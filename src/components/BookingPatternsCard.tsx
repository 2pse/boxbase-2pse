import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/integrations/supabase/client"
import { Clock } from "lucide-react"

interface BookingPattern {
  dayOfWeek: string
  hour: number
  registrations: number
}

export const BookingPatternsCard = () => {
  const [patterns, setPatterns] = useState<BookingPattern[]>([])
  const [mostPopular, setMostPopular] = useState<BookingPattern | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBookingPatterns()
  }, [])

  const loadBookingPatterns = async () => {
    try {
      // Get course registrations with course data from the last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data: registrations, error } = await supabase
        .from('course_registrations')
        .select(`
          registered_at,
          courses!inner(
            course_date,
            start_time
          )
        `)
        .eq('status', 'registered')
        .gte('courses.course_date', thirtyDaysAgo.toISOString().split('T')[0])

      if (error) throw error

      // Process data to find patterns
      const patternMap = new Map<string, number>()
      
      registrations?.forEach(registration => {
        const courseDate = new Date(registration.courses.course_date)
        const dayOfWeek = courseDate.toLocaleDateString('de-DE', { weekday: 'short' })
        
        // Extract hour from start_time (format: "HH:MM:SS")
        const startTime = registration.courses.start_time
        const hour = startTime ? parseInt(startTime.split(':')[0]) : 18
        
        const key = `${dayOfWeek}-${hour}`
        patternMap.set(key, (patternMap.get(key) || 0) + 1)
      })

      // Convert to array and get top patterns
      const dayOrder = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
      const allPatterns = Array.from(patternMap.entries())
        .map(([key, count]) => {
          const [dayOfWeek, hourStr] = key.split('-')
          return {
            dayOfWeek,
            hour: parseInt(hourStr),
            registrations: count
          }
        })

      // Sort chronologically for display
      const topPatterns = [...allPatterns]
        .sort((a, b) => {
          // First sort by day of week
          const dayA = dayOrder.indexOf(a.dayOfWeek)
          const dayB = dayOrder.indexOf(b.dayOfWeek)
          if (dayA !== dayB) return dayA - dayB
          // Then sort by hour
          return a.hour - b.hour
        })
        .slice(0, 8)

      // Find most popular pattern for summary
      const mostPopularPattern = allPatterns.reduce((max, current) => 
        current.registrations > max.registrations ? current : max, 
        allPatterns[0]
      )

      setPatterns(topPatterns)
      setMostPopular(mostPopularPattern)
    } catch (error) {
      console.error('Error loading booking patterns:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Booking patterns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-4 bg-muted rounded flex-1 mr-4"></div>
                <div className="h-4 w-8 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Booking patterns
        </CardTitle>
        <p className="text-xs text-muted-foreground">30 days</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {patterns.length === 0 ? (
            <p className="text-muted-foreground text-sm">No booking data available</p>
          ) : (
            patterns.map((pattern, index) => (
              <div key={`${pattern.dayOfWeek}-${pattern.hour}`} className="flex justify-between items-center text-sm">
                <span className="font-medium">
                  {pattern.dayOfWeek} {pattern.hour}:00
                </span>
                 <div className="flex items-center gap-2">
                   <div 
                     className="h-2 bg-primary rounded-full"
                     style={{ 
                       width: `${Math.max(20, (pattern.registrations / (mostPopular?.registrations || 1)) * 60)}px` 
                     }}
                   ></div>
                   <span className="w-8 text-right text-muted-foreground">
                     {pattern.registrations}
                   </span>
                 </div>
              </div>
            ))
          )}
        </div>
        {patterns.length > 0 && mostPopular && (
          <div className="pt-3 border-t mt-3 space-y-1">
            <p className="text-xs text-muted-foreground">
              Most bookings: {mostPopular.dayOfWeek} {mostPopular.hour}:00 ({mostPopular.registrations} bookings)
            </p>
            <p className="text-xs text-muted-foreground">
              Bar = relative frequency, number = absolute bookings
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}