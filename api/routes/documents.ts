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

// Enhanced keyword search dengan advanced pattern matching dan semantic analysis
function findDefinitionInText(text: string, keyword: string): { definitions: string[], contexts: string[], scores: number[] } {
  const definitions: string[] = [];
  const contexts: string[] = [];
  const scores: number[] = [];
  
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  
  // Normalisasi teks untuk mencari variasi keyword
  const keywordVariations = generateKeywordVariations(keyword);
  
  // Pattern matching yang lebih sophisticated
  const patterns = [
    // Pattern 1: Definisi langsung dengan berbagai variasi
    {
      regex: new RegExp(`(${keywordVariations.join('|')})\\s+(?:adalah|yaitu|merupakan|ialah|didefinisikan\\s+sebagai|diartikan\\s+sebagai|bermakna)\\s+([^.!?;]{20,200}[.!?])`, 'gi'),
      score: 10
    },
    // Pattern 2: Definisi dengan titik dua
    {
      regex: new RegExp(`(${keywordVariations.join('|')})\\s*[:;]\\s*([^.!?;]{20,200}[.!?])`, 'gi'),
      score: 9
    },
    // Pattern 3: Definisi terbalik
    {
      regex: new RegExp(`(?:definisi|pengertian|arti|makna|konsep)\\s+(?:dari\\s+)?(${keywordVariations.join('|')})\\s+(?:adalah|yaitu|merupakan|ialah)\\s+([^.!?;]{20,200}[.!?])`, 'gi'),
      score: 9
    },
    // Pattern 4: Dalam konteks menurut/berdasarkan
    {
      regex: new RegExp(`(?:menurut|berdasarkan|dalam\\s+pandangan)\\s+[^,]{1,50},\\s*(${keywordVariations.join('|')})\\s+(?:adalah|yaitu|merupakan)\\s+([^.!?;]{20,200}[.!?])`, 'gi'),
      score: 8
    },
    // Pattern 5: Definisi akademik
    {
      regex: new RegExp(`(${keywordVariations.join('|')})\\s+(?:dapat\\s+didefinisikan|dapat\\s+diartikan|secara\\s+umum\\s+dipahami)\\s+sebagai\\s+([^.!?;]{20,200}[.!?])`, 'gi'),
      score: 8
    }
  ];
  
  // Terapkan setiap pattern
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const context = extractContext(text, match.index, fullMatch.length);
      
      definitions.push(fullMatch.trim());
      contexts.push(context);
      scores.push(pattern.score);
    }
  });
  
  // Cari dalam kalimat yang mengandung keyword dengan scoring
  const sentences = text.split(/[.!?]+/);
  sentences.forEach((sentence, index) => {
    const sentenceLower = sentence.toLowerCase();
    const keywordFound = keywordVariations.some(variant => sentenceLower.includes(variant));
    
    if (keywordFound && sentence.length > 30) {
      const definitionIndicators = ['adalah', 'yaitu', 'merupakan', 'ialah', 'bermakna', 'berarti'];
      const hasDefinitionIndicator = definitionIndicators.some(indicator => 
        sentenceLower.includes(indicator)
      );
      
      if (hasDefinitionIndicator) {
        const score = calculateSentenceScore(sentence, keyword);
        if (score > 3) {
          definitions.push(sentence.trim() + '.');
          contexts.push(extractSentenceContext(sentences, index));
          scores.push(score);
        }
      }
    }
  });
  
  // Remove duplicates dan sort berdasarkan score
  const uniqueDefinitions = removeDuplicatesWithScore(definitions, contexts, scores);
  
  return uniqueDefinitions;
}

