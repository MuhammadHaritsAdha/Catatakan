// public/app.js
/**
 * Catatkan - Frontend Application Logic
 * Integrasi Hugging Face AI, Pos Alokasi Dana, dan Laporan Bulanan
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
      const totalSaldoEl = document.getElementById('statTotalSaldo');
      if (totalSaldoEl) totalSaldoEl.textContent = formatRupiah(rep.summary.totalAllocationsBalance);

      const totalInEl = document.getElementById('statTotalPemasukan');
      if (totalInEl) totalInEl.textContent = formatRupiah(rep.summary.totalIncome);

      const totalOutEl = document.getElementById('statTotalPengeluaran');
      if (totalOutEl) totalOutEl.textContent = formatRupiah(rep.summary.totalExpense);


    }
  } catch (err) {
    console.error('Error updating overview stats:', err);
  }
}

// ==========================================
// TAB 1: CHAT AI WORKFLOW (HUGGING FACE)
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
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Mengurai teks dengan Hugging Face...`;
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
    appendChatMessage('bot', 'Terjadi kesalahan koneksi ke server AI Hugging Face.');
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
      actionBtnHtml = `
        <div class="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
          <span class="text-[11px] font-semibold text-indigo-700">${parsedData.category} &bull; ${formatRupiah(parsedData.amount)}</span>
          <button onclick="confirmSaveParsedTransaction()" class="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg font-medium shadow-sm transition">
            Simpan Transaksi &rarr;
          </button>
        </div>
      `;
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
      <span class="ml-1 font-mono text-[11px]">Hugging Face sedang memproses...</span>
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

function renderParsedPreview(parsed) {
  document.getElementById('aiEmptyCard').classList.add('hidden');
  document.getElementById('aiResultCard').classList.remove('hidden');

  const badge = document.getElementById('aiInferenceBadge');
  if (badge) {
    badge.className = 'text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono';
    badge.textContent = parsed.inferenceMode || 'Hugging Face AI';
  }

  const typeBadge = document.getElementById('previewTypeBadge');
  if (typeBadge) {
    if (parsed.type === 'income') {
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
  if (descEl) descEl.textContent = parsed.description;

  const catEl = document.getElementById('previewCategory');
  if (catEl) catEl.textContent = parsed.category;

  const allocEl = document.getElementById('previewAllocation');
  if (allocEl) allocEl.textContent = parsed.targetAllocation || 'Umum';

  const modelEl = document.getElementById('previewModelName');
  if (modelEl) modelEl.textContent = parsed.model || appState.hfSettings.model;
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
    card.className = 'bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between space-y-4 hover:shadow-md transition';
    card.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">${alloc.icon || '📦'}</span>
            <div>
              <h4 class="font-bold text-slate-800 text-sm">${alloc.name}</h4>
              <p class="text-[11px] text-slate-400 line-clamp-1">${alloc.description || ''}</p>
            </div>
          </div>
          <button onclick="quickTransferFrom('${alloc.id}')" title="Pindah Saldo dari Sini" class="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-slate-50">
            <i data-lucide="arrow-left-right" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="pt-2">
          <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Saldo Tersedia</span>
          <p class="text-xl font-extrabold text-slate-900">${formatRupiah(alloc.balance)}</p>
        </div>
      </div>

      <div class="space-y-1.5 pt-2 border-t border-slate-100">
        <div class="flex items-center justify-between text-xs text-slate-500">
          <span>Target Alokasi:</span>
          <span class="font-semibold text-slate-700">${alloc.target > 0 ? formatRupiah(alloc.target) : 'Fleksibel'}</span>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500" style="width: ${percent}%; background-color: ${alloc.color || '#3b82f6'};"></div>
        </div>
        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span>Kesiapan Saldo</span>
          <span class="font-mono font-medium">${percent}%</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  lucide.createIcons();
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
    } else {
      showToast(json.message || 'Gagal membuat pos kantong', 'error');
    }
  } catch (err) {
    console.error('Error creating allocation:', err);
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

async function loadMonthlyReport() {
  const select = document.getElementById('reportMonthSelect');
  let year = new Date().getFullYear();
  let month = new Date().getMonth() + 1;

  if (select && select.value) {
    const [y, m] = select.value.split('-');
    year = Number(y);
    month = Number(m);
  } else {
    populateMonthSelect();
  }

  try {
    const res = await fetch(`/api/reports/monthly?year=${year}&month=${month}`);
    const json = await res.json();
    if (json.success) {
      appState.currentMonthReport = json.data;
      renderReportUI(json.data);
    }
  } catch (err) {
    console.error('Error loading report:', err);
  }
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
  // 1. Donut Chart (Persentase Pengeluaran per Kategori)
  const donutCanvas = document.getElementById('categoryDonutChart');
  if (donutCanvas && report.categoryBreakdown.length > 0) {
    const labels = report.categoryBreakdown.map(c => c.category);
    const data = report.categoryBreakdown.map(c => c.amount);
    const colors = report.categoryBreakdown.map(c => c.color || '#6366f1');

    if (donutChartInstance) donutChartInstance.destroy();

    donutChartInstance = new Chart(donutCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        cutout: '70%'
      }
    });

    // Custom legend
    const legendList = document.getElementById('chartLegendList');
    if (legendList) {
      legendList.innerHTML = '';
      report.categoryBreakdown.slice(0, 4).forEach(c => {
        const item = document.createElement('div');
        item.className = 'flex items-center gap-1.5';
        item.innerHTML = `
          <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${c.color}"></span>
          <span class="text-slate-600 truncate">${c.category} (${c.percentage}%)</span>
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
      '#10b981',
      '#ef4444',
      ...report.categoryBreakdown.slice(0, 4).map(c => c.color || '#6366f1')
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
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!list || list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-8 text-center text-slate-400">
          Belum ada catatan transaksi yang sesuai dengan filter.
        </td>
      </tr>
    `;
    return;
  }

  list.forEach(tx => {
    const isIncome = tx.type === 'income';
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/70 transition';

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono text-[11px] text-slate-500">${formatDate(tx.date)}</td>
      <td class="py-3 px-4">
        <p class="font-bold text-slate-800 text-xs">${escapeHtml(tx.description)}</p>
        ${tx.rawChat ? `<p class="text-[10px] text-slate-400 italic font-mono">Chat: "${escapeHtml(tx.rawChat)}"</p>` : ''}
      </td>
      <td class="py-3 px-4">
        <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
          ${tx.category}
        </span>
      </td>
      <td class="py-3 px-4 text-[11px] text-slate-600 font-medium">
        ${tx.allocationId ? (appState.allocations.find(a => a.id === tx.allocationId)?.name || 'Pos Terkait') : '-'}
      </td>
      <td class="py-3 px-4">
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200">
          <i data-lucide="cpu" class="w-3 h-3"></i> ${tx.aiModel || 'Manual'}
        </span>
      </td>
      <td class="py-3 px-4 text-right font-extrabold ${isIncome ? 'text-emerald-600' : 'text-slate-900'}">
        ${isIncome ? '+' : '-'}${formatRupiah(tx.amount)}
      </td>
      <td class="py-3 px-4 text-center">
        <button onclick="deleteTransaction('${tx.id}')" title="Hapus Transaksi" class="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-100">
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
// TAB 6: HUGGING FACE PLAYGROUND
// ==========================================

function saveHfSettings() {
  const model = document.getElementById('hfModelSelect').value;
  const token = document.getElementById('hfTokenInput').value.trim();

  appState.hfSettings.model = model;
  appState.hfSettings.token = token;

  localStorage.setItem('catatkan_hf_model', model);
  if (token) {
    localStorage.setItem('catatkan_hf_token', token);
  } else {
    localStorage.removeItem('catatkan_hf_token');
  }

  const topbar = document.getElementById('topbarAiModel');
  if (topbar) topbar.textContent = `Hugging Face (${model.split('/')[1] || model})`;

  showToast('Pengaturan Hugging Face berhasil disimpan!', 'success');
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
  output.textContent = '// Menghubungi Hugging Face Serverless Inference API...';

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
