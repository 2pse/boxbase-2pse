import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LogOut, Dumbbell, Target, Moon, Sun, RotateCcw, Eye, EyeOff, Trophy } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { supabase } from "@/integrations/supabase/client"
import { useNavigate } from "react-router-dom"
import { useToast } from "@/hooks/use-toast"
import { AvatarUpload } from "@/components/AvatarUpload"
import { useTheme } from "next-themes"

import { useGymSettings } from "@/contexts/GymSettingsContext"
import { getDisplayName } from "@/lib/nameUtils"
import { YearlyTrainingHeatmap } from "@/components/YearlyTrainingHeatmap"

interface UserProfileProps {
  onClose: () => void
}

export const UserProfile: React.FC<UserProfileProps> = ({ onClose }) => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const { settings } = useGymSettings()
  
  const primaryColor = settings?.primary_color || '#B81243'
  
  // Form states
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [nickname, setNickname] = useState("")
  const [accessCode, setAccessCode] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [userId, setUserId] = useState<string>("")
  const [membershipType, setMembershipType] = useState<string | null>(null)
  const [accessCodeError, setAccessCodeError] = useState("")
  const [showAccessCode, setShowAccessCode] = useState(false)
  const [leaderboardVisible, setLeaderboardVisible] = useState(true)

  useEffect(() => {
    loadProfile()
    checkDailyRefresh()
  }, [])

  const checkDailyRefresh = () => {
    const lastRefresh = localStorage.getItem('lastAppRefresh')
    const now = new Date()
    const today = now.toDateString()
    
    if (!lastRefresh || lastRefresh !== today) {
      localStorage.setItem('lastAppRefresh', today)
      if (lastRefresh) {
        setTimeout(() => window.location.reload(), 2000)
      }
    }
  }

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profile) {
        setFirstName(profile.first_name || "")
        setLastName(profile.last_name || "")
        setDisplayName(profile.display_name || "")
        setNickname(profile.nickname || "")
        setAccessCode(profile.access_code || "")
        setAvatarUrl(profile.avatar_url)
        setMembershipType(profile.membership_type || null)
        setLeaderboardVisible(profile.leaderboard_visible ?? true)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    }
  }

  const validateAccessCode = (code: string) => {
    if (!code) {
      setAccessCodeError("Access code is required")
      return false
    }
    if (!/^\d+$/.test(code)) {
      setAccessCodeError("Access code may only contain numbers")
      return false
    }
    if (code.length < 6) {
      setAccessCodeError("Access code must have at least 6 digits")
      return false
    }
    setAccessCodeError("")
    return true
  }

  const handleAccessCodeChange = (value: string) => {
    // Only allow numbers
    const numericValue = value.replace(/\D/g, '')
    setAccessCode(numericValue)
    if (numericValue) {
      validateAccessCode(numericValue)
    } else {
      setAccessCodeError("")
    }
  }

  const saveLeaderboardVisibility = async (visible: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('profiles')
        .update({ leaderboard_visible: visible })
        .eq('user_id', user.id)

      if (error) throw error

      toast({
        title: "Setting saved",
        description: visible ? "You will be shown in the leaderboard." : "You will no longer be shown in the leaderboard.",
      })
    } catch (error) {
      console.error('Error saving leaderboard visibility:', error)
      // Rollback the state on error
      setLeaderboardVisible(!visible)
      toast({
        title: "Error",
        description: "Leaderboard setting could not be saved.",
        variant: "destructive"
      })
    }
  }

  const handleLeaderboardVisibilityChange = async (checked: boolean) => {
    // Optimistic update
    setLeaderboardVisible(checked)
    
    try {
      // Save immediately
      await saveLeaderboardVisibility(checked)
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('leaderboardVisibilityChanged', {
        detail: { visible: checked }
      }))
    } catch (error) {
      // Revert on error
      setLeaderboardVisible(!checked)
    }
  }

  const saveProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      // Validate access code before saving
      if (!validateAccessCode(accessCode)) {
        toast({
          title: "Error",
          description: "Please check your access code.",
          variant: "destructive"
        })
        return
      }

      // Update profile fields (excluding leaderboard_visible as it's handled separately)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ nickname })
        .eq('user_id', user.id)

      if (profileError) throw profileError

      // Update access code using edge function (updates both profile and auth password)
      const { data, error: accessCodeError } = await supabase.functions.invoke('update-access-code', {
        body: { newAccessCode: accessCode }
      })

      if (accessCodeError) {
        console.error('Access code update error:', accessCodeError)
        throw new Error(accessCodeError.message || 'Error updating access code')
      }

      toast({
        title: "Profile saved",
        description: "Access code successfully changed. Use the new code for the next login.",
      })
    } catch (error) {
      console.error('Error saving profile:', error)
      toast({
        title: "Error",
        description: (error as any)?.message ?? "Profile could not be saved.",
        variant: "destructive"
      })
    }
  }

  const handleLogout = async () => {
    try {
      // Set logout flag to prevent AuthKeeper interference
      localStorage.setItem('logging_out', 'true')
      
      // Show loading state
      toast({
        title: "Logging out...",
        description: "You are being logged out.",
      })

      // Clear local storage first (immediate UI feedback)
      localStorage.removeItem('mockUser')
      localStorage.removeItem('lastAppRefresh')
      
      try {
        // Attempt proper logout
        await supabase.auth.signOut()
      } catch (authError: any) {
        // Handle session already invalid gracefully
        console.log('Session already invalid or logout failed:', authError)
        // Don't throw error - we still want to redirect
      }

      // Clear logout flag
      localStorage.removeItem('logging_out')

      // Always navigate away regardless of Supabase logout success
      navigate('/')
      
      toast({
        title: "Successfully logged out",
        description: "You have been successfully logged out.",
      })
    } catch (error) {
      console.error('Error during logout:', error)
      // Clear logout flag
      localStorage.removeItem('logging_out')
      // Fallback: still navigate away even on error
      navigate('/')
      toast({
        title: "Logged out",
        description: "You have been logged out.",
        variant: "default"
      })
    }
  }

  const navigateToStrengthValues = () => {
    navigate('/pro/strength-values')
  }

  const navigateToExercises = () => {
    navigate('/pro/exercises')
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      <div className="max-w-2xl mx-auto p-3 md:p-4 pb-20 md:pb-24">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <h1 className="text-xl md:text-3xl font-bold">Profile</h1>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>

        {/* Basic Data - always visible */}
        <Card className="border-primary/20 mb-3 md:mb-4">
          <CardHeader className="pb-3 md:pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg md:text-2xl">Basic Data</CardTitle>
              <Button
                onClick={handleRefresh}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <RotateCcw className="h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:space-y-4">
              <div className="flex flex-col items-center space-y-3 md:space-y-4 mb-4 md:mb-6">
                <AvatarUpload 
                  userId={userId} 
                  currentAvatarUrl={avatarUrl}
                  showUploadButton={false}
                  onAvatarUpdate={(newUrl) => {
                    setAvatarUrl(newUrl)
                    // Also reload the profile to get the latest data
                    loadProfile()
                  }}
                />
                <div className="text-center">
                  <h3 className="text-base md:text-xl font-semibold text-foreground">{displayName || `${firstName} ${lastName}`.trim()}</h3>
                  <p className="text-xs md:text-base text-muted-foreground">{membershipType}</p>
                </div>
              </div>

              <div>
                <Label htmlFor="nickname" className="text-sm md:text-lg text-foreground">Nickname (visible to others) *</Label>
                <Input
                  id="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Your nickname (optional)"
                  className="bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 md:h-12 text-sm md:text-lg"
                />
              </div>

              <div>
                <Label htmlFor="accessCode" className="text-sm md:text-lg text-foreground">Access Code (at least 6 digits) *</Label>
                <div className="relative">
                  <Input
                    id="accessCode"
                    type={showAccessCode ? "text" : "password"}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={accessCode}
                    onChange={(e) => handleAccessCodeChange(e.target.value.replace(/\s/g, ''))}
                    placeholder="123456"
                    maxLength={12}
                    className={`pr-10 bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 h-9 md:h-12 text-sm md:text-lg ${accessCodeError ? "border-destructive" : ""}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowAccessCode(!showAccessCode)}
                  >
                    {showAccessCode ? (
                      <EyeOff className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {accessCodeError && (
                  <p className="text-sm md:text-base text-destructive mt-1">{accessCodeError}</p>
                )}
                <p className="text-xs md:text-base text-muted-foreground mt-1">
                  Your personal access code for the app
                </p>
              </div>
              
              <Button onClick={saveProfile} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-[1.02]">
                Save Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Training Log - Jahresübersicht */}
        <YearlyTrainingHeatmap 
          userId={userId}
          primaryColor={primaryColor}
        />

        {/* Navigation to Strength Values and Exercises */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-3 md:mb-4">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 md:p-6 cursor-pointer hover:bg-gray-150 dark:hover:bg-gray-700 transition-all hover:scale-[1.02]" onClick={navigateToStrengthValues}>
            <div className="flex flex-col items-center justify-center text-center">
              <Dumbbell className="h-6 w-6 md:h-10 md:w-10 mb-2 text-primary" />
              <h3 className="font-semibold text-sm md:text-lg text-foreground">Strength Values</h3>
              <p className="text-xs md:text-base text-muted-foreground">Manage 1RM values</p>
            </div>
          </div>
          
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 md:p-6 cursor-pointer hover:bg-gray-150 dark:hover:bg-gray-700 transition-all hover:scale-[1.02]" onClick={navigateToExercises}>
            <div className="flex flex-col items-center justify-center text-center">
              <Target className="h-6 w-6 md:h-10 md:w-10 mb-2 text-primary" />
              <h3 className="font-semibold text-sm md:text-lg text-foreground">Exercises</h3>
              <p className="text-xs md:text-base text-muted-foreground">Edit preferences</p>
            </div>
          </div>
        </div>

        {/* Contact Tile */}
        {(settings?.whatsapp_number || settings?.contact_email) && (
          <Card className="border-primary/20 mb-4">
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl">Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {settings?.whatsapp_number && (
                  <a
                    href={`https://wa.me/${settings.whatsapp_number.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-gray-200 dark:bg-gray-700 rounded-2xl hover:bg-gray-250 dark:hover:bg-gray-600 transition-all hover:scale-[1.02]"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488"/>
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-sm md:text-lg text-foreground">WhatsApp</p>
                        <p className="text-xs md:text-base text-muted-foreground">{settings.whatsapp_number}</p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
                
                {settings?.contact_email && (
                  <a
                    href={`mailto:${settings.contact_email}`}
                    className="flex items-center justify-between p-3 bg-gray-200 dark:bg-gray-700 rounded-2xl hover:bg-gray-250 dark:hover:bg-gray-600 transition-all hover:scale-[1.02]"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-sm md:text-lg text-foreground">Email</p>
                        <p className="text-xs md:text-base text-muted-foreground">{settings.contact_email}</p>
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settings - moved to end */}
        <Card className="border-primary/20 mb-4">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Dark Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {theme === 'dark' ? (
                    <Moon className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
                  ) : (
                    <Sun className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
                  )}
                  <Label htmlFor="dark-mode" className="text-sm md:text-lg text-foreground">Dark Mode</Label>
                </div>
                <Switch
                  id="dark-mode"
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
              </div>

              {/* Leaderboard Visibility Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Trophy className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
                  <Label htmlFor="leaderboard-visible" className="text-sm md:text-lg text-foreground">Show in Leaderboard</Label>
                </div>
                <Switch
                  id="leaderboard-visible"
                  checked={leaderboardVisible}
                  onCheckedChange={handleLeaderboardVisibilityChange}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logout Button - at the end of the page */}
        <div className="mt-8 mb-8">
          <Button 
            onClick={handleLogout} 
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-[1.02]"
            size="lg"
          >
            <LogOut className="mr-2 h-4 w-4 md:h-5 md:w-5" />
            Log out
          </Button>
        </div>
      </div>
    </div>
  )
}