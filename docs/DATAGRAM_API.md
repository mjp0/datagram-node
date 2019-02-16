# Datagram API tutorial

> Note that until we reach 1.0 this is work-in-progress

A quick word about code conventions used. The API for Datagram was designed to be super simple and fast to use but still, offer advanced features to those who need them.

For this reason, all function arguments in Datagram are objects. Objects are the only way we can expand arguments if needed without having to modify the function arguments and forcing developers to rewrite their code with every update.

Each function accepts required arguments, optional settings and a callback function to call when done. Each function looks like this: `function(arguments, [options], callback)`.

> Even though functions have apparent callback support, **all API functions also support both async/await and Promises**.

## Let's get started

To get started we need to first get the Datagram code.

```javascript
const Datagram = require('datagram') // nodejs

// or

import Datagram from 'datagram' // es6
```

Everything we do with Datagram requires a Datagram instance. As a convention, we write it as datagram with lowercase so we don't mix up Datagram the js library with the datagram the instance.

There's few things we need to do before we can start doing what we really want. First things first, we need a new datagram. This happens by creating a new Datagram instance and then call `ready()` to wait until your Datagram is generated. Depending on the device, cryptographic functions can sometimes be a bit CPU intensive. 

```javascript
const DG = new Datagram()

// or if you are opening existing Datagram

const DG = new Datagram(credentials = { user_id, password })

DG.ready((err, datagram) => {
  // datagram -> your new datagram
  console.log(datagram) // { credentials, settings, ...api }
})

// or with async/await
const datagram = await DG.ready()

// or with Promises
DG.ready().then(datagram => {
  // datagram -> your new datagram
  console.log(datagram) // { credentials, settings, ...api }
})
```

> After you have your new datagram, remember to save your credentials in case you want to open this datagram again in the future.

Now we can start to do more interesting things. Let's say we want to create a group video call datagram that works like Skype or Facetime. First we need to tell Datagram what kind of data are we talking about here. We are talking about a video chat so we choose video. Datagram needs to know if this is a private only-for-your-eyes, a private share with someone, something you want to share with many people or a group setting where everybody's equal. We call these one-to-non, one-to-one, one-to-many and many-to-many. In our case it's a group activity so we go with many-to-many.

```javascript
const template = {
  "datatype": "video",
  "sharemodel": "many-to-many",
  "description": "Me and my entourage",
  "allowed_streams": [ "video" ]
}
```

Depending what you choose as your sharemodel, your datagram will limit others ability to be able to affect your datagram. All one-to-X sharemodels gives you the ability to choose who can post into your datagram and doesn't  allow others to invite new people. If you choose many-to-many, you effectively release the control of this datagram to any anybody who you have invited.

Based on the above description, Datagram can generate a datagram that accepts video streams from anyone. Then we can share it with others.

```javascript
await DG.build({ template })

const sharelink = await DG.share()
// sharelink ->  P4mzRhx1nVO4ZjDPUI3ioJ6XUlyVmJ84... (datagram_address|datagram_encryption_key|index_stream_key)
```

`share()` gives you Datagram address and the encryption key as a string. Everybody is fully aware that the sharelinks looks attrocious and they makes you want to go and over-engineer a solution to make them better but wait! I already went through that and here's some tools I came up with. You can also use all the different sharelinks styles to login into datagrams. Using image file of a QR code as credentials for the first time is rad.

```javascript
// Get it as a qr code
const QR_code_buffer = await DG.share({ type: "qr" })

// Send it over bluetooth
const bluetooths = await DG.utils.getBluetooths()
const pairing_is_successful = await DG.utils.pairBluetooth({ device_id: "fA52gS-dfb23gag" })
if (pairing_is_successful) await DB.share({ type: "bluetooth", device_id: "fA52gS-dfb23gag" })

// Make it a melody (so you can enjoy the sweet sound of peer-to-peer sharing)
const melodylink_buffer = await DG.share({ type: "melody" })

// Use the ubiquotus web to show the content (use datagram.link website or host your own standalone web share server)
const weblink = await DG.share({ type: "web" })
```

