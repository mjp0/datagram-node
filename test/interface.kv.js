const test = require('tape')
const ram = require('random-access-memory')
const { error } = require('../utils')
const { kv } = require('../core/interfaces')
const { create } = require('../core')
const definitions = require('../definitions/cores')

test('interface/kv', async (t) => {
  const core = await create({ definition: definitions.Admin, storage: ram }).catch(error)

  // Add key/value interface
  await core.addInterface(kv).catch(error)
  t.equal(typeof core.kv.set, 'function', 'kv.set method found')

  // Add foo=bar
  const pos = await core.kv.set('foo', 'bar').catch(error)
  t.equal(pos, 1, 'key should be stored at position 1')

  // Verify foo === bar
  const foo = await core.kv.get('foo').catch(error)
  t.equal(foo, 'bar', 'foo is bar')

  // Verify foo exists in all keys
  const all_keys = await core.kv.get_all_keys().catch(error)
  t.equal(all_keys[0], 'foo', 'should have previous saved key')

  // Remove foo
  await core.kv.rem('foo').catch(error)

  // Verify foo is gone
  const non_foo = await core.kv.get('foo').catch(error)
  t.false(non_foo, 'foo is removed')

  // Verify all keys is empty
  const empty_all_keys = await core.kv.get_all_keys().catch(error)
  t.equal(empty_all_keys.length, 0, 'keys should be empty')

  t.end()
})
