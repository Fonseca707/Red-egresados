/*
  ─────────────────── LA PORTADA EN UN CELULAR, MEDIDA ────────────────────────

  La revisión móvil de este proyecto (vault: `movil-revision`) es del 2026-07-31
  y midió la portada VIEJA. La portada actual —el hero Samsung, sistema `.hp-*`—
  entró en producción el 2026-08-03, y encima el 2026-08-05 se le reescribió el
  copy. O sea: **lo que hoy ve la gente en su teléfono nunca se ha medido.**

  ── Por qué NO se reusa el arnés de iframe de aquella revisión ───────────────
  Aquel arnés (reemplazar el documento por un `<iframe>` de 390 px del mismo
  origen) resolvía un problema real —el Chrome de la extensión está clavado en
  1280 px— pero se le documentaron TRES trampas, y las tres son el mismo
  problema de fondo: **la página medida no está viva**.
    · La pestaña en segundo plano congela las animaciones CSS → un panel se leía
      como "fuera de la pantalla" cuando era su entrada parada en el frame 0.
    · `scrollIntoView({behavior:'smooth'})` no avanza en segundo plano → otro
      falso "no se ve".
    · El historial es compartido, así que el botón «atrás» no se puede probar.

  Aquí se emula el aparato de verdad por CDP (`Emulation.setDeviceMetricsOverride`
  con `mobile: true`, que es lo que hace que el navegador respete el meta
  viewport) en una pestaña en PRIMER PLANO. Las tres trampas desaparecen por
  construcción, no por acordarse de ellas. Y por si acaso, antes de medir se
  terminan las animaciones a mano.

  ── Qué se mide ─────────────────────────────────────────────────────────────
    1. DESBORDE HORIZONTAL y QUIÉN lo causa (etiqueta, clase, cuánto se sale).
       Es el fallo que se ve como "la pantalla se corre de lado".
    2. TOQUES PEQUEÑOS (<32 px) — pero comprobando el área que SE TOCA, no la
       caja que se dibuja: un control puede ampliar su zona sensible con un
       pseudo-elemento, y una vara que no distingue eso marca como rotos justo
       los que ya se arreglaron.
    3. TEXTO MINÚSCULO (<10.5 px) y CAMPOS por debajo de 16 px — esto último no
       es estética: Safari AMPLÍA la página al enfocar un campo con texto menor
       de 16 px y no vuelve solo.
    4. CONTENIDO TAPADO por la barra de navegación inferior (`fixed`), que en
       este proyecto ya se comió el pie de la portada una vez.
    5. QUE EL CÓDIGO FUNCIONE: errores de JavaScript, promesas rechazadas y
       recursos que no cargan (404, CORS, bloqueos). Una portada puede caber
       perfecta y estar rota por dentro.

  Uso:  node pruebas-movil.mjs [url]      · VER=1 para mirarlo con ventana
*/
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] ?? "https://sinapsisred.web.app";
const VER = process.env.VER === "1";
/* CAPTURAS=1 guarda el PNG de cada aparato. Un número dice que algo mide 24 px;
   la captura dice si eso se ve mal, que es lo que no se puede deducir. */
const CAPTURAS = process.env.CAPTURAS === "1";
const DIR_CAPTURAS = join(process.cwd(), ".capturas-movil");

/*
  Tres anchos, no uno. La revisión anterior midió solo 390 (iPhone), y el ancho
  más común de Android es 360: seis píxeles menos bastan para que algo que
  "cabía justo" deje de caber.
*/
const APARATOS = [
  ["Android 360", 360, 800, 3],
  ["iPhone 390", 390, 844, 3],
  ["iPhone Max 430", 430, 932, 3],
];

const PAGINAS = [["Portada", "/index.html"]];

