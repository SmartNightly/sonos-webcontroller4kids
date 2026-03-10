import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'

vi.mock('../../src/version', () => ({ APP_VERSION: '1.2.3-test' }))

import versionRouter from '../../src/routes/version'

const app = express()
app.use('/version', versionRouter)

describe('GET /version', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    delete process.env.GIT_COMMIT
    delete process.env.BUILD_DATE
  })

  afterEach(() => {
    process.env.GIT_COMMIT = originalEnv.GIT_COMMIT
    process.env.BUILD_DATE = originalEnv.BUILD_DATE
  })

  it('returns version and defaults when env vars not set', async () => {
    const res = await request(app).get('/version')
    expect(res.status).toBe(200)
    expect(res.body.version).toBe('1.2.3-test')
    expect(res.body.gitCommit).toBe('unknown')
    expect(res.body.gitCommitShort).toBe('unknown')
    expect(res.body.buildDate).toBe('unknown')
  })

  it('returns git commit and build date from env vars', async () => {
    process.env.GIT_COMMIT = 'abc1234567890abcdef'
    process.env.BUILD_DATE = '2025-01-15T10:00:00Z'

    const res = await request(app).get('/version')
    expect(res.status).toBe(200)
    expect(res.body.gitCommit).toBe('abc1234567890abcdef')
    expect(res.body.gitCommitShort).toBe('abc1234')
    expect(res.body.buildDate).toBe('2025-01-15T10:00:00Z')
  })

  it('uses full commit as short when commit is already short', async () => {
    process.env.GIT_COMMIT = 'abc123'

    const res = await request(app).get('/version')
    expect(res.body.gitCommitShort).toBe('abc123')
  })
})
