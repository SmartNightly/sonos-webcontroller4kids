import { Router } from 'express'
import type { Request, Response } from 'express'
import { APP_VERSION } from '../version'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', version: APP_VERSION })
})

export default router
