import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

// This client uses the SERVICE ROLE key and must never be sent to
// the frontend. All Supabase access in this app goes through the
// Express backend so business rules (stock validation, activity
// logging, etc.) are always enforced.
export const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
