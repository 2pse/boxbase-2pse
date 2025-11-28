import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { supabase } from "@/integrations/supabase/client"
import { User } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { startOfWeek, subWeeks, format, isWithinInterval, endOfWeek } from 'date-fns'
import { de } from 'date-fns/locale'

interface MemberStatsDialogProps {
  userId: string
  displayName: string
  firstName?: string | null
  lastName?: string | null
  totalBookings?: number
  totalTrainings?: number
  cancellations?: number
  isOpen: boolean
  onClose: () => void
}

interface WeeklyActivity {
  week: string
  weekStart: Date
  course_bookings: number
  open_gym: number
}

interface MemberStats {
  total_bookings: number
  total_trainings: number
  cancellations: number
  bookings_by_day: Record<string, number>
  trainings_by_day: Record<string, number>
  bookings_by_trainer: Record<string, number>
  preferred_day: string
  preferred_time: string
  preferred_training_day: string
  preferred_trainer: string
  cancellation_rate: number
  weekly_activity: WeeklyActivity[]
}

const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const dayOrder = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export const MemberStatsDialog = ({
  userId,
  displayName,
  firstName,
  lastName,
  totalBookings = 0,
  totalTrainings = 0,
  cancellations = 0,
  isOpen,
  onClose
}: MemberStatsDialogProps) => {
  const [showOpenGym, setShowOpenGym] = useState(false)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['member-stats', userId],
    queryFn: async (): Promise<MemberStats> => {
      // Calculate date range for last 12 weeks
      const now = new Date()
      const twelveWeeksAgo = subWeeks(now, 12)

      // Fetch bookings with course details
      const { data: bookings } = await supabase
        .from('course_registrations')
        .select(`
          registered_at,
          courses(course_date, start_time, trainer)
        `)
        .eq('user_id', userId)
        .eq('status', 'registered')

      // Fetch Open Gym trainings
      const { data: trainings } = await supabase
        .from('training_sessions')
        .select('session_date')
        .eq('user_id', userId)
        .eq('session_type', 'free_training')

      // Fetch cancellations
      const { data: cancelledBookings } = await supabase
        .from('course_registrations')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'cancelled')

      // Calculate bookings by day of week
      const bookingsByDay: Record<string, number> = {}
      const trainingsByDay: Record<string, number> = {}
      const bookingsByTrainer: Record<string, number> = {}
      const bookingTimes: string[] = []

      dayOrder.forEach(day => {
        bookingsByDay[day] = 0
        trainingsByDay[day] = 0
      })

      bookings?.forEach(booking => {
        const course = booking.courses as any
        if (course?.course_date) {
          const date = new Date(course.course_date)
          const day = dayNames[date.getDay()]
          bookingsByDay[day] = (bookingsByDay[day] || 0) + 1
          
          if (course.start_time) {
            bookingTimes.push(course.start_time)
          }
          
          if (course.trainer) {
            bookingsByTrainer[course.trainer] = (bookingsByTrainer[course.trainer] || 0) + 1
          }
        }
      })

      trainings?.forEach(training => {
        if (training.session_date) {
          const date = new Date(training.session_date)
          const day = dayNames[date.getDay()]
          trainingsByDay[day] = (trainingsByDay[day] || 0) + 1
        }
      })

      // Calculate weekly activity for the last 12 weeks
      const weeklyActivity: WeeklyActivity[] = []
      for (let i = 11; i >= 0; i--) {
        const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 }) // Monday
        const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
        
        // Count course bookings in this week
        const courseCount = bookings?.filter(booking => {
          const course = booking.courses as any
          if (!course?.course_date) return false
          const courseDate = new Date(course.course_date)
          return isWithinInterval(courseDate, { start: weekStart, end: weekEnd })
        }).length || 0

        // Count open gym sessions in this week
        const openGymCount = trainings?.filter(training => {
          if (!training.session_date) return false
          const sessionDate = new Date(training.session_date)
          return isWithinInterval(sessionDate, { start: weekStart, end: weekEnd })
        }).length || 0

        weeklyActivity.push({
          week: `KW ${format(weekStart, 'w', { locale: de })}`,
          weekStart,
          course_bookings: courseCount,
          open_gym: openGymCount
        })
      }

      // Find preferred day for bookings
      let preferredDay = '-'
      let maxBookings = 0
      Object.entries(bookingsByDay).forEach(([day, count]) => {
        if (count > maxBookings) {
          maxBookings = count
          preferredDay = day
        }
      })

      // Find preferred day for trainings
      let preferredTrainingDay = '-'
      let maxTrainings = 0
      Object.entries(trainingsByDay).forEach(([day, count]) => {
        if (count > maxTrainings) {
          maxTrainings = count
          preferredTrainingDay = day
        }
      })

      // Find preferred time
      let preferredTime = '-'
      if (bookingTimes.length > 0) {
        const timeCounts: Record<string, number> = {}
        bookingTimes.forEach(time => {
          const hour = time.split(':')[0]
          timeCounts[hour] = (timeCounts[hour] || 0) + 1
        })
        let maxTimeCount = 0
        Object.entries(timeCounts).forEach(([hour, count]) => {
          if (count > maxTimeCount) {
            maxTimeCount = count
            preferredTime = `${hour}:00`
          }
        })
      }

      // Find preferred trainer
      let preferredTrainer = '-'
      let maxTrainerCount = 0
      Object.entries(bookingsByTrainer).forEach(([trainer, count]) => {
        if (count > maxTrainerCount) {
          maxTrainerCount = count
          preferredTrainer = trainer
        }
      })

      const totalBookingsCount = bookings?.length || 0
      const cancellationsCount = cancelledBookings?.length || 0
      const cancellationRate = totalBookingsCount > 0 
        ? (cancellationsCount / (totalBookingsCount + cancellationsCount)) * 100 
        : 0

      return {
        total_bookings: totalBookingsCount,
        total_trainings: trainings?.length || 0,
        cancellations: cancellationsCount,
        bookings_by_day: bookingsByDay,
        trainings_by_day: trainingsByDay,
        bookings_by_trainer: bookingsByTrainer,
        preferred_day: preferredDay,
        preferred_time: preferredTime,
        preferred_training_day: preferredTrainingDay,
        preferred_trainer: preferredTrainer,
        cancellation_rate: cancellationRate,
        weekly_activity: weeklyActivity
      }
    },
    enabled: isOpen
  })

  const dataByDay = showOpenGym ? (stats?.trainings_by_day || {}) : (stats?.bookings_by_day || {})
  const maxValue = Math.max(...Object.values(dataByDay), 1)
  const title = showOpenGym ? 'Open Gym per Weekday' : 'Course Bookings per Weekday'

  const memberName = firstName && lastName 
    ? `${firstName} ${lastName}` 
    : displayName

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {memberName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{stats.total_bookings}</div>
                <div className="text-xs text-muted-foreground">Bookings</div>
              </div>
              <div className="bg-muted rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{stats.total_trainings}</div>
                <div className="text-xs text-muted-foreground">Open Gym</div>
              </div>
              <div className="bg-muted rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{stats.cancellations}</div>
                <div className="text-xs text-muted-foreground">Cancellations</div>
              </div>
            </div>

            {/* Preferences */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">Preferences</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-2">
                  <div className="text-xs text-muted-foreground">Preferred Day</div>
                  <div className="font-medium">{stats.preferred_day}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <div className="text-xs text-muted-foreground">Preferred Time</div>
                  <div className="font-medium">{stats.preferred_time}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <div className="text-xs text-muted-foreground">Preferred Trainer</div>
                  <div className="font-medium">{stats.preferred_trainer}</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <div className="text-xs text-muted-foreground">Cancellation Rate</div>
                  <div className="font-medium">{stats.cancellation_rate.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            {/* Bar Chart with Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground">{title}</h4>
                <div className="flex items-center gap-2">
                  <Label htmlFor="show-open-gym" className="text-xs text-muted-foreground">
                    Open Gym
                  </Label>
                  <Switch
                    id="show-open-gym"
                    checked={showOpenGym}
                    onCheckedChange={setShowOpenGym}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                {dayOrder.map((day) => (
                  <div key={day} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-8">{day}</span>
                    <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                        style={{ width: `${Math.max((dataByDay[day] || 0) / maxValue * 100, dataByDay[day] > 0 ? 15 : 0)}%` }}
                      >
                        {dataByDay[day] > 0 && (
                          <span className="text-xs font-medium text-primary-foreground">
                            {dataByDay[day]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Weekly Activity Line Chart - Last 3 Months */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">
                Activity (Last 3 Months)
              </h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.weekly_activity}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fontSize: 10 }} 
                    interval={1}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    allowDecimals={false} 
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line 
                    type="monotone" 
                    dataKey="course_bookings" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2} 
                    name="Course Bookings"
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="open_gym" 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2} 
                    name="Open Gym"
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}