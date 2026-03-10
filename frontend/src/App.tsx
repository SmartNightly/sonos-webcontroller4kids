import { lazy, Suspense, useEffect, useState, useMemo } from 'react'

// API Base URL - verwendet relative URL in Production, localhost in Development
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:3344' : ''

function App() {
  const params = new URLSearchParams(window.location.search)
  const isAdmin = params.get('admin') === '1'

  const [activeTemplate, setActiveTemplate] = useState<string>('default')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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
  }, [])

  // Template-Komponente dynamisch laden (memoized, um bei jedem Render neu zu erstellen)
  const TemplateApp = useMemo(() => {
    return lazy(
      () =>
        import(`./templates/${activeTemplate}/App.tsx`).catch(
          () => import('./templates/default/App.tsx'),
        ), // Fallback
    )
  }, [activeTemplate])

  if (loading) {
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
          Lade {activeTemplate}...
        </div>
      }
    >
      <TemplateApp isAdmin={isAdmin} />
    </Suspense>
  )
}

export default App
