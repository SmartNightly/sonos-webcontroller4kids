import { Router } from 'express'
import type { Request, Response } from 'express'
import { APP_VERSION } from '../version'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const gitCommit = process.env.GIT_COMMIT || 'unknown'
  const buildDate = process.env.BUILD_DATE || 'unknown'

  res.json({
    version: APP_VERSION,
    gitCommit,
    // Expose short hash (first 7 chars) if it looks like a full SHA
    gitCommitShort: gitCommit.length > 7 ? gitCommit.slice(0, 7) : gitCommit,
    buildDate,
  })
})

export default router
