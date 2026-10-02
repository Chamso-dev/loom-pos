import { useEffect, useState } from 'react'

/** Tracks a CSS media query, e.g. useMediaQuery('(max-width: 767px)'). */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}

/** Phones and small tablets, where the sidebar becomes a slide-in menu. */
export const useIsPhone = () => useMediaQuery('(max-width: 767px)')
