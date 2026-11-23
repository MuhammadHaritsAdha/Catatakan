# 💸 Catatkan - Aplikasi Pencatat Keuangan Otomatis Berbasis Chat AI untuk Mahasiswa

> **Tugas Mata Kuliah: Manajemen Proyek**  
> Solusi praktis dan intuitif pencatatan finansial harian mahasiswa berbasis **Natural Language Processing (NLP)** menggunakan model **Hugging Face** serta manajemen **Pos Alokasi Dana (Fund Allocation - Pembagian Saldo Riil)** dan **Laporan Evaluasi Bulanan Otomatis**.

---

## 👥 Struktur Organisasi Proyek (Tim Pengembang)

| No | Nama Lengkap | NIM | Peran (Role) | Tanggung Jawab Utama |
|---|---|---|---|---|
| 1 | **Bima Eka Setiawan** | `20240140089` | **Project Manager** | Perencanaan timeline, koordinasi lintas divisi, penyusunan PRD, dan QA. |
| 2 | **Muhammad Harits Adha** | `20240140073` | **Backend Developer** | Arsitektur REST API Express.js, integrasi AI Hugging Face, controller transaksi & alokasi dana. |
| 3 | **Farhan Rasyid Mustaqim** | `20240140102` | **UI/UX Designer** | Perancangan wireframe & alur interaksi chat keuangan instan. |
| 4 | **Dzaki Ahmad Fauzi** | `20240140082` | **UI/UX Designer** | Desain visual dashboard pos alokasi dana, kartu kantong saldo riil, & design system. |
| 5 | **Muhammad Daffa Azzaki** | `20240140071` | **Database Engineer** | Perancangan skema data (User, Transaction, Category, FundAllocation) & data persistence. |
| 6 | **Pasya Achmadineja Maulana** | `20240140035` | **Frontend Developer** | Implementasi UI interaktif, visualisasi grafik Chart.js, & rekapitulasi evaluasi bulanan. |
| 7 | **Adrian Bustanil** | `20240140067` | **Frontend Developer** | Pengembangan antarmuka ruang chat AI, alur pemindahan saldo riil antar-kantong, & responsiveness. |

---

## 🎯 Keselarasan dengan PRD (Ruang Lingkup Proyek)

Aplikasi ini mengimplementasikan **100% ruang lingkup (scope)** yang tertuang pada dokumen PRD:

### 1. Pencatatan Keuangan Berbasis Chat AI (Scope 1)
- **Ekstraksi Teks Otomatis:** Mahasiswa cukup mengetik kalimat santai seperti:
  - *"Beli cetak modul 15rb"* &rarr; Otomatis terdeteksi: Rp 15.000, Pengeluaran, Kategori Kuliah, Pos Alokasi: Tugas & Kuliah.
  - *"Makan kantin 20rb"* &rarr; Otomatis terdeteksi: Rp 20.000, Pengeluaran, Kategori Konsumsi.
  - *"Kiriman uang saku ortu 1.5jt"* &rarr; Otomatis terdeteksi: Rp 1.500.000, Pemasukan, Kategori Uang Saku.
  - *"Bayar kos 650rb"* &rarr; Otomatis terdeteksi: Rp 650.000, Pengeluaran, Pos Tempat Tinggal.
- **Custom Categorization:** Pengguna dapat membuat dan mengelola kategori transaksi secara mandiri (Tempat Tinggal, Konsumsi, Lifestyle, Transportasi, Tabungan, dll) lengkap dengan icon dan warna badge.

### 2. Pos Alokasi Dana (Fund Allocation - Pembagian Saldo Riil) (Scope 2)
- **Kantong Penyimpanan Saldo Riil:** Memisahkan uang saku masuk ke kantong Tempat Tinggal (Kos), Konsumsi, Tugas & Kuliah, Transportasi, Lifestyle & Nongkrong, dan Tabungan Mahasiswa.
- **Fitur Bagi Saldo Riil (Distribution Wizard):** Begitu uang saku diterima, dapat langsung dibagi dengan aturan khusus mahasiswa (*Prioritas Kebutuhan Pokok & Kuliah*) atau custom amount.
- **Fitur Pemindahan Saldo Riil Antar-Kantong:** Saldo dapat dipindahkan antar-kantong (misalnya dari Lifestyle ke Kosan) dengan pencatatan log mutasi sehingga dana kebutuhan utama tidak terpakai untuk nongkrong.

