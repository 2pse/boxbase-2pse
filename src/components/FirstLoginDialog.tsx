import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, Play } from "lucide-react"
import erklaerungsvideoImage from "@/assets/erklaerungsvideo.jpg"

interface FirstLoginDialogProps {
  open: boolean
  onClose: () => void
}

export const FirstLoginDialog = ({ open, onClose }: FirstLoginDialogProps) => {
  const handleYouTubeClick = () => {
    window.open("https://youtube.com/shorts/GXhPX6__sI4?feature=shared", "_blank")
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm mx-auto bg-white/95 dark:bg-black/95 border-gray-200 dark:border-gray-800 text-black dark:text-white [&>button]:hidden">
        <DialogHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-8 w-8 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
          <DialogTitle className="text-center pr-8 text-xl font-bold text-black dark:text-white">
            Willkommen im Gym
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <p className="text-center text-gray-700 dark:text-gray-300 text-base leading-relaxed">
            Bitte schaue dir zu Beginn das kurze Erklärungsvideo zur App an
          </p>
          
          {/* Video Thumbnail */}
          <div className="relative rounded-lg overflow-hidden">
            <img 
              src={erklaerungsvideoImage} 
              alt="Gym App Erklärungsvideo" 
              className="w-full h-auto"
            />
          </div>
          
          {/* YouTube Button */}
          <Button 
            onClick={handleYouTubeClick}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-md transition-colors text-base"
            size="lg"
          >
            <Play className="h-5 w-5 mr-2 fill-current" />
            Video ansehen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}