import { useCallback } from 'react'
import { useDemoMode } from '@/contexts/DemoModeContext'
import { toast } from 'sonner'

/**
 * Hook that guards mutations in demo mode.
 * Returns a function that checks if demo mode is active.
 * If active, shows a toast and returns true (block operation).
 * If not active, returns false (allow operation).
 */
export const useDemoGuard = () => {
  const { isDemoMode } = useDemoMode()

  const guardMutation = useCallback((customMessage?: string): boolean => {
    if (isDemoMode) {
      toast.info(customMessage || 'Demo Mode: Changes will not be saved', {
        duration: 3000,
        icon: '🎮'
      })
      return true // Block the operation
    }
    return false // Allow the operation
  }, [isDemoMode])

  return { isDemoMode, guardMutation }
}
