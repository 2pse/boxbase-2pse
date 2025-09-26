import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Check, CreditCard, Infinity, Calendar, Dumbbell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BookingRules {
  type: 'unlimited' | 'limited' | 'credits' | 'open_gym_only';
  limit?: {
    count: number;
    period: 'week' | 'month';
  };
  credits?: {
    initial_amount: number;
    refill_schedule: 'monthly' | 'never';
  };
}

interface MembershipPlanV2 {
  id?: string;
  name: string;
  description?: string;
  price_monthly?: number;
  duration_months: number;
  auto_renewal: boolean;
  includes_open_gym: boolean;
  is_active: boolean;
  payment_frequency: 'monthly' | 'one_time';
  booking_rules: BookingRules;
}

interface MembershipPlanWizardV2Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editingPlan?: MembershipPlanV2 | null;
}

const BOOKING_TYPES = [
  {
    type: 'unlimited' as const,
    title: 'Unlimited',
    description: 'Unbegrenzte Kursbuchungen',
    icon: Infinity
  },
  {
    type: 'limited' as const,
    title: 'Limited',
    description: 'Begrenztes Kontingent pro Zeitraum',
    icon: Calendar
  },
  {
    type: 'credits' as const,
    title: 'Credits',
    description: 'Credit-basiertes System',
    icon: CreditCard
  },
  {
    type: 'open_gym_only' as const,
    title: 'Open Gym Only',
    description: 'Nur Zugang zum Open Gym',
    icon: Dumbbell
  }
];

