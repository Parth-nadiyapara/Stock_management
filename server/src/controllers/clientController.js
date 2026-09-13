import { supabase } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logActivity } from '../utils/activityLog.js';

const CLIENT_SELECT = `
  id, name, phone, address, created_at, updated_at, created_by, updated_by,
  created_by_user:users!clients_created_by_fkey ( display_name ),
  updated_by_user:users!clients_updated_by_fkey ( display_name )
`;

function mapClient(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    address: row.address,
    createdBy: row.created_by_user?.display_name || null,
    updatedBy: row.updated_by_user?.display_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const listClients = asyncHandler(async (req, res) => {
  const { search } = req.query;
  let query = supabase.from('clients').select(CLIENT_SELECT).order('name');

  if (search?.trim()) {
    query = query.ilike('name', `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw new ApiError(500, 'Failed to load clients', error.message);
  res.json({ clients: data.map(mapClient) });
});

export const createClient = asyncHandler(async (req, res) => {
  const { name, phone, address } = req.body;
  if (!name?.trim()) throw new ApiError(400, 'Client name is required');

  const { data: inserted, error } = await supabase
    .from('clients')
    .insert({
      name: name.trim(),
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      created_by: req.user.id,
    })
    .select(CLIENT_SELECT)
    .single();

  if (error) throw new ApiError(500, 'Failed to create client', error.message);

  await logActivity({
    userId: req.user.id,
    action: 'client.create',
    entityType: 'client',
    entityId: inserted.id,
    description: `${req.user.displayName} added client ${inserted.name}`,
  });

  res.status(201).json({ client: mapClient(inserted) });
});

export const updateClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, address } = req.body;

  const patch = { updated_by: req.user.id };
  if (name !== undefined) {
    if (!name.trim()) throw new ApiError(400, 'Client name cannot be empty');
    patch.name = name.trim();
  }
  if (phone !== undefined) patch.phone = phone?.trim() || null;
  if (address !== undefined) patch.address = address?.trim() || null;

  const { data: updated, error } = await supabase
    .from('clients')
    .update(patch)
    .eq('id', id)
    .select(CLIENT_SELECT)
    .single();

  if (error) throw new ApiError(500, 'Failed to update client', error.message);
  if (!updated) throw new ApiError(404, 'Client not found');

  await logActivity({
    userId: req.user.id,
    action: 'client.update',
    entityType: 'client',
    entityId: id,
    description: `${req.user.displayName} updated client ${updated.name}`,
  });

  res.json({ client: mapClient(updated) });
});

export const deleteClient = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: existing, error: findErr } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', id)
    .maybeSingle();
  if (findErr) throw new ApiError(500, 'Failed to load client', findErr.message);
  if (!existing) throw new ApiError(404, 'Client not found');

  const { count } = await supabase
    .from('packing_bills')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', id);

  if (count > 0) {
    throw new ApiError(400, 'This client has packing bills on record and cannot be deleted');
  }

  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw new ApiError(500, 'Failed to delete client', error.message);

  await logActivity({
    userId: req.user.id,
    action: 'client.delete',
    entityType: 'client',
    entityId: id,
    description: `${req.user.displayName} deleted client ${existing.name}`,
  });

  res.json({ success: true });
});

export const getClientDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select(CLIENT_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (clientErr) throw new ApiError(500, 'Failed to load client', clientErr.message);
  if (!client) throw new ApiError(404, 'Client not found');

  const { data: bills, error: billsErr } = await supabase
    .from('packing_bills')
    .select(
      `id, bill_number, size, quantity, weight_kg, bill_date, created_at,
       products ( name ), created_by_user:users ( display_name )`
    )
    .eq('client_id', id)
    .order('created_at', { ascending: false });

  if (billsErr) throw new ApiError(500, 'Failed to load packing history', billsErr.message);

  res.json({
    client: mapClient(client),
    packingHistory: bills.map((b) => ({
      id: b.id,
      billNumber: b.bill_number,
      product: b.products?.name,
      size: b.size,
      quantity: b.quantity,
      weightKg: Number(b.weight_kg),
      date: b.bill_date,
      createdBy: b.created_by_user?.display_name,
    })),
  });
});
