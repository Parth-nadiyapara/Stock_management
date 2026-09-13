import { supabase } from '../config/db.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logActivity } from '../utils/activityLog.js';

const PRODUCT_TYPES = ['product', 'material'];

// Finds a product/material by name, creating it if it doesn't exist
// yet. Keeps the master list normalized without forcing the user
// through a separate "manage products" screen.
//
// `type` is 'product' (finished goods, offered in the packing bill
// picker) or 'material' (raw stock, tracked but not packed/sold
// directly). A name is global - if it already exists under a
// different type than requested, that's a naming conflict we
// reject rather than silently reclassifying it.
export async function getOrCreateProduct(name, type = 'product') {
  const trimmed = name.trim();
  const normalizedType = PRODUCT_TYPES.includes(type) ? type : 'product';

  const { data: existing, error: findErr } = await supabase
    .from('products')
    .select('id, name, type')
    .ilike('name', trimmed)
    .maybeSingle();

  if (findErr) throw new ApiError(500, 'Failed to look up product', findErr.message);

  if (existing) {
    if (existing.type !== normalizedType) {
      throw new ApiError(
        400,
        `"${existing.name}" already exists as a ${existing.type}. Use a different name, or pick ${existing.type} instead.`
      );
    }
    return existing;
  }

  const { data: created, error: createErr } = await supabase
    .from('products')
    .insert({ name: trimmed, type: normalizedType })
    .select('id, name, type')
    .single();

  if (createErr) throw new ApiError(500, 'Failed to create product', createErr.message);
  return created;
}

export function mapStockRow(row) {
  return {
    id: row.id,
    productId: row.product_id,
    product: row.products?.name || null,
    productType: row.products?.type || 'product',
    size: row.size,
    weightKg: Number(row.weight_kg),
    availableKg: Number(row.available_kg),
    pricePerKg: Number(row.price_per_kg),
    date: row.entry_date,
    createdBy: row.created_by_user?.display_name || null,
    updatedBy: row.updated_by_user?.display_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isLowStock: Number(row.available_kg) < env.lowStockThresholdKg,
  };
}

export const STOCK_SELECT = `
  id, product_id, size, weight_kg, available_kg, price_per_kg, entry_date,
  created_at, updated_at, created_by, updated_by,
  products ( name, type ),
  created_by_user:users!stock_entries_created_by_fkey ( display_name ),
  updated_by_user:users!stock_entries_updated_by_fkey ( display_name )
`;

export const listStock = asyncHandler(async (req, res) => {
  const { search, size, date, type } = req.query;

  let query = supabase.from('stock_entries').select(STOCK_SELECT).order('entry_date', { ascending: false });

  if (size) query = query.eq('size', size);
  if (date) query = query.eq('entry_date', date);

  const { data, error } = await query;
  if (error) throw new ApiError(500, 'Failed to load stock', error.message);

  let rows = data.map(mapStockRow);

  if (search) {
    const term = search.trim().toLowerCase();
    rows = rows.filter((r) => r.product?.toLowerCase().includes(term));
  }

  // Used by the Packing form to only offer finished Products (not
  // raw Materials) in its product picker.
  if (type && PRODUCT_TYPES.includes(type)) {
    rows = rows.filter((r) => r.productType === type);
  }

  res.json({ stock: rows });
});

export const createStock = asyncHandler(async (req, res) => {
  const { product, type, size, weightKg, pricePerKg, date } = req.body;
  const normalizedType = type && PRODUCT_TYPES.includes(type) ? type : 'product';

  if (!product?.trim()) throw new ApiError(400, 'Product name is required');
  // Size only applies to finished Products - Materials are tracked
  // without one, since raw material batches aren't sized.
  if (normalizedType === 'product' && !size?.trim()) throw new ApiError(400, 'Size is required');
  if (type && !PRODUCT_TYPES.includes(type)) throw new ApiError(400, 'Type must be "product" or "material"');
  const weight = Number(weightKg);
  const price = Number(pricePerKg);
  if (!Number.isFinite(weight) || weight <= 0) throw new ApiError(400, 'Weight (KG) must be a positive number');
  if (!Number.isFinite(price) || price < 0) throw new ApiError(400, 'Price must be a non-negative number');

  const prod = await getOrCreateProduct(product, type);
  const finalSize = normalizedType === 'material' ? null : size.trim();

  const { data: inserted, error } = await supabase
    .from('stock_entries')
    .insert({
      product_id: prod.id,
      size: finalSize,
      weight_kg: weight,
      available_kg: weight,
      price_per_kg: price,
      entry_date: date || new Date().toISOString().slice(0, 10),
      created_by: req.user.id,
    })
    .select(STOCK_SELECT)
    .single();

  if (error) throw new ApiError(500, 'Failed to add stock', error.message);

  await logActivity({
    userId: req.user.id,
    action: 'stock.create',
    entityType: 'stock',
    entityId: inserted.id,
    description: finalSize
      ? `${req.user.displayName} added ${weight} KG ${prod.name} (${finalSize})`
      : `${req.user.displayName} added ${weight} KG ${prod.name}`,
  });

  res.status(201).json({ stock: mapStockRow(inserted) });
});

