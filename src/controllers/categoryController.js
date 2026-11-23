// src/controllers/categoryController.js
const dataStore = require('../services/dataStore');

// GET /api/categories
const getAllCategories = async (req, res) => {
  try {
    const categories = await dataStore.getCategories();
    return res.status(200).json({
      success: true,
      message: 'Kategori transaksi berhasil diambil',
      data: categories,
    });
  } catch (error) {
    console.error('Error getting categories:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal mengambil kategori',
    });
  }
};

// POST /api/categories
const createCategory = async (req, res) => {
  try {
    const { name, icon, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Nama kategori wajib diisi!',
      });
    }

    const newCategory = await dataStore.addCategory(name, icon, color);
    return res.status(201).json({
      success: true,
      message: 'Kategori baru berhasil dibuat!',
      data: newCategory,
    });
  } catch (error) {
    console.error('Error creating category:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal membuat kategori baru',
    });
  }
};

// DELETE /api/categories/:id
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await dataStore.deleteCategory(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Kategori tidak ditemukan!',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Kategori berhasil dihapus!',
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    return res.status(500).json({
      success: false,
      message: 'Gagal menghapus kategori',
    });
  }
};

module.exports = {
  getAllCategories,
  createCategory,
  deleteCategory,
};
