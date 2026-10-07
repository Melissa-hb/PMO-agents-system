import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseUrl } from './runtimeUrls';

const supabaseUrl = resolveSupabaseUrl();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
