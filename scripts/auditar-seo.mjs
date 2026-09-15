// Auditoría SEO: recorre el sitemap y revisa cada página y cada enlace interno.
// Uso: node scripts/auditar-seo.mjs [base]   (base por defecto: el sitio en producción)
//      node scripts/auditar-seo.mjs http://127.0.0.1:8788
const SITIO = "https://rifaclara.maudev.cl";
const base = (process.argv[2] ?? SITIO).replace(/\/$/, "");
const local = (url) => url.replace(SITIO, base);

const problemas = [];
const avisar = (url, texto) => problemas.push(`${url.replace(base, "") || "/"} → ${texto}`);
const traer = async (url, opciones) => {
  for (let i = 0; i < 3; i++) {
    try { return await fetch(url, { redirect: "manual", ...opciones }); } catch { await new Promise((r) => setTimeout(r, 1000)); }
  }
  throw new Error(`No responde: ${url}`);
};
const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const atributo = (html, re) => html.match(re)?.[1]?.trim();

// 1. robots.txt y sitemaps
const robots = await (await traer(`${base}/robots.txt`)).text();
if (!robots.includes(`Sitemap: ${SITIO}/sitemap-index.xml`)) avisar(`${base}/robots.txt`, "no declara el sitemap");
const indice = await (await traer(`${base}/sitemap-index.xml`)).text();
const urls = [];
for (const s of locs(indice)) {
  const r = await traer(local(s));
  if (r.status !== 200) { avisar(local(s), `sitemap responde ${r.status}`); continue; }
  urls.push(...locs(await r.text()).map(local));
}
if (!urls.includes(`${base}/`)) avisar(`${base}/`, "la portada no está en el sitemap");

// 2. Cada página del sitemap
const enlaces = new Set();
const titulos = new Map();
const filas = [];
for (const url of urls) {
  const res = await traer(url);
  const html = res.status === 200 ? await res.text() : "";
  const ruta = new URL(url).pathname;
  const antes = problemas.length;
  if (res.status !== 200) { avisar(url, `responde ${res.status}`); filas.push([ruta, "✗"]); continue; }

  const titulo = atributo(html, /<title>([^<]*)<\/title>/);
  const descripcion = atributo(html, /<meta name="description" content="([^"]*)"/);
  const canonica = atributo(html, /<link rel="canonical" href="([^"]*)"/);
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length;
  if (!/<html lang="es-CL"/.test(html)) avisar(url, "falta lang=\"es-CL\"");
  if (!titulo) avisar(url, "sin <title>");
  else if (titulo.length < 20 || titulo.length > 65) avisar(url, `título de ${titulo.length} caracteres (ideal 20–65): "${titulo}"`);
  if (titulo) { if (titulos.has(titulo)) avisar(url, `título repetido con ${titulos.get(titulo)}`); titulos.set(titulo, ruta); }
  if (!descripcion) avisar(url, "sin meta description");
  else if (descripcion.length < 70 || descripcion.length > 165) avisar(url, `descripción de ${descripcion.length} caracteres (ideal 70–165)`);
  if (canonica !== SITIO + (ruta === "/" ? "/" : ruta)) avisar(url, `canónica distinta: ${canonica}`);
  if (/<meta name="robots" content="[^"]*noindex/.test(html)) avisar(url, "tiene noindex pero está en el sitemap");
  if (h1 !== 1) avisar(url, `${h1} etiquetas <h1> (debe haber una)`);
  for (const p of ["og:title", "og:description", "og:image", "og:url"]) {
    if (!new RegExp(`<meta property="${p}" content="[^"]+"`).test(html)) avisar(url, `falta ${p}`);
  }
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(json); } catch { avisar(url, "JSON-LD inválido"); }
  }
  for (const [img] of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt="/.test(img)) avisar(url, "imagen sin alt");
  for (const [, href] of html.matchAll(/<a\b[^>]*href="([^"#]+)/g)) {
    if (href.startsWith("/") || href.startsWith(SITIO)) enlaces.add(new URL(href, SITIO).pathname);
  }
  filas.push([ruta, problemas.length === antes ? "✓" : "✗"]);
}

// 3. Imagen para compartir
const og = await traer(`${base}/og.png`);
if (og.status !== 200 || !og.headers.get("content-type")?.includes("image/png")) avisar(`${base}/og.png`, `imagen para compartir responde ${og.status}`);

// 4. Enlaces internos: nada roto (redirecciones a /ingresar son esperables en el panel)
for (const ruta of [...enlaces].sort()) {
  const r = await traer(base + ruta);
  if (r.status >= 400) avisar(base + ruta, `enlace interno roto (${r.status})`);
}

// 5. Páginas privadas: fuera del sitemap y con noindex o redirección
for (const ruta of ["/ingresar", "/panel", "/panel/nueva", "/boleto/RC-AAAAA-BBBBB"]) {
  if (urls.some((u) => new URL(u).pathname === ruta)) avisar(base + ruta, "página privada dentro del sitemap");
  const r = await traer(base + ruta);
  const html = r.status < 300 || r.status === 404 ? await r.text() : "";
  if (r.status < 300 && !/noindex/.test(html)) avisar(base + ruta, "página privada sin noindex");
}

console.log(`Auditoría SEO de ${base}: ${urls.length} páginas en el sitemap, ${enlaces.size} enlaces internos revisados\n`);
for (const [ruta, estado] of filas) console.log(`  ${estado} ${ruta}`);
if (problemas.length) {
  console.log(`\n${problemas.length} problemas:`);
  for (const p of problemas) console.log(`  ✗ ${p}`);
  process.exitCode = 1;
} else {
  console.log("\nSin problemas.");
}
