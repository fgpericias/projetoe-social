'use strict';
/**
 * esocialAPI.js
 * Comunicação SOAP com o webservice do eSocial (produção e homologação)
 * – envio de lote de eventos
 * – consulta de resultado do lote
 */
const axios  = require('axios');
const https  = require('https');
const { v4: uuidv4 } = require('uuid');

// ── Endpoints oficiais ──────────────────────────────────────────────────────
const ENDPOINTS = {
  producao: {
    enviar   : 'https://webservices.envio.esocial.gov.br/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc',
    consultar: 'https://webservices.consulta.esocial.gov.br/servicos/empregador/consultarloteeventos/WsConsultarLoteEventos.svc',
  },
  homologacao: {
    enviar   : 'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/enviarloteeventos/WsEnviarLoteEventos.svc',
    consultar: 'https://webservices.producaorestrita.esocial.gov.br/servicos/empregador/consultarloteeventos/WsConsultarLoteEventos.svc',
  },
};

// ── Namespace do serviço ────────────────────────────────────────────────────
// Namespaces corretos para endpoints WCF (2025) - Manual Dev v1.15
const NS_ENVIO    = 'http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/v1_1_0';
// Namespace correto da consulta conforme WsConsultarLoteEventos-v1_1_0.wsdl (targetNamespace)
const NS_CONSULTA = 'http://www.esocial.gov.br/servicos/empregador/lote/eventos/envio/consulta/retornoProcessamento/v1_1_0';
const NS_LOTE     = 'http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1';
const SOAP_ACTION_ENVIAR   = `${NS_ENVIO}/ServicoEnviarLoteEventos/EnviarLoteEventos`;
const SOAP_ACTION_CONSULTAR = `${NS_CONSULTA}/ServicoConsultarLoteEventos/ConsultarLoteEventos`;

class EsocialAPI {
  /**
   * @param {object} opts
   * @param {Buffer}  opts.pfxBuffer     - Buffer do arquivo .pfx (descontinuado, usar privateKeyPem/certPem)
   * @param {string}  opts.privateKeyPem - Chave privada em PEM (preferido)
   * @param {string}  opts.certPem       - Certificado em PEM (preferido)
   * @param {string}  opts.pfxPassword   - Senha do .pfx (se usar pfxBuffer)
   * @param {string}  opts.ambiente      - 'producao' | 'homologacao'
   */
  constructor({ pfxBuffer, privateKeyPem, certPem, pfxPassword, ambiente = 'homologacao' }) {
    this.endpoints = ENDPOINTS[ambiente] || ENDPOINTS.homologacao;
    this.ambiente  = ambiente;

    // Agente HTTPS com certificado cliente (mTLS)
    // Preferir PEM em vez de pfxBuffer pois Node.js HTTPS funciona melhor assim
    try {
      let agentConfig;

      if (privateKeyPem && certPem) {
        // Usar chave privada e certificado em PEM (RECOMENDADO)
        agentConfig = {
          key  : privateKeyPem,
          cert : certPem,
          rejectUnauthorized: false,
        };
        console.log(`✅ https.Agent criado com PEM (chave + cert)`);
      } else if (pfxBuffer) {
        // Fallback para pfxBuffer se PEM não disponível
        agentConfig = {
          pfx             : pfxBuffer,
          passphrase      : pfxPassword,
          rejectUnauthorized: false,
        };
        console.log(`✅ https.Agent criado com PFX (${pfxBuffer.length} bytes)`);
      } else {
        throw new Error('Nenhum certificado fornecido (pfxBuffer ou privateKeyPem/certPem)');
      }

      this.httpsAgent = new https.Agent(agentConfig);
    } catch (err) {
      console.error(`❌ Erro ao criar https.Agent:`, err.message);
      throw err;
    }
  }

