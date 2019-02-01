# How to use Core Service

```
const { create, load, clone } = require('./core')
```

## General good-to-knows
1. Core Service is for creating and accessing the data stream
2. Core Service offers only the base API to interact with the stream, the rest is optional addons
3. Core Service deals with individual cores (Containers deal with multiple)
4. Core Definition is always at the position 0
5. 


# `createCore(args, opts)`

Args:
```
{ 
  definition: CoreDefinition, // 
  storage: RandomAccessStorage
}
```