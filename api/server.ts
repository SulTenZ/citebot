// 2. backend/server.ts
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Konfigurasi CORS bisa lebih sederhana karena originnya sama
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
// Vercel akan menangani routing, jadi kita langsung gunakan rutenya
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Backend server is running!' });
});

export default app;
