var test = require('tape')
const debug = require('../utils/debug')(__filename, "test")

var hypervisor = require('../hypervisor')
var ram = require('random-access-memory')
var tmp = require('tmp').tmpNameSync
const async = require('async')

test('replicate two hypervisors', function (t) {
  t.plan(22)

  var m1
  var m2

  var coreEvents1 = 0
  var coreEvents2 = 0
  

  function setup(m, buf, cb) {
    m.add_core("test", "text", function (err, core) {
      t.error(err)
      core.append(buf, function (err) {
        t.error(err)
        core.get(0, function (err, data) {
          t.error(err)
          t.equals(data.toString(), buf, "saved data should exist")
          m.cores((err, cores) => {
            t.error(err)
            t.deepEquals(cores, [core], "core is correctly found in the cores")
            cb()
          })
        })
      })
    })
  }

  m1 = hypervisor(ram, "test")
  m1.ready(() => {
    m1.on('core', function (core, name) {
      t.equals(name, String(coreEvents1))
      coreEvents1++
    })
    
    m2 = hypervisor(ram, "test")
    m2.ready(() => {
      m2.on('core', function (core, name) {
        t.equals(name, String(coreEvents2))
        coreEvents2++
      })
      setup(m1, 'foo', function () {
        setup(m2, 'bar', function () {
          var r = m1.replicate()
          r.pipe(m2.replicate()).pipe(r)
            .once('end', check)
        })
      })
    })
  })

  function check() {
    async.waterfall([
      next => {
        m1.cores((err, cores) => {
          t.error(err)
          t.equals(cores.length, 2)
          
          m2.cores((err, cores) => {
            t.error(err)
            t.equals(cores.length, 2)
            next()
          })
        })
      },
      next => {
        m1.get_cores((err, cores) => {
          t.error(err)
          debug(cores)
          cores[1].get(0, function (err, data) {
            t.error(err)
            t.equals(data.toString(), 'bar')
            next()
          })
        })
      },
      next => {
        m2.get_cores((err, cores) => {
          t.error(err)
          cores[1].get(0, function (err, data) {
            t.error(err)
            t.equals(data.toString(), 'foo')
            t.equals(coreEvents1, 2)
            t.equals(coreEvents2, 2)
            next()
          })
        })
      }
    ])
  }
})

// test('live replicate two hypervisors', function (t) {
//   t.plan(22)

//   var m1 = hypervisor("test1", ram)
//   var m2 = hypervisor("test2", ram)

//   var coreEvents1 = 0
//   var coreEvents2 = 0
//   m1.on('core', function (core, name) {
//     t.equals(name, String(coreEvents1))
//     coreEvents1++
//   })
//   m2.on('core', function (core, name) {
//     t.equals(name, String(coreEvents2))
//     coreEvents2++
//   })

//   function setup(m, buf, cb) {
//     m.add_core("test", "text", function (err, w) {
//       t.error(err)
//       w.append(buf, function (err) {
//         t.error(err)
//         w.get(0, function (err, data) {
//           t.error(err)
//           t.equals(data.toString(), buf)
//           t.deepEquals(m.cores(), [w])
//           cb()
//         })
//       })
//     })
//   }

//   setup(m1, 'foo', function () {
//     setup(m2, 'bar', function () {
//       var r = m1.replicate({ live: true })
//       r.pipe(m2.replicate({ live: true })).pipe(r)
//       setTimeout(check, 1000)
//     })
//   })

//   function check() {
//     t.equals(m1.cores().length, 2)
//     t.equals(m2.cores().length, 2)
//     m1.cores()[1].get(0, function (err, data) {
//       t.error(err)
//       t.equals(data.toString(), 'bar')
//     })
//     m2.cores()[1].get(0, function (err, data) {
//       t.error(err)
//       t.equals(data.toString(), 'foo')
//     })
//     t.equals(coreEvents1, 2)
//     t.equals(coreEvents2, 2)
//   }
// })