import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, ChevronDown, ChevronUp, QrCode, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";

interface Purchase {
  id: string;
  item_name: string;
  item_type: string;
  amount: number;
  status: string;
  created_at: string;
  stripe_session_id: string;
}

interface UserPurchaseHistoryProps {
  userId: string;
}

export function UserPurchaseHistory({ userId }: UserPurchaseHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["user-purchases", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_history")
        .select("*")
        .eq("user_id", userId)
        .eq("item_type", "product")
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Purchase[];
    },
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (purchases.length === 0) {
    return null;
  }

  const qrData = selectedPurchase ? JSON.stringify({
    purchase_id: selectedPurchase.id,
    item_name: selectedPurchase.item_name,
    amount: selectedPurchase.amount,
    date: selectedPurchase.created_at,
  }) : "";

  return (
    <div className="mt-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-4 bg-card border border-border rounded-lg hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">My Purchases ({purchases.length})</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {purchases.map((purchase) => (
            <Card key={purchase.id} className="hover:bg-accent/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h4 className="font-medium">{purchase.item_name}</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Paid
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(purchase.created_at), "d. MMM yyyy", { locale: de })}
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      €{purchase.amount.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedPurchase(purchase)}
                    title="Show QR Code"
                  >
                    <QrCode className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={!!selectedPurchase} onOpenChange={() => setSelectedPurchase(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Purchase Receipt</DialogTitle>
          </DialogHeader>
          {selectedPurchase && (
            <div className="space-y-4 text-center">
              <div>
                <p className="font-medium">{selectedPurchase.item_name}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedPurchase.created_at), "d. MMMM yyyy, HH:mm", { locale: de })} Uhr
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-6 mx-auto w-fit">
                <QRCodeSVG value={qrData} size={200} />
              </div>
              
              <p className="text-xs text-muted-foreground">
                Show this QR code when picking up your order
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
