const path = require("path");

console.log(path.join('./', 'packages/dev-tools'))
console.log(path.join('./', 'blockera'))

console.log(path.join(path.join('./', 'blockera'), path.join('./', 'packages/dev-tools')))