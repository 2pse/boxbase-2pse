import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Users } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { supabase } from "@/integrations/supabase/client"
import { CourseUtilizationCard } from "./CourseUtilizationCard"
import { PopularCoursesCard } from "./PopularCoursesCard"
import { CancellationRateCard } from "./CancellationRateCard"
import { BookingPatternsCard } from "./BookingPatternsCard"
import { InactiveMembersCard } from "./InactiveMembersCard"
import { loadMembershipPlanColors, getMembershipColor } from "@/lib/membershipColors"

interface AdminStatsProps {
  onStatsLoad?: (stats: any) => void
}

interface LeaderboardStats {
  totalEntries: number
  memberStats: {
    [key: string]: number
  }
  currentMonthEntries: number
  checkInsByPlan: {
    [key: string]: number
  }
}

export const AdminStats = ({ onStatsLoad }: AdminStatsProps) => {
  const [stats, setStats] = useState<LeaderboardStats>({
    totalEntries: 0,
    memberStats: {},
    currentMonthEntries: 0,
    checkInsByPlan: {}
  })
  const [loading, setLoading] = useState(true)
  const [planColors, setPlanColors] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    loadStats()
    loadMembershipPlanColors().then(setPlanColors)
  }, [])

  const loadStats = async () => {
    try {
      setLoading(true)
      
      const currentDate = new Date()
      const currentYear = currentDate.getFullYear()
      const currentMonth = currentDate.getMonth() + 1
      
      // Calculate first and last day of current month
      const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1)
      const lastDayOfMonth = new Date(currentYear, currentMonth, 0)
      
      // Get all active membership plans first
      const { data: allActivePlans } = await supabase
        .from('membership_plans_v2')
        .select('name')
        .eq('is_active', true)
      
      // Get current month from leaderboard entries (this counts all completed training)
      const { data: leaderboardData } = await supabase
        .from('leaderboard_entries')
        .select('user_id, training_count')
        .eq('year', currentYear)
        .eq('month', currentMonth)

      // Get completed course registrations for current month
      const { data: completedCourseRegistrations } = await supabase
        .from('course_registrations')
        .select(`
          user_id,
          courses!inner(
            course_date,
            end_time
          )
        `)
        .eq('status', 'registered')
        .gte('courses.course_date', firstDayOfMonth.toISOString().split('T')[0])
        .lte('courses.course_date', lastDayOfMonth.toISOString().split('T')[0])

      // Filter only courses that have already ended
      const now = new Date()
      const completedCourses = completedCourseRegistrations?.filter(reg => {
        const course = reg.courses
        if (!course) return false
        
        const courseEndTime = new Date(`${course.course_date}T${course.end_time}`)
        return courseEndTime <= now
      }) || []

      // Get Open Gym check-ins for current month
      const { data: openGymSessions } = await supabase
        .from('training_sessions')
        .select('user_id, session_date, session_type')
        .eq('session_type', 'free_training')
        .gte('session_date', firstDayOfMonth.toISOString().split('T')[0])
        .lte('session_date', lastDayOfMonth.toISOString().split('T')[0])

      // Get all active memberships V2 to map users to membership plan names
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

      // Create a map of user_id to membership plan name
      const userMembershipMap = new Map<string, string>()
      allMembershipsV2?.forEach(membership => {
        const plan = membership.membership_plans_v2
        if (plan?.is_active) {
          userMembershipMap.set(membership.user_id, plan.name)
        }
      })

      // Initialize check-ins with all active plans at 0
      const checkInsByPlan: { [key: string]: number } = {}
      allActivePlans?.forEach(plan => {
        checkInsByPlan[plan.name] = 0
      })

      // Count completed courses
      completedCourses.forEach(registration => {
        const planName = userMembershipMap.get(registration.user_id)
        if (planName) {
          checkInsByPlan[planName] = (checkInsByPlan[planName] || 0) + 1
        } else {
          // Default for admins/trainers without membership
          checkInsByPlan['Staff'] = (checkInsByPlan['Staff'] || 0) + 1
        }
      })

      // Count Open Gym check-ins
      openGymSessions?.forEach(session => {
        const planName = userMembershipMap.get(session.user_id)
        if (planName) {
          checkInsByPlan[planName] = (checkInsByPlan[planName] || 0) + 1
        } else {
          checkInsByPlan['Staff'] = (checkInsByPlan['Staff'] || 0) + 1
        }
      })

      const totalRegistrations = completedCourses.length + (openGymSessions?.length || 0)

      // Calculate total training sessions from leaderboard
      const totalCurrentMonth = leaderboardData?.reduce((sum, entry) => sum + entry.training_count, 0) || 0

      // For member stats, get all profiles (source of truth for member count)
      const { data: adminTrainerRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['admin', 'trainer'])
      
      const adminTrainerUserIds = new Set(adminTrainerRoles?.map(r => r.user_id) || [])

      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('user_id')

      // Count memberships by plan name based on profiles, excluding admins/trainers
      const membershipCounts: { [key: string]: number } = {}
      
      allProfiles?.forEach(profile => {
        // Skip admin/trainer profiles
        if (!adminTrainerUserIds.has(profile.user_id)) {
          const planName = userMembershipMap.get(profile.user_id)
          if (planName) {
            membershipCounts[planName] = (membershipCounts[planName] || 0) + 1
          }
        }
      })

      const statsData = {
        totalEntries: totalCurrentMonth,
        memberStats: membershipCounts,
        currentMonthEntries: totalRegistrations,
        checkInsByPlan: checkInsByPlan
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

  // Prepare chart data with plan colors
  const chartData = Object.entries(stats.checkInsByPlan || {}).map(([planName, count]) => ({
    name: planName,
    value: count,
    fill: planName === 'Staff' ? '#6b7280' : getMembershipColor(planName, planColors)
  }))

  // Calculate dynamic scale based on data
  const maxValue = Math.max(...chartData.map(item => item.value), 1)
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
          <CardTitle>Completed trainings by membership plan</CardTitle>
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
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
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
              <p className="text-lg font-medium text-foreground">Number of memberships by plan</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(stats.memberStats).map(([planName, count]) => {
              const planColor = getMembershipColor(planName, planColors)
              return (
                <div key={planName} className="text-center">
                  <Badge 
                    className="text-sm mb-2"
                    style={{
                      backgroundColor: planColor,
                      color: '#ffffff',
                      border: 'none'
                    }}
                  >
                    {planName}
                  </Badge>
                  <p className="text-xl font-bold">{count}</p>
                </div>
              )
            })}
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
