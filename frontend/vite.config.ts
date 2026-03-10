import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootPkg = JSON.parse(
  readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'),
) as { version?: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Inject app version from root package.json at build time
    __APP_VERSION__: JSON.stringify(rootPkg.version ?? '0.0.0'),
  },
})
