import { TRANSLATIONS } from "./i18n.js";
import { GOVERNORATES, fetchLiveWeather, describeWeatherCode, computeSprayingAdvice } from "./weather-service.js";
import { CROPS, PATHOGEN_TYPES, DISEASES_DATA, QUIZ_QUESTIONS } from "./data-diseases.js";
import { speechService } from "./speech-service.js";
import { loadFirebaseConfig, saveFirebaseConfig, loadAIConfig, saveAIConfig } from "./firebase-config.js";
import { firebaseService, PRELOADED_DIAGNOSES } from "./firebase-service.js";
import { compressImage, analyzePlantImage, checkBackendHealth } from "./ai-service.js";

const state = {
  lang: localStorage.getItem("tabib_lang") || "ar",
  route: "home",
  user: null,
  profile: null,
  diagnoses: [...PRELOADED_DIAGNOSES],
  consultations: [],
  activeConsultId: null,
  diseases: [...DISEASES_DATA],
  quizQuestions: [...QUIZ_QUESTIONS],
  selectedCropFilter: "all",
  selectedPathogenFilter: "all",
  libSearch: "",
  learnTab: "identify",
  quizIndex: 0,
  quizSelected: null,
  quizSubmitted: false,
  quizScoreRun: 0,
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
    return "تنبيه: يجب الضغط على 'Get started' وتفعيل (Email/Password) في Firebase Console لمشروعك (Authentication > Sign-in method).";
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
    return "قواعد حماية Firestore بحاجة لتطبيق القواعد المرفقة في firestore.rules أو تشغيلها في وضع الاختبار.";
  }
  if (msg.includes("failed-precondition") || msg.includes("not-found") || msg.includes("404")) {
    return "تأكد من الضغط على Create Database في قسم Firestore Database في لوحة Firebase Console لمشروعك.";
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
    farmer: t("roleFarmer"),
    engineer: t("roleEngineer"),
    student: t("roleStudent"),
    nursery: t("roleNursery"),
    other: t("roleOther")
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
  if (route === "dashboard") {
    const isAdmin = Boolean(
      state.profile?.accountType === "admin" ||
      state.profile?.role === "admin" ||
      state.profile?.accountType === "engineer" ||
      state.user?.email?.toLowerCase().includes("admin")
    );
    if (!isAdmin) {
      showToast("لوحة التحكم مخصصة لحسابات الإدارة (Admin) فقط", "warning");
      route = "home";
    }
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
  if (state.route === "learning") renderLearning();
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
  const selects = [document.getElementById("select-governorate"), document.getElementById("auth-governorate")];
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

  try {
    descEl.textContent = t("weatherLoading");
    const w = await fetchLiveWeather(lat, lon);
    const info = describeWeatherCode(w.weatherCode, state.lang);
    tempEl.textContent = `${w.temp}° ${state.lang === "ar" ? "م" : "C"}`;
    descEl.textContent = `${info.text}${label ? ` • ${label}` : ""}`;
    iconEl.textContent = info.icon;
    windEl.textContent = `${w.windSpeed} ${state.lang === "ar" ? "كم/س" : "km/h"}`;
    humEl.textContent = `${w.humidity}%`;
    rainEl.textContent = `${w.precipitation} ${state.lang === "ar" ? "مم" : "mm"}`;
    advEl.textContent = computeSprayingAdvice(w, state.lang);
  } catch (err) {
    descEl.textContent = state.lang === "ar" ? "تعذر الاتصال بخدمة الطقس الحية" : "Unable to load live weather";
    advEl.textContent = err.message;
  }
}

// ==================== CONNECTION & ADMIN VISIBILITY ====================

function updateConnectionUI() {
  const isAdmin = Boolean(
    state.profile?.accountType === "admin" ||
    state.profile?.role === "admin" ||
    state.profile?.accountType === "engineer" ||
    state.user?.email?.toLowerCase().includes("admin")
  );

  const navDash = document.getElementById("nav-dashboard-link");
  if (navDash) {
    navDash.classList.toggle("hidden", !isAdmin);
  }

  const authBtn = document.getElementById("btn-nav-auth");
  if (authBtn) {
    if (state.user) {
      authBtn.textContent = state.profile?.name ? `👤 ${state.profile.name.split(" ")[0]}` : (isAdmin ? "لوحة الإدارة" : t("accountBtn"));
      authBtn.setAttribute("data-route", isAdmin ? "dashboard" : "home");
    } else {
      authBtn.textContent = t("loginBtn");
      authBtn.setAttribute("data-route", "auth");
    }
  }
}

// ==================== HOME RECENT DIAGNOSES ====================

function renderHomeRecent() {
  const container = document.getElementById("home-recent-list");
  if (!state.diagnoses.length) {
    container.innerHTML = `<p class="section-subtitle">${escapeHtml(t("noRecentYet"))}</p>`;
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
    if (err.message === "AI_NOT_CONFIGURED") {
      showToast(
        state.lang === "ar"
          ? "محرك الذكاء الاصطناعي غير مضبوط بعد — أدخل مفتاح Gemini API أو رابط نموذجك في الإعدادات ليتم التحليل الحقيقي."
          : "Vision AI is not configured yet — enter your Gemini API key or custom ML endpoint in Settings.",
        "warning"
      );
      openConfigModal();
    } else {
      showToast(err.message, "error");
    }
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
    if (!firebaseService.isReady) {
      showToast("اربط قاعدة بيانات Firebase أولاً لحفظ التقرير", "warning");
      openConfigModal();
      return;
    }
    if (!state.user) {
      showToast("سجّل الدخول أولاً لحفظ التقرير في حسابك", "warning");
      navigateTo("auth");
      return;
    }
    try {
      const saved = await firebaseService.saveDiagnosis(state.user.uid, report, state.uploadedImage?.thumbDataUrl || "");
      state.diagnoses.unshift(saved);
      showToast(state.lang === "ar" ? "تم حفظ التشخيص في قاعدة بيانات Firebase بنجاح" : "Diagnosis saved to Firebase!");
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
        showToast("سجّل الدخول بعد ربط Firebase لحفظ المفضلة", "warning");
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

// ==================== LEARNING MODE ====================

function renderLearning() {
  const stats = state.profile?.learningStats || { points: 0, streak: 0, answeredIds: [] };
  document.getElementById("learn-points").textContent = stats.points || 0;
  document.getElementById("learn-streak").textContent = stats.streak || 0;

  document.querySelectorAll("[data-learn-tab]").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-learn-tab") === state.learnTab);
  });

  const stage = document.getElementById("learning-stage");
  const ar = state.lang === "ar";

  if (state.learnTab === "compare") {
    stage.innerHTML = `<div class="disease-grid">
      ${state.diseases.slice(0, 6).map(d => `
        <div class="card">
          <img src="${escapeHtml(d.image)}" alt="" style="width:100%;height:150px;object-fit:cover;border-radius:12px;margin-bottom:12px;" />
          <h3 style="font-weight:800;margin-bottom:6px;">${escapeHtml(ar ? d.nameAr : d.nameEn)}</h3>
          <p class="section-subtitle" style="font-size:0.88rem;">${escapeHtml(ar ? d.lookalikeNoteAr : d.lookalikeNoteEn)}</p>
        </div>
      `).join("")}
    </div>`;
    return;
  }

  const qList = state.quizQuestions;
  const q = qList[state.quizIndex % qList.length];
  const opts = ar ? q.optionsAr : q.optionsEn;
  const letters = ["A", "B", "C", "D"];

  stage.innerHTML = `
    <div class="card quiz-card">
      <div>
        <span class="tag" style="margin-bottom:10px;display:inline-block;">سؤال ${(state.quizIndex % qList.length) + 1} من ${qList.length}</span>
        <img src="${escapeHtml(q.image)}" alt="Leaf quiz sample" style="width:100%;max-height:300px;object-fit:cover;border-radius:16px;margin-bottom:14px;" />
        <div class="weather-advice">
          💡 <strong>تلميح:</strong> ${escapeHtml(ar ? q.tipAr : q.tipEn)}
        </div>
      </div>

      <div>
        <h2 style="font-weight:800;font-size:1.2rem;margin-bottom:16px;">${escapeHtml(ar ? q.questionAr : q.questionEn)}</h2>
        <div id="quiz-options">
          ${opts.map((opt, idx) => {
            let cls = "quiz-option";
            if (state.quizSubmitted) {
              if (idx === q.correctIndex) cls += " correct";
              else if (idx === state.quizSelected) cls += " wrong";
            } else if (idx === state.quizSelected) {
              cls += " selected";
            }
            return `<button class="${cls}" data-opt-idx="${idx}"><span class="quiz-letter">${letters[idx]}</span><span>${escapeHtml(opt)}</span></button>`;
          }).join("")}
        </div>

        <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
          ${!state.quizSubmitted
            ? `<button id="btn-quiz-submit" class="btn btn-primary" ${state.quizSelected === null ? "disabled" : ""}>${escapeHtml(t("confirmAnswer"))}</button>`
            : `<button id="btn-quiz-next" class="btn btn-primary">${escapeHtml(t("nextQuestion"))} ←</button>`
          }
          <button id="btn-quiz-skip" class="btn btn-secondary">${escapeHtml(t("skipQuestion"))}</button>
        </div>
      </div>
    </div>
  `;

  stage.querySelectorAll("[data-opt-idx]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (state.quizSubmitted) return;
      state.quizSelected = Number(btn.getAttribute("data-opt-idx"));
      renderLearning();
    });
  });

  document.getElementById("btn-quiz-submit")?.addEventListener("click", async () => {
    state.quizSubmitted = true;
    const correct = state.quizSelected === q.correctIndex;
    if (state.profile) {
      const currentStats = state.profile.learningStats || { points: 0, streak: 0, answeredIds: [] };
      const newPoints = (currentStats.points || 0) + (correct ? 20 : 0);
      const newStreak = correct ? (currentStats.streak || 0) + 1 : 0;
      state.profile.learningStats = {
        points: newPoints,
        streak: newStreak,
        answeredIds: Array.from(new Set([...(currentStats.answeredIds || []), q.id]))
      };
      if (firebaseService.isReady && state.user) {
        await firebaseService.saveLearningProgress(state.user.uid, {
          points: newPoints,
          streak: newStreak,
          answeredId: q.id
        }).catch(() => {});
      }
    }
    showToast(correct ? "إجابة صحيحة! +20 نقطة" : "إجابة غير صحيحة — راجع التلميح أسفل الصورة", correct ? "info" : "warning");
    renderLearning();
  });

  const goNext = () => {
    state.quizIndex = (state.quizIndex + 1) % qList.length;
    state.quizSelected = null;
    state.quizSubmitted = false;
    renderLearning();
  };
  document.getElementById("btn-quiz-next")?.addEventListener("click", goNext);
  document.getElementById("btn-quiz-skip")?.addEventListener("click", goNext);
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

