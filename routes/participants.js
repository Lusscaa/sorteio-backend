const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;

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
    else cb(new Error('Tipo de arquivo inválido.'));
  }
});

const abbreviateName = (name) => {
  const parts = name.trim().split(' ').filter(Boolean);

  if (parts.length === 1) return parts[0];

  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
};

// LISTAR PARTICIPANTES
router.get('/', async (req, res) => {

  const { data, error } = await supabase
    .from('Nome')
    .select('*')
    .order('numeroParticipacao', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const public_list = data.map(p => ({
    id: p.id,
    numeroParticipacao: p.numeroParticipacao,
    nomeAbreviado: abbreviateName(p.nome),
    status: p.status,
    criadoEm: p.criadoEm
  }));

  res.json(public_list);
});

// NOVO PARTICIPANTE
router.post('/',
  upload.fields([
    { name: 'comprovante1', maxCount: 1 },
    { name: 'comprovante2', maxCount: 1 }
  ]),
  async (req, res) => {

    const { nome, email, whatsapp } = req.body;

    if (!nome || !email || !whatsapp) {
      return res.status(400).json({
        error: 'Todos os campos são obrigatórios.'
      });
    }

    if (!req.files?.comprovante1 || !req.files?.comprovante2) {
      return res.status(400).json({
        error: 'Ambos comprovantes obrigatórios.'
      });
    }

    const comprovante1 =
      req.files.comprovante1[0].filename;

    const comprovante2 =
      req.files.comprovante2[0].filename;

    // BUSCA DUPLICADOS
    const { data: existentes } = await supabase
      .from('Nome')
      .select('*');

    const duplicate = existentes.find(
      p =>
        p['E-mail'] === email ||
        p.Tel === whatsapp
    );

    if (duplicate) {
      return res.status(409).json({
        error: 'E-mail ou telefone já cadastrado.'
      });
    }

    const nextNum =
      existentes.length > 0
        ? Math.max(...existentes.map(p =>
            p.numeroParticipacao || 0
          )) + 1
        : 1;

    const { error } = await supabase
      .from('Nome')
      .insert([
        {
          nome: nome,
          'E-mail': email,
          Tel: whatsapp,
          Print1: comprovante1,
          Print2: comprovante2,
          numeroParticipacao: nextNum,
          status: 'aguardando',
          criadoEm: new Date().toISOString()
        }
      ]);

    if (error) {
      return res.status(500).json({
        error: error.message
      });
    }

    res.status(201).json({
      success: true,
      numeroParticipacao: nextNum,
      nomeAbreviado: abbreviateName(nome),
      status: 'aguardando'
    });
  }
);

module.exports = router;