// src/utils/api.ts - Updated untuk mendukung author, year, dan sentence count
import axios from 'axios';
import { getToken } from './auth';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Type definitions untuk options parameter
interface UploadOptions {
  sentenceCount?: number;
}

interface ParaphraseOptions {
  sentenceCount?: number;
}

export const authAPI = {
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),
  
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
};

export const documentsAPI = {
  // Updated function signature untuk mendukung author, year, dan sentence count
  upload: (
    file: File, 
    citationFormat: string, 
    keyword: string, 
    author: string, 
    year: number, 
    options: UploadOptions = {}
  ) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('citationFormat', citationFormat);
    formData.append('keyword', keyword);
    formData.append('author', author);
    formData.append('year', year.toString());
    
    // Tambahkan sentence count ke additionalInfo jika ada
    if (options.sentenceCount !== undefined) {
      formData.append('additionalInfo', JSON.stringify({
        sentenceCount: options.sentenceCount
      }));
    }
    
    return api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  process: (documentId: string) =>
    api.post('/documents/process', { documentId }),
  
  getHistory: () =>
    api.get('/documents/history'),

  // Updated function signature untuk mendukung sentence count
  paraphraseText: (
    originalText: string, 
    citationFormat: string, 
    keyword: string, 
    author: string, 
    year: number,
    options: ParaphraseOptions = {}
  ) => {
    const payload: any = {
      originalText,
      citationFormat,
      keyword,
      author,
      year
    };
    
    // Tambahkan sentence count ke additionalInfo jika ada
    if (options.sentenceCount !== undefined) {
      payload.additionalInfo = {
        sentenceCount: options.sentenceCount
      };
    }
    
    return api.post('/documents/paraphrase-text', payload);
  },
};

export default api;