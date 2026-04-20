import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Singleton for client components
export const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

// Factory for server routes — creates a fresh instance per call
export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey)
}
