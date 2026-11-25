import { TRANSLATIONS } from "./i18n.js";
import { GOVERNORATES, fetchLiveWeather, describeWeatherCode, computeSprayingAdvice } from "./weather-service.js";
import { CROPS, PATHOGEN_TYPES, DISEASES_DATA, QUIZ_QUESTIONS } from "./data-diseases.js";
import { speechService } from "./speech-service.js";
import { loadFirebaseConfig, saveFirebaseConfig, loadAIConfig, saveAIConfig } from "./firebase-config.js";
import { firebaseService } from "./firebase-service.js";
import { compressImage, analyzePlantImage, checkBackendHealth } from "./ai-service.js";

const state = {
  lang: localStorage.getItem("tabib_lang") || "ar",
  route: "home",
  user: null,
  profile: null,
  diagnoses: [],
  consultations: [],
  activeConsultId: null,
  diseases: [...DISEASES_DATA],
  selectedCropFilter: "all",
  selectedPathogenFilter: "all",
  libSearch: "",
  dashTab: "overview",
  uploadedImage: null, // { dataUrl, base64, mimeType, thumbDataUrl }
  currentReport: null,
  authMode: "login",
  selectedRole: "farmer",
  backendHealth: { available: false, aiConfigured: false },
  channelSettings: null
};

// ==================== UTILITIES ====================

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatFirebaseError(err) {
  const msg = err?.message || String(err);
  if (msg.includes("CONFIGURATION_NOT_FOUND") || msg.includes("auth/operation-not-allowed")) {
    return "خدمة تسجيل الدخول غير مفعلة حالياً، يرجى المحاولة لاحقاً.";
  }
  if (msg.includes("auth/user-not-found") || msg.includes("auth/wrong-password") || msg.includes("auth/invalid-credential")) {
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  }
  if (msg.includes("auth/email-already-in-use")) {
    return "هذا البريد الإلكتروني مسجل بالفعل، يمكنك تسجيل الدخول مباشرة.";
  }
  if (msg.includes("auth/weak-password")) {
    return "كلمة المرور ضعيفة، يرجى كتابة 6 أحرف أو أرقام على الأقل.";
  }
  if (msg.includes("permission-denied") || msg.includes("Missing or insufficient permissions")) {
    return "تعذر إتمام العملية بسبب قيود الصلاحيات.";
  }
  if (msg.includes("failed-precondition") || msg.includes("not-found") || msg.includes("404")) {
    return "تعذر حفظ البيانات في السجل السحابي حالياً.";
  }
  return msg;
}

