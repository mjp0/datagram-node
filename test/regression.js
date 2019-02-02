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

test('regression: adapter with no core replicate to adapter with 1 core', function(done) {
  const m1 = adapter({ password: 'testpassword', definition: test_definition }, { storage: ram })
  const m2 = adapter({ password: 'testpassword', definition: test_definition }, { storage: ram })

  function setup1(m, buf, cb) {
    m.add_core('test', 'generic', function(err, w) {
      expect(err).toBeFalsy()
      const bufs = []
      for (let i = 0; i < 1000; i++) {
        bufs.push(buf)
      }
      w.append(bufs, function(err) {
        expect(err).toBeFalsy()
        w.get(13, function(err, data) {
          expect(err).toBeFalsy()
          expect(data.toString()).toBe(buf)
          m.get_cores((err, cores) => {
            expect(err).toBeFalsy()
            expect(cores).toEqual([ w ])
            cb()
          })
        })
      })
    })
  }

  function setup2(m, buf, cb) {
    m.add_core('test', 'generic', function(err, w) {
      expect(err).toBeFalsy()
      const bufs = []
      for (let i = 0; i < 10; i++) {
        bufs.push(buf)
      }
      w.append(bufs, function(err) {
        expect(err).toBeFalsy()
        w.get(3, function(err, data) {
          expect(err).toBeFalsy()
          expect(data.toString()).toBe(buf)
          m.get_cores((err, cores) => {
            expect(err).toBeFalsy()
            expect(cores).toEqual([ w ])
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
      expect(err).toBeFalsy()
      m2.get_cores((err, cores2) => {
        expect(err).toBeFalsy()
        expect(cores1.length).toBe(2)
        expect(cores2.length).toBe(2)
        expect(cores1[0].length).toBe(1000)
        expect(cores1[1].length).toBe(10)
        expect(cores2[0].length).toBe(10)
        expect(cores2[1].length).toBe(1000)
        cores1[1].get(0, function(err, data) {
          expect(err).toBeFalsy()
          expect(data.toString()).toBe('bar')
          cores2[1].get(0, function(err, data) {
            expect(err).toBeFalsy()
            expect(data.toString()).toBe('foo')
            done()
          })
        })
      })
    })
  }
})
