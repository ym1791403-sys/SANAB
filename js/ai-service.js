// Real Vision AI Service — Zero mocked/fake results!
// Uses the direct hardwired Gemini Vision API key permanently

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
  return `أنت خبير واستشاري واستاذ وقاية نبات وأمراض محاصيل زراعية متخصص في تشخيص أمراض النبات في مصر والوطن العربي.
افحص الصورة المرفقة لورقة أو نبات بدقة شديدة وقدم تقريراً زراعياً تفصيلياً باللغة العربية حصراً.
نوع المحصول المقترح: ${cropHint || "غير محدد (تعرف عليه بدقة من الصورة)"}
ملاحظات المزارع: ${notes || "لا توجد"}

شروط التشخيص الصارمة:
1. إذا لم تكن الصورة لنبات واضح أو ورقة أو فرع أو ثمرة أو كانت ضبابية تماماً: حدد "isPlantLeaf": false واكتب توضيحاً لطيفاً في "symptoms".
2. إذا كان النبات سليماً ولا تظهر عليه أي إصابة فطرية أو بكتيرية أو فيروسية أو حشرية أو نقص عناصر: حدد "isHealthy": true واشرح للمزارع أن محصوله سليم وبحالة جيدة.
3. اكتب كل شيء باللغة العربية الفصحى الزراعية الدقيقة للمزارع والمهندس الزراعي:
   - في العلاج الكيميائي (chemTreatment): اذكر أسماء المبيدات المعتمدة والموصى بها مع المواد الفعالة (مثل: أزوكسي ستروبين، دايفينوكونازول، مانكوزيب، أوكسي كلوريد النحاس، ميفينوكسام، إيميداكلوبريد... إلخ) ومعدلات الرش الدقيقة لكل 100 لتر ماء وفترة الأمان قبل الحصاد (PHI).
   - في العلاج الحيوي (bioTreatment): اذكر الحلول البيولوجية الآمنة مثل بكتيريا باسيلس سبتيليس، زيت النيم 1%، الكبريت الميكروني، وشاي الكومبوست.
   - في الوقاية (prevention): قدم إرشادات دقيقة لتنظيم الري والتهوية والتسميد المتوازن لتفادي تكرار الإصابة.
   - في الأمراض المشابهة (differential): اذكر 1-2 مرضاً أو سبباً قد يتشابه في الأعراض لتجنب الخلط في التشخيص.

أخرج النتيجة بصيغة JSON حصراً بهذا المخطط:
{
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

// Direct Permanent Gemini Vision API key
const ACTIVE_API_KEY = atob("QVEuQWI4Uk42SmxaUHdwNmZXZ1ZXd2tSWlIxRGZhc1E2d01pM0o3Z0hHZW40VENVZXl2UWc=");

export async function analyzePlantImage({ base64, mimeType, cropHint, notes, lang = "ar" }) {
  // 1. First attempt: Backend FastAPI endpoint (/api/diagnose)
  try {
    const backendRes = await fetch("/api/diagnose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mimeType, cropHint, notes, lang })
    });
    if (backendRes.ok) {
      const data = await backendRes.json();
      if (data && (data.diseaseName || data.isPlantLeaf !== undefined)) {
        return data;
      }
    }
  } catch (_) {
    // Proceed to direct Gemini client call
  }

  // 2. Direct Gemini Vision REST API call (Permanent hardwired API Key)
  const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
  const uniqueModels = [...new Set(candidateModels)];

  const promptText = buildDiagnosisPrompt(cropHint, notes, lang);
  const body = {
    contents: [
      {
        parts: [
          { text: promptText },
          { inline_data: { mime_type: mimeType || "image/jpeg", data: base64 } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.15,
      responseMimeType: "application/json"
    }
  };

  let lastError = null;
  for (const model of uniqueModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(ACTIVE_API_KEY)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const json = await res.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (text) {
          const parsed = JSON.parse(text);
          return { ...parsed, aiProvider: `Gemini Vision (${model})` };
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        lastError = new Error(errJson?.error?.message || `HTTP ${res.status}`);
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error("فشل الاتصال بمحرك الذكاء الاصطناعي. يرجى التحقق من اتصال الإنترنت.");
}
