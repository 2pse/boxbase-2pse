import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Dumbbell, Zap, Timer } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useGymSettings } from "@/contexts/GymSettingsContext"

export type WorkoutType = "crossfit" | "bodybuilding" | null

interface WorkoutTypeSelectorProps {
  selectedType: WorkoutType
  onTypeSelect: (type: WorkoutType) => void
}

export const WorkoutTypeSelector = ({ selectedType, onTypeSelect }: WorkoutTypeSelectorProps) => {
  const navigate = useNavigate()
  const { settings } = useGymSettings()

  const handleTimerClick = () => {
    // Store current page as referrer for better back navigation
    sessionStorage.setItem('timer-referrer', window.location.pathname)
    navigate('/workout-timer')
  }

  // Don't show types that are disabled by admin
  const showFunctionalFitness = settings?.show_functional_fitness_workouts !== false
  const showBodybuilding = settings?.show_bodybuilding_workouts !== false

  // If both workout types are disabled, show a message
  if (!showFunctionalFitness && !showBodybuilding) {
    return (
      <div className="space-y-4 px-4">
        <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-2xl h-32 shadow-sm">
          <div className="text-center space-y-3 flex flex-col justify-center h-full">
             <h3 className="text-xl font-bold text-muted-foreground">No workouts available</h3>
             <p className="text-xs text-muted-foreground leading-relaxed">
               Currently no workouts are activated.
             </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-1">
      {showFunctionalFitness && (
        <div 
          className={cn(
            "bg-gray-100 dark:bg-gray-800 p-6 cursor-pointer transition-all duration-300 hover:bg-gray-150 dark:hover:bg-gray-700 rounded-2xl h-32 shadow-sm hover:scale-105",
            selectedType === "crossfit" 
              ? "bg-primary/10 dark:bg-primary/20 border-2 border-primary" 
              : ""
          )}
          onClick={() => onTypeSelect("crossfit")}
        >
          <div className="text-center space-y-3 flex flex-col justify-center h-full">
            <h3 className="text-xl font-bold">Functional Fitness</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              High-intensity,<br />
              functional workouts<br />
              and weightlifting
            </p>
          </div>
        </div>
      )}

      {showBodybuilding && (
        <div 
          className={cn(
            "bg-gray-100 dark:bg-gray-800 p-6 cursor-pointer transition-all duration-300 hover:bg-gray-150 dark:hover:bg-gray-700 rounded-2xl h-32 shadow-sm hover:scale-105",
            selectedType === "bodybuilding" 
              ? "bg-primary/10 dark:bg-primary/20 border-2 border-primary" 
              : ""
          )}
          onClick={() => onTypeSelect("bodybuilding")}
        >
          <div className="text-center space-y-3 flex flex-col justify-center h-full">
            <h3 className="text-xl font-bold">Bodybuilding</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Targeted muscle building<br />
              and strength improvement
            </p>
          </div>
        </div>
      )}
    </div>
  )
}