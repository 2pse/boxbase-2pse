import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight, ShoppingBag, CreditCard, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface SessionData {
  success: boolean;
  status: string;
  metadata: {
    purchase_type?: string;
    item_name?: string;
    billing_start_date?: string;
  };
  membership?: {
    planName: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  amount: number;
  currency: string;
}

export default function ShopSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") || "purchase";
  const sessionId = searchParams.get("session_id");
  
  const [loading, setLoading] = useState(!!sessionId);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  useEffect(() => {
    if (sessionId) {
      verifySession();
    }
    
    // Dispatch event for any listeners
    window.dispatchEvent(new CustomEvent('purchaseCompleted', { 
      detail: { type } 
    }));
  }, [sessionId, type]);

  const verifySession = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("verify-checkout-session", {
        body: { session_id: sessionId }
      });

      if (error) {
        console.error("Session verification error:", error);
      } else {
        setSessionData(data);
      }
    } catch (err) {
      console.error("Failed to verify session:", err);
    } finally {
      setLoading(false);
    }
  };

  const isUpgrade = sessionData?.metadata?.purchase_type === "membership_upgrade" || 
                    sessionData?.metadata?.purchase_type === "credits_to_subscription";

  const getContent = () => {
    if (loading) {
      return {
        icon: Loader2,
        title: "Verifying...",
        description: "Please wait while we confirm your purchase.",
        animate: true,
      };
    }

    if (isUpgrade) {
      const startDate = sessionData?.membership?.startDate || sessionData?.metadata?.billing_start_date;
      const planName = sessionData?.membership?.planName || sessionData?.metadata?.item_name;
      const today = new Date().toISOString().split("T")[0];
      const isImmediate = !startDate || startDate <= today;

      return {
        icon: CreditCard,
        title: "Upgrade Confirmed!",
        description: isImmediate 
          ? `Your new ${planName} membership is now active.`
          : `Your ${planName} membership will be active starting ${format(new Date(startDate), "MMMM d, yyyy")}.`,
        animate: false,
      };
    }

    switch (type) {
      case "membership": {
        const startDate = sessionData?.membership?.startDate;
        const planName = sessionData?.membership?.planName || sessionData?.metadata?.item_name;
        const today = new Date().toISOString().split("T")[0];
        const isImmediate = !startDate || startDate <= today;

        return {
          icon: CreditCard,
          title: "Membership Activated!",
          description: isImmediate
            ? `Your ${planName || 'membership'} is now active. You can start using all benefits immediately.`
            : `Your ${planName || 'membership'} will be active starting ${format(new Date(startDate), "MMMM d, yyyy")}.`,
          animate: false,
        };
      }
      case "product":
        return {
          icon: ShoppingBag,
          title: "Purchase Successful!",
          description: `Thank you for your purchase${sessionData?.metadata?.item_name ? ` of ${sessionData.metadata.item_name}` : ''}. You can pick it up at the gym.`,
          animate: false,
        };
      default:
        return {
          icon: CheckCircle,
          title: "Payment Successful!",
          description: "Your payment has been processed successfully.",
          animate: false,
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
              <Icon className={`h-8 w-8 text-green-600 dark:text-green-400 ${content.animate ? 'animate-spin' : ''}`} />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold">{content.title}</h1>
              <p className="text-muted-foreground">{content.description}</p>
            </div>

            {sessionData?.amount && !loading && (
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Amount paid</p>
                <p className="text-xl font-bold">
                  €{sessionData.amount.toFixed(2)}
                </p>
              </div>
            )}

            <div className="space-y-3 pt-4">
              <Button 
                className="w-full" 
                onClick={() => navigate("/pro")}
                disabled={loading}
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => navigate("/shop")}
                disabled={loading}
              >
                Back to Shop
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
