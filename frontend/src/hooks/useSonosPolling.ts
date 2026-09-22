import { useEffect, useEffectEvent } from 'react'
import { requestJson } from '../api'

export interface SonosStatus {
  available?: boolean
  state?: string
  volume?: number
  shuffle?: boolean
  repeat?: string
  trackNo?: number
  track?: {
    title?: string
    artist?: string
    album?: string
    positionMs?: number
    durationMs?: number
  }
}

export function useSonosPolling(room: string | null, onStatus: (status: SonosStatus) => void) {
  const receiveStatus = useEffectEvent(onStatus)

  useEffect(() => {
    if (!room) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined

    const poll = async () => {
      controller = new AbortController()
      const signal = controller.signal
      const timeout = setTimeout(() => controller?.abort(), 5000)
      try {
        const data = await requestJson<SonosStatus>(
          `/sonos/status?room=${encodeURIComponent(room)}`,
          { signal },
        )
        if (!disposed && !signal.aborted) receiveStatus(data)
      } catch (error) {
        if (!disposed && !signal.aborted) console.error('Status-Polling-Fehler:', error)
      } finally {
        clearTimeout(timeout)
        if (!disposed) timer = setTimeout(poll, 2000)
      }
    }

    void poll()
    return () => {
      disposed = true
      clearTimeout(timer)
      controller?.abort()
    }
  }, [room])
}
