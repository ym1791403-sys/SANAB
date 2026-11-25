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
        if key:
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
    prompt = f"""أنت خبير واستشاري واستاذ وقاية نبات وأمراض محاصيل زراعية متخصص في تشخيص أمراض النبات في مصر والوطن العربي.
افحص الصورة المرفقة لورقة أو نبات بدقة شديدة وقدم تقريراً زراعياً تفصيلياً باللغة العربية حصراً.
نوع المحصول المقترح: {req.cropHint or "غير محدد (تعرف عليه بدقة من الصورة)"}
ملاحظات المزارع: {req.notes or "لا توجد"}

شروط التشخيص الصارمة:
1. إذا لم تكن الصورة لنبات واضح أو ورقة أو فرع أو ثمرة أو كانت ضبابية تماماً: حدد "isPlantLeaf": false واكتب توضيحاً لطيفاً في "symptoms".
2. إذا كان النبات سليماً ولا تظهر عليه أي إصابة فطرية أو بكتيرية أو فيروسية أو حشرية أو نقص عناصر: حدد "isHealthy": true واشرح للمزارع أن محصوله سليم وبحالة جيدة.
3. اكتب كل شيء باللغة العربية الفصحى الزراعية الدقيقة للمزارع والمهندس الزراعي:
   - في العلاج الكيميائي (chemTreatment): اذكر أسماء المبيدات المعتمدة والموصى بها مع المواد الفعالة (مثل: أزوكسي ستروبين، دايفينوكونازول، مانكوزيب، أوكسي كلوريد النحاس، ميفينوكسام، إيميداكلوبريد... إلخ) ومعدلات الرش الدقيقة لكل 100 لتر ماء وفترة الأمان قبل الحصاد (PHI).
   - في العلاج الحيوي (bioTreatment): اذكر الحلول البيولوجية الآمنة مثل بكتيريا باسيلس سبتيليس، زيت النيم 1%، الكبريت الميكروني، وشاي الكومبوست.
   - في الوقاية (prevention): قدم إرشادات دقيقة لتنظيم الري والتهوية والتسميد المتوازن لتفادي تكرار الإصابة.
   - في الأمراض المشابهة (differential): اذكر 1-2 مرضاً أو سبباً قد يتشابه في الأعراض لتجنب الخلط في التشخيص.

أخرج النتيجة بصيغة JSON حصراً بهذا المخطط:
{{
  "isPlantLeaf": true,
  "isHealthy": false,
  "cropName": "اسم المحصول بالعربية",
  "diseaseName": "اسم المرض أو الآفة بالعربية",
  "diseaseNameEn": "الاسم العلمي والإنجليزي للمرض",
  "matchAssessment": "نسبة الدقة والتطابق التقديري (مثال: تطابق دقيق ومؤكد بنسبة 95%)",
  "severity": "low",
  "severityText": "منخفضة أو متوسطة أو شديدة الخطورة",
  "symptoms": "وصف دقيق للأعراض المرئية وموضع الإصابة على الورقة أو النبات",
  "bioTreatment": ["خطوة 1", "خطوة 2"],
  "chemTreatment": ["مبيد معتمد 1 مع المادة الفعالة والجرعة", "مبيد معتمد 2"],
  "prevention": ["إرشاد وقائي 1", "إرشاد وقائي 2"],
  "differential": ["مرض مشابه 1", "مرض مشابه 2"]
}}"""

    import requests
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": gemini_key
    }
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": req.mimeType or "image/jpeg",
                            "data": req.imageBase64
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.15,
            "responseMimeType": "application/json"
        }
    }

    preferred_model = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")
    candidate_models = [preferred_model, "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash"]
    unique_models = []
    for m in candidate_models:
        if m not in unique_models:
            unique_models.append(m)

    last_err = None
    for model_name in unique_models:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
            res = requests.post(url, headers=headers, json=payload, timeout=45)
            if res.ok:
                j = res.json()
                raw_text = j.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                parsed = json.loads(raw_text)
                parsed["aiProvider"] = f"Gemini Vision ({model_name})"
                return parsed
            else:
                last_err = RuntimeError(f"Model {model_name} returned {res.status_code}: {res.text[:200]}")
        except Exception as e:
            last_err = e
            continue

    raise HTTPException(status_code=500, detail=f"Vision analysis failed: {last_err}")


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
