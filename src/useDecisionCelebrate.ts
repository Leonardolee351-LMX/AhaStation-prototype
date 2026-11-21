import { useEffect, useRef, useState } from 'react'

export function useDecisionCelebrate(pendingCount: number, duration = 2800) {
  const previous = useRef(pendingCount)
  const [celebrating, setCelebrating] = useState(false)

  useEffect(() => {
    const wasPending = previous.current > 0
    previous.current = pendingCount
    if (!wasPending || pendingCount > 0) return
    setCelebrating(true)
    const timer = window.setTimeout(() => setCelebrating(false), duration)
    return () => window.clearTimeout(timer)
  }, [pendingCount, duration])

  return celebrating
}
