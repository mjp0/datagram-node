const ram = require('random-access-memory')
const { error } = require('../utils')
const { getInterface } = require('../core/interfaces')
const { create } = require('../core')
const definitions = require('../definitions/cores')

test('interface/kv', async () => {
  const core = await create({ definition: definitions.Admin, storage: ram }).catch(error)

  // Add key/value interface
  const kv = await getInterface('kv')
  await core.addInterface(kv).catch(error)
  expect(typeof core.kv.set).toBe('function')

  // Add foo=bar
  const pos = await core.kv.set('foo', 'bar').catch(error)
  expect(pos).toBe(1)

  // Verify foo === bar
  const foo = await core.kv.get('foo').catch(error)
  expect(foo).toBe('bar')

  // Verify foo exists in all keys
  const all_keys = await core.kv.get_all_keys().catch(error)
  expect(all_keys[0]).toBe('foo')

  // Remove foo
  await core.kv.rem('foo').catch(error)

  // Verify foo is gone
  const non_foo = await core.kv.get('foo').catch(error)
  expect(non_foo).toBeFalsy()

  // Verify all keys is empty
  const empty_all_keys = await core.kv.get_all_keys().catch(error)
  expect(empty_all_keys.length).toBe(0)
})
