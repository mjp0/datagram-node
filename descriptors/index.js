const fs = require('fs')
const path = require('path')

const schema_registry = {}

const schemas = fs.readdirSync(path.join(__dirname, 'installed'))

schemas.forEach((s) => {
  const file = fs.readFileSync(path.join(__dirname, 'installed', s), 'UTF-8')

  try {
    const schema = JSON.parse(file)
    schema_registry[schema['@id']] = schema
  } catch (e) {
    throw new Error(e)
  }
})

module.exports = schema_registry
