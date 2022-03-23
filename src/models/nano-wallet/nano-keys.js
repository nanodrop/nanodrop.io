const { blake2b, blake2bFinal, blake2bInit, blake2bUpdate } = require('blakejs')

const nacl = require('./utils/nacl.js')

const crypto = require("crypto")
const BigNumber = require('bignumber.js');

const { encodeNanoBase32, decodeNanoBase32 } = require('./utils/nano-base32.js')
const { checkKey, checkString, checkIndex, compareArrays } = require('./check.js')

const STATE_BLOCK_PREAMBLE_BYTES = new Uint8Array(32)
STATE_BLOCK_PREAMBLE_BYTES[31] = 6
const TunedBigNumber = BigNumber.clone({ EXPONENTIAL_AT: 1e9 })

function signBlock(hash, secretKey)  {
  const blockHashBytes = hexToByteArray(hash)
  const secretKeyBytes = hexToByteArray(secretKey)
  const signatureBytes = nacl.sign.detached(blockHashBytes, secretKeyBytes)
  return byteArrayToHex(signatureBytes)
}

function verifySignature(hash, signature, publicKey)  {
  const blockHashBytes = hexToByteArray(hash)
  const signatureBytes = hexToByteArray(signature)
  const publicKeyBytes = hexToByteArray(publicKey)
  return nacl.sign.detached.verify(blockHashBytes, signatureBytes, publicKeyBytes )
}

function deriveAddress(publicKey, prefix = "nano_") {
  if (!checkKey(publicKey)) throw new Error('Public key is not valid')
  const publicKeyBytes = hexToByteArray(publicKey)
  const paddedPublicKeyBytes = hexToByteArray(publicKey)
  const encodedPublicKey = encodeNanoBase32(paddedPublicKeyBytes)
  const checksum = blake2b(publicKeyBytes, null, 5).reverse()
  const encodedChecksum = encodeNanoBase32(checksum)
  return prefix + encodedPublicKey + encodedChecksum
}

function parseNanoAddress(address) {
  const invalid = { valid: false, publicKey: null, publicKeyBytes: null }
  if (!checkString(address) || !/^(xrb_|nano_)[13][13-9a-km-uw-z]{59}$/.test(address)) {
    return invalid
  }
  let prefixLength = address.indexOf('_') + 1
  const publicKeyBytes = decodeNanoBase32(address.substr(prefixLength, 52))
  const publicKey = byteArrayToHex(publicKeyBytes)
  const checksumBytes = decodeNanoBase32(address.substr(-8))
  const computedChecksumBytes = blake2b(publicKeyBytes, null, 5).reverse()
  const valid = compareArrays(checksumBytes, computedChecksumBytes)
  if (!valid) return invalid
  const checksum = byteArrayToHex(computedChecksumBytes)
  return {
    publicKeyBytes,
    publicKey,
    checksum,
    valid: true
  }
}

function deriveSecretKey(seed, index) {

  const seedBytes = hexToByteArray(seed)
  const indexBuffer = new ArrayBuffer(4)
  const indexView = new DataView(indexBuffer)
  indexView.setUint32(0, index)
  const indexBytes = new Uint8Array(indexBuffer)

  const context = blake2bInit(32)
  blake2bUpdate(context, seedBytes)
  blake2bUpdate(context, indexBytes)
  const secretKeyBytes = blake2bFinal(context)

  return byteArrayToHex(secretKeyBytes)
}


function derivePublicKey(secret) {
  if (checkKey(secret)) {
    const uint_key_pair = nacl.sign.keyPair.fromSecretKey(hexToByteArray(secret))
    return byteArrayToHex(uint_key_pair.publicKey)
  }
}

function deriveKeyPair(seed, index) {
  if (checkKey(seed) && checkIndex(index)) {
    const private_key = deriveSecretKey(seed, index)
    const public_key = derivePublicKey(private_key)
    const address = deriveAddress(public_key)
    return { privateKey: private_key, publicKey: public_key, address: address }
  }
}


function createRandomSeed() {
  const random_seed = crypto.randomBytes(32)
  return byteArrayToHex(random_seed)
}

function blakeChecksum(hash){
  return byteArrayToHex(blake2b(hexToByteArray(hash), null, 5).reverse())
}

function rawsToHex(raws) {
  return TunedBigNumber(raws).toString(16).padStart(32, '0')
}

function hexToRaws(hex){
  return TunedBigNumber(`0x${hex}`).toString(10)
}

function hexToByteArray(hex) {
  let bytes = []
  for (let c = 0; c < hex.length; c += 2)
    bytes.push(parseInt(hex.substr(c, 2), 16));
  return new Uint8Array(bytes);
}

function byteArrayToHex(bytes) {
  let hex = []
  for (let i = 0; i < bytes.length; i++) {
    let current = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    hex.push((current >>> 4).toString(16));
    hex.push((current & 0xF).toString(16));
  }
  return hex.join("").toUpperCase();
}

module.exports = {
  createRandomSeed,
  parseNanoAddress,
  deriveKeyPair,
  deriveAddress,
  derivePublicKey,
  signBlock,
  verifySignature,
  hexToByteArray,
  byteArrayToHex,
  rawsToHex,
  hexToRaws,
  blakeChecksum
}

