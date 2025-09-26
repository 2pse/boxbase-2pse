import { useState, useRef, useCallback } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Camera, Upload, User, Edit, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

interface AvatarUploadProps {
  userId: string
  currentAvatarUrl?: string | null
  onAvatarUpdate?: (newAvatarUrl: string | null) => void
  size?: "sm" | "md" | "lg"
  showUploadButton?: boolean
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  userId,
  currentAvatarUrl,
  onAvatarUpdate,
  size = "md",
  showUploadButton = true
}) => {
  const [uploading, setUploading] = useState(false)
  const [showCropDialog, setShowCropDialog] = useState(false)
  const [imageSrc, setImageSrc] = useState<string>("")
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<Crop>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const { toast } = useToast()

  const avatarSize = {
    sm: "w-8 h-8",
    md: "w-12 h-12", 
    lg: "w-20 h-20"
  }[size]

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        1,
        width,
        height,
      ),
      width,
      height,
    )
    setCrop(crop)
  }, [])

  const getCroppedImg = useCallback(async (image: HTMLImageElement, crop: Crop): Promise<Blob> => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    canvas.width = crop.width * scaleX
    canvas.height = crop.height * scaleY

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY,
    )

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob as Blob)
      }, 'image/jpeg', 0.9)
    })
  }, [])

  const uploadCroppedAvatar = async () => {
    if (!imageRef.current || !completedCrop) return

    try {
      setUploading(true)
      
      const croppedImageBlob = await getCroppedImg(imageRef.current, completedCrop)
      
      // Create a unique filename with user ID
      const fileName = `${userId}/avatar.jpg`

      // Delete existing avatar if exists
      if (currentAvatarUrl) {
        const oldPath = currentAvatarUrl.split('/').pop()
        if (oldPath) {
          await supabase.storage.from('avatars').remove([`${userId}/${oldPath}`])
        }
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, croppedImageBlob, { upsert: true })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', userId)

      if (updateError) throw updateError

      onAvatarUpdate?.(publicUrl)
      setShowCropDialog(false)
      setImageSrc("")
      toast({
        title: "Profile Picture Uploaded",
        description: "Your profile picture has been successfully updated."
      })
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast({
        title: "Upload Error",
        description: "The profile picture could not be uploaded.",
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Ungültiger Dateityp",
          description: "Bitte wählen Sie ein Bild aus.",
          variant: "destructive"
        })
        return
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Datei zu groß",
          description: "Das Bild darf maximal 5MB groß sein.",
          variant: "destructive"
        })
        return
      }

      // Create image preview for cropping
      const reader = new FileReader()
      reader.onload = () => {
        setImageSrc(reader.result as string)
        setShowCropDialog(true)
      }
      reader.readAsDataURL(file)
    }
    
    // Reset input value
    event.target.value = ''
  }

  return (
    <div className="flex flex-col items-center space-y-3">
      <div className="relative">
        <Avatar className={`${avatarSize}`}>
          <AvatarImage src={currentAvatarUrl || ''} alt="Profile Picture" />
          <AvatarFallback className="bg-primary text-primary-foreground">
            <User className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
        
        {uploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      
      {/* Upload button or icon buttons */}
      {showUploadButton ? (
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          size="sm"
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploading ? "Uploading..." : "Upload Profile Picture"}
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-8 rounded-full p-0 shadow-lg"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Edit className="w-3 h-3" />
          </Button>
          
          {currentAvatarUrl && (
            <Button
              size="sm"
              variant="destructive"
              className="h-8 w-8 rounded-full p-0 shadow-lg"
              onClick={async () => {
                try {
                  // Delete from storage
                  const fileName = currentAvatarUrl.split('/').pop()
                  if (fileName) {
                    await supabase.storage
                      .from('avatars')
                      .remove([`${userId}/${fileName}`])
                  }
                  
                  // Update profile
                  await supabase
                    .from('profiles')
                    .update({ avatar_url: null })
                    .eq('user_id', userId)
                  
                  onAvatarUpdate?.(null)
                  toast({
                    title: "Profile Picture Deleted",
                    description: "The profile picture has been successfully removed."
                  })
                } catch (error) {
                  console.error('Error deleting avatar:', error)
                  toast({
                    title: "Delete Error",
                    description: "The profile picture could not be deleted.",
                    variant: "destructive"
                  })
                }
              }}
              disabled={uploading}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      )}
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Crop Dialog */}
      <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crop Profile Picture</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {imageSrc && (
              <div className="flex flex-col items-center space-y-4">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                  circularCrop
                >
                  <img
                    ref={imageRef}
                    alt="Crop me"
                    src={imageSrc}
                    style={{ maxHeight: '400px', maxWidth: '100%' }}
                    onLoad={onImageLoad}
                  />
                </ReactCrop>
                <div className="flex gap-2">
                  <Button 
                    onClick={uploadCroppedAvatar} 
                    disabled={!completedCrop || uploading}
                  >
                    {uploading ? "Uploading..." : "Save"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCropDialog(false)}
                    disabled={uploading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}