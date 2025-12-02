import { useState, useEffect } from "react"
import { User } from "@supabase/supabase-js"
import { supabase } from "@/integrations/supabase/client"
import { useRealtimeSync } from "@/hooks/useRealtimeSync"
import { startOfMonth, addMonths, format } from "date-fns"


interface MonthlyTrainingCalendarProps {
  user: User
  userRole?: string
}

export const MonthlyTrainingCalendar = ({ user, userRole }: MonthlyTrainingCalendarProps) => {
  const [trainingDays, setTrainingDays] = useState<Set<number>>(new Set())
  const [registeredDays, setRegisteredDays] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)

  // Use real-time sync hook
  useRealtimeSync({
    user,
    onCourseRegistrationChange: () => setTimeout(() => loadTrainingDays(), 100),
    onTrainingSessionChange: () => setTimeout(() => loadTrainingDays(), 100)
  })

  useEffect(() => {
    loadTrainingDays()
  }, [user.id])

  const loadTrainingDays = async () => {
    try {
      const currentDate = new Date()
      const firstDayOfMonth = startOfMonth(currentDate)
      const firstDayOfNextMonth = startOfMonth(addMonths(currentDate, 1))
      const firstDayStr = format(firstDayOfMonth, 'yyyy-MM-dd')
      const nextMonthStr = format(firstDayOfNextMonth, 'yyyy-MM-dd')
      
      // Load training sessions
      const { data: sessions, error } = await supabase
        .from('training_sessions')
        .select('session_date')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('session_date', firstDayStr)
        .lt('session_date', nextMonthStr)

      if (error) {
        console.error('Error loading training days:', error)
        return
      }

      const days = new Set<number>()
      sessions?.forEach(session => {
        const sessionDate = new Date(session.session_date)
        days.add(sessionDate.getDate())
      })

      // Load course registrations and check for auto-completion
      const { data: registrations, error: regError } = await supabase
        .from('course_registrations')
        .select(`
          course_id,
          courses(course_date, end_time)
        `)
        .eq('user_id', user.id)
        .eq('status', 'registered')
        .gte('courses.course_date', firstDayStr)
        .lt('courses.course_date', nextMonthStr)

      const regDays = new Set<number>()
      if (!regError && registrations) {
        for (const reg of registrations) {
          if (reg.courses?.course_date) {
            const courseDate = new Date(reg.courses.course_date)
            const day = courseDate.getDate()

            // Mark ALL days with course registrations (past, present, future)
            regDays.add(day)

            // Handle auto-completion for past courses
            if (reg.courses.end_time) {
              const courseEndTime = new Date(`${reg.courses.course_date}T${reg.courses.end_time}`)
              const now = new Date()
              
              if (now > courseEndTime) {
                days.add(day)

                // Use upsert with ignoreDuplicates to prevent race conditions
                // The UNIQUE index on (user_id, session_date, session_type) ensures no duplicates
                const { error: upsertError } = await supabase
                  .from('training_sessions')
                  .upsert({
                    user_id: user.id,
                    session_date: reg.courses.course_date,
                    session_type: 'course',
                    status: 'completed'
                  }, {
                    onConflict: 'user_id,session_date,session_type',
                    ignoreDuplicates: true
                  })
                
                if (upsertError) {
                  console.error('Error creating training session:', upsertError)
                }
              }
            }
          }
        }
      }

      console.log('Training days:', Array.from(days))
      console.log('Registered days:', Array.from(regDays))
      setTrainingDays(days)
      setRegisteredDays(regDays)
    } catch (error) {
      console.error('Error loading training days:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysInMonth = () => {
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth()
    return new Date(currentYear, currentMonth + 1, 0).getDate()
  }

  const getCurrentDay = () => {
    return new Date().getDate()
  }

  const getDayStatus = (day: number) => {
    const currentDay = getCurrentDay()
    
    if (trainingDays.has(day)) {
      return "bg-green-500" // Trained - green
    } else if (day < currentDay) {
      return "bg-red-500" // Missed - red
    } else {
      return "bg-gray-400" // Future - gray (even if registered)
    }
  }

  const getDayBorderClass = (day: number) => {
    const currentDay = getCurrentDay()
    const isRegistered = registeredDays.has(day)
    const isTrained = trainingDays.has(day)
    
    if (day < currentDay) {
      // Past days
      if (isTrained) {
        return "!border-2 !border-green-500" // Trained - green border
      } else {
        return "!border-2 !border-red-500" // Not trained - red border
      }
    } else {
      // Future days
      if (isRegistered) {
        return "!border-2 !border-green-400" // Registered - green border
      } else {
        return "border border-gray-400" // Not registered - gray border
      }
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-1">
        {Array.from({ length: getDaysInMonth() }, (_, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-full bg-gray-200 animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 md:gap-1.5">
      {Array.from({ length: getDaysInMonth() }, (_, i) => {
        const day = i + 1
        const currentDay = getCurrentDay()
        const isRegistered = registeredDays.has(day)
        
        return (
          <div
            key={day}
            className={`w-3 md:w-4 h-3 md:h-4 rounded-full ${getDayStatus(day)} ${getDayBorderClass(day)} transition-all duration-200 relative flex items-center justify-center`}
            title={`Day ${day}: ${
              trainingDays.has(day) 
                ? 'Trained' 
                : isRegistered
                ? 'Registered for course'
                : day < getCurrentDay() 
                ? 'Not trained' 
                : 'Future day'
            }`}
          >
          </div>
        )
      })}
    </div>
  )
}