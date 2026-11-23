// src/routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { getMonthlyReport } = require('../controllers/reportController');

// GET /api/reports/monthly
router.get('/monthly', getMonthlyReport);

module.exports = router;
