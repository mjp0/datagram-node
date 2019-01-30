const fs = require('fs')
const request = require('superagent')

function fetch_schemas(callback) {
  request.get('https://schema.org/docs/tree.jsonld').end((err, body) => {
    callback(err, body.text.trim())
  })
}

// fetch_schemas(() => {})
const schemas = {}
fetch_schemas((err, jsonschema) => {
  if (err) throw err
  const json = JSON.parse(jsonschema)
  const p = parseNested()
  const jsonloop = new p(json, 'name', 'children')
  jsonloop.countNodes(json)
  console.log(schemas)
  const path = `${__dirname}/../descriptors/installed/`
  console.log(`Found ${Object.keys(schemas).length} schemas, storing to ${path}`)
  for (const schema in schemas) {
    if (schemas.hasOwnProperty(schema)) {
      const s = schemas[schema]
      console.log(`Storing schema ${s.name} to ${s.name.toLowerCase()}.json`)
      fs.writeFileSync(`${path}${s.name.toLowerCase()}.json`, JSON.stringify(s))
    }
  }
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