export const MembershipPlanWizardV2: React.FC<MembershipPlanWizardV2Props> = ({
  isOpen,
  onClose,
  onSave,
  editingPlan
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<MembershipPlanV2>({
    name: '',
    description: '',
    price_monthly: undefined,
    duration_months: 1,
    auto_renewal: false,
    includes_open_gym: false,
    is_active: true,
    payment_frequency: 'monthly',
    booking_rules: { type: 'unlimited' }
  });

  // Reset form when editing plan changes
  React.useEffect(() => {
    if (editingPlan) {
      console.log('Loading plan data for editing:', editingPlan);
      setFormData(editingPlan);
      setCurrentStep(1);
    }
  }, [editingPlan]);

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!isOpen && !editingPlan) {
      setFormData({
        name: '',
        description: '',
        price_monthly: undefined,
        duration_months: 1,
        auto_renewal: false,
        includes_open_gym: false,
        is_active: true,
        payment_frequency: 'monthly',
        booking_rules: { type: 'unlimited' }
      });
      setCurrentStep(1);
    }
  }, [isOpen, editingPlan]);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.name.trim() !== '';
      case 2:
        return true;
      case 3:
        if (formData.booking_rules.type === 'limited') {
          return formData.booking_rules.limit?.count > 0;
        }
        if (formData.booking_rules.type === 'credits') {
          return formData.booking_rules.credits?.initial_amount > 0;
        }
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    } else {
      toast.error('Please fill in all required fields');
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleBookingTypeChange = (type: BookingRules['type']) => {
    setFormData(prev => {
      // If type hasn't changed, keep existing values
      if (prev.booking_rules.type === type) {
        return prev;
      }

      // Create new booking rules based on type
      let newBookingRules: BookingRules = { type };
      
      if (type === 'limited') {
        // Preserve existing limit values if switching back to limited
        if (prev.booking_rules.type === 'limited' && prev.booking_rules.limit) {
          newBookingRules.limit = prev.booking_rules.limit;
        } else {
          // Set defaults only when switching from a different type
          newBookingRules.limit = { count: 8, period: 'month' as const };
        }
      } else if (type === 'credits') {
        // Preserve existing credit values if switching back to credits
        if (prev.booking_rules.type === 'credits' && prev.booking_rules.credits) {
          newBookingRules.credits = prev.booking_rules.credits;
        } else {
          // Set defaults only when switching from a different type
          newBookingRules.credits = { initial_amount: 10, refill_schedule: 'monthly' as const };
        }
      }

      return {
        ...prev,
        booking_rules: newBookingRules
      };
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    console.log('Submitting form data:', formData);
    console.log('Current booking rules:', formData.booking_rules);
    
    try {
      const planData = {
        name: formData.name,
        description: formData.description || null,
        price_monthly: formData.price_monthly || null,
        duration_months: formData.duration_months,
        auto_renewal: formData.auto_renewal,
        includes_open_gym: formData.includes_open_gym,
        is_active: formData.is_active,
        payment_frequency: formData.payment_frequency,
        booking_rules: formData.booking_rules as any
      };

      console.log('Data being sent to database:', planData);

      if (editingPlan) {
        const { error } = await supabase
          .from('membership_plans_v2')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;
        console.log('Plan successfully updated');
        toast.success('Plan erfolgreich aktualisiert');
      } else {
        const { error } = await supabase
          .from('membership_plans_v2')
          .insert(planData);

        if (error) throw error;
        console.log('Plan successfully created');
        toast.success('Plan erfolgreich erstellt');
      }

      onSave();
      onClose();
    } catch (error: any) {
      console.error('Submit error:', error);
      toast.error('Fehler beim Speichern: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Plan Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="z.B. Premium Plan"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Beschreibung des Plans..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">
                  {formData.payment_frequency === 'monthly' ? 'Monatlicher Preis (€)' : 'Einmaliger Preis (€)'}
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.price_monthly || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    price_monthly: e.target.value ? parseFloat(e.target.value) : undefined 
                  }))}
                  placeholder="0"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="duration">Laufzeit (Monate)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration_months}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    duration_months: parseInt(e.target.value) || 0 
                  }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Zahlungsfrequenz</Label>
              <RadioGroup
                value={formData.payment_frequency}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  payment_frequency: value as 'monthly' | 'one_time' 
                }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="monthly-payment" />
                  <Label htmlFor="monthly-payment">Monatlich</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="one_time" id="one-time-payment" />
                  <Label htmlFor="one-time-payment">Einmalig (z.B. 10er Karte)</Label>
                </div>
              </RadioGroup>
              {formData.payment_frequency === 'one_time' && (
                <p className="text-sm text-muted-foreground">
                  Bei einmaliger Zahlung können Credits über mehrere Monate genutzt werden.
                </p>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Buchungstyp auswählen</Label>
              <RadioGroup 
                value={formData.booking_rules.type} 
                onValueChange={handleBookingTypeChange}
              >
                {BOOKING_TYPES.map((bookingType) => {
                  const Icon = bookingType.icon;
                  return (
                    <div key={bookingType.type} className="flex items-center space-x-2 p-4 rounded-lg border">
                      <RadioGroupItem value={bookingType.type} id={bookingType.type} />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center space-x-2">
                          <Icon className="h-4 w-4" />
                          <Label htmlFor={bookingType.type} className="font-medium">
                            {bookingType.title}
                          </Label>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {bookingType.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            {formData.booking_rules.type === 'limited' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Buchungslimit konfigurieren</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="limit-count">Anzahl Buchungen</Label>
                    <Input
                      id="limit-count"
                      type="number"
                      value={formData.booking_rules.limit?.count ?? 8}
                      onChange={(e) => {
                        const newCount = parseInt(e.target.value) || 0;
                        console.log('Updating limit count:', newCount);
                        setFormData(prev => ({
                          ...prev,
                          booking_rules: {
                            ...prev.booking_rules,
                            limit: {
                              count: newCount,
                              period: prev.booking_rules.limit?.period ?? 'month'
                            }
                          }
                        }));
                      }}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="limit-period">Zeitraum</Label>
                    <RadioGroup
                      value={formData.booking_rules.limit?.period ?? 'month'}
                      onValueChange={(value) => {
                        console.log('Updating period:', value);
                        setFormData(prev => ({
                          ...prev,
                          booking_rules: {
                            ...prev.booking_rules,
                            limit: {
                              count: prev.booking_rules.limit?.count ?? 8,
                              period: value as 'week' | 'month'
                            }
                          }
                        }));
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="week" id="week" />
                        <Label htmlFor="week">Pro Woche</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="month" id="month" />
                        <Label htmlFor="month">Pro Monat</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>
            )}

            {formData.booking_rules.type === 'credits' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Credits konfigurieren</h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="initial-credits">Initiale Credits</Label>
                    <Input
                      id="initial-credits"
                      type="number"
                      value={formData.booking_rules.credits?.initial_amount ?? 10}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        booking_rules: {
                          ...prev.booking_rules,
                          credits: {
                            initial_amount: parseInt(e.target.value) || 0,
                            refill_schedule: prev.booking_rules.credits?.refill_schedule ?? 'monthly'
                          }
                        }
                      }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Credit-Aufladung</Label>
                    <RadioGroup
                      value={formData.booking_rules.credits?.refill_schedule ?? 'monthly'}
                      onValueChange={(value) => setFormData(prev => ({
                        ...prev,
                        booking_rules: {
                          ...prev.booking_rules,
                          credits: {
                            initial_amount: prev.booking_rules.credits?.initial_amount ?? 10,
                            refill_schedule: value as 'monthly' | 'never'
                          }
                        }
                      }))}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="monthly" id="monthly" />
                        <Label htmlFor="monthly">Monatlich</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="never" id="never" />
                        <Label htmlFor="never">Nur einmalig</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </div>
            )}

            {(formData.booking_rules.type === 'unlimited' || formData.booking_rules.type === 'open_gym_only') && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No further configuration required for this booking type.
                </p>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Allgemeine Einstellungen</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto-Verlängerung</Label>
                  <p className="text-sm text-muted-foreground">
                    Plan wird automatisch verlängert
                  </p>
                </div>
                <Switch
                  checked={formData.auto_renewal}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, auto_renewal: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Open Gym inklusive</Label>
                  <p className="text-sm text-muted-foreground">
                    Zugang zum Open Gym enthalten
                  </p>
                </div>
                <Switch
                  checked={formData.includes_open_gym}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, includes_open_gym: checked }))}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Plan aktiv</Label>
                  <p className="text-sm text-muted-foreground">
                    Plan ist für Buchungen verfügbar
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
              </div>
            </div>

            {/* Plan Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Vorschau</CardTitle>
                <CardDescription>So wird Ihr Plan angezeigt</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Name:</span>
                  <span>{formData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Preis:</span>
                  <span>
                    {formData.price_monthly 
                      ? `${formData.price_monthly}€ ${formData.payment_frequency === 'monthly' ? '/Monat' : 'einmalig'}`
                      : 'Kostenlos'
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Zahlungsfrequenz:</span>
                  <span>{formData.payment_frequency === 'monthly' ? 'Monatlich' : 'Einmalig'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Buchungstyp:</span>
                  <span>
                    {formData.booking_rules.type === 'unlimited' && 'Unlimited'}
                    {formData.booking_rules.type === 'limited' && 
                      `${formData.booking_rules.limit?.count} pro ${formData.booking_rules.limit?.period === 'week' ? 'Woche' : 'Monat'}`}
                    {formData.booking_rules.type === 'credits' && 
                      `${formData.booking_rules.credits?.initial_amount} Credits`}
                    {formData.booking_rules.type === 'open_gym_only' && 'Open Gym Only'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingPlan ? 'Plan bearbeiten' : 'Neuen Plan erstellen'}
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${currentStep === step 
                  ? 'bg-primary text-primary-foreground' 
                  : currentStep > step 
                    ? 'bg-primary/20 text-primary' 
                    : 'bg-muted text-muted-foreground'
                }
              `}>
                {currentStep > step ? <Check className="h-4 w-4" /> : step}
              </div>
              {step < 4 && (
                <div className={`
                  w-12 h-px mx-2
                  ${currentStep > step ? 'bg-primary' : 'bg-muted'}
                `} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-6">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Zurück
          </Button>

          {currentStep < 4 ? (
            <Button onClick={handleNext}>
              Weiter
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Speichert...' : editingPlan ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};