### 3. Laporan & Rekapitulasi Pengeluaran Bulanan (Scope 3)
- **Rekapitulasi Total:** Perhitungan total pemasukan, total pengeluaran, saldo riil tersisa, dan rasio pengeluaran.
- **Visualisasi Grafik / Chart:**
  - *Doughnut Chart*: Persentase pengeluaran berdasarkan kategori utama.
  - *Bar Chart*: Perbandingan arus kas dan nominal tiap pos pengeluaran.
- **Ringkasan Evaluasi Bulanan Otomatis:** Menampilkan evaluasi kategori pengeluaran terbesar sesuai contoh di PRD (misal: *"Pengeluaran terbanyak bulan ini: Tempat Tinggal 52% (Rp 650.000)"*) dilengkapi dengan saran kesehatan anggaran mahasiswa.

---

## 🤗 Integrasi Model AI Hugging Face

Sistem menggunakan model AI dari **Hugging Face** dengan arsitektur multi-layer:
1. **Primary Model:** `Qwen/Qwen2.5-7B-Instruct` melalui **Hugging Face Serverless Inference API** (Chat Completions Router).
2. **Alternative Models:** `meta-llama/Llama-3.2-3B-Instruct`, `mistralai/Mistral-7B-Instruct-v0.3`, `deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B`.
3. **Resilient Local Fin-NLP Engine:** Mesin pemroses bahasa alami bahasa Indonesia khusus mahasiswa yang mengenali angka slang (*"15rb"*, *"20k"*, *"1.5jt"*, *"650.000"*) tanpa downtime bahkan saat offline atau jaringan terbatas.

---

## 🚀 Cara Menjalankan Website Secara Lokal

### 1. Clone & Masuk ke Folder Proyek
```bash
cd "Catatakan-Backend"
```

### 2. Pastikan Dependensi Terpasang
```bash
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)
File `.env` sudah disiapkan dengan konfigurasi bawaan:
```env
PORT=5000
HF_MODEL=Qwen/Qwen2.5-7B-Instruct
# Masukkan token Hugging Face Anda jika ada (opsional, sistem tetap jalan tanpa token):
HF_TOKEN=
```

### 4. Jalankan Server
```bash
npm start
# atau untuk live reload saat pengembangan:
npm run dev
```

### 5. Buka di Browser
Buka browser dan akses:
```
http://localhost:5000
```

---

## 📡 Dokumentasi Endpoint REST API

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/` | Antarmuka web utama aplikasi (HTML/CSS/JS) |
| `POST` | `/api/transactions/chat` | Parsing teks transaksi menggunakan AI Hugging Face |
| `GET` | `/api/transactions` | Mendapatkan semua daftar riwayat transaksi (mendukung filter) |
| `POST` | `/api/transactions` | Menyimpan transaksi baru (manual atau konfirmasi dari Chat AI) |
| `DELETE` | `/api/transactions/:id` | Menghapus transaksi dan mengembalikan saldo kantong |
| `GET` | `/api/allocations` | Mengambil data pos kantong saldo riil & log pemindahan |
| `POST` | `/api/allocations` | Menambah kantong alokasi baru |
| `POST` | `/api/allocations/transfer` | Memindahkan saldo riil antar-kantong |
| `POST` | `/api/allocations/distribute` | Membagikan uang saku masuk ke pos-pos alokasi |
| `GET` | `/api/categories` | Mengambil daftar kategori transaksi |
| `POST` | `/api/categories` | Membuat kategori kustom baru |
| `GET` | `/api/reports/monthly` | Menghasilkan rekapitulasi, evaluasi bulanan & breakdown grafik |
| `GET` | `/api/prd` | Data lengkap dokumen PRD dan struktur anggota tim |
| `GET` | `/api/health` | Status server dan engine AI |

---

## 🛠️ Tech Stack
- **Backend:** Node.js, Express.js (REST API CommonJS)
- **AI / NLP:** Hugging Face Inference API (`Qwen2.5-7B`, `Llama-3.2`) + Custom Indonesian Student Financial NLP Engine
- **Frontend:** Tailwind CSS (Modern Responsive Design), Vanilla JS, Chart.js, Lucide Icons
- **Database / Storage:** In-Memory & File-based JSON Persistence (`data/storage.json`) siap migrasi ke PostgreSQL Sequelize.
