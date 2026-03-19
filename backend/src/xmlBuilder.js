'use strict';
/**
 * xmlBuilder.js
 * Constrói os XMLs dos eventos eSocial SST:
 *   S-2240 – Condições Ambientais do Trabalho
 *   S-2220 – Monitoramento da Saúde do Trabalhador (ASO)
 *   S-2210 – Comunicação de Acidente de Trabalho (CAT)
 */

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── S-2240 ─────────────────────────────────────────────────────────────────
/**
 * @param {object} p
 * @param {string} p.evtId           - ID único do evento (ex: "ID12345678000195202501001")
 * @param {string} p.perApur         - Competência YYYY-MM
 * @param {string} p.tpAmb           - "1" produção | "2" homologação
 * @param {string} p.indRetif        - "1" original | "2" retificação
 * @param {string} p.nrInsc8         - 8 primeiros dígitos do CNPJ (raiz)
 * @param {string} p.cpfTrab         - CPF do trabalhador (11 dígitos)
 * @param {string} p.nisTrab         - NIS/PIS do trabalhador (11 dígitos)
 * @param {string} p.matricula       - Matrícula
 * @param {string} p.nrInscEstab     - CNPJ completo do estabelecimento (14 dígitos)
 * @param {string} p.dscSetor        - Nome do setor/GHE
 * @param {string} p.obsAmb          - Descrição das atividades
 * @param {Array}  p.agNoc           - Lista de agentes nocivos
 * @param {string} p.dtIniCondicao   - Data início da condição YYYY-MM-DD
 */
function buildS2240(p) {
  const agNocXml = (p.agNoc || []).map(a => `
        <agNoc>
          <codAgNoc>${esc(a.cod)}</codAgNoc>
          <dscAgNoc>${esc(a.dsc)}</dscAgNoc>
          <tpAval>${esc(a.tpAval || '2')}</tpAval>
          ${a.intConc ? `<intConc>${esc(a.intConc)}</intConc>` : ''}
          ${a.limTol  ? `<limTol>${esc(a.limTol)}</limTol>`   : ''}
          ${a.unMed   ? `<unMed>${esc(a.unMed)}</unMed>`     : ''}
          <tecMedAval>${esc(a.tecMedAval || '2')}</tecMedAval>
          <epcEficaz>${esc(a.epcEficaz || 'S')}</epcEficaz>
          <epiEficaz>${esc(a.epiEficaz || 'S')}</epiEficaz>
          <ativ>${esc(a.ativ || '1')}</ativ>
          <abert>${esc(a.abert || 'N')}</abert>
        </agNoc>`).join('') || `
        <agNoc>
          <codAgNoc>09.01.001</codAgNoc>
          <dscAgNoc>Ausência de fator de risco previsto no Anexo IV</dscAgNoc>
          <tpAval>2</tpAval>
          <tecMedAval>2</tecMedAval>
          <epcEficaz>S</epcEficaz>
          <epiEficaz>N</epiEficaz>
          <ativ>2</ativ>
          <abert>N</abert>
        </agNoc>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtExpRisco/v_S_01_03_00"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <evtExpRisco Id="${esc(p.evtId)}">
    <ideEvento>
      <indRetif>${esc(p.indRetif || '1')}</indRetif>
      <perApur>${esc(p.perApur)}</perApur>
      <tpAmb>${esc(p.tpAmb || '1')}</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${esc(p.nrInsc8)}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${esc(p.cpfTrab)}</cpfTrab>
      <nisTrab>${esc(p.nisTrab)}</nisTrab>
      <matricula>${esc(p.matricula || '001')}</matricula>
    </ideVinculo>
    <infoAmb>
      <localAmb>
        <tpInsc>1</tpInsc>
        <nrInsc>${esc(p.nrInscEstab)}</nrInsc>
        <dscSetor>${esc(p.dscSetor)}</dscSetor>
      </localAmb>
      <prgAmb>
        <codAmb>1</codAmb>
        <obsAmb>${esc((p.obsAmb || '').substring(0, 999))}</obsAmb>
        ${p.dtIniCondicao ? `<dtIniCondicao>${esc(p.dtIniCondicao)}</dtIniCondicao>` : ''}
        ${agNocXml}
      </prgAmb>
    </infoAmb>
  </evtExpRisco>
</eSocial>`;
}

// ── S-2220 ─────────────────────────────────────────────────────────────────
/**
 * @param {object} p
 * @param {string} p.evtId       - ID único
 * @param {string} p.tpAmb       - ambiente
 * @param {string} p.nrInsc8     - CNPJ raiz
 * @param {string} p.cpfTrab
 * @param {string} p.nisTrab
 * @param {string} p.matricula
 * @param {string} p.dtAso       - Data do ASO YYYY-MM-DD
 * @param {string} p.tpAso       - 1=Adm 2=Per 3=Ret 4=Mud 9=Dem
 * @param {string} p.resAso      - 1=Apto 2=Inapto
 * @param {object} p.medico      - {nmMed, nrCRM, ufCRM}
 * @param {Array}  p.exames      - [{dtExm, procRealizado, ordExame, indResult, obsExame?}]
 */
