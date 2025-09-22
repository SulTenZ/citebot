// src/components/UploadForm.tsx
import { useState } from 'react';
import { Upload, FileUp, Search, Bot, Sparkles, FileText, Zap, User, Calendar } from 'lucide-react';
import { documentsAPI } from '../utils/api';
import { toast } from 'react-hot-toast';

interface UploadFormProps {
  onUploadSuccess: (documentId: string, keyword: string) => void;
  loading: boolean;
}

export default function UploadForm({ onUploadSuccess, loading }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [citationFormat, setCitationFormat] = useState('APA');
  const [uploading, setUploading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [author, setAuthor] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error('File terlalu besar (maksimal 5MB)');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast.error('Pilih file terlebih dahulu');
      return;
    }
    
    if (!keyword.trim()) {
      toast.error('Masukkan kata kunci yang ingin dicari definisinya');
      return;
    }

    if (!author.trim()) {
      toast.error('Masukkan nama penulis');
      return;
    }

    if (!year.trim() || isNaN(Number(year)) || Number(year) < 1900 || Number(year) > new Date().getFullYear() + 5) {
      toast.error('Masukkan tahun yang valid');
      return;
    }

    setUploading(true);
    try {
      const response = await documentsAPI.upload(file, citationFormat, keyword.trim(), author.trim(), Number(year));
      toast.success('File berhasil diupload!');
      onUploadSuccess(response.data.document.id, keyword.trim());
      
      // Reset form
      setFile(null);
      setKeyword('');
      setAuthor('');
      setYear(new Date().getFullYear().toString());
      const form = e.target as HTMLFormElement;
      form.reset();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Upload gagal');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/90 via-purple-600/90 to-blue-600/90"></div>
        <div className="relative z-10">
          <div className="flex items-center mb-3">
            <div className="bg-white/20 p-2 rounded-xl mr-3">
              <Bot className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold">Upload & Analisis Dokumen</h2>
            <Sparkles className="w-5 h-5 ml-2 animate-pulse" />
          </div>
          <p className="text-indigo-100">
            Upload jurnal atau dokumen, dan biarkan AI mencari definisi untuk Anda
          </p>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        {/* File Upload Section */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-3">
            📄 Upload Dokumen (PDF, DOCX, TXT)
          </label>
          <div className={`border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ${
            file 
              ? 'border-green-400 bg-green-50/50' 
              : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/30'
          }`}>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".pdf,.docx,.txt"
              onChange={handleFileChange}
              disabled={uploading || loading}
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <div className={`p-4 rounded-2xl mb-4 transition-all duration-300 ${
                file 
                  ? 'bg-green-500 text-white shadow-lg' 
                  : 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg hover:shadow-xl hover:scale-105'
              }`}>
                {file ? <FileText className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
              </div>
              <span className={`text-lg font-semibold mb-2 ${
                file ? 'text-green-700' : 'text-gray-700'
              }`}>
                {file ? `✅ ${file.name}` : 'Klik untuk upload atau drag & drop'}
              </span>
              <span className="text-sm text-gray-500 text-center leading-relaxed">
                {file 
                  ? 'File siap untuk diproses' 
                  : 'Upload jurnal atau dokumen akademik yang berisi definisi\nFormat yang didukung: PDF, DOCX, TXT (Max 5MB)'
                }
              </span>
            </label>
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
                placeholder="Contoh: Smith, J. D. atau Johnson, M."
                className="w-full pl-16 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-300 bg-gray-50/50 hover:bg-white focus:bg-white text-lg"
                disabled={uploading || loading}
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
                disabled={uploading || loading}
              />
            </div>
          </div>
        </div>

        {/* Keyword Input Section */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-3">
            🔍 Kata Kunci Definisi
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-lg">
              <Search className="text-white w-5 h-5" />
            </div>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Contoh: Machine Learning, React Native, Algoritma Genetika..."
              className="w-full pl-16 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all duration-300 bg-gray-50/50 hover:bg-white focus:bg-white text-lg"
              disabled={uploading || loading}
            />
          </div>
          <div className="mt-3 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200/50">
            <div className="flex items-center text-sm text-blue-700">
              <Zap className="w-4 h-4 mr-2" />
              <span className="font-medium">AI akan mencari definisi kata kunci ini dari dokumen yang diupload</span>
            </div>
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
                  disabled={uploading || loading}
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
          <div className="mt-3 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200/50">
            <div className="text-sm text-purple-700">
              <span className="font-medium">Format yang akan digunakan:</span>
              <div className="mt-1 text-xs">
                {citationFormat === 'APA' && '• APA: Author, A. A. (Year). Title. Publisher.'}
                {citationFormat === 'MLA' && '• MLA: Author. "Title." Publisher, Year.'}
                {citationFormat === 'Chicago' && '• Chicago: Author. Title. Publisher, Year.'}
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!file || !keyword.trim() || !author.trim() || !year.trim() || uploading || loading}
          className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white py-4 px-6 rounded-2xl hover:from-indigo-700 hover:via-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-bold text-lg shadow-2xl hover:shadow-xl transform hover:-translate-y-1 flex items-center justify-center relative overflow-hidden"
        >
          <div className="flex items-center relative z-10">
            <div className="mr-3 p-2 bg-white/20 rounded-lg">
              <FileUp className="w-6 h-6" />
            </div>
            {uploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                Mengupload & Memproses...
              </>
            ) : loading ? (
              <>
                <Bot className="w-5 h-5 mr-3 animate-pulse" />
                AI sedang mencari & memproses...
              </>
            ) : (
              <>
                Upload & Mulai Analisis AI
                <Sparkles className="w-5 h-5 ml-2 animate-pulse" />
              </>
            )}
          </div>
          {/* Button background animation */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        </button>
      </form>
    </div>
  );
}