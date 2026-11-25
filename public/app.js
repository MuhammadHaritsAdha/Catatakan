// public/app.js
/**
 * Catatkan - Frontend Application Logic
 * Integrasi AI Pencatat Keuangan, Pos Alokasi Dana, dan Laporan Bulanan
 */

// State Management
let appState = {
  transactions: [],
  categories: [],
  allocations: [],
  totalBalance: 0,
  transferLogs: [],
  currentMonthReport: null,
  activeParsedTx: null,
  hfSettings: {
    model: localStorage.getItem('catatkan_hf_model') || 'Qwen/Qwen2.5-7B-Instruct',
    token: localStorage.getItem('catatkan_hf_token') || ''
  }
};

let donutChartInstance = null;
let barChartInstance = null;

// Currency Formatter
const formatRupiah = (val) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val || 0);
};

// Date Formatter
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Toast notification helper
const showToast = (message, type = 'success') => {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;

  const iconName = type === 'success' ? 'check-circle' : (type === 'error' ? 'alert-triangle' : 'info');
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-5 h-5 shrink-0"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
};

// TAB SWITCHING
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.mobile-nav-btn').forEach(el => el.classList.remove('active'));

  const targetContent = document.getElementById(tabId);
  if (targetContent) {
    targetContent.classList.remove('hidden');
  }

  const navBtn = document.getElementById(`tab-btn-${tabId}`);
  if (navBtn) navBtn.classList.add('active');

  const mobBtn = document.getElementById(`mob-tab-${tabId}`);
  if (mobBtn) mobBtn.classList.add('active');

  // Trigger chart re-render if switching to report tab
  if (tabId === 'reports-view') {
    setTimeout(() => {
      if (appState.currentMonthReport) {
        renderCharts(appState.currentMonthReport);
      }
    }, 100);
  }

  lucide.createIcons();
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  if (menu) menu.classList.toggle('hidden');
}

// ==========================================
// DATA FETCHING & SYNCHRONIZATION
// ==========================================

async function fetchInitialData() {
  try {
    await Promise.all([
      fetchCategories(),
      fetchAllocations(),
      fetchTransactions(),
      fetchPrdData(),
      loadMonthlyReport()
    ]);
    updateOverviewStats();
  } catch (err) {
    console.error('Error fetching initial data:', err);
  }
}

async function fetchCategories() {
  try {
    const res = await fetch('/api/categories');
    const json = await res.json();
    if (json.success) {
      appState.categories = json.data;
      renderCategoriesUI();
    }
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

async function fetchAllocations() {
  try {
    const res = await fetch('/api/allocations');
    const json = await res.json();
    if (json.success) {
      appState.allocations = json.data.allocations;
      appState.totalBalance = json.data.totalBalance;
      appState.transferLogs = json.data.transferLogs || [];
      renderAllocationsUI();
      renderTransferLogsUI();
    }
  } catch (err) {
    console.error('Failed to load allocations:', err);
  }
}

async function fetchTransactions() {
  try {
    const res = await fetch('/api/transactions');
    const json = await res.json();
    if (json.success) {
      appState.transactions = json.data;
      renderTransactionsTable(appState.transactions);
      updateOverviewStats();
    }
  } catch (err) {
    console.error('Failed to load transactions:', err);
  }
}

async function fetchPrdData() {
  try {
    const res = await fetch('/api/prd');
    const json = await res.json();
    if (json.success) {
      renderTeamCards(json.data.team);
    }
  } catch (err) {
    console.error('Failed to load PRD data:', err);
  }
}

async function updateOverviewStats() {
  try {
    const res = await fetch('/api/reports/monthly');
    const json = await res.json();
    if (json.success && json.data) {
      const rep = json.data;
      const totalSaldo = rep.summary.totalAllocationsBalance;
      const totalIn = rep.summary.totalIncome;
      const totalOut = rep.summary.totalExpense;
      const netSavings = rep.summary.netSavings;

      const totalSaldoEl = document.getElementById('statTotalSaldo');
      if (totalSaldoEl) totalSaldoEl.textContent = formatRupiah(totalSaldo);

      const totalSaldoAllocEl = document.getElementById('statTotalSaldoAllocBanner');
      if (totalSaldoAllocEl) totalSaldoAllocEl.textContent = formatRupiah(totalSaldo);

      const totalInEl = document.getElementById('statTotalPemasukan');
      if (totalInEl) totalInEl.textContent = formatRupiah(totalIn);

      const totalOutEl = document.getElementById('statTotalPengeluaran');
      if (totalOutEl) totalOutEl.textContent = formatRupiah(totalOut);

      // Report Tab summary elements
      const repInEl = document.getElementById('reportTotalIncome');
      if (repInEl) repInEl.textContent = formatRupiah(totalIn);

      const repOutEl = document.getElementById('reportTotalExpense');
      if (repOutEl) repOutEl.textContent = formatRupiah(totalOut);

      const repNetEl = document.getElementById('reportNetSavings');
      if (repNetEl) repNetEl.textContent = formatRupiah(netSavings);
    }
  } catch (err) {
    console.error('Error updating overview stats:', err);
  }
}

// ==========================================
// TAB 1: CHAT AI WORKFLOW
// ==========================================

function sendPredefinedMessage(text) {
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = text;
    handleChatSubmit(new Event('submit'));
  }
}

function resetChatHistory() {
  const container = document.getElementById('chatMessages');
  if (container) {
    container.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
          <i data-lucide="bot" class="w-4 h-4"></i>
        </div>
        <div class="bg-slate-100 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[85%] space-y-2 shadow-sm">
          <p class="font-semibold text-slate-900">Halo mahasiswa hebat! 👋</p>
          <p>Ada pengeluaran atau pemasukan apa hari ini? Tulis aja langsung santai, contoh:</p>
          <div class="flex flex-wrap gap-1.5 pt-1">
            <span class="text-xs bg-white text-indigo-700 px-2.5 py-1 rounded-full border border-slate-200 cursor-pointer hover:bg-indigo-50" onclick="sendPredefinedMessage('Makan kantin 20rb')">"Makan kantin 20rb"</span>
            <span class="text-xs bg-white text-indigo-700 px-2.5 py-1 rounded-full border border-slate-200 cursor-pointer hover:bg-indigo-50" onclick="sendPredefinedMessage('Beli cetak modul 15rb')">"Beli cetak modul 15rb"</span>
            <span class="text-xs bg-white text-indigo-700 px-2.5 py-1 rounded-full border border-slate-200 cursor-pointer hover:bg-indigo-50" onclick="sendPredefinedMessage('Kiriman uang saku ortu 1.5jt')">"Kiriman uang saku ortu 1.5jt"</span>
          </div>
        </div>
      </div>
    `;
    lucide.createIcons();
  }
  document.getElementById('aiEmptyCard').classList.remove('hidden');
  document.getElementById('aiResultCard').classList.add('hidden');
  document.getElementById('aiInferenceBadge').textContent = 'Menunggu input...';
}

async function handleChatSubmit(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('chatInput');
  const chatMessage = input.value.trim();
  if (!chatMessage) return;

  // Append user chat message
  appendChatMessage('user', chatMessage);
  input.value = '';

  // Show bot typing indicator
  const typingIndicatorId = appendTypingIndicator();

  // Update preview badge
  const badge = document.getElementById('aiInferenceBadge');
  if (badge) {
    badge.className = 'text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-mono flex items-center gap-1';
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Memproses pesan...`;
  }

  try {
    const res = await fetch('/api/transactions/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hf-token': appState.hfSettings.token,
        'x-hf-model': appState.hfSettings.model
      },
      body: JSON.stringify({
        chatMessage,
        model: appState.hfSettings.model,
        hfToken: appState.hfSettings.token
      })
    });

    const json = await res.json();
    removeTypingIndicator(typingIndicatorId);

    if (json.success && json.data) {
      const parsed = json.data;
      const action = json.action || 'transaction';

      // 1. Tangani Pesan di Luar Konteks Keuangan
      if (action === 'out_of_scope') {
        resetChatPreviewCard();
        appendChatMessage('bot', parsed.reply || 'Halo! Saya adalah asisten pencatat keuangan mahasiswa.');
        return;
      }

      // 2. Tangani Permintaan Cek Saldo Langsung
      if (action === 'check_balance') {
        resetChatPreviewCard();
        appendChatMessage('bot', parsed.reply);
        updateOverviewStats();
        return;
      }

      // 3. Tangani Permintaan Pindah Saldo yang Belum Lengkap (Tanya tujuan & nominal)
      if (action === 'transfer_prompt') {
        resetChatPreviewCard();
        appendChatMessage('bot', parsed.reply);
        return;
      }

      // 4. Tangani Pemindahan Saldo (Transfer Antar Kantong)
      if (action === 'transfer') {
        appState.activeParsedTx = {
          ...parsed,
          type: 'transfer',
          rawChat: chatMessage
        };

        renderParsedPreview(appState.activeParsedTx);

        appendChatMessage('bot', parsed.reply, {
          type: 'transfer',
          amount: parsed.amount,
          fromAllocation: parsed.fromAllocation,
          toAllocation: parsed.toAllocation,
          fromAllocationId: parsed.fromAllocationId,
          toAllocationId: parsed.toAllocationId
        });
        return;
      }

      // 4. Tangani Catatan Transaksi (Income / Expense)
      appState.activeParsedTx = { ...parsed, rawChat: chatMessage };

      // Update right-hand preview card
      renderParsedPreview(parsed);

      // Bot chat response message
      const typeLabel = parsed.type === 'income' ? 'pemasukan' : 'pengeluaran';
      const botResponse = `Siap! Saya mendeteksi catatan ${typeLabel} sebesar **${formatRupiah(parsed.amount)}** untuk **${parsed.description}** pada kategori **${parsed.category}** (pos alokasi: *${parsed.targetAllocation}*).`;

      appendChatMessage('bot', botResponse, parsed);
    } else {
      appendChatMessage('bot', 'Maaf, AI mengalami kendala saat membaca catatan. Coba tulis kalimat lebih sederhana ya!');
    }
  } catch (err) {
    console.error('Error sending chat:', err);
    removeTypingIndicator(typingIndicatorId);
    appendChatMessage('bot', 'Terjadi kesalahan koneksi ke server AI.');
  }
}

