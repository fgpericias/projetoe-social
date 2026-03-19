'use strict';
/**
 * certificate.js
 * Carrega e extrai dados de um certificado .pfx (ICP-Brasil / e-CPF / e-CNPJ)
 */
const forge = require('node-forge');
const fs    = require('fs');
const path  = require('path');

/**
 * Carrega o certificado .pfx e retorna a chave privada e o certificado em PEM.
 * @param {string} pfxPath   - Caminho para o arquivo .pfx
 * @param {string} password  - Senha do certificado
 */
function loadCertificate(pfxPath, password) {
  // Normalizar caminho (converter barras invertidas escapadas)
  const normalizedPath = pfxPath.replace(/\\\\/g, '/');
  const resolvedPath = path.resolve(normalizedPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Certificado não encontrado em: ${resolvedPath}`);
  }

  const pfxBuffer = fs.readFileSync(resolvedPath);
  const pfxDer    = forge.util.binary.raw.encode(new Uint8Array(pfxBuffer));
  let pkcs12;
  try {
    const pfxAsn1 = forge.asn1.fromDer(pfxDer);
    pkcs12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);
  } catch (err) {
    throw new Error(`Senha do certificado incorreta ou arquivo corrompido: ${err.message}`);
  }

  // Extrai chave privada
  const keyBags = pkcs12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag  = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || [])[0];
  if (!keyBag || !keyBag.key) {
    // tenta keyBag simples
    const kb2 = pkcs12.getBags({ bagType: forge.pki.oids.keyBag });
    const k   = (kb2[forge.pki.oids.keyBag] || [])[0];
    if (!k) throw new Error('Chave privada não encontrada no certificado');
    keyBag = k;
  }
  const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);

  // Extrai certificados (pega o end-entity, não a CA)
  const certBags = pkcs12.getBags({ bagType: forge.pki.oids.certBag });
  const certs    = certBags[forge.pki.oids.certBag] || [];
  if (!certs.length) throw new Error('Certificado público não encontrado no .pfx');

  // Ordena: prefere cert sem basicConstraints CA (= end-entity)
  const endEntityBag = certs.find(b => {
    const ext = b.cert.getExtension('basicConstraints');
    return !ext || !ext.cA;
  }) || certs[0];

  const cert        = endEntityBag.cert;
  const certPem     = forge.pki.certificateToPem(cert);
  const certBase64  = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\r?\n/g, '');

  // Dados do titular
  const subject = {};
  cert.subject.attributes.forEach(a => { subject[a.shortName] = a.value; });

  const issuer = {};
  cert.issuer.attributes.forEach(a => { issuer[a.shortName] = a.value; });

  // CPF/CNPJ do titular (extraído do CN ou do SAN)
  let cpfCnpj = '';
  const cn = subject.CN || '';
  const cpfMatch  = cn.match(/(\d{11})/);
  const cnpjMatch = cn.match(/(\d{14})/);
  if (cnpjMatch) cpfCnpj = cnpjMatch[1];
  else if (cpfMatch) cpfCnpj = cpfMatch[1];

  return {
    privateKeyPem,
    certPem,
    certBase64,
    subject,
    issuer,
    cpfCnpj,
    validity: {
      notBefore : cert.validity.notBefore,
      notAfter  : cert.validity.notAfter,
    },
    pfxBuffer, // mantém para mTLS se necessário
  };
}

/**
 * Carrega o certificado a partir de um Buffer (upload via HTTP).
 */
function loadCertificateFromBuffer(buffer, password) {
  const tmp = require('os').tmpdir() + '/cert_tmp_' + Date.now() + '.pfx';
  fs.writeFileSync(tmp, buffer);
  try {
    return loadCertificate(tmp, password);
  } finally {
    fs.unlinkSync(tmp);
  }
}

module.exports = { loadCertificate, loadCertificateFromBuffer };
