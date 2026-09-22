import { useContext, useLayoutEffect, useRef } from 'react'
import { ThemeCycleContext, themeNames } from '../themeSettings'
import './ThemeCycleButton.css'

export function ThemeCycleButton({ theme }: { theme: string }) {
  const settings = useContext(ThemeCycleContext)
  const button = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    settings?.restoreFocus(button.current)
  }, [settings])
  const name = themeNames[settings?.active ?? theme] ?? theme
  if (!settings?.next) return <span className="theme-name">{name}</span>
  return (
    <button
      ref={button}
      type="button"
      className="theme-cycle"
      onClick={settings.cycle}
      aria-label={`${name}: nächstes Theme ${themeNames[settings.next] ?? settings.next}`}
      title="Tippen für das nächste Theme"
    >
      {name}
    </button>
  )
}
