const fs = require('fs-extra')
const path = require('path')

// Add installed descriptors
const installed_descriptors = fs.readdirSync(path.join(__dirname, '/../src/descriptors/installed'))

// TODO: Refactor this code not to depend fs
const unloaded_descriptors = []
installed_descriptors.forEach((s) => {
  const fpath = path.join(__dirname, '/../src/descriptors/installed/', s)
  if (fpath.match('.json')) {
    unloaded_descriptors.push(fpath)
  }
})
let descriptor_registry = {}
unloaded_descriptors.forEach((fpath) => {
  const descriptor = require(fpath)
  descriptor_registry[descriptor.context['@id']] = descriptor
})

fs.writeFileSync(path.join(__dirname, '/../src/descriptors/descriptors.json'), JSON.stringify(descriptor_registry))
