const test = require('tape')
const container = require('../container')
const ram = require('random-access-memory')
const admin = require('../container/definitions/cores/admin')
const messagestream = require('../container/definitions/cores/messages')
const debug = require('../utils/debug')(__filename)

const test_definition = {
  id: 'basic_test',
  name: 'Basic test definition',
  version: 1,
  // one-to-one = expect cores from two users, one for me and one for you
  // one-to-non = expect cores only from me
  // one-to-many = expect cores from anybody but allow me to choose
  // many-to-many = everybody can add their cores freely
  model: 'one-to-many',
  accepted_cores: [ admin, messagestream ],
}

test('no cores', function(t) {
  const hv = container({ password: 'testpassword' }, { storage: ram, definition: test_definition })
  hv.ready((err) => {
    t.error(err, 'no errors')
    debug(hv)
    hv.cores((err, cores) => {
      t.error(err, 'no errors')
      t.deepEquals(cores, [], 'hv has no cores')
      t.end()
    })
  })
})

test('create core', function(t) {
  t.plan(6)

  const hv = container({ password: 'testpassword' }, { storage: ram, definition: test_definition })
  hv.ready((err) => {
    t.error(err, 'no errors')
    hv.add_core('test', 'text', function(err, core) {
      t.error(err, 'no errors')
      core.append('foo', function(err) {
        t.error(err, 'no errors')
        core.get(0, function(err, data) {
          t.error(err, 'no errors')
          t.equals(data.toString(), 'foo', 'core contains stored string')
          hv.cores((err, cores) => {
            t.error(err, 'no errors')
            t.deepEquals(cores, [ core ], 'core is correctly found in the cores')
          })
        })
      })
    })
  })
})

test('get core by key', function(t) {
  t.plan(3)

  const hv = container({ password: 'testpassword' }, { storage: ram, definition: test_definition })
  hv.ready((err) => {
    t.error(err, 'no errors')
    hv.add_core('test', 'text', function(err, core) {
      t.error(err, 'no errors')
      const core_reference = hv.core(core.key)
      t.deepEquals(core_reference, core, 'core is the same as retrieved core (buffer key)')
      core = hv.core(core.key.toString('hex'))
      t.deepEquals(core_reference, core, 'core is the same as retrieved core (hex key)')
    })
  })
})

test('get localcore by name', function(t) {
  t.plan(3)

  const hv = container({ password: 'testpassword' }, { storage: ram, definition: test_definition })
  hv.ready((err) => {
    t.error(err, 'no errors')
    hv.add_core('bob', 'text', function(err, w) {
      t.error(err, 'no errors')
      hv.open_core('bob', function(err, w2) {
        t.error(err, 'valid core retrieved')
        t.deepEquals(w2, w, 'core is the same as retrieved core')
      })
    })
  })
})
