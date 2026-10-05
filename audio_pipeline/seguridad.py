"""
Configuración y verificación de acceso del backend de PsiEstudio
=================================================================
Lee audio_pipeline/.env (sin dependencias externas) y valida el token que
manda la web y el celular en el header X-PSI-Token.
"""

import hmac
import os
from pathlib import Path
from typing import List

ENV_FILE = Path(__file__).resolve().parent / ".env"
TOKEN_HEADER = "X-PSI-Token"
PUBLIC_PATHS = {"/api/health"}


def load_env_file(path: Path = ENV_FILE) -> None:
    """Carga pares CLAVE=valor en os.environ. No pisa variables ya definidas."""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def get_api_token() -> str:
    """Devuelve el token configurado. Si falta, el servidor no debe arrancar."""
    token = os.environ.get("PSI_API_TOKEN", "").strip()
    if len(token) < 24:
        raise RuntimeError(
            "PSI_API_TOKEN no está configurado (o es demasiado corto). "
            "Completá audio_pipeline/.env antes de iniciar el servidor."
        )
    return token


def get_allowed_origins() -> List[str]:
    raw = os.environ.get("ALLOWED_ORIGINS", "")
    return [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]


def token_is_valid(received: str, expected: str) -> bool:
    """Comparación en tiempo constante para no filtrar el token por tiempos de respuesta."""
    if not received:
        return False
    return hmac.compare_digest(received.encode("utf-8"), expected.encode("utf-8"))


def requires_token(path: str, method: str) -> bool:
    """Todo /api/ requiere token, salvo el health check y las llamadas preflight del navegador."""
    if method == "OPTIONS":
        return False
    if path in PUBLIC_PATHS:
        return False
    return path.startswith("/api/")
