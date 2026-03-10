import { vi, describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'

vi.mock('../../src/version', () => ({ APP_VERSION: '1.0.0-test' }))

import healthRouter from '../../src/routes/health'

const app = express()
app.use('/health', healthRouter)

describe('GET /health', () => {
  it('returns status ok and version', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(typeof res.body.version).toBe('string')
  })
})
