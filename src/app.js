// src/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const transactionRoutes = require('./routes/transactionRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const allocationRoutes = require('./routes/allocationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const prdRoutes = require('./routes/prdRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend files from /public
app.use(express.static(path.join(__dirname, '../public')));

// Daftarkan Route REST API
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/allocations', allocationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/prd', prdRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'Catatkan - Aplikasi Pencatat Keuangan Mahasiswa berbasis Chat AI',
    timestamp: new Date().toISOString(),
    aiEngine: 'Hugging Face Inference API'
  });
});

module.exports = app;
