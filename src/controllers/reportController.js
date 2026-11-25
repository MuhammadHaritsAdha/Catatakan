// src/controllers/reportController.js
const dataStore = require('../services/dataStore');

// GET /api/reports/monthly
const getMonthlyReport = async (req, res) => {
  try {
    const { year, month, startDate, endDate } = req.query;
    const report = await dataStore.getMonthlyReport(year, month, startDate, endDate);
    return res.status(200).json({
      success: true,
      message: `Laporan keuangan periode ${report.period.monthName} berhasil diambil`,
      data: report,
    });
  } catch (error) {
    console.error('Error getting monthly report:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal membuat laporan bulanan',
    });
  }
};

module.exports = {
  getMonthlyReport,
};
