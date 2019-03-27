#!/usr/bin/env node

const cli = require('commander')
const pkg = require('./package.json')
const Datagram = require('./src')
const { generateUser, fromB58 } = require('./src/utils')
const fs = require('fs-extra')
const templates = require('./src/templates/streams')
const path = require('path')
const chokidar = require('chokidar')

let dg = null
let watcher = null

function error(err) {
  console.error(err)
  process.exit()
}
process.on('uncaughtException', function(err) {
  error(err)
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

function openUserFile(filename) {
  const ufile = fs.readFileSync(filename, 'UTF-8')
  if (ufile) {
    const u = ufile.split('/')
    if (u.length === 2 && u[0].length > 0 && u[1].length > 0) {
      return {
        id: u[0].trim(),
        password: u[1].trim(),
      }
    } else return error('invalid file')
  } else return error('no file found at ' + filename)
}

function openCredsFile(filename) {
  const ufile = fs.readFileSync(filename, 'UTF-8')
  if (ufile) {
    const u = ufile.split('/')
    if (u.length === 2 && u[0].length > 0 && u[1].length > 0) {
      return {
        read: u[0].trim(),
        encryption_password: u[1].trim(),
      }
    } else return error('invalid file')
  } else return error('no file found at ' + filename)
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
    args = { ...args, keys: { ...options.datagram } }
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
const create = async (filename, options) => {
  if (!filename) return error('filename missing')
  return new Promise(async (done, error) => {
    const args = generateArgs(options)
    const DG = new Datagram(args, args.keys || null)
    dg = await DG.ready()
    const keys = await dg.getKeys()
    fs.writeFileSync(filename + '.creds.dg', `${keys.read}/${keys.encryption_password}`)
    console.log(`Created new Datagram\nLocal address: ${keys.read}\nEncryption password: ${keys.encryption_password}`)
    done(dg)
  })
}
cli
  .command('create [filename]')
  .description('Generates new Datagram credentials to a file')
  .option('-u --userfile [credentials_file]', 'User file', openUserFile)
  .option('-i --id [id]', 'User id')
  .option('-p --pass [password]', 'User password')
  .action(create)

// Clone remote
const clone = async (options) => {
  return new Promise(async (done, error) => {
    if (!options.sharelink) return error('sharelink missing')
    const args = {
      ...generateArgs(options),
      sharelink: options.sharelink,
      realtime: true,
      full_sync: options.fullsync || false,
      host: options.host || false,
    }

    try {
      console.log('Connecting to the share...')
      const DG = new Datagram(args || null)
      dg = await DG.ready()
      console.log('Real-time cloning started (stop by pressing CTRL+C)')
      done(dg)
    } catch (e) {
      error(e)
    }
  })
}

cli
  .command('clone')
  .option('-u --userfile [credentials_file]', 'User file', openUserFile)
  .option('-i --id [id]', 'User id')
  .option('-p --pass [password]', 'User password')
  .option('-l --sharelink [sharelink]', 'Sharelink')
  .option('--fullsync [boolean]', 'Syncs everything')
  .option('--host [boolean]', 'Partipates in the hosting')
  .action(clone)

// Share
async function createShare(dg) {
  return new Promise(async (done, error) => {
    const sharelink = await dg.share({ realtime: true })
    console.log('Share started (stop by pressing CTRL+C)')

    const settings = await dg.getSettings()
    const keys = await dg.getKeys()

    // Monitor for file adds
    const db_path = `${settings.path}${fromB58(keys.read).toString('hex')}`

    watcher = chokidar.watch(db_path, { persistent: true }).on('change', async (event, path) => {
      console.log('New data added, restarting the share...')
      cleanUp()
      await createShare(dg)
    })
    done(sharelink)
  })
}
const share = async (options) => {
  const args = generateArgs(options)
  if (!args.keys) {
    const dg_keys = await dg.getKeys()
    if (dg_keys) args.keys = dg_keys
    else return error('datagram address is required for sharing')
  }
  const DG = new Datagram(args, args.keys)
  dg = await DG.ready()
  const sharelink = await createShare(dg)

  console.log(`Sharelink: ${sharelink}`)
}
cli
  .command('share')
  .option('-u --userfile [credentials_file]', 'User file', openUserFile)
  .option('-i --id [id]', 'User id')
  .option('-p --pass [password]', 'User password')
  .option('-a --address [address]', "Datagram's local address")
  .option('-e --encryption [encryption_password]', "Datagram's encryption password")
  .option('-d --datagram [dg_filename]', 'Datagram credentials file', openCredsFile)
  .action(share)

// Add files
cli
  .command('add [filename]')
  .description('Add new file to a datagram')
  .option('-u --userfile [credentials_file]', 'User file', openUserFile)
  .option('-i --id [id]', 'User id')
  .option('-p --pass [password]', 'User password')
  .option('-a --address [address]', "Datagram's local address")
  .option('-e --encryption [encryption_password]', "Datagram's encryption password")
  .option('-d --datagram [dg_filename]', 'Datagram credentials file', openCredsFile)
  .action(async (filename, options) => {
    if (!filename) return error('filename missing')
    if (!await fs.exists(filename)) return error('non-existing file')
    const args = generateArgs(options)
    const DG = new Datagram(args, args.keys)
    dg = await DG.ready()
    const f = path.parse(filename)
    const p = path.normalize(filename)
    console.log(`Importing ${f.base}...`)

    const file = await fs.readFile(p)
    await dg.write(f.base, file)
    console.log('...done')
  })

// List
cli
  .command('list')
  .description('List all files')
  .option('-u --userfile [credentials_file]', 'User file', openUserFile)
  .option('-i --id [id]', 'User id')
  .option('-p --pass [password]', 'User password')
  .option('-a --address [address]', "Datagram's local address")
  .option('-e --encryption [encryption_password]', "Datagram's encryption password")
  .option('-d --datagram [dg_filename]', 'Datagram credentials file', openCredsFile)
  .action(async (options) => {
    const args = generateArgs(options)

    const DG = new Datagram(args, args.keys)
    dg = await DG.ready()
    const ls = await dg.ls()
    ls.sort().forEach(f => console.log(f))
  })

// Search

// Export data
cli
  .command('export [data_name] [target_file]')
  .description('Export data')
  .option('-u --userfile [credentials_file]', 'User file', openUserFile)
  .option('-i --id [id]', 'User id')
  .option('-p --pass [password]', 'User password')
  .option('-a --address [address]', "Datagram's local address")
  .option('-e --encryption [encryption_password]', "Datagram's encryption password")
  .option('-d --datagram [dg_filename]', 'Datagram credentials file', openCredsFile)
  .action(async (data_name, target_file, options) => {
    if (!data_name) return error('data_name missing')
    if (!target_file) return error('target_file missing')
    const args = generateArgs(options)

    const DG = new Datagram(args, args.keys)
    dg = await DG.ready()
    const data = await dg.read(data_name)
    if(data) {
      const f = path.parse(target_file)
      const p = path.normalize(target_file)
      console.log(`Data found, exporting to ${f.base}...`)
      await fs.writeFile(p, data)
      console.log('Export done')
    } else {
      console.log(`no data found with data name ${data_name}`)
    }
  })

// Get stats

// Get authorization token

// Authorize another datagram
// const repl = async (options) => {
//   let args = generateArgs(options)
//   let dg = null
//   if (options.sharelink) {
//     console.log('Cloning...')
//     options.realtime = true
//     dg = await clone(options)
//   } else if (!options.sharelink && options.address && options.encryption) {
//     console.log('Opening...')
//     console.log(args)
//     dg = await create(options, args.keys)
//   } else {
//     console.log('Creating...')
//     dg = await create(options)
//   }
//   const readline = require('readline')
//   const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout,
//   })
//   function d(data) {
//     rl.write(data)
//   }
//   async function run() {
//     rl.question('λ ', async (code) => {
//       if (code) {
//         try {
//           if (code === 'help') {
//             console.log('Available commands', Object.keys(dg))
//             await run()
//           } else if (code.match(/share\(/)) {
//             options = { realtime: true, ...options }
//             const sharelink = await dg.share({ realtime: true })
//             console.log(`Sharelink: ${sharelink}`)
//             await run()
//           } else if (code.match(/exit/)) {
//             process.exit()
//           } else if (code.match(/debug\(/)) {
//             eval(`dg.${code}`)
//             await run()
//           } else {
//             eval(
//               `dg.${code}.then(async (d) => { console.log(d||'done'); await run(); }).catch(async (e) => { console.log(e); await run(); })`,
//             ) // + '.then(d)')
//           }
//         } catch (e) {
//           console.error(e)
//           await run()
//         }
//       } else await run()
//     })
//   }
//   run()
// }
// cli
//   .command('repl')
//   .option('-u --userfile [credentials_file]', 'User file', openUserFile)
//   .option('-i --id [id]', 'User id')
//   .option('-p --pass [password]', 'User password')
//   .option('-l --sharelink [sharelink]', 'Sharelink')
//   .option('-a --address [address]', "Datagram's local address")
//   .option('-e --encryption [encryption_password]', "Datagram's encryption password")
//   .option('--fullsync [boolean]', 'Syncs everything')
//   .option('--host [boolean]', 'Partipates in the hosting')
//   .action(repl)

cli.parse(process.argv)
