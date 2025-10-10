import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, CreditCard, AlertCircle } from "lucide-react"

interface MembershipLimitDisplayProps {
  userId: string
  membershipType: string
  courseDate?: string
}

export const MembershipLimitDisplay = ({ userId, membershipType, courseDate }: MembershipLimitDisplayProps) => {
  const [monthlyCount, setMonthlyCount] = useState<number>(0)
  const [monthlyLimit, setMonthlyLimit] = useState<number>(0)
  const [credits, setCredits] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [periodStart, setPeriodStart] = useState<string>('')
  const [periodEnd, setPeriodEnd] = useState<string>('')

  useEffect(() => {
    const fetchLimits = async () => {
      const targetDate = courseDate ? new Date(courseDate) : new Date()
      
      // Calculate MONTHLY period only
      const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1)
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0)

      const periodStartStr = monthStart.toISOString().split('T')[0]
      const periodEndStr = monthEnd.toISOString().split('T')[0]
      
      setPeriodStart(periodStartStr)
      setPeriodEnd(periodEndStr)

      if (membershipType.includes('Limited')) {
        // Get V2 membership limit
        const { data: membershipData } = await supabase
          .from('user_memberships_v2')
          .select('membership_plans_v2(booking_rules)')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single()

        const bookingRules = membershipData?.membership_plans_v2?.booking_rules as any
        const limit = bookingRules?.limit?.count || 0
        setMonthlyLimit(limit)

        // Fetch registrations in MONTHLY period
        const { data: registrations } = await supabase
          .from('course_registrations')
          .select('id, courses!inner(course_date)')
          .eq('user_id', userId)
          .eq('status', 'registered')
          .gte('courses.course_date', periodStartStr)
          .lte('courses.course_date', periodEndStr)
        
        setMonthlyCount(registrations?.length || 0)
      } else if (membershipType === 'credits' || membershipType === 'Credits') {
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

  if (membershipType.includes('Limited')) {
    const remaining = Math.max(0, monthlyLimit - monthlyCount)
    
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">Monthly Registrations</span>
                <Badge variant={remaining > 0 ? "default" : "destructive"}>
                  {monthlyCount}/{monthlyLimit}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {remaining > 0 
                  ? `You can register ${remaining} more times this month`
                  : "You have reached your monthly limit"
                }
              </p>
            </div>
          </div>
          {remaining === 0 && (
            <div className="mt-3 p-2 bg-destructive/10 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">
                Monthly limit reached - new registrations possible next month
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