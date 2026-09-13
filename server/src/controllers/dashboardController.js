import { supabase } from '../config/db.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const [stockRes, clientsRes, productsRes, todaysStockRes, todaysPackingRes, activityRes, recentPackingRes] =
    await Promise.all([
      supabase.from('stock_entries').select('available_kg, weight_kg, size, entry_date, products ( name )'),
      supabase.from('clients').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('stock_entries').select('weight_kg').eq('entry_date', today),
      supabase.from('packing_bills').select('weight_kg').eq('bill_date', today),
      supabase
        .from('activity_logs')
        .select('id, action, description, created_at, users ( display_name )')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('packing_bills')
        .select('id, bill_number, weight_kg, bill_date, clients ( name ), products ( name )')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

  for (const r of [stockRes, clientsRes, productsRes, todaysStockRes, todaysPackingRes, activityRes, recentPackingRes]) {
    if (r.error) throw new ApiError(500, 'Failed to load dashboard data', r.error.message);
  }

  const totalAvailableKg = stockRes.data.reduce((sum, s) => sum + Number(s.available_kg), 0);
  const todaysAddedKg = todaysStockRes.data.reduce((sum, s) => sum + Number(s.weight_kg), 0);
  const todaysPackingKg = todaysPackingRes.data.reduce((sum, s) => sum + Number(s.weight_kg), 0);

  const lowStockItems = stockRes.data
    .filter((s) => Number(s.available_kg) < env.lowStockThresholdKg)
    .map((s) => ({ product: s.products?.name, size: s.size, availableKg: Number(s.available_kg) }));

  res.json({
    cards: {
      totalAvailableKg,
      todaysAddedKg,
      todaysPackingKg,
      totalClients: clientsRes.count || 0,
      totalProducts: productsRes.count || 0,
    },
    lowStockItems,
    recentActivity: activityRes.data.map((a) => ({
      id: a.id,
      description: a.description,
      user: a.users?.display_name,
      createdAt: a.created_at,
    })),
    recentPacking: recentPackingRes.data.map((p) => ({
      id: p.id,
      billNumber: p.bill_number,
      client: p.clients?.name,
      product: p.products?.name,
      weightKg: Number(p.weight_kg),
      date: p.bill_date,
    })),
  });
});
