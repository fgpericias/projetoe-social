'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Diagnóstico de variáveis de ambiente (Railway)
console.log('🔍 Variáveis detectadas:', {
  PFX_BASE64: process.env.PFX_BASE64 ? `SIM (${process.env.PFX_BASE64.length} chars)` : 'NÃO',
  PFX_PASSWORD: process.env.PFX_PASSWORD ? 'SIM' : 'NÃO',
  TRANSMISSOR_CPF: process.env.TRANSMISSOR_CPF || 'NÃO',
  ESOCIAL_AMBIENTE: process.env.ESOCIAL_AMBIENTE || 'NÃO',
});

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const { v4: uuidv4 } = require('uuid');

const { loadCertificate }  = require('./src/certificate');
const { decodeCertificateFromBase64 } = require('./src/certificate-railway');
const { EsocialXmlSigner } = require('./src/xmlSigner');
const { EsocialAPI }        = require('./src/esocialAPI');
const { buildS2240, buildS2220, buildS2210, generateEvtId } = require('./src/xmlBuilder');
const { Empresa, Trabalhador, Evento } = require('./src/database');
const { v4: uuid2 } = require('uuid');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────────────────
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
  : ['http://localhost:3001', 'http://localhost:5500', 'http://127.0.0.1:5500'];

