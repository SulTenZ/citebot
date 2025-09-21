// backend/routes/documents.ts
import express from 'express';
import multer from 'multer';
import { createRequire } from 'module';
import mammoth from 'mammoth';
import Replicate from 'replicate';
import { neon } from '@neondatabase/serverless';
import { verifyToken, AuthRequest } from '../middleware/auth.js';

// Fix untuk require() dalam ES modules
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const router = express.Router();

// Setup multer
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipe file tidak didukung'));
    }
  }
});

// Setup Replicate sesuai dokumentasi
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

async function extractText(buffer: Buffer, mimetype: string): Promise<string> {
  try {
    switch (mimetype) {
      case 'application/pdf':
        const pdfData = await pdfParse(buffer);
        return pdfData.text;
      
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        const docxResult = await mammoth.extractRawText({ buffer });
        return docxResult.value;
      
      case 'text/plain':
        return buffer.toString('utf-8');
      
      default:
        throw new Error('Tipe file tidak didukung');
    }
  } catch (error) {
    console.error('Error extracting text:', error);
    throw new Error('Gagal mengekstrak teks dari file');
  }
}

// Upload document dengan keyword
router.post('/upload', verifyToken, upload.single('document'), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File tidak ditemukan' });
  }

  const keyword = req.body.keyword;
  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: 'Kata kunci wajib diisi' });
  }

  try {
    // Extract text dari file
    const extractedText = await extractText(req.file.buffer, req.file.mimetype);
    
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'Tidak ada teks yang bisa diekstrak' });
    }

    const sql = neon(process.env.DATABASE_URL!);
    
    // Simpan dokumen dengan keyword
    const result = await sql`
      INSERT INTO documents (user_id, filename, original_text, citation_format, keyword)
      VALUES (${req.userId}, ${req.file.originalname}, ${extractedText}, ${req.body.citationFormat || 'APA'}, ${keyword.trim()})
      RETURNING id, filename, original_text, keyword
    `;
    
    res.status(200).json({
      message: 'Upload berhasil',
      document: result[0]
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Gagal memproses file' });
  }
});

// Process document dengan Replicate API yang benar
router.post('/process', verifyToken, async (req: AuthRequest, res) => {
  const { documentId } = req.body;

  if (!documentId) {
    return res.status(400).json({ error: 'Document ID wajib diisi' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    // Ambil dokumen
    const documents = await sql`
      SELECT * FROM documents 
      WHERE id = ${documentId} AND user_id = ${req.userId}
    `;
    
    if (documents.length === 0) {
      return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    }

    const doc = documents[0];
    
    // Prompt yang lebih singkat dan efisien
    const prompt = `Cari definisi "${doc.keyword}" dalam teks ini:

"${doc.original_text.substring(0, 1000)}"

Jawab format:
FOUND: Yes/No
ORIGINAL: [kutip definisi jika ada]
PARAPHRASE: [parafrase akademis]
CITATION: [${doc.citation_format} format]`;

    // Input yang lebih hemat credit
    const input = {
      prompt: prompt,
      max_tokens: 5000, // Dikurangi untuk hemat credit
      temperature: 0.3,
      top_p: 0.9,
      top_k: 50,
      stream: false
    };

    console.log('Calling Replicate API...');
    
    // Gunakan replicate.run() sesuai dokumentasi
    const output = await replicate.run("ibm-granite/granite-3.3-8b-instruct", { input });
    
    console.log('Replicate response:', output);
    
    // Process output - sesuai dokumentasi, output adalah array
    const result = Array.isArray(output) ? output.join("") : String(output);
    
    console.log('Processed result:', result);
    
    // Parse hasil dengan format yang lebih sederhana
    let definisiAsli = '';
    let paraphrased = '';
    let citation = '';
    let found = false;
    
    // Cek apakah found
    if (result.toLowerCase().includes('found: yes') || result.toLowerCase().includes('ditemukan: ya')) {
      found = true;
    }
    
    // Extract ORIGINAL
    const originalMatch = result.match(/ORIGINAL:\s*(.*?)(?=PARAPHRASE:|$)/is);
    if (originalMatch) {
      definisiAsli = originalMatch[1].trim();
    }
    
    // Extract PARAPHRASE
    const paraphraseMatch = result.match(/PARAPHRASE:\s*(.*?)(?=CITATION:|$)/is);
    if (paraphraseMatch) {
      paraphrased = paraphraseMatch[1].trim();
    }
    
    // Extract CITATION
    const citationMatch = result.match(/CITATION:\s*(.*?)$/is);
    if (citationMatch) {
      citation = citationMatch[1].trim();
    }
    
    // Fallback jika parsing gagal
    if (!paraphrased) {
      if (found) {
        paraphrased = `Berdasarkan analisis dokumen, definisi ${doc.keyword} telah ditemukan dan diidentifikasi.`;
        citation = `${doc.filename.replace('.pdf', '')} (${new Date().getFullYear()}). Definisi ${doc.keyword}. Format ${doc.citation_format}.`;
      } else {
        paraphrased = `Definisi "${doc.keyword}" tidak ditemukan dalam dokumen "${doc.filename}".`;
        citation = `${doc.filename} - Kata kunci "${doc.keyword}" tidak ditemukan.`;
      }
    }
    
    // Bersihkan hasil
    definisiAsli = definisiAsli.trim();
    paraphrased = paraphrased.trim();
    citation = citation.trim();
    
    // Update dokumen dengan hasil AI
    await sql`
      UPDATE documents 
      SET paraphrased = ${paraphrased}, citation = ${citation}, 
          definition_found = ${found}, original_definition = ${definisiAsli}
      WHERE id = ${documentId}
    `;
    
    res.status(200).json({
      message: 'Dokumen berhasil diproses dengan AI',
      result: {
        keyword: doc.keyword,
        definitionFound: found,
        originalDefinition: definisiAsli,
        paraphrased,
        citation,
        citationFormat: doc.citation_format,
        rawAIResponse: result.substring(0, 500) // Debug info
      }
    });
    
  } catch (error) {
    console.error('Process error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log detail error untuk debugging
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    res.status(500).json({ 
      error: 'AI gagal memproses dokumen: ' + errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get history
router.get('/history', verifyToken, async (req: AuthRequest, res) => {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    const documents = await sql`
      SELECT id, filename, keyword, citation_format, paraphrased, citation, 
             definition_found, original_definition, created_at
      FROM documents
      WHERE user_id = ${req.userId}
      ORDER BY created_at DESC
    `;
    
    res.status(200).json({
      documents
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Gagal mengambil riwayat dokumen' });
  }
});

export default router;