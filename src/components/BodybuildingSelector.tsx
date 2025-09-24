import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Dumbbell, ArrowUp, ArrowDown, User, Zap } from "lucide-react"

export type BodybuildingFocus = "Push" | "Pull" | "Unterkörper" | "Oberkörper" | "Ganzkörper" | null
export type BodybuildingDifficulty = "Leicht" | "Mittel" | "Schwer" | null

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
    { type: "Push" as const, icon: ArrowUp, title: "Push", description: "Brust, Schultern, Trizeps" },
    { type: "Pull" as const, icon: ArrowDown, title: "Pull", description: "Rücken, Bizeps" },
    { type: "Unterkörper" as const, icon: Dumbbell, title: "Unterkörper", description: "Quadrizeps, Hamstrings, Glutes" },
    { type: "Oberkörper" as const, icon: User, title: "Oberkörper", description: "Kompletter Oberkörper" },
    { type: "Ganzkörper" as const, icon: Zap, title: "Ganzkörper", description: "Komplettes Training" }
  ]

  const difficultyOptions = [
    { type: "Leicht" as const, title: "Leicht", description: "Anfänger" },
    { type: "Mittel" as const, title: "Mittel", description: "Fortgeschritten" },
    { type: "Schwer" as const, title: "Schwer", description: "Profi" }
  ]

  // For focus selection step (step 2)
  if (!selectedFocus) {
    return (
      <div className="space-y-4 px-4">
        {focusOptions.map(({ type, title, description }) => (
          <div 
            key={type}
            className={cn(
              "bg-gray-100 dark:bg-gray-800 p-6 cursor-pointer transition-all duration-300 hover:bg-gray-150 dark:hover:bg-gray-700 rounded-2xl h-32 shadow-sm hover:scale-105",
              selectedFocus === type 
                ? "bg-primary/10 dark:bg-primary/20 border-2 border-primary" 
                : ""
            )}
            onClick={() => onFocusSelect(type)}
          >
            <div className="text-center space-y-3 flex flex-col justify-center h-full">
              <h4 className="text-xl font-bold">{title}</h4>
              <p className="text-xs text-muted-foreground">
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
    <div className="space-y-4 px-4">
      {difficultyOptions.map(({ type, title, description }) => (
        <div 
          key={type}
          className={cn(
            "bg-gray-100 dark:bg-gray-800 p-6 cursor-pointer transition-all duration-300 hover:bg-gray-150 dark:hover:bg-gray-700 rounded-2xl h-32 shadow-sm hover:scale-105",
            selectedDifficulty === type 
              ? "bg-primary/10 dark:bg-primary/20 border-2 border-primary" 
              : ""
          )}
          onClick={() => onDifficultySelect(type)}
        >
          <div className="text-center space-y-3 flex flex-col justify-center h-full">
            <h4 className="text-xl font-bold">{title}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}