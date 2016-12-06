var fs = require('fs')
var path = require('path')
var polyspine = require('../')

var input = JSON.parse(fs.readFileSync(path.join(__dirname, 'input.geojson')))

var features = polyspine(input).map(function (linestring) {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: linestring
    }
  }
})

input.features = input.features.concat(features).reverse()
console.log(JSON.stringify(input))
