const fs = require('fs')
const path = require('path')

const template_registry = {}

const templates = fs.readdirSync(path.join(__dirname, 'installed'))

templates.forEach((s) => {
  const fpath = path.join(__dirname, 'installed', s)
  if (fpath.match('.json')) {
    const template = require(fpath)
    template_registry[template['@id']] = template
  }
})

module.exports = template_registry
