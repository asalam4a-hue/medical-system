# تطبيق الأندرويد
غلاف WebView يفتح البرنامج (نسخة PHP أو Google Script) مع دعم: إرفاق الصور من المعرض أو الكاميرا، الطباعة، زر الرجوع، وتغيير عنوان الخادم.

1. افتح المجلد `android` في **Android Studio** (سينشئ Gradle Wrapper تلقائياً).
2. **Build ← Build APK(s)** (أو Generate Signed Bundle للنشر).
3. عند أول تشغيل اكتب رابط البرنامج، مثال `https://your-site.com/clinic/` أو رابط Google Script.

الحد الأدنى Android 7.0 (API 24). الاتصال بـ http مسموح لشبكة المركز الداخلية، لكن يُفضّل HTTPS.
> لم يتم بناء الـ APK في بيئة العمل لعدم توفر Android SDK بها؛ الكود مكتوب ولم يُجرَّب على جهاز.
