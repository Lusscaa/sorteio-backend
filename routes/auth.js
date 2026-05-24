const express = require('express');
const router = express.Router();
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const CONFIG_PATH = './data/config.json';
const JWT_SECRET = process.env.JWT_SECRET || 'sorteio-vip-secret-2024';

// Initialize admin password if config doesn't have proper hash
const initConfig = () => {
  let config = {};
  try { config = JSON.parse(fs.readFileSync(CONFIG_PATH)); } catch (e) {}
  if (!config.adminPassword || config.adminPassword === '$2b$10$YourHashedPasswordHere') {
    const hash = bcrypt.hashSync('admin123', 10);
    config.adminPassword = hash;
    if (!config.drawDate) config.drawDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (config.showReprovados === undefined) config.showReprovados = false;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));
  }
  return config;
};

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Senha obrigatória' });

  const config = initConfig();
  const valid = bcrypt.compareSync(password, config.adminPassword);

  if (!valid) return res.status(401).json({ error: 'Senha incorreta' });

  const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

router.post('/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const config = initConfig();

  if (!bcrypt.compareSync(currentPassword, config.adminPassword)) {
    return res.status(401).json({ error: 'Senha atual incorreta' });
  }

  config.adminPassword = bcrypt.hashSync(newPassword, 10);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));
  res.json({ success: true });
});

module.exports = router;
module.exports.JWT_SECRET = JWT_SECRET;
