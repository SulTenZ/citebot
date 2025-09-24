// src/components/ParaphraseForm.tsx
import { useState } from 'react';
import { Quote, Search, Bot, Sparkles, Zap, User, Calendar, Hash } from 'lucide-react';
import { documentsAPI } from '../utils/api';
import { toast } from 'react-hot-toast';

interface ParaphraseFormProps {
  onSuccess: () => void;
  loading: boolean;
}

export default function ParaphraseForm({ onSuccess, loading }: ParaphraseFormProps) {
  const [originalText, setOriginalText] = useState('');
  const [citationFormat, setCitationFormat] = useState('APA');
  const [processing, setProcessing] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [author, setAuthor] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [sentenceCount, setSentenceCount] = useState('2');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!originalText.trim()) {
      toast.error('Masukkan definisi yang ingin diparafrase');
      return;
    }
    if (!keyword.trim()) {
      toast.error('Masukkan kata kunci definisi');
      return;
    }
    if (!author.trim()) {
      toast.error('Masukkan nama penulis');
      return;
    }
    if (!year.trim() || isNaN(Number(year))) {
      toast.error('Masukkan tahun yang valid');
      return;
    }
    if (!sentenceCount || isNaN(Number(sentenceCount)) || Number(sentenceCount) < 1 || Number(sentenceCount) > 5) {
      toast.error('Jumlah kalimat harus antara 1-5');
      return;
    }

    setProcessing(true);
    try {
      await documentsAPI.paraphraseText(
        originalText, 
        citationFormat, 
        keyword.trim(), 
        author.trim(), 
        Number(year),
        {
          sentenceCount: Number(sentenceCount)
        }
      );
      toast.success('Teks berhasil diparafrase dan disimpan!');
      onSuccess();
      
      // Reset form
      setOriginalText('');
      setKeyword('');
      setAuthor('');
      setYear(new Date().getFullYear().toString());
      setSentenceCount('2');

    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Gagal memproses teks');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
      <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 p-6 text-white relative">
        <div className="flex items-center mb-3">
            <div className="bg-white/20 p-2 rounded-xl mr-3">
              <Bot className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold">Parafrase & Buat Sitasi dari Teks</h2>
            <Sparkles className="w-5 h-5 ml-2 animate-pulse" />
          </div>
          <p className="text-emerald-100">
            Masukkan definisi, dan biarkan AI memparafrase dan membuat sitasi untuk Anda.
          </p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        {/* Definition Input Section */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-3">
            📝 Masukkan Definisi/Pengertian
          </label>
           <div className="relative">
              <div className="absolute left-4 top-6 transform -translate-y-1/2 bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg">
                <Quote className="text-white w-5 h-5" />
              </div>
          <textarea
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            placeholder="Ketik atau tempel definisi yang ingin Anda parafrase di sini..."
            className="w-full pl-16 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 bg-gray-50/50 hover:bg-white focus:bg-white text-lg min-h-[150px]"
            disabled={processing || loading}
            rows={5}
          />
          </div>
        </div>

        {/* Author and Year Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Author Input */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">
              👤 Nama Penulis/Author
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-green-500 to-teal-500 p-2 rounded-lg">
                <User className="text-white w-5 h-5" />
              </div>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Contoh: Smith, J. D."
                className="w-full pl-16 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300 bg-gray-50/50 hover:bg-white focus:bg-white text-lg"
                disabled={processing || loading}
              />
            </div>
          </div>

          {/* Year Input */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">
              📅 Tahun Publikasi
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-lg">
                <Calendar className="text-white w-5 h-5" />
              </div>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2024"
                min="1900"
                max={new Date().getFullYear() + 5}
                className="w-full pl-16 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-300 bg-gray-50/50 hover:bg-white focus:bg-white text-lg"
                disabled={processing || loading}
              />
            </div>
          </div>
        </div>

        {/* Keyword and Sentence Count Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Keyword Input */}
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 mb-3">
              🔍 Kata Kunci Utama
            </label>
            <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg">
                  <Search className="text-white w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Contoh: Machine Learning"
                  className="w-full pl-16 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 bg-gray-50/50 hover:bg-white focus:bg-white text-lg"
                  disabled={processing || loading}
                />
              </div>
          </div>

          {/* Sentence Count Input */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">
              📝 Jumlah Kalimat Parafrase
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-pink-500 to-rose-500 p-2 rounded-lg">
                <Hash className="text-white w-5 h-5" />
              </div>
              <select
                value={sentenceCount}
                onChange={(e) => setSentenceCount(e.target.value)}
                className="w-full pl-16 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-pink-500/20 focus:border-pink-500 transition-all duration-300 bg-gray-50/50 hover:bg-white focus:bg-white text-lg appearance-none cursor-pointer"
                disabled={processing || loading}
              >
                <option value="1">1 Kalimat</option>
                <option value="2">2 Kalimat</option>
                <option value="3">3 Kalimat</option>
                <option value="4">4 Kalimat</option>
                <option value="5">5 Kalimat</option>
              </select>
              {/* Custom dropdown arrow */}
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Info Alert for AI Processing */}
        <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-200/50">
          <div className="flex items-center text-sm text-emerald-700">
            <Zap className="w-4 h-4 mr-2" />
            <span className="font-medium">
              AI akan memparafrase definisi "{keyword || '[kata kunci]'}" menjadi {sentenceCount} kalimat yang natural dan akademis
            </span>
          </div>
        </div>

        {/* Citation Format Section */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-3">
            📚 Format Sitasi
          </label>
          <div className="grid grid-cols-3 gap-3">
            {['APA', 'MLA', 'Chicago'].map((format) => (
              <label key={format} className="relative cursor-pointer">
                <input
                  type="radio"
                  name="citationFormat"
                  value={format}
                  checked={citationFormat === format}
                  onChange={(e) => setCitationFormat(e.target.value)}
                  className="sr-only"
                  disabled={processing || loading}
                />
                <div className={`p-4 rounded-2xl border-2 text-center transition-all duration-300 ${
                  citationFormat === format
                    ? 'border-indigo-500 bg-gradient-to-br from-indigo-50 to-purple-50 text-indigo-700 shadow-lg transform scale-105'
                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 text-gray-700'
                }`}>
                  <span className="font-bold text-lg">{format}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!originalText.trim() || !keyword.trim() || !author.trim() || !year.trim() || processing || loading}
          className="w-full bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white py-4 px-6 rounded-2xl hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-bold text-lg shadow-2xl hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center relative overflow-hidden"
        >
          {processing || loading ? (
            <>
              <Bot className="w-5 h-5 mr-3 animate-pulse" />
              AI sedang memproses...
            </>
          ) : (
            <>
              <Zap className="w-6 h-6 mr-3" />
              Parafrase & Buat Sitasi ({sentenceCount} Kalimat)
            </>
          )}
        </button>
      </form>
    </div>
  );
}