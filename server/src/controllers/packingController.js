import { supabase } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logActivity } from '../utils/activityLog.js';

const PACKING_SELECT = `
  id, bill_number, client_id, stock_entry_id, product_id, size, quantity, weight_kg,
  bill_date, created_at, created_by,
  clients ( name ),
  products ( name ),
  created_by_user:users ( display_name )
`;

function mapBill(row) {
  return {
    id: row.id,
    billNumber: row.bill_number,
    clientId: row.client_id,
    client: row.clients?.name || null,
    product: row.products?.name || null,
    size: row.size,
    quantity: row.quantity !== null ? Number(row.quantity) : null,
    weightKg: Number(row.weight_kg),
    date: row.bill_date,
    createdBy: row.created_by_user?.display_name || null,
    createdAt: row.created_at,
  };
}

export const listPacking = asyncHandler(async (req, res) => {
  const { search, client, product, date } = req.query;

  let query = supabase.from('packing_bills').select(PACKING_SELECT).order('created_at', { ascending: false });

  if (date) query = query.eq('bill_date', date);

  const { data, error } = await query;
  if (error) throw new ApiError(500, 'Failed to load packing bills', error.message);

  let rows = data.map(mapBill);

  if (search?.trim()) {
    const term = search.trim().toLowerCase();
    rows = rows.filter((r) => r.billNumber.toLowerCase().includes(term));
  }
  if (client?.trim()) {
    const term = client.trim().toLowerCase();
    rows = rows.filter((r) => r.client?.toLowerCase().includes(term));
  }
  if (product?.trim()) {
    const term = product.trim().toLowerCase();
    rows = rows.filter((r) => r.product?.toLowerCase().includes(term));
  }

  res.json({ packing: rows });
});

export const getPackingDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('packing_bills').select(PACKING_SELECT).eq('id', id).maybeSingle();
  if (error) throw new ApiError(500, 'Failed to load packing bill', error.message);
  if (!data) throw new ApiError(404, 'Packing bill not found');
  res.json({ packing: mapBill(data) });
});

export const createPacking = asyncHandler(async (req, res) => {
  const { clientId, stockEntryId, quantity, weightKg, date } = req.body;

  if (!clientId) throw new ApiError(400, 'Client is required');
  if (!stockEntryId) throw new ApiError(400, 'Stock item is required');

  const weight = Number(weightKg);
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new ApiError(400, 'Weight (KG) must be a positive number');
  }

  const qty = quantity !== undefined && quantity !== '' ? Number(quantity) : null;
  if (qty !== null && (!Number.isFinite(qty) || qty <= 0)) {
    throw new ApiError(400, 'Quantity must be a positive number');
  }

  // The database function does the availability check + deduction +
  // insert atomically, so we never end up with a mismatched state
  // even under concurrent requests from multiple users.
  const { data, error } = await supabase.rpc('create_packing_bill', {
    p_client_id: clientId,
    p_stock_entry_id: stockEntryId,
    p_quantity: qty,
    p_weight_kg: weight,
    p_bill_date: date || new Date().toISOString().slice(0, 10),
    p_created_by: req.user.id,
  });

  if (error) {
    if (error.message?.includes('INSUFFICIENT_STOCK')) {
      throw new ApiError(400, 'Insufficient stock available for this quantity');
    }
    if (error.message?.includes('STOCK_NOT_FOUND')) {
      throw new ApiError(404, 'Selected stock batch no longer exists');
    }
    if (error.message?.includes('INVALID_WEIGHT')) {
      throw new ApiError(400, 'Weight (KG) must be a positive number');
    }
    throw new ApiError(500, 'Failed to create packing bill', error.message);
  }

  const created = data?.[0];
  if (!created) throw new ApiError(500, 'Packing bill creation returned no data');

  const { data: full, error: fetchErr } = await supabase
    .from('packing_bills')
    .select(PACKING_SELECT)
    .eq('id', created.id)
    .single();
  if (fetchErr) throw new ApiError(500, 'Packing bill created but failed to load details', fetchErr.message);

  await logActivity({
    userId: req.user.id,
    action: 'packing.create',
    entityType: 'packing',
    entityId: created.id,
    description: `${req.user.displayName} created packing ${created.bill_number} (${weight} KG)`,
  });

  res.status(201).json({ packing: mapBill(full) });
});
