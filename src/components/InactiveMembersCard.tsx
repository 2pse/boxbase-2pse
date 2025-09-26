import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/integrations/supabase/client"
import { UserX } from "lucide-react"

interface InactiveMember {
  display_name: string
  last_login_at: string | null
  daysSinceLogin: number
  membership_type: string
}

export const InactiveMembersCard = () => {
  const [inactiveMembers, setInactiveMembers] = useState<InactiveMember[]>([])
  const [totalInactive, setTotalInactive] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInactiveMembers()
  }, [])

  const loadInactiveMembers = async () => {
    try {
      // Get profiles with their membership info
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          display_name,
          first_name,
          last_name,
          last_login_at,
          user_id,
          status
        `)
        .eq('status', 'inactive')
        .order('last_login_at', { ascending: true, nullsFirst: true })

      if (profilesError) throw profilesError

      // Get membership data for these users
      const userIds = profiles?.map(p => p.user_id) || []
      
      let membershipsData: any[] = []
      if (userIds.length > 0) {
        const { data: memberships } = await supabase
          .from('user_memberships_v2')
          .select(`
            user_id,
            status,
            membership_plans_v2(
              name,
              booking_rules
            )
          `)
          .in('user_id', userIds)
          .eq('status', 'active')
        
        membershipsData = memberships || []
      }

      // Process inactive members
      const currentDate = new Date()
      const inactiveList = profiles?.map(profile => {
        const lastLogin = profile.last_login_at ? new Date(profile.last_login_at) : null
        const daysSinceLogin = lastLogin 
          ? Math.floor((currentDate.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24))
          : 999

        // Find membership type
        const userMembership = membershipsData.find(m => m.user_id === profile.user_id)
        let membershipType = 'No subscription'
        
        if (userMembership?.membership_plans_v2) {
          const plan = userMembership.membership_plans_v2
          const bookingType = plan.booking_rules?.type || 'unknown'
          
          switch (bookingType) {
            case 'unlimited':
              membershipType = 'Unlimited'
              break
            case 'limited':
              membershipType = 'Limited'
              break
            case 'credits':
              membershipType = 'Credits'
              break
            case 'open_gym_only':
              membershipType = 'Open Gym'
              break
            default:
              membershipType = plan.name || 'Unknown'
          }
        }

        const displayName = profile.first_name && profile.last_name 
          ? `${profile.first_name} ${profile.last_name}`
          : profile.display_name || 'Unknown'

        return {
          display_name: displayName,
          last_login_at: profile.last_login_at,
          daysSinceLogin,
          membership_type: membershipType
        }
      }).slice(0, 10) || [] // Show top 10 most inactive

      setInactiveMembers(inactiveList)
      setTotalInactive(profiles?.length || 0)
    } catch (error) {
      console.error('Error loading inactive members:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatLastLogin = (lastLogin: string | null, daysSince: number) => {
    if (!lastLogin) return 'Never logged in'
    if (daysSince === 0) return 'Today'
    if (daysSince === 1) return 'Yesterday'
    if (daysSince < 7) return `${daysSince} days ago`
    if (daysSince < 30) return `${Math.floor(daysSince / 7)} weeks ago`
    return `${Math.floor(daysSince / 30)} months ago`
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserX className="h-5 w-5 text-primary" />
            Inactive members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <div className="h-4 bg-muted rounded flex-1 mr-4"></div>
                <div className="h-6 w-16 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserX className="h-5 w-5 text-primary" />
          Inactive members ({totalInactive})
        </CardTitle>
        <p className="text-xs text-muted-foreground">Members without login for 21+ days</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {inactiveMembers.length === 0 ? (
            <p className="text-muted-foreground text-sm">All members are active! 🎉</p>
          ) : (
            inactiveMembers.map((member, index) => (
              <div key={`${member.display_name}-${index}`} className="flex justify-between items-center">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatLastLogin(member.last_login_at, member.daysSinceLogin)}
                  </p>
                </div>
                <Badge 
                  variant="outline" 
                  className="text-xs ml-2"
                >
                  {member.membership_type}
                </Badge>
              </div>
            ))
          )}
        </div>
        {totalInactive > 10 && (
          <div className="pt-3 border-t mt-3">
            <p className="text-xs text-muted-foreground">
              ... and {totalInactive - 10} more inactive members
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}