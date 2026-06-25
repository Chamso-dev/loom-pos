import { motion, useReducedMotion } from 'framer-motion'
import { ReactNode } from 'react'

interface PageWrapperProps {
  children: ReactNode
}

/**
 * Page transition. Deliberately minimal: a product UI loads into a task, so a
 * quick opacity fade (~160ms, strong ease-out) is enough — no slide-up
 * choreography to sit through on every navigation. Respects reduced-motion.
 */
export default function PageWrapper({ children }: PageWrapperProps) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.16, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  )
}
