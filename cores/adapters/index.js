const flatbuffers = require('flatbuffers');
const fs = require('fs');

const example = flatbuffers.compileSchema(fs.readFileSync('example.bfbs'));
const generated = example.generate({ x: 1, y: 2 });
const parsed = example.parse(generated);

console.log('generated:', Array.from(generated));
console.log('parsed:', parsed);

const index = {
  admin: (() => {
    return 
  })(),

}
const 

module.exports = { admin }
