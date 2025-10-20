import { useState, useEffect } from "react"
import { Dumbbell } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { useRealtimeSync } from "@/hooks/useRealtimeSync"
import { timezone } from "@/lib/timezone"

interface MonthlyProgressCircleProps {
  user: User
  trainingCount: number
  onDataChange?: () => void
}

interface DayData {
  dayNumber: number
  hasTraining: boolean
  hasRegistration: boolean
  isPast: boolean
  isFuture: boolean
  isToday: boolean
}

export const MonthlyProgressCircle: React.FC<MonthlyProgressCircleProps> = ({
  user,
  trainingCount,
  onDataChange
}) => {
  const [monthlyData, setMonthlyData] = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)

  // Setup real-time sync
  useRealtimeSync({
    user,
    onCourseRegistrationChange: () => loadMonthlyData(),
    onTrainingSessionChange: () => loadMonthlyData()
  })

  useEffect(() => {
    loadMonthlyData()
  }, [user.id])

  const loadMonthlyData = async () => {
    try {
      const today = timezone.nowInBerlin()
      const currentMonth = today.getMonth()
      const currentYear = today.getFullYear()
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
      
      // Load training sessions for the month
      const { data: sessions } = await supabase
        .from('training_sessions')
        .select('session_date, status')
        .eq('user_id', user.id)
        .gte('session_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
        .lt('session_date', `${currentYear}-${String(currentMonth + 2).padStart(2, '0')}-01`)

      // Load course registrations for the month
      const { data: registrations } = await supabase
        .from('course_registrations')
        .select(`
          course_id,
          status,
          courses(course_date)
        `)
        .eq('user_id', user.id)
        .eq('status', 'registered')
        .gte('courses.course_date', `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`)
        .lt('courses.course_date', `${currentYear}-${String(currentMonth + 2).padStart(2, '0')}-01`)

      // Create day data
      const dayData: DayData[] = []
      for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = timezone.createDateInBerlin(currentYear, currentMonth, day)
        const dayString = currentDate.toISOString().split('T')[0]
        
        const hasTraining = sessions?.some(s => s.session_date === dayString && s.status === 'completed') || false
        const hasRegistration = registrations?.some(r => r.courses?.course_date === dayString) || false
        
        dayData.push({
          dayNumber: day,
          hasTraining,
          hasRegistration,
          isPast: currentDate < today && !timezone.isSameDayInBerlin(currentDate, today),
          isFuture: currentDate > today,
          isToday: timezone.isSameDayInBerlin(currentDate, today)
        })
      }

      setMonthlyData(dayData)
      setLoading(false)
      onDataChange?.()
    } catch (error) {
      console.error('Error loading monthly data:', error)
      setLoading(false)
    }
  }

  const getDotColor = (day: DayData) => {
    if (day.hasTraining) {
      return 'fill-green-500' // Completed training - filled with green
    } else if (day.hasRegistration) {
      return 'fill-none stroke-green-500 stroke-2' // Course registration - green border
    } else if (day.isPast) {
      return 'fill-black dark:fill-white' // Past days without training - black
    } else {
      return 'fill-gray-300 dark:fill-gray-600' // Future days - gray
    }
  }

  const renderCircleDots = () => {
    const radius = 140
    const centerX = 180
    const centerY = 180
    
    return monthlyData.map((day, index) => {
      const angle = (index / monthlyData.length) * 2 * Math.PI - Math.PI / 2
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      
      return (
        <circle
          key={day.dayNumber}
          cx={x}
          cy={y}
          r="6"
          className={getDotColor(day)}
        />
      )
    })
  }

  if (loading) {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 flex items-center justify-center h-48">
        <div className="animate-pulse text-muted-foreground">Loading Monthly Overview...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center">
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 360 360" 
        className="drop-shadow-sm w-full md:w-[117%] h-full md:h-[117%]"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Circle dots for each day */}
        {renderCircleDots()}
        
        {/* Center content */}
        <g transform="translate(180, 180)">
          {/* Dumbbell icon */}
          <foreignObject x="-20" y="-85" width="40" height="40">
            <Dumbbell className="h-10 w-10 text-primary" />
          </foreignObject>
          
          {/* Training count */}
          <text
            x="0"
            y="20"
            textAnchor="middle"
            className="fill-foreground text-6xl font-bold"
          >
            {trainingCount}
          </text>
        </g>
      </svg>
    </div>
  )
}