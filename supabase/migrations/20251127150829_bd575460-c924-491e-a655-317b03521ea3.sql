-- Update all pending purchases to completed (these were processed before webhook was fixed)
UPDATE purchase_history 
SET status = 'completed', updated_at = now()
WHERE status = 'pending';