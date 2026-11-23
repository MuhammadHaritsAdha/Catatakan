// src/routes/allocationRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllocations,
  createAllocation,
  updateAllocation,
  transferBetweenAllocations,
  distributeLumpSum,
} = require('../controllers/allocationController');

// GET /api/allocations -> Ambil semua kantong alokasi dan total saldo riil
router.get('/', getAllocations);

// POST /api/allocations -> Tambah kantong alokasi kustom baru
router.post('/', createAllocation);

// PUT /api/allocations/:id -> Edit target / nama kantong
router.put('/:id', updateAllocation);

// POST /api/allocations/transfer -> Pindah saldo riil antar-kantong (Pos Alokasi Dana)
router.post('/transfer', transferBetweenAllocations);

// POST /api/allocations/distribute -> Bagi saldo riil begitu uang saku / pendapatan masuk
router.post('/distribute', distributeLumpSum);

module.exports = router;
