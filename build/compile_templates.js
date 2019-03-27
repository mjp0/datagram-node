const fs = require('fs-extra')
const path = require('path')

// Add installed templates
const installed_templates = fs.readdirSync(path.join(__dirname, '/../src/templates/streams/installed'))

// TODO: Refactor this code not to depend fs
const unloaded_templates = []
installed_templates.forEach((s) => {
  const fpath = path.join(__dirname, '/../src/templates/streams/installed/', s)
  if (fpath.match('.json')) {
    unloaded_templates.push(fpath)
  }
})
let template_registry = {}
unloaded_templates.forEach((fpath) => {
  const template = require(fpath)
  template_registry[template['@id']] = template
})

fs.writeFileSync(path.join(__dirname, '/../src/templates/streams/templates.json'), JSON.stringify(template_registry))
