// src/controllers/transactionController.js
const aiService = require('../services/aiServices');
const dataStore = require('../services/dataStore');

// POST /api/transactions/chat
const handleChatTransaction = async (req, res) => {
  try {
    const { chatMessage, autoSave, hfToken, model } = req.body;

    if (!chatMessage || !chatMessage.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Pesan chat tidak boleh kosong!',
      });
    }

    // Panggil service AI Hugging Face
    const parsedData = await aiService.parseChatToTransaction(chatMessage, {
      hfToken: hfToken || req.headers['x-hf-token'],
      model: model || req.headers['x-hf-model']
    });

    let savedTransaction = null;
    if (autoSave) {
      savedTransaction = await dataStore.addTransaction({
        ...parsedData,
        rawChat: chatMessage,
        aiParsed: true,
        aiModel: parsedData.model || 'Hugging Face'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Chat berhasil diproses oleh AI Hugging Face!',
      data: parsedData,
      savedTransaction,
    });
  } catch (error) {
    console.error('Error handling chat:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan pada server AI Hugging Face.',
    });
  }
};

// GET /api/transactions
const getAllTransactions = async (req, res) => {
  try {
    const { type, category, month, year } = req.query;
    const transactions = await dataStore.getTransactions({ type, category, month, year });
    return res.status(200).json({
      success: true,
      message: 'Daftar transaksi berhasil diambil',
      data: transactions,
      total: transactions.length
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil data transaksi',
    });
  }
};

// POST /api/transactions
const createTransaction = async (req, res) => {
  try {
    const { description, amount, type, category, allocationId, date, rawChat, aiModel } = req.body;

    if (!description || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Deskripsi dan nominal transaksi wajib diisi!',
      });
    }

    const newTx = await dataStore.addTransaction({
      description,
      amount,
      type: type || 'expense',
      category: category || 'Lainnya',
      allocationId: allocationId || null,
      date: date || new Date().toISOString(),
      rawChat: rawChat || '',
      aiParsed: !!rawChat,
      aiModel: aiModel || 'Manual'
    });

    return res.status(201).json({
      success: true,
      message: 'Transaksi berhasil dicatat dan saldo pos alokasi telah disesuaikan!',
      data: newTx,
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mencatat transaksi',
    });
  }
};

// DELETE /api/transactions/:id
const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await dataStore.deleteTransaction(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Transaksi tidak ditemukan!',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Transaksi berhasil dihapus dan saldo alokasi disesuaikan!',
    });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus transaksi',
    });
  }
};

module.exports = {
  handleChatTransaction,
  getAllTransactions,
  createTransaction,
  deleteTransaction,
};
