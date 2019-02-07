# How to use Stream Service

## Get started
```
const { create, load, clone } = require('./stream')
```

## General good-to-knows
1. Stream Service is for creating and accessing individual streams
2. Stream Service offers only the base API to interact with the stream, the rest is optional addon interfaces
3. Stream Service deals with individual streams (Containers deal with multiple)
4. [Stream Definition](/docs/how-to-use/CORE_DEFINITIONS.md) is always at the position 0

## `create(args, opts)`

Creates a new stream based on the stream definition.

```
args = { 
  definition: StreamDefinition,
  storage: RandomAccessStorage
}

opts = { 
  keys: { 
    key: Buffer, // stream's key
    secret: Buffer // stream's secret key
  }
}
```

## `load(args)`

Loads and initializes a stored stream based on key. If only `key` is provided, stream is opened in read-only mode. Provide `secret` as well to make it readable.

```
args = { 
  keys: { 
    key: Buffer, // Stream's key
    secret: Buffer // Stream's secret key
  },
  storage: RandomAccessStorage
}
```

## `clone(args)`

Creates an empty clone based on `key`. Clones are always read-only and meant to be a replicated copy of another stream.

```
args = { 
  keys: { 
    key: Buffer, // Stream's key
  },
  storage: RandomAccessStorage
}
```

## Run tests
```
DEBUG=datagram* npx jest test/streams.js
```