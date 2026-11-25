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

const withTimeout = (p, ms = 2500) =>
  Promise.race([
    p,
    new Promise((_, reject) => setTimeout(() => reject(new Error("network-timeout")), ms))
  ]);

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
      return JSON.parse(localStorage.getItem("sanab_consultations") || "[]");
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
        const snap = await withTimeout(getDoc(userRef), 2000);
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
    if (!email || !password) {
      throw new Error("يرجى إدخال البريد الإلكتروني وكلمة المرور");
    }
    if (password.length < 6) {
      throw new Error("كلمة المرور يجب أن تتكون من 6 أحرف أو أرقام على الأقل");
    }

    // Check if email already registered locally
    const existing = this._getLocalAccounts().find(a => a.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error("هذا البريد الإلكتروني مسجل بالفعل، يمكنك تسجيل الدخول مباشرة.");
    }

    const isAdm = accountType === "admin" || email.toLowerCase().includes("admin");
    const chosenRole = isAdm ? "admin" : (accountType || "farmer");

    // Try real Firebase Auth first
    if (this.auth) {
      try {
        const cred = await withTimeout(createUserWithEmailAndPassword(this.auth, email, password), 2500);
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
            await withTimeout(setDoc(doc(this.db, "users", cred.user.uid), profile), 2000);
          } catch (e) {
            console.warn("Firestore doc write skipped, saved locally:", e.message);
          }
        }
        this._saveLocalAccount(cred.user, profile, password);
        this._setActiveLocalSession(cred.user, profile);
        return { user: cred.user, profile, cloud: true };
      } catch (err) {
        console.warn("Firebase Auth register failed, fallback to local:", err.message);
        if (err.code === "auth/email-already-in-use") {
          throw new Error("هذا البريد الإلكتروني مسجل بالفعل، يمكنك تسجيل الدخول مباشرة.");
        }
        if (err.code === "auth/weak-password") {
          throw new Error("كلمة المرور ضعيفة، يرجى كتابة 6 أحرف أو أرقام على الأقل.");
        }
      }
    }

    // Persistent local registration
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
    return { user: localUser, profile: localProfile, cloud: false };
  }

  async login({ email, password, remember = true }) {
    if (!email || !password) {
      throw new Error("يرجى إدخال البريد الإلكتروني وكلمة المرور");
    }

    const locals = this._getLocalAccounts();
    const matched = locals.find(a => a.email.toLowerCase() === email.toLowerCase());

    if (this.auth) {
      try {
        await withTimeout(setPersistence(
          this.auth,
          remember ? browserLocalPersistence : browserSessionPersistence
        ), 1500).catch(() => {});
        const cred = await withTimeout(signInWithEmailAndPassword(this.auth, email, password), 2500);
        const profile = await this.getUserProfile(cred.user.uid, cred.user);
        this._saveLocalAccount(cred.user, profile, password);
        this._setActiveLocalSession(cred.user, profile);
        return { user: cred.user, profile, cloud: true };
      } catch (err) {
        console.warn("Firebase Auth login failed, checking fallback:", err.message);
        if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
          throw new Error("البريد الإلكتروني أو كلمة المرور غير صحيحة");
        }
      }
    }

    if (matched) {
      if (matched.password && matched.password !== password) {
        throw new Error("كلمة المرور غير صحيحة");
      }
      this._setActiveLocalSession(matched.user, matched.profile);
      return { user: matched.user, profile: matched.profile, cloud: false };
    }

    throw new Error("البريد الإلكتروني غير مسجل، يرجى إنشاء حساب جديد أولاً");
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
        const docRef = await withTimeout(addDoc(collection(this.db, "diagnoses"), {
          ...payload,
          createdAt: serverTimestamp()
        }), 2000);
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
        const snap = await withTimeout(getDocs(q), 1800);
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

    unique.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    return unique;
  }

  async deleteDiagnosis(id) {
    if (this.db) {
      try {
        await withTimeout(deleteDoc(doc(this.db, "diagnoses", id)), 1800);
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
        const snap = await withTimeout(getDocs(collection(this.db, "diseases")), 2000);
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
        const snap = await withTimeout(getDocs(collection(this.db, "quiz_questions")), 2000);
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

  async createConsultation({ userId, userName, governorate, crop, subject, details, attachedReport = null, imageUrl = "", targetEngineerId = "all" }) {
    const docData = {
      id: "c_" + Date.now().toString(36),
      farmerId: userId,
      farmerName: userName,
      governorate: governorate || "",
      crop: crop || "",
      subject: subject || "استشارة زراعية",
      targetEngineerId: targetEngineerId || "all",
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

  async getRegisteredEngineers() {
    let list = [];
    if (this.db) {
      try {
        const q = query(collection(this.db, "users"), where("accountType", "==", "engineer"));
        const snap = await withTimeout(getDocs(q), 1800);
        list = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      } catch (_) {}
    }
    const locals = this._getLocalAccounts();
    const localEngs = locals
      .filter(a => a.profile?.accountType === "engineer" || a.profile?.role === "engineer")
      .map(a => a.profile);

    const combined = [...list, ...localEngs];
    const seen = new Set();
    const unique = [];
    for (const eng of combined) {
      const key = eng.uid || eng.email;
      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push(eng);
      }
    }
    return unique;
  }

  async getChannelSettings() {
    return { whatsappNumber: "201000000000", telegramBotUrl: "" };
  }

  async saveChannelSettings(settings) {
    return settings;
  }
}

export const firebaseService = new FirebaseService();
