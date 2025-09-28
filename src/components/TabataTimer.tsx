import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useNavigate } from "react-router-dom"

import { ArrowLeft } from "lucide-react"
import { useGymSettings } from "@/contexts/GymSettingsContext"

export const TabataTimer: React.FC = () => {
  const navigate = useNavigate()
  const { settings } = useGymSettings()
  const primaryColor = settings?.primary_color || '#B81243'
  
  const [rounds, setRounds] = useState(8)
  const [workSeconds, setWorkSeconds] = useState(20)
  const [restSeconds, setRestSeconds] = useState(10)

  const handleStart = () => {
    navigate('/workout-timer/start', { 
      state: { 
        type: 'tabata', 
        settings: { rounds, workSeconds, restSeconds } 
      } 
    })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="p-4">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-6 pb-20 -mt-16">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold mb-2">TABATA</h1>
            <p className="text-lg text-muted-foreground">High Intensity Interval Training</p>
          </div>

          <div className="space-y-6">
            {/* Runden */}
            <div className="flex items-center justify-center gap-4">
              <span className="text-lg font-medium">Rounds:</span>
              <Select value={rounds.toString()} onValueChange={(value) => setRounds(Number(value))}>
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
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((num) => (
                    <SelectItem key={num} value={num.toString()} className="text-base">
                      {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Work Zeit */}
            <div className="flex items-center justify-center gap-4">
              <span className="text-lg font-medium">Work:</span>
              <Select value={workSeconds.toString()} onValueChange={(value) => setWorkSeconds(Number(value))}>
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
                  {[10, 15, 20, 30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420, 450, 480, 510, 540, 570, 600].map((num) => (
                    <SelectItem key={num} value={num.toString()} className="text-base">
                      {num >= 60 ? `${Math.floor(num / 60)}:${(num % 60).toString().padStart(2, '0')}` : `${num}s`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rest Zeit */}
            <div className="flex items-center justify-center gap-4">
              <span className="text-lg font-medium">Rest:</span>
              <Select value={restSeconds.toString()} onValueChange={(value) => setRestSeconds(Number(value))}>
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
                  {[5, 10, 15, 20, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420, 450, 480, 510, 540, 570, 600].map((num) => (
                    <SelectItem key={num} value={num.toString()} className="text-base">
                      {num >= 60 ? `${Math.floor(num / 60)}:${(num % 60).toString().padStart(2, '0')}` : `${num}s`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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