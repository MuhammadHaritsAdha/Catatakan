// src/config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

const dbName = process.env.DB_NAME || 'catatkan_db';
const dbUser = process.env.DB_USER || 'postgres';
const dbPassword = process.env.DB_PASSWORD || 'postgres';
const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = process.env.DB_PORT || 5432;

const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// Test connection function
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Koneksi ke PostgreSQL (database: ' + dbName + ') berhasil!');
    return true;
  } catch (error) {
    console.warn('⚠️  Peringatan: Belum dapat terhubung ke PostgreSQL:', error.message);
    console.warn('ℹ️  Aplikasi tetap berjalan dalam mode in-memory data store.');
    return false;
  }
};

module.exports = {
  sequelize,
  testConnection,
};
