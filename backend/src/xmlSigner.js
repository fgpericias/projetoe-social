'use strict';
/**
 * xmlSigner.js
 * Assina XMLs de eventos eSocial com XMLDSig (RSA-SHA256 + C14N)
 * conforme manual técnico eSocial v1.3
 */
const xmlCrypto = require('xml-crypto');

class EsocialXmlSigner {
  /**
   * @param {string} privateKeyPem - Chave privada RSA em formato PEM
   * @param {string} certBase64    - Certificado em Base64 (sem headers PEM)
   */
  constructor(privateKeyPem, certBase64) {
    this.privateKeyPem = privateKeyPem;
    this.certBase64    = certBase64;
  }

  /**
   * Assina um XML de evento eSocial.
   * @param {string} xml      - XML do evento (sem assinatura)
   * @param {string} eventId  - Valor do atributo Id do elemento raiz do evento
   * @returns {string}        - XML assinado
   */
  sign(xml, eventId) {
    const sig = new xmlCrypto.SignedXml({ idAttribute: 'Id' });

    // Referência ao elemento com o Id do evento
    sig.addReference(
      `//*[@Id='${eventId}']`,
      [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      ],
      'http://www.w3.org/2001/04/xmlenc#sha256',
      '',    // digestValue (preenchido automaticamente)
      '',    // transforms
      '',    // uri
      false  // isEmptyUri
    );

    sig.signingKey             = this.privateKeyPem;
    sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
    sig.signatureAlgorithm     = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';

    const certBase64 = this.certBase64;
    sig.keyInfoProvider = {
      getKeyInfo() {
        return `<X509Data><X509Certificate>${certBase64}</X509Certificate></X509Data>`;
      },
    };

    sig.computeSignature(xml, {
      prefix: 'ds',
      location: {
        reference : `//*[@Id='${eventId}']`,
        action    : 'append',
      },
    });

    return sig.getSignedXml();
  }
}

module.exports = { EsocialXmlSigner };
