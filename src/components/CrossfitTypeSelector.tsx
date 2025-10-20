import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Target, Trophy } from "lucide-react"

export type CrossfitType = "WOD" | "Weightlifting" | null

interface CrossfitTypeSelectorProps {
  selectedType: CrossfitType
  onTypeSelect: (type: CrossfitType) => void
}

export const CrossfitTypeSelector = ({ selectedType, onTypeSelect }: CrossfitTypeSelectorProps) => {
  const types = [
    {
      type: "WOD" as const,
      title: "WOD",
      description: "Functional\nFull body workout"
    },
    {
      type: "Weightlifting" as const,
      title: "Weightlifting",
      description: "Olympic\nWeightlifting"
    }
  ]

  return (
    <div className="space-y-4">
      {types.map(({ type, title, description }) => (
        <div 
          key={type}
          className={cn(
            "bg-gray-100 dark:bg-gray-800 p-6 cursor-pointer transition-all duration-300 hover:bg-gray-150 dark:hover:bg-gray-700 rounded-2xl h-32 shadow-sm hover:scale-105",
            selectedType === type 
              ? "bg-primary/10 dark:bg-primary/20 border-2 border-primary" 
              : ""
          )}
          onClick={() => onTypeSelect(type)}
        >
          <div className="text-center space-y-3 flex flex-col justify-center h-full">
            <h4 className="text-xl font-bold">{title}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
              {description}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}