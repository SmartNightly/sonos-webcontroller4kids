import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import cors from 'cors'

import healthRouter from './routes/health'
import mediaRouter from './routes/media'
import adminRouter from './routes/admin'
import sonosRouter from './routes/sonos'

const app = express()
const PORT = parseInt(process.env.PORT || '3344', 10)

app.use(cors())
app.use(express.json())

app.use('/health', healthRouter)
app.use('/media', mediaRouter)
app.use('/admin', adminRouter)
app.use(sonosRouter) // handles /sonos/control, /sonos/status, /play, /search/apple

// Serve static frontend files in production (MUSS AM ENDE kommen!)
const frontendPath = path.join(__dirname, '..', '..', 'frontend', 'dist')
console.log('Frontend-Pfad:', frontendPath)
console.log('Frontend existiert:', fs.existsSync(frontendPath))
if (fs.existsSync(frontendPath)) {
  console.log('Frontend-Dateien werden ausgeliefert von:', frontendPath)
  app.use(express.static(frontendPath))

  // SPA fallback - serve index.html for all non-API routes
  app.use((req, res, next) => {
    if (
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/media') &&
      !req.path.startsWith('/admin') &&
      !req.path.startsWith('/sonos') &&
      !req.path.startsWith('/search') &&
      !req.path.startsWith('/play')
    ) {
      res.sendFile(path.join(frontendPath, 'index.html'))
    } else {
      next()
    }
  })
} else {
  console.error('WARNUNG: Frontend-Verzeichnis nicht gefunden:', frontendPath)
}

app.listen(PORT, () => {
  console.log(`Backend läuft auf http://localhost:${PORT}`)
})