function showToast(msg, type = "info") {
  const box = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast ${type === "error" ? "error" : type === "warning" ? "warning" : ""}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function t(key) {
  return TRANSLATIONS[state.lang]?.[key] || TRANSLATIONS.ar[key] || key;
}

function parseFirebaseConfigInput(rawText) {
  const txt = (rawText || "").trim();
  if (!txt) return null;

  // Try direct JSON first
  try {
    const parsed = JSON.parse(txt);
    if (parsed.apiKey && parsed.projectId) return parsed;
  } catch (_) {}

  // Safely extract standard Firebase keys from a JS snippet (const firebaseConfig = { ... })
  const keys = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId", "databaseURL", "measurementId"];
  const extracted = {};
  for (const k of keys) {
    const re = new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']+)["']`);
    const match = txt.match(re);
    if (match?.[1]) extracted[k] = match[1].trim();
  }
  if (extracted.apiKey && extracted.projectId) {
    return extracted;
  }
  return null;
}

function getSeverityBadge(sev, customText = "") {
  const map = {
    high: { cls: "sev-high", ar: "شديدة", en: "Severe" },
    medium: { cls: "sev-medium", ar: "متوسطة", en: "Moderate" },
    low: { cls: "sev-low", ar: "منخفضة", en: "Low" }
  };
  const info = map[sev] || map.medium;
  const label = customText || info[state.lang];
  return `<span class="severity-badge ${info.cls}">⚠️ ${escapeHtml(label)}</span>`;
}

function getRoleLabel(role) {
  const map = {
    farmer: t("roleFarmer") || "مزارع",
    engineer: t("roleEngineer") || "مهندس زراعي",
    nursery: t("roleNursery") || "صاحب مشتل",
    admin: "مسؤول النظام"
  };
  return map[role] || role;
}

// ==================== I18N & ROUTING ====================

function applyLanguage() {
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === "ar" ? "rtl" : "ltr";
  document.getElementById("lang-label").textContent = state.lang === "ar" ? "EN" : "عربي";

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (TRANSLATIONS[state.lang][key]) {
      el.textContent = TRANSLATIONS[state.lang][key];
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (TRANSLATIONS[state.lang][key]) {
      el.placeholder = TRANSLATIONS[state.lang][key];
    }
  });

  populateGovernorateSelects();
  renderAllActive();
}

function navigateTo(route) {
  const protectedRoutes = ["diagnosis", "consultations", "dashboard"];
  if (protectedRoutes.includes(route) && !state.user) {
    state.intendedRoute = route;
    route = "auth";
  }

  if (route === "dashboard") {
    const isAdmin = Boolean(
      state.profile?.accountType === "admin" ||
      state.profile?.role === "admin" ||
      state.user?.email?.toLowerCase().includes("admin")
    );
    if (!isAdmin) {
      route = "home";
    }
  }
  if (route === "auth") {
    const submitBtn = document.getElementById("btn-auth-submit");
    if (submitBtn) submitBtn.disabled = false;
  }
  state.route = route;
  window.location.hash = route;
  document.querySelectorAll(".app-view").forEach(v => v.classList.add("hidden"));
  const target = document.getElementById(`view-${route}`);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".nav-link").forEach(a => {
    a.classList.toggle("active", a.getAttribute("data-route") === route);
  });

  document.getElementById("main-nav")?.classList.remove("open");
  speechService.stop();
  renderCurrentRoute();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCurrentRoute() {
  if (state.route === "home") renderHomeRecent();
  if (state.route === "library") renderLibrary();
  if (state.route === "consultations") renderConsultationsView();
  if (state.route === "dashboard") renderDashboard();
}

function renderAllActive() {
  updateConnectionUI();
  renderCurrentRoute();
  if (state.currentReport) renderDiagnosisReport(state.currentReport);
}

// ==================== WEATHER ====================

function populateGovernorateSelects() {
  const selects = [
    document.getElementById("select-governorate"),
    document.getElementById("auth-governorate"),
    document.getElementById("landing-select-gov")
  ];
  for (const sel of selects) {
    if (!sel) continue;
    const prev = sel.value || state.profile?.governorate || localStorage.getItem("tabib_gov") || "cairo";
    sel.innerHTML = GOVERNORATES.map(g =>
      `<option value="${g.id}">${escapeHtml(g[state.lang])}</option>`
    ).join("");
    sel.value = GOVERNORATES.some(g => g.id === prev) ? prev : "cairo";
  }
}

async function loadWeatherForGov(govId) {
  const gov = GOVERNORATES.find(g => g.id === govId) || GOVERNORATES[0];
  localStorage.setItem("tabib_gov", gov.id);
  await loadWeatherCoords(gov.lat, gov.lon, gov[state.lang]);
}

async function loadWeatherCoords(lat, lon, label = "") {
  const tempEl = document.getElementById("weather-temp");
  const descEl = document.getElementById("weather-desc");
  const iconEl = document.getElementById("weather-icon");
  const windEl = document.getElementById("weather-wind");
  const humEl = document.getElementById("weather-humidity");
  const rainEl = document.getElementById("weather-rain");
  const advEl = document.getElementById("weather-advice-text");

  const landingTemp = document.getElementById("landing-weather-temp");
  const landingDesc = document.getElementById("landing-weather-desc");
  const landingIcon = document.getElementById("landing-weather-icon");
  const landingWind = document.getElementById("landing-weather-wind");
  const landingHum = document.getElementById("landing-weather-hum");
  const landingRain = document.getElementById("landing-weather-rain");
  const landingAdv = document.getElementById("landing-advice-text");

  try {
    const w = await fetchLiveWeather(lat, lon);
    const info = describeWeatherCode(w.weatherCode, state.lang);
    const advice = computeSprayingAdvice(w, state.lang);

    if (tempEl) tempEl.textContent = `${w.temp}° ${state.lang === "ar" ? "م" : "C"}`;
    if (descEl) descEl.textContent = `${info.text}${label ? ` • ${label}` : ""}`;
    if (iconEl) iconEl.textContent = info.icon;
    if (windEl) windEl.textContent = `${w.windSpeed} ${state.lang === "ar" ? "كم/س" : "km/h"}`;
    if (humEl) humEl.textContent = `${w.humidity}%`;
    if (rainEl) rainEl.textContent = `${w.precipitation} ${state.lang === "ar" ? "مم" : "mm"}`;
    if (advEl) advEl.textContent = advice;

    if (landingTemp) landingTemp.textContent = `${w.temp}° ${state.lang === "ar" ? "م" : "C"}`;
    if (landingDesc) landingDesc.textContent = `${info.text}${label ? ` • ${label}` : ""}`;
    if (landingIcon) landingIcon.textContent = info.icon;
    if (landingWind) landingWind.textContent = `${w.windSpeed} ${state.lang === "ar" ? "كم/س" : "km/h"}`;
    if (landingHum) landingHum.textContent = `${w.humidity}%`;
    if (landingRain) landingRain.textContent = `${w.precipitation} ${state.lang === "ar" ? "مم" : "mm"}`;
    if (landingAdv) landingAdv.textContent = advice;
  } catch (err) {
    if (descEl && !descEl.textContent) {
      descEl.textContent = state.lang === "ar" ? "طقس معتدل • القاهرة" : "Moderate Weather • Cairo";
    }
  }
}

// ==================== CONNECTION & ADMIN VISIBILITY ====================

function updateConnectionUI() {
  const isLogged = Boolean(state.user);
  const isAdmin = Boolean(
    state.profile?.accountType === "admin" ||
    state.profile?.role === "admin" ||
    state.user?.email?.toLowerCase().includes("admin")
  );

  // Toggle protected navigation links (Image 3 fix!)
  document.querySelectorAll(".user-only").forEach(el => {
    if (el.id === "nav-dashboard-link") {
      el.classList.toggle("hidden", !(isLogged && isAdmin));
    } else {
      el.classList.toggle("hidden", !isLogged);
    }
  });

  // Toggle landing vs web-app workspace (Introductory Landing vs Active Web App)
  const landingSec = document.getElementById("home-landing-section");
  const appSec = document.getElementById("home-app-section");
  if (landingSec) landingSec.classList.toggle("hidden", isLogged);
  if (appSec) appSec.classList.toggle("hidden", !isLogged);

  // Welcome greeting
  const greetingEl = document.getElementById("app-user-greeting");
  if (greetingEl && isLogged) {
    const name = state.profile?.name || (state.user?.email ? state.user.email.split("@")[0] : "المزارع");
    greetingEl.textContent = `مرحباً بك، ${name} 🌾`;
  }

  // Top Auth Action Button
  const authBtn = document.getElementById("btn-nav-auth");
  if (authBtn) {
    if (isLogged) {
      authBtn.textContent = state.profile?.name ? `👤 ${state.profile.name.split(" ")[0]}` : (isAdmin ? "لوحة الإدارة" : t("accountBtn"));
      authBtn.setAttribute("data-route", isAdmin ? "dashboard" : "home");
      authBtn.className = "btn btn-sm btn-ghost";
    } else {
      authBtn.textContent = "تسجيل الدخول / حساب جديد";
      authBtn.setAttribute("data-route", "auth");
      authBtn.className = "btn btn-sm btn-primary";
    }
  }

  // Navbar Logout Button
  const navLogoutBtn = document.getElementById("btn-nav-logout");
  if (navLogoutBtn) {
    navLogoutBtn.classList.toggle("hidden", !isLogged);
  }
}

// ==================== HOME RECENT DIAGNOSES ====================

function renderHomeRecent() {
  const container = document.getElementById("home-recent-list");
  if (!state.diagnoses.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:36px 16px;background:var(--bg-light);border-radius:16px;border:1.5px dashed var(--border-light);">
        <div style="font-size:2.2rem;margin-bottom:8px;">🌿</div>
        <p style="margin:0 0 6px;font-weight:800;color:var(--text-dark);font-size:1.05rem;">لا توجد فحوصات سابقة محفوظة بعد</p>
        <p style="margin:0 0 16px;font-size:0.88rem;color:var(--text-muted);max-width:400px;margin-inline:auto;">التقط صورة لورقة محصولك وسيتولى الذكاء الاصطناعي تشخيص الإصابة وتحديد العلاج وحفظ الفحص في حسابك.</p>
        <button class="btn btn-primary" data-route="diagnosis" style="margin-inline:auto;display:inline-flex;"><span>📸 افحص محصولك الآن</span></button>
      </div>
    `;
    return;
  }

  const latest = state.diagnoses.slice(0, 4);
  container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">
    ${latest.map(d => `
      <div style="border:1px solid var(--border-light);border-radius:14px;padding:14px;display:flex;gap:12px;align-items:center;cursor:pointer;" data-open-saved="${escapeHtml(d.id)}">
        ${d.imageUrl ? `<img src="${escapeHtml(d.imageUrl)}" alt="" style="width:58px;height:58px;border-radius:12px;object-fit:cover;flex-shrink:0;" />` : `<div style="width:58px;height:58px;border-radius:12px;background:var(--green-100);display:grid;place-items:center;font-size:1.5rem;flex-shrink:0;">🌿</div>`}
        <div style="min-width:0;flex:1;">
          <div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(d.cropName || "")} - ${escapeHtml(d.diseaseName)}</div>
          <div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px;">${escapeHtml(d.matchAssessment || "")}</div>
          <div style="margin-top:6px;">${getSeverityBadge(d.severity, d.severityText)}</div>
        </div>
      </div>
    `).join("")}
  </div>`;

  container.querySelectorAll("[data-open-saved]").forEach(el => {
    el.addEventListener("click", () => {
      const found = state.diagnoses.find(x => x.id === el.getAttribute("data-open-saved"));
      if (found) {
        state.currentReport = found;
        navigateTo("diagnosis");
        renderDiagnosisReport(found);
      }
    });
  });
}

// ==================== AI PLANT DIAGNOSIS ====================

async function handleImageSelected(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast(state.lang === "ar" ? "يرجى اختيار ملف صورة صالح" : "Please choose a valid image file", "error");
    return;
  }
  try {
    const compressed = await compressImage(file);
    state.uploadedImage = compressed;
    document.getElementById("leaf-preview-img").src = compressed.dataUrl;
    document.getElementById("preview-container").classList.remove("hidden");
    document.getElementById("btn-analyze-leaf").disabled = false;
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function runPlantAnalysis() {
  if (!state.uploadedImage) return;
  const btn = document.getElementById("btn-analyze-leaf");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> <span>${escapeHtml(t("analyzingBtn"))}</span>`;

  try {
    const cropHint = document.getElementById("diag-crop-select").value;
    const notes = document.getElementById("diag-notes").value;
    const report = await analyzePlantImage({
      base64: state.uploadedImage.base64,
      mimeType: state.uploadedImage.mimeType,
      cropHint,
      notes,
      lang: state.lang
    });
    state.currentReport = {
      ...report,
      imageUrl: state.uploadedImage.thumbDataUrl
    };
    renderDiagnosisReport(state.currentReport);
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `🔍 <span>${escapeHtml(t("analyzeBtn"))}</span>`;
  }
}

