import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWaitlistNotifications } from "@/hooks/useWaitlistNotifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { getPriorizedMembership, getMembershipTypeName } from "@/lib/membershipUtils"
import { UserPlus, Edit, Trash2, Search, CreditCard, Home, Users, Calendar, FileText, Newspaper, Dumbbell, Trophy, DollarSign, Settings, LogOut, Percent, Download, RefreshCw } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CourseTemplateManager from "@/components/CourseTemplateManager";
import NewsManager from "@/components/NewsManager";
import AdminEmailManager from "@/components/AdminEmailManager";

import { CourseParticipants } from "@/components/CourseParticipants";
import { MembershipBadge } from "@/components/MembershipBadge";
import { AdminStats } from "@/components/AdminStats";
import { RiseHeader } from "@/components/RiseHeader";
import WorkoutManagement from "./WorkoutManagement";
import AdminChallengeManager from "@/components/AdminChallengeManager";
import { MembershipPlanManagerV2 } from "@/components/MembershipPlanManagerV2";

import { FinanceReport } from "@/components/FinanceReport";
import { GymSettings } from "@/components/GymSettings";
import { DataExport } from "@/components/DataExport";
import { ProductManager } from "@/components/ProductManager";
import { AdminPurchaseHistory } from "@/components/AdminPurchaseHistory";
import { AdminRiskRadar } from "@/components/AdminRiskRadar";


import { useToast } from "@/hooks/use-toast";

interface Member {
  id: string;
  display_name: string;
  first_name?: string;
  last_name?: string;
  access_code: string;
  user_id: string | null;
  email?: string;
  created_at: string;
  membership_type: 'Basic Member' | 'Premium Member' | 'Trainer' | 'Administrator' | 'Open Gym' | 'Wellpass' | 'Credits';
  status: string;
  last_login_at: string | null;
  authors?: boolean;
  current_membership_type?: string;
  current_membership_color?: string;
  membership_end_date?: string | null;
  membership_auto_renewal?: boolean;
  membership_start_date?: string | null;
  user_memberships?: Array<{
    status: string;
    membership_plan_id: string;
    membership_plans: {
      name: string;
      booking_type: string;
    };
  }>;
}

