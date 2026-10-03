import { useEffect, useRef, useState } from 'react'

/** Size of an element, kept up to date as the layout changes. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) })
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return [ref, size.width, size.height] as const
}
