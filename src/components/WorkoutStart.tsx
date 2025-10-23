import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { useNavigate, useLocation } from "react-router-dom"
import { Play, Pause, RotateCcw, ArrowLeft } from "lucide-react"

import { useGymSettings } from "@/contexts/GymSettingsContext"

interface LocationState {
  type: 'fortime' | 'amrap' | 'emom' | 'tabata'
  settings: {
    timeCap?: number
    minutes?: number
    interval?: number
    rounds?: number
    workSeconds?: number
    restSeconds?: number
  }
}

export const WorkoutStart: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { type, settings } = (location.state as LocationState) || {}
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const { settings: gymSettings } = useGymSettings()
  const primaryColor = gymSettings?.primary_color || '#B81243'
  
  const [countdown, setCountdown] = useState(10)
  const [isCountingDown, setIsCountingDown] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [workoutTime, setWorkoutTime] = useState(0)
  const [currentRound, setCurrentRound] = useState(1)
  const [roundTime, setRoundTime] = useState(0)
  const [isWorkPhase, setIsWorkPhase] = useState(true)
  const [isFinished, setIsFinished] = useState(false)

  // Create beep sound using Web Audio API
  const playBeep = (frequency: number = 800, duration: number = 200) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = frequency
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + duration / 1000)
  }

  useEffect(() => {
    if (!type || !settings) {
      navigate('/workout-timer')
      return
    }
  }, [type, settings, navigate])

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isCountingDown && countdown > 0) {
      // Play beep sound for last 3 seconds
      if (countdown <= 3) {
        playBeep(1000, 300)
      }
      
      interval = setInterval(() => {
        setCountdown(prev => prev - 1)
      }, 1000)
    } else if (isCountingDown && countdown === 0) {
      // Play start sound
      playBeep(1200, 500)
      setIsCountingDown(false)
      setIsRunning(true)
    }

    return () => clearInterval(interval)
  }, [isCountingDown, countdown])

  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isRunning) {
      interval = setInterval(() => {
        setWorkoutTime(prev => prev + 1)
        
        if (type === 'emom') {
          setRoundTime(prev => {
            const newRoundTime = prev + 1
            if (newRoundTime >= settings.interval!) {
              setCurrentRound(r => r + 1)
              return 0
            }
            return newRoundTime
          })
          
            if (currentRound > settings.rounds!) {
              setIsRunning(false)
              setIsFinished(true)
              playBeep(600, 1000) // End sound
            }
        } else if (type === 'tabata') {
          setRoundTime(prev => {
            const newRoundTime = prev + 1
            const currentInterval = isWorkPhase ? settings.workSeconds! : settings.restSeconds!
            
            // Play countdown beep for last 3 seconds of set/rest
            if (currentInterval - newRoundTime <= 3 && currentInterval - newRoundTime > 0) {
              playBeep(1000, 300)
            }
            
            if (newRoundTime >= currentInterval) {
              if (isWorkPhase) {
                // Work phase ends, start rest
                setIsWorkPhase(false)
                playBeep(800, 200) // Phase change sound
              } else {
                // Rest phase ends, start next work round
                setIsWorkPhase(true)
                setCurrentRound(r => r + 1)
                playBeep(1000, 200) // Phase change sound
              }
              return 0
            }
            return newRoundTime
          })
          
            if (currentRound > settings.rounds!) {
              setIsRunning(false)
              setIsFinished(true)
              playBeep(600, 1000) // End sound
            }
        } else if (type === 'fortime' && settings.timeCap && workoutTime + 1 >= settings.timeCap * 60) {
          setIsRunning(false)
          setIsFinished(true)
          playBeep(600, 1000) // End sound
        } else if (type === 'amrap' && settings.minutes && workoutTime + 1 >= settings.minutes * 60) {
          setIsRunning(false)
          setIsFinished(true)
          playBeep(600, 1000) // End sound
        }
      }, 1000)
    }

    return () => clearInterval(interval)
  }, [isRunning, type, settings, workoutTime, currentRound, roundTime])

  const handleStart = () => {
    setCountdown(10)
    setIsCountingDown(true)
  }

  const handlePause = () => {
    setIsRunning(!isRunning)
  }

  const handleReset = () => {
    setIsRunning(false)
    setIsCountingDown(false)
    setCountdown(10)
    setWorkoutTime(0)
    setCurrentRound(1)
    setRoundTime(0)
    setIsWorkPhase(true)
    setIsFinished(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (!type || !settings) return null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="p-4">
        <Button
          variant="ghost"
          onClick={() => {
            navigate('/pro')
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('changeTab', { detail: 'wod' }))
            }, 50)
          }}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          {!isCountingDown && !isRunning && workoutTime === 0 && (
            <div className="text-center space-y-12">
              <h1 className="text-8xl font-bold">START</h1>
              
              <div className="flex justify-center">
                <Button
                  onClick={handleStart}
                  size="lg"
                  className="w-40 h-40 rounded-full hover:opacity-90 border-4"
                  style={{ 
                    backgroundColor: primaryColor, 
                    borderColor: primaryColor 
                  }}
                >
                  <div 
                    className="w-20 h-20 rounded-full flex items-center justify-center ml-2"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <div className="w-0 h-0 border-l-8 border-l-white border-t-6 border-t-transparent border-b-6 border-b-transparent ml-1"></div>
                  </div>
                </Button>
              </div>
              
              <p className="text-xl text-muted-foreground">Click here to start</p>
            </div>
          )}

          {isCountingDown && (
            <div className="text-center space-y-8">
              <h1 className={`text-8xl font-bold ${countdown <= 3 ? 'text-primary animate-pulse' : ''}`}>
                {countdown}
              </h1>
              <p className="text-xl text-muted-foreground">Get ready...</p>
            </div>
          )}

          {(isRunning || (!isRunning && !isFinished && workoutTime > 0)) && (
            <div className="text-center space-y-12">
              <div>
                {type !== 'tabata' && (
                  <h1 className="text-8xl font-bold">{formatTime(workoutTime)}</h1>
                )}
                {type === 'emom' && (
                  <div className="mt-6">
                    <p className="text-2xl">Round {currentRound} of {settings.rounds}</p>
                    <p className="text-xl text-muted-foreground">
                      Round Time: {formatTime(roundTime)}
                    </p>
                  </div>
                )}
                {type === 'tabata' && (
                  <div className="mt-6">
                    <p className="text-2xl mb-8">Round {currentRound} of {settings.rounds}</p>
                    <div className="space-y-4">
                      <p className={`text-8xl font-bold ${isWorkPhase ? 'text-primary' : 'text-muted-foreground'}`}>
                        {formatTime((isWorkPhase ? settings.workSeconds! : settings.restSeconds!) - roundTime)}
                      </p>
                      <p className={`text-4xl font-bold ${isWorkPhase ? 'text-primary' : 'text-muted-foreground'}`}>
                        {isWorkPhase ? 'WORK' : 'REST'}
                      </p>
                      <p className="text-xl text-muted-foreground mt-8">
                        Total: {formatTime(workoutTime)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-center gap-6">
                <Button
                  onClick={handlePause}
                  size="lg"
                  variant="outline"
                  className="w-20 h-20 rounded-full border-2"
                >
                  {isRunning ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
                </Button>
                
                <Button
                  onClick={handleReset}
                  size="lg"
                  variant="outline"
                  className="w-20 h-20 rounded-full border-2"
                >
                  <RotateCcw className="h-8 w-8" />
                </Button>
              </div>
            </div>
          )}

          {isFinished && (
            <div className="text-center space-y-12">
              <h1 className="text-6xl font-bold">FINISHED!</h1>
              <p className="text-3xl">Time: {formatTime(workoutTime)}</p>
              {type === 'emom' && (
                <p className="text-2xl">Rounds: {currentRound - 1} of {settings.rounds}</p>
              )}
              {type === 'tabata' && (
                <p className="text-2xl">Rounds: {currentRound - 1} of {settings.rounds}</p>
              )}
              
              <Button
                onClick={handleReset}
                size="lg"
                className="w-full h-16 text-xl"
              >
                Try Again
              </Button>
            </div>
          )}
        </div>
      </div>
      
    </div>
  )
}