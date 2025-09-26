import { useState, useEffect } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MembershipBadge } from "@/components/MembershipBadge"
import { Trash2, Plus, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { AdminParticipantManager } from "@/components/AdminParticipantManager"
import { ProfileImageViewer } from "@/components/ProfileImageViewer"
import { getDisplayName } from "@/lib/nameUtils"
import { Database } from "@/integrations/supabase/types"

interface Course {
  id: string
  title: string
  trainer: string
  course_date: string
  start_time: string
  end_time: string
  max_participants: number
  registered_count: number
  waitlisted_count: number
}

interface Participant {
  id: string
  user_id: string
  status: string
  registered_at: string
  display_name: string
  membership_type: string
  avatar_url?: string
  nickname?: string
}

interface CourseParticipantsListProps {
  course: Course
  onClose: () => void
  isAdmin?: boolean
}

export const CourseParticipantsList: React.FC<CourseParticipantsListProps> = ({
  course,
  onClose,
  isAdmin = false
}) => {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<{ imageUrl: string | null; displayName: string } | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'trainer' | 'member' | null>(null)

  useEffect(() => {
    loadCurrentUserRole()
  }, [course.id])

  useEffect(() => {
    if (currentUserRole !== null) {
      loadParticipants()
    }
  }, [course.id, currentUserRole])

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

  // Removed: Waitlist processing is now handled by database trigger automatically

  const loadParticipants = async () => {
    try {
      setLoading(true)
      
      // Get registrations
      const { data: registrations, error: regError } = await supabase
        .from('course_registrations')
        .select('id, user_id, status, registered_at')
        .eq('course_id', course.id)
        .order('registered_at', { ascending: true })

      if (regError) throw regError

      if (!registrations || registrations.length === 0) {
        setParticipants([])
        return
      }

      // Get profiles for these users
      const userIds = registrations.map(r => r.user_id)
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, display_name, first_name, last_name, nickname, avatar_url')
        .in('user_id', userIds)

      if (profileError) throw profileError

      // Combine data
      const participantsData = registrations.map(reg => {
        const profile = profiles?.find(p => p.user_id === reg.user_id)
        return {
          id: reg.id,
          user_id: reg.user_id,
          status: reg.status,
          registered_at: reg.registered_at,
          display_name: profile ? getDisplayName({
            first_name: profile.first_name,
            last_name: profile.last_name, // Show last_name for admin users
            nickname: profile.nickname,
            display_name: profile.display_name
          }, currentUserRole) : 'Unbekannt',
          membership_type: 'Member', // Default since membership_type is not available for other users
          avatar_url: profile?.avatar_url,
          nickname: profile?.nickname
        }
      })

      setParticipants(participantsData)
    } catch (error) {
      console.error('Error loading participants:', error)
      toast.error('Error loading participants')
    } finally {
      setLoading(false)
    }
  }

  const removeParticipant = async (registrationId: string) => {
    try {
      const { error } = await supabase
        .from('course_registrations')
        .update({ status: 'cancelled' })
        .eq('id', registrationId)

      if (error) throw error
      toast.success('Teilnehmer entfernt')

      await loadParticipants()
    } catch (error) {
      console.error('Error removing participant:', error)
      toast.error('Fehler beim Entfernen des Teilnehmers')
    }
  }

  const promoteFromWaitlist = async (registrationId: string, participantName: string) => {
    try {
      const { error } = await supabase
        .from('course_registrations')
        .update({ status: 'registered' })
        .eq('id', registrationId)

      if (error) throw error
      toast.success(`${participantName} zum Kurs hinzugefügt`)

      // Trigger Make.com notification via Edge Function
      try {
        const { error: notifyError } = await supabase.functions.invoke('notify-waitlist-promotion', {
          body: { registration_id: registrationId }
        })
        if (notifyError) {
          console.error('Notify waitlist promotion error:', notifyError)
          toast.warning('Benachrichtigung konnte nicht gesendet werden')
        } else {
          console.log('Waitlist notification triggered')
        }
      } catch (notifyErr) {
        console.error('Notify waitlist promotion exception:', notifyErr)
        toast.warning('Benachrichtigung konnte nicht gesendet werden')
      }

      // Removed: Waitlist processing is now handled by database trigger automatically

      await loadParticipants()
    } catch (error) {
      console.error('Error promoting participant:', error)
      toast.error('Fehler beim Hinzufügen zum Kurs')
    }
  }

  const registeredParticipants = participants.filter(p => p.status === 'registered')
  const waitlistedParticipants = participants.filter(p => p.status === 'waitlisted' || p.status === 'waitlist')

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
        <p className="text-muted-foreground">Loading Participants...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Kurs-Teilnehmer verwalten</h2>
        <div className="flex gap-2">
          {isAdmin && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Hinzufügen
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Schließen
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{course.title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={`text-white ${registeredParticipants.length > course.max_participants ? 'bg-orange-500' : 'bg-green-500'}`}>
                {registeredParticipants.length}/{course.max_participants} angemeldet
              </Badge>
              {waitlistedParticipants.length > 0 && (
                <Badge variant="outline" className="bg-yellow-500 text-white">
                  {waitlistedParticipants.length} wartend
                </Badge>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Trainer: {course.trainer} • {new Date(course.course_date).toLocaleDateString('de-DE')} • {course.start_time.slice(0, 5)} - {course.end_time.slice(0, 5)}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Registered Participants */}
          <div>
            <h3 className="font-medium text-sm mb-3">Angemeldete Teilnehmer</h3>
            {registeredParticipants.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Keine Anmeldungen</p>
            ) : (
              <div className="space-y-3">
                 {registeredParticipants.map((participant) => (
                  <div key={participant.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg min-h-[60px]">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <img
                        src={participant.avatar_url || '/placeholder.svg'}
                        alt={participant.display_name}
                        className="w-8 h-8 rounded-full object-cover border border-border cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                        onClick={() => setSelectedProfile({ 
                          imageUrl: participant.avatar_url || null, 
                          displayName: participant.display_name
                        })}
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium truncate">{participant.display_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(participant.registered_at).toLocaleDateString('de-DE')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeParticipant(participant.id)}
                          className="text-destructive hover:text-destructive h-8 w-8 p-0"
                          title="Entfernen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Waitlist Section */}
          {waitlistedParticipants.length > 0 && (
            <div>
              <h3 className="font-medium text-sm mb-3">Warteliste</h3>
              {isAdmin ? (
                <div className="space-y-3">
                  {waitlistedParticipants.map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg min-h-[60px]">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <img
                          src={participant.avatar_url || '/placeholder.svg'}
                          alt={participant.display_name}
                          className="w-8 h-8 rounded-full object-cover border border-border cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                          onClick={() => setSelectedProfile({ 
                            imageUrl: participant.avatar_url || null, 
                            displayName: participant.display_name
                          })}
                        />
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-medium truncate">{participant.display_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(participant.registered_at).toLocaleDateString('de-DE')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => promoteFromWaitlist(participant.id, participant.display_name)}
                          className="bg-green-600 hover:bg-green-700 text-white h-8 w-8 p-0"
                          title="Zum Kurs hinzufügen"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeParticipant(participant.id)}
                          className="text-destructive hover:text-destructive h-8 w-8 p-0"
                          title="Entfernen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {waitlistedParticipants.length} Person(en) auf der Warteliste
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    Namen werden aus Datenschutzgründen nicht angezeigt
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>


      <AdminParticipantManager
        courseId={course.id}
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onParticipantAdded={loadParticipants}
      />
      
      <ProfileImageViewer
        isOpen={!!selectedProfile}
        onClose={() => setSelectedProfile(null)}
        imageUrl={selectedProfile?.imageUrl || null}
        displayName={selectedProfile?.displayName || ''}
      />
    </div>
  )
}
