CREATE TABLE IF NOT EXISTS public.app_state (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_state FROM anon, authenticated;
-- Siyosat qasddan qo'shilmaydi: brauzer jadvalga kira olmaydi.
-- Faqat Vercel serveridagi secret/service_role kaliti yozishi va o'qiydi.
