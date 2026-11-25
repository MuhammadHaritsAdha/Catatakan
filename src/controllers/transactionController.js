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

    const formatRp = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);

    // 1. Tangani Out of Scope (Pertanyaan di luar konteks keuangan)
    if (parsedData.action === 'out_of_scope') {
      return res.status(200).json({
        success: true,
        action: 'out_of_scope',
        data: {
          reply: parsedData.reply
        }
      });
    }

    // 2. Tangani Cek Saldo Langsung Lewat Chat
    if (parsedData.action === 'check_balance') {
      const allocations = await dataStore.getAllocations();
      const totalBalance = allocations.reduce((acc, curr) => acc + Number(curr.balance), 0);
      const breakdownLines = allocations.map(a => `- ${a.icon || '📦'} **${a.name}:** ${formatRp(a.balance)}`).join('\n');
      const reply = `💰 **Informasi Saldo Kamu Saat Ini:**\n\n**Total Saldo Riil:** **${formatRp(totalBalance)}**\n\n📊 **Rincian per Pos Alokasi:**\n${breakdownLines}\n\n💡 *Tips: Kamu bisa memindahkan saldo antar kantong langsung lewat chat ini (contoh: "Pindahin 50rb dari Tabungan ke Konsumsi").*`;

      return res.status(200).json({
        success: true,
        action: 'check_balance',
        data: {
          totalBalance,
          allocations,
          reply
        }
      });
    }

    // 3. Tangani Permintaan Pindah Saldo yang Belum Lengkap (Tanya mau pindahin ke mana / berapa)
    if (parsedData.action === 'transfer_prompt') {
      const allocations = await dataStore.getAllocations();
      const pocketList = allocations.map(a => `- ${a.icon || '📦'} **${a.name}** (Tersedia: ${formatRp(a.balance)})`).join('\n');

      let reply = '';
      if (parsedData.amount > 0 && parsedData.fromAllocation) {
        reply = `Boleh! Kamu mau pindahin dana sebesar **${formatRp(parsedData.amount)}** dari pos **${parsedData.fromAllocation}** ke pos mana nih? 🤔\n\n**Pilihan pos alokasi tujuan:**\n${pocketList}\n\n*Contoh: "ke Konsumsi"*`;
      } else if (parsedData.amount > 0) {
        reply = `Boleh! Nominal **${formatRp(parsedData.amount)}** mau dipindahkan dari pos apa ke pos apa nih? 🤔\n\n**Pos yang tersedia saat ini:**\n${pocketList}\n\n*Contoh: "dari Tabungan ke Konsumsi"*`;
      } else {
        reply = `Boleh banget! Mau pindahin saldo berapa dan dari kantong mana ke kantong mana nih? 😊\n\n**Pos alokasi yang tersedia saat ini:**\n${pocketList}\n\n💡 *Contoh kamu bisa ketik langsung:*\n- *"Pindahin 50rb dari Tabungan ke Konsumsi"*\n- *"Transfer 100k dari Konsumsi ke Tempat Tinggal"*\n- *"Geser 20rb dari Tabungan ke Transportasi"*`;
      }

      return res.status(200).json({
        success: true,
        action: 'transfer_prompt',
        data: {
          reply
        }
      });
    }

    // 4. Tangani Pemindahan Saldo Lengkap (Transfer Antar Kantong)
    if (parsedData.action === 'transfer') {
      const allocations = await dataStore.getAllocations();
      const fromAlloc = allocations.find(a => a.name.toLowerCase() === (parsedData.fromAllocation || '').toLowerCase()) ||
                        allocations.find(a => a.name.toLowerCase().includes('tabungan')) ||
                        allocations[0];
      const toAlloc = allocations.find(a => a.name.toLowerCase() === (parsedData.toAllocation || '').toLowerCase()) ||
                      allocations.find(a => a.name.toLowerCase().includes('konsumsi')) ||
                      allocations[1] || allocations[0];

      const amount = Number(parsedData.amount) || 0;
      const reply = `🔄 Siap! Saya mendeteksi permintaan **Pemindahan Saldo** sebesar **${formatRp(amount)}** dari pos **${fromAlloc.name}** ke pos **${toAlloc.name}**.\n\nKlik tombol di bawah atau di panel pratinjau untuk mengeksekusi pemindahan saldo ini.`;

      return res.status(200).json({
        success: true,
        action: 'transfer',
        data: {
          amount,
          fromAllocation: fromAlloc.name,
          toAllocation: toAlloc.name,
          fromAllocationId: fromAlloc.id,
          toAllocationId: toAlloc.id,
          reply
        }
      });
    }

    // 4. Tangani Transaksi Biasa (Income / Expense)
    let savedTransaction = null;
    if (autoSave) {
      savedTransaction = await dataStore.addTransaction({
        ...parsedData,
        rawChat: chatMessage,
        aiParsed: true,
        aiModel: 'Asisten AI'
      });
    }

    return res.status(200).json({
      success: true,
      action: 'transaction',
      message: 'Chat berhasil diproses oleh Asisten AI!',
      data: parsedData,
      savedTransaction,
    });
  } catch (error) {
    console.error('Error handling chat:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Terjadi kesalahan pada server AI.',
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
