const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const participantRoutes = require('./routes/participants');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure data directories exist
const dirs = ['./data', './uploads'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Initialize DB files
const DB_PATH = './data/participants.json';
const WINNER_PATH = './data/winners.json';
const CONFIG_PATH = './data/config.json';

if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, '[]');
if (!fs.existsSync(WINNER_PATH)) fs.writeFileSync(WINNER_PATH, '[]');
if (!fs.existsSync(CONFIG_PATH)) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({
    drawDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    showReprovados: false,
    adminPassword: '$2b$10$YourHashedPasswordHere' // "admin123" hashed
  }));
}

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/participants', participantRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/config', (req, res) => {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
  res.json({ drawDate: config.drawDate, showReprovados: config.showReprovados });
});

app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
  console.log(`🔑 Painel admin: http://localhost:3000/admin`);
  console.log(`🔐 Senha padrão: admin123`);
});
