const bs58check = require('bs58check')

exports.toB58 = (buf) => {
  return bs58check.encode(buf)
}

exports.fromB58 = (b58) => {
  return bs58check.decode(b58)
}