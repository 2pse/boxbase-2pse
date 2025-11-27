import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Infinity, CalendarDays, Coins, Building, Link as LinkIcon, Loader2, ArrowUp } from "lucide-react";
import { MembershipPlanWizardV2, BookingRules } from "./MembershipPlanWizardV2";
import { invalidateMembershipColorCache } from "@/lib/membershipColors";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MembershipPlanV2 {
  id: string;
  name: string;
  description?: string;
  price_monthly?: number;
  duration_months: number;
  cancellation_allowed?: boolean;
  cancellation_deadline_days?: number;
  includes_open_gym: boolean;
  is_active: boolean;
  is_public: boolean;
  payment_frequency: 'monthly' | 'one_time';
  payment_type: string;
  booking_rules: BookingRules;
  stripe_product_id?: string;
  stripe_price_id?: string;
  color?: string;
  upgrade_priority?: number;
  created_at: string;
  updated_at: string;
}

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
      return <Coins className="h-4 w-4" />;
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

export const MembershipPlanManagerV2: React.FC = () => {
  const [plans, setPlans] = useState<MembershipPlanV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlanV2 | null>(null);
  const [linkingStripe, setLinkingStripe] = useState<string | null>(null);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('membership_plans_v2')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setPlans((data || []).map(plan => ({
        ...plan,
        payment_frequency: plan.payment_frequency as 'monthly' | 'one_time',
        booking_rules: plan.booking_rules as unknown as BookingRules
      })));
    } catch (error: any) {
      toast.error('Error loading plans: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleEdit = (plan: MembershipPlanV2) => {
    setEditingPlan(plan);
    setIsWizardOpen(true);
  };

  const handleCreate = () => {
    setEditingPlan(null);
    setIsWizardOpen(true);
  };

  const handleDelete = async (planId: string) => {
    try {
      const { error } = await supabase
        .from('membership_plans_v2')
        .delete()
        .eq('id', planId);

      if (error) throw error;
      
      toast.success('Plan successfully deleted');
      invalidateMembershipColorCache();
      loadPlans();
    } catch (error: any) {
      toast.error('Error deleting: ' + error.message);
    }
  };

  const handleWizardSave = () => {
    loadPlans();
  };

  const handleLinkToStripe = async (planId: string) => {
    setLinkingStripe(planId);
    
    try {
      const { data, error } = await supabase.functions.invoke("create-stripe-product", {
        body: { plan_id: planId },
      });

      if (error) {
        console.error("Stripe linking error:", error);
        toast.error("Stripe-Verknüpfung fehlgeschlagen");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Mit Stripe verknüpft!");
      loadPlans();
    } catch (err: any) {
      toast.error("Fehler: " + err.message);
    } finally {
      setLinkingStripe(null);
    }
  };

  if (loading) {
    return <div className="p-6">Loading membership plans...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Membership Plans</h2>
          <p className="text-muted-foreground">Create and manage your memberships</p>
        </div>
        <Button onClick={handleCreate} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          New Plan
        </Button>
      </div>

      <div className="space-y-4">
        {plans.map((plan) => (
          <Card 
            key={plan.id} 
            className="transition-all"
            style={{ borderLeftColor: plan.color || '#52a7b4', borderLeftWidth: '4px' }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {plan.name}
                    <Badge 
                      variant={plan.is_active ? "default" : "secondary"}
                      className={plan.is_active ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}
                    >
                      {plan.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </CardTitle>
                  {plan.description && (
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{plan.price_monthly?.toFixed(2) || '0.00'} €</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.payment_frequency === 'monthly' ? '/ month' : 'one-time'}
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
                    {plan.booking_rules.limit.count}x / month
                  </Badge>
                )}
                {plan.booking_rules?.type === 'credits' && plan.booking_rules.credits && (
                  <Badge variant="outline">
                    {plan.booking_rules.credits.initial_amount} Credits
                  </Badge>
                )}
                {plan.duration_months > 1 && (
                  <Badge variant="outline">{plan.duration_months} months</Badge>
                )}
                {plan.includes_open_gym && (
                  <Badge variant="outline">Open Gym incl.</Badge>
                )}
                {plan.cancellation_allowed && (
                  <Badge variant="outline">
                    Kündbar {plan.cancellation_deadline_days && plan.cancellation_deadline_days > 0 
                      ? `(${Math.round(plan.cancellation_deadline_days / 30)} Mon. Frist)` 
                      : '(sofort)'}
                  </Badge>
                )}
                {plan.upgrade_priority !== undefined && plan.upgrade_priority > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <ArrowUp className="h-3 w-3" />
                    Priority {plan.upgrade_priority}
                  </Badge>
                )}
              </div>

              {/* Stripe Status */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div>
                  {plan.stripe_price_id ? (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                      <LinkIcon className="h-3 w-3 mr-1" />
                      Stripe linked
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLinkToStripe(plan.id)}
                      disabled={linkingStripe === plan.id}
                    >
                      {linkingStripe === plan.id ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <LinkIcon className="h-3 w-3 mr-1" />
                      )}
                      Link to Stripe
                    </Button>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(plan)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Plan</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete plan "{plan.name}"? 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(plan.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {plans.length === 0 && (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">No plans available</h3>
              <p className="text-muted-foreground">
                Create your first membership plan
              </p>
              <Button onClick={handleCreate} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create first plan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <MembershipPlanWizardV2
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSave={handleWizardSave}
        editingPlan={editingPlan}
      />
    </div>
  );
};