function buildS2220(p) {
  const examesXml = (p.exames || []).map((e, i) => `
      <exame>
        <dtExm>${esc(e.dtExm || p.dtAso)}</dtExm>
        <procRealizado>${esc(e.procRealizado)}</procRealizado>
        <ordExame>${i + 1}</ordExame>
        <indResult>${esc(e.indResult || '1')}</indResult>
        ${e.obsExame ? `<obsExame>${esc(e.obsExame)}</obsExame>` : ''}
      </exame>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_03_00"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <evtMonit Id="${esc(p.evtId)}">
    <ideEvento>
      <indRetif>${esc(p.indRetif || '1')}</indRetif>
      <tpAmb>${esc(p.tpAmb || '1')}</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${esc(p.nrInsc8)}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${esc(p.cpfTrab)}</cpfTrab>
      <nisTrab>${esc(p.nisTrab)}</nisTrab>
      <matricula>${esc(p.matricula || '001')}</matricula>
    </ideVinculo>
    <aso>
      <dtAso>${esc(p.dtAso)}</dtAso>
      <tpAso>${esc(p.tpAso)}</tpAso>
      <resAso>${esc(p.resAso)}</resAso>
      <medico>
        <nmMed>${esc(p.medico.nmMed)}</nmMed>
        <nrCRM>${esc(p.medico.nrCRM)}</nrCRM>
        <ufCRM>${esc(p.medico.ufCRM)}</ufCRM>
      </medico>
      ${examesXml}
    </aso>
  </evtMonit>
</eSocial>`;
}

// ── S-2210 ─────────────────────────────────────────────────────────────────
/**
 * @param {object} p - campos do acidente de trabalho
 */
function buildS2210(p) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtCAT/v_S_01_03_00"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <evtCAT Id="${esc(p.evtId)}">
    <ideEvento>
      <indRetif>${esc(p.indRetif || '1')}</indRetif>
      <tpAmb>${esc(p.tpAmb || '1')}</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${esc(p.nrInsc8)}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${esc(p.cpfTrab)}</cpfTrab>
      <nisTrab>${esc(p.nisTrab)}</nisTrab>
      <matricula>${esc(p.matricula || '001')}</matricula>
    </ideVinculo>
    <cat>
      <dtAcid>${esc(p.dtAcid)}</dtAcid>
      <tpAcid>${esc(p.tpAcid || '1')}</tpAcid>
      <hrAcid>${esc(p.hrAcid || '0800')}</hrAcid>
      <tpCat>${esc(p.tpCat || '1')}</tpCat>
      <indCatObito>${esc(p.indCatObito || 'N')}</indCatObito>
      <ideLocalAcid>
        <tpLocal>${esc(p.tpLocal || '1')}</tpLocal>
        <dscLocal>${esc(p.dscLocal)}</dscLocal>
        <tpLograd>${esc(p.tpLograd || 'R')}</tpLograd>
        <dscLograd>${esc(p.dscLograd)}</dscLograd>
        <nrLograd>${esc(p.nrLograd || 'S/N')}</nrLograd>
        ${p.complLograd ? `<complLograd>${esc(p.complLograd)}</complLograd>` : ''}
        <bairro>${esc(p.bairro || 'Centro')}</bairro>
        <cep>${esc(p.cep || '00000000')}</cep>
        <codMunic>${esc(p.codMunic || '3550308')}</codMunic>
        <uf>${esc(p.uf || 'SP')}</uf>
        <pais>105</pais>
      </ideLocalAcid>
      <atestado>
        <codCID>${esc(p.codCID)}</codCID>
        <dtAtend>${esc(p.dtAtend)}</dtAtend>
        <dscLesao>${esc(p.dscLesao)}</dscLesao>
        <partAtingPrinc>${esc(p.partAtingPrinc || '800')}</partAtingPrinc>
        <tpAcidEnum>${esc(p.tpAcidEnum || '9999')}</tpAcidEnum>
      </atestado>
      <acompMed>
        <nmMed>${esc(p.nmMed)}</nmMed>
        <nrCRM>${esc(p.nrCRM)}</nrCRM>
        <ufCRM>${esc(p.ufCRM || 'SP')}</ufCRM>
      </acompMed>
    </cat>
  </evtCAT>
</eSocial>`;
}

// ── Gera ID de evento no padrão eSocial ────────────────────────────────────
function generateEvtId(cnpj14, seq = 1) {
  const ts  = Date.now().toString().slice(-12);
  const s   = String(seq).padStart(5, '0');
  return `ID${cnpj14.replace(/\D/g, '')}${ts}${s}`;
}

module.exports = { buildS2240, buildS2220, buildS2210, generateEvtId, esc };
