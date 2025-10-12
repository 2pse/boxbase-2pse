interface MembershipV2 {
  membership_plans_v2?: {
    booking_rules?: any;
    name?: string;
  };
  membership_data?: any;
  start_date?: string;
}

interface MembershipV1 {
  membership_plans?: {
    booking_type: string;
    name?: string;
  };
  remaining_credits?: number;
}

/**
 * Returns the first active membership without any prioritization
 */
export const getPriorizedMembership = (memberships: MembershipV2[]): MembershipV2 | null => {
  if (!memberships.length) return null;
  
  // Simply return the first membership without prioritization
  return memberships[0];
};

/**
 * Gets the membership type name from either V2 or V1 system
 */
export const getMembershipTypeName = (membershipV2: MembershipV2 | null, membershipV1?: MembershipV1 | null): string | null => {
  if (membershipV2?.membership_plans_v2?.name) {
    return membershipV2.membership_plans_v2.name;
  }
  
  if (membershipV1?.membership_plans?.name) {
    return membershipV1.membership_plans.name;
  }
  
  // Legacy mapping fallback
  const legacyMapping = {
    'unlimited': 'Unlimited',
    'limited': 'Basic Member',
    'credits': 'Credits',
    'monthly_limit': 'Basic Member',
    'weekly_limit': 'Basic Member',
    'open_gym_only': 'Open Gym'
  };
  
  const bookingType = membershipV1?.membership_plans?.booking_type;
  return bookingType ? legacyMapping[bookingType as keyof typeof legacyMapping] || 'No Membership' : 'No Membership';
};