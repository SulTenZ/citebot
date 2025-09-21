// src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import Sidebar from '../components/Sidebar';
import UploadForm from '../components/UploadForm';
import DocumentView from '../components/DocumentView';
import { documentsAPI } from '../utils/api';
import { toast } from 'react-hot-toast';

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

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await documentsAPI.getHistory();
      setDocuments(response.data.documents);
    } catch (error) {
      toast.error('Gagal memuat riwayat dokumen');
    }
  };

  const handleUploadSuccess = async (documentId: string, keyword: string) => {
    setLoading(true);
    try {
      await documentsAPI.process(documentId);
      toast.success(`Definisi "${keyword}" berhasil dicari dan diproses!`);
      await loadHistory();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Gagal memproses dokumen';
      toast.error(errorMsg);
      console.error('Process error:', errorMsg);
    } finally {
      setLoading(false);
    }
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
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Cari Definisi dari Dokumen</h2>
              <p className="text-gray-600 mb-4">
                Upload dokumen (jurnal, paper, dll) dan masukkan kata kunci. 
                AI akan mencari definisi kata kunci tersebut, lalu melakukan parafrase dan membuat sitasi.
              </p>
              <UploadForm 
                onUploadSuccess={handleUploadSuccess}
                loading={loading}
              />
            </div>
            
            {selectedDoc && (
              <DocumentView document={selectedDoc} />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}