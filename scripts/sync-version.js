const fs = require('fs')
const path = require('path')

// Read package.json version
const packageJsonPath = path.join(__dirname, '..', 'package.json')
const manifestJsonPath = path.join(__dirname, '..', 'manifest.json')

try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'))

  // Update manifest version to match package.json
  manifestJson.version = packageJson.version

  // Write back to manifest.json
  fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2) + '\n')

  console.log(`✅ Version synced to ${packageJson.version} in manifest.json`)
} catch (error) {
  console.error('❌ Error syncing version:', error.message)
  process.exit(1)
}
