#!/usr/bin/env node

const cli = require('commander')
const pkg = require('./package.json')
const Datagram = require('./src')
const { generateUser, fromB58 } = require('./src/utils')
const fs = require('fs-extra')
const templates = require('./src/templates/streams')
const path = require('path')
const chokidar = require('chokidar')

function error(err) {
  console.error(err)
  process.exit()
}
process.on('uncaughtException', function(err) {
  error(err)
})

function openUserFile(filename) {
  const ufile = fs.readFileSync(filename, 'UTF-8')
  if (ufile) {
    const u = ufile.split('/')
    if (u.length === 2 && u[0].length > 0 && u[1].length > 0) {
      return {
        id: u[0].trim(),
        password: u[1].trim(),
      }
    } else return error('invalid userfile')
  } else return error('no userfile found at ' + filename)
}

function generateArgs(options) {
  let args = {}
  if (options.userfile) {
    args = options.userfile
  } else if (options.id && options.password) {
    args = {
      id: options.id,
      password: options.password,
    }
  } else {
    return error('insufficient user credentials provided')
  }

  if (options.datagram) {
    args = { ...args, ...options.datagram }
  } else if (options.address && options.encryption) {
    args = {
      ...args,
      keys: {
        read: options.address,
        encryption_password: options.encryption,
      },
    }
  } else if (options._name === 'share') {
    return error('datagram address and encryption password required for sharing')
  }

  args.type = 'fs'
  return args
}

cli.version(pkg.version)

// Generate user credentials
cli.command('user [filename]').description('Generate new user credentials to a file').action(async (filename) => {
  if (!filename) return error('filename missing')
  const user = await generateUser().catch(error)
  fs.writeFileSync(filename + '.user.dg', `${user.id}/${user.password}`)
  console.log(`User: ${user.id}\nPassword: ${user.password}\n\nStored at ${filename}.user.dg`)
})

// Create new
cli
  .command('create')
  .option('-u --userfile [credentials_file]', 'User file', openUserFile)
  .option('-i --id [id]', 'User id')
  .option('-p --pass [password]', 'User password')
  .action(async (options) => {
    const args = generateArgs(options)
    const DG = new Datagram(args)
    const dg = await DG.ready()
    const keys = await dg.getKeys()
    console.log(`Created new Datagram\nLocal address: ${keys.read}\nEncryption password: ${keys.encryption_password}`)
  })

// Clone remote
cli
  .command('clone')
  .option('-u --userfile [credentials_file]', 'User file', openUserFile)
  .option('-i --id [id]', 'User id')
  .option('-p --pass [password]', 'User password')
  .option('-l --sharelink [sharelink]', 'Sharelink')
  .option('--fullsync [boolean]', 'Syncs everything')
  .option('--host [boolean]', 'Partipates in the hosting')
  .action(async (options) => {
    if (!options.sharelink) return error('sharelink missing')
    const args = {
      ...generateArgs(options),
      sharelink: options.sharelink,
      realtime: true,
      full_sync: options.fullsync || false,
      host: options.host || false,
    }

    const DG = new Datagram(args)
    // Notifications
    DG.on('connection:new', (pkg) => {
      console.log(`Connected to ${pkg.socket_key}`)
    })
    DG.on('connection:error', (pkg) => {
      console.log(`Connection error with ${pkg.socket_key}. Error message: ${JSON.stringify(pkg.error)}`)
    })
    DG.on('connection:end', (pkg) => {
      console.log(`Connection ended for ${pkg.socket_key}`)
    })
    const dg = await DG.ready()
  })

// Share
cli
  .command('share')
  .option('-u --userfile [credentials_file]', 'User file', openUserFile)
  .option('-i --id [id]', 'User id')
  .option('-p --pass [password]', 'User password')
  .option('-a --address [address]', "Datagram's local address")
  .option('-e --encryption [encryption_password]', "Datagram's encryption password")
  .option('-d --datagram [dg_filename]', 'Datagram file')
  .action(async (options) => {
    const args = generateArgs(options)
    if (!args.keys) return error('datagram address is required for sharing')

    async function createShare() {
      return new Promise(async (done, error) => {
        const DG = new Datagram(args, args.keys)

        // Notifications
        DG.on('connection:new', (pkg) => {
          console.log(`New connection from ${pkg.socket_key}`)
        })
        DG.on('connection:error', (pkg) => {
          console.log(`Connection error with ${pkg.socket_key}. Error message: ${JSON.stringify(pkg.error)}`)
        })
        DG.on('connection:end', (pkg) => {
          console.log(`Connection ended for ${pkg.socket_key}`)
        })
        const dg = await DG.ready()

        const sharelink = await dg.share({ realtime: true })
        console.log('Share started')

        const settings = await dg.getSettings()
        const keys = await dg.getKeys()

        // Monitor for file adds
        const db_path = `${settings.path}${fromB58(keys.read).toString('hex')}`

        const watcher = chokidar.watch(db_path, { persistent: true }).on('change', async (event, path) => {
          console.log('New data added, restarting the share...')
          cleanUp()
          await createShare()
        })

        // Cleaning up
        async function cleanUp() {
          watcher.close()
          await dg.disconnect()
        }

        if (process.platform === 'win32') {
          var rl = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout,
          })

          rl.on('SIGINT', function() {
            process.emit('SIGINT')
          })
        }

        process.on('SIGINT', async () => {
          cleanUp()
          console.log('\nStopped sharing and disconnected all downloaders')
          process.exit()
        })
        done(sharelink)
      })
    }
    const sharelink = await createShare()
    console.log(`Sharelink: ${sharelink}`)
  })

// Add files
cli
  .command('add')
  .option('-u --userfile [credentials_file]', 'User file', openUserFile)
  .option('-i --id [id]', 'User id')
  .option('-p --pass [password]', 'User password')
  .option('-a --address [address]', "Datagram's local address")
  .option('-e --encryption [encryption_password]', "Datagram's encryption password")
  .option('-d --datagram [dg_filename]', 'Datagram file')
  .option('-f --file [filename]', 'File you want to add')
  .action(async (options) => {
    if (!options.file) return error('filename missing')
    if (!await fs.exists(options.file)) return error('non-existing file')
    const args = generateArgs(options)
    const DG = new Datagram(args, args.keys)
    const dg = await DG.ready()
    const f = path.parse(options.file)
    const p = path.normalize(options.file)
    console.log(`Importing ${f.base}...`)

    const file = await fs.readFile(p, 'binary')
    await dg.write(f.base, file)
    console.log('...done')
  })
// Search

// Export data

// Get stats

// Get authorization token

// Authorize another datagram

cli.parse(process.argv)
