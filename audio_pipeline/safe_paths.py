"""
Validación de rutas para el backend de PsiEstudio
=================================================
Todo nombre que llega desde el cliente (session_id, nombre de chunk) pasa por acá
antes de tocar el disco. Sin dependencias externas para poder testearlo aislado.

Por qué existe: en Windows la barra invertida también separa rutas, así que un
session_id como "..\\..\\algo" escapa del directorio base si solo se filtra "/".
"""

import re
from pathlib import Path
from typing import Optional

SESSION_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
FILENAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{1,128}$")


class UnsafePathError(ValueError):
    """Nombre o ruta rechazados por seguridad."""


def validate_session_id(session_id: str) -> str:
    """Devuelve el session_id si es seguro; si no, lanza UnsafePathError."""
    if not isinstance(session_id, str) or not SESSION_ID_PATTERN.fullmatch(session_id):
        raise UnsafePathError(f"session_id inválido: {session_id!r}")
    return session_id


def validate_filename(filename: str) -> str:
    """
    Acepta solo un nombre de archivo plano (sin carpetas). Rechaza "." y ".."
    y cualquier cosa que no esté en la lista permitida.
    """
    if not isinstance(filename, str) or not FILENAME_PATTERN.fullmatch(filename):
        raise UnsafePathError(f"nombre de archivo inválido: {filename!r}")
    if filename in (".", ".."):
        raise UnsafePathError(f"nombre de archivo inválido: {filename!r}")
    return filename


def sanitize_filename(raw_name: Optional[str], fallback: str) -> str:
    """
    Convierte el nombre que manda el cliente en un nombre plano seguro.
    Se toma solo el último componente (quita rutas) y se reemplazan los caracteres
    no permitidos (espacios, acentos, etc.). Nunca devuelve un nombre vacío ni "..".
    """
    base = Path(str(raw_name or "")).name.replace("\\", "/").split("/")[-1]
    cleaned = re.sub(r"[^A-Za-z0-9_.-]", "_", base)[:128].strip("._")
    if not cleaned:
        return fallback
    return cleaned


def resolve_inside(base_dir: Path, *parts: str) -> Path:
    """
    Une base_dir con partes ya validadas y verifica que la ruta final quede
    dentro de base_dir. Defensa en profundidad: aunque el validador de nombre
    falle, esta comprobación evita escribir o borrar fuera de la base.
    """
    base = Path(base_dir).resolve()
    candidate = base.joinpath(*parts).resolve()
    if candidate != base and not candidate.is_relative_to(base):
        raise UnsafePathError(f"ruta fuera del directorio permitido: {candidate}")
    return candidate
