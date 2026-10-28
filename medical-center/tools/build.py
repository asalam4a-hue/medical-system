import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
web = root / "web"
rd = lambda n: (web / n).read_text(encoding="utf-8")
seed = (root / "tools/seed.json").read_text(encoding="utf-8")
def build(mode, out, extra=""):
    html = rd("index.html")
    css = "<style>\n" + rd("app.css") + "\n</style>"
    js = "<script>window.API_MODE='%s';window.SEED=%s;%s</script>\n" % (mode, seed, extra)
    for f in ("api.js", "core.js", "screens.js", "reports.js", "details.js", "dues.js", "export.js"):
        js += "<script>\n" + rd(f).replace("</script", "<\\/script") + "\n</script>\n"
    html = html.replace("<!--CSS-->", css).replace("<!--SCRIPTS-->", js)
    p = root / out; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(html, encoding="utf-8")
    print(out, len(html) // 1024, "KB")
build("php", "php/index.html")
build("gas", "gas/Index.html")
build("local", "demo/index.html")
(root / "gas/Seed.gs").write_text("var SEED = " + seed + ";\n", encoding="utf-8")
(root / "gas/appsscript.json").write_text(json.dumps({
  "timeZone": "Africa/Cairo", "exceptionLogging": "STACKDRIVER", "runtimeVersion": "V8",
  "oauthScopes": ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"],
  "webapp": {"executeAs": "USER_DEPLOYING", "access": "ANYONE_ANONYMOUS"}}, indent=2), encoding="utf-8")
