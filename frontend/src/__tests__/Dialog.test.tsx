import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { Dialog } from '../components/Dialog'

function Example({ busy = false }: { busy?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Bearbeiten</button>
      {open && (
        <Dialog title="Titel bearbeiten" busy={busy} onClose={() => setOpen(false)}>
          <input aria-label="Titel" />
          <button onClick={() => setOpen(false)}>Abbrechen</button>
        </Dialog>
      )}
    </>
  )
}

describe('Dialog keyboard navigation', () => {
  it('traps focus, makes the background inert and restores focus on Escape', async () => {
    const user = userEvent.setup()
    render(<Example />)
    const trigger = screen.getByRole('button', { name: 'Bearbeiten' })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: 'Titel bearbeiten' })).toHaveAttribute(
      'aria-modal',
      'true',
    )
    expect(trigger.inert).toBe(true)
    expect(screen.getByRole('textbox', { name: 'Titel' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('textbox', { name: 'Titel' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger.inert).not.toBe(true)
    expect(trigger).toHaveFocus()
  })

  it('prevents Escape from closing during a save, and uses the latest busy state', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Example busy />)
    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }))
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true')
    rerender(<Example />)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
