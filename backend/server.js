'use strict';
require('dotenv').config();

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
app.use(cors({ origin: '*' })); // Em produção, restrinja para o domínio do Cloudflare Pages
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

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
function requireCert(res) {
  if (!signer || !esocialAPI) {
    res.status(503).json({ erro: 'Certificado digital não configurado. Configure PFX_PATH e PFX_PASSWORD no .env' });
    return false;
  }
  return true;
}

function cnpj8(cnpj) { return cnpj.replace(/\D/g, '').substring(0, 8); }
function cnpj14(cnpj) { return cnpj.replace(/\D/g, '').padEnd(14, '0').substring(0, 14); }

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
app.post('/api/enviar/s2240', async (req, res) => {
  if (!requireCert(res)) return;
  const { empresaId, cnpj, ghe, trabalhadores, agNoc, perApur, tpAmb } = req.body;

  try {
    const cnpj14str = cnpj14(cnpj || '');
    const cnpj8str  = cnpj8(cnpj || '');
    const transmCPF = (process.env.TRANSMISSOR_CPF || '').replace(/\D/g, '');
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
        matricula     : trab.matricula || '001',
        nrInscEstab   : cnpj14str,
        dscSetor      : ghe.setor || 'GHE',
        obsAmb        : ghe.atividades || '',
        agNoc,
        dtIniCondicao : ghe.dtIniCondicao || '',
      });

      const xmlSigned = signer.sign(xml, evtId);
      xmlsSigned.push({ xml: xmlSigned, evtId });
    }

    const resultado = await esocialAPI.enviarLote({
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
        nr_rec      : resultado.nrRec || null,
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
app.post('/api/enviar/s2220', async (req, res) => {
  if (!requireCert(res)) return;
  const { empresaId, cnpj, asos, tpAmb } = req.body;

  try {
    const cnpj14str = cnpj14(cnpj || '');
    const cnpj8str  = cnpj8(cnpj || '');
    const transmCPF = (process.env.TRANSMISSOR_CPF || '').replace(/\D/g, '');
    const xmlsSigned = [];

    for (const aso of asos) {
      const evtId  = generateEvtId(cnpj14str, xmlsSigned.length + 1);
      const xml    = buildS2220({
        evtId,
        tpAmb    : tpAmb || (process.env.ESOCIAL_AMBIENTE === 'producao' ? '1' : '2'),
        indRetif : '1',
        nrInsc8  : cnpj8str,
        cpfTrab  : (aso.cpf || '').replace(/\D/g, '').padStart(11, '0').substring(0, 11),
        nisTrab  : (aso.nis || '').replace(/\D/g, '').padStart(11, '0').substring(0, 11),
        matricula: aso.matricula || '001',
        dtAso    : aso.dtAso,
        tpAso    : aso.tpAso || '2',
        resAso   : aso.resAso || '1',
        medico   : aso.medico,
        exames   : aso.exames || [],
      });

      const xmlSigned = signer.sign(xml, evtId);
      xmlsSigned.push({ xml: xmlSigned, evtId, cpf: aso.cpf });
    }

    const resultado = await esocialAPI.enviarLote({
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
        nr_rec      : resultado.nrRec || null,
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
app.post('/api/enviar/s2210', async (req, res) => {
  if (!requireCert(res)) return;
  const { empresaId, cnpj, cat, tpAmb } = req.body;

  try {
    const cnpj14str = cnpj14(cnpj || '');
    const cnpj8str  = cnpj8(cnpj || '');
    const transmCPF = (process.env.TRANSMISSOR_CPF || '').replace(/\D/g, '');
    const evtId     = generateEvtId(cnpj14str, 1);

    const xml    = buildS2210({
      evtId,
      tpAmb    : tpAmb || (process.env.ESOCIAL_AMBIENTE === 'producao' ? '1' : '2'),
      indRetif : '1',
      nrInsc8  : cnpj8str,
      ...cat,
    });

    const xmlSigned = signer.sign(xml, evtId);

    const resultado = await esocialAPI.enviarLote({
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
      nr_rec      : resultado.nrRec || null,
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
app.get('/api/consultar/:nrRec', async (req, res) => {
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

// ── Inicia servidor ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 eSocial SST Backend rodando em http://localhost:${PORT}`);
  console.log(`   Frontend: http://localhost:${PORT}\n`);
});
