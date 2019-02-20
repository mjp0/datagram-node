const fs = require('fs')
const request = require('superagent')

function fetch_schemas(callback) {
  request.get('http://schema.org/version/latest/schema.jsonld').end((err, body) => {
    callback(err, body.text.trim())
  })
}

// fetch_schemas(() => {})
const schemas = {}
fetch_schemas((err, jsonschema) => {
  if (err) throw err
  const json = JSON.parse(jsonschema)

  // console.log(json['@graph'])
  const schemas = json['@graph']
  // const p = parseNested()
  // const jsonloop = new p(json, 'name', 'children')
  // jsonloop.countNodes(json)
  // console.log(schemas)

  // Get property values
  const properties = schemas.filter((s) => {
    // @type can be either an array or a singleton object
    if (Array.isArray(s['@type'])) {
      if (s['@type'].indexOf('rdf:Property') !== -1) return true
    } else if (s['@type'] && s['@type'] === 'rdf:Property') return true
    else return false
  })

  // Get property datatypes
  const datatypes = schemas.filter((s) => {
    // @type can be either an array or a singleton object
    // console.log(s['@type'], Array.isArray(s['@type']))
    if (Array.isArray(s['@type'])) {
      if (s['@type'].indexOf('http://schema.org/DataType') !== -1) return true
    } else if (s['@type'] && s['@type'] === 'http://schema.org/DataType') return true
    else return false
  })
  console.log(datatypes)
  // process.exit()

  const path = `${__dirname}/../descriptors/installed/`
  console.log(`Found ${schemas.length} schemas, storing to ${path}`)
  const jsons = []
  for (const schema in schemas) {
    if (schemas.hasOwnProperty(schema)) {
      const s = schemas[schema]
      if (s['@type'] && !s['@type'].toString().match(/Property/)) {
        const name = s['rdfs:label']
        if (name) {
          // Find out all properties associated with this
          const ass_properties = properties.filter((prop) => {
            const domainIncludes = prop['http://schema.org/domainIncludes']
            if (domainIncludes) {
              // @type can be either an array or a singleton object
              if (Array.isArray(domainIncludes)) {
                domainIncludes.forEach((di) => {
                  if (di['@id'] === s['@id']) return true
                })
              } else if (domainIncludes['@id'] === s['@id']) return true
              else return false
            }
          })

          // Find out all properties associated with this

          // what we want is a list of datatypes associated with the properties
          // loop through each datatype and find out if any of the properties use it (more efficient than the other way)
          // const ass_datatypes = {}

          // datatypes.forEach((datatype) => {
          //   ass_properties.forEach(ass_prop => {
          //     const rangeIncludes = ass_prop['http://schema.org/rangeIncludes']
          //     if (rangeIncludes) {
          //       console.log(rangeIncludes)
          //       // @type can be either an array or a singleton object
          //       if (Array.isArray(rangeIncludes)) {
          //         rangeIncludes.forEach((di) => {
          //           if (di['@id'] === datatypes['@id']) ass_datatypes[datatype['@id']] = datatype
          //         })
          //       } else if (rangeIncludes['@id'] === datatype['@id']) ass_datatypes[datatype['@id']] = datatype
          //       else return false
          //     }
          //   })
          // })
          // console.log(s, ass_properties)
          console.log(`Storing schema ${name} to ${name.toLowerCase()}.json`)
          jsons.push({ context: s, properties: ass_properties })
        }
      }
    }
  }

  fs.writeFileSync(
    `${path}schema_org.json`,
    JSON.stringify(jsons),
  )
})

