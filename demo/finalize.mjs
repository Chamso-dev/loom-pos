/**
 * Turns the Vite output into files that run anywhere:
 * - dist-demo/loompos-demo.html: a complete page to open from disk on a PC or phone.
 * - dist-demo/artifact.html: the same page as a fragment for hosts that add their own
 *   <html>/<head>/<body> wrapper.
 * The app script runs as a classic script at the end of the page, and a small fallback
 * explains the problem instead of leaving a blank screen if the browser cannot start it.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const dir = new URL('../dist-demo/', import.meta.url)
const html = readFileSync(new URL('index.html', dir), 'utf8')

const pick = (re) => [...html.matchAll(re)].map((m) => m[0])
const title = pick(/<title>[\s\S]*?<\/title>/g)[0] ?? '<title>LoomPOS</title>'
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g).join('\n')
const scripts = pick(/<script\b[^>]*>[\s\S]*?<\/script>/g)
if (scripts.length !== 1) throw new Error(`Expected one inlined script, found ${scripts.length}`)
const app = scripts[0].replace(/^<script\b[^>]*>/, '<script>')

const fallback = `<script>
(function () {
  setTimeout(function () {
    var root = document.getElementById('root');
    if (root && !root.firstChild) {
      root.innerHTML = '<div style="font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;line-height:1.5">' +
        '<h1 style="font-size:1.25rem">LoomPOS could not start</h1>' +
        '<p>This browser blocked or could not run the app. Open the file in an up-to-date Chrome, Edge, Firefox or Safari.</p>' +
        '<p dir="rtl" lang="ar">تعذّر تشغيل LoomPOS في هذا المتصفح. افتح الملف في نسخة حديثة من Chrome أو Edge أو Firefox أو Safari.</p></div>';
    }
  }, 8000);
})();
</script>`

const description = '<meta name="description" content="LoomPOS for Algerian shops: Arabic and English, DZD, CIB, Edahabia, BaridiMob and customer credit.">'
const body = `<div id="root"></div>\n${fallback}\n${app}`

writeFileSync(
  new URL('loompos-demo.html', dir),
  `<!doctype html>
<html lang="ar-DZ" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${title}
${description}
${styles}
</head>
<body>
${body}
</body>
</html>
`
)
writeFileSync(new URL('artifact.html', dir), `${title}\n${description}\n${styles}\n${body}\n`)
console.log('Wrote dist-demo/loompos-demo.html and dist-demo/artifact.html')
