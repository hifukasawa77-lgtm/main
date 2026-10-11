/* AES-GCM authenticated encryption. Passwords and keys are never stored. */
(function (root) {
  'use strict';
  var FORMAT = 'receipt-vault-v1', ITERATIONS = 600000;
  function encode(bytes) { var str = ''; bytes.forEach(function (b) { str += String.fromCharCode(b); }); return btoa(str); }
  function decode(text) {
    if (typeof text !== 'string' || text.length > 45000000) throw new Error('Invalid encrypted file');
    return Uint8Array.from(atob(text), function (c) { return c.charCodeAt(0); });
  }
  function validate(envelope) {
    if (!envelope || envelope.format !== FORMAT || envelope.iterations !== ITERATIONS) throw new Error('Unsupported encrypted file');
    if (decode(envelope.salt).length !== 16 || decode(envelope.iv).length !== 12 || decode(envelope.data).length < 16) throw new Error('Invalid encrypted file');
  }
  async function derive(password, salt) {
    var material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: ITERATIONS }, material,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function seal(state, key, salt) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, additionalData: new TextEncoder().encode(FORMAT) }, key, new TextEncoder().encode(JSON.stringify(state)));
    return { format: FORMAT, iterations: ITERATIONS, salt: encode(salt), iv: encode(iv), data: encode(new Uint8Array(data)) };
  }
  async function unlock(envelope, password) {
    validate(envelope);
    var salt = decode(envelope.salt), key = await derive(password, salt);
    var plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(envelope.iv), additionalData: new TextEncoder().encode(FORMAT) }, key, decode(envelope.data));
    var state = JSON.parse(new TextDecoder().decode(plain));
    if (!state || state.app !== 'receipt-ocr-ledger' || state.version !== 2 || !state.values || typeof state.values !== 'object' || Array.isArray(state.values)) throw new Error('Invalid vault contents');
    return { key: key, salt: salt, state: state };
  }
  root.ReceiptCrypto = Object.freeze({ FORMAT: FORMAT, derive: derive, seal: seal, unlock: unlock, validate: validate });
})(globalThis);
