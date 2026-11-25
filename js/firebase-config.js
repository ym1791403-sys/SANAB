// Firebase Project Configuration for طبيب الغيط (Tabib El-Gheit)
// Connected Project: senap-d4a15

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBXviTNH4nVLSezWBh5FBxCNuJumu5JRCQ",
  authDomain: "senap-d4a15.firebaseapp.com",
  projectId: "senap-d4a15",
  storageBucket: "senap-d4a15.firebasestorage.app",
  messagingSenderId: "417838476170",
  appId: "1:417838476170:web:c55be5e12946e8beb5f673",
  measurementId: "G-S230MMYYC0"
};

const STORAGE_KEY_FB = "tabib_el_gheit_firebase_config";
const STORAGE_KEY_AI = "tabib_el_gheit_ai_config";

export function loadFirebaseConfig() {
  if (typeof window !== "undefined" && window.__TABIB_FIREBASE_CONFIG__?.apiKey && window.__TABIB_FIREBASE_CONFIG__?.projectId) {
    return window.__TABIB_FIREBASE_CONFIG__;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FB);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.apiKey && parsed?.projectId) return parsed;
    }
  } catch (_) {}
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveFirebaseConfig(configObj) {
  localStorage.setItem(STORAGE_KEY_FB, JSON.stringify(configObj));
}

export function clearFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEY_FB);
}

export function loadAIConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_AI);
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return {
    provider: "backend", // "backend" | "gemini" | "custom"
    geminiApiKey: "",
    geminiModel: "gemini-2.5-flash",
    customEndpoint: ""
  };
}

export function saveAIConfig(cfg) {
  localStorage.setItem(STORAGE_KEY_AI, JSON.stringify(cfg));
}
