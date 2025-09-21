// src/utils/api.ts - Update untuk mendukung keyword
import axios from 'axios';
import { getToken } from './auth';

const API_URL = '/api';

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

export const authAPI = {
  register: (email: string, password: string) =>
    api.post('/auth/register', { email, password }),
  
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
};

export const documentsAPI = {
  upload: (file: File, citationFormat: string, keyword: string) => {
    const formData = new FormData();
    formData.append('document', file);
    formData.append('citationFormat', citationFormat);
    formData.append('keyword', keyword);
    return api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  process: (documentId: string) =>
    api.post('/documents/process', { documentId }),
  
  getHistory: () =>
    api.get('/documents/history'),
};

export default api;