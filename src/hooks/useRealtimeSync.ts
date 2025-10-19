import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { User } from '@supabase/supabase-js'

interface UseRealtimeSyncProps {
  user: User
  onCourseRegistrationChange?: () => void
  onTrainingSessionChange?: () => void
  onCourseChange?: () => void
}

export const useRealtimeSync = ({
  user,
  onCourseRegistrationChange,
  onTrainingSessionChange,
  onCourseChange
}: UseRealtimeSyncProps) => {
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const triggerReload = useCallback(() => {
    // Clear existing timeout to prevent multiple rapid calls (debouncing)
    if (reloadTimeoutRef.current) {
      clearTimeout(reloadTimeoutRef.current)
    }
    
    // Debounce: wait 300ms before triggering reload to batch rapid events
    reloadTimeoutRef.current = setTimeout(() => {
      // Dispatch custom event for backward compatibility
      window.dispatchEvent(new CustomEvent('courseRegistrationChanged'))
      
      // Call all provided callbacks
      onCourseRegistrationChange?.()
      onTrainingSessionChange?.()
      onCourseChange?.()
    }, 300)
  }, [onCourseRegistrationChange, onTrainingSessionChange, onCourseChange])

  useEffect(() => {
    // Subscribe to course registration changes
    const registrationChannel = supabase
      .channel('course_registrations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'course_registrations',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          console.log('Course registration changed')
          triggerReload()
        }
      )
      .subscribe()

    // Subscribe to training session changes
    const trainingChannel = supabase
      .channel('training_sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'training_sessions',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          console.log('Training session changed')
          triggerReload()
        }
      )
      .subscribe()

    // Subscribe to course changes (affects all users)
    const courseChannel = supabase
      .channel('courses_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'courses'
        },
        () => {
          console.log('Course changed')
          triggerReload()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(registrationChannel)
      supabase.removeChannel(trainingChannel)
      supabase.removeChannel(courseChannel)
    }
  }, [user.id, triggerReload])

  return { triggerReload }
}