const bs58check = require('bs58check')

exports.toB58 = (value = null) => {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(value)
  return bs58check.encode(Buffer.from(input))
}

exports.fromB58 = (b58 = null) => {
  return bs58check.decode(b58)
}
