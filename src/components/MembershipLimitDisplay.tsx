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
      if (membershipType.includes('Limited') || membershipType === 'credits' || membershipType === 'Credits') {
        // Get V2 membership data (credits stored in membership_data)
        const { data: membershipData } = await supabase
          .from('user_memberships_v2')
          .select('membership_data, membership_plans_v2(booking_rules)')
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

  if (membershipType.includes('Limited') || membershipType === 'credits' || membershipType === 'Credits') {
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