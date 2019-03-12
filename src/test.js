const pump = require("pump")
const hyperdb = require("hyperdb")
const network = require("@hyperswarm/network")
const cr = require("crypto")

// this is meant to "simulate" two separate servers so two networks
const net1 = network()
const net2 = network()

const db1 = hyperdb(`./_test1`, { valueEncoding: "utf-8" })
let db2
db1.ready(() => {
  console.log("hyper1 created")

  console.log('swarming')
  const $key = db1.key
  const id = cr.createHash("sha256").update($key).digest()
  net1.discovery.holepunchable((err, yes) => {
    if (err || !yes) {
      console.log("no hole")
      process.exit()
    }
  })

  net1.join(id, {
    lookup: false,
    announce: true,
  })
  net1.on("connection", (socket) => {
    console.log('net1 got connection')
    // this is suppose to "push" so piping from
    // rep1 to socket (rep2) to rep1
    var rep = db1.replicate({ live: true })
    pump(rep, socket, rep, function () {
      console.log("socket1 pipe end")
    })
    socket.on("data", (data) => {
      //console.log("socket1 got data", data)
    })
  })
  db2 = hyperdb(`./_test2`, $key, { valueEncoding: "utf-8" })
  db2.ready(() => {
    console.log("hyper2 created")
    net2.join(id, {
      lookup: true,
      announce: false,
    })
    net2.on("connection", (socket) => {
      console.log('net2 got connection')
      // this is suppose to replicate so piping from
      // socket (rep1) to rep2 to socket (rep1)
      var rep = db2.replicate({ live: true })
      pump(rep, socket, rep, function () {
        console.log("socket2 pipe end")
      })
      socket.on("data", (data) => {
        //console.log("socket2 got data", data)
      })
    })
    db2.watch("/test", (err, data) => {
      console.log("socket2 /test", data)
    })
    db1.authorize(db2.local.key, () => {})
  })
})

setInterval(function () {
  db1.put("/test", "test", () => {
    db1.list((err, list) => {
      console.log("1", list)
    })
    db2.list((err, list) => {
      console.log("2", list)
    })
    db2.put("/test2", "test2", () => {})
  })
}, 3000)