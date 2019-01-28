const test = require('tape')
const hypervisor = require('../hypervisor')
const debug = require('../utils/debug')(__filename, 'test')
const fs = require('fs-extra')

function cleanup() {
  // eslint-disable-next-line no-path-concat
  fs.removeSync(__dirname + '/temp')
}
process.on('exit', cleanup)
test.onFinish = cleanup
test.onFailure = cleanup

test.skip('hypervisor removal', async function(t) {
  t.plan(6)

  // Let's create a group of friends

  const friends = {}

  async function create_friend_group(cb) {
    friends.Bob = {}
    friends.Bob.hv = await create_hypervisor_with_core('Bob').catch((err) => {
      throw err
    })
    friends.Bob.key = friends.Bob.hv._cores['Bob'].key.toString('hex')
    debug('Bob key', friends.Bob.key)

    friends.Alice = {}
    friends.Alice.hv = await create_hypervisor_with_core('Alice').catch((err) => {
      throw err
    })
    friends.Alice.key = friends.Alice.hv._cores['Alice'].key.toString('hex')
    debug('Alice key', friends.Alice.key)

    friends.John = {}
    friends.John.hv = await create_hypervisor_with_core('John').catch((err) => {
      throw err
    })
    cb()
  }

  create_friend_group(() => {
    // Everybody is a friend so everybody shares with each other, streams for everyone!
    for (const person_a in friends) {
      if (friends.hasOwnProperty(person_a)) {
        const a = friends[person_a].hv
        for (const person_b in friends) {
          if (friends.hasOwnProperty(person_b)) {
            const b = friends[person_b].hv
            if (person_a !== person_b) {
              friends[person_a].pipe = a.replicate({ live: true })
              friends[person_a].pipe.pipe(b.replicate({ live: true })).pipe(friends[person_a].pipe)
            }
          }
        }
      }
    }
    setTimeout(friend_check, 1000)
  })

  // Now everybody should have three friends
  function friend_check() {
    for (const person in friends) {
      if (friends.hasOwnProperty(person)) {
        t.equal(Object.keys(friends[person].hv._cores).length, 4, friends[person].hv._localName)
      }
    }
    remove_john_from_bob()
  }

  // Bob gets pissed off from John's whining and removes his core
  function remove_john_from_bob() {
    friends.Bob.hv._remove_core(friends.John.key)
    // debug('bob', friends.Bob.hv)

    // Now we need to reconnect Bob to others so ignore list is applied
    friends.Bob.pipe.end()
    friends.Bob.hv.mux._finalize()

    // Connect Bob to every one except himself and John
    const a = friends.Bob.hv
    for (const person_b in friends) {
      if (friends.hasOwnProperty(person_b)) {
        const b = friends[person_b].hv
        if (person_b !== 'Bob' && person_b !== 'John') {
          const pipe_a = a.replicate({ live: true })
          pipe_a.pipe(b.replicate({ live: true })).pipe(pipe_a)
        }
      }
    }
    setTimeout(check_bob_to_validate_removal, 1000)
  }

  function check_bob_to_validate_removal() {
    // shouldn't have any markings of John ever existing nor he gets his updates
    let john_found = false
    for (const core in friends.Bob.hv._cores) {
      if (friends.Bob.hv._cores.hasOwnProperty(core)) {
        if (friends.Bob.hv._cores[core].key && friends.Bob.hv._cores[core].key === friends.John.key) john_found = true
      }
    }
    t.equal(john_found, false)
    everybody_create_an_update()
  }

  function everybody_create_an_update() {
    for (const person in friends) {
      if (friends.hasOwnProperty(person)) {
        const p = friends[person]
        const core = p.hv.get_core_by_key(p.key)
        core.append('anybody out there?', () => {})
      }
    }
    setTimeout(verify_everybody_got_updates, 1000)
  }

  function verify_everybody_got_updates() {
    // cleanup()
  }
})

async function create_hypervisor_with_core(name) {
  return new Promise(async (resolve, reject) => {
    const mf = hypervisor(name, `${__dirname}/temp/${name}`)
    mf.add_core(name, (err, core, index) => {
      if (err) reject(err)
      core.append(`${name}'s here`, () => {})
      resolve(mf)
    })
  })
}
