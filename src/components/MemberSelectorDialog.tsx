import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Star, X } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { User } from "@supabase/supabase-js"
import { useToast } from "@/hooks/use-toast"
import { getDisplayName, getInitials } from "@/lib/nameUtils"

interface Member {
  user_id: string
  nickname: string | null
  display_name: string | null
  first_name: string | null
  last_name: string | null
  avatar_url: string | null
  isFavorite: boolean
}

interface MemberSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  courseName: string
  courseDate: string
  courseTime: string
  user: User
}

export const MemberSelectorDialog: React.FC<MemberSelectorDialogProps> = ({
  open,
  onOpenChange,
  courseId,
  courseName,
  courseDate,
  courseTime,
  user
}) => {
  const [members, setMembers] = useState<Member[]>([])
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<'favorites' | 'all'>('favorites')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadMembers()
      loadFavorites()
      setSelectedMembers(new Set())
      setSearchQuery("")
    }
  }, [open])

  const loadMembers = async () => {
    setLoading(true)
    try {
      // Load admin user IDs
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin")
      
      const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || [])

      // Load all profiles except current user
      const { data } = await supabase
        .from("profiles")
        .select("user_id, nickname, display_name, first_name, last_name, avatar_url")
        .neq("user_id", user.id)

      // Filter out admins and users with display_name 'Admin'
      const filteredMembers = (data || []).filter(member => {
        return !adminUserIds.has(member.user_id) && 
               member.display_name?.toLowerCase() !== 'admin'
      })

      setMembers(filteredMembers.map(m => ({ ...m, isFavorite: false })))
    } catch (error) {
      console.error('Error loading members:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadFavorites = async () => {
    try {
      const { data } = await supabase
        .from("member_favorites")
        .select("favorite_user_id")
        .eq("user_id", user.id)

      setFavorites(new Set(data?.map(f => f.favorite_user_id) || []))
    } catch (error) {
      console.error('Error loading favorites:', error)
    }
  }

  const toggleFavorite = async (memberId: string) => {
    try {
      if (favorites.has(memberId)) {
        // Remove favorite
        await supabase
          .from("member_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("favorite_user_id", memberId)
        
        setFavorites(prev => {
          const newSet = new Set(prev)
          newSet.delete(memberId)
          return newSet
        })
      } else {
        // Add favorite
        await supabase
          .from("member_favorites")
          .insert({
            user_id: user.id,
            favorite_user_id: memberId
          })
        
        setFavorites(prev => new Set([...prev, memberId]))
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  const toggleSelection = (memberId: string) => {
    setSelectedMembers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(memberId)) {
        newSet.delete(memberId)
      } else {
        newSet.add(memberId)
      }
      return newSet
    })
  }

  const sendInvitations = async () => {
    if (selectedMembers.size === 0) return

    setSending(true)
    try {
      const recipientIds = Array.from(selectedMembers)

      // Check for existing invitations
      const { data: existingInvitations } = await supabase
        .from("course_invitations")
        .select("id, recipient_id, status")
        .eq("course_id", courseId)
        .eq("sender_id", user.id)
        .in("recipient_id", recipientIds)

      const existingMap = new Map(
        existingInvitations?.map(inv => [inv.recipient_id, inv]) || []
      )

      // Categorize recipients
      const toCreate: string[] = []
      const toReactivate: string[] = []
      const alreadyPending: string[] = []

      recipientIds.forEach(recipientId => {
        const existing = existingMap.get(recipientId)
        if (!existing) {
          toCreate.push(recipientId)
        } else if (existing.status === 'pending') {
          alreadyPending.push(recipientId)
        } else {
          // declined or accepted - reactivate
          toReactivate.push(existing.id)
        }
      })

      // Reactivate declined/accepted invitations
      if (toReactivate.length > 0) {
        await supabase
          .from("course_invitations")
          .update({ status: 'pending', responded_at: null })
          .in("id", toReactivate)
      }

      // Create new invitations
      if (toCreate.length > 0) {
        const newInvitations = toCreate.map(recipientId => ({
          course_id: courseId,
          sender_id: user.id,
          recipient_id: recipientId,
          status: 'pending'
        }))

        const { data: insertedInvitations, error } = await supabase
          .from("course_invitations")
          .insert(newInvitations)
          .select('id')

        if (error) throw error

        // Trigger webhook for each new invitation
        for (const invitation of insertedInvitations || []) {
          supabase.functions.invoke('notify-course-invitation', {
            body: { invitation_id: invitation.id }
          }).catch(err => console.error('Webhook error:', err))
        }
      }

      const sentCount = toCreate.length + toReactivate.length
      
      toast({
        title: "Invitations Sent",
        description: `${sentCount} invitation${sentCount !== 1 ? 's' : ''} sent successfully${alreadyPending.length > 0 ? `. ${alreadyPending.length} already pending.` : ''}`
      })

      onOpenChange(false)
    } catch (error) {
      console.error('Error sending invitations:', error)
      toast({
        title: "Error",
        description: "Failed to send invitations",
        variant: "destructive"
      })
    } finally {
      setSending(false)
    }
  }

  const filteredMembers = members.filter(member => {
    const name = getDisplayName(member).toLowerCase()
    const matchesSearch = name.includes(searchQuery.toLowerCase())
    const matchesTab = activeTab === 'all' || (activeTab === 'favorites' && favorites.has(member.user_id))
    return matchesSearch && matchesTab
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>Invite Members</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium">{courseName}</p>
            <p>{formatDate(courseDate)} · {courseTime}</p>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b px-4">
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-4 py-2 text-sm font-medium relative ${
              activeTab === 'favorites' 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Favorites
            {activeTab === 'favorites' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium relative ${
              activeTab === 'all' 
                ? 'text-foreground' 
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All
            {activeTab === 'all' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Member List */}
        <ScrollArea className="flex-1 px-4">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading members...
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              {activeTab === 'favorites' && favorites.size === 0 
                ? "No favorites yet. Go to 'All' to add some!" 
                : "No members found"}
            </div>
          ) : (
            <div className="space-y-2 py-2">
              {filteredMembers.map(member => (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedMembers.has(member.user_id)}
                    onCheckedChange={() => toggleSelection(member.user_id)}
                  />
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(member)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 font-medium truncate">
                    {getDisplayName(member)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(member.user_id)
                    }}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`h-5 w-5 ${
                        favorites.has(member.user_id)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="p-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={sendInvitations} 
            disabled={selectedMembers.size === 0 || sending}
          >
            {sending ? 'Sending...' : `Invite ${selectedMembers.size > 0 ? selectedMembers.size : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
