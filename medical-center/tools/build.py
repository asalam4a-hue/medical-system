import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
web = root / "web"
rd = lambda n: (web / n).read_text(encoding="utf-8")
seed = (root / "tools/seed.json").read_text(encoding="utf-8")
import base64
def gas_wrap(html):
    # جوجل (HtmlService) يعدّل بعض النصوص داخل الصفحة فيكسر الأكواد؛ نحمّل التطبيق كنص Base64 ونُنفّذه بالمتصفح فلا يلمسه جوجل
    b = base64.b64encode(html.encode("utf-8")).decode("ascii")
    parts = ",\n".join('"%s"' % b[i:i + 60000] for i in range(0, len(b), 60000))
    return ('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>برنامج إدارة المركز الطبي</title>'
      '<script>var P=[' + parts + '];(function(){try{var b=atob(P.join("")),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);var h=new TextDecoder("utf-8").decode(u),d=new DOMParser().parseFromString(h,"text/html");'
      'window.__boot=function(){document.title=d.title||document.title;[].forEach.call(d.querySelectorAll("style"),function(s){var n=document.createElement("style");n.textContent=s.textContent;document.head.appendChild(n)});'
      'var sc=[].slice.call(d.querySelectorAll("script"));sc.forEach(function(s){s.parentNode.removeChild(s)});document.body.innerHTML=d.body.innerHTML;'
      'sc.forEach(function(s){var n=document.createElement("script");n.text=s.textContent;document.body.appendChild(n)})};}catch(e){window.__bootErr=e}})();</script></head>'
      '<body><div style="font:16px sans-serif;text-align:center;padding:40px">جاري التحميل…</div>'
      '<script>if(window.__boot)window.__boot();else document.body.innerText="فشل التحميل: "+(window.__bootErr&&window.__bootErr.message)</script></body></html>')
def build(mode, out, extra=""):
    html = rd("index.html")
    css = "<style>\n" + rd("app.css") + "\n</style>"
    js = "<script>window.API_MODE='%s';window.SEED=%s;%s</script>\n" % (mode, seed, extra)
    for f in ("api.js", "core.js", "screens.js", "reports.js", "details.js", "dues.js", "cash.js", "journal.js", "admin.js", "ocr.js", "export.js"):
        js += "<script>\n" + rd(f).replace("</script", "<\\/script") + "\n</script>\n"
    html = html.replace("<!--CSS-->", css).replace("<!--SCRIPTS-->", js)
    if mode == "gas": html = gas_wrap(html)
    p = root / out; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(html, encoding="utf-8")
    print(out, len(html) // 1024, "KB")
GAS_URL = json.loads((root / "server.json").read_text(encoding="utf-8"))["url"]  # مصدر واحد للرابط (server.json)
build("php", "php/index.html", "window.API_URL=%s;" % json.dumps(GAS_URL))
build("gas", "gas/Index.html")
build("local", "demo/index.html")
import shutil; (root / "android/app/src/main/assets").mkdir(parents=True, exist_ok=True); shutil.copy(root / "php/index.html", root / "android/app/src/main/assets/index.html")
(root / "gas/Seed.gs").write_text("var SEED = " + seed + ";\n", encoding="utf-8")
(root / "gas/appsscript.json").write_text(json.dumps({
  "timeZone": "Africa/Cairo", "exceptionLogging": "STACKDRIVER", "runtimeVersion": "V8",
  "oauthScopes": ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
  "webapp": {"executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS"}}, indent=2), encoding="utf-8")
