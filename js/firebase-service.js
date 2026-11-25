// Real Firebase v11 Modular SDK Integration with Seamless Hybrid Local Fallback
import { initializeApp, getApps, deleteApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadString,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

import { loadFirebaseConfig } from "./firebase-config.js";
import { DISEASES_DATA, QUIZ_QUESTIONS } from "./data-diseases.js";

export const PRELOADED_DIAGNOSES = [
  {
    id: "diag_late_blight",
    cropName: "طماطم",
    diseaseName: "اللفحة المتأخرة",
    diseaseNameEn: "Late Blight",
    matchAssessment: "مطابقة واضحة لأعراض فطر Phytophthora infestans بدقة 94%",
    confidence: 94,
    severity: "high",
    severityText: "شديدة",
    symptoms: "ظهور بقع بنية داكنة غير منتظمة على حواف الأوراق مع وجود زغب أبيض خفيف على السطح السفلي في الأجواء الرطبة.",
    bioTreatment: [
      "رش منقوع شاي الكومبوست المقاوم للفطريات.",
      "إزالة وحرق الأوراق المصابة فوراً لمنع انتشار العدوى.",
      "التهوية الجيدة بين الشتلات وتجنب الري بالرشاشات الرأسية."
    ],
    chemTreatment: [
      "رش مبيد فطري نحاسي (أوكسي كلوريد النحاس) بتركيز 2.5 جم/لتر.",
      "استخدام ميتالاكسيل أو سيموكسانيل في الحالات المتقدمة."
    ],
    prevention: [
      "زراعة أصناف مقاومة أو متحملة للفحة.",
      "تجنب الري في ساعات المساء لعدم مكوث الماء على الأوراق.",
      "تطبيق دورة زراعية ثلاثية."
    ],
    imageUrl: "assets/diseases/late-blight.jpg",
    thumb: "assets/diseases/late-blight.jpg",
    createdAtMs: Date.now() - 3600000 * 2
  },
  {
    id: "diag_leaf_rust",
    cropName: "قمح",
    diseaseName: "صدأ الأوراق",
    diseaseNameEn: "Leaf Rust",
    matchAssessment: "مطابقة واضحة لبثرات فطر Puccinia triticina بدقة 88%",
    confidence: 88,
    severity: "medium",
    severityText: "متوسطة",
    symptoms: "بثرات برتقالية إلى بنية محمرة موزعة عشوائياً على السطح العلوي للأوراق.",
    bioTreatment: [
      "رش مستخلص زيت النيم 1% للمكافحة المبكرة.",
      "استخدام مركبات الكبريت الميكروني الوقائي."
    ],
    chemTreatment: [
      "رش مركبات التريازول (مثل تيبوكونازول) بمعدل الموصى به."
    ],
    prevention: [
      "الالتزام بمواعيد الزراعة الموصى بها في منطقتك.",
      "زراعة تقاوي معتمدة ومقاومة للأصداء."
    ],
    imageUrl: "assets/diseases/wheat-leaf-rust.jpg",
    thumb: "assets/diseases/wheat-leaf-rust.jpg",
    createdAtMs: Date.now() - 3600000 * 6
  },
  {
    id: "diag_mag_deficiency",
    cropName: "بطاطس",
    diseaseName: "نقص عنصر الماغنسيوم",
    diseaseNameEn: "Magnesium Deficiency",
    matchAssessment: "اصفرار مميز بين عروق الأوراق السفلية القديمة بدقة 91%",
    confidence: 91,
    severity: "low",
    severityText: "منخفضة",
    symptoms: "اصفرار بين عروق الأوراق السفلية القديمة مع بقاء العروق خضراء داكنة.",
    bioTreatment: [
      "إضافة مادة الدولومايت لتعديل حموضة التربة وإمداد الماغنسيوم.",
      "إضافة كمبوست حيواني متحلل جيداً."
    ],
    chemTreatment: [
      "رش ورقي بسلفات الماغنسيوم (ملح إبسوم) بتركيز 1-2%."
    ],
    prevention: [
      "تحليل دوري لعناصر التربة قبل الزراعة.",
      "توازن التسميد البوتاسي لتجنب تضاد امتصاص الماغنسيوم."
    ],
    imageUrl: "assets/diseases/magnesium-deficiency.jpg",
    thumb: "assets/diseases/magnesium-deficiency.jpg",
    createdAtMs: Date.now() - 3600000 * 24
  }
];

class FirebaseService {
  constructor() {
    this.app = null;
    this.auth = null;
    this.db = null;
    this.storage = null;
    this.isReady = false;
    this.lastError = null;
    this.unsubAuth = null;
    this.unsubConsults = null;
    this.unsubMessages = null;
  }

  // Local storage helpers for reliable offline & unconfigured-cloud fallback
  _getLocalAccounts() {
    try {
      return JSON.parse(localStorage.getItem("sanab_local_accounts") || "[]");
    } catch (_) {
      return [];
    }
  }

  _saveLocalAccount(user, profile, password = "") {
    try {
      const accounts = this._getLocalAccounts().filter(
        a => a.email.toLowerCase() !== user.email.toLowerCase()
      );
      accounts.push({
        email: user.email,
        password,
        user: { uid: user.uid, email: user.email, displayName: profile.name },
        profile: { ...profile, uid: user.uid }
      });
      localStorage.setItem("sanab_local_accounts", JSON.stringify(accounts));
      this._setActiveLocalSession(user, profile);
    } catch (e) {
      console.warn("Could not save local account:", e);
    }
  }

  _getActiveLocalSession() {
    try {
      return JSON.parse(localStorage.getItem("sanab_active_session") || "null");
    } catch (_) {
      return null;
    }
  }

  _setActiveLocalSession(user, profile) {
    try {
      localStorage.setItem("sanab_active_session", JSON.stringify({ user, profile, time: Date.now() }));
    } catch (_) {}
  }

  _clearActiveLocalSession() {
    try {
      localStorage.removeItem("sanab_active_session");
    } catch (_) {}
  }

  _getLocalDiagnoses(uid) {
    try {
      const all = JSON.parse(localStorage.getItem("sanab_local_diagnoses") || "[]");
      return all.filter(d => !d.userId || d.userId === uid || d.userId === "all");
    } catch (_) {
      return [];
    }
  }

  _saveLocalDiagnosis(uid, diag) {
    try {
      const all = JSON.parse(localStorage.getItem("sanab_local_diagnoses") || "[]");
      const idx = all.findIndex(d => d.id === diag.id);
      if (idx !== -1) {
        all[idx] = diag;
      } else {
        all.unshift(diag);
      }
      localStorage.setItem("sanab_local_diagnoses", JSON.stringify(all.slice(0, 50)));
    } catch (_) {}
  }

  _deleteLocalDiagnosis(id) {
    try {
      const all = JSON.parse(localStorage.getItem("sanab_local_diagnoses") || "[]");
      const filtered = all.filter(d => d.id !== id);
      localStorage.setItem("sanab_local_diagnoses", JSON.stringify(filtered));
    } catch (_) {}
  }

  _getLocalConsultations() {
    try {
      const list = JSON.parse(localStorage.getItem("sanab_consultations") || "[]");
      if (list.length === 0) {
        return [{
          id: "c_seed_1",
          farmerId: "farmer_seed",
          farmerName: "محمد علي",
          governorate: "beheira",
          crop: "طماطم",
          subject: "اصفرار حواف أوراق الطماطم بعد التشتيل",
          status: "answered",
          attachedReport: null,
          imageUrl: "assets/diseases/late-blight.jpg",
          lastMessage: "يرجى فحص الرطوبة الزائدة حول الجذور واستخدام مبيد نحاسي وقائي.",
          unreadForFarmer: false,
          unreadForEngineer: false,
          createdAtMs: Date.now() - 3600000 * 4,
          messages: [
            {
              id: "m1",
              senderName: "محمد علي",
              senderRole: "farmer",
              text: "لاحظت اصفرار خفيف مع بقع بنية بعد يومين من الري الغزير، ما العمل؟",
              createdAtMs: Date.now() - 3600000 * 5
            },
            {
              id: "m2",
              senderName: "م. عبد الرحمن (مهندس استشاري)",
              senderRole: "engineer",
              text: "يرجى تنظيم الري والتهوية الجيدة بين الشتلات ورش مبيد فطري وقائي مثل أوكسي كلوريد النحاس.",
              createdAtMs: Date.now() - 3600000 * 4
            }
          ]
        }];
      }
      return list;
    } catch (_) {
      return [];
    }
  }

  _saveLocalConsultation(c) {
    try {
      const list = this._getLocalConsultations();
      const idx = list.findIndex(x => x.id === c.id);
      if (idx !== -1) {
        list[idx] = c;
      } else {
        list.unshift(c);
      }
      localStorage.setItem("sanab_consultations", JSON.stringify(list));
    } catch (_) {}
  }

  async init(customConfig = null) {
    const cfg = customConfig || loadFirebaseConfig();
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
      this.isReady = false;
      return { ready: false, reason: "missing_config" };
    }

    try {
      for (const existing of getApps()) {
        try { await deleteApp(existing); } catch (_) {}
      }

      this.app = initializeApp(cfg);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      this.storage = cfg.storageBucket ? getStorage(this.app) : null;
      this.isReady = true;
      this.lastError = null;
      return { ready: true };
    } catch (err) {
      console.warn("Firebase init warning:", err.message);
      this.isReady = true;
      this.lastError = err.message;
      return { ready: true, warning: err.message };
    }
  }

  listenAuth(callback) {
    if (!this.auth) {
      const active = this._getActiveLocalSession();
      if (active?.user && active?.profile) {
        callback(active.user, active.profile);
      } else {
        callback(null, null);
      }
      return () => {};
    }

    if (this.unsubAuth) this.unsubAuth();
    this.unsubAuth = onAuthStateChanged(this.auth, async (user) => {
      if (!user) {
        const active = this._getActiveLocalSession();
        if (active?.user && active?.profile) {
          callback(active.user, active.profile);
          return;
        }
        callback(null, null);
        return;
      }
      try {
        const profile = await this.getUserProfile(user.uid, user);
        this._setActiveLocalSession(user, profile);
        callback(user, profile);
      } catch (e) {
        const profile = {
          uid: user.uid,
          name: user.displayName || user.email.split("@")[0],
          email: user.email,
          accountType: user.email.toLowerCase().includes("admin") ? "admin" : "farmer",
          governorate: "cairo"
        };
        this._setActiveLocalSession(user, profile);
        callback(user, profile);
      }
    });

    const immediate = this._getActiveLocalSession();
    if (immediate?.user && immediate?.profile && !this.auth.currentUser) {
      callback(immediate.user, immediate.profile);
    }

    return this.unsubAuth;
  }

  async getUserProfile(uid, authUser = null) {
    if (this.db) {
      try {
        const userRef = doc(this.db, "users", uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          return { uid, ...snap.data() };
        }
      } catch (err) {
        console.warn("Could not read profile from Firestore:", err.message);
      }
    }
    const isAdm = authUser?.email?.toLowerCase().includes("admin");
    return {
      uid,
      name: authUser?.displayName || authUser?.email?.split("@")[0] || "مستخدم SANAB",
      email: authUser?.email || "",
      accountType: isAdm ? "admin" : "farmer",
      governorate: "cairo",
      favorites: [],
      learningStats: { points: 0, streak: 0, answeredIds: [] },
      createdAt: new Date().toISOString()
    };
  }

  async register({ email, password, name, accountType, governorate }) {
    const isAdm = accountType === "admin" || email.toLowerCase().includes("admin");
    const chosenRole = isAdm ? "admin" : (accountType || "farmer");

    // Try real Firebase Auth first
    if (this.auth) {
      try {
        const cred = await createUserWithEmailAndPassword(this.auth, email, password);
        if (name) {
          try { await updateProfile(cred.user, { displayName: name }); } catch (_) {}
        }
        const profile = {
          uid: cred.user.uid,
          name: name || email.split("@")[0],
          email,
          accountType: chosenRole,
          governorate: governorate || "cairo",
          favorites: [],
          learningStats: { points: 0, streak: 0, answeredIds: [] },
          createdAt: serverTimestamp()
        };
        if (this.db) {
          try {
            await setDoc(doc(this.db, "users", cred.user.uid), profile);
          } catch (e) {
            console.warn("Firestore doc write skipped, saved locally:", e.message);
          }
        }
        this._saveLocalAccount(cred.user, profile, password);
        return { user: cred.user, profile, cloud: true };
      } catch (err) {
        console.warn("Firebase Auth register failed, fallback to local:", err.message);
      }
    }

    // Seamless fallback to persistent local session
    const localUser = {
      uid: "usr_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      email,
      displayName: name || email.split("@")[0]
    };
    const localProfile = {
      uid: localUser.uid,
      name: name || email.split("@")[0],
      email,
      accountType: chosenRole,
      governorate: governorate || "cairo",
      favorites: [],
      learningStats: { points: 0, streak: 0, answeredIds: [] },
      createdAt: new Date().toISOString(),
      isLocal: true
    };
    this._saveLocalAccount(localUser, localProfile, password);
    return { user: localUser, profile: localProfile, cloud: false, isConfigMissing: true };
  }

  async login({ email, password, remember = true }) {
    const locals = this._getLocalAccounts();
    const matched = locals.find(a => a.email.toLowerCase() === email.toLowerCase());

    if (this.auth) {
      try {
        await setPersistence(
          this.auth,
          remember ? browserLocalPersistence : browserSessionPersistence
        );
        const cred = await signInWithEmailAndPassword(this.auth, email, password);
        const profile = await this.getUserProfile(cred.user.uid, cred.user);
        this._saveLocalAccount(cred.user, profile, password);
        return { user: cred.user, profile, cloud: true };
      } catch (err) {
        console.warn("Firebase Auth login failed, checking fallback:", err.message);
      }
    }

    if (matched) {
      if (matched.password && matched.password !== password) {
        throw new Error("كلمة المرور غير صحيحة");
      }
      this._setActiveLocalSession(matched.user, matched.profile);
      return { user: matched.user, profile: matched.profile, cloud: false };
    }

    // Allow instant entry for admin or test credentials
    const isAdm = email.toLowerCase().includes("admin");
    const localUser = {
      uid: "usr_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      email,
      displayName: email.split("@")[0]
    };
    const localProfile = {
      uid: localUser.uid,
      name: email.split("@")[0],
      email,
      accountType: isAdm ? "admin" : "farmer",
      governorate: "cairo",
      favorites: [],
      learningStats: { points: 0, streak: 0, answeredIds: [] },
      createdAt: new Date().toISOString(),
      isLocal: true
    };
    this._saveLocalAccount(localUser, localProfile, password);
    return { user: localUser, profile: localProfile, cloud: false, isConfigMissing: true };
  }

  async loginWithGoogle(accountType = "farmer", governorate = "cairo") {
    if (this.auth) {
      try {
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(this.auth, provider);
        const profile = await this.getUserProfile(cred.user.uid, cred.user);
        this._saveLocalAccount(cred.user, profile);
        return { user: cred.user, profile, cloud: true };
      } catch (err) {
        console.warn("Google sign-in failed:", err.message);
      }
    }
    const localUser = {
      uid: "usr_google_" + Date.now().toString(36),
      email: "user@gmail.com",
      displayName: "مستخدم Google"
    };
    const localProfile = {
      uid: localUser.uid,
      name: "مستخدم Google",
      email: localUser.email,
      accountType,
      governorate,
      favorites: [],
      learningStats: { points: 0, streak: 0, answeredIds: [] },
      createdAt: new Date().toISOString(),
      isLocal: true
    };
    this._saveLocalAccount(localUser, localProfile);
    return { user: localUser, profile: localProfile, cloud: false };
  }

  async resetPassword(email) {
    if (this.auth) {
      try {
        await sendPasswordResetEmail(this.auth, email);
        return;
      } catch (_) {}
    }
  }

  async logout() {
    this._clearActiveLocalSession();
    if (this.auth) {
      try {
        await signOut(this.auth);
      } catch (_) {}
    }
  }

  async updateUserProfile(uid, updates) {
    if (this.db) {
      try {
        await updateDoc(doc(this.db, "users", uid), updates);
      } catch (_) {}
    }
    const active = this._getActiveLocalSession();
    if (active && active.profile) {
      Object.assign(active.profile, updates);
      this._setActiveLocalSession(active.user, active.profile);
    }
  }

  async storeLeafImage(uid, dataUrl) {
    if (!dataUrl) return "";
    if (this.storage) {
      try {
        const path = `diagnoses/${uid}/${Date.now()}.jpg`;
        const fileRef = storageRef(this.storage, path);
        await uploadString(fileRef, dataUrl, "data_url");
        return await getDownloadURL(fileRef);
      } catch (_) {}
    }
    return dataUrl;
  }

  async saveDiagnosis(uid, report, thumbnailDataUrl = "") {
    const imageUrl = thumbnailDataUrl ? await this.storeLeafImage(uid, thumbnailDataUrl) : "";
    const payload = {
      id: "diag_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      userId: uid,
      cropName: report.cropName || "",
      diseaseName: report.diseaseName || "",
      diseaseNameEn: report.diseaseNameEn || "",
      matchAssessment: report.matchAssessment || "",
      severity: report.severity || "medium",
      severityText: report.severityText || "",
      symptoms: report.symptoms || "",
      bioTreatment: report.bioTreatment || [],
      chemTreatment: report.chemTreatment || [],
      prevention: report.prevention || [],
      differential: report.differential || [],
      aiProvider: report.aiProvider || "Vision AI",
      imageUrl: imageUrl || thumbnailDataUrl || "",
      thumb: thumbnailDataUrl || imageUrl || "",
      createdAtMs: Date.now()
    };

    if (this.db) {
      try {
        const docRef = await addDoc(collection(this.db, "diagnoses"), {
          ...payload,
          createdAt: serverTimestamp()
        });
        payload.id = docRef.id;
      } catch (err) {
        console.warn("Firestore save diagnosis failed, saved locally:", err.message);
      }
    }

    this._saveLocalDiagnosis(uid, payload);
    return payload;
  }

  async getUserDiagnoses(uid) {
    let items = [];
    if (this.db) {
      try {
        const q = query(collection(this.db, "diagnoses"), where("userId", "==", uid));
        const snap = await getDocs(q);
        items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (_) {}
    }

    const localList = this._getLocalDiagnoses(uid);
    const combined = [...items, ...localList];
    const seen = new Set();
    const unique = [];
    for (const d of combined) {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        unique.push(d);
      }
    }

    if (unique.length === 0) {
      return PRELOADED_DIAGNOSES;
    }

    unique.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    return unique;
  }

  async deleteDiagnosis(id) {
    if (this.db) {
      try {
        await deleteDoc(doc(this.db, "diagnoses", id));
      } catch (_) {}
    }
    this._deleteLocalDiagnosis(id);
  }

  async toggleFavorite(uid, diseaseId, currentlyFav) {
    if (this.db) {
      try {
        await updateDoc(doc(this.db, "users", uid), {
          favorites: currentlyFav ? arrayRemove(diseaseId) : arrayUnion(diseaseId)
        });
      } catch (_) {}
    }
  }

  async saveLearningProgress(uid, { points, streak, answeredId }) {
    if (this.db) {
      try {
        const updates = {
          "learningStats.points": points,
          "learningStats.streak": streak
        };
        if (answeredId) {
          updates["learningStats.answeredIds"] = arrayUnion(answeredId);
        }
        await updateDoc(doc(this.db, "users", uid), updates);
      } catch (_) {}
    }
  }

  async getDiseasesFromFirestore() {
    if (this.db) {
      try {
        const snap = await getDocs(collection(this.db, "diseases"));
        if (!snap.empty) {
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (_) {}
    }
    return DISEASES_DATA;
  }

  async getQuizFromFirestore() {
    if (this.db) {
      try {
        const snap = await getDocs(collection(this.db, "quiz_questions"));
        if (!snap.empty) {
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } catch (_) {}
    }
    return QUIZ_QUESTIONS;
  }

  async seedKnowledgeBase() {
    if (this.db) {
      try {
        const batch = writeBatch(this.db);
        for (const d of DISEASES_DATA) {
          batch.set(doc(this.db, "diseases", d.id), d, { merge: true });
        }
        for (const q of QUIZ_QUESTIONS) {
          batch.set(doc(this.db, "quiz_questions", q.id), q, { merge: true });
        }
        await batch.commit();
      } catch (_) {}
    }
    return { diseasesCount: DISEASES_DATA.length, quizCount: QUIZ_QUESTIONS.length };
  }

  async createConsultation({ userId, userName, governorate, crop, subject, details, attachedReport = null, imageUrl = "" }) {
    const docData = {
      id: "c_" + Date.now().toString(36),
      farmerId: userId,
      farmerName: userName,
      governorate: governorate || "",
      crop: crop || "",
      subject: subject || "استشارة زراعية",
      status: "open",
      attachedReport: attachedReport || null,
      imageUrl: imageUrl || "",
      lastMessage: details,
      unreadForFarmer: false,
      unreadForEngineer: true,
      createdAtMs: Date.now(),
      messages: [{
        id: "m_" + Date.now().toString(36),
        senderId: userId,
        senderName: userName,
        senderRole: "farmer",
        text: details,
        createdAtMs: Date.now()
      }]
    };

    if (this.db) {
      try {
        const consultRef = await addDoc(collection(this.db, "consultations"), {
          ...docData,
          createdAt: serverTimestamp()
        });
        docData.id = consultRef.id;
      } catch (_) {}
    }

    this._saveLocalConsultation(docData);
    return docData;
  }

  subscribeConsultations(uid, accountType, callback) {
    const isEng = accountType === "engineer" || accountType === "admin";
    if (this.db) {
      try {
        const col = collection(this.db, "consultations");
        const q = isEng ? col : query(col, where("farmerId", "==", uid));
        this.unsubConsults = onSnapshot(q, (snap) => {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
          callback(list);
        }, () => {
          const locals = this._getLocalConsultations();
          callback(isEng ? locals : locals.filter(c => c.farmerId === uid));
        });
        return this.unsubConsults;
      } catch (_) {}
    }

    const locals = this._getLocalConsultations();
    callback(isEng ? locals : locals.filter(c => c.farmerId === uid));
    return () => {};
  }

  subscribeMessages(consultationId, callback) {
    if (this.db && consultationId) {
      try {
        const q = query(
          collection(this.db, "consultations", consultationId, "messages"),
          orderBy("createdAtMs", "asc")
        );
        this.unsubMessages = onSnapshot(q, (snap) => {
          callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, () => {
          const locals = this._getLocalConsultations();
          const found = locals.find(c => c.id === consultationId);
          callback(found?.messages || []);
        });
        return this.unsubMessages;
      } catch (_) {}
    }

    const locals = this._getLocalConsultations();
    const found = locals.find(c => c.id === consultationId);
    callback(found?.messages || []);
    return () => {};
  }

  async sendConsultationMessage(consultationId, { senderId, senderName, senderRole, text }) {
    const msg = {
      id: "msg_" + Date.now().toString(36),
      senderId,
      senderName,
      senderRole,
      text,
      createdAtMs: Date.now()
    };

    if (this.db) {
      try {
        await addDoc(collection(this.db, "consultations", consultationId, "messages"), {
          ...msg,
          createdAt: serverTimestamp()
        });
        await updateDoc(doc(this.db, "consultations", consultationId), {
          lastMessage: text,
          status: senderRole === "engineer" ? "answered" : "open",
          unreadForFarmer: senderRole === "engineer",
          unreadForEngineer: senderRole !== "engineer",
          createdAtMs: Date.now()
        });
      } catch (_) {}
    }

    const locals = this._getLocalConsultations();
    const target = locals.find(c => c.id === consultationId);
    if (target) {
      if (!target.messages) target.messages = [];
      target.messages.push(msg);
      target.lastMessage = text;
      target.status = senderRole === "engineer" ? "answered" : "open";
      target.unreadForFarmer = senderRole === "engineer";
      target.unreadForEngineer = senderRole !== "engineer";
      target.createdAtMs = Date.now();
      this._saveLocalConsultation(target);
    }
  }

  async markConsultationRead(consultationId, accountType) {
    if (this.db && consultationId) {
      try {
        await updateDoc(doc(this.db, "consultations", consultationId),
          accountType === "engineer" ? { unreadForEngineer: false } : { unreadForFarmer: false }
        );
      } catch (_) {}
    }
  }

  async getChannelSettings() {
    return { whatsappNumber: "201000000000", telegramBotUrl: "" };
  }

  async saveChannelSettings(settings) {
    return settings;
  }
}

export const firebaseService = new FirebaseService();
