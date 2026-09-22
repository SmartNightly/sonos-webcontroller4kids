import KidsView from './KidsView'
import type { modernThemes } from '../themeSettings'
import '../templates/default/App.css'
import '../templates/colorful/App.css'
import '../templates/wolkenklang/App.css'

// One component identity preserves player, room and navigation during theme changes.
export default function ModernKidsApp({
  theme,
  demo,
}: {
  theme: (typeof modernThemes)[number]
  demo: boolean
}) {
  return <KidsView theme={theme} demo={demo} />
}