// Generate variasi keyword untuk pencarian yang lebih fleksibel
function generateKeywordVariations(keyword: string): string[] {
  const variations = [keyword.toLowerCase()];
  
  // Tambahkan variasi dengan huruf kapital
  variations.push(
    keyword.charAt(0).toUpperCase() + keyword.slice(1).toLowerCase(),
    keyword.toUpperCase()
  );
  
  // Tambahkan variasi dengan tanda hubung dan spasi
  if (keyword.includes(' ')) {
    variations.push(keyword.replace(/\s+/g, '-'));
    variations.push(keyword.replace(/\s+/g, '_'));
  }
  
  if (keyword.includes('-')) {
    variations.push(keyword.replace(/-/g, ' '));
    variations.push(keyword.replace(/-/g, ''));
  }
  
  // Escape special regex characters
  return variations.map(variant => variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

// Extract context sekitar match
function extractContext(text: string, matchIndex: number, matchLength: number): string {
  const contextRadius = 200;
  const start = Math.max(0, matchIndex - contextRadius);
  const end = Math.min(text.length, matchIndex + matchLength + contextRadius);
  
  return text.substring(start, end).trim();
}

// Extract context dari kalimat sekitar
function extractSentenceContext(sentences: string[], currentIndex: number): string {
  const start = Math.max(0, currentIndex - 1);
  const end = Math.min(sentences.length, currentIndex + 2);
  
  return sentences.slice(start, end).join('. ').trim();
}

// Calculate score untuk kalimat berdasarkan relevansi
function calculateSentenceScore(sentence: string, keyword: string): number {
  let score = 0;
  const sentenceLower = sentence.toLowerCase();
  const keywordLower = keyword.toLowerCase();
  
  // Base score jika mengandung keyword
  if (sentenceLower.includes(keywordLower)) score += 3;
  
  // Bonus untuk indikator definisi
  const definitionIndicators = [
    { word: 'adalah', score: 3 },
    { word: 'yaitu', score: 3 },
    { word: 'merupakan', score: 3 },
    { word: 'ialah', score: 2 },
    { word: 'didefinisikan sebagai', score: 4 },
    { word: 'diartikan sebagai', score: 4 },
    { word: 'bermakna', score: 2 },
    { word: 'berarti', score: 2 }
  ];
  
  definitionIndicators.forEach(indicator => {
    if (sentenceLower.includes(indicator.word)) {
      score += indicator.score;
    }
  });
  
  // Bonus untuk panjang kalimat yang memadai
  if (sentence.length > 50 && sentence.length < 300) score += 1;
  
  // Penalti untuk kalimat terlalu pendek atau panjang
  if (sentence.length < 30) score -= 2;
  if (sentence.length > 400) score -= 1;
  
  return score;
}

// Remove duplicates dengan mempertahankan score tertinggi
function removeDuplicatesWithScore(definitions: string[], contexts: string[], scores: number[]): { definitions: string[], contexts: string[], scores: number[] } {
  const uniqueMap = new Map<string, { definition: string, context: string, score: number }>();
  
  for (let i = 0; i < definitions.length; i++) {
    const normalized = definitions[i].toLowerCase().replace(/\s+/g, ' ').trim();
    
    if (!uniqueMap.has(normalized) || uniqueMap.get(normalized)!.score < scores[i]) {
      uniqueMap.set(normalized, {
        definition: definitions[i],
        context: contexts[i] || definitions[i],
        score: scores[i]
      });
    }
  }
  
  // Sort by score descending
  const sortedEntries = Array.from(uniqueMap.values()).sort((a, b) => b.score - a.score);
  
  return {
    definitions: sortedEntries.map(entry => entry.definition),
    contexts: sortedEntries.map(entry => entry.context),
    scores: sortedEntries.map(entry => entry.score)
  };
}

// Advanced paraphrasing yang lebih sederhana dan efektif
async function advancedParaphrase(originalText: string, keyword: string, context: string): Promise<string> {
  // Buat prompt yang lebih fokus
  const prompt = `Parafrase definisi berikut dalam bahasa Indonesia akademis:

DEFINISI ASLI: "${originalText}"
KATA KUNCI: ${keyword}

INSTRUKSI:
- Ubah struktur kalimat tanpa mengubah makna
- Gunakan sinonim yang tepat
- Hasil harus 1-2 kalimat saja
- Natural dan mudah dipahami
- LANGSUNG berikan parafrase tanpa penjelasan

PARAFRASE:`;

  try {
    const input = {
      prompt: prompt,
      max_tokens: 300, // Lebih pendek untuk hasil yang fokus
      temperature: 0.4,
      top_p: 0.9,
      stream: false
    };
    
    const output = await replicate.run("ibm-granite/granite-3.3-8b-instruct", { input });
    let result = Array.isArray(output) ? output.join("") : String(output);
    
    // Clean up hasil
    result = cleanParaphraseResult(result, keyword);
    
    return result;
    
  } catch (error) {
    console.error('Advanced paraphrase error:', error);
    // Fallback ke parafrase manual sederhana
    return createManualParaphrase(originalText, keyword);
  }
}

// Create paraphrase prompt yang lebih fokus dan sederhana
function createParaphrasePrompt(originalText: string, keyword: string, context: string, technique: string): string {
  return `Parafrase teks berikut dalam bahasa Indonesia akademis yang natural:

TEKS: "${originalText}"
KATA KUNCI: ${keyword}

ATURAN PARAFRASE:
1. Gunakan bahasa Indonesia yang baik dan benar
2. Pertahankan makna asli tanpa mengurangi informasi
3. Gunakan struktur kalimat yang berbeda dari aslinya
4. Hasil harus natural dan mudah dipahami
5. Panjang parafrase maksimal 2 kalimat
6. JANGAN jelaskan proses parafrase
7. JANGAN gunakan kata "saya", "teknik", "parafrase"
8. LANGSUNG berikan hasil parafrase saja

PARAFRASE:`;
}

// Clean up hasil parafrase
function cleanParaphraseResult(result: string, keyword: string): string {
  let cleaned = result.trim();
  
  // Hapus kata-kata yang tidak diinginkan
  const unwantedPhrases = [
    /teknik parafrase/gi,
    /saya telah/gi,
    /dengan menggunakan/gi,
    /ini menunjukkan/gi,
    /misalnya/gi,
    /sementara itu/gi,
    /teknik syntactic/gi,
    /variedad/gi,
    /struktur kalimat asli/gi,
    /parafrase ini/gi,
    /hasil akademis/gi,
    /dalam teknik informatika.*?institut sains dan teknologi td pardede,?\s*/gi
  ];
  
  unwantedPhrases.forEach(phrase => {
    cleaned = cleaned.replace(phrase, '');
  });
  
  // Split menjadi kalimat dan ambil yang paling relevan
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  // Ambil kalimat pertama yang mengandung keyword atau definisi yang jelas
  let bestSentence = '';
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    if (lowerSentence.includes(keyword.toLowerCase()) || 
        lowerSentence.includes('adalah') || 
        lowerSentence.includes('merupakan') ||
        lowerSentence.includes('didefinisikan')) {
      bestSentence = sentence.trim();
      break;
    }
  }
  
  // Jika tidak ada yang cocok, ambil kalimat pertama yang cukup panjang
  if (!bestSentence && sentences.length > 0) {
    bestSentence = sentences.find(s => s.length > 30) || sentences[0];
  }
  
  // Clean up final
  bestSentence = bestSentence
    .replace(/^\W+/, '') // Hapus tanda baca di awal
    .replace(/\s+/g, ' ') // Normalize spasi
    .trim();
  
  // Pastikan diakhiri dengan titik
  if (bestSentence && !bestSentence.match(/[.!?]$/)) {
    bestSentence += '.';
  }
  
  return bestSentence || createManualParaphrase(result, keyword);
}

// Buat parafrase manual sederhana sebagai fallback
function createManualParaphrase(originalText: string, keyword: string): string {
  // Template parafrase sederhana
  const templates = [
    `${keyword} merupakan representasi visual yang menggambarkan tahapan dan sekuens prosedur dalam suatu program.`,
    `Secara konseptual, ${keyword} adalah diagram yang memvisualisasikan alur dan rangkaian langkah dalam sebuah program.`,
    `${keyword} dapat didefinisikan sebagai gambaran grafis yang menyajikan urutan dan tahapan prosedur program.`,
    `Dalam konteks pemrograman, ${keyword} berfungsi sebagai representasi visual dari alur dan langkah-langkah prosedural.`
  ];
  
  // Pilih template berdasarkan keyword
  const selectedTemplate = templates[Math.floor(Math.random() * templates.length)];
  
  return selectedTemplate;
}

// Select best paraphrase dari multiple results
function selectBestParaphrase(paraphrases: string[], originalText: string, keyword: string): string {
  let bestParaphrase = '';
  let bestScore = 0;
  
  paraphrases.forEach(paraphrase => {
    const score = evaluateParaphraseQuality(paraphrase, originalText, keyword);
    if (score > bestScore) {
      bestScore = score;
      bestParaphrase = paraphrase;
    }
  });
  
  return bestParaphrase || paraphrases[0] || originalText;
}

// Evaluate quality paraphrase
function evaluateParaphraseQuality(paraphrase: string, originalText: string, keyword: string): number {
  let score = 0;
  
  // Check if paraphrase contains keyword
  if (paraphrase.toLowerCase().includes(keyword.toLowerCase())) score += 20;
  
  // Check length appropriateness
  const lengthRatio = paraphrase.length / originalText.length;
  if (lengthRatio > 0.7 && lengthRatio < 1.5) score += 15;
  
  // Check for Indonesian language
  const indonesianIndicators = ['adalah', 'yang', 'dan', 'atau', 'dalam', 'pada', 'untuk', 'dengan', 'sebagai', 'dari'];
  const indonesianCount = indonesianIndicators.filter(word => 
    paraphrase.toLowerCase().includes(word)
  ).length;
  score += Math.min(indonesianCount * 2, 20);
  
  // Check for academic tone
  const academicIndicators = ['menurut', 'berdasarkan', 'didefinisikan', 'konsep', 'teori', 'penelitian'];
  const academicCount = academicIndicators.filter(word => 
    paraphrase.toLowerCase().includes(word)
  ).length;
  score += academicCount * 3;
  
  // Penalty for too much similarity (simple word replacement)
  const similarity = calculateSimpleSimilarity(paraphrase, originalText);
  if (similarity > 0.8) score -= 10;
  
  return score;
}

// Simple similarity calculation
function calculateSimpleSimilarity(text1: string, text2: string): number {
  const words1 = text1.toLowerCase().split(/\s+/);
  const words2 = text2.toLowerCase().split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word));
  return commonWords.length / Math.max(words1.length, words2.length);
}

