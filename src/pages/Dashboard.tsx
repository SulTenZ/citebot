// src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Sidebar from '../components/Sidebar';
import UploadForm from '../components/UploadForm';
import ParaphraseForm from '../components/ParaphraseForm'; // Import komponen baru
import DocumentView from '../components/DocumentView';
import { documentsAPI } from '../utils/api';
import { toast } from 'react-hot-toast';
import { FileUp, Type } from 'lucide-react'; // Import ikon

interface Document {
  id: string;
  filename: string;
  keyword?: string;
  citation_format: string;
  paraphrased?: string;
  citation?: string;
  definition_found?: boolean;
  original_definition?: string;
  created_at: string;
}

export default function Dashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'document' | 'text'>('document'); // State untuk tab

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await documentsAPI.getHistory();
      setDocuments(response.data.documents);
      if(response.data.documents.length > 0 && !selectedDoc) {
        setSelectedDoc(response.data.documents[0]);
      }
    } catch (error) {
      toast.error('Gagal memuat riwayat dokumen');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = async (documentId: string, keyword: string) => {
    setLoading(true);
    try {
      await documentsAPI.process(documentId);
      toast.success(`Definisi "${keyword}" dari dokumen berhasil diproses!`);
      await loadHistory();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Gagal memproses dokumen';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleParaphraseSuccess = async () => {
    // Cukup muat ulang riwayat, data baru akan muncul di atas
    await loadHistory();
  };

  return (
    <Layout>
      <div className="flex h-full">
        <Sidebar 
          documents={documents}
          selectedDoc={selectedDoc}
          onSelectDoc={setSelectedDoc}
        />
        
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-4xl mx-auto">            
            <div className="bg-white/50 backdrop-blur-sm rounded-3xl shadow-lg p-6 mb-6 border border-white/20">
              
              {/* Tab Switcher */}
              <div className="mb-6 flex justify-center bg-gray-100/70 p-2 rounded-2xl">
                <button
                  onClick={() => setActiveTab('document')}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-300 ${
                    activeTab === 'document' ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg' : 'text-gray-600 hover:bg-white'
                  }`}
                >
                  <FileUp className="w-5 h-5" />
                  Parafrase dari Dokumen
                </button>
                <button
                  onClick={() => setActiveTab('text')}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold transition-all duration-300 ${
                    activeTab === 'text' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg' : 'text-gray-600 hover:bg-white'
                  }`}
                >
                  <Type className="w-5 h-5" />
                  Parafrase dari Teks
                </button>
              </div>

              {/* Conditional Rendering Form */}
              {activeTab === 'document' ? (
                <UploadForm 
                  onUploadSuccess={handleUploadSuccess}
                  loading={loading}
                />
              ) : (
                <ParaphraseForm 
                  onSuccess={handleParaphraseSuccess}
                  loading={loading}
                />
              )}
            </div>
            
            {selectedDoc ? (
              <DocumentView document={selectedDoc} />
            ) : (
                <div className="text-center p-12 bg-white/50 rounded-3xl">
                    <h3 className="text-xl font-bold text-gray-700">Belum ada dokumen yang dipilih</h3>
                    <p className="text-gray-500 mt-2">Pilih salah satu item dari riwayat atau proses dokumen baru.</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}