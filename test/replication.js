const test = require('tape')
const hypervisor = require('../hypervisor')
const ram = require('random-access-memory')
const async = require('async')

test('replicate two hypervisors', function(t) {
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
            t.deepEquals(cores, [ core ], 'core is correctly found in the cores')
            cb()
          })
        })
      })
    })
  }

  const m1 = hypervisor(ram, 'test')
  const m2 = hypervisor(ram, 'test')
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

test('replicate two live hypervisors', function(t) {
  t.plan(22)

  let m1
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

  m1 = hypervisor(ram, 'test')
  m1.ready(() => {
    m2 = hypervisor(ram, 'test')
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
