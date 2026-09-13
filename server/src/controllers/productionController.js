import { supabase } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logActivity } from '../utils/activityLog.js';
import { getOrCreateProduct, mapStockRow, STOCK_SELECT } from './stockController.js';

const PRODUCTION_SELECT = `
  id, material_stock_entry_id, material_id, product_id, product_stock_entry_id, size,
  material_used_kg, produced_kg, production_date, created_at, created_by,
  material:products!production_records_material_id_fkey ( name ),
  product:products!production_records_product_id_fkey ( name ),
  created_by_user:users ( display_name )
`;

function mapProduction(row) {
  return {
    id: row.id,
    materialStockEntryId: row.material_stock_entry_id,
    material: row.material?.name || null,
    productId: row.product_id,
    product: row.product?.name || null,
    productStockEntryId: row.product_stock_entry_id,
    size: row.size,
    materialUsedKg: Number(row.material_used_kg),
    producedKg: Number(row.produced_kg),
    date: row.production_date,
    createdBy: row.created_by_user?.display_name || null,
    createdAt: row.created_at,
  };
}

export const listProduction = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('production_records')
    .select(PRODUCTION_SELECT)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new ApiError(500, 'Failed to load production history', error.message);
  res.json({ production: data.map(mapProduction) });
});

export const createProduction = asyncHandler(async (req, res) => {
  const { materialStockEntryId, product, size, quantityKg, pricePerKg, date } = req.body;

  if (!materialStockEntryId) throw new ApiError(400, 'Select a material batch');
  if (!product?.trim()) throw new ApiError(400, 'Product name is required');
  if (!size?.trim()) throw new ApiError(400, 'Size is required');

  const quantity = Number(quantityKg);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ApiError(400, 'Quantity (KG) must be a positive number');
  }

  const price = pricePerKg !== undefined && pricePerKg !== '' ? Number(pricePerKg) : 0;
  if (!Number.isFinite(price) || price < 0) throw new ApiError(400, 'Price must be a non-negative number');

  // Reuses the exact same "find or create" logic Stock uses, so a
  // production run can target a brand-new product name or an
  // existing one without a separate product-management system.
  // Always 'product' type - production never yields a Material.
  const prod = await getOrCreateProduct(product, 'product');

  const { data, error } = await supabase.rpc('create_production', {
    p_material_stock_entry_id: materialStockEntryId,
    p_product_id: prod.id,
    p_size: size.trim(),
    p_quantity_kg: quantity,
    p_price_per_kg: price,
    p_production_date: date || new Date().toISOString().slice(0, 10),
    p_created_by: req.user.id,
  });

  if (error) {
    if (error.message?.includes('INSUFFICIENT_MATERIAL')) {
      throw new ApiError(400, 'Insufficient material stock for this quantity');
    }
    if (error.message?.includes('MATERIAL_NOT_FOUND')) {
      throw new ApiError(404, 'Selected material batch no longer exists');
    }
    if (error.message?.includes('NOT_A_MATERIAL')) {
      throw new ApiError(400, 'Selected batch is not a Material');
    }
    if (error.message?.includes('PRODUCT_NOT_FOUND')) {
      throw new ApiError(404, 'Product could not be created or found');
    }
    if (error.message?.includes('NOT_A_PRODUCT')) {
      throw new ApiError(400, `"${prod.name}" is registered as a Material, not a Product`);
    }
    if (error.message?.includes('INVALID_QUANTITY') || error.message?.includes('SIZE_REQUIRED')) {
      throw new ApiError(400, 'Enter a valid size and quantity');
    }
    throw new ApiError(500, 'Failed to save production', error.message);
  }

  const created = data?.[0];
  if (!created) throw new ApiError(500, 'Production creation returned no data');

  const { data: full, error: fetchErr } = await supabase
    .from('production_records')
    .select(PRODUCTION_SELECT)
    .eq('id', created.id)
    .single();
  if (fetchErr) throw new ApiError(500, 'Production saved but failed to load details', fetchErr.message);

  const mapped = mapProduction(full);

  // Fetch both affected stock rows in their normal Stock-page shape
  // so the frontend can merge them into local state directly instead
  // of refetching the whole stock list for what is, underneath, just
  // two row changes.
  const [{ data: materialStockRow, error: materialErr }, { data: productStockRow, error: productErr }] =
    await Promise.all([
      supabase.from('stock_entries').select(STOCK_SELECT).eq('id', materialStockEntryId).single(),
      supabase.from('stock_entries').select(STOCK_SELECT).eq('id', created.product_stock_entry_id).single(),
    ]);
  if (materialErr || productErr) {
    throw new ApiError(500, 'Production saved but failed to load updated stock', (materialErr || productErr).message);
  }

  await logActivity({
    userId: req.user.id,
    action: 'production.create',
    entityType: 'production',
    entityId: created.id,
    description: `${req.user.displayName} created production: ${mapped.product} - ${mapped.size} - ${mapped.producedKg} KG`,
  });

  res.status(201).json({
    production: mapped,
    materialStock: mapStockRow(materialStockRow),
    productStock: mapStockRow(productStockRow),
  });
});
