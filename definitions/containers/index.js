const fs = require('fs')
const path = require('path')

const definition_registry = {}

const definitions = fs.readdirSync(path.join(__dirname, 'installed'))

definitions.forEach((s) => {
  const file = fs.readFileSync(path.join(__dirname, 'installed', s), 'UTF-8')

  try {
    const definition = JSON.parse(file)
    definition_registry[definition['@id']] = definition
  } catch (e) {
    throw new Error(e)
  }
})

module.exports = definition_registry