export const updateStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { product, size, weightKg, pricePerKg, date } = req.body;

  const { data: existing, error: findErr } = await supabase
    .from('stock_entries')
    .select('*, products ( type )')
    .eq('id', id)
    .maybeSingle();

  if (findErr) throw new ApiError(500, 'Failed to load stock entry', findErr.message);
  if (!existing) throw new ApiError(404, 'Stock entry not found');

  const usedKg = Number(existing.weight_kg) - Number(existing.available_kg);

  const patch = { updated_by: req.user.id };

  if (product?.trim()) {
    // A stock entry's product/material category is fixed by the
    // product it points to - editing here can rename or switch to
    // a different existing product, but keeps the same type as the
    // batch already had (type isn't editable per stock entry).
    const prod = await getOrCreateProduct(product, existing.products?.type || 'product');
    patch.product_id = prod.id;
  }
  if (size?.trim()) patch.size = size.trim();
  if (date) patch.entry_date = date;
  if (pricePerKg !== undefined) {
    const price = Number(pricePerKg);
    if (!Number.isFinite(price) || price < 0) throw new ApiError(400, 'Price must be a non-negative number');
    patch.price_per_kg = price;
  }
  if (weightKg !== undefined) {
    const weight = Number(weightKg);
    if (!Number.isFinite(weight) || weight <= 0) throw new ApiError(400, 'Weight (KG) must be a positive number');
    if (weight < usedKg) {
      throw new ApiError(
        400,
        `Cannot set total weight below ${usedKg} KG - that much has already been packed from this batch`
      );
    }
    patch.weight_kg = weight;
    patch.available_kg = weight - usedKg;
  }

  const { data: updated, error } = await supabase
    .from('stock_entries')
    .update(patch)
    .eq('id', id)
    .select(STOCK_SELECT)
    .single();

  if (error) throw new ApiError(500, 'Failed to update stock', error.message);

  await logActivity({
    userId: req.user.id,
    action: 'stock.update',
    entityType: 'stock',
    entityId: id,
    description: `${req.user.displayName} updated stock entry ${updated.products?.name || ''} (${updated.size})`,
  });

  res.json({ stock: mapStockRow(updated) });
});

export const deleteStock = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: existing, error: findErr } = await supabase
    .from('stock_entries')
    .select('id, weight_kg, available_kg, size, products ( name )')
    .eq('id', id)
    .maybeSingle();

  if (findErr) throw new ApiError(500, 'Failed to load stock entry', findErr.message);
  if (!existing) throw new ApiError(404, 'Stock entry not found');

  if (Number(existing.available_kg) < Number(existing.weight_kg)) {
    throw new ApiError(
      400,
      'This stock batch already has packing bills against it and cannot be deleted. Consider adjusting future entries instead.'
    );
  }

  const { error } = await supabase.from('stock_entries').delete().eq('id', id);
  if (error) throw new ApiError(500, 'Failed to delete stock', error.message);

  await logActivity({
    userId: req.user.id,
    action: 'stock.delete',
    entityType: 'stock',
    entityId: id,
    description: `${req.user.displayName} deleted stock entry ${existing.products?.name || ''} (${existing.size})`,
  });

  res.json({ success: true });
});

export const listProducts = asyncHandler(async (req, res) => {
  const { type } = req.query;
  let query = supabase.from('products').select('id, name, type').order('name');
  if (type && PRODUCT_TYPES.includes(type)) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) throw new ApiError(500, 'Failed to load products', error.message);
  res.json({ products: data });
});
