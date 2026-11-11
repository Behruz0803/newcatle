// GitHub Pages statik, API esa Supabase Edge Function'da ishlaydi.
// Lokal Node va Vercel uchun avvalgi /api/db manzili saqlanadi.
window.__NEWCASTLE_API_URL__ = window.location.hostname.endsWith("github.io")
  ? "https://rsnrmjrzuikkjafjpgnm.supabase.co/functions/v1/newcastle-api/db"
  : "/api/db";
