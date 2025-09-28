import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useNavigate } from "react-router-dom"

import { ArrowLeft } from "lucide-react"
import { useGymSettings } from "@/contexts/GymSettingsContext"

interface AmrapTimerProps {
  embedded?: boolean
  onBack?: () => void
}

export const AmrapTimer: React.FC<AmrapTimerProps> = ({ embedded = false, onBack }) => {
  const navigate = useNavigate()
  const { settings } = useGymSettings()
  const primaryColor = settings?.primary_color || '#B81243'
  
  const [minutes, setMinutes] = useState(7)

  const handleStart = () => {
    navigate('/workout-timer/start', { 
      state: { 
        type: 'amrap', 
        settings: { minutes } 
      } 
    })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="p-4">
      <Button
        variant="ghost"
        onClick={() => onBack ? onBack() : navigate(-1)}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      </div>
      
      <div className="flex-1 p-6 pt-8 pb-20">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold mb-2">AMRAP</h1>
            <p className="text-lg text-muted-foreground">As many reps as possible</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-center gap-4">
              <Select value={minutes.toString()} onValueChange={(value) => setMinutes(Number(value))}>
                <SelectTrigger 
                  className="w-20 h-12 text-center text-lg bg-background"
                  style={{ borderColor: primaryColor, color: primaryColor }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent 
                  className="bg-background z-50 max-h-60"
                  style={{ borderColor: primaryColor }}
                >
                  {Array.from({ length: 60 }, (_, i) => i + 1).map((num) => (
                    <SelectItem key={num} value={num.toString()} className="text-base">
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-lg font-medium">Minutes</span>
            </div>

            <Button
              onClick={handleStart}
              variant="outline"
              className="w-full h-14 text-lg font-medium transition-all duration-200 hover:text-white"
              style={{
                borderColor: primaryColor,
                color: primaryColor
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = primaryColor
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = primaryColor
              }}
            >
              Start
            </Button>
          </div>
        </div>
      </div>
      
    </div>
  )
}