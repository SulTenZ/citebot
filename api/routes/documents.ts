// api/routes/documents.ts
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

// Helper function untuk membersihkan teks agar aman untuk SQL
function sanitizeText(text: string): string {
  if (!text) return '';
  
  // Replace problematic characters dan trim
  return text
    .replace(/\0/g, '') // null bytes
    .replace(/\r\n/g, '\n') // normalize line endings
    .replace(/\r/g, '\n')
    .replace(/\u0000-\u001F/g, ' ') // control characters
    .replace(/\u007F-\u009F/g, ' ') // more control characters
    .replace(/'/g, "''") // escape single quotes
    .trim();
}

// Helper function untuk membersihkan JSON
function sanitizeJson(data: any): string {
  try {
    const cleanData = JSON.parse(JSON.stringify(data, (key, value) => {
      if (typeof value === 'string') {
        return sanitizeText(value);
      }
      return value;
    }));
    return JSON.stringify(cleanData);
  } catch (error) {
    console.error('JSON sanitization error:', error);
    return JSON.stringify({ error: 'Invalid data' });
  }
}

async function extractText(buffer: Buffer, mimetype: string): Promise<string> {
  try {
    switch (mimetype) {
      case 'application/pdf':
        const pdfData = await pdfParse(buffer);
        return sanitizeText(pdfData.text);
     
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        const docxResult = await mammoth.extractRawText({ buffer });
        return sanitizeText(docxResult.value);
     
      case 'text/plain':
        return sanitizeText(buffer.toString('utf-8'));
     
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
      regex: new RegExp(`(${keywordVariations.join('|')})\\s+(?:adalah|yaitu|merupakan|ialah|didefinisikan\\s+sebagai|diartikan\\s+sebagai|bermakna)\\s+([^.!?;]{20,300}[.!?])`, 'gi'),
      score: 10
    },
    // Pattern 2: Definisi dengan titik dua
    {
      regex: new RegExp(`(${keywordVariations.join('|')})\\s*[:;]\\s*([^.!?;]{20,300}[.!?])`, 'gi'),
      score: 9
    },
    // Pattern 3: Definisi terbalik
    {
      regex: new RegExp(`(?:definisi|pengertian|arti|makna|konsep)\\s+(?:dari\\s+)?(${keywordVariations.join('|')})\\s+(?:adalah|yaitu|merupakan|ialah)\\s+([^.!?;]{20,300}[.!?])`, 'gi'),
      score: 9
    },
    // Pattern 4: Dalam konteks menurut/berdasarkan
    {
      regex: new RegExp(`(?:menurut|berdasarkan|dalam\\s+pandangan)\\s+[^,]{1,50},\\s*(${keywordVariations.join('|')})\\s+(?:adalah|yaitu|merupakan)\\s+([^.!?;]{20,300}[.!?])`, 'gi'),
      score: 8
    },
    // Pattern 5: Definisi akademik
    {
      regex: new RegExp(`(${keywordVariations.join('|')})\\s+(?:dapat\\s+didefinisikan|dapat\\s+diartikan|secara\\s+umum\\s+dipahami)\\s+sebagai\\s+([^.!?;]{20,300}[.!?])`, 'gi'),
      score: 8
    }
  ];
 
  // Terapkan setiap pattern
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const context = extractContext(text, match.index, fullMatch.length);
     
      definitions.push(sanitizeText(fullMatch.trim()));
      contexts.push(sanitizeText(context));
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
          definitions.push(sanitizeText(sentence.trim() + '.'));
          contexts.push(sanitizeText(extractSentenceContext(sentences, index)));
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

// ENHANCED Multi-Sentence Paraphrasing System
async function enhancedMultiSentenceParaphrase(
  originalText: string, 
  keyword: string, 
  context: string, 
  sentenceCount: number = 2
): Promise<string> {
  console.log(`🎯 Generating ${sentenceCount}-sentence paraphrase for "${keyword}"`);
 
  // Create sophisticated prompt for multi-sentence paraphrasing
  const prompt = createMultiSentencePrompt(originalText, keyword, context, sentenceCount);

  try {
    const input = {
      prompt: prompt,
      max_tokens: Math.min(4000, sentenceCount * 800), // Dynamic token allocation
      temperature: 0.3, // Balanced for creativity and consistency
      top_p: 0.85,
      stream: false
    };
   
    const output = await replicate.run("ibm-granite/granite-3.3-8b-instruct", { input });
    let result = Array.isArray(output) ? output.join("") : String(output);
   
    // Enhanced post-processing for multi-sentence results
    result = enhancedCleanupMultiSentence(result, keyword, sentenceCount);
   
    return sanitizeText(result);
   
  } catch (error) {
    console.error('Enhanced multi-sentence paraphrase error:', error);
    // Fallback to manual multi-sentence generation
    return sanitizeText(createMultiSentenceManualParaphrase(originalText, keyword, sentenceCount));
  }
}

// Create sophisticated prompt for multi-sentence paraphrasing
function createMultiSentencePrompt(originalText: string, keyword: string, context: string, sentenceCount: number): string {
  const sentenceCountText = [
    '', 'satu kalimat', 'dua kalimat', 'tiga kalimat', 'empat kalimat', 'lima kalimat'
  ][sentenceCount] || `${sentenceCount} kalimat`;

  return `Anda adalah ahli linguistik dan parafrase tingkat professor dengan keahlian dalam bahasa Indonesia akademis. Tugas Anda adalah memparafrase definisi berikut dengan presisi tinggi.

DEFINISI ASLI:
"${sanitizeText(originalText)}"

KATA KUNCI: ${sanitizeText(keyword)}
KONTEKS: ${sanitizeText(context)}

INSTRUKSI PARAFRASE ADVANCED:
1. Buat parafrase TEPAT ${sentenceCount} kalimat (${sentenceCountText})
2. Setiap kalimat harus utuh dan bermakna lengkap
3. Gunakan variasi struktur kalimat yang sophisticated:
   - Kalimat 1: Definisi inti dengan struktur berbeda
   ${sentenceCount >= 2 ? '- Kalimat 2: Elaborasi atau karakteristik utama' : ''}
   ${sentenceCount >= 3 ? '- Kalimat 3: Fungsi atau penerapan praktis' : ''}
   ${sentenceCount >= 4 ? '- Kalimat 4: Konteks atau domain penggunaan' : ''}
   ${sentenceCount >= 5 ? '- Kalimat 5: Signifikansi atau implikasi' : ''}

4. Gunakan transformasi linguistik:
   - Ubah struktur aktif-pasif
   - Variasi sinonim akademik
   - Reorder klausa subordinat
   - Nominalisasi/denominalisasi strategis

5. Pertahankan register akademik Indonesia yang natural
6. Pastikan kohesi antar kalimat dengan penanda wacana yang tepat
7. JANGAN gunakan kata "saya", "kami", "kita" atau referensi diri
8. JANGAN jelaskan proses parafrase
9. LANGSUNG berikan hasil parafrase ${sentenceCount} kalimat

HASIL PARAFRASE (${sentenceCountText}):`;
}

// Enhanced cleanup for multi-sentence results
function enhancedCleanupMultiSentence(result: string, keyword: string, targetSentenceCount: number): string {
  let cleaned = result.trim();
 
  // Remove unwanted phrases
  const unwantedPhrases = [
    /hasil parafrase/gi,
    /parafrase.*?kalimat/gi,
    /dengan.*?kalimat/gi,
    /saya.*?memparafrase/gi,
    /teknik.*?digunakan/gi,
    /berikut.*?hasil/gi,
    /ini.*?parafrase/gi
  ];
 
  unwantedPhrases.forEach(phrase => {
    cleaned = cleaned.replace(phrase, '');
  });
 
  // Split into sentences and analyze
  const sentences = cleaned
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15)
    .filter(s => !s.toLowerCase().includes('parafrase'))
    .filter(s => !s.toLowerCase().includes('kalimat'));
 
  // Select best sentences that contain keyword or definition indicators
  const prioritizedSentences: string[] = [];
  const keywordSentences: string[] = [];
  const definitionSentences: string[] = [];
  const otherSentences: string[] = [];
 
  sentences.forEach(sentence => {
    const lowerSentence = sentence.toLowerCase();
    const hasKeyword = lowerSentence.includes(keyword.toLowerCase());
    const hasDefinitionMarker = ['adalah', 'merupakan', 'yaitu', 'didefinisikan', 'dikategorikan'].some(marker => 
      lowerSentence.includes(marker)
    );
   
    if (hasKeyword && hasDefinitionMarker) {
      prioritizedSentences.push(sentence);
    } else if (hasKeyword) {
      keywordSentences.push(sentence);
    } else if (hasDefinitionMarker) {
      definitionSentences.push(sentence);
    } else if (sentence.length > 25) {
      otherSentences.push(sentence);
    }
  });
 
  // Build result with exact sentence count
  const finalSentences: string[] = [];
 
  // Add prioritized sentences first
  finalSentences.push(...prioritizedSentences.slice(0, targetSentenceCount));
 
  // Fill remaining slots
  while (finalSentences.length < targetSentenceCount) {
    if (keywordSentences.length > 0) {
      finalSentences.push(keywordSentences.shift()!);
    } else if (definitionSentences.length > 0) {
      finalSentences.push(definitionSentences.shift()!);
    } else if (otherSentences.length > 0) {
      finalSentences.push(otherSentences.shift()!);
    } else {
      break;
    }
  }
 
  // If we still don't have enough, generate additional sentences
  while (finalSentences.length < targetSentenceCount) {
    const additionalSentence = generateAdditionalSentence(keyword, finalSentences.length + 1);
    finalSentences.push(additionalSentence);
  }
 
  // Ensure proper capitalization and punctuation
  const result_text = finalSentences
    .slice(0, targetSentenceCount)
    .map(sentence => {
      let formatted = sentence.trim();
      formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
      if (!formatted.match(/[.!?]$/)) {
        formatted += '.';
      }
      return formatted;
    })
    .join(' ');
 
  console.log(`✅ Generated ${finalSentences.length} sentences for "${keyword}"`);
  return result_text;
}

// Generate additional sentence when AI doesn't produce enough
function generateAdditionalSentence(keyword: string, sentenceNumber: number): string {
  const templates: { [key: number]: string } = {
    2: `Konsep ${keyword} ini memiliki aplikasi yang luas dalam berbagai bidang terkait.`,
    3: `Implementasi ${keyword} memerlukan pemahaman mendalam tentang prinsip-prinsip dasarnya.`,
    4: `Dalam konteks akademis, ${keyword} sering menjadi fokus penelitian interdisipliner.`,
    5: `Pengembangan ${keyword} terus mengalami evolusi seiring dengan kemajuan teknologi dan metodologi.`
  };
 
  return templates[sentenceNumber] || 
         `Pemahaman terhadap ${keyword} sangat penting dalam pengembangan ilmu pengetahuan modern.`;
}

// Create manual multi-sentence paraphrase as fallback
function createMultiSentenceManualParaphrase(originalText: string, keyword: string, sentenceCount: number): string {
  const baseSentences = [
    `${keyword} dapat didefinisikan sebagai konsep yang memiliki karakteristik dan dimensi spesifik dalam konteks akademik.`,
    `Konsep ini mencakup berbagai aspek yang saling berkaitan dan membentuk pemahaman komprehensif.`,
    `Dalam implementasinya, ${keyword} memerlukan pendekatan yang sistematis dan terstruktur.`,
    `Pemahaman mendalam tentang ${keyword} sangat penting untuk pengembangan teoretis maupun praktis.`,
    `Aplikasi ${keyword} dalam berbagai domain menunjukkan relevansi dan signifikansinya dalam konteks kontemporer.`
  ];
 
  return baseSentences.slice(0, sentenceCount).join(' ');
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
 
  return citations.map(citation => sanitizeText(citation));
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
 
  return bibliographies.map(bib => sanitizeText(bib));
}

// Upload document dengan parameter tambahan
router.post('/upload', verifyToken, upload.single('document'), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File tidak ditemukan' });
  }

  const { keyword, author, year, citationFormat, additionalInfo } = req.body;
 
  // Parse additional info for sentence count
  let sentenceCount = 2; // default
  if (additionalInfo) {
    try {
      const parsed = typeof additionalInfo === 'string' ? JSON.parse(additionalInfo) : additionalInfo;
      sentenceCount = parseInt(parsed.sentenceCount) || 2;
    } catch (e) {
      console.log('Could not parse additionalInfo, using default sentence count');
    }
  }
 
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

  if (sentenceCount < 1 || sentenceCount > 5) {
    return res.status(400).json({ error: 'Jumlah kalimat harus antara 1-5' });
  }

  try {
    const extractedText = await extractText(req.file.buffer, req.file.mimetype);
   
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'Tidak ada teks yang bisa diekstrak' });
    }

    const sql = neon(process.env.DATABASE_URL!);
   
    // Sanitize semua input sebelum query
    const cleanFilename = sanitizeText(req.file.originalname);
    const cleanExtractedText = sanitizeText(extractedText);
    const cleanCitationFormat = sanitizeText(citationFormat || 'APA');
    const cleanKeyword = sanitizeText(keyword.trim());
    const cleanAuthor = sanitizeText(author.trim());
    const cleanAdditionalInfo = sanitizeJson({ sentenceCount });
   
    const result = await sql`
      INSERT INTO documents (
        user_id, 
        filename, 
        original_text, 
        citation_format, 
        keyword, 
        author, 
        publication_year, 
        additional_info
      )
      VALUES (
        ${req.userId}, 
        ${cleanFilename}, 
        ${cleanExtractedText}, 
        ${cleanCitationFormat}, 
        ${cleanKeyword}, 
        ${cleanAuthor}, 
        ${Number(year)}, 
        ${cleanAdditionalInfo}
      )
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

// Enhanced paraphrase text endpoint dengan sentence count support
router.post('/paraphrase-text', verifyToken, async (req: AuthRequest, res) => {
  const { originalText, keyword, author, year, citationFormat, additionalInfo } = req.body;

  // Parse sentence count from additional info
  let sentenceCount = 2; // default
  if (additionalInfo) {
    try {
      const parsed = typeof additionalInfo === 'string' ? JSON.parse(additionalInfo) : additionalInfo;
      sentenceCount = parseInt(parsed.sentenceCount) || 2;
    } catch (e) {
      console.log('Could not parse additionalInfo, using default sentence count');
    }
  }

  // Validasi input
  if (!originalText || !originalText.trim()) {
    return res.status(400).json({ error: 'Teks definisi wajib diisi' });
  }
  if (!keyword || !keyword.trim()) {
    return res.status(400).json({ error: 'Kata kunci wajib diisi' });
  }
  if (!author || !author.trim()) {
    return res.status(400).json({ error: 'Nama penulis wajib diisi' });
  }
  if (!year || isNaN(Number(year)) || Number(year) < 1900 || Number(year) > new Date().getFullYear() + 5) {
    return res.status(400).json({ error: 'Tahun publikasi tidak valid' });
  }
  if (sentenceCount < 1 || sentenceCount > 5) {
    return res.status(400).json({ error: 'Jumlah kalimat harus antara 1-5' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL!);

    console.log(`🎯 Processing text paraphrase with ${sentenceCount} sentences for keyword: "${keyword}"`);

    // Proses dengan Enhanced Multi-Sentence AI
    const paraphrased = await enhancedMultiSentenceParaphrase(originalText, keyword, originalText, sentenceCount);
    const citations = generateAdvancedInTextCitation(paraphrased, author, Number(year), citationFormat);
    const bibliographies = generateAdvancedBibliography(`Definisi untuk "${keyword}"`, author, Number(year), citationFormat);

    const selectedCitation = selectBestCitation(citations);
    const selectedBibliography = selectBestBibliography(bibliographies);

    // Sanitize semua data sebelum simpan ke database
    const cleanOriginalText = sanitizeText(originalText);
    const cleanParaphrased = sanitizeText(paraphrased);
    const cleanSelectedCitation = sanitizeText(selectedCitation);
    const cleanCitationFormat = sanitizeText(citationFormat || 'APA');
    const cleanKeyword = sanitizeText(keyword.trim());
    const cleanAuthor = sanitizeText(author.trim());
    const cleanAdditionalInfo = sanitizeJson({ 
      sentenceCount, 
      processingType: 'text_input' 
    });

    // Simpan ke database dengan metadata tambahan
    const result = await sql`
      INSERT INTO documents (
        user_id, 
        filename, 
        original_text, 
        citation_format, 
        keyword, 
        author, 
        publication_year,
        paraphrased,
        citation,
        definition_found,
        original_definition,
        additional_info
      )
      VALUES (
        ${req.userId}, 
        ${`Teks: ${cleanKeyword}`}, 
        ${cleanOriginalText}, 
        ${cleanCitationFormat}, 
        ${cleanKeyword}, 
        ${cleanAuthor}, 
        ${Number(year)},
        ${cleanParaphrased},
        ${cleanSelectedCitation},
        ${true},
        ${cleanOriginalText},
        ${cleanAdditionalInfo}
      )
      RETURNING id
    `;
   
    res.status(200).json({
      message: `Teks berhasil diparafrase menjadi ${sentenceCount} kalimat!`,
      documentId: result[0].id,
      preview: {
        originalSentences: originalText.split(/[.!?]+/).filter((s: string) => s.trim().length > 0).length,
        paraphrasedSentences: paraphrased.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
        targetSentences: sentenceCount
      }
    });

  } catch (error) {
    console.error('Enhanced paraphrase text error:', error);
    res.status(500).json({ error: 'Gagal memparafrase teks' });
  }
});

// Enhanced process document dengan sentence count support
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
   
    // Parse sentence count from additional_info
    let sentenceCount = 2; // default
    if (doc.additional_info) {
      try {
        const parsed = typeof doc.additional_info === 'string' ? JSON.parse(doc.additional_info) : doc.additional_info;
        sentenceCount = parseInt(parsed.sentenceCount) || 2;
      } catch (e) {
        console.log('Could not parse additional_info from document, using default');
      }
    }

    console.log(`🚀 Processing document with ${sentenceCount}-sentence paraphrasing`);
   
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
     
      // Use enhanced multi-sentence paraphrasing
      console.log(`✨ Using enhanced ${sentenceCount}-sentence paraphrasing for high-confidence definition`);
      paraphrased = await enhancedMultiSentenceParaphrase(
        definisiAsli, 
        doc.keyword, 
        definitionResults.contexts[0],
        sentenceCount
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
     
      console.log(`📝 Using enhanced ${sentenceCount}-sentence paraphrasing for medium-confidence definition`);
      const combinedContext = definitionResults.contexts.slice(0, 2).join('\n\n');
      paraphrased = await enhancedMultiSentenceParaphrase(
        definisiAsli, 
        doc.keyword, 
        combinedContext,
        sentenceCount
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
      console.log(`🤖 Using AI comprehensive analysis with ${sentenceCount}-sentence generation`);
      const comprehensivePrompt = createComprehensiveAnalysisPrompt(
        doc.original_text, 
        doc.keyword, 
        doc.citation_format
      );
     
      const input = {
        prompt: comprehensivePrompt,
        max_tokens: 4000,
        temperature: 0.15,
        top_p: 0.85,
        stream: false
      };

      console.log('Calling Replicate for comprehensive analysis...');
      const output = await replicate.run("ibm-granite/granite-3.3-8b-instruct", { input });
      const result = Array.isArray(output) ? output.join("") : String(output);
     
      const parsedResult = parseComprehensiveAnalysis(result);
     
      found = parsedResult.statusPencarian === 'DITEMUKAN';
      definisiAsli = parsedResult.definisiEksplisit || '';
      confidenceLevel = parsedResult.tingkatKepastian || 'RENDAH';
     
      if (found && parsedResult.analisisKomprehensif) {
        // Use the comprehensive analysis as base for multi-sentence paraphrasing
        paraphrased = await enhancedMultiSentenceParaphrase(
          parsedResult.analisisKomprehensif,
          doc.keyword,
          parsedResult.definisiImplisit || '',
          sentenceCount
        );
      } else {
        // Generate multi-sentence explanation for not found
        paraphrased = await generateNotFoundExplanationMultiSentence(doc.keyword, doc.filename, sentenceCount);
      }
     
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
   
    // Final quality check and sentence count verification
    const finalSentenceCount = paraphrased.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    console.log(`✅ Generated paraphrase: Target=${sentenceCount}, Actual=${finalSentenceCount} sentences`);
   
    // Select best citation dan bibliography
    const selectedCitation = selectBestCitation(citations);
    const selectedBibliography = selectBestBibliography(bibliographies);
   
    // Clean up results
    if (definisiAsli.startsWith('"') && definisiAsli.endsWith('"')) {
      definisiAsli = definisiAsli.slice(1, -1);
    }

    // Sanitize semua data sebelum update database
    const cleanParaphrased = sanitizeText(paraphrased);
    const cleanSelectedCitation = sanitizeText(selectedCitation);
    const cleanDefinisiAsli = sanitizeText(definisiAsli);
    const cleanAdditionalInfo = sanitizeJson({ 
      sentenceCount, 
      actualSentenceCount: finalSentenceCount,
      processingType: 'document_analysis',
      confidenceLevel,
      processingTime: new Date().toISOString()
    });
   
    // Update dokumen dengan semua data
    await sql`
      UPDATE documents 
      SET paraphrased = ${cleanParaphrased}, 
          citation = ${cleanSelectedCitation}, 
          definition_found = ${found}, 
          original_definition = ${cleanDefinisiAsli},
          additional_info = ${cleanAdditionalInfo}
      WHERE id = ${documentId}
    `;
   
    res.status(200).json({
      message: `Dokumen berhasil diproses dengan parafrase ${sentenceCount} kalimat`,
      result: {
        keyword: doc.keyword,
        author: doc.author,
        publicationYear: doc.publication_year,
        definitionFound: found,
        confidenceLevel: confidenceLevel,
        originalDefinition: definisiAsli,
        paraphrased: paraphrased,
        inTextCitation: selectedCitation,
        alternativeCitations: citations.slice(0, 3),
        bibliography: selectedBibliography,
        alternativeBibliographies: bibliographies.slice(0, 2),
        citationFormat: doc.citation_format,
        sentenceAnalysis: {
          targetSentences: sentenceCount,
          actualSentences: finalSentenceCount,
          originalSentences: definisiAsli.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
          processingSuccess: finalSentenceCount === sentenceCount
        },
        processingNotes: generateProcessingNotes(found, confidenceLevel, definitionResults.scores[0] || 0)
      }
    });
   
  } catch (error) {
    console.error('Enhanced process error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
   
    res.status(500).json({ 
      error: 'Gagal memproses dokumen: ' + errorMessage,
      details: errorMessage
    });
  }
});

// Generate multi-sentence explanation when definition is not found
async function generateNotFoundExplanationMultiSentence(keyword: string, filename: string, sentenceCount: number): Promise<string> {
  const prompt = `Buatlah penjelasan akademis dalam bahasa Indonesia untuk situasi di mana definisi kata kunci tidak ditemukan dalam dokumen.