function appendChatMessage(sender, text, parsedData = null) {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `flex items-start gap-3 ${sender === 'user' ? 'justify-end' : ''}`;

  if (sender === 'user') {
    msgDiv.innerHTML = `
      <div class="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-[80%] shadow-sm">
        <p>${escapeHtml(text)}</p>
      </div>
      <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 font-bold text-xs">
        Saya
      </div>
    `;
  } else {
    let actionBtnHtml = '';
    if (parsedData) {
      if (parsedData.type === 'transfer') {
        actionBtnHtml = `
          <div class="mt-2.5 pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
            <span class="text-[11px] font-semibold text-brand-800">Transfer &bull; ${formatRupiah(parsedData.amount)} (${parsedData.fromAllocation} &rarr; ${parsedData.toAllocation})</span>
            <button onclick="confirmAiTransfer('${parsedData.fromAllocationId}', '${parsedData.toAllocationId}', ${parsedData.amount})" class="text-xs bg-brand-800 hover:bg-brand-900 text-white px-3 py-1.5 rounded-lg font-medium shadow-sm transition flex items-center gap-1.5">
              <i data-lucide="arrow-left-right" class="w-3.5 h-3.5"></i>
              Konfirmasi Pindah Saldo &rarr;
            </button>
          </div>
        `;
      } else {
        actionBtnHtml = `
          <div class="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
            <span class="text-[11px] font-semibold text-indigo-700">${parsedData.category} &bull; ${formatRupiah(parsedData.amount)}</span>
            <button onclick="confirmSaveParsedTransaction()" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg font-medium shadow-sm transition">
              Simpan Transaksi &rarr;
            </button>
          </div>
        `;
      }
    }

    msgDiv.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
        <i data-lucide="bot" class="w-4 h-4"></i>
      </div>
      <div class="bg-slate-100 text-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[85%] shadow-sm space-y-1">
        <div>${markedParse(text)}</div>
        ${actionBtnHtml}
      </div>
    `;
  }

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
  lucide.createIcons();
}

function appendTypingIndicator() {
  const container = document.getElementById('chatMessages');
  if (!container) return null;

  const id = `typing-${Date.now()}`;
  const typingDiv = document.createElement('div');
  typingDiv.id = id;
  typingDiv.className = 'flex items-start gap-3';
  typingDiv.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
      <i data-lucide="bot" class="w-4 h-4"></i>
    </div>
    <div class="bg-slate-100 text-slate-500 rounded-2xl rounded-tl-sm px-4 py-2 text-xs flex items-center gap-1.5">
      <span class="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"></span>
      <span class="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style="animation-delay: 0.15s"></span>
      <span class="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style="animation-delay: 0.3s"></span>
      <span class="ml-1 text-[11px] text-gray-500">Sedang memproses catatan...</span>
    </div>
  `;
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;
  lucide.createIcons();
  return id;
}

function removeTypingIndicator(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

function resetChatPreviewCard() {
  const emptyCard = document.getElementById('aiEmptyCard');
  const resultCard = document.getElementById('aiResultCard');
  if (emptyCard) emptyCard.classList.remove('hidden');
  if (resultCard) resultCard.classList.add('hidden');

  const badge = document.getElementById('aiInferenceBadge');
  if (badge) {
    badge.className = 'text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600';
    badge.textContent = 'Menunggu input...';
  }
  appState.activeParsedTx = null;
}

function renderParsedPreview(parsed) {
  document.getElementById('aiEmptyCard').classList.add('hidden');
  document.getElementById('aiResultCard').classList.remove('hidden');

  const badge = document.getElementById('aiInferenceBadge');
  if (badge) {
    if (parsed.type === 'transfer') {
      badge.className = 'text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono';
      badge.textContent = 'Pemindahan Saldo';
    } else {
      badge.className = 'text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono';
      badge.textContent = 'Pencatatan Otomatis';
    }
  }

  const typeBadge = document.getElementById('previewTypeBadge');
  if (typeBadge) {
    if (parsed.type === 'transfer') {
      typeBadge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800';
      typeBadge.textContent = 'Pindah Saldo';
    } else if (parsed.type === 'income') {
      typeBadge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700';
      typeBadge.textContent = 'Pemasukan';
    } else {
      typeBadge.className = 'text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700';
      typeBadge.textContent = 'Pengeluaran';
    }
  }

  const amtEl = document.getElementById('previewAmount');
  if (amtEl) amtEl.textContent = formatRupiah(parsed.amount);

  const descEl = document.getElementById('previewDescription');
  if (descEl) {
    descEl.textContent = parsed.type === 'transfer' ? `Transfer: ${parsed.fromAllocation} -> ${parsed.toAllocation}` : (parsed.description || '-');
  }

  const catEl = document.getElementById('previewCategory');
  if (catEl) {
    catEl.textContent = parsed.type === 'transfer' ? `Dari: ${parsed.fromAllocation}` : (parsed.category || '-');
  }

  const allocEl = document.getElementById('previewAllocation');
  if (allocEl) {
    allocEl.textContent = parsed.type === 'transfer' ? `Ke: ${parsed.toAllocation}` : (parsed.targetAllocation || 'Umum');
  }

  const modelEl = document.getElementById('previewModelName');
  if (modelEl) modelEl.textContent = 'Pencatatan Otomatis';

  const saveBtn = document.getElementById('btnSaveParsedTx');
  if (saveBtn) {
    saveBtn.disabled = false;
    if (parsed.type === 'transfer') {
      saveBtn.onclick = () => confirmAiTransfer(parsed.fromAllocationId, parsed.toAllocationId, parsed.amount);
      saveBtn.innerHTML = `<i data-lucide="arrow-left-right" class="w-4 h-4"></i><span>Eksekusi Pemindahan Saldo</span>`;
    } else {
      saveBtn.onclick = confirmSaveParsedTransaction;
      saveBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Konfirmasi & Simpan</span>`;
    }
  }
  lucide.createIcons();
}

async function confirmAiTransfer(fromId, toId, amount) {
  if (!fromId || !toId || !amount) {
    showToast('Parameter transfer tidak valid', 'error');
    return;
  }

  const saveBtn = document.getElementById('btnSaveParsedTx');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="animate-spin mr-1">⌛</span> Memindahkan...`;
  }

  try {
    const res = await fetch('/api/allocations/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromId,
        toId,
        amount,
        reason: 'Pemindahan saldo via Chat AI'
      })
    });

    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      appendChatMessage('bot', `✅ **Pemindahan Saldo Berhasil!**\nSaldo sebesar **${formatRupiah(amount)}** telah berhasil dipindahkan.`);
      resetChatPreviewCard();
      await Promise.all([
        fetchAllocations(),
        loadMonthlyReport()
      ]);
      await updateOverviewStats();
    } else {
      showToast(json.message || 'Gagal memindahkan saldo', 'error');
      appendChatMessage('bot', `⚠️ Gagal memindahkan saldo: ${json.message}`);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i data-lucide="arrow-left-right" class="w-4 h-4"></i><span>Coba Lagi</span>`;
      }
    }
  } catch (err) {
    console.error('Error in confirmAiTransfer:', err);
    showToast('Terjadi kesalahan koneksi saat memindahkan saldo', 'error');
  }
}

async function confirmSaveParsedTransaction() {
  if (!appState.activeParsedTx) return;

  const tx = appState.activeParsedTx;
  const saveBtn = document.getElementById('btnSaveParsedTx');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="animate-spin mr-1">⌛</span> Menyimpan...`;
  }

  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        allocationId: tx.allocationId,
        targetAllocation: tx.targetAllocation,
        date: tx.date || new Date().toISOString(),
        rawChat: tx.rawChat,
        aiModel: tx.model || appState.hfSettings.model
      })
    });

    const json = await res.json();
    if (json.success) {
      const savedAlloc = json.data?.allocationName || tx.targetAllocation || 'Tabungan';
      const typeLabel = tx.type === 'income' ? 'pemasukan' : 'pengeluaran';
      const actionText = tx.type === 'income' ? 'ditambahkan ke' : 'dipotong dari';

      showToast(`Transaksi "${tx.description}" berhasil disimpan!`, 'success');

      // Tampilkan notifikasi bot langsung di jendela chat
      appendChatMessage('bot', `✅ **Transaksi Berhasil Disimpan!**\nCatatan ${typeLabel} sebesar **${formatRupiah(tx.amount)}** untuk *${tx.description}* telah dicatat ke database dan ${actionText} kantong **${savedAlloc}**.`);

      // Refresh seluruh state data & ringkasan statistik seketika tanpa refresh halaman
      await Promise.all([
        fetchTransactions(),
        fetchAllocations(),
        loadMonthlyReport()
      ]);
      await updateOverviewStats();
      await updateOverviewStats();

      // Reset preview card kembali bersih
      document.getElementById('aiEmptyCard').classList.remove('hidden');
      document.getElementById('aiResultCard').classList.add('hidden');
      document.getElementById('aiInferenceBadge').textContent = 'Tersimpan!';
      appState.activeParsedTx = null;
    } else {
      showToast(json.message || 'Gagal menyimpan transaksi', 'error');
    }
  } catch (err) {
    console.error('Error saving transaction:', err);
    showToast('Terjadi kesalahan koneksi server', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Simpan ke Database & Potong Kantong</span>`;
      lucide.createIcons();
    }
  }
}

// ==========================================
// TAB 2: POS ALOKASI DANA (FUND ALLOCATION)
// ==========================================

function renderAllocationsUI() {
  const grid = document.getElementById('allocationsGrid');
  if (!grid) return;

  grid.innerHTML = '';
  appState.allocations.forEach(alloc => {
    const percent = alloc.target > 0 ? Math.min(100, Math.round((alloc.balance / alloc.target) * 100)) : 100;
    
    const card = document.createElement('div');
    card.className = 'bg-white rounded-2xl p-5 shadow-sm border border-gray-200 flex flex-col justify-between space-y-4 hover:shadow-md transition';
    card.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-brand-50 text-brand-800 flex items-center justify-center text-xl shrink-0">
              ${alloc.icon || '📦'}
            </div>
            <div>
              <h4 class="font-bold text-gray-900 text-sm">${alloc.name}</h4>
              <p class="text-[11px] text-gray-400 line-clamp-1">${alloc.description || ''}</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="quickTransferFrom('${alloc.id}')" title="Pindah saldo dari pos ini" class="p-1.5 text-gray-400 hover:text-brand-800 rounded-lg hover:bg-gray-50 transition">
              <i data-lucide="arrow-left-right" class="w-4 h-4"></i>
            </button>
            <button onclick="openEditAllocationModal('${alloc.id}')" title="Ubah atau Hapus pos ini" class="p-1.5 text-gray-400 hover:text-brand-800 rounded-lg hover:bg-gray-50 transition">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <div>
          <span class="text-2xl font-bold text-gray-900">${formatRupiah(alloc.balance)}</span>
          <span class="text-xs text-gray-500 ml-1">/ ${alloc.target > 0 ? formatRupiah(alloc.target) : 'Fleksibel'}</span>
        </div>
      </div>

      <div class="space-y-1.5 pt-2 border-t border-gray-100">
        <div class="w-full bg-brand-100 rounded-full h-2 overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500 bg-brand-700" style="width: ${percent}%;"></div>
        </div>
        <p class="text-[11px] text-gray-500 font-medium">${percent}% dari target saldo</p>
      </div>
    `;
    grid.appendChild(card);
  });

  // Populate inline transfer dropdowns
  const fromSel = document.getElementById('inlineTransferFrom');
  const toSel = document.getElementById('inlineTransferTo');
  if (fromSel && toSel && appState.allocations.length > 0) {
    fromSel.innerHTML = '';
    toSel.innerHTML = '';
    appState.allocations.forEach(a => {
      const opt1 = document.createElement('option');
      opt1.value = a.id;
      opt1.textContent = `${a.icon || '📦'} ${a.name} (${formatRupiah(a.balance)})`;
      fromSel.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = a.id;
      opt2.textContent = `${a.icon || '📦'} ${a.name}`;
      toSel.appendChild(opt2);
    });

    if (toSel.options.length > 1) {
      toSel.selectedIndex = 1;
    }
  }

  lucide.createIcons();
}

