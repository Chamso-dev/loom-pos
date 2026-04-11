import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useStore } from '@/store/useStore'

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: 'ADMIN' | 'CASHIER'
}

export default function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { user, token } = useStore()
  const location = useLocation()

  if (!user || !token) {
    // Redirect to login but save the attempted url
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRole && user.role !== requiredRole && user.role !== 'ADMIN') {
    // If user doesn't have required role and is not an admin, redirect to /billing
    return <Navigate to="/billing" replace />
  }

  return <>{children}</>
}
