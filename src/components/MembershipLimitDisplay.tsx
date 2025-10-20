import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, CreditCard, AlertCircle } from "lucide-react"

interface MembershipLimitDisplayProps {
  userId: string
  membershipType: string
  courseDate?: string
  bookingType?: string
}

export const MembershipLimitDisplay = ({ userId, membershipType, courseDate, bookingType }: MembershipLimitDisplayProps) => {
  const [monthlyCount, setMonthlyCount] = useState<number>(0)
  const [monthlyLimit, setMonthlyLimit] = useState<number>(0)
  const [credits, setCredits] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [periodStart, setPeriodStart] = useState<string>('')
  const [periodEnd, setPeriodEnd] = useState<string>('')

  useEffect(() => {
    const fetchLimits = async () => {
      if (bookingType === 'limited') {
        // Get V2 membership data for LIMITED memberships (including start_date)
        const { data: membershipData } = await supabase
          .from('user_memberships_v2')
          .select('membership_data, start_date, membership_plans_v2(booking_rules)')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single()

        if (membershipData?.membership_plans_v2?.booking_rules) {
          const bookingRules = membershipData.membership_plans_v2.booking_rules as any
          
          if (bookingRules.type === 'limited') {
            // Individual period-based calculation for LIMITED memberships
            const limit = bookingRules.limit
            
            // Get membership start_date for individual period calculation
            const membershipStartDate = new Date(membershipData.start_date)
            const startDay = membershipStartDate.getDate()
            
            // Use course_date if provided, otherwise use current date
            const targetDate = courseDate ? new Date(courseDate) : new Date()
            
            // Calculate period start based on individual start_date
            let periodStart: Date
            if (limit.period === 'week') {
              const day = targetDate.getDay()
              const diff = day === 0 ? -6 : 1 - day
              periodStart = new Date(targetDate)
              periodStart.setDate(targetDate.getDate() + diff)
              periodStart.setHours(0, 0, 0, 0)
            } else {
              // Individual monthly period based on start_date
              periodStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), startDay)
              
              // If target date is before the start day, we're in the previous period
              if (targetDate.getDate() < startDay) {
                periodStart.setMonth(periodStart.getMonth() - 1)
              }
            }
            
            // Calculate period end
            let periodEnd = new Date(periodStart)
            if (limit.period === 'week') {
              periodEnd.setDate(periodEnd.getDate() + 6)
            } else {
              periodEnd.setMonth(periodEnd.getMonth() + 1)
              periodEnd.setDate(periodEnd.getDate() - 1)
            }
            
            // Count registrations in the target period
            const { data: registrations } = await supabase
              .from('course_registrations')
              .select('id, courses!inner(course_date)')
              .eq('user_id', userId)
              .eq('status', 'registered')
              .gte('courses.course_date', periodStart.toISOString().split('T')[0])
              .lte('courses.course_date', periodEnd.toISOString().split('T')[0])
            
            const usedInPeriod = registrations?.length || 0
            const remaining = Math.max(0, limit.count - usedInPeriod)
            
            setCredits(remaining)
            setMonthlyLimit(limit.count)
            setMonthlyCount(usedInPeriod)
            setPeriodStart(periodStart.toISOString().split('T')[0])
            setPeriodEnd(periodEnd.toISOString().split('T')[0])
          }
        }
      } else if (bookingType === 'credits') {
        // For CREDITS type, use stored credits from membership_data
        const { data: membershipData } = await supabase
          .from('user_memberships_v2')
          .select('membership_data')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single()

        const data = membershipData?.membership_data as any
        const remainingCredits = data?.remaining_credits || 0
        
        setCredits(remainingCredits)
      }
      setLoading(false)
    }

    fetchLimits()
  }, [userId, membershipType, courseDate, bookingType])

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">Loading registration information...</div>
        </CardContent>
      </Card>
    )
  }

  if (bookingType === 'limited' || bookingType === 'credits') {
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