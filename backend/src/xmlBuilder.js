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
 * Estrutura conforme XSD v_S_01_03_00 (evtExpRisco.xsd)
 * @param {object} p
 * @param {string} p.evtId          - ID único (ID\d{34}, 36 chars)
 * @param {string} p.tpAmb          - "1" produção | "2" homologação
 * @param {string} p.indRetif       - "1" original | "2" retificação
 * @param {string} p.nrInsc8        - CNPJ raiz (8 dígitos)
 * @param {string} p.cpfTrab        - CPF do trabalhador (11 dígitos)
 * @param {string} p.matricula      - Matrícula (opcional)
 * @param {string} p.nrInscEstab    - CNPJ completo do estabelecimento (14 dígitos)
 * @param {string} p.dscSetor       - Descrição do setor/GHE (até 100 chars)
 * @param {string} p.dscAtivDes     - Descrição das atividades (até 999 chars)
 * @param {Array}  p.agNoc          - Agentes nocivos [{cod, dsc?, tpAval?, intConc?, limTol?, unMed?, tecMedicao?}]
 * @param {string} p.dtIniCondicao  - Data início YYYY-MM-DD (obrigatório)
 * @param {Array}  p.respReg        - Responsáveis pelos registros ambientais [{cpfResp, ideOC?, nrOC?, ufOC?, dscOC?}] (mín. 1)
 */
function buildS2240(p) {
  // Responsáveis pelos registros ambientais (obrigatório ≥ 1)
  // Para 09.01.001: só cpfResp. Para outros: + ideOC, nrOC, ufOC
  const respRegXml = (() => {
    const list = (p.respReg || []).length > 0
      ? p.respReg
      : [{ cpfResp: p.cpfResp || p.transmCPF || '' }];
    return list.map(r => {
      const hasAgNocReal = (p.agNoc || []).some(a => a.cod !== '09.01.001');
      return `
      <respReg>
        <cpfResp>${esc(r.cpfResp)}</cpfResp>${
        r.ideOC || hasAgNocReal ? `
        <ideOC>${esc(r.ideOC || '4')}</ideOC>` : ''}${
        r.ideOC === '9' && r.dscOC ? `
        <dscOC>${esc(r.dscOC)}</dscOC>` : ''}${
        r.nrOC || hasAgNocReal ? `
        <nrOC>${esc(r.nrOC || '')}</nrOC>` : ''}${
        r.ufOC || hasAgNocReal ? `
        <ufOC>${esc(r.ufOC || 'SP')}</ufOC>` : ''}
      </respReg>`;
    }).join('');
  })();

  // Agentes nocivos – estrutura nova (v_S_01_03_00):
  //   09.01.001 = sem risco → só <codAgNoc>, sem dscAgNoc/tpAval (dtIniCondicao >= 2024-04-22)
  //   outros códigos → codAgNoc + tpAval + opcionais + epcEpi
  const agNocXml = (p.agNoc || []).length > 0
    ? (p.agNoc || []).map(a => {
        const isSemRisco = a.cod === '09.01.001';
        return `
        <agNoc>
          <codAgNoc>${esc(a.cod)}</codAgNoc>${
          !isSemRisco && a.dsc ? `
          <dscAgNoc>${esc(a.dsc)}</dscAgNoc>` : ''}${
          !isSemRisco ? `
          <tpAval>${esc(a.tpAval || '2')}</tpAval>` : ''}${
          !isSemRisco && a.intConc != null && a.intConc !== '' ? `
          <intConc>${esc(a.intConc)}</intConc>` : ''}${
          !isSemRisco && a.limTol != null && a.limTol !== '' ? `
          <limTol>${esc(a.limTol)}</limTol>` : ''}${
          !isSemRisco && a.unMed != null && a.unMed !== '' ? `
          <unMed>${esc(a.unMed)}</unMed>` : ''}${
          a.tecMedicao ? `
          <tecMedicao>${esc(a.tecMedicao)}</tecMedicao>` : ''}${
          !isSemRisco ? `
          <epcEpi>
            <utilizEPC>${esc(a.utilizEPC || '0')}</utilizEPC>${
            a.utilizEPC === '2' ? `
            <eficEpc>${esc(a.eficEpc || 'S')}</eficEpc>` : ''}
            <utilizEPI>${esc(a.utilizEPI || '0')}</utilizEPI>${
            a.utilizEPI === '2' ? `
            <eficEpi>${esc(a.eficEpi || 'S')}</eficEpi>` : ''}
          </epcEpi>` : ''}
        </agNoc>`;
      }).join('')
    : `
        <agNoc>
          <codAgNoc>09.01.001</codAgNoc>
        </agNoc>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtExpRisco/v_S_01_03_00"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <evtExpRisco Id="${esc(p.evtId)}">
    <ideEvento>
      <indRetif>${esc(p.indRetif || '1')}</indRetif>
      <tpAmb>${esc(p.tpAmb || '2')}</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${esc(p.nrInsc8)}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${esc(p.cpfTrab)}</cpfTrab>${
      p.matricula ? `
      <matricula>${esc(p.matricula)}</matricula>` : `
      <codCateg>${esc(p.codCateg || '101')}</codCateg>`}
    </ideVinculo>
    <infoExpRisco>
      <dtIniCondicao>${esc(p.dtIniCondicao)}</dtIniCondicao>
      <infoAmb>
        <localAmb>1</localAmb>
        <dscSetor>${esc((p.dscSetor || '').substring(0, 100))}</dscSetor>
        <tpInsc>1</tpInsc>
        <nrInsc>${esc(p.nrInscEstab)}</nrInsc>
      </infoAmb>
      <infoAtiv>
        <dscAtivDes>${esc((p.dscAtivDes || p.obsAmb || 'Atividades administrativas').substring(0, 999))}</dscAtivDes>
      </infoAtiv>${agNocXml}${respRegXml}
    </infoExpRisco>
  </evtExpRisco>
</eSocial>`;
}

