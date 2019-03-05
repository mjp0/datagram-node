const bs58check = require('bs58check')

exports.toB58 = (value = null) => {
  if(!value) throw new Error('NULL_VALUE')
  const input = Buffer.isBuffer(value) ? value : Buffer.from(value, 'hex') 
  return bs58check.encode(input)
}

exports.fromB58 = (b58 = null) => {
  return bs58check.decode(b58)
}
