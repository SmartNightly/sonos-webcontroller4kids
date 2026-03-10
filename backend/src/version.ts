import fs from 'node:fs'
import path from 'node:path'

// Reads version from package.json at module load time.
// __dirname is backend/src/ in dev (ts-node) and backend/dist/ in production,
// so '../package.json' always resolves to backend/package.json.
const pkgJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'),
) as { version?: string }

export const APP_VERSION: string = pkgJson.version ?? '0.0.0'