async function executeInlineTransfer() {
  const fromSelect = document.getElementById('inlineTransferFrom');
  const toSelect = document.getElementById('inlineTransferTo');
  const amountInput = document.getElementById('inlineTransferAmount');

  if (!fromSelect || !toSelect || !amountInput) return;

  const fromId = fromSelect.value;
  const toId = toSelect.value;
  const amount = Number(amountInput.value) || 0;

  if (fromId === toId) {
    showToast('Pos asal dan tujuan tidak boleh sama!', 'error');
    return;
  }

  if (amount <= 0) {
    showToast('Nominal transfer harus lebih dari 0', 'error');
    return;
  }

  const fromAlloc = appState.allocations.find(a => a.id === fromId);
  if (fromAlloc && amount > fromAlloc.balance) {
    showToast(`Saldo ${fromAlloc.name} tidak mencukupi (Tersedia: ${formatRupiah(fromAlloc.balance)})`, 'error');
    return;
  }

  try {
    const res = await fetch('/api/allocations/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAllocationId: fromId,
        toAllocationId: toId,
        amount,
        reason: 'Pindah saldo antarpos'
      })
    });

    const json = await res.json();
    if (json.success) {
      showToast('Pemindahan saldo berhasil!', 'success');
      amountInput.value = '';
      await Promise.all([
        fetchAllocations(),
        loadMonthlyReport()
      ]);
      await updateOverviewStats();
    } else {
      showToast(json.message || 'Gagal memindahkan saldo', 'error');
    }
  } catch (err) {
    console.error('Error executing inline transfer:', err);
    showToast('Terjadi kesalahan koneksi', 'error');
  }
}

