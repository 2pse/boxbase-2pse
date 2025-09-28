import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Users } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { supabase } from "@/integrations/supabase/client"
import { getPriorizedMembership, getMembershipTypeName } from "@/lib/membershipUtils"
import { CourseUtilizationCard } from "./CourseUtilizationCard"
import { PopularCoursesCard } from "./PopularCoursesCard"
import { CancellationRateCard } from "./CancellationRateCard"
import { BookingPatternsCard } from "./BookingPatternsCard"
import { InactiveMembersCard } from "./InactiveMembersCard"

interface AdminStatsProps {
  onStatsLoad?: (stats: any) => void
}

interface LeaderboardStats {
  totalEntries: number
  memberStats: {
    [key: string]: number
  }
  currentMonthEntries: number
        registrationsByType: {
        'Unlimited': number
        'Limited': number
        'Credits': number
        'Open Gym': number
      }
}

export const AdminStats = ({ onStatsLoad }: AdminStatsProps) => {
  const [stats, setStats] = useState<LeaderboardStats>({
    totalEntries: 0,
    memberStats: {},
    currentMonthEntries: 0,
    registrationsByType: {
      'Unlimited': 0,
      'Limited': 0,
      'Credits': 0,
      'Open Gym': 0
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  // Helper function to map booking types to display categories
  const mapBookingTypeToCategory = (bookingType: string | undefined): string => {
    console.log('Mapping booking type:', bookingType)
    switch (bookingType) {
      case 'unlimited':
        console.log('Mapped to: Unlimited')
        return 'Unlimited'
      case 'limited':
      case 'weekly_limit':
      case 'monthly_limit':
        console.log('Mapped to: Limited')
        return 'Limited'
      case 'credits':
        console.log('Mapped to: Credits')
        return 'Credits'
      case 'open_gym_only':
        console.log('Mapped to: Open Gym')
        return 'Open Gym'
      default:
        console.log('Mapped to: Unlimited (default)')
        return 'Unlimited'
    }
  }

  const loadStats = async () => {
    try {
      setLoading(true)
      
      const currentDate = new Date()
      const currentYear = currentDate.getFullYear()
      const currentMonth = currentDate.getMonth() + 1
      
      // Get current month from leaderboard entries (this counts all completed training)
      const { data: leaderboardData } = await supabase
        .from('leaderboard_entries')
        .select('user_id, training_count')
        .eq('year', currentYear)
        .eq('month', currentMonth)

      // Get admin/trainer roles to exclude from membership counts
      const { data: adminTrainerRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'trainer'])
      
      const adminTrainerUserIds = new Set(adminTrainerRoles?.map(r => r.user_id) || [])

      // Get all profiles (source of truth for member count)
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('user_id')

      // Get all active memberships V2
      const { data: allMembershipsV2 } = await supabase
        .from('user_memberships_v2')
        .select(`
          user_id,
          membership_plans_v2(
            name,
            booking_rules,
            is_active
          )
        `)
        .eq('status', 'active')
        .eq('membership_plans_v2.is_active', true)

      console.log('All Profiles:', allProfiles?.length)  
      console.log('All V2 Memberships:', allMembershipsV2?.length)
      console.log('Admin/Trainer User IDs:', Array.from(adminTrainerUserIds))

      // Create a map of user_id to membership for easier lookup
      const userMembershipMap = new Map()
      allMembershipsV2?.forEach(membership => {
        const plan = membership.membership_plans_v2
        if (plan?.is_active) {
          const bookingRules = plan.booking_rules as any // Type assertion for Json type
          userMembershipMap.set(membership.user_id, {
            type: bookingRules?.type || 'unknown',
            name: plan.name
          })
        }
      })

      // Note: V1 system has been deprecated, using only V2 memberships now

      // Calculate total training sessions from leaderboard
      const totalCurrentMonth = leaderboardData?.reduce((sum, entry) => sum + entry.training_count, 0) || 0

      // Count memberships by type based on profiles, excluding admins/trainers
      const membershipCounts = {
        'Unlimited': 0,
        'Limited': 0, 
        'Credits': 0,
        'Open Gym': 0
      }

      let totalActiveMembers = 0
      
      allProfiles?.forEach(profile => {
        // Skip admin/trainer profiles
        if (!adminTrainerUserIds.has(profile.user_id)) {
          totalActiveMembers++
          const membershipInfo = userMembershipMap.get(profile.user_id)
          if (membershipInfo) {
            const membershipCategory = mapBookingTypeToCategory(membershipInfo.type)
            membershipCounts[membershipCategory as keyof typeof membershipCounts] += 1
          }
        }
      })

      console.log('Total Active Members:', totalActiveMembers)
      console.log('Membership Counts:', membershipCounts)

      // Note: V1 system has been deprecated, only using V2 memberships now

      const statsData = {
        totalEntries: totalCurrentMonth,
        memberStats: membershipCounts,
        currentMonthEntries: totalCurrentMonth,
        registrationsByType: membershipCounts
      }

      setStats(statsData)
      onStatsLoad?.(statsData)
    } catch (error) {
      console.error('Error loading admin stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return null
  }

  // Get colors for membership types
  const getMembershipColor = (type: string) => {
    // All membership types now use gray color
    return 'hsl(0, 0%, 65%)' // Gray for all membership types
  }

  const chartData = [
    { name: 'Unlimited', value: stats.registrationsByType?.['Unlimited'] || 0, fill: getMembershipColor('Unlimited') },
    { name: 'Limited', value: stats.registrationsByType?.['Limited'] || 0, fill: getMembershipColor('Limited') },
    { name: 'Credits', value: stats.registrationsByType?.['Credits'] || 0, fill: getMembershipColor('Credits') },
    { name: 'Open Gym', value: stats.registrationsByType?.['Open Gym'] || 0, fill: getMembershipColor('Open Gym') }
  ]

  // Calculate dynamic scale based on data
  const maxValue = Math.max(...chartData.map(item => item.value))
  const scaleMax = Math.max(maxValue * 1.2, 50) // At least 50, or 20% above max value

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Overview of studio statistics and activities</p>
      </div>
      
      {/* Main Stats */}
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 text-primary" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Registrations this month</p>
                <p className="text-2xl font-bold">{stats.currentMonthEntries}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Registrations by membership type</CardTitle>
          <p className="text-xs text-muted-foreground">This month</p>
        </CardHeader>
        <CardContent>
          <div className="w-full">
             <ResponsiveContainer width="100%" height={300}>
               <BarChart data={chartData} margin={{ top: 20, right: 30, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={70}
                />
                <YAxis 
                  domain={[0, scaleMax]} 
                  tick={{ fontSize: 12 }}
                />
                <Tooltip />
                <Bar 
                  dataKey="value" 
                  minPointSize={2}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Total Memberships */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center mb-4">
            <Users className="h-8 w-8 text-primary" />
            <div className="ml-4">
              <p className="text-lg font-medium text-foreground">Number of memberships by category</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(stats.memberStats).map(([type, count]) => (
              <div key={type} className="text-center">
                <Badge variant="secondary" className="text-sm mb-2">{type}</Badge>
                <p className="text-xl font-bold">{count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Course Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <CourseUtilizationCard />
        <PopularCoursesCard />
        <CancellationRateCard />
      </div>

      {/* Booking Patterns and Inactive Members */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BookingPatternsCard />
        <InactiveMembersCard />
      </div>
    </div>
  )
}