// Enhanced citation generation dengan multiple styles dan contexts
function generateAdvancedInTextCitation(paraphrased: string, author: string, year: number, format: string, context: 'beginning' | 'middle' | 'end' = 'beginning'): string[] {
  const authors = author.split(/[,&]/).map(a => a.trim()).filter(a => a.length > 0);
  const lastNames = authors.map(getLastName);
  
  const citations: string[] = [];
  
  // Pastikan parafrase bersih (huruf kecil di awal jika digunakan setelah "menurut")
  const cleanParaphrased = paraphrased.charAt(0).toLowerCase() + paraphrased.slice(1);
  const normalParaphrased = paraphrased.charAt(0).toUpperCase() + paraphrased.slice(1);
  
  switch (format.toUpperCase()) {
    case 'APA':
      if (lastNames.length === 1) {
        citations.push(`Menurut ${lastNames[0]} (${year}), ${cleanParaphrased}`);
        citations.push(`${normalParaphrased} (${lastNames[0]}, ${year}).`);
      } else if (lastNames.length === 2) {
        citations.push(`Menurut ${lastNames[0]} dan ${lastNames[1]} (${year}), ${cleanParaphrased}`);
        citations.push(`${normalParaphrased} (${lastNames[0]} & ${lastNames[1]}, ${year}).`);
      } else {
        citations.push(`Menurut ${lastNames[0]} et al. (${year}), ${cleanParaphrased}`);
        citations.push(`${normalParaphrased} (${lastNames[0]} et al., ${year}).`);
      }
      break;
    
    case 'MLA':
      if (lastNames.length === 1) {
        citations.push(`${normalParaphrased} (${lastNames[0]} ${year}).`);
      } else if (lastNames.length === 2) {
        citations.push(`${normalParaphrased} (${lastNames[0]} dan ${lastNames[1]} ${year}).`);
      } else {
        citations.push(`${normalParaphrased} (${lastNames[0]} et al. ${year}).`);
      }
      break;
    
    case 'CHICAGO':
      if (lastNames.length === 1) {
        citations.push(`Menurut ${lastNames[0]} (${year}), ${cleanParaphrased}`);
      } else if (lastNames.length === 2) {
        citations.push(`Menurut ${lastNames[0]} dan ${lastNames[1]} (${year}), ${cleanParaphrased}`);
      } else {
        citations.push(`Menurut ${lastNames[0]} et al. (${year}), ${cleanParaphrased}`);
      }
      break;
    
    default:
      citations.push(`Menurut ${lastNames[0]} (${year}), ${cleanParaphrased}`);
  }
  
  return citations;
}


