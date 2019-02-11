const fs = require('fs')
const path = require('path')

const definition_registry = {}

const definitions = fs.readdirSync(path.join(__dirname, 'installed'))

definitions.forEach((s) => {
  const fpath = path.join(__dirname, 'installed', s)
  if (fpath.match('.json')) {
    const definition = require(fpath)
    definition_registry[definition['@id']] = definition
  }
})

module.exports = definition_registry
