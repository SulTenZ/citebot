// src/components/Layout.tsx
import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { removeToken } from '../utils/auth';
import { LogOut, FileText, Bot, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    removeToken();
    toast.success('Logout berhasil');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <header className="bg-white/80 backdrop-blur-xl shadow-lg border-b border-white/20 sticky top-0 z-50">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Logo with gradient and animation */}
            <div className="relative">
              <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 p-3 rounded-2xl shadow-lg transform hover:scale-105 transition-all duration-300">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 animate-pulse">
                <Sparkles className="w-4 h-4 text-yellow-500" />
              </div>
            </div>
            
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
                CiteBot
              </h1>
              <p className="text-sm text-gray-500 -mt-1">AI Citation Assistant</p>
            </div>
          </div>
          
          {/* User section with enhanced styling */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 bg-gradient-to-r from-gray-50 to-white px-4 py-2 rounded-xl border border-gray-200/50 shadow-sm">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700">Dashboard</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all duration-300 rounded-xl border border-transparent hover:border-red-200"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </header>
      
      <main className="h-[calc(100vh-81px)] relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-indigo-200/20 rounded-full animate-pulse"></div>
          <div className="absolute top-60 right-20 w-24 h-24 bg-purple-200/20 rounded-full animate-pulse delay-300"></div>
          <div className="absolute bottom-32 left-32 w-28 h-28 bg-blue-200/20 rounded-full animate-pulse delay-700"></div>
        </div>
        {children}
      </main>
    </div>
  );
}