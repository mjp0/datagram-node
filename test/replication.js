const adapter = require('../adapter')
const ram = require('random-access-memory')
const async = require('async')
const admin = require('../adapter/definitions/cores/admin')
const messagestream = require('../adapter/definitions/cores/messages')

const test_definition = {
  id: 'basic_test',
  name: 'Basic test definition',
  version: 1,
  // one-to-one = expect cores from two users, one for me and one for you
  // one-to-non = expect cores only from me
  // one-to-many = expect cores from anybody but allow me to choose
  // many-to-many = everybody can add their cores freely
  model: 'one-to-many',
  accepted_cores: [admin, messagestream],
}

test('replicate two adapters', function() {
  expect.assertions(22)

  function setup(m, buf, cb) {
    m.add_core('test', 'text', function(err, core) {
      expect(err).toBeFalsy()
      core.append(buf, function(err) {
        expect(err).toBeFalsy()
        core.get(0, function(err, data) {
          expect(err).toBeFalsy()
          expect(data.toString()).toBe(buf)
          m.cores((err, cores) => {
            expect(err).toBeFalsy()
            expect(cores.indexOf(core)).not.toBe(-1)
            cb()
          })
        })
      })
    })
  }

  const m1 = adapter({ password: 'testpassword', definition: test_definition }, { storage: ram })
  const m2 = adapter({ password: 'testpassword', definition: test_definition }, { storage: ram })
  m1.ready(() => {
    m2.ready(() => {
      setup(m1, 'foo', function() {
        setup(m2, 'bar', function() {
          const r = m1.replicate()
          r.pipe(m2.replicate()).pipe(r).once('end', check)
        })
      })
    })
  })

  function check() {
    async.waterfall([
      (next) => {
        m1.cores((err, cores) => {
          expect(err).toBeFalsy()
          expect(cores.length).toBe(2)

          m2.cores((err, cores) => {
            expect(err).toBeFalsy()
            expect(cores.length).toBe(2)
            next()
          })
        })
      },
      (next) => {
        m1.get_cores((err, cores) => {
          expect(err).toBeFalsy()
          cores[1].get(0, function(err, data) {
            expect(err).toBeFalsy()
            expect(data.toString()).toBe('bar')
            next()
          })
        })
      },
      (next) => {
        m2.get_cores((err, cores) => {
          expect(err).toBeFalsy()
          cores[1].get(0, function(err, data) {
            expect(err).toBeFalsy()
            expect(data.toString()).toBe('foo')
            next()
          })
        })
      },
    ])
  }
})

test('replicate two live adapters', function() {
  expect.assertions(22)

  let m2

  function setup(m, buf, cb) {
    m.add_core('test', 'text', function(err, core) {
      expect(err).toBeFalsy()
      core.append(buf, function(err) {
        expect(err).toBeFalsy()
        core.get(0, function(err, data) {
          expect(err).toBeFalsy()
          expect(data.toString()).toBe(buf)
          m.cores((err, cores) => {
            expect(err).toBeFalsy()
            expect(cores).toEqual([ core ])
            cb()
          })
        })
      })
    })
  }

  const m1 = adapter({ password: 'testpassword', definition: test_definition }, { storage: ram })
  m1.ready(() => {
    m2 = adapter({ password: 'testpassword', definition: test_definition }, { storage: ram })
    m2.ready(() => {
      setup(m1, 'foo', function() {
        setup(m2, 'bar', function() {
          const r = m1.replicate({ live: true })
          r.pipe(m2.replicate({ live: true })).pipe(r)
          setTimeout(check, 1000)
        })
      })
    })
  })

  function check() {
    async.waterfall([
      (next) => {
        m1.cores((err, cores) => {
          expect(err).toBeFalsy()
          expect(cores.length).toBe(2)

          m2.cores((err, cores) => {
            expect(err).toBeFalsy()
            expect(cores.length).toBe(2)
            next()
          })
        })
      },
      (next) => {
        m1.get_cores((err, cores) => {
          expect(err).toBeFalsy()
          cores[1].get(0, function(err, data) {
            expect(err).toBeFalsy()
            expect(data.toString()).toBe('bar')
            next()
          })
        })
      },
      (next) => {
        m2.get_cores((err, cores) => {
          expect(err).toBeFalsy()
          cores[1].get(0, function(err, data) {
            expect(err).toBeFalsy()
            expect(data.toString()).toBe('foo')
            next()
          })
        })
      },
    ])
  }
})

test('replicate two adapters and remove a core', function() {
  expect.assertions(35)

  const core_keys = {}

  function setup(m, buf, cb) {
    m.add_core(buf.toString(), 'text', function(err, core) {
      expect(err).toBeFalsy()
      core.append(buf, function(err) {
        expect(err).toBeFalsy()
        core.get(0, function(err, data) {
          expect(err).toBeFalsy()
          expect(data.toString()).toBe(buf)
          m.cores((err, cores) => {
            expect(err).toBeFalsy()

            expect(cores.indexOf(core)).not.toBe(-1)
            core_keys[buf.toString()] = core.key.toString('hex')
            cb()
          })
        })
      })
    })
  }

  const m1 = adapter({ password: 'testpassword', definition: test_definition }, { storage: ram })
  const m2 = adapter({ password: 'testpassword', definition: test_definition }, { storage: ram })
  m1.ready(() => {
    m2.ready(() => {
      setup(m1, 'foo', function() {
        setup(m2, 'bar', function() {
          setup(m2, 'zzz', function() {
            const r = m1.replicate()
            r.pipe(m2.replicate()).pipe(r).once('end', check)
          })
        })
      })
    })
  })

  function check() {
    async.waterfall([
      (next) => {
        m1.cores((err, cores) => {
          expect(err).toBeFalsy()
          expect(cores.length).toBe(3)

          m2.cores((err, cores) => {
            expect(err).toBeFalsy()
            expect(cores.length).toBe(3)
            next()
          })
        })
      },
      (next) => {
        m1.get_cores((err, cores) => {
          expect(err).toBeFalsy()
          cores[1].get(0, function(err, data) {
            expect(err).toBeFalsy()
            if (data.toString() === 'zzz' || data.toString() === 'bar') {
              expect(1).toBeTruthy()
            }

            cores[2].get(0, function(err, data) {
              expect(err).toBeFalsy()
              if (data.toString() === 'zzz' || data.toString() === 'bar') {
                expect(1).toBeTruthy()
              }
              next()
            })
          })
        })
      },
      (next) => {
        m2.get_cores((err, cores) => {
          expect(err).toBeFalsy()
          cores[1].get(0, function(err, data) {
            expect(err).toBeFalsy()
            if (data.toString() === 'zzz' || data.toString() === 'bar' || data.toString() === 'foo') {
              expect(1).toBeTruthy()
            }
            next()
          })
        })
      },
      (next) => {
        m1.remove_core(core_keys['zzz'], (err, core) => {
          expect(err).toBeFalsy()
          const r = m1.replicate()
          r.pipe(m2.replicate()).pipe(r).once('end', next)
        })
      },
      (next) => {
        m1.get_blocklist((err, blocklist) => {
          expect(err).toBeFalsy()
          expect(blocklist.indexOf(core_keys['zzz'])).not.toBe(-1)

          m1.get_cores((err, cores) => {
            expect(err).toBeFalsy()
            expect(cores.indexOf(core_keys['zzz'])).toBe(-1)
            next()
          })
        })
      },
    ])
  }
})