function saveUserProfile() {
  const name = document.getElementById('settingFullName')?.value || 'Farhan Rasyid';
  showToast(`Perubahan profil "${name}" berhasil disimpan.`, 'success');
}

function renderTransferLogsUI() {
  const tbody = document.getElementById('transferLogsTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!appState.transferLogs || appState.transferLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-6 text-center text-slate-400">
          Belum ada riwayat pemindahan saldo riil antar-kantong.
        </td>
      </tr>
    `;
    return;
  }

  appState.transferLogs.forEach(log => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/70 transition';
    tr.innerHTML = `
      <td class="py-2.5 px-4 font-mono text-[11px] text-slate-500">${formatDate(log.date)}</td>
      <td class="py-2.5 px-4 font-medium text-slate-800">
        <span class="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1.5"></span>${log.fromAllocationName}
      </td>
      <td class="py-2.5 px-4 font-medium text-slate-800">
        <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>${log.toAllocationName}
      </td>
      <td class="py-2.5 px-4 font-bold text-teal-700">${formatRupiah(log.amount)}</td>
      <td class="py-2.5 px-4 text-slate-500 italic">${log.reason || '-'}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Modal Bagi Saldo Riil
function openDistributeModal() {
  const list = document.getElementById('distributePocketsList');
  if (!list) return;

  list.innerHTML = '';
  appState.allocations.forEach(alloc => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100';
    item.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-lg">${alloc.icon || '📦'}</span>
        <div>
          <p class="font-bold text-slate-800 text-xs">${alloc.name}</p>
          <p class="text-[10px] text-slate-400">Saldo saat ini: ${formatRupiah(alloc.balance)}</p>
        </div>
      </div>
      <div class="w-32 relative">
        <span class="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">Rp</span>
        <input 
          type="number" 
          id="alloc-dist-input-${alloc.id}" 
          data-alloc-id="${alloc.id}" 
          value="0" 
          oninput="calculateDistributedSum()" 
          class="alloc-dist-input w-full bg-white border border-slate-200 rounded-lg pl-8 pr-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-emerald-400"
        />
      </div>
    `;
    list.appendChild(item);
  });

  document.getElementById('distributeTotalInput').value = '1500000';
  applyPresetRule('mahasiswa');
  document.getElementById('modalDistribute').classList.remove('hidden');
}

function closeDistributeModal() {
  document.getElementById('modalDistribute').classList.add('hidden');
}

function applyPresetRule(ruleType) {
  const total = Number(document.getElementById('distributeTotalInput').value) || 0;
  if (total <= 0) return;

  const inputs = document.querySelectorAll('.alloc-dist-input');
  
  if (ruleType === 'mahasiswa') {
    // Priority: Kosan 40%, Makan 30%, Kuliah 10%, Transport 10%, Tabungan 10%
    inputs.forEach(inp => {
      const id = inp.dataset.allocId;
      const alloc = appState.allocations.find(a => a.id === id);
      if (!alloc) return;

      const name = alloc.name.toLowerCase();
      let percent = 0.10;
      if (name.includes('tempat tinggal') || name.includes('kos')) percent = 0.40;
      else if (name.includes('konsumsi') || name.includes('makan')) percent = 0.30;
      else if (name.includes('kuliah') || name.includes('tugas')) percent = 0.10;
      else if (name.includes('transport')) percent = 0.10;
      else if (name.includes('tabungan')) percent = 0.10;

      inp.value = Math.round(total * percent);
    });
  } else if (ruleType === 'rata') {
    const count = inputs.length || 1;
    const each = Math.round(total / count);
    inputs.forEach(inp => {
      inp.value = each;
    });
  }

  calculateDistributedSum();
}

function recalculateDistributions() {
  applyPresetRule('mahasiswa');
}

function calculateDistributedSum() {
  const inputs = document.querySelectorAll('.alloc-dist-input');
  let sum = 0;
  inputs.forEach(inp => {
    sum += Number(inp.value) || 0;
  });
  const sumEl = document.getElementById('distributeCalculatedSum');
  if (sumEl) sumEl.textContent = formatRupiah(sum);
}

async function executeDistribution() {
  const totalAmount = Number(document.getElementById('distributeTotalInput').value) || 0;
  if (totalAmount <= 0) {
    showToast('Nominal total dana harus lebih dari 0', 'error');
    return;
  }

  const distributions = [];
  document.querySelectorAll('.alloc-dist-input').forEach(inp => {
    distributions.push({
      allocationId: inp.dataset.allocId,
      amount: Number(inp.value) || 0
    });
  });

  try {
    const res = await fetch('/api/allocations/distribute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalAmount, distributions })
    });

    const json = await res.json();
    if (json.success) {
      showToast(`Berhasil mendistribusikan uang saku ${formatRupiah(totalAmount)}!`, 'success');
      closeDistributeModal();
      await Promise.all([
        fetchAllocations(),
        fetchTransactions(),
        loadMonthlyReport()
      ]);
    } else {
      showToast(json.message || 'Gagal membagikan saldo', 'error');
    }
  } catch (err) {
    console.error('Error distributing:', err);
    showToast('Terjadi kesalahan jaringan', 'error');
  }
}

// Modal Pindah Saldo Antar-Kantong (Transfer)
function openTransferModal(fromId = null) {
  const fromSelect = document.getElementById('transferFromSelect');
  const toSelect = document.getElementById('transferToSelect');
  if (!fromSelect || !toSelect) return;

  fromSelect.innerHTML = '';
  toSelect.innerHTML = '';

  appState.allocations.forEach(alloc => {
    const optFrom = document.createElement('option');
    optFrom.value = alloc.id;
    optFrom.textContent = `${alloc.icon || '📦'} ${alloc.name} (${formatRupiah(alloc.balance)})`;
    fromSelect.appendChild(optFrom);

    const optTo = document.createElement('option');
    optTo.value = alloc.id;
    optTo.textContent = `${alloc.icon || '📦'} ${alloc.name}`;
    toSelect.appendChild(optTo);
  });

  if (fromId) {
    fromSelect.value = fromId;
  }

  // Ensure 'To' is different from 'From'
  if (fromSelect.value === toSelect.value && toSelect.options.length > 1) {
    toSelect.selectedIndex = (fromSelect.selectedIndex + 1) % toSelect.options.length;
  }

  updateTransferSourceBalance();
  document.getElementById('modalTransfer').classList.remove('hidden');
}

function quickTransferFrom(allocId) {
  openTransferModal(allocId);
}

function closeTransferModal() {
  document.getElementById('modalTransfer').classList.add('hidden');
}

function updateTransferSourceBalance() {
  const fromId = document.getElementById('transferFromSelect').value;
  const alloc = appState.allocations.find(a => a.id === fromId);
  const textEl = document.getElementById('transferSourceBalanceText');
  if (alloc && textEl) {
    textEl.textContent = `Saldo tersedia di kantong ini: ${formatRupiah(alloc.balance)}`;
  }
}

async function executeTransfer() {
  const fromId = document.getElementById('transferFromSelect').value;
  const toId = document.getElementById('transferToSelect').value;
  const amount = Number(document.getElementById('transferAmountInput').value) || 0;
  const reason = document.getElementById('transferReasonInput').value.trim();

  if (fromId === toId) {
    showToast('Kantong asal dan tujuan tidak boleh sama!', 'error');
    return;
  }

  if (amount <= 0) {
    showToast('Nominal transfer harus lebih besar dari 0!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/allocations/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromId, toId, amount, reason })
    });

    const json = await res.json();
    if (json.success) {
      showToast(`Pemindahan saldo ${formatRupiah(amount)} berhasil!`, 'success');
      closeTransferModal();
      await fetchAllocations();
    } else {
      showToast(json.message || 'Gagal memindahkan saldo', 'error');
    }
  } catch (err) {
    console.error('Error transferring:', err);
    showToast('Gagal terhubung ke server', 'error');
  }
}

// Modal Pos Kantong Baru
function openNewAllocationModal() {
  document.getElementById('modalNewAllocation').classList.remove('hidden');
}

function closeNewAllocationModal() {
  document.getElementById('modalNewAllocation').classList.add('hidden');
}

async function submitNewAllocation() {
  const name = document.getElementById('newAllocName').value.trim();
  const target = Number(document.getElementById('newAllocTarget').value) || 0;
  const icon = document.getElementById('newAllocIcon').value.trim() || '📦';
  const color = document.getElementById('newAllocColor').value;

  if (!name) {
    showToast('Nama kantong alokasi wajib diisi!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, target, icon, color })
    });

    const json = await res.json();
    if (json.success) {
      showToast(`Pos kantong "${name}" berhasil dibuat!`, 'success');
      closeNewAllocationModal();
      await fetchAllocations();
      await updateOverviewStats();
    } else {
      showToast(json.message || 'Gagal membuat pos kantong', 'error');
    }
  } catch (err) {
    console.error('Error creating allocation:', err);
  }
}

// Modal Edit / Hapus Pos Alokasi
function openEditAllocationModal(allocId) {
  const alloc = appState.allocations.find(a => String(a.id) === String(allocId));
  if (!alloc) return;

  const idEl = document.getElementById('editAllocId');
  const nameEl = document.getElementById('editAllocName');
  const targetEl = document.getElementById('editAllocTarget');
  const iconEl = document.getElementById('editAllocIcon');
  const colorEl = document.getElementById('editAllocColor');

  if (idEl) idEl.value = alloc.id;
  if (nameEl) nameEl.value = alloc.name;
  if (targetEl) targetEl.value = alloc.target || 0;
  if (iconEl) iconEl.value = alloc.icon || '📦';
  if (colorEl) colorEl.value = alloc.color || '#166534';

  const modal = document.getElementById('modalEditAllocation');
  if (modal) modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeEditAllocationModal() {
  const modal = document.getElementById('modalEditAllocation');
  if (modal) modal.classList.add('hidden');
}

async function submitEditAllocation() {
  const idEl = document.getElementById('editAllocId');
  const nameEl = document.getElementById('editAllocName');
  const targetEl = document.getElementById('editAllocTarget');
  const iconEl = document.getElementById('editAllocIcon');
  const colorEl = document.getElementById('editAllocColor');

  const id = idEl ? idEl.value : null;
  const name = nameEl ? nameEl.value.trim() : '';
  const target = targetEl ? Number(targetEl.value) || 0 : 0;
  const icon = iconEl ? iconEl.value.trim() || '📦' : '📦';
  const color = colorEl ? colorEl.value || '#166534' : '#166534';

  if (!name) {
    showToast('Nama pos alokasi tidak boleh kosong!', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/allocations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, target, icon, color })
    });

    const json = await res.json();
    if (json.success) {
      showToast('Pos alokasi berhasil diperbarui!', 'success');
      closeEditAllocationModal();
      await fetchAllocations();
      await updateOverviewStats();
    } else {
      showToast(json.message || 'Gagal memperbarui pos alokasi', 'error');
    }
  } catch (err) {
    console.error('Error updating allocation:', err);
    showToast('Gagal terhubung ke server', 'error');
  }
}

async function confirmDeleteCurrentAllocation() {
  const idEl = document.getElementById('editAllocId');
  const nameEl = document.getElementById('editAllocName');
  const id = idEl ? idEl.value : null;
  const name = nameEl ? nameEl.value : 'ini';

  if (!confirm(`Apakah Anda yakin ingin menghapus pos alokasi "${name}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/allocations/${id}`, {
      method: 'DELETE'
    });

    const json = await res.json();
    if (json.success) {
      showToast(`Pos "${name}" berhasil dihapus`, 'success');
      closeEditAllocationModal();
      await fetchAllocations();
      await updateOverviewStats();
    } else {
      showToast(json.message || 'Gagal menghapus pos alokasi', 'error');
    }
  } catch (err) {
    console.error('Error deleting allocation:', err);
    showToast('Gagal terhubung ke server', 'error');
  }
}

