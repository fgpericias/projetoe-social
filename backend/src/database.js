'use strict';
/**
 * database.js
 * Armazenamento em arquivos JSON (sem compilação nativa necessária)
 * Guarda histórico de envios, empresas e trabalhadores
 */
const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// ── Utilitários de arquivo JSON ─────────────────────────────────────────────
function readDb(name) {
  const file = path.join(DATA_DIR, name + '.json');
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return []; }
}

function writeDb(name, data) {
  const file = path.join(DATA_DIR, name + '.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function now() {
  return new Date().toLocaleString('pt-BR');
}

// ── Empresas ────────────────────────────────────────────────────────────────
const Empresa = {
  upsert(data) {
    const list = readDb('empresas');
    const idx  = list.findIndex(e => e.cnpj === data.cnpj);
    const record = { ...data, updated_at: now() };
    if (idx >= 0) list[idx] = { ...list[idx], ...record };
    else list.push({ ...record, created_at: now() });
    writeDb('empresas', list);
    return record;
  },
  findByCnpj(cnpj) {
    return readDb('empresas').find(e => e.cnpj === cnpj.replace(/\D/g, ''));
  },
  list() {
    return readDb('empresas').sort((a, b) => (a.razao || '').localeCompare(b.razao || ''));
  },
};

// ── Trabalhadores ────────────────────────────────────────────────────────────
const Trabalhador = {
  bulkInsert(empresaId, lista) {
    const all = readDb('trabalhadores');
    for (const t of lista) {
      const cpf = (t.cpf || '').replace(/\D/g, '');
      const exists = all.findIndex(x => x.empresa_id === empresaId && x.cpf === cpf);
      const record = {
        id        : cpf + '_' + empresaId,
        empresa_id: empresaId,
        nome      : t.nome || '',
        cpf,
        nis       : (t.nis || '').replace(/\D/g, ''),
        matricula : t.matricula || '',
        cargo     : t.cargo || '',
        ghe       : t.ghe || '',
        created_at: now(),
      };
      if (exists >= 0) all[exists] = record;
      else all.push(record);
    }
    writeDb('trabalhadores', all);
  },
  findByEmpresa(empresaId) {
    return readDb('trabalhadores')
      .filter(t => t.empresa_id === empresaId)
      .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  },
};

// ── Eventos eSocial ──────────────────────────────────────────────────────────
const Evento = {
  insert(data) {
    const list = readDb('eventos');
    list.unshift({ ...data, created_at: now(), updated_at: now() });
    writeDb('eventos', list);
  },
  updateStatus(id, updates) {
    const list = readDb('eventos');
    const idx  = list.findIndex(e => e.id === id);
    if (idx >= 0) list[idx] = { ...list[idx], ...updates, updated_at: now() };
    writeDb('eventos', list);
  },
  findByEmpresa(empresaId, limit = 100) {
    return readDb('eventos')
      .filter(e => e.empresa_id === empresaId)
      .slice(0, limit);
  },
  findAll(limit = 200) {
    return readDb('eventos').slice(0, limit);
  },
  findPendentes() {
    return readDb('eventos').filter(e => e.status === 'enviado' && e.nr_rec);
  },
  findByNrRec(nrRec) {
    return readDb('eventos').find(e => e.nr_rec === nrRec);
  },
};

module.exports = { Empresa, Trabalhador, Evento };
