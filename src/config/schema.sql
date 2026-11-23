-- ====================================================================
-- DATABASE SCHEMA: CATATKAN (PostgreSQL)
-- Aplikasi Pencatat Keuangan Otomatis Berbasis Chat AI untuk Mahasiswa
-- Mata Kuliah: Manajemen Proyek
-- Database Engineer: Muhammad Daffa Azzaki (20240140071)
-- ====================================================================

-- 1. Buat Database (Jalankan di query tool / pgAdmin / psql)
-- CREATE DATABASE catatkan_db;
-- \c catatkan_db;

-- Aktifkan ekstensi UUID jika diperlukan
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- TABEL 1: users (Pengguna / Mahasiswa)
-- ====================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nim VARCHAR(20),
    campus VARCHAR(100) DEFAULT 'Universitas',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- TABEL 2: categories (Kategori Transaksi - Scope 1: Custom Categorization)
-- ====================================================================
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(10) DEFAULT '🏷️',
    color VARCHAR(20) DEFAULT '#6B7280',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- TABEL 3: fund_allocations (Pos Alokasi Dana Riil - Scope 2)
-- ====================================================================
CREATE TABLE IF NOT EXISTS fund_allocations (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    balance DECIMAL(15, 2) DEFAULT 0.00,
    target DECIMAL(15, 2) DEFAULT 0.00,
    icon VARCHAR(10) DEFAULT '📦',
    color VARCHAR(20) DEFAULT '#3B82F6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- TABEL 4: transactions (Riwayat Catatan Transaksi - Scope 1 & 3)
-- ====================================================================
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    allocation_id INT REFERENCES fund_allocations(id) ON DELETE SET NULL,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    category_name VARCHAR(50) NOT NULL,
    description VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    raw_chat TEXT,
    ai_parsed BOOLEAN DEFAULT false,
    ai_model VARCHAR(100) DEFAULT 'Hugging Face (Qwen2.5-7B-Instruct)',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- TABEL 5: transfer_logs (Log Pemindahan Saldo Antar-Kantong - Scope 2)
-- ====================================================================
CREATE TABLE IF NOT EXISTS transfer_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    from_allocation_id INT REFERENCES fund_allocations(id) ON DELETE CASCADE,
    to_allocation_id INT REFERENCES fund_allocations(id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL,
    reason VARCHAR(255),
    transfer_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- INDEXING UNTUK OPTIMASI PERFORMA & QUERY LAPORAN
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_name);
CREATE INDEX IF NOT EXISTS idx_transactions_allocation ON transactions(allocation_id);
CREATE INDEX IF NOT EXISTS idx_allocations_user ON fund_allocations(user_id);

-- ====================================================================
-- INITIAL SEED DATA (DATA AWAL SESUAI PRD MAHASISWA)
-- ====================================================================

-- 1. Insert User Mahasiswa Demo
INSERT INTO users (id, name, email, password, nim, campus) 
VALUES (1, 'Bima Eka Setiawan', 'mahasiswa@catatkan.id', '$2b$10$hasheddemo123', '20240140089', 'Teknik Informatika')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Kategori Default
INSERT INTO categories (id, user_id, name, icon, color, is_default) VALUES
(1, 1, 'Konsumsi', '🍜', '#F59E0B', true),
(2, 1, 'Tempat Tinggal', '🏠', '#3B82F6', true),
(3, 1, 'Kuliah', '📚', '#8B5CF6', true),
(4, 1, 'Transportasi', '🛵', '#10B981', true),
(5, 1, 'Lifestyle', '☕', '#EC4899', true),
(6, 1, 'Tabungan', '💰', '#06B6D4', true),
(7, 1, 'Uang Saku / Gaji', '💵', '#059669', true),
(8, 1, 'Lainnya', '🏷️', '#6B7280', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Pos Alokasi Dana (Kantong Saldo Riil)
INSERT INTO fund_allocations (id, user_id, name, description, balance, target, icon, color) VALUES
(1, 1, 'Tempat Tinggal', 'Uang kos, wifi, dan listrik bulanan', 650000.00, 650000.00, '🏠', '#3B82F6'),
(2, 1, 'Konsumsi', 'Makan harian kantin, warteg, galon & snack', 550000.00, 600000.00, '🍜', '#F59E0B'),
(3, 1, 'Tugas & Kuliah', 'Cetak modul, fotokopi, buku & print praktikum', 135000.00, 150000.00, '📚', '#8B5CF6'),
(4, 1, 'Transportasi', 'Bensin motor, parkir, ojol & angkot', 95000.00, 120000.00, '🛵', '#10B981'),
(5, 1, 'Lifestyle & Nongkrong', 'Nongkrong warkop/cafe, nonton & hiburan', 140000.00, 180000.00, '☕', '#EC4899'),
(6, 1, 'Tabungan Mahasiswa', 'Dana darurat dan tabungan masa depan', 450000.00, 500000.00, '💰', '#06B6D4')
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Contoh Transaksi Chat AI Awal
INSERT INTO transactions (id, user_id, allocation_id, category_name, description, amount, type, transaction_date, raw_chat, ai_parsed, ai_model) VALUES
(1, 1, 6, 'Uang Saku / Gaji', 'Kiriman uang saku dari orang tua', 2000000.00, 'income', CURRENT_TIMESTAMP - INTERVAL '15 days', 'Dapat kiriman uang saku 2 juta dari ortu', true, 'Hugging Face (Qwen2.5-7B-Instruct)'),
(2, 1, 1, 'Tempat Tinggal', 'Bayar kosan bulan berjalan', 650000.00, 'expense', CURRENT_TIMESTAMP - INTERVAL '14 days', 'Bayar kos 650rb', true, 'Hugging Face (Qwen2.5-7B-Instruct)'),
(3, 1, 2, 'Konsumsi', 'Makan kantin teknik siang', 20000.00, 'expense', CURRENT_TIMESTAMP - INTERVAL '10 days', 'Makan kantin 20rb', true, 'Hugging Face (Qwen2.5-7B-Instruct)'),
(4, 1, 3, 'Kuliah', 'Beli cetak modul mata kuliah & fotokopi', 15000.00, 'expense', CURRENT_TIMESTAMP - INTERVAL '8 days', 'Beli cetak modul 15rb', true, 'Hugging Face (Qwen2.5-7B-Instruct)'),
(5, 1, 4, 'Transportasi', 'Bensin motor beat', 25000.00, 'expense', CURRENT_TIMESTAMP - INTERVAL '5 days', 'Isi bensin 25rb', true, 'Hugging Face (Qwen2.5-7B-Instruct)'),
(6, 1, 5, 'Lifestyle', 'Nongkrong warkop & es kopi bareng temen', 22000.00, 'expense', CURRENT_TIMESTAMP - INTERVAL '3 days', 'Nongkrong ngopi 22rb', true, 'Hugging Face (Qwen2.5-7B-Instruct)'),
(7, 1, 2, 'Konsumsi', 'Makan siang warteg plus es teh', 18000.00, 'expense', CURRENT_TIMESTAMP - INTERVAL '1 days', 'Makan warteg 18k', true, 'Hugging Face (Qwen2.5-7B-Instruct)')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence IDs
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
SELECT setval('fund_allocations_id_seq', (SELECT MAX(id) FROM fund_allocations));
SELECT setval('transactions_id_seq', (SELECT MAX(id) FROM transactions));
