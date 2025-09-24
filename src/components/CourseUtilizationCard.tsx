import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/integrations/supabase/client"
import { TrendingUp } from "lucide-react"

interface CourseStats {
  totalCourses: number
  totalCapacity: number
  totalRegistrations: number
  utilizationRate: number
  avgParticipants: number
}

export const CourseUtilizationCard = () => {
  const [stats, setStats] = useState<CourseStats>({
    totalCourses: 0,
    totalCapacity: 0,
    totalRegistrations: 0,
    utilizationRate: 0,
    avgParticipants: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCourseUtilization()
  }, [])

  const loadCourseUtilization = async () => {
    try {
      // Get courses from the last 30 days
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select(`
          id,
          max_participants,
          course_registrations(count)
        `)
        .eq('status', 'active')
        .gte('course_date', thirtyDaysAgo.toISOString().split('T')[0])

      if (coursesError) throw coursesError

      const totalCourses = courses?.length || 0
      const totalCapacity = courses?.reduce((sum, course) => sum + (course.max_participants || 0), 0) || 0
      const totalRegistrations = courses?.reduce((sum, course) => {
        return sum + (course.course_registrations?.[0]?.count || 0)
      }, 0) || 0

      const utilizationRate = totalCapacity > 0 ? (totalRegistrations / totalCapacity) * 100 : 0
      const avgParticipants = totalCourses > 0 ? totalRegistrations / totalCourses : 0

      setStats({
        totalCourses,
        totalCapacity,
        totalRegistrations,
        utilizationRate,
        avgParticipants
      })
    } catch (error) {
      console.error('Error loading course utilization:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Kursauslastung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded"></div>
            <div className="h-6 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Kursauslastung
        </CardTitle>
        <p className="text-xs text-muted-foreground">30 Tage</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Auslastung</span>
            <span className="font-medium">{Math.round(stats.utilizationRate)}%</span>
          </div>
          <Progress value={stats.utilizationRate} className="h-2" />
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Kurse gesamt</p>
            <p className="text-xl font-bold">{stats.totalCourses}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ø Teilnehmer</p>
            <p className="text-xl font-bold">{Math.round(stats.avgParticipants)}</p>
          </div>
        </div>
        
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            {stats.totalRegistrations} von {stats.totalCapacity} Plätzen belegt
          </p>
        </div>
      </CardContent>
    </Card>
  )
}