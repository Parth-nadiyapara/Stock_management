import { supabase } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listActivity = asyncHandler(async (req, res) => {
  const { user, action, dateFrom, dateTo } = req.query;

  let query = supabase
    .from('activity_logs')
    .select('id, action, entity_type, description, created_at, user_id, users ( display_name )')
    .order('created_at', { ascending: false })
    .limit(200);

  if (action) query = query.eq('action', action);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);

  const { data, error } = await query;
  if (error) throw new ApiError(500, 'Failed to load activity', error.message);

  let rows = data.map((a) => ({
    id: a.id,
    action: a.action,
    entityType: a.entity_type,
    description: a.description,
    user: a.users?.display_name,
    createdAt: a.created_at,
  }));

  if (user?.trim()) {
    const term = user.trim().toLowerCase();
    rows = rows.filter((r) => r.user?.toLowerCase().includes(term));
  }

  res.json({ activity: rows });
});
