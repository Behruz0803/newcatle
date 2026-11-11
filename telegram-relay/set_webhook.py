"""Boshqaruv botining webhook manzilini Vercel’ga yo‘naltirish."""

import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

bot_token = os.environ["BOT_TOKEN"].strip()
base_url = os.environ["VERCEL_URL"].strip().rstrip("/")
secret = os.environ["WEBHOOK_SECRET"].strip()
if not base_url.startswith("https://"):
    raise RuntimeError("VERCEL_URL https:// bilan boshlanishi kerak.")
if len(secret) < 32:
    raise RuntimeError("WEBHOOK_SECRET kamida 32 ta belgidan iborat bo‘lsin.")

response = httpx.post(
    f"https://api.telegram.org/bot{bot_token}/setWebhook",
    json={
        "url": f"{base_url}/api/index",
        "secret_token": secret,
        "allowed_updates": ["message"],
        "drop_pending_updates": True,
    },
    timeout=30,
)
response.raise_for_status()
result = response.json()
if not result.get("ok"):
    raise RuntimeError(result.get("description", "Telegram webhook o‘rnatmadi."))
print(f"Webhook o‘rnatildi: {base_url}/api/index")
print("Endi kompyuterdagi app.py dasturini ishlatish shart emas.")