function renderDiagnosisReport(report) {
  document.getElementById("diag-empty-state").classList.add("hidden");
  const out = document.getElementById("diag-report-output");
  out.classList.remove("hidden");

  if (report.isPlantLeaf === false) {
    out.innerHTML = `
      <div class="report-hero">
        <div class="disclaimer-box">
          <span>⚠️</span>
          <div>
            <strong>${state.lang === "ar" ? "الصورة لا تبدو كورقة نبات واضحة" : "Image does not appear to be a clear plant leaf"}</strong>
            <p style="margin-top:6px;">${escapeHtml(report.symptoms || "")}</p>
          </div>
        </div>
      </div>`;
    return;
  }

  const bioList = (report.bioTreatment || []).map(item => `<li><span>✅</span><span>${escapeHtml(item)}</span></li>`).join("");
  const chemList = (report.chemTreatment || []).map(item => `<li><span>🧪</span><span>${escapeHtml(item)}</span></li>`).join("");
  const prevList = (report.prevention || []).map(item => `<li><span>🛡️</span><span>${escapeHtml(item)}</span></li>`).join("");
  const diffList = (report.differential || []).map(item => `<li><span>🔎</span><span>${escapeHtml(item)}</span></li>`).join("");

  out.innerHTML = `
    <div class="report-hero">
      <div class="report-hero-top">
        <div>
          <span class="tag" style="margin-bottom:8px;display:inline-block;">${escapeHtml(t("prelimBadge"))}</span>
          <div style="font-size:0.9rem;color:var(--text-muted);font-weight:700;">${escapeHtml(report.cropName || "")}</div>
          <h2 style="font-weight:900;font-size:1.35rem;">${escapeHtml(report.diseaseName || "")} ${report.diseaseNameEn ? `<span style="font-size:0.95rem;color:var(--text-muted);">(${escapeHtml(report.diseaseNameEn)})</span>` : ""}</h2>
          <div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">المحرك: ${escapeHtml(report.aiProvider || "Vision AI")}</div>
        </div>
        <button id="btn-speak-report" class="btn btn-speak">
          🔊 <span>${escapeHtml(t("listenBtn"))}</span>
        </button>
      </div>

      <div class="report-stats-row">
        <div class="report-stat-box">
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">${escapeHtml(t("confidenceLabel"))}</div>
          <strong style="color:var(--green-800);font-size:0.95rem;">${escapeHtml(report.matchAssessment || t("prelimBadge"))}</strong>
        </div>
        <div class="report-stat-box">
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px;">${escapeHtml(t("severityLabel"))}</div>
          ${getSeverityBadge(report.severity, report.severityText)}
        </div>
      </div>
    </div>

    <div class="report-section-card">
      <div class="report-section-title" style="color:var(--info-text);">👁️ ${escapeHtml(t("symptomsTitle"))}</div>
      <p style="color:var(--text-secondary);">${escapeHtml(report.symptoms || "")}</p>
    </div>

    ${diffList ? `
      <div class="report-section-card">
        <div class="report-section-title" style="color:#6d4c00;">🔎 ${escapeHtml(t("differentialTitle"))}</div>
        <ul class="report-list">${diffList}</ul>
      </div>` : ""}

    ${bioList ? `
      <div class="report-section-card">
        <div class="report-section-title" style="color:var(--green-700);">🌱 ${escapeHtml(t("bioTreatTitle"))}</div>
        <ul class="report-list">${bioList}</ul>
      </div>` : ""}

    ${chemList ? `
      <div class="report-section-card">
        <div class="report-section-title" style="color:var(--warning-text);">🧪 ${escapeHtml(t("chemTreatTitle"))}</div>
        <ul class="report-list">${chemList}</ul>
      </div>` : ""}

    ${prevList ? `
      <div class="report-section-card">
        <div class="report-section-title" style="color:var(--green-800);">🛡️ ${escapeHtml(t("preventionTitle"))}</div>
        <ul class="report-list">${prevList}</ul>
      </div>` : ""}

    <div class="disclaimer-box">
      <span>⚠️</span>
      <span>${escapeHtml(t("disclaimerText"))}</span>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <button id="btn-save-report" class="btn btn-primary">💾 ${escapeHtml(t("saveReportBtn"))}</button>
      <button id="btn-share-wa" class="btn btn-whatsapp">💬 ${escapeHtml(t("shareWaBtn"))}</button>
      <button id="btn-share-tg" class="btn btn-telegram">✈️ ${escapeHtml(t("shareTgBtn"))}</button>
      <button id="btn-escalate-eng" class="btn btn-secondary">🎧 ${escapeHtml(t("consultEngBtn"))}</button>
    </div>
  `;

  // Bind Speak ("اسمع التشخيص")
  const speakBtn = document.getElementById("btn-speak-report");
  speakBtn.addEventListener("click", () => {
    if (speechService.isSpeaking) {
      speechService.stop();
      return;
    }
    const text = speechService.formatReportSpeech(report, state.lang);
    const ok = speechService.speak(text, state.lang);
    if (!ok) {
      showToast(state.lang === "ar" ? "المتصفح الحالي لا يدعم القراءة الصوتية" : "Speech synthesis is not supported in this browser", "warning");
    }
  });
  speechService.onStateChange = (speaking) => {
    const b = document.getElementById("btn-speak-report");
    if (!b) return;
    b.classList.toggle("speaking", speaking);
    b.innerHTML = speaking ? `⏹️ <span>${escapeHtml(t("stopListenBtn"))}</span>` : `🔊 <span>${escapeHtml(t("listenBtn"))}</span>`;
  };

  // Save to Firestore
  document.getElementById("btn-save-report").addEventListener("click", async () => {
    if (!state.user) {
      showToast("سجّل الدخول أولاً لحفظ التقرير في حسابك", "warning");
      navigateTo("auth");
      return;
    }
    try {
      const saved = await firebaseService.saveDiagnosis(state.user.uid, report, state.uploadedImage?.thumbDataUrl || "");
      state.diagnoses.unshift(saved);
      showToast(state.lang === "ar" ? "تم حفظ نتيجة الفحص بنجاح 🌾" : "Diagnosis saved successfully 🌾", "success");
    } catch (err) {
      showToast(formatFirebaseError(err), "error");
    }
  });

  // WhatsApp & Telegram real share
  const shareSummary = `🌿 SANAB - ${t("prelimBadge")}\nالمحصول: ${report.cropName}\nالحالة المحتملة: ${report.diseaseName}\nالخطورة: ${report.severityText}\nالأعراض: ${report.symptoms}\nالعلاج الحيوي: ${(report.bioTreatment || []).join(" / ")}`;
  document.getElementById("btn-share-wa").addEventListener("click", () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareSummary)}`, "_blank", "noopener");
  });
  document.getElementById("btn-share-tg").addEventListener("click", () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(shareSummary)}`, "_blank", "noopener");
  });

  // Escalate to Agricultural Engineer
  document.getElementById("btn-escalate-eng").addEventListener("click", () => {
    openNewConsultModal({
      crop: report.cropName || "",
      subject: `مراجعة تشخيص: ${report.diseaseName || ""}`,
      details: `أرجو مراجعة هذا التشخيص المبدئي (${report.matchAssessment || ""}):\nالأعراض: ${report.symptoms || ""}`
    });
  });
}

