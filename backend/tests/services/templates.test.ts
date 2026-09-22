import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'

vi.mock('node:fs', () => ({
  default: { existsSync: vi.fn(), readFileSync: vi.fn(), readdirSync: vi.fn() },
}))
import { listTemplates } from '../../src/services/templates'

beforeEach(() => vi.resetAllMocks())

describe('template manifest', () => {
  it('loads templates in production without frontend source files', () => {
    vi.mocked(fs.existsSync).mockImplementation((file) =>
      String(file).endsWith('dist/templates.json'),
    )
    vi.mocked(fs.readFileSync).mockReturnValue('["colorful","default"]')
    expect(listTemplates()).toEqual(['colorful', 'default'])
    expect(fs.readdirSync).not.toHaveBeenCalled()
  })

  it('discovers only valid template entry points in development', () => {
    vi.mocked(fs.existsSync).mockImplementation((file) => String(file).endsWith('/default/App.tsx'))
    vi.mocked(fs.readdirSync).mockReturnValue(['default', 'README.md', 'empty'] as any)
    expect(listTemplates()).toEqual(['default'])
  })

  it('rejects invalid manifest names', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('["../backend"]')
    expect(() => listTemplates()).toThrow('Ungültiges Template-Manifest')
  })
})