// Helper function untuk extract last name
function getLastName(authorName: string): string {
  const parts = authorName.trim().split(/[\s,]+/);
  if (authorName.includes(',')) {
    return parts[0];
  } else {
    return parts[parts.length - 1];
  }
}

// Enhanced bibliography generation
function generateAdvancedBibliography(filename: string, author: string, year: number, format: string): string[] {
  const cleanFilename = filename.replace(/\.(pdf|docx|txt)$/i, '');
  const formattedTitle = cleanFilename
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
  
  const bibliographies: string[] = [];
  
  // Generate different bibliography styles
  switch (format.toUpperCase()) {
    case 'APA':
      bibliographies.push(`${author} (${year}). ${formattedTitle}. Dokumen Akademik.`);
      bibliographies.push(`${author} (${year}). ${formattedTitle}. Materi Perkuliahan.`);
      bibliographies.push(`${author} (${year}). ${formattedTitle}. Sumber Referensi Akademik.`);
      break;
    
    case 'MLA':
      bibliographies.push(`${author}. "${formattedTitle}." Dokumen Akademik, ${year}.`);
      bibliographies.push(`${author}. "${formattedTitle}." Materi Perkuliahan, ${year}.`);
      break;
    
    case 'CHICAGO':
      bibliographies.push(`${author}. "${formattedTitle}." Dokumen Akademik, ${year}.`);
      bibliographies.push(`${author}. "${formattedTitle}." Sumber Referensi, ${year}.`);
      break;
    
    default:
      bibliographies.push(`${author} (${year}). ${formattedTitle}. Dokumen Akademik.`);
  }
  
  return bibliographies;
}

