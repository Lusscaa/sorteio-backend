const express = require('express');
const router = express.Router();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const authMiddleware = require('../middleware/auth');

const WINNER_PATH = './data/winners.json';
const CONFIG_PATH = './data/config.json';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Todas rotas admin protegidas
router.use(authMiddleware);

// GET participantes
router.get('/participants', async (req, res) => {

  const { data, error } = await supabase
    .from('participants')
    .select('*')
    .order('numeroParticipacao', { ascending: true });

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  res.json(data || []);
});

// UPDATE STATUS
router.patch('/participants/:id/status', async (req, res) => {

  const { status } = req.body;

  const valid = [
    'aguardando',
    'confirmado',
    'reprovado'
  ];

  if (!valid.includes(status)) {
    return res.status(400).json({
      error: 'Status inválido.'
    });
  }

  const { data, error } = await supabase
    .from('participants')
    .update({
      status: status
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  if (!data) {
    return res.status(404).json({
      error: 'Participante não encontrado.'
    });
  }

  res.json({
    success: true,
    participant: data
  });

});

// DELETE participante
router.delete('/participants/:id', async (req, res) => {

  const { data: participant, error: findError } = await supabase
    .from('participants')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (findError || !participant) {
    return res.status(404).json({
      error: 'Participante não encontrado.'
    });
  }

  // deletar uploads
  [participant.print1, participant.print2]
    .forEach(file => {

      if (file) {
        try {
          fs.unlinkSync(`./uploads/${file}`);
        } catch {}
      }

    });

  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  res.json({
    success: true
  });

});

// SORTEAR
router.post('/draw', async (req, res) => {

  const { data: participantes, error } = await supabase
    .from('participants')
    .select('*')
    .eq('status', 'confirmado');

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  if (!participantes || participantes.length === 0) {
    return res.status(400).json({
      error: 'Nenhum participante confirmado.'
    });
  }

  const winner =
    participantes[
      Math.floor(
        Math.random() * participantes.length
      )
    ];

  let winners = [];

  try {
    winners = JSON.parse(
      fs.readFileSync(WINNER_PATH)
    );
  } catch {}

  winners.push({
    ...winner,
    realizadoEm: new Date().toISOString()
  });

  fs.writeFileSync(
    WINNER_PATH,
    JSON.stringify(winners, null, 2)
  );

  res.json({
    success: true,
    winner
  });

});

// WINNERS
router.get('/winners', (req, res) => {

  try {

    const winners = JSON.parse(
      fs.readFileSync(WINNER_PATH)
    );

    res.json(winners);

  } catch {

    res.json([]);

  }

});

// EXPORT CSV
router.get('/export', async (req, res) => {

  const { data: participants, error } = await supabase
    .from('participants')
    .select('*')
    .order('numeroParticipacao', {
      ascending: true
    });

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  const headers = [
    'Nº',
    'Nome',
    'Email',
    'WhatsApp',
    'Status',
    'Data'
  ];

  const rows = (participants || []).map(p => [
    p.numeroParticipacao,
    p.nome,
    p.email,
    p.tel,
    p.status,
    new Date(p.criadoEm)
      .toLocaleString('pt-BR')
  ]);

  const csv = [headers, ...rows]
    .map(row =>
      row.map(cell =>
        `"${String(cell || '')
          .replace(/"/g, '""')}"`
      ).join(',')
    )
    .join('\n');

  res.setHeader(
    'Content-Type',
    'text/csv; charset=utf-8'
  );

  res.setHeader(
    'Content-Disposition',
    'attachment; filename="participantes.csv"'
  );

  res.send('\uFEFF' + csv);

});

// CONFIG
router.get('/config', (req, res) => {

  const config = JSON.parse(
    fs.readFileSync(CONFIG_PATH)
  );

  res.json({
    drawDate: config.drawDate,
    showReprovados: config.showReprovados
  });

});

// UPDATE CONFIG
router.put('/config', (req, res) => {

  const {
    drawDate,
    showReprovados
  } = req.body;

  const config = JSON.parse(
    fs.readFileSync(CONFIG_PATH)
  );

  if (drawDate) {
    config.drawDate = drawDate;
  }

  if (showReprovados !== undefined) {
    config.showReprovados = showReprovados;
  }

  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify(config, null, 2)
  );

  res.json({
    success: true
  });

});

// STATS
router.get('/stats', async (req, res) => {

  const { data, error } = await supabase
    .from('participants')
    .select('*');

  if (error) {
    return res.status(500).json({
      error: error.message
    });
  }

  const list = data || [];

  res.json({
    total: list.length,
    aguardando: list.filter(
      p => p.status === 'aguardando'
    ).length,
    confirmados: list.filter(
      p => p.status === 'confirmado'
    ).length,
    reprovados: list.filter(
      p => p.status === 'reprovado'
    ).length
  });

});

module.exports = router;