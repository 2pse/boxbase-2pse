import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Search, Plus, X, Edit } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { MembershipBadge } from "@/components/MembershipBadge"
import { getDisplayName } from "@/lib/nameUtils"
import { getPriorizedMembership, getMembershipTypeName } from "@/lib/membershipUtils"

interface Member {
  user_id: string
  display_name?: string | null
  first_name?: string | null
  last_name?: string | null
  nickname?: string | null
  membership_type?: string | null
  email?: string
}

interface AdminParticipantManagerProps {
  courseId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onParticipantAdded: () => void
}

export const AdminParticipantManager: React.FC<AdminParticipantManagerProps> = ({
  courseId,
  open,
  onOpenChange,
  onParticipantAdded
}) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [members, setMembers] = useState<Member[]>([])
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [registeredUserIds, setRegisteredUserIds] = useState<string[]>([])
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [editedEmail, setEditedEmail] = useState("")
  const [editedFirstName, setEditedFirstName] = useState("")
  const [editedLastName, setEditedLastName] = useState("")
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'trainer' | 'member' | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [totalMembers, setTotalMembers] = useState(0)
  const membersPerPage = 10

  useEffect(() => {
    if (open) {
      loadMembers()
      loadRegisteredUsers()
      loadCurrentUserRole()
    }
  }, [open, courseId])

  useEffect(() => {
    const filtered = members.filter(member => {
      const displayName = getDisplayName(member, currentUserRole)
      return displayName.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !registeredUserIds.includes(member.user_id)
    })
    setFilteredMembers(filtered)
    setCurrentPage(0) // Reset to first page when filtering
  }, [searchTerm, members, registeredUserIds, currentUserRole])

  const loadCurrentUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()

      setCurrentUserRole(data?.role as any || 'member')
    } catch (error) {
      console.error('Error loading user role:', error)
      setCurrentUserRole('member')
    }
  }

  const loadMembers = async () => {
    try {
      setLoading(true)
      
      // Get total count first
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('user_id', 'is', null)

      if (countError) throw countError
      setTotalMembers(count || 0)

      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name, first_name, last_name, nickname')
        .not('user_id', 'is', null)
        .order('display_name')

      if (profilesError) throw profilesError

      // Fetch all active memberships v2
      const { data: membershipsV2Data, error: membershipsV2Error } = await supabase
        .from('user_memberships_v2')
        .select(`
          user_id,
          status,
          membership_data,
          membership_plans_v2 (
            name,
            booking_rules
          )
        `)
        .eq('status', 'active')

      if (membershipsV2Error) throw membershipsV2Error

      // Process members with correct membership information
      const membersWithMembership = (profilesData || []).map(profile => {
        const userMemberships = membershipsV2Data?.filter(m => m.user_id === profile.user_id) || []
        const prioritizedMembership = getPriorizedMembership(userMemberships)
        const membershipTypeName = getMembershipTypeName(prioritizedMembership)

        return {
          user_id: profile.user_id,
          display_name: profile.display_name,
          first_name: profile.first_name,
          last_name: profile.last_name,
          nickname: profile.nickname,
          membership_type: membershipTypeName,
          email: `${getDisplayName(profile, 'admin')?.toLowerCase().replace(/\s+/g, '.')}@gym.com` || 'user@gym.com'
        }
      })

      setMembers(membersWithMembership)

    } catch (error) {
      console.error('Error loading members:', error)
      toast.error('Error loading members')
    } finally {
      setLoading(false)
    }
  }

  const loadRegisteredUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('course_registrations')
        .select('user_id')
        .eq('course_id', courseId)
        .eq('status', 'registered')

      if (error) throw error
      setRegisteredUserIds(data?.map(r => r.user_id) || [])
    } catch (error) {
      console.error('Error loading registered users:', error)
    }
  }

  const addParticipant = async (userId: string) => {
    try {
      // First check if there's an existing registration
      const { data: existingRegistration, error: checkError } = await supabase
        .from('course_registrations')
        .select('id, status')
        .eq('course_id', courseId)
        .eq('user_id', userId)
        .single()

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError
      }

      if (existingRegistration) {
        // Update existing registration to 'registered' status
        const { error: updateError } = await supabase
          .from('course_registrations')
          .update({ 
            status: 'registered',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRegistration.id)

        if (updateError) throw updateError
      } else {
        // Create new registration
        const { error: insertError } = await supabase
          .from('course_registrations')
          .insert({
            course_id: courseId,
            user_id: userId,
            status: 'registered'
          })

        if (insertError) throw insertError
      }
      
      toast.success('Teilnehmer hinzugefügt')
      await loadRegisteredUsers()
      onParticipantAdded()
    } catch (error) {
      console.error('Error adding participant:', error)
      toast.error('Fehler beim Hinzufügen des Teilnehmers')
    }
  }

  const startEditingMember = (member: Member) => {
    setEditingMember(member)
    setEditedEmail(member.email || '')
    setEditedFirstName(member.first_name || '')
    setEditedLastName(member.last_name || '')
  }

  const saveChanges = async () => {
    if (!editingMember) return

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          first_name: editedFirstName,
          last_name: editedLastName,
          display_name: `${editedFirstName} ${editedLastName}`.trim()
        })
        .eq('user_id', editingMember.user_id)

      if (profileError) throw profileError

      // Email is read-only, no updates needed

      toast.success('Mitglied erfolgreich aktualisiert')
      setEditingMember(null)
      await loadMembers()
    } catch (error) {
      console.error('Error updating member:', error)
      toast.error('Fehler beim Aktualisieren des Mitglieds')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Teilnehmer hinzufügen</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nach Mitglied suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="overflow-y-auto max-h-96 space-y-2">
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                {searchTerm ? 'Keine Mitglieder gefunden' : 'Alle Mitglieder sind bereits angemeldet'}
              </div>
            ) : (
              <>
                {filteredMembers
                  .slice(currentPage * membersPerPage, (currentPage + 1) * membersPerPage)
                  .map((member) => (
                    <Card key={member.user_id} className="cursor-pointer hover:bg-hover-neutral">
                      <CardContent className="p-3">
                         <div className="flex items-center justify-between">
                           <div className="flex-1">
                              <div className="flex items-center gap-3 mb-1">
                                <span className="font-medium">{getDisplayName(member, currentUserRole)}</span>
                                <MembershipBadge type={member.membership_type as any} forceBlack />
                              </div>
                             {member.email && (
                               <span className="text-sm text-muted-foreground">{member.email}</span>
                             )}
                           </div>
                            <Button
                              size="sm"
                              onClick={() => addParticipant(member.user_id)}
                              className="h-8 w-8 p-0"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                         </div>
                      </CardContent>
                    </Card>
                  ))}
                
                {/* Pagination */}
                {filteredMembers.length > membersPerPage && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                      disabled={currentPage === 0}
                    >
                      Vorherige
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Seite {currentPage + 1} von {Math.ceil(filteredMembers.length / membersPerPage)} 
                      ({filteredMembers.length} Mitglieder)
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(Math.ceil(filteredMembers.length / membersPerPage) - 1, currentPage + 1))}
                      disabled={currentPage >= Math.ceil(filteredMembers.length / membersPerPage) - 1}
                    >
                      Nächste
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </div>
      </DialogContent>
      
      {/* Edit Member Dialog */}
      {editingMember && (
        <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Mitglied bearbeiten</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="editFirstName">First Name</Label>
                <Input
                  id="editFirstName"
                  value={editedFirstName}
                  onChange={(e) => setEditedFirstName(e.target.value)}
                  placeholder="First Name"
                />
              </div>
              <div>
                <Label htmlFor="editLastName">Last Name</Label>
                <Input
                  id="editLastName"
                  value={editedLastName}
                  onChange={(e) => setEditedLastName(e.target.value)}
                  placeholder="Last Name"
                />
              </div>
              <div>
                <Label htmlFor="editEmail">Email</Label>
                <Input
                  id="editEmail"
                  type="email"
                  value={editedEmail}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                  placeholder="Email Address"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={saveChanges} disabled={!editedFirstName || !editedLastName}>
                  Speichern
                </Button>
                <Button variant="outline" onClick={() => setEditingMember(null)}>
                  Abbrechen
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}