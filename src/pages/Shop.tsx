import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ArrowLeft, CreditCard, Package, Loader2, ShoppingBag, Infinity, CalendarDays, Coins, Building, AlertTriangle, XCircle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { ShopProduct, MembershipPlanV2Extended } from "@/types/shop";
import { Logo } from "@/components/Logo";
import { UserPurchaseHistory } from "@/components/UserPurchaseHistory";

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
      return 'Unlimited';
    case 'limited':
      return 'Limited';
    case 'credits':
      return 'Credits';
    case 'open_gym_only':
      return 'Open Gym';
    default:
      return type;
  }
};

interface ProductWithImages extends ShopProduct {
  shop_product_images?: { image_url: string; sort_order: number }[];
}

export default function Shop() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [plans, setPlans] = useState<MembershipPlanV2Extended[]>([]);
  const [products, setProducts] = useState<ProductWithImages[]>([]);
  const [currentMembership, setCurrentMembership] = useState<any>(null);
  const [pendingUpgrade, setPendingUpgrade] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("memberships");
  const [upgradeDialogPlan, setUpgradeDialogPlan] = useState<MembershipPlanV2Extended | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [membershipDetailOpen, setMembershipDetailOpen] = useState(false);

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

    // Load shop products with images (only show products with stock > 0)
    const { data: productsData } = await supabase
      .from("shop_products")
      .select("*, shop_product_images(image_url, sort_order)")
      .eq("is_active", true)
      .gt("stock_quantity", 0)
      .order("name");

    setProducts((productsData as unknown as ProductWithImages[]) || []);

    // Load all user memberships to detect pending upgrades
    const { data: membershipsList } = await supabase
      .from("user_memberships_v2")
      .select("*, membership_plans_v2(*)")
      .eq("user_id", user.id)
      .in("status", ["active", "pending_activation"])
      .order("start_date", { ascending: true });

    if (membershipsList && membershipsList.length > 0) {
      // Current membership: active and start_date <= today
      const today = new Date().toISOString().split("T")[0];
      const current = membershipsList.find((m: any) => 
        m.status === "active" && 
        (!m.start_date || m.start_date <= today)
      );
      setCurrentMembership(current || null);

      // Pending upgrade: pending_activation OR active with future start_date
      const pending = membershipsList.find((m: any) =>
        m.status === "pending_activation" ||
        (m.status === "active" && m.start_date && m.start_date > today)
      );
      setPendingUpgrade(pending || null);
    }

    setLoading(false);
  };

  const canUpgrade = (plan: MembershipPlanV2Extended) => {
    if (!currentMembership) return true;
    // Allow upgrade even with pending - user can change their mind

    const currentPriority = currentMembership.membership_plans_v2?.upgrade_priority || 0;
    const currentPrice = currentMembership.membership_plans_v2?.price_monthly || 0;
    const planPrice = plan.price_monthly || 0;

    // Can upgrade if: better priority (lower number = better) OR (same priority AND higher price)
    return (plan.upgrade_priority < currentPriority) || 
           (plan.upgrade_priority === currentPriority && planPrice > currentPrice);
  };

  const handleMembershipCheckout = async (plan: MembershipPlanV2Extended) => {
    if (!plan.stripe_price_id) {
      toast.error("This plan is not available for online purchase. Please contact us.");
      return;
    }

    // Check if upgrade dialog should be shown
    if (currentMembership && currentMembership.membership_plan_id !== plan.id) {
      setUpgradeDialogPlan(plan);
      return;
    }

    await processCheckout(plan);
  };

  const processCheckout = async (plan: MembershipPlanV2Extended) => {
    setCheckoutLoading(plan.id);
    setUpgradeDialogPlan(null);

    const currentBookingType = currentMembership?.membership_plans_v2?.booking_rules?.type;
    const currentPaymentFrequency = currentMembership?.membership_plans_v2?.payment_frequency;
    const isCreditsBasedUpgrade = currentBookingType === "credits" && plan.booking_rules?.type !== "credits";
    
    // Check if this is a subscription upgrade: either has stripe_subscription_id OR has monthly payment frequency
    const isMonthlySubscription = currentPaymentFrequency === "monthly";
    const hasExistingSubscription = currentMembership?.stripe_subscription_id || isMonthlySubscription;
    const isSubscriptionUpgrade = hasExistingSubscription && !isCreditsBasedUpgrade && currentMembership.membership_plan_id !== plan.id;

    let endpoint = "create-stripe-checkout";
    if (isCreditsBasedUpgrade) {
      endpoint = "create-subscription-from-credits";
    } else if (isSubscriptionUpgrade) {
      endpoint = "create-upgrade-checkout";
    }

    const { data, error } = await supabase.functions.invoke(endpoint, {
      body: {
        plan_id: plan.id,
        success_url: `${window.location.origin}/shop/success?type=membership`,
        cancel_url: `${window.location.origin}/shop`,
      },
    });

    if (error || data?.error) {
      console.error("Checkout error:", error || data?.error);
      toast.error(data?.error || "Error creating checkout session");
      setCheckoutLoading(null);
      return;
    }

    if (data?.url) {
      window.location.href = data.url;
    }
  };

  const handleProductCheckout = async (product: ShopProduct) => {
    if (!product.stripe_price_id) {
      toast.error("This product is not available for online purchase.");
      return;
    }

    if (product.stock_quantity <= 0) {
      toast.error("This product is sold out.");
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
      toast.error(data?.error || "Error creating checkout session");
      setCheckoutLoading(null);
      return;
    }

    if (data?.url) {
      window.location.href = data.url;
    }
  };

  const getMembershipButtonText = (plan: MembershipPlanV2Extended) => {
    if (!currentMembership) return "Buy Now";
    
    // Check if this plan IS the pending upgrade
    if (pendingUpgrade && pendingUpgrade.membership_plan_id === plan.id) {
      return "Upgrade Pending";
    }
    
    // If different plan and has pending upgrade, show "Change Upgrade"
    if (pendingUpgrade && canUpgrade(plan)) {
      return "Upgrade ändern";
    }
    
    const currentType = currentMembership.membership_plans_v2?.booking_rules?.type;
    const planType = plan.booking_rules?.type;
    
    // Credit top-up logic
    if (currentType === "credits" && planType === "credits" && currentMembership.membership_plan_id === plan.id) {
      return "Top Up Credits";
    }
    
    if (currentMembership.membership_plan_id === plan.id) {
      return "Current Plan";
    }

    if (!canUpgrade(plan)) {
      return "Not Available";
    }
    
    return "Upgrade";
  };

  const isCurrentPlan = (plan: MembershipPlanV2Extended) => {
    return currentMembership?.membership_plan_id === plan.id;
  };

  const handleCancelMembership = async () => {
    setCancelLoading(true);
    
    const { data, error } = await supabase.functions.invoke("cancel-membership");

    if (error || data?.error) {
      console.error("Cancel error:", error || data?.error);
      toast.error(data?.error || "Error cancelling membership");
      setCancelLoading(false);
      setCancelDialogOpen(false);
      return;
    }

    toast.success("Membership scheduled for cancellation");
    setCancelLoading(false);
    setCancelDialogOpen(false);
    loadData(); // Reload to reflect changes
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const isCancellationRequested = () => {
    return currentMembership?.membership_data?.cancellation_requested_at;
  };

  const getProductImages = (product: ProductWithImages): string[] => {
    const images: string[] = [];
    
    // Add images from shop_product_images
    if (product.shop_product_images && product.shop_product_images.length > 0) {
      const sorted = [...product.shop_product_images].sort((a, b) => a.sort_order - b.sort_order);
      images.push(...sorted.map(img => img.image_url));
    }
    
    // Add main image_url if exists and not already included
    if (product.image_url && !images.includes(product.image_url)) {
      images.unshift(product.image_url);
    }
    
    return images;
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/pro?openProfile=true')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Logo className="h-8" />
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 pb-20 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Shop</h1>
          <p className="text-muted-foreground">Memberships & Products</p>
        </div>

        {/* Current Membership Badge - clickable for details */}
        {currentMembership && (
          <Card 
            className="border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
            onClick={() => setMembershipDetailOpen(true)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Current Membership</p>
                  <p className="font-semibold">{currentMembership.membership_plans_v2?.name}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {formatDate(currentMembership.start_date)}
                    {currentMembership.end_date && ` - ${formatDate(currentMembership.end_date)}`}
                  </span>
                </div>
              </div>
              {isCancellationRequested() && (
                <div className="flex items-center gap-2 text-sm text-yellow-600 mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Kündigung angefragt</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pending Upgrade Badge */}
        {pendingUpgrade && (
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pending Upgrade</p>
                <p className="font-semibold">
                  {pendingUpgrade.membership_plans_v2?.name} starts {pendingUpgrade.start_date}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex gap-8 mb-6">
            <button
              onClick={() => setActiveTab('memberships')}
              className={`
                text-sm md:text-lg font-medium transition-all pb-1 border-b-2 flex items-center gap-2
                ${activeTab === 'memberships' 
                  ? 'text-primary border-primary' 
                  : 'text-muted-foreground border-transparent hover:text-foreground'
                }
              `}
            >
              <CreditCard className="h-4 w-4" />
              Memberships
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`
                text-sm md:text-lg font-medium transition-all pb-1 border-b-2 flex items-center gap-2
                ${activeTab === 'products' 
                  ? 'text-primary border-primary' 
                  : 'text-muted-foreground border-transparent hover:text-foreground'
                }
              `}
            >
              <Package className="h-4 w-4" />
              Products
            </button>
          </div>

          <TabsContent value="memberships" className="mt-6 space-y-4">
            {plans.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No memberships available</p>
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
                            <Badge variant="secondary" className="text-xs">Current</Badge>
                          )}
                        </CardTitle>
                        {plan.description && (
                          <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{plan.price_monthly?.toFixed(2)} €</p>
                        <p className="text-xs text-muted-foreground">
                          {plan.payment_frequency === 'one_time' ? 'one-time' : '/ month'}
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
                          {plan.booking_rules.limit.count}x / {plan.booking_rules.limit.period}
                        </Badge>
                      )}
                      {plan.booking_rules?.type === 'credits' && plan.booking_rules.limit && (
                        <Badge variant="outline">
                          {plan.booking_rules.limit.count} Credits
                        </Badge>
                      )}
                      {plan.duration_months > 1 && (
                        <Badge variant="outline">{plan.duration_months} months</Badge>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => handleMembershipCheckout(plan)}
                      disabled={
                        checkoutLoading === plan.id || 
                        (isCurrentPlan(plan) && plan.booking_rules?.type !== 'credits') ||
                        (pendingUpgrade && pendingUpgrade.membership_plan_id === plan.id) ||
                        (!isCurrentPlan(plan) && !canUpgrade(plan))
                      }
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
                        Contact us for this plan
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
                  <p className="text-muted-foreground">No products available</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {products.map((product) => {
                  const images = getProductImages(product);
                  
                  return (
                    <Card key={product.id}>
                      {images.length > 1 ? (
                        <Carousel className="w-full">
                          <CarouselContent>
                            {images.map((url, idx) => (
                              <CarouselItem key={idx}>
                                <div className="aspect-video rounded-t-lg overflow-hidden bg-muted">
                                  <img
                                    src={url}
                                    alt={`${product.name} ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </CarouselItem>
                            ))}
                          </CarouselContent>
                          <CarouselPrevious className="left-2" />
                          <CarouselNext className="right-2" />
                        </Carousel>
                      ) : images.length === 1 ? (
                        <div className="aspect-video rounded-t-lg overflow-hidden bg-muted">
                          <img
                            src={images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : null}
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{product.name}</CardTitle>
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
                          disabled={checkoutLoading === product.id || !product.stripe_price_id}
                        >
                          {checkoutLoading === product.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <ShoppingBag className="h-4 w-4 mr-2" />
                          )}
                          Buy Now
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Purchase History */}
            {user && <UserPurchaseHistory userId={user.id} />}
          </TabsContent>
        </Tabs>
      </main>

      {/* Membership Detail Dialog */}
      <Dialog open={membershipDetailOpen} onOpenChange={setMembershipDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deine Membership</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Plan Name with Badge */}
            <div className="flex items-center gap-3">
              <Badge 
                style={{ backgroundColor: currentMembership?.membership_plans_v2?.color || undefined }}
                className="text-white"
              >
                {currentMembership?.membership_plans_v2?.name}
              </Badge>
            </div>

            {/* Duration Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Start:</span>
                <span className="font-medium">{formatDate(currentMembership?.start_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ende:</span>
                <span className="font-medium">{formatDate(currentMembership?.end_date) || "Unbegrenzt"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium">
                  {isCancellationRequested() ? "Kündigung angefragt" : "Aktiv"}
                </span>
              </div>
            </div>

            {/* Booking Type Info */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-sm">
                <BookingTypeIcon type={currentMembership?.membership_plans_v2?.booking_rules?.type || ''} />
                <span>{getBookingTypeLabel(currentMembership?.membership_plans_v2?.booking_rules?.type || '')}</span>
                {currentMembership?.membership_plans_v2?.booking_rules?.type === 'limited' && 
                  currentMembership?.membership_plans_v2?.booking_rules?.limit && (
                    <span className="text-muted-foreground">
                      ({currentMembership.membership_plans_v2.booking_rules.limit.count}x / {currentMembership.membership_plans_v2.booking_rules.limit.period})
                    </span>
                  )}
                {currentMembership?.membership_plans_v2?.booking_rules?.type === 'credits' && 
                  currentMembership?.membership_data?.remaining_credits !== undefined && (
                    <span className="text-muted-foreground">
                      ({currentMembership.membership_data.remaining_credits} Credits übrig)
                    </span>
                  )}
              </div>
            </div>

            {/* Cancellation Section */}
            {currentMembership?.membership_plans_v2?.cancellation_allowed && (
              <div className="border-t pt-4">
                {isCancellationRequested() ? (
                  <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-500/10 p-3 rounded">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Kündigung angefragt - endet am {formatDate(currentMembership?.end_date)}</span>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => {
                      setMembershipDetailOpen(false);
                      setCancelDialogOpen(true);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Membership kündigen
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Confirmation Dialog */}
      <Dialog open={!!upgradeDialogPlan} onOpenChange={() => setUpgradeDialogPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingUpgrade ? "Upgrade ändern" : "Confirm Upgrade"}</DialogTitle>
            <DialogDescription>
              {pendingUpgrade ? (
                <>
                  Du hast bereits ein Upgrade zu <strong>{pendingUpgrade.membership_plans_v2?.name}</strong> gebucht.
                  <br /><br />
                  Möchtest du stattdessen zu <strong>{upgradeDialogPlan?.name}</strong> wechseln?
                  Das vorherige Upgrade wird storniert.
                </>
              ) : (
                <>
                  You are about to upgrade from{" "}
                  <strong>{currentMembership?.membership_plans_v2?.name}</strong> to{" "}
                  <strong>{upgradeDialogPlan?.name}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {currentMembership?.membership_plans_v2?.booking_rules?.type === 'credits' ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Deine neue Membership startet <strong>sofort</strong> nach der Zahlung.
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-500">
                  ⚠️ Verbleibende Credits verfallen mit dem Upgrade.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Deine neue Membership startet am Ende deines aktuellen Abrechnungszeitraums.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeDialogPlan(null)}>
              Abbrechen
            </Button>
            <Button onClick={() => upgradeDialogPlan && processCheckout(upgradeDialogPlan)}>
              {pendingUpgrade ? "Upgrade ändern" : "Bestätigen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancellation Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Membership kündigen</DialogTitle>
            <DialogDescription>
              Möchtest du deine <strong>{currentMembership?.membership_plans_v2?.name}</strong> Membership wirklich kündigen?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Deine Membership bleibt bis zum Ende der Laufzeit aktiv:
            </p>
            <p className="font-semibold">
              Endet am: {formatDate(currentMembership?.end_date)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} disabled={cancelLoading}>
              Abbrechen
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancelMembership}
              disabled={cancelLoading}
            >
              {cancelLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Jetzt kündigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