app.use(cors({
  origin: (origin, cb) => {
    // Permite sem origin (apps mobile, Postman, curl) ou origins na lista
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origem não permitida — ' + origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ── Gestão de usuários (whitelist) ─────────────────────────────────────────
const jwt = require('jsonwebtoken');
const usersFile = path.join(__dirname, 'data', 'users.json');

function loadUsers() {
  try {
    if (!fs.existsSync(usersFile)) {
      // Admin padrão = Ellen
      const admin = { email: process.env.ADMIN_EMAIL || 'ellencristinealmeida@gmail.com', role: 'admin', ativo: true, nome: 'Ellen Cristine', criadoEm: new Date().toISOString() };
      fs.mkdirSync(path.dirname(usersFile), { recursive: true });
      fs.writeFileSync(usersFile, JSON.stringify([admin], null, 2));
      return [admin];
    }
    return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  } catch { return []; }
}
function saveUsers(users) {
  fs.mkdirSync(path.dirname(usersFile), { recursive: true });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// ── Middleware JWT ──────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'prumosst_dev_secret_2025';

function authMiddleware(req, res, next) {
  // Permite sem auth se REQUIRE_AUTH não estiver ativo (desenvolvimento)
  if (process.env.REQUIRE_AUTH !== 'true') return next();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ erro: 'Token não fornecido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

function adminOnly(req, res, next) {
  if (process.env.REQUIRE_AUTH !== 'true') return next();
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao administrador' });
  next();
}

// ── Carrega certificado na inicialização ────────────────────────────────────
let certData  = null;
let signer    = null;
let esocialAPI = null;

function initCertificate() {
  let pfxPath    = process.env.PFX_PATH;
  const pfxBase64 = process.env.PFX_BASE64; // Para Railway
  const pfxPwd   = process.env.PFX_PASSWORD;
  const ambiente = process.env.ESOCIAL_AMBIENTE || 'homologacao';

  // Se em Railway, decodificar Base64
  if (pfxBase64 && !pfxPath) {
    console.log('🔐 Detectado ambiente Railway, decodificando certificado...');
    pfxPath = decodeCertificateFromBase64(pfxBase64);
  }

  if (!pfxPath || !pfxPwd) {
    console.warn('⚠️  PFX_PATH/PFX_BASE64 ou PFX_PASSWORD não configurados');
    return;
  }

  try {
    certData  = loadCertificate(pfxPath, pfxPwd);
    signer    = new EsocialXmlSigner(certData.privateKeyPem, certData.certBase64);
    esocialAPI = new EsocialAPI({
      privateKeyPem: certData.privateKeyPem,
      certPem      : certData.certPem,
      ambiente,
    });
    console.log(`✅ Certificado carregado: ${certData.subject.CN || certData.cpfCnpj}`);
    console.log(`   Validade: ${certData.validity.notBefore.toLocaleDateString('pt-BR')} → ${certData.validity.notAfter.toLocaleDateString('pt-BR')}`);
    console.log(`   Ambiente eSocial: ${ambiente}`);
  } catch (err) {
    console.error('❌ Erro ao carregar certificado:', err.message);
  }
}
initCertificate();

// ── Helpers ─────────────────────────────────────────────────────────────────
// Retorna { signer, esocialAPI, transmCPF } para a requisição
// Prioridade: cert do body da req > cert global do .env
function getCertForRequest(req, res) {
  const { userCertBase64, userCertPassword, userTransmCPF } = req.body || {};

  // Se o usuário enviou o próprio certificado
  if (userCertBase64 && userCertPassword) {
    try {
      const { loadCertificate } = require('./src/certificate');
      const { decodeCertificateFromBase64 } = require('./src/certificate-railway');
      const pfxPath = decodeCertificateFromBase64(userCertBase64);
      const cert = loadCertificate(pfxPath, userCertPassword);
      const userSigner = new EsocialXmlSigner(cert.privateKeyPem, cert.certBase64);
      const userAPI = new EsocialAPI({
        privateKeyPem: cert.privateKeyPem,
        certPem: cert.certPem,
        ambiente: process.env.ESOCIAL_AMBIENTE || 'homologacao',
      });
      return {
        signer: userSigner,
        esocialAPI: userAPI,
        transmCPF: (userTransmCPF || cert.cpfCnpj || process.env.TRANSMISSOR_CPF || '').replace(/\D/g, ''),
        ok: true,
      };
    } catch (err) {
      res.status(400).json({ erro: 'Certificado inválido: ' + err.message });
      return { ok: false };
    }
  }

  // Fallback: certificado global do .env
  if (!signer || !esocialAPI) {
    res.status(503).json({ erro: 'Certificado digital não configurado. Faça upload do seu certificado no perfil.' });
    return { ok: false };
  }
  return {
    signer,
    esocialAPI,
    transmCPF: (process.env.TRANSMISSOR_CPF || '').replace(/\D/g, ''),
    ok: true,
  };
}

function requireCert(res) {
  if (!signer || !esocialAPI) {
    res.status(503).json({ erro: 'Certificado digital não configurado. Configure PFX_PATH e PFX_PASSWORD no .env' });
    return false;
  }
  return true;
}

function cnpj8(cnpj) { return cnpj.replace(/\D/g, '').substring(0, 8); }
function cnpj14(cnpj) { return cnpj.replace(/\D/g, '').padEnd(14, '0').substring(0, 14); }

// ── GET /api/debug (diagnóstico Railway) ─────────────────────────────────────
app.get('/api/debug', (req, res) => {
  const allEnv = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k === 'PFX_BASE64') allEnv[k] = v ? `SIM_${v.length}_chars` : 'VAZIO';
    else if (['PFX_PASSWORD','TRANSMISSOR_CPF','TRANSMISSOR_NOME','ESOCIAL_AMBIENTE'].includes(k)) allEnv[k] = v || 'VAZIO';
  }
  res.json({
    versao_codigo: 'v5_debug',
    node_version: process.version,
    cwd: process.cwd(),
    variaveis_customizadas: allEnv,
    total_env_vars: Object.keys(process.env).length,
  });
});

// ── GET /api/status ──────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({
    ok       : true,
    cert     : certData ? {
      titular  : certData.subject.CN || certData.cpfCnpj,
      validade : certData.validity.notAfter,
      cpfCnpj  : certData.cpfCnpj,
    } : null,
    ambiente : process.env.ESOCIAL_AMBIENTE || 'homologacao',
    transmissor: {
      cpf  : process.env.TRANSMISSOR_CPF,
      nome : process.env.TRANSMISSOR_NOME,
    },
  });
});

