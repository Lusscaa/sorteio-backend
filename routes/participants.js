const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = './data/participants.json';
const CONFIG_PATH = './data/config.json';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo inválido. Use JPG, PNG ou WEBP.'));
  }
});

const readDB = () => {
  try { return JSON.parse(fs.readFileSync(DB_PATH)); } catch { return []; }
};

const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

const abbreviateName = (name) => {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

// GET public participants list
router.get('/', (req, res) => {
  const participants = readDB();
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH));

  const filtered = participants.filter(p => {
    if (p.status === 'confirmado') return true;
    if (p.status === 'aguardando') return true;
    if (p.status === 'reprovado') return config.showReprovados;
    return false;
  });

  const public_list = filtered.map(p => ({
    id: p.id,
    numeroParticipacao: p.numeroParticipacao,
    nomeAbreviado: abbreviateName(p.nome),
    status: p.status,
    criadoEm: p.criadoEm
  }));

  // Sort by number
  public_list.sort((a, b) => a.numeroParticipacao - b.numeroParticipacao);
  res.json(public_list);
});

// GET winner
router.get('/winner', (req, res) => {
  const WINNER_PATH = './data/winners.json';
  try {
    const winners = JSON.parse(fs.readFileSync(WINNER_PATH));
    if (winners.length === 0) return res.json(null);
    const last = winners[winners.length - 1];
    res.json({
      nomeAbreviado: abbreviateName(last.nome),
      numeroParticipacao: last.numeroParticipacao,
      realizadoEm: last.realizadoEm
    });
  } catch {
    res.json(null);
  }
});

// POST new participant
router.post('/', upload.fields([
  { name: 'comprovante1', maxCount: 1 },
  { name: 'comprovante2', maxCount: 1 }
]), (req, res) => {
  const { nome, email, whatsapp } = req.body;

  if (!nome || !email || !whatsapp) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  if (!req.files?.comprovante1 || !req.files?.comprovante2) {
    return res.status(400).json({ error: 'Ambos os comprovantes são obrigatórios.' });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }

  // WhatsApp validation (only numbers, 10-11 digits)
  const wppClean = whatsapp.replace(/\D/g, '');
  if (wppClean.length < 10 || wppClean.length > 11) {
    return res.status(400).json({ error: 'WhatsApp inválido.' });
  }

  const participants = readDB();

  // Duplicate check
  const emailLower = email.toLowerCase().trim();
  const duplicate = participants.find(
    p => p.email.toLowerCase() === emailLower || p.whatsapp === wppClean
  );
  if (duplicate) {
    // Clean uploaded files
    Object.values(req.files).flat().forEach(f => {
      try { fs.unlinkSync(f.path); } catch {}
    });
    return res.status(409).json({ error: 'Este e-mail ou WhatsApp já está cadastrado.' });
  }

  const nextNum = participants.length > 0
    ? Math.max(...participants.map(p => p.numeroParticipacao)) + 1
    : 1;

  const participant = {
    id: uuidv4(),
    numeroParticipacao: nextNum,
    nome: nome.trim(),
    email: emailLower,
    whatsapp: wppClean,
    comprovante1: req.files.comprovante1[0].filename,
    comprovante2: req.files.comprovante2[0].filename,
    status: 'aguardando',
    criadoEm: new Date().toISOString()
  };

  participants.push(participant);
  writeDB(participants);

  res.status(201).json({
    success: true,
    numeroParticipacao: participant.numeroParticipacao,
    nomeAbreviado: abbreviateName(participant.nome),
    status: participant.status
  });
});

module.exports = router;
