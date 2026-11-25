# SANAB (Web Platform)

منصة ويب زراعية متكاملة لتشخيص أمراض النبات بالذكاء الاصطناعي (نتيجة استرشادية مبدئية)، موسوعة الآفات، الوضع التعليمي التفاعلي، واستشارات المهندسين الزراعيين عبر **Firebase** (Auth + Cloud Firestore + Storage).

## التشغيل السريع محلياً
```powershell
python server.py
```
ثم افتح المتصفح على: `http://127.0.0.1:8080`

## ربط قاعدة بيانات Firebase
1. افتح لوحة **Firebase Console** > Project Settings > Your apps > Web App.
2. انسخ كود `firebaseConfig` والصقه في ملف `js/firebase-config.js` (أو الصقه مباشرة من داخل الموقع عبر زر **«في انتظار ربط Firebase / إعدادات الربط»**).
3. فعّل **Authentication** (Email/Password + Google) و **Cloud Firestore** وطبق القواعد الموجودة في `firestore.rules`.
4. من داخل نافذة الإعدادات في الموقع اضغط **«تهيئة موسوعة الأمراض والاختبارات في Firestore»** لرفع بيانات الأمراض والاختبارات إلى قاعدة بياناتك.

## تفعيل التشخيص الحقيقي للصور (Vision AI)
- أضف `GEMINI_API_KEY` في ملف `.env` (أو أدخله من إعدادات الموقع في المتصفح)، أو اربط رابط نموذجك الخاص عبر `CUSTOM_VISION_URL`.
