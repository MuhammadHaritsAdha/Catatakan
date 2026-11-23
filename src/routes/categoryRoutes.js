// src/routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const {
  getAllCategories,
  createCategory,
  deleteCategory,
} = require('../controllers/categoryController');

// GET /api/categories
router.get('/', getAllCategories);

// POST /api/categories
router.post('/', createCategory);

// DELETE /api/categories/:id
router.delete('/:id', deleteCategory);

module.exports = router;
