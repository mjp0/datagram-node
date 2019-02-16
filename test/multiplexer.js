jest.useFakeTimers()

const hypercore = require('hypercore')
const ram = require('random-access-memory')
const multiplexer = require('../src/container/multiplexer')
const pump = require('pump')
const through = require('through2')
const { log } = require('../src/utils/debug')(__filename, 'test')

test('Key exchange API', function() {
  expect.assertions(11)
  const encryptionKey = Buffer.from('deadbeefdeadbeefdeadbeefdeadbeef') // used to encrypt the connection

  const mux1 = multiplexer(encryptionKey)
  const mux2 = multiplexer(encryptionKey)

  mux1.ready(function(client) {
    mux1.haveFeeds([ 'foo', 'oof', '03', '01' ])
  })

  mux2.ready(function(client) {
    mux2.haveFeeds([ 'bar', '02', '01' ], {
      signatures: [ 'sig' ],
      custom: 'option',
    })
  })
  expect(1).toBeTruthy()
  
  const expectedKeys = [ '01', '02', '03', 'foo', 'oof' ]

  mux1.on('manifest', function(m) {
    expect(m.keys instanceof Array).toBeTruthy()
    expect(m.keys[0]).toBe('bar')
    expect(m.signatures instanceof Array).toBeTruthy()
    expect(m.signatures[0]).toBe('sig')
    expect(m.custom).toBe('option')

    mux1.on('replicate', function(keys, repl) {
      // Keys should be alphabetically sorted
      // and identical on both ends.
      expect(keys).toEqual(expectedKeys)
      expect(typeof repl).toBe('function')
    })

    mux1.wantFeeds('02', 'oof') // pick some of the remote's keys excluding 'bar'
  })

  mux2.on('manifest', function(m) {
    expect(m.keys[0]).toBe('foo')
    expect(m.keys[1]).toBe('oof')
    mux2.on('replicate', function(keys, repl) {
      expect(keys).toEqual(expectedKeys)
      expect(typeof repl).toBe('function')
    })

    mux2.wantFeeds(m.keys) // mark all remote keys as 'want' for classical multicore behaviour
  })

  pump(
    mux1.stream,
    through(function(chunk, _, next) {
      log('MUX1->MUX2', chunk.toString('utf8'))
      this.push(chunk)
      next()
    }),
    mux2.stream,
    through(function(chunk, _, next) {
      log('MUX2->MUX1', chunk.toString('utf8'))
      this.push(chunk)
      next()
    }),
    mux1.stream,
  )
})

test('Actual replication', function() {
  expect.assertions(18)
  const encryptionKey = Buffer.from('deadbeefdeadbeefdeadbeefdeadbeef')
  const h1 = hypercore(ram)
  const h2 = hypercore(ram)
  const h3 = hypercore(ram)

  // Initial cores
  function setup(cb) {
    h1.ready(function() {
      h1.append('hyper', function(err) {
        expect(err).toBeFalsy()
        h2.ready(function() {
          h2.append('sea', function(err) {
            expect(err).toBeFalsy()
            h3.ready(function() {
              h3.append('late to the party', function(err) {
                expect(err).toBeFalsy()
                cb()
              })
            })
          })
        })
      })
    })
  }

  const mux1 = multiplexer(encryptionKey)
  const mux2 = multiplexer(encryptionKey)
  // replicated core placeholders
  let h1r = null
  let h2r = null
  let h3r = null
  mux1.on('manifest', function(m) {
    h2r = hypercore(ram, h2.key.toString('hex'))
    h2r.on('download', function(index, data) {
      expect(data.toString('utf8')).toBe('sea')
      expect(index).toBe(0)
    })

    h3r = hypercore(ram, h3.key.toString('hex'))
    h3r.on('download', function(index, data) {
      expect(data.toString('utf8')).toBe('late to the party')
      expect(index).toBe(0)
    })

    mux1.on('replicate', function(keys, repl) {
      expect(keys).toEqual([ h1, h2, h3 ]
        .map(function(f) {
          return f.key.toString('hex')
        })
        .sort())
      repl([ h2r, h1, h3r ])
    })
    mux1.wantFeeds(m.keys)
  })

  mux2.on('manifest', function(m) {
    h1r = hypercore(ram, m.keys[0])
    h1r.on('download', function(index, data) {
      expect(data.toString('utf8')).toBe('hyper')
      expect(index).toBe(0)
    })
    mux2.on('replicate', function(keys, repl) {
      expect(keys).toEqual([ h1, h2, h3 ]
        .map(function(f) {
          return f.key.toString('hex')
        })
        .sort())
      repl([ h1r, h2, h3 ])
    })
    mux2.wantFeeds(m.keys)
  })

  setup(function() {
    mux1.ready(function(client) {
      mux1.haveFeeds([ h1 ])
    })
    mux2.ready(function(client) {
      mux2.haveFeeds([ h2, h3 ])
    })
  })

  mux1.stream
    .pipe(
      through(function(chunk, _, next) {
        log('MUX1->MUX2', chunk.toString('utf8'))
        this.push(chunk)
        next()
      }),
    )
    .pipe(mux2.stream)
    .pipe(
      through(function(chunk, _, next) {
        log('MUX2->MUX1', chunk.toString('utf8'))
        this.push(chunk)
        next()
      }),
    )
    .pipe(mux1.stream)
    .once('end', function(err) {
      expect(err).toBeFalsy()
      h1r.get(0, function(err, data) {
        expect(err).toBeFalsy()
        expect(data.toString('utf8')).toBe('hyper')
      })

      h2r.get(0, function(err, data) {
        expect(err).toBeFalsy()
        expect(data.toString('utf8')).toBe('sea')
      })

      h3r.get(0, function(err, data) {
        expect(err).toBeFalsy()
        expect(data.toString('utf8')).toBe('late to the party')
      })
    })
})
