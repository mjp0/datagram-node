const fs = require('fs')
const path = require('path')
const debug = require('../utils/debug')(__filename)
const { sdoValidate } = require('schemaorg-jsd')
const msgpack = require('msgpack5')()

const descriptor_registry = {}
const descriptors = fs.readdirSync(path.join(__dirname, 'installed'))

descriptors.forEach((s) => {
  const descriptor = require(path.join(__dirname, 'installed', s))
  descriptor_registry[descriptor.context['@id']] = descriptor
})

const _get = async (name) => {
  return new Promise(async (done, error) => {
    if (descriptor_registry[`http://schema.org/${name}`]) {
      const d = descriptor_registry[`http://schema.org/${name}`]
      d.keys = d.properties.map((dprop) => {
        let ranges = dprop['http://schema.org/rangeIncludes']
        if (Array.isArray(ranges)) {
          ranges = ranges.map((r) => r['@id'])
        } else {
          ranges = [ ranges['@id'] ]
        }
        return { key: dprop['rdfs:label'], types: ranges }
      })
      done(JSON.parse(JSON.stringify(d)))
    } else {
      error(new Error('DESCRIPTOR_NOT_FOUND'))
    }
  })
}

exports.get = async (name) => {
  return new Promise(async (done, error) => {
    const descriptor = await _get(name).catch(error)
    delete descriptor.properties // if you want these, use getRaw
    done(descriptor)
  })
}

exports.getRaw = async (name) => {
  return new Promise(async (done, error) => {
    const descriptor = await _get(name, []).catch(error)
    done(descriptor)
  })
}

exports.describe = async (descriptor, data) => {
  return new Promise(async (done, error) => {
    const described_data = {
      '@context': 'http://schema.org/',
      '@type': descriptor.context['@id'],
    }
    for (const d in data) {
      if (data.hasOwnProperty(d)) {
        described_data[d] = data[d]
      }
    }
    // DISABLED UNTIL FIGURED OUT HOW TO DO CUSTOM VALIDATORS
    // const is_valid_descriptor = await sdoValidate(described_data, descriptor.context['rdfs:label']).catch(error)
    // if (is_valid_descriptor) {
    //   done(described_data)
    // } else {
    //   error(new Error('BAD_STATE'))
    // }
    done(described_data)
  })
}

exports.create = async (descriptor_name, data) => {
  return new Promise(async (done, error) => {
    const descriptor = await exports.get(descriptor_name).catch(error)
    if (!descriptor) return error(new Error('NO_DESCRIPTOR_FOUND'))

    const described_data = await exports.describe(descriptor, data).catch(error)
    const described_data_finalized = await exports.finalize(described_data).catch(error)
    done(described_data_finalized)
  })
}

exports.finalize = async (described_data) => {
  return new Promise(async (done) => {
    done(msgpack.encode(described_data))
  })
}

exports.read = async (packed_described_data) => {
  return new Promise(async (done) => {
    done(msgpack.decode(packed_described_data))
  })
}
