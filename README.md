# CiteBot - AI-Powered Citation Generator

CiteBot adalah aplikasi web yang memungkinkan pengguna untuk mengupload dokumen, melakukan parafrase konten menggunakan AI (IBM Granite), dan menghasilkan sitasi dalam format APA/MLA/Chicago.

## 🚀 Fitur

- **Autentikasi Pengguna**: Registrasi & Login dengan JWT
- **Upload Dokumen**: Mendukung PDF, DOCX, dan TXT (maks 5MB)
- **AI Processing**: Parafrase otomatis dan pembuatan sitasi
- **Format Sitasi**: APA, MLA, dan Chicago
- **Riwayat Dokumen**: Simpan dan lihat dokumen yang telah diproses

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js Serverless Functions (Vercel)
- **Database**: Neon PostgreSQL
- **AI**: IBM Granite 3.3-8b via Replicate API
- **Authentication**: JWT

## 📋 Prerequisites

- Node.js 18+
- NPM atau Yarn
- Akun Neon Database
- Akun Replicate API
- Akun Vercel (untuk deployment)
