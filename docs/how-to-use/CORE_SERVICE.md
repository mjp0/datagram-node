# How to use Core Service

```
const { createNewCore, loadCore, removeCore } = require('./core')
```

## General observations and good-to-knows
1. Core Service is for creating and accessing the data stream
2. Core Service offers only the basic get and add functions, the rest is optional addons
3. Core Service deals with individual cores (Containers deal with multiple)

# `createCore(args, opts)`

Args:
```
{ 
  definition: CoreDefinition, // 
  storage: RandomAccessStorage
}
```