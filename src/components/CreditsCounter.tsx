import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { useGymSettings } from "@/contexts/GymSettingsContext"
import { Infinity } from "lucide-react"
import { getPriorizedMembership } from "@/lib/membershipUtils"
import { MembershipDetailsPopover } from "./MembershipDetailsPopover"

interface CreditsCounterProps {
  user: User
}

interface MembershipInfo {
  type: 'credits' | 'unlimited' | 'monthly_limit' | 'weekly_limit' | 'open_gym_only' | null
  remainingCredits?: number
  usedThisMonth?: number
  monthlyLimit?: number
  limitPeriod?: 'week' | 'month'
}

export const CreditsCounter = ({ user }: CreditsCounterProps) => {
  const [membershipInfo, setMembershipInfo] = useState<MembershipInfo>({ type: null })
  const [loading, setLoading] = useState(true)
  const { settings } = useGymSettings()
  const primaryColor = settings?.primary_color || '#B81243'

  useEffect(() => {
    loadMembershipInfo()

    // Listen for credit updates
    const handleCreditUpdate = () => {
      loadMembershipInfo()
    }

    window.addEventListener('creditsUpdated', handleCreditUpdate)
    window.addEventListener('courseRegistrationChanged', handleCreditUpdate)
    
    return () => {
      window.removeEventListener('creditsUpdated', handleCreditUpdate)
      window.removeEventListener('courseRegistrationChanged', handleCreditUpdate)
    }
  }, [user.id])

  const loadMembershipInfo = async () => {
    if (!user?.id) return;

    try {
      // First check new v2 system - get ALL active memberships (including start_date)
      const { data: membershipsV2, error: v2Error } = await supabase
        .from('user_memberships_v2')
        .select(`
          *,
          membership_plans_v2!inner(booking_rules)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (!v2Error && membershipsV2 && membershipsV2.length > 0) {
        // Prioritize memberships if user has multiple
        const prioritizedMembership = getPriorizedMembership(membershipsV2);
        if (!prioritizedMembership) return;
        
        const bookingRules = prioritizedMembership.membership_plans_v2?.booking_rules as any;
        const membershipData = prioritizedMembership.membership_data as any || {};
        
        if (bookingRules.type === 'credits') {
          setMembershipInfo({
            type: 'credits',
            remainingCredits: membershipData.remaining_credits || 0
          });
          return;
        } else if (bookingRules.type === 'unlimited') {
          setMembershipInfo({ type: 'unlimited' });
          return;
        } else if (bookingRules.type === 'limited') {
          // Limited memberships use individual period-based calculation
          // Calculate remaining credits for CURRENT period based on start_date
          const limit = bookingRules.limit;
          const currentDate = new Date();
          
          // Get membership start_date for individual period calculation
          const membershipStartDate = new Date(prioritizedMembership.start_date);
          const startDay = membershipStartDate.getDate();
          
          // Calculate current period start based on individual start_date
          let periodStart: Date;
          if (limit.period === 'week') {
            // Week starts on Monday
            const day = currentDate.getDay();
            const diff = day === 0 ? -6 : 1 - day;
            periodStart = new Date(currentDate);
            periodStart.setDate(currentDate.getDate() + diff);
            periodStart.setHours(0, 0, 0, 0);
          } else {
            // Individual monthly period based on start_date
            // Example: start_date = 11.10.2025 → current period could be 11.10. - 10.11.
            periodStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), startDay);
            
            // If we're before the start day, we're still in the previous period
            if (currentDate.getDate() < startDay) {
              periodStart.setMonth(periodStart.getMonth() - 1);
            }
          }
          
          // Calculate period end
          let periodEnd = new Date(periodStart);
          if (limit.period === 'week') {
            periodEnd.setDate(periodEnd.getDate() + 6);
          } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
            periodEnd.setDate(periodEnd.getDate() - 1);
          }
          
          // Count registrations in current period
          const { data: registrations } = await supabase
            .from('course_registrations')
            .select('id, courses!inner(course_date)')
            .eq('user_id', user.id)
            .eq('status', 'registered')
            .gte('courses.course_date', periodStart.toISOString().split('T')[0])
            .lte('courses.course_date', periodEnd.toISOString().split('T')[0]);
          
          const usedInPeriod = registrations?.length || 0;
          const remaining = Math.max(0, limit.count - usedInPeriod);
          
          setMembershipInfo({
            type: 'credits',
            remainingCredits: remaining
          });
          return;
        } else if (bookingRules.type === 'open_gym_only') {
          setMembershipInfo({ type: 'open_gym_only' });
          return;
        }
      }

      // V1 system has been deprecated, checking user roles for admin/trainer unlimited access
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'trainer'])
        .maybeSingle();

      if (userRole) {
        setMembershipInfo({ type: 'unlimited' });
      } else {
        setMembershipInfo({ type: null });
      }
    } catch (error) {
      console.error('Error loading membership info:', error);
      setMembershipInfo({ type: null });
    } finally {
      setLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return <div className="w-6 h-6 bg-white/20 rounded animate-pulse"></div>
    }

    switch (membershipInfo.type) {
      case 'credits':
        return <span className="text-white text-lg font-bold">{membershipInfo.remainingCredits}</span>
      case 'unlimited':
        return <Infinity className="w-6 h-6 text-white" />
      case 'open_gym_only':
        return <Infinity className="w-6 h-6 text-white" />
      case 'monthly_limit':
      case 'weekly_limit':
        return <span className="text-white text-lg font-bold">{membershipInfo.remainingCredits}</span>
      default:
        return <span className="text-white text-sm font-bold">?</span>
    }
  }

  // Don't show if no membership info
  if (!loading && !membershipInfo.type) {
    return null
  }

  return (
    <MembershipDetailsPopover user={user}>
      <div 
        className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
        style={{ backgroundColor: primaryColor }}
      >
        {renderContent()}
      </div>
    </MembershipDetailsPopover>
  )
}