// ── S-2220 ─────────────────────────────────────────────────────────────────
/**
 * Evento S-2220 – Monitoramento da Saúde do Trabalhador (ASO) v_S_01_03_00
 * @param {object} p
 * @param {string} p.evtId        - ID único do evento
 * @param {string} p.tpAmb        - '1'=produção | '2'=homologação (default '2')
 * @param {string} p.nrInsc8      - CNPJ raiz 8 dígitos
 * @param {string} p.cpfTrab      - CPF do trabalhador (11 dígitos)
 * @param {string} p.nisTrab      - NIS/PIS do trabalhador (opcional)
 * @param {string} p.matricula    - Matrícula (opcional)
 * @param {string} p.dtAso        - Data do ASO YYYY-MM-DD
 * @param {string} p.tpAso        - 1=Admissional 2=Periódico 3=Retorno 4=Mudança 9=Demissional
 * @param {string} p.resAso       - 1=Apto 2=Inapto
 * @param {object} p.medico       - {nmMed, nrCRM, ufCRM} – médico responsável pelo ASO
 * @param {Array}  p.exames       - Exames complementares [{dtExm, procRealizado?, ordExame?, indResult?, obsProc?}]
 *                                  Cada exame: dtExm=data, procRealizado=código TUSS (ex: '0101'),
 *                                  ordExame=1(inicial)/2(sequencial), indResult=1(Normal)/2(Alterado)
 *                                  OBS: o exame clínico em si é o ASO (dtAso+medico). exames[] = exames COMPLEMENTARES.
 */
