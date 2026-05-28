// ============================================================
// supabase-config.js - Supabase Client Initialization
// ============================================================

const appConfig = window.APP_CONFIG || {};
const SUPABASE_URL = appConfig.supabaseUrl;
const SUPABASE_KEY = appConfig.supabaseAnonKey;

if (!window.supabase) {
  console.error("Supabase CDN not loaded. Please ensure the CDN script is included before this script.");
} else if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Supabase config missing. Generate js/app-config.js from your .env before opening the app.");
} else {
  window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}
