const crypto = require('crypto');

const GENESIS = '0'.repeat(64);
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Comprobante: SHA256 de un nonce aleatorio + datos del voto. Es imposible de adivinar
// o de enlazar con el votante, porque no incluye ningún dato de identidad.
function makeReceipt(electionId, candidateId) {
  const nonce = crypto.randomBytes(16).toString('hex');
  return sha256(`${nonce}|${electionId}|${candidateId}|${Date.now()}`);
}

// Cada voto se encadena con el anterior: alterar un voto rompe toda la cadena posterior.
const chainHash = (prevHash, receiptHash, electionId, candidateId) =>
  sha256(`${prevHash}|${receiptHash}|${electionId}|${candidateId}`);

module.exports = { GENESIS, sha256, makeReceipt, chainHash };
