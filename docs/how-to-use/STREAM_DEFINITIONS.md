# Stream Definitions

Stream Definitions are JSON schema documents that tell [Stream Service](CORE_SERVICE.md) what kind of stream you want to contruct.

You can find installed stream definitions at [/definitions/streams/installed](/definitions/streams/installed) directory. Feel free to add your own definitions there.

All stream definitions must have `@type = datagramStream`, `name` and `description`.

### Stream Interfaces

Stream Service can attach custom interfaces into a stream it creates. This feature allows you to create any type of stream you want. For example, `kv` interface turns stream into a key/value database.

All available Stream Interfaces can be found at [/stream/interfaces](/stream/interfaces). Feel free to add your own.

If interested, read [how to create your own stream interface](/docs/how-to-use/CORE_INTERFACES.md).

## Example Stream Definition

This is the Stream Definition for Meta Stream that Container uses to store information about all the streams it knows about. Meta Stream is essentially a key/value database so  the definition requests `kv` interface. It also requests `meta` interface which is a special interface meant only for the meta stream.

```
{
  "@context": "http://schema.org/",
  "@type": "datagramStream",
  "name": "Meta",
  "description": "Meta Stream keeps track of Streams in the Container. Meant only for Container's internal use.",
  "interfaces": [
    "kv",
    "meta"
  ]
}
```