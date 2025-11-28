import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { MembershipBadge } from "./MembershipBadge"
import { MemberStatsDialog } from "./MemberStatsDialog"
import { 
  RefreshCw, 
  Eye, 
  Mail, 
  X, 
  ArrowUp, 
  ArrowDown, 
  Minus,
  UserX,
  Clock
} from "lucide-react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"

interface NeverActiveSnapshot {
  snapshot_date: string
  days_0_7_count: number
  days_8_14_count: number
  days_15_21_count: number
  days_21_plus_count: number
  total_never_active: number
  days_0_7_percentage: number
  days_8_14_percentage: number
  days_15_21_percentage: number
  days_21_plus_percentage: number
}

interface InactiveSnapshot {
  snapshot_date: string
  active_under_10_count: number
  days_10_15_count: number
  days_15_21_count: number
  days_21_plus_count: number
  total_previously_active: number
  active_under_10_percentage: number
  days_10_15_percentage: number
  days_15_21_percentage: number
  days_21_plus_percentage: number
}

interface NeverActiveMember {
  user_id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  membership_type: string
  days_since_signup: number
  category: string
}

interface InactiveMember {
  user_id: string
  display_name: string
  first_name: string | null
  last_name: string | null
  membership_type: string
  days_since_last_activity: number
  last_activity_date: string
  total_bookings: number
  total_training_sessions: number
  cancellations: number
  category: string
}

