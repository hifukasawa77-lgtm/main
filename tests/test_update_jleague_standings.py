import importlib.util
import io
import json
import tempfile
import unittest
from email.message import Message
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).parents[1] / "scripts" / "update_jleague_standings.py"
SPEC = importlib.util.spec_from_file_location("update_jleague_standings", SCRIPT)
assert SPEC and SPEC.loader
standings = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(standings)


def response(body: bytes, content_type: str = "application/json"):
    headers = Message()
    headers["Content-Type"] = content_type
    result = io.BytesIO(body)
    result.headers = headers
    return result


def valid_body(team: str = "Test FC") -> bytes:
    payload = {
        "standings": {
            "entries": [
                {
                    "team": {"displayName": team, "logos": [{"href": "badge.png"}]},
                    "stats": [{"name": "rank", "displayValue": "1"}],
                }
            ]
        }
    }
    return json.dumps(payload).encode()


class UpdateStandingsTest(unittest.TestCase):
    @mock.patch.object(standings.time, "sleep")
    @mock.patch.object(standings.urllib.request, "urlopen")
    def test_retries_non_json_then_succeeds(self, urlopen, _sleep):
        urlopen.side_effect = [
            response(b"<html>temporary error</html>", "text/html"),
            response(valid_body()),
        ]

        rows = standings.fetch_standings("jpn.1")

        self.assertEqual("Test FC", rows[0]["strTeam"])
        self.assertEqual(2, urlopen.call_count)

    @mock.patch.object(standings.time, "sleep")
    @mock.patch.object(standings.urllib.request, "urlopen")
    def test_retries_invalid_utf8_and_fails_safely(self, urlopen, _sleep):
        urlopen.side_effect = [response(b'{"bad":"\xff"}') for _ in range(3)]

        with self.assertRaisesRegex(RuntimeError, "not valid UTF-8"):
            standings.fetch_standings("jpn.2")

        self.assertEqual(3, urlopen.call_count)

    @mock.patch.object(standings.time, "sleep")
    @mock.patch.object(standings.urllib.request, "urlopen")
    def test_retries_json_containing_a_null_byte(self, urlopen, _sleep):
        urlopen.side_effect = [response(b'{"bad":"\x00"}') for _ in range(3)]

        with self.assertRaisesRegex(RuntimeError, "not valid JSON"):
            standings.fetch_standings("jpn.3")

        self.assertEqual(3, urlopen.call_count)

    @mock.patch.object(standings, "fetch_standings")
    def test_failed_league_keeps_previous_rows(self, fetch):
        fetch.side_effect = [
            [{"strTeam": "New J1"}],
            RuntimeError("bad response"),
            [{"strTeam": "New J3"}],
        ]
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "standings.json"
            output.write_text(
                json.dumps({"j1": [], "j2": [{"strTeam": "Old J2"}], "j3": []}),
                encoding="utf-8",
            )

            standings.write_standings(output)

            updated = json.loads(output.read_text(encoding="utf-8"))
            self.assertEqual("New J1", updated["j1"][0]["strTeam"])
            self.assertEqual("Old J2", updated["j2"][0]["strTeam"])
            self.assertEqual("New J3", updated["j3"][0]["strTeam"])

    @mock.patch.object(standings, "fetch_standings")
    def test_all_failures_preserve_the_entire_output(self, fetch):
        fetch.side_effect = RuntimeError("bad response")
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "standings.json"
            output.write_text("existing data", encoding="utf-8")

            with self.assertRaisesRegex(RuntimeError, "all ESPN league requests failed"):
                standings.write_standings(output)

            self.assertEqual("existing data", output.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
