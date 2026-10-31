package com.zahraa.clinic

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.MediaStore
import android.util.Base64
import android.view.View
import android.view.ViewGroup
import android.webkit.*
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ProgressBar
import androidx.core.content.FileProvider
import java.io.File

/** غلاف WebView يفتح برنامج المركز الطبي (نسخة PHP أو Google Apps Script) بعنوان يحدده المستخدم. */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var bar: ProgressBar
    private var chooserCb: ValueCallback<Array<Uri>>? = null
    private var cameraUri: Uri? = null
    private val DEFAULT_URL = "https://zahraaclinic.free.nf"
    private val reqFile = 41
    private val reqCam = 42

    private val serverUrl get() = DEFAULT_URL

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val root = FrameLayout(this)
        web = WebView(this)
        bar = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { max = 100; visibility = View.GONE }
        root.addView(web, ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        root.addView(bar, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 8))
        setContentView(root)
        setup()
        web.loadUrl(serverUrl)
    }

    private fun setup() {
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
        }
        web.addJavascriptInterface(object {
            @JavascriptInterface fun print() = runOnUiThread {
                val pm = getSystemService(Context.PRINT_SERVICE) as PrintManager
                pm.print("تقرير", web.createPrintDocumentAdapter("تقرير"), PrintAttributes.Builder().build())
            }
            @JavascriptInterface fun saveFile(name: String, mime: String, b64: String) = runOnUiThread {
                val dir = File(cacheDir, "exports").apply { mkdirs() }
                val f = File(dir, name.replace(Regex("[^\\w.\\- \\u0600-\\u06FF]"), "_"))
                f.writeBytes(Base64.decode(b64, Base64.DEFAULT))
                val uri = FileProvider.getUriForFile(this@MainActivity, "com.zahraa.clinic.files", f)
                startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = mime; putExtra(Intent.EXTRA_STREAM, uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) }, "حفظ / مشاركة الملف"))
            }
        }, "AndroidBridge")
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                val host = Uri.parse(serverUrl).host
                val ok = r.url.host == host || r.url.host?.endsWith("google.com") == true || r.url.host?.endsWith("googleusercontent.com") == true
                if (!ok) { startActivity(Intent(Intent.ACTION_VIEW, r.url)); return true }
                return false
            }
            override fun onPageStarted(v: WebView?, u: String?, f: Bitmap?) { bar.visibility = View.VISIBLE }
            override fun onPageFinished(v: WebView?, u: String?) { bar.visibility = View.GONE }
            override fun onReceivedError(v: WebView, r: WebResourceRequest, e: WebResourceError) {
                if (r.isForMainFrame) retryDialog("تعذر الاتصال بالخادم: ${e.description}")
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(v: WebView?, p: Int) { bar.progress = p }
            override fun onShowFileChooser(v: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                chooserCb?.onReceiveValue(null); chooserCb = cb; pickImage(); return true
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // عند العودة للتطبيق: مزامنة فورية لتظهر أي تغييرات حدثت من الويب أو السكريبت أو مستخدم آخر
        if (::web.isInitialized) web.evaluateJavascript("window.__syncNow && window.__syncNow()", null)
    }

    private fun retryDialog(msg: String) {
        AlertDialog.Builder(this).setTitle("لا يوجد اتصال").setMessage(msg).setCancelable(false)
            .setPositiveButton("إعادة المحاولة") { _, _ -> web.loadUrl(serverUrl) }
            .setNegativeButton("إغلاق", null).show()
    }

    /** اختيار صورة من المعرض أو الكاميرا (لصور البطاقات والنماذج والكارنيهات). */
    private fun pickImage() {
        val gallery = Intent(Intent.ACTION_GET_CONTENT).apply { type = "image/*"; addCategory(Intent.CATEGORY_OPENABLE) }
        val extra = ArrayList<Intent>()
        if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            val dir = File(cacheDir, "photos").apply { mkdirs() }
            val f = File.createTempFile("cam", ".jpg", dir)
            cameraUri = FileProvider.getUriForFile(this@MainActivity, "com.zahraa.clinic.files", f)
            extra.add(Intent(MediaStore.ACTION_IMAGE_CAPTURE).putExtra(MediaStore.EXTRA_OUTPUT, cameraUri))
        } else requestPermissions(arrayOf(Manifest.permission.CAMERA), reqCam)
        val chooser = Intent.createChooser(gallery, "إرفاق صورة").putExtra(Intent.EXTRA_INITIAL_INTENTS, extra.toTypedArray())
        try { startActivityForResult(chooser, reqFile) } catch (e: Exception) { chooserCb?.onReceiveValue(null); chooserCb = null }
    }

    override fun onRequestPermissionsResult(c: Int, p: Array<out String>, r: IntArray) { /* الكاميرا اختيارية: تظهر عند الإرفاق التالي */ }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(c: Int, res: Int, data: Intent?) {
        if (c != reqFile) return super.onActivityResult(c, res, data)
        val uri = if (res == RESULT_OK) (data?.data ?: cameraUri) else null
        chooserCb?.onReceiveValue(if (uri != null) arrayOf(uri) else null); chooserCb = null
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        web.evaluateJavascript("(function(){try{if(S.user&&S.screen!=='home'){back();return 1}}catch(e){}return 0})()") { r ->
            if (r != "1") super.onBackPressed()
        }
    }

}