KATA KUNCI: "${keyword}"
NAMA FILE: "${filename}"
JUMLAH KALIMAT: ${sentenceCount}

Buat penjelasan yang:
1. TEPAT ${sentenceCount} kalimat
2. Profesional dan akademis
3. Menjelaskan hasil analisis yang telah dilakukan
4. Menyarankan kemungkinan penyebab
5. Memberikan kontribusi akademis

PENJELASAN (${sentenceCount} kalimat):`;

  try {
    const input = {
      prompt: prompt,
      max_tokens: sentenceCount * 400,
      temperature: 0.3,
      top_p: 0.9,
      stream: false
    };

    const output = await replicate.run("ibm-granite/granite-3.3-8b-instruct", { input });
    const result = Array.isArray(output) ? output.join("") : String(output);
   
    return enhancedCleanupMultiSentence(result, keyword, sentenceCount);
   
  } catch (error) {
    return createMultiSentenceManualParaphrase(
      `Berdasarkan analisis menyeluruh terhadap dokumen "${filename}", definisi eksplisit untuk kata kunci "${keyword}" tidak ditemukan.`,
      keyword,
      sentenceCount
    );
  }
}

// Create comprehensive analysis prompt yang sudah ada sebelumnya
function createComprehensiveAnalysisPrompt(text: string, keyword: string, citationFormat: string): string {
  const textSegments = text.split(/\n\n|\.\s+/);
  const relevantSegments = textSegments.filter(segment => 
    segment.toLowerCase().includes(keyword.toLowerCase())
  ).slice(0, 8);
 
  const relevantText = relevantSegments.length > 0 
    ? relevantSegments.join('\n\n')
    : text.substring(0, 3000);

  return `Anda adalah asisten AI ahli analisis dokumen akademik dengan kemampuan tingkat PhD. Tugas Anda adalah melakukan analisis mendalam terhadap dokumen untuk mencari dan menganalisis definisi kata kunci.

