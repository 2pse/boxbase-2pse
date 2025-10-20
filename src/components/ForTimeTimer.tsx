import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useNavigate } from "react-router-dom"

import { ArrowLeft } from "lucide-react"
import { useGymSettings } from "@/contexts/GymSettingsContext"

interface ForTimeTimerProps {
  embedded?: boolean
  onBack?: () => void
}

export const ForTimeTimer: React.FC<ForTimeTimerProps> = ({ embedded = false, onBack }) => {
  const navigate = useNavigate()
  const { settings } = useGymSettings()
  const primaryColor = settings?.primary_color || '#B81243'
  
  const [timeCap, setTimeCap] = useState(15)

  const handleStart = () => {
    navigate('/workout-timer/start', { 
      state: { 
        type: 'fortime', 
        settings: { timeCap } 
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
            <h1 className="text-4xl md:text-5xl font-bold mb-2">For Time</h1>
            <p className="text-lg md:text-xl text-muted-foreground">As fast as possible</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-center gap-4">
              <span className="text-lg md:text-xl font-medium">Time Cap</span>
              <Select value={timeCap.toString()} onValueChange={(value) => setTimeCap(Number(value))}>
                <SelectTrigger 
                  className="w-20 md:w-24 h-12 md:h-14 text-center text-lg md:text-xl bg-background"
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
            </div>

            <Button
              onClick={handleStart}
              variant="outline"
              className="w-full h-14 md:h-16 text-lg md:text-xl font-medium transition-all duration-200 hover:text-white"
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