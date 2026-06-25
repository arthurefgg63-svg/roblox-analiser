from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)

# Se depois você colocar o frontend no mesmo domínio, pode até remover CORS.
# Aqui deixo restrito e simples para desenvolvimento.
CORS(app, resources={r"/api/*": {"origins": "*"}})

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
CACHE_TTL_SECONDS = 300

_cache: Dict[str, Dict[str, Any]] = {}
session = requests.Session()
session.headers.update({
    "User-Agent": "GiftHub/1.0 (+public Roblox profile lookup)"
})


def json_error(message: str, status_code: int = 400):
    return jsonify({"ok": False, "error": message}), status_code


def validate_username(username: str) -> bool:
    return bool(USERNAME_RE.fullmatch(username or ""))


def cache_get(key: str) -> Optional[Dict[str, Any]]:
    item = _cache.get(key)
    if not item:
      return None
    if time.time() - item["saved_at"] > CACHE_TTL_SECONDS:
      _cache.pop(key, None)
      return None
    return item["data"]


def cache_set(key: str, data: Dict[str, Any]) -> None:
    _cache[key] = {
        "saved_at": time.time(),
        "data": data
    }


def request_json(method: str, url: str, **kwargs) -> Any:
    kwargs.setdefault("timeout", 12)
    response = session.request(method, url, **kwargs)
    response.raise_for_status()
    return response.json()


def build_avatar_url(user_id: int) -> str:
    return (
        "https://thumbnails.roblox.com/v1/users/avatar-headshot"
        f"?userIds={user_id}&size=420x420&format=Png&isCircular=false"
    )


def get_public_profile(username: str) -> Dict[str, Any]:
    username = username.strip()

    username_lookup_url = "https://users.roblox.com/v1/usernames/users"
    lookup_payload = {"usernames": [username], "excludeBannedUsers": False}

    lookup_result = request_json("POST", username_lookup_url, json=lookup_payload)
    users = lookup_result.get("data") or []

    if not users:
        raise ValueError("Usuário não encontrado.")

    user = users[0]
    user_id = user["id"]

    details_url = f"https://users.roblox.com/v1/users/{user_id}"
    details = request_json("GET", details_url)

    avatar_url = build_avatar_url(user_id)

    profile_url = f"https://www.roblox.com/users/{user_id}/profile"

    result = {
        "ok": True,
        "user": {
            "id": user_id,
            "name": details.get("name", user.get("name", username)),
            "displayName": details.get("displayName", user.get("displayName", user.get("name", username))),
            "created": details.get("created"),
            "description": details.get("description", ""),
            "isBanned": bool(details.get("isBanned", False)),
            "robloxUrl": profile_url
        },
        "avatar": {
            "url": avatar_url
        }
    }

    return result


@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health():
    return jsonify({
        "ok": True,
        "service": "GiftHub API",
        "time": datetime.now(timezone.utc).isoformat()
    })


@app.get("/api/lookup")
def lookup():
    username = (request.args.get("username") or "").strip()

    if not validate_username(username):
        return json_error("Username inválido. Use 3 a 20 caracteres: letras, números e underline.", 400)

    cache_key = username.lower()
    cached = cache_get(cache_key)
    if cached:
        return jsonify({
            "ok": True,
            "cached": True,
            **cached
        })

    try:
        data = get_public_profile(username)
        cache_set(cache_key, data)
        return jsonify({
            "ok": True,
            "cached": False,
            **data
        })
    except requests.HTTPError as exc:
        return json_error(f"Falha ao consultar a API do Roblox: {exc}", 502)
    except requests.RequestException:
        return json_error("Erro de rede ao consultar o Roblox.", 502)
    except ValueError as exc:
        return json_error(str(exc), 404)
    except Exception:
        return json_error("Erro interno inesperado.", 500)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
