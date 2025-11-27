import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight, ShoppingBag, CreditCard } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function ShopSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") || "purchase";

  useEffect(() => {
    // Dispatch event for any listeners
    window.dispatchEvent(new CustomEvent('purchaseCompleted', { 
      detail: { type } 
    }));
  }, [type]);

  const getContent = () => {
    switch (type) {
      case "membership":
        return {
          icon: CreditCard,
          title: "Mitgliedschaft erfolgreich!",
          description: "Deine Mitgliedschaft wurde aktiviert. Du kannst jetzt alle Vorteile nutzen.",
        };
      case "product":
        return {
          icon: ShoppingBag,
          title: "Kauf erfolgreich!",
          description: "Vielen Dank für deinen Einkauf. Wir haben deine Bestellung erhalten.",
        };
      default:
        return {
          icon: CheckCircle,
          title: "Zahlung erfolgreich!",
          description: "Deine Zahlung wurde erfolgreich verarbeitet.",
        };
    }
  };

  const content = getContent();
  const Icon = content.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-center">
          <Logo className="h-8" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <Icon className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{content.title}</h1>
              <p className="text-muted-foreground">{content.description}</p>
            </div>

            <div className="space-y-3 pt-4">
              <Button 
                className="w-full" 
                onClick={() => navigate("/pro")}
              >
                Zum Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => navigate("/shop")}
              >
                Zurück zum Shop
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
