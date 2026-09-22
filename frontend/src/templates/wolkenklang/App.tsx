import { lazy, Suspense } from 'react'
import KidsView from '../../components/KidsView'
import './App.css'

const Admin = lazy(() => import('../default/App'))

export default function App({ isAdmin }: { isAdmin: boolean }) {
  const demo = new URLSearchParams(window.location.search).get('demo') === '1'
  if (isAdmin && !demo)
    return (
      <Suspense fallback={<p>Elternbereich wird geladen…</p>}>
        <Admin isAdmin />
      </Suspense>
    )
  return <KidsView demo={demo} theme="wolkenklang" />
}
