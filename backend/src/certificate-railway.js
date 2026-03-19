'use strict';
/**
 * certificate-railway.js
 * Decodifica certificado em Base64 (para Railway/ambiente sem acesso a arquivo)
 */
const fs = require('fs');
const path = require('path');

/**
 * Decodifica certificado em Base64 e salva como arquivo temporário
 * @param {string} base64String - String Base64 do certificado
 * @returns {string} Caminho do arquivo decodificado
 */
function decodeCertificateFromBase64(base64String) {
  const tmpDir = '/tmp'; // Railway usa /tmp
  const certPath = path.join(tmpDir, 'cert_temp.pfx');

  try {
    // Decodificar Base64 para Buffer
    const buffer = Buffer.from(base64String, 'base64');

    // Salvar no arquivo temporário
    fs.writeFileSync(certPath, buffer);

    console.log(`✅ Certificado decodificado e salvo em: ${certPath}`);
    return certPath;
  } catch (err) {
    throw new Error(`Erro ao decodificar certificado Base64: ${err.message}`);
  }
}

module.exports = { decodeCertificateFromBase64 };
