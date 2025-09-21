// src/components/DocumentView.tsx
import { FileText, Quote, Calendar, BookOpen, Copy, Check, Search, AlertCircle, CheckCircle, Sparkles, Bot, BookmarkCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

interface DocumentProps {
  document: {
    id: string;
    filename: string;
    keyword?: string;
    citation_format: string;
    paraphrased?: string;
    citation?: string;
    definition_found?: boolean;
    original_definition?: string;
    created_at: string;
  };
}

export default function DocumentView({ document }: DocumentProps) {
  const [copiedParaphrase, setCopiedParaphrase] = useState(false);
  const [copiedCitation, setCopiedCitation] = useState(false);
  const [copiedDefinition, setCopiedDefinition] = useState(false);

  const copyToClipboard = (text: string, type: 'paraphrase' | 'citation' | 'definition') => {
    navigator.clipboard.writeText(text);
    if (type === 'paraphrase') {
      setCopiedParaphrase(true);
      setTimeout(() => setCopiedParaphrase(false), 2000);
    } else if (type === 'citation') {
      setCopiedCitation(true);
      setTimeout(() => setCopiedCitation(false), 2000);
    } else {
      setCopiedDefinition(true);
      setTimeout(() => setCopiedDefinition(false), 2000);
    }
    toast.success('Teks berhasil disalin! 📋');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
      {/* Header with gradient background */}
      <div className="p-8 border-b border-gray-200/50 bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5"></div>
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-start">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-4 rounded-2xl shadow-lg mr-4">
                <FileText className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{document.filename}</h2>
                <div className="flex items-center flex-wrap gap-4 text-sm">
                  <div className="flex items-center text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span className="font-medium">{formatDate(document.created_at)}</span>
                  </div>
                  <div className="bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 px-3 py-1.5 rounded-full font-bold text-sm">
                    {document.citation_format}
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-gray-200/50 shadow-sm">
                <div className="flex items-center text-sm text-gray-600">
                  <Bot className="w-4 h-4 mr-1" />
                  <span className="font-medium">AI Processed</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Enhanced Keyword Search Result */}
          {document.keyword && (
            <div className="bg-white/70 backdrop-blur-sm p-6 rounded-2xl border border-gray-200/50 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-xl mr-4 shadow-lg">
                    <Search className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center mb-2">
                      <span className="font-bold text-gray-700 mr-3">Kata Kunci Dicari:</span>
                      <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg">
                        {document.keyword}
                      </span>
                    </div>
                  </div>
                </div>
                
                {document.definition_found !== undefined && (
                  <div className={`flex items-center px-4 py-3 rounded-2xl font-bold shadow-lg ${
                    document.definition_found 
                      ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border-2 border-green-200' 
                      : 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border-2 border-amber-200'
                  }`}>
                    {document.definition_found ? (
                      <>
                        <CheckCircle className="w-5 h-5 mr-2" />
                        <span>✅ Definisi Ditemukan</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-5 h-5 mr-2" />
                        <span>❌ Definisi Tidak Ditemukan</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Original Definition Section */}
      {document.original_definition && document.definition_found && (
        <div className="p-8 border-b border-gray-200/50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl flex items-center text-gray-800">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 p-3 rounded-xl mr-3 shadow-lg">
                <Quote className="w-6 h-6 text-white" />
              </div>
              📖 Definisi Asli dari Dokumen
            </h3>
            <button
              onClick={() => copyToClipboard(document.original_definition!, 'definition')}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-300 rounded-xl border border-gray-200 hover:border-blue-300 shadow-sm hover:shadow-md"
            >
              {copiedDefinition ? (
                <>
                  <Check className="w-5 h-5 text-green-600 mr-2" />
                  <span className="font-medium text-green-600">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 mr-2" />
                  <span className="font-medium">Salin</span>
                </>
              )}
            </button>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-2xl border-2 border-blue-200/50 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-200/20 rounded-full -mr-12 -mt-12"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-200/20 rounded-full -ml-16 -mb-16"></div>
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap font-medium text-lg relative z-10">
              {document.original_definition}
            </p>
          </div>
        </div>
      )}

      {/* Paraphrased Result Section */}
      {document.paraphrased && (
        <div className="p-8 border-b border-gray-200/50">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl flex items-center text-gray-800">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-3 rounded-xl mr-3 shadow-lg">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              🤖 Hasil Parafrase AI
              <Sparkles className="w-5 h-5 ml-2 text-purple-500 animate-pulse" />
            </h3>
            <button
              onClick={() => copyToClipboard(document.paraphrased!, 'paraphrase')}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-all duration-300 rounded-xl border border-gray-200 hover:border-purple-300 shadow-sm hover:shadow-md"
            >
              {copiedParaphrase ? (
                <>
                  <Check className="w-5 h-5 text-green-600 mr-2" />
                  <span className="font-medium text-green-600">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 mr-2" />
                  <span className="font-medium">Salin</span>
                </>
              )}
            </button>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-2xl border-2 border-purple-200/50 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-28 h-28 bg-purple-200/20 rounded-full -mr-14 -mt-14"></div>
            <div className="absolute bottom-0 left-0 w-36 h-36 bg-pink-200/20 rounded-full -ml-18 -mb-18"></div>
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap font-medium text-lg relative z-10">
              {document.paraphrased}
            </p>
          </div>
        </div>
      )}

      {/* Citation Section */}
      {document.citation && (
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-xl flex items-center text-gray-800">
              <div className="bg-gradient-to-br from-green-500 to-teal-500 p-3 rounded-xl mr-3 shadow-lg">
                <BookmarkCheck className="w-6 h-6 text-white" />
              </div>
              📚 Sitasi ({document.citation_format})
            </h3>
            <button
              onClick={() => copyToClipboard(document.citation!, 'citation')}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-green-600 hover:bg-green-50 transition-all duration-300 rounded-xl border border-gray-200 hover:border-green-300 shadow-sm hover:shadow-md"
            >
              {copiedCitation ? (
                <>
                  <Check className="w-5 h-5 text-green-600 mr-2" />
                  <span className="font-medium text-green-600">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 mr-2" />
                  <span className="font-medium">Salin</span>
                </>
              )}
            </button>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-teal-50 p-6 rounded-2xl border-2 border-green-200/50 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/20 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-teal-200/20 rounded-full -ml-12 -mb-12"></div>
            <p className="text-gray-800 font-mono text-lg bg-white/50 p-4 rounded-xl border border-green-200/50 relative z-10">
              {document.citation}
            </p>
          </div>
        </div>
      )}

      {/* No content state */}
      {!document.paraphrased && !document.citation && (
        <div className="p-12 text-center">
          <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-8 rounded-3xl mb-6 mx-auto w-fit">
            <Bot className="w-16 h-16 text-gray-400 mx-auto animate-pulse" />
          </div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">Sedang Diproses AI</h3>
          <p className="text-gray-500 leading-relaxed">
            Dokumen sedang dianalisis oleh AI untuk mencari definisi dan<br />
            membuat sitasi. Proses ini membutuhkan beberapa saat.
          </p>
        </div>
      )}
    </div>
  );
}