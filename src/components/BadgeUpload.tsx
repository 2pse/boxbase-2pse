import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, Trash2, AlertCircle } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

interface UploadedBadge {
  name: string
  url: string
  id: string
}

interface BadgeUploadProps {
  onBadgeUploaded?: () => void
}

export const BadgeUpload = ({ onBadgeUploaded }: BadgeUploadProps) => {
  const [uploading, setUploading] = useState(false)
  const [badges, setBadges] = useState<UploadedBadge[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const loadBadges = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase.storage
        .from('challenge-badges')
        .list()

      if (error) {
        console.error('Error loading badges:', error)
        return
      }

      const badgeList: UploadedBadge[] = data
        ?.filter(file => file.name !== '.emptyFolderPlaceholder')
        .map(file => ({
          name: file.name,
          url: supabase.storage.from('challenge-badges').getPublicUrl(file.name).data.publicUrl,
          id: file.id || file.name
        })) || []

      setBadges(badgeList)
    } catch (error) {
      console.error('Error loading badges:', error)
    } finally {
      setLoading(false)
    }
  }

  useState(() => {
    loadBadges()
  })

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Datei zu groß",
        description: "Die maximale Dateigröße beträgt 5MB.",
        variant: "destructive"
      })
      return
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Ungültiger Dateityp",
        description: "Nur JPEG, PNG, WebP und SVG Dateien sind erlaubt.",
        variant: "destructive"
      })
      return
    }

    try {
      setUploading(true)
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      
      const { error } = await supabase.storage
        .from('challenge-badges')
        .upload(fileName, file)

      if (error) {
        throw error
      }

      toast({
        title: "Badge uploaded",
        description: "The badge has been successfully uploaded."
      })

      // Reload badges
      await loadBadges()
      onBadgeUploaded?.()
      
      // Clear input
      event.target.value = ''
    } catch (error) {
      console.error('Error uploading badge:', error)
      toast({
        title: "Upload fehlgeschlagen",
        description: "There was an error uploading the badge.",
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteBadge = async (fileName: string) => {
    try {
      const { error } = await supabase.storage
        .from('challenge-badges')
        .remove([fileName])

      if (error) {
        throw error
      }

      toast({
        title: "Badge gelöscht",
        description: "Das Badge wurde erfolgreich gelöscht."
      })

      // Reload badges
      await loadBadges()
      onBadgeUploaded?.()
    } catch (error) {
      console.error('Error deleting badge:', error)
      toast({
        title: "Löschen fehlgeschlagen",
        description: "Es gab einen Fehler beim Löschen des Badges.",
        variant: "destructive"
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Challenge Badges verwalten
        </CardTitle>
        <CardDescription>
          Upload custom badge images for challenges. 
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Empfohlene Größe:</strong> 64x64 Pixel oder größer (quadratisch) für beste Darstellung. 
            Maximale Dateigröße: 5MB. Unterstützte Formate: JPEG, PNG, WebP, SVG.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="badge-upload">Upload Badge</Label>
          <Input
            id="badge-upload"
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/svg+xml"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          {uploading && (
            <p className="text-sm text-muted-foreground">Uploading...</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Uploaded Badges</Label>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading badges...</p>
          ) : badges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No badges uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {badges.map((badge) => (
                <div key={badge.id} className="relative group">
                  <div className="aspect-square border rounded-lg overflow-hidden bg-background">
                    <img 
                      src={badge.url} 
                      alt={badge.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Badge</AlertDialogTitle>
                        <AlertDialogDescription>
                          Do you really want to delete this badge? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteBadge(badge.name)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <p className="text-xs text-center mt-1 truncate">{badge.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}