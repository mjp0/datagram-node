let test = require('tape')
const debug = require('../utils/debug')(__filename, "test")

let hypervisor = require('../hypervisor')
let ram = require('random-access-memory')
let tmp = require('tmp').tmpNameSync

test('no cores', function (t) {
  const hv = hypervisor(ram)
  hv.ready(() => {
    hv.cores((err, cores) => {
      t.error(err)
      t.deepEquals(cores, [], "hv has no cores")
      t.end()
    })
  })
})

test('create core', function (t) {
  t.plan(6)

  const hv = hypervisor(ram)
  hv.ready(() => {
    hv.add_core("test", "text", function (err, core) {
      t.error(err)
      core.append('foo', function (err) {
        t.error(err)
        core.get(1, function (err, data) {
          t.error(err)
          t.equals(data.toString(), 'foo', "core contains stored string")
          hv.cores((err, cores) => {
            t.error(err)
            t.deepEquals(cores, [core], "core is correctly found in the cores")
          })
        })
      })
    })
  })
})

test('get core by key', function (t) {
  t.plan(3)

  const hv = hypervisor(ram)
  hv.ready(() => {
    hv.add_core("test", "text", function (err, core) {
      t.error(err)
      let core_reference = hv.core(core.key)
      t.deepEquals(core_reference, core, 'core is the same as retrieved core (buffer key)')
      core = hv.core(core.key.toString('hex'))
      t.deepEquals(core_reference, core, 'core is the same as retrieved core (hex key)')
    })
  })
})

test('get localcore by name', function (t) {
  t.plan(3)

  const hv = hypervisor(ram)
  hv.ready(() => {
    hv.add_core('bob', "text", function (err, w) {
      t.error(err)
      hv.open_core('bob', function (err, w2) {
        t.error(err, 'valid core retrieved')
        t.deepEquals(w2, w, 'core is the same as retrieved core')
      })
    })
  })
})

// test('get localcore by name across disk loads', function (t) {
//   t.plan(5)

//   let storage = tmp()
//   let key

//   const hv = hypervisor(storage)
//   hv.ready(() => {
//     debug("key", hv._hypervisor_key)
//     hv.add_core('minuette', "text", function (err, w) {
//       t.error(err)
//       t.ok(w.key)
//       key = w.key
  
//       // HACK: close its storage
//       w._storage.close(function () {
//         const hv2 = hypervisor(storage, hv._hypervisor_key)
//         hv2.add_core('minuette', "text", function (err, w2) {
//           t.error(err)
//           t.ok(w.key)
//           t.deepEquals(w2.key, w.key, 'keys match')
//         })
//       })
//     })
//   })
// })