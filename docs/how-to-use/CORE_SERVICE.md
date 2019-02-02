# How to use Core Service

## Get started
```
const { create, load, clone } = require('./core')
```

## General good-to-knows
1. Core Service is for creating and accessing individual cores
2. Core Service offers only the base API to interact with the stream, the rest is optional addon interfaces
3. Core Service deals with individual cores (Containers deal with multiple)
4. [Core Definition](/docs/how-to-use/CORE_DEFINITIONS.md) is always at the position 0

## `create(args, opts)`

Creates a new core based on the core definition.

```
args = { 
  definition: CoreDefinition,
  storage: RandomAccessStorage
}

opts = { 
  keys: { 
    key: Buffer, // core's key
    secret: Buffer // core's secret key
  }
}
```

## `load(args)`

Loads and initializes a stored core based on key. If only `key` is provided, core is opened in read-only mode. Provide `secret` as well to make it readable.

```
args = { 
  keys: { 
    key: Buffer, // Core's key
    secret: Buffer // Core's secret key
  },
  storage: RandomAccessStorage
}
```

## `clone(args)`

Creates an empty clone based on `key`. Clones are always read-only and meant to be a replicated copy of another core.

```
args = { 
  keys: { 
    key: Buffer, // Core's key
  },
  storage: RandomAccessStorage
}
```

## Run tests
```
DEBUG=datagram* npx jest test/cores.js
```