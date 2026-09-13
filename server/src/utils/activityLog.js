import { supabase } from '../config/db.js';

/**
 * Records one row in activity_logs. Failures here are logged but
 * never thrown - a logging problem should not roll back or block
 * the business operation that triggered it.
 */
export async function logActivity({ userId, action, entityType, entityId, description }) {
  const { error } = await supabase.from('activity_logs').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    description,
  });

  if (error) {
    console.error('Failed to write activity log:', error.message);
  }
}