// ==================== DISEASE LIBRARY ====================

function renderLibrary() {
  const filterList = document.getElementById("crop-filter-list");
  filterList.innerHTML = CROPS.map(c => `
    <button class="filter-btn ${state.selectedCropFilter === c.id ? "active" : ""}" data-crop-id="${c.id}">
      <span>${escapeHtml(c[state.lang])}</span>
    </button>
  `).join("");

  filterList.querySelectorAll("[data-crop-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.selectedCropFilter = btn.getAttribute("data-crop-id");
      renderLibrary();
    });
  });

  const q = state.libSearch.trim().toLowerCase();
  const pathogen = state.selectedPathogenFilter;
  const favs = state.profile?.favorites || [];

  const filtered = state.diseases.filter(d => {
    const matchCrop = state.selectedCropFilter === "all" || d.crop === state.selectedCropFilter || (d.crops || []).includes(state.selectedCropFilter);
    const matchPathogen = pathogen === "all" || d.pathogenType === pathogen;
    const text = `${d.nameAr} ${d.nameEn} ${d.scientificName} ${d.cropAr} ${d.cropEn} ${d.symptomsAr} ${d.symptomsEn}`.toLowerCase();
    const matchSearch = !q || text.includes(q);
    return matchCrop && matchPathogen && matchSearch;
  });

  const grid = document.getElementById("disease-grid");
  if (!filtered.length) {
    grid.innerHTML = `<div class="card" style="grid-column:1/-1;text-align:center;padding:36px;">لا توجد نتائج مطابقة لبحثك.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(d => {
    const isFav = favs.includes(d.id);
    const pLabel = PATHOGEN_TYPES[d.pathogenType]?.[state.lang] || d.pathogenType;
    return `
      <article class="disease-card">
        <div class="disease-thumb">
          <img src="${escapeHtml(d.image)}" alt="${escapeHtml(state.lang === "ar" ? d.nameAr : d.nameEn)}" loading="lazy" />
        </div>
        <div class="disease-card-body">
          <div>
            <div class="tag-row" style="margin-bottom:8px;">
              <span class="tag">${escapeHtml(state.lang === "ar" ? d.cropAr : d.cropEn)}</span>
              <span class="tag" style="background:var(--bg-page);color:var(--text-secondary);">${escapeHtml(pLabel)}</span>
            </div>
            <h3 style="font-weight:800;font-size:1.05rem;margin-bottom:4px;">${escapeHtml(state.lang === "ar" ? d.nameAr : d.nameEn)}</h3>
            <p class="section-subtitle" style="font-size:0.84rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              ${escapeHtml(state.lang === "ar" ? d.symptomsAr : d.symptomsEn)}
            </p>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <button class="btn btn-sm btn-secondary" data-open-disease="${escapeHtml(d.id)}" style="flex:1;">${escapeHtml(t("learnMore"))}</button>
            <button class="icon-btn" data-fav-disease="${escapeHtml(d.id)}" title="المفضلة">${isFav ? "⭐" : "☆"}</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll("[data-open-disease]").forEach(btn => {
    btn.addEventListener("click", () => {
      const d = state.diseases.find(x => x.id === btn.getAttribute("data-open-disease"));
      if (d) openDiseaseModal(d);
    });
  });

  grid.querySelectorAll("[data-fav-disease]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-fav-disease");
      if (!state.user || !firebaseService.isReady) {
        showToast("سجّل الدخول أولاً لحفظ هذا المرض في المفضلة", "warning");
        return;
      }
      const currentlyFav = (state.profile?.favorites || []).includes(id);
      await firebaseService.toggleFavorite(state.user.uid, id, currentlyFav);
      state.profile.favorites = currentlyFav
        ? state.profile.favorites.filter(x => x !== id)
        : [...(state.profile.favorites || []), id];
      renderLibrary();
    });
  });
}

