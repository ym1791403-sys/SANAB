// Real Vision AI Service — Zero mocked/fake results!
// Supports:
// 1. Local/Hosted Python FastAPI Backend (/api/diagnose)
// 2. Direct Google Gemini Vision REST API (user's Gemini API key)
// 3. Custom Vision Endpoint (PyTorch / FastAPI / Firebase Function)

import { loadAIConfig } from "./firebase-config.js";

export async function compressImage(file, maxSide = 1024, quality = 0.84) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image format"));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);

        // Smaller thumbnail for Firestore document preview if Firebase Storage is inactive
        const tScale = Math.min(1, 360 / Math.max(img.width, img.height));
        const tw = Math.max(1, Math.round(img.width * tScale));
        const th = Math.max(1, Math.round(img.height * tScale));
        const tCanvas = document.createElement("canvas");
        tCanvas.width = tw;
        tCanvas.height = th;
        tCanvas.getContext("2d").drawImage(img, 0, 0, tw, th);
        const thumbDataUrl = tCanvas.toDataURL("image/jpeg", 0.72);

        resolve({
          dataUrl,
          base64: dataUrl.split(",")[1],
          mimeType: "image/jpeg",
          thumbDataUrl
        });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function buildDiagnosisPrompt(cropHint, notes, lang = "ar") {
  const outputLang = lang === "ar" ? "Arabic" : "English";
  return `You are an expert plant pathologist and agricultural extension engineer.
Analyze the uploaded image carefully and honestly.
User crop hint: ${cropHint || "Not specified"}
User notes: ${notes || "None"}
Target response language for descriptive fields: ${outputLang}

CRITICAL HONESTY RULES:
1. If the image is NOT a plant, crop, stem, fruit, or leaf (or is completely blurry/unreadable), set "isPlantLeaf": false and explain politely in "symptoms".
2. If the plant appears healthy with no clear disease or nutrient symptoms, set "isHealthy": true and explain clearly rather than inventing a disease.
3. Never exaggerate certainty. Use realistic preliminary confidence ("matchAssessment") and always include 1-2 visually similar differential possibilities in "differential" when applicable so the farmer avoids misapplying pesticides.
4. Return strictly valid JSON matching this schema:
{
  "isPlantLeaf": true,
  "isHealthy": false,
  "cropName": "string",
  "diseaseName": "string (primary target language)",
  "diseaseNameEn": "string (English scientific/common name)",
  "matchAssessment": "string (e.g. تشخيص مبدئي - تطابق متوسط (حوالي 72%) or Preliminary - Moderate match)",
  "severity": "low" | "medium" | "high",
  "severityText": "string",
  "symptoms": "string (concise description of observed visual symptoms in the photo)",
  "bioTreatment": ["string", "string"],
  "chemTreatment": ["string", "string"],
  "prevention": ["string", "string"],
  "differential": ["string (similar lookalike disease/deficiency to rule out)"]
}`;
}

export async function checkBackendHealth() {
  try {
    const res = await fetch("/api/health", { method: "GET" });
    if (!res.ok) return { available: false };
    return await res.json();
  } catch (_) {
    return { available: false };
  }
}

export async function analyzePlantImage({ base64, mimeType, cropHint, notes, lang = "ar" }) {
  const aiConfig = loadAIConfig();

  // 1. Custom ML / External Endpoint if selected
  if (aiConfig.provider === "custom" && aiConfig.customEndpoint) {
    const res = await fetch(aiConfig.customEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mimeType, cropHint, notes, lang })
    });
    if (!res.ok) {
      throw new Error(`Custom AI endpoint returned HTTP ${res.status}`);
    }
    const data = await res.json();
    return { ...data, aiProvider: "Custom Vision Endpoint" };
  }

  // 2. Direct Gemini API Key if configured in client settings
  if (aiConfig.geminiApiKey) {
    const model = aiConfig.geminiModel || "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(aiConfig.geminiApiKey)}`;
    const body = {
      contents: [
        {
          parts: [
            { text: buildDiagnosisPrompt(cropHint, notes, lang) },
            { inline_data: { mime_type: mimeType || "image/jpeg", data: base64 } }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json?.error?.message || `Gemini API error (${res.status})`);
    }
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(text);
    return { ...parsed, aiProvider: `Gemini (${model})` };
  }

  // 3. Backend FastAPI proxy (/api/diagnose)
  const backendRes = await fetch("/api/diagnose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType, cropHint, notes, lang })
  });
  const backendData = await backendRes.json().catch(() => ({}));
  if (!backendRes.ok) {
    const code = backendData?.code || "";
    if (code === "AI_KEY_MISSING") {
      throw new Error("AI_NOT_CONFIGURED");
    }
    throw new Error(backendData?.detail || `Backend AI error (${backendRes.status})`);
  }
  return backendData;
}
