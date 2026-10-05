"""
Pruebas de safe_paths. Ejecutar desde audio_pipeline/:
    python -m unittest discover -s tests -v
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from safe_paths import (  # noqa: E402
    UnsafePathError,
    resolve_inside,
    sanitize_filename,
    validate_filename,
    validate_session_id,
)


class SessionIdTests(unittest.TestCase):
    def test_accepts_normal_ids(self):
        for sid in ["web_1759680000000", "session_ab12cd34ef", "clase-3_A"]:
            self.assertEqual(validate_session_id(sid), sid)

    def test_rejects_traversal_and_separators(self):
        bad = ["..", ".", "..\\..", "..\\..\\victim", "../etc", "a/b", "a\\b",
               "con espacio", "", "x" * 65, "nul\x00byte", "C:evil", None, 42]
        for sid in bad:
            with self.subTest(sid=sid):
                with self.assertRaises(UnsafePathError):
                    validate_session_id(sid)


class FilenameTests(unittest.TestCase):
    def test_validate_rejects_paths_and_dots(self):
        for name in ["..", ".", "../x.m4a", "..\\x.m4a", "sub/x.m4a", "", "a" * 129]:
            with self.subTest(name=name):
                with self.assertRaises(UnsafePathError):
                    validate_filename(name)

    def test_sanitize_strips_directories(self):
        self.assertEqual(sanitize_filename("..\\..\\evil.m4a", "fb.caf"), "evil.m4a")
        self.assertEqual(sanitize_filename("../../../etc/passwd", "fb.caf"), "passwd")
        self.assertEqual(sanitize_filename("C:\\Users\\x\\clase.caf", "fb.caf"), "clase.caf")

    def test_sanitize_keeps_normal_names_and_fixes_spaces(self):
        self.assertEqual(sanitize_filename("clase_1_123.m4a", "fb.caf"), "clase_1_123.m4a")
        # espacio -> "_", "ñ" -> "_", "ú" -> "_"
        self.assertEqual(sanitize_filename("Mi clase ñandú.m4a", "fb.caf"), "Mi_clase__and_.m4a")

    def test_sanitize_falls_back_when_empty_or_dots(self):
        for raw in [None, "", "..", ".", "...", "/", "\\"]:
            with self.subTest(raw=raw):
                self.assertEqual(sanitize_filename(raw, "fb.caf"), "fb.caf")


class ResolveInsideTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        root = Path(self._tmp.name)
        self.base = root / "uploaded_sessions"
        self.base.mkdir()
        (root / "victim").mkdir()
        (root / "victim" / "secreto.txt").write_text("intacto", encoding="utf-8")

    def tearDown(self):
        self._tmp.cleanup()

    def test_inside_is_allowed(self):
        p = resolve_inside(self.base, "session_ok")
        self.assertEqual(p.parent, self.base.resolve())

    def test_escape_is_blocked(self):
        with self.assertRaises(UnsafePathError):
            resolve_inside(self.base, "..", "victim")
        with self.assertRaises(UnsafePathError):
            resolve_inside(self.base, "..\\victim")

    def test_base_itself_is_not_a_session(self):
        # ".." apunta a la carpeta padre: tiene que quedar fuera
        with self.assertRaises(UnsafePathError):
            resolve_inside(self.base, "..")


if __name__ == "__main__":
    unittest.main()
