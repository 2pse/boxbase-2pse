import { useState, useEffect } from "react"
import { Weight, Infinity, Dumbbell } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { getPriorizedMembership } from "@/lib/membershipUtils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useRealtimeSync } from "@/hooks/useRealtimeSync"

interface DashboardCreditsCardProps {
  user: User
}

interface MembershipInfo {
  type: 'credits' | 'unlimited' | 'monthly_limit' | 'open_gym_only' | null
  remainingCredits?: number
  usedThisMonth?: number
  monthlyLimit?: number
  planName?: string
}

export const DashboardCreditsCard: React.FC<DashboardCreditsCardProps> = ({ user }) => {
  const [membershipInfo, setMembershipInfo] = useState<MembershipInfo>({ type: null })
  const [loading, setLoading] = useState(true)
  const [popoverOpen, setPopoverOpen] = useState(false)

  // Add real-time sync for immediate updates
  useRealtimeSync({
    user,
    onCourseRegistrationChange: () => {
      console.log('Course registration changed - updating credits')
      loadMembershipInfo()
    }
  })

  useEffect(() => {
    loadMembershipInfo()
  }, [user.id])

  const loadMembershipInfo = async () => {
    try {
      // Check v2 system first
      const { data: membershipV2Data } = await supabase
        .from('user_memberships_v2')
        .select(`
          status,
          membership_data,
          start_date,
          end_date,
          membership_plans_v2(
            id,
            name,
            booking_rules,
            includes_open_gym
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'active')

      if (membershipV2Data && membershipV2Data.length > 0) {
        const prioritizedMembership = getPriorizedMembership(membershipV2Data)
        const bookingRules = prioritizedMembership?.membership_plans_v2?.booking_rules as any
        const membershipData = prioritizedMembership?.membership_data as any
        const planName = prioritizedMembership?.membership_plans_v2?.name

        if (bookingRules?.type === 'credits') {
          setMembershipInfo({
            type: 'credits',
            remainingCredits: membershipData?.remaining_credits || 0,
            planName
          })
        } else if (bookingRules?.type === 'unlimited') {
          setMembershipInfo({
            type: 'unlimited',
            planName
          })
        } else if (bookingRules?.type === 'limited') {
          // For limited memberships, calculate used credits this period
          const limitPeriod = bookingRules.limit?.period || 'month'
          const limitCount = bookingRules.limit?.count || 0
          
          let periodStart: Date
          if (limitPeriod === 'week') {
            periodStart = new Date()
            periodStart.setDate(periodStart.getDate() - periodStart.getDay() + 1) // Monday
          } else {
            periodStart = new Date()
            periodStart.setDate(1) // First day of month
          }

          const { data: registrations } = await supabase
            .from('course_registrations')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'registered')
            .gte('registered_at', periodStart.toISOString())

          const usedThisMonth = registrations?.length || 0
          const remainingCredits = membershipData?.remaining_credits || 0

          setMembershipInfo({
            type: 'monthly_limit',
            remainingCredits,
            usedThisMonth,
            monthlyLimit: limitCount,
            planName
          })
        } else if (bookingRules?.type === 'open_gym_only') {
          setMembershipInfo({
            type: 'open_gym_only',
            planName
          })
        }
      } else {
        // Check user roles for admin/trainer unlimited access
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'trainer'])
          .maybeSingle()

        if (userRole) {
          setMembershipInfo({
            type: 'unlimited',
            planName: userRole.role === 'admin' ? 'Admin' : 'Trainer'
          })
        } else {
          setMembershipInfo({ type: null })
        }
      }

      setLoading(false)
    } catch (error) {
      console.error('Error loading membership info:', error)
      setLoading(false)
    }
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      )
    }

    if (!membershipInfo.type) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="text-4xl font-bold text-muted-foreground mb-1">
              -
            </div>
            <div className="text-sm text-muted-foreground">
              Credits
            </div>
          </div>
          <Dumbbell className="absolute top-3 right-3 h-5 w-5 text-muted-foreground" />
        </div>
      )
    }

    switch (membershipInfo.type) {
      case 'credits':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-1">
                {membershipInfo.remainingCredits}
              </div>
              <div className="text-sm text-muted-foreground">
                Credits
              </div>
            </div>
            <Dumbbell className="absolute top-3 right-3 h-5 w-5 text-muted-foreground" />
          </div>
        )

      case 'unlimited':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl text-primary mb-1 flex justify-center">
                <Infinity className="h-10 w-10" />
              </div>
              <div className="text-sm text-muted-foreground">
                Credits
              </div>
            </div>
            <Dumbbell className="absolute top-3 right-3 h-5 w-5 text-muted-foreground" />
          </div>
        )

      case 'monthly_limit':
        const remaining = (membershipInfo.monthlyLimit || 0) - (membershipInfo.usedThisMonth || 0)
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-1">
                {Math.max(0, remaining)}
              </div>
              <div className="text-sm text-muted-foreground">
                Credits
              </div>
            </div>
            <Dumbbell className="absolute top-3 right-3 h-5 w-5 text-muted-foreground" />
          </div>
        )

      case 'open_gym_only':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl text-primary mb-1 flex justify-center">
                <Infinity className="h-10 w-10" />
              </div>
              <div className="text-sm text-muted-foreground">
                Credits
              </div>
            </div>
            <Dumbbell className="absolute top-3 right-3 h-5 w-5 text-muted-foreground" />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button 
          className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-3 hover:bg-gray-150 dark:hover:bg-gray-700 transition-all hover:scale-[1.02] h-24 relative w-full cursor-pointer"
          onClick={() => setPopoverOpen(true)}
        >
          {renderContent()}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Mitgliedschaftsdetails</h3>
          {membershipInfo.type === 'credits' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Plan: {membershipInfo.planName || 'Credits Plan'}</p>
              <p className="text-sm">Verbleibende Credits: <span className="font-semibold">{membershipInfo.remainingCredits}</span></p>
            </div>
          )}
          {membershipInfo.type === 'unlimited' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Plan: {membershipInfo.planName || 'Unlimited'}</p>
              <p className="text-sm">Unbegrenzte Kursbuchungen verfügbar</p>
            </div>
          )}
          {membershipInfo.type === 'monthly_limit' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Plan: {membershipInfo.planName || 'Monthly Limit'}</p>
              <p className="text-sm">Monatslimit: <span className="font-semibold">{membershipInfo.monthlyLimit}</span></p>
              <p className="text-sm">Diesen Monat genutzt: <span className="font-semibold">{membershipInfo.usedThisMonth}</span></p>
              <p className="text-sm">Verbleibend: <span className="font-semibold">{Math.max(0, (membershipInfo.monthlyLimit || 0) - (membershipInfo.usedThisMonth || 0))}</span></p>
            </div>
          )}
          {membershipInfo.type === 'open_gym_only' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Plan: {membershipInfo.planName || 'Open Gym'}</p>
              <p className="text-sm">Nur freies Training verfügbar</p>
            </div>
          )}
          {!membershipInfo.type && (
            <p className="text-sm text-muted-foreground">Keine aktive Mitgliedschaft gefunden</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}