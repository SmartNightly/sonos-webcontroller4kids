import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'

import { API_BASE_URL } from './api'
import { modernThemes, ThemeCycleContext, THEME_STORAGE_KEY } from './themeSettings'

const ModernKidsApp = lazy(() => import('./components/ModernKidsApp'))

// Create each lazy component once, so renders never replace its identity.
const defaultTemplate = lazy(() => import('./templates/default/App.tsx'))
const templateLoaders = import.meta.glob<{ default: ComponentType<{ isAdmin: boolean }> }>(
  './templates/*/App.tsx',
)
const templates = Object.fromEntries(
  Object.entries(templateLoaders).map(([path, load]) => [
    path.split('/')[2],
    lazy<ComponentType<{ isAdmin: boolean }>>(() =>
      load().catch(() => import('./templates/default/App.tsx')),
    ),
  ]),
)

function App() {
  const params = new URLSearchParams(window.location.search)
  const isAdmin = params.get('admin') === '1'
  // A local preview never changes the installation's active template.
  const [previewTemplate] = useState(() => params.get('template'))
  const demo =
    !!previewTemplate && Object.hasOwn(templates, previewTemplate) && params.get('demo') === '1'

  const [activeTemplate, setActiveTemplate] = useState<string>(demo ? previewTemplate! : 'default')
  const [enabledTemplates, setEnabledTemplates] = useState<string[]>(
    demo ? [...modernThemes] : ['default'],
  )
  const [loading, setLoading] = useState(true)
  const restoreFocus = useRef(false)
  const focusThemeButton = (button: HTMLButtonElement | null) => {
    if (restoreFocus.current && button) {
      button.focus()
      restoreFocus.current = false
    }
  }

  useEffect(() => {
    if (demo) return
    let controller: AbortController
    let initial = true
    const refresh = async () => {
      controller?.abort()
      controller = new AbortController()
      const signal = controller.signal
      try {
        const res = await fetch(`${API_BASE_URL}/admin/sonos`, { signal })
        if (!res.ok) throw new Error('Template-Konfiguration nicht verfügbar')
        const data = await res.json()
        if (signal.aborted) return
        const fallback = Object.hasOwn(templates, data.activeTemplate)
          ? data.activeTemplate
          : 'default'
        const allowed = [
          ...new Set<string>(
            (Array.isArray(data.enabledTemplates) ? data.enabledTemplates : [fallback]).filter(
              (name: unknown) => typeof name === 'string' && Object.hasOwn(templates, name),
            ),
          ),
        ]
        if (!allowed.length) allowed.push(fallback)
        let saved: string | null = null
        try {
          saved = localStorage.getItem(THEME_STORAGE_KEY)
        } catch {
          /* Private mode */
        }
        const preferred = initial ? (previewTemplate ?? saved) : null
        const wasInitial = initial
        setActiveTemplate((current) =>
          isAdmin
            ? fallback
            : preferred && allowed.includes(preferred)
              ? preferred
              : !wasInitial && allowed.includes(current)
                ? current
                : allowed.includes(fallback)
                  ? fallback
                  : allowed[0],
        )
        setEnabledTemplates(allowed)
        initial = false
      } catch {
        // Keep a working selection on transient refresh failures.
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    }
    void refresh()
    window.addEventListener('focus', refresh)
    const interval = window.setInterval(refresh, 30000)
    return () => {
      controller?.abort()
      window.removeEventListener('focus', refresh)
      clearInterval(interval)
    }
  }, [demo, isAdmin, previewTemplate])

  const templateName = activeTemplate
  const next =
    enabledTemplates.length > 1
      ? enabledTemplates[(enabledTemplates.indexOf(activeTemplate) + 1) % enabledTemplates.length]
      : undefined
  const cycle = () => {
    if (!next) return
    restoreFocus.current = true
    setActiveTemplate(next)
    if (!demo) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        /* Switching still works */
      }
      const url = new URL(window.location.href)
      url.searchParams.delete('template')
      window.history.replaceState({}, '', url)
    }
  }
  const TemplateApp = isAdmin
    ? defaultTemplate
    : Object.hasOwn(templates, templateName)
      ? templates[templateName]
      : defaultTemplate

  if (loading && !demo) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontSize: '24px',
          color: '#666',
        }}
      >
        Lade Template...
      </div>
    )
  }

  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            fontSize: '24px',
            color: '#666',
          }}
        >
          Lade {previewTemplate ?? activeTemplate}...
        </div>
      }
    >
      <ThemeCycleContext.Provider
        value={{ active: templateName, next, cycle, restoreFocus: focusThemeButton }}
      >
        {(!isAdmin || demo) &&
        modernThemes.includes(templateName as (typeof modernThemes)[number]) ? (
          <ModernKidsApp theme={templateName as (typeof modernThemes)[number]} demo={demo} />
        ) : (
          <TemplateApp isAdmin={isAdmin} />
        )}
      </ThemeCycleContext.Provider>
    </Suspense>
  )
}

export default App
