# Datagram, the free data platform
> Datagram is an open-source data platform that you can use to build data and communication infrastructures as containers called datagrams. Datagram helps you to organize and share any data in a decentralized and peer-to-peer manner.

[![license](https://img.shields.io/badge/license-apache--2.0-brightgreen.svg)](http://standardjs.com) [![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Fmachianists%2Fdatagram-node.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Fmachianists%2Fdatagram-node?ref=badge_shield) [![js-standardx-style](https://img.shields.io/badge/code%20style-standardx-brightgreen.svg)](http://standardjs.com) [![web-datagram](https://img.shields.io/badge/web-datagramjs.com-blue.svg)](https://datagramjs.com) [![twitter-machianists](https://img.shields.io/badge/twitter-@machianists-blue.svg)](https://twitter.com/machianists)

---

**THIS IS A WORK-IN-PROGRESS - DO NOT ATTEMPT TO USE**

---

- [More about Datagram](#more-about-datagram)
- [Get started](#get-started)
  - [How the API works](#how-the-api-works)
  - [Quick start API tutorial](/docs/DATAGRAM_API.md)
- [Running tests](#running-tests)
- [The team](#the-team)
- [License](#license)

## More about Datagram
### The purpose why Datagram was created
Servers used to be about running code and storing backups. Now they are about facilitating connections and serving data. Docker and Kubernetes have made it easy to spin up complex server infrastructures. Despite advances in server orchestration we are still manually handling all the communication and data managing that happens between the users and the service.

Datagram aims to help with this by offering a framework to containerize communications and database.

We believe that the future of the Internet is peer-to-peer so to support this vision, Datagram supports both client-server and peer-to-peer connection models out-of-the-box.

## Get started

```bash
# install datagram locally for development
npm install datagram
```

### How the API works
Initialize your Datagram instance.
```javascript
const Datagram = require('datagram')

const DG = new Datagram() // datagram will generate user_id and password for you

await DG.ready() // standby until everything is ready

const credentials = await DG.getCredentials() // store these somewhere safe

console.log(DG) // -> { ... available API methods, credentials and settings ... }
```

Build a new Datagram from a pre-made template or your own.

> 

```javascript
// Let's do a group video chat
const template = {
  "datatype": "video",
  "sharemodel": "many-to-many",
  "description": "Me and my entourage",
  "allowed_streams": [ "video" ]
}

// Datagram supports callbacks, await/async and Promises.
// You can use any of the three standard control flow styles with Datagram's API.

// go with nodejs style callbacks
DG.build({ template }, (err, dg) => {
  // dg -> datagram built from the template
})

// use the new async/await
await DG.build({ template }).catch(err)

// or go with Promises
DG.build({ template }).then(dg => {
  // dg -> datagram built from the template
}).catch(err)
```

Attach any compatible streams you want and read others.
```javascript
// Attach your webcam's video stream into the datagram
const { user_id } = await DG.getCredentials()
const video_stream = navigator.mediaDevices.getUserMedia()
await DG.add_stream({ "@type": "video", user_id: user_id, stream: video_stream)

// Render HTML view of your datagram
const video_streams = await DG.getStreams()
const rendering = await DG.render({ streams: video_streams, view: "html5_video_wall" })
fs.writeFileSync('video_chat.html', rendering)
// open video_chat.html with your browser
```

To understand better what's happening here, check out [Quick Start API tutorial](docs/DATAGRAM_API.md).

> Quick links: [Datagram architecture](docs/ARCHITECTURE.md) | [How-to-use tutorials](docs/how-to-use) | [Datagram terminology](/docs/TERMINOLOGY.md)

## Running tests


```bash
# Install dependencies and test tooling
npm install

# Run tests
npm test

# or run tests with debug logging
DEBUG=*datagram* npm test
```




## The team

Datagram is a user-driven project maintained by an equal-fair open-source organization called [Machian](https://machian.com).

Current primary maintainer is [Marko Polojärvi](https://twitter.com/markopolojarvi). Major direct and indirect contributions have come from Mathias Buus, Stephen Whitmore, Paul Frazee, Benjamin Forster, Martin Heidegger, Lars-Magnus Skog, Alexander Cobleigh and Tony Ivanov.

> **If you are interested in working with peer-to-peer technologies and solving the hardest & most fascinating issues with digital privacy and security, contact [Marko Polojärvi](https://twitter.com/markopolojarvi) right now.**


## License

We consider Datagram as a public utility.

All Datagram code is licensed under Apache License 2.0 (Apache-2.0)