Now your job is to somehow share the sharelink of choice with the people you want to participate in the datagram. We might be interested to see what's going on in the datagram to see if anybody is ready to chat... For that we can start `monitor()` that will let you know if new streams are added or there's new data in one of the streams.

```javascript
const state = await DG.monitor({ interval: 0 }) // in seconds - 0 is real-time
// state -> { streams: [ stream ], users: [ user_details ], admin: [ admin_action ], settings: { datatype, sharemodel, ...others } }

// datagram includes a lightweight "terminal" interface which you can bring up when monitoring
await DG.monitor({ internal: 0, ui: true })
```

At some point it might be polite for you to join the group. You can do that by creating a stream of data out of the source of your choosing, and adding it to the datagram. As long as its binary stream and you have a proper data descriptor for it, you can use it. You can use it even without the data descriptor but then nobody except you can read the data right. If a data descriptor is missing for your use case, you can write one for yourself for community verification or make a request for somebody else to write it for you. As long as your data descriptors adheres to the common defined syntax and it is not a duplicate of another data descriptor, it will be community verified. 

Integrating with the browser's camera API is easy so let's go with that.

```javascript
const { user_id } = await DG.getCredentials()
const video_stream = navigator.mediaDevices.getUserMedia()
await DG.addStream({ type: "video", user_id, stream: video_stream)
// and now you are streaming from your webcam/phone to the group
```

If we had chosen to create a datagram with one-to-X sharemodel, we would have to deal with admin side of things. The most important challenge with decentralized network-based systems is to add basic administrative and discussion moderation tools without violating decentralization. Datagram includes a bunch of different ways to create admin and moderation functionality in a way that's compatible with decentralization. They are a set of rules that all Datagrams are default set to follow. Because Datagram is open-source, it's possible to disable any of the rules but this will not affect other users in the network.

Let's go over the tools...

```javascript
// get all admins
const admins = await DG.getAdmins()
// admins -> [ admin ]

// remove an admin
const is_done = await DG.removeAdmin({ admin })
// is_done -> true|false

// get all known users in the datagram
const users = await DG.getUsers()
// users -> [ user ]

// add an admin
const is_done = await DG.addAdmin({ user })
// is_done -> true|false

// block user
const is_done = await DG.blockUser({ user })
// is_done -> true|false

// invite user
const is_done = await DG.inviteUser({ user })
// is_done -> true|false

// destroy datagram (this will also send a request to all participators to delete their copies of the data)
const is_done = await DG.destroy() // as soon as all the copies are deleted, datagram ceases to exist
```

So what if we would like to share our datagram to the whole world. You can do it with one-to-many and many-to-many sharemodels. When you `publish()` your datagram, it's address, encryption key and description is sent to a decentralized and open discovery index. Anybody can add their datagrams into the discovery index and search it for free. You can also run your own discovery index service.

```javascript
const sharelink = await DG.publish()
// returns a sharelink because often the next step is to share the link with others
```

As mentioned, you can also search and monitor the discovery index for things you are interested in. Discovery index returns sharelinks that you will then proceed to open with Datagram.

```javascript
const cyberpunk_2077_posts = await DG.searchIndex({ phrase: "cyperpunk 2077" })
// cyberpunk_2077_posts -> [ sharelink ]
```

You can open any sharelink you receive by created a new Datagram and then using `open()`. Depending on the sharemodel the datagram creator chose, you may or may not be able to add your own stream into the datagram.

```javascript
const cyberpunk_2077_post = await DG.open({ sharelink })
// cyberpunk_2077_post -> { type: "post",  }
```

## Questions or comments?

If you have any questions regarding API, don't hesitate to [raise an issue](https://github.com/machianists/datagram-node/issues) or ask [Marko Polojärvi](https://twitter.com/markopolojarvi).