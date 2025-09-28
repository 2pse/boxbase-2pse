import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2, CreditCard, Infinity, Calendar, Dumbbell } from "lucide-react";
import { MembershipPlanWizardV2, BookingRules } from "./MembershipPlanWizardV2";
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
  auto_renewal: boolean;
  includes_open_gym: boolean;
  is_active: boolean;
  payment_frequency: 'monthly' | 'one_time';
  booking_rules: BookingRules;
  created_at: string;
  updated_at: string;
}

const getBookingTypeDisplay = (bookingRules: BookingRules) => {
  switch (bookingRules.type) {
    case 'unlimited':
      return {
        label: 'Unlimited',
        icon: Infinity,
        description: 'Unbegrenzte Buchungen',
        color: 'bg-primary/10 text-primary'
      };
    case 'limited':
      return {
        label: `${bookingRules.limit?.count} pro ${bookingRules.limit?.period === 'week' ? 'Woche' : 'Monat'}`,
        icon: Calendar,
        description: 'Begrenzte Buchungen',
        color: 'bg-blue-100 text-blue-800'
      };
    case 'credits':
      return {
        label: `${bookingRules.credits?.initial_amount} Credits`,
        icon: CreditCard,
        description: 'Credit-basiert',
        color: 'bg-purple-100 text-purple-800'
      };
    case 'open_gym_only':
      return {
        label: 'Open Gym Only',
        icon: Dumbbell,
        description: 'Nur Open Gym Zugang',
        color: 'bg-orange-100 text-orange-800'
      };
    default:
      return {
        label: 'Unbekannt',
        icon: Calendar,
        description: 'Unbekannter Typ',
        color: 'bg-gray-100 text-gray-800'
      };
  }
};

export const MembershipPlanManagerV2: React.FC = () => {
  const [plans, setPlans] = useState<MembershipPlanV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlanV2 | null>(null);

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
      loadPlans();
    } catch (error: any) {
      toast.error('Error deleting: ' + error.message);
    }
  };

  const handleWizardSave = () => {
    loadPlans();
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const bookingDisplay = getBookingTypeDisplay(plan.booking_rules);
          const Icon = bookingDisplay.icon;

          return (
            <Card key={plan.id} className="relative shadow-none">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <Badge 
                    variant={plan.is_active ? "default" : "secondary"}
                    className={plan.is_active ? "bg-green-100 text-green-800" : ""}
                  >
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                {plan.description && (
                  <CardDescription>{plan.description}</CardDescription>
                )}
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Pricing */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Price:</span>
                  <span className="font-medium">
                    {plan.price_monthly 
                      ? `${plan.price_monthly}€ ${plan.payment_frequency === 'monthly' ? '/month' : 'one-time'}`
                      : 'Free'
                    }
                  </span>
                </div>

                {/* Duration */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Duration:</span>
                  <span className="font-medium">{plan.duration_months} months</span>
                </div>

                {/* Booking Type */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{bookingDisplay.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{bookingDisplay.description}</p>
                </div>

                {/* Features */}
                <div className="space-y-1">
                  {plan.includes_open_gym && (
                    <Badge variant="outline" className="text-xs">
                      Open Gym inklusive
                    </Badge>
                  )}
                  {plan.auto_renewal && (
                    <Badge variant="outline" className="text-xs ml-2">
                      Auto-Verlängerung
                    </Badge>
                  )}
                </div>

                {/* Booking Rules Details */}
                {plan.booking_rules.type === 'credits' && plan.booking_rules.credits && (
                  <div className="text-xs text-muted-foreground">
                    Credits: {plan.booking_rules.credits.initial_amount} initial
                    {plan.booking_rules.credits.refill_schedule === 'monthly' && ', monatlich aufgeladen'}
                  </div>
                )}

                {/* Actions */}
                <div className="flex space-x-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(plan)}
                    className="flex-1"
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
                        <AlertDialogTitle>Plan löschen</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete plan "{plan.name}"? 
                          Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(plan.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Löschen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {plans.length === 0 && (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium">Keine Pläne vorhanden</h3>
              <p className="text-muted-foreground">
                Erstellen Sie Ihren ersten Mitgliedschaftsplan
              </p>
              <Button onClick={handleCreate} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Ersten Plan erstellen
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