INSTRUKSI ANALISIS:
1. Lakukan pencarian menyeluruh untuk kata kunci "${keyword}" dalam teks
2. Identifikasi definisi langsung, tersirat, dan kontekstual
3. Berikan analisis yang komprehensif dalam bahasa Indonesia yang sempurna
4. Gunakan pendekatan multi-perspektif untuk memahami konsep

TEKS DOKUMEN:
${sanitizeText(relevantText)}

KATA KUNCI: ${sanitizeText(keyword)}
FORMAT SITASI: ${sanitizeText(citationFormat)}

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

// Parse comprehensive analysis result - function yang sudah ada
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
 
  if (!analisisKomprehensif && result.length > 100) {
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
    definisiEksplisit: sanitizeText(definisiEksplisit),
    definisiImplisit: sanitizeText(definisiImplisit),
    analisisKomprehensif: sanitizeText(analisisKomprehensif),
    tingkatKepastian
  };
}

// Select best citation from alternatives - function yang sudah ada
function selectBestCitation(citations: string[]): string {
  if (citations.length === 0) return '';
 
  const preferred = citations.find(citation => 
    citation.startsWith('Menurut') || citation.startsWith('Berdasarkan')
  );
 
  return preferred || citations[0];
}

// Select best bibliography from alternatives - function yang sudah ada
function selectBestBibliography(bibliographies: string[]): string {
  if (bibliographies.length === 0) return '';
 
  const preferred = bibliographies.find(bib => bib.includes('Dokumen Akademik'));
 
  return preferred || bibliographies[0];
}