function openNewConsultModal(prefill = {}) {
  if (!firebaseService.isReady || !state.user) {
    showToast("سجّل الدخول بعد ربط Firebase لفتح استشارة حقيقية", "warning");
    navigateTo(firebaseService.isReady ? "auth" : state.route);
    if (!firebaseService.isReady) openConfigModal();
    return;
  }
  document.getElementById("consult-crop").value = prefill.crop || "";
  document.getElementById("consult-subject").value = prefill.subject || "";
  document.getElementById("consult-details").value = prefill.details || "";
  document.getElementById("modal-new-consult").classList.remove("hidden");
}

// ==================== DASHBOARD ====================

function renderDashboard() {
  const guard = document.getElementById("dash-auth-guard");
  const main = document.getElementById("dash-main");
  if (!state.user || !firebaseService.isReady) {
    guard.classList.remove("hidden");
    main.classList.add("hidden");
    return;
  }
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
  const answeredCount = (state.profile?.learningStats?.answeredIds || []).length;
  const learnPct = state.quizQuestions.length
    ? Math.min(100, Math.round((answeredCount / state.quizQuestions.length) * 100))
    : 0;

  if (state.dashTab === "overview") {
    content.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-val">${totalDiag}</div><div class="kpi-label">إجمالي الفحوصات</div></div>
        <div class="kpi-card"><div class="kpi-val">${learnPct}%</div><div class="kpi-label">التقدم التعليمي</div></div>
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
      <h3 style="font-weight:800;margin-bottom:14px;">سجل فحوصاتي في Firestore (${totalDiag})</h3>
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
        <button id="btn-dash-open-cfg" class="btn btn-secondary">⚙️ إعدادات Firebase والذكاء الاصطناعي</button>
      </div>
    </div>`;
    document.getElementById("btn-dash-save-gov").addEventListener("click", async () => {
      const gov = document.getElementById("dash-gov-select").value;
      await firebaseService.updateUserProfile(state.user.uid, { governorate: gov });
      state.profile.governorate = gov;
      loadWeatherForGov(gov);
      showToast("تم تحديث المحافظة بنجاح");
    });
    document.getElementById("btn-dash-open-cfg").addEventListener("click", openConfigModal);
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

// ==================== CONFIGURATION MODAL ====================

function openConfigModal() {
  const modal = document.getElementById("modal-config");
  const fbCfg = loadFirebaseConfig();
  const aiCfg = loadAIConfig();

  if (fbCfg) {
    document.getElementById("cfg-firebase-raw").value = JSON.stringify(fbCfg, null, 2);
  }
  document.getElementById("cfg-ai-provider").value = aiCfg.provider || "gemini";
  document.getElementById("cfg-gemini-key").value = aiCfg.geminiApiKey || "";
  document.getElementById("cfg-custom-url").value = aiCfg.customEndpoint || "";
  toggleAIConfigFields();
  modal.classList.remove("hidden");
}

function toggleAIConfigFields() {
  const provider = document.getElementById("cfg-ai-provider").value;
  document.getElementById("cfg-gemini-group").classList.toggle("hidden", provider !== "gemini");
  document.getElementById("cfg-custom-group").classList.toggle("hidden", provider !== "custom");
}

// ==================== INITIALIZATION ====================

async function syncUserData(user, profile) {
  state.user = user;
  state.profile = profile;
  updateConnectionUI();

  if (user && firebaseService.isReady) {
    try {
      const userDiags = await firebaseService.getUserDiagnoses(user.uid);
      state.diagnoses = userDiags?.length ? userDiags : [...PRELOADED_DIAGNOSES];
    } catch (_) {
      state.diagnoses = [...PRELOADED_DIAGNOSES];
    }

    if (profile?.governorate) {
      loadWeatherForGov(profile.governorate);
    }

    firebaseService.subscribeConsultations(user.uid, profile?.accountType || "farmer", (list) => {
      state.consultations = list;
      const isEng = profile?.accountType === "engineer" || profile?.accountType === "admin";
      const unreadCount = list.filter(c => (isEng ? c.unreadForEngineer : c.unreadForFarmer)).length;
      const badge = document.getElementById("notif-badge");
      if (badge) {
        badge.textContent = String(unreadCount);
        badge.classList.toggle("hidden", unreadCount === 0);
      }
      if (state.route === "consultations") renderConsultationsView();
      if (state.route === "dashboard") renderDashboard();
    });
  } else {
    state.diagnoses = [...PRELOADED_DIAGNOSES];
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
      firebaseService.listenAuth(syncUserData);
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

  document.getElementById("btn-firebase-status")?.addEventListener("click", openConfigModal);
  document.getElementById("btn-open-config-banner")?.addEventListener("click", openConfigModal);
  document.getElementById("btn-diag-config")?.addEventListener("click", openConfigModal);

  // Weather controls
  document.getElementById("select-governorate")?.addEventListener("change", (e) => {
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

  // Learning tabs
  document.querySelectorAll("[data-learn-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.learnTab = btn.getAttribute("data-learn-tab");
      renderLearning();
    });
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
    if (subBtn) subBtn.textContent = isSignup ? "إنشاء الحساب" : "تسجيل الدخول";
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
        showToast(res.isConfigMissing
          ? "تم إنشاء الحساب وتسجيل الدخول بنجاح! 🌾"
          : "تم إنشاء حسابك في Firebase بنجاح! 🌾", "success");
      }

      await syncUserData(res.user, res.profile);

      const isAdmin = Boolean(
        res.profile?.accountType === "admin" ||
        res.profile?.role === "admin" ||
        res.profile?.accountType === "engineer" ||
        email.toLowerCase().includes("admin")
      );

      if (isAdmin) {
        navigateTo("dashboard");
      } else {
        navigateTo("home");
      }
    } catch (err) {
      showToast(formatFirebaseError(err), "error");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  document.getElementById("btn-google-auth").addEventListener("click", async () => {
    try {
      const gov = document.getElementById("auth-governorate")?.value || "cairo";
      const res = await firebaseService.loginWithGoogle(state.selectedRole, gov);
      await syncUserData(res.user, res.profile);
      const isAdmin = Boolean(
        res.profile?.accountType === "admin" ||
        res.profile?.role === "admin" ||
        res.profile?.accountType === "engineer"
      );
      if (isAdmin) {
        navigateTo("dashboard");
      } else {
        navigateTo("home");
      }
    } catch (err) {
      showToast(formatFirebaseError(err), "error");
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
      const created = await firebaseService.createConsultation({
        userId: state.user.uid,
        userName: state.profile?.name || state.user.email,
        governorate: state.profile?.governorate || "",
        crop: document.getElementById("consult-crop").value.trim(),
        subject: document.getElementById("consult-subject").value.trim(),
        details: document.getElementById("consult-details").value.trim()
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

  // Modals close & Config form
  document.getElementById("btn-close-disease-modal").addEventListener("click", () => {
    speechService.stop();
    document.getElementById("modal-disease").classList.add("hidden");
  });
  document.getElementById("btn-close-config-modal").addEventListener("click", () => {
    document.getElementById("modal-config").classList.add("hidden");
  });
  document.getElementById("cfg-ai-provider").addEventListener("change", toggleAIConfigFields);

  document.getElementById("form-config").addEventListener("submit", async (e) => {
    e.preventDefault();
    const rawFb = document.getElementById("cfg-firebase-raw").value;
    if (rawFb.trim()) {
      const parsed = parseFirebaseConfigInput(rawFb);
      if (!parsed) {
        showToast("صيغة إعدادات Firebase غير مكتملة — تأكد من وجود apiKey و projectId", "error");
        return;
      }
      saveFirebaseConfig(parsed);
      const initRes = await firebaseService.init(parsed);
      if (!initRes.ready) {
        showToast(`تعذر الاتصال بـ Firebase: ${initRes.error || ""}`, "error");
        return;
      }
      firebaseService.listenAuth(syncUserData);
    }

    saveAIConfig({
      provider: document.getElementById("cfg-ai-provider").value,
      geminiApiKey: document.getElementById("cfg-gemini-key").value.trim(),
      geminiModel: "gemini-2.5-flash",
      customEndpoint: document.getElementById("cfg-custom-url").value.trim()
    });

    updateConnectionUI();
    document.getElementById("modal-config").classList.add("hidden");
    showToast("تم حفظ وتفعيل الإعدادات بنجاح");
  });

  document.getElementById("btn-seed-firestore").addEventListener("click", async () => {
    if (!firebaseService.isReady) {
      showToast("احفظ إعدادات Firebase أولاً قبل التهيئة", "warning");
      return;
    }
    try {
      const res = await firebaseService.seedKnowledgeBase();
      showToast(`تم رفع ${res.diseasesCount} مرض زراعي و ${res.quizCount} سؤال تدريبي إلى Firestore!`);
    } catch (err) {
      showToast(formatFirebaseError(err), "error");
    }
  });

  // Respect URL hash
  const initialHash = window.location.hash.replace("#", "");
  if (["home", "diagnosis", "library", "learning", "consultations", "dashboard", "auth"].includes(initialHash)) {
    navigateTo(initialHash);
  }
}

bootstrap();
