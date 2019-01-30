const test = require('tape')
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

test('replicate two adapters', function(t) {
  t.plan(22)

  function setup(m, buf, cb) {
    m.add_core('test', 'text', function(err, core) {
      t.error(err, 'no errors')
      core.append(buf, function(err) {
        t.error(err, 'no errors')
        core.get(0, function(err, data) {
          t.error(err, 'no errors')
          t.equals(data.toString(), buf, 'saved data should exist')
          m.cores((err, cores) => {
            t.error(err, 'no errors')
            t.notEquals(cores.indexOf(core), -1, 'core is correctly found in the cores')
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
          t.error(err, 'no errors')
          t.equals(cores.length, 2, 'should have two cores')

          m2.cores((err, cores) => {
            t.error(err, 'no errors')
            t.equals(cores.length, 2, 'should have two cores')
            next()
          })
        })
      },
      (next) => {
        m1.get_cores((err, cores) => {
          t.error(err, 'no errors')
          cores[1].get(0, function(err, data) {
            t.error(err, 'no errors')
            t.equals(data.toString(), 'bar', 'should have replicated content')
            next()
          })
        })
      },
      (next) => {
        m2.get_cores((err, cores) => {
          t.error(err, 'no errors')
          cores[1].get(0, function(err, data) {
            t.error(err, 'no errors')
            t.equals(data.toString(), 'foo', 'should have replicated content')
            next()
          })
        })
      },
    ])
  }
})

test('replicate two live adapters', function(t) {
  t.plan(22)

  let m2

  function setup(m, buf, cb) {
    m.add_core('test', 'text', function(err, core) {
      t.error(err, 'no errors')
      core.append(buf, function(err) {
        t.error(err, 'no errors')
        core.get(0, function(err, data) {
          t.error(err, 'no errors')
          t.equals(data.toString(), buf, 'saved data should exist')
          m.cores((err, cores) => {
            t.error(err, 'no errors')
            t.deepEquals(cores, [ core ], 'core is correctly found in the cores')
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
          t.error(err, 'no errors')
          t.equals(cores.length, 2, 'should have two cores')

          m2.cores((err, cores) => {
            t.error(err, 'no errors')
            t.equals(cores.length, 2, 'should have two cores')
            next()
          })
        })
      },
      (next) => {
        m1.get_cores((err, cores) => {
          t.error(err, 'no errors')
          cores[1].get(0, function(err, data) {
            t.error(err, 'no errors')
            t.equals(data.toString(), 'bar', 'should have replicated content')
            next()
          })
        })
      },
      (next) => {
        m2.get_cores((err, cores) => {
          t.error(err, 'no errors')
          cores[1].get(0, function(err, data) {
            t.error(err, 'no errors')
            t.equals(data.toString(), 'foo', 'should have replicated content')
            next()
          })
        })
      },
    ])
  }
})

test('replicate two adapters and remove a core', function(t) {
  t.plan(35)

  const core_keys = {}

  function setup(m, buf, cb) {
    m.add_core(buf.toString(), 'text', function(err, core) {
      t.error(err, 'no errors')
      core.append(buf, function(err) {
        t.error(err, 'no errors')
        core.get(0, function(err, data) {
          t.error(err, 'no errors')
          t.equals(data.toString(), buf, 'saved data should exist')
          m.cores((err, cores) => {
            t.error(err, 'no errors')

            t.notEqual(cores.indexOf(core), -1, 'core is correctly found in the cores')
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
          t.error(err, 'no errors')
          t.equals(cores.length, 3, 'should have three cores')

          m2.cores((err, cores) => {
            t.error(err, 'no errors')
            t.equals(cores.length, 3, 'should have three cores')
            next()
          })
        })
      },
      (next) => {
        m1.get_cores((err, cores) => {
          t.error(err, 'no errors')
          cores[1].get(0, function(err, data) {
            t.error(err, 'no errors')
            if (data.toString() === 'zzz' || data.toString() === 'bar') {
              t.true(1, 'should have replicated content')
            }

            cores[2].get(0, function(err, data) {
              t.error(err, 'no errors')
              if (data.toString() === 'zzz' || data.toString() === 'bar') {
                t.true(1, 'should have replicated content')
              }
              next()
            })
          })
        })
      },
      (next) => {
        m2.get_cores((err, cores) => {
          t.error(err, 'no errors')
          cores[1].get(0, function(err, data) {
            t.error(err, 'no errors')
            if (data.toString() === 'zzz' || data.toString() === 'bar' || data.toString() === 'foo') {
              t.true(1, 'should have replicated content')
            }
            next()
          })
        })
      },
      (next) => {
        m1.remove_core(core_keys['zzz'], (err, core) => {
          t.error(err, 'no errors')
          const r = m1.replicate()
          r.pipe(m2.replicate()).pipe(r).once('end', next)
        })
      },
      (next) => {
        m1.get_blocklist((err, blocklist) => {
          t.error(err, 'no errors')
          t.notEquals(blocklist.indexOf(core_keys['zzz']), -1, 'zzz core should be on blocklist')

          m1.get_cores((err, cores) => {
            t.error(err, 'no errors')
            t.equals(cores.indexOf(core_keys['zzz']), -1, 'zzz core should not be in meta-core anymore')
            next()
          })
        })
      },
    ])
  }
})