// ── POST /api/empresas ───────────────────────────────────────────────────────
app.post('/api/empresas', (req, res) => {
  const { razao, cnpj, cnae, grauRisco, endereco } = req.body;
  if (!cnpj) return res.status(400).json({ erro: 'CNPJ obrigatório' });
  const id = uuidv4();
  Empresa.upsert({
    id, razao, cnae, grau_risco: grauRisco, endereco,
    cnpj : cnpj.replace(/\D/g, ''),
    cnpj8: cnpj8(cnpj),
    cpf_resp: process.env.TRANSMISSOR_CPF || '',
  });
  res.json({ ok: true, id });
});

app.get('/api/empresas', (req, res) => res.json(Empresa.list()));

// ── POST /api/trabalhadores/importar ─────────────────────────────────────────
app.post('/api/trabalhadores/importar', (req, res) => {
  const { empresaId, trabalhadores } = req.body;
  if (!empresaId || !Array.isArray(trabalhadores)) {
    return res.status(400).json({ erro: 'empresaId e trabalhadores[] obrigatórios' });
  }
  Trabalhador.bulkInsert(empresaId, trabalhadores);
  res.json({ ok: true, importados: trabalhadores.length });
});

app.get('/api/trabalhadores/:empresaId', (req, res) => {
  res.json(Trabalhador.findByEmpresa(req.params.empresaId));
});

