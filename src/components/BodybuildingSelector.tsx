import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Dumbbell, ArrowUp, ArrowDown, User, Zap } from "lucide-react"

export type BodybuildingFocus = "Push" | "Pull" | "Lower Body" | "Upper Body" | "Full Body" | null
export type BodybuildingDifficulty = "Easy" | "Medium" | "Hard" | null

interface BodybuildingSelectorProps {
  selectedFocus: BodybuildingFocus
  selectedDifficulty: BodybuildingDifficulty
  onFocusSelect: (focus: BodybuildingFocus) => void
  onDifficultySelect: (difficulty: BodybuildingDifficulty) => void
}

export const BodybuildingSelector = ({ 
  selectedFocus, 
  selectedDifficulty, 
  onFocusSelect, 
  onDifficultySelect 
}: BodybuildingSelectorProps) => {
  const focusOptions = [
    { type: "Push" as const, icon: ArrowUp, title: "Push", description: "Chest, Shoulders, Triceps" },
    { type: "Pull" as const, icon: ArrowDown, title: "Pull", description: "Back, Biceps" },
    { type: "Lower Body" as const, icon: Dumbbell, title: "Lower Body", description: "Quadriceps, Hamstrings, Glutes" },
    { type: "Upper Body" as const, icon: User, title: "Upper Body", description: "Complete Upper Body" },
    { type: "Full Body" as const, icon: Zap, title: "Full Body", description: "Complete Training" }
  ]

  const difficultyOptions = [
    { type: "Easy" as const, title: "Easy", description: "Beginner" },
    { type: "Medium" as const, title: "Medium", description: "Intermediate" },
    { type: "Hard" as const, title: "Hard", description: "Advanced" }
  ]

  // For focus selection step (step 2)
  if (!selectedFocus) {
    return (
      <div className="space-y-4 md:mx-8 lg:mx-12">
        {focusOptions.map(({ type, title, description }) => (
          <div 
            key={type}
            className={cn(
              "bg-gray-100 dark:bg-gray-800 p-6 md:p-8 cursor-pointer transition-all duration-300 hover:bg-gray-150 dark:hover:bg-gray-700 rounded-2xl h-32 md:h-40 shadow-sm hover:scale-105",
              selectedFocus === type 
                ? "bg-primary/10 dark:bg-primary/20 border-2 border-primary" 
                : ""
            )}
            onClick={() => onFocusSelect(type)}
          >
            <div className="text-center space-y-3 flex flex-col justify-center h-full">
              <h4 className="text-xl md:text-3xl font-bold">{title}</h4>
              <p className="text-xs md:text-base text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // For difficulty selection step (step 3)
  return (
    <div className="space-y-4 md:mx-8 lg:mx-12">
      {difficultyOptions.map(({ type, title, description }) => (
        <div 
          key={type}
          className={cn(
            "bg-gray-100 dark:bg-gray-800 p-6 md:p-8 cursor-pointer transition-all duration-300 hover:bg-gray-150 dark:hover:bg-gray-700 rounded-2xl h-32 md:h-40 shadow-sm hover:scale-105",
            selectedDifficulty === type 
              ? "bg-primary/10 dark:bg-primary/20 border-2 border-primary" 
              : ""
          )}
          onClick={() => onDifficultySelect(type)}
        >
          <div className="text-center space-y-3 flex flex-col justify-center h-full">
            <h4 className="text-xl md:text-3xl font-bold">{title}</h4>
            <p className="text-xs md:text-base text-muted-foreground">{description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}