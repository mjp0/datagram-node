# Core Interfaces

Core Interfaces are a custom interfaces that work on top of Core's base API. Interfaces are meant to be a way to turn data streams into any kind of data structure you can imagine, and code. All interfaces have direct access to the data stream and can also use other interfaces.

*Note: Currently Core Definitions do not enforce dependencies so Core Definition needs to explicitly add all required interfaces*

## Example Core Interface
```javascript
exports.modules = {
  '@id': 'my_interface',                                  // unique name
  '@depends': ['kv'],                                     // not used yet but will be
  positionRead: (API, stream) => {                        // initialization wrapper
      return async (feed_position) => {                   // your function starts
        return new Promise(async (done, error) => {       // yes, promises
          // read the position via API
          // remember to catch(error)
          const pos_data = await API.get(feed_position).catch(error)

          // read the position directly from stream
          // stream supports only callbacks
          stream.get(feed_position, (err, dpos_data) => {
            if(err) return error(err)

            // When you are done, say it
            done(dpos_data)
          })
        })
      })
  }
}
```

As you can see from above, the structure of interface call is simple. It starts with `(API, stream) => {}` which is used to pass in core's API and direct access to the stream.

Your interface function is a simple async/await function that takes in whatever input you want and spits out the result. Interface function are used to both read and write.

> **You must save your interface with the exact name you choose as `@id`**

## Adding your interface to a core
### Via Core Definition
Add your interface's `@id` name to your Core Definition's `interfaces` set and it will be loaded automatically. Remember to store your interface at `/core/interfaces`.

### Programmatically
Core Base API has a method `core.addInterface(interface_name)` that you can use to add your interface to any core adhoc.  Remember to store your interface at `/core/interfaces`.