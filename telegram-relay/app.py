"""Telegram boshqaruv botidan shaxsiy akkaunt orqali botlarga matn yuborish."""

from __future__ import annotations

import asyncio
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from dotenv import load_dotenv
from telethon import TelegramClient, events

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / ".data"


@dataclass(frozen=True)
class Config:
    api_id: int
    api_hash: str
    bot_token: str
    targets: tuple[str, ...]
    send_delay: float = 1.0


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f".env faylida {name} to‘ldirilmagan.")
    return value


def parse_targets(raw: str) -> tuple[str, ...]:
    """Vergul bilan ajratilgan bot username’larini tozalaydi va takrorini oladi."""
    targets: list[str] = []
    seen: set[str] = set()

    for item in raw.split(","):
        username = item.strip().lstrip("@")
        if not username:
            continue
        if not re.fullmatch(r"[A-Za-z0-9_]+", username):
            raise RuntimeError(f"Noto‘g‘ri bot username: {item.strip()}")
        key = username.lower()
        if key not in seen:
            seen.add(key)
            targets.append(f"@{username}")

    if not targets:
        raise RuntimeError("TARGET_BOTS ichiga kamida bitta bot username kiriting.")
    return tuple(targets)


def load_config() -> Config:
    load_dotenv(BASE_DIR / ".env")
    try:
        api_id = int(required_env("API_ID"))
    except ValueError as exc:
        raise RuntimeError("API_ID faqat raqamlardan iborat bo‘lishi kerak.") from exc

    try:
        send_delay = float(os.getenv("SEND_DELAY", "1"))
    except ValueError as exc:
        raise RuntimeError("SEND_DELAY raqam bo‘lishi kerak.") from exc
    if send_delay < 0:
        raise RuntimeError("SEND_DELAY manfiy bo‘lishi mumkin emas.")

    return Config(
        api_id=api_id,
        api_hash=required_env("API_HASH"),
        bot_token=required_env("BOT_TOKEN"),
        targets=parse_targets(required_env("TARGET_BOTS")),
        send_delay=send_delay,
    )


async def relay_text(
    account: TelegramClient,
    targets: Sequence[str],
    text: str,
    pause: float = 0,
) -> tuple[list[str], dict[str, str]]:
    """Matnni barcha botlarga yuboradi; bitta xato qolganlarini to‘xtatmaydi."""
    sent: list[str] = []
    failed: dict[str, str] = {}

    for index, target in enumerate(targets):
        try:
            await account.send_message(target, text)
            sent.append(target)
        except Exception as exc:  # Har bir bot uchun xatoni alohida qayd etamiz.
            failed[target] = f"{type(exc).__name__}: {exc}"
        if pause and index < len(targets) - 1:
            await asyncio.sleep(pause)

    return sent, failed


async def main() -> None:
    config = load_config()
    DATA_DIR.mkdir(exist_ok=True)

    account = TelegramClient(str(DATA_DIR / "account"), config.api_id, config.api_hash)
    controller = TelegramClient(
        str(DATA_DIR / "controller"), config.api_id, config.api_hash
    )
    relay_lock = asyncio.Lock()

    # Birinchi ishga tushirishda telefon, Telegram kodi va kerak bo‘lsa 2FA parol
    # faqat shu terminalda so‘raladi. Ular dastur kodi yoki .env ga yozilmaydi.
    await account.start()
    me = await account.get_me()
    if me is None or getattr(me, "bot", False):
        raise RuntimeError("Shaxsiy Telegram akkaunti bilan kirish amalga oshmadi.")

    await controller.start(bot_token=config.bot_token)
    controller_me = await controller.get_me()
    controller_name = getattr(controller_me, "username", "noma’lum")

    @controller.on(events.NewMessage(incoming=True))
    async def on_controller_message(event: events.NewMessage.Event) -> None:
        # Boshqaruv botidan faqat shaxsiy akkaunt egasi foydalana oladi.
        if not event.is_private or event.sender_id != me.id:
            return

        text = event.raw_text or ""
        if text.strip() == "/start":
            await event.respond(
                "Matn yozing. Men uni sizning akkauntingizdan "
                f"{len(config.targets)} ta botga yuboraman."
            )
            return
        if not text.strip():
            await event.respond("Hozircha faqat matnli xabar yuborish mumkin.")
            return

        async with relay_lock:
            sent, failed = await relay_text(
                account, config.targets, text, config.send_delay
            )

        report = [f"Yuborildi: {len(sent)}/{len(config.targets)} ta botga."]
        if failed:
            report.append("Xato bo‘lganlar: " + ", ".join(failed))
            for target, error in failed.items():
                print(f"[XATO] {target}: {error}")
        await event.respond("\n".join(report))

    print(f"Boshqaruv boti: @{controller_name}")
    print(f"Shaxsiy akkaunt ID: {me.id}")
    print(f"Oluvchi botlar: {', '.join(config.targets)}")
    print("Dastur ishlamoqda. To‘xtatish uchun Ctrl+C bosing.")

    await asyncio.gather(
        account.run_until_disconnected(),
        controller.run_until_disconnected(),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nDastur to‘xtatildi.")
