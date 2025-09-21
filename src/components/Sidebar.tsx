// src/components/Sidebar.tsx
import { Clock, FileText, ChevronRight, Search, CheckCircle, AlertCircle, Archive } from 'lucide-react';
import Logo from '../assets/logo.png';

interface Document {
  id: string;
  filename: string;
  keyword?: string;
  citation_format: string;
  definition_found?: boolean;
  created_at: string;
}

interface SidebarProps {
  documents: Document[];
  selectedDoc: Document | null;
  onSelectDoc: (doc: Document) => void;
}

export default function Sidebar({ documents, selectedDoc, onSelectDoc }: SidebarProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="w-80 bg-white/80 backdrop-blur-xl border-r border-white/30 h-full overflow-y-auto shadow-xl">
      {/* Header with gradient */}
      <div className="p-6 border-b border-gray-200/50 bg-gradient-to-r from-indigo-50 to-purple-50">
        <h2 className="font-bold text-lg flex items-center text-gray-800">
          <img src={Logo} alt="CiteBot Logo" className="w-8 h-8 mr-3 rounded-lg shadow-md" />
          Riwayat Pencarian
        </h2>
        <p className="text-sm text-gray-600 mt-1 ml-12">
          {documents.length} dokumen diproses
        </p>
      </div>
      
      <div className="p-4">
        {documents.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-6 rounded-2xl mb-4 mx-auto w-fit">
              <Archive className="w-12 h-12 text-gray-400 mx-auto" />
            </div>
            <h3 className="font-semibold text-gray-700 mb-2">Belum Ada Pencarian</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Upload dokumen dan cari definisi<br />
              untuk memulai menggunakan CiteBot
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc, index) => (
              <button
                key={doc.id}
                onClick={() => onSelectDoc(doc)}
                className={`w-full text-left p-4 rounded-2xl transition-all duration-300 group relative overflow-hidden ${
                  selectedDoc?.id === doc.id
                    ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 shadow-lg transform scale-[1.02]'
                    : 'hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 border-2 border-transparent hover:border-gray-200/50 hover:shadow-md'
                }`}
              >
                {selectedDoc?.id === doc.id && (
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 rounded-2xl"></div>
                )}
                
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <div className={`p-2 rounded-lg mr-3 ${
                        selectedDoc?.id === doc.id 
                          ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-lg' 
                          : 'bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-blue-600'
                      } transition-all duration-300`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <p className="font-semibold text-sm text-gray-800 truncate">
                        {doc.filename}
                      </p>
                    </div>
                    
                    {doc.keyword && (
                      <div className="flex items-center mb-3 ml-11">
                        <div className="flex items-center bg-white/80 backdrop-blur-sm border border-blue-200/50 rounded-lg px-2 py-1 shadow-sm">
                          <Search className="w-3 h-3 mr-1 text-blue-500" />
                          <span className="text-xs text-blue-700 font-medium">
                            {doc.keyword}
                          </span>
                        </div>
                        {doc.definition_found !== undefined && (
                          <div className={`ml-2 p-1 rounded-full ${
                            doc.definition_found 
                              ? 'bg-green-100 text-green-600' 
                              : 'bg-amber-100 text-amber-600'
                          }`}>
                            {doc.definition_found ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center ml-11 text-xs text-gray-500">
                      <div className="bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700 px-2 py-1 rounded-full text-xs font-medium mr-2">
                        {doc.citation_format}
                      </div>
                      <span>•</span>
                      <span className="ml-2">{formatDate(doc.created_at)}</span>
                    </div>
                  </div>
                  
                  {selectedDoc?.id === doc.id && (
                    <div className="ml-3 text-indigo-600">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  )}
                </div>
                
                <div className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold text-gray-600">{index + 1}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
