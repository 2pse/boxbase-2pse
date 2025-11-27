-- Drop the obsolete trigger that references non-existent revenue_history table
DROP TRIGGER IF EXISTS archive_revenue_before_membership_delete ON user_memberships_v2;

-- Drop the obsolete function
DROP FUNCTION IF EXISTS archive_revenue_on_membership_delete();