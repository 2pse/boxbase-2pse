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
  type: 'credits' | 'unlimited' | 'monthly_limit' | 'weekly_limit' | 'open_gym_only' | null
  remainingCredits?: number
  usedThisMonth?: number
  monthlyLimit?: number
  planName?: string
  limitPeriod?: 'week' | 'month'
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

  // Listen for course registration events for instant updates
  useEffect(() => {
    const handleCourseRegistrationChanged = () => {
      loadMembershipInfo()
    }

    window.addEventListener('courseRegistrationChanged', handleCourseRegistrationChanged)
    window.addEventListener('creditsUpdated', handleCourseRegistrationChanged)
    
    return () => {
      window.removeEventListener('courseRegistrationChanged', handleCourseRegistrationChanged)
      window.removeEventListener('creditsUpdated', handleCourseRegistrationChanged)
    }
  }, [])

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
          // For limited memberships, dynamically calculate based on individual period
          const limitPeriod = bookingRules.limit?.period || 'month'
          const limitCount = bookingRules.limit?.count || 0
          
          const now = new Date()
          const membershipStartDate = new Date(prioritizedMembership.start_date)
          const startDay = membershipStartDate.getDate()
          
          let periodStart: Date
          let periodEnd: Date
          
          if (limitPeriod === 'week') {
            // Week starts on Monday
            const day = now.getDay()
            const diff = day === 0 ? -6 : 1 - day
            periodStart = new Date(now)
            periodStart.setDate(now.getDate() + diff)
            periodStart.setHours(0, 0, 0, 0)
            periodEnd = new Date(periodStart)
            periodEnd.setDate(periodEnd.getDate() + 6)
          } else {
            // Individual monthly period based on start_date
            periodStart = new Date(now.getFullYear(), now.getMonth(), startDay)
            if (now.getDate() < startDay) {
              periodStart.setMonth(periodStart.getMonth() - 1)
            }
            periodEnd = new Date(periodStart)
            periodEnd.setMonth(periodEnd.getMonth() + 1)
            periodEnd.setDate(periodEnd.getDate() - 1)
          }

          // Count course registrations based on course_date in current period
          const { data: registrations } = await supabase
            .from('course_registrations')
            .select('id, courses!inner(course_date)')
            .eq('user_id', user.id)
            .eq('status', 'registered')
            .gte('courses.course_date', periodStart.toISOString().split('T')[0])
            .lte('courses.course_date', periodEnd.toISOString().split('T')[0])

          // Count Open Gym sessions in current period
          const { data: gymSessions } = await supabase
            .from('training_sessions')
            .select('id')
            .eq('user_id', user.id)
            .eq('session_type', 'free_training')
            .eq('status', 'completed')
            .gte('session_date', periodStart.toISOString().split('T')[0])
            .lte('session_date', periodEnd.toISOString().split('T')[0])

          const usedThisPeriod = (registrations?.length || 0) + (gymSessions?.length || 0)
          const remainingCredits = Math.max(0, limitCount - usedThisPeriod)

          setMembershipInfo({
            type: limitPeriod === 'week' ? 'weekly_limit' : 'monthly_limit',
            remainingCredits,
            usedThisMonth: usedThisPeriod,
            monthlyLimit: limitCount,
            planName,
            limitPeriod: limitPeriod
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
            <div className="text-4xl md:text-7xl font-bold text-muted-foreground mb-1 md:mb-2">
              -
            </div>
            <div className="text-sm md:text-lg text-muted-foreground">
              Credits
            </div>
          </div>
          <Dumbbell className="absolute top-3 md:top-5 right-3 md:right-5 h-5 md:h-8 w-5 md:w-8 text-muted-foreground" />
        </div>
      )
    }

    switch (membershipInfo.type) {
      case 'credits':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl md:text-7xl font-bold text-primary mb-1 md:mb-2">
                {membershipInfo.remainingCredits}
              </div>
              <div className="text-sm md:text-lg text-muted-foreground">
                Credits
              </div>
            </div>
            <Dumbbell className="absolute top-3 md:top-5 right-3 md:right-5 h-5 md:h-8 w-5 md:w-8 text-muted-foreground" />
          </div>
        )

      case 'unlimited':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl md:text-7xl text-primary mb-1 md:mb-2 flex justify-center">
                <Infinity className="h-10 md:h-16 w-10 md:w-16" />
              </div>
              <div className="text-sm md:text-lg text-muted-foreground">
                Credits
              </div>
            </div>
            <Dumbbell className="absolute top-3 md:top-5 right-3 md:right-5 h-5 md:h-8 w-5 md:w-8 text-muted-foreground" />
          </div>
        )

      case 'monthly_limit':
      case 'weekly_limit':
        const remaining = (membershipInfo.monthlyLimit || 0) - (membershipInfo.usedThisMonth || 0)
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl md:text-7xl font-bold text-primary mb-1 md:mb-2">
                {Math.max(0, remaining)}
              </div>
              <div className="text-sm md:text-lg text-muted-foreground">
                Credits
              </div>
            </div>
            <Dumbbell className="absolute top-3 md:top-5 right-3 md:right-5 h-5 md:h-8 w-5 md:w-8 text-muted-foreground" />
          </div>
        )

      case 'open_gym_only':
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl md:text-7xl text-primary mb-1 md:mb-2 flex justify-center">
                <Infinity className="h-10 md:h-16 w-10 md:w-16" />
              </div>
              <div className="text-sm md:text-lg text-muted-foreground">
                Credits
              </div>
            </div>
            <Dumbbell className="absolute top-3 md:top-5 right-3 md:right-5 h-5 md:h-8 w-5 md:w-8 text-muted-foreground" />
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
          className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-3 md:p-6 hover:bg-gray-150 dark:hover:bg-gray-700 transition-all hover:scale-[1.02] h-[22px] md:h-[155px] relative w-full cursor-pointer"
          onClick={() => setPopoverOpen(true)}
        >
          {renderContent()}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Membership Details</h3>
          {membershipInfo.type === 'credits' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Plan: {membershipInfo.planName || 'Credits Plan'}</p>
              <p className="text-sm">Remaining Credits: <span className="font-semibold">{membershipInfo.remainingCredits}</span></p>
            </div>
          )}
          {membershipInfo.type === 'unlimited' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Plan: {membershipInfo.planName || 'Unlimited'}</p>
              <p className="text-sm">Unlimited course bookings available</p>
            </div>
          )}
          {(membershipInfo.type === 'monthly_limit' || membershipInfo.type === 'weekly_limit') && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Plan: {membershipInfo.planName || (membershipInfo.limitPeriod === 'week' ? 'Wöchentliches Limit' : 'Monatliches Limit')}</p>
               <p className="text-sm">{membershipInfo.limitPeriod === 'week' ? 'Wöchentliches' : 'Monatliches'} Limit: <span className="font-semibold">{membershipInfo.monthlyLimit}</span></p>
               <p className="text-sm">Verbraucht {membershipInfo.limitPeriod === 'week' ? 'diese Woche' : 'diesen Monat'}: <span className="font-semibold">{membershipInfo.usedThisMonth}</span></p>
               <p className="text-sm">Verbleibend: <span className="font-semibold">{Math.max(0, (membershipInfo.monthlyLimit || 0) - (membershipInfo.usedThisMonth || 0))}</span></p>
            </div>
          )}
          {membershipInfo.type === 'open_gym_only' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Plan: {membershipInfo.planName || 'Open Gym'}</p>
              <p className="text-sm">Only free training available</p>
            </div>
          )}
          {!membershipInfo.type && (
            <p className="text-sm text-muted-foreground">No active membership found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}