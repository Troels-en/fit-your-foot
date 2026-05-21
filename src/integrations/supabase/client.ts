import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Fallback-Werte für Builds wo .env.production nicht ausgelesen wird (z.B. Lovable-CDN
// mit aggressiver HTML-Cache). Anon-Key + Project-URL sind public-by-design — RLS
// und Edge Functions sind die Security-Schicht, nicht der Key.
const FALLBACK_URL = 'https://fanqhmtzalewwfppwupz.supabase.co';
const FALLBACK_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbnFobXR6YWxld3dmcHB3dXB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzA0MjksImV4cCI6MjA5MjYwNjQyOX0.cwnrlZtJ1YjpH_whlusBXHlO3b-O1KTK_5Vnzri3pDs';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL;
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_PUBLISHABLE_KEY;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});