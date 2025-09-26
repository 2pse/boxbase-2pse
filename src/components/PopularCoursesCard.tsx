import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/integrations/supabase/client"
import { Star } from "lucide-react"

interface PopularCourse {
  title: string
  registrations: number
  avgUtilization: number
}

export const PopularCoursesCard = () => {
  const [courses, setCourses] = useState<PopularCourse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPopularCourses()
  }, [])

  const loadPopularCourses = async () => {
    try {
      // Get courses with registration counts from the last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data: coursesData, error } = await supabase
        .from('courses')
        .select(`
          title,
          max_participants,
          course_registrations!inner(
            status
          )
        `)
        .eq('status', 'active')
        .eq('course_registrations.status', 'registered')
        .gte('course_date', thirtyDaysAgo.toISOString().split('T')[0])

      if (error) throw error

      // Group by title and calculate stats
      const courseStats = new Map<string, { registrations: number; totalCapacity: number; courseCount: number }>()
      
      coursesData?.forEach(course => {
        const title = course.title
        const current = courseStats.get(title) || { registrations: 0, totalCapacity: 0, courseCount: 0 }
        
        courseStats.set(title, {
          registrations: current.registrations + 1,
          totalCapacity: current.totalCapacity + (course.max_participants || 0),
          courseCount: current.courseCount + 1
        })
      })

      // Convert to array and calculate utilization
      const popularCourses = Array.from(courseStats.entries())
        .map(([title, stats]) => ({
          title,
          registrations: stats.registrations,
          avgUtilization: stats.totalCapacity > 0 ? (stats.registrations / stats.totalCapacity) * 100 : 0
        }))
        .sort((a, b) => b.registrations - a.registrations)
        .slice(0, 5)

      setCourses(popularCourses)
    } catch (error) {
      console.error('Error loading popular courses:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Most popular courses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-4 bg-muted rounded flex-1 mr-4"></div>
                <div className="h-6 w-12 bg-muted rounded"></div>
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
          <Star className="h-5 w-5 text-primary" />
          Most popular courses
        </CardTitle>
        <p className="text-xs text-muted-foreground">30 days</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {courses.length === 0 ? (
            <p className="text-muted-foreground text-sm">No course data available</p>
          ) : (
            courses.map((course, index) => (
              <div key={course.title} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    #{index + 1}
                  </span>
                  <span className="text-sm font-medium">{course.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {course.registrations}x Bookings
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(course.avgUtilization)}% Utilization
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}