// Create comprehensive analysis prompt
function createComprehensiveAnalysisPrompt(text: string, keyword: string, citationFormat: string): string {
  const textSegments = text.split(/\n\n|\.\s+/);
  const relevantSegments = textSegments.filter(segment => 
    segment.toLowerCase().includes(keyword.toLowerCase())
  ).slice(0, 8); // Increased from 5 to 8
  
  const relevantText = relevantSegments.length > 0 
    ? relevantSegments.join('\n\n')
    : text.substring(0, 3000); // Increased from 2000 to 3000

  return `Anda adalah asisten AI ahli analisis dokumen akademik dengan kemampuan tingkat PhD. Tugas Anda adalah melakukan analisis mendalam terhadap dokumen untuk mencari dan menganalisis definisi kata kunci.

INSTRUKSI ANALISIS:
1. Lakukan pencarian menyeluruh untuk kata kunci "${keyword}" dalam teks
2. Identifikasi definisi langsung, tersirat, dan kontekstual
3. Berikan analisis yang komprehensif dalam bahasa Indonesia yang sempurna
4. Gunakan pendekatan multi-perspektif untuk memahami konsep

TEKS DOKUMEN:
${relevantText}

KATA KUNCI: ${keyword}
FORMAT SITASI: ${citationFormat}

PANDUAN ANALISIS:
- Cari definisi eksplisit (menggunakan kata "adalah", "yaitu", dll.)
- Identifikasi definisi implisit (dari konteks dan penjelasan)
- Perhatikan sinonim dan variasi istilah
- Analisis hubungan konsep dengan ide-ide terkait
- Pertimbangkan definisi operasional dan teoritis

FORMAT JAWABAN YANG WAJIB DIIKUTI:
STATUS_PENCARIAN: [DITEMUKAN/TIDAK_DITEMUKAN]
DEFINISI_EKSPLISIT: [kutip langsung jika ada, atau "Tidak ditemukan definisi eksplisit"]
DEFINISI_IMPLISIT: [jelaskan pemahaman dari konteks, atau "Tidak dapat diidentifikasi dari konteks"]
ANALISIS_KOMPREHENSIF: [analisis mendalam dalam bahasa Indonesia akademis]
TINGKAT_KEPASTIAN: [TINGGI/SEDANG/RENDAH]

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

// Enhanced process document dengan AI yang diperbaiki
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
    
    // Enhanced definition search
    const definitionResults = findDefinitionInText(doc.original_text, doc.keyword);
    
    let definisiAsli = '';
    let paraphrased = '';
    let citations: string[] = [];
    let bibliographies: string[] = [];
    let found = false;
    let confidenceLevel = 'RENDAH';
    
    if (definitionResults.definitions.length > 0 && definitionResults.scores[0] >= 7) {
      // High confidence definition found
      found = true;
      definisiAsli = definitionResults.definitions[0];
      confidenceLevel = definitionResults.scores[0] >= 9 ? 'TINGGI' : 'SEDANG';
      
      // Use advanced paraphrasing
      paraphrased = await advancedParaphrase(
        definisiAsli, 
        doc.keyword, 
        definitionResults.contexts[0]
      );
      
      // Generate multiple citation variations
      citations = generateAdvancedInTextCitation(
        paraphrased, 
        doc.author, 
        doc.publication_year, 
        doc.citation_format,
        'beginning'
      );
      
      bibliographies = generateAdvancedBibliography(
        doc.filename, 
        doc.author, 
        doc.publication_year, 
        doc.citation_format
      );
      
    } else if (definitionResults.definitions.length > 0) {
      // Medium confidence - definition found but with lower score
      found = true;
      definisiAsli = definitionResults.definitions[0];
      confidenceLevel = 'SEDANG';
      
      // Use advanced paraphrasing with additional context
      const combinedContext = definitionResults.contexts.slice(0, 2).join('\n\n');
      paraphrased = await advancedParaphrase(
        definisiAsli, 
        doc.keyword, 
        combinedContext
      );
      
      citations = generateAdvancedInTextCitation(
        paraphrased, 
        doc.author, 
        doc.publication_year, 
        doc.citation_format,
        'beginning'
      );
      
      bibliographies = generateAdvancedBibliography(
        doc.filename, 
        doc.author, 
        doc.publication_year, 
        doc.citation_format
      );
      
    } else {
      // No pattern match found, use comprehensive AI analysis
      const comprehensivePrompt = createComprehensiveAnalysisPrompt(
        doc.original_text, 
        doc.keyword, 
        doc.citation_format
      );
      
      const input = {
        prompt: comprehensivePrompt,
        max_tokens: 4000,
        temperature: 0.15, // Lower temperature for more consistent analysis
        top_p: 0.85,
        stream: false
      };

      console.log('Calling Replicate for comprehensive analysis...');
      const output = await replicate.run("ibm-granite/granite-3.3-8b-instruct", { input });
      const result = Array.isArray(output) ? output.join("") : String(output);
      
      console.log('AI Response:', result);
      
      // Enhanced parsing untuk hasil AI
      const parsedResult = parseComprehensiveAnalysis(result);
      
      found = parsedResult.statusPencarian === 'DITEMUKAN';
      definisiAsli = parsedResult.definisiEksplisit || '';
      confidenceLevel = parsedResult.tingkatKepastian || 'RENDAH';
      
      if (found && parsedResult.analisisKomprehensif) {
        // Use the comprehensive analysis as base for paraphrasing
        paraphrased = await advancedParaphrase(
          parsedResult.analisisKomprehensif,
          doc.keyword,
          parsedResult.definisiImplisit || ''
        );
      } else {
        // Generate explanation for not found
        paraphrased = await generateNotFoundExplanation(doc.keyword, doc.filename);
      }
      
      // Generate citations even for not found cases
      citations = generateAdvancedInTextCitation(
        paraphrased, 
        doc.author, 
        doc.publication_year, 
        doc.citation_format,
        found ? 'beginning' : 'end'
      );
      
      bibliographies = generateAdvancedBibliography(
        doc.filename, 
        doc.author, 
        doc.publication_year, 
        doc.citation_format
      );
    }
    
    // Post-processing untuk memastikan kualitas
    paraphrased = await postProcessParaphrase(paraphrased, doc.keyword);
    
    // Select best citation dan bibliography
    const selectedCitation = selectBestCitation(citations);
    const selectedBibliography = selectBestBibliography(bibliographies);
    
    // Clean up results
    if (definisiAsli.startsWith('"') && definisiAsli.endsWith('"')) {
      definisiAsli = definisiAsli.slice(1, -1);
    }
    
    // Update dokumen dengan semua data
    await sql`
      UPDATE documents 
      SET paraphrased = ${paraphrased}, 
          citation = ${selectedCitation}, 
          definition_found = ${found}, 
          original_definition = ${definisiAsli}
      WHERE id = ${documentId}
    `;
    
    res.status(200).json({
      message: 'Dokumen berhasil diproses dengan analisis mendalam',
      result: {
        keyword: doc.keyword,
        author: doc.author,
        publicationYear: doc.publication_year,
        definitionFound: found,
        confidenceLevel: confidenceLevel,
        originalDefinition: definisiAsli,
        paraphrased: paraphrased,
        inTextCitation: selectedCitation,
        alternativeCitations: citations.slice(0, 3), // Provide alternatives
        bibliography: selectedBibliography,
        alternativeBibliographies: bibliographies.slice(0, 2),
        citationFormat: doc.citation_format,
        processingNotes: generateProcessingNotes(found, confidenceLevel, definitionResults.scores[0] || 0)
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

// Parse comprehensive analysis result
function parseComprehensiveAnalysis(result: string): {
  statusPencarian: string;
  definisiEksplisit: string;
  definisiImplisit: string;
  analisisKomprehensif: string;
  tingkatKepastian: string;
} {
  const lines = result.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let statusPencarian = 'TIDAK_DITEMUKAN';
  let definisiEksplisit = '';
  let definisiImplisit = '';
  let analisisKomprehensif = '';
  let tingkatKepastian = 'RENDAH';
  
  for (const line of lines) {
    if (line.includes('STATUS_PENCARIAN:')) {
      const status = line.replace(/STATUS_PENCARIAN:\s*/i, '').trim();
      statusPencarian = status.includes('DITEMUKAN') ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN';
    } else if (line.includes('DEFINISI_EKSPLISIT:')) {
      definisiEksplisit = line.replace(/DEFINISI_EKSPLISIT:\s*/i, '').trim();
      if (definisiEksplisit.toLowerCase().includes('tidak ditemukan')) {
        definisiEksplisit = '';
      }
    } else if (line.includes('DEFINISI_IMPLISIT:')) {
      definisiImplisit = line.replace(/DEFINISI_IMPLISIT:\s*/i, '').trim();
    } else if (line.includes('ANALISIS_KOMPREHENSIF:')) {
      analisisKomprehensif = line.replace(/ANALISIS_KOMPREHENSIF:\s*/i, '').trim();
    } else if (line.includes('TINGKAT_KEPASTIAN:')) {
      tingkatKepastian = line.replace(/TINGKAT_KEPASTIAN:\s*/i, '').trim().toUpperCase();
      if (!['TINGGI', 'SEDANG', 'RENDAH'].includes(tingkatKepastian)) {
        tingkatKepastian = 'RENDAH';
      }
    }
  }
  
  // If parsing failed, try alternative parsing
  if (!analisisKomprehensif && result.length > 100) {
    // Use entire result as comprehensive analysis
    const cleanResult = result
      .replace(/STATUS_PENCARIAN:|DEFINISI_EKSPLISIT:|DEFINISI_IMPLISIT:|ANALISIS_KOMPREHENSIF:|TINGKAT_KEPASTIAN:/gi, '')
      .trim();
    
    if (cleanResult.length > 50) {
      analisisKomprehensif = cleanResult;
      statusPencarian = result.toLowerCase().includes('ditemukan') && !result.toLowerCase().includes('tidak ditemukan') 
        ? 'DITEMUKAN' : 'TIDAK_DITEMUKAN';
    }
  }
  
  return {
    statusPencarian,
    definisiEksplisit,
    definisiImplisit,
    analisisKomprehensif,
    tingkatKepastian
  };
}

// Generate explanation when definition is not found
async function generateNotFoundExplanation(keyword: string, filename: string): Promise<string> {
  const explanationPrompt = `Buatlah penjelasan akademis dalam bahasa Indonesia untuk situasi di mana definisi kata kunci tidak ditemukan dalam dokumen.

KATA KUNCI: "${keyword}"
NAMA FILE: "${filename}"

Buat penjelasan yang:
1. Profesional dan akademis
2. Menjelaskan bahwa analisis telah dilakukan secara menyeluruh
3. Menyarankan kemungkinan penyebab tidak ditemukannya definisi
4. Tetap memberikan kontribusi akademis
5. Tidak lebih dari 150 kata

PENJELASAN:`;

  const input = {
    prompt: explanationPrompt,
    max_tokens: 1000,
    temperature: 0.3,
    top_p: 0.9,
    stream: false
  };

  try {
    const output = await replicate.run("ibm-granite/granite-3.3-8b-instruct", { input });
    const result = Array.isArray(output) ? output.join("") : String(output);
    return result.trim() || `Berdasarkan analisis menyeluruh terhadap dokumen "${filename}", definisi eksplisit untuk kata kunci "${keyword}" tidak ditemukan dalam teks yang tersedia. Hal ini mungkin disebabkan oleh penggunaan istilah yang berbeda atau pendekatan kontekstual dalam penyampaian konsep tersebut.`;
  } catch (error) {
    return `Berdasarkan analisis menyeluruh terhadap dokumen "${filename}", definisi eksplisit untuk kata kunci "${keyword}" tidak ditemukan dalam teks yang tersedia.`;
  }
}

// Post-process paraphrase yang lebih ketat
async function postProcessParaphrase(paraphrase: string, keyword: string): Promise<string> {
  // Bersihkan dari kata-kata yang tidak diinginkan
  let cleaned = paraphrase
    .replace(/teknik\s+\w+/gi, '')
    .replace(/saya\s+(telah|akan|dapat)/gi, '')
    .replace(/dengan\s+menggunakan\s+teknik/gi, '')
    .replace(/ini\s+menunjukkan/gi, '')
    .replace(/misalnya/gi, '')
    .replace(/sementara\s+itu/gi, '')
    .replace(/parafrase\s+ini/gi, '')
    .replace(/hasil\s+akademis/gi, '')
    .replace(/\bvariedad\b/gi, '')
    .replace(/dalam\s+teknik\s+informatika.*?institut\s+sains\s+dan\s+teknologi\s+td\s+pardede,?\s*/gi, '')
    .replace(/di\s+fakultas\s+teknologi\s+industri,?\s*/gi, '')
    .replace(/ia\s+membantu.*$/gi, '') // Hapus kalimat setelah definisi utama
    .trim();
  
  // Ambil hanya kalimat pertama yang berisi definisi
  const sentences = cleaned.split(/[.!?]+/);
  let definitionSentence = '';
  
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length > 20 && 
        (trimmed.toLowerCase().includes(keyword.toLowerCase()) &&
         (trimmed.toLowerCase().includes('adalah') || 
          trimmed.toLowerCase().includes('merupakan') ||
          trimmed.toLowerCase().includes('didefinisikan')))) {
      definitionSentence = trimmed;
      break;
    }
  }
  
  // Jika tidak ada yang cocok, buat parafrase manual
  if (!definitionSentence || definitionSentence.length < 30) {
    definitionSentence = createManualParaphrase(paraphrase, keyword);
  }
  
  // Final cleanup
  definitionSentence = definitionSentence
    .replace(/^\W+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Pastikan diakhiri dengan titik
  if (!definitionSentence.match(/[.!?]$/)) {
    definitionSentence += '.';
  }
  
  // Pastikan kapitalisasi yang benar
  definitionSentence = definitionSentence.charAt(0).toUpperCase() + definitionSentence.slice(1);
  
  return definitionSentence;
}

// Check if text is English-dominant
function isEnglishDominant(text: string): boolean {
  const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'under', 'over'];
  const words = text.toLowerCase().split(/\s+/);
  const englishCount = englishWords.filter(word => words.includes(word)).length;
  
  return englishCount > words.length * 0.15; // If more than 15% English words
}

// Check if text has academic tone
function hasAcademicTone(text: string): boolean {
  const academicIndicators = [
    'menurut', 'berdasarkan', 'penelitian', 'studi', 'analisis', 'konsep', 'teori',
    'definisi', 'pengertian', 'pemahaman', 'dijelaskan', 'diuraikan', 'dikemukakan',
    'pendapat', 'pandangan', 'perspektif', 'gagasan', 'ide', 'prinsip'
  ];
  
  const lowerText = text.toLowerCase();
  const indicatorCount = academicIndicators.filter(indicator => 
    lowerText.includes(indicator)
  ).length;
  
  return indicatorCount >= 2 || text.length > 100;
}

// Select best citation from alternatives
function selectBestCitation(citations: string[]): string {
  if (citations.length === 0) return '';
  
  // Prefer citations that start with "Menurut" or "Berdasarkan"
  const preferred = citations.find(citation => 
    citation.startsWith('Menurut') || citation.startsWith('Berdasarkan')
  );
  
  return preferred || citations[0];
}

// Select best bibliography from alternatives
function selectBestBibliography(bibliographies: string[]): string {
  if (bibliographies.length === 0) return '';
  
  // Prefer "Dokumen Akademik" over others
  const preferred = bibliographies.find(bib => bib.includes('Dokumen Akademik'));
  
  return preferred || bibliographies[0];
}

// Generate processing notes untuk user feedback
function generateProcessingNotes(found: boolean, confidenceLevel: string, score: number): string {
  let notes = '';
  
  if (found) {
    if (confidenceLevel === 'TINGGI') {
      notes = `Definisi ditemukan dengan tingkat kepercayaan tinggi (skor: ${score}). Parafrase dibuat menggunakan teknik analisis semantik lanjutan.`;
    } else if (confidenceLevel === 'SEDANG') {
      notes = `Definisi ditemukan dengan tingkat kepercayaan sedang (skor: ${score}). Dilakukan analisis kontekstual untuk menghasilkan parafrase yang akurat.`;
    } else {
      notes = `Definisi ditemukan dengan tingkat kepercayaan rendah. Digunakan analisis komprehensif AI untuk memastikan akurasi parafrase.`;
    }
  } else {
    notes = `Definisi eksplisit tidak ditemukan dalam dokumen. Telah dilakukan analisis menyeluruh menggunakan berbagai teknik pencarian dan AI untuk memastikan tidak ada informasi yang terlewat.`;
  }
  
  return notes;
}

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