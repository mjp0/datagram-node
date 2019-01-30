const test = require('tape')
const adapter = require('../adapter')
const ram = require('random-access-memory')
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
  accepted_cores: [ admin, messagestream ],
}

test('regression: adapter with no core replicate to adapter with 1 core', function(t) {
  const m1 = adapter({ password: 'testpassword', definition: test_definition }, { storage: ram })
  const m2 = adapter({ password: 'testpassword', definition: test_definition }, { storage: ram })

  function setup1(m, buf, cb) {
    m.add_core('test', 'generic', function(err, w) {
      t.error(err, 'no errors')
      const bufs = []
      for (let i = 0; i < 1000; i++) {
        bufs.push(buf)
      }
      w.append(bufs, function(err) {
        t.error(err, 'no errors')
        w.get(13, function(err, data) {
          t.error(err, 'no errors')
          t.equals(data.toString(), buf)
          m.get_cores((err, cores) => {
            t.error(err, 'no errors')
            t.deepEquals(cores, [ w ], 'read matches write')
            cb()
          })
        })
      })
    })
  }

  function setup2(m, buf, cb) {
    m.add_core('test', 'generic', function(err, w) {
      t.error(err, 'no errors')
      const bufs = []
      for (let i = 0; i < 10; i++) {
        bufs.push(buf)
      }
      w.append(bufs, function(err) {
        t.error(err, 'no errors')
        w.get(3, function(err, data) {
          t.error(err, 'no errors')
          t.equals(data.toString(), buf)
          m.get_cores((err, cores) => {
            t.error(err, 'no errors')
            t.deepEquals(cores, [ w ], 'read matches write')
            cb()
          })
        })
      })
    })
  }

  m1.ready(() => {
    m2.ready(() => {
      setup1(m1, 'foo', function() {
        setup2(m2, 'bar', function() {
          const r = m1.replicate()
          r.once('end', done)
          const s = m2.replicate()
          s.once('end', done)
          r.pipe(s).pipe(r)

          let pending = 2
          function done() {
            if (!--pending) check()
          }
        })
      })
    })
  })

  function check() {
    m1.get_cores((err, cores1) => {
      t.error(err, 'no errors')
      m2.get_cores((err, cores2) => {
        t.error(err, 'no errors')
        t.equals(cores1.length, 2, '2 cores')
        t.equals(cores2.length, 2, '2 cores')
        t.equals(cores1[0].length, 1000, 'core sees 1000 entries')
        t.equals(cores1[1].length, 10, 'core sees 10 entries')
        t.equals(cores2[0].length, 10, 'receiver sees 10 entries')
        t.equals(cores2[1].length, 1000, 'receiver sees 1000 entries')
        cores1[1].get(0, function(err, data) {
          t.error(err, 'no errors')
          t.equals(data.toString(), 'bar', 'core 1 has core 2 data')
          cores2[1].get(0, function(err, data) {
            t.error(err, 'no errors')
            t.equals(data.toString(), 'foo', 'core 2 has core 1 data')
            t.end()
          })
        })
      })
    })
  }
})