function buildS2220(p) {
  // Mapeamento tpAso antigo → tpExameOcup novo (v_S_01_03_00)
  // Antigo: 1=Admissional, 2=Periódico, 3=Retorno, 4=Mudança, 9=Demissional
  // Novo:   0=Admissional, 1=Periódico, 2=Retorno, 3=Mudança, 4=Monit.Pontual, 9=Demissional
  const tpMap = { '1':'0', '2':'1', '3':'2', '4':'3', '9':'9' };
  const tpExameOcup = tpMap[p.tpAso] ?? p.tpAso ?? '1';

  // Exames — obrigatório mínimo 1 com procRealizado (4 dígitos)
  const examesXml = (p.exames && p.exames.length > 0 ? p.exames : [{
    dtExm: p.dtAso,
    procRealizado: '0101', // exame clínico padrão
    ordExame: '1',
    indResult: p.resAso === '2' ? '2' : '1',
  }]).map((e, i) => `
        <exame>
          <dtExm>${esc(e.dtExm || p.dtAso)}</dtExm>
          <procRealizado>${esc(e.procRealizado || '0295')}</procRealizado>${
          e.obsProc ? `
          <obsProc>${esc(e.obsProc)}</obsProc>` : ''}${
          e.ordExame ? `
          <ordExame>${esc(e.ordExame)}</ordExame>` : ''}${
          e.indResult ? `
          <indResult>${esc(e.indResult)}</indResult>` : ''}
        </exame>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<eSocial xmlns="http://www.esocial.gov.br/schema/evt/evtMonit/v_S_01_03_00"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <evtMonit Id="${esc(p.evtId)}">
    <ideEvento>
      <indRetif>${esc(p.indRetif || '1')}</indRetif>
      <tpAmb>${esc(p.tpAmb || '2')}</tpAmb>
      <procEmi>1</procEmi>
      <verProc>1.0</verProc>
    </ideEvento>
    <ideEmpregador>
      <tpInsc>1</tpInsc>
      <nrInsc>${esc(p.nrInsc8)}</nrInsc>
    </ideEmpregador>
    <ideVinculo>
      <cpfTrab>${esc(p.cpfTrab)}</cpfTrab>${
      p.matricula ? `
      <matricula>${esc(p.matricula)}</matricula>` : `
      <codCateg>${esc(p.codCateg || '101')}</codCateg>`}
    </ideVinculo>
    <exMedOcup>
      <tpExameOcup>${esc(tpExameOcup)}</tpExameOcup>
      <aso>
        <dtAso>${esc(p.dtAso)}</dtAso>
        <resAso>${esc(p.resAso || '1')}</resAso>${examesXml}
        <medico>
          <nmMed>${esc(p.medico.nmMed)}</nmMed>${
          p.medico.nrCRM ? `
          <nrCRM>${esc(p.medico.nrCRM)}</nrCRM>` : ''}${
          p.medico.ufCRM ? `
          <ufCRM>${esc(p.medico.ufCRM)}</ufCRM>` : ''}
        </medico>
      </aso>
    </exMedOcup>
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
function generateEvtId(cnpjOuCpf, seq = 1) {
  // Formato oficial REGRA_VALIDA_ID_EVENTO (eSocial Leiaute Anexo II):
  // ID + T(1) + NNNNNNNNNNNNNN(14) + AAAAMMDD(8) + HHMMSS(6) + QQQQQ(5) = 36 chars
  //  T  = 1 (CNPJ) | 2 (CPF)
  //  NN = CNPJ raiz (8 dígitos) + 6 zeros  OU  CPF (11 dígitos) + 3 zeros
  const digits = cnpjOuCpf.replace(/\D/g, '');
  const isCpf  = digits.length <= 11;
  const T      = isCpf ? '2' : '1';
  // Raiz do CNPJ = primeiros 8 dígitos; CPF = 11 dígitos – ambos padded à direita até 14
  const raiz   = (isCpf ? digits.substring(0, 11) : digits.substring(0, 8)).padEnd(14, '0');
  const now    = new Date();
  const pad    = (n, l) => String(n).padStart(l, '0');
  const dt     = `${now.getFullYear()}${pad(now.getMonth()+1,2)}${pad(now.getDate(),2)}`;
  const hr     = `${pad(now.getHours(),2)}${pad(now.getMinutes(),2)}${pad(now.getSeconds(),2)}`;
  const s      = String(seq).padStart(5, '0');
  return `ID${T}${raiz}${dt}${hr}${s}`; // 2+1+14+8+6+5 = 36 chars
}

module.exports = { buildS2240, buildS2220, buildS2210, generateEvtId, esc };
