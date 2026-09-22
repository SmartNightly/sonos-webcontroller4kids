import { createContext } from 'react'

export const themeNames: Record<string, string> = {
  default: 'Default',
  classic: 'Classic',
  colorful: 'Colorful Kids',
  hoerinsel: 'Hörinsel',
  wolkenklang: 'Wolkenklang',
}
export const modernThemes = ['default', 'colorful', 'hoerinsel', 'wolkenklang'] as const
export const THEME_STORAGE_KEY = 'kids-theme'
export const ThemeCycleContext = createContext<{
  active: string
  next?: string
  cycle: () => void
  restoreFocus: (button: HTMLButtonElement | null) => void
} | null>(null)
