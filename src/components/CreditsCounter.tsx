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
  type: 'credits' | 'unlimited' | 'monthly_limit' | 'open_gym_only' | null
  remainingCredits?: number
  usedThisMonth?: number
  monthlyLimit?: number
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
      // First check new v2 system - get ALL active memberships
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
      const limit = bookingRules.limit;
      const limitPeriod = limit?.period || 'month';
      const limitCount = limit?.count || 0;
      
      // Calculate period start/end based on course_date
      const now = new Date();
      let periodStart: Date;
      let periodEnd: Date;
      
      if (limitPeriod === 'week') {
        periodStart = new Date(now);
        periodStart.setDate(periodStart.getDate() - periodStart.getDay() + 1); // Monday
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 7);
      } else {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }
      
      // Count registrations in current period based on course_date
      const { data: registrations } = await supabase
        .from('course_registrations')
        .select('id, courses!inner(course_date)')
        .eq('user_id', user.id)
        .eq('status', 'registered')
        .gte('courses.course_date', periodStart.toISOString().split('T')[0])
        .lt('courses.course_date', periodEnd.toISOString().split('T')[0]);

      const usedThisPeriod = registrations?.length || 0;

      setMembershipInfo({
        type: 'monthly_limit',
        usedThisMonth: usedThisPeriod,
        monthlyLimit: limitCount,
        remainingCredits: Math.max(0, limitCount - usedThisPeriod)
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