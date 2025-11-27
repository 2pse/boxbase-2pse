import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, Package, Loader2, ShoppingBag, Infinity, CalendarDays, Coins, Building } from "lucide-react";
import { toast } from "sonner";
import { ShopProduct, MembershipPlanV2Extended } from "@/types/shop";
import { Logo } from "@/components/Logo";

const BookingTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'unlimited':
      return <Infinity className="h-4 w-4" />;
    case 'limited':
      return <CalendarDays className="h-4 w-4" />;
    case 'credits':
      return <Coins className="h-4 w-4" />;
    case 'open_gym_only':
      return <Building className="h-4 w-4" />;
    default:
      return <CreditCard className="h-4 w-4" />;
  }
};

const getBookingTypeLabel = (type: string) => {
  switch (type) {
    case 'unlimited':
      return 'Unbegrenzt';
    case 'limited':
      return 'Limitiert';
    case 'credits':
      return 'Credits';
    case 'open_gym_only':
      return 'Open Gym';
    default:
      return type;
  }
};

export default function Shop() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [plans, setPlans] = useState<MembershipPlanV2Extended[]>([]);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [currentMembership, setCurrentMembership] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("memberships");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);

    // Load membership plans
    const { data: plansData } = await supabase
      .from("membership_plans_v2")
      .select("*")
      .eq("is_active", true)
      .eq("is_public", true)
      .order("upgrade_priority", { ascending: true });

    setPlans((plansData as unknown as MembershipPlanV2Extended[]) || []);

    // Load shop products
    const { data: productsData } = await supabase
      .from("shop_products")
      .select("*")
      .eq("is_active", true)
      .order("name");

    setProducts((productsData as unknown as ShopProduct[]) || []);

    // Load current membership
    const { data: membershipData } = await supabase
      .from("user_memberships_v2")
      .select("*, membership_plans_v2(*)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    setCurrentMembership(membershipData);
    setLoading(false);
  };

  const handleMembershipCheckout = async (plan: MembershipPlanV2Extended) => {
    if (!plan.stripe_price_id) {
      toast.error("Dieser Plan ist nicht für Online-Kauf verfügbar. Bitte kontaktiere uns.");
      return;
    }

    setCheckoutLoading(plan.id);

    const { data, error } = await supabase.functions.invoke("create-stripe-checkout", {
      body: {
        plan_id: plan.id,
        success_url: `${window.location.origin}/shop/success?type=membership`,
        cancel_url: `${window.location.origin}/shop`,
      },
    });

    if (error || data?.error) {
      console.error("Checkout error:", error || data?.error);
      toast.error(data?.error || "Fehler beim Erstellen der Checkout-Session");
      setCheckoutLoading(null);
      return;
    }

    if (data?.url) {
      window.location.href = data.url;
    }
  };

  const handleProductCheckout = async (product: ShopProduct) => {
    if (!product.stripe_price_id) {
      toast.error("Dieses Produkt ist nicht für Online-Kauf verfügbar.");
      return;
    }

    if (product.stock_quantity <= 0) {
      toast.error("Dieses Produkt ist ausverkauft.");
      return;
    }

    setCheckoutLoading(product.id);

    const { data, error } = await supabase.functions.invoke("create-stripe-checkout", {
      body: {
        product_id: product.id,
        success_url: `${window.location.origin}/shop/success?type=product`,
        cancel_url: `${window.location.origin}/shop`,
      },
    });

    if (error || data?.error) {
      console.error("Checkout error:", error || data?.error);
      toast.error(data?.error || "Fehler beim Erstellen der Checkout-Session");
      setCheckoutLoading(null);
      return;
    }

    if (data?.url) {
      window.location.href = data.url;
    }
  };

  const getMembershipButtonText = (plan: MembershipPlanV2Extended) => {
    if (!currentMembership) return "Jetzt kaufen";
    
    const currentType = currentMembership.membership_plans_v2?.booking_rules?.type;
    const planType = plan.booking_rules?.type;
    
    // Credit top-up logic
    if (currentType === "credits" && planType === "credits") {
      return "Credits aufladen";
    }
    
    if (currentMembership.membership_plan_id === plan.id) {
      return "Aktueller Plan";
    }
    
    return "Upgrade";
  };

  const isCurrentPlan = (plan: MembershipPlanV2Extended) => {
    return currentMembership?.membership_plan_id === plan.id;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Logo className="h-8" />
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 pb-20 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Shop</h1>
          <p className="text-muted-foreground">Mitgliedschaften & Produkte</p>
        </div>

        {/* Current Membership Badge */}
        {currentMembership && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Aktuelle Mitgliedschaft</p>
                <p className="font-semibold">{currentMembership.membership_plans_v2?.name}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="memberships" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Mitgliedschaften
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produkte
            </TabsTrigger>
          </TabsList>

          <TabsContent value="memberships" className="mt-6 space-y-4">
            {plans.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Keine Mitgliedschaften verfügbar</p>
                </CardContent>
              </Card>
            ) : (
              plans.map((plan) => (
                <Card 
                  key={plan.id} 
                  className={`transition-all ${isCurrentPlan(plan) ? 'border-primary ring-1 ring-primary' : ''}`}
                  style={{ borderLeftColor: plan.color, borderLeftWidth: '4px' }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {plan.name}
                          {isCurrentPlan(plan) && (
                            <Badge variant="secondary" className="text-xs">Aktuell</Badge>
                          )}
                        </CardTitle>
                        {plan.description && (
                          <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{plan.price_monthly?.toFixed(2)} €</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.payment_type === 'subscription' ? '/ Monat' : 'einmalig'}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <BookingTypeIcon type={plan.booking_rules?.type || ''} />
                        {getBookingTypeLabel(plan.booking_rules?.type || '')}
                      </Badge>
                      {plan.booking_rules?.type === 'limited' && plan.booking_rules.limit && (
                        <Badge variant="outline">
                          {plan.booking_rules.limit.count}x / {plan.booking_rules.limit.period === 'week' ? 'Woche' : 'Monat'}
                        </Badge>
                      )}
                      {plan.booking_rules?.type === 'credits' && plan.booking_rules.limit && (
                        <Badge variant="outline">
                          {plan.booking_rules.limit.count} Credits
                        </Badge>
                      )}
                      {plan.duration_months > 1 && (
                        <Badge variant="outline">{plan.duration_months} Monate</Badge>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => handleMembershipCheckout(plan)}
                      disabled={checkoutLoading === plan.id || (isCurrentPlan(plan) && plan.booking_rules?.type !== 'credits')}
                    >
                      {checkoutLoading === plan.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ShoppingBag className="h-4 w-4 mr-2" />
                      )}
                      {getMembershipButtonText(plan)}
                    </Button>
                    
                    {!plan.stripe_price_id && (
                      <p className="text-xs text-center text-muted-foreground">
                        Kontaktiere uns für diesen Plan
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="products" className="mt-6">
            {products.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Keine Produkte verfügbar</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {products.map((product) => (
                  <Card 
                    key={product.id} 
                    className={product.stock_quantity === 0 ? "opacity-60" : ""}
                  >
                    {product.image_url && (
                      <div className="aspect-video rounded-t-lg overflow-hidden bg-muted">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {product.name}
                            {product.stock_quantity === 0 && (
                              <Badge variant="destructive" className="text-xs">Ausverkauft</Badge>
                            )}
                          </CardTitle>
                          {product.category && (
                            <p className="text-xs text-muted-foreground">{product.category}</p>
                          )}
                        </div>
                        <p className="text-xl font-bold">{product.price.toFixed(2)} €</p>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {product.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      <Button
                        className="w-full"
                        onClick={() => handleProductCheckout(product)}
                        disabled={checkoutLoading === product.id || product.stock_quantity === 0 || !product.stripe_price_id}
                      >
                        {checkoutLoading === product.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ShoppingBag className="h-4 w-4 mr-2" />
                        )}
                        {product.stock_quantity === 0 ? "Ausverkauft" : "Kaufen"}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
