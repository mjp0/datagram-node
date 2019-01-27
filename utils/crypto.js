const sodium = require('sodium-universal')

const CONTEXT = Buffer.from('datagramv1') // dappdb v1

exports.blake2b = function(str) {
  const digest = Buffer.alloc(32)
  sodium.crypto_generichash(digest, Buffer.from(str))
  return digest
}

exports.deriveKeyPair = function(master_key) {
  const seed = Buffer.alloc(sodium.crypto_sign_SEEDBYTES)
  const keyPair = {
    publicKey: Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES),
    secretKey: Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES),
  }

  const secretKey = exports.blake2b(master_key)
  sodium.crypto_kdf_derive_from_key(seed, 1, CONTEXT, secretKey)
  sodium.crypto_sign_seed_keypair(keyPair.publicKey, keyPair.secretKey, seed)
  seed.fill(0)

  return keyPair
}
