import os
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from api.index import app


ENV = {
    "API_ID": "12345",
    "API_HASH": "test-api-hash",
    "BOT_TOKEN": "test-bot-token",
    "TELEGRAM_SESSION": "test-session",
    "WEBHOOK_SECRET": "a" * 32,
    "TARGET_BOTS": "@first_bot,@second_bot",
    "SEND_DELAY": "0",
}


class ServerTests(unittest.TestCase):
    def test_health_does_not_expose_secrets(self):
        with patch.dict(os.environ, ENV, clear=True):
            response = TestClient(app).get("/api/health")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["configured"])
        self.assertNotIn("test-bot-token", response.text)
        self.assertNotIn("test-session", response.text)

    def test_webhook_requires_secret_header(self):
        with patch.dict(os.environ, ENV, clear=True):
            response = TestClient(app).post("/api/relay", json={})
        self.assertEqual(response.status_code, 403)

    @patch("api.index.process_update", new_callable=AsyncMock)
    def test_valid_webhook_is_processed(self, process):
        process.return_value = {"ok": True, "sent": 2, "failed": []}
        with patch.dict(os.environ, ENV, clear=True):
            response = TestClient(app).post(
                "/api/relay",
                json={"update_id": 1, "message": {"text": "Salom"}},
                headers={"X-Telegram-Bot-Api-Secret-Token": ENV["WEBHOOK_SECRET"]},
            )
        self.assertEqual(response.status_code, 200)
        process.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
