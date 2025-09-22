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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ message: 'Backend server is running!' });
});

// Tambahkan kode ini untuk menjalankan server di environment lokal
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Backend server berjalan di http://localhost:${PORT}`);
  });
}

export default app;
