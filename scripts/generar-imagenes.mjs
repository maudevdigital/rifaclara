// Genera web/public/og.png (vista previa al compartir, 1200×630) y
// web/public/apple-touch-icon.png (180×180) a partir de HTML con la marca.
// Uso: node scripts/generar-imagenes.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const publico = fileURLToPath(new URL("../web/public/", import.meta.url));
const fuentes = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@500&family=JetBrains+Mono:wght@500;600&display=swap">`;
const marca = `<span style="position:relative;display:grid;place-items:center;width:64px;height:64px;border-radius:16px;background:#1d6359">
  <svg viewBox="0 0 16 16" width="34" height="34" fill="none"><path d="M3.5 8.4 6.6 11.4 12.5 4.8" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;

const vendidos = new Set([1, 2, 4, 5, 8, 9, 10, 12, 13, 15, 16, 18, 19, 21, 22, 24, 26, 27, 29, 30, 31, 33, 34, 36, 37, 39]);
const celdas = Array.from({ length: 40 }, (_, n) => {
  const estilo = n === 7 || n === 23 ? "background:#e9b949;border-color:#e9b949;color:#2a1f00;font-weight:600"
    : vendidos.has(n) ? "background:#e6eee9;border-color:transparent;color:#8fa39b" : "background:#fff;border-color:#d8e0db;color:#13302c";
  return `<span style="display:grid;place-items:center;aspect-ratio:1;border:1.5px solid;border-radius:9px;font:500 20px 'JetBrains Mono';${estilo}">${String(n).padStart(2, "0")}</span>`;
}).join("");

const og = `<html><head>${fuentes}</head><body style="margin:0;width:1200px;height:630px;background:#faf8f3;font-family:Inter;color:#13302c;display:grid;grid-template-columns:1.15fr .85fr;gap:56px;padding:70px 76px;box-sizing:border-box;align-items:center">
  <div style="display:grid;gap:30px">
    <div style="display:flex;align-items:center;gap:18px;font:700 38px Sora">${marca}Rifa Clara</div>
    <div style="font:600 64px/1.04 Sora;letter-spacing:-.02em">Rifas online con un sorteo que <span style="color:#1d6359">cualquiera puede comprobar</span></div>
    <div style="font:500 26px Inter;color:#57645f">Gratis hasta 100 números · sin comisión</div>
    <div style="font:600 22px 'JetBrains Mono';color:#1d6359">rifaclara.maudev.cl</div>
  </div>
  <div style="display:grid;gap:14px;background:#fff;border:1.5px solid #d8e0db;border-radius:28px;padding:26px;box-shadow:0 24px 60px rgba(10,40,35,.12)">
    <div style="height:10px;border-radius:9px;background:#e6eee9;overflow:hidden"><b style="display:block;height:100%;width:65%;background:#23845a;border-radius:9px"></b></div>
    <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:8px">${celdas}</div>
    <div style="font:600 18px Inter;color:#23845a">✓ Lista sellada · sorteo verificable</div>
  </div>
</body></html>`;

const icono = `<html><body style="margin:0;width:180px;height:180px;background:#1d6359;display:grid;place-items:center">
  <svg viewBox="0 0 16 16" width="104" height="104" fill="none"><path d="M3.5 8.4 6.6 11.4 12.5 4.8" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></body></html>`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1200, height: 630 } });
await pagina.setContent(og, { waitUntil: "networkidle" });
await pagina.screenshot({ path: publico + "og.png" });
await pagina.setViewportSize({ width: 180, height: 180 });
await pagina.setContent(icono);
await pagina.screenshot({ path: publico + "apple-touch-icon.png" });
await navegador.close();
console.log("Listo: web/public/og.png y web/public/apple-touch-icon.png");
