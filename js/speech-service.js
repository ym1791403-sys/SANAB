// Real Web Speech API service for "اسمع التشخيص" (accessible audio readout for farmers)

class SpeechService {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.isSpeaking = false;
    this.onStateChange = null;
  }

  isSupported() {
    return Boolean(this.synth && typeof SpeechSynthesisUtterance !== "undefined");
  }

  pickVoice(lang = "ar") {
    if (!this.synth) return null;
    const voices = this.synth.getVoices() || [];
    if (lang === "ar") {
      return (
        voices.find(v => v.lang.toLowerCase().startsWith("ar-eg")) ||
        voices.find(v => v.lang.toLowerCase().startsWith("ar-sa")) ||
        voices.find(v => v.lang.toLowerCase().startsWith("ar")) ||
        null
      );
    }
    return (
      voices.find(v => v.lang.toLowerCase().startsWith("en-us")) ||
      voices.find(v => v.lang.toLowerCase().startsWith("en")) ||
      null
    );
  }

  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.isSpeaking = false;
    if (this.onStateChange) this.onStateChange(false);
  }

  speak(text, lang = "ar", onEndCallback = null) {
    if (!this.isSupported()) {
      return false;
    }
    this.stop();

    const cleanText = String(text || "").replace(/[#*_`]/g, " ").trim();
    if (!cleanText) return false;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = lang === "ar" ? "ar-EG" : "en-US";
    utterance.rate = lang === "ar" ? 0.94 : 1.0;
    utterance.pitch = 1.0;

    const voice = this.pickVoice(lang);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (this.onStateChange) this.onStateChange(true);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (this.onStateChange) this.onStateChange(false);
      if (onEndCallback) onEndCallback();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      if (this.onStateChange) this.onStateChange(false);
      if (onEndCallback) onEndCallback();
    };

    this.synth.speak(utterance);
    return true;
  }

  formatReportSpeech(report, lang = "ar") {
    if (!report) return "";
    if (lang === "ar") {
      const bio = (report.bioTreatment || []).join("، ");
      const chem = (report.chemTreatment || []).join("، ");
      const prev = (report.prevention || []).join("، ");
      return [
        `تقرير تشخيص المحصول. تشخيص مبدئي استرشادي.`,
        `المحصول: ${report.cropName || "غير محدد"}.`,
        `الحالة المحتملة: ${report.diseaseName}. درجة الخطورة: ${report.severityText || ""}.`,
        report.symptoms ? `الأعراض الملاحظة: ${report.symptoms}.` : "",
        bio ? `العلاج الحيوي والوقائي الآمن للتربة: ${bio}.` : "",
        chem ? `العلاج الكيميائي والمبيدات المعتمدة: ${chem}.` : "",
        prev ? `إرشادات وقائية: ${prev}.` : "",
        `تنبيه مهم: هذه نتيجة مبدئية استرشادية، يُنصح بمراجعة مهندس زراعي قبل رش أي مبيد.`
      ].filter(Boolean).join(" ");
    }
    const bio = (report.bioTreatment || []).join(", ");
    const chem = (report.chemTreatment || []).join(", ");
    const prev = (report.prevention || []).join(", ");
    return [
      `Crop Diagnosis Report. Preliminary advisory screening.`,
      `Crop: ${report.cropName || "Plant"}.`,
      `Likely condition: ${report.diseaseName}. Severity: ${report.severityText || ""}.`,
      report.symptoms ? `Observed symptoms: ${report.symptoms}.` : "",
      bio ? `Biological and preventive treatment: ${bio}.` : "",
      chem ? `Chemical treatment: ${chem}.` : "",
      prev ? `Prevention guidelines: ${prev}.` : "",
      `Important notice: this is a preliminary AI screening. Consult an agronomist before spraying.`
    ].filter(Boolean).join(" ");
  }
}

export const speechService = new SpeechService();
