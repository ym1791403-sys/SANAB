// Real Open-Meteo Weather Service + Agronomic Spraying Advisory (Zero Fake Weather!)

export const GOVERNORATES = [
  { id: "cairo", ar: "القاهرة", en: "Cairo", lat: 30.0444, lon: 31.2357 },
  { id: "giza", ar: "الجيزة", en: "Giza", lat: 30.0131, lon: 31.2089 },
  { id: "dakahlia", ar: "الدقهلية (المنصورة)", en: "Dakahlia (Mansoura)", lat: 31.0409, lon: 31.3785 },
  { id: "sharkia", ar: "الشرقية (الزقازيق)", en: "Sharkia (Zagazig)", lat: 30.5877, lon: 31.5020 },
  { id: "beheira", ar: "البحيرة (دمنهور)", en: "Beheira (Damanhour)", lat: 31.0341, lon: 30.4682 },
  { id: "gharbia", ar: "الغربية (طنطا)", en: "Gharbia (Tanta)", lat: 30.7865, lon: 31.0004 },
  { id: "menoufia", ar: "المنوفية (شبين الكوم)", en: "Menoufia (Shebin El-Kom)", lat: 30.5526, lon: 31.0090 },
  { id: "kafr-el-sheikh", ar: "كفر الشيخ", en: "Kafr El-Sheikh", lat: 31.1107, lon: 30.9388 },
  { id: "fayoum", ar: "الفيوم", en: "Fayoum", lat: 29.3084, lon: 30.8428 },
  { id: "minya", ar: "المنيا", en: "Minya", lat: 28.1099, lon: 30.7503 },
  { id: "assiut", ar: "أسيوط", en: "Assiut", lat: 27.1809, lon: 31.1837 },
  { id: "qena", ar: "قنا", en: "Qena", lat: 26.1551, lon: 32.7160 },
  { id: "ismailia", ar: "الإسماعيلية", en: "Ismailia", lat: 30.5965, lon: 32.2715 },
  { id: "alexandria", ar: "الإسكندرية", en: "Alexandria", lat: 31.2001, lon: 29.9187 }
];

const WEATHER_CODE_MAP = {
  0: { ar: "سماء صافية ومشمسة", en: "Clear & Sunny", icon: "☀️" },
  1: { ar: "غائم جزئياً بشكل خفيف", en: "Mainly Clear", icon: "🌤️" },
  2: { ar: "غائم جزئياً", en: "Partly Cloudy", icon: "⛅" },
  3: { ar: "غائم كلياً", en: "Overcast", icon: "☁️" },
  45: { ar: "ضباب / شبورة", en: "Foggy", icon: "🌫️" },
  48: { ar: "شبورة كثيفة", en: "Depositing Rime Fog", icon: "🌫️" },
  51: { ar: "رذاذ خفيف", en: "Light Drizzle", icon: "🌦️" },
  53: { ar: "رذاذ متوسط", en: "Moderate Drizzle", icon: "🌦️" },
  61: { ar: "أمطار خفيفة", en: "Light Rain", icon: "🌧️" },
  63: { ar: "أمطار متوسطة", en: "Moderate Rain", icon: "🌧️" },
  65: { ar: "أمطار غزيرة", en: "Heavy Rain", icon: "⛈️" },
  80: { ar: "زخات مطر خفيفة", en: "Rain Showers", icon: "🌦️" },
  95: { ar: "عاصفة رعدية", en: "Thunderstorm", icon: "⛈️" }
};

export async function fetchLiveWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Weather API error: ${res.status}`);
  }
  const data = await res.json();
  const c = data.current || {};
  return {
    temp: Math.round(c.temperature_2m ?? 0),
    humidity: Math.round(c.relative_humidity_2m ?? 0),
    windSpeed: Math.round(c.wind_speed_10m ?? 0),
    precipitation: Number(c.precipitation ?? 0),
    weatherCode: Number(c.weather_code ?? 0),
    observedAt: c.time || new Date().toISOString()
  };
}

export function describeWeatherCode(code, lang = "ar") {
  const entry = WEATHER_CODE_MAP[code] || { ar: "طقس متقلب", en: "Variable Weather", icon: "🌤️" };
  return { text: entry[lang] || entry.ar, icon: entry.icon };
}

export function computeSprayingAdvice(w, lang = "ar") {
  if (w.precipitation > 0.2 || [51, 53, 61, 63, 65, 80, 95].includes(w.weatherCode)) {
    return lang === "ar"
      ? "توجد أمطار حالياً: يُنصح بتأجيل الرش الورقي والمبيدات حتى جفاف الأوراق لمنع غسل المحلول."
      : "Active rain detected: Postpone foliar spraying until leaves dry to prevent wash-off.";
  }
  if (w.windSpeed > 18) {
    return lang === "ar"
      ? `سرعة الرياح مرتفعة (${w.windSpeed} كم/س): تجنب الرش الآن لمنع تطاير المبيد وفقدانه.`
      : `High wind speed (${w.windSpeed} km/h): Avoid spraying now to prevent chemical drift.`;
  }
  if (w.temp >= 34) {
    return lang === "ar"
      ? `درجة الحرارة مرتفعة (${w.temp}° م): أجّل الرش للصباح الباكر أو قبل الغروب لتفادي احتراق الأوراق.`
      : `High temperature (${w.temp}°C): Delay spraying to early morning or sunset to avoid leaf scorch.`;
  }
  if (w.humidity >= 80) {
    return lang === "ar"
      ? `الرطوبة مرتفعة (${w.humidity}%): راقب المحصول لظهور الأمراض الفطرية مثل اللفحة المتأخرة والبياض الزغبي.`
      : `High humidity (${w.humidity}%): Monitor closely for fungal diseases like Late Blight and Downy Mildew.`;
  }
  return lang === "ar"
    ? `سرعة الرياح هادئة (${w.windSpeed} كم/س) والحرارة مناسبة (${w.temp}° م): الوقت جيد للرش الوقائي والعمليات الحقلية.`
    : `Calm winds (${w.windSpeed} km/h) and mild temperature (${w.temp}°C): Suitable conditions for preventive spraying.`;
}
