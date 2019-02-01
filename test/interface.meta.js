const test = require('tape')
const ram = require('random-access-memory')
const { error } = require('../utils')
const { kv } = require('../core/interfaces/kv')
const { meta } = require('../core/interfaces/meta')
const { create } = require('../core')
const definitions = require('../definitions/cores')

test('interface/meta', async (t) => {
  const core = await create({ definition: definitions.Meta, storage: ram }).catch(error)

  // Add key/value interface (required for )
  await core.addInterface(kv).catch(error)
  t.equal(typeof core.kv.set, 'function', 'kv.set method found')

  // Add meta core interface
  await core.addInterface(meta).catch(error)
  t.equal(typeof core.meta.add_core, 'function', 'meta.add_core method found')

  // create new meta-core
  

  t.end()
})