// ── POST /api/enviar/s2240 ───────────────────────────────────────────────────
app.post('/api/enviar/s2240', authMiddleware, async (req, res) => {
  const certCtx = getCertForRequest(req, res); if (!certCtx.ok) return;
  const { empresaId, cnpj, ghe, agNoc, perApur, tpAmb, engCpf, engCrea, engCreaUf } = req.body;
  const trabalhadores = req.body.trabalhadores;
  if (!Array.isArray(trabalhadores) || trabalhadores.length === 0) {
    return res.status(400).json({ erro: 'Nenhum trabalhador informado. Adicione pelo menos um CPF antes de enviar.' });
  }
  for (const t of trabalhadores) {
    const dtIni = t.dtIni || t.dtIniCondicao || req.body.dtIniCondicao || '';
    if (!dtIni || !/^\d{4}-\d{2}-\d{2}$/.test(dtIni)) {
      return res.status(400).json({ erro: `Preencha a "Data de Início da Exposição" do trabalhador ${t.cpf || ''}. Formato: DD/MM/AAAA` });
    }
  }

  try {
    const cnpj14str = cnpj14(cnpj || '');
    const cnpj8str  = cnpj8(cnpj || '');
    const transmCPF = certCtx.transmCPF;
    const xmlsSigned = [];

    for (const trab of trabalhadores) {
      const evtId  = generateEvtId(cnpj14str, xmlsSigned.length + 1);
      const xml    = buildS2240({
        evtId,
        perApur       : perApur || new Date().toISOString().slice(0, 7),
        tpAmb         : tpAmb || process.env.ESOCIAL_AMBIENTE === 'producao' ? '1' : '2',
        indRetif      : '1',
        nrInsc8       : cnpj8str,
        cpfTrab       : (trab.cpf || '').replace(/\D/g, '').padStart(11, '0').substring(0, 11),
        nisTrab       : (trab.nis || '').replace(/\D/g, '').padStart(11, '0').substring(0, 11),
        matricula     : trab.mat || trab.matricula || undefined,
        nrInscEstab   : cnpj14str,
        dscSetor      : ghe.setor || 'GHE',
        obsAmb        : ghe.atividades || '',
        agNoc,
        dtIniCondicao : trab.dtIni || trab.dtIniCondicao || ghe.dtIniCondicao || req.body.dtIniCondicao || '',
        // Responsável pelos registros ambientais (obrigatório pelo XSD v_S_01_03_00)
        respReg: [{
          cpfResp : (engCpf || transmCPF).replace(/\D/g, ''),
          ideOC   : (agNoc || []).some(a => a.cod !== '09.01.001') ? '1' : undefined, // 1=CREA (só p/ ag. nocivos reais)
          nrOC    : (agNoc || []).some(a => a.cod !== '09.01.001') ? (engCrea || '').replace(/\D/g, '') : undefined,
          ufOC    : (agNoc || []).some(a => a.cod !== '09.01.001') ? (engCreaUf || 'SP') : undefined,
        }],
      });

      console.log('\n🔍 XML S-2240 ANTES DE ASSINAR:\n', xml.substring(0, 1500));
      const xmlSigned = certCtx.signer.sign(xml, evtId);
      xmlsSigned.push({ xml: xmlSigned, evtId });
    }

    const resultado = await certCtx.esocialAPI.enviarLote({
      tpInscEmpregador  : '1',
      nrInscEmpregador  : cnpj8str,
      tpInscTransmissor : '2',
      nrInscTransmissor : transmCPF,
      eventos           : xmlsSigned,
    });

    // Salva no banco
    xmlsSigned.forEach((e, i) => {
      Evento.insert({
        id          : uuidv4(),
        empresa_id  : empresaId || '',
        tipo_evento : 'S-2240',
        evt_id      : e.evtId,
        nr_rec      : resultado.protocoloEnvio || resultado.nrRec || null,
        cd_resposta : resultado.cdResposta,
        desc_resposta: resultado.descResposta,
        status      : resultado.sucesso ? 'enviado' : 'erro',
        xml_enviado : e.xml,
        worker_cpf  : (trabalhadores[i]?.cpf || '').replace(/\D/g, ''),
        competencia : perApur,
        ambiente    : process.env.ESOCIAL_AMBIENTE || 'homologacao',
      });
    });

    res.json(resultado);
  } catch (err) {
    console.error('Erro S-2240:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ── POST /api/enviar/s2220 ───────────────────────────────────────────────────
app.post('/api/enviar/s2220', authMiddleware, async (req, res) => {
  const certCtx = getCertForRequest(req, res); if (!certCtx.ok) return;
  const { empresaId, cnpj, asos, tpAmb } = req.body;

  try {
    const cnpj14str = cnpj14(cnpj || '');
    const cnpj8str  = cnpj8(cnpj || '');
    const transmCPF = certCtx.transmCPF;
    const xmlsSigned = [];

    for (const aso of asos) {
      const evtId  = generateEvtId(cnpj14str, xmlsSigned.length + 1);
      const xml    = buildS2220({
        evtId,
        tpAmb    : tpAmb || (process.env.ESOCIAL_AMBIENTE === 'producao' ? '1' : '2'),
        indRetif : '1',
        nrInsc8  : cnpj8str,
        cpfTrab  : (aso.cpf || '').replace(/\D/g, '').padStart(11, '0').substring(0, 11),
        nisTrab  : (() => { const n = (aso.nis || '').replace(/\D/g, ''); return n && !/^0+$/.test(n) ? n : undefined; })(),
        matricula: aso.matricula || undefined,
        dtAso    : aso.dtAso,
        tpAso    : aso.tpAso || '2',
        resAso   : aso.resAso || '1',
        medico   : aso.medico,
        exames   : aso.exames || [],
      });

      const xmlSigned = certCtx.signer.sign(xml, evtId);
      xmlsSigned.push({ xml: xmlSigned, evtId, cpf: aso.cpf });
    }

    const resultado = await certCtx.esocialAPI.enviarLote({
      tpInscEmpregador  : '1',
      nrInscEmpregador  : cnpj8str,
      tpInscTransmissor : '2',
      nrInscTransmissor : transmCPF,
      eventos           : xmlsSigned,
    });

    xmlsSigned.forEach((e, i) => {
      Evento.insert({
        id          : uuidv4(),
        empresa_id  : empresaId || '',
        tipo_evento : 'S-2220',
        evt_id      : e.evtId,
        nr_rec      : resultado.protocoloEnvio || resultado.nrRec || null,
        cd_resposta : resultado.cdResposta,
        desc_resposta: resultado.descResposta,
        status      : resultado.sucesso ? 'enviado' : 'erro',
        xml_enviado : e.xml,
        worker_cpf  : (e.cpf || '').replace(/\D/g, ''),
        competencia : (asos[0]?.dtAso || '').substring(0, 7),
        ambiente    : process.env.ESOCIAL_AMBIENTE || 'homologacao',
      });
    });

    res.json(resultado);
  } catch (err) {
    console.error('Erro S-2220:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ── POST /api/enviar/s2210 ───────────────────────────────────────────────────
app.post('/api/enviar/s2210', authMiddleware, async (req, res) => {
  const certCtx = getCertForRequest(req, res); if (!certCtx.ok) return;
  const { empresaId, cnpj, cat, tpAmb } = req.body;

  try {
    const cnpj14str = cnpj14(cnpj || '');
    const cnpj8str  = cnpj8(cnpj || '');
    const transmCPF = certCtx.transmCPF;
    const evtId     = generateEvtId(cnpj14str, 1);

    const xml    = buildS2210({
      evtId,
      tpAmb    : tpAmb || (process.env.ESOCIAL_AMBIENTE === 'producao' ? '1' : '2'),
      indRetif : '1',
      nrInsc8  : cnpj8str,
      ...cat,
    });

    const xmlSigned = certCtx.signer.sign(xml, evtId);

    const resultado = await certCtx.esocialAPI.enviarLote({
      tpInscEmpregador  : '1',
      nrInscEmpregador  : cnpj8str,
      tpInscTransmissor : '2',
      nrInscTransmissor : transmCPF,
      eventos           : [{ xml: xmlSigned, evtId }],
    });

    Evento.insert({
      id          : uuidv4(),
      empresa_id  : empresaId || '',
      tipo_evento : 'S-2210',
      evt_id      : evtId,
      nr_rec      : resultado.protocoloEnvio || resultado.nrRec || null,
      cd_resposta : resultado.cdResposta,
      desc_resposta: resultado.descResposta,
      status      : resultado.sucesso ? 'enviado' : 'erro',
      xml_enviado : xmlSigned,
      worker_cpf  : (cat.cpfTrab || '').replace(/\D/g, ''),
      competencia : (cat.dtAcid || '').substring(0, 7),
      ambiente    : process.env.ESOCIAL_AMBIENTE || 'homologacao',
    });

    res.json(resultado);
  } catch (err) {
    console.error('Erro S-2210:', err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ── GET /api/consultar/:nrRec ────────────────────────────────────────────────
app.get('/api/consultar/:nrRec', authMiddleware, async (req, res) => {
  if (!requireCert(res)) return;
  try {
    const resultado = await esocialAPI.consultarLote(req.params.nrRec);
    const evt = Evento.findByNrRec(req.params.nrRec);
    if (evt) {
      Evento.updateStatus(evt.id, {
        status        : resultado.situacao === '4' ? 'processado' : 'enviado',
        nr_rec        : req.params.nrRec,
        cd_resposta   : resultado.situacao,
        desc_resposta : resultado.descSituacao,
        xml_resposta  : resultado.rawResponse,
        situacao_lote : resultado.situacao,
        erros         : JSON.stringify(resultado.erros || []),
      });
    }
    res.json(resultado);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── GET /api/historico/:empresaId ────────────────────────────────────────────
app.get('/api/historico/:empresaId', (req, res) => {
  const eventos = Evento.findByEmpresa(req.params.empresaId);
  res.json(eventos);
});

// ── GET /api/historico ───────────────────────────────────────────────────────
app.get('/api/historico', (req, res) => {
  res.json(Evento.findAll(200));
});

// ── Polling automático de status (a cada 5 min) ──────────────────────────────
setInterval(async () => {
  if (!esocialAPI) return;
  try {
    const pendentes = Evento.findPendentes();
    for (const evt of pendentes) {
      if (!evt.nr_rec) continue;
      try {
        const r = await esocialAPI.consultarLote(evt.nr_rec);
        if (r.situacao) {
          Evento.updateStatus(evt.id, {
            status        : r.situacao === '4' ? 'processado' : 'enviado',
            nr_rec        : evt.nr_rec,
            cd_resposta   : r.situacao,
            desc_resposta : r.descSituacao,
            xml_resposta  : r.rawResponse,
            situacao_lote : r.situacao,
            erros         : JSON.stringify(r.erros || []),
          });
        }
      } catch (_) { /* ignora falhas individuais */ }
    }
  } catch (_) { /* ignora erros de leitura */ }
}, 5 * 60 * 1000);

// ── POST /api/auth/login ─────────────────────────────────────────────────────
// Recebe { email, nome, googleUid } do frontend após Google OAuth
// Verifica se email está na whitelist e retorna JWT próprio
app.post('/api/auth/login', (req, res) => {
  const { email, nome, googleUid } = req.body;
  if (!email) return res.status(400).json({ erro: 'Email obrigatório' });

  const users = loadUsers();
  let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  // Modo desenvolvimento (REQUIRE_AUTH != true): aceita qualquer Google autenticado
  // e auto-cadastra como admin se for o primeiro usuário
  if (!user && process.env.REQUIRE_AUTH !== 'true') {
    const isFirstUser = users.length === 0;
    user = {
      email: email.toLowerCase(),
      nome: nome || email,
      role: isFirstUser ? 'admin' : 'user',
      ativo: true,
      criadoEm: new Date().toISOString(),
    };
    users.push(user);
    saveUsers(users);
    console.log(`✅ Modo dev: usuário auto-cadastrado — ${email} (${user.role})`);
  }

  if (!user) return res.status(403).json({ erro: 'Acesso não autorizado. Solicite acesso ao administrador.' });
  if (!user.ativo) return res.status(403).json({ erro: 'Sua conta está suspensa. Entre em contato com o suporte.' });

  // Atualiza último acesso
  user.ultimoAcesso = new Date().toISOString();
  if (nome && !user.nome) user.nome = nome;
  saveUsers(users);

  const token = jwt.sign(
    { email: user.email, nome: user.nome || nome, role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({ ok: true, token, user: { email: user.email, nome: user.nome, role: user.role } });
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
app.get('/api/admin/users', authMiddleware, adminOnly, (req, res) => {
  res.json(loadUsers());
});

// ── POST /api/admin/users ─────────────────────────────────────────────────────
app.post('/api/admin/users', authMiddleware, adminOnly, (req, res) => {
  const { email, nome, role } = req.body;
  if (!email) return res.status(400).json({ erro: 'Email obrigatório' });
  const users = loadUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ erro: 'Email já cadastrado' });
  }
  users.push({ email: email.toLowerCase(), nome: nome || '', role: role || 'user', ativo: true, criadoEm: new Date().toISOString() });
  saveUsers(users);
  res.json({ ok: true });
});

// ── PATCH /api/admin/users/:email ─────────────────────────────────────────────
app.patch('/api/admin/users/:email', authMiddleware, adminOnly, (req, res) => {
  const users = loadUsers();
  const idx = users.findIndex(u => u.email.toLowerCase() === decodeURIComponent(req.params.email).toLowerCase());
  if (idx === -1) return res.status(404).json({ erro: 'Usuário não encontrado' });
  Object.assign(users[idx], req.body);
  saveUsers(users);
  res.json({ ok: true, user: users[idx] });
});

// ── DELETE /api/admin/users/:email ────────────────────────────────────────────
app.delete('/api/admin/users/:email', authMiddleware, adminOnly, (req, res) => {
  let users = loadUsers();
  const email = decodeURIComponent(req.params.email).toLowerCase();
  const admin = users.find(u => u.role === 'admin');
  if (admin && admin.email.toLowerCase() === email) return res.status(400).json({ erro: 'Não é possível remover o administrador principal' });
  users = users.filter(u => u.email.toLowerCase() !== email);
  saveUsers(users);
  res.json({ ok: true });
});

// ── Inicia servidor ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 eSocial SST Backend rodando em http://localhost:${PORT}`);
  console.log(`   Frontend: http://localhost:${PORT}\n`);
});
