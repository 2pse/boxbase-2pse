import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Upload, Image as ImageIcon, Palette, Settings, Save, X, User, Lock, Webhook, ExternalLink, ChevronDown } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useGymSettings } from "@/contexts/GymSettingsContext"

interface GymSettingsData {
  id: string
  gym_name: string
  logo_light_url: string | null
  logo_dark_url: string | null
  app_icon_url: string | null
  primary_color: string
  whatsapp_number: string | null
  contact_email: string | null
  address: string | null
  webhook_member_url: string | null
  webhook_waitlist_url: string | null
  webhook_reactivation_url: string | null
  show_functional_fitness_workouts: boolean
  show_bodybuilding_workouts: boolean
}

export const GymSettings = () => {
  const [settings, setSettings] = useState<GymSettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState<'light' | 'dark' | 'app' | null>(null)
  
  // Collapsible states
  const [brandingOpen, setBrandingOpen] = useState(false)
  const [adminProfileOpen, setAdminProfileOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [webhooksOpen, setWebhooksOpen] = useState(false)
  
  // Admin profile state
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [updatingProfile, setUpdatingProfile] = useState(false)
  
  const { toast } = useToast()
  const { refreshSettings } = useGymSettings()

  useEffect(() => {
    loadSettings()
    loadAdminData()
  }, [])

  const loadAdminData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setAdminEmail(user.email)
      }
    } catch (error) {
      console.error('Error loading admin data:', error)
    }
  }

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('gym_settings')
        .select('*')
        .maybeSingle()

      if (error) {
        console.error('Error loading gym settings:', error)
        toast({
          title: "Error",
          description: "Error loading gym settings",
          variant: "destructive",
        })
        return
      }

      if (data) {
        setSettings(data)
      } else {
        // No settings exist, create default settings
        await createDefaultSettings()
      }
    } catch (error) {
      console.error('Error loading gym settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const createDefaultSettings = async () => {
    try {
      const defaultSettings = {
        gym_name: "Mein Studio",
        primary_color: "#52a7b4",
        theme_mode: "both",
        show_functional_fitness_workouts: true,
        show_bodybuilding_workouts: true
      }

      const { data, error } = await supabase
        .from('gym_settings')
        .insert(defaultSettings)
        .select()
        .single()

      if (error) {
        console.error('Error creating default settings:', error)
        toast({
          title: "Error",
          description: "Error creating default settings",
          variant: "destructive",
        })
        return
      }

      setSettings(data)
      toast({
        title: "Success",
        description: "Default settings have been created",
      })
    } catch (error) {
      console.error('Error creating default settings:', error)
    }
  }

  const handleLogoUpload = async (file: File, type: 'light' | 'dark' | 'app') => {
    if (!settings) return

    setUploadingLogo(type)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${type}-${type === 'app' ? 'icon' : 'logo'}-${Date.now()}.${fileExt}`
      const filePath = fileName

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('gym-logos')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        toast({
          title: "Error",
          description: "Error uploading logo",
          variant: "destructive",
        })
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('gym-logos')
        .getPublicUrl(filePath)

      if (!urlData?.publicUrl) {
        toast({
          title: "Error",
          description: "Error retrieving logo URL",
          variant: "destructive",
        })
        return
      }

      // Update settings
      const fieldName = type === 'light' ? 'logo_light_url' : 
                       type === 'dark' ? 'logo_dark_url' : 'app_icon_url';
      const updatedSettings = {
        ...settings,
        [fieldName]: urlData.publicUrl
      }

      setSettings(updatedSettings)

      const description = type === 'light' ? 'Light logo successfully uploaded' :
                         type === 'dark' ? 'Dark logo successfully uploaded' :
                         'App icon successfully uploaded';
      toast({
        title: "Success",
        description,
      })
    } catch (error) {
      console.error('Error uploading logo:', error)
      toast({
        title: "Error",
        description: "Error uploading logo",
        variant: "destructive",
      })
    } finally {
      setUploadingLogo(null)
    }
  }

  const handleLogoRemove = async (type: 'light' | 'dark' | 'app') => {
    if (!settings) return

    const fieldName = type === 'light' ? 'logo_light_url' : 
                     type === 'dark' ? 'logo_dark_url' : 'app_icon_url';
    
    const updatedSettings = {
      ...settings,
      [fieldName]: null
    }

    setSettings(updatedSettings)

    const description = type === 'light' ? 'Light logo removed' :
                       type === 'dark' ? 'Dark logo removed' :
                       'App icon removed';
    toast({
      title: "Success",
      description,
    })
  }

  const handleSave = async () => {
    if (!settings) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('gym_settings')
        .update({
          gym_name: settings.gym_name,
          logo_light_url: settings.logo_light_url,
          logo_dark_url: settings.logo_dark_url,
          app_icon_url: settings.app_icon_url,
          primary_color: settings.primary_color,
          theme_mode: 'both',
          whatsapp_number: settings.whatsapp_number,
          contact_email: settings.contact_email,
          address: settings.address,
          webhook_member_url: settings.webhook_member_url,
          webhook_waitlist_url: settings.webhook_waitlist_url,
          webhook_reactivation_url: settings.webhook_reactivation_url,
          show_functional_fitness_workouts: settings.show_functional_fitness_workouts,
          show_bodybuilding_workouts: settings.show_bodybuilding_workouts,
        })
        .eq('id', settings.id)

      if (error) {
        console.error('Error saving settings:', error)
        toast({
          title: "Error",
          description: "Error saving settings",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Settings successfully saved",
      })

      // Refresh global settings context to apply changes immediately
      await refreshSettings()
    } catch (error) {
      console.error('Error saving settings:', error)
      toast({
        title: "Error",
        description: "Error saving settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!adminEmail && !adminPassword) {
      toast({
        title: "Error",
        description: "Please enter an email or new password",
        variant: "destructive",
      })
      return
    }

    setUpdatingProfile(true)
    try {
      const updateData: any = {}
      if (adminEmail) updateData.email = adminEmail
      if (adminPassword) updateData.password = adminPassword

      const { data, error } = await supabase.functions.invoke('update-admin-profile', {
        body: updateData
      })

      if (error) {
        console.error('Error updating admin profile:', error)
        toast({
          title: "Error",
          description: "Error updating admin profile",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Success",
        description: "Admin profile successfully updated",
      })

      // Clear password field after successful update
      setAdminPassword("")
      
      // Reload admin data
      await loadAdminData()
      
    } catch (error) {
      console.error('Error updating admin profile:', error)
      toast({
        title: "Error",
        description: "Unexpected error updating profile",
        variant: "destructive",
      })
    } finally {
      setUpdatingProfile(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-10 bg-gray-200 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Creating default settings...</p>
            <div className="animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage studio settings, branding and contact information</p>
      </div>
      
      {/* Branding & Design Section */}
      <Collapsible open={brandingOpen} onOpenChange={setBrandingOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Branding
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${brandingOpen ? 'transform rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="gym_name">Gym Name</Label>
                <Input
                  id="gym_name"
                  value={settings.gym_name}
                  onChange={(e) => setSettings({ ...settings, gym_name: e.target.value })}
                  placeholder="Gym Name"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Light Mode Logo */}
                <div>
                  <Label>Logo for Light Design</Label>
                  <div className="mt-2 space-y-4">
                    {settings.logo_light_url && (
                      <div className="space-y-2">
                        <div className="p-4 border rounded-lg bg-white">
                          <img 
                            src={settings.logo_light_url} 
                            alt="Light Logo" 
                            className="h-16 object-contain"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLogoRemove('light')}
                          className="w-full text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remove Logo
                        </Button>
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleLogoUpload(file, 'light')
                        }}
                        className="hidden"
                        id="light-logo-upload"
                      />
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById('light-logo-upload')?.click()}
                        disabled={uploadingLogo === 'light'}
                        className="w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingLogo === 'light' ? 'Uploading...' : 'Upload Logo'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Dark Mode Logo */}
                <div>
                  <Label>Logo for Dark Design</Label>
                  <div className="mt-2 space-y-4">
                    {settings.logo_dark_url && (
                      <div className="space-y-2">
                        <div className="p-4 border rounded-lg bg-gray-900">
                          <img 
                            src={settings.logo_dark_url} 
                            alt="Dark Logo" 
                            className="h-16 object-contain"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLogoRemove('dark')}
                          className="w-full text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remove Logo
                        </Button>
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleLogoUpload(file, 'dark')
                        }}
                        className="hidden"
                        id="dark-logo-upload"
                      />
                      <Button
                        variant="outline"
                        onClick={() => document.getElementById('dark-logo-upload')?.click()}
                        disabled={uploadingLogo === 'dark'}
                        className="w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingLogo === 'dark' ? 'Uploading...' : 'Upload Logo'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* App Icon */}
              <div>
                <Label>App Icon</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Recommended size: 512x512 pixels (square)
                </p>
                <div className="mt-2 space-y-4">
                  {settings.app_icon_url && (
                    <div className="space-y-2">
                      <div className="p-4 border rounded-lg bg-background">
                        <img 
                          src={settings.app_icon_url} 
                          alt="App Icon" 
                          className="h-16 w-16 object-contain rounded"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLogoRemove('app')}
                        className="w-full text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Remove App Icon
                      </Button>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleLogoUpload(file, 'app')
                      }}
                      className="hidden"
                      id="app-icon-upload"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('app-icon-upload')?.click()}
                      disabled={uploadingLogo === 'app'}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingLogo === 'app' ? 'Uploading...' : 'Upload App Icon'}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Primary Color */}
              <div>
                <Label htmlFor="primary_color">Primary Color</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Choose the main color of your studio
                </p>
                <div className="space-y-3">
                  <div className="flex gap-3 items-center">
                    <div className="relative">
                      <Input
                        id="primary_color"
                        type="color"
                        value={settings.primary_color}
                        onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                        className="w-16 h-16 p-1 border-2 cursor-pointer rounded-lg"
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        value={settings.primary_color}
                        onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                        placeholder="#52a7b4"
                        className="font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ backgroundColor: `${settings.primary_color}15` }}>
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: settings.primary_color }}></div>
                    <span className="text-sm text-muted-foreground">Preview of selected color</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Admin Profile Settings */}
      <Collapsible open={adminProfileOpen} onOpenChange={setAdminProfileOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Admin Profile
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${adminProfileOpen ? 'transform rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <form onSubmit={handleUpdateAdminProfile} className="space-y-6">
                <div>
                  <Label htmlFor="admin_email">Email Address</Label>
                  <Input
                    id="admin_email"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@gym.de"
                  />
                </div>

                <div>
                  <Label htmlFor="admin_password">New Password</Label>
                  <Input
                    id="admin_password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Leave empty if no change"
                  />
                </div>

                <Button 
                  type="submit" 
                  disabled={updatingProfile}
                  className="w-full"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {updatingProfile ? 'Updating...' : 'Update Profile'}
                </Button>
              </form>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Contact Information */}
      <Collapsible open={contactOpen} onOpenChange={setContactOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Contact Information
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${contactOpen ? 'transform rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
                <Input
                  id="whatsapp_number"
                  value={settings.whatsapp_number || ''}
                  onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
                  placeholder="+49 123 456789"
                />
              </div>

              <div>
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={settings.contact_email || ''}
                  onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
                  placeholder="info@gym.de"
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Webhooks */}
      <Collapsible open={webhooksOpen} onOpenChange={setWebhooksOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  Webhooks
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${webhooksOpen ? 'transform rotate-180' : ''}`} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="webhook_member_url">Member Webhook URL</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Triggered when members are created
                </p>
                <div className="flex gap-2">
                  <Input
                    id="webhook_member_url"
                    value={settings.webhook_member_url || ''}
                    onChange={(e) => setSettings({ ...settings, webhook_member_url: e.target.value })}
                    placeholder="https://hook.eu2.make.com/..."
                  />
                  {settings.webhook_member_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(settings.webhook_member_url!, '_blank')}
                      title="Test webhook"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="webhook_waitlist_url">Waitlist Webhook URL</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Triggered when promoted from waitlist
                </p>
                <div className="flex gap-2">
                  <Input
                    id="webhook_waitlist_url"
                    value={settings.webhook_waitlist_url || ''}
                    onChange={(e) => setSettings({ ...settings, webhook_waitlist_url: e.target.value })}
                    placeholder="https://hook.eu2.make.com/..."
                  />
                  {settings.webhook_waitlist_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(settings.webhook_waitlist_url!, '_blank')}
                      title="Test webhook"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="webhook_reactivation_url">Reactivation Webhook URL</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Triggered when members are inactive for 21 days
                </p>
                <div className="flex gap-2">
                  <Input
                    id="webhook_reactivation_url"
                    value={settings.webhook_reactivation_url || ''}
                    onChange={(e) => setSettings({ ...settings, webhook_reactivation_url: e.target.value })}
                    placeholder="https://hook.eu2.make.com/..."
                  />
                  {settings.webhook_reactivation_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(settings.webhook_reactivation_url!, '_blank')}
                      title="Test webhook"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  )
}