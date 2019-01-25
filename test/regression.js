var test = require('tape')
var hypercore = require('hypercore')
var hypervisor = require('../hypervisor')
var ram = require('random-access-memory')
var tmp = require('tmp').tmpNameSync
const debug = require('../utils/debug')(__filename, "test")

test('regression: concurrency of core creation', function (t) {
  t.plan(3)

  var storage = tmp()
  var key

  var hv = hypervisor(storage)

  hv.add_core('minuette', function (err, w) {
    t.error(err)
    t.ok(w.key)
    key = w.key
  })

  hv.ready(function () {
    t.equals(hv.cores().length, 0)
  })
})

test('regression: MF with no core replicate to MF with 1 core', function (t) {
  var m1 = hypervisor(ram)
  var m2 = hypervisor(ram)

  function setup1 (m, buf, cb) {
    m.add_core(function (err, w) {
      t.error(err)
      var bufs = []
      for(var i=0; i < 1000; i++) {
        bufs.push(buf)
      }
      w.append(bufs, function (err) {
        t.error(err)
        w.get(13, function (err, data) {
          t.error(err)
          t.equals(data.toString(), buf)
          t.deepEquals(m.cores(), [w], 'read matches write')
          cb()
        })
      })
    })
  }

  function setup2 (m, buf, cb) {
    m.add_core(function (err, w) {
      t.error(err)
      var bufs = []
      for(var i=0; i < 10; i++) {
        bufs.push(buf)
      }
      w.append(bufs, function (err) {
        t.error(err)
        w.get(3, function (err, data) {
          t.error(err)
          t.equals(data.toString(), buf)
          t.deepEquals(m.cores(), [w], 'read matches write')
          cb()
        })
      })
    })
    //cb()
    //m.add_core(function (err, w) {
    //  t.error(err)
    //  cb()
    //})
  }

  setup1(m1, 'foo', function () {
    setup2(m2, 'bar', function () {
      var r = m1.replicate()
      r.once('end', done)
      var s = m2.replicate()
      s.once('end', done)
      r.pipe(s).pipe(r)

      var pending = 2
      function done () {
        if (!--pending) check()
      }
    })
  })

  function check () {
    t.equals(m1.cores().length, 2, '2 cores')
    t.equals(m2.cores().length, 2, '2 cores')
    t.equals(m1.cores()[0].length, 1000, 'core sees 1000 entries')
    t.equals(m1.cores()[1].length, 10, 'core sees 10 entries')
    t.equals(m2.cores()[0].length, 10, 'receiver sees 10 entries')
    t.equals(m2.cores()[1].length, 1000, 'receiver sees 1000 entries')
    m1.cores()[1].get(0, function (err, data) {
      t.error(err)
      t.equals(data.toString(), 'bar', 'core 1 has core 2 data')
      m2.cores()[1].get(0, function (err, data) {
        t.error(err)
        t.equals(data.toString(), 'foo', 'core 2 has core 1 data')
        t.end()
      })
    })
  }
})

test('regression: start replicating before cores are loaded', function (t) {
  t.plan(22)

  var m1 = hypervisor(ram)
  var m2 = hypervisor(ram)

  var coreEvents1 = 0
  var coreEvents2 = 0
  m1.on('core', function (core, name) {
    t.equals(name, String(coreEvents1))
    coreEvents1++
  })
  m2.on('core', function (core, name) {
    t.equals(name, String(coreEvents2))
    coreEvents2++
  })

  function setup (m, buf, cb) {
    m.add_core(function (err, w) {
      t.error(err)
      w.append(buf, function (err) {
        t.error(err)
        w.get(0, function (err, data) {
          t.error(err)
          t.equals(data.toString(), buf)
          t.deepEquals(m.cores(), [w])
          cb()
        })
      })
    })
  }

  setup(m1, 'foo', function () {
    setup(m2, 'bar', function () {
      var r = m1.replicate()
      r.pipe(m2.replicate()).pipe(r)
        .once('end', check)
    })
  })

  function check () {
    t.equals(m1.cores().length, 2)
    t.equals(m2.cores().length, 2)
    m1.cores()[1].get(0, function (err, data) {
      t.error(err)
      t.equals(data.toString(), 'bar')
    })
    m2.cores()[1].get(0, function (err, data) {
      t.error(err)
      t.equals(data.toString(), 'foo')
    })
    t.equals(coreEvents1, 2)
    t.equals(coreEvents2, 2)
  }
})

