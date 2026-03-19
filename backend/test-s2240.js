#!/usr/bin/env node
'use strict';

// Teste automatizado de envio S-2240
require('dotenv').config();

const { EsocialAPI } = require('./src/esocialAPI');
const { loadCertificate } = require('./src/certificate');
const { buildS2240, generateEvtId } = require('./src/xmlBuilder');

async function testS2240() {
  console.log('🧪 Iniciando teste de envio S-2240...\n');

  try {
    // 1. Carregar certificado
    const pfxPath = process.env.PFX_PATH;
    const pfxPwd = process.env.PFX_PASSWORD;
    const certData = loadCertificate(pfxPath, pfxPwd);
    console.log(`✅ Certificado carregado: ${certData.cpfCnpj}`);

    // 2. Preparar dados de teste
    const dados = {
      tpInscEmpregador: 2, // CNPJ
      nrInscEmpregador: '00000000000191',
      tpInscTransmissor: 1, // CPF
      nrInscTransmissor: process.env.TRANSMISSOR_CPF || '34781894895',
      transmissorNome: process.env.TRANSMISSOR_NOME || 'Ellen Cristine',
      ideEvento: generateEvtId('00000000000191', 1),
      agNoc: [
        {
          seqAgNoc: '001',
          codAgNoc: '09.01.001',
          dscAgNoc: 'Ruído',
        },
      ],
    };

    console.log(`📋 Dados de teste preparados`);
    console.log(`   CNPJ: ${dados.nrInscEmpregador}`);
    console.log(`   CPF Transmissor: ${dados.nrInscTransmissor}`);

    // 3. Construir XML S-2240
    const xmlS2240 = buildS2240(dados);
    console.log(`\n📄 XML S-2240 gerado (${xmlS2240.length} bytes)`);

    // 4. Inicializar eSocial API
    const esocialAPI = new EsocialAPI({
      privateKeyPem: certData.privateKeyPem,
      certPem: certData.certPem,
      ambiente: 'homologacao',
    });

    // 5. Enviar evento
    console.log(`\n🚀 Enviando ao eSocial...\n`);
    let resultado;
    try {
      resultado = await esocialAPI.enviarLote({
        tpInscEmpregador: dados.tpInscEmpregador,
        nrInscEmpregador: dados.nrInscEmpregador,
        tpInscTransmissor: dados.tpInscTransmissor,
        nrInscTransmissor: dados.nrInscTransmissor,
        eventos: [{ xml: xmlS2240 }],
      });
    } catch (apiErr) {
      console.error(`❌ Erro ao enviar:`, apiErr.message);
      if (apiErr.response?.data) {
        console.log(`Resposta:`, apiErr.response.data.substring(0, 600));
      }
      throw apiErr;
    }

    // 6. Exibir resultado
    console.log('\n📨 RESPOSTA DO eSocial:');
    console.log(`   Sucesso: ${resultado.sucesso}`);
    console.log(`   Código: ${resultado.cdResposta}`);
    console.log(`   Descrição: ${resultado.descResposta}`);
    console.log(`   NrRec: ${resultado.nrRec}`);

    if (resultado.rawResponse) {
      console.log(`\n📥 Resposta bruta (primeiros 800 chars):`);
      console.log(resultado.rawResponse.substring(0, 800));
      console.log('\n...\n');
    }

    process.exit(resultado.sucesso ? 0 : 1);

  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
    if (err.response?.data) {
      console.error('Resposta:', err.response.data.substring(0, 500));
    }
    process.exit(1);
  }
}

testS2240();
