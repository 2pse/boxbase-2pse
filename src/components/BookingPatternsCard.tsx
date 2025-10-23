import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/integrations/supabase/client"
import { Clock, ChevronLeft, ChevronRight } from "lucide-react"

interface BookingPattern {
  dayOfWeek: string
  hour: number
  registrations: number
}

export const BookingPatternsCard = () => {
  const [patterns, setPatterns] = useState<BookingPattern[]>([])
  const [allPatterns, setAllPatterns] = useState<BookingPattern[]>([])
  const [mostPopular, setMostPopular] = useState<BookingPattern | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(0)
  const itemsPerPage = 10

  useEffect(() => {
    loadBookingPatterns()
  }, [])

  // Update patterns when page changes
  useEffect(() => {
    const start = currentPage * itemsPerPage
    const end = start + itemsPerPage
    setPatterns(allPatterns.slice(start, end))
  }, [currentPage, allPatterns])

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
        const dayOfWeek = courseDate.toLocaleDateString('en-US', { weekday: 'short' })
        
        // Extract hour from start_time (format: "HH:MM:SS")
        const startTime = registration.courses.start_time
        const hour = startTime ? parseInt(startTime.split(':')[0]) : 18
        
        const key = `${dayOfWeek}-${hour}`
        patternMap.set(key, (patternMap.get(key) || 0) + 1)
      })

      // Convert to array and get top patterns
      const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
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
      const sortedPatterns = [...allPatterns]
        .sort((a, b) => {
          // First sort by day of week
          const dayA = dayOrder.indexOf(a.dayOfWeek)
          const dayB = dayOrder.indexOf(b.dayOfWeek)
          if (dayA !== dayB) return dayA - dayB
          // Then sort by hour
          return a.hour - b.hour
        })

      setAllPatterns(sortedPatterns)
      const topPatterns = sortedPatterns.slice(0, itemsPerPage)

      // Find most popular pattern for summary
      const mostPopularPattern = allPatterns.reduce((max, current) => 
        current.registrations > max.registrations ? current : max, 
        allPatterns[0]
      )

      setPatterns(topPatterns)
      setCurrentPage(0)
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
        
        {allPatterns.length > itemsPerPage && (
          <div className="flex justify-between items-center pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {currentPage + 1} of {Math.ceil(allPatterns.length / itemsPerPage)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={(currentPage + 1) * itemsPerPage >= allPatterns.length}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
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