/**
 * controllo.mjs — il pavimento tecnico, a 375, 768 e 1280 px
 *
 *     node scripts/controllo.mjs http://localhost:4193
 *
 * Prende il posto di `controllo-qualita/controllo.js`, citato in PIPELINE.md
 * ma che su questo PC non esiste (come tutta `03-libreria/`). Controlla:
 *
 * - contrasto del testo contro il primo fondo pieno risalendo gli antenati
 *   (4,5:1, oppure 3:1 da 24 px o da 18,66 px in grassetto). Non vede gli
 *   pseudo-elementi né le fotografie: quelle voci vanno misurate a mano
 *   (PROMPT-RIFINITURA, fase 5);
 * - bersagli cliccabili sotto i 24×24 px;
 * - trabocchi: la pagina più larga della finestra, e ogni elemento con
 *   scrollWidth > clientWidth (è così che si vede il `white-space: nowrap`,
 *   che non fa traboccare la pagina);
 * - immagini senza alt o senza width/height, o rotte;
 * - salti nei livelli dei titoli, ancore che non puntano a niente;
 * - ogni richiesta verso un host diverso da quello del sito.
 *
 * Esce con codice 1 se trova qualcosa.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [, , url = 'http://localhost:4193'] = process.argv;
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const LARGHEZZE = [
  { w: 375, h: 812, mobile: true },
  { w: 768, h: 1024, mobile: false },
  { w: 1280, h: 800, mobile: false },
];

const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=0',
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'controllo-'))}`,
  '--no-first-run', '--no-default-browser-check', 'about:blank',
]);
const wsUrl = await new Promise((ok, ko) => {
  chrome.stderr.on('data', (d) => { const m = String(d).match(/ws:\/\/[^\s]+/); if (m) ok(m[0]); });
  setTimeout(() => ko(new Error('Chrome non ha aperto il DevTools')), 15000);
});
const ws = new WebSocket(wsUrl);
await new Promise((ok) => ws.addEventListener('open', ok));
let id = 0;
const attese = new Map();
const richieste = new Set();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && attese.has(m.id)) { attese.get(m.id)(m); attese.delete(m.id); }
  if (m.method === 'Network.requestWillBeSent') richieste.add(m.params.request.url);
});
const invia = (method, params = {}, sessionId) => new Promise((ok, ko) => {
  const n = ++id;
  attese.set(n, (m) => (m.error ? ko(new Error(`${method}: ${m.error.message}`)) : ok(m.result)));
  ws.send(JSON.stringify({ id: n, method, params, sessionId }));
});
const { targetId } = await invia('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await invia('Target.attachToTarget', { targetId, flatten: true });
const s = (m, p) => invia(m, p, sessionId);
await s('Page.enable');
await s('Network.enable');

// Gira dentro la pagina. Restituisce l'elenco dei guasti a questa larghezza.
const esame = String.raw`(async () => {
  await document.fonts.ready;
  for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
  scrollTo(0, 0);
  await new Promise(r => setTimeout(r, 400));
  const guasti = [];
  const nome = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
  const rgb = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; let [r, g, b, a = 1] = m.map(Number); if (c.startsWith('color(srgb')) { r *= 255; g *= 255; b *= 255; } return [r, g, b, +a]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const fondo = (el) => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none' && e !== document.body) return 'immagine'; const c = rgb(cs.backgroundColor); if (c && c[3] > 0.9) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };

  // contrasto: ogni elemento con testo proprio visibile
  for (const el of document.querySelectorAll('body *')) {
    const testo = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).length;
    if (!testo) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const f = fondo(el);
    if (f === 'immagine') { guasti.push('da misurare a mano (testo su immagine): ' + nome(el)); continue; }
    const c = rgb(cs.color);
    const L1 = lum(c), L2 = lum(f);
    const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize), grassetto = +cs.fontWeight >= 700;
    const soglia = (px >= 24 || (grassetto && px >= 18.66)) ? 3 : 4.5;
    if (cr < soglia) guasti.push('contrasto ' + cr.toFixed(2) + ':1 < ' + soglia + ' — ' + nome(el) + ' «' + el.textContent.trim().slice(0, 40) + '»');
  }

  // bersagli
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea')) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (getComputedStyle(el).position === 'absolute' && r.width <= 1) continue;
    if (r.width < 24 || r.height < 24) guasti.push('bersaglio ' + Math.round(r.width) + '×' + Math.round(r.height) + ' px — ' + nome(el) + ' «' + el.textContent.trim().slice(0, 30) + '»');
  }

  // trabocchi
  if (document.documentElement.scrollWidth > innerWidth) guasti.push('la pagina è larga ' + document.documentElement.scrollWidth + ' px su ' + innerWidth);
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (['auto', 'scroll'].includes(cs.overflowX)) continue;
    // 6 px di tolleranza: un figlio ruotato di un grado o due sporge di un paio di
    // pixel e non è un guasto. Il nowrap invece si segnala sempre.
    const sporge = el.scrollWidth - el.clientWidth;
    if (el.clientWidth > 0 && cs.display !== 'inline' && (sporge > 6 || (sporge > 1 && cs.whiteSpace === 'nowrap'))) guasti.push('trabocca ' + el.scrollWidth + ' in ' + el.clientWidth + ' px — ' + nome(el));
  }

  // immagini
  for (const img of document.images) {
    if (!img.hasAttribute('alt')) guasti.push('immagine senza alt: ' + img.currentSrc);
    if (!img.getAttribute('width') || !img.getAttribute('height')) guasti.push('immagine senza misure: ' + img.currentSrc);
    if (img.complete && img.naturalWidth === 0) guasti.push('immagine rotta: ' + img.src);
    // Con srcset e descrittori «w» naturalWidth è corretto per la densità: la
    // larghezza vera del file si legge ricaricandolo da solo.
    const vero = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth); i.onerror = () => ok(0); i.src = img.currentSrc || img.src; });
    const r = img.getBoundingClientRect();
    if (vero && r.width * devicePixelRatio > vero * 1.05) guasti.push('immagine mostrata oltre la sua misura: ' + img.currentSrc.split('/').pop() + ' ' + vero + ' px per ' + Math.round(r.width * devicePixelRatio) + ' px fisici');
  }

  // titoli e ancore
  let prima = 0;
  for (const h of document.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    const n = +h.tagName[1];
    if (prima && n > prima + 1) guasti.push('salto di titolo h' + prima + ' → h' + n + ': «' + h.textContent.trim().slice(0, 30) + '»');
    prima = n;
  }
  if (document.querySelectorAll('h1').length !== 1) guasti.push('h1 presenti: ' + document.querySelectorAll('h1').length);
  for (const a of document.querySelectorAll('a[href^="#"]')) {
    const id = a.getAttribute('href').slice(1);
    if (id && !document.getElementById(id)) guasti.push('ancora morta: #' + id);
  }
  return guasti;
})()`;

let totale = 0;
const host = new URL(url).host;
for (const { w, h, mobile } of LARGHEZZE) {
  await s('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
  await s('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 1500));
  const { result } = await s('Runtime.evaluate', { expression: esame, awaitPromise: true, returnByValue: true });
  const guasti = result.value ?? [`errore: ${JSON.stringify(result)}`];
  const veri = guasti.filter((g) => !g.startsWith('da misurare a mano'));
  totale += veri.length;
  console.log(`\n── ${w} px ── ${veri.length ? veri.length + ' guasti' : 'pulito'}`);
  for (const g of [...new Set(guasti)]) console.log('  ' + g);
}

const esterne = [...richieste].filter((r) => !r.startsWith('data:') && new URL(r).host !== host);
console.log(`\n── richieste verso terzi ── ${esterne.length || 'nessuna'}`);
for (const r of esterne) console.log('  ' + r);
totale += esterne.length;

ws.close();
chrome.kill();
process.exit(totale ? 1 : 0);
