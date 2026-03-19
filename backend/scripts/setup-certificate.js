#!/usr/bin/env node
'use strict';
/**
 * setup-certificate.js
 * Ferramenta de linha de comando para:
 *   1. Testar se o .pfx carrega corretamente
 *   2. Exibir informações do certificado
 *   3. Criar o arquivo .env preenchido
 *
 * Uso: node scripts/setup-certificate.js
 */
const readline = require('readline');
const path     = require('path');
const fs       = require('fs');
require('dotenv').config();

const { loadCertificate } = require('../src/certificate');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

async function main() {
  console.log('\n=== Configuração do Certificado Digital – eSocial SST ===\n');

  // Caminho do .pfx
  let pfxPath = await ask('Caminho do arquivo .pfx [ex: C:\\Users\\Dell\\Desktop\\Certificado.pfx]: ');
  pfxPath = pfxPath.trim();
  if (!fs.existsSync(pfxPath)) {
    console.error('❌ Arquivo não encontrado:', pfxPath);
    process.exit(1);
  }

  // Senha
  const password = await ask('Senha do certificado: ');

  console.log('\n🔄 Carregando certificado...');
  let cert;
  try {
    cert = loadCertificate(pfxPath, password.trim());
  } catch (err) {
    console.error('❌', err.message);
    rl.close();
    process.exit(1);
  }

  console.log('\n✅ Certificado carregado com sucesso!\n');
  console.log('   Titular :', cert.subject.CN || '(não identificado)');
  console.log('   CPF/CNPJ:', cert.cpfCnpj   || '(não extraído)');
  console.log('   Emitido por:', cert.issuer.CN || cert.issuer.O || '(não identificado)');
  console.log('   Válido até:', cert.validity.notAfter.toLocaleDateString('pt-BR'));

  const vencido = cert.validity.notAfter < new Date();
  if (vencido) console.warn('\n⚠️  ATENÇÃO: Este certificado está VENCIDO!');

  // Dados do transmissor
  const cpfTransmissor = cert.cpfCnpj || await ask('\nCPF do transmissor (11 dígitos): ');
  const nomeTransmissor = cert.subject.CN ? cert.subject.CN.split(':')[0].trim() : await ask('Nome do transmissor: ');

  // Ambiente
  const amb = await ask('\nAmbiente eSocial [producao/homologacao] (padrão: homologacao): ');
  const ambiente = amb.trim() === 'producao' ? 'producao' : 'homologacao';

  // Porta
  const portaStr = await ask('Porta do servidor (padrão: 3001): ');
  const porta = portaStr.trim() || '3001';

  // Gera JWT secret aleatório
  const jwtSecret = require('crypto').randomBytes(48).toString('hex');

  // Escreve .env
  const envContent = `# eSocial SST – gerado automaticamente em ${new Date().toLocaleString('pt-BR')}
PORT=${porta}
NODE_ENV=production

# Certificado Digital
PFX_PATH=${pfxPath.replace(/\\/g, '\\\\')}
PFX_PASSWORD=${password.trim()}

# Transmissor
TRANSMISSOR_CPF=${cpfTransmissor.replace(/\D/g,'')}
TRANSMISSOR_NOME=${nomeTransmissor}

# eSocial
ESOCIAL_AMBIENTE=${ambiente}

# Segurança
JWT_SECRET=${jwtSecret}

# CORS – coloque a URL do seu Cloudflare Pages aqui
FRONTEND_URL=*
`;

  const envPath = path.join(__dirname, '..', '.env');
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log(`\n✅ Arquivo .env criado em: ${envPath}`);
  console.log('\n🚀 Para iniciar o servidor: node server.js\n');

  rl.close();
}

main().catch(err => { console.error(err); process.exit(1); });