// ==========================================
// TAB 3: LAPORAN & REKAPITULASI (SCOPE 3)
// ==========================================

function populateMonthSelect() {
  const select = document.getElementById('reportMonthSelect');
  if (!select) return;

  const now = new Date();
  select.innerHTML = '';
  
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const opt = document.createElement('option');
    opt.value = `${y}-${m}`;
    opt.textContent = d.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
    select.appendChild(opt);
  }
}

async function loadMonthlyReport(customStartDate = null, customEndDate = null) {
  const startInput = document.getElementById('reportStartDate');
  const endInput = document.getElementById('reportEndDate');

  let startDate = customStartDate !== null ? customStartDate : (startInput ? startInput.value : '');
  let endDate = customEndDate !== null ? customEndDate : (endInput ? endInput.value : '');

  // Default tanggal awal = tanggal 1 bulan ini, tanggal akhir = hari ini / akhir bulan
  const now = new Date();
  if (!startDate && startInput) {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const yyyy = firstDay.getFullYear();
    const mm = String(firstDay.getMonth() + 1).padStart(2, '0');
    const dd = String(firstDay.getDate()).padStart(2, '0');
    startInput.value = `${yyyy}-${mm}-${dd}`;
    startDate = startInput.value;
  }
  if (!endDate && endInput) {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const yyyy = lastDay.getFullYear();
    const mm = String(lastDay.getMonth() + 1).padStart(2, '0');
    const dd = String(lastDay.getDate()).padStart(2, '0');
    endInput.value = `${yyyy}-${mm}-${dd}`;
    endDate = endInput.value;
  }

  let url = '/api/reports/monthly';
  const params = [];
  if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
  if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
  if (params.length > 0) {
    url += '?' + params.join('&');
  }

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.success && json.data) {
      appState.currentMonthReport = json.data;
      const periodBadge = document.getElementById('reportPeriodBadge');
      if (periodBadge && json.data.period?.monthName) {
        periodBadge.textContent = `Periode: ${json.data.period.monthName}`;
      }
      renderReportUI(json.data);
    }
  } catch (err) {
    console.error('Error loading report:', err);
  }
}

