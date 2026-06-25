from __future__ import annotations

import re
import time
from typing import Any, Dict, Optional

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

USERNAME_RE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
CACHE_TTL_SECONDS = 300

session = requests.Session()
session.headers.update({"User-Agent": "GiftHub/1.0"})

_cache: Dict[str, Dict[str, Any]] = {}


def is_valid_username(username: str) -> bool:
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
    _cache[key] = {"saved_at": time.time(), "data": data}


def request_json(method: str, url: str, **kwargs) -> Any:
    kwargs.setdefault("timeout", 12)
    response = session.request(method, url, **kwargs)
    response.raise_for_status()
    return response.json()


@app.after_request
def security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "service": "GiftHub API"})


@app.get("/api/lookup")
def lookup():
    username = (request.args.get("username") or "").strip()

    if not is_valid_username(username):
        return jsonify({"ok": False, "error": "Username inválido."}), 400

    cached = cache_get(username.lower())
    if cached:
        return jsonify({"ok": True, "cached": True, **cached})

    try:
        lookup_data = request_json(
            "POST",
            "https://users.roblox.com/v1/usernames/users",
            json={"usernames": [username], "excludeBannedUsers": False},
        )

        users = lookup_data.get("data") or []
        if not users:
            return jsonify({"ok": False, "error": "Usuário não encontrado."}), 404

        user_id = users[0]["id"]
        details = request_json("GET", f"https://users.roblox.com/v1/users/{user_id}")

        data = {
            "user": {
                "id": details.get("id", user_id),
                "name": details.get("name", username),
                "displayName": details.get("displayName", username),
                "created": details.get("created", ""),
                "description": details.get("description", ""),
                "isBanned": bool(details.get("isBanned", False)),
                "robloxUrl": f"https://www.roblox.com/users/{user_id}/profile",
            },
            "avatar": {
                "url": f"https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds={user_id}&size=420x420&format=Png&isCircular=false"
            },
        }

        cache_set(username.lower(), data)
        return jsonify({"ok": True, "cached": False, **data})

    except requests.RequestException:
        return jsonify({"ok": False, "error": "Erro ao consultar o Roblox."}), 502


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
