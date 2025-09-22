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

// Setup Replicate
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

// Fungsi untuk mencari definisi dalam teks dengan multiple approaches
function findDefinitionInText(text: string, keyword: string): string[] {
  const definitions: string[] = [];
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  
  // Pattern 1: "Keyword adalah..."
  const pattern1 = new RegExp(`${lowerKeyword}\\s+(?:adalah|yaitu|merupakan|ialah)\\s+([^.!?]+[.!?])`, 'gi');
  const matches1 = text.match(pattern1);
  if (matches1) definitions.push(...matches1);
  
  // Pattern 2: "Keyword: definisi..."
  const pattern2 = new RegExp(`${lowerKeyword}\\s*[:;]\\s*([^.!?]+[.!?])`, 'gi');
  const matches2 = text.match(pattern2);
  if (matches2) definitions.push(...matches2);
  
  // Pattern 3: "Definisi keyword..."
  const pattern3 = new RegExp(`(?:definisi|pengertian|arti)\\s+${lowerKeyword}\\s+(?:adalah|yaitu|merupakan|ialah)\\s+([^.!?]+[.!?])`, 'gi');
  const matches3 = text.match(pattern3);
  if (matches3) definitions.push(...matches3);
  
  // Pattern 4: Cari dalam kalimat yang mengandung keyword
  const sentences = text.split(/[.!?]+/);
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(lowerKeyword) && 
        (sentence.toLowerCase().includes('adalah') || 
         sentence.toLowerCase().includes('yaitu') ||
         sentence.toLowerCase().includes('merupakan'))) {
      definitions.push(sentence.trim() + '.');
    }
  }
  
  return [...new Set(definitions)]; // Remove duplicates
}

// Fungsi untuk generate sitasi in-text dengan parafrase yang terintegrasi
function generateInTextCitation(paraphrased: string, author: string, year: number, format: string): string {
  // Parse multiple authors
  const authors = author.split(/[,&]/).map(a => a.trim()).filter(a => a.length > 0);
  
  // Extract last names
  const getLastName = (authorName: string): string => {
    const parts = authorName.trim().split(/[\s,]+/);
    if (authorName.includes(',')) {
      // Format "Smith, J. D." -> "Smith"
      return parts[0];
    } else {
      // Format "John Doe Smith" -> "Smith"
      return parts[parts.length - 1];
    }
  };

  const lastNames = authors.map(getLastName);
  
  let citationText = '';
  
  switch (format.toUpperCase()) {
    case 'APA':
      if (lastNames.length === 1) {
        citationText = `Menurut ${lastNames[0]} (${year}), ${paraphrased.toLowerCase()}`;
      } else if (lastNames.length === 2) {
        citationText = `Menurut ${lastNames[0]} dan ${lastNames[1]} (${year}), ${paraphrased.toLowerCase()}`;
      } else {
        citationText = `Menurut ${lastNames[0]} et al. (${year}), ${paraphrased.toLowerCase()}`;
      }
      break;
    
    case 'MLA':
      if (lastNames.length === 1) {
        citationText = `${paraphrased} (${lastNames[0]} ${year}).`;
      } else if (lastNames.length === 2) {
        citationText = `${paraphrased} (${lastNames[0]} dan ${lastNames[1]} ${year}).`;
      } else {
        citationText = `${paraphrased} (${lastNames[0]} et al. ${year}).`;
      }
      break;
    
    case 'CHICAGO':
      if (lastNames.length === 1) {
        citationText = `Seperti yang dijelaskan oleh ${lastNames[0]} (${year}), ${paraphrased.toLowerCase()}`;
      } else if (lastNames.length === 2) {
        citationText = `Seperti yang dijelaskan oleh ${lastNames[0]} dan ${lastNames[1]} (${year}), ${paraphrased.toLowerCase()}`;
      } else {
        citationText = `Seperti yang dijelaskan oleh ${lastNames[0]} et al. (${year}), ${paraphrased.toLowerCase()}`;
      }
      break;
    
    default:
      // Default ke APA
      if (lastNames.length === 1) {
        citationText = `Menurut ${lastNames[0]} (${year}), ${paraphrased.toLowerCase()}`;
      } else if (lastNames.length === 2) {
        citationText = `Menurut ${lastNames[0]} dan ${lastNames[1]} (${year}), ${paraphrased.toLowerCase()}`;
      } else {
        citationText = `Menurut ${lastNames[0]} et al. (${year}), ${paraphrased.toLowerCase()}`;
      }
  }
  
  return citationText;
}

