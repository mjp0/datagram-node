const test = require('tape')
const debug = require('../utils/debug')(__filename, "test")
const MetaCore = require('../hypervisor/meta-core')
const async = require('async')
const tmp = require('tmp').tmpNameSync
const ram = require('random-access-memory')
const { deriveKeyPair } = require("../utils/crypto")

const keys = {}
const metacore_keypair = deriveKeyPair(Buffer.from("test" + "metacore"))
keys.key = metacore_keypair.publicKey.toString("hex")
keys.secret = metacore_keypair.secretKey.toString("hex")

test("create new meta-core", (t) => {
  t.plan(3)
  MetaCore.create(ram, keys, (err, MC) => {
    t.equal((typeof MC), "object", "should be an object")
    t.equal((typeof MC.get_kv), "function", "should have kv interface")
    t.equal((typeof MC.add_core_details), "function", "should have meta core interface")
  })
})

test("check key/value interface", (t) => {
  t.plan(5)
  MetaCore.create(ram, keys, (err, MC) => {    
    MC.set_kv("foo", "bar", (err) => {
      t.error(err, "no errors")
      MC.get_kv("foo", (err, value) => {
        t.error(err, "no errors")
        t.equal(value, "bar", "returned value should match saved value")
        MC.get_all_keys((err, keys) => {
          t.error(err, "no errors")
          t.equal(keys[0], "foo", "should have previous saved key")
        })
      })
    })
  })
})

test("check meta core interface", (t) => {
  t.plan(23)
  let MC = null
  //const storage = tmp()

  let core1_key = ""
  let core2_key = ""

  async.waterfall([
    next => {
      MetaCore.create(ram, keys, (err, metacore) => {
        t.error(err, "no errors")
        MC = metacore
        next()
      })
    },
    next => {
      // Let's assume we have a core and want to add details for it
      MC.add_core("foo", "text", (err, core) => {
        t.error(err, "no errors")
        t.ok(core.key, "core1 should have a key")
        core1_key = core.key.toString("hex")
        next()
      })
    },
    next => {
      // Let's assume we have a core and want to add details for it
      MC.add_core("bar", "text", (err, core) => {
        t.error(err, "no errors")
        t.ok(core.key, "core2 should have a key")
        core2_key = core.key.toString("hex")
        next()
      })
    },
    next => {
      // We should be able to find the core we saved above
      MC.get_core_details(core1_key, (err, details) => {
        t.error(err, "no errors")
        t.equal(details.name, "foo", "core name matches")
        t.equal(details.key, core1_key, "core key matches")
        t.equal(details.type, "text", "core type matches")
        next()
      })
    },
    next => {
      // Let's check if we can pull out all known cores
      // To make this more robust, add random crap into the store
      MC.set_kv("foo", "bar", (err) => {
        MC.get_all_core_details((err, cores) => {
          t.error(err, "no errors")
          t.equal(cores[0].name, "foo", "core 1 name matches")
          t.equal(cores[0].key, core1_key, "core 1 key matches")
          t.equal(cores[0].type, "text", "core 1 type matches")
          t.equal(cores[1].name, "bar", "core 2 name matches")
          t.equal(cores[1].key, core2_key, "core 2 key matches")
          t.equal(cores[1].type, "text", "core 2 type matches")
          t.false(cores[2], "there should be only two cores")
          next()
        })
      })
    },
    next => {
      // Let's remove a core
      MC.remove_core(core1_key, (err) => {
        t.error(err, "no errors")
        MC.get_all_core_details((err, cores) => {
          t.error(err, "no errors")
          t.equal(cores[0].name, "bar", "core 2 name matches")
          t.equal(cores[0].key, core2_key, "core 2 key matches")
          t.equal(cores[0].type, "text", "core 2 type matches")
          t.false(cores[1], "there should be only one core left")
          next()
        })
      })
    }
  ])
})

test("storage persistence", t => {
  t.plan(13)
  let mc1 = null
  let mc1_key = null
  let core1_key = null
  let storage = tmp()

  async.waterfall([
    next => {
      // First we will need to create a brand new meta core
      MetaCore.create(storage, keys, (err, metacore1) => {
        t.error(err, "no errors")
        t.ok(metacore1.key.toString("hex"), "mc1 has a key")
        mc1_key = metacore1.key.toString("hex")
        mc1 = metacore1
        next()
      })
    },
    next => {
      // Then we need a new core in it
      mc1.add_core("test", "text", (err, core) => {
        t.error(err, "no errors")
        t.ok(core.key.toString("hex"), "core has a key")
        core1_key = core.key.toString("hex")
        next()
      })
    },
    next => {
      // Now let's try to open that meta core again and see if it persists and loads the test core
      MetaCore.open(storage, { key: mc1_key }, (err, mc2) => {
        t.error(err, "no errors")
        t.ok(mc2.key.toString("hex"), "mc2 has a key")
        t.equal(mc1_key, mc2.key.toString("hex"), "mc1 and mc2 keys match")
        t.equal(mc2.length, 1, "should have one item in store")
        mc2.load_cores_from_storage((err) => {
          t.error(err, "no errors")
          mc2.get_all_core_details((err, cores) => {
            t.error(err, "no errors")
            t.equal(cores.length, 1, "mc2 should have one core")
            t.ok(typeof mc2.core_references, "object", "core references should exist")
            t.ok(mc2.core_references[core1_key].key.toString("hex"), "core should be loaded in the core references")
            next()
          })
        })
      })
    }
  ])
})