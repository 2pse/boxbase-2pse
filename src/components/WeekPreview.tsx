import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { useRealtimeSync } from "@/hooks/useRealtimeSync"
import { timezone } from "@/lib/timezone"
import { DayCourseDialog } from "./DayCourseDialog"

interface WeekPreviewProps {
  user: User
  userRole?: string
  primaryColor?: string
  userMembershipType?: string | null
}

interface DayInfo {
  date: string
  dayName: string
  dayNumber: number
  isToday: boolean
  hasRegistration: boolean
  hasWaitlist: boolean
  courseCount: number
}

export const WeekPreview: React.FC<WeekPreviewProps> = ({ user, userRole, primaryColor, userMembershipType }) => {
  const [weekData, setWeekData] = useState<DayInfo[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Setup real-time sync
  useRealtimeSync({
    user,
    onCourseRegistrationChange: () => loadWeekData(),
    onCourseChange: () => loadWeekData()
  })

  useEffect(() => {
    loadWeekData()
  }, [user.id])

  // Listen for course registration events for instant updates
  useEffect(() => {
    const handleCourseRegistrationChanged = () => {
      loadWeekData()
    }

    window.addEventListener('courseRegistrationChanged', handleCourseRegistrationChanged)
    
    return () => {
      window.removeEventListener('courseRegistrationChanged', handleCourseRegistrationChanged)
    }
  }, [])

  const loadWeekData = async () => {
    try {
      const today = timezone.nowInBerlin()
      const weekDays: DayInfo[] = []

      // Generate 7 days starting from today
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(today)
        currentDate.setDate(today.getDate() + i)
        
        const dateString = currentDate.toISOString().split('T')[0]
        
        weekDays.push({
          date: dateString,
          dayName: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
          dayNumber: currentDate.getDate(),
          isToday: i === 0,
          hasRegistration: false,
          hasWaitlist: false,
          courseCount: 0
        })
      }

      // Only load course data if not Open Gym membership
      const isOpenGym = userMembershipType === 'open_gym_only'
      
      if (!isOpenGym) {
        // Load course registrations for the week
        const startDate = weekDays[0].date
        const endDate = weekDays[6].date

        const { data: registrations } = await supabase
          .from('course_registrations')
          .select(`
            status,
            courses(course_date, id)
          `)
          .eq('user_id', user.id)
          .in('status', ['registered', 'waitlist'])
          .gte('courses.course_date', startDate)
          .lte('courses.course_date', endDate)

        // Load all courses for the week to count available courses
        const { data: allCourses } = await supabase
          .from('courses')
          .select('course_date, id')
          .eq('is_cancelled', false)
          .gte('course_date', startDate)
          .lte('course_date', endDate)

        // Update week data with registration info
        weekDays.forEach(day => {
          const dayRegistrations = registrations?.filter(r => r.courses?.course_date === day.date) || []
          const dayCourses = allCourses?.filter(c => c.course_date === day.date) || []
          
          day.hasRegistration = dayRegistrations.some(r => r.status === 'registered')
          day.hasWaitlist = dayRegistrations.some(r => r.status === 'waitlist')
          day.courseCount = dayCourses.length
        })
      }

      setWeekData(weekDays)
      setLoading(false)
    } catch (error) {
      console.error('Error loading week data:', error)
      setLoading(false)
    }
  }

  const getDayStyle = (day: DayInfo) => {
    if (day.isToday) {
      return 'bg-primary text-primary-foreground'
    } else if (day.hasRegistration) {
      return `bg-green-50 dark:bg-green-950 border-2 border-green-500 text-green-700 dark:text-green-300`
    } else if (day.hasWaitlist) {
      return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-500 border-2 text-yellow-700 dark:text-yellow-300'
    } else {
      return 'bg-muted text-muted-foreground hover:bg-muted/80'
    }
  }

  const getRegisteredBorderStyle = (day: DayInfo) => {
    return {} // Border styling now handled in getDayStyle
  }

  if (loading) {
    return (
      <div className="h-full flex items-center">
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl p-4">
          <div className="flex gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex-1 h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="h-full flex items-center w-full">
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl p-1 md:p-3 hover:bg-gray-150 dark:hover:bg-gray-700 transition-all hover:scale-[1.01]">
          <div className="flex gap-1 md:gap-2">
            {weekData.map((day) => (
              <button
                key={day.date}
                onClick={() => setSelectedDate(day.date)}
                className={`min-w-0 flex-1 p-1.5 md:p-3.5 rounded-lg transition-all hover:scale-105 ${getDayStyle(day)}`}
                style={getRegisteredBorderStyle(day)}
              >
                <div className="text-center">
                  <div className="text-xs md:text-sm font-medium mb-0.5 md:mb-1">{day.dayName}</div>
                  <div className="text-sm md:text-lg font-bold">{day.dayNumber}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {selectedDate && (
        <DayCourseDialog
          open={!!selectedDate}
          onOpenChange={(open) => !open && setSelectedDate(null)}
          date={selectedDate}
          user={user}
          userRole={userMembershipType === 'Open Gym' ? 'open_gym' : userRole}
        />
      )}
    </>
  )
}