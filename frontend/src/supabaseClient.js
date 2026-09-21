import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://kxorhytupznfhotgneys.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4b3JoeXR1cHpuZmhvdGduZXlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2NjY0MjEsImV4cCI6MjEwMzI0MjQyMX0.LAl2rKQBC3ikfv-_StkmR0NzMuTu5OT8ohNvESVPVjo';

let supabaseInstance = null;

export function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseInstance;
}
