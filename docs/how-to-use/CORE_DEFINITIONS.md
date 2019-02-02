# Core Definitions

Core Definitions are JSON schema documents that tell [Core Service](CORE_SERVICE.md) what kind of core you want to contruct.

You can find installed core definitions at [/definitions/cores/installed](/definitions/cores/installed) directory. Feel free to add your own definitions there.

All core definitions must have `@type = datagramCore`, `name` and `description`.

### Core Interfaces

Core Service can attach custom interfaces into a core it creates. This feature allows you to create any type of core you want. For example, `kv` interface turns core into a key/value database.

All available Core Interfaces can be found at [/core/interfaces](/core/interfaces). Feel free to add your own.

If interested, read [how to create your own core interface](/docs/how-to-use/CORE_INTERFACES.md).

## Example Core Definition

This is the Core Definition for Meta Core that Container uses to store information about all the cores it knows about. Meta Core is essentially a key/value database so  the definition requests `kv` interface. It also requests `meta` interface which is a special interface meant only for the meta core.

```
{
  "@context": "http://schema.org/",
  "@type": "datagramCore",
  "name": "Meta",
  "description": "Meta Core keeps track of Cores in the Container. Meant only for Container's internal use.",
  "interfaces": [
    "kv",
    "meta"
  ]
}
```