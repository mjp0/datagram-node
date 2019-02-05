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

test('no cores', function(done) {
  const hv = container({ password: 'testpassword' }, { storage: ram, definition: test_definition })
  hv.ready((err) => {
    expect(err).toBeFalsy()
    debug(hv)
    hv.cores((err, cores) => {
      expect(err).toBeFalsy()
      expect(cores).toEqual([])
      done()
    })
  })
})

test('create core', function() {
  expect.assertions(6)

  const hv = container({ password: 'testpassword' }, { storage: ram, definition: test_definition })
  hv.ready((err) => {
    expect(err).toBeFalsy()
    hv.add_core('test', 'text', function(err, core) {
      expect(err).toBeFalsy()
      core.append('foo', function(err) {
        expect(err).toBeFalsy()
        core.get(0, function(err, data) {
          expect(err).toBeFalsy()
          expect(data.toString()).toBe('foo')
          hv.cores((err, cores) => {
            expect(err).toBeFalsy()
            expect(cores).toEqual([ core ])
          })
        })
      })
    })
  })
})

test('get core by key', function() {
  expect.assertions(3)

  const hv = container({ password: 'testpassword' }, { storage: ram, definition: test_definition })
  hv.ready((err) => {
    expect(err).toBeFalsy()
    hv.add_core('test', 'text', function(err, core) {
      expect(err).toBeFalsy()
      const core_reference = hv.core(core.key)
      expect(core_reference).toEqual(core)
      core = hv.core(core.key.toString('hex'))
      expect(core_reference).toEqual(core)
    })
  })
})

test('get localcore by name', function() {
  expect.assertions(3)

  const hv = container({ password: 'testpassword' }, { storage: ram, definition: test_definition })
  hv.ready((err) => {
    expect(err).toBeFalsy()
    hv.add_core('bob', 'text', function(err, w) {
      expect(err).toBeFalsy()
      hv.open_core('bob', function(err, w2) {
        expect(err).toBeFalsy()
        expect(w2).toEqual(w)
      })
    })
  })
})
