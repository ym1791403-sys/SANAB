"""
SANAB — FastAPI Backend & Static Host
Serves the responsive web application and provides a real Vision AI endpoint
using google-genai (Gemini Vision) or a custom ML endpoint configured via .env.
Zero fake/mocked diagnosis responses.
"""

import base64
import json
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="SANAB Web API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class DiagnoseRequest(BaseModel):
    imageBase64: str
    mimeType: str = "image/jpeg"
    cropHint: Optional[str] = ""
    notes: Optional[str] = ""
    lang: str = "ar"


@app.get("/api/health")
def health():
    has_gemini = bool(os.environ.get("GEMINI_API_KEY", "").strip())
    custom_url = os.environ.get("CUSTOM_VISION_URL", "").strip()
    fb_file = BASE_DIR / "firebase-web-config.json"
    return {
        "available": True,
        "aiConfigured": has_gemini or bool(custom_url),
        "aiProvider": "custom" if custom_url else ("gemini" if has_gemini else "none"),
        "hasFirebaseJson": fb_file.exists() or bool(os.environ.get("FIREBASE_CONFIG_JSON", "").strip()),
    }


@app.get("/api/public-config")
def public_config():
    fb_file = BASE_DIR / "firebase-web-config.json"
    if fb_file.exists():
        try:
            return {"firebaseConfig": json.loads(fb_file.read_text(encoding="utf-8"))}
        except Exception:
            pass
    raw = os.environ.get("FIREBASE_CONFIG_JSON", "").strip()
    if raw:
        try:
            return {"firebaseConfig": json.loads(raw)}
        except Exception:
            pass
    return {"firebaseConfig": None}


GOV_COORDS = {
    "cairo": (30.0444, 31.2357),
    "giza": (30.0131, 31.2089),
    "alexandria": (31.2001, 29.9187),
    "dakahlia": (31.0409, 31.3785),
    "sharkia": (30.5877, 31.5020),
    "beheira": (31.0341, 30.4682),
    "gharbia": (30.7865, 31.0004),
    "menoufia": (30.5526, 31.0090),
    "kafr-el-sheikh": (31.1107, 30.9388),
    "fayoum": (29.3084, 30.8428),
    "minya": (28.1099, 30.7503),
    "assiut": (27.1809, 31.1837),
    "qena": (26.1551, 32.7160),
    "ismailia": (30.5965, 32.2715),
}


@app.get("/api/weather")
def get_weather(gov: str = "cairo", lat: Optional[float] = None, lon: Optional[float] = None):
    import requests
    if lat is None or lon is None:
        coords = GOV_COORDS.get(gov.lower(), (30.0444, 31.2357))
        lat, lon = coords
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto"
        res = requests.get(url, timeout=6)
        if res.ok:
            data = res.json().get("current", {})
            return {
                "temp": round(data.get("temperature_2m", 24)),
                "humidity": round(data.get("relative_humidity_2m", 42)),
                "windSpeed": round(data.get("wind_speed_10m", 12)),
                "precipitation": float(data.get("precipitation", 0.0)),
                "weatherCode": int(data.get("weather_code", 0)),
                "observedAt": data.get("time", "")
            }
    except Exception:
        pass
    return {
        "temp": 24,
        "humidity": 42,
        "windSpeed": 12,
        "precipitation": 0.0,
        "weatherCode": 0,
        "observedAt": ""
    }


@app.post("/api/diagnose")
def diagnose(req: DiagnoseRequest):
    custom_url = os.environ.get("CUSTOM_VISION_URL", "").strip()
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()

    if custom_url:
        import requests
        r = requests.post(custom_url, json=req.model_dump(), timeout=45)
        if not r.ok:
            raise HTTPException(status_code=502, detail=f"Custom vision model error: {r.status_code}")
        data = r.json()
        data.setdefault("aiProvider", "Custom Vision Server")
        return data

    if not gemini_key:
        return JSONResponse(
            status_code=400,
            content={
                "code": "AI_KEY_MISSING",
                "detail": "No GEMINI_API_KEY or CUSTOM_VISION_URL configured on server."
            },
        )

    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        raise HTTPException(status_code=500, detail=f"google-genai package missing: {exc}")

    output_lang = "Arabic" if req.lang == "ar" else "English"
    prompt = f"""You are an expert plant pathologist and agricultural extension engineer.
Analyze the uploaded image carefully and honestly.
User crop hint: {req.cropHint or "Not specified"}
User notes: {req.notes or "None"}
Target response language for descriptive fields: {output_lang}

CRITICAL HONESTY RULES:
1. If the image is NOT a plant, crop, stem, fruit, or leaf (or is completely blurry/unreadable), set "isPlantLeaf": false and explain politely in "symptoms".
2. If the plant appears healthy with no clear disease or nutrient symptoms, set "isHealthy": true and explain clearly rather than inventing a disease.
3. Never exaggerate certainty. Frame confidence honestly as preliminary ("matchAssessment") and list 1-2 visually similar differential possibilities in "differential" so farmers verify before spraying.
4. Return strictly valid JSON with keys:
isPlantLeaf (bool), isHealthy (bool), cropName (string), diseaseName (string), diseaseNameEn (string),
matchAssessment (string), severity ("low"|"medium"|"high"), severityText (string), symptoms (string),
bioTreatment (list of strings), chemTreatment (list of strings), prevention (list of strings), differential (list of strings)."""

    try:
        img_bytes = base64.b64decode(req.imageBase64)
        client = genai.Client(api_key=gemini_key)
        model_name = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
        response = client.models.generate_content(
            model=model_name,
            contents=[
                types.Part.from_bytes(data=img_bytes, mime_type=req.mimeType or "image/jpeg"),
                prompt,
            ],
            config=types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json",
            ),
        )
        parsed = json.loads(response.text)
        parsed["aiProvider"] = f"Gemini Vision ({model_name})"
        return parsed
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Vision analysis failed: {exc}")


# Serve static files (css, js, assets, index.html)
app.mount("/css", StaticFiles(directory=BASE_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=BASE_DIR / "js"), name="js")
app.mount("/assets", StaticFiles(directory=BASE_DIR / "assets"), name="assets")


@app.get("/")
def index():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    target = BASE_DIR / full_path
    if target.is_file():
        return FileResponse(target)
    return FileResponse(BASE_DIR / "index.html")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run("server:app", host="127.0.0.1", port=port, reload=False)