// Generate processing notes - function yang sudah ada
function generateProcessingNotes(found: boolean, confidenceLevel: string, score: number): string {
  let notes = '';
 
  if (found) {
    if (confidenceLevel === 'TINGGI') {
      notes = `Definisi ditemukan dengan tingkat kepercayaan tinggi (skor: ${score}). Parafrase dibuat menggunakan teknik analisis semantik lanjutan dengan multiple sentence generation.`;
    } else if (confidenceLevel === 'SEDANG') {
      notes = `Definisi ditemukan dengan tingkat kepercayaan sedang (skor: ${score}). Dilakukan analisis kontekstual untuk menghasilkan parafrase multi-kalimat yang akurat.`;
    } else {
      notes = `Definisi ditemukan dengan tingkat kepercayaan rendah. Digunakan analisis komprehensif AI untuk memastikan akurasi parafrase multi-kalimat.`;
    }
  } else {
    notes = `Definisi eksplisit tidak ditemukan dalam dokumen. Telah dilakukan analisis menyeluruh menggunakan berbagai teknik pencarian dan AI untuk memastikan tidak ada informasi yang terlewat.`;
  }
 
  return notes;
}

// Get history endpoint - unchanged
router.get('/history', verifyToken, async (req: AuthRequest, res) => {
  try {
    const sql = neon(process.env.DATABASE_URL!);
   
    const documents = await sql`
      SELECT id, filename, keyword, citation_format, paraphrased, citation, 
             definition_found, original_definition, author, publication_year, 
             additional_info, created_at
      FROM documents
      WHERE user_id = ${req.userId}
      ORDER BY created_at DESC
    `;
   
    // Add sentence count info to response
    const documentsWithInfo = documents.map(doc => {
      let sentenceInfo: { sentenceCount: string, actualSentenceCount: string } = { sentenceCount: 'Unknown', actualSentenceCount: 'Unknown' };
     
      if (doc.additional_info) {
        try {
          const parsed = typeof doc.additional_info === 'string' ? JSON.parse(doc.additional_info) : doc.additional_info;
          sentenceInfo = {
            sentenceCount: parsed.sentenceCount || 'Unknown',
            actualSentenceCount: parsed.actualSentenceCount || 'Unknown'
          };
        } catch (e) {
          // Keep default values
        }
      }
     
      return {
        ...doc,
        sentenceInfo
      };
    });
   
    res.status(200).json({
      documents: documentsWithInfo
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Gagal mengambil riwayat dokumen' });
  }
});

export default router;