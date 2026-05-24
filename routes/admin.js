const express = require('express');
const router = express.Router();
const fs = require('fs');
const authMiddleware = require('../middleware/auth');

const DB_PATH = './data/participants.json';
const WINNER_PATH = './data/winners.json';
const CONFIG_PATH = './data/config.json';

const readDB = () => {
  try { return JSON.parse(fs.readFileSync(DB_PATH)); } catch { return []; }
};
const writeDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

// All admin routes require auth
router.use(authMiddleware);

// GET all participants (full data)
router.get('/participants', (req, res) => {
  const participants = readDB();
  participants.sort((a, b) => a.numeroParticipacao - b.numeroParticipacao);
  res.json(participants);
});

// PATCH update status
router.patch('/participants/:id/status', (req, res) => {
  const { status } = req.body;
  const valid = ['aguardando', 'confirmado', 'reprovado'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  const participants = readDB();
  const idx = participants.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Participante não encontrado.' });

  participants[idx].status = status;
  participants[idx].atualizadoEm = new Date().toISOString();
  writeDB(participants);
  res.json({ success: true, participant: participants[idx] });
});

// DELETE participant
router.delete('/participants/:id', (req, res) => {
  let participants = readDB();
  const p = participants.find(p => p.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Participante não encontrado.' });

  // Delete files
  [p.comprovante1, p.comprovante2].forEach(f => {
    if (f) try { fs.unlinkSync(`./uploads/${f}`); } catch {}
  });

  participants = participants.filter(p => p.id !== req.params.id);
  writeDB(participants);
  res.json({ success: true });
});

// POST draw raffle
router.post('/draw', (req, res) => {
  const participants = readDB();
  const confirmed = participants.filter(p => p.status === 'confirmado');

  if (confirmed.length === 0) {
    return res.status(400).json({ error: 'Nenhum participante confirmado para o sorteio.' });
  }

  const winner = confirmed[Math.floor(Math.random() * confirmed.length)];

  let winners = [];
  try { winners = JSON.parse(fs.readFileSync(WINNER_PATH)); } catch {}

  const winnerRecord = {
    ...winner,
    realizadoEm: new Date().toISOString()
  };
  winners.push(winnerRecord);
  fs.writeFileSync(WINNER_PATH, JSON.stringify(winners, null, 2));

  res.json({
    success: true,
    winner: {
      id: winner.id,
      nome: winner.nome,
      numeroParticipacao: winner.numeroParticipacao,
      email: winner.email,
      whatsapp: winner.whatsapp
    }
  });
});

// GET winner history
router.get('/winners', (req, res) => {
  try {
    const winners = JSON.parse(fs.readFileSync(WINNER_PATH));
    res.json(winners);
  } catch {
    res.json([]);
  }
});

// GET export CSV
router.get('/export', (req, res) => {
  const participants = readDB();
  const headers = ['Nº', 'Nome', 'Email', 'WhatsApp', 'Status', 'Data de Cadastro'];
  const rows = participants.map(p => [
    p.numeroParticipacao,
    p.nome,
    p.email,
    p.whatsapp,
    p.status,
    new Date(p.criadoEm).toLocaleString('pt-BR')
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="participantes.csv"');
  res.send('\uFEFF' + csvContent); // BOM for Excel
});

// GET config
router.get('/config', (req, res) => {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
  res.json({ drawDate: config.drawDate, showReprovados: config.showReprovados });
});

// PUT update config
router.put('/config', (req, res) => {
  const { drawDate, showReprovados } = req.body;
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
  if (drawDate) config.drawDate = drawDate;
  if (showReprovados !== undefined) config.showReprovados = showReprovados;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));
  res.json({ success: true });
});

// GET stats
router.get('/stats', (req, res) => {
  const participants = readDB();
  res.json({
    total: participants.length,
    aguardando: participants.filter(p => p.status === 'aguardando').length,
    confirmados: participants.filter(p => p.status === 'confirmado').length,
    reprovados: participants.filter(p => p.status === 'reprovado').length
  });
});

module.exports = router;