export const AdminRiskRadar = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedMember, setSelectedMember] = useState<any | null>(null)
  const [showMemberStatsDialog, setShowMemberStatsDialog] = useState(false)
  const [emailQueue, setEmailQueue] = useState<Set<string>>(new Set())
  const [selectedNeverActiveCategory, setSelectedNeverActiveCategory] = useState<string | null>(null)
  const [selectedInactiveCategory, setSelectedInactiveCategory] = useState<string | null>(null)

  // Membership plan colors for badges
  const { data: membershipPlans } = useQuery({
    queryKey: ['membership-plans-colors'],
    queryFn: async () => {
      const { data } = await supabase
        .from('membership_plans_v2')
        .select('name, color')
        .eq('is_active', true)
      return data || []
    }
  })

  const planColors = new Map(membershipPlans?.map(p => [p.name, p.color]) || [])

  // Live membership data
  const { data: liveMemberships } = useQuery({
    queryKey: ['risk-radar-live-memberships'],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from('user_memberships_v2')
        .select('user_id, membership_plan_id')
        .eq('status', 'active')
      
      const { data: plans } = await supabase
        .from('membership_plans_v2')
        .select('id, name')
        .eq('is_active', true)
      
      return { memberships: memberships || [], plans: plans || [] }
    }
  })

  // Never active snapshots (last 30 days)
  const { data: neverActiveSnapshots } = useQuery({
    queryKey: ['never-active-snapshots'],
    queryFn: async () => {
      const { data } = await supabase
        .from('never_active_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(30)
      return (data || []).reverse()
    }
  })

  // Inactive snapshots (last 30 days)
  const { data: inactiveSnapshots } = useQuery({
    queryKey: ['inactive-snapshots'],
    queryFn: async () => {
      const { data } = await supabase
        .from('inactive_member_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: false })
        .limit(30)
      return (data || []).reverse()
    }
  })

  // Never active members for today
  const { data: allNeverActiveMembers } = useQuery({
    queryKey: ['never-active-members-all'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('never_active_member_details')
        .select('*')
        .eq('snapshot_date', today)
        .order('days_since_signup', { ascending: false })
      return data as NeverActiveMember[] | null
    }
  })

  // Inactive members for today
  const { data: allInactiveMembers } = useQuery({
    queryKey: ['inactive-members-all'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('inactive_member_details')
        .select('*')
        .eq('snapshot_date', today)
        .order('days_since_last_activity', { ascending: false })
      return data as InactiveMember[] | null
    }
  })

  // Get live membership type for a user
  const getLiveMembershipType = (userId: string) => {
    const membership = liveMemberships?.memberships.find(m => m.user_id === userId)
    if (!membership) return 'No Membership'
    const plan = liveMemberships?.plans.find(p => p.id === membership.membership_plan_id)
    return plan?.name || 'No Membership'
  }

  // Refresh data manually
  const handleRefreshData = async () => {
    setIsRefreshing(true)
    try {
      await supabase.functions.invoke('calculate-risk-radar-snapshot')
      
      await queryClient.invalidateQueries({ queryKey: ['never-active-snapshots'] })
      await queryClient.invalidateQueries({ queryKey: ['inactive-snapshots'] })
      await queryClient.invalidateQueries({ queryKey: ['never-active-members-all'] })
      await queryClient.invalidateQueries({ queryKey: ['inactive-members-all'] })
      
      toast.success('Data updated successfully')
    } catch (error) {
      console.error('Error refreshing data:', error)
      toast.error('Error updating data')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Add member to email queue
  const handleAddToEmailQueue = (userId: string, displayName: string) => {
    if (emailQueue.has(userId)) {
      toast.info(`${displayName} is already in the email list`)
      return
    }
    setEmailQueue(prev => new Set(prev).add(userId))
    toast.success(`${displayName} added to email list`)
  }

  // Remove from email queue
  const handleRemoveFromQueue = (userId: string) => {
    setEmailQueue(prev => {
      const newSet = new Set(prev)
      newSet.delete(userId)
      return newSet
    })
  }

  // Navigate to email manager with selected users
  const handleSendEmails = () => {
    const userIds = Array.from(emailQueue).join(',')
    navigate(`/admin?tab=email&userIds=${userIds}`)
  }

  // Clear email queue
  const handleClearQueue = () => {
    setEmailQueue(new Set())
  }

  // Open member stats dialog
  const handleShowStats = (member: any) => {
    setSelectedMember(member)
    setShowMemberStatsDialog(true)
  }

  // Calculate change indicator
  const calculateChange = (snapshots: any[], field: string) => {
    if (!snapshots || snapshots.length < 2) return 0
    const current = snapshots[snapshots.length - 1]?.[field] || 0
    const previous = snapshots[snapshots.length - 2]?.[field] || 0
    return current - previous
  }

  // Render change indicator
  const renderChangeIndicator = (change: number) => {
    if (change > 0) return <ArrowUp className="h-4 w-4 text-destructive" />
    if (change < 0) return <ArrowDown className="h-4 w-4 text-green-500" />
    return <Minus className="h-4 w-4 text-muted-foreground" />
  }

  // Filter never active members by selected category
  const filteredNeverActiveMembers = allNeverActiveMembers?.filter(m => {
    if (!selectedNeverActiveCategory) return false
    const categoryMap: Record<string, string> = {
      'days_0_7': '0-7',
      'days_8_14': '8-14',
      'days_15_21': '15-21',
      'days_21_plus': '21+'
    }
    return m.category === categoryMap[selectedNeverActiveCategory]
  }) || []

  // Filter inactive members by selected category
  const filteredInactiveMembers = allInactiveMembers?.filter(m => {
    if (!selectedInactiveCategory) return false
    const categoryMap: Record<string, string> = {
      'active_under_10': 'active',
      'days_10_15': '10-15',
      'days_15_21': '15-21',
      'days_21_plus': '21+'
    }
    return m.category === categoryMap[selectedInactiveCategory]
  }) || []

  // Get queued member names for display
  const getQueuedMemberNames = () => {
    const names: string[] = []
    emailQueue.forEach(userId => {
      const naMember = allNeverActiveMembers?.find(m => m.user_id === userId)
      const inMember = allInactiveMembers?.find(m => m.user_id === userId)
      const member = naMember || inMember
      if (member) {
        const name = member.first_name && member.last_name 
          ? `${member.first_name} ${member.last_name}` 
          : member.display_name
        names.push(name)
      }
    })
    return names
  }

  const latestNeverActive = neverActiveSnapshots?.[neverActiveSnapshots.length - 1] as NeverActiveSnapshot | undefined
  const latestInactive = inactiveSnapshots?.[inactiveSnapshots.length - 1] as InactiveSnapshot | undefined

  const neverActiveCategories = [
    { key: 'days_0_7', label: '0-7 Days', count: latestNeverActive?.days_0_7_count || 0, percentage: latestNeverActive?.days_0_7_percentage || 0 },
    { key: 'days_8_14', label: '8-14 Days', count: latestNeverActive?.days_8_14_count || 0, percentage: latestNeverActive?.days_8_14_percentage || 0 },
    { key: 'days_15_21', label: '15-21 Days', count: latestNeverActive?.days_15_21_count || 0, percentage: latestNeverActive?.days_15_21_percentage || 0 },
    { key: 'days_21_plus', label: '21+ Days', count: latestNeverActive?.days_21_plus_count || 0, percentage: latestNeverActive?.days_21_plus_percentage || 0 },
  ]

  const inactiveCategories = [
    { key: 'active_under_10', label: 'Active (<10d)', count: latestInactive?.active_under_10_count || 0, percentage: latestInactive?.active_under_10_percentage || 0 },
    { key: 'days_10_15', label: '10-15 Days', count: latestInactive?.days_10_15_count || 0, percentage: latestInactive?.days_10_15_percentage || 0 },
    { key: 'days_15_21', label: '15-21 Days', count: latestInactive?.days_15_21_count || 0, percentage: latestInactive?.days_15_21_percentage || 0 },
    { key: 'days_21_plus', label: '21+ Days', count: latestInactive?.days_21_plus_count || 0, percentage: latestInactive?.days_21_plus_percentage || 0 },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Risk Radar</h1>
          <p className="text-muted-foreground">Member activity and engagement monitoring</p>
        </div>
        <Button onClick={handleRefreshData} disabled={isRefreshing} size="sm" variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Never Active Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <UserX className="h-5 w-5 text-destructive" />
          <h2 className="text-xl font-semibold">Never Active Members</h2>
          <span className="text-muted-foreground">({latestNeverActive?.total_never_active || 0} total)</span>
        </div>

        {/* Category Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {neverActiveCategories.map((category) => {
            const change = calculateChange(neverActiveSnapshots || [], `${category.key}_count`)
            return (
              <button
                key={category.key}
                className={`bg-muted rounded-2xl p-4 text-left transition-all hover:bg-muted/80 hover:scale-[1.02] ${
                  selectedNeverActiveCategory === category.key ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedNeverActiveCategory(
                  selectedNeverActiveCategory === category.key ? null : category.key
                )}
              >
                <div className="text-sm text-muted-foreground mb-2">{category.label}</div>
                <div className="text-3xl font-bold">{category.count}</div>
                <div className="text-sm text-muted-foreground mb-2">{category.percentage.toFixed(1)}%</div>
                <div className="flex items-center gap-1 pt-2 border-t border-border/50">
                  {renderChangeIndicator(change)}
                  <span className="text-sm text-muted-foreground">{Math.abs(change)}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Trend Chart */}
        {neverActiveSnapshots && neverActiveSnapshots.length > 1 && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Trend (last 30 days)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={neverActiveSnapshots}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="snapshot_date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                  className="text-xs"
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('de-DE')}
                />
                <Legend />
                <Line dataKey="days_0_7_count" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} name="0-7 Days" dot={false} />
                <Line dataKey="days_8_14_count" stroke="hsl(var(--muted-foreground))" strokeWidth={2} name="8-14 Days" dot={false} />
                <Line dataKey="days_15_21_count" stroke="hsl(var(--muted-foreground))" strokeWidth={2.5} name="15-21 Days" dot={false} />
                <Line dataKey="days_21_plus_count" stroke="hsl(var(--primary))" strokeWidth={3} name="21+ Days (Critical)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Member List */}
        {selectedNeverActiveCategory && filteredNeverActiveMembers.length > 0 && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Members ({filteredNeverActiveMembers.length})</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredNeverActiveMembers.map((member) => {
                const memberName = member.first_name && member.last_name
                  ? `${member.first_name} ${member.last_name}`
                  : member.display_name
                const liveType = getLiveMembershipType(member.user_id)
                
                return (
                  <Card key={member.user_id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{memberName}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        {member.days_since_signup} days since signup •
                        <MembershipBadge 
                          type={liveType as any}
                          color={planColors.get(liveType)}
                          noShadow
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleShowStats(member)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant={emailQueue.has(member.user_id) ? "default" : "ghost"} 
                        size="sm"
                        onClick={() => handleAddToEmailQueue(member.user_id, memberName)}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Inactive Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-500" />
          <h2 className="text-xl font-semibold">Inactive Members (Previously Active)</h2>
          <span className="text-muted-foreground">({latestInactive?.total_previously_active || 0} total)</span>
        </div>

        {/* Category Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {inactiveCategories.map((category) => {
            const fieldMap: Record<string, string> = {
              'active_under_10': 'active_under_10_count',
              'days_10_15': 'days_10_15_count',
              'days_15_21': 'days_15_21_count',
              'days_21_plus': 'days_21_plus_count'
            }
            const change = calculateChange(inactiveSnapshots || [], fieldMap[category.key])
            return (
              <button
                key={category.key}
                className={`bg-muted rounded-2xl p-4 text-left transition-all hover:bg-muted/80 hover:scale-[1.02] ${
                  selectedInactiveCategory === category.key ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setSelectedInactiveCategory(
                  selectedInactiveCategory === category.key ? null : category.key
                )}
              >
                <div className="text-sm text-muted-foreground mb-2">{category.label}</div>
                <div className="text-3xl font-bold">{category.count}</div>
                <div className="text-sm text-muted-foreground mb-2">{category.percentage.toFixed(1)}%</div>
                <div className="flex items-center gap-1 pt-2 border-t border-border/50">
                  {renderChangeIndicator(change)}
                  <span className="text-sm text-muted-foreground">{Math.abs(change)}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Trend Chart */}
        {inactiveSnapshots && inactiveSnapshots.length > 1 && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Trend (last 30 days)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={inactiveSnapshots}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="snapshot_date"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                  className="text-xs"
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleDateString('de-DE')}
                />
                <Legend />
                <Line dataKey="active_under_10_count" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} name="Active (<10d)" dot={false} />
                <Line dataKey="days_10_15_count" stroke="hsl(var(--muted-foreground))" strokeWidth={2} name="10-15 Days" dot={false} />
                <Line dataKey="days_15_21_count" stroke="hsl(var(--muted-foreground))" strokeWidth={2.5} name="15-21 Days" dot={false} />
                <Line dataKey="days_21_plus_count" stroke="hsl(var(--primary))" strokeWidth={3} name="21+ Days (Critical)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Member List */}
        {selectedInactiveCategory && filteredInactiveMembers.length > 0 && (
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-4">Members ({filteredInactiveMembers.length})</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredInactiveMembers.map((member) => {
                const memberName = member.first_name && member.last_name
                  ? `${member.first_name} ${member.last_name}`
                  : member.display_name
                const liveType = getLiveMembershipType(member.user_id)
                
                return (
                  <Card key={member.user_id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{memberName}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                        {member.days_since_last_activity} days inactive •
                        {member.total_bookings} bookings •
                        <MembershipBadge 
                          type={liveType as any}
                          color={planColors.get(liveType)}
                          noShadow
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleShowStats(member)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant={emailQueue.has(member.user_id) ? "default" : "ghost"} 
                        size="sm"
                        onClick={() => handleAddToEmailQueue(member.user_id, memberName)}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Floating Email Queue */}
      {emailQueue.size > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Card className="shadow-lg">
            <div className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-semibold text-sm mb-1">Email List ({emailQueue.size})</div>
                  <div className="text-xs text-muted-foreground max-w-xs truncate">
                    {getQueuedMemberNames().join(', ')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={handleClearQueue}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={handleSendEmails}>
                    Send Emails →
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Member Stats Dialog */}
      {selectedMember && (
        <MemberStatsDialog
          userId={selectedMember.user_id}
          displayName={selectedMember.display_name}
          firstName={selectedMember.first_name}
          lastName={selectedMember.last_name}
          totalBookings={selectedMember.total_bookings}
          totalTrainings={selectedMember.total_training_sessions}
          cancellations={selectedMember.cancellations}
          isOpen={showMemberStatsDialog}
          onClose={() => {
            setShowMemberStatsDialog(false)
            setSelectedMember(null)
          }}
        />
      )}
    </div>
  )
}
