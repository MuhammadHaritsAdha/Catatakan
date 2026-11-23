// src/controllers/allocationController.js
const dataStore = require('../services/dataStore');

// GET /api/allocations
const getAllocations = async (req, res) => {
  try {
    const allocations = await dataStore.getAllocations();
    const totalBalance = allocations.reduce((acc, curr) => acc + Number(curr.balance), 0);
    const logs = await dataStore.getTransferLogs();

    return res.status(200).json({
      success: true,
      message: 'Pos alokasi dana berhasil diambil',
      data: {
        allocations,
        totalBalance,
        transferLogs: logs
      }
    });
  } catch (error) {
    console.error('Error getting allocations:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil pos alokasi dana',
    });
  }
};

// POST /api/allocations
const createAllocation = async (req, res) => {
  try {
    const { name, target, initialBalance, icon, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama kantong alokasi wajib diisi!',
      });
    }

    const newAlloc = await dataStore.addAllocation(name, target, initialBalance, icon, color);
    return res.status(201).json({
      success: true,
      message: 'Pos alokasi baru berhasil ditambahkan!',
      data: newAlloc,
    });
  } catch (error) {
    console.error('Error creating allocation:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal membuat pos alokasi',
    });
  }
};

// PUT /api/allocations/:id
const updateAllocation = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await dataStore.updateAllocation(id, req.body);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Pos alokasi tidak ditemukan',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Pos alokasi berhasil diperbarui',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating allocation:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal memperbarui pos alokasi',
    });
  }
};

// POST /api/allocations/transfer
const transferBetweenAllocations = async (req, res) => {
  try {
    const { fromId, toId, amount, reason } = req.body;

    if (!fromId || !toId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Parameter transfer (fromId, toId, amount) tidak lengkap!',
      });
    }

    const result = await dataStore.transferAllocation(fromId, toId, amount, reason);
    return res.status(200).json({
      success: true,
      message: `Pemindahan saldo riil sebesar Rp ${Number(amount).toLocaleString('id-ID')} berhasil!`,
      data: result,
    });
  } catch (error) {
    console.error('Error transfer allocation:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Gagal memindahkan saldo antar-kantong',
    });
  }
};

// POST /api/allocations/distribute
const distributeLumpSum = async (req, res) => {
  try {
    const { totalAmount, distributions } = req.body;

    if (!totalAmount || !distributions || !Array.isArray(distributions)) {
      return res.status(400).json({
        success: false,
        message: 'Total dana dan rincian alokasi harus disediakan!',
      });
    }

    const result = await dataStore.distributeLumpSum(totalAmount, distributions);
    return res.status(200).json({
      success: true,
      message: `Saldo riil Rp ${Number(totalAmount).toLocaleString('id-ID')} berhasil didistribusikan ke kantong alokasi!`,
      data: result,
    });
  } catch (error) {
    console.error('Error distribute lump sum:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Gagal mendistribusikan saldo',
    });
  }
};

module.exports = {
  getAllocations,
  createAllocation,
  updateAllocation,
  transferBetweenAllocations,
  distributeLumpSum,
};
