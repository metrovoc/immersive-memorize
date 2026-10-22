// Copies the version from package.json into manifest.json, keeping the manifest's formatting.
const fs = require('fs')
const path = require('path')

const manifestPath = path.join(__dirname, '..', 'manifest.json')
const { version } = require('../package.json')
const manifest = fs.readFileSync(manifestPath, 'utf8')
fs.writeFileSync(manifestPath, manifest.replace(/"version": "[^"]*"/, `"version": "${version}"`))
console.log(`manifest.json version set to ${version}`)
