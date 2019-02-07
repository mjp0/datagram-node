const sodium = require('sodium-universal')

const CONTEXT = Buffer.from('datagramv1') // dappdb v1

exports.blake2b = function(str) {
  const digest = Buffer.alloc(32)
  sodium.crypto_generichash(digest, Buffer.from(str))
  return digest
}

exports.deriveKeyPairSync = (master_key) => {
  const seed = Buffer.alloc(sodium.crypto_sign_SEEDBYTES)
  const key_pair = {
    publicKey: Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES),
    secretKey: Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES),
  }

  const secret_key = exports.blake2b(master_key)
  sodium.crypto_kdf_derive_from_key(seed, 1, CONTEXT, secret_key)
  sodium.crypto_sign_seed_keypair(key_pair.publicKey, key_pair.secretKey, seed)
  seed.fill(0)

  const keys = {
    key: key_pair.publicKey,
    secret: key_pair.secretKey,
  }

  return keys
}

exports.createKeyPairSync = () => {
  const key_pair = {
    publicKey: Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES),
    secretKey: Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES),
  }

  sodium.crypto_sign_keypair(key_pair.publicKey, key_pair.secretKey)

  const keys = {
    key: key_pair.publicKey,
    secret: key_pair.secretKey,
  }

  return keys
}

exports.generatePasswordSync = (len = 32) => {
  const password = Buffer.alloc(len + 10)
  sodium.randombytes_buf(password)
  return password.slice(0, len)
}
