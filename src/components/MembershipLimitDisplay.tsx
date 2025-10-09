import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, CreditCard, AlertCircle } from "lucide-react"

interface MembershipLimitDisplayProps {
  userId: string
  membershipType: string
  courseDate?: string // ← NEW: Optional course date for preview
}

export const MembershipLimitDisplay = ({ userId, membershipType, courseDate }: MembershipLimitDisplayProps) => {
  const [weeklyCount, setWeeklyCount] = useState<number>(0)
  const [credits, setCredits] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [periodStart, setPeriodStart] = useState<string>('')
  const [periodEnd, setPeriodEnd] = useState<string>('')

  useEffect(() => {
    const fetchLimits = async () => {
      // Determine target date (courseDate or current week)
      const targetDate = courseDate ? new Date(courseDate) : new Date()
      
      // Calculate week period (Monday-Sunday)
      const dayOfWeek = targetDate.getDay()
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const monday = new Date(targetDate)
      monday.setDate(monday.getDate() + diff)
      monday.setHours(0, 0, 0, 0)
      
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 6)
      sunday.setHours(23, 59, 59, 999)

      const periodStartStr = monday.toISOString().split('T')[0]
      const periodEndStr = sunday.toISOString().split('T')[0]
      
      setPeriodStart(periodStartStr)
      setPeriodEnd(periodEndStr)

      // Map new booking types to legacy checks
      if (membershipType === 'monthly_limit' || membershipType === 'Basic Member' || membershipType.includes('Limited')) {
        // Fetch registrations in target period
        const { data: registrations, error } = await supabase
          .from('course_registrations')
          .select('id, courses!inner(course_date)')
          .eq('user_id', userId)
          .eq('status', 'registered')
          .gte('courses.course_date', periodStartStr)
          .lte('courses.course_date', periodEndStr)
        
        if (!error && registrations) {
          setWeeklyCount(registrations.length)
        }
      } else if (membershipType === 'credits' || membershipType === 'Credits') {
        // V1 system has been deprecated, setting credits to 0
        setCredits(0)
      }
      setLoading(false)
    }

    fetchLimits()
  }, [userId, membershipType, courseDate])

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">Loading registration information...</div>
        </CardContent>
      </Card>
    )
  }

  if (membershipType === 'monthly_limit' || membershipType === 'Basic Member') {
    const remaining = Math.max(0, 2 - weeklyCount)
    
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">Weekly Registrations</span>
                <Badge variant={remaining > 0 ? "default" : "destructive"}>
                  {weeklyCount}/2
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {remaining > 0 
                  ? `You can register ${remaining} more times this week`
                  : "You have reached your weekly limit"
                }
              </p>
            </div>
          </div>
          {remaining === 0 && (
            <div className="mt-3 p-2 bg-destructive/10 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">
                Limit reached - new registrations possible from Monday
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (membershipType === 'credits' || membershipType === 'Credits') {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">Available Credits</span>
                <Badge variant={credits > 0 ? "default" : "destructive"}>
                  {credits} Credits
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {credits > 0 
                  ? `You can register ${credits} more times for courses`
                  : "No credits available - please contact the team"
                }
              </p>
            </div>
          </div>
          {credits === 0 && (
            <div className="mt-3 p-2 bg-destructive/10 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">
                No credits - top up at reception possible
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return null
}