import { lazy } from 'react'

/**
 * The dashboard, loaded on first visit. Only managers open it, so cashiers at the till never
 * download its code and charts. The single-file demo swaps this module for a direct import
 * (see vite.demo.config.ts), as a sandboxed page cannot fetch split code.
 */
export const Dashboard = lazy(() => import('./Dashboard'))
