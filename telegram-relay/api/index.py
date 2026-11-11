"""Vercel serverless webhook: boshqaruv botidan shaxsiy akkaunt orqali relay."""

from __future__ import annotations

import asyncio
import hmac
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from telethon import TelegramClient
from telethon.sessions import StringSession

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
app = FastAPI(title="Telegram Relay", docs_url=None, redoc_url=None)


@dataclass(frozen=True)
class Settings:
    api_id: int
    api_hash: str
    bot_token: str
    telegram_session: str
    webhook_secret: str
    targets: tuple[str, ...]
    send_delay: float

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            api_id=int(os.getenv("API_ID", "0") or 0),
            api_hash=os.getenv("API_HASH", "").strip(),
            bot_token=os.getenv("BOT_TOKEN", "").strip(),
            telegram_session=os.getenv("TELEGRAM_SESSION", "").strip(),
            webhook_secret=os.getenv("WEBHOOK_SECRET", "").strip(),
            targets=tuple(
                item.strip()
                for item in os.getenv("TARGET_BOTS", "").split(",")
                if item.strip()
            ),
            send_delay=max(0.0, float(os.getenv("SEND_DELAY", "1") or 1)),
        )

    @property
    def configured(self) -> bool:
        return all(
            (
                self.api_id > 0,
                self.api_hash,
                self.bot_token,
                self.telegram_session,
                self.webhook_secret,
                self.targets,
            )
        )


async def notify(bot_token: str, chat_id: int, text: str) -> None:
    """Boshqaruv botiga qisqa holat xabarini qaytaradi."""
    async with httpx.AsyncClient(timeout=15) as http:
        response = await http.post(
            f"https://api.telegram.org/bot{bot_token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
        )
        response.raise_for_status()


async def relay_text(
    account: TelegramClient,
    targets: Sequence[str],
    text: str,
    pause: float,
) -> tuple[list[str], dict[str, str]]:
    sent: list[str] = []
    failed: dict[str, str] = {}
    for index, target in enumerate(targets):
        try:
            await account.send_message(target, text)
            sent.append(target)
        except Exception as exc:
            failed[target] = f"{type(exc).__name__}: {exc}"
        if pause and index < len(targets) - 1:
            await asyncio.sleep(pause)
    return sent, failed


async def safe_notify(settings: Settings, chat_id: int, text: str) -> None:
    try:
        await notify(settings.bot_token, chat_id, text)
    except Exception as exc:
        print(f"Boshqaruv botiga javob yuborish xatosi: {type(exc).__name__}")


async def process_update(settings: Settings, update: dict[str, Any]) -> dict[str, Any] | None:
    message = update.get("message")
    if not isinstance(message, dict):
        return
    chat = message.get("chat") or {}
    sender = message.get("from") or {}
    chat_id = chat.get("id")
    sender_id = sender.get("id")
    if not isinstance(chat_id, int) or not isinstance(sender_id, int):
        return

    account = TelegramClient(
        StringSession(settings.telegram_session), settings.api_id, settings.api_hash
    )
    try:
        await account.connect()
        if not await account.is_user_authorized():
            if chat.get("type") == "private":
                await safe_notify(settings, chat_id, "Server sessiyasi yaroqsiz. Qayta sozlash kerak.")
            return
        me = await account.get_me()
        if me is None or getattr(me, "bot", False):
            await safe_notify(settings, chat_id, "TELEGRAM_SESSION shaxsiy akkauntga tegishli emas.")
            return

        # Faqat shaxsiy akkaunt egasining boshqaruv botiga yozgan xabari qabul qilinadi.
        if chat.get("type") != "private" or sender_id != me.id:
            return

        text = message.get("text")
        if text == "/start":
            await safe_notify(
                settings,
                chat_id,
                f"Server tayyor. Matn yozing — {len(settings.targets)} ta botga yuboraman.",
            )
            return
        if not isinstance(text, str) or not text.strip():
            await safe_notify(settings, chat_id, "Hozircha faqat matnli xabar yuborish mumkin.")
            return

        sent, failed = await relay_text(
            account, settings.targets, text, settings.send_delay
        )
        report = [f"Yuborildi: {len(sent)}/{len(settings.targets)} ta botga."]
        if failed:
            report.append("Xato bo‘lganlar: " + ", ".join(failed))
            for target, error in failed.items():
                print(f"Relay xatosi {target}: {error}")
        await safe_notify(settings, chat_id, "\n".join(report))
        return {"ok": True, "sent": len(sent), "failed": list(failed)}
    except Exception as exc:
        print(f"Webhook qayta ishlash xatosi: {type(exc).__name__}: {exc}")
        if chat.get("type") == "private":
            await safe_notify(settings, chat_id, "Serverda xato yuz berdi. Vercel loglarini tekshiring.")
    finally:
        await account.disconnect()


@app.get("/")
@app.get("/api")
@app.get("/api/index")
@app.get("/api/health")
async def health() -> dict[str, Any]:
    try:
        configured = Settings.from_env().configured
    except (TypeError, ValueError):
        configured = False
    return {"ok": True, "service": "telegram-relay", "version": 2, "configured": configured}


@app.post("/api")
@app.post("/api/index")
@app.post("/api/relay")
async def webhook(request: Request) -> dict[str, Any]:
    try:
        settings = Settings.from_env()
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Server sozlamalari xato.") from exc
    if not settings.configured:
        raise HTTPException(status_code=503, detail="Server hali sozlanmagan.")

    supplied_secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if not hmac.compare_digest(supplied_secret, settings.webhook_secret):
        raise HTTPException(status_code=403, detail="Ruxsat yo‘q.")

    update = await request.json()
    if not isinstance(update, dict):
        return {"ok": True}
    result = await process_update(settings, update)
    return {"ok": True, "result": result}
