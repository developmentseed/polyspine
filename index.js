const assert = require('assert')
const toPSLG = require('poly-to-pslg')
const cdt2d = require('cdt2d')
const linear = require('linear-solve')

module.exports = polyspine

/**
 * @param {GeoJSON} input
 */
function polyspine (input, options) {
  switch (input.type) {
    case 'FeatureCollection':
      return flatten(input.features.map(function (feature) {
        return polyspine(feature, options)
      }))
    case 'Feature':
      return polyspine(input.geometry, options)
    case 'MultiPolygon':
      return flatten(input.coordinates.map(polygonSpine))
    case 'Polygon':
      return polygonSpine(input.coordinates)
    case 'MultiLineString':
      return input.coordinates
    case 'LineString':
      return [input.coordinates]
    case 'Point':
      return []
  }

  function polygonSpine (poly) {
    const pslg = toPSLG(poly, { nested: true, clean: true })
    const indexToCoordinates = function (i) { return pslg.points[i] }
    const cdt = cdt2d(pslg.points, pslg.edges, { exterior: false })

    let strips = decompose(cdt)
    strips = strips.map(strip => strip.map(t => cdt[t].map(indexToCoordinates)))
    return strips.map(strip => strip.map(circumcenter))

    // return cdt.map(function (t) {
    //   t = t.map(indexToCoordinates)
    //   t.push(t[0].slice())
    //   return t
    // })
  }
}

function decompose (cdt) {
  const g = cdtGraph(cdt)

  return dfs(g.incidents.findIndex(i => i.length === 1))

  function dfs (node, prefix) {
    if (!prefix) {
      prefix = []
    }

    prefix.push(node)

    const children = getChildren(node)

    if (children.length === 0) {
      return [prefix]
    }

    // follow edges
    edges(node).forEach(e => { e.used = true })

    const childPaths = flatten(children.map(child => dfs(child, [node])))
    const connected = childPaths.filter(cp => cp[0] === node)
    const maxLength = Math.max.apply(null, connected.map(p => p.length))
    const best = connected.find(p => p.length === maxLength)
    childPaths.splice(childPaths.indexOf(best), 1, prefix.concat(best))
    return childPaths

    function edges (i) {
      return g.incidents[i].filter(edge => !edge.used)
    }

    function getChildren (i) {
      return edges(i).map(e => e[e[0] === i ? 1 : 0])
    }
  }
}

function cdtGraph (cdt) {
  const index = {}
  const edges = []
  const incidents = new Array(cdt.length)
  for (let i = 0; i < incidents.length; i++) {
    incidents[i] = []
  }

  cdt.forEach(function (t, i) {
    add(t[0], t[1], i)
    add(t[1], t[2], i)
    add(t[2], t[0], i)
  })

  function add (p1, p2, i) {
    const key = `${p1}-${p2}`
    const reverse = `${p2}-${p1}`
    assert(!index.hasOwnProperty(key))
    index[key] = i
    if (index.hasOwnProperty(reverse)) {
      const j = index[reverse]
      const edge = [i, j]
      edges.push(edge)
      incidents[i].push(edge)
      incidents[j].push(edge)
    }
  }

  return {
    edges: edges,
    incidents: incidents
  }
}

function circumcenter (triangle) {
  const o = triangle[0]
  const a = (triangle[1][0] - o[0]) / 2
  const b = (triangle[1][1] - o[1]) / 2
  const c = (triangle[2][0] - o[0]) / 2
  const d = (triangle[2][1] - o[1]) / 2

  const s = a * a + b * b
  const t = c * c + d * d
  const u = (a - c) * (a - c) + (b - d) * (b - d)

  if (s + t < u || t + u < s || u + s < t) {
    // triangle is obtuse - yield centroid instead of circumcenter
    return [
      (triangle[0][0] + triangle[1][0] + triangle[2][0]) / 3,
      (triangle[0][1] + triangle[1][1] + triangle[2][1]) / 3
    ]
  }

  const det = a * d - b * c
  if (det === 0) {
    // this should never happen, as it means we have a "triangle" with two
    // parallel sides
    return null
  }

  const center = linear.solve([[a, b], [c, d]], [ a * a + b * b, c * c + d * d ])

  return [
    center[0] + o[0],
    center[1] + o[1]
  ]
}

function flatten (arrays) {
  return Array.prototype.concat.apply([], arrays)
}

