import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, QrCode, Loader2, Filter, ShoppingBag, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";

interface Purchase {
  id: string;
  user_id: string;
  item_name: string;
  item_type: string;
  item_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  stripe_session_id: string;
  profile?: {
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
  };
}

type FilterType = "all" | "product" | "membership" | "credit_topup";

export function AdminPurchaseHistory() {
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);

  const { data: purchases = [], isLoading } = useQuery({
    queryKey: ["admin-purchases"],
    queryFn: async () => {
      // Load purchases
      const { data: purchaseData, error } = await supabase
        .from("purchase_history")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      // Load profiles separately
      const userIds = [...new Set(purchaseData?.map(p => p.user_id) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name, first_name, last_name")
        .in("user_id", userIds);
      
      const profileMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
      
      return (purchaseData || []).map(purchase => ({
        ...purchase,
        profile: profileMap.get(purchase.user_id) || null
      })) as Purchase[];
    },
  });

  const filteredPurchases = purchases.filter(purchase => {
    if (filter === "all") return true;
    return purchase.item_type === filter;
  });

  const getUserName = (purchase: Purchase) => {
    if (purchase.profile?.display_name) return purchase.profile.display_name;
    if (purchase.profile?.first_name || purchase.profile?.last_name) {
      return `${purchase.profile.first_name || ""} ${purchase.profile.last_name || ""}`.trim();
    }
    return "Unknown User";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Completed</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-500/30">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "product":
        return <Badge variant="secondary"><ShoppingBag className="h-3 w-3 mr-1" />Product</Badge>;
      case "membership":
        return <Badge variant="secondary"><CreditCard className="h-3 w-3 mr-1" />Membership</Badge>;
      case "credit_topup":
        return <Badge variant="secondary"><Package className="h-3 w-3 mr-1" />Credits</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const qrData = selectedPurchase ? JSON.stringify({
    purchase_id: selectedPurchase.id,
    item_name: selectedPurchase.item_name,
    amount: selectedPurchase.amount,
    date: selectedPurchase.created_at,
  }) : "";

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Orders ({filteredPurchases.length})
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex gap-1">
              {(["all", "product", "membership", "credit_topup"] as FilterType[]).map((type) => (
                <Button
                  key={type}
                  variant={filter === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(type)}
                >
                  {type === "all" ? "All" : type === "credit_topup" ? "Credits" : type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredPurchases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No orders found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPurchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(purchase.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getUserName(purchase)}
                    </TableCell>
                    <TableCell>{purchase.item_name}</TableCell>
                    <TableCell>{getTypeBadge(purchase.item_type)}</TableCell>
                    <TableCell className="font-medium">
                      €{purchase.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(purchase.status)}</TableCell>
                    <TableCell>
                      {purchase.item_type === "product" && purchase.status === "completed" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedPurchase(purchase)}
                          title="Show QR Code"
                        >
                          <QrCode className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

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
                  {getUserName(selectedPurchase)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedPurchase.created_at), "d. MMMM yyyy, HH:mm", { locale: de })} Uhr
                </p>
              </div>
              
              <div className="bg-white rounded-lg p-6 mx-auto w-fit">
                <QRCodeSVG value={qrData} size={200} />
              </div>
              
              <p className="text-xs text-muted-foreground">
                Scan this QR code to verify the purchase
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