// Fungsi untuk generate bibliography/reference list
function generateBibliography(filename: string, author: string, year: number, format: string): string {
  const cleanFilename = filename.replace(/\.(pdf|docx|txt)$/i, '');
  const formattedTitle = cleanFilename
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  
  switch (format.toUpperCase()) {
    case 'APA':
      return `${author} (${year}). ${formattedTitle}. Dokumen Akademik.`;
    
    case 'MLA':
      return `${author}. "${formattedTitle}." Dokumen Akademik, ${year}.`;
    
    case 'CHICAGO':
      return `${author}. "${formattedTitle}." Dokumen Akademik, ${year}.`;
    
    default:
      return `${author} (${year}). ${formattedTitle}. Dokumen Akademik.`;
  }
}

// Fungsi untuk membuat prompt yang lebih baik
function createImprovedPrompt(text: string, keyword: string, citationFormat: string): string {
  const textSegments = text.split(/\n\n|\.\s+/);
  const relevantSegments = textSegments.filter(segment => 
    segment.toLowerCase().includes(keyword.toLowerCase())
  ).slice(0, 5);
  
  const relevantText = relevantSegments.length > 0 
    ? relevantSegments.join('\n\n')
    : text.substring(0, 2000);

  return `Anda adalah asisten AI yang ahli dalam analisis dokumen akademik. Tugas Anda adalah mencari dan menganalisis definisi kata kunci dalam teks dokumen.

INSTRUKSI:
1. Cari definisi kata kunci "${keyword}" dalam teks berikut
2. Berikan jawaban dalam bahasa Indonesia yang baik dan benar
3. Jika definisi ditemukan, parafrasekan dengan gaya akademik
4. Jika tidak ditemukan, jelaskan dengan jelas

TEKS DOKUMEN:
${relevantText}

KATA KUNCI: ${keyword}

FORMAT JAWABAN (WAJIB DIIKUTI):
DITEMUKAN: [Ya/Tidak]
DEFINISI_ASLI: [kutip langsung definisi dari teks, atau "Tidak ditemukan"]
PARAFRASE: [parafrase akademis dalam bahasa Indonesia, atau penjelasan bahwa tidak ditemukan]

JAWABAN:`;
}

// Upload document dengan keyword, author, dan year
router.post('/upload', verifyToken, upload.single('document'), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File tidak ditemukan' });
  }

  const { keyword, author, year, citationFormat } = req.body;
  
  // Validasi input
  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: 'Kata kunci wajib diisi' });
  }
  
  if (!author || !author.trim()) {
    return res.status(400).json({ error: 'Nama penulis wajib diisi' });
  }
  
  if (!year || isNaN(Number(year)) || Number(year) < 1900 || Number(year) > new Date().getFullYear() + 5) {
    return res.status(400).json({ error: 'Tahun publikasi tidak valid' });
  }

  try {
    const extractedText = await extractText(req.file.buffer, req.file.mimetype);
    
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'Tidak ada teks yang bisa diekstrak' });
    }

    const sql = neon(process.env.DATABASE_URL!);
    
    const result = await sql`
      INSERT INTO documents (user_id, filename, original_text, citation_format, keyword, author, publication_year)
      VALUES (${req.userId}, ${req.file.originalname}, ${extractedText}, ${citationFormat || 'APA'}, ${keyword.trim()}, ${author.trim()}, ${Number(year)})
      RETURNING id, filename, original_text, keyword, author, publication_year
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

// Process document dengan AI yang diperbaiki
router.post('/process', verifyToken, async (req: AuthRequest, res) => {
  const { documentId } = req.body;

  if (!documentId) {
    return res.status(400).json({ error: 'Document ID wajib diisi' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    const documents = await sql`
      SELECT * FROM documents 
      WHERE id = ${documentId} AND user_id = ${req.userId}
    `;
    
    if (documents.length === 0) {
      return res.status(404).json({ error: 'Dokumen tidak ditemukan' });
    }

    const doc = documents[0];
    
    // Coba cari definisi dengan pattern matching dulu
    const foundDefinitions = findDefinitionInText(doc.original_text, doc.keyword);
    
    let definisiAsli = '';
    let paraphrased = '';
    let citation = '';
    let found = false;
    
    if (foundDefinitions.length > 0) {
      // Jika ditemukan dengan pattern matching
      found = true;
      definisiAsli = foundDefinitions[0];
      
      // Gunakan AI untuk parafrase
      const improvedPrompt = `Parafrasekan definisi berikut dalam bahasa Indonesia yang akademis dan formal:

DEFINISI ASLI: "${definisiAsli}"
KATA KUNCI: "${doc.keyword}"

Berikan parafrase yang:
1. Menggunakan bahasa Indonesia yang baik dan benar
2. Mempertahankan makna asli
3. Menggunakan gaya penulisan akademik
4. Tidak menggunakan kutipan langsung