const CHROMES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  "/usr/bin/google-chrome",
].filter(Boolean);

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pendientes = new Map();
    this.oyentes = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === undefined) {
        for (const o of this.oyentes) o(msg);
        return;
      }
      const p = this.pendientes.get(msg.id);
      if (!p) return;
      this.pendientes.delete(msg.id);
      msg.error ? p.no(new Error(msg.error.message)) : p.si(msg.result);
    });
  }
  static async abrir(url) {
    const ws = new WebSocket(url);
    await new Promise((si, no) => {
      ws.addEventListener("open", si, { once: true });
      ws.addEventListener("error", () => no(new Error("no abre el WebSocket de CDP")), { once: true });
    });
    return new Cdp(ws);
  }
  al(fn) {
    this.oyentes.push(fn);
  }
  enviar(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((si, no) => this.pendientes.set(id, { si, no }));
  }
  cerrar() {
    try {
      this.ws.close();
    } catch {}
  }
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarPuerto(puerto) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${puerto}/json/version`);
      if (r.ok) return r.json();
    } catch {}
    await dormir(250);
  }
  throw new Error("Chrome no abrió el puerto de depuración");
}

/* Corre DENTRO de la página: qué se sale solo lo sabe el navegador, que es
   quien ya resolvió la maquetación. */
const MEDIR = `(() => {
  const W = window.innerWidth;
  const doc = document.documentElement;

  const desborde = Math.max(doc.scrollWidth, document.body.scrollWidth) - W;

  /*
    ⚠️ LA VARA TIENE DOS LADOS, Y EL IZQUIERDO NO AVISA.

    scrollWidth solo crece con lo que se sale por la DERECHA: en una página de
    izquierda a derecha el navegador no deja desplazarse a negativo, así que lo
    que se sale por la IZQUIERDA se recorta en silencio y la página sigue
    diciendo que "cabe". Es peor que el desborde clásico: no hay barra que lo
    delate, solo letras cortadas por la mitad.

    Pasó exactamente aquí (2026-08-06): la línea de tiempo de la portada tenía
    los textos y los círculos cortados a la izquierda y la primera medición dio
    "cabe" en los tres aparatos. Por eso se recorren los DOS bordes y el
    veredicto mira ambos, no scrollWidth.
  */
  const culpables = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.opacity === "0") continue;
    // Lo que se sale a propósito y el navegador SÍ deja alcanzar (carruseles,
    // tablas anchas) vive dentro de un contenedor que se desplaza: no es esto.
    let recortado = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.overflowX === "auto" || ps.overflowX === "scroll") { recortado = true; break; }
    }
    if (recortado) continue;
    const porDerecha = r.right > W + 1;
    const porIzquierda = r.left < -1;
    if (!porDerecha && !porIzquierda) continue;
    // Solo el más externo: si un contenedor se sale, sus hijos también, y
    // listarlos todos convierte el informe en ruido.
    if (culpables.some((c) => c.nodo.contains(el))) continue;
    culpables.push({
      nodo: el,
      etiqueta: el.tagName.toLowerCase(),
      clase: (typeof el.className === "string" ? el.className : "").slice(0, 80),
      lado: porIzquierda ? (porDerecha ? "ambos" : "izquierda") : "derecha",
      sobra: porIzquierda ? Math.round(-r.left) : Math.round(r.right - W),
      texto: (el.textContent || "").trim().slice(0, 40),
    });
  }
  const seSaleIzquierda = culpables.some((c) => c.lado !== "derecha");

  // El área que SE TOCA, no la caja que se dibuja (ver cabecera).
  const toques = [];
  for (const el of document.querySelectorAll("button, a, input, select, textarea, [role=button]")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height >= 32) continue;
    const cx = Math.round(r.left + r.width / 2);
    const suyo = (y) => {
      const en = document.elementFromPoint(cx, y);
      return !!en && (en === el || el.contains(en) || en.contains(el));
    };
    const m = Math.round((32 - r.height) / 2);
    if (suyo(r.top - m) && suyo(r.bottom + m)) continue;
    toques.push({ etiqueta: el.tagName.toLowerCase(), alto: Math.round(r.height), texto: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30) });
  }

  const textoChico = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!el.childNodes.length) continue;
    const propio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 3);
    if (!propio) continue;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px >= 10.5) continue;
    textoChico.push({ px: Math.round(px * 10) / 10, texto: el.textContent.trim().slice(0, 30) });
  }

  /* Campos por debajo de 16 px: Safari amplía la página al enfocarlos y NO
     vuelve solo. Este proyecto ya lo arregló una vez poniendo el piso en
     theme.js; esto vigila que la portada no lo haya perdido. */
  const camposChicos = [];
  for (const el of document.querySelectorAll("input, select, textarea")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (px >= 15.9) continue;
    camposChicos.push({ px: Math.round(px * 10) / 10, tipo: el.type || el.tagName.toLowerCase() });
  }

  /* Lo que la barra inferior fija tapa al llegar al fondo. */
  let tapado = null;
  const fijos = [...document.querySelectorAll("body *")].filter((e) => {
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return s.position === "fixed" && r.height > 0 && r.bottom >= window.innerHeight - 2 && r.width > W * 0.6;
  });
  if (fijos.length) {
    const barra = fijos[0].getBoundingClientRect();
    const pie = document.querySelector("footer");
    if (pie) {
      const r = pie.getBoundingClientRect();
      // Se mide con la página YA al fondo (el llamador hace el scroll).
      if (r.bottom > barra.top + 2) tapado = { alto: Math.round(barra.height), sobra: Math.round(r.bottom - barra.top) };
    }
  }

  return JSON.stringify({
    ancho: W,
    desborde,
    seSaleIzquierda,
    culpables: culpables.map(({ nodo, ...c }) => c).slice(0, 8),
    toques: toques.slice(0, 6),
    nToques: toques.length,
    textoChico: textoChico.slice(0, 4),
    nTexto: textoChico.length,
    camposChicos: camposChicos.slice(0, 4),
    tapado,
    alto: doc.scrollHeight,
  });
})()`;

/* Recorrer la página entera y dejar las animaciones terminadas: lo que entra
   con `hp-reveal` no se ha revelado hasta que se pasa por delante. */
const ASENTAR = `(async () => {
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y <= h; y += Math.round(window.innerHeight * 0.8)) {
    window.scrollTo(0, y);
    await dormir(120);
  }
  window.scrollTo(0, h);
  await dormir(400);
  document.getAnimations().forEach((a) => { try { a.finish(); } catch {} });
  await dormir(150);
  return true;
})()`;

async function main() {
  const chrome = CHROMES.find((p) => existsSync(p));
  if (!chrome) throw new Error("No encuentro Chrome. Pasa la ruta en CHROME_PATH.");
  const perfil = mkdtempSync(join(tmpdir(), "sinapsis-movil-"));
  const puerto = 9700 + Math.floor(Math.random() * 300);
  const proc = spawn(
    chrome,
    [
      `--remote-debugging-port=${puerto}`,
      `--user-data-dir=${perfil}`,
      VER ? "" : "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=Translate",
      "about:blank",
    ].filter(Boolean),
    { stdio: "ignore" }
  );

  let cdp;
  let fallos = 0;
  try {
    const info = await esperarPuerto(puerto);
    cdp = await Cdp.abrir(info.webSocketDebuggerUrl);
    const { targetId } = await cdp.enviar("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.enviar("Target.attachToTarget", { targetId, flatten: true });
    const s = (m, p) => cdp.enviar(m, p, sessionId);

    await s("Page.enable");
    await s("Runtime.enable");
    await s("Log.enable");
    await s("Network.enable");

    // ── "que el código funcione": todo lo que la página se queje, se apunta.
    let quejas = [];
    cdp.al((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === "Log.entryAdded") {
        const e = msg.params.entry;
        if (e.level === "error") quejas.push({ tipo: e.source === "network" ? "recurso" : "consola", texto: e.text?.slice(0, 160), url: (e.url || "").slice(0, 110) });
      }
      if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params.exceptionDetails;
        quejas.push({ tipo: "javascript", texto: (d.exception?.description || d.text || "").split("\n")[0].slice(0, 160), url: (d.url || "").slice(0, 110) });
      }
      if (msg.method === "Network.loadingFailed" && !msg.params.canceled) {
        quejas.push({ tipo: "recurso", texto: msg.params.errorText, url: "" });
      }
    });

    for (const [nombreAparato, ancho, alto, dpr] of APARATOS) {
      await s("Emulation.setDeviceMetricsOverride", { width: ancho, height: alto, deviceScaleFactor: dpr, mobile: true });
      await s("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });

      for (const [nombrePagina, ruta] of PAGINAS) {
        quejas = [];
        await s("Page.navigate", { url: BASE + ruta });
        await dormir(3200); // Firebase + fuentes + iconos
        await s("Runtime.evaluate", { expression: ASENTAR, awaitPromise: true, returnByValue: true });
        const r = await s("Runtime.evaluate", { expression: MEDIR, returnByValue: true });
        const m = JSON.parse(r.result.value);

        // El veredicto mira los DOS bordes: `scrollWidth` es ciego al izquierdo.
        const cabe = m.desborde <= 1 && !m.seSaleIzquierda;
        if (!cabe) fallos++;
        const partes = [
          cabe ? "cabe" : m.desborde > 1 ? `SE SALE ${m.desborde} px a la derecha` : "SE CORTA POR LA IZQUIERDA",
          m.nToques ? `${m.nToques} toque(s) <32 px` : null,
          m.nTexto ? `${m.nTexto} texto(s) <10.5 px` : null,
          m.camposChicos.length ? `${m.camposChicos.length} campo(s) <16 px (zoom iOS)` : null,
          m.tapado ? `pie TAPADO por la barra (${m.tapado.sobra} px)` : null,
          quejas.length ? `${quejas.length} error(es)` : null,
        ].filter(Boolean);
        console.log(`${cabe ? "✅" : "❌"} ${nombreAparato.padEnd(15)} ${nombrePagina.padEnd(9)} ${partes.join(" · ")}`);

        for (const c of m.culpables) console.log(`      ↳ ${c.lado} ${c.sobra} px: <${c.etiqueta} class="${c.clase}"> ${c.texto ? `«${c.texto}»` : ""}`);
        for (const t of m.toques) console.log(`      ↳ toque ${t.alto} px: <${t.etiqueta}> ${t.texto ? `«${t.texto}»` : ""}`);
        for (const t of m.textoChico) console.log(`      ↳ texto ${t.px} px: «${t.texto}»`);
        for (const c of m.camposChicos) console.log(`      ↳ campo ${c.px} px (${c.tipo})`);
        for (const q of dedupe(quejas)) {
          console.log(`      ⚠️ ${q.tipo}: ${q.texto}${q.url ? ` — ${q.url}` : ""}`);
          fallos++;
        }

        if (CAPTURAS) {
          mkdirSync(DIR_CAPTURAS, { recursive: true });
          // Vuelta arriba: el asentado dejó la página al fondo y lo que hay que
          // mirar es lo primero que se ve al abrir.
          await s("Runtime.evaluate", { expression: "window.scrollTo(0,0)" });
          await dormir(500);
          const png = await s("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
          const archivo = join(DIR_CAPTURAS, `${nombreAparato.replace(/\s+/g, "-")}-${nombrePagina}.png`);
          writeFileSync(archivo, Buffer.from(png.data, "base64"));
          console.log(`      📷 ${archivo}`);
        }
      }
    }
  } finally {
    cdp?.cerrar();
    proc.kill();
  }
  console.log(fallos === 0 ? "\n=== La portada cabe y no se queja de nada ===" : `\n=== ${fallos} cosa(s) que mirar ===`);
}

function dedupe(qs) {
  const vistas = new Set();
  return qs.filter((q) => {
    const k = q.tipo + q.texto + q.url;
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
