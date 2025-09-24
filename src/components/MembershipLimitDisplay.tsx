import { useEffect, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, CreditCard, AlertCircle } from "lucide-react"

interface MembershipLimitDisplayProps {
  userId: string
  membershipType: string
}

export const MembershipLimitDisplay = ({ userId, membershipType }: MembershipLimitDisplayProps) => {
  const [weeklyCount, setWeeklyCount] = useState<number>(0)
  const [credits, setCredits] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLimits = async () => {
      // Map new booking types to legacy checks
      if (membershipType === 'monthly_limit' || membershipType === 'Basic Member') {
        // Fetch weekly registration count
        const { data, error } = await supabase
          .rpc('get_weekly_registrations_count', { p_user_id: userId })
        
        if (!error && data !== null) {
          setWeeklyCount(data)
        }
      } else if (membershipType === 'credits' || membershipType === 'Credits') {
        // V1 system has been deprecated, setting credits to 0
        setCredits(0)
      }
      setLoading(false)
    }

    fetchLimits()
  }, [userId, membershipType])

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground">Lade Anmeldeinformationen...</div>
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
                <span className="font-medium">Wöchentliche Anmeldungen</span>
                <Badge variant={remaining > 0 ? "default" : "destructive"}>
                  {weeklyCount}/2
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {remaining > 0 
                  ? `Du kannst dich noch ${remaining}x diese Woche anmelden`
                  : "Du hast dein wöchentliches Limit erreicht"
                }
              </p>
            </div>
          </div>
          {remaining === 0 && (
            <div className="mt-3 p-2 bg-destructive/10 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">
                Limit erreicht - neue Anmeldungen ab Montag möglich
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
                <span className="font-medium">Verfügbare Credits</span>
                <Badge variant={credits > 0 ? "default" : "destructive"}>
                  {credits} Credits
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {credits > 0 
                  ? `Du kannst dich noch ${credits}x für Kurse anmelden`
                  : "Keine Credits verfügbar - bitte wende dich an das Team"
                }
              </p>
            </div>
          </div>
          {credits === 0 && (
            <div className="mt-3 p-2 bg-destructive/10 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">
                Keine Credits - Aufladen am Empfang möglich
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return null
}