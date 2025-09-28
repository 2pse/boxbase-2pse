import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useNavigate } from "react-router-dom"

import { ArrowLeft } from "lucide-react"
import { useGymSettings } from "@/contexts/GymSettingsContext"

interface EmomTimerProps {
  embedded?: boolean
  onBack?: () => void
}

export const EmomTimer: React.FC<EmomTimerProps> = ({ embedded = false, onBack }) => {
  const navigate = useNavigate()
  const { settings } = useGymSettings()
  const primaryColor = settings?.primary_color || '#B81243'
  
  const [interval, setInterval] = useState(150) // 2:30 in seconds
  const [rounds, setRounds] = useState(10)

  // Generate options for every 30 seconds from 0:30 to 10:00
  const intervalOptions = []
  for (let seconds = 30; seconds <= 600; seconds += 30) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    const label = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    intervalOptions.push({ value: seconds, label })
  }

  const handleStart = () => {
    navigate('/workout-timer/start', { 
      state: { 
        type: 'emom', 
        settings: { interval, rounds } 
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
            <h1 className="text-4xl font-bold mb-2">EMOM</h1>
            <p className="text-lg text-muted-foreground">Every Minute on the Minute</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-4">
                <span className="text-lg font-medium">Every</span>
                <Select value={interval.toString()} onValueChange={(value) => setInterval(Number(value))}>
                  <SelectTrigger 
                    className="w-24 h-12 text-center text-lg bg-background"
                    style={{ borderColor: primaryColor, color: primaryColor }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent 
                    className="bg-background z-50 max-h-60"
                    style={{ borderColor: primaryColor }}
                  >
                    {intervalOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value.toString()} className="text-base">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center justify-center gap-4">
                <span className="text-lg font-medium">for</span>
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