function openDiseaseModal(d) {
  const modal = document.getElementById("modal-disease");
  const body = document.getElementById("modal-disease-body");
  const ar = state.lang === "ar";
  const bio = ar ? d.bioTreatmentAr : d.bioTreatmentEn;
  const chem = ar ? d.chemTreatmentAr : d.chemTreatmentEn;
  const prev = ar ? d.preventionAr : d.preventionEn;

  body.innerHTML = `
    <div style="display:flex;gap:16px;align-items:center;margin-bottom:16px;flex-wrap:wrap;">
      <img src="${escapeHtml(d.image)}" alt="" style="width:110px;height:110px;border-radius:16px;object-fit:cover;" />
      <div style="flex:1;">
        <div class="tag-row" style="margin-bottom:6px;">
          <span class="tag">${escapeHtml(ar ? d.cropAr : d.cropEn)}</span>
          ${getSeverityBadge(d.severity, ar ? d.severityAr : d.severityEn)}
        </div>
        <h2 style="font-weight:900;">${escapeHtml(ar ? d.nameAr : d.nameEn)}</h2>
        <div style="font-size:0.86rem;color:var(--text-muted);font-style:italic;">${escapeHtml(d.scientificName)}</div>
      </div>
    </div>

    <div style="margin-bottom:14px;">
      <button id="btn-modal-listen" class="btn btn-sm btn-speak">🔊 ${escapeHtml(t("listenBtn"))}</button>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px;">
      <div class="card" style="padding:14px;">
        <strong style="color:var(--info-text);">👁️ ${escapeHtml(t("symptomsTitle"))}</strong>
        <p style="margin-top:6px;color:var(--text-secondary);">${escapeHtml(ar ? d.symptomsAr : d.symptomsEn)}</p>
      </div>
      <div class="card" style="padding:14px;">
        <strong style="color:var(--green-700);">🌱 ${escapeHtml(t("bioTreatTitle"))}</strong>
        <ul class="report-list" style="margin-top:8px;">${bio.map(x => `<li>✅ <span>${escapeHtml(x)}</span></li>`).join("")}</ul>
      </div>
      <div class="card" style="padding:14px;">
        <strong style="color:var(--warning-text);">🧪 ${escapeHtml(t("chemTreatTitle"))}</strong>
        <ul class="report-list" style="margin-top:8px;">${chem.map(x => `<li>🧪 <span>${escapeHtml(x)}</span></li>`).join("")}</ul>
      </div>
      <div class="card" style="padding:14px;">
        <strong style="color:var(--green-800);">🛡️ ${escapeHtml(t("preventionTitle"))}</strong>
        <ul class="report-list" style="margin-top:8px;">${prev.map(x => `<li>🛡️ <span>${escapeHtml(x)}</span></li>`).join("")}</ul>
      </div>
      <div class="disclaimer-box">
        <span>🔎</span>
        <span><strong>التفريق عن المتشابهات:</strong> ${escapeHtml(ar ? d.lookalikeNoteAr : d.lookalikeNoteEn)}</span>
      </div>
    </div>
  `;

  document.getElementById("btn-modal-listen").addEventListener("click", () => {
    if (speechService.isSpeaking) {
      speechService.stop();
      return;
    }
    const text = speechService.formatReportSpeech({
      cropName: ar ? d.cropAr : d.cropEn,
      diseaseName: ar ? d.nameAr : d.nameEn,
      severityText: ar ? d.severityAr : d.severityEn,
      symptoms: ar ? d.symptomsAr : d.symptomsEn,
      bioTreatment: bio,
      chemTreatment: chem,
      prevention: prev
    }, state.lang);
    speechService.speak(text, state.lang);
  });

  modal.classList.remove("hidden");
}

// ==================== CONSULTATIONS ====================

function renderConsultationsView() {
  const guard = document.getElementById("consult-auth-guard");
  const ws = document.getElementById("consult-workspace");

  const waLink = document.getElementById("link-wa-channel");
  const tgLink = document.getElementById("link-tg-channel");
  if (state.channelSettings?.whatsappNumber) {
    waLink.href = `https://wa.me/${state.channelSettings.whatsappNumber.replace(/\D/g, "")}`;
    waLink.classList.remove("hidden");
  }
  if (state.channelSettings?.telegramBotUrl) {
    tgLink.href = state.channelSettings.telegramBotUrl;
    tgLink.classList.remove("hidden");
  }

  if (!state.user || !firebaseService.isReady) {
    guard.classList.remove("hidden");
    ws.classList.add("hidden");
    return;
  }

  guard.classList.add("hidden");
  ws.classList.remove("hidden");

  const isEng = state.profile?.accountType === "engineer";
  document.getElementById("consult-list-title").textContent = isEng ? "صندوق استشارات المزارعين (مهندس زراعي)" : "استشاراتي";
  loadAndRenderEngineers();

  const listEl = document.getElementById("consult-list");
  if (!state.consultations.length) {
    listEl.innerHTML = `<p class="section-subtitle">لا توجد استشارات مفتوحة بعد.</p>`;
  } else {
    listEl.innerHTML = state.consultations.map(c => {
      const unread = isEng ? c.unreadForEngineer : c.unreadForFarmer;
      return `
        <button class="filter-btn ${state.activeConsultId === c.id ? "active" : ""}" data-consult-id="${escapeHtml(c.id)}" style="flex-direction:column;align-items:flex-start;gap:4px;">
          <div style="display:flex;justify-content:space-between;width:100%;align-items:center;">
            <strong>${escapeHtml(c.subject)}</strong>
            ${unread ? `<span class="tag" style="background:#fdecec;color:#c62828;">جديد</span>` : ""}
          </div>
          <span style="font-size:0.78rem;opacity:0.85;">${escapeHtml(c.crop)} • ${escapeHtml(c.farmerName || "")}</span>
        </button>
      `;
    }).join("");

    listEl.querySelectorAll("[data-consult-id]").forEach(btn => {
      btn.addEventListener("click", () => {
        openConsultationThread(btn.getAttribute("data-consult-id"));
      });
    });
  }
}

function openConsultationThread(consultId) {
  state.activeConsultId = consultId;
  const c = state.consultations.find(x => x.id === consultId);
  if (!c) return;

  document.getElementById("consult-thread-empty").classList.add("hidden");
  document.getElementById("consult-thread-active").classList.remove("hidden");
  document.getElementById("thread-subject").textContent = c.subject;
  document.getElementById("thread-meta").textContent = `${c.crop} • ${c.farmerName || ""}`;
  document.getElementById("thread-status-badge").textContent = c.status === "answered" ? "تم الرد" : "قيد المراجعة";

  firebaseService.markConsultationRead(consultId, state.profile?.accountType || "farmer");
  firebaseService.subscribeMessages(consultId, (msgs) => {
    const box = document.getElementById("thread-messages");
    box.innerHTML = msgs.map(m => {
      const mine = m.senderId === state.user?.uid;
      return `
        <div class="chat-bubble ${mine ? "mine" : "theirs"}">
          <div style="font-size:0.74rem;opacity:0.8;margin-bottom:2px;">${escapeHtml(m.senderName)} (${m.senderRole === "engineer" ? "مهندس زراعي" : "مزارع"})</div>
          <div>${escapeHtml(m.text)}</div>
        </div>
      `;
    }).join("");
    box.scrollTop = box.scrollHeight;
  });

  renderConsultationsView();
}

function getGovName(govId) {
  const g = GOVERNORATES.find(x => x.id === govId);
  return g ? g[state.lang] : (govId || (state.lang === "ar" ? "مصر" : "Egypt"));
}

