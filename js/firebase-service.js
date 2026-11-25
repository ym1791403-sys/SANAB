// Real Firebase v11 Modular SDK Integration (Auth + Cloud Firestore + Storage)
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

  async init(customConfig = null) {
    const cfg = customConfig || loadFirebaseConfig();
    if (!cfg || !cfg.apiKey || !cfg.projectId) {
      this.isReady = false;
      return { ready: false, reason: "missing_config" };
    }

    try {
      // Clean previous app instance if reconfiguring at runtime
      for (const existing of getApps()) {
        await deleteApp(existing);
      }

      this.app = initializeApp(cfg);
      this.auth = getAuth(this.app);
      this.db = getFirestore(this.app);
      this.storage = cfg.storageBucket ? getStorage(this.app) : null;
      this.isReady = true;
      this.lastError = null;
      return { ready: true, projectId: cfg.projectId };
    } catch (err) {
      this.isReady = false;
      this.lastError = err.message;
      return { ready: false, error: err.message };
    }
  }

  requireReady() {
    if (!this.isReady || !this.auth || !this.db) {
      throw new Error("FIREBASE_NOT_CONFIGURED");
    }
  }

  listenAuth(callback) {
    if (!this.isReady || !this.auth) {
      callback(null, null);
      return () => {};
    }
    if (this.unsubAuth) this.unsubAuth();
    this.unsubAuth = onAuthStateChanged(this.auth, async (user) => {
      if (!user) {
        callback(null, null);
        return;
      }
      const profile = await this.getUserProfile(user.uid, user);
      callback(user, profile);
    });
    return this.unsubAuth;
  }

  async getUserProfile(uid, authUser = null) {
    this.requireReady();
    const userRef = doc(this.db, "users", uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return { uid, ...snap.data() };
    }
    // Create default profile if authenticated via Google for the first time
    const fallbackProfile = {
      uid,
      name: authUser?.displayName || authUser?.email?.split("@")[0] || "مستخدم جديد",
      email: authUser?.email || "",
      accountType: "farmer",
      governorate: "cairo",
      favorites: [],
      learningStats: { points: 0, streak: 0, answeredIds: [] },
      createdAt: serverTimestamp()
    };
    await setDoc(userRef, fallbackProfile);
    return fallbackProfile;
  }

  async register({ email, password, name, accountType, governorate }) {
    this.requireReady();
    const cred = await createUserWithEmailAndPassword(this.auth, email, password);
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }
    const profile = {
      uid: cred.user.uid,
      name: name || email.split("@")[0],
      email,
      accountType: accountType || "farmer",
      governorate: governorate || "cairo",
      favorites: [],
      learningStats: { points: 0, streak: 0, answeredIds: [] },
      createdAt: serverTimestamp()
    };
    await setDoc(doc(this.db, "users", cred.user.uid), profile);
    return { user: cred.user, profile };
  }

  async login({ email, password, remember = true }) {
    this.requireReady();
    await setPersistence(
      this.auth,
      remember ? browserLocalPersistence : browserSessionPersistence
    );
    const cred = await signInWithEmailAndPassword(this.auth, email, password);
    const profile = await this.getUserProfile(cred.user.uid, cred.user);
    return { user: cred.user, profile };
  }

  async loginWithGoogle(accountType = "farmer", governorate = "cairo") {
    this.requireReady();
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(this.auth, provider);
    const userRef = doc(this.db, "users", cred.user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: cred.user.uid,
        name: cred.user.displayName || cred.user.email,
        email: cred.user.email || "",
        accountType,
        governorate,
        favorites: [],
        learningStats: { points: 0, streak: 0, answeredIds: [] },
        createdAt: serverTimestamp()
      });
    }
    const profile = await this.getUserProfile(cred.user.uid, cred.user);
    return { user: cred.user, profile };
  }

  async resetPassword(email) {
    this.requireReady();
    await sendPasswordResetEmail(this.auth, email);
  }

  async logout() {
    if (this.auth) {
      await signOut(this.auth);
    }
  }

  async updateUserProfile(uid, updates) {
    this.requireReady();
    await updateDoc(doc(this.db, "users", uid), updates);
  }

  // Upload image to Firebase Storage if enabled, otherwise compress safely for Firestore document
  async storeLeafImage(uid, dataUrl) {
    if (!dataUrl) return "";
    if (this.storage) {
      try {
        const path = `diagnoses/${uid}/${Date.now()}.jpg`;
        const fileRef = storageRef(this.storage, path);
        await uploadString(fileRef, dataUrl, "data_url");
        return await getDownloadURL(fileRef);
      } catch (err) {
        console.warn("Storage upload failed, falling back to compressed thumbnail:", err.message);
      }
    }
    return dataUrl; // already compressed JPEG thumbnail
  }

  // Diagnoses CRUD
  async saveDiagnosis(uid, report, thumbnailDataUrl = "") {
    this.requireReady();
    const imageUrl = thumbnailDataUrl ? await this.storeLeafImage(uid, thumbnailDataUrl) : "";
    const payload = {
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
      imageUrl,
      createdAtMs: Date.now(),
      createdAt: serverTimestamp()
    };
    const docRef = await addDoc(collection(this.db, "diagnoses"), payload);
    return { id: docRef.id, ...payload };
  }

  async getUserDiagnoses(uid) {
    this.requireReady();
    const q = query(collection(this.db, "diagnoses"), where("userId", "==", uid));
    const snap = await getDocs(q);
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    return items;
  }

  async deleteDiagnosis(id) {
    this.requireReady();
    await deleteDoc(doc(this.db, "diagnoses", id));
  }

  // Favorites & Learning Progress
  async toggleFavorite(uid, diseaseId, currentlyFav) {
    this.requireReady();
    await updateDoc(doc(this.db, "users", uid), {
      favorites: currentlyFav ? arrayRemove(diseaseId) : arrayUnion(diseaseId)
    });
  }

  async saveLearningProgress(uid, { points, streak, answeredId }) {
    this.requireReady();
    const updates = {
      "learningStats.points": points,
      "learningStats.streak": streak
    };
    if (answeredId) {
      updates["learningStats.answeredIds"] = arrayUnion(answeredId);
    }
    await updateDoc(doc(this.db, "users", uid), updates);
  }

  // Disease Encyclopedia & Quiz Firestore Sync + Seeder
  async getDiseasesFromFirestore() {
    if (!this.isReady) return null;
    try {
      const snap = await getDocs(collection(this.db, "diseases"));
      if (snap.empty) return null;
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn("Could not read diseases from Firestore:", err.message);
      return null;
    }
  }

  async getQuizFromFirestore() {
    if (!this.isReady) return null;
    try {
      const snap = await getDocs(collection(this.db, "quiz_questions"));
      if (snap.empty) return null;
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      return null;
    }
  }

  async seedKnowledgeBase() {
    this.requireReady();
    const batch = writeBatch(this.db);
    for (const d of DISEASES_DATA) {
      batch.set(doc(this.db, "diseases", d.id), d, { merge: true });
    }
    for (const q of QUIZ_QUESTIONS) {
      batch.set(doc(this.db, "quiz_questions", q.id), q, { merge: true });
    }
    await batch.commit();
    return { diseasesCount: DISEASES_DATA.length, quizCount: QUIZ_QUESTIONS.length };
  }

  // Real-time Consultations
  async createConsultation({ userId, userName, governorate, crop, subject, details, attachedReport = null, imageUrl = "" }) {
    this.requireReady();
    const docData = {
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
      createdAt: serverTimestamp()
    };
    const consultRef = await addDoc(collection(this.db, "consultations"), docData);
    await addDoc(collection(this.db, "consultations", consultRef.id, "messages"), {
      senderId: userId,
      senderName: userName,
      senderRole: "farmer",
      text: details,
      createdAtMs: Date.now(),
      createdAt: serverTimestamp()
    });
    return { id: consultRef.id, ...docData };
  }

  subscribeConsultations(uid, accountType, callback) {
    if (!this.isReady) {
      callback([]);
      return () => {};
    }
    if (this.unsubConsults) this.unsubConsults();

    const col = collection(this.db, "consultations");
    const q = accountType === "engineer"
      ? col
      : query(col, where("farmerId", "==", uid));

    this.unsubConsults = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      callback(list);
    }, (err) => {
      console.warn("Consultations snapshot error:", err.message);
      callback([]);
    });
    return this.unsubConsults;
  }

  subscribeMessages(consultationId, callback) {
    if (!this.isReady || !consultationId) return () => {};
    if (this.unsubMessages) this.unsubMessages();

    const q = query(
      collection(this.db, "consultations", consultationId, "messages"),
      orderBy("createdAtMs", "asc")
    );
    this.unsubMessages = onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return this.unsubMessages;
  }

  async sendConsultationMessage(consultationId, { senderId, senderName, senderRole, text }) {
    this.requireReady();
    await addDoc(collection(this.db, "consultations", consultationId, "messages"), {
      senderId,
      senderName,
      senderRole,
      text,
      createdAtMs: Date.now(),
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(this.db, "consultations", consultationId), {
      lastMessage: text,
      status: senderRole === "engineer" ? "answered" : "open",
      unreadForFarmer: senderRole === "engineer",
      unreadForEngineer: senderRole !== "engineer",
      createdAtMs: Date.now()
    });
  }

  async markConsultationRead(consultationId, accountType) {
    if (!this.isReady || !consultationId) return;
    try {
      await updateDoc(doc(this.db, "consultations", consultationId),
        accountType === "engineer"
          ? { unreadForEngineer: false }
          : { unreadForFarmer: false }
      );
    } catch (_) {}
  }

  async getChannelSettings() {
    if (!this.isReady) return null;
    try {
      const snap = await getDoc(doc(this.db, "settings", "channels"));
      return snap.exists() ? snap.data() : null;
    } catch (_) {
      return null;
    }
  }

  async saveChannelSettings({ whatsappNumber, telegramBotUrl }) {
    this.requireReady();
    await setDoc(doc(this.db, "settings", "channels"), {
      whatsappNumber: whatsappNumber || "",
      telegramBotUrl: telegramBotUrl || "",
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
}

export const firebaseService = new FirebaseService();