PARAFRASE:`;

      const input = {
        prompt: improvedPrompt,
        max_tokens: 3000,
        temperature: 0.2,
        top_p: 0.9,
        stream: false
      };

      console.log('Calling Replicate for paraphrasing...');
      const output = await replicate.run("ibm-granite/granite-3.3-8b-instruct", { input });
      const result = Array.isArray(output) ? output.join("") : String(output);
      
      paraphrased = result.trim();
      
    } else {
      // Jika tidak ditemukan dengan pattern, coba dengan AI
      const improvedPrompt = createImprovedPrompt(doc.original_text, doc.keyword, doc.citation_format);
      
      const input = {
        prompt: improvedPrompt,
        max_tokens: 4000,
        temperature: 0.1,
        top_p: 0.8,
        stream: false
      };

      console.log('Calling Replicate for full analysis...');
      const output = await replicate.run("ibm-granite/granite-3.3-8b-instruct", { input });
      const result = Array.isArray(output) ? output.join("") : String(output);
      
      console.log('AI Response:', result);
      
      // Parse hasil dengan lebih robust
      const lines = result.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      for (const line of lines) {
        if (line.toLowerCase().includes('ditemukan:')) {
          found = line.toLowerCase().includes('ya') || line.toLowerCase().includes('yes');
        } else if (line.includes('DEFINISI_ASLI:')) {
          definisiAsli = line.replace(/DEFINISI_ASLI:\s*/i, '').trim();
          if (definisiAsli.toLowerCase().includes('tidak ditemukan')) {
            definisiAsli = '';
          }
        } else if (line.includes('PARAFRASE:')) {
          paraphrased = line.replace(/PARAFRASE:\s*/i, '').trim();
        }
      }
      
      // Jika parsing gagal, buat fallback yang lebih baik
      if (!paraphrased) {
        if (result.toLowerCase().includes('tidak ditemukan') || 
            result.toLowerCase().includes('not found')) {
          found = false;
          paraphrased = `Berdasarkan analisis dokumen "${doc.filename}", definisi spesifik untuk kata kunci "${doc.keyword}" tidak ditemukan dalam teks yang tersedia.`;
        } else {
          // Ambil bagian yang paling relevan dari response
          const cleanResult = result.replace(/DITEMUKAN:|DEFINISI_ASLI:|PARAFRASE:/gi, '').trim();
          paraphrased = cleanResult || `Analisis dokumen untuk kata kunci "${doc.keyword}" telah dilakukan.`;
        }
      }
    }
    
    // Generate sitasi in-text dengan parafrase dan bibliography
    const inTextCitation = generateInTextCitation(paraphrased, doc.author, doc.publication_year, doc.citation_format);
    const bibliography = generateBibliography(doc.filename, doc.author, doc.publication_year, doc.citation_format);
    citation = inTextCitation;
    
    // Bersihkan hasil
    if (definisiAsli.startsWith('"') && definisiAsli.endsWith('"')) {
      definisiAsli = definisiAsli.slice(1, -1);
    }
    
    // Pastikan parafrase dalam bahasa Indonesia
    if (paraphrased && paraphrased.trim().length > 0) {
      // Jika terdeteksi masih bahasa Inggris, buat ulang
      const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
      const wordCount = paraphrased.split(' ').length;
      const englishWordCount = englishWords.filter(word => 
        paraphrased.toLowerCase().includes(` ${word} `)
      ).length;
      
      if (englishWordCount > wordCount * 0.1) { // Jika lebih dari 10% kata Inggris
        if (found && definisiAsli) {
          paraphrased = `Menurut dokumen, ${doc.keyword} didefinisikan sebagai konsep yang dijelaskan dalam teks sumber. Definisi ini memberikan pemahaman tentang karakteristik dan sifat dari ${doc.keyword}.`;
        } else {
          paraphrased = `Dalam dokumen "${doc.filename}", tidak ditemukan definisi eksplisit untuk kata kunci "${doc.keyword}".`;
        }
      }
    }
    
    // Update dokumen dengan semua data termasuk author dan year
    await sql`
      UPDATE documents 
      SET paraphrased = ${paraphrased}, citation = ${citation}, 
          definition_found = ${found}, original_definition = ${definisiAsli}
      WHERE id = ${documentId}
    `;
    
    res.status(200).json({
      message: 'Dokumen berhasil diproses',
      result: {
        keyword: doc.keyword,
        author: doc.author,
        publicationYear: doc.publication_year,
        definitionFound: found,
        originalDefinition: definisiAsli,
        paraphrased: paraphrased,
        inTextCitation: inTextCitation,
        bibliography: bibliography,
        citationFormat: doc.citation_format
      }
    });
    
  } catch (error) {
    console.error('Process error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: errorMessage,
      stack: error instanceof Error ? error.stack : 'No stack'
    });
    
    res.status(500).json({ 
      error: 'Gagal memproses dokumen: ' + errorMessage,
      details: errorMessage
    });
  }
});

// Get history dengan data author dan year
router.get('/history', verifyToken, async (req: AuthRequest, res) => {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    const documents = await sql`
      SELECT id, filename, keyword, citation_format, paraphrased, citation, 
             definition_found, original_definition, author, publication_year, created_at
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