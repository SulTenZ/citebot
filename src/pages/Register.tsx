// src/pages/Register.tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { authAPI } from '../utils/api';
import { UserPlus, Mail, Lock, Shield, Stars } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Password tidak cocok');
      return;
    }

    setLoading(true);

    try {
      await authAPI.register(email, password);
      toast.success('Registrasi berhasil! Silakan login');
      navigate('/login');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-16 w-24 h-24 bg-emerald-200 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-32 right-24 w-28 h-28 bg-teal-200 rounded-full opacity-20 animate-pulse delay-300"></div>
        <div className="absolute bottom-32 left-24 w-20 h-20 bg-green-200 rounded-full opacity-20 animate-pulse delay-700"></div>
        <div className="absolute bottom-16 right-16 w-32 h-32 bg-cyan-200 rounded-full opacity-20 animate-pulse delay-500"></div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl p-10 rounded-2xl shadow-2xl w-full max-w-md border border-white/20 relative z-10">
        {/* Header with animated icon */}
        <div className="flex items-center justify-center mb-8 relative">
          <div className="bg-gradient-to-br from-emerald-600 to-teal-600 p-4 rounded-2xl shadow-lg transform hover:scale-105 transition-transform duration-300">
            <UserPlus className="w-8 h-8 text-white" />
          </div>
          <div className="absolute -top-2 -right-2">
            <Stars className="w-4 h-4 text-yellow-500 animate-bounce" />
          </div>
        </div>
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
            Bergabung Dengan Kami
          </h1>
          <p className="text-gray-600">Buat akun CiteBot baru Anda</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 bg-gray-50/50 hover:bg-white focus:bg-white"
                placeholder="nama@email.com"
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 bg-gray-50/50 hover:bg-white focus:bg-white"
                placeholder="Minimal 6 karakter"
                minLength={6}
                required
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Konfirmasi Password
            </label>
            <div className="relative">
              <Shield className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-300 bg-gray-50/50 hover:bg-white focus:bg-white"
                placeholder="Ulangi password"
                minLength={6}
                required
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 px-4 rounded-xl hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                Memproses...
              </div>
            ) : (
              'Daftar Sekarang'
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center">
          <p className="text-gray-600">
            Sudah punya akun?{' '}
            <Link 
              to="/login" 
              className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline transition-colors duration-300"
            >
              Login disini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}