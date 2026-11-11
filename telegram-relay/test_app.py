import unittest

from app import parse_targets, relay_text


class FakeAccount:
    def __init__(self, fail_for=None):
        self.fail_for = fail_for or set()
        self.calls = []

    async def send_message(self, target, text):
        self.calls.append((target, text))
        if target in self.fail_for:
            raise RuntimeError("Sinov xatosi")


class ParseTargetsTests(unittest.TestCase):
    def test_normalizes_and_deduplicates_usernames(self):
        self.assertEqual(
            parse_targets("first_bot, @Second_Bot, FIRST_BOT"),
            ("@first_bot", "@Second_Bot"),
        )

    def test_rejects_empty_list(self):
        with self.assertRaises(RuntimeError):
            parse_targets(" , ")


class RelayTests(unittest.IsolatedAsyncioTestCase):
    async def test_sends_same_text_to_all_targets(self):
        account = FakeAccount()
        sent, failed = await relay_text(
            account, ("@first_bot", "@second_bot"), "Assalomu alaykum"
        )

        self.assertEqual(sent, ["@first_bot", "@second_bot"])
        self.assertEqual(failed, {})
        self.assertEqual(
            account.calls,
            [
                ("@first_bot", "Assalomu alaykum"),
                ("@second_bot", "Assalomu alaykum"),
            ],
        )

    async def test_continues_after_one_bot_fails(self):
        account = FakeAccount(fail_for={"@second_bot"})
        sent, failed = await relay_text(
            account,
            ("@first_bot", "@second_bot", "@third_bot"),
            "Salom",
        )

        self.assertEqual(sent, ["@first_bot", "@third_bot"])
        self.assertIn("@second_bot", failed)
        self.assertEqual(len(account.calls), 3)


if __name__ == "__main__":
    unittest.main()
