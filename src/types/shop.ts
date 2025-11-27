export interface ShopProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  stock_quantity: number;
  is_active: boolean;
  stripe_product_id?: string;
  stripe_price_id?: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
  images?: ShopProductImage[];
}

export interface ShopProductImage {
  id: string;
  product_id: string;
  image_url: string;
  sort_order: number;
  created_at?: string;
}

export interface PurchaseHistory {
  id: string;
  user_id: string;
  stripe_session_id: string;
  stripe_payment_intent_id?: string;
  amount: number;
  currency: string;
  item_type: 'membership' | 'product' | 'credit_topup';
  item_id: string;
  item_name: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface MembershipPlanV2Extended {
  id: string;
  name: string;
  description?: string;
  price_monthly?: number;
  duration_months: number;
  auto_renewal: boolean;
  is_active: boolean;
  is_public: boolean;
  payment_type: string;
  payment_frequency: string;
  booking_rules: {
    type: 'unlimited' | 'limited' | 'credits' | 'open_gym_only';
    limit?: {
      count: number;
      period: 'week' | 'month';
    };
    includes_open_gym?: boolean;
  };
  stripe_product_id?: string;
  stripe_price_id?: string;
  upgrade_priority: number;
  cancellation_allowed: boolean;
  cancellation_deadline_days: number;
  color: string;
  created_at?: string;
  updated_at?: string;
}
