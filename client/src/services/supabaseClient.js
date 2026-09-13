import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// This client uses the public ANON key and is used only to listen
// for Realtime change events so the UI can refresh itself. All
// actual reads/writes of data go through the Express API, which
// uses the service-role key on the server. If Realtime env vars
// aren't set, `supabase` is null and the app simply falls back to
// no live-sync (everything still works via normal API calls).
export const supabase = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: false } }) : null;
