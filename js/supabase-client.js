// ============================================================
// Supabase クライアント設定
// セットアップ後、以下の2つの値を実際の値に置き換えてください：
//   SUPABASE_URL  → Supabase ダッシュボード > Settings > API > Project URL
//   SUPABASE_ANON_KEY → Supabase ダッシュボード > Settings > API > anon public
// ============================================================

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