function applyReportDateFilter() {
  const startInput = document.getElementById('reportStartDate');
  const endInput = document.getElementById('reportEndDate');
  const s = startInput ? startInput.value : '';
  const e = endInput ? endInput.value : '';

  if (s && e && s > e) {
    showToast('Tanggal awal tidak boleh lebih besar dari tanggal akhir', 'error');
    return;
  }

  loadMonthlyReport(s, e);
  showToast('Laporan keuangan diperbarui sesuai rentang tanggal', 'success');
}

function resetReportDateFilter() {
  const now = new Date();
  const startInput = document.getElementById('reportStartDate');
  const endInput = document.getElementById('reportEndDate');

  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const pad = (n) => String(n).padStart(2, '0');
  const s = `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-01`;
  const e = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;

  if (startInput) startInput.value = s;
  if (endInput) endInput.value = e;

  loadMonthlyReport(s, e);
  showToast('Rentang tanggal direset ke bulan ini', 'info');
}

function renderReportUI(report) {
  // Evaluasi Bulanan Sesuai PRD
  const evalEl = document.getElementById('reportSummaryEvaluation');
  if (evalEl) evalEl.textContent = report.summaryEvaluation;

  const adviceEl = document.getElementById('reportFinancialAdvice');
  if (adviceEl) adviceEl.textContent = report.financialAdvice;

  // Category Breakdown Table
  const tbody = document.getElementById('categoryTableBody');
  if (tbody) {
    tbody.innerHTML = '';
    if (report.categoryBreakdown.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400">Belum ada pengeluaran pada periode ini.</td></tr>`;
    } else {
      report.categoryBreakdown.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition';
        tr.innerHTML = `
          <td class="py-3 px-4 font-semibold text-slate-800 flex items-center gap-2">
            <span>${item.icon || '🏷️'}</span>
            <span>${item.category}</span>
          </td>
          <td class="py-3 px-4 font-bold text-slate-900">${formatRupiah(item.amount)}</td>
          <td class="py-3 px-4 font-mono font-bold text-indigo-600">${item.percentage}%</td>
          <td class="py-3 px-4 w-48">
            <div class="w-full bg-slate-100 rounded-full h-2">
              <div class="h-2 rounded-full" style="width: ${item.percentage}%; background-color: ${item.color || '#6366f1'};"></div>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  // Render Charts
  renderCharts(report);
}

function renderCharts(report) {
  const figmaColors = ['#165B33', '#EAB308', '#22C55E', '#4A9060', '#9CA3AF', '#3B82F6', '#EC4899'];

  // 1. Donut Chart (Persentase Pengeluaran per Kategori)
  const donutCanvas = document.getElementById('categoryDonutChart');
  if (donutCanvas && report.categoryBreakdown.length > 0) {
    const labels = report.categoryBreakdown.map(c => c.category);
    const data = report.categoryBreakdown.map(c => c.amount);
    const colors = report.categoryBreakdown.map((c, i) => c.color || figmaColors[i % figmaColors.length]);

    if (donutChartInstance) donutChartInstance.destroy();

    donutChartInstance = new Chart(donutCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 3,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        cutout: '72%'
      }
    });

    // Custom legend
    const legendList = document.getElementById('chartLegendList');
    if (legendList) {
      legendList.innerHTML = '';
      report.categoryBreakdown.slice(0, 6).forEach((c, i) => {
        const item = document.createElement('div');
        item.className = 'flex items-center gap-1.5';
        const swatchColor = c.color || figmaColors[i % figmaColors.length];
        item.innerHTML = `
          <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${swatchColor}"></span>
          <span class="text-gray-600 truncate">${c.category} (${c.percentage}%)</span>
        `;
        legendList.appendChild(item);
      });
    }
  }

  // 2. Bar Chart (Pemasukan vs Pengeluaran & Top Kategori)
  const barCanvas = document.getElementById('categoryBarChart');
  if (barCanvas) {
    const labels = ['Pemasukan', 'Pengeluaran', ...report.categoryBreakdown.slice(0, 4).map(c => c.category)];
    const dataValues = [
      report.summary.totalIncome,
      report.summary.totalExpense,
      ...report.categoryBreakdown.slice(0, 4).map(c => c.amount)
    ];
    const barColors = [
      '#166534',
      '#EF4444',
      ...report.categoryBreakdown.slice(0, 4).map((c, i) => c.color || figmaColors[(i + 2) % figmaColors.length])
    ];

    if (barChartInstance) barChartInstance.destroy();

    barChartInstance = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: dataValues,
          backgroundColor: barColors,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => 'Rp ' + (value >= 1000000 ? (value / 1000000) + 'jt' : (value / 1000) + 'k')
            }
          }
        }
      }
    });
  }
}

// ==========================================
// TAB 4: RIWAYAT TRANSAKSI & CUSTOM CATEGORIES
// ==========================================

function renderCategoriesUI() {
  const container = document.getElementById('categoryChipsContainer');
  const filterSelect = document.getElementById('txFilterCategory');
  const manualSelect = document.getElementById('manualTxCategory');

  if (container) {
    container.innerHTML = '';
    appState.categories.forEach(cat => {
      const chip = document.createElement('span');
      chip.className = 'inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border';
      chip.style.backgroundColor = `${cat.color}15`;
      chip.style.borderColor = `${cat.color}40`;
      chip.style.color = cat.color;
      chip.innerHTML = `${cat.icon || '🏷️'} ${cat.name}`;
      container.appendChild(chip);
    });
  }

  if (filterSelect) {
    filterSelect.innerHTML = `<option value="">Semua Kategori</option>`;
    appState.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = `${cat.icon || '🏷️'} ${cat.name}`;
      filterSelect.appendChild(opt);
    });
  }

  if (manualSelect) {
    manualSelect.innerHTML = '';
    appState.categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.name;
      opt.textContent = `${cat.icon || '🏷️'} ${cat.name}`;
      manualSelect.appendChild(opt);
    });
  }
}

function renderTransactionsTable(list) {
  const tbody = document.getElementById('transactionTableBody');
  const dashList = document.getElementById('dashboardRecentTransactions');
  const countEl = document.getElementById('txSummaryCount');
  const expEl = document.getElementById('txSummaryExpense');
  const incEl = document.getElementById('txSummaryIncome');

  let totalExpense = 0;
  let totalIncome = 0;

  (list || []).forEach(tx => {
    if (tx.type === 'income') totalIncome += Number(tx.amount) || 0;
    else totalExpense += Number(tx.amount) || 0;
  });

  if (countEl) countEl.textContent = `${(list || []).length} transaksi`;
  if (expEl) expEl.textContent = `-${formatRupiah(totalExpense)}`;
  if (incEl) incEl.textContent = `+${formatRupiah(totalIncome)}`;

  // Populate Dashboard Recent Transactions
  if (dashList) {
    dashList.innerHTML = '';
    const recents = (appState.transactions || []).slice(0, 5);
    if (recents.length === 0) {
      dashList.innerHTML = `<p class="py-4 text-center text-xs text-gray-400">Belum ada transaksi tercatat.</p>`;
    } else {
      recents.forEach(tx => {
        const isIncome = tx.type === 'income';
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between py-3';
        row.innerHTML = `
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full ${isIncome ? 'bg-brand-50 text-brand-800' : 'bg-gray-100 text-gray-600'} flex items-center justify-center shrink-0">
              <i data-lucide="${isIncome ? 'arrow-down-left' : 'shopping-bag'}" class="w-4 h-4"></i>
            </div>
            <div>
              <p class="text-xs font-semibold text-gray-900">${escapeHtml(tx.description)}</p>
              <p class="text-[11px] text-gray-400">${tx.category} · ${formatDate(tx.date)}</p>
            </div>
          </div>
          <span class="text-xs font-bold ${isIncome ? 'text-brand-800' : 'text-gray-900'}">
            ${isIncome ? '+' : '-'}${formatRupiah(tx.amount)}
          </span>
        `;
        dashList.appendChild(row);
      });
    }
  }

  if (!tbody) return;

  tbody.innerHTML = '';
  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-gray-400">
          Belum ada catatan transaksi yang sesuai dengan filter.
        </td>
      </tr>
    `;
    return;
  }

  list.forEach(tx => {
    const isIncome = tx.type === 'income';
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50 transition';

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono text-[11px] text-gray-500">${formatDate(tx.date)}</td>
      <td class="py-3 px-4">
        <p class="font-bold text-gray-900 text-xs">${escapeHtml(tx.description)}</p>
        ${tx.rawChat ? `<p class="text-[10px] text-gray-400 italic font-mono">Chat: "${escapeHtml(tx.rawChat)}"</p>` : ''}
      </td>
      <td class="py-3 px-4">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700">
          ${tx.category}
        </span>
      </td>
      <td class="py-3 px-4 text-[11px] text-gray-600 font-medium">
        ${tx.allocationId ? (appState.allocations.find(a => a.id === tx.allocationId)?.name || 'Pos Terkait') : '-'}
      </td>
      <td class="py-3 px-4">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${tx.aiParsed ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-600'}">
          <i data-lucide="${tx.aiParsed ? 'sparkles' : 'pen-tool'}" class="w-3 h-3"></i> ${tx.aiParsed ? 'Chat AI' : 'Manual'}
        </span>
      </td>
      <td class="py-3 px-4 text-right font-extrabold ${isIncome ? 'text-brand-800' : 'text-gray-900'}">
        ${isIncome ? '+' : '-'}${formatRupiah(tx.amount)}
      </td>
      <td class="py-3 px-4 text-center">
        <button onclick="deleteTransaction('${tx.id}')" title="Hapus Transaksi" class="text-gray-400 hover:text-rose-600 p-1 rounded hover:bg-gray-100">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  lucide.createIcons();
}

function filterTransactions() {
  const search = document.getElementById('txSearchInput').value.toLowerCase();
  const type = document.getElementById('txFilterType').value;
  const category = document.getElementById('txFilterCategory').value;

  let filtered = [...appState.transactions];

  if (search) {
    filtered = filtered.filter(t => 
      t.description.toLowerCase().includes(search) || 
      (t.rawChat && t.rawChat.toLowerCase().includes(search))
    );
  }

  if (type) {
    filtered = filtered.filter(t => t.type === type);
  }

  if (category) {
    filtered = filtered.filter(t => t.category.toLowerCase() === category.toLowerCase());
  }

  renderTransactionsTable(filtered);
}

async function deleteTransaction(id) {
  if (!confirm('Yakin ingin menghapus catatan transaksi ini?')) return;

  try {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Transaksi berhasil dihapus!', 'success');
      await Promise.all([
        fetchTransactions(),
        fetchAllocations(),
        loadMonthlyReport()
      ]);
      await updateOverviewStats();
    } else {
      showToast(json.message || 'Gagal menghapus', 'error');
    }
  } catch (err) {
    console.error('Error deleting tx:', err);
  }
}

// Modal Kategori Kustom
function openNewCategoryModal() {
  document.getElementById('modalNewCategory').classList.remove('hidden');
}

function closeNewCategoryModal() {
  document.getElementById('modalNewCategory').classList.add('hidden');
}

async function submitNewCategory() {
  const name = document.getElementById('newCategoryName').value.trim();
  const icon = document.getElementById('newCategoryIcon').value.trim() || '🏷️';
  const color = document.getElementById('newCategoryColor').value;

  if (!name) {
    showToast('Nama kategori wajib diisi!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon, color })
    });

    const json = await res.json();
    if (json.success) {
      showToast(`Kategori "${name}" berhasil dibuat!`, 'success');
      closeNewCategoryModal();
      await fetchCategories();
    } else {
      showToast(json.message || 'Gagal membuat kategori', 'error');
    }
  } catch (err) {
    console.error('Error creating category:', err);
  }
}

// Modal Transaksi Manual
function openManualTransactionModal() {
  const allocSelect = document.getElementById('manualTxAllocation');
  if (allocSelect) {
    allocSelect.innerHTML = `<option value="">Auto-match Kantong</option>`;
    appState.allocations.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = `${a.icon || '📦'} ${a.name}`;
      allocSelect.appendChild(opt);
    });
  }
  document.getElementById('modalManualTx').classList.remove('hidden');
}

