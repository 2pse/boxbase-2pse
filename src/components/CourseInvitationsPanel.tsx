import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar, Clock, Check, X, MapPin } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { useToast } from "@/hooks/use-toast"
import { timezone } from "@/lib/timezone"
import { format } from "date-fns"
import { getDisplayName, getInitials } from "@/lib/nameUtils"

interface Invitation {
  id: string
  course_id: string
  sender_id: string
  recipient_id: string
  status: string
  message: string | null
  created_at: string
  responded_at: string | null
  courses: {
    title: string
    course_date: string
    start_time: string
    end_time: string
    trainer: string | null
    max_participants: number
  }
  sender_profile?: {
    nickname: string | null
    display_name: string | null
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  }
  recipient_profile?: {
    nickname: string | null
    display_name: string | null
    first_name: string | null
    last_name: string | null
    avatar_url: string | null
  }
}

interface CourseInvitationsPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User
  onNavigateToCourses?: () => void
}

export const CourseInvitationsPanel: React.FC<CourseInvitationsPanelProps> = ({
  open,
  onOpenChange,
  user,
  onNavigateToCourses
}) => {
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received')
  const [receivedInvitations, setReceivedInvitations] = useState<Invitation[]>([])
  const [sentInvitations, setSentInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadInvitations()
    }
  }, [open])

  const loadInvitations = async () => {
    setLoading(true)
    try {
      // Load received invitations
      const { data: received } = await supabase
        .from('course_invitations')
        .select(`
          *,
          courses (title, course_date, start_time, end_time, trainer, max_participants)
        `)
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })

      // Load sent invitations
      const { data: sent } = await supabase
        .from('course_invitations')
        .select(`
          *,
          courses (title, course_date, start_time, end_time, trainer, max_participants)
        `)
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })

      // Load sender profiles for received invitations
      const senderIds = [...new Set(received?.map(i => i.sender_id) || [])]
      const { data: senderProfiles } = await supabase
        .from('profiles')
        .select('user_id, nickname, display_name, first_name, last_name, avatar_url')
        .in('user_id', senderIds)

      // Load recipient profiles for sent invitations
      const recipientIds = [...new Set(sent?.map(i => i.recipient_id) || [])]
      const { data: recipientProfiles } = await supabase
        .from('profiles')
        .select('user_id, nickname, display_name, first_name, last_name, avatar_url')
        .in('user_id', recipientIds)

      // Map profiles to invitations
      const receivedWithProfiles = (received || []).map(inv => ({
        ...inv,
        sender_profile: senderProfiles?.find(p => p.user_id === inv.sender_id)
      }))

      const sentWithProfiles = (sent || []).map(inv => ({
        ...inv,
        recipient_profile: recipientProfiles?.find(p => p.user_id === inv.recipient_id)
      }))

      // Sort: active first, then expired
      const sortInvitations = (invitations: Invitation[]) => {
        return invitations.sort((a, b) => {
          const aExpired = isExpired(a.courses)
          const bExpired = isExpired(b.courses)
          if (aExpired && !bExpired) return 1
          if (!aExpired && bExpired) return -1
          return 0
        })
      }

      setReceivedInvitations(sortInvitations(receivedWithProfiles))
      setSentInvitations(sortInvitations(sentWithProfiles))
    } catch (error) {
      console.error('Error loading invitations:', error)
    } finally {
      setLoading(false)
    }
  }

  const isExpired = (courses: { course_date: string; end_time: string }) => {
    const nowInBerlin = timezone.nowInBerlin()
    const todayStr = format(nowInBerlin, 'yyyy-MM-dd')
    const nowTime = format(nowInBerlin, 'HH:mm:ss')
    
    return courses.course_date < todayStr || 
           (courses.course_date === todayStr && courses.end_time <= nowTime)
  }

  const handleAccept = async (invitation: Invitation) => {
    try {
      // 1. Check if user can register
      const { data: canRegister } = await supabase
        .rpc('can_user_register_for_course_enhanced', {
          p_user_id: user.id,
          p_course_id: invitation.course_id
        })

      const response = canRegister as any
      const canReg = response?.canRegister || false
      const canWaitlist = response?.canWaitlist || false

      if (!canReg && !canWaitlist) {
        toast({
          title: "Cannot Accept",
          description: "You cannot register for this course. Check your membership limits.",
          variant: "destructive"
        })
        return
      }

      // 2. Check for existing registration
      const { data: existingReg } = await supabase
        .from('course_registrations')
        .select('id, status')
        .eq('course_id', invitation.course_id)
        .eq('user_id', user.id)
        .maybeSingle()

      // Determine if waitlist
      const { data: regCount } = await supabase
        .from('course_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', invitation.course_id)
        .eq('status', 'registered')

      const isWaitlist = (regCount?.length || 0) >= invitation.courses.max_participants
      const newStatus = isWaitlist ? 'waitlist' : 'registered'

      // 3. Handle credit deduction (only for non-waitlist)
      if (!isWaitlist) {
        const { data: creditResult } = await supabase
          .rpc('handle_course_registration_credits', {
            p_user_id: user.id,
            p_course_id: invitation.course_id,
            p_action: 'deduct'
          })
        
        const creditData = creditResult as any
        if (creditData && !creditData.success) {
          toast({
            title: "Cannot Accept",
            description: creditData.message || "No credits available",
            variant: "destructive"
          })
          return
        }
      }

      // 4. Create or update registration
      if (existingReg) {
        const { error } = await supabase
          .from('course_registrations')
          .update({ 
            status: newStatus, 
            registered_at: new Date().toISOString() 
          })
          .eq('id', existingReg.id)

        if (error) {
          // Rollback credits
          if (!isWaitlist) {
            await supabase.rpc('handle_course_registration_credits', {
              p_user_id: user.id,
              p_course_id: invitation.course_id,
              p_action: 'refund'
            })
          }
          throw error
        }
      } else {
        const { error } = await supabase
          .from('course_registrations')
          .insert({
            course_id: invitation.course_id,
            user_id: user.id,
            status: newStatus
          })

        if (error) {
          // Rollback credits
          if (!isWaitlist) {
            await supabase.rpc('handle_course_registration_credits', {
              p_user_id: user.id,
              p_course_id: invitation.course_id,
              p_action: 'refund'
            })
          }
          throw error
        }
      }

      // 5. Update invitation status
      await supabase
        .from("course_invitations")
        .update({ 
          status: "accepted", 
          responded_at: new Date().toISOString() 
        })
        .eq("id", invitation.id)

      // 6. Dispatch events
      window.dispatchEvent(new Event('courseRegistrationChanged'))
      window.dispatchEvent(new Event('invitationCountChanged'))

      toast({
        title: isWaitlist ? "Added to Waitlist" : "Registration Successful",
        description: isWaitlist 
          ? "You have been added to the waitlist" 
          : "You have been registered for the course"
      })

      await loadInvitations()
    } catch (error) {
      console.error('Error accepting invitation:', error)
      toast({
        title: "Error",
        description: "Failed to accept invitation",
        variant: "destructive"
      })
    }
  }

  const handleDecline = async (invitation: Invitation) => {
    try {
      await supabase
        .from("course_invitations")
        .update({ 
          status: "declined", 
          responded_at: new Date().toISOString() 
        })
        .eq("id", invitation.id)

      window.dispatchEvent(new Event('invitationCountChanged'))
      
      toast({
        title: "Invitation Declined",
        description: "The invitation has been declined"
      })

      await loadInvitations()
    } catch (error) {
      console.error('Error declining invitation:', error)
      toast({
        title: "Error",
        description: "Failed to decline invitation",
        variant: "destructive"
      })
    }
  }

  const getStatusBadge = (status: string, expired: boolean) => {
    if (expired) {
      return <Badge className="bg-gray-400 text-white">Expired</Badge>
    }
    switch (status) {
      case 'pending':
        return <Badge className="bg-yellow-500 text-white">Pending</Badge>
      case 'accepted':
        return <Badge className="bg-green-600 text-white">Accepted</Badge>
      case 'declined':
        return <Badge className="bg-red-600 text-white">Declined</Badge>
      default:
        return null
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    })
  }

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5)
  }

  const renderInvitationCard = (invitation: Invitation, type: 'received' | 'sent') => {
    const expired = isExpired(invitation.courses)
    const profile = type === 'received' ? invitation.sender_profile : invitation.recipient_profile
    const label = type === 'received' ? 'From' : 'To'

    return (
      <Card 
        key={invitation.id} 
        className={`${expired ? 'opacity-50' : ''}`}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {profile ? getInitials(profile) : '?'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-medium">
                  {profile ? getDisplayName(profile) : 'Unknown'}
                </p>
              </div>
            </div>
            {getStatusBadge(invitation.status, expired)}
          </div>

          <div className="space-y-1">
            <p className="font-semibold">{invitation.courses.title}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(invitation.courses.course_date)}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(invitation.courses.start_time)} - {formatTime(invitation.courses.end_time)}
              </div>
            </div>
            {invitation.courses.trainer && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {invitation.courses.trainer}
              </div>
            )}
          </div>

          {/* Action buttons for received pending invitations */}
          {type === 'received' && invitation.status === 'pending' && !expired && (
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={() => handleAccept(invitation)}
                className="flex-1"
                size="sm"
              >
                <Check className="h-4 w-4 mr-1" />
                Accept
              </Button>
              <Button 
                onClick={() => handleDecline(invitation)}
                variant="outline"
                className="flex-1"
                size="sm"
              >
                <X className="h-4 w-4 mr-1" />
                Decline
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const currentInvitations = activeTab === 'received' ? receivedInvitations : sentInvitations

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] p-0">
        <SheetHeader className="p-4 pb-2 border-b">
          <SheetTitle>Course Invitations</SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <div className="flex border-b px-4">
          <button
            onClick={() => setActiveTab('received')}
            className={`px-4 py-2 text-sm font-medium relative ${
              activeTab === 'received' 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Received
            {activeTab === 'received' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-4 py-2 text-sm font-medium relative ${
              activeTab === 'sent' 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Sent
            {activeTab === 'sent' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        <ScrollArea className="flex-1 h-[calc(85vh-120px)]">
          <div className="p-4 space-y-3">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading invitations...
              </div>
            ) : currentInvitations.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No {activeTab} invitations
              </div>
            ) : (
              currentInvitations.map(invitation => 
                renderInvitationCard(invitation, activeTab)
              )
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