async function loadAndRenderEngineers() {
  const grid = document.getElementById("engineers-list-grid");
  const countBadge = document.getElementById("engineers-count-badge");
  const selectEl = document.getElementById("consult-engineer-select");
  if (!grid) return;

  try {
    const engineers = await firebaseService.getRegisteredEngineers();
    if (countBadge) countBadge.textContent = `${engineers.length} ${state.lang === "ar" ? "مهندس متاح" : "engineers"}`;

    if (selectEl) {
      const prevVal = selectEl.value;
      selectEl.innerHTML = `<option value="all">${state.lang === "ar" ? "عام (متاح لجميع المهندسين الزراعيين)" : "All Engineers"}</option>` +
        engineers.map(eng => `<option value="${escapeHtml(eng.uid || eng.email)}">م. ${escapeHtml(eng.name)} (${escapeHtml(getGovName(eng.governorate))})</option>`).join("");
      if (prevVal && engineers.some(e => (e.uid || e.email) === prevVal)) {
        selectEl.value = prevVal;
      }
    }

    if (!engineers.length) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:22px 14px;background:rgba(46,125,50,0.04);border-radius:12px;border:1px dashed var(--border);">
          <div style="font-size:1.8rem;margin-bottom:6px;">👨‍🌾</div>
          <strong style="color:var(--text-main);">لا يوجد مهندسون مسجلون حالياً</strong>
          <p class="section-subtitle" style="margin-top:4px;font-size:0.84rem;">عند قيام أي مهندس بإنشاء حساب جديد واختيار "مهندس زراعي"، سيظهر اسمه ومحافظته هنا فوراً لجميع المستخدمين.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = engineers.map(eng => `
      <div class="card" style="margin:0;padding:14px;border:1.5px solid var(--green-200);background:linear-gradient(135deg, rgba(46,125,50,0.03), rgba(27,94,32,0.07));">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--green-700);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.05rem;">
            ${escapeHtml((eng.name || "م")[0])}
          </div>
          <div style="flex:1;min-width:0;">
            <strong style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">م. ${escapeHtml(eng.name)}</strong>
            <span style="font-size:0.78rem;color:var(--text-muted);">📍 ${escapeHtml(getGovName(eng.governorate))}</span>
          </div>
          <span class="tag" style="background:#e8f5e9;color:#2e7d32;font-size:0.72rem;padding:2px 6px;">متاح</span>
        </div>
        <button type="button" class="btn btn-sm btn-outline-primary" style="width:100%;font-size:0.82rem;" data-consult-eng-id="${escapeHtml(eng.uid || eng.email)}" data-consult-eng-name="${escapeHtml(eng.name)}">
          💬 استشارة هذا المهندس
        </button>
      </div>
    `).join("");

    grid.querySelectorAll("[data-consult-eng-id]").forEach(btn => {
      btn.addEventListener("click", () => {
        const engId = btn.getAttribute("data-consult-eng-id");
        openNewConsultModal({ targetEngineerId: engId });
      });
    });
  } catch (_) {}
}

function openNewConsultModal(prefill = {}) {
  if (!state.user) {
    showToast("سجّل الدخول أولاً لفتح استشارة زراعية", "warning");
    navigateTo("auth");
    return;
  }
  document.getElementById("consult-crop").value = prefill.crop || "";
  document.getElementById("consult-subject").value = prefill.subject || "";
  document.getElementById("consult-details").value = prefill.details || "";
  if (prefill.targetEngineerId) {
    const sel = document.getElementById("consult-engineer-select");
    if (sel) sel.value = prefill.targetEngineerId;
  }
  document.getElementById("modal-new-consult").classList.remove("hidden");
}

// ==================== DASHBOARD ====================

