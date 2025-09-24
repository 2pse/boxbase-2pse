import { Dialog, DialogContent } from "@/components/ui/dialog"

interface ProfileImageViewerProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string | null
  displayName: string
}

export const ProfileImageViewer: React.FC<ProfileImageViewerProps> = ({
  isOpen,
  onClose,
  imageUrl,
  displayName
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-4">
        <div className="flex flex-col items-center space-y-4">
          <h3 className="text-lg font-semibold">{displayName}</h3>
          <div className="w-64 h-64 rounded-full overflow-hidden border-4 border-border">
            <img
              src={imageUrl || '/placeholder.svg'}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}