function closeManualTransactionModal() {
  document.getElementById('modalManualTx').classList.add('hidden');
}

async function submitManualTransaction() {
  const description = document.getElementById('manualTxDesc').value.trim();
  const amount = Number(document.getElementById('manualTxAmount').value) || 0;
  const type = document.getElementById('manualTxType').value;
  const category = document.getElementById('manualTxCategory').value;
  const allocationId = document.getElementById('manualTxAllocation').value;

  if (!description || amount <= 0) {
    showToast('Deskripsi dan nominal transaksi harus diisi!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, amount, type, category, allocationId, aiModel: 'Manual Entry' })
    });

    const json = await res.json();
    if (json.success) {
      showToast('Transaksi manual berhasil dicatat!', 'success');
      closeManualTransactionModal();
      await Promise.all([
        fetchTransactions(),
        fetchAllocations(),
        loadMonthlyReport()
      ]);
      await updateOverviewStats();
    } else {
      showToast(json.message || 'Gagal menyimpan', 'error');
    }
  } catch (err) {
    console.error('Error manual tx:', err);
  }
}

// ==========================================
// TAB 5: PRD & TIM PENGEMBANG
// ==========================================

function renderTeamCards(teamList) {
  const container = document.getElementById('teamCardsContainer');
  if (!container || !teamList) return;

  container.innerHTML = '';
  teamList.forEach(member => {
    const card = document.createElement('div');
    card.className = 'bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3.5 hover:shadow-sm transition';
    card.innerHTML = `
      <div class="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl shrink-0">
        ${member.avatar || '👨‍🎓'}
      </div>
      <div class="space-y-1">
        <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
          ${member.role}
        </span>
        <h4 class="font-extrabold text-slate-900 text-sm">${member.name}</h4>
        <p class="text-xs font-mono font-medium text-slate-500">NIM: ${member.nim}</p>
        <p class="text-[11px] text-slate-600 pt-1 leading-snug">${member.responsibilities}</p>
      </div>
    `;
    container.appendChild(card);
  });
}

// ==========================================
// TAB 6: PENGATURAN AI
// ==========================================

function saveHfSettings() {
  const modelEl = document.getElementById('hfModelSelect');
  const tokenEl = document.getElementById('hfTokenInput');
  if (!modelEl) return;

  const model = modelEl.value;
  const token = tokenEl ? tokenEl.value.trim() : '';

  appState.hfSettings.model = model;
  appState.hfSettings.token = token;

  localStorage.setItem('catatkan_hf_model', model);
  if (token) {
    localStorage.setItem('catatkan_hf_token', token);
  } else {
    localStorage.removeItem('catatkan_hf_token');
  }

  const topbar = document.getElementById('topbarAiModel');
  if (topbar) topbar.textContent = `Asisten AI`;

  showToast('Pengaturan berhasil disimpan!', 'success');
}

function setPlaygroundInput(text) {
  const input = document.getElementById('playgroundInput');
  if (input) input.value = text;
}

async function runPlaygroundTest() {
  const input = document.getElementById('playgroundInput');
  const output = document.getElementById('playgroundOutput');
  const btn = document.getElementById('btnRunPlayground');
  const latencyEl = document.getElementById('playgroundLatency');

  const text = input.value.trim();
  if (!text) return;

  btn.disabled = true;
  btn.innerHTML = `<span class="animate-spin">⌛</span> Menguji...`;
  output.textContent = '// Memproses transaksi...';

  const startTime = performance.now();

  try {
    const res = await fetch('/api/transactions/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hf-token': appState.hfSettings.token,
        'x-hf-model': appState.hfSettings.model
      },
      body: JSON.stringify({
        chatMessage: text,
        model: appState.hfSettings.model,
        hfToken: appState.hfSettings.token
      })
    });

    const elapsed = Math.round(performance.now() - startTime);
    if (latencyEl) latencyEl.textContent = `Latency: ${elapsed}ms`;

    const json = await res.json();
    output.textContent = JSON.stringify(json, null, 2);
  } catch (err) {
    output.textContent = `// Error: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5"></i> Uji Model`;
    lucide.createIcons();
  }
}

// Utility: Markdown simple parser
function markedParse(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Linebreaks
  html = html.replace(/\n/g, '<br>');
  return html;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialization on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  // Restore HF settings in input fields
  const modelSelect = document.getElementById('hfModelSelect');
  if (modelSelect && appState.hfSettings.model) {
    modelSelect.value = appState.hfSettings.model;
  }
  const tokenInput = document.getElementById('hfTokenInput');
  if (tokenInput && appState.hfSettings.token) {
    tokenInput.value = appState.hfSettings.token;
  }

  fetchInitialData();
  lucide.createIcons();
});
