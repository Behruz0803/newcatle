"""Vercel uchun maxfiy TELEGRAM_SESSION qiymatini bir marta yaratish."""

import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.sessions import StringSession

BASE_DIR = Path(__file__).resolve().parent


async def main():
    load_dotenv(BASE_DIR / ".env")
    api_id = int(os.environ["API_ID"])
    api_hash = os.environ["API_HASH"]
    client = TelegramClient(StringSession(), api_id, api_hash)
    try:
        await client.start(
            phone=lambda: input("Shaxsiy Telegram telefon raqamingiz (+998...): ")
        )
        me = await client.get_me()
        if me is None or getattr(me, "bot", False):
            raise RuntimeError("Bot tokeni emas, shaxsiy akkaunt telefon raqamini kiriting.")
        session = client.session.save()
        output = BASE_DIR / ".server-session.txt"
        output.write_text(session, encoding="utf-8")
        print(f" Tayyor: {output}")
        print("Bu fayldagi qiymatni Vercel’da TELEGRAM_SESSION ga joylang.")
        print("Fayl akkauntga to‘liq kirish huquqi beradi — uni hech kimga yubormang.")
    finally:
        await client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
