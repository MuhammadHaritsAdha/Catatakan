// src/services/aiServices.js
/**
 * Catatkan AI Service
 * Mendukung Gemini API + Indonesian Student Fin-NLP Engine & Post-Validation Safeguard
 */

const DEFAULT_HF_MODEL = process.env.HF_MODEL || 'Qwen/Qwen2.5-7B-Instruct';

// Function to extract monetary amount from Indonesian student informal text
const inferAmountIndonesian = (text) => {
  const clean = text.toLowerCase().replace(/rp\.?\s?/g, '');

  // 1. Million expressions: "1.5jt", "1,5 jt", "2jt", "2 jt", "1.5 juta", "2 juta"
  const jtMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:jt|juta)/i);
  if (jtMatch) {
    const val = parseFloat(jtMatch[1].replace(',', '.'));
    return Math.round(val * 1000000);
  }

  // 2. Thousand expressions: "15rb", "20k", "500 ribu", "500rb", "50k", "15ribu"
  const rbMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:rb|k|ribu)/i);
  if (rbMatch) {
    const val = parseFloat(rbMatch[1].replace(',', '.'));
    return Math.round(val * 1000);
  }

  // 3. Formatted thousands: "650.000", "20.000", "1.500.000", "2.000.000"
  const formattedMatch = clean.match(/\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b/);
  if (formattedMatch) {
    const normalized = formattedMatch[0].replace(/\./g, '').replace(/,/g, '.');
    return Math.round(parseFloat(normalized));
  }

  // 4. Explicit Rp with numbers: "Rp 25000", "rp50000"
  const rpNumberMatch = text.match(/rp\.?\s*(\d+)/i);
  if (rpNumberMatch) {
    return Number(rpNumberMatch[1]);
  }

  // 5. Plain numbers ONLY if >= 1000 (menghindari angka urutan seperti "ke 1", "jam 2", dsb)
  const plainMatches = clean.match(/\b\d+\b/g);
  if (plainMatches && plainMatches.length > 0) {
    const numbers = plainMatches.map(Number).filter((n) => n >= 500);
    if (numbers.length > 0) {
      return numbers[numbers.length - 1];
    }
  }

  return 0;
};

// Match allocation name from text
const matchAllocationName = (rawStr) => {
  if (!rawStr) return null;
  const s = rawStr.toLowerCase();
  if (s.match(/(kos|kost|kontrakan|tinggal|kamar|wifi|listrik|sewa)/)) return 'Tempat Tinggal';
  if (s.match(/(makan|makanan|kantin|warteg|konsumsi|snack|jajan|minum|kuliner|food)/)) return 'Konsumsi';
  if (s.match(/(kuliah|tugas|modul|print|cetak|fotokopi|buku|kampus|ukt|praktikum|skripsi)/)) return 'Tugas & Kuliah';
  if (s.match(/(transport|bensin|pertalite|pertamax|ojol|grab|gojek|maxim|parkir|angkot|krl|busway)/)) return 'Transportasi';
  if (s.match(/(lifestyle|nongkrong|ngopi|cafe|kafe|warkop|game|hiburan|nonton|bioskop|belanja|outfit)/)) return 'Lifestyle & Nongkrong';
  if (s.match(/(tabungan|nabung|menabung|simpanan|celengan|darurat|rekening|invest)/)) return 'Tabungan Mahasiswa';
  return null;
};

// Intent detection: check if query is out of scope, balance check, transfer, or transaction
const detectChatIntent = (chatMessage) => {
  const text = String(chatMessage || '').trim();
  const lower = text.toLowerCase();

  // 1. PEMINDAHAN SALDO (Prioritas pertama jika ada kata pindah/transfer/geser/alihkan)
  const isTransferQuery = lower.match(/(pindah(?:in|kan)?|transfer|geser|alihkan)\s*(?:saldo|dana|uang)?/i);
  if (isTransferQuery) {
    const amount = inferAmountIndonesian(text);

    // Parse source & destination allocation
    let fromAllocation = null;
    let toAllocation = null;

    // Pola: "dari [asal] ... ke [tujuan]"
    const dariMatch = lower.match(/dari\s+([a-zA-Z0-9\s&]+?)(?:\s+(?:ke|buat|untuk|sebesar|sejumlah|\d)|$)/i);
    const keMatch = lower.match(/(?:ke|buat|untuk)\s+([a-zA-Z0-9\s&]+?)(?:\s+(?:dari|sebesar|sejumlah|\d)|$)/i);

    if (dariMatch) {
      fromAllocation = matchAllocationName(dariMatch[1]);
    }
    if (keMatch) {
      toAllocation = matchAllocationName(keMatch[1]);
    }

    // Fallback: cari dari kata kunci jika ada nama alokasi eksplisit
    if (!fromAllocation) {
      if (lower.includes('tabungan')) fromAllocation = 'Tabungan Mahasiswa';
      else if (lower.includes('lifestyle') || lower.includes('nongkrong')) fromAllocation = 'Lifestyle & Nongkrong';
      else if (lower.includes('konsumsi') && !lower.includes('ke konsumsi') && !lower.includes('buat konsumsi')) fromAllocation = 'Konsumsi';
      else if (lower.includes('kos') && !lower.includes('ke kos') && !lower.includes('buat kos')) fromAllocation = 'Tempat Tinggal';
      else if (lower.includes('kuliah') && !lower.includes('ke kuliah') && !lower.includes('buat kuliah')) fromAllocation = 'Tugas & Kuliah';
      else if (lower.includes('transport') && !lower.includes('ke transport') && !lower.includes('buat transport')) fromAllocation = 'Transportasi';
    }

    if (!toAllocation) {
      if ((lower.includes('makan') || lower.includes('konsumsi')) && fromAllocation !== 'Konsumsi') toAllocation = 'Konsumsi';
      else if ((lower.includes('tabungan') || lower.includes('nabung')) && fromAllocation !== 'Tabungan Mahasiswa') toAllocation = 'Tabungan Mahasiswa';
      else if ((lower.includes('kos') || lower.includes('tinggal')) && fromAllocation !== 'Tempat Tinggal') toAllocation = 'Tempat Tinggal';
      else if ((lower.includes('kuliah') || lower.includes('tugas') || lower.includes('modul')) && fromAllocation !== 'Tugas & Kuliah') toAllocation = 'Tugas & Kuliah';
      else if ((lower.includes('transport') || lower.includes('bensin')) && fromAllocation !== 'Transportasi') toAllocation = 'Transportasi';
      else if ((lower.includes('lifestyle') || lower.includes('nongkrong')) && fromAllocation !== 'Lifestyle & Nongkrong') toAllocation = 'Lifestyle & Nongkrong';
    }

    // Cek apakah instruksi transfer LENGKAP (ada nominal, asal, dan tujuan)
    const isComplete = Boolean(amount > 0 && fromAllocation && toAllocation && fromAllocation !== toAllocation);

    if (!isComplete) {
      return {
        action: 'transfer_prompt',
        isFinancialQuery: true,
        amount: amount || 0,
        fromAllocation,
        toAllocation,
        rawText: text
      };
    }

    return {
      action: 'transfer',
      isFinancialQuery: true,
      amount: amount || 0,
      fromAllocation,
      toAllocation,
      rawText: text
    };
  }

  // 2. CEK SALDO (Balance Inquiry)
  const isBalanceQuery = !lower.match(/(pindah|transfer|geser|alihkan)/) && (
    lower.match(/(cek|lihat|liat|tengok|tampilkan|mau lihat|mau liat|berapa|info|intip)\s*(?:total\s*)?(saldo|duit|uang|tabungan|kantong|kas)/) ||
    lower.match(/saldo\s*(?:saya|aku|gua|gw|ku|kamu|tersisa|sekarang|tinggal|ada berapa)/) ||
    lower.match(/(sisa|total)\s*(?:saldo|uang|duit)/) ||
    lower.match(/(uang|duit)\s*(?:saya|gua|gw|aku)\s*(?:tinggal|sisa|berapa)/) ||
    lower === 'saldo' || lower === 'cek saldo' || lower === 'lihat saldo'
  );

  if (isBalanceQuery) {
    return {
      action: 'check_balance',
      isFinancialQuery: true
    };
  }

  // 3. CEK APAKAH PERTANYAAN DI LUAR KONTEKS KEUANGAN (Out of Scope)
  const financialKeywords = [
    // Income
    'uang bulanan', 'bulanan', 'uang saku', 'jatah bulanan', 'kiriman', 'dikirimi', 'dikirim',
    'gaji', 'ortu', 'orang tua', 'ayah', 'ibu', 'transfer masuk', 'terima', 'uang masuk', 'bayaran',
    'pendapatan', 'saldo masuk', 'beasiswa', 'jual', 'freelance', 'proyek', 'tf masuk', 'ditransfer',
    // Expense
    'makan', 'beli', 'bayar', 'jajan', 'minum', 'kopi', 'warkop', 'kafe', 'cafe',
    'transport', 'pulsa', 'kuota', 'sewa', 'kos', 'kosan', 'kost', 'kontrakan', 'belanja',
    'nonton', 'bensin', 'pertalite', 'pertamax', 'ongkir', 'internet', 'wifi',
    'listrik', 'konsumsi', 'modul', 'print', 'cetak', 'fotokopi', 'buku', 'ukt', 'spp',
    'ojol', 'grab', 'gojek', 'maxim', 'indomaret', 'alfamart', 'warteg', 'padang',
    'nabung', 'tabungan', 'investasi', 'topup', 'top up', 'checkout', 'porsi', 'bungkus'
  ];

  // Tambahkan kata kunci lifestyle, nongkrong, dll agar tidak out_of_scope
  const lifestyleKeywords = [
    'lifestyle', 'nongkrong', 'ngopi', 'warkop', 'cafe', 'kafe', 'bioskop',
    'nonton', 'game', 'steam', 'topup', 'top up', 'netflix', 'spotify',
    'skincare', 'baju', 'jalan', 'outfit', 'hiburan', 'parkir',
    'angkot', 'krl', 'busway', 'kuota', 'internet'
  ];

  const hasFinancialKeyword = financialKeywords.some(kw => lower.includes(kw)) || lifestyleKeywords.some(kw => lower.includes(kw));
  const detectedAmount = inferAmountIndonesian(text);
  // Fix: regex sekarang mendeteksi "25rb", "50k", "1.5jt" (angka langsung menempel satuan)
  const hasCurrencyIndicator = lower.match(/(?:rp\.?|\d+\s*(?:rb|k|ribu|jt|juta)|\b(?:rupiah)\b)/i);

  // Jika TIDAK ADA kata kunci keuangan DAN nominal 0 atau tidak ada satuan mata uang:
  if (!hasFinancialKeyword && (!hasCurrencyIndicator || detectedAmount <= 0)) {
    return {
      action: 'out_of_scope',
      isFinancialQuery: false,
      reply: `Halo! Saya adalah **Catatkan Bot**, asisten pencatat keuangan khusus mahasiswa. 🎓\n\nSaya mendeteksi pesan Anda berada di luar konteks pencatatan keuangan. Saya dapat membantu Anda untuk:\n- 📝 **Mencatat Transaksi** (contoh: *"Makan kantin 20rb"*, *"Uang bulanan dikirim 2jt"*)\n- 💰 **Cek Saldo Riil & Kantong** (contoh: *"Mau lihat saldo gua dong"*, *"Cek sisa uangku"*)\n- 🔄 **Pindah Saldo Antar Kantong** (contoh: *"Pindahin 50rb dari Tabungan ke buat makan"*)\n\nSilakan ketik transaksi atau perintah keuangan kamu ya!`
    };
  }

  // 4. TRANSAKSI BIASA (Pemasukan / Pengeluaran)
  return {
    action: 'transaction',
    isFinancialQuery: true
  };
};

// Function to infer transaction type (income / expense)
const inferTypeIndonesian = (text) => {
  const lower = text.toLowerCase();
  
  const incomeKeywords = [
    'uang bulanan', 'bulanan', 'uang saku', 'jatah bulanan', 'kiriman', 'dikirimi', 'dikirim',
    'gaji', 'ortu', 'orang tua', 'transfer masuk', 'terima', 'uang masuk', 'bayaran',
    'pendapatan', 'dapat', 'saldo masuk', 'beasiswa', 'jual', 'freelance', 'proyek',
    'cashback', 'cair', 'menang', 'ditransfer', 'transferan', 'tf masuk', 'dikasih uang'
  ];

  const expenseKeywords = [
    'makan', 'beli', 'bayar', 'jajan', 'minum', 'kopi', 'warkop', 'kafe',
    'transport', 'pulsa', 'sewa', 'kos', 'kosan', 'kontrakan', 'belanja',
    'nonton', 'bensin', 'pertalite', 'pertamax', 'ongkir', 'internet', 'wifi',
    'listrik', 'konsumsi', 'modul', 'print', 'cetak', 'fotokopi', 'buku',
    'ojol', 'grab', 'gojek', 'maxim', 'indomaret', 'alfamart', 'warteg'
  ];

  // Prioritas kata kunci pemasukan
  if (incomeKeywords.some((kw) => lower.includes(kw))) {
    // Kecuali jika ada kata "bayar" atau "beli" (misal: "bayar uang bulanan kos")
    if (lower.includes('bayar') || lower.includes('beli')) {
      return 'expense';
    }
    return 'income';
  }

  if (expenseKeywords.some((kw) => lower.includes(kw))) return 'expense';
  return 'expense';
};

// Function to categorize based on PRD scopes for college students
const inferCategoryIndonesian = (text) => {
  const lower = text.toLowerCase();

  // Pemasukan / Uang Saku / Bulanan (PRIORITAS TINGGI jika ada kata kunci pemasukan)
  if (lower.match(/(uang bulanan|bulanan|uang saku|jatah bulanan|kiriman|dikirimi|dikirim|ortu|orang tua|ayah|ibu|mama|papa|gaji|honor|beasiswa|freelance|tf masuk|tf dari|transferan|ditransfer|dapat uang|uang masuk)/)) {
    if (!lower.includes('bayar') && !lower.includes('beli')) {
      return { category: 'Uang Saku / Gaji', allocation: 'Tabungan Mahasiswa' };
    }
  }

  // Tempat Tinggal (Kos/Kontrakan/Listrik/Wifi)
  if (lower.match(/(kos|kosan|kost|sewa kamar|kontrakan|tempat tinggal|ibu kos|bapak kos|kamar)/)) {
    return { category: 'Tempat Tinggal', allocation: 'Tempat Tinggal' };
  }

  // Tugas & Kuliah (Print, modul, fotokopi, buku, ukt, praktikum)
  if (lower.match(/(modul|cetak|print|fotokopi|foto kopi|buku kuliah|tugas|praktikum|alat tulis|dosen|kampus|ukt|spp|kartu ujian)/)) {
    return { category: 'Kuliah', allocation: 'Tugas & Kuliah' };
  }

  // Transportasi (Bensin, ojol, parkir, kereta, busway, angkot)
  if (lower.match(/(bensin|pertalite|pertamax|spbu|ojol|grab|gojek|maxim|inドライブ|parkir|krl|angkot|busway|transjakarta|tambal ban|helm)/)) {
    return { category: 'Transportasi', allocation: 'Transportasi' };
  }

  // Lifestyle & Nongkrong (Warkop, cafe, nongkrong, bioskop, game, outfit, skincare)
  if (lower.match(/(lifestyle|nongkrong|warkop|cafe|kafe|kopi kenangan|janji jiwa|starbucks|cinema|bioskop|nonton|game|steam|topup|top up|netflix|spotify|skincare|baju|jalan)/)) {
    return { category: 'Lifestyle', allocation: 'Lifestyle & Nongkrong' };
  }

  // Tabungan / Investasi
  if (lower.match(/(tabungan|menabung|nabung|invest|bibit|ajaib|reksadana|simpanan|celengan)/)) {
    return { category: 'Tabungan', allocation: 'Tabungan Mahasiswa' };
  }

  // Konsumsi (Makan harian, kantin, warteg, galon, dsb)
  if (lower.match(/(makan|minum|kantin|warteg|padang|geprek|mie|bakso|nasgor|nasi goreng|indomie|es teh|galon|aqua|snack|jajan|indomaret|alfamart)/)) {
    return { category: 'Konsumsi', allocation: 'Konsumsi' };
  }

  return { category: 'Konsumsi', allocation: 'Konsumsi' };
};

// Clean description from text
const cleanDescription = (text) => {
  return text
    .replace(/(?:rp\.?\s*|\b\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|k|ribu)\b|\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b|\b\d+\b)/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || text.trim();
};

// Post-validation safeguard: memvalidasi hasil ekstraksi AI agar tidak salah kamar
const applyValidationSafeguard = (parsed, rawText) => {
  const lower = rawText.toLowerCase();

  // 1. Jika terdeteksi kata uang bulanan / uang saku / dikirim tapi AI salah menebak expense:
  const isIncomeMention = lower.match(/(uang bulanan|bulanan|uang saku|jatah bulanan|kiriman|dikirimi|dikirim|dapat uang|uang masuk|tf masuk|ditransfer)/);
  const isDirectExpenseAction = lower.includes('bayar') || lower.includes('beli');

  if (isIncomeMention && !isDirectExpenseAction) {
    parsed.type = 'income';
    parsed.category = 'Uang Saku / Gaji';
    parsed.targetAllocation = 'Tabungan Mahasiswa';
    if (!parsed.description || parsed.description.toLowerCase().includes('makan') || parsed.description.toLowerCase().includes('beli')) {
      parsed.description = cleanDescription(rawText) || 'Penerimaan uang bulanan';
    }
  }

  // 2. Pastikan nominal tidak 0 jika ada angka juta/ribu
  if (!parsed.amount || parsed.amount <= 0) {
    parsed.amount = inferAmountIndonesian(rawText);
  }

  return parsed;
};

// Fallback NLP Engine specifically crafted for Indonesian student finance
const buildIndonesianNlpFallback = (chatMessage, customModelName = DEFAULT_HF_MODEL) => {
  const cleanText = String(chatMessage || '').trim();
  const amount = inferAmountIndonesian(cleanText);
  const type = inferTypeIndonesian(cleanText);
  const { category, allocation } = inferCategoryIndonesian(cleanText);
  const description = cleanDescription(cleanText) || cleanText;

  const result = {
    description: description.charAt(0).toUpperCase() + description.slice(1),
    amount: amount || 0,
    type,
    category,
    targetAllocation: allocation,
    date: new Date().toISOString(),
    aiProvider: 'Catatkan AI',
    model: 'Catatkan Engine',
    inferenceMode: 'Pencatatan Otomatis',
    confidence: 0.98,
    note: 'Diproses dengan mesin NLP Bahasa Indonesia untuk keuangan mahasiswa.'
  };

  return applyValidationSafeguard(result, cleanText);
};

// Call Gemini API sebagai AI Engine utama
const callGeminiApi = async (chatMessage) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null; // Tidak ada key, skip ke fallback
  }

  const systemPrompt = `Anda adalah sistem AI Pencatat Keuangan Mahasiswa Indonesia ("Catatkan").
Tugas Anda adalah mengekstrak data keuangan dari kalimat santai mahasiswa secara akurat.
Balas HANYA dengan 1 objek JSON murni tanpa markdown, tanpa teks pengantar, dan tanpa penutup.
Format JSON:
{
  "description": "Deskripsi transaksi singkat dan jelas",
  "amount": 20000,
  "type": "expense" atau "income",
  "category": "Konsumsi" | "Tempat Tinggal" | "Kuliah" | "Transportasi" | "Lifestyle" | "Tabungan" | "Uang Saku / Gaji" | "Lainnya",
  "targetAllocation": "Konsumsi" | "Tempat Tinggal" | "Tugas & Kuliah" | "Transportasi" | "Lifestyle & Nongkrong" | "Tabungan Mahasiswa"
}

ATURAN PENTING:
- "Uang bulanan", "uang saku", "dikirimi uang", "gaji", "beasiswa", "transferan ortu" ADALAH type: "income", category: "Uang Saku / Gaji", targetAllocation: "Tabungan Mahasiswa".
- "Makan", "jajan", "kantin", "warteg" ADALAH type: "expense", category: "Konsumsi", targetAllocation: "Konsumsi".
- "Beli modul", "cetak", "fotokopi", "buku" ADALAH type: "expense", category: "Kuliah", targetAllocation: "Tugas & Kuliah".
- "Bayar kos", "kontrakan" ADALAH type: "expense", category: "Tempat Tinggal", targetAllocation: "Tempat Tinggal".
- "Nongkrong", "warkop", "cafe", "bioskop", "game", "lifestyle" ADALAH type: "expense", category: "Lifestyle", targetAllocation: "Lifestyle & Nongkrong".
- Angka "25rb" = 25000, "50k" = 50000, "1.5jt" = 1500000.`;

  const userPrompt = `Ekstrak kalimat transaksi ini ke JSON: "${chatMessage}"`;

  try {
    const { GoogleGenAI } = require('@google/genai');
    const genAI = new GoogleGenAI({ apiKey });

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `${systemPrompt}\n\n${userPrompt}`,
      config: {
        temperature: 0.1,
        maxOutputTokens: 300,
      }
    });

    const content = result.text;
    if (content) {
      let cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        cleaned = cleaned.slice(start, end + 1);
      }
      const parsed = JSON.parse(cleaned);
      const resObj = {
        description: parsed.description || cleanDescription(chatMessage),
        amount: Number(parsed.amount) || inferAmountIndonesian(chatMessage),
        type: parsed.type === 'income' ? 'income' : 'expense',
        category: parsed.category || inferCategoryIndonesian(chatMessage).category,
        targetAllocation: parsed.targetAllocation || inferCategoryIndonesian(chatMessage).allocation,
        date: new Date().toISOString(),
        aiProvider: 'Catatkan AI',
        model: 'Gemini',
        inferenceMode: 'Pencatatan Otomatis',
        confidence: 0.99,
        rawResponse: content
      };
      return applyValidationSafeguard(resObj, chatMessage);
    }
  } catch (err) {
    console.warn(`Gemini API error: ${err.message}. Falling back to local NLP...`);
  }

  return null; // Gagal, lanjut ke fallback
};

// Call Hugging Face Serverless Inference API (atau langsung Local Fin-NLP jika token kosong)
const callHuggingFaceApi = async (chatMessage, options = {}) => {
  const hfToken = options.hfToken || process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
  const model = options.model || process.env.HF_MODEL || DEFAULT_HF_MODEL;

  // Jika token Hugging Face tidak diisi, langsung gunakan Local NLP Engine agar instan tanpa lag dan tanpa error koneksi
  if (!hfToken || !hfToken.trim()) {
    return buildIndonesianNlpFallback(chatMessage, model);
  }

  const systemPrompt = `Anda adalah sistem AI Pencatat Keuangan Mahasiswa Indonesia ("Catatkan").
Tugas Anda adalah mengekstrak data keuangan dari kalimat santai mahasiswa secara akurat.
Balas HANYA dengan 1 objek JSON murni tanpa markdown, tanpa teks pengantar, dan tanpa penutup.
Format JSON:
{
  "description": "Deskripsi transaksi singkat dan jelas",
  "amount": 20000,
  "type": "expense" atau "income",
  "category": "Konsumsi" | "Tempat Tinggal" | "Kuliah" | "Transportasi" | "Lifestyle" | "Tabungan" | "Uang Saku / Gaji" | "Lainnya",
  "targetAllocation": "Konsumsi" | "Tempat Tinggal" | "Tugas & Kuliah" | "Transportasi" | "Lifestyle & Nongkrong" | "Tabungan Mahasiswa"
}

ATURAN PENTING:
- "Uang bulanan", "uang saku", "dikirimi uang", "gaji", "beasiswa", "transferan ortu" ADALAH type: "income", category: "Uang Saku / Gaji", targetAllocation: "Tabungan Mahasiswa".
- "Makan", "jajan", "kantin", "warteg" ADALAH type: "expense", category: "Konsumsi", targetAllocation: "Konsumsi".
- "Beli modul", "cetak", "fotokopi", "buku" ADALAH type: "expense", category: "Kuliah", targetAllocation: "Tugas & Kuliah".
- "Bayar kos", "kontrakan" ADALAH type: "expense", category: "Tempat Tinggal", targetAllocation: "Tempat Tinggal".

Contoh input: "uang bulanan 2 jt"
Output: {"description":"Penerimaan uang bulanan","amount":2000000,"type":"income","category":"Uang Saku / Gaji","targetAllocation":"Tabungan Mahasiswa"}

Contoh input: "uang bulanan dikirim 2 jt"
Output: {"description":"Uang bulanan dikirim dari orang tua","amount":2000000,"type":"income","category":"Uang Saku / Gaji","targetAllocation":"Tabungan Mahasiswa"}

Contoh input: "Kiriman uang saku ortu 1.5jt"
Output: {"description":"Kiriman uang saku dari orang tua","amount":1500000,"type":"income","category":"Uang Saku / Gaji","targetAllocation":"Tabungan Mahasiswa"}

Contoh input: "Makan kantin 20rb"
Output: {"description":"Makan di kantin kampus","amount":20000,"type":"expense","category":"Konsumsi","targetAllocation":"Konsumsi"}

Contoh input: "Beli cetak modul 15rb"
Output: {"description":"Cetak modul mata kuliah","amount":15000,"type":"expense","category":"Kuliah","targetAllocation":"Tugas & Kuliah"}

Contoh input: "Bayar kos 650rb"
Output: {"description":"Pembayaran kosan bulanan","amount":650000,"type":"expense","category":"Tempat Tinggal","targetAllocation":"Tempat Tinggal"}`;

  const userPrompt = `Ekstrak kalimat transaksi ini ke JSON: "${chatMessage}"`;

  const routerUrl = 'https://router.huggingface.co/v1/chat/completions';
  const legacyRouterUrl = `https://api-inference.huggingface.co/models/${model}`;

  const headers = {
    'Content-Type': 'application/json',
  };
  if (hfToken) {
    headers['Authorization'] = `Bearer ${hfToken}`;
  }

  // 1. Try OpenAI-compatible HF Router
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(routerUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) {
        const cleaned = content.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        const result = {
          description: parsed.description || cleanDescription(chatMessage),
          amount: Number(parsed.amount) || inferAmountIndonesian(chatMessage),
          type: parsed.type === 'income' ? 'income' : 'expense',
          category: parsed.category || inferCategoryIndonesian(chatMessage).category,
          targetAllocation: parsed.targetAllocation || inferCategoryIndonesian(chatMessage).allocation,
          date: new Date().toISOString(),
          aiProvider: 'Catatkan AI',
          model: 'Catatkan Engine',
          inferenceMode: 'Pencatatan Otomatis',
          confidence: 0.98,
          rawResponse: content
        };
        return applyValidationSafeguard(result, chatMessage);
      }
    }
  } catch (err) {
    console.warn(`Hugging Face Router error: ${err.message}. Trying direct endpoint...`);
  }

  // 2. Try Direct HF Serverless Inference Endpoint
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const fullPrompt = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${userPrompt}<|im_end|>\n<|im_start|>assistant\n`;

    const response = await fetch(legacyRouterUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: 250,
          temperature: 0.1,
          return_full_text: false
        }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.ok) {
      const result = await response.json();
      let textOut = '';
      if (Array.isArray(result) && result[0]?.generated_text) {
        textOut = result[0].generated_text;
      } else if (typeof result === 'string') {
        textOut = result;
      }

      if (textOut) {
        let cleaned = textOut.replace(/```json/gi, '').replace(/```/g, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          cleaned = cleaned.slice(start, end + 1);
        }
        const parsed = JSON.parse(cleaned);
        const resObj = {
          description: parsed.description || cleanDescription(chatMessage),
          amount: Number(parsed.amount) || inferAmountIndonesian(chatMessage),
          type: parsed.type === 'income' ? 'income' : 'expense',
          category: parsed.category || inferCategoryIndonesian(chatMessage).category,
          targetAllocation: parsed.targetAllocation || inferCategoryIndonesian(chatMessage).allocation,
          date: new Date().toISOString(),
          aiProvider: 'Catatkan AI',
          model: 'Catatkan Engine',
          inferenceMode: 'Pencatatan Otomatis',
          confidence: 0.96,
          rawResponse: textOut
        };
        return applyValidationSafeguard(resObj, chatMessage);
      }
    }
  } catch (err) {
    console.warn(`Direct Hugging Face API error: ${err.message}.`);
  }

  // 3. Fallback to resilient Indonesian NLP engine
  return buildIndonesianNlpFallback(chatMessage, model);
};

/**
 * Main parser entrypoint with intent handling
 */
const parseChatToTransaction = async (chatMessage, options = {}) => {
  const text = String(chatMessage || '').trim();
  if (!text) {
    throw new Error('Pesan chat tidak boleh kosong');
  }

  // 1. Cek intent percakapan terlebih dahulu
  const intent = detectChatIntent(text);
  if (intent.action === 'out_of_scope') {
    return {
      action: 'out_of_scope',
      reply: intent.reply
    };
  }
  if (intent.action === 'check_balance') {
    return {
      action: 'check_balance'
    };
  }
  if (intent.action === 'transfer_prompt') {
    return {
      action: 'transfer_prompt',
      amount: intent.amount,
      fromAllocation: intent.fromAllocation,
      toAllocation: intent.toAllocation,
      rawText: text
    };
  }
  if (intent.action === 'transfer') {
    return {
      action: 'transfer',
      amount: intent.amount,
      fromAllocation: intent.fromAllocation,
      toAllocation: intent.toAllocation,
      rawText: text
    };
  }

  // 2. Transaksi normal (pemasukan / pengeluaran)
  // Prioritas: Gemini API → HuggingFace API → Local NLP Fallback
  let txData = await callGeminiApi(text);
  if (!txData) {
    txData = await callHuggingFaceApi(text, options);
  }
  return {
    action: 'transaction',
    ...txData
  };
};

module.exports = {
  parseChatToTransaction,
  buildIndonesianNlpFallback,
  detectChatIntent,
  matchAllocationName,
  callGeminiApi,
  DEFAULT_HF_MODEL,
};