function renderDashboard() {
  const isAdmin = Boolean(
    state.profile?.accountType === "admin" ||
    state.profile?.role === "admin" ||
    state.user?.email?.toLowerCase().includes("admin")
  );
  if (!state.user || !isAdmin) {
    navigateTo("home");
    return;
  }
  const guard = document.getElementById("dash-auth-guard");
  const main = document.getElementById("dash-main");
  guard.classList.add("hidden");
  main.classList.remove("hidden");

  document.getElementById("dash-user-name").textContent = state.profile?.name || state.user.email;
  document.getElementById("dash-user-role").textContent = getRoleLabel(state.profile?.accountType || "farmer");

  document.querySelectorAll("[data-dash-tab]").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-dash-tab") === state.dashTab);
  });

  const content = document.getElementById("dash-content");
  const totalDiag = state.diagnoses.length;
  const favCount = (state.profile?.favorites || []).length;
  const govName = GOVERNORATES.find(g => g.id === (state.profile?.governorate || "cairo"))?.[state.lang] || "القاهرة";

  if (state.dashTab === "overview") {
    content.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-val">${totalDiag}</div><div class="kpi-label">إجمالي الفحوصات</div></div>
        <div class="kpi-card"><div class="kpi-val">${escapeHtml(govName)}</div><div class="kpi-label">المحافظة / الإقليم</div></div>
        <div class="kpi-card"><div class="kpi-val">${favCount}</div><div class="kpi-label">الأمراض المفضلة</div></div>
        <div class="kpi-card"><div class="kpi-val">${state.consultations.length}</div><div class="kpi-label">الاستشارات</div></div>
      </div>

      <div class="card">
        <div class="section-header">
          <h3 style="font-weight:800;">أحدث الفحوصات المسجلة</h3>
          <button class="btn btn-sm btn-primary" data-route="diagnosis">+ فحص جديد</button>
        </div>
        ${totalDiag ? state.diagnoses.slice(0, 5).map(d => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border-light);gap:12px;flex-wrap:wrap;">
            <div>
              <strong>${escapeHtml(d.cropName || "")} — ${escapeHtml(d.diseaseName)}</strong>
              <div style="font-size:0.82rem;color:var(--text-muted);">${escapeHtml(d.matchAssessment || "")}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              ${getSeverityBadge(d.severity, d.severityText)}
              <button class="btn btn-sm btn-secondary" data-view-diag="${escapeHtml(d.id)}">عرض</button>
            </div>
          </div>
        `).join("") : `<p class="section-subtitle">لا توجد فحوصات محفوظة بعد.</p>`}
      </div>
    `;
  } else if (state.dashTab === "diagnoses") {
    content.innerHTML = `<div class="card">
      <h3 style="font-weight:800;margin-bottom:14px;">سجل فحوصاتي المحفوظة (${totalDiag})</h3>
      ${totalDiag ? state.diagnoses.map(d => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid var(--border-light);gap:12px;flex-wrap:wrap;">
          <div style="display:flex;gap:12px;align-items:center;">
            ${d.imageUrl ? `<img src="${escapeHtml(d.imageUrl)}" alt="" style="width:54px;height:54px;border-radius:10px;object-fit:cover;" />` : ""}
            <div>
              <strong>${escapeHtml(d.cropName || "")} — ${escapeHtml(d.diseaseName)}</strong>
              <div style="font-size:0.82rem;color:var(--text-muted);">${new Date(d.createdAtMs || Date.now()).toLocaleDateString("ar-EG")}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm btn-secondary" data-view-diag="${escapeHtml(d.id)}">فتح التقرير</button>
            <button class="btn btn-sm btn-ghost" style="color:var(--danger-text);" data-del-diag="${escapeHtml(d.id)}">حذف</button>
          </div>
        </div>
      `).join("") : `<p class="section-subtitle">لا توجد فحوصات محفوظة بعد.</p>`}
    </div>`;
  } else if (state.dashTab === "favorites") {
    const favDiseases = state.diseases.filter(d => (state.profile?.favorites || []).includes(d.id));
    content.innerHTML = `<div class="card">
      <h3 style="font-weight:800;margin-bottom:14px;">الأمراض المحفوظة في المفضلة (${favDiseases.length})</h3>
      ${favDiseases.length ? `<div class="disease-grid">
        ${favDiseases.map(d => `
          <div class="disease-card">
            <div class="disease-thumb"><img src="${escapeHtml(d.image)}" alt="" /></div>
            <div class="disease-card-body">
              <strong>${escapeHtml(d.nameAr)}</strong>
              <button class="btn btn-sm btn-secondary" data-open-fav-disease="${escapeHtml(d.id)}">عرض التقرير</button>
            </div>
          </div>
        `).join("")}
      </div>` : `<p class="section-subtitle">لم تضف أي أمراض إلى المفضلة بعد.</p>`}
    </div>`;
    content.querySelectorAll("[data-open-fav-disease]").forEach(btn => {
      btn.addEventListener("click", () => {
        const d = state.diseases.find(x => x.id === btn.getAttribute("data-open-fav-disease"));
        if (d) openDiseaseModal(d);
      });
    });
  } else if (state.dashTab === "settings") {
    content.innerHTML = `<div class="card">
      <h3 style="font-weight:800;margin-bottom:14px;">إعدادات الحساب والربط</h3>
      <div class="form-group">
        <label class="form-label">محافظة المزرعة الافتراضية</label>
        <select id="dash-gov-select" class="form-control">
          ${GOVERNORATES.map(g => `<option value="${g.id}" ${state.profile?.governorate === g.id ? "selected" : ""}>${escapeHtml(g.ar)}</option>`).join("")}
        </select>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
        <button id="btn-dash-save-gov" class="btn btn-primary">حفظ المحافظة</button>
      </div>
    </div>`;
    document.getElementById("btn-dash-save-gov").addEventListener("click", async () => {
      const gov = document.getElementById("dash-gov-select").value;
      if (state.user?.uid) {
        await firebaseService.updateUserProfile(state.user.uid, { governorate: gov });
      }
      if (state.profile) state.profile.governorate = gov;
      localStorage.setItem("tabib_gov", gov);
      loadWeatherForGov(gov);
      showToast("تم تحديث المحافظة بنجاح");
    });
  }

  content.querySelectorAll("[data-view-diag]").forEach(btn => {
    btn.addEventListener("click", () => {
      const found = state.diagnoses.find(d => d.id === btn.getAttribute("data-view-diag"));
      if (found) {
        state.currentReport = found;
        navigateTo("diagnosis");
        renderDiagnosisReport(found);
      }
    });
  });

  content.querySelectorAll("[data-del-diag]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del-diag");
      await firebaseService.deleteDiagnosis(id);
      state.diagnoses = state.diagnoses.filter(d => d.id !== id);
      showToast("تم حذف الفحص");
      renderDashboard();
    });
  });
}

// ==================== INITIALIZATION ====================

async function syncUserData(user, profile) {
  state.user = user;
  state.profile = profile;
  updateConnectionUI();

  if (user && firebaseService.isReady) {
    try {
      const userDiags = await firebaseService.getUserDiagnoses(user.uid);
      state.diagnoses = userDiags || [];
    } catch (_) {
      state.diagnoses = [];
    }

    if (profile?.governorate) {
      loadWeatherForGov(profile.governorate);
    }

    firebaseService.subscribeConsultations(user.uid, profile?.accountType || "farmer", (list) => {
      state.consultations = list || [];
      const isEng = profile?.accountType === "engineer" || profile?.accountType === "admin";
      const unreadCount = (list || []).filter(c => (isEng ? c.unreadForEngineer : c.unreadForFarmer)).length;
      const badge = document.getElementById("notif-badge");
      if (badge) {
        badge.textContent = String(unreadCount);
        badge.classList.toggle("hidden", unreadCount === 0);
      }
      if (state.route === "consultations") renderConsultationsView();
      if (state.route === "dashboard") renderDashboard();
    });
  } else {
    state.diagnoses = [];
    state.consultations = [];
    document.getElementById("notif-badge")?.classList.add("hidden");
  }

  renderHomeRecent();
  renderCurrentRoute();
}

async function bootstrap() {
  applyLanguage();

  // Instant live weather initialization (runs in parallel, never blocks UI)
  const savedGov = localStorage.getItem("tabib_gov") || "cairo";
  loadWeatherForGov(savedGov).catch(() => {});

  // Check backend FastAPI health & public Firebase config if present
  state.backendHealth = await checkBackendHealth().catch(() => ({ available: false }));
  if (state.backendHealth.available && state.backendHealth.hasFirebaseJson && !loadFirebaseConfig()) {
    try {
      const res = await fetch("/api/public-config");
      const data = await res.json();
      if (data?.firebaseConfig?.apiKey) {
        saveFirebaseConfig(data.firebaseConfig);
      }
    } catch (_) {}
  }

  // Init Firebase if config exists
  try {
    const fbRes = await firebaseService.init();
    if (fbRes.ready) {
      firebaseService.getDiseasesFromFirestore().then(fsDiseases => {
        if (fsDiseases?.length) state.diseases = fsDiseases;
      }).catch(() => {});
      firebaseService.getQuizFromFirestore().then(fsQuiz => {
        if (fsQuiz?.length) state.quizQuestions = fsQuiz;
      }).catch(() => {});
      firebaseService.getChannelSettings().then(cs => {
        state.channelSettings = cs;
      }).catch(() => {});
    }
  } catch (_) {}

  // Always listen to auth so persistent user sessions are loaded immediately
  firebaseService.listenAuth(syncUserData);

  updateConnectionUI();

  // Global navigation clicks
  document.addEventListener("click", (e) => {
    const routeBtn = e.target.closest("[data-route]");
    if (routeBtn) {
      e.preventDefault();
      navigateTo(routeBtn.getAttribute("data-route"));
    }
  });

  document.getElementById("btn-mobile-menu")?.addEventListener("click", () => {
    document.getElementById("main-nav")?.classList.toggle("open");
  });

  document.getElementById("btn-lang-toggle")?.addEventListener("click", () => {
    state.lang = state.lang === "ar" ? "en" : "ar";
    localStorage.setItem("tabib_lang", state.lang);
    applyLanguage();
  });

  document.getElementById("btn-notifications")?.addEventListener("click", () => {
    navigateTo("consultations");
  });

  document.getElementById("btn-nav-logout")?.addEventListener("click", async () => {
    await firebaseService.logout();
    await syncUserData(null, null);
    showToast(state.lang === "ar" ? "تم تسجيل الخروج بنجاح" : "Logged out successfully");
    navigateTo("home");
  });

  // Weather controls
  document.getElementById("select-governorate")?.addEventListener("change", (e) => {
    loadWeatherForGov(e.target.value);
  });
  document.getElementById("landing-select-gov")?.addEventListener("change", (e) => {
    loadWeatherForGov(e.target.value);
  });
  document.getElementById("btn-gps-weather")?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showToast("المتصفح لا يدعم تحديد الموقع الجغرافي", "warning");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => loadWeatherCoords(pos.coords.latitude, pos.coords.longitude, state.lang === "ar" ? "موقعك الحالي" : "Your GPS"),
      () => showToast("لم يتم السماح بالوصول للموقع الجغرافي", "warning")
    );
  });

  // Upload & Diagnosis events
  const dropzone = document.getElementById("upload-dropzone");
  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files?.[0]) handleImageSelected(e.dataTransfer.files[0]);
  });
  document.getElementById("input-leaf-file").addEventListener("change", (e) => {
    if (e.target.files?.[0]) handleImageSelected(e.target.files[0]);
  });
  document.getElementById("input-leaf-camera").addEventListener("change", (e) => {
    if (e.target.files?.[0]) handleImageSelected(e.target.files[0]);
  });
  document.getElementById("btn-clear-image").addEventListener("click", () => {
    state.uploadedImage = null;
    document.getElementById("preview-container").classList.add("hidden");
    document.getElementById("btn-analyze-leaf").disabled = true;
  });
  document.getElementById("btn-analyze-leaf").addEventListener("click", runPlantAnalysis);

  // Library filters
  document.getElementById("lib-search").addEventListener("input", (e) => {
    state.libSearch = e.target.value;
    renderLibrary();
  });
  document.getElementById("pathogen-filter").addEventListener("change", (e) => {
    state.selectedPathogenFilter = e.target.value;
    renderLibrary();
  });

  // Dashboard sidebar tabs
  document.querySelectorAll("[data-dash-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.dashTab = btn.getAttribute("data-dash-tab");
      renderDashboard();
    });
  });
  document.getElementById("btn-logout").addEventListener("click", async () => {
    await firebaseService.logout();
    await syncUserData(null, null);
    showToast("تم تسجيل الخروج");
    navigateTo("home");
  });

  // Auth view events
  const toggleAuthMode = (mode) => {
    state.authMode = mode;
    const isSignup = mode === "register";
    const titleEl = document.getElementById("auth-title");
    const subEl = document.getElementById("auth-subtitle");
    if (titleEl) titleEl.textContent = isSignup ? "إنشاء حساب جديد" : "أهلاً بك في SANAB";
    if (subEl) subEl.textContent = isSignup ? "أنشئ حسابك للبدء" : "سجّل الدخول لمتابعة مزرعتك";
    document.getElementById("register-only-fields")?.classList.toggle("hidden", !isSignup);
    document.getElementById("login-only-row")?.classList.toggle("hidden", isSignup);
    const subBtn = document.getElementById("btn-auth-submit");
    if (subBtn) {
      subBtn.textContent = isSignup ? "إنشاء الحساب" : "تسجيل الدخول";
      subBtn.disabled = false;
    }
    const swBtn = document.getElementById("btn-switch-auth-mode");
    if (swBtn) swBtn.textContent = isSignup ? "لديك حساب؟ سجّل الدخول" : "إنشاء حساب جديد";
  };

  document.getElementById("btn-switch-auth-mode")?.addEventListener("click", () => {
    toggleAuthMode(state.authMode === "login" ? "register" : "login");
  });

  document.getElementById("btn-toggle-eye")?.addEventListener("click", () => {
    const pwInput = document.getElementById("auth-password");
    if (!pwInput) return;
    const isPw = pwInput.type === "password";
    pwInput.type = isPw ? "text" : "password";
  });

  document.querySelectorAll("#auth-role-grid .role, #auth-role-grid .role-card").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#auth-role-grid .role, #auth-role-grid .role-card").forEach(x => {
        x.classList.remove("on");
        x.classList.remove("active");
      });
      btn.classList.add("on");
      btn.classList.add("active");
      state.selectedRole = btn.getAttribute("data-role");
    });
  });

  document.getElementById("form-auth").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const submitBtn = document.getElementById("btn-auth-submit");
    if (submitBtn) submitBtn.disabled = true;

    try {
      let res;
      if (state.authMode === "login") {
        const remember = document.getElementById("auth-remember")?.checked ?? true;
        res = await firebaseService.login({ email, password, remember });
        showToast("تم تسجيل الدخول بنجاح", "success");
      } else {
        const name = document.getElementById("auth-name").value.trim();
        const governorate = document.getElementById("auth-governorate")?.value || "cairo";
        const role = state.selectedRole || (email.toLowerCase().includes("admin") ? "admin" : "farmer");
        res = await firebaseService.register({ email, password, name, accountType: role, governorate });
        showToast("تم إنشاء حسابك وتسجيل الدخول بنجاح! 🌾", "success");
      }

      await syncUserData(res.user, res.profile);

      const isAdmin = Boolean(
        res.profile?.accountType === "admin" ||
        res.profile?.role === "admin" ||
        email.toLowerCase().includes("admin")
      );

      const target = state.intendedRoute || (isAdmin ? "dashboard" : "home");
      state.intendedRoute = null;
      navigateTo(target);
    } catch (err) {
      showToast(formatFirebaseError(err), "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  document.getElementById("btn-forgot-pass").addEventListener("click", async () => {
    const email = document.getElementById("auth-email").value.trim();
    if (!email) {
      showToast("اكتب بريدك الإلكتروني أولاً لإرسال رابط الاستعادة", "warning");
      return;
    }
    try {
      await firebaseService.resetPassword(email);
      showToast("تم إرسال رابط استعادة كلمة المرور لبريدك");
    } catch (err) {
      showToast(formatFirebaseError(err), "error");
    }
  });

  // Consultations modals & messages
  document.getElementById("btn-new-consult").addEventListener("click", () => openNewConsultModal());
  document.getElementById("btn-close-consult-modal").addEventListener("click", () => {
    document.getElementById("modal-new-consult").classList.add("hidden");
  });
  document.getElementById("form-new-consult").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const targetEngineerId = document.getElementById("consult-engineer-select")?.value || "all";
      const created = await firebaseService.createConsultation({
        userId: state.user.uid,
        userName: state.profile?.name || state.user.email,
        governorate: state.profile?.governorate || "",
        crop: document.getElementById("consult-crop").value.trim(),
        subject: document.getElementById("consult-subject").value.trim(),
        details: document.getElementById("consult-details").value.trim(),
        targetEngineerId
      });
      document.getElementById("modal-new-consult").classList.add("hidden");
      showToast("تم إرسال استشارتك بنجاح");
      openConsultationThread(created.id);
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("form-send-msg").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("input-chat-msg");
    const text = input.value.trim();
    if (!text || !state.activeConsultId) return;
    input.value = "";
    await firebaseService.sendConsultationMessage(state.activeConsultId, {
      senderId: state.user.uid,
      senderName: state.profile?.name || state.user.email,
      senderRole: state.profile?.accountType || "farmer",
      text
    });
  });

  // Modals close
  document.getElementById("btn-close-disease-modal").addEventListener("click", () => {
    speechService.stop();
    document.getElementById("modal-disease").classList.add("hidden");
  });

  // Respect URL hash
  const initialHash = window.location.hash.replace("#", "");
  if (["home", "diagnosis", "library", "consultations", "dashboard", "auth"].includes(initialHash)) {
    navigateTo(initialHash);
  }
}

bootstrap();