  // ── Monta XML do lote ─────────────────────────────────────────────────────
  buildLoteXml({ tpInscEmpregador, nrInscEmpregador, tpInscTransmissor, nrInscTransmissor, eventos }) {
    const eventosXml = eventos
      .map((e, i) => {
        const xmlClean = e.xml.replace(/^<\?xml[^?]*\?>\s*/i, '');
        // REGRA_VALIDA_ID_EVENTO: o Id do <evento> no lote DEVE ser idêntico
        // ao Id do elemento interno (evtExpRisco, evtMonit, evtCAT...).
        // Usar e.evtId (passado junto com e.xml) para garantir a igualdade.
        const eventoId = e.evtId || `ev${i + 1}`;
        return `      <evento Id="${eventoId}">\n        ${xmlClean}\n      </evento>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="${NS_LOTE}">
  <envioLoteEventos grupo="2">
    <ideEmpregador>
      <tpInsc>${tpInscEmpregador}</tpInsc>
      <nrInsc>${nrInscEmpregador}</nrInsc>
    </ideEmpregador>
    <ideTransmissor>
      <tpInsc>${tpInscTransmissor}</tpInsc>
      <nrInsc>${nrInscTransmissor}</nrInsc>
    </ideTransmissor>
    <eventos>
${eventosXml}
    </eventos>
  </envioLoteEventos>
</eSocial>`;
  }

  // ── Envelope SOAP para envio ──────────────────────────────────────────────
  buildEnvioSoap(loteXml) {
    return `<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ser="${NS_ENVIO}">
  <soapenv:Header/>
  <soapenv:Body>
    <ser:EnviarLoteEventos>
      <ser:loteEventos>
        ${loteXml.replace(/^<\?xml[^?]*\?>\s*/i, '')}
      </ser:loteEventos>
    </ser:EnviarLoteEventos>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  // ── Envelope SOAP para consulta ───────────────────────────────────────────
  // O campo correto é protocoloEnvio (não nrRec) — XSD ConsultaLoteEventos-v1_0_0.xsd
  buildConsultaSoap(protocoloEnvio) {
    const NS_CONSULTA_XML = 'http://www.esocial.gov.br/schema/lote/eventos/envio/consulta/retornoProcessamento/v1_0_0';
    return `<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:con="${NS_CONSULTA}">
  <soapenv:Header/>
  <soapenv:Body>
    <con:ConsultarLoteEventos>
      <con:consulta>
        <eSocial xmlns="${NS_CONSULTA_XML}">
          <consultaLoteEventos>
            <protocoloEnvio>${protocoloEnvio}</protocoloEnvio>
          </consultaLoteEventos>
        </eSocial>
      </con:consulta>
    </con:ConsultarLoteEventos>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  // ── Envia lote de eventos ─────────────────────────────────────────────────
  async enviarLote(params) {
    const loteXml      = this.buildLoteXml(params);
    const soapEnvelope = this.buildEnvioSoap(loteXml);

    // LOG temporário para debug do SOAP
    console.log('\n📤 SOAP ENVELOPE (primeiros 2000 chars):\n', soapEnvelope.substring(0, 2000));

    let rawResponse;
    try {
      const res = await axios.post(this.endpoints.enviar, soapEnvelope, {
        httpsAgent: this.httpsAgent,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction'  : `"${SOAP_ACTION_ENVIAR}"`,
        },
        timeout   : 60000,
        maxBodyLength: Infinity,
      });
      rawResponse = res.data;
    } catch (err) {
      if (err.response) {
        rawResponse = err.response.data;
        // eSocial às vezes retorna erro HTTP mas com SOAP Fault útil
      } else {
        throw new Error(`Falha na conexão com eSocial: ${err.message}`);
      }
    }

    return this._parseEnvioResponse(rawResponse, loteXml);
  }

  // ── Consulta resultado do lote ────────────────────────────────────────────
  async consultarLote(nrRec) {
    const soapBody = this.buildConsultaSoap(nrRec);

    let rawResponse;
    try {
      const res = await axios.post(this.endpoints.consultar, soapBody, {
        httpsAgent: this.httpsAgent,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction'  : `"${SOAP_ACTION_CONSULTAR}"`,
        },
        timeout: 30000,
      });
      rawResponse = res.data;
    } catch (err) {
      if (err.response) {
        rawResponse = err.response.data;
      } else {
        throw new Error(`Falha na consulta ao eSocial: ${err.message}`);
      }
    }

    console.log('\n📥 CONSULTA – Raw (primeiros 1500 chars):');
    console.log(String(rawResponse).substring(0, 1500));

    return this._parseConsultaResponse(rawResponse);
  }

  // ── Parsers de resposta ───────────────────────────────────────────────────
  _parseEnvioResponse(xml, loteXml) {
    console.log('\n📥 ========== RESPOSTA DO eSocial ==========');
    console.log('Primeiros 1500 chars:');
    console.log(xml.substring(0, 1500));
    console.log('='.repeat(50));

    const get = (tag) => {
      // Tenta vários formatos de tag
      // 1. Com namespace (ns1:cdResposta)
      let m = xml.match(new RegExp(`<ns[\\d]*:${tag}[^>]*>([^<]*)<\\/ns[\\d]*:${tag}>`, 'i'));
      if (m) return m[1].trim();

      // 2. Sem namespace (cdResposta)
      m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
      if (m) return m[1].trim();

      // 3. Com namespace qualquer (\w:cdResposta)
      m = xml.match(new RegExp(`<\\w+:${tag}[^>]*>([^<]*)<\\/\\w+:${tag}>`, 'i'));
      if (m) return m[1].trim();

      return null;
    };

    const cdResp   = get('cdResposta');
    const nrRec    = get('nrRec');
    const descResp = get('descResposta');
    const protocolo = get('protocoloEnvio');

    console.log(`\n✅ Parsed: cdResposta=${cdResp}, protocoloEnvio=${protocolo}, nrRec=${nrRec}, desc=${descResp}\n`);

    return {
      sucesso         : cdResp === '201',
      nrRec,
      protocoloEnvio  : protocolo,
      cdResposta      : cdResp,
      descResposta    : descResp,
      loteXml,
      rawResponse     : xml,
    };
  }

  _parseConsultaResponse(xml) {
    const get = (tag) => {
      // Match tags com ou sem namespace prefix
      let m = xml.match(new RegExp(`<[\\w]*:?${tag}[^>]*>([^<]*)<\\/[\\w]*:?${tag}>`));
      return m ? m[1].trim() : null;
    };

    // Situação do lote: cdResposta dentro de <status>
    const statusBlock = xml.match(/<status>([\s\S]*?)<\/status>/i);
    const cdRespLote  = statusBlock
      ? (statusBlock[1].match(/<cdResposta>([^<]*)<\/cdResposta>/) || [])[1] || null
      : null;
    const descLote    = statusBlock
      ? (statusBlock[1].match(/<descResposta>([^<]*)<\/descResposta>/) || [])[1] || null
      : null;

    // Retorno de cada evento (dentro de <processamento>)
    const eventosRetorno = [];
    const reEvt = /<processamento>([\s\S]*?)<\/processamento>/gi;
    let mEvt;
    while ((mEvt = reEvt.exec(xml)) !== null) {
      const blk  = mEvt[1];
      const cd   = (blk.match(/<cdResposta>([^<]*)<\/cdResposta>/) || [])[1] || '';
      const desc = (blk.match(/<descResposta>([^<]*)<\/descResposta>/) || [])[1] || '';
      // Ocorrências deste evento
      const ocorrs = [];
      const reOc = /<ocorrencia>([\s\S]*?)<\/ocorrencia>/gi;
      let mOc;
      while ((mOc = reOc.exec(blk)) !== null) {
        const o = mOc[1];
        ocorrs.push({
          tipo      : (o.match(/<tipo>([^<]*)<\/tipo>/) || [])[1] || '',
          codigo    : (o.match(/<codigo>([^<]*)<\/codigo>/) || [])[1] || '',
          descricao : (o.match(/<descricao>([^<]*)<\/descricao>/) || [])[1] || '',
          localizacao: (o.match(/<localizacao>([^<]*)<\/localizacao>/) || [])[1] || '',
        });
      }
      eventosRetorno.push({ cdResposta: cd, descResposta: desc, ocorrencias: ocorrs });
    }

    // Retrocompatibilidade: erros = todas as ocorrências de todos os eventos
    const erros = eventosRetorno.flatMap(e =>
      e.ocorrencias.map(o => ({ cod: o.codigo, desc: o.descricao }))
    );

    return {
      situacao     : cdRespLote,
      descSituacao : descLote,
      eventosRetorno,
      erros,
      rawResponse  : xml,
    };
  }
}

module.exports = { EsocialAPI };
