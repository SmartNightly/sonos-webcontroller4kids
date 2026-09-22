import { lazy, Suspense, useEffect, useState } from 'react'
import type { ComponentType } from 'react'

import { API_BASE_URL } from './api'

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
  const previewTemplate = params.get('template')
  const demo =
    !!previewTemplate && Object.hasOwn(templates, previewTemplate) && params.get('demo') === '1'

  const [activeTemplate, setActiveTemplate] = useState<string>('default')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (demo) return
    // Aktives Template vom Backend laden
    fetch(`${API_BASE_URL}/admin/sonos`)
      .then((res) => res.json())
      .then((data) => {
        setActiveTemplate(data.activeTemplate || 'default')
        setLoading(false)
      })
      .catch(() => {
        setActiveTemplate('default')
        setLoading(false)
      })
  }, [demo])

  const templateName = previewTemplate ?? activeTemplate
  const TemplateApp = Object.hasOwn(templates, templateName)
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
      <TemplateApp isAdmin={isAdmin} />
    </Suspense>
  )
}

export default App
