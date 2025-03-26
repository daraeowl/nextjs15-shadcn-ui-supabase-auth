import { createClient } from '@supabase/supabase-js';

// The standard Supabase client that should be used on both client and server
// for operations that don't require admin privileges
export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
); 