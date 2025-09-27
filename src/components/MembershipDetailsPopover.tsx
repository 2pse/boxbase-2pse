import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Infinity, CreditCard, Calendar, Clock, X } from "lucide-react"

import { getPriorizedMembership, getMembershipTypeName } from "@/lib/membershipUtils"

interface MembershipDetailsPopoverProps {
  user: User
  children: React.ReactNode
}

interface DetailedMembershipInfo {
  planName: string
  type: 'credits' | 'unlimited' | 'limited' | 'open_gym_only' | null
  remainingCredits?: number
  usedThisMonth?: number
  monthlyLimit?: number
  weeklyLimit?: number
  periodType?: 'week' | 'month'
  startDate?: string
  endDate?: string
  autoRenewal?: boolean
}

export const MembershipDetailsPopover = ({ user, children }: MembershipDetailsPopoverProps) => {
  const [membershipDetails, setMembershipDetails] = useState<DetailedMembershipInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Listen for membership updates
    const handleMembershipUpdate = () => {
      if (open) {
        loadMembershipDetails()
      }
    }

    window.addEventListener('membershipUpdated', handleMembershipUpdate)
    window.addEventListener('creditsUpdated', handleMembershipUpdate)
    
    // Set up realtime subscription for membership changes
    const membershipSubscription = supabase
      .channel('membership_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'user_memberships_v2', filter: `user_id=eq.${user.id}` }, 
        () => {
          if (open) {
            loadMembershipDetails()
          }
        }
      )
      .subscribe()
    
    return () => {
      window.removeEventListener('membershipUpdated', handleMembershipUpdate)
      window.removeEventListener('creditsUpdated', handleMembershipUpdate)
      supabase.removeChannel(membershipSubscription)
    }
  }, [user.id, open])

  const loadMembershipDetails = async () => {
    if (!user?.id) return
    setLoading(true)

    try {
      // Check V2 system first
      const { data: membershipsV2 } = await supabase
        .from('user_memberships_v2')
        .select(`
          *,
          membership_plans_v2!inner(*)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (membershipsV2 && membershipsV2.length > 0) {
        const prioritizedMembership = getPriorizedMembership(membershipsV2)
        if (!prioritizedMembership) return

        const plan = prioritizedMembership.membership_plans_v2
        const bookingRules = plan?.booking_rules as any
        const membershipData = prioritizedMembership.membership_data as any || {}

        let remainingCredits = 0
        let usedThisMonth = 0

        // Calculate credits based on membership type - same logic as CreditsCounter
        if (bookingRules?.type === 'credits') {
          remainingCredits = membershipData.remaining_credits || 0
        } else if (bookingRules?.type === 'limited') {
          const limit = bookingRules.limit
          
          // Calculate current period based on limit type
          let periodQuery
          if (limit?.period === 'week') {
            const currentWeekStart = new Date()
            currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay() + 1)
            periodQuery = currentWeekStart.toISOString().split('T')[0]
          } else {
            const currentDate = new Date()
            periodQuery = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-01`
          }
          
          const { data: registrations } = await supabase
            .from('course_registrations')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'registered')
            .gte('registered_at', periodQuery)

          usedThisMonth = registrations?.length || 0
          const monthlyLimit = limit?.count || 0
          remainingCredits = Math.max(0, monthlyLimit - usedThisMonth)
        }

        setMembershipDetails({
          planName: plan?.name || 'Unbekannt',
          type: bookingRules?.type || null,
          remainingCredits,
          usedThisMonth,
          periodType: bookingRules?.limit?.period,
          monthlyLimit: bookingRules?.limit?.count,
          weeklyLimit: bookingRules?.limit?.period === 'week' ? bookingRules?.limit?.count : undefined,
          startDate: (prioritizedMembership as any).start_date,
          endDate: (prioritizedMembership as any).end_date,
          autoRenewal: (prioritizedMembership as any).auto_renewal
        })
      } else {
        // Check if user has admin/trainer role
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'trainer'])
          .maybeSingle()

        if (userRole) {
          setMembershipDetails({
            planName: userRole.role === 'admin' ? 'Administrator' : 'Trainer',
            type: 'unlimited'
          })
        } else {
          setMembershipDetails({
            planName: 'Keine aktive Mitgliedschaft',
            type: null
          })
        }
      }
    } catch (error) {
      console.error('Error loading membership details:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not available'
    return new Date(dateStr).toLocaleDateString('en-US')
  }

  const getMembershipIcon = (type: string | null) => {
    switch (type) {
      case 'unlimited':
        return <Infinity className="w-5 h-5" />
      case 'credits':
        return <CreditCard className="w-5 h-5" />
      case 'limited':
        return <Calendar className="w-5 h-5" />
      case 'open_gym_only':
        return <Clock className="w-5 h-5" />
      default:
        return <CreditCard className="w-5 h-5" />
    }
  }

  const getMembershipDescription = (details: DetailedMembershipInfo) => {
    switch (details.type) {
      case 'unlimited':
        return 'Unbegrenzte Teilnahme an allen Kursen'
      case 'credits':
        return `${details.remainingCredits} Credits verfügbar`
      case 'limited':
        if (details.periodType === 'week') {
          return `${details.remainingCredits} von ${details.weeklyLimit} Kurse diese Woche`
        }
        return `${details.remainingCredits} von ${details.monthlyLimit} Kurse diesen Monat`
      case 'open_gym_only':
        return 'Nur Open Gym Zugang'
      default:
        return 'Keine aktive Mitgliedschaft'
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={loadMembershipDetails}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {membershipDetails && getMembershipIcon(membershipDetails.type)}
                <div>
                  <CardTitle className="text-base">
                    {loading ? 'Lädt...' : membershipDetails?.planName || 'Mitgliedschaft'}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {loading ? '' : membershipDetails && getMembershipDescription(membershipDetails)}
                  </CardDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-sm opacity-70 hover:opacity-100" 
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Schließen</span>
              </Button>
            </div>
          </CardHeader>
          
          {!loading && membershipDetails && (
            <CardContent className="space-y-3 pt-0">
              {membershipDetails.type === 'credits' && (
                <div className="flex justify-between items-center p-2 bg-muted rounded-md">
                  <span className="text-sm font-medium">Verfügbare Credits</span>
                  <Badge variant="secondary" className="font-bold">
                    {membershipDetails.remainingCredits}
                  </Badge>
                </div>
              )}
              
              {membershipDetails.type === 'limited' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-muted rounded-md">
                    <span className="text-sm font-medium">
                      {membershipDetails.periodType === 'week' ? 'Wöchentliches Limit' : 'Monatliches Limit'}
                    </span>
                    <Badge variant="secondary">
                      {membershipDetails.weeklyLimit || membershipDetails.monthlyLimit}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-muted rounded-md">
                    <span className="text-sm font-medium">Verbleibend</span>
                    <Badge variant="outline">
                      {membershipDetails.remainingCredits}
                    </Badge>
                  </div>
                  {membershipDetails.usedThisMonth !== undefined && (
                    <div className="flex justify-between items-center p-2 bg-muted rounded-md">
                      <span className="text-sm font-medium">Verwendet</span>
                      <Badge variant="outline">
                        {membershipDetails.usedThisMonth}
                      </Badge>
                    </div>
                  )}
                </div>
              )}
              
              {membershipDetails.startDate && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Beginn:</span>
                    <br />
                    <span className="text-muted-foreground">
                      {formatDate(membershipDetails.startDate)}
                    </span>
                  </div>
                  {membershipDetails.endDate && (
                    <div>
                      <span className="font-medium">Ende:</span>
                      <br />
                      <span className="text-muted-foreground">
                        {formatDate(membershipDetails.endDate)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              {membershipDetails.autoRenewal !== undefined && (
                <div className="flex justify-between items-center p-2 bg-muted rounded-md">
                  <span className="text-sm font-medium">Automatische Verlängerung</span>
                  <Badge variant={membershipDetails.autoRenewal ? "default" : "secondary"}>
                    {membershipDetails.autoRenewal ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </PopoverContent>
    </Popover>
  )
}