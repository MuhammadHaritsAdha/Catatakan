require('dotenv').config();

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

const { testConnection } = require('./src/config/database');

const server = app.listen(PORT, async () => {
  console.log(`\n  \x1b[36m🚀 Catatkan - Website AI Pencatat Keuangan Mahasiswa\x1b[0m`);
  console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mLocal:\x1b[0m   \x1b[36mhttp://localhost:${PORT}/\x1b[0m`);
  console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mAI Engine:\x1b[0m Catatkan Natural Language Engine`);

  const dbConnected = await testConnection();
  if (dbConnected) {
    console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mDatabase:\x1b[0m PostgreSQL Terhubung (\x1b[32m${process.env.DB_NAME || 'catatkan_db'}\x1b[0m)\n`);
  } else {
    console.log(`  \x1b[33m➜\x1b[0m  \x1b[1mDatabase:\x1b[0m Mode In-Memory / File Storage (\x1b[33mPostgreSQL belum dinyalakan\x1b[0m)\n`);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\x1b[31mPort ${PORT} sedang dipakai. Coba ganti PORT di .env atau matikan proses lama.\x1b[0m`);
  } else {
    console.error('Server error:', err);
  }
});
