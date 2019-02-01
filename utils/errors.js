function error(err, meta) {
  console.log(meta)
  throw err
}
module.exports = { error }
