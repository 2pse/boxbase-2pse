import { Button } from "@/components/ui/button"
import { Home } from "lucide-react"
import { useNavigate } from "react-router-dom"

export const NavigationButton = () => {
  const navigate = useNavigate()

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => navigate('/')}
      className="fixed top-4 left-4 z-50"
      aria-label="Home"
    >
      <Home className="h-4 w-4" />
    </Button>
  )
}