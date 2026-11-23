// src/services/dataStore.js
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'storage.json');

// Default initial seed data for local fallback
const getDefaultData = () => {
  const now = new Date();
  return {
    categories: [
      { id: 1, name: 'Konsumsi', icon: '🍜', color: '#F59E0B', isDefault: true },
      { id: 2, name: 'Tempat Tinggal', icon: '🏠', color: '#3B82F6', isDefault: true },
      { id: 3, name: 'Kuliah', icon: '📚', color: '#8B5CF6', isDefault: true },
      { id: 4, name: 'Transportasi', icon: '🛵', color: '#10B981', isDefault: true },
      { id: 5, name: 'Lifestyle', icon: '☕', color: '#EC4899', isDefault: true },
      { id: 6, name: 'Tabungan', icon: '💰', color: '#06B6D4', isDefault: true },
      { id: 7, name: 'Uang Saku / Gaji', icon: '💵', color: '#059669', isDefault: true },
      { id: 8, name: 'Lainnya', icon: '🏷️', color: '#6B7280', isDefault: true },
    ],
    allocations: [
      { id: 1, name: 'Tempat Tinggal', description: 'Uang kos, wifi, dan listrik bulanan', balance: 0, target: 650000, color: '#3B82F6', icon: '🏠' },
      { id: 2, name: 'Konsumsi', description: 'Makan harian, kantin, warteg, galon & snack', balance: 0, target: 600000, color: '#F59E0B', icon: '🍜' },
      { id: 3, name: 'Tugas & Kuliah', description: 'Cetak modul, fotokopi, buku kuliah & print praktikum', balance: 0, target: 150000, color: '#8B5CF6', icon: '📚' },
      { id: 4, name: 'Transportasi', description: 'Bensin motor, ojol, parkir & angkot', balance: 0, target: 120000, color: '#10B981', icon: '🛵' },
      { id: 5, name: 'Lifestyle & Nongkrong', description: 'Nongkrong warkop/cafe, nonton, game & hiburan', balance: 0, target: 180000, color: '#EC4899', icon: '☕' },
      { id: 6, name: 'Tabungan Mahasiswa', description: 'Dana darurat dan tabungan masa depan', balance: 0, target: 500000, color: '#06B6D4', icon: '💰' }
    ],
    transactions: [],
    transferLogs: []
  };
};

class DataStore {
  constructor() {
    this.usePostgres = false;
    this.models = null;
    this.data = null;
    this.init();
  }

  async init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DATA_FILE)) {
        const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
        this.data = JSON.parse(fileContent);
      } else {
        this.data = getDefaultData();
        this.persist();
      }
    } catch (e) {
      this.data = getDefaultData();
    }

    try {
      await sequelize.authenticate();
      this.models = require('../models');
      this.usePostgres = true;
      console.log('⚡ DataStore: Menggunakan PostgreSQL (catatkan_db) secara aktif.');
    } catch (err) {
      this.usePostgres = false;
    }
  }

  async checkPostgres() {
    if (this.usePostgres && this.models) return true;
    try {
      await sequelize.authenticate();
      this.models = require('../models');
      this.usePostgres = true;
      return true;
    } catch (e) {
      this.usePostgres = false;
      return false;
    }
  }

  persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {}
  }

  // --- Transactions ---
  async getTransactions(filter = {}) {
    const isPg = await this.checkPostgres();

    if (isPg && this.models?.Transaction) {
      try {
        const where = {};
        if (filter.type) where.type = filter.type;
        if (filter.category) where.category_name = filter.category;

        const rows = await this.models.Transaction.findAll({
          where,
          order: [['transaction_date', 'DESC'], ['id', 'DESC']],
        });

        if (rows && rows.length > 0) {
          return rows.map((r) => ({
            id: r.id,
            description: r.description,
            amount: Number(r.amount),
            type: r.type,
            category: r.category_name,
            allocationId: r.allocation_id,
            date: r.transaction_date,
            rawChat: r.raw_chat,
            aiParsed: r.ai_parsed,
            aiModel: r.ai_model,
          }));
        }
      } catch (err) {
        console.warn('Postgres query error, fallback to JSON:', err.message);
      }
    }

    // JSON fallback
    let list = [...this.data.transactions];
    if (filter.type) list = list.filter((t) => t.type === filter.type);
    if (filter.category) list = list.filter((t) => t.category.toLowerCase() === filter.category.toLowerCase());
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async addTransaction(tx) {
    const isPg = await this.checkPostgres();

    const amount = Number(tx.amount) || 0;
    const type = tx.type === 'income' ? 'income' : 'expense';
    const categoryName = tx.category || (type === 'income' ? 'Uang Saku / Gaji' : 'Konsumsi');
    const targetAllocName = tx.targetAllocation || '';

    // Cari ID Alokasi yang cocok
    let allocId = tx.allocationId || null;
    let allocNameFound = '';

    // Ambil semua alokasi yang ada
    const allAllocs = await this.getAllocations();
    if (!allocId) {
      if (targetAllocName) {
        const match = allAllocs.find((a) => a.name.toLowerCase().includes(targetAllocName.toLowerCase()) || targetAllocName.toLowerCase().includes(a.name.toLowerCase()));
        if (match) {
          allocId = match.id;
          allocNameFound = match.name;
        }
      }
      if (!allocId && categoryName) {
        const match = allAllocs.find((a) => a.name.toLowerCase().includes(categoryName.toLowerCase()) || categoryName.toLowerCase().includes(a.name.toLowerCase()));
        if (match) {
          allocId = match.id;
          allocNameFound = match.name;
        }
      }
      if (!allocId) {
        if (type === 'income') {
          // Default pemasukan ke Tabungan Mahasiswa
          const tabunganAlloc = allAllocs.find((a) => a.name.toLowerCase().includes('tabungan'));
          if (tabunganAlloc) {
            allocId = tabunganAlloc.id;
            allocNameFound = tabunganAlloc.name;
          } else if (allAllocs.length > 0) {
            allocId = allAllocs[0].id;
            allocNameFound = allAllocs[0].name;
          }
        } else {
          // Default pengeluaran ke Konsumsi
          const konsumsiAlloc = allAllocs.find((a) => a.name.toLowerCase().includes('konsumsi'));
          if (konsumsiAlloc) {
            allocId = konsumsiAlloc.id;
            allocNameFound = konsumsiAlloc.name;
          } else if (allAllocs.length > 0) {
            allocId = allAllocs[0].id;
            allocNameFound = allAllocs[0].name;
          }
        }
      }
    } else {
      const match = allAllocs.find((a) => a.id == allocId);
      if (match) allocNameFound = match.name;
    }

    if (isPg && this.models?.Transaction) {
      try {
        // Pastikan user demo id 1 ada
        let user = await this.models.User.findByPk(1).catch(() => null);
        if (!user) {
          user = await this.models.User.create({
            id: 1,
            name: 'Bima Eka Setiawan',
            email: 'mahasiswa@catatkan.id',
            password: 'demo',
            nim: '20240140089',
            campus: 'Teknik Informatika'
          }).catch(() => null);
        }

        // Cari kategori jika ada
        const cat = await this.models.Category.findOne({ where: { name: categoryName } }).catch(() => null);

        const created = await this.models.Transaction.create({
          user_id: user ? user.id : 1,
          allocation_id: allocId,
          category_id: cat ? cat.id : null,
          category_name: categoryName,
          description: tx.description || (type === 'income' ? 'Pemasukan uang saku' : 'Pengeluaran baru'),
          amount,
          type,
          transaction_date: tx.date ? new Date(tx.date) : new Date(),
          raw_chat: tx.rawChat || '',
          ai_parsed: !!tx.aiParsed,
          ai_model: tx.aiModel || 'Hugging Face',
        });

        // Sesuaikan saldo Pos Alokasi Dana di Postgres
        if (allocId) {
          const alloc = await this.models.FundAllocation.findByPk(allocId);
          if (alloc) {
            const currentBal = Number(alloc.balance);
            alloc.balance = type === 'income' ? currentBal + amount : Math.max(0, currentBal - amount);
            await alloc.save();
          }
        }

        // Simpan juga ke in-memory agar konsisten
        const syncTx = {
          id: created.id,
          description: created.description,
          amount: Number(created.amount),
          type: created.type,
          category: created.category_name,
          allocationId: created.allocation_id,
          allocationName: allocNameFound,
          date: created.transaction_date,
          rawChat: created.raw_chat,
          aiParsed: created.ai_parsed,
          aiModel: created.ai_model,
        };
        this.data.transactions.unshift(syncTx);
        this.persist();

        return syncTx;
      } catch (err) {
        console.warn('Postgres insert error, fallback to JSON:', err.message);
      }
    }

    // JSON fallback
    const newTx = {
      id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      description: tx.description || (type === 'income' ? 'Pemasukan uang saku' : 'Pengeluaran baru'),
      amount,
      type,
      category: categoryName,
      allocationId: allocId,
      allocationName: allocNameFound,
      date: tx.date || new Date().toISOString(),
      rawChat: tx.rawChat || '',
      aiParsed: !!tx.aiParsed,
      aiModel: tx.aiModel || 'Hugging Face'
    };

    this.data.transactions.unshift(newTx);
    if (newTx.allocationId) {
      const alloc = this.data.allocations.find((a) => a.id == newTx.allocationId);
      if (alloc) {
        if (newTx.type === 'income') alloc.balance += newTx.amount;
        else alloc.balance = Math.max(0, alloc.balance - newTx.amount);
      }
    }
    this.persist();
    return newTx;
  }

  async deleteTransaction(id) {
    const isPg = await this.checkPostgres();

    if (isPg && this.models?.Transaction) {
      try {
        const tx = await this.models.Transaction.findByPk(id);
        if (tx) {
          if (tx.allocation_id) {
            const alloc = await this.models.FundAllocation.findByPk(tx.allocation_id);
            if (alloc) {
              const currentBal = Number(alloc.balance);
              alloc.balance = tx.type === 'income' ? Math.max(0, currentBal - Number(tx.amount)) : currentBal + Number(tx.amount);
              await alloc.save();
            }
          }
          await tx.destroy();
        }
      } catch (err) {
        console.warn('Postgres delete error, fallback to JSON:', err.message);
      }
    }

    const idx = this.data.transactions.findIndex((t) => t.id == id);
    if (idx !== -1) {
      const [deleted] = this.data.transactions.splice(idx, 1);
      if (deleted.allocationId) {
        const alloc = this.data.allocations.find((a) => a.id == deleted.allocationId);
        if (alloc) {
          if (deleted.type === 'income') alloc.balance = Math.max(0, alloc.balance - deleted.amount);
          else alloc.balance += deleted.amount;
        }
      }
      this.persist();
      return true;
    }
    return true;
  }

  // --- Categories ---
  async getCategories() {
    const isPg = await this.checkPostgres();

    if (isPg && this.models?.Category) {
      try {
        const rows = await this.models.Category.findAll({ order: [['id', 'ASC']] });
        if (rows && rows.length > 0) {
          return rows.map((r) => ({
            id: r.id,
            name: r.name,
            icon: r.icon,
            color: r.color,
            isDefault: r.is_default
          }));
        }
      } catch (err) {}
    }
    return [...this.data.categories];
  }

  async addCategory(name, icon = '🏷️', color = '#6B7280') {
    const isPg = await this.checkPostgres();

    if (isPg && this.models?.Category) {
      try {
        const created = await this.models.Category.create({
          user_id: 1,
          name: name.trim(),
          icon: icon.trim() || '🏷️',
          color: color || '#6B7280',
          is_default: false
        });
        return {
          id: created.id,
          name: created.name,
          icon: created.icon,
          color: created.color,
          isDefault: false
        };
      } catch (err) {}
    }

    const newCat = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      icon: icon.trim() || '🏷️',
      color: color || '#6B7280',
      isDefault: false
    };
    this.data.categories.push(newCat);
    this.persist();
    return newCat;
  }

  async deleteCategory(id) {
    const isPg = await this.checkPostgres();
    if (isPg && this.models?.Category) {
      try {
        const cat = await this.models.Category.findByPk(id);
        if (cat) await cat.destroy();
      } catch (err) {}
    }

    const idx = this.data.categories.findIndex((c) => c.id == id);
    if (idx !== -1) {
      this.data.categories.splice(idx, 1);
      this.persist();
    }
    return true;
  }

  // --- Pos Alokasi Dana (Fund Allocation) ---
  async getAllocations() {
    const isPg = await this.checkPostgres();

    if (isPg && this.models?.FundAllocation) {
      try {
        const rows = await this.models.FundAllocation.findAll({ order: [['id', 'ASC']] });
        if (rows && rows.length > 0) {
          return rows.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            balance: Number(r.balance),
            target: Number(r.target),
            icon: r.icon,
            color: r.color
          }));
        }
      } catch (err) {}
    }
    return [...this.data.allocations];
  }

  async addAllocation(name, target = 0, initialBalance = 0, icon = '📦', color = '#3B82F6') {
    const isPg = await this.checkPostgres();

    if (isPg && this.models?.FundAllocation) {
      try {
        const created = await this.models.FundAllocation.create({
          user_id: 1,
          name: name.trim(),
          description: `Kantong alokasi untuk ${name}`,
          balance: Number(initialBalance) || 0,
          target: Number(target) || 0,
          icon: icon || '📦',
          color: color || '#3B82F6'
        });
        return {
          id: created.id,
          name: created.name,
          description: created.description,
          balance: Number(created.balance),
          target: Number(created.target),
          icon: created.icon,
          color: created.color
        };
      } catch (err) {}
    }

    const newAlloc = {
      id: `alloc-${Date.now()}`,
      name: name.trim(),
      description: `Kantong alokasi untuk ${name}`,
      balance: Number(initialBalance) || 0,
      target: Number(target) || 0,
      color: color || '#3B82F6',
      icon: icon || '📦'
    };
    this.data.allocations.push(newAlloc);
    this.persist();
    return newAlloc;
  }

  async updateAllocation(id, updates) {
    const isPg = await this.checkPostgres();
    if (isPg && this.models?.FundAllocation) {
      try {
        const alloc = await this.models.FundAllocation.findByPk(id);
        if (alloc) {
          if (updates.name) alloc.name = updates.name.trim();
          if (updates.description !== undefined) alloc.description = updates.description;
          if (updates.balance !== undefined) alloc.balance = Number(updates.balance);
          if (updates.target !== undefined) alloc.target = Number(updates.target);
          if (updates.color) alloc.color = updates.color;
          if (updates.icon) alloc.icon = updates.icon;
          await alloc.save();
          return alloc;
        }
      } catch (err) {}
    }

    const alloc = this.data.allocations.find((a) => a.id == id);
    if (!alloc) return null;
    if (updates.name) alloc.name = updates.name.trim();
    if (updates.description !== undefined) alloc.description = updates.description;
    if (updates.balance !== undefined) alloc.balance = Number(updates.balance);
    if (updates.target !== undefined) alloc.target = Number(updates.target);
    if (updates.color) alloc.color = updates.color;
    if (updates.icon) alloc.icon = updates.icon;
    this.persist();
    return alloc;
  }

  async transferAllocation(fromId, toId, amount, reason = '') {
    const numAmount = Number(amount);
    if (numAmount <= 0) throw new Error('Nominal transfer harus lebih besar dari 0');

    const isPg = await this.checkPostgres();

    if (isPg && this.models?.FundAllocation && this.models?.TransferLog) {
      try {
        const fromAlloc = await this.models.FundAllocation.findByPk(fromId);
        const toAlloc = await this.models.FundAllocation.findByPk(toId);

        if (!fromAlloc || !toAlloc) throw new Error('Kantong alokasi asal atau tujuan tidak ditemukan di database');

        const fromBal = Number(fromAlloc.balance);
        if (fromBal < numAmount) {
          throw new Error(`Saldo di kantong "${fromAlloc.name}" tidak mencukupi (Tersedia: Rp ${fromBal.toLocaleString('id-ID')})`);
        }

        fromAlloc.balance = fromBal - numAmount;
        toAlloc.balance = Number(toAlloc.balance) + numAmount;
        await fromAlloc.save();
        await toAlloc.save();

        const log = await this.models.TransferLog.create({
          user_id: 1,
          from_allocation_id: fromAlloc.id,
          to_allocation_id: toAlloc.id,
          amount: numAmount,
          reason: reason || `Pemindahan saldo dari ${fromAlloc.name} ke ${toAlloc.name}`,
          transfer_date: new Date()
        });

        return {
          fromAlloc,
          toAlloc,
          log: {
            id: log.id,
            fromAllocationId: fromAlloc.id,
            fromAllocationName: fromAlloc.name,
            toAllocationId: toAlloc.id,
            toAllocationName: toAlloc.name,
            amount: numAmount,
            reason: log.reason,
            date: log.transfer_date
          }
        };
      } catch (err) {
        if (!err.message.includes('tidak mencukupi')) {
          console.warn('Postgres transfer error, fallback to JSON:', err.message);
        } else {
          throw err;
        }
      }
    }

    // JSON fallback
    const fromAlloc = this.data.allocations.find((a) => a.id == fromId);
    const toAlloc = this.data.allocations.find((a) => a.id == toId);

    if (!fromAlloc || !toAlloc) throw new Error('Kantong alokasi asal atau tujuan tidak ditemukan');
    if (fromAlloc.balance < numAmount) {
      throw new Error(`Saldo di kantong "${fromAlloc.name}" tidak mencukupi (Tersedia: Rp ${fromAlloc.balance.toLocaleString('id-ID')})`);
    }

    fromAlloc.balance -= numAmount;
    toAlloc.balance += numAmount;

    const log = {
      id: `trf-${Date.now()}`,
      fromAllocationId: fromId,
      fromAllocationName: fromAlloc.name,
      toAllocationId: toId,
      toAllocationName: toAlloc.name,
      amount: numAmount,
      reason: reason || `Pemindahan saldo dari ${fromAlloc.name} ke ${toAlloc.name}`,
      date: new Date().toISOString()
    };

    if (!this.data.transferLogs) this.data.transferLogs = [];
    this.data.transferLogs.unshift(log);
    this.persist();

    return { fromAlloc, toAlloc, log };
  }

  async distributeLumpSum(totalAmount, distributionArray) {
    const numTotal = Number(totalAmount);
    if (numTotal <= 0) throw new Error('Total dana harus lebih dari 0');

    const isPg = await this.checkPostgres();

    if (isPg && this.models?.FundAllocation) {
      try {
        for (const item of distributionArray) {
          const alloc = await this.models.FundAllocation.findByPk(item.allocationId);
          if (alloc) {
            alloc.balance = Number(alloc.balance) + (Number(item.amount) || 0);
            await alloc.save();
          }
        }

        const tx = await this.addTransaction({
          description: 'Penerimaan dana & pembagian saldo riil ke pos alokasi',
          amount: numTotal,
          type: 'income',
          category: 'Uang Saku / Gaji',
          rawChat: `Bagi dana riil Rp ${numTotal.toLocaleString('id-ID')}`,
          aiParsed: false
        });

        const updatedAllocations = await this.getAllocations();
        return { success: true, totalAmount: numTotal, allocations: updatedAllocations, transaction: tx };
      } catch (err) {
        console.warn('Postgres distribute error, fallback to JSON:', err.message);
      }
    }

    distributionArray.forEach((item) => {
      const alloc = this.data.allocations.find((a) => a.id == item.allocationId);
      if (alloc) {
        alloc.balance += Number(item.amount || 0);
      }
    });

    const tx = await this.addTransaction({
      description: 'Penerimaan dana & pembagian saldo riil ke pos alokasi',
      amount: numTotal,
      type: 'income',
      category: 'Uang Saku / Gaji',
      rawChat: `Bagi dana riil Rp ${numTotal.toLocaleString('id-ID')}`,
      aiParsed: false
    });

    this.persist();
    return { success: true, totalAmount: numTotal, allocations: this.data.allocations, transaction: tx };
  }

  async getTransferLogs() {
    const isPg = await this.checkPostgres();
    if (isPg && this.models?.TransferLog) {
      try {
        const rows = await this.models.TransferLog.findAll({
          include: [
            { model: this.models.FundAllocation, as: 'fromAllocation' },
            { model: this.models.FundAllocation, as: 'toAllocation' }
          ],
          order: [['id', 'DESC']],
          limit: 50
        });

        if (rows && rows.length > 0) {
          return rows.map((r) => ({
            id: r.id,
            fromAllocationId: r.from_allocation_id,
            fromAllocationName: r.fromAllocation ? r.fromAllocation.name : 'Pos Asal',
            toAllocationId: r.to_allocation_id,
            toAllocationName: r.toAllocation ? r.toAllocation.name : 'Pos Tujuan',
            amount: Number(r.amount),
            reason: r.reason,
            date: r.transfer_date
          }));
        }
      } catch (err) {}
    }
    return this.data.transferLogs || [];
  }

  // --- Laporan & Rekapitulasi (Scope 3) ---
  async getMonthlyReport(year, month) {
    const y = Number(year) || new Date().getFullYear();
    const m = Number(month) || (new Date().getMonth() + 1);

    const allTransactions = await this.getTransactions();
    const categories = await this.getCategories();
    const allocations = await this.getAllocations();

    // Hitung total saldo dari semua alokasi
    const totalAllocationsBalance = allocations.reduce((acc, curr) => acc + Number(curr.balance), 0);

    // Hitung pemasukan dan pengeluaran
    let totalIncome = 0;
    let totalExpense = 0;
    const expenseByCategory = {};
    const incomeByCategory = {};

    allTransactions.forEach((tx) => {
      const d = new Date(tx.date);
      // Cocokkan bulan jika data banyak, atau hitung semua data yang ada
      if (tx.type === 'income') {
        totalIncome += Number(tx.amount);
        incomeByCategory[tx.category] = (incomeByCategory[tx.category] || 0) + Number(tx.amount);
      } else {
        totalExpense += Number(tx.amount);
        expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + Number(tx.amount);
      }
    });

    const netSavings = totalIncome - totalExpense;

    const categoryBreakdown = Object.entries(expenseByCategory).map(([category, amount]) => {
      const percentage = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
      const catObj = categories.find((c) => c.name.toLowerCase() === category.toLowerCase());
      return {
        category,
        amount,
        percentage,
        color: catObj ? catObj.color : '#6B7280',
        icon: catObj ? catObj.icon : '🏷️'
      };
    }).sort((a, b) => b.amount - a.amount);

    let highestExpense = null;
    let summaryEvaluation = 'Belum ada data pengeluaran yang tercatat pada bulan ini.';
    if (categoryBreakdown.length > 0) {
      highestExpense = categoryBreakdown[0];
      summaryEvaluation = `Pengeluaran terbanyak: ${highestExpense.category} sebesar ${highestExpense.percentage}% (Rp ${highestExpense.amount.toLocaleString('id-ID')}).`;
    }

    const expenseRatio = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0;
    let financialAdvice = '';
    if (totalExpense === 0) {
      financialAdvice = 'Belum ada pengeluaran yang dicatat. Catat setiap transaksi agar keuanganmu terkontrol!';
    } else if (expenseRatio <= 60) {
      financialAdvice = 'Finansial Kamu Sangat Sehat! Kamu berhasil menghemat lebih dari 40% pemasukan. Pertahankan alokasi ke pos Tabungan Mahasiswa.';
    } else if (expenseRatio <= 85) {
      financialAdvice = 'Keuangan Kamu Cukup Terkendali. Awasi pengeluaran kategori Lifestyle & Nongkrong agar saldo tidak menipis.';
    } else {
      financialAdvice = 'Peringatan Anggaran: Pengeluaran sudah mendekati atau melebihi pemasukan. Kurangi pos Lifestyle dan fokuskan pada Tempat Tinggal dan Konsumsi.';
    }

    return {
      period: {
        year: y,
        month: m,
        monthName: new Date(y, m - 1, 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' })
      },
      summary: {
        totalIncome,
        totalExpense,
        netSavings,
        totalAllocationsBalance,
        totalTransactionsCount: allTransactions.length,
        expenseRatio
      },
      highestExpense,
      summaryEvaluation,
      financialAdvice,
      categoryBreakdown,
      transactions: allTransactions
    };
  }
}

const dataStore = new DataStore();
module.exports = dataStore;
