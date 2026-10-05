"""
Pruebas de seguridad.py. Ejecutar desde audio_pipeline/:
    python -m unittest discover -s tests -v
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import seguridad  # noqa: E402


class EnvFileTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.env_path = Path(self._tmp.name) / ".env"
        self._saved = dict(os.environ)

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self._saved)
        self._tmp.cleanup()

    def test_loads_values_and_ignores_comments(self):
        self.env_path.write_text("# comentario\nPSI_TEST_A=uno\n\nPSI_TEST_B='dos'\n", encoding="utf-8")
        os.environ.pop("PSI_TEST_A", None)
        os.environ.pop("PSI_TEST_B", None)
        seguridad.load_env_file(self.env_path)
        self.assertEqual(os.environ["PSI_TEST_A"], "uno")
        self.assertEqual(os.environ["PSI_TEST_B"], "dos")

    def test_does_not_override_existing_variable(self):
        self.env_path.write_text("PSI_TEST_C=nuevo\n", encoding="utf-8")
        os.environ["PSI_TEST_C"] = "original"
        seguridad.load_env_file(self.env_path)
        self.assertEqual(os.environ["PSI_TEST_C"], "original")


class TokenTests(unittest.TestCase):
    def setUp(self):
        self._saved = dict(os.environ)

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self._saved)

    def test_missing_or_short_token_refuses_to_start(self):
        for value in [None, "", "corto"]:
            with self.subTest(value=value):
                if value is None:
                    os.environ.pop("PSI_API_TOKEN", None)
                else:
                    os.environ["PSI_API_TOKEN"] = value
                with self.assertRaises(RuntimeError):
                    seguridad.get_api_token()

    def test_valid_token_is_returned(self):
        os.environ["PSI_API_TOKEN"] = "x" * 32
        self.assertEqual(seguridad.get_api_token(), "x" * 32)

    def test_token_comparison(self):
        expected = "a" * 32
        self.assertTrue(seguridad.token_is_valid("a" * 32, expected))
        self.assertFalse(seguridad.token_is_valid("b" * 32, expected))
        self.assertFalse(seguridad.token_is_valid("", expected))
        self.assertFalse(seguridad.token_is_valid("a" * 31, expected))

    def test_which_paths_need_token(self):
        self.assertTrue(seguridad.requires_token("/api/sessions/create", "POST"))
        self.assertTrue(seguridad.requires_token("/api/sessions", "GET"))
        self.assertFalse(seguridad.requires_token("/api/health", "GET"))
        self.assertFalse(seguridad.requires_token("/api/sessions/create", "OPTIONS"))
        self.assertFalse(seguridad.requires_token("/index.html", "GET"))

    def test_origins_parsing(self):
        os.environ["ALLOWED_ORIGINS"] = "http://localhost:3000/, https://x.netlify.app ,"
        self.assertEqual(
            seguridad.get_allowed_origins(),
            ["http://localhost:3000", "https://x.netlify.app"],
        )


if __name__ == "__main__":
    unittest.main()