export default function Admin() {
  // Handle waitlist notifications for automatic promotions
  useWaitlistNotifications();
  
  const isMobile = useIsMobile();
  
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  // V2 Member creation state only 
  const [newMemberFirstName, setNewMemberFirstName] = useState("");
  const [newMemberLastName, setNewMemberLastName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberCode, setNewMemberCode] = useState("");
  const [newMemberIsAuthor, setNewMemberIsAuthor] = useState(false);
  const [selectedMembershipPlan, setSelectedMembershipPlan] = useState("");
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  
  // Temporary placeholder for old V1 system to prevent build errors
  const [editMembershipConfig, setEditMembershipConfig] = useState({
    type: 'unlimited' as any,
    price: '',
    durationMonths: 1,
    autoRenewal: false,
    bookingLimit: 8,
    bookingType: 'monthly' as any,
    includesOpenGym: true,
    credits: 10
  });
  
  // Membership configuration state
  const [membershipConfig, setMembershipConfig] = useState({
    type: 'unlimited' as 'unlimited' | 'open_gym' | 'limited' | 'credits' | 'trainer',
    price: '',
    durationMonths: 1,
    autoRenewal: false,
    bookingLimit: 8, // per month for limited
    bookingType: 'monthly' as 'weekly' | 'monthly',
    includesOpenGym: true,
    credits: 10 // for credits type
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [activePage, setActivePage] = useState<'home' | 'members' | 'courses' | 'templates' | 'news' | 'email' | 'workouts' | 'challenges' | 'memberships' | 'finance' | 'settings' | 'export' | 'shop' | 'risk-radar'>('home');
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  
  // Edit member state - V2 system only 
  const [editSelectedMembershipPlan, setEditSelectedMembershipPlan] = useState("");
  const [editCurrentMembership, setEditCurrentMembership] = useState<any>(null);
  const [creditsAmount, setCreditsAmount] = useState<number>(10);
  const [isSubtracting, setIsSubtracting] = useState<boolean>(false);
  const membersPerPage = 10;
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load membership plans on component mount
  const loadMembershipPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('membership_plans_v2')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setAvailablePlans(data || []);
    } catch (error) {
      console.error('Error loading membership plans:', error);
    }
  };
  

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          navigate("/auth");
        } else {
          setTimeout(() => {
            checkAdminRole(session.user.id);
          }, 0);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session?.user) {
        navigate("/auth");
      } else {
        checkAdminRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Read URL params for tab navigation (e.g., from Risk Radar)
  const [searchParams] = useSearchParams()
  
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam) {
      const validTabs = ['home', 'members', 'courses', 'templates', 'news', 'email', 'workouts', 'challenges', 'memberships', 'finance', 'settings', 'export', 'shop', 'risk-radar']
      if (validTabs.includes(tabParam)) {
        setActivePage(tabParam as typeof activePage)
      }
    }
  }, [searchParams])

  useEffect(() => {
    loadMembershipPlans();
  }, []);

  useEffect(() => {
    if (activePage === 'members' && isAdmin) {
      loadMembers();
      loadMembershipPlans(); // Refresh membership plans when accessing members page
    }
  }, [activePage, isAdmin, currentPage, searchTerm]);

  const checkAdminRole = async (userId: string) => {
    try {
      // Spezielle Behandlung für Admin-E-Mail
      const user = await supabase.auth.getUser();
      if (user.data.user?.email === 'admin@rise-fitness.com') {
        setIsAdmin(true);
        loadMembers();
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
      } else {
        setIsAdmin(!!data);
        if (!!data) {
          loadMembers();
        } else {
          toast({
            title: "Error",
            description: "No admin authorization",
            variant: "destructive",
          });
          navigate("/pro");
        }
      }
    } catch (error) {
      console.error('Error checking admin role:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      // First update member status automatically
      await supabase.rpc('update_member_status');
      
      // Calculate offset for pagination
      const offset = (currentPage - 1) * membersPerPage;
      
      // Build query to load all profiles with optional membership data
      let query = supabase
        .from('profiles')
        .select(`
          id, 
          display_name,
          first_name,
          last_name,
          access_code, 
          created_at, 
          user_id, 
          membership_type, 
          status, 
          last_login_at, 
          authors
        `, { count: 'exact' });
      
      if (searchTerm) {
        query = query.or(`display_name.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,access_code.ilike.%${searchTerm}%`);
      }
      
      const { data: profilesData, error: profilesError, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + membersPerPage - 1);

      if (profilesError) {
        console.error('Error loading profiles:', profilesError);
        toast({
          title: "Error",
          description: "Error loading members",
          variant: "destructive",
        });
        return;
      }

      // Load emails via secure Database Function
      const userIds = profilesData?.map(p => p.user_id) || [];
      let emailData: Record<string, string> = {};
      
      if (userIds.length > 0) {
        try {
          console.log('Loading emails via database function for user IDs:', userIds);
          const { data: emailResponse, error: emailError } = await supabase.rpc('get_member_emails_for_admin', {
            user_ids: userIds
          });
          
          if (emailError) {
            console.error('Database function failed, emails will not be displayed:', emailError);
            // Don't throw error, just continue without emails
          } else if (emailResponse) {
            // Convert array response to object
            emailResponse.forEach((row: { user_id: string; email: string }) => {
              emailData[row.user_id] = row.email;
            });
            console.log('Successfully loaded emails:', Object.keys(emailData).length, 'emails');
          }
        } catch (emailError) {
          console.warn('Database function not available, emails will not be displayed:', emailError);
          // Continue without emails - this is expected if user lacks admin privileges
        }
      }

      // Separately load V2 membership data for these profiles
      let membershipsData = [];
      
      if (userIds.length > 0) {
        const { data: memberships } = await supabase
          .from('user_memberships_v2')
          .select(`
            user_id,
            status,
            membership_data,
            start_date,
            end_date,
            auto_renewal,
            membership_plans_v2(
              name,
              color,
              booking_rules,
              payment_frequency,
              price_monthly
            )
          `)
          .in('user_id', userIds)
          .eq('status', 'active');
        
        membershipsData = memberships || [];
      }

      // Transform data to include membership type
      const membersWithMembership = profilesData?.map(member => {
        const userMemberships = membershipsData.filter(m => m.user_id === member.user_id);
        
        // Determine membership type using V2 system only (consistent with FinanceReport)
        let membershipType = 'No Membership'; // Default fallback
        let membershipColor: string | undefined = undefined;
        let endDate = null;
        let autoRenewal = false;
        let startDate = null;
        
        if (userMemberships.length > 0) {
          // Use shared prioritization logic from membershipUtils
          const selectedMembership = getPriorizedMembership(userMemberships);
          membershipType = getMembershipTypeName(selectedMembership, null);
          membershipColor = selectedMembership.membership_plans_v2?.color || undefined;
          endDate = selectedMembership.end_date;
          autoRenewal = selectedMembership.auto_renewal;
          startDate = selectedMembership.start_date;
        }
        
        return {
          ...member,
          email: emailData[member.user_id] || '',
          current_membership_type: membershipType,
          current_membership_color: membershipColor,
          membership_end_date: endDate,
          membership_auto_renewal: autoRenewal,
          membership_start_date: startDate
        };
      }) || [];
      
      setMembers(membersWithMembership as any);
      setTotalMembers(count || 0);
    } catch (error) {
      console.error('Error loading members:', error);
      toast({
        title: "Error",
        description: "Error loading members",
        variant: "destructive",
      });
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Membership is now optional - members can purchase their own in the app
    if (!newMemberFirstName || !newMemberEmail || !newMemberCode) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (First name, Email, Access code)",
        variant: "destructive",
      });
      return;
    }

    // Find the selected plan (optional - may be null if "none" or empty)
    const selectedPlan = selectedMembershipPlan && selectedMembershipPlan !== "none" 
      ? availablePlans.find(plan => plan.id === selectedMembershipPlan) 
      : null;

    try {
      // Note: Access codes can now be shared by multiple users
      // Email uniqueness is enforced by Supabase Auth

      // Determine user role - trainer plans get trainer role, others get member role
      const isTrainer = selectedPlan?.booking_rules?.type === 'unlimited' && selectedPlan?.name.toLowerCase().includes('trainer');
      const userRole = isTrainer ? 'trainer' : 'member';
      
      // Create display_name from first_name and last_name
      const displayName = newMemberLastName ? `${newMemberFirstName} ${newMemberLastName}` : newMemberFirstName;
      
      // Create user via Edge Function with proper role assignment
      const { data: result, error: functionError } = await supabase.functions.invoke('create-member', {
        body: {
          email: newMemberEmail,
          password: newMemberCode,
          user_metadata: {
            first_name: newMemberFirstName,
            last_name: newMemberLastName,
            display_name: displayName,
            access_code: newMemberCode,
            membership_type: userRole,
            authors: newMemberIsAuthor
          }
        }
      });

      if (functionError || !result?.success) {
        console.error('Error creating member:', functionError || result?.error);
        const errorMessage = functionError?.message || result?.error || 'Unknown error';
        toast({
          title: "Error",
          description: `Error creating member: ${errorMessage}`,
          variant: "destructive",
        });
        return;
      }

      // Only create membership if a plan was selected
      if (selectedPlan) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + selectedPlan.duration_months);

        // Prepare initial membership data based on plan type
        let initialMembershipData = {};
        if (selectedPlan.booking_rules?.type === 'credits') {
          initialMembershipData = {
            remaining_credits: selectedPlan.booking_rules.credits?.initial_amount || 10
          };
        }
        // Limited memberships don't use remaining_credits
        // They calculate availability dynamically based on period

        const { error: membershipError } = await supabase
          .from('user_memberships_v2')
          .insert({
            user_id: result.user.id,
            membership_plan_id: selectedPlan.id,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            status: 'active',
            auto_renewal: selectedPlan.auto_renewal || false,
            membership_data: initialMembershipData
          });

        if (membershipError) {
          console.error('Error creating user membership:', membershipError);
          toast({
            title: "Warning",
            description: "Mitglied erstellt, aber Mitgliedschaft konnte nicht zugewiesen werden",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erfolg",
            description: "Mitglied mit Mitgliedschaft erstellt",
            variant: "default",
          });
          
          // Dispatch event for real-time updates in frontend
          window.dispatchEvent(new CustomEvent('membershipUpdated', { 
            detail: { userId: result?.data?.user_id } 
          }));
        }
      } else {
        // No membership selected - member can purchase in app
        toast({
          title: "Erfolg",
          description: "Mitglied erstellt (ohne Mitgliedschaft - kann selbst in App kaufen)",
          variant: "default",
        });
      }

      // Reset form
      setNewMemberFirstName("");
      setNewMemberLastName("");
      setNewMemberEmail("");
      setNewMemberCode("");
      setNewMemberIsAuthor(false);
      setSelectedMembershipPlan("");
      setDialogOpen(false);
      
      // Reload members
      loadMembers();

    } catch (error) {
      console.error('Error creating member:', error);
      toast({
        title: "Error",
        description: "Unexpected error creating member",
        variant: "destructive",
      });
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingMember) return;

    try {
      // Use existing access code or keep it as is (don't auto-generate)
      const accessCode = editingMember.access_code;
      
      // Auto-generate display_name from first and last name
      const displayName = editingMember.first_name && editingMember.last_name 
        ? `${editingMember.first_name} ${editingMember.last_name}`
        : editingMember.first_name || editingMember.display_name || '';

      // Check if access code changed to determine if we need to update Supabase Auth
      const originalMember = members.find(m => m.user_id === editingMember.user_id);
      const accessCodeChanged = originalMember && originalMember.access_code !== accessCode;

      // Update profile data directly via Supabase RLS
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          first_name: editingMember.first_name,
          last_name: editingMember.last_name,
          access_code: accessCode,
          authors: editingMember.authors
        })
        .eq('user_id', editingMember.user_id);

      if (profileUpdateError) {
        console.error('Error updating profile:', profileUpdateError);
        toast({
          title: "Error",
          description: "Error updating profile",
          variant: "destructive",
        });
        return;
      }

      // If access code changed, also update the Supabase Auth password
      if (accessCodeChanged && accessCode) {
        const { error: accessCodeError } = await supabase.functions.invoke('update-access-code', {
          body: {
            newAccessCode: accessCode,
            targetUserId: editingMember.user_id
          }
        });

        if (accessCodeError) {
          console.error('Error updating access code:', accessCodeError);
          toast({
            title: "Warning",
            description: "Profile updated, but access code could not be changed",
            variant: "destructive",
          });
          // Don't return here - profile was updated successfully
        }
      }

      // Handle membership plan change if a new plan was selected
      if (editSelectedMembershipPlan && editSelectedMembershipPlan !== editCurrentMembership?.membership_plan_id) {
        // Note: The database trigger will automatically delete old active memberships
        // when we create a new active membership

        // Get the selected plan details
        const { data: selectedPlan } = await supabase
          .from('membership_plans_v2')
          .select('*')
          .eq('id', editSelectedMembershipPlan)
          .single();

        if (!selectedPlan) {
          toast({
             title: "Error",
            description: "Selected plan not found",
            variant: "destructive",
          });
          return;
        }

        // Calculate dates
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + selectedPlan.duration_months);

        // Prepare membership data
        const bookingRules = selectedPlan.booking_rules as any;
        let membershipData = {};

        // Initialize credits for credit-based plans
        if (bookingRules?.type === 'credits') {
          const initialCredits = bookingRules.credits?.initial_amount || 10;
          membershipData = { remaining_credits: initialCredits };
        }

        if (editCurrentMembership) {
          // Update existing membership
          const { error: membershipError } = await supabase
            .from('user_memberships_v2')
            .update({
              membership_plan_id: selectedPlan.id,
              start_date: startDate.toISOString().split('T')[0],
              end_date: endDate.toISOString().split('T')[0],
              auto_renewal: selectedPlan.auto_renewal || false,
              status: 'active',
              membership_data: membershipData
            })
            .eq('id', editCurrentMembership.id);

          if (membershipError) {
            console.error('Error updating membership:', membershipError);
            toast({
               title: "Error",
               description: "Error updating membership",
              variant: "destructive",
            });
            return;
          }
        } else {
          // Create new membership if none exists
          const { error: membershipError } = await supabase
            .from('user_memberships_v2')
            .insert({
              user_id: editingMember.user_id,
              membership_plan_id: selectedPlan.id,
              start_date: startDate.toISOString().split('T')[0],
              end_date: endDate.toISOString().split('T')[0],
              auto_renewal: selectedPlan.auto_renewal || false,
              status: 'active',
              membership_data: membershipData
            });

          if (membershipError) {
            console.error('Error creating new membership:', membershipError);
            toast({
              title: "Error",
              description: "Error creating new membership",
              variant: "destructive",
            });
            return;
          }
        }

        toast({
          title: "Success",
          description: `Membership successfully changed to "${selectedPlan.name}"`,
        });
        
        // Dispatch event for real-time updates in frontend
        window.dispatchEvent(new CustomEvent('membershipUpdated', { 
          detail: { userId: editingMember?.user_id } 
        }));
      } else {
        toast({
          title: "Success",
          description: "Profile successfully updated",
        });
      }
      
      // Reset state and reload data
      setEditingMember(null);
      setEditSelectedMembershipPlan("");
      setEditCurrentMembership(null);
      setEditDialogOpen(false);
      loadMembers();
    } catch (error) {
      console.error('Error updating member:', error);
      toast({
        title: "Error",
        description: "Error updating member",
        variant: "destructive",
      });
    }
  };

  const loadEditMemberData = async (userId: string) => {
    if (!userId) return;
    
    try {
      // Load profile data first
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Load email via secure Database Function
      let userEmail = '';
      try {
        console.log('Loading email via database function for user ID:', userId);
        const { data: emailResponse, error: emailError } = await supabase.rpc('get_member_emails_for_admin', {
          user_ids: [userId]
        });
        
        if (emailError) {
          console.error('Error loading email via database function:', emailError);
        } else if (emailResponse && emailResponse.length > 0) {
          userEmail = emailResponse[0].email;
          console.log('Successfully loaded email for user:', userEmail);
        }
      } catch (emailError) {
        console.warn('Could not load email for user via database function:', emailError);
      }

      if (profile) {
        // Use existing access code as-is (don't auto-generate)
        const accessCode = profile.access_code;
        
        // Update the editing member with complete profile data including email
        setEditingMember(prev => prev ? {
          ...prev,
          first_name: profile.first_name,
          last_name: profile.last_name,
          display_name: profile.display_name,
          access_code: accessCode,
          authors: profile.authors,
          email: userEmail
        } : null);
      }

      // Load current V2 membership data and set editCurrentMembership
      const { data: memberships } = await supabase
        .from('user_memberships_v2')
        .select(`
          *,
          membership_plans_v2(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (memberships && memberships[0]) {
        const membership = memberships[0];
        setEditCurrentMembership(membership);
        
        const plan = membership.membership_plans_v2;
        
        // Set editSelectedMembershipPlan to current plan
        setEditSelectedMembershipPlan(plan.id);
        
        // Calculate actual duration from start and end date
        let actualDurationMonths = plan.duration_months || 1;
        if (membership.start_date && membership.end_date) {
          const startDate = new Date(membership.start_date);
          const endDate = new Date(membership.end_date);
          const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
                           (endDate.getMonth() - startDate.getMonth());
          if (monthsDiff > 0) {
            actualDurationMonths = monthsDiff;
          }
        }
        
        // Set form data based on current V2 membership
        const bookingRules = (plan.booking_rules as any) || {};
        const membershipData = (membership.membership_data as any) || {};
        
        let membershipType: 'unlimited' | 'open_gym' | 'limited' | 'credits' | 'trainer' = 'unlimited';
        
        if (bookingRules.type === 'unlimited') membershipType = 'unlimited';
        else if (bookingRules.type === 'open_gym_only') membershipType = 'open_gym';
        else if (bookingRules.type === 'limited') membershipType = 'limited';
        else if (bookingRules.type === 'credits') membershipType = 'credits';
        
        setEditMembershipConfig({
          type: membershipType,
          price: plan.price_monthly?.toString() || '',
          durationMonths: actualDurationMonths,
          autoRenewal: membership.auto_renewal ?? false,
          bookingLimit: bookingRules.limit?.count || bookingRules.credits?.initial_amount || 8,
          bookingType: 'monthly', // Default to monthly
          includesOpenGym: plan.includes_open_gym || false,
          credits: membershipData.remaining_credits || bookingRules.credits?.initial_amount || 10
        });
      } else {
        // No active V2 membership, clear editCurrentMembership and set defaults
        setEditCurrentMembership(null);
        setEditSelectedMembershipPlan("");
        setEditMembershipConfig({
          type: 'unlimited',
          price: '',
          durationMonths: 1,
          autoRenewal: false,
          bookingLimit: 8,
          bookingType: 'monthly',
          includesOpenGym: true,
          credits: 10
        });
      }
    } catch (error) {
      console.error('Error loading member data:', error);
    }
  };

  const handleManageCredits = async () => {
    if (!editCurrentMembership) return;

    try {
      // Check if this is a credits-based membership
      const membershipData = editCurrentMembership.membership_data || {};
      const currentCredits = membershipData.remaining_credits || 0;
      
      let newCredits;
      if (isSubtracting) {
        newCredits = Math.max(0, currentCredits - creditsAmount);
      } else {
        newCredits = currentCredits + creditsAmount;
      }

      const updatedMembershipData = {
        ...membershipData,
        remaining_credits: newCredits
      };

      const { error } = await supabase
        .from('user_memberships_v2')
        .update({ 
          membership_data: updatedMembershipData,
          updated_at: new Date().toISOString()
        })
        .eq('id', editCurrentMembership.id);

      if (error) {
        console.error('Error updating credits:', error);
        toast({
          title: "Error",
          description: "Error updating credits",
          variant: "destructive",
        });
        return;
      }

      // Update local state
      setEditCurrentMembership(prev => ({
        ...prev,
        membership_data: updatedMembershipData
      }));

      toast({
        title: "Success",
        description: `Credits ${isSubtracting ? 'deducted' : 'added'}. New amount: ${newCredits}`,
      });

      // Dispatch event for real-time updates in frontend
      window.dispatchEvent(new CustomEvent('creditsUpdated', { 
        detail: { userId: editingMember?.user_id } 
      }));

      // Reset form
      setCreditsAmount(10);
      setIsSubtracting(false);
      
    } catch (error) {
      console.error('Error managing credits:', error);
      toast({
        title: "Error", 
        description: "Error managing credits",
        variant: "destructive",
      });
    }
  };

  const deleteMember = async (member: Member) => {
    if (!member.user_id) {
      toast({
        title: "Error",
        description: "Benutzer-ID nicht gefunden",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('delete-member', {
        body: { userId: member.user_id }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Member was successfully deleted",
      });

      // Refresh member list
      loadMembers();
      setMemberToDelete(null);
    } catch (error: any) {
      console.error('Error deleting member:', error);
      toast({
        title: "Error",
        description: error.message || "Member could not be deleted",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Aktiv';
      case 'paused': return 'Pausiert';
      case 'cancelled': return 'Gekündigt';
      case 'expired': return 'Abgelaufen';
      default: return status;
    }
  };

  const getMembershipDuration = (endDate: string | null, autoRenewal: boolean, startDate: string | null) => {
    if (!endDate) {
      return { text: '-', className: 'text-muted-foreground' };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    
    let diffTime = end.getTime() - today.getTime();
    let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Calculate next period for auto-renewal if membership expired
    if (diffDays < 0 && autoRenewal && startDate) {
      const start = new Date(startDate);
      const durationMonths = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
      
      const nextEnd = new Date(end);
      nextEnd.setMonth(nextEnd.getMonth() + Math.max(1, durationMonths || 1));
      
      diffTime = nextEnd.getTime() - today.getTime();
      diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    if (diffDays < 0) {
      return { 
        text: 'Expired', 
        className: 'text-red-600 font-medium' 
      };
    } else if (diffDays === 0) {
      return { 
        text: 'Today', 
        className: 'text-orange-600 font-medium' 
      };
    } else if (diffDays <= 7) {
      return { 
        text: `${diffDays} day${diffDays !== 1 ? 's' : ''}`, 
        className: 'text-orange-500' 
      };
    } else if (diffDays <= 30) {
      return { 
        text: `${diffDays} days`, 
        className: 'text-yellow-600' 
      };
    } else {
      // Calculate months based on start date for accurate duration
      let months = 0;
      let remainingDays = diffDays;
      
      if (startDate) {
        const start = new Date(startDate);
        const calculationEnd = new Date(today);
        calculationEnd.setDate(calculationEnd.getDate() + diffDays);
        
        // Calculate difference in months
        months = (calculationEnd.getFullYear() - start.getFullYear()) * 12;
        months += calculationEnd.getMonth() - start.getMonth();
        
        // Calculate remaining days after months
        const monthBoundary = new Date(start);
        monthBoundary.setMonth(monthBoundary.getMonth() + months);
        remainingDays = Math.ceil((calculationEnd.getTime() - monthBoundary.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        // Fallback without start date: use rough estimation
        months = Math.floor(diffDays / 30);
        remainingDays = diffDays % 30;
      }
      
      // Only show full months if less than 7 days remaining
      if (months >= 1 && remainingDays > 7) {
        return { 
          text: `${months} mo. ${remainingDays} day${remainingDays !== 1 ? 's' : ''}`, 
          className: 'text-green-600' 
        };
      } else if (months >= 1) {
        return { 
          text: `${months} month${months !== 1 ? 's' : ''}`, 
          className: 'text-green-600' 
        };
      }
    }
    
    return { text: `${diffDays} days`, className: 'text-muted-foreground' };
  };


  const handleDeleteMember = async (memberId: string, memberName: string, userId?: string) => {
    if (!confirm(`Sind Sie sicher, dass Sie das Mitglied "${memberName}" komplett löschen möchten? Dies entfernt sowohl das Profil als auch den Account unwiderruflich.`)) return;

    try {
      if (!userId) {
        // Fallback: only delete from profiles if no user_id
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', memberId);

        if (error) {
          console.error('Error deleting member:', error);
          toast({
            title: "Error",
            description: "Error deleting member",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Success",
            description: "Member successfully deleted",
          });
          setCurrentPage(1);
          loadMembers();
        }
        return;
      }

      // Use edge function to delete completely
      const { data: result, error: functionError } = await supabase.functions.invoke('delete-member', {
        body: { userId }
      });

      if (functionError || !result?.success) {
        console.error('Error deleting member:', functionError || result?.error);
        toast({
          title: "Error",
          description: "Error deleting member",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Member and account successfully deleted",
        });
        setCurrentPage(1);
        loadMembers();
      }
    } catch (error) {
      console.error('Error deleting member:', error);
      toast({
        title: "Error",
        description: "Error deleting member",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: "Error",
          description: "Error signing out",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Successfully signed out",
        });
        navigate("/");
      }
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Error",
        description: "Error signing out",
        variant: "destructive",
      });
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Zugriff verweigert</h1>
          <p className="text-muted-foreground">Sie haben keine Admin-Berechtigung.</p>
        </div>
      </div>
    );
  }

  const handlePageChange = (page: string) => {
    const validPages = ['home', 'members', 'courses', 'templates', 'news', 'email', 'workouts', 'challenges', 'memberships', 'sync', 'finance', 'shop', 'risk-radar', 'settings', 'export'] as const;
    if (validPages.includes(page as any)) {
      setActivePage(page as typeof activePage);
      // Refresh membership plans when switching to members page
      if (page === 'members') {
        loadMembershipPlans();
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <RiseHeader 
        showAdminAccess={true}
        activePage={activePage}
        onPageChange={handlePageChange}
        onLogout={handleLogout}
      />
      
      <div className="container mx-auto p-6">
        {activePage === 'home' && (
          <AdminStats />
        )}

        {activePage === 'members' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Members</h2>
                <p className="text-muted-foreground">Manage and organize your studio members</p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (open) {
                  loadMembershipPlans(); // Refresh plans when opening create dialog
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <UserPlus className="mr-2 h-4 w-4" />
                    New Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Member</DialogTitle>
                    <DialogDescription>
                      Create a new member account with individual membership configuration
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateMember} className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">First Name *</label>
                        <Input
                          placeholder="Max"
                          value={newMemberFirstName}
                          onChange={(e) => setNewMemberFirstName(e.target.value)}
                          onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('First name is required')}
                          onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Last Name</label>
                        <Input
                          placeholder="Mustermann"
                          value={newMemberLastName}
                          onChange={(e) => setNewMemberLastName(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email *</label>
                      <Input
                        type="email"
                        placeholder="Member's email address"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Please enter a valid email address')}
                        onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Access Code *</label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Access Code"
                          value={newMemberCode}
                          onChange={(e) => setNewMemberCode(e.target.value.replace(/\s/g, ''))}
                          onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Access code is required')}
                          onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const newCode = Math.floor(Math.random() * 900000 + 100000).toString();
                            setNewMemberCode(newCode);
                          }}
                        >
                          Generate
                        </Button>
                      </div>
                    </div>
                    
                    {/* V2 Simplified Membership Selection */}
                    <div className="space-y-4 border-t pt-4">
                      <h3 className="text-lg font-semibold">Mitgliedschaft (optional)</h3>
                      <p className="text-sm text-muted-foreground">
                        Mitglieder können ihre Mitgliedschaft auch selbst in der App kaufen.
                      </p>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Mitgliedschaftsplan</label>
                        <Select 
                          value={selectedMembershipPlan} 
                          onValueChange={setSelectedMembershipPlan}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Keine Mitgliedschaft zuweisen" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Keine Mitgliedschaft</SelectItem>
                            {availablePlans.map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.name} - €{plan.price_monthly}/{plan.duration_months}M
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="isAuthor"
                          checked={newMemberIsAuthor}
                          onChange={(e) => setNewMemberIsAuthor(e.target.checked)}
                        />
                        <label htmlFor="isAuthor" className="text-sm font-medium">Can Create Workouts</label>
                      </div>

                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button type="submit">Create Member</Button>
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Search and Members Table */}
            <div className="space-y-4">
              <div className="flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Members ({totalMembers})</CardTitle>
                </CardHeader>
                <CardContent>
                  {isMobile ? (
                    // Mobile card layout
                    <div className="space-y-3">
                      {members.map((member) => (
                        <Card key={member.id} className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-sm mb-1">
                                {member.first_name && member.last_name 
                                  ? `${member.first_name} ${member.last_name}`
                                  : member.display_name || 'Unbekannt'
                                }
                              </div>
                              <div className="text-xs text-muted-foreground mb-2">
                                {member.access_code}
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <MembershipBadge type={member.current_membership_type as any || 'No Membership'} color={member.current_membership_color} noShadow />
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  member.status === 'active' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {member.status === 'active' ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              {member.authors && (
                                <Badge variant="secondary" className="text-xs">Autor</Badge>
                              )}
                            </div>
                            <div className="flex gap-1 ml-4">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingMember(member);
                                  loadEditMemberData(member.user_id || '');
                                  setEditDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setMemberToDelete(member)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    // Desktop table layout
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead className="hidden md:table-cell">Access Code</TableHead>
                            <TableHead>Membership</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="hidden sm:table-cell">Contract Duration</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                      </TableHeader>
                        <TableBody>
                          {members.map((member) => (
                            <TableRow key={member.id}>
                               <TableCell className="font-medium">
                                 <div>
                                   <div className="font-medium">
                                     {member.first_name && member.last_name 
                                       ? `${member.first_name} ${member.last_name}`
                                       : member.display_name || 'Unbekannt'
                                     }
                                   </div>
                                   <div className="md:hidden text-sm">
                                     <Badge variant="outline" className="font-mono text-xs mr-2">
                                       {member.access_code}
                                     </Badge>
                                   </div>
                                    {member.authors && (
                                      <Badge variant="secondary" className="text-xs mt-1">Autor</Badge>
                                    )}
                                 </div>
                               </TableCell>
                               <TableCell className="font-mono hidden md:table-cell">{member.access_code}</TableCell>
                               <TableCell>
                                 <MembershipBadge type={member.current_membership_type as any || 'No Membership'} color={member.current_membership_color} noShadow />
                               </TableCell>
                               <TableCell>
                                 <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                   member.status === 'active' 
                                     ? 'bg-green-100 text-green-800' 
                                     : 'bg-red-100 text-red-800'
                                 }`}>
                                   {member.status === 'active' ? 'Active' : 'Inactive'}
                                 </span>
                               </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const duration = getMembershipDuration(
                        member.membership_end_date, 
                        member.membership_auto_renewal || false,
                        member.membership_start_date
                      );
                      return (
                        <span className={duration.className}>
                          {duration.text}
                        </span>
                      );
                    })()}
                    {member.membership_auto_renewal && (
                      <RefreshCw className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </TableCell>
                               <TableCell>
                                 <div className="flex gap-1">
                                   <Button
                                     size="sm"
                                     variant="outline"
                                     onClick={() => {
                                       setEditingMember(member);
                                       loadEditMemberData(member.user_id || '');
                                       setEditDialogOpen(true);
                                     }}
                                   >
                                     <Edit className="h-4 w-4" />
                                   </Button>
                                   <Button
                                     size="sm"
                                     variant="outline"
                                     onClick={() => setMemberToDelete(member)}
                                     className="text-destructive hover:text-destructive"
                                   >
                                     <Trash2 className="h-4 w-4" />
                                   </Button>
                                 </div>
                               </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  
                  {/* Pagination Controls */}
                  {totalMembers > membersPerPage && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>
                          Page {currentPage} of {Math.ceil(totalMembers / membersPerPage)} ({totalMembers} members total)
                        </span>
                        
                        {/* Direct page jump */}
                        <div className="flex items-center gap-2">
                          <span>Go to page:</span>
                          <Input
                            type="number"
                            min="1"
                            max={Math.ceil(totalMembers / membersPerPage)}
                            value={currentPage}
                            onChange={(e) => {
                              const page = parseInt(e.target.value);
                              if (page >= 1 && page <= Math.ceil(totalMembers / membersPerPage)) {
                                setCurrentPage(page);
                              }
                            }}
                            className="w-16 h-8 text-center"
                          />
                        </div>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(Math.min(Math.ceil(totalMembers / membersPerPage), currentPage + 1))}
                        disabled={currentPage >= Math.ceil(totalMembers / membersPerPage)}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activePage === 'courses' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Courses</h2>
              <p className="text-muted-foreground">Manage courses and participants</p>
            </div>
            <CourseParticipants />
          </div>
        )}
        {activePage === 'templates' && <CourseTemplateManager />}
        {activePage === 'news' && <NewsManager />}
        {activePage === 'email' && <AdminEmailManager />}
        
        {activePage === 'workouts' && <WorkoutManagement hideHeader={true} />}
        {activePage === 'challenges' && <AdminChallengeManager />}
        {activePage === 'memberships' && <MembershipPlanManagerV2 />}
        
        {activePage === 'finance' && <FinanceReport />}
        {activePage === 'shop' && (
          <div className="space-y-8">
            <ProductManager />
            <AdminPurchaseHistory />
          </div>
        )}
        {activePage === 'risk-radar' && <AdminRiskRadar />}
        {activePage === 'settings' && <GymSettings />}
        {activePage === 'export' && <DataExport />}
      </div>

      {/* Edit Member Dialog - Unified Form */}
      {editingMember && (
        <Dialog open={editDialogOpen} onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (open) {
            loadMembershipPlans(); // Refresh plans when opening edit dialog
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Member: {editingMember.display_name}</DialogTitle>
              <DialogDescription>
                Edit member data and membership configuration
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditSave} className="space-y-6">
              {/* Basic Profile Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">First Name *</label>
                  <Input
                    placeholder="Max"
                    value={editingMember.first_name || ''}
                    onChange={(e) => setEditingMember({
                      ...editingMember,
                      first_name: e.target.value
                    })}
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('First name is required')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Last Name</label>
                  <Input
                    placeholder="Mustermann"
                    value={editingMember.last_name || ''}
                    onChange={(e) => setEditingMember({
                      ...editingMember,
                      last_name: e.target.value
                    })}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  placeholder="max@beispiel.de"
                  value={editingMember.email || ''}
                  disabled
                  readOnly
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Access Code *</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Access Code"
                    value={editingMember.access_code || ''}
                    onChange={(e) => setEditingMember({
                      ...editingMember,
                      access_code: e.target.value.replace(/\s/g, '')
                    })}
                    onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Access code is required')}
                    onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      const newCode = Math.floor(Math.random() * 900000 + 100000).toString();
                      setEditingMember({
                        ...editingMember,
                        access_code: newCode
                      });
                      
                      // Update access code in auth system immediately
                      if (editingMember.user_id) {
                        try {
                          await supabase.functions.invoke('update-access-code', {
                            body: {
                              newAccessCode: newCode,
                              targetUserId: editingMember.user_id
                            }
                          });
                          toast({
                            title: "Success",
                            description: "New access code generated",
                          });
                        } catch (error) {
                          console.error('Error updating access code:', error);
                          toast({
                            title: "Warnung",
                            description: "Code generiert, aber Anmeldecode konnte nicht aktualisiert werden",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                  >
                    Generate new
                  </Button>
                </div>
              </div>

              {/* Simplified Membership Management */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold">Membership Management</h3>
                
                {/* Current Membership Display */}
                {editCurrentMembership && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium">Current Membership:</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {editCurrentMembership.membership_plans_v2?.name} - €{editCurrentMembership.membership_plans_v2?.price_monthly}
                      {editCurrentMembership.membership_plans_v2?.payment_frequency === 'monthly' ? '/month' : ' one-time'}
                    </p>
                    {editCurrentMembership.membership_plans_v2?.booking_rules?.type === 'credits' && (
                      <p className="text-sm text-muted-foreground">
                        Remaining Credits: {editCurrentMembership.membership_data?.remaining_credits || 0}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Membership Plan Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Change membership plan</label>
                  <Select 
                    value={editSelectedMembershipPlan} 
                    onValueChange={setEditSelectedMembershipPlan}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose new plan (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} - €{plan.price_monthly}/{plan.duration_months}M
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Credits Management for Credit-based Memberships */}
                {editCurrentMembership?.membership_plans_v2?.booking_rules?.type === 'credits' && (
                  <div className="space-y-4 p-4 border rounded-lg">
                    <h4 className="font-medium">Credits verwalten</h4>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Anzahl Credits</label>
                        <Input
                          type="number"
                          max="100"
                          value={creditsAmount}
                          onChange={(e) => setCreditsAmount(parseInt(e.target.value) || 0)}
                          className="w-24"
                        />
                      </div>
                      <div className="space-y-2 flex-1">
                        <label className="text-sm font-medium">Aktion</label>
                        <div className="flex gap-2 w-full">
                          <Button
                            type="button"
                            variant={isSubtracting ? "default" : "outline"}
                            onClick={() => setIsSubtracting(true)}
                            size="sm"
                            className="flex-1 sm:flex-none"
                          >
                            Abziehen
                          </Button>
                          <Button
                            type="button"
                            variant={!isSubtracting ? "default" : "outline"}
                            onClick={() => setIsSubtracting(false)}
                            size="sm"
                            className="flex-1 sm:flex-none"
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={() => handleManageCredits()}
                        className="w-full sm:w-auto sm:mt-6"
                      >
                        {isSubtracting ? 'Subtract' : 'Add'} Credits
                      </Button>
                    </div>
                  </div>
                )}

                {/* Authors Checkbox */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="editAuthors"
                    checked={editingMember.authors || false}
                    onChange={(e) => setEditingMember({
                      ...editingMember,
                      authors: e.target.checked
                    })}
                  />
                  <label htmlFor="editAuthors" className="text-sm font-medium">Can Create Workouts</label>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit">Save Member</Button>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Member Confirmation Dialog */}
      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete member "{memberToDelete?.display_name || memberToDelete?.first_name + ' ' + memberToDelete?.last_name}"? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => memberToDelete && deleteMember(memberToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
