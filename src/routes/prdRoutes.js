// src/routes/prdRoutes.js
const express = require('express');
const router = express.Router();
const aiService = require('../services/aiServices');

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      title: 'Pengembangan Aplikasi Pencatat Keuangan Otomatis Berbasis Chat AI untuk Mahasiswa',
      appName: 'Catatkan',
      version: '1.0.0',
      background: {
        problem: 'Banyak mahasiswa menghadapi kesulitan dalam mengelola keuangan harian maupun bulanan (uang saku orang tua, kerja sampingan, UKT/SPP, biaya kos, kebutuhan kuliah print/buku, hingga nongkrong/lifestyle). Aplikasi pencatatan umum berformat form manual yang rumit membuat mahasiswa malas dan lupa mencatat.',
        solution: 'Menggunakan teknologi Natural Language Processing (NLP) pada Chat AI dengan model dari Hugging Face. Cukup berkirim pesan singkat seperti "Beli cetak modul 15rb" atau "Makan kantin 20rb", sistem AI mengenali nominal, kategori, dan waktu transaksi secara instan.'
      },
      objectives: [
        'Mengembangkan aplikasi pencatatan keuangan berbasis Chat AI yang praktis, intuitif, dan sesuai dengan kebutuhan mahasiswa.',
        'Memfasilitasi pembagian saldo ke dalam pos alokasi dana khusus mahasiswa (seperti uang kos, tugas/kuliah, kebutuhan harian, dan tabungan).',
        'Menyediakan laporan dan analisis pengeluaran bulanan secara otomatis guna membentuk kebiasaan finansial yang bijak bagi mahasiswa.'
      ],
      scopes: [
        {
          id: 1,
          name: 'Pencatatan Keuangan Berbasis Chat AI',
          description: 'Pemrosesan pesan teks otomatis (parsing) menggunakan AI/NLP untuk mengekstrak nominal, jenis transaksi, tanggal, dan kategori mandiri (Custom Categorization).',
          status: '100% Implemented (Hugging Face AI + Local NLP Fallback)'
        },
        {
          id: 2,
          name: 'Pos Alokasi Dana (Fund Allocation - Pembagian Saldo Riil)',
          description: 'Pembuatan kantong/kategori penyimpanan saldo riil begitu uang saku masuk, serta fitur pembagian dan pemindahan saldo riil antar-kategori agar dana kebutuhan utama tidak terpakai.',
          status: '100% Implemented'
        },
        {
          id: 3,
          name: 'Laporan & Rekapitulasi Pengeluaran Bulanan',
          description: 'Rekapitulasi total pengeluaran dan pemasukan periode berjalan, visualisasi grafik/chart persentase pengeluaran kategori, serta ringkasan evaluasi bulanan kategori terbesar.',
          status: '100% Implemented'
        }
      ],
      aiConfiguration: {
        provider: 'Hugging Face Inference API / Serverless',
        recommendedModels: [
          'Qwen/Qwen2.5-7B-Instruct',
          'meta-llama/Llama-3.2-3B-Instruct',
          'mistralai/Mistral-7B-Instruct-v0.3',
          'deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B'
        ],
        activeDefaultModel: aiService.DEFAULT_HF_MODEL,
        tokenConfigured: !!(process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY)
      },
      team: [
        {
          role: 'Project Manager',
          name: 'Bima Eka Setiawan',
          nim: '20240140089',
          avatar: '👨‍💼',
          responsibilities: 'Manajemen timeline proyek, koordinasi antar divisi, penyusunan PRD, dan quality assurance.'
        },
        {
          role: 'Backend Developer',
          name: 'Muhammad Harits Adha',
          nim: '20240140073',
          avatar: '👨‍💻',
          responsibilities: 'Arsitektur REST API Express.js, integrasi AI Hugging Face, controller logika transaksi dan alokasi dana.'
        },
        {
          role: 'UI/UX Designer',
          name: 'Farhan Rasyid Mustaqim',
          nim: '20240140102',
          avatar: '🎨',
          responsibilities: 'Perancangan wireframe, user flow chat keuangan praktis, dan design system antarmuka mobile/web.'
        },
        {
          role: 'UI/UX Designer',
          name: 'Dzaki Ahmad Fauzi',
          nim: '20240140082',
          avatar: '🎨',
          responsibilities: 'Desain visual dashboard pos alokasi dana, komponen interaktif, dan prototyping.'
        },
        {
          role: 'Database Engineer',
          name: 'Muhammad Daffa Azzaki',
          nim: '20240140071',
          avatar: '🗄️',
          responsibilities: 'Perancangan skema relasi database (User, Transaction, Category, FundAllocation), indexing & persistensi.'
        },
        {
          role: 'Frontend Developer',
          name: 'Pasya Achmadineja Maulana',
          nim: '20240140035',
          avatar: '💻',
          responsibilities: 'Implementasi antarmuka interaktif, integrasi state management, visualisasi grafik chart laporan bulanan.'
        },
        {
          role: 'Frontend Developer',
          name: 'Adrian Bustanil',
          nim: '20240140067',
          avatar: '💻',
          responsibilities: 'Pengembangan antarmuka ruang chat AI, alur pemindahan saldo riil antar-kantong, dan responsiveness.'
        }
      ]
    }
  });
});

module.exports = router;
