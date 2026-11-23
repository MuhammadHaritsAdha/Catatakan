// src/routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const {
  handleChatTransaction,
  getAllTransactions,
  createTransaction,
  deleteTransaction,
} = require('../controllers/transactionController');

// GET /api/transactions -> Ambil semua riwayat transaksi
router.get('/', getAllTransactions);

// POST /api/transactions -> Catat transaksi baru
router.post('/', createTransaction);

// POST /api/transactions/chat -> Fitur Chat AI Pencatat Keuangan (Hugging Face)
router.post('/chat', handleChatTransaction);

// DELETE /api/transactions/:id -> Hapus transaksi
router.delete('/:id', deleteTransaction);

module.exports = router;
