// src/config/syncDb.js
const { Client } = require('pg');
require('dotenv').config();

const dbName = process.env.DB_NAME || 'catatkan_db';
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = process.env.DB_PORT || 5432;

// 1. Fungsi untuk auto-create database jika belum ada
const ensureDatabaseExists = async () => {
  const rootClient = new Client({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: 'postgres', // connect ke database default postgres
  });

  try {
    await rootClient.connect();
    const checkDbQuery = 'SELECT 1 FROM pg_database WHERE datname = $1';
    const res = await rootClient.query(checkDbQuery, [dbName]);

    if (res.rowCount === 0) {
      console.log(`📦 Database "${dbName}" belum ada. Sedang membuat otomatis...`);
      await rootClient.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Berhasil membuat database baru: "${dbName}"!`);
    } else {
      console.log(`ℹ️  Database "${dbName}" sudah ada.`);
    }
  } catch (err) {
    console.warn(`⚠️  Peringatan saat memeriksa database root: ${err.message}`);
  } finally {
    try {
      await rootClient.end();
    } catch (e) {}
  }
};

const syncDatabase = async () => {
  console.log('🔄 Memulai persiapan database PostgreSQL...');
  
  // Pastikan database catatkan_db dibuat terlebih dahulu
  await ensureDatabaseExists();

  const { sequelize, testConnection } = require('./database');
  const db = require('../models');

  const isConnected = await testConnection();
  if (!isConnected) {
    console.error('❌ Tidak dapat terhubung ke PostgreSQL. Pastikan service PostgreSQL sudah aktif dan password di .env sesuai.');
    process.exit(1);
  }

  try {
    // Sinkronisasi seluruh tabel
    await sequelize.sync({ alter: true });
    console.log('✅ Semua tabel (users, categories, fund_allocations, transactions, transfer_logs) berhasil disinkronkan!');

    // Cek apakah data awal perlu di-seed
    const categoryCount = await db.Category.count();
    if (categoryCount === 0) {
      console.log('🌱 Menyemai data awal kategori & pos alokasi dana mahasiswa...');
      
      const [demoUser] = await db.User.findOrCreate({
        where: { email: 'mahasiswa@catatkan.id' },
        defaults: {
          name: 'Bima Eka Setiawan',
          password: 'hasheddemo123',
          nim: '20240140089',
          campus: 'Teknik Informatika'
        }
      });

      await db.Category.bulkCreate([
        { user_id: demoUser.id, name: 'Konsumsi', icon: '🍜', color: '#F59E0B', is_default: true },
        { user_id: demoUser.id, name: 'Tempat Tinggal', icon: '🏠', color: '#3B82F6', is_default: true },
        { user_id: demoUser.id, name: 'Kuliah', icon: '📚', color: '#8B5CF6', is_default: true },
        { user_id: demoUser.id, name: 'Transportasi', icon: '🛵', color: '#10B981', is_default: true },
        { user_id: demoUser.id, name: 'Lifestyle', icon: '☕', color: '#EC4899', is_default: true },
        { user_id: demoUser.id, name: 'Tabungan', icon: '💰', color: '#06B6D4', is_default: true },
        { user_id: demoUser.id, name: 'Uang Saku / Gaji', icon: '💵', color: '#059669', is_default: true },
        { user_id: demoUser.id, name: 'Lainnya', icon: '🏷️', color: '#6B7280', is_default: true }
      ]);

      await db.FundAllocation.bulkCreate([
        { user_id: demoUser.id, name: 'Tempat Tinggal', description: 'Uang kos, wifi, dan listrik bulanan', balance: 650000, target: 650000, icon: '🏠', color: '#3B82F6' },
        { user_id: demoUser.id, name: 'Konsumsi', description: 'Makan harian kantin, warteg, galon & snack', balance: 550000, target: 600000, icon: '🍜', color: '#F59E0B' },
        { user_id: demoUser.id, name: 'Tugas & Kuliah', description: 'Cetak modul, fotokopi, buku & print praktikum', balance: 135000, target: 150000, icon: '📚', color: '#8B5CF6' },
        { user_id: demoUser.id, name: 'Transportasi', description: 'Bensin motor, parkir, ojol & angkot', balance: 95000, target: 120000, icon: '🛵', color: '#10B981' },
        { user_id: demoUser.id, name: 'Lifestyle & Nongkrong', description: 'Nongkrong warkop/cafe, nonton & hiburan', balance: 140000, target: 180000, icon: '☕', color: '#EC4899' },
        { user_id: demoUser.id, name: 'Tabungan Mahasiswa', description: 'Dana darurat dan tabungan masa depan', balance: 450000, target: 500000, icon: '💰', color: '#06B6D4' }
      ]);

      console.log('✅ Data awal berhasil disemai!');
    }

    console.log('🎉 Setup database PostgreSQL selesai!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Gagal sinkronisasi database:', error);
    process.exit(1);
  }
};

syncDatabase();