function parseNested() {
  let nodes = []
  class JSONLoop {
    constructor(obj, idPropertyName, childrenPropertyName) {
      this.id = idPropertyName
      this.children = childrenPropertyName
      this.count = 0
      this.countNodes(obj)
      this.total = this.count + 0
    }
    isEmpty(obj) {
      for (const property in obj) {
        return false
      }
      return true
    }
    countNodes(obj) {
      const that = this
      this.count++
      return (function() {
        if (!obj || that.isEmpty(obj)) {
          return false
        } else {
          // console.log(obj)
          const obj_clone = JSON.parse(JSON.stringify(obj))
          delete obj_clone.children
          schemas[obj_clone.name] = obj_clone
          if (obj[that.children]) {
            obj[that.children].forEach(function(child) {
              that.countNodes(child)
            })
          }
        }
      })()
    }
    generateClone(obj) {
      const target = {}
      for (const i in obj) {
        if (i !== this.children) {
          target[i] = obj[i]
        }
      }
      return target
    }
    getAllNodes(obj, id, callback) {
      schemas[this.id] = obj
      if (obj[this.children]) {
        const that = this
        obj[this.children].forEach(function(node) {
          that.getAllNodes(node, id, callback)
        })
      }
    }
    findNodeById(obj, id, callback) {
      if (obj[this.id] === id) {
        this.count = this.total + 0
        callback(null, obj)
      } else {
        if (this.count === 1) {
          this.count = this.total + 0
          callback('the node does not exist', null)
        }
        this.count--
        if (obj[this.children]) {
          const that = this
          obj[this.children].forEach(function(node) {
            that.findNodeById(node, id, callback)
          })
        }
      }
    }
    matchConditions(obj, conditions) {
      let flag = true
      Object.keys(conditions).forEach(function(item) {
        if (typeof conditions[item] === 'string' || typeof conditions[item] === 'number') {
          if (obj[item] !== conditions[item]) {
            flag = false
            return false
          }
        } else if (conditions[item] instanceof RegExp) {
          if (!conditions[item].test(obj[item])) {
            flag = false
            return false
          }
        } else if (typeof conditions[item] === 'object') {
          Object.keys(conditions[item]).forEach(function(subitem) {
            switch (subitem) {
              case '>': {
                if (!(obj[item] > conditions[item][subitem])) {
                  flag = false
                  return false
                }
                break
              }
              case '<': {
                if (!(obj[item] < conditions[item][subitem])) {
                  flag = false
                  return false
                }
                break
              }
              case '>=': {
                if (!(obj[item] >= conditions[item][subitem])) {
                  flag = false
                  return false
                }
                break
              }
              case '<=': {
                if (!(obj[item] <= conditions[item][subitem])) {
                  flag = false
                  return false
                }
                break
              }
              case '!==': {
                if (!(obj[item] !== conditions[item][subitem])) {
                  flag = false
                  return false
                }
                break
              }
            }
          })
          if (!flag) {
            return false
          }
        }
      })
      if (!flag) {
        return false
      }

      return true
    }
    findNodes(obj, conditions, callback) {
      const that = this
      let copy = [] // ths shallow copy of nodes array
      return (function(obj, conditions, callback) {
        if (that.matchConditions(obj, conditions)) {
          nodes.push(obj)
          if (that.count === 1) {
            that.count = that.total + 0
            copy = nodes.slice(0)
            nodes = []
            callback(null, copy)
          }
          that.count--
        } else {
          if (that.count === 1) {
            that.count = that.total + 0
            copy = nodes.slice(0)
            nodes = []
            callback(null, copy)
          }
          that.count--
          if (obj[that.children]) {
            obj[that.children].forEach(function(child) {
              that.findNodes(child, conditions, callback)
            })
          }
        }
      })(obj, conditions, callback)
    }
    findParent(obj, node, callback, needCleanNode) {
      const that = this
      if (this.count === 1) {
        this.count = this.total + 0
        callback('its parent node does not exist', null)
      } else {
        this.count--
        if (typeof obj[this.children] !== 'undefined') {
          let notFind = true
          obj[this.children].forEach(function(item) {
            if (item[that.id] === node[that.id]) {
              that.count = that.total + 0
              if (needCleanNode) {
                callback(null, that.generateClone(obj))
              } else {
                callback(null, obj)
              }
              notFind = false
              return false
            }
          })
          if (notFind) {
            obj[this.children].forEach(function(item) {
              that.findParent(item, node, callback)
            })
          }
        }
      }
    }
    findSiblings(obj, node, callback) {
      const that = this
      this.findParent(
        obj,
        node,
        function(err, parent) {
          if (err) {
            callback('its sibling nodes do not exist', null)
          } else {
            const siblings = []
            parent[that.children].forEach(function(item) {
              if (item[that.id] !== node[that.id]) {
                siblings.push(that.generateClone(item))
              }
            })
            callback(null, siblings)
          }
        },
        false,
      )
    }
    findAncestors(obj, node, callback) {
      const that = this
      if (node[this.id] === obj[this.id]) {
        const copy = nodes.slice(0)
        nodes = []
        callback(null, copy)
      } else {
        this.findParent(obj, node, function(err, parent) {
          if (err) {
            callback('its ancestor nodes do not exist', null)
          } else {
            nodes.push(parent)
            that.findAncestors(obj, parent, callback)
          }
        })
      }
    }
  }
  return JSONLoop
}
