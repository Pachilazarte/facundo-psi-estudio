/* ======================================================
   PSIESTUDIO — PROFESSIONAL REACT SUITE
   Zero-Emoji, 100% Lucide Icons, Structured Academic Ingestion,
   Materia-Centric Exam Linking & Profile Administration
   ====================================================== */

const { useState, useEffect, useMemo, useRef } = React;

// ── 1. SUPABASE CLIENT & CONFIG ──
const SUPABASE_CONFIG = {
  url: localStorage.getItem('psi_supabase_url') || 'https://eckgwyvbevlpnhjrsaxy.supabase.co',
  key: localStorage.getItem('psi_supabase_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVja2d3eXZiZXZscG5oanJzYXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MzM1ODgsImV4cCI6MjEwNjIwOTU4OH0.MfgjL7yQPidqir2ybVEpcfeAsrioZGIIvgVv_bMyI7I'
};

// Clave de la app (aceptada por el dueño: queda en el código del frontend)
const APP_TOKEN = 'h5SUedldWPhWMN6Ja_kzirtUZXSTSo3Q1Zx8EZN9ktU';

let supabaseClient = null;
try {
  if (window.supabase && SUPABASE_CONFIG.url.startsWith('http')) {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key, {
      global: {
        // La clave de la app viaja en un header; la base la verifica (ver 0002_clave_de_app.sql)
        fetch: (input, init = {}) => {
          const headers = new Headers(init.headers || {});
          headers.set('x-app-token', APP_TOKEN);
          return fetch(input, { ...init, headers });
        }
      }
    });
  }
} catch (e) {
  console.warn('Supabase init fallback:', e);
}

// ── 1.5 INDEXEDDB PERSISTENCE LAYER (DEXIE) ──
let psiDB = null;
try {
  if (window.Dexie) {
    psiDB = new window.Dexie('PsiEstudioDB');
    psiDB.version(1).stores({
      materias: 'id, nombre',
      bibliografia: 'id, materia_id, unidad, estado',
      clases: 'id, materia_id, nro_clase',
      apuntes: 'id, materia_id, unidad, created_at',
      documentos_pdf: 'id, materia_id, created_at',
      examenes: 'id, materia_id, fecha',
      syncQueue: '++id, action, table, timestamp'
    });
    psiDB.version(2).stores({
      audioSegments: '++id, sesion, orden'
    });
    psiDB.version(4).stores({
      cargasAudio: null,
      audioSegments: null
    });
  }
} catch (e) {
  console.warn('Dexie DB init warning:', e);
}

// ── 2. LUCIDE SVG ICON WRAPPER (100% PURE REACT SVG, ZERO DOM MUTATION) ──
const Icon = ({ name, className = "w-4 h-4", size = 18, style = {}, strokeWidth = 2, ...props }) => {
  const pascalName = useMemo(() => {
    if (!name) return 'HelpCircle';
    const clean = String(name).replace(/^lucide-/i, '');
    return clean
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }, [name]);

  const iconDef = useMemo(() => {
    if (typeof window === 'undefined' || !window.lucide) return null;
    return window.lucide[pascalName] || (window.lucide.icons && window.lucide.icons[pascalName]) || null;
  }, [pascalName]);

  const widthVal = typeof size === 'number' ? `${size}px` : size;
  const heightVal = typeof size === 'number' ? `${size}px` : size;
  const combinedStyle = {
    width: widthVal,
    height: heightVal,
    display: 'inline-block',
    verticalAlign: 'middle',
    flexShrink: 0,
    ...style
  };

  if (!iconDef || !Array.isArray(iconDef)) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={combinedStyle}
        {...props}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={combinedStyle}
      {...props}
    >
      {iconDef.map(([tag, attrs], idx) => {
        const Tag = tag;
        return <Tag key={idx} {...attrs} />;
      })}
    </svg>
  );
};

// ── 2.4 TOKEN DEL SERVIDOR DE AUDIO (header X-PSI-Token) ──
// El token se guarda en este navegador desde Ajustes. Nunca va en el código.
function psiApiHeaders(extra = {}) {
  return { 'X-PSI-Token': APP_TOKEN, ...extra };
}

// Token automático: el servidor local lo entrega solo a esta web (desde localhost).
// Nadie tiene que pegarlo a mano.
fetch('/api-config.json', { cache: 'no-store' })
  .then(r => (r.ok ? r.json() : null))
  .then(cfg => { if (cfg && cfg.token) { try { localStorage.setItem('psi_api_token', cfg.token); } catch (e) {} } })
  .catch(() => {});

// ── 2.5 HAPTIC FEEDBACK UTILITY ──
const triggerHaptic = (type = 'light') => {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'light') navigator.vibrate(15);
      else if (type === 'medium') navigator.vibrate(35);
      else if (type === 'success') navigator.vibrate([20, 60, 20]);
    } catch (e) {}
  }
};

// ── 3. ENRICHED MARKDOWN PARSER (WITH KATEX MATH & MERMAID) ──
// ── 3. ENRICHED MARKDOWN PARSER (WITH KATEX, BULLETS & ACADEMIC HIERARCHY) ──
function extractAcademicTitle(text) {
  if (!text) return '';
  const match = text.match(/^#\s+([^\n\r]+)/m);
  if (match && match[1]) {
    return match[1].replace(/[*_#]/g, '').trim();
  }
  return '';
}

function generateAcademicPrompt(materiaNombre = '', textoTitulo = '', extraContent = '') {
  return `# INSTRUCCIONES PARA PROCESAMIENTO DE TEXTO ACADÉMICO
Actúa como un experto en transcripción y análisis de textos universitarios. Tu objetivo es transformar el material proporcionado (PDF, Word o escaneado) en una guía de estudio de máxima densidad y fidelidad.

## 1. INSTRUCCIONES DE CONTENIDO
Empezá con una introducción desarrollada que explique cómo inicia el texto y cuál es la idea central. Cada vez que aparezca un título o subtítulo importante, ponelo igual que en el texto como encabezado. Debajo, escribí un resumen fiel de lo que desarrolla ese apartado, usando palabras textuales o lo más cercanas al original. Respetá el orden temático del texto, de principio a fin. No inventes, no interpretes ni agregues información externa: solo usá lo que esté en el texto. La idea es que el material final sea como una guía de estudio narrativa y ordenada, donde quede claro qué trata cada parte, con definiciones exactas para poder escribirlas en un examen.
De esta forma, el resumen debe arrancar con:
- Introducción (extensa, explicando de qué habla el texto en general).
- Título/Subtítulo (tal cual aparece en el original).
- Explicación fiel, desarrollada y extensa de cada punto.
- Siguiente tema/subtema con su desarrollo detallado… y así hasta el final.

## 2. REGLAS DE EXTENSIÓN Y LIMPIEZA
- **PROHIBICIÓN DE CITAS:** No utilices etiquetas de citas, números de página ni corchetes del tipo. El texto debe ser limpio y fluido.
- **MÁXIMA DENSIDAD:** Si el texto original es extenso, el resumen debe ser igualmente denso. No resumas conceptos clave en una sola oración; explica los fundamentos y los matices para que la guía sea autosuficiente para el estudio.
- **FIDELIDAD TEXTUAL:** Mantén las definiciones técnicas y el vocabulario específico del autor.

## 3. FORMATO DE SALIDA (JERARQUÍA MARKDOWN)
Debes estructurar el contenido utilizando exclusivamente la siguiente jerarquía para asegurar la conversión posterior a PDF:
- \`#\` → Título principal (Mayúsculas y Negrita).
- \`##\` → Secciones principales / Introducción (Negrita).
- \`###\` → Subtítulos (Negrita).
- \`**Negrita**\` → Para resaltar conceptos clave dentro de los párrafos.
- \`*Texto en cursiva*\` → Para definiciones exactas o citas textuales del autor.
- \`•\` → Listas de primer nivel.
- \`◦\` → Sublistas (manteniendo la sangría).

## 4. RESTRICCIÓN DE ENTREGA
- **SÓLO CÓDIGO:** Entrega el contenido EXCLUSIVAMENTE dentro de un bloque de código (Markdown/MD/TXT).
- **SIN CHAT:** No incluyas saludos, introducciones ni comentarios por parte de la IA (prohibido frases como "Aquí tienes tu resumen"). El texto debe comenzar directamente con el primer encabezado.

no me des un pdf, dame el formato que te pido
${materiaNombre ? `\n---\n**DATOS DE LA CÁTEDRA:**\n- **Materia:** ${materiaNombre}\n` : ''}${textoTitulo ? `- **Texto / Unidad:** ${textoTitulo}\n` : ''}
Te pasare ahora el contenido. Lo que sí, el contenido que sea en relación a las diapositivas debe ir textualmente, debe ir sí o sí.

Ahora te pasare la transcripción de la clase / texto:${extraContent ? `\n\n\`\`\`text\n${extraContent}\n\`\`\`` : ''}`;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeURL(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (/^(?:https?:\/\/|data:image\/|blob:|\/|\.\/)/i.test(trimmed)) {
    return trimmed.replace(/["'<>]/g, '');
  }
  return '';
}

function parseMarkdownToHTML(md) {
  if (!md) return '';

  const placeholders = [];
  const preserve = (content) => {
    const key = `@@@PSI_TOKEN_${placeholders.length}@@@`;
    placeholders.push(content);
    return key;
  };

  let text = md;

  // 1. Proteger bloques de código y Mermaid
  text = text.replace(/```(mermaid|[\w-]*)\r?\n([\s\S]*?)```/g, (match, lang, code) => {
    if (lang === 'mermaid') {
      const escapedMermaid = escapeHTML(code.trim());
      return preserve(
        `<div class="my-4 p-4 rounded-xl bg-app-surface border border-app-border text-center overflow-x-auto">` +
        `<div class="inline-block px-2.5 py-0.5 rounded bg-app-emerald-bg text-app-emerald text-[10px] font-mono font-bold mb-2 uppercase tracking-wider">Diagrama Académico</div>` +
        `<div class="mermaid text-xs flex justify-center">${escapedMermaid}</div>` +
        `</div>`
      );
    }
    const escapedCode = escapeHTML(code.trim());
    const displayLang = escapeHTML(lang || 'Código');
    return preserve(
      `<div class="my-3 p-3 rounded-xl bg-app-card border border-app-border font-mono text-[11px] overflow-x-auto text-app-text">` +
      `<div class="text-[9px] text-app-muted uppercase font-bold tracking-wider mb-1.5">${displayLang}</div>` +
      `<pre class="whitespace-pre overflow-x-auto">${escapedCode}</pre>` +
      `</div>`
    );
  });

  // 2. Proteger fórmulas KaTeX
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    return preserve(`$$${formula}$$`);
  });
  text = text.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
    return preserve(`$${formula}$`);
  });

  // 3. Proteger imágenes válidas ![alt](src)
  text = text.replace(/!\[(.*?)\]\(([^()\s]+(?:\([^()\s]*\)[^()\s]*)*)\)/g, (match, alt, src) => {
    const safeSrc = sanitizeURL(src);
    const safeAlt = escapeHTML(alt || 'Gráfico / Diagrama');
    if (!safeSrc) {
      return preserve(`<span class="text-xs text-app-muted italic">[Imagen no permitida]</span>`);
    }
    return preserve(
      `<div class="my-4 p-2.5 rounded-xl bg-app-surface border border-app-border text-center shadow-sm break-inside-avoid">` +
      `<img src="${safeSrc}" alt="${safeAlt}" class="max-h-[420px] max-w-full mx-auto rounded-lg object-contain shadow-md" loading="lazy" />` +
      (alt ? `<p class="text-[11px] text-app-muted mt-2 italic font-medium">${safeAlt}</p>` : '') +
      `</div>`
    );
  });

  // 4. Proteger marcadores de prompts de imágenes
  text = text.replace(/\[(?:IMAGEN_PROMPT|imagen_prompt|imagen|figura|grafico)\s*(\d*):?\s*([^\]]*)\]/gi, (match, num, desc) => {
    const cleanNum = num ? ` #${escapeHTML(num)}` : '';
    const cleanDesc = escapeHTML(desc.trim() || 'Esquema o diagrama conceptual solicitado');
    return preserve(
      `<div class="my-3.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-left shadow-sm break-inside-avoid">` +
      `<div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-wider">` +
      `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>` +
      `IMAGEN SOLICITADA${cleanNum} (PROMPT IA)</div>` +
      `<p class="text-xs text-app-text mt-2 font-mono bg-app-surface p-2 rounded-lg border border-app-border/70 select-all">${cleanDesc}</p>` +
      `</div>`
    );
  });

  // 5. Escapar todo el texto remanente para neutralizar XSS
  let html = escapeHTML(text);

  // 6. Tablas Markdown (con celdas ya escapadas)
  html = html.replace(/((?:^\s*\|.+\|\s*\r?\n?)+)/gm, (match) => {
    const lines = match.trim().split(/\r?\n/).filter(l => l.trim().startsWith('|'));
    if (lines.length < 2) return match;
    const parseRow = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
    const header = parseRow(lines[0]);
    let startIdx = 1;
    if (lines.length > 1 && /^[\s|:-]+$/.test(lines[1])) startIdx = 2;
    const rows = lines.slice(startIdx).map(parseRow);

    return `<div class="overflow-x-auto my-3.5 rounded-xl border border-app-border bg-app-surface shadow-sm">
      <table class="w-full text-xs text-left border-collapse">
        <thead class="bg-app-card border-b border-app-border text-app-text font-extrabold text-[11px]">
          <tr>${header.map(h => `<th class="px-3 py-2 border-r border-app-border last:border-0">${h}</th>`).join('')}</tr>
        </thead>
        <tbody class="divide-y divide-app-border">
          ${rows.map((r, rIdx) => `<tr class="${rIdx % 2 === 1 ? 'bg-app-card/30' : ''} hover:bg-app-card/60 transition-colors">${r.map(c => `<td class="px-3 py-2 border-r border-app-border last:border-0 text-app-text">${c}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  });

  // 7. Formato Markdown habitual
  html = html
    .replace(/^##### (.*$)/gim, '<h5 class="text-xs font-bold text-app-muted mt-2 mb-0.5 tracking-tight uppercase">$1</h5>')
    .replace(/^#### (.*$)/gim, '<h4 class="text-xs font-extrabold text-app-text mt-3 mb-1 tracking-tight">$1</h4>')
    .replace(/^### (.*$)/gim, '<h3 class="text-sm font-extrabold text-app-text mt-3.5 mb-1 tracking-tight">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-base font-black text-app-text mt-4 mb-1.5 border-b border-app-border/40 pb-1 tracking-tight">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-xl font-black uppercase text-app-emerald mt-4 mb-2 tracking-tight">$1</h1>')
    .replace(/^\&gt;\s?(.*$)/gim, '<blockquote class="border-l-4 border-app-emerald bg-app-emerald-bg/20 p-3 my-2.5 rounded-r-xl text-xs italic text-app-text font-serif leading-relaxed">$1</blockquote>')
    .replace(/\*\*\*(.*?)\*\*\*/gim, '<strong class="text-app-emerald font-extrabold italic">$1</strong>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong class="text-app-emerald font-extrabold">$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em class="text-app-navy font-semibold italic">$1</em>')
    .replace(/^([ \t]{2,}|\t+)[•\-*◦]\s*(.*$)/gim, '<li class="ml-8 list-[circle] text-app-text text-xs leading-relaxed my-0.5 opacity-90">$2</li>')
    .replace(/^[ \t]*◦\s*(.*$)/gim, '<li class="ml-8 list-[circle] text-app-text text-xs leading-relaxed my-0.5 opacity-90">$1</li>')
    .replace(/^[ \t]*[•\-*]\s*(.*$)/gim, '<li class="ml-4 list-disc text-app-text text-xs leading-relaxed my-0.5">$1</li>')
    .replace(/^[ \t]*(\d+)[\.\)]\s*(.*$)/gim, '<li class="ml-5 list-decimal text-app-text text-xs leading-relaxed my-0.5 font-medium">$2</li>')
    .replace(/\n$/gim, '<br />');

  // 8. Re-insertar placeholders
  placeholders.forEach((val, idx) => {
    if (val.startsWith('$$') && val.endsWith('$$')) {
      const formula = val.slice(2, -2).trim();
      const rendered = (typeof window !== 'undefined' && window.katex)
        ? window.katex.renderToString(formula, { displayMode: true, throwOnError: false })
        : `<pre class="text-xs font-mono p-2 bg-app-surface rounded-lg">${escapeHTML(formula)}</pre>`;
      val = `<div class="my-3 text-center p-2 rounded-xl bg-app-surface border border-app-border overflow-x-auto">${rendered}</div>`;
    } else if (val.startsWith('$') && val.endsWith('$')) {
      const formula = val.slice(1, -1).trim();
      val = (typeof window !== 'undefined' && window.katex)
        ? window.katex.renderToString(formula, { displayMode: false, throwOnError: false })
        : `<code>${escapeHTML(formula)}</code>`;
    }

    html = html.replace(`@@@PSI_TOKEN_${idx}@@@`, val);
  });

  // 9. Sanitización final con DOMPurify si está presente
  if (typeof window !== 'undefined' && window.DOMPurify) {
    html = window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
        'strong', 'b', 'em', 'i', 'u', 's', 'strike',
        'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'img', 'div', 'span',
        'svg', 'path', 'rect', 'circle', 'line', 'polyline', 'polygon',
        'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'mover', 'munder', 'mspace', 'mtext', 'annotation'
      ],
      ALLOWED_ATTR: [
        'class', 'style', 'id', 'src', 'alt', 'loading',
        'viewbox', 'fill', 'stroke', 'stroke-width', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'd', 'rx', 'ry',
        'colspan', 'rowspan', 'scope', 'aria-hidden'
      ],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
    });
  }

  return html;
}

function generarUUID(prefijo = '') {
  let id = '';
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    id = crypto.randomUUID();
  } else {
    id = Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
  }
  return prefijo ? `${prefijo}_${id}` : id;
}

// ── 3.5 UTILIDADES DE TIEMPO Y LOCAL STORAGE ──
function formatTime(secs) {
  if (!secs || isNaN(secs) || !isFinite(secs) || secs < 0) return '00:00';
  const s = Math.floor(secs || 0);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const remM = m % 60;
  const remS = s % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(remM).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;
  return `${String(remM).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;
}

function safeGetLocalStorage(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) ? parsed.filter(Boolean) : fallback;
    }
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch (err) {
    console.warn(`Error al leer '${key}' de localStorage. Se restablece con fallback seguro.`, err);
    try { localStorage.removeItem(key); } catch (e) {}
    return fallback;
  }
}

function stripLargeBinaryFields(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripLargeBinaryFields);
  const clone = { ...obj };
  const binaryKeys = ['pdfData', 'pdf_data', 'fileData', 'archivo_pdf', 'dataUrl', 'blob', 'audioData'];
  for (const k of binaryKeys) {
    if (k in clone) delete clone[k];
  }
  if (Array.isArray(clone.grabaciones)) {
    clone.grabaciones = clone.grabaciones.map(g => ({ ...g, url: (typeof g.url === 'string' && g.url.startsWith('data:') ? '' : g.url) }));
  }
  if (Array.isArray(clone.imagenes)) {
    clone.imagenes = clone.imagenes.map(img => ({ ...img, url: (typeof img.url === 'string' && img.url.startsWith('data:') ? '' : img.url) }));
  }
  return clone;
}

function safeSetLocalStorage(key, data) {
  try {
    const sanitized = stripLargeBinaryFields(data);
    localStorage.setItem(key, typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized));
  } catch (err) {
    console.warn(`[Storage] QuotaExceededError o error guardando '${key}' en localStorage:`, err);
    if (typeof window !== 'undefined' && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014)) {
      window.dispatchEvent(new CustomEvent('psi-storage-quota-warning', { detail: { key, message: err?.message } }));
    }
  }
}

// ── 3.6 TOMBSTONES ANTI-RESURRECCIÓN DE DATOS ELIMINADOS ──
function getDeletedRecords() {
  return safeGetLocalStorage('psi_deleted_records', []);
}

function addDeletedRecord(table, id) {
  if (!id) return;
  const current = getDeletedRecords();
  if (!current.some(r => r.table === table && r.id === id)) {
    const updated = [...current, { table, id, deleted_at: new Date().toISOString() }];
    safeSetLocalStorage('psi_deleted_records', updated);
  }
}

function isRecordDeleted(table, id) {
  if (!id) return false;
  const current = getDeletedRecords();
  return current.some(r => r.table === table && r.id === id);
}

function clearDeletedRecords() {
  safeSetLocalStorage('psi_deleted_records', []);
}

// ── 3.8 NEUROSCAN VECTOR PDF COMPILER (A4 & 2-COLUMN BOOKLET) ──
function parseInlineSegments(str) {
  const segments = [];
  const re = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) {
      segments.push({ text: str.slice(last, m.index), bold: false, italic: false });
    }
    if (m[1] !== undefined) segments.push({ text: m[1], bold: true, italic: true });
    else if (m[2] !== undefined) segments.push({ text: m[2], bold: true, italic: false });
    else if (m[3] !== undefined) segments.push({ text: m[3], bold: false, italic: true });
    last = m.index + m[0].length;
  }
  if (last < str.length) {
    segments.push({ text: str.slice(last), bold: false, italic: false });
  }
  return segments.length ? segments : [{ text: str, bold: false, italic: false }];
}

function parseMarkdownTokens(text) {
  const lines = (text || '').split('\n');
  const tokens = [];

  for (let rawLine of lines) {
    const line = rawLine.trimEnd();
    const imgMatch = line.match(/^\s*(\[(?:imagen|FIGURA|IMAGEN|grafico)\s*\d*:?\s*([^\]]+)\]|!\[(.*?)\]\((.*?)\))\s*$/i);
    if (imgMatch) {
      const rawKey = imgMatch[1];
      const label = imgMatch[2] || imgMatch[3] || rawKey;
      tokens.push({ type: 'image_var', rawKey, label });
    } else if (/^# /.test(line)) {
      tokens.push({ type: 'h1', text: line.slice(2).trim() });
    } else if (/^## /.test(line)) {
      tokens.push({ type: 'h2', text: line.slice(3).trim() });
    } else if (/^### /.test(line)) {
      tokens.push({ type: 'h3', text: line.slice(4).trim() });
    } else if (/^---+$/.test(line.trim())) {
      tokens.push({ type: 'hr' });
    } else if (/^\$\$.*\$\$$/.test(line.trim())) {
      const formula = line.trim().slice(2, -2).trim();
      tokens.push({ type: 'formula', text: formula });
    } else if (/^> /.test(line)) {
      const q = line.slice(2).trim();
      tokens.push({ type: 'quote', text: q, segs: parseInlineSegments(q) });
    } else if (/^\s*◦\s+/.test(line)) {
      const t2 = line.replace(/^\s*◦\s+/, '').trim();
      tokens.push({ type: 'li2', text: t2, segs: parseInlineSegments(t2) });
    } else if (/^\s*[•\-*]\s+/.test(line)) {
      const t1 = line.replace(/^\s*[•\-*]\s+/, '').trim();
      tokens.push({ type: 'li1', text: t1, segs: parseInlineSegments(t1) });
    } else if (!line.trim()) {
      tokens.push({ type: 'blank' });
    } else {
      tokens.push({ type: 'body', text: line, segs: parseInlineSegments(line) });
    }
  }

  return tokens;
}

async function convertPDFToTwoColumns(sourceBlob) {
  if (!window.PDFLib) return sourceBlob;
  const PDFLibObj = window.PDFLib;

  let rawBytes;
  if (sourceBlob instanceof Blob) {
    rawBytes = await sourceBlob.arrayBuffer();
  } else if (typeof sourceBlob === 'string' && sourceBlob.startsWith('data:')) {
    const base64 = sourceBlob.split(',')[1];
    const binaryStr = atob(base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);
    rawBytes = bytes.buffer;
  } else if (typeof sourceBlob === 'string') {
    const res = await fetch(sourceBlob);
    rawBytes = await res.arrayBuffer();
  } else if (sourceBlob instanceof ArrayBuffer) {
    rawBytes = sourceBlob;
  } else if (sourceBlob?.buffer instanceof ArrayBuffer) {
    rawBytes = sourceBlob.buffer;
  }

  const sourceDoc = await PDFLibObj.PDFDocument.load(rawBytes);
  const destDoc = await PDFLibObj.PDFDocument.create();

  // Configuración de alta fidelidad NEUROSCAN (2 páginas por carilla horizontal A4)
  const marginPt = 6 * 2.83465; // Margen exterior seguro (6mm)
  const gapPt = 6 * 2.83465; // Separación central (6mm)
  const sheetW = 841.89; // A4 Horizontal (ancho)
  const sheetH = 595.28; // A4 Horizontal (alto)
  const slotW = (sheetW - (marginPt * 2) - gapPt) / 2;
  const slotH = sheetH - (marginPt * 2);

  const totalPages = sourceDoc.getPageCount();
  const zoom = 1.0; // 100% Escala natural sin recorte perimetral

  for (let i = 0; i < totalPages; i += 2) {
    const newPage = destDoc.addPage([sheetW, sheetH]);

    const placePage = async (idx, x0, y0) => {
      if (idx >= totalPages) return;
      const srcPage = sourceDoc.getPage(idx);
      const caja = srcPage.getMediaBox();
      let L = caja.x, B = caja.y, R = caja.x + caja.width, T = caja.y + caja.height;
      let w = R - L, h = T - B;

      const arHueco = slotW / slotH;
      const arPag = w / h;
      if (arPag > arHueco) {
        const nw = Math.max(h * arHueco, w * 0.95);
        L += (w - nw) / 2; R -= (w - nw) / 2; w = nw;
      } else {
        const nh = Math.max(w / arHueco, h * 0.95);
        B += (h - nh) / 2; T -= (h - nh) / 2; h = nh;
      }

      const bbox = { left: L, bottom: B, right: R, top: T };
      const emb = await destDoc.embedPage(srcPage, bbox);
      const esc = Math.min(slotW / emb.width, slotH / emb.height);
      const drawW = emb.width * esc;
      const drawH = emb.height * esc;
      const posX = x0 + (slotW - drawW) / 2;
      const posY = y0 + (slotH - drawH) / 2;
      newPage.drawPage(emb, { x: posX, y: posY, width: drawW, height: drawH });
    };

    await placePage(i, marginPt, marginPt); // Izquierda
    await placePage(i + 1, marginPt + slotW + gapPt, marginPt); // Derecha
  }

  const outputBytes = await destDoc.save();
  return new Blob([outputBytes], { type: 'application/pdf' });
}

async function downloadPDFHelper({ pdfData, fileName, twoColumns = false, showToast }) {
  if (!pdfData) {
    if (showToast) showToast('No hay archivo PDF disponible para descargar', 'alert-circle');
    return;
  }
  if (showToast) showToast(twoColumns ? 'Generando PDF 2 páginas por hoja...' : 'Preparando descarga...', 'refresh-cw');
  try {
    let blob;
    if (twoColumns) {
      blob = await convertPDFToTwoColumns(pdfData);
    } else if (pdfData instanceof Blob) {
      blob = pdfData;
    } else if (typeof pdfData === 'string' && pdfData.startsWith('data:')) {
      const base64 = pdfData.split(',')[1];
      const binaryStr = atob(base64);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);
      blob = new Blob([bytes], { type: 'application/pdf' });
    } else if (typeof pdfData === 'string' && pdfData.startsWith('blob:')) {
      const res = await fetch(pdfData);
      blob = await res.blob();
    } else {
      blob = new Blob([pdfData], { type: 'application/pdf' });
    }

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const cleanBase = (fileName || 'Documento').replace(/\.pdf$/i, '');
    a.download = twoColumns ? `${cleanBase} (2 Paginas por hoja).pdf` : `${cleanBase}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    if (showToast) showToast('Descarga iniciada con éxito', 'check-circle');
  } catch (err) {
    console.error('Error descargando PDF:', err);
    if (showToast) showToast('Error al descargar: ' + err.message, 'alert-triangle');
  }
}

// ── 3. MOTOR ORIGINAL DE GENERACIÓN DE PDF NEUROSCAN (SCANNER OCR) ──
function stripInline(s) {
  return String(s || '')
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function formatLatexReadable(tex) {
  return String(tex || '')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\left\s*\(/g, '(')
    .replace(/\\right\s*\)/g, ')')
    .replace(/\\left\s*\[/g, '[')
    .replace(/\\right\s*\]/g, ']')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    .replace(/\\times/g, '×')
    .replace(/\\pm/g, '±')
    .replace(/\\leq?/g, '≤')
    .replace(/\\geq?/g, '≥')
    .replace(/\\neq?/g, '≠')
    .replace(/\\sum_\{[^}]+\}\^\{[^}]+\}/g, 'Σ')
    .replace(/\\sum/g, 'Σ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\mu/g, 'μ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\sqrt/g, '√')
    .replace(/\\cdot/g, '·')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\quad/g, '   ')
    .replace(/\\qquad/g, '     ')
    .replace(/\\/g, '')
    .trim();
}

function parseInline(str) {
  var segments = [];
  var clean = String(str || '')
    .replace(/^[%•\-*◦]+\s*/, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-');

  var re = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\$([^\$\n]+)\$/g;
  var last = 0, m;
  while ((m = re.exec(clean)) !== null) {
    if (m.index > last) {
      segments.push({ text: clean.slice(last, m.index), bold: false, italic: false });
    }
    if (m[1] !== undefined)      segments.push({ text: m[1], bold: true,  italic: true  });
    else if (m[2] !== undefined) segments.push({ text: m[2], bold: true,  italic: false });
    else if (m[3] !== undefined) segments.push({ text: m[3], bold: false, italic: true  });
    else if (m[4] !== undefined) segments.push({ text: m[4], bold: true,  italic: false, isCode: true });
    else if (m[5] !== undefined) segments.push({ text: formatLatexReadable(m[5]), bold: false, italic: true });
    last = m.index + m[0].length;
  }
  if (last < clean.length) segments.push({ text: clean.slice(last), bold: false, italic: false });
  return segments.length ? segments : [{ text: clean, bold: false, italic: false }];
}

function parseMarkdown(text) {
  var rawLines = String(text || '').split('\n');
  var tokens = [];
  var secCount = 0, formulaCount = 0, wordCount = 0;

  var i = 0;
  while (i < rawLines.length) {
    var rawLine = rawLines[i];
    var line = rawLine.trimEnd();

    // Detección de Bloques de Código o Mermaid (```lang ... ```)
    if (/^\s*```/.test(line)) {
      var lang = line.replace(/^\s*```/, '').trim();
      var codeLines = [];
      i++;
      while (i < rawLines.length && !/^\s*```/.test(rawLines[i].trimEnd())) {
        codeLines.push(rawLines[i]);
        i++;
      }
      tokens.push({
        type: 'code_block',
        lang: lang || 'code',
        lines: codeLines,
        text: codeLines.join('\n')
      });
      i++;
      continue;
    }

    // Detección de Tabla Markdown
    if (/^\s*\|(.+)\|\s*$/.test(line)) {
      var tableLines = [];
      while (i < rawLines.length && /^\s*\|(.+)\|\s*$/.test(rawLines[i].trimEnd())) {
        tableLines.push(rawLines[i].trimEnd());
        i++;
      }
      
      if (tableLines.length >= 2) {
        var parseRow = function(rowStr) {
          var trimmed = rowStr.trim().replace(/^\|/, '').replace(/\|$/, '');
          return trimmed.split('|').map(function(c) { return c.trim(); });
        };
        
        var headerCells = parseRow(tableLines[0]);
        var startRow = 1;
        if (tableLines.length > 1 && /^[\s|:-]+$/.test(tableLines[1])) {
          startRow = 2;
        }
        
        var bodyRows = [];
        for (var r = startRow; r < tableLines.length; r++) {
          bodyRows.push(parseRow(tableLines[r]));
        }
        
        tokens.push({
          type: 'table',
          headers: headerCells,
          rows: bodyRows
        });
        continue;
      }
    }

    var imgMatch = line.match(/^\s*(\[(?:imagen|FIGURA|IMAGEN|grafico|IMAGEN_PROMPT|imagen_prompt|figura)\s*\d*:?\s*([^\]]+)\]|!\[(.*?)\]\((.*?)\))\s*$/i);
    if (imgMatch) {
      var rawKey = imgMatch[1];
      var label = imgMatch[2] || imgMatch[3] || rawKey;
      var src = imgMatch[4] || '';
      tokens.push({ type: 'image_var', rawKey: rawKey, label: label, src: src });
    } else if (/^# /.test(line)) {
      tokens.push({ type: 'h1', text: stripInline(line.slice(2).trim()) });
      wordCount += line.split(/\s+/).length;
    } else if (/^## /.test(line)) {
      tokens.push({ type: 'h2', text: stripInline(line.slice(3).trim()) });
      secCount++;
      wordCount += line.split(/\s+/).length;
    } else if (/^### /.test(line)) {
      tokens.push({ type: 'h3', text: stripInline(line.slice(4).trim()) });
      wordCount += line.split(/\s+/).length;
    } else if (/^#### /.test(line)) {
      tokens.push({ type: 'h4', text: stripInline(line.slice(5).trim()) });
      wordCount += line.split(/\s+/).length;
    } else if (/^##### /.test(line)) {
      tokens.push({ type: 'h4', text: stripInline(line.slice(6).trim()) });
      wordCount += line.split(/\s+/).length;
    } else if (/^---+$/.test(line.trim())) {
      tokens.push({ type: 'hr' });
    } else if (/^\$\$.*\$\$$/.test(line.trim())) {
      var formula = line.trim().slice(2, -2).trim();
      tokens.push({ type: 'formula', text: formula });
      formulaCount++;
    } else if (/^\s*>\s*(.*)$/.test(line)) {
      var qMatch = line.match(/^\s*>\s*(.*)$/);
      var qText = qMatch ? qMatch[1].trim() : '';
      tokens.push({ type: 'quote', text: qText, segs: parseInline(qText) });
      wordCount += qText.split(/\s+/).length;
    } else if (/^(\s{2,}|\t+)[•\-*◦]\s*(.*)$/.test(line) || /^\s*◦\s*(.*)$/.test(line)) {
      var mSub = line.match(/^(\s{2,}|\t+)[•\-*◦]\s*(.*)$/) || line.match(/^\s*◦\s*(.*)$/);
      var t2 = mSub ? mSub[mSub.length - 1].trim() : '';
      tokens.push({ type: 'li2', text: t2, segs: parseInline(t2) });
      wordCount += t2.split(/\s+/).length;
    } else if (/^\s*[•\-*]\s*(.*)$/.test(line)) {
      var mMain = line.match(/^\s*[•\-*]\s*(.*)$/);
      var t1 = mMain ? mMain[1].trim() : '';
      tokens.push({ type: 'li1', text: t1, segs: parseInline(t1) });
      wordCount += t1.split(/\s+/).length;
    } else if (/^\s*(\d+)[\.\)]\s*(.*)$/.test(line)) {
      var mNum = line.match(/^\s*(\d+)[\.\)]\s*(.*)$/);
      var nNum = mNum[1];
      var nText = mNum[2].trim();
      tokens.push({ type: 'num_li', num: nNum, text: nText, segs: parseInline(nText) });
      wordCount += nText.split(/\s+/).length;
    } else if (!line.trim()) {
      tokens.push({ type: 'blank' });
    } else {
      tokens.push({ type: 'body', text: line, segs: parseInline(line) });
      wordCount += line.split(/\s+/).length;
    }
    i++;
  }

  return { tokens: tokens, sections: secCount, formulas: formulaCount, words: wordCount };
}

function getStoredImageData(key, fallbackSrc) {
  if (fallbackSrc && fallbackSrc.startsWith('data:')) return fallbackSrc;
  try {
    const raw = localStorage.getItem('neuroscan_img_' + String(key).toLowerCase().trim());
    return raw || fallbackSrc || null;
  } catch (e) {
    return fallbackSrc || null;
  }
}

function getRotatedBase64Sync(base64, degrees) {
  if (!degrees || degrees % 360 === 0) return base64;
  try {
    var img = new Image();
    img.src = base64;
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var rad = (degrees % 360) * Math.PI / 180;
    var w = img.naturalWidth || img.width || 800;
    var h = img.naturalHeight || img.height || 600;

    if (degrees === 90 || degrees === 270) {
      canvas.width = h;
      canvas.height = w;
    } else {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -w / 2, -h / 2);
    return canvas.toDataURL('image/png');
  } catch(e) {
    return base64;
  }
}

function buildPDF(parsed, materia, unidad, titulo, opts) {
  opts = opts || { nums: true, footer: true, header: true };
  var jspdf = window.jspdf;
  if (!jspdf || !jspdf.jsPDF) throw new Error('jsPDF no disponible');
  var fontSel = 'helvetica';
  var doc = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  var PW = 210, PH = 297;
  var ML = 15, MR = 15, MT = 20, MB = 18;
  var TW = PW - ML - MR;
  var pageNum = 1;

  var C_BLACK  = [15, 23, 42];
  var C_DARK   = [30, 41, 59];
  var C_ACCENT = [5, 150, 105];
  var C_SUB    = [99, 102, 241];
  var C_DIM    = [100, 116, 139];
  var C_RULE   = [203, 213, 225];
  var C_FORM   = [180, 83, 9];

  var FS_H1   = 12;
  var FS_H2   = 10.5;
  var FS_H3   = 9.5;
  var FS_H4   = 8.5;
  var FS_BODY = 8;
  var FS_LI   = FS_BODY;
  var FS_HDR  = 6.8;

  function lh(fs) { return fs * 0.353 * 1.05; }

  var y = MT;

  function setColor(arr) { doc.setTextColor(arr[0], arr[1], arr[2]); }
  function setDraw(arr)  { doc.setDrawColor(arr[0], arr[1], arr[2]); }

  function needSpace(needed) {
    if (y + needed > PH - MB) { addPage(); return true; }
    return false;
  }

  function drawFooter() {
    doc.setFontSize(FS_HDR);
    doc.setFont(fontSel, 'normal');
    setColor(C_DIM);
    doc.text(String(pageNum), PW / 2, PH - 8, { align: 'center' });

    doc.setFontSize(FS_HDR - 0.5);
    doc.setFont(fontSel, 'italic');
    setColor(C_DIM);
    var leftMaxW = (TW / 2) - 10;
    var leftText = doc.splitTextToSize((materia || '') + ' · ' + (unidad || ''), leftMaxW)[0] || '';
    var rightText = doc.splitTextToSize(titulo || '', leftMaxW)[0] || '';
    doc.text(leftText, ML, PH - 8);
    doc.text(rightText, PW - MR, PH - 8, { align: 'right' });
  }

  function addPage() {
    drawFooter();
    doc.addPage('a4', 'portrait');
    pageNum++;
    y = MT;
    drawPageHeader();
  }

  function drawPageHeader() {
    doc.setFontSize(FS_HDR);
    doc.setFont(fontSel, 'normal');
    setColor(C_DIM);
    var headText = doc.splitTextToSize((materia || '') + ' · ' + (unidad || '') + ' · ' + (titulo || ''), TW)[0] || '';
    doc.text(headText, ML, MT - 8);
    setDraw(C_RULE);
    doc.setLineWidth(0.18);
    doc.line(ML, MT - 5, PW - MR, MT - 5);
  }

  function renderInline(segs, startX, maxW, fs, baseColor, baseBold) {
    var words = [];
    (segs || []).forEach(function(seg) {
      var rawSegText = String(seg.text || '')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-');
      var parts = rawSegText.split(/(\s+)/);
      parts.forEach(function(p) {
        if (p === '') return;
        var isSpace = /^\s+$/.test(p);
        words.push({ text: p, bold: seg.bold || baseBold, italic: seg.italic, isCode: seg.isCode, isSpace: isSpace });
      });
    });

    var lineH = lh(fs);
    var lines = [];
    var curr = [];
    var currW = 0;

    words.forEach(function(w) {
      var style = (w.bold && w.italic) ? 'bolditalic' : w.bold ? 'bold' : w.italic ? 'italic' : 'normal';
      doc.setFont(w.isCode ? 'courier' : fontSel, style);
      doc.setFontSize(fs);
      var ww = doc.getTextWidth(w.text);

      if (!w.isSpace && currW + ww > maxW && curr.length > 0) {
        if (curr.length && curr[curr.length-1].isSpace) curr.pop();
        lines.push(curr);
        curr = [{ text: w.text, bold: w.bold, italic: w.italic, isCode: w.isCode, isSpace: false, width: ww }];
        currW = ww;
      } else {
        curr.push({ text: w.text, bold: w.bold, italic: w.italic, isCode: w.isCode, isSpace: w.isSpace, width: ww });
        currW += ww;
      }
    });
    if (curr.length) {
      if (curr[curr.length-1].isSpace) curr.pop();
      lines.push(curr);
    }

    lines.forEach(function(line) {
      needSpace(lineH + 0.4);
      var cx = startX;
      line.forEach(function(w) {
        var style = (w.bold && w.italic) ? 'bolditalic' : w.bold ? 'bold' : w.italic ? 'italic' : 'normal';
        doc.setFont(w.isCode ? 'courier' : fontSel, style);
        doc.setFontSize(fs);
        setColor(w.bold ? C_BLACK : baseColor);
        doc.text(w.text, cx, y);
        cx += w.width;
      });
      y += lineH;
    });
    y += 0.2;
  }

  // Header Página 1
  drawPageHeader();

  var prevType = '';

  parsed.tokens.forEach(function(tok) {
    switch (tok.type) {

      case 'h1': {
        if (prevType && prevType !== 'blank') y += 2;
        needSpace(lh(FS_H1) + 6);
        setDraw(C_ACCENT);
        doc.setLineWidth(0.4);
        doc.line(ML, y - 1, PW - MR, y - 1);
        doc.setFontSize(FS_H1);
        doc.setFont(fontSel,'bold');
        setColor(C_BLACK);
        var h1lines = doc.splitTextToSize(tok.text.toUpperCase(), TW);
        doc.text(h1lines, PW / 2, y + lh(FS_H1) - 0.5, { align: 'center' });
        y += h1lines.length * lh(FS_H1) + 1;
        doc.line(ML, y, PW - MR, y);
        y += 2;
        break;
      }

      case 'h2': {
        y += 2;
        needSpace(lh(FS_H2) + 6);
        doc.setFontSize(FS_H2);
        doc.setFont(fontSel,'bold');
        setColor(C_ACCENT);
        var h2lines = doc.splitTextToSize(tok.text, TW);
        doc.text(h2lines, ML, y);
        y += h2lines.length * lh(FS_H2) + 0.5;
        setDraw(C_ACCENT);
        doc.setLineWidth(0.28);
        doc.line(ML, y, ML + Math.min(TW, tok.text.length * 2.2), y);
        y += 2;
        break;
      }

      case 'h3': {
        y += 1.5;
        needSpace(lh(FS_H3) + 4);
        doc.setFillColor(C_SUB[0], C_SUB[1], C_SUB[2]);
        doc.rect(ML, y - lh(FS_H3) + 0.5, 1.8, lh(FS_H3), 'F');
        doc.setFontSize(FS_H3);
        doc.setFont(fontSel,'bold');
        setColor(C_SUB);
        var h3lines = doc.splitTextToSize(tok.text, TW - 5);
        doc.text(h3lines, ML + 4, y);
        y += h3lines.length * lh(FS_H3) + 1;
        break;
      }

      case 'h4': {
        y += 1.2;
        needSpace(lh(FS_H4) + 3);
        doc.setFontSize(FS_H4);
        doc.setFont(fontSel, 'bold');
        setColor(C_BLACK);
        var h4lines = doc.splitTextToSize(tok.text, TW);
        doc.text(h4lines, ML, y);
        y += h4lines.length * lh(FS_H4) + 0.8;
        break;
      }

      case 'code_block': {
        var codeLines = tok.lines || [tok.text];
        var blockH = Math.min((codeLines.length * 3.5) + 6, 90);
        needSpace(blockH + 2);
        doc.setFillColor(248, 250, 252);
        setDraw(C_RULE);
        doc.setLineWidth(0.18);
        doc.roundedRect(ML, y, TW, blockH, 1.5, 1.5, 'FD');
        
        doc.setFontSize(6.2);
        doc.setFont('courier', 'bold');
        setColor(C_ACCENT);
        doc.text(tok.lang === 'mermaid' ? 'DIAGRAMA CONCEPTUAL' : 'BLOQUE ACADÉMICO / SINTAXIS', ML + 3, y + 3.8);

        doc.setFontSize(6.8);
        doc.setFont('courier', 'normal');
        setColor(C_DARK);
        var cy = y + 7.5;
        codeLines.slice(0, 24).forEach(function(cline) {
          doc.text(String(cline).slice(0, 95), ML + 3, cy);
          cy += 3.4;
        });
        y += blockH + 2.5;
        break;
      }

      case 'quote': {
        needSpace(lh(FS_BODY) + 2);
        doc.setFillColor(240, 253, 244);
        setDraw(C_ACCENT);
        doc.setLineWidth(0.6);
        doc.line(ML, y - lh(FS_BODY), ML, y + 1);
        renderInline(tok.segs || [{ text: tok.text, bold: false, italic: true }], ML + 4, TW - 4, FS_BODY, C_DARK, false);
        break;
      }

      case 'image_var': {
        var rawBase64 = getStoredImageData(tok.rawKey, tok.src);
        y += 2;
        if (rawBase64) {
          try {
            var finalBase64 = getRotatedBase64Sync(rawBase64, 0);
            var maxImgW = TW;
            var maxImgH = 100;
            var imgProps = doc.getImageProperties(finalBase64);
            var aspect = imgProps.width / imgProps.height;
            var renderW = maxImgW;
            var renderH = renderW / aspect;
            if (renderH > maxImgH) {
              renderH = maxImgH;
              renderW = renderH * aspect;
            }
            var imgX = ML + (TW - renderW) / 2;

            needSpace(renderH + 8);
            doc.addImage(finalBase64, imgProps.fileType || 'PNG', imgX, y, renderW, renderH);
            y += renderH + 3;

            doc.setFontSize(8);
            doc.setFont(fontSel, 'italic');
            setColor(C_DIM);
            doc.text('Figura / Lámina: ' + tok.label, PW / 2, y, { align: 'center' });
            y += 5;
          } catch(errImg) {
            console.error('Error imagen:', errImg);
            needSpace(10);
            setDraw(C_RULE);
            doc.setLineWidth(0.2);
            doc.rect(ML, y, TW, 10);
            doc.setFontSize(8);
            doc.text('[Error al renderizar imagen: ' + tok.label + ']', PW / 2, y + 6, { align: 'center' });
            y += 12;
          }
        } else {
          needSpace(10);
          doc.setDrawColor(0, 180, 220);
          doc.setLineWidth(0.2);
          doc.rect(ML, y, TW, 8);
          doc.setFontSize(8);
          doc.setFont(fontSel, 'italic');
          setColor(C_ACCENT);
          doc.text('📷 [Variable de imagen: ' + tok.label + ']', PW / 2, y + 5.5, { align: 'center' });
          y += 11;
        }
        break;
      }

      case 'li1': {
        needSpace(lh(FS_LI) + 1);
        doc.setFillColor(C_ACCENT[0], C_ACCENT[1], C_ACCENT[2]);
        doc.circle(ML + 3, y - (lh(FS_LI) * 0.35), 0.75, 'F');
        renderInline(tok.segs || [{ text: tok.text, bold: false, italic: false }], ML + 7, TW - 7, FS_LI, C_DARK, false);
        break;
      }

      case 'li2': {
        needSpace(lh(FS_LI) + 1);
        doc.setDrawColor(C_SUB[0], C_SUB[1], C_SUB[2]);
        doc.setLineWidth(0.22);
        doc.circle(ML + 8.5, y - (lh(FS_LI) * 0.35), 0.65, 'D');
        renderInline(tok.segs || [{ text: tok.text, bold: false, italic: false }], ML + 12, TW - 12, FS_LI - 0.5, C_DARK, false);
        break;
      }

      case 'num_li': {
        needSpace(lh(FS_LI) + 1);
        doc.setFontSize(FS_LI);
        doc.setFont(fontSel, 'bold');
        setColor(C_ACCENT);
        doc.text(String(tok.num) + '.', ML + 2, y);
        renderInline(tok.segs || [{ text: tok.text, bold: false, italic: false }], ML + 7, TW - 7, FS_LI, C_DARK, false);
        break;
      }

      case 'formula': {
        var cleanMath = formatLatexReadable(tok.text);
        needSpace(10);
        doc.setFillColor(254, 252, 232);
        setDraw([217, 119, 6]);
        doc.setLineWidth(0.2);
        doc.roundedRect(ML, y, TW, 7.5, 1, 1, 'FD');
        doc.setFontSize(FS_BODY);
        doc.setFont(fontSel, 'bolditalic');
        setColor(C_FORM);
        doc.text(cleanMath, PW / 2, y + 4.8, { align: 'center' });
        y += 10.5;
        break;
      }

      case 'table': {
        y += 2;
        if (doc.autoTable) {
          needSpace(16);
          doc.autoTable({
            head: [tok.headers],
            body: tok.rows,
            startY: y,
            margin: { left: ML, right: MR },
            styles: {
              font: fontSel,
              fontSize: 7.2,
              cellPadding: 1.5,
              lineColor: C_RULE,
              lineWidth: 0.15,
              textColor: C_DARK
            },
            headStyles: {
              fillColor: C_ACCENT,
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 7.5
            },
            alternateRowStyles: {
              fillColor: [248, 250, 252]
            },
            didDrawPage: function(data) {
              if (data.pageNumber > pageNum) {
                pageNum = data.pageNumber;
                drawPageHeader();
              }
            }
          });
          y = doc.lastAutoTable.finalY + 3;
        } else {
          var colCount = tok.headers.length || 1;
          var colW = TW / colCount;
          var cellH = 6;
          var tableH = (tok.rows.length + 1) * cellH;
          needSpace(tableH + 4);

          // Table Header
          doc.setFillColor(C_ACCENT[0], C_ACCENT[1], C_ACCENT[2]);
          doc.rect(ML, y, TW, cellH, 'F');
          doc.setFont(fontSel, 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(255, 255, 255);
          tok.headers.forEach(function(h, cIdx) {
            var cellX = ML + (cIdx * colW) + 2;
            doc.text(String(h).slice(0, 25), cellX, y + 4.2);
          });
          y += cellH;

          // Table Rows
          doc.setFont(fontSel, 'normal');
          doc.setFontSize(7);
          tok.rows.forEach(function(row, rIdx) {
            needSpace(cellH + 1);
            if (rIdx % 2 === 1) {
              doc.setFillColor(245, 247, 250);
              doc.rect(ML, y, TW, cellH, 'F');
            }
            setDraw(C_RULE);
            doc.setLineWidth(0.12);
            doc.rect(ML, y, TW, cellH, 'S');

            setColor(C_DARK);
            row.forEach(function(val, cIdx) {
              var cellX = ML + (cIdx * colW) + 2;
              doc.text(String(val || '').slice(0, 28), cellX, y + 4.2);
            });
            y += cellH;
          });
          y += 3;
        }
        break;
      }

      case 'hr': {
        needSpace(4);
        setDraw(C_RULE);
        doc.setLineWidth(0.2);
        doc.line(ML, y, PW - MR, y);
        y += 3;
        break;
      }

      case 'body': {
        needSpace(lh(FS_BODY) + 0.5);
        renderInline(tok.segs || [{ text: tok.text, bold: false, italic: false }], ML, TW, FS_BODY, C_BLACK, false);
        break;
      }

      case 'blank': {
        y += lh(FS_BODY) * 0.4;
        break;
      }
    }
    prevType = tok.type;
  });

  if (opts && opts.footer) {
    drawFooter();
  }

  return { blob: doc.output('blob'), pages: pageNum };
}

async function generateAcademicPDFBlob({ materia = '', unidad = '', titulo = '', contenido = '' }) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('La librería jsPDF no está disponible en este momento.');
  }
  const cleanMateria = (materia || 'Cátedra').trim();
  const cleanUnidad = (unidad || 'Unidad 1').trim();
  const cleanTitulo = (titulo || 'Resumen Académico').trim();

  const parsed = parseMarkdown(contenido || '');
  const result = buildPDF(parsed, cleanMateria, cleanUnidad, cleanTitulo, { nums: true, footer: true, header: true });

  const blobUrl = URL.createObjectURL(result.blob);
  const cleanM = cleanMateria.replace(/[/\\?%*:|"<>]/g, '-');
  const cleanT = cleanTitulo.replace(/[/\\?%*:|"<>]/g, '-');
  const cleanFileName = `${cleanM} - ${cleanT}.pdf`;

  return {
    blob: result.blob,
    blobUrl,
    pageCount: result.pages,
    fileName: cleanFileName
  };
}

// ── MASTER SEED DATA (PERMANENTE ANTI-PÉRDIDA DE DATOS ACADÉMICOS) ──
const ACADEMIC_MASTER_SEEDS = {
  materias: [
    {
      id: 'mat_evaluacion_infantojuvenil',
      nombre: 'Evaluación Psicológica y Psicodiagnóstico (Infanto Juvenil)',
      abreviatura: 'EVAL-IJ',
      docente: 'Cátedra de Evaluación y Diagnóstico Infanto-Juvenil',
      color: '#059669',
      año_cursado: 2026,
      cuatrimestre: 2,
      descripcion: 'Evaluación psicométrica de la inteligencia infantil (WISC-IV), modelo CHC, puntuación, baremos, administración y análisis cualitativo clínico.',
      fecha_parcial1: '2026-10-20',
      modalidad_parcial: 'Presencial Escrito',
      temas_parcial1: 'WISC-IV: Fundamentos CHC, Subtests principales y optativos, Baremos, Discontinuación e Interpretación Clínica.'
    },
    {
      id: 'mat_personalidad',
      nombre: 'Psicología de la Personalidad',
      abreviatura: 'PERS',
      docente: 'Cátedra de Psicología de la Personalidad',
      color: '#8B5CF6',
      año_cursado: 2026,
      cuatrimestre: 2,
      descripcion: 'Modelos de rasgos, teorías psicodinámicas, fenomenológicas, cognitivas y evaluación de la personalidad.',
      fecha_parcial1: '2026-11-05',
      modalidad_parcial: 'Presencial Escrito',
      temas_parcial1: 'Unidad 1: Modelos de Rasgos y Factores (Big Five / Costa & McCrae). Unidad 2: Enfoques Fenomenológicos y Conductuales.'
    }
  ],
  bibliografia: [
    {
      id: 'bib_wisc_manual_admin',
      materia_id: 'mat_evaluacion_infantojuvenil',
      materia: 'Evaluación Psicológica y Psicodiagnóstico (Infanto Juvenil)',
      unidad: 'Unidad 1',
      nro_texto: 1,
      titulo_texto: 'Manual de Administración y Puntuación WISC-IV',
      autores: 'Wechsler, D. (2011)',
      caracter: 'Obligatorio',
      estado: 'Leído',
      va_parcial: true,
      nro_parcial: 1,
      link_resumen: '',
      notas: 'Consignas textuales, reglas de comienzo, retorno e interrupción para los 15 subtests.'
    },
    {
      id: 'bib_wisc_fundamentos_chc',
      materia_id: 'mat_evaluacion_infantojuvenil',
      materia: 'Evaluación Psicológica y Psicodiagnóstico (Infanto Juvenil)',
      unidad: 'Unidad 1',
      nro_texto: 2,
      titulo_texto: 'Estructura CHC, Índices y Análisis Clínico Cualitativo WISC-IV',
      autores: 'Flanagan, D. P. & Kaufman, A. S.',
      caracter: 'Obligatorio',
      estado: 'Leído',
      va_parcial: true,
      nro_parcial: 1,
      link_resumen: '',
      notas: 'ICV, IRP, IMT, IVP, CIT, ICG y discrepancias clínicas significativas.'
    },
    {
      id: 'bib_wisc_protocolo_baremos',
      materia_id: 'mat_evaluacion_infantojuvenil',
      materia: 'Evaluación Psicológica y Psicodiagnóstico (Infanto Juvenil)',
      unidad: 'Unidad 1',
      nro_texto: 3,
      titulo_texto: 'Protocolo de Registro, Cálculo de Edades y Baremos Argentinos WISC-IV',
      autores: 'Cátedra Evaluación Infanto-Juvenil / Tabin',
      caracter: 'Obligatorio',
      estado: 'Leído',
      va_parcial: true,
      nro_parcial: 1,
      link_resumen: '',
      notas: 'Conversión de puntuaciones directas a escalares, sumas compuestas, percentiles e intervalos de confianza.'
    },
    {
      id: 'bib_personalidad_u1',
      materia_id: 'mat_personalidad',
      materia: 'Psicología de la Personalidad',
      unidad: 'Unidad 1',
      nro_texto: 1,
      titulo_texto: 'Teorías de la Personalidad: Modelos Factoriales y del Big Five',
      autores: 'Costa, P. T. & McCrae, R. R. / Cloninger, S.',
      caracter: 'Obligatorio',
      estado: 'Leído',
      va_parcial: true,
      nro_parcial: 1,
      link_resumen: '',
      notas: 'Cinco grandes factores: Neuroticismo, Extraversión, Apertura, Amabilidad y Responsabilidad.'
    },
    {
      id: 'bib_personalidad_u2',
      materia_id: 'mat_personalidad',
      materia: 'Psicología de la Personalidad',
      unidad: 'Unidad 2',
      nro_texto: 2,
      titulo_texto: 'Personalidad, Estabilidad y Dinámica del Cambio',
      autores: 'Bandura, A. / Cloninger, S.',
      caracter: 'Obligatorio',
      estado: 'Pendiente',
      va_parcial: true,
      nro_parcial: 1,
      link_resumen: '',
      notas: 'Determinismo recíproco triádico, autoeficacia y autorregulación.'
    }
  ],
  apuntes: [
    {
      id: 'apu_wisc_resumen_integral',
      materia_id: 'mat_evaluacion_infantojuvenil',
      materia: 'Evaluación Psicológica y Psicodiagnóstico (Infanto Juvenil)',
      unidad: 'Unidad 1',
      titulo: 'Resumen Completo WISC-IV: Fundamentos Teóricos, Estructura CHC y Análisis Clínico',
      tipo: 'Resumen',
      va_parcial: true,
      nro_parcial: '1° Parcial',
      pdfName: 'Resumen_Completo_WISC_IV_Catedra_Evaluacion_Infanto_Juvenil.pdf',
      contenido: `# RESUMEN COMPLETO WISC-IV: FUNDAMENTOS TEÓRICOS, ESTRUCTURA CHC Y ANÁLISIS CLÍNICO CUALITATIVO

## Introducción y Modelo Psicométrico CHC
La Escala de Inteligencia de Wechsler para Niños - Cuarta Edición (WISC-IV) es un instrumento clínico de administración individual diseñado para evaluar la capacidad cognitiva de niños y adolescentes de 6 años 0 meses a 16 años 11 meses. Su diseño abandona la antigua dicotomía de CI Verbal / CI de Ejecución para alinearse con la teoría **Cattell-Horn-Carroll (CHC)** sobre las aptitudes cognitivas humanas.

El WISC-IV proporciona una medida de la capacidad intelectual general (**Coeficiente Intelectual Total - CIT**) y cuatro puntuaciones compuestas principales que representan dominios cognitivos discretos:
- **Índice de Comprensión Verbal (ICV):** Mide la inteligencia cristalizada ($Gc$), el razonamiento verbal, la formación de conceptos y el conocimiento léxico adquirido en el entorno sociocultural.
- **Índice de Razonamiento Perceptivo (IRP):** Evalúa la inteligencia fluida ($Gf$) y el procesamiento visual ($Gv$), la integración visomotora y la capacidad de resolver problemas novedosos sin mediación verbal predominante.
- **Índice de Memoria de Trabajo (IMT):** Mide la memoria a corto plazo ($Gsm$), la atención sostenida, la concentración y la capacidad de retener y manipular mentalmente información cuantitativa o secuencial.
- **Índice de Velocidad de Procesamiento (IVP):** Evalúa la velocidad de procesamiento cognitivo ($Gs$), la coordinación visomotora fina, la rapidez mental y la discriminación visual bajo presión de tiempo.

## Estructura de los 15 Subtests (10 Principales y 5 Optativos)

### 1. Comprensión Verbal (ICV)
• **Semejanzas (S - Principal):** El niño debe explicar en qué se parecen dos conceptos o palabras. Evalúa formación de conceptos verbales, pensamiento abstracto y categorización lógica ($Gc$). Puntuación de 0, 1 o 2 puntos según nivel de abstracción.
• **Vocabulario (V - Principal):** Para ítems gráficos, nombrar el dibujo; para ítems verbales, definir palabras. Evalúa riqueza de vocabulario, aprendizaje formal y desarrollo del lenguaje ($Gc$).
• **Comprensión (C - Principal):** Responder a preguntas sobre principios sociales, normas de conducta, situaciones cotidianas y juicios morales. Evalúa juicio social, sentido común y madurez práctica.
• **Información (I - Optativo):** Responder a preguntas de conocimiento general y cultura general adquirida.
• **Adivinanzas (Ad - Optativo):** Identificar conceptos a partir de pistas sucesivas.

### 2. Razonamiento Perceptivo (IRP)
• **Construcción con Cubos (CC - Principal):** Reproducir modelos geométricos bidimensionales utilizando cubos bicolores (rojo y blanco) con límite de tiempo. Evalúa organización perceptual, visualización espacial ($Gv$) y coordinación motriz. Bonificación por tiempo.
• **Conceptos (Co - Principal):** El evaluado debe elegir entre dos o tres filas de ilustraciones aquellas que comparten una característica común. Evalúa razonamiento abstracto no verbal y categorización sin lenguaje ($Gf$).
• **Matrices (M - Principal):** Completar una matriz lógica eligiendo la opción correcta entre cinco alternativas. Evalúa razonamiento inductivo e inteligencia fluida clásica ($Gf$).
• **Figuras Incompletas (FI - Optativo):** Identificar la parte esencial que falta en un dibujo dentro de un límite de tiempo de 20 segundos por ítem.

### 3. Memoria de Trabajo (IMT)
• **Dígitos (D - Principal):** Consta de Dígitos Directos (repetición en el mismo orden, evalúa memoria inmediata y span atencional) y Dígitos Inversos (repetición en orden inverso, evalúa manipulación ejecutiva y memoria de trabajo activa).
• **Letras y Números (LN - Principal):** El evaluador lee una secuencia desordenada de letras y números; el niño debe reorganizarla diciendo primero los números en orden ascendente y luego las letras en orden alfabético.
• **Aritmética (A - Optativo):** Resolver mentalmente problemas matemáticos presentados oralmente dentro de un límite de tiempo estricto.

### 4. Velocidad de Procesamiento (IVP)
• **Claves (CL - Principal):** Copiar símbolos emparejados con números o figuras geométricas sencillas dentro de un límite de 120 segundos. Evalúa memoria visual a corto plazo, velocidad psicomotriz y capacidad de aprendizaje asociativo.
• **Búsqueda de Símbolos (BS - Principal):** Indicar si uno o dos símbolos modelo aparecen en un grupo de búsqueda dentro de 120 segundos. Evalúa velocidad de rastreo visual y discriminación perceptual.
• **Animales (An - Optativo):** Marcar animales en una lámina estructurada o desordenada (cancelación).

## Normas de Administración, Retorno y Discontinuación
- **Cálculo de la Edad Cronológica Exacta:** Restar Fecha de Evaluación menos Fecha de Nacimiento en formato [Año - Mes - Día], realizando los préstamos de 30 días y 12 meses cuando sea necesario.
- **Punto de Comienzo por Edad:** Cada subtest indica en el protocolo el ítem de inicio según la edad del sujeto.
- **Criterio de Retorno:** Si el niño no obtiene puntuación perfecta en los dos primeros ítems correspondientes a su edad, se debe administrar los ítems anteriores en orden inverso hasta obtener dos aciertos consecutivos con puntuación máxima (criterio de base).
- **Criterio de Discontinuación (Suspensión):** Interrumpir la administración tras un número determinado de fallos consecutivos especificados en cada subtest (generalmente 3, 4 o 5 ceros consecutivos).

## Cálculo de Puntuaciones y Diagnóstico Clínico
1. **Puntuaciones Directas (PD):** Suma simple de los puntos obtenidos en cada ítem.
2. **Puntuaciones Escalares (PE):** Se obtienen transformando la PD según el baremo de la edad cronológica correspondiente (Tabla A.1). Media = 10, Desvío Estándar = 3.
3. **Puntuaciones Compuestas e Índices:** Se suman las PE de los subtests principales correspondientes a cada índice y se busca en las tablas de conversión para obtener ICV, IRP, IMT, IVP y CIT (Media = 100, DE = 15).
4. **Índice de Capacidad General (ICG):** Cálculo alternativo que combina exclusivamente ICV + IRP, recomendado cuando existen discrepancias significativas e inusuales entre memoria de trabajo o velocidad de procesamiento respecto a la capacidad de razonamiento.`
    },
    {
      id: 'apu_wisc_consignas',
      materia_id: 'mat_evaluacion_infantojuvenil',
      materia: 'Evaluación Psicológica y Psicodiagnóstico (Infanto Juvenil)',
      unidad: 'Unidad 1',
      titulo: 'Resumen Completo de Consignas y Criterios Subtest por Subtest WISC-IV',
      tipo: 'Guía de Cátedra',
      va_parcial: true,
      nro_parcial: '1° Parcial',
      pdfName: 'Resumen_Completo_Consignas_WISC_IV.pdf',
      contenido: `# CONSIGNAS TEXTUALES Y CRITERIOS DE PUNTUACIÓN SUBTEST POR SUBTEST (WISC-IV)

## 1. Construcción con Cubos (CC)
• **Materiales:** 9 cubos rojo/blanco, Libreta de Estímulos y Cronómetro.
• **Consigna Ítem 1 (4 cubos):** *"Mira estos cubos. Todos son iguales. En algunos lados son todos rojos, en otros todos blancos, y en otros tienen rojo y blanco. Voy a juntar estos cubos para hacer una figura. Mira bien."*
• **Criterio de Suspensión:** Tras 3 puntuaciones consecutivas de 0.
• **Regla de Puntuación:** Ítems 1-3 con 0, 1 o 2 puntos según intentos. Ítems 4-14 con bonificación por tiempo de ejecución rápido.

## 2. Semejanzas (S)
• **Consigna Ítem de Muestra:** *"¿En qué se parecen el rojo y el azul?"* (Si no responde correctamente: *"El rojo y el azul son colores"*).
• **Consigna Ítems de Prueba:** *"¿En qué se parecen un gato y un ratón?"*, *"¿En qué se parecen una manzana y una banana?"*.
• **Criterio de Suspensión:** Tras 3 puntuaciones consecutivas de 0.
• **Criterio de Puntuación:** 
  ◦ 2 puntos: Concepto supraordenado universal y abstracto (ej: "Ambos son mamíferos / animales").
  ◦ 1 punto: Propiedad común o función secundaria (ej: "Los dos tienen cuatro patas / tienen cola").
  ◦ 0 puntos: Diferencias o respuestas incorrectas (ej: "Uno caza al otro").

## 3. Dígitos (D)
• **Consigna Dígitos Directos:** *"Voy a decir unos números. Escucha con atención y cuando termine, repítelos exactamente igual a como yo los dije."* Ritmo de 1 dígito por segundo.
• **Consigna Dígitos Inversos:** *"Ahora voy a decir otros números, pero esta vez, cuando termine, debes decírmelos al revés, de atrás hacia adelante. Si digo 8-2, ¿qué tendrías que decir?"*
• **Criterio de Suspensión:** Discontinuar cada parte tras puntuar 0 en ambos ensayos de un mismo ítem.

## 4. Conceptos (Co)
• **Consigna:** *"Mira esta fila (señalar) y mira esta otra fila (señalar). Elige uno de aquí que vaya con uno de aquí para formar un grupo que tenga algo en común."*
• **Criterio de Suspensión:** Tras 5 puntuaciones consecutivas de 0.

## 5. Claves (CL)
• **Consigna Claves A (6-7 años):** *"Mira aquí. Cada figura tiene una marca adentro. Tienes que dibujar en cada figura vacía la misma marca que le corresponde arriba."*
• **Consigna Claves B (8-16 años):** *"Mira estas casillas. Cada número tiene un signo especial debajo. Llena tantas casillas como puedas en orden sin saltarte ninguna hasta que te diga basta."*
• **Tiempo límite:** 120 segundos cronometrados con precisión.`
    },
    {
      id: 'apu_personalidad_bigfive',
      materia_id: 'mat_personalidad',
      materia: 'Psicología de la Personalidad',
      unidad: 'Unidad 1',
      titulo: 'Resumen Completo: Modelos Factoriales y Dimensiones del Big Five',
      tipo: 'Resumen',
      va_parcial: true,
      nro_parcial: '1° Parcial',
      pdfName: 'Teorias_Personalidad_BigFive_Costa_McCrae.pdf',
      contenido: `# MODELO DE LOS CINCO GRANDES FACTORES DE LA PERSONALIDAD (BIG FIVE)

## 1. Fundamentos Teóricos de Costa & McCrae
El Modelo de los Cinco Grandes Factores (Five-Factor Model - FFM) representa el consenso contemporáneo más sólido en psicometría de la personalidad. Postula que la estructura de la personalidad humana se organiza jerárquicamente en cinco dimensiones bipolares de base biológica y universalidad transcultural.

## 2. Las Cinco Dimensiones y sus Facetas
• **Neuroticismo (N) vs. Estabilidad Emocional:** Tendencia general a experimentar afecto negativo, vulnerabilidad al estrés, ansiedad, hostilidad, depresión y autocrítica.
• **Extraversión (E) vs. Introversión:** Orientación hacia el mundo exterior, sociabilidad, asertividad, búsqueda de sensaciones y nivel de actividad física.
• **Apertura a la Experiencia (O) vs. Convencionalismo:** Curiosidad intelectual, imaginación activa, sensibilidad estética, interés por ideas no convencionales y valores flexibles.
• **Amabilidad / Cordialidad (A) vs. Antagonismo:** Tendencias interpersonales altruistas, empatía, confianza en los demás, franqueza y cooperación.
• **Responsabilidad / Meticulosidad (C) vs. Falta de Dirección:** Control de impulsos orientados a metas, organización, disciplina, perseverancia y sentido del deber.

## 3. Evaluación Psicométrica (NEO-PI-R / NEO-FFI)
El inventario NEO-PI-R evalúa las 5 dimensiones mayores mediante 30 facetas específicas (6 facetas por factor), proporcionando un perfil dimensional de alta estabilidad temporal en la adultez.`
    }
  ],
  documentos_pdf: [
    {
      id: 'pdf_wisc_resumen_integral',
      materia_id: 'mat_evaluacion_infantojuvenil',
      materia: 'Evaluación Psicológica y Psicodiagnóstico (Infanto Juvenil)',
      nombre_archivo: 'Resumen_Completo_WISC_IV_Catedra_Evaluacion_Infanto_Juvenil.pdf',
      titulo: 'Resumen Completo WISC-IV Cátedra Evaluación Infanto Juvenil',
      unidad: 'Unidad 1',
      tipo: 'Resumen',
      va_parcial: true,
      nro_parcial: '1° Parcial',
      num_paginas: 8,
      created_at: new Date().toISOString()
    },
    {
      id: 'pdf_wisc_consignas',
      materia_id: 'mat_evaluacion_infantojuvenil',
      materia: 'Evaluación Psicológica y Psicodiagnóstico (Infanto Juvenil)',
      nombre_archivo: 'Resumen_Completo_Consignas_WISC_IV.pdf',
      titulo: 'Resumen Completo Consignas WISC-IV',
      unidad: 'Unidad 1',
      tipo: 'Guía de Cátedra',
      va_parcial: true,
      nro_parcial: '1° Parcial',
      num_paginas: 12,
      created_at: new Date().toISOString()
    },
    {
      id: 'pdf_personalidad_bigfive',
      materia_id: 'mat_personalidad',
      materia: 'Psicología de la Personalidad',
      nombre_archivo: 'Teorias_Personalidad_BigFive_Costa_McCrae.pdf',
      titulo: 'Teorías de la Personalidad - Modelo Big Five',
      unidad: 'Unidad 1',
      tipo: 'Resumen',
      va_parcial: true,
      nro_parcial: '1° Parcial',
      num_paginas: 6,
      created_at: new Date().toISOString()
    }
  ],
  examenes: [
    {
      id: 'ex_wisc_p1',
      materia_id: 'mat_evaluacion_infantojuvenil',
      materia: 'Evaluación Psicológica y Psicodiagnóstico (Infanto Juvenil)',
      nombre: 'Primer Parcial: Evaluación de la Inteligencia Infantil (WISC-IV)',
      tipo: '1° Parcial',
      fecha: '2026-10-20',
      modalidad: 'Presencial Escrito',
      unidades_incluidas: ['Unidad 1', 'Unidad 2'],
      textos_vinculados: ['bib_wisc_manual_admin', 'bib_wisc_fundamentos_chc', 'bib_wisc_protocolo_baremos'],
      temas: 'Fundamentos psicométricos del WISC-IV, modelo CHC, administración de los 15 subtests, criterios de retorno y discontinuación, cálculo de baremos e interpretación diagnóstica.',
      finalizado: false
    },
    {
      id: 'ex_personalidad_p1',
      materia_id: 'mat_personalidad',
      materia: 'Psicología de la Personalidad',
      nombre: 'Primer Parcial Teórico: Modelos de Rasgos y Big Five',
      tipo: '1° Parcial',
      fecha: '2026-11-05',
      modalidad: 'Presencial Escrito',
      unidades_incluidas: ['Unidad 1', 'Unidad 2'],
      textos_vinculados: ['bib_personalidad_u1', 'bib_personalidad_u2'],
      temas: 'Modelos factoriales, dimensiones Big Five (Costa & McCrae), estabilidad de rasgos y determinismo recíproco.',
      finalizado: false
    }
  ]
};

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('psi_theme') || 'light');
  const [activeTab, setActiveTab] = useState('materias'); // 'materias', 'pdf', 'perfil', 'system'
  const [selectedMateriaId, setSelectedMateriaId] = useState(null);
  const [innerTab, setInnerTab] = useState('params');
  const [biblioFilter, setBiblioFilter] = useState('todos');

  // Academic State (con safe storage anti-crash, filtrado por tombstones y auto-fusión de seeds)
  const [materias, setMaterias] = useState(() => {
    const cached = safeGetLocalStorage('psi_materias_cache', []);
    const validCached = cached.filter(m => !isRecordDeleted('materias', m.id));
    if (validCached.length === 0) return ACADEMIC_MASTER_SEEDS.materias.filter(m => !isRecordDeleted('materias', m.id));
    const merged = [...validCached];
    ACADEMIC_MASTER_SEEDS.materias.forEach(m => {
      if (!isRecordDeleted('materias', m.id) && !merged.find(x => x.id === m.id)) merged.push(m);
    });
    return merged;
  });

  const [biblio, setBiblio] = useState(() => {
    const cached = safeGetLocalStorage('psi_biblio_cache', []);
    const validCached = cached.filter(b => !isRecordDeleted('bibliografia', b.id));
    if (validCached.length === 0) return ACADEMIC_MASTER_SEEDS.bibliografia.filter(b => !isRecordDeleted('bibliografia', b.id));
    const merged = [...validCached];
    ACADEMIC_MASTER_SEEDS.bibliografia.forEach(b => {
      if (!isRecordDeleted('bibliografia', b.id) && !merged.find(x => x.id === b.id)) merged.push(b);
    });
    return merged;
  });

  const [clases, setClases] = useState(() => safeGetLocalStorage('psi_clases_cache', []).filter(c => !isRecordDeleted('clases', c.id)));

  const [apuntes, setApuntes] = useState(() => {
    const cached = safeGetLocalStorage('psi_apuntes_cache', []);
    const validCached = cached.filter(a => !isRecordDeleted('apuntes', a.id));
    if (validCached.length === 0) return ACADEMIC_MASTER_SEEDS.apuntes.filter(a => !isRecordDeleted('apuntes', a.id));
    const merged = [...validCached];
    ACADEMIC_MASTER_SEEDS.apuntes.forEach(a => {
      if (!isRecordDeleted('apuntes', a.id) && !merged.find(x => x.id === a.id)) merged.push(a);
    });
    return merged;
  });

  const [pdfs, setPdfs] = useState(() => {
    const cached = safeGetLocalStorage('psi_pdfs_cache', []);
    const validCached = cached.filter(p => !isRecordDeleted('documentos_pdf', p.id));
    if (validCached.length === 0) return ACADEMIC_MASTER_SEEDS.documentos_pdf.filter(p => !isRecordDeleted('documentos_pdf', p.id));
    const merged = [...validCached];
    ACADEMIC_MASTER_SEEDS.documentos_pdf.forEach(p => {
      if (!isRecordDeleted('documentos_pdf', p.id) && !merged.find(x => x.id === p.id)) merged.push(p);
    });
    return merged;
  });

  const [examenes, setExamenes] = useState(() => {
    const cached = safeGetLocalStorage('psi_examenes_cache', []);
    const validCached = cached.filter(e => !isRecordDeleted('examenes', e.id));
    if (validCached.length === 0) return ACADEMIC_MASTER_SEEDS.examenes.filter(e => !isRecordDeleted('examenes', e.id));
    const merged = [...validCached];
    ACADEMIC_MASTER_SEEDS.examenes.forEach(e => {
      if (!isRecordDeleted('examenes', e.id) && !merged.find(x => x.id === e.id)) merged.push(e);
    });
    return merged;
  });

  // Connectivity & Modals
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState(() => safeGetLocalStorage('psi_sync_queue', []));
  const [toast, setToast] = useState({ show: false, msg: '', iconName: 'check-circle' });
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const currentVersion = 'v2.35.0';

  const [modalMateria, setModalMateria] = useState({ open: false, data: null });
  const [modalBiblio, setModalBiblio] = useState({ open: false, data: null });
  const [modalBiblioBatch, setModalBiblioBatch] = useState(false);
  const [modalClase, setModalClase] = useState({ open: false, data: null });
  const [modalApunte, setModalApunte] = useState({ open: false, data: null });
  const [modalUploadPDF, setModalUploadPDF] = useState({ open: false, materiaId: null });
  const setModalUploadApuntePDF = setModalUploadPDF;
  const modalUploadApuntePDF = modalUploadPDF;
  const [modalExamen, setModalExamen] = useState({ open: false, data: null });
  const [modalPDFViewer, setModalPDFViewer] = useState({ open: false, data: null });
  const [modalSearch, setModalSearch] = useState(false);
  const [modalPomodoro, setModalPomodoro] = useState(false);
  const [modalMoreMenu, setModalMoreMenu] = useState(false);
  const [modalFlashcards, setModalFlashcards] = useState({ open: false, items: [], title: '' });
  const [globalMateriaFilter, setGlobalMateriaFilter] = useState('todas');
  const [recorderPresetData, setRecorderPresetData] = useState(null);

  const [ingestionData, setIngestionData] = useState(null);
  const [profileImage, setProfileImage] = useState(localStorage.getItem('psi_profile_image') || null);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncStatusSummary, setSyncStatusSummary] = useState(null);

  const handleProfileImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
        localStorage.setItem('psi_profile_image', reader.result);
        showToast('Foto de perfil actualizada', 'check');
      };
      reader.readAsDataURL(file);
    }
  };

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('psi_theme', theme);
  }, [theme]);

  // ServiceWorker Registration & Automated Updates
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
                showToast('🚀 Nueva versión de PsiEstudio disponible', 'sparkles');
              }
            });
          }
        });
      }).catch(err => console.warn('[SW] Error registro:', err));
    }
  }, []);

  // Alerta de límite de cuota de almacenamiento local
  useEffect(() => {
    const handleQuotaWarning = () => {
      showToast('⚠️ Cuota de almacenamiento del navegador alcanzada. Datos preservados en IndexedDB.', 'alert-triangle');
    };
    window.addEventListener('psi-storage-quota-warning', handleQuotaWarning);
    return () => window.removeEventListener('psi-storage-quota-warning', handleQuotaWarning);
  }, []);

  const checkForUpdates = async (manual = true) => {
    setCheckingUpdate(true);
    triggerHaptic('light');
    if (manual) showToast('Buscando actualizaciones en la nube...', 'refresh-cw');
    try {
      // 1. Fetch version.json bypassing browser cache
      const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const info = await res.json();
        if (info.version && `v${info.version}` !== currentVersion) {
          setUpdateAvailable(true);
          showToast(`¡Nueva versión v${info.version} encontrada!`, 'sparkles');
          setCheckingUpdate(false);
          return;
        }
      }
      // 2. Trigger SW update
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          if (reg.waiting || reg.installing) {
            setUpdateAvailable(true);
            showToast('¡Nueva versión lista para instalar!', 'sparkles');
            setCheckingUpdate(false);
            return;
          }
        }
      }
      if (manual) showToast(`PsiEstudio está al día (${currentVersion})`, 'check-circle-2');
    } catch (e) {
      if (manual) showToast('No se pudo verificar la actualización', 'alert-circle');
    } finally {
      setCheckingUpdate(false);
    }
  };

  const applyUpdate = async () => {
    showToast('Actualizando PsiEstudio...', 'refresh-cw');
    triggerHaptic('success');
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(k => caches.delete(k)));
      } catch (e) {}
    }
    setTimeout(() => {
      window.location.reload(true);
    }, 500);
  };

  // Initial Fetch & Offline Handling
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Conexión restaurada — Sincronizando', 'wifi');
      processSyncQueue();
      fetchAllData();
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('Modo Offline — Datos en caché local', 'wifi-off');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Auto-seed garantizado
    seedInitialData();
    fetchAllData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showToast = (msg, iconName = 'check-circle') => {
    setToast({ show: true, msg, iconName });
    setTimeout(() => setToast({ show: false, msg: '', iconName: 'check-circle' }), 3200);
  };

  const saveToIndexedDB = async (tableName, items) => {
    if (psiDB && psiDB[tableName] && Array.isArray(items)) {
      try {
        if (tableName === 'documentos_pdf' || tableName === 'apuntes') {
          // Merge defensivo: preservar binarios locales existentes si el ítem entrante no los tiene
          const existing = await psiDB[tableName].toArray();
          const mergedItems = items.map(item => {
            if (!item) return item;
            const match = existing.find(e => e.id === item.id);
            if (match) {
              return {
                ...match,
                ...item,
                pdfData: item.pdfData || match.pdfData || null,
                pdfName: item.pdfName || match.pdfName || null,
                numPages: item.numPages || match.numPages || match.num_paginas || 1,
                num_paginas: item.num_paginas || match.num_paginas || match.numPages || 1,
                texto_extraido: item.texto_extraido || match.texto_extraido || '',
                contenido: item.contenido || match.contenido || ''
              };
            }
            return item;
          });
          await psiDB[tableName].clear();
          if (mergedItems.length > 0) {
            await psiDB[tableName].bulkPut(mergedItems);
          }
        } else {
          await psiDB[tableName].clear();
          if (items.length > 0) {
            await psiDB[tableName].bulkPut(items);
          }
        }
      } catch (e) {
        console.warn(`IndexedDB save error (${tableName}):`, e);
      }
    }
  };

  const seedInitialData = () => {
    setMaterias(prev => {
      let merged = prev.filter(m => !isRecordDeleted('materias', m.id));
      [...ACADEMIC_MASTER_SEEDS.materias].reverse().forEach(m => {
        if (isRecordDeleted('materias', m.id)) return;
        const idx = merged.findIndex(x => x.id === m.id || x.nombre.toLowerCase() === m.nombre.toLowerCase());
        if (idx === -1) merged.unshift(m);
        else merged[idx] = { ...m, ...merged[idx] };
      });
      safeSetLocalStorage('psi_materias_cache', merged);
      saveToIndexedDB('materias', merged);
      return merged;
    });

    setBiblio(prev => {
      let merged = prev.filter(b => !isRecordDeleted('bibliografia', b.id));
      [...ACADEMIC_MASTER_SEEDS.bibliografia].reverse().forEach(b => {
        if (isRecordDeleted('bibliografia', b.id)) return;
        const idx = merged.findIndex(x => x.id === b.id || (x.titulo_texto === b.titulo_texto && x.materia_id === b.materia_id));
        if (idx === -1) merged.unshift(b);
      });
      safeSetLocalStorage('psi_biblio_cache', merged);
      saveToIndexedDB('bibliografia', merged);
      return merged;
    });

    setApuntes(prev => {
      let merged = prev.filter(a => !isRecordDeleted('apuntes', a.id));
      [...ACADEMIC_MASTER_SEEDS.apuntes].reverse().forEach(a => {
        if (isRecordDeleted('apuntes', a.id)) return;
        const idx = merged.findIndex(x => x.id === a.id || (x.titulo === a.titulo && x.materia_id === a.materia_id));
        if (idx === -1) merged.unshift(a);
      });
      safeSetLocalStorage('psi_apuntes_cache', merged);
      saveToIndexedDB('apuntes', merged);
      return merged;
    });

    setPdfs(prev => {
      let merged = prev.filter(p => !isRecordDeleted('documentos_pdf', p.id));
      [...ACADEMIC_MASTER_SEEDS.documentos_pdf].reverse().forEach(p => {
        if (isRecordDeleted('documentos_pdf', p.id)) return;
        const idx = merged.findIndex(x => x.id === p.id || (x.nombre_archivo === p.nombre_archivo && x.materia_id === p.materia_id));
        if (idx === -1) merged.unshift(p);
      });
      safeSetLocalStorage('psi_pdfs_cache', merged);
      saveToIndexedDB('documentos_pdf', merged);
      return merged;
    });

    setExamenes(prev => {
      let merged = prev.filter(e => !isRecordDeleted('examenes', e.id));
      [...ACADEMIC_MASTER_SEEDS.examenes].reverse().forEach(e => {
        if (isRecordDeleted('examenes', e.id)) return;
        const idx = merged.findIndex(x => x.id === e.id || (x.nombre === e.nombre && x.materia_id === e.materia_id));
        if (idx === -1) merged.unshift(e);
      });
      safeSetLocalStorage('psi_examenes_cache', merged);
      saveToIndexedDB('examenes', merged);
      return merged;
    });
  };

  // IndexedDB Initial Load & Supabase Realtime Subscription
  useEffect(() => {
    const loadFromIndexedDB = async () => {
      if (!psiDB) return;
      try {
        const [mats, bibs, clas, apus, pdfsList, exas, queue] = await Promise.all([
          psiDB.materias.toArray(),
          psiDB.bibliografia.toArray(),
          psiDB.clases.toArray(),
          psiDB.apuntes.toArray(),
          psiDB.documentos_pdf.toArray(),
          psiDB.examenes.toArray(),
          psiDB.syncQueue.toArray()
        ]);

        let mergedMats = mats.filter(m => !isRecordDeleted('materias', m.id));
        [...ACADEMIC_MASTER_SEEDS.materias].reverse().forEach(m => {
          if (isRecordDeleted('materias', m.id)) return;
          const idx = mergedMats.findIndex(x => x.id === m.id || x.nombre.toLowerCase() === m.nombre.toLowerCase());
          if (idx === -1) mergedMats.unshift(m);
          else mergedMats[idx] = { ...m, ...mergedMats[idx] };
        });
        setMaterias(mergedMats);

        let mergedBibs = bibs.filter(b => !isRecordDeleted('bibliografia', b.id));
        [...ACADEMIC_MASTER_SEEDS.bibliografia].reverse().forEach(b => {
          if (isRecordDeleted('bibliografia', b.id)) return;
          const idx = mergedBibs.findIndex(x => x.id === b.id || (x.titulo_texto === b.titulo_texto && x.materia_id === b.materia_id));
          if (idx === -1) mergedBibs.unshift(b);
        });
        setBiblio(mergedBibs);

        const validClas = clas.filter(c => !isRecordDeleted('clases', c.id));
        if (validClas.length > 0) setClases(validClas);

        let mergedPdfs = pdfsList.filter(p => !isRecordDeleted('documentos_pdf', p.id));
        [...ACADEMIC_MASTER_SEEDS.documentos_pdf].reverse().forEach(p => {
          if (isRecordDeleted('documentos_pdf', p.id)) return;
          const idx = mergedPdfs.findIndex(x => x.id === p.id || (x.nombre_archivo === p.nombre_archivo && x.materia_id === p.materia_id));
          if (idx === -1) mergedPdfs.unshift(p);
        });
        setPdfs(mergedPdfs);
        
        let mergedApuntes = apus.filter(a => !isRecordDeleted('apuntes', a.id));
        [...ACADEMIC_MASTER_SEEDS.apuntes].reverse().forEach(a => {
          if (isRecordDeleted('apuntes', a.id)) return;
          const idx = mergedApuntes.findIndex(x => x.id === a.id || (x.titulo === a.titulo && x.materia_id === a.materia_id));
          if (idx === -1) mergedApuntes.unshift(a);
        });

        if (mergedPdfs && mergedPdfs.length > 0) {
          mergedPdfs.forEach(p => {
            const existingIdx = mergedApuntes.findIndex(a => a.id === p.id || a.pdfName === p.nombre_archivo);
            if (existingIdx === -1) {
              mergedApuntes = [{
                id: p.id,
                materia_id: p.materia_id,
                materia: p.materia,
                unidad: p.unidad || 'Unidad 1',
                titulo: p.titulo || p.nombre_archivo,
                tipo: p.tipo || 'Resumen',
                va_parcial: Boolean(p.va_parcial),
                nro_parcial: p.nro_parcial || null,
                pdfName: p.nombre_archivo,
                numPages: p.num_paginas || 1,
                pdfData: p.pdfData || null,
                contenido: `[Documento PDF Original: ${p.nombre_archivo || p.titulo}]`,
                created_at: p.created_at || new Date().toISOString()
              }, ...mergedApuntes];
            } else if (p.pdfData && !mergedApuntes[existingIdx].pdfData) {
              mergedApuntes[existingIdx].pdfData = p.pdfData;
            }
          });
        }
        setApuntes(mergedApuntes);

        let mergedExams = exas.filter(e => !isRecordDeleted('examenes', e.id));
        [...ACADEMIC_MASTER_SEEDS.examenes].reverse().forEach(e => {
          if (isRecordDeleted('examenes', e.id)) return;
          const idx = mergedExams.findIndex(x => x.id === e.id || (x.nombre === e.nombre && x.materia_id === e.materia_id));
          if (idx === -1) mergedExams.unshift(e);
        });
        setExamenes(mergedExams);

        if (queue.length > 0) setSyncQueue(queue);
      } catch (e) {
        console.warn('Error loading from IndexedDB:', e);
      }
    };
    loadFromIndexedDB();

    if (!supabaseClient) return;

    const channel = supabaseClient
      .channel('psi_realtime_db')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        console.log('[Supabase Realtime] Cambio detectado:', payload);
        fetchAllData();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase Realtime] Canales activos');
        }
      });

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [supabaseClient]);

  const fetchAllData = async () => {
    if (!supabaseClient || !navigator.onLine) return;
    try {
      const [matsRes, bibRes, claRes, apuRes, pdfRes, exRes] = await Promise.allSettled([
        supabaseClient.from('materias').select('*').order('nombre'),
        supabaseClient.from('bibliografia').select('*').order('unidad'),
        supabaseClient.from('clases').select('*').order('nro_clase'),
        supabaseClient.from('apuntes').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('documentos_pdf').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('examenes').select('*').order('fecha')
      ]);

      const isPendingLocalInsert = (table, id) => {
        return syncQueue.some(q => q.table === table && (q.action === 'INSERT' || q.action === 'UPDATE') && q.payload?.id === id);
      };

      if (matsRes.status === 'fulfilled' && Array.isArray(matsRes.value.data)) {
        matsRes.value.data.forEach(m => {
          if (m.deleted_at || isRecordDeleted('materias', m.id)) {
            addDeletedRecord('materias', m.id);
          }
        });
        setMaterias(prev => {
          let serverActive = matsRes.value.data.filter(m => !m.deleted_at && !isRecordDeleted('materias', m.id));
          prev.filter(p => !isRecordDeleted('materias', p.id) && isPendingLocalInsert('materias', p.id)).forEach(p => {
            if (!serverActive.find(m => m.id === p.id)) serverActive.push(p);
          });
          safeSetLocalStorage('psi_materias_cache', serverActive);
          saveToIndexedDB('materias', serverActive);
          return serverActive;
        });
      }

      if (bibRes.status === 'fulfilled' && Array.isArray(bibRes.value.data)) {
        bibRes.value.data.forEach(b => {
          if (b.deleted_at || isRecordDeleted('bibliografia', b.id)) {
            addDeletedRecord('bibliografia', b.id);
          }
        });
        setBiblio(prev => {
          let serverActive = bibRes.value.data.filter(b => !b.deleted_at && !isRecordDeleted('bibliografia', b.id));
          prev.filter(p => !isRecordDeleted('bibliografia', p.id) && isPendingLocalInsert('bibliografia', p.id)).forEach(p => {
            if (!serverActive.find(b => b.id === p.id)) serverActive.push(p);
          });
          safeSetLocalStorage('psi_biblio_cache', serverActive);
          saveToIndexedDB('bibliografia', serverActive);
          return serverActive;
        });
      }

      if (claRes.status === 'fulfilled' && Array.isArray(claRes.value.data)) {
        claRes.value.data.forEach(c => {
          if (c.deleted_at || isRecordDeleted('clases', c.id)) {
            addDeletedRecord('clases', c.id);
          }
        });
        setClases(prev => {
          let serverActive = claRes.value.data.filter(c => !c.deleted_at && !isRecordDeleted('clases', c.id));
          prev.filter(p => !isRecordDeleted('clases', p.id) && isPendingLocalInsert('clases', p.id)).forEach(p => {
            if (!serverActive.find(c => c.id === p.id)) serverActive.push(p);
          });
          safeSetLocalStorage('psi_clases_cache', serverActive);
          saveToIndexedDB('clases', serverActive);
          return serverActive;
        });
      }

      if (apuRes.status === 'fulfilled' && Array.isArray(apuRes.value.data)) {
        apuRes.value.data.forEach(a => {
          if (a.deleted_at || isRecordDeleted('apuntes', a.id)) {
            addDeletedRecord('apuntes', a.id);
          }
        });
        setApuntes(prev => {
          let incoming = apuRes.value.data.filter(a => !a.deleted_at && !isRecordDeleted('apuntes', a.id));
          let merged = incoming.map(inc => {
            const match = prev.find(p => p.id === inc.id);
            if (match) {
              return {
                ...match,
                ...inc,
                pdfData: match.pdfData || inc.pdfData || null,
                pdfName: match.pdfName || inc.pdfName || null,
                numPages: match.numPages || inc.numPages || 1
              };
            }
            return inc;
          });
          prev.filter(p => !isRecordDeleted('apuntes', p.id) && isPendingLocalInsert('apuntes', p.id)).forEach(p => {
            if (!merged.find(a => a.id === p.id)) merged.push(p);
          });
          safeSetLocalStorage('psi_apuntes_cache', merged);
          saveToIndexedDB('apuntes', merged);
          return merged;
        });
      }

      if (pdfRes.status === 'fulfilled' && Array.isArray(pdfRes.value.data)) {
        pdfRes.value.data.forEach(p => {
          if (p.deleted_at || isRecordDeleted('documentos_pdf', p.id)) {
            addDeletedRecord('documentos_pdf', p.id);
          }
        });
        setPdfs(prev => {
          let incoming = pdfRes.value.data.filter(p => !p.deleted_at && !isRecordDeleted('documentos_pdf', p.id));
          let merged = incoming.map(inc => {
            const match = prev.find(p => p.id === inc.id);
            if (match) {
              return {
                ...match,
                ...inc,
                pdfData: match.pdfData || inc.pdfData || null,
                num_paginas: match.num_paginas || inc.num_paginas || 1,
                tamaño_bytes: match.tamaño_bytes || inc.tamaño_bytes || 0
              };
            }
            return inc;
          });
          prev.filter(p => !isRecordDeleted('documentos_pdf', p.id) && isPendingLocalInsert('documentos_pdf', p.id)).forEach(p => {
            if (!merged.find(m => m.id === p.id)) merged.push(p);
          });
          safeSetLocalStorage('psi_pdfs_cache', merged);
          saveToIndexedDB('documentos_pdf', merged);
          return merged;
        });
      }

      if (exRes.status === 'fulfilled' && Array.isArray(exRes.value.data)) {
        exRes.value.data.forEach(e => {
          if (e.deleted_at || isRecordDeleted('examenes', e.id)) {
            addDeletedRecord('examenes', e.id);
          }
        });
        setExamenes(prev => {
          let serverActive = exRes.value.data.filter(e => !e.deleted_at && !isRecordDeleted('examenes', e.id));
          prev.filter(p => !isRecordDeleted('examenes', p.id) && isPendingLocalInsert('examenes', p.id)).forEach(p => {
            if (!serverActive.find(e => e.id === p.id)) serverActive.push(p);
          });
          safeSetLocalStorage('psi_examenes_cache', serverActive);
          saveToIndexedDB('examenes', serverActive);
          return serverActive;
        });
      }

      // Procesa la cola offline de forma ordenada si hay pendientes
      if (syncQueue && syncQueue.length > 0) {
        processSyncQueue();
      }
    } catch (err) {
      console.warn('Sync fetch error:', err);
    }
  };

  const enqueueAction = async (action, table, payload) => {
    const cleanPayload = stripLargeBinaryFields(payload);
    const item = { id: Date.now(), action, table, payload: cleanPayload, timestamp: new Date().toISOString() };
    const newQueue = [...syncQueue, item];
    setSyncQueue(newQueue);
    safeSetLocalStorage('psi_sync_queue', newQueue);
    if (psiDB && psiDB.syncQueue) {
      try {
        await psiDB.syncQueue.add(item);
      } catch (e) {
        console.warn('IndexedDB enqueue error:', e);
      }
    }
  };

  // ── SANITIZACIÓN DEFENSIVA PARA ESQUEMA POSTGRES / SUPABASE ──
  const sanitizeForCloud = {
    materias: (m) => {
      const { evaluaciones, ...clean } = m || {};
      return {
        id: String(clean.id),
        nombre: String(clean.nombre || ''),
        abreviatura: String(clean.abreviatura || 'MAT'),
        docente: String(clean.docente || ''),
        color: String(clean.color || '#10B981'),
        año_cursado: parseInt(clean.año_cursado, 10) || 2026,
        cuatrimestre: parseInt(clean.cuatrimestre, 10) || 1,
        descripcion: String(clean.descripcion || ''),
        fecha_parcial1: clean.fecha_parcial1 || null,
        modalidad_parcial: String(clean.modalidad_parcial || 'Presencial Escrito'),
        temas_parcial1: String(clean.temas_parcial1 || ''),
        created_at: clean.created_at || new Date().toISOString()
      };
    },
    bibliografia: (b) => {
      let nroParcial = null;
      if (b && b.nro_parcial) {
        const match = String(b.nro_parcial).match(/\d+/);
        nroParcial = match ? parseInt(match[0], 10) : 1;
      }
      return {
        id: String(b?.id || ''),
        materia_id: b?.materia_id || null,
        materia: String(b?.materia || ''),
        unidad: String(b?.unidad || 'Unidad 1'),
        nro_texto: parseInt(b?.nro_texto, 10) || 1,
        titulo_texto: String(b?.titulo_texto || 'Texto sin título'),
        autores: String(b?.autores || ''),
        caracter: String(b?.caracter || 'Obligatorio'),
        estado: String(b?.estado || 'Pendiente'),
        va_parcial: Boolean(b?.va_parcial),
        nro_parcial: nroParcial,
        link_resumen: String(b?.link_resumen || ''),
        notas: String(b?.notas || ''),
        created_at: b?.created_at || new Date().toISOString()
      };
    },
    clases: (c) => {
      return {
        id: String(c?.id || ''),
        materia_id: c?.materia_id || null,
        materia: String(c?.materia || ''),
        nro_clase: parseInt(c?.nro_clase, 10) || 1,
        tipo: String(c?.tipo || 'Teórica'),
        titulo_clase: String(c?.titulo_clase || ''),
        desgrabacion_md: String(c?.desgrabacion_md || ''),
        link_grabacion: String(c?.link_grabacion || ''),
        grabaciones: Array.isArray(c?.grabaciones) ? c.grabaciones.map(g => ({ id: g.id, title: g.title, url: (typeof g.url === 'string' && g.url.startsWith('data:') ? '' : g.url) })) : [],
        imagenes: Array.isArray(c?.imagenes) ? c.imagenes.map(img => ({ id: img.id, caption: img.caption, url: (typeof img.url === 'string' && img.url.startsWith('data:') ? '' : img.url) })) : [],
        aclaraciones: String(c?.aclaraciones || ''),
        temas_enfasis: String(c?.temas_enfasis || ''),
        fecha_carga: c?.fecha_carga || c?.fecha || new Date().toISOString()
      };
    },
    apuntes: (a) => {
      const { pdfData, pdfName, numPages, saveToPdfDocs, ...clean } = a || {};
      let nroParcial = null;
      if (clean.nro_parcial) {
        const match = String(clean.nro_parcial).match(/\d+/);
        nroParcial = match ? parseInt(match[0], 10) : 1;
      }
      return {
        id: String(clean.id || ''),
        materia_id: clean.materia_id || null,
        materia: String(clean.materia || ''),
        unidad: String(clean.unidad || 'Unidad 1'),
        titulo: String(clean.titulo || 'Apunte'),
        tipo: String(clean.tipo || 'Resumen'),
        va_parcial: Boolean(clean.va_parcial),
        nro_parcial: nroParcial,
        contenido: String(clean.contenido || ''),
        created_at: clean.created_at || new Date().toISOString()
      };
    },
    documentos_pdf: (p) => {
      const { pdfData, ...clean } = p || {};
      let nroParcial = null;
      if (clean.nro_parcial) {
        const match = String(clean.nro_parcial).match(/\d+/);
        nroParcial = match ? parseInt(match[0], 10) : 1;
      }
      return {
        id: String(clean.id || ''),
        nombre_archivo: String(clean.nombre_archivo || 'documento.pdf'),
        titulo: String(clean.titulo || clean.nombre_archivo || 'Documento PDF'),
        materia_id: clean.materia_id || null,
        materia: String(clean.materia || ''),
        unidad: String(clean.unidad || 'Unidad 1'),
        tipo: String(clean.tipo || 'Resumen'),
        num_paginas: parseInt(clean.num_paginas, 10) || 1,
        va_parcial: Boolean(clean.va_parcial),
        nro_parcial: nroParcial,
        texto_extraido: clean.texto_extraido ? String(clean.texto_extraido).slice(0, 5000) : '',
        created_at: clean.created_at || new Date().toISOString()
      };
    },
    examenes: (e) => {
      const linkedTexts = e?.textos_vinculados || e?.textos_ids || [];
      return {
        id: String(e?.id || ''),
        materia_id: e?.materia_id || null,
        materia: String(e?.materia || ''),
        nombre: String(e?.nombre || 'Evaluación'),
        tipo: String(e?.tipo || 'Parcial 1'),
        fecha: e?.fecha || new Date().toISOString().split('T')[0],
        modalidad: String(e?.modalidad || 'Presencial Escrito'),
        temas: String(e?.temas || ''),
        unidades_incluidas: Array.isArray(e?.unidades_incluidas) ? e.unidades_incluidas : [],
        textos_vinculados: Array.isArray(linkedTexts) ? linkedTexts : [],
        textos_ids: Array.isArray(linkedTexts) ? linkedTexts : [],
        finalizado: Boolean(e?.finalizado),
        created_at: e?.created_at || new Date().toISOString()
      };
    }
  };

  const processSyncQueue = async () => {
    if (!navigator.onLine || !supabaseClient || syncQueue.length === 0) return;
    const queue = [...syncQueue];
    const remainingQueue = [];

    for (const item of queue) {
      try {
        if (!item.table || !item.payload) continue;
        const sanitizer = sanitizeForCloud[item.table];
        const cleanPayload = sanitizer ? sanitizer(item.payload) : item.payload;

        if (item.action === 'INSERT' || item.action === 'UPDATE') {
          const { error } = await supabaseClient.from(item.table).upsert(cleanPayload, { onConflict: 'id' });
          if (error) throw error;
        } else if (item.action === 'DELETE') {
          const { error } = await supabaseClient.from(item.table).delete().eq('id', item.payload.id);
          if (error) throw error;
        }
      } catch (e) {
        console.warn(`[SyncQueue] Error al sincronizar ítem en ${item.table}:`, e);
        remainingQueue.push(item);
      }
    }

    setSyncQueue(remainingQueue);
    safeSetLocalStorage('psi_sync_queue', remainingQueue);
    if (psiDB && psiDB.syncQueue) {
      try {
        await psiDB.syncQueue.clear();
        if (remainingQueue.length > 0) {
          await psiDB.syncQueue.bulkAdd(remainingQueue);
        }
      } catch (e) {
        console.warn('IndexedDB syncQueue update error:', e);
      }
    }

    if (remainingQueue.length === 0) {
      showToast('Cola sincronizada con Supabase', 'cloud-check');
    } else {
      showToast(`${remainingQueue.length} elemento(s) pendientes de reintento`, 'alert-circle');
    }
  };

  const currentMateria = useMemo(() => {
    return materias.find(m => m.id === selectedMateriaId) || null;
  }, [materias, selectedMateriaId]);

  const currentMateriaTexts = useMemo(() => {
    if (!currentMateria) return [];
    return biblio.filter(b => b.materia_id === currentMateria.id || b.materia === currentMateria.nombre);
  }, [biblio, currentMateria]);

  const currentMateriaUnits = useMemo(() => {
    const set = new Set(currentMateriaTexts.map(t => t.unidad || 'Unidad 1'));
    const detected = Array.from(set).filter(Boolean);
    if (detected.length === 0) {
      return ['Unidad 1', 'Unidad 2', 'Unidad 3', 'Unidad 4', 'Unidad 5'];
    }
    return detected;
  }, [currentMateriaTexts]);

  const currentMateriaExams = useMemo(() => {
    if (!currentMateria) return [];
    return examenes.filter(e => e.materia_id === currentMateria.id || e.materia === currentMateria.nombre);
  }, [examenes, currentMateria]);

  const currentMateriaClases = useMemo(() => {
    if (!currentMateria) return [];
    return clases.filter(c => c.materia_id === currentMateria.id || c.materia === currentMateria.nombre);
  }, [clases, currentMateria]);

  const currentMateriaApuntes = useMemo(() => {
    if (!currentMateria) return [];
    return apuntes.filter(a => a.materia_id === currentMateria.id || a.materia === currentMateria.nombre);
  }, [apuntes, currentMateria]);

  const currentMateriaPdfs = useMemo(() => {
    if (!currentMateria) return [];
    return pdfs.filter(p => p.materia_id === currentMateria.id || p.materia === currentMateria.nombre);
  }, [pdfs, currentMateria]);

  // Global Next Exam Calculation
  const nextExam = useMemo(() => {
    const hoyMs = new Date().setHours(0, 0, 0, 0);
    const valid = examenes
      .filter(e => !e.finalizado && e.fecha)
      .filter(e => new Date(e.fecha + 'T00:00:00').getTime() >= hoyMs)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    return valid[0] || null;
  }, [examenes]);

  // ── SAVE & CRUD HANDLERS ──
  const handleSaveMateria = async (formData) => {
    const isEdit = Boolean(formData.id);
    const payload = {
      ...formData,
      id: formData.id || generarUUID('mat'),
      created_at: formData.created_at || new Date().toISOString()
    };

    const updated = isEdit ? materias.map(m => m.id === payload.id ? payload : m) : [...materias, payload];
    setMaterias(updated);
    safeSetLocalStorage('psi_materias_cache', updated);
    saveToIndexedDB('materias', updated);
    setModalMateria({ open: false, data: null });
    showToast(isEdit ? 'Materia actualizada' : 'Materia creada', 'book');

    // Sincronizar evaluaciones dinámicas en la colección de exámenes
    if (Array.isArray(formData.evaluaciones) && formData.evaluaciones.length > 0) {
      let currentExs = [...examenes];
      formData.evaluaciones.forEach((ev, idx) => {
        const existingIdx = currentExs.findIndex(ex => (ex.id === ev.id) || (ex.materia_id === payload.id && ex.nombre === ev.nombre));
        const examItem = {
          id: ev.id || generarUUID('ex'),
          nombre: ev.nombre || ev.tipo || 'Evaluación',
          materia_id: payload.id,
          materia: payload.nombre,
          tipo: ev.tipo || '1° Parcial',
          fecha: ev.fecha || new Date().toISOString().split('T')[0],
          modalidad: ev.modalidad || 'Presencial Escrito',
          temas: ev.temario || '',
          unidades_incluidas: [],
          textos_vinculados: [],
          textos_ids: [],
          created_at: new Date().toISOString()
        };
        if (existingIdx >= 0) {
          currentExs[existingIdx] = { ...currentExs[existingIdx], ...examItem };
        } else {
          currentExs.push(examItem);
        }
      });
      setExamenes(currentExs);
      safeSetLocalStorage('psi_examenes_cache', currentExs);
      saveToIndexedDB('examenes', currentExs);
    }

    if (supabaseClient && isOnline) {
      try {
        // Excluir 'evaluaciones' del payload directo de materias en Supabase para evitar 400 Bad Request
        const { evaluaciones, ...cleanMateria } = payload;
        if (isEdit) await supabaseClient.from('materias').update(cleanMateria).eq('id', cleanMateria.id);
        else await supabaseClient.from('materias').insert([cleanMateria]);
      } catch (e) {
        enqueueAction(isEdit ? 'UPDATE' : 'INSERT', 'materias', payload);
      }
    } else {
      enqueueAction(isEdit ? 'UPDATE' : 'INSERT', 'materias', payload);
    }
  };

  const handleDeleteMateria = async (id) => {
    const target = materias.find(m => m.id === id);
    const nombreMat = target?.nombre || '';
    if (!confirm(`¿Eliminar definitivamente la materia "${nombreMat || id}" y todos sus datos asociados (apuntes, bibliografía, clases, PDFs y exámenes)?`)) return;

    // 1. Identificar registros hijos asociados
    const childBiblio = biblio.filter(b => b.materia_id === id || (nombreMat && b.materia === nombreMat));
    const childClases = clases.filter(c => c.materia_id === id || (nombreMat && c.materia === nombreMat));
    const childApuntes = apuntes.filter(a => a.materia_id === id || (nombreMat && a.materia === nombreMat));
    const childPdfs = pdfs.filter(p => p.materia_id === id || (nombreMat && p.materia === nombreMat));
    const childExamenes = examenes.filter(e => e.materia_id === id || (nombreMat && e.materia === nombreMat));

    // 2. Registrar Tombstones Anti-Resurrección
    addDeletedRecord('materias', id);
    childBiblio.forEach(b => addDeletedRecord('bibliografia', b.id));
    childClases.forEach(c => addDeletedRecord('clases', c.id));
    childApuntes.forEach(a => addDeletedRecord('apuntes', a.id));
    childPdfs.forEach(p => addDeletedRecord('documentos_pdf', p.id));
    childExamenes.forEach(e => addDeletedRecord('examenes', e.id));

    // 3. Actualizar React State & LocalStorage
    const updatedMats = materias.filter(m => m.id !== id);
    const updatedBib = biblio.filter(b => b.materia_id !== id && (!nombreMat || b.materia !== nombreMat));
    const updatedCla = clases.filter(c => c.materia_id !== id && (!nombreMat || c.materia !== nombreMat));
    const updatedApu = apuntes.filter(a => a.materia_id !== id && (!nombreMat || a.materia !== nombreMat));
    const updatedPdf = pdfs.filter(p => p.materia_id !== id && (!nombreMat || p.materia !== nombreMat));
    const updatedExa = examenes.filter(e => e.materia_id !== id && (!nombreMat || e.materia !== nombreMat));

    setMaterias(updatedMats);
    setBiblio(updatedBib);
    setClases(updatedCla);
    setApuntes(updatedApu);
    setPdfs(updatedPdf);
    setExamenes(updatedExa);

    safeSetLocalStorage('psi_materias_cache', updatedMats);
    safeSetLocalStorage('psi_biblio_cache', updatedBib);
    safeSetLocalStorage('psi_clases_cache', updatedCla);
    safeSetLocalStorage('psi_apuntes_cache', updatedApu);
    safeSetLocalStorage('psi_pdfs_cache', updatedPdf);
    safeSetLocalStorage('psi_examenes_cache', updatedExa);

    if (selectedMateriaId === id) setSelectedMateriaId(null);

    // 4. Limpiar en IndexedDB
    if (psiDB) {
      try {
        await Promise.allSettled([
          psiDB.materias.delete(id),
          childBiblio.length > 0 ? psiDB.bibliografia.bulkDelete(childBiblio.map(b => b.id)) : Promise.resolve(),
          childClases.length > 0 ? psiDB.clases.bulkDelete(childClases.map(c => c.id)) : Promise.resolve(),
          childApuntes.length > 0 ? psiDB.apuntes.bulkDelete(childApuntes.map(a => a.id)) : Promise.resolve(),
          childPdfs.length > 0 ? psiDB.documentos_pdf.bulkDelete(childPdfs.map(p => p.id)) : Promise.resolve(),
          childExamenes.length > 0 ? psiDB.examenes.bulkDelete(childExamenes.map(e => e.id)) : Promise.resolve()
        ]);
      } catch (errDB) {
        console.warn('Error borrando en IndexedDB:', errDB);
      }
    }

    showToast('Materia y datos vinculados eliminados definitivamente', 'trash-2');

    // 5. Eliminar en Supabase en Cascada
    if (supabaseClient && isOnline) {
      try {
        await Promise.allSettled([
          supabaseClient.from('materias').delete().eq('id', id),
          supabaseClient.from('bibliografia').delete().eq('materia_id', id),
          supabaseClient.from('clases').delete().eq('materia_id', id),
          supabaseClient.from('apuntes').delete().eq('materia_id', id),
          supabaseClient.from('documentos_pdf').delete().eq('materia_id', id),
          supabaseClient.from('examenes').delete().eq('materia_id', id)
        ]);
      } catch (e) {
        enqueueAction('DELETE', 'materias', { id });
      }
    } else {
      enqueueAction('DELETE', 'materias', { id });
    }
  };

  const handleSaveBiblio = async (formData) => {
    const isEdit = Boolean(formData.id);
    const payload = {
      ...formData,
      id: formData.id || generarUUID('bib'),
      materia_id: selectedMateriaId,
      materia: currentMateria ? currentMateria.nombre : 'General',
      created_at: formData.created_at || new Date().toISOString()
    };

    const updated = isEdit ? biblio.map(b => b.id === payload.id ? payload : b) : [payload, ...biblio];
    setBiblio(updated);
    safeSetLocalStorage('psi_biblio_cache', updated);
    setModalBiblio({ open: false, data: null });
    showToast('Texto guardado en bibliografía', 'file-text');

    if (supabaseClient && isOnline) {
      try {
        if (isEdit) await supabaseClient.from('bibliografia').update(payload).eq('id', payload.id);
        else await supabaseClient.from('bibliografia').insert([payload]);
      } catch (e) {
        enqueueAction(isEdit ? 'UPDATE' : 'INSERT', 'bibliografia', payload);
      }
    } else {
      enqueueAction(isEdit ? 'UPDATE' : 'INSERT', 'bibliografia', payload);
    }
  };

  // Structured Batch Import
  const handleBatchImportBiblio = async (parsedItems) => {
    const newItems = parsedItems.map((item) => ({
      ...item,
      id: generarUUID('bib'),
      materia_id: selectedMateriaId,
      materia: currentMateria ? currentMateria.nombre : 'General',
      created_at: new Date().toISOString()
    }));

    const updated = [...newItems, ...biblio];
    setBiblio(updated);
    safeSetLocalStorage('psi_biblio_cache', updated);
    setModalBiblioBatch(false);
    showToast(`${newItems.length} textos importados con éxito`, 'check-circle-2');

    if (supabaseClient && isOnline) {
      try { await supabaseClient.from('bibliografia').insert(newItems); }
      catch (e) { newItems.forEach(it => enqueueAction('INSERT', 'bibliografia', it)); }
    } else {
      newItems.forEach(it => enqueueAction('INSERT', 'bibliografia', it));
    }
  };

  const handleToggleBiblioEstado = async (id) => {
    const item = biblio.find(b => b.id === id);
    if (!item) return;
    const estados = ['Pendiente', 'Resumiendo', 'Leído', 'Salteado', 'No va'];
    const nextIdx = (estados.indexOf(item.estado) + 1) % estados.length;
    const nextEstado = estados[nextIdx];

    const updated = biblio.map(b => b.id === id ? { ...b, estado: nextEstado } : b);
    setBiblio(updated);
    safeSetLocalStorage('psi_biblio_cache', updated);

    if (supabaseClient && isOnline) {
      try { await supabaseClient.from('bibliografia').update({ estado: nextEstado }).eq('id', id); }
      catch (e) { enqueueAction('UPDATE', 'bibliografia', { id, estado: nextEstado }); }
    } else {
      enqueueAction('UPDATE', 'bibliografia', { id, estado: nextEstado });
    }
  };

  const handleDeleteBiblio = async (id) => {
    if (!confirm('¿Eliminar este texto?')) return;
    addDeletedRecord('bibliografia', id);
    const updated = biblio.filter(b => b.id !== id);
    setBiblio(updated);
    safeSetLocalStorage('psi_biblio_cache', updated);
    if (psiDB) {
      try { await psiDB.bibliografia.delete(id); } catch (e) {}
    }
    showToast('Texto eliminado', 'trash-2');

    if (supabaseClient && isOnline) {
      try { await supabaseClient.from('bibliografia').delete().eq('id', id); }
      catch (e) { enqueueAction('DELETE', 'bibliografia', { id }); }
    } else {
      enqueueAction('DELETE', 'bibliografia', { id });
    }
  };

  const handleSaveClase = async (formData) => {
    const isEdit = Boolean(formData.id);
    const payload = {
      ...formData,
      id: formData.id || generarUUID('cla'),
      materia_id: selectedMateriaId,
      materia: currentMateria ? currentMateria.nombre : 'General',
      fecha_carga: formData.fecha_carga || new Date().toISOString()
    };

    const updated = isEdit ? clases.map(c => c.id === payload.id ? payload : c) : [payload, ...clases];
    setClases(updated);
    safeSetLocalStorage('psi_clases_cache', updated);
    saveToIndexedDB('clases', updated);
    setModalClase({ open: false, data: null });
    showToast(isEdit ? 'Clase actualizada con éxito' : 'Protocolo de clase guardado', 'check-circle-2');

    if (supabaseClient && isOnline) {
      try {
        if (isEdit) await supabaseClient.from('clases').update(payload).eq('id', payload.id);
        else await supabaseClient.from('clases').insert([payload]);
      } catch (e) {
        enqueueAction(isEdit ? 'UPDATE' : 'INSERT', 'clases', payload);
      }
    } else {
      enqueueAction(isEdit ? 'UPDATE' : 'INSERT', 'clases', payload);
    }
  };

  const handleDeleteClase = async (id) => {
    if (!confirm('¿Eliminar esta clase?')) return;
    addDeletedRecord('clases', id);
    const updated = clases.filter(c => c.id !== id);
    setClases(updated);
    safeSetLocalStorage('psi_clases_cache', updated);
    if (psiDB) {
      try { await psiDB.clases.delete(id); } catch (e) {}
    }
    showToast('Clase eliminada', 'trash-2');

    if (supabaseClient && isOnline) {
      try { await supabaseClient.from('clases').delete().eq('id', id); }
      catch (e) { enqueueAction('DELETE', 'clases', { id }); }
    } else {
      enqueueAction('DELETE', 'clases', { id });
    }
  };

  const handleOpenClassInRecorder = (claseObj, audioObj = null) => {
    setRecorderPresetData({
      materiaId: claseObj?.materia_id || selectedMateriaId || (materias[0]?.id || ''),
      claseNum: claseObj?.nro_clase || 1,
      tema: claseObj?.titulo_clase || claseObj?.aclaraciones || '',
      audioUrl: audioObj?.url || (claseObj?.link_grabacion || null),
      autoStart: !audioObj && !claseObj?.link_grabacion
    });
    setModalClase({ open: false, data: null });
    setActiveTab('grabadora');
    triggerHaptic('medium');
    showToast('Clase cargada en Grabadora & Desgrabador', 'mic');
  };

  const handleLinkTranscriptToClass = ({ materia_id, nro_clase, titulo_clase, audioUrl, transcript }) => {
    const existingIndex = clases.findIndex(c => c.materia_id === materia_id && parseInt(c.nro_clase, 10) === parseInt(nro_clase, 10));
    const transcriptSummary = transcript?.segments
      ? transcript.segments.map(s => `[${s.timestamp}] ${s.text}`).join('\n')
      : transcript?.paragraphs?.join('\n\n') || '';

    if (existingIndex >= 0) {
      const existing = clases[existingIndex];
      const updatedClase = {
        ...existing,
        titulo_clase: existing.titulo_clase || titulo_clase || `Clase #${nro_clase}`,
        desgrabacion_md: transcriptSummary,
        link_grabacion: existing.link_grabacion || audioUrl || '',
        grabaciones: audioUrl ? [...(existing.grabaciones || []).filter(g => g.url !== audioUrl), { id: Date.now(), url: audioUrl, title: `Desgrabación Verbatim (C#${nro_clase})` }] : (existing.grabaciones || [])
      };
      const updatedList = clases.map((c, idx) => idx === existingIndex ? updatedClase : c);
      setClases(updatedList);
      safeSetLocalStorage('psi_clases_cache', updatedList);
      saveToIndexedDB('clases', updatedList);
      showToast('Ficha de clase actualizada con desgrabación vinculada', 'check-circle');
    } else {
      const newClase = {
        id: 'cla_' + Date.now(),
        materia_id: materia_id || selectedMateriaId,
        materia: (materias.find(m => m.id === materia_id)?.nombre) || 'General',
        nro_clase: parseInt(nro_clase, 10) || 1,
        tipo: 'Teórica',
        titulo_clase: titulo_clase || `Clase #${nro_clase}`,
        desgrabacion_md: transcriptSummary,
        link_grabacion: audioUrl || '',
        grabaciones: audioUrl ? [{ id: Date.now(), url: audioUrl, title: `Desgrabación Verbatim (C#${nro_clase})` }] : [],
        fecha_carga: new Date().toISOString()
      };
      const updatedList = [newClase, ...clases];
      setClases(updatedList);
      safeSetLocalStorage('psi_clases_cache', updatedList);
      saveToIndexedDB('clases', updatedList);
      showToast('Nueva clase creada con desgrabación vinculada', 'check-circle');
    }
  };

  const handleSaveApunte = async (formData) => {
    const isEdit = Boolean(formData.id);
    const targetMatId = formData.materia_id || selectedMateriaId || (materias[0]?.id || null);
    const targetMatObj = materias.find(m => m.id === targetMatId);
    const targetMatName = targetMatObj ? targetMatObj.nombre : (currentMateria ? currentMateria.nombre : 'General');

    const payload = {
      ...formData,
      id: formData.id || generarUUID('apu'),
      materia_id: targetMatId,
      materia: targetMatName,
      created_at: formData.created_at || new Date().toISOString()
    };

    const updated = isEdit ? apuntes.map(a => a.id === payload.id ? payload : a) : [payload, ...apuntes];
    setApuntes(updated);
    safeSetLocalStorage('psi_apuntes_cache', updated);
    saveToIndexedDB('apuntes', updated);
    setModalApunte({ open: false, data: null });
    setModalUploadApuntePDF({ open: false, materiaId: null });
    showToast('Apunte guardado con éxito', 'file-edit');

    // Si vino de una subida de PDF o se solicitó guardar en sistema, registrar en documentos_pdf
    if (formData.pdfName || formData.saveToPdfDocs || formData.pdfData) {
      const pdfPayload = {
        id: generarUUID('pdf'),
        nombre_archivo: formData.pdfName || `${formData.titulo || 'Apunte'}.pdf`,
        titulo: formData.titulo || 'Apunte Académico',
        materia_id: targetMatId,
        materia: targetMatName,
        unidad: formData.unidad || 'Unidad 1',
        tipo: formData.tipo || 'Resumen',
        num_paginas: parseInt(formData.numPages, 10) || 1,
        va_parcial: Boolean(formData.va_parcial),
        nro_parcial: formData.nro_parcial || null,
        pdfData: formData.pdfData || null,
        texto_extraido: (formData.contenido || '').slice(0, 5000),
        created_at: new Date().toISOString()
      };
      const updatedPdfs = [pdfPayload, ...pdfs.filter(p => p.id !== pdfPayload.id)];
      setPdfs(updatedPdfs);
      safeSetLocalStorage('psi_pdfs_cache', updatedPdfs);
      saveToIndexedDB('documentos_pdf', updatedPdfs);
      if (supabaseClient && isOnline) {
        try {
          const { pdfData, ...cleanPdf } = pdfPayload;
          await supabaseClient.from('documentos_pdf').insert([cleanPdf]);
        } catch(e) {
          console.warn('Error al insertar en documentos_pdf:', e);
        }
      }
    }

    if (supabaseClient && isOnline) {
      try {
        const { pdfName, numPages, saveToPdfDocs, pdfData, ...cleanPayload } = payload;
        // Postgres nro_parcial is INT: ensure integer conversion or default 1
        if (cleanPayload.nro_parcial) {
          const matchedNum = String(cleanPayload.nro_parcial).match(/\d+/);
          cleanPayload.nro_parcial = matchedNum ? parseInt(matchedNum[0], 10) : 1;
        } else {
          cleanPayload.nro_parcial = 1;
        }
        if (isEdit) await supabaseClient.from('apuntes').update(cleanPayload).eq('id', payload.id);
        else await supabaseClient.from('apuntes').insert([cleanPayload]);
      } catch (e) {
        console.warn('Error sincronizando apunte en Supabase:', e);
        enqueueAction(isEdit ? 'UPDATE' : 'INSERT', 'apuntes', cleanPayload);
      }
    } else {
      const { pdfName, numPages, saveToPdfDocs, pdfData, ...cleanOfflinePayload } = payload;
      if (cleanOfflinePayload.nro_parcial) {
        const matchedNum = String(cleanOfflinePayload.nro_parcial).match(/\d+/);
        cleanOfflinePayload.nro_parcial = matchedNum ? parseInt(matchedNum[0], 10) : 1;
      } else {
        cleanOfflinePayload.nro_parcial = 1;
      }
      enqueueAction(isEdit ? 'UPDATE' : 'INSERT', 'apuntes', cleanOfflinePayload);
    }
  };

  const handleDeleteApunte = async (id) => {
    if (!confirm('¿Eliminar este apunte?')) return;
    addDeletedRecord('apuntes', id);
    addDeletedRecord('documentos_pdf', id);

    const updated = apuntes.filter(a => a.id !== id);
    setApuntes(updated);
    safeSetLocalStorage('psi_apuntes_cache', updated);
    if (psiDB) {
      try { await psiDB.apuntes.delete(id); } catch (e) {}
    }

    // Si también está en pdfs, eliminarlo
    if (pdfs.some(p => p.id === id)) {
      const updatedP = pdfs.filter(p => p.id !== id);
      setPdfs(updatedP);
      safeSetLocalStorage('psi_pdfs_cache', updatedP);
      if (psiDB) {
        try { await psiDB.documentos_pdf.delete(id); } catch (e) {}
      }
    }

    showToast('Apunte eliminado', 'trash-2');

    if (supabaseClient && isOnline) {
      try {
        await supabaseClient.from('apuntes').delete().eq('id', id);
        await supabaseClient.from('documentos_pdf').delete().eq('id', id);
      } catch (e) {
        enqueueAction('DELETE', 'apuntes', { id });
        enqueueAction('DELETE', 'documentos_pdf', { id });
      }
    } else {
      enqueueAction('DELETE', 'apuntes', { id });
      enqueueAction('DELETE', 'documentos_pdf', { id });
    }
  };

  const handleSaveDocumentoPDF = async (docPayload) => {
    // 1. Guardar en documentos_pdf
    const updated = [docPayload, ...pdfs.filter(p => p.id !== docPayload.id)];
    setPdfs(updated);
    safeSetLocalStorage('psi_pdfs_cache', updated);
    saveToIndexedDB('documentos_pdf', updated);

    // 2. También registrar/actualizar en apuntes para que aparezca en el listado de apuntes
    const apunteRecord = {
      id: docPayload.id,
      materia_id: docPayload.materia_id,
      materia: docPayload.materia,
      unidad: docPayload.unidad || 'Unidad 1',
      titulo: docPayload.titulo || docPayload.nombre_archivo,
      tipo: docPayload.tipo || 'Resumen',
      va_parcial: Boolean(docPayload.va_parcial),
      nro_parcial: docPayload.nro_parcial || null,
      pdfName: docPayload.nombre_archivo,
      numPages: docPayload.num_paginas || 1,
      pdfData: docPayload.pdfData,
      contenido: `[Documento PDF Original: ${docPayload.nombre_archivo || docPayload.titulo}]`,
      created_at: docPayload.created_at || new Date().toISOString()
    };
    const updatedApuntes = [apunteRecord, ...apuntes.filter(a => a.id !== apunteRecord.id)];
    setApuntes(updatedApuntes);
    safeSetLocalStorage('psi_apuntes_cache', updatedApuntes);
    saveToIndexedDB('apuntes', updatedApuntes);

    showToast('Documento y Apunte guardados con éxito', 'check-circle');

    if (supabaseClient && isOnline) {
      try {
        const { pdfData, ...cleanPayload } = docPayload;
        await supabaseClient.from('documentos_pdf').upsert([cleanPayload]);
      } catch (e) {
        console.warn('Error sincronizando documento_pdf en Supabase:', e);
      }
      try {
        const { pdfData, ...cleanApunte } = apunteRecord;
        if (cleanApunte.nro_parcial) {
          const matchedNum = String(cleanApunte.nro_parcial).match(/\d+/);
          cleanApunte.nro_parcial = matchedNum ? parseInt(matchedNum[0], 10) : 1;
        } else {
          cleanApunte.nro_parcial = 1;
        }
        await supabaseClient.from('apuntes').upsert([cleanApunte]);
      } catch (e2) {
        console.warn('Error sincronizando apunte derivado en Supabase:', e2);
      }
    }
  };

  const handleDeleteDocumentoPDF = async (id) => {
    const doc = pdfs.find(p => p.id === id);
    if (!confirm(`¿Eliminar "${doc?.nombre_archivo || doc?.titulo || 'este documento'}" del sistema?`)) return;
    addDeletedRecord('documentos_pdf', id);
    addDeletedRecord('apuntes', id);

    const updated = pdfs.filter(p => p.id !== id);
    setPdfs(updated);
    safeSetLocalStorage('psi_pdfs_cache', updated);
    if (psiDB) {
      try { await psiDB.documentos_pdf.delete(id); } catch (e) {}
    }

    if (apuntes.some(a => a.id === id)) {
      const updatedA = apuntes.filter(a => a.id !== id);
      setApuntes(updatedA);
      safeSetLocalStorage('psi_apuntes_cache', updatedA);
      if (psiDB) {
        try { await psiDB.apuntes.delete(id); } catch (e) {}
      }
    }

    showToast('Documento PDF eliminado', 'trash-2');

    if (supabaseClient && isOnline) {
      try { await supabaseClient.from('documentos_pdf').delete().eq('id', id); }
      catch (e) { enqueueAction('DELETE', 'documentos_pdf', { id }); }
    } else {
      enqueueAction('DELETE', 'documentos_pdf', { id });
    }
  };

  const handleSaveExamen = async (formData) => {
    const isEdit = Boolean(formData.id);
    const linkedTexts = formData.textos_vinculados || formData.textos_ids || [];
    const payload = {
      ...formData,
      id: formData.id || (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'ex_' + Date.now()),
      materia_id: selectedMateriaId,
      materia: currentMateria ? currentMateria.nombre : 'General',
      textos_vinculados: linkedTexts,
      textos_ids: linkedTexts,
      unidades_incluidas: formData.unidades_incluidas || [],
      finalizado: formData.finalizado || false,
      created_at: formData.created_at || new Date().toISOString()
    };

    const updated = isEdit ? examenes.map(e => e.id === payload.id ? payload : e) : [payload, ...examenes];
    setExamenes(updated);
    safeSetLocalStorage('psi_examenes_cache', updated);
    setModalExamen({ open: false, data: null });
    showToast('Examen registrado correctamente', 'calendar-check');

    if (supabaseClient && isOnline) {
      try {
        if (isEdit) await supabaseClient.from('examenes').update(payload).eq('id', payload.id);
        else await supabaseClient.from('examenes').insert([payload]);
      } catch (e) {
        enqueueAction(isEdit ? 'UPDATE' : 'INSERT', 'examenes', payload);
      }
    } else {
      enqueueAction(isEdit ? 'UPDATE' : 'INSERT', 'examenes', payload);
    }
  };

  const handleDeleteExamen = async (id) => {
    if (!confirm('¿Eliminar este examen?')) return;
    addDeletedRecord('examenes', id);
    const updated = examenes.filter(e => e.id !== id);
    setExamenes(updated);
    safeSetLocalStorage('psi_examenes_cache', updated);
    if (psiDB) {
      try { await psiDB.examenes.delete(id); } catch (e) {}
    }
    showToast('Examen eliminado', 'trash-2');

    if (supabaseClient && isOnline) {
      try { await supabaseClient.from('examenes').delete().eq('id', id); }
      catch (e) { enqueueAction('DELETE', 'examenes', { id }); }
    } else {
      enqueueAction('DELETE', 'examenes', { id });
    }
  };

  // PDF Ingestion
  const handlePDFUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      showToast('Selecciona un archivo PDF válido', 'alert-circle');
      return;
    }

    showToast('Extrayendo texto del PDF...', 'loader');
    const reader = new FileReader();
    reader.onload = async function() {
      try {
        const typedArray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        let fullText = '';
        const maxPages = Math.min(pdf.numPages, 5);
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map(item => item.str).join(' ') + '\n\n';
        }

        const matchedMat = materias.find(m => file.name.toLowerCase().includes(m.nombre.toLowerCase()) || file.name.toLowerCase().includes((m.abreviatura || '').toLowerCase()));

        setIngestionData({
          fileName: file.name,
          numPages: pdf.numPages,
          titulo: file.name.replace(/\.pdf$/i, '').replace(/_/g, ' '),
          materiaId: matchedMat ? matchedMat.id : (materias[0]?.id || ''),
          unidad: 'Unidad 1',
          autores: '',
          caracter: 'Obligatorio',
          vaParcial: false,
          extractedText: fullText.slice(0, 1200)
        });
        showToast('PDF analizado correctamente', 'check-circle');
      } catch (err) {
        showToast('Error procesando PDF', 'alert-triangle');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmIngestion = async (e) => {
    e.preventDefault();
    if (!ingestionData) return;

    const targetMat = materias.find(m => m.id === ingestionData.materiaId);
    const matName = targetMat ? targetMat.nombre : 'General';

    const newDoc = {
      id: 'pdf_' + Date.now(),
      nombre_archivo: ingestionData.fileName,
      materia_id: ingestionData.materiaId || null,
      materia: matName,
      unidad: ingestionData.unidad,
      num_paginas: ingestionData.numPages,
      va_parcial: ingestionData.vaParcial,
      texto_extraido: ingestionData.extractedText,
      created_at: new Date().toISOString()
    };

    const newBib = {
      id: 'bib_' + Date.now(),
      materia_id: ingestionData.materiaId || null,
      materia: matName,
      unidad: ingestionData.unidad,
      titulo_texto: ingestionData.titulo,
      autores: ingestionData.autores || 'Autor PDF',
      caracter: ingestionData.caracter || 'Obligatorio',
      estado: 'Pendiente',
      va_parcial: ingestionData.vaParcial,
      notas: `Ingestado desde ${newDoc.nombre_archivo}`,
      created_at: new Date().toISOString()
    };

    const updatedPdfs = [newDoc, ...pdfs];
    const updatedBib = [newBib, ...biblio];

    setPdfs(updatedPdfs);
    setBiblio(updatedBib);
    safeSetLocalStorage('psi_pdfs_cache', updatedPdfs);
    safeSetLocalStorage('psi_biblio_cache', updatedBib);
    setIngestionData(null);
    showToast('PDF y Bibliografía guardados con éxito', 'check-circle');

    if (supabaseClient && isOnline) {
      try {
        await Promise.all([
          supabaseClient.from('documentos_pdf').insert([newDoc]),
          supabaseClient.from('bibliografia').insert([newBib])
        ]);
      } catch (err) {
        enqueueAction('INSERT', 'documentos_pdf', newDoc);
        enqueueAction('INSERT', 'bibliografia', newBib);
      }
    } else {
      enqueueAction('INSERT', 'documentos_pdf', newDoc);
      enqueueAction('INSERT', 'bibliografia', newBib);
    }
  };

  const exportBackupJSON = () => {
    const data = { materias, biblio, clases, apuntes, pdfs, examenes, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PsiEstudio_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('Copia de seguridad exportada', 'download');
  };

  const handleImportBackupJSON = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('El archivo no contiene un JSON válido.');
        }

        let newMats = materias;
        let newBib = biblio;
        let newCla = clases;
        let newApu = apuntes;
        let newPdf = pdfs;
        let newEx = examenes;

        if (Array.isArray(parsed.materias) && parsed.materias.length > 0) {
          newMats = [...parsed.materias];
          materias.forEach(m => { if (!newMats.find(x => x.id === m.id)) newMats.push(m); });
          setMaterias(newMats);
          safeSetLocalStorage('psi_materias_cache', newMats);
          saveToIndexedDB('materias', newMats);
        }

        if (Array.isArray(parsed.biblio) && parsed.biblio.length > 0) {
          newBib = [...parsed.biblio];
          biblio.forEach(b => { if (!newBib.find(x => x.id === b.id)) newBib.push(b); });
          setBiblio(newBib);
          safeSetLocalStorage('psi_biblio_cache', newBib);
          saveToIndexedDB('bibliografia', newBib);
        }

        if (Array.isArray(parsed.clases) && parsed.clases.length > 0) {
          newCla = [...parsed.clases];
          clases.forEach(c => { if (!newCla.find(x => x.id === c.id)) newCla.push(c); });
          setClases(newCla);
          safeSetLocalStorage('psi_clases_cache', newCla);
          saveToIndexedDB('clases', newCla);
        }

        if (Array.isArray(parsed.apuntes) && parsed.apuntes.length > 0) {
          newApu = [...parsed.apuntes];
          apuntes.forEach(a => { if (!newApu.find(x => x.id === a.id)) newApu.push(a); });
          setApuntes(newApu);
          safeSetLocalStorage('psi_apuntes_cache', newApu);
          saveToIndexedDB('apuntes', newApu);
        }

        if (Array.isArray(parsed.pdfs) && parsed.pdfs.length > 0) {
          newPdf = [...parsed.pdfs];
          pdfs.forEach(p => { if (!newPdf.find(x => x.id === p.id)) newPdf.push(p); });
          setPdfs(newPdf);
          safeSetLocalStorage('psi_pdfs_cache', newPdf);
          saveToIndexedDB('documentos_pdf', newPdf);
        }

        if (Array.isArray(parsed.examenes) && parsed.examenes.length > 0) {
          newEx = [...parsed.examenes];
          examenes.forEach(ex => { if (!newEx.find(x => x.id === ex.id)) newEx.push(ex); });
          setExamenes(newEx);
          safeSetLocalStorage('psi_examenes_cache', newEx);
          saveToIndexedDB('examenes', newEx);
        }

        showToast('Backup importado y fusionado correctamente', 'check-circle-2');
        triggerHaptic('success');
      } catch (err) {
        console.error('Error al importar backup:', err);
        showToast('Error al procesar JSON: ' + err.message, 'alert-triangle');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── MOTOR DE CARGA Y MIGRACIÓN TOTAL A LA NUBE (LOCAL TO CLOUD) ──
  const syncAllLocalDataToCloud = async (silent = false) => {
    if (!supabaseClient) {
      if (!silent) showToast('Supabase no está inicializado en este cliente', 'alert-triangle');
      return;
    }
    if (!navigator.onLine) {
      if (!silent) showToast('Sin conexión a Internet para sincronizar', 'wifi-off');
      return;
    }

    setIsSyncingAll(true);
    if (!silent) {
      triggerHaptic('medium');
      showToast('Sincronizando y subiendo datos locales a Supabase...', 'cloud-upload');
    }

    const results = {
      materias: 0,
      bibliografia: 0,
      clases: 0,
      apuntes: 0,
      documentos_pdf: 0,
      examenes: 0,
      deletions: 0,
      errors: []
    };

    try {
      // 0. Sincronizar bajas remotas (Tombstones) en Supabase para evitar resurrección permanente
      const deletedRecords = getDeletedRecords();
      if (deletedRecords.length > 0) {
        for (const rec of deletedRecords) {
          try {
            if (rec.table && rec.id) {
              await supabaseClient.from(rec.table).delete().eq('id', rec.id);
              // Si es materia, limpiar en cascada en Supabase
              if (rec.table === 'materias') {
                await Promise.allSettled([
                  supabaseClient.from('bibliografia').delete().eq('materia_id', rec.id),
                  supabaseClient.from('clases').delete().eq('materia_id', rec.id),
                  supabaseClient.from('apuntes').delete().eq('materia_id', rec.id),
                  supabaseClient.from('documentos_pdf').delete().eq('materia_id', rec.id),
                  supabaseClient.from('examenes').delete().eq('materia_id', rec.id)
                ]);
              }
              results.deletions++;
            }
          } catch (delErr) {
            console.warn(`Error eliminando registro remoto tombstoned (${rec.table} - ${rec.id}):`, delErr);
          }
        }
      }

      // 1. Materias (Solo materias activas no eliminadas)
      const matsList = materias.filter(m => !isRecordDeleted('materias', m.id));
      if (matsList.length > 0) {
        const cleanMats = matsList.map(sanitizeForCloud.materias);
        const { error } = await supabaseClient.from('materias').upsert(cleanMats, { onConflict: 'id' });
        if (error) results.errors.push(`Materias: ${error.message}`);
        else results.materias = cleanMats.length;
      }

      // 2. Bibliografía
      const bibList = biblio.filter(b => !isRecordDeleted('bibliografia', b.id));
      if (bibList.length > 0) {
        const cleanBib = bibList.map(sanitizeForCloud.bibliografia);
        const { error } = await supabaseClient.from('bibliografia').upsert(cleanBib, { onConflict: 'id' });
        if (error) results.errors.push(`Bibliografía: ${error.message}`);
        else results.bibliografia = cleanBib.length;
      }

      // 3. Clases
      const claList = clases.filter(c => !isRecordDeleted('clases', c.id));
      if (claList.length > 0) {
        const cleanCla = claList.map(sanitizeForCloud.clases);
        const { error } = await supabaseClient.from('clases').upsert(cleanCla, { onConflict: 'id' });
        if (error) results.errors.push(`Clases: ${error.message}`);
        else results.clases = cleanCla.length;
      }

      // 4. Apuntes (Garantiza notas y resúmenes completos)
      const apuList = apuntes.filter(a => !isRecordDeleted('apuntes', a.id));
      if (apuList.length > 0) {
        const cleanApu = apuList.map(sanitizeForCloud.apuntes);
        const { error } = await supabaseClient.from('apuntes').upsert(cleanApu, { onConflict: 'id' });
        if (error) results.errors.push(`Apuntes: ${error.message}`);
        else results.apuntes = cleanApu.length;
      }

      // 5. Documentos PDF
      const pdfList = pdfs.filter(p => !isRecordDeleted('documentos_pdf', p.id));
      if (pdfList.length > 0) {
        const cleanPdf = pdfList.map(sanitizeForCloud.documentos_pdf);
        const { error } = await supabaseClient.from('documentos_pdf').upsert(cleanPdf, { onConflict: 'id' });
        if (error) results.errors.push(`Documentos PDF: ${error.message}`);
        else results.documentos_pdf = cleanPdf.length;
      }

      // 6. Exámenes
      const exList = examenes.filter(e => !isRecordDeleted('examenes', e.id));
      if (exList.length > 0) {
        const cleanEx = exList.map(sanitizeForCloud.examenes);
        const { error } = await supabaseClient.from('examenes').upsert(cleanEx, { onConflict: 'id' });
        if (error) results.errors.push(`Exámenes: ${error.message}`);
        else results.examenes = cleanEx.length;
      }

      if (results.errors.length === 0) {
        setSyncQueue([]);
        safeSetLocalStorage('psi_sync_queue', []);
        if (psiDB && psiDB.syncQueue) {
          try { await psiDB.syncQueue.clear(); } catch (e) {}
        }
      }

      const totalItems = results.materias + results.bibliografia + results.clases + results.apuntes + results.documentos_pdf + results.examenes;
      const summaryMsg = results.errors.length > 0
        ? `Sincronizados ${totalItems} registros con advertencias (${results.errors.length})`
        : `¡${totalItems} registros respaldados con éxito en Supabase!`;

      setSyncStatusSummary(results);
      if (!silent) {
        showToast(summaryMsg, results.errors.length > 0 ? 'alert-circle' : 'check-circle-2');
        triggerHaptic('success');
      } else {
        console.log(`[Auto-Sync Silencioso] ${summaryMsg}`);
      }
    } catch (err) {
      console.error('Error durante sincronización total:', err);
      if (!silent) showToast(`Error al subir a la nube: ${err.message}`, 'alert-triangle');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const clearCache = () => {
    if (!confirm('¿Limpiar caché local? (Los datos en Supabase no se borrarán)')) return;
    localStorage.clear();
    setMaterias([]);
    setBiblio([]);
    setClases([]);
    setApuntes([]);
    setPdfs([]);
    setExamenes([]);
    showToast('Caché limpiada', 'trash-2');
    fetchAllData();
  };

  const triggerPing = async () => {
    showToast('Enviando ping Keep-Alive...', 'activity');
    if (supabaseClient) {
      try {
        await supabaseClient.from('supabase_keep_alive').upsert([{ id: 1, ping_source: 'PsiEstudio-Client', status: 'ACTIVE', ping_timestamp: new Date().toISOString() }]);
        showToast('Ping registrado en Supabase', 'check-circle');
      } catch (e) {
        showToast('Ping registrado localmente', 'check-circle');
      }
    }
  };

  return (
    <div className="min-h-screen bg-app-base text-app-text transition-colors duration-300">
      {/* ══ HEADER (FULL RESPONSIVE NAVIGATION) ══ */}
      <header className="sticky top-0 z-40 bg-app-base/95 backdrop-blur-xl border-b border-app-border px-3 sm:px-6 py-2.5 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
          
          {/* Top Bar: Brand, Search & Tools */}
          <div className="flex items-center justify-between gap-2">
            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => { setActiveTab('materias'); setSelectedMateriaId(null); }}
            >
              <img
                src="logo.png"
                alt="PsiEstudio"
                className="w-9 h-9 rounded-xl object-cover shadow-emerald border border-app-border/40 hover:scale-105 transition-transform"
              />
              <div>
                <h1 className="text-lg font-black tracking-tight leading-none text-app-text">
                  PsiEstudio
                </h1>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-app-emerald">
                  Academic Suite
                </span>
              </div>
            </div>

            {/* Header Action Tools */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setModalSearch(true)}
                className="px-2.5 py-1.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold text-app-text hover:border-app-emerald transition-all shadow-card flex items-center gap-1.5"
                title="Buscar en todas las materias y textos"
              >
                <Icon name="search" className="w-3.5 h-3.5 text-app-emerald" />
                <span className="hidden sm:inline text-[11px]">Buscar</span>
              </button>

              <button
                onClick={() => setModalPomodoro(true)}
                className="w-8 h-8 rounded-xl bg-app-card border border-app-border flex items-center justify-center text-app-text hover:border-app-amber transition-all shadow-card"
                title="Temporizador Pomodoro"
              >
                <Icon name="timer" className="w-3.5 h-3.5 text-app-amber" />
              </button>

              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="w-8 h-8 rounded-xl bg-app-card border border-app-border flex items-center justify-center text-app-text hover:border-app-emerald transition-all shadow-card"
                title="Modo Crema / Oscuro"
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="w-3.5 h-3.5 text-app-text" />
              </button>

              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-extrabold bg-app-card border border-app-border shadow-card ${isOnline ? 'text-app-emerald' : 'text-app-ruby'}`}>
                <span className={`w-1.5 h-1.5 rounded-md ${isOnline ? 'bg-app-emerald shadow-[0_0_6px_var(--color-emerald-main)]' : 'bg-app-ruby'}`}></span>
                <span className="hidden sm:inline">{isOnline ? 'Cloud' : 'Offline'}</span>
              </div>
            </div>
          </div>

          {/* Navigation Pill Tabs (Always visible on all screen sizes with horizontal swipe) */}
          <div className="overflow-x-auto no-scrollbar hidden md:flex items-center gap-1.5 p-1 bg-app-surface border border-app-border rounded-lg">
            {[
              { id: 'materias', label: 'Aulas', icon: 'layers', badge: materias.length },
              { id: 'biblio', label: 'Biblioteca', icon: 'book-open', badge: biblio.length },
              { id: 'clases', label: 'Clases', icon: 'presentation', badge: clases.length },
              { id: 'apuntes', label: 'Apuntes', icon: 'file-text', badge: apuntes.length },
              { id: 'examenes', label: 'Exámenes', icon: 'calendar-check', badge: examenes.length },
              { id: 'grabadora', label: 'Grabadora & DSP', icon: 'mic', badge: null },
              { id: 'pdf', label: 'PDF OCR', icon: 'file-up', badge: pdfs.length },
              { id: 'perfil', label: 'Mi Perfil', icon: 'user', badge: null },
              { id: 'system', label: 'Sistema', icon: 'cpu', badge: null },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                    isActive
                      ? 'bg-app-card text-app-emerald shadow-card border border-app-border ring-1 ring-app-emerald/30'
                      : 'text-app-muted hover:text-app-text hover:bg-app-card/40'
                  }`}
                >
                  <Icon name={tab.icon} className={`w-3.5 h-3.5 ${isActive ? 'text-app-emerald' : 'text-app-muted'}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== null && tab.badge > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-black ${
                      isActive ? 'bg-app-emerald text-white' : 'bg-app-card border border-app-border text-app-muted'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

        </div>
      </header>

      {/* ══ MOBILE BOTTOM NAVIGATION DOCK (100% NATIVE MOBILE VIEW) ══ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-app-card/95 backdrop-blur-xl border-t border-app-border px-2 pt-1.5 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))] flex justify-around items-center shadow-fluffy">
        {[
          { id: 'materias', label: 'Aulas', icon: 'layers' },
          { id: 'biblio', label: 'Lecturas', icon: 'book-open' },
          { id: 'apuntes', label: 'Apuntes', icon: 'file-text' },
          { id: 'clases', label: 'Clases', icon: 'presentation' },
          { id: 'examenes', label: 'Exámenes', icon: 'calendar-check' },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); }}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all flex-1 ${
                isActive ? 'text-app-emerald font-extrabold scale-105' : 'text-app-muted hover:text-app-text font-medium'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-app-emerald-bg border border-app-emerald/30' : ''}`}>
                <Icon name={tab.icon} className={`w-4 h-4 ${isActive ? 'text-app-emerald' : 'text-app-muted'}`} />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5">{tab.label}</span>
            </button>
          );
        })}
        
        {/* Más Menu Button */}
        <button
          onClick={() => setModalMoreMenu(true)}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all flex-1 ${
            activeTab === 'pdf' || activeTab === 'perfil' || activeTab === 'system' ? 'text-app-emerald font-extrabold' : 'text-app-muted hover:text-app-text'
          }`}
        >
          <div className="p-1.5 rounded-xl">
            <Icon name="more-horizontal" className="w-4 h-4 text-app-muted" />
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Más</span>
        </button>
      </nav>

      {/* ══ MAIN VIEW CONTAINER ══ */}
      <main className="max-w-7xl mx-auto p-3.5 md:p-5 pb-32 md:pb-8">

        {/* ── TAB: MATERIAS (AULAS Y CARPETAS) ── */}
        {activeTab === 'materias' && !selectedMateriaId && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2.5 text-app-text">
                  <Icon name="layers" className="w-6 h-6 text-app-emerald" size={24} /> Aulas & Materias en Cursado
                </h2>
                <p className="text-xs text-app-muted mt-0.5">Ingresa al aula de cada materia para ver bibliografía, exámenes y protocolos.</p>
              </div>
            </div>

            {/* Banner Próximo Examen */}
            {nextExam && (
              <div
                onClick={() => {
                  const m = materias.find(x => x.nombre.toLowerCase() === nextExam.materia.toLowerCase());
                  if (m) setSelectedMateriaId(m.id);
                }}
                className="bg-gradient-to-r from-app-surface to-app-card border border-app-border hover:border-app-emerald p-4 sm:p-5 rounded-lg shadow-fluffy flex items-center gap-3.5 cursor-pointer transition-all hover:-translate-y-0.5"
              >
                <div className="w-12 sm:w-14 text-center">
                  <div className="text-2xl sm:text-3xl font-black text-app-emerald leading-none">
                    {Math.ceil((new Date(nextExam.fecha + 'T00:00:00') - new Date().setHours(0,0,0,0)) / 864e5) || '0'}
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-app-muted mt-1">Días</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-app-emerald flex items-center gap-1">
                    <Icon name="bell" className="w-3.5 h-3.5" /> Próximo Examen
                  </div>
                  <div className="text-base sm:text-lg font-extrabold text-app-text truncate">{nextExam.nombre}</div>
                  <div className="text-xs text-app-muted mt-0.5 truncate">{nextExam.materia} • {nextExam.fecha}</div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-md bg-app-amber-bg text-app-amber border border-app-amber/30">
                  Ver Aula <Icon name="chevron-right" className="w-3.5 h-3.5" />
                </span>
              </div>
            )}

            {/* Materias Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {materias.map(m => {
                const textsInMat = biblio.filter(b => b.materia_id === m.id || b.materia === m.nombre);
                const leidos = textsInMat.filter(b => b.estado === 'Leído' || b.estado === 'Salteado').length;
                const pct = textsInMat.length > 0 ? Math.round((leidos / textsInMat.length) * 100) : 0;
                const clasesCount = clases.filter(c => c.materia_id === m.id || c.materia === m.nombre).length;
                const apuntesCount = apuntes.filter(a => a.materia_id === m.id || a.materia === m.nombre).length;

                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedMateriaId(m.id)}
                    className="bg-app-card border border-app-border hover:border-app-emerald p-5 sm:p-4 rounded-xl shadow-card hover:shadow-fluffy transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-extrabold px-3 py-1 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/30 uppercase tracking-wider">
                          {m.abreviatura || 'MAT'}
                        </span>
                        <span className="text-xs font-semibold text-app-muted">
                          {m.cuatrimestre === 0 ? 'Anual' : `${m.cuatrimestre}° Cuatrimestre`}
                        </span>
                      </div>
                      <h3 className="text-xl font-extrabold text-app-text leading-tight mb-1">{m.nombre}</h3>
                      <p className="text-xs text-app-muted flex items-center gap-1 mb-4">
                        <Icon name="user" className="w-3.5 h-3.5" /> {m.docente || 'Docente no asignado'}
                      </p>

                      <div className="mb-4">
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="text-app-muted">Progreso Lecturas ({leidos}/{textsInMat.length})</span>
                          <span className="text-app-emerald">{pct}%</span>
                        </div>
                        <div className="w-full h-2 bg-app-surface rounded-full overflow-hidden border border-app-border">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-md transition-all duration-500" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-3 border-t border-app-border text-xs text-app-muted font-bold">
                      <span className="px-2.5 py-1 rounded-md bg-app-surface border border-app-border flex items-center gap-1">
                        <Icon name="book-open" className="w-3.5 h-3.5" /> {textsInMat.length} textos
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-app-surface border border-app-border flex items-center gap-1">
                        <Icon name="presentation" className="w-3.5 h-3.5" /> {clasesCount} clases
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-app-surface border border-app-border flex items-center gap-1">
                        <Icon name="file-edit" className="w-3.5 h-3.5" /> {apuntesCount} apuntes
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB: AULA / MATERIA DETALLE (CON SELECTOR RÁPIDO & SUB-BARRA STICKY) ── */}
        {activeTab === 'materias' && selectedMateriaId && currentMateria && (
          <div className="space-y-5 animate-fade-in">
            
            {/* Aula Header & Materia Switcher Card */}
            <div className="bg-app-card border border-app-border p-4 sm:p-4 rounded-xl shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedMateriaId(null)}
                    className="px-3.5 py-1.5 rounded-xl bg-app-surface border border-app-border hover:border-app-emerald text-xs font-bold text-app-text flex items-center gap-1.5 shadow-card transition-all"
                  >
                    <Icon name="arrow-left" className="w-3.5 h-3.5" /> Volver a Aulas
                  </button>
                  
                  {/* Selector rápido de materia */}
                  <select
                    value={selectedMateriaId}
                    onChange={e => setSelectedMateriaId(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-app-surface border border-app-border text-xs font-extrabold text-app-emerald outline-none"
                  >
                    {materias.map(m => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>

                <span className="text-xs font-extrabold px-3 py-1 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/30 uppercase tracking-wider">
                  {currentMateria.abreviatura || 'MAT'}
                </span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-app-text leading-tight">{currentMateria.nombre}</h2>
                <p className="text-xs text-app-muted mt-1 flex items-center gap-1.5">
                  <Icon name="user" className="w-3.5 h-3.5 text-app-emerald" /> {currentMateria.docente || 'Docente no asignado'} • {currentMateria.cuatrimestre === 0 ? 'Anual' : `${currentMateria.cuatrimestre}° Cuatrimestre`}
                </p>
              </div>

              {/* Acciones Rápidas */}
              <div className="pt-3 border-t border-app-border">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-app-emerald mb-2 flex items-center gap-1">
                  <Icon name="zap" className="w-3.5 h-3.5 text-app-emerald" /> Acciones Rápidas en esta Materia
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  <button onClick={() => setModalExamen({ open: true, data: null })} className="p-2.5 rounded-xl bg-app-emerald text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-emerald hover:brightness-110">
                    <Icon name="calendar-plus" className="w-3.5 h-3.5 text-white" /> Crear Examen
                  </button>
                  <button onClick={() => setModalBiblio({ open: true, data: null })} className="p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold flex items-center justify-center gap-1.5 hover:border-app-emerald text-app-text">
                    <Icon name="plus" className="w-3.5 h-3.5 text-app-emerald" /> Agregar Texto
                  </button>
                  <button onClick={() => setModalBiblioBatch(true)} className="p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold flex items-center justify-center gap-1.5 hover:border-app-emerald text-app-text">
                    <Icon name="file-spreadsheet" className="w-3.5 h-3.5 text-app-emerald" /> Carga Rápida
                  </button>
                  <button onClick={() => setModalFlashcards({ open: true, items: currentMateriaTexts, title: `Fichas: ${currentMateria ? currentMateria.nombre : ''}` })} className="p-2.5 rounded-xl bg-app-emerald-bg text-app-emerald border border-app-emerald/30 text-xs font-bold flex items-center justify-center gap-1.5 hover:brightness-110">
                    <Icon name="layers" className="w-3.5 h-3.5" /> Repasar Fichas
                  </button>
                  <button onClick={() => setModalClase({ open: true, data: null })} className="p-2.5 rounded-xl bg-app-navy-bg text-app-navy border border-app-navy/30 text-xs font-bold flex items-center justify-center gap-1.5 hover:brightness-110">
                    <Icon name="presentation" className="w-3.5 h-3.5" /> Protocolo Clase
                  </button>
                  <button onClick={() => setModalApunte({ open: true, data: null })} className="p-2.5 rounded-xl bg-app-amber-bg text-app-amber border border-app-amber/30 text-xs font-bold flex items-center justify-center gap-1.5 hover:brightness-110">
                    <Icon name="file-edit" className="w-3.5 h-3.5" /> Nuevo Apunte
                  </button>
                </div>
              </div>
            </div>

            {/* ══ SUB-BARRA STICKY DE SECCIONES DEL AULA ══ */}
            <div className="sticky top-[58px] z-30 bg-app-base/95 backdrop-blur-md pb-2 pt-1">
              <div className="overflow-x-auto no-scrollbar flex items-center gap-2 p-1.5 bg-app-surface border border-app-border rounded-lg">
                {[
                  { id: 'params', label: 'Cátedra & Temario', count: null, icon: 'clipboard-list' },
                  { id: 'biblio', label: 'Bibliografía', count: currentMateriaTexts.length, icon: 'book-marked' },
                  { id: 'examenes', label: 'Exámenes & Link', count: currentMateriaExams.length, icon: 'calendar-check' },
                  { id: 'clases', label: 'Clases', count: currentMateriaClases.length, icon: 'presentation' },
                  { id: 'apuntes', label: 'Apuntes', count: currentMateriaApuntes.length, icon: 'file-edit' },
                  { id: 'pdfs', label: 'PDFs OCR', count: currentMateriaPdfs.length, icon: 'file-check' }
                ].map(sec => {
                  const isSelected = innerTab === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => setInnerTab(sec.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all flex items-center gap-2 flex-shrink-0 ${
                        isSelected
                          ? 'bg-app-card text-app-emerald shadow-card border border-app-border ring-1 ring-app-emerald'
                          : 'text-app-muted hover:text-app-text hover:bg-app-card/40'
                      }`}
                    >
                      <Icon name={sec.icon} className={`w-4 h-4 ${isSelected ? 'text-app-emerald' : 'text-app-muted'}`} />
                      <span>{sec.label}</span>
                      {sec.count !== null && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-black ${
                          isSelected ? 'bg-app-emerald text-white' : 'bg-app-card border border-app-border text-app-text'
                        }`}>
                          {sec.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1. PARÁMETROS & TEMARIO */}
            {innerTab === 'params' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-app-card border border-app-border p-5 rounded-xl shadow-card">
                    <div className="text-xs font-extrabold uppercase text-app-emerald mb-1">Docente / Cátedra</div>
                    <div className="text-lg font-extrabold text-app-text">{currentMateria.docente || 'Sin docente asignado'}</div>
                    <div className="text-xs text-app-muted mt-2">Año: {currentMateria.año_cursado || 2026} • Cuatrimestre: {currentMateria.cuatrimestre || '2'}</div>
                  </div>
                  <div className="bg-app-card border border-app-border p-5 rounded-xl shadow-card">
                    <div className="flex justify-between items-center mb-1">
                      <div className="text-xs font-extrabold uppercase text-app-emerald">Evaluaciones & Parciales</div>
                      <span className="text-[10px] font-bold text-app-muted">{(currentMateria.evaluaciones?.length || (currentMateria.fecha_parcial1 ? 1 : 0) + (currentMateria.fecha_parcial2 ? 1 : 0))} instancia(s)</span>
                    </div>
                    {currentMateria.evaluaciones && currentMateria.evaluaciones.length > 0 ? (
                      <div className="space-y-1.5 mt-2">
                        {currentMateria.evaluaciones.map((ev, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-0.5 border-b border-app-border/40 last:border-0">
                            <span className="font-bold text-app-text truncate max-w-[140px]">{ev.nombre || ev.tipo}:</span>
                            <span className="font-mono text-[11px] text-app-emerald font-bold">{ev.fecha || 'A definir'}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1 mt-1">
                        <div className="text-sm font-extrabold text-app-text">1° Parcial: {currentMateria.fecha_parcial1 || 'A definir'}</div>
                        <div className="text-sm font-extrabold text-app-text">2° Parcial: {currentMateria.fecha_parcial2 || 'A definir'}</div>
                        <div className="text-xs text-app-muted mt-1">Modalidad: {currentMateria.modalidad_parcial || 'Presencial'}</div>
                      </div>
                    )}
                  </div>
                  <div className="bg-app-card border border-app-border p-5 rounded-xl shadow-card">
                    <div className="text-xs font-extrabold uppercase text-app-emerald mb-1">Examen Final & Enlaces</div>
                    <div className="text-sm font-extrabold text-app-text">Final: {currentMateria.fecha_final || 'A definir'}</div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {currentMateria.link_programa && <a href={currentMateria.link_programa} target="_blank" className="px-3 py-1 bg-app-emerald-bg text-app-emerald text-xs font-bold rounded-lg border border-app-emerald/30">Programa Oficial</a>}
                      {currentMateria.link_drive && <a href={currentMateria.link_drive} target="_blank" className="px-3 py-1 bg-app-navy-bg text-app-navy text-xs font-bold rounded-lg border border-app-navy/30">Carpeta Drive</a>}
                    </div>
                  </div>
                </div>

                {/* Temarios dinámicos por cada evaluación */}
                {currentMateria.evaluaciones && currentMateria.evaluaciones.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentMateria.evaluaciones.map((ev, i) => (
                      <div key={i} className="bg-app-card border border-app-border p-5 rounded-xl shadow-card space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-base font-extrabold text-app-text flex items-center gap-2">
                            <Icon name="file-text" className="w-4 h-4 text-app-emerald" /> {ev.nombre || ev.tipo}
                          </h4>
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/20">
                            {ev.modalidad || 'Presencial'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-app-muted">Fecha: <span className="text-app-text">{ev.fecha || 'Sin fecha asignada'}</span></p>
                        <p className="text-sm text-app-text whitespace-pre-wrap leading-relaxed">
                          {ev.temario || 'No hay temario cargado para esta evaluación.'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="bg-app-card border border-app-border p-5 sm:p-4 rounded-xl shadow-card space-y-3">
                      <h4 className="text-base font-extrabold text-app-text flex items-center gap-2">
                        <Icon name="file-text" className="w-4 h-4 text-app-emerald" /> Temario 1° Parcial
                      </h4>
                      <p className="text-sm text-app-text whitespace-pre-wrap leading-relaxed">{currentMateria.temas_parcial1 || 'No hay temario cargado para el 1° parcial.'}</p>
                    </div>
                    <div className="bg-app-card border border-app-border p-5 sm:p-4 rounded-xl shadow-card space-y-3">
                      <h4 className="text-base font-extrabold text-app-text flex items-center gap-2">
                        <Icon name="file-text" className="w-4 h-4 text-app-emerald" /> Temario 2° Parcial
                      </h4>
                      <p className="text-sm text-app-text whitespace-pre-wrap leading-relaxed">{currentMateria.temas_parcial2 || 'No hay temario cargado para el 2° parcial.'}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 2. BIBLIOGRAFÍA EN EL AULA */}
            {innerTab === 'biblio' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { id: 'todos', label: 'Todos' },
                      { id: 'Obligatorio', label: 'Obligatorio' },
                      { id: 'Optativo', label: 'Optativo' },
                      { id: 'parcial', label: 'Va al Parcial' },
                      { id: 'Pendiente', label: 'Pendientes' },
                      { id: 'Resumiendo', label: 'Resumiendo' },
                      { id: 'Leído', label: 'Leídos' },
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setBiblioFilter(f.id)}
                        className={`px-3 py-1 rounded-md text-xs font-bold border transition-all ${
                          biblioFilter === f.id
                            ? 'bg-app-emerald text-white border-app-emerald shadow-emerald'
                            : 'bg-app-surface border-app-border text-app-muted hover:text-app-text'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <button onClick={() => setModalBiblioBatch(true)} className="px-3.5 py-1.5 bg-app-surface border border-app-border rounded-xl text-xs font-bold text-app-text hover:border-app-emerald flex items-center gap-1.5 shadow-card">
                    <Icon name="file-spreadsheet" className="w-3.5 h-3.5 text-app-emerald" /> Carga Estructurada
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentMateriaTexts
                    .filter(b => {
                      if (biblioFilter === 'todos') return true;
                      if (biblioFilter === 'parcial') return b.va_parcial;
                      if (biblioFilter === 'Obligatorio' || biblioFilter === 'Optativo') return (b.caracter || 'Obligatorio') === biblioFilter;
                      return b.estado === biblioFilter;
                    })
                    .map(t => (
                      <div key={t.id} className="bg-app-card border border-app-border p-5 rounded-xl shadow-card flex flex-col justify-between hover:shadow-fluffy transition-all">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex gap-1.5 items-center">
                              <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-app-surface border border-app-border text-app-muted">
                                {t.unidad || 'Unidad 1'}
                              </span>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${t.caracter === 'Optativo' ? 'bg-app-surface text-app-muted border-app-border' : 'bg-app-emerald-bg text-app-emerald border-app-emerald/30'}`}>
                                {t.caracter || 'Obligatorio'}
                              </span>
                            </div>
                            <button
                              onClick={() => handleToggleBiblioEstado(t.id)}
                              className={`text-xs font-bold px-3 py-1 rounded-md border transition-all ${
                                t.estado === 'Leído' ? 'bg-app-emerald-bg text-app-emerald border-app-emerald/40' :
                                t.estado === 'Resumiendo' ? 'bg-app-navy-bg text-app-navy border-app-navy/40' :
                                'bg-app-amber-bg text-app-amber border-app-amber/40'
                              }`}
                            >
                              {t.estado || 'Pendiente'}
                            </button>
                          </div>
                          <h4 className="text-base font-extrabold text-app-text mb-1 leading-snug">{t.titulo_texto}</h4>
                          <p className="text-xs text-app-muted mb-3 italic">Autor: {t.autores || 'No especificado'}</p>
                          {t.notas && <p className="text-xs text-app-muted bg-app-surface p-2.5 rounded-xl border border-app-border mb-3">{t.notas}</p>}
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t border-app-border text-xs">
                          <span className={`font-bold ${t.va_parcial ? 'text-app-amber' : 'text-app-muted'}`}>
                            {t.va_parcial ? 'Va al Parcial' : 'Lectura regular'}
                          </span>
                          <div className="flex gap-2">
                            <button
                              title="Copiar Prompt Académico para IA"
                              onClick={() => {
                                const prompt = generateAcademicPrompt(currentMateria?.nombre, `${t.unidad} - ${t.titulo_texto} (${t.autores || 'Autor'})`, t.notas || '');
                                navigator.clipboard.writeText(prompt);
                                showToast('📋 Prompt copiado para IA', 'sparkles');
                                triggerHaptic('success');
                              }}
                              className="px-2 py-1 rounded-lg bg-app-surface border border-app-border hover:border-app-emerald text-app-emerald flex items-center gap-1 font-bold text-[11px]"
                            >
                              <Icon name="sparkles" className="w-3.5 h-3.5" />
                              <span>Prompt</span>
                            </button>
                            {t.link_resumen && (
                              <a href={t.link_resumen} target="_blank" className="p-1.5 rounded-lg bg-app-emerald-bg text-app-emerald border border-app-emerald/30 text-xs font-bold flex items-center gap-1">
                                <Icon name="external-link" className="w-3.5 h-3.5" /> Resumen
                              </a>
                            )}
                            <button onClick={() => setModalBiblio({ open: true, data: t })} className="p-1.5 rounded-lg bg-app-surface border border-app-border hover:border-app-emerald">
                              <Icon name="edit-2" className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteBiblio(t.id)} className="p-1.5 rounded-lg bg-app-ruby-bg text-app-ruby border border-app-ruby/30">
                              <Icon name="trash-2" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 3. EXÁMENES EN EL AULA */}
            {innerTab === 'examenes' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-extrabold text-app-text flex items-center gap-2">
                    <Icon name="calendar-check" className="w-5 h-5 text-app-emerald" /> Exámenes & Vinculación de Unidades
                  </h3>
                  <button onClick={() => setModalExamen({ open: true, data: null })} className="bg-app-emerald text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-emerald">
                    <Icon name="plus" className="w-4 h-4" /> Crear Examen en esta Materia
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {examenes.filter(e => e.materia_id === selectedMateriaId || e.materia === currentMateria.nombre).map(ex => {
                    const includedUnits = ex.unidades_incluidas || [];
                    const linkedIds = ex.textos_vinculados || ex.textos_ids || [];

                    const relevantTexts = currentMateriaTexts.filter(b => {
                      if (linkedIds.length > 0) return linkedIds.includes(b.id);
                      if (includedUnits.length > 0) return includedUnits.includes(b.unidad);
                      return b.va_parcial;
                    });

                    const readCount = relevantTexts.filter(t => t.estado === 'Leído' || t.estado === 'Salteado').length;
                    const pendingTexts = relevantTexts.filter(t => t.estado !== 'Leído' && t.estado !== 'Salteado');
                    const pct = relevantTexts.length > 0 ? Math.round((readCount / relevantTexts.length) * 100) : 100;

                    const pendingByUnit = {};
                    pendingTexts.forEach(t => {
                      const u = t.unidad || 'Unidad 1';
                      if (!pendingByUnit[u]) pendingByUnit[u] = [];
                      pendingByUnit[u].push(t);
                    });

                    return (
                      <div key={ex.id} className="bg-app-card border border-app-border p-4 rounded-xl shadow-card space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-app-amber-bg text-app-amber border border-app-amber/30">
                              {ex.tipo}
                            </span>
                            <h4 className="text-xl font-extrabold text-app-text mt-1">{ex.nombre}</h4>
                            <p className="text-xs text-app-muted mt-0.5">Fecha: {ex.fecha} • Modalidad: {ex.modalidad}</p>
                            {includedUnits.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {includedUnits.map(u => (
                                  <span key={u} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-app-surface border border-app-border text-app-emerald">
                                    {u}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                triggerHaptic('medium');
                                setModalFlashcards({
                                  open: true,
                                  title: `Simulación: ${ex.nombre}`,
                                  items: relevantTexts.map(t => ({
                                    id: t.id,
                                    titulo_texto: `¿Qué tesis y conceptos clave plantea "${t.titulo_texto}"?`,
                                    autores: `${t.autores || 'Autor'} • ${t.unidad}`,
                                    notas: t.notas || 'Repasa las nociones centrales de este autor, sus definiciones axiomáticas y su articulación con el programa de la materia.'
                                  }))
                                });
                              }}
                              className="px-3 py-1 bg-app-emerald-bg text-app-emerald font-bold text-xs rounded-xl border border-app-emerald/30 flex items-center gap-1.5 hover:brightness-110"
                            >
                              <Icon name="brain" className="w-3.5 h-3.5" /> Simular Parcial
                            </button>
                            <button onClick={() => setModalExamen({ open: true, data: ex })} className="text-app-muted hover:text-app-emerald p-1.5"><Icon name="edit-2" className="w-4 h-4" /></button>
                            <button onClick={() => handleDeleteExamen(ex.id)} className="text-app-ruby p-1.5"><Icon name="trash-2" className="w-4 h-4" /></button>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-app-muted">Textos Evaluados Leídos</span>
                            <span className="text-app-emerald">{readCount}/{relevantTexts.length} ({pct}%)</span>
                          </div>
                          <div className="w-full h-2.5 bg-app-surface rounded-full overflow-hidden border border-app-border">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-md transition-all duration-500" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>

                        {pendingTexts.length === 0 ? (
                          <div className="p-3 bg-app-emerald-bg border border-app-emerald/20 rounded-xl text-xs font-bold text-app-emerald flex items-center gap-2">
                            <Icon name="check-circle" className="w-4 h-4" /> Todos los textos de este examen están leídos.
                          </div>
                        ) : (
                          <div className="space-y-3 pt-2">
                            <div className="text-xs font-extrabold uppercase tracking-wider text-app-ruby flex items-center gap-1.5">
                              <Icon name="alert-circle" className="w-3.5 h-3.5" /> Pendientes de Lectura ({pendingTexts.length})
                            </div>
                            {Object.entries(pendingByUnit).map(([unidad, txs]) => (
                              <div key={unidad} className="bg-app-surface p-3.5 rounded-lg border border-app-border space-y-2">
                                <div className="text-xs font-extrabold text-app-emerald">{unidad}</div>
                                {txs.map(t => (
                                  <div key={t.id} className="flex items-center justify-between gap-2 text-xs py-1 border-b border-app-border/40 last:border-0">
                                    <span className="text-app-text font-semibold flex-1 truncate">{t.titulo_texto}</span>
                                    <button
                                      onClick={() => handleToggleBiblioEstado(t.id)}
                                      className="px-2 py-0.5 rounded-md bg-app-card border border-app-border text-[11px] font-bold text-app-muted hover:text-app-emerald hover:border-app-emerald"
                                    >
                                      Marcar Leído
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. CLASES EN EL AULA */}
            {innerTab === 'clases' && (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-3 justify-between items-center bg-app-card p-5 rounded-xl border border-app-border shadow-card">
                  <div>
                    <h3 className="text-lg font-extrabold text-app-text flex items-center gap-2">
                      <Icon name="monitor" className="w-5 h-5 text-app-emerald" /> Protocolos de Clase
                    </h3>
                    <p className="text-xs text-app-muted mt-0.5">Audios, diapositivas, fotos de pizarra y aclaraciones de la cátedra.</p>
                  </div>
                  <button
                    onClick={() => { triggerHaptic('light'); setModalClase({ open: true, data: null }); }}
                    className="bg-app-emerald text-white font-extrabold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-emerald hover:brightness-110"
                  >
                    <Icon name="plus-circle" className="w-4 h-4 text-white" /> Registrar Nueva Clase
                  </button>
                </div>

                {currentMateriaClases.length === 0 ? (
                  <div className="bg-app-card border border-app-border rounded-xl p-10 text-center space-y-4 shadow-card">
                    <div className="w-16 h-16 rounded-xl bg-app-emerald-bg text-app-emerald flex items-center justify-center mx-auto shadow-emerald border border-app-emerald/20">
                      <Icon name="monitor" className="w-8 h-8" size={32} />
                    </div>
                    <div className="max-w-md mx-auto">
                      <h4 className="text-lg font-extrabold text-app-text">Sin clases registradas en esta materia</h4>
                      <p className="text-xs text-app-muted mt-1 leading-relaxed">
                        Crea protocolos de tus clases teóricas, prácticas o talleres. Puedes adjuntar múltiples grabaciones de audio, fotos de la pizarra y los énfasis para el examen.
                      </p>
                    </div>
                    <button
                      onClick={() => { triggerHaptic('light'); setModalClase({ open: true, data: null }); }}
                      className="px-6 py-3 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald inline-flex items-center gap-2 hover:brightness-110"
                    >
                      <Icon name="plus" className="w-4 h-4 text-white" /> Crear Protocolo de Clase #1
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {currentMateriaClases.map(c => {
                      const grabacionesList = c.grabaciones || (c.link_grabacion ? [{ id: 1, url: c.link_grabacion, title: 'Audio de Clase' }] : []);
                      const imagenesList = c.imagenes || [];

                      return (
                        <div key={c.id} className="bg-app-card border border-app-border p-4 rounded-xl shadow-card space-y-4 flex flex-col justify-between hover:shadow-fluffy transition-all">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-extrabold px-3 py-1 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/30">
                                Clase #{c.nro_clase} • {c.tipo || 'Teórica'}
                              </span>
                              <span className="text-xs text-app-muted font-bold flex items-center gap-1">
                                <Icon name="calendar" className="w-3.5 h-3.5" /> {c.fecha}
                              </span>
                            </div>

                            <h4 className="text-lg font-black text-app-text leading-snug">{c.titulo_clase}</h4>

                            {c.aclaraciones && (
                              <div className="p-3.5 bg-app-emerald-bg border border-app-emerald/20 rounded-lg text-xs text-app-text space-y-1">
                                <div className="font-extrabold text-app-emerald flex items-center gap-1">
                                  <Icon name="alert-triangle" className="w-3.5 h-3.5" /> Énfasis del Docente / Examen:
                                </div>
                                <div className="leading-relaxed whitespace-pre-wrap">{c.aclaraciones}</div>
                              </div>
                            )}

                            {c.contenido_ppt && (
                              <div className="p-3 bg-app-surface border border-app-border rounded-lg text-xs text-app-muted space-y-1">
                                <div className="font-bold text-app-text flex items-center gap-1">
                                  <Icon name="presentation" className="w-3.5 h-3.5 text-app-navy" /> Contenido de Diapositivas:
                                </div>
                                <div className="line-clamp-4 leading-relaxed whitespace-pre-wrap">{c.contenido_ppt}</div>
                              </div>
                            )}

                            {grabacionesList.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <div className="text-[11px] font-bold text-app-muted flex items-center gap-1">
                                  <Icon name="mic" className="w-3.5 h-3.5 text-app-navy" /> Grabaciones ({grabacionesList.length}):
                                </div>
                                <div className="space-y-2">
                                  {grabacionesList.map((g, idx) => (
                                    (g.url && (g.url.startsWith('data:audio') || g.url.startsWith('blob:') || g.isDirectFile)) ? (
                                      <div key={g.id || idx} className="p-2.5 rounded-xl bg-app-surface border border-app-border space-y-1 shadow-sm">
                                        <div className="flex items-center justify-between text-xs font-bold text-app-text">
                                          <span className="flex items-center gap-1.5 truncate">
                                            <Icon name="music" className="w-3.5 h-3.5 text-app-navy shrink-0" />
                                            <strong className="truncate">{g.title || `Audio ${idx + 1}`}</strong>
                                          </span>
                                          <div className="flex items-center gap-1.5">
                                            <button
                                              onClick={() => handleOpenClassInRecorder(c, g)}
                                              className="px-2 py-0.5 text-[10px] font-bold bg-app-emerald-bg border border-app-emerald/30 text-app-emerald rounded-md hover:bg-app-emerald hover:text-white flex items-center gap-1 transition-all"
                                              title="Abrir en Visor Verbatim / Desgrabar"
                                            >
                                              <Icon name="mic" className="w-3 h-3" /> Desgrabar
                                            </button>
                                            <span className="text-[10px] text-app-emerald font-bold bg-app-emerald-bg px-2 py-0.5 rounded-md">Audio Grabado</span>
                                          </div>
                                        </div>
                                        <audio controls src={g.url} className="w-full h-8 rounded-lg bg-app-card" preload="metadata" />
                                      </div>
                                    ) : (
                                      <a
                                        key={g.id || idx}
                                        href={g.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex px-3 py-1.5 bg-app-navy-bg text-app-navy text-xs font-bold rounded-xl border border-app-navy/30 items-center gap-1.5 hover:brightness-110"
                                      >
                                        <Icon name="play-circle" className="w-3.5 h-3.5" /> {g.title || `Audio ${idx + 1}`}
                                      </a>
                                    )
                                  ))}
                                </div>
                              </div>
                            )}

                            {imagenesList.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <div className="text-[11px] font-bold text-app-muted flex items-center gap-1">
                                  <Icon name="image" className="w-3.5 h-3.5 text-app-emerald" /> Fotos de Pizarra / Diapositivas ({imagenesList.length}):
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {imagenesList.map((img, idx) => (
                                    <a key={img.id || idx} href={img.url} target="_blank" rel="noreferrer" className="block relative rounded-xl overflow-hidden border border-app-border group">
                                      <img src={img.url} alt={img.caption || 'Foto clase'} className="w-full h-20 object-cover group-hover:scale-105 transition-transform" />
                                      {img.caption && <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 truncate text-center">{img.caption}</span>}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-app-border text-xs">
                            {c.link_doc_resumen ? (
                              <a href={c.link_doc_resumen} target="_blank" rel="noreferrer" className="px-3 py-1 bg-app-surface text-app-text font-bold rounded-xl border border-app-border flex items-center gap-1 hover:border-app-emerald">
                                <Icon name="file-text" className="w-3.5 h-3.5 text-app-emerald" /> Documento Adjunto
                              </a>
                            ) : (
                              <span></span>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => { triggerHaptic('light'); setModalClase({ open: true, data: c }); }}
                                className="px-3 py-1 bg-app-surface text-app-text font-bold rounded-xl border border-app-border hover:border-app-emerald flex items-center gap-1"
                              >
                                <Icon name="edit-2" className="w-3.5 h-3.5" /> Editar
                              </button>
                              <button
                                onClick={() => { triggerHaptic('warning'); handleDeleteClase(c.id); }}
                                className="p-1.5 text-app-ruby hover:bg-app-ruby-bg rounded-xl border border-transparent hover:border-app-ruby/30"
                              >
                                <Icon name="trash-2" className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 5. APUNTES EN EL AULA */}
            {innerTab === 'apuntes' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2.5 justify-between items-center bg-app-card p-4 rounded-xl border border-app-border shadow-card">
                  <div>
                    <h3 className="text-base font-black text-app-text flex items-center gap-2">
                      <Icon name="file-text" className="w-5 h-5 text-app-emerald" /> Guías de Estudio & Apuntes
                    </h3>
                    <p className="text-xs text-app-muted">Redactados con máxima densidad y formato de doble hoja imprimible.</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        const prompt = generateAcademicPrompt(currentMateria?.nombre, currentMateriaUnits[0] || 'Unidad 1', '');
                        navigator.clipboard.writeText(prompt);
                        showToast('📋 Prompt Académico copiado', 'sparkles');
                        triggerHaptic('success');
                      }}
                      className="px-3.5 py-2 bg-app-surface border border-app-border hover:border-app-emerald text-app-emerald font-bold text-xs rounded-xl flex items-center gap-1.5"
                    >
                      <Icon name="sparkles" className="w-3.5 h-3.5" /> Copiar Prompt IA
                    </button>
                    <button
                      onClick={() => { triggerHaptic('light'); setModalUploadApuntePDF({ open: true, materiaId: selectedMateriaId }); }}
                      className="px-3.5 py-2 bg-app-navy text-white font-extrabold text-xs rounded-xl shadow-card hover:brightness-110 flex items-center gap-1.5"
                    >
                      <Icon name="upload-cloud" className="w-4 h-4 text-white" /> Subir PDF de Apunte
                    </button>
                    <button
                      onClick={() => { triggerHaptic('light'); setModalApunte({ open: true, data: null }); }}
                      className="px-4 py-2 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald hover:brightness-110 flex items-center gap-1.5"
                    >
                      <Icon name="plus-circle" className="w-4 h-4 text-white" /> Crear Nuevo Apunte
                    </button>
                  </div>
                </div>

                {currentMateriaApuntes.length === 0 ? (
                  <div className="bg-app-card border border-app-border rounded-xl p-10 text-center space-y-4 shadow-card">
                    <div className="w-14 h-14 rounded-lg bg-app-emerald-bg text-app-emerald flex items-center justify-center mx-auto border border-app-emerald/20">
                      <Icon name="file-text" className="w-7 h-7" size={28} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-extrabold text-app-text">Sin apuntes cargados en esta materia</h4>
                      <p className="text-xs text-app-muted max-w-sm mx-auto">
                        Puedes subir un apunte existente directamente en formato PDF o redactar uno nuevo con ayuda de IA y formato de doble hoja imprimible.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                      <button
                        onClick={() => setModalUploadApuntePDF({ open: true, materiaId: selectedMateriaId })}
                        className="px-5 py-2.5 bg-app-navy text-white font-bold text-xs rounded-xl shadow-card flex items-center gap-2 hover:brightness-110"
                      >
                        <Icon name="upload-cloud" className="w-4 h-4" /> Subir Apunte en PDF
                      </button>
                      <button
                        onClick={() => setModalApunte({ open: true, data: null })}
                        className="px-5 py-2.5 bg-app-emerald text-white font-bold text-xs rounded-xl shadow-emerald flex items-center gap-2 hover:brightness-110"
                      >
                        <Icon name="plus-circle" className="w-4 h-4" /> Crear con Editor / IA
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentMateriaApuntes.map(a => (
                      <div key={a.id} className="bg-app-card border border-app-border p-5 rounded-xl shadow-card flex flex-col justify-between hover:shadow-fluffy transition-all">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/20">{a.tipo || 'Resumen'}</span>
                              {(a.pdfData || a.pdfName) && (
                                <span className="text-[10px] font-bold text-app-navy bg-app-navy-bg px-2 py-0.5 rounded-md border border-app-navy/20 flex items-center gap-1">
                                  <Icon name="file-text" className="w-3 h-3" /> PDF Original
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-app-muted font-bold">{a.unidad}</span>
                          </div>
                          <h4 className="text-base font-black text-app-text mb-2 leading-snug">{a.titulo}</h4>
                          <p className="text-xs text-app-muted line-clamp-3 leading-relaxed mb-4">{(a.contenido || '').replace(/[#*`>•◦]/g, '')}</p>
                        </div>
                        <div className="flex flex-wrap justify-between items-center pt-3 border-t border-app-border gap-2 text-xs">
                          <span className="font-bold text-app-amber text-[11px] truncate max-w-[120px]" title={a.nro_parcial || 'Para Parcial'}>
                            {a.va_parcial ? (a.nro_parcial ? `Para ${a.nro_parcial}` : 'Para Parcial') : 'Estudio'}
                          </span>
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {(a.pdfData || a.pdfName) ? (
                              <>
                                <button
                                  onClick={() => setModalPDFViewer({ open: true, data: a })}
                                  className="px-2.5 py-1 bg-app-emerald-bg text-app-emerald border border-app-emerald/30 font-bold rounded-xl flex items-center gap-1 hover:brightness-110"
                                  title="Visualizar documento PDF interactivo"
                                >
                                  <Icon name="eye" className="w-3.5 h-3.5" /> Visualizar
                                </button>
                                <button
                                  onClick={() => downloadPDFHelper({ pdfData: a.pdfData, fileName: a.pdfName || a.titulo, twoColumns: false, showToast })}
                                  className="px-2 py-1 bg-app-surface text-app-navy border border-app-border hover:border-app-navy font-bold rounded-xl flex items-center gap-1"
                                  title="Descargar PDF normal en A4"
                                >
                                  <Icon name="download" className="w-3 h-3 text-app-navy" /> ⬇ A4
                                </button>
                                <button
                                  onClick={() => downloadPDFHelper({ pdfData: a.pdfData, fileName: a.pdfName || a.titulo, twoColumns: true, showToast })}
                                  className="px-2 py-1 bg-app-navy text-white font-bold rounded-xl flex items-center gap-1 shadow-sm hover:brightness-110"
                                  title="Descargar en formato 2 páginas por hoja (cuadernillo)"
                                >
                                  <Icon name="book-open" className="w-3 h-3 text-white" /> 📖 2 Págs
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setModalApunte({ open: true, data: a })}
                                className="px-3 py-1 bg-app-surface text-app-text font-bold rounded-xl border border-app-border hover:border-app-emerald flex items-center gap-1"
                              >
                                <Icon name="book-open" className="w-3.5 h-3.5 text-app-emerald" /> Ver / Hoja Doble
                              </button>
                            )}
                            <button
                              onClick={() => setModalApunte({ open: true, data: a })}
                              className="p-1.5 text-app-muted hover:text-app-text rounded-xl border border-transparent hover:border-app-border"
                              title="Editar apunte / Ver editor split"
                            >
                              <Icon name="edit-3" className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteApunte(a.id)}
                              className="p-1.5 text-app-ruby hover:bg-app-ruby-bg rounded-xl border border-transparent hover:border-app-ruby/30"
                              title="Eliminar apunte"
                            >
                              <Icon name="trash-2" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 6. DOCUMENTOS PDF EN EL AULA */}
            {innerTab === 'pdfs' && (
              <div className="space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <div>
                    <h3 className="text-lg font-black text-app-text flex items-center gap-2">
                      <Icon name="file-text" className="w-5 h-5 text-app-emerald" /> Documentos PDF de {currentMateria.nombre}
                    </h3>
                    <p className="text-xs text-app-muted">Archivos PDF listos para visualizar o descargar en formato Normal y Hoja Doble.</p>
                  </div>
                  <button
                    onClick={() => { triggerHaptic('light'); setModalUploadPDF({ open: true, materiaId: selectedMateriaId }); }}
                    className="px-4 py-2.5 bg-app-navy text-white font-extrabold text-xs rounded-xl shadow-card hover:brightness-110 flex items-center gap-2"
                  >
                    <Icon name="upload-cloud" className="w-4 h-4 text-white" /> Subir Archivo PDF
                  </button>
                </div>

                {currentMateriaPdfs.length === 0 ? (
                  <div className="bg-app-card border border-app-border rounded-xl p-10 text-center space-y-4 shadow-card">
                    <div className="w-14 h-14 rounded-xl bg-app-emerald-bg text-app-emerald flex items-center justify-center mx-auto border border-app-emerald/20">
                      <Icon name="file-text" className="w-7 h-7" size={28} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-extrabold text-app-text">Sin documentos PDF en esta materia</h4>
                      <p className="text-xs text-app-muted max-w-sm mx-auto">
                        Sube tus archivos PDF ya maquetados para tenerlos organizados, visualizarlos en pantalla o descargarlos en 2 páginas por hoja.
                      </p>
                    </div>
                    <button
                      onClick={() => setModalUploadPDF({ open: true, materiaId: selectedMateriaId })}
                      className="px-5 py-2.5 bg-app-navy text-white font-bold text-xs rounded-xl shadow-card inline-flex items-center gap-2 hover:brightness-110"
                    >
                      <Icon name="upload-cloud" className="w-4 h-4" /> Subir Primer PDF
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentMateriaPdfs.map(p => (
                      <div key={p.id} className="bg-app-card border border-app-border p-5 rounded-xl shadow-card flex flex-col justify-between hover:shadow-fluffy transition-all">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/20">
                              {p.unidad || 'General'}
                            </span>
                            <span className="text-xs text-app-muted font-bold">{p.num_paginas || 1} págs</span>
                          </div>
                          <h4 className="text-base font-black text-app-text mb-1.5 leading-snug line-clamp-2">
                            {p.nombre_archivo || p.titulo}
                          </h4>
                          {p.tipo && (
                            <span className="text-[10px] text-app-muted font-bold inline-block mb-3">
                              {p.tipo} {p.va_parcial && p.nro_parcial ? `• ${p.nro_parcial}` : ''}
                            </span>
                          )}
                        </div>
                        <div className="pt-3 border-t border-app-border flex items-center justify-between gap-1.5">
                          <button
                            onClick={() => setModalPDFViewer({ open: true, data: p })}
                            className="flex-1 py-2 bg-app-emerald text-white font-bold text-xs rounded-xl shadow-emerald hover:brightness-110 flex items-center justify-center gap-1.5"
                          >
                            <Icon name="book-open" className="w-3.5 h-3.5" /> Visualizar
                          </button>
                          <button
                            onClick={() => downloadPDFHelper({ pdfData: p.pdfData, fileName: p.nombre_archivo || p.titulo, twoColumns: false, showToast })}
                            className="p-2 bg-app-surface text-app-text hover:border-app-navy border border-app-border rounded-xl text-xs font-bold"
                            title="Descargar Normal A4"
                          >
                            <Icon name="download" className="w-4 h-4 text-app-navy" />
                          </button>
                          <button
                            onClick={() => downloadPDFHelper({ pdfData: p.pdfData, fileName: p.nombre_archivo || p.titulo, twoColumns: true, showToast })}
                            className="p-2 bg-app-navy text-white rounded-xl text-xs font-bold shadow-card hover:brightness-110"
                            title="Descargar 2 Páginas por Hoja (Folleto)"
                          >
                            <span className="text-[11px] font-black">2P</span>
                          </button>
                          <button
                            onClick={() => handleDeleteDocumentoPDF(p.id)}
                            className="p-2 text-app-ruby hover:bg-app-ruby-bg rounded-xl border border-transparent hover:border-app-ruby/30"
                            title="Eliminar documento"
                          >
                            <Icon name="trash-2" className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB GLOBAL: BIBLIOTECA GENERAL ── */}
        {activeTab === 'biblio' && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-app-card p-5 rounded-xl border border-app-border shadow-card">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-app-text flex items-center gap-2">
                  <Icon name="book-open" className="w-6 h-6 text-app-emerald" size={24} /> Biblioteca General de Lecturas
                </h2>
                <p className="text-xs text-app-muted">Todos los textos del programa clasificados por cátedra y estado de lectura.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setModalBiblioBatch(true)} className="px-3.5 py-2 bg-app-surface border border-app-border hover:border-app-emerald text-app-text font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm">
                  <Icon name="file-spreadsheet" className="w-3.5 h-3.5 text-app-emerald" /> Carga Rápida
                </button>
                <button onClick={() => setModalBiblio({ open: true, data: null })} className="px-4 py-2 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald hover:brightness-110 flex items-center gap-1.5">
                  <Icon name="plus" className="w-3.5 h-3.5 text-white" /> Agregar Texto
                </button>
              </div>
            </div>

            {/* Materia Filter Chips & State Filter */}
            <div className="space-y-2">
              <div className="overflow-x-auto no-scrollbar flex gap-1.5 py-1">
                <button
                  onClick={() => setGlobalMateriaFilter('todas')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold border whitespace-nowrap transition-all ${
                    globalMateriaFilter === 'todas'
                      ? 'bg-app-emerald text-white border-app-emerald shadow-emerald'
                      : 'bg-app-surface border-app-border text-app-muted hover:text-app-text'
                  }`}
                >
                  Todas las Materias ({biblio.length})
                </button>
                {materias.map(m => {
                  const count = biblio.filter(b => b.materia_id === m.id || b.materia === m.nombre).length;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setGlobalMateriaFilter(m.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold border whitespace-nowrap transition-all ${
                        globalMateriaFilter === m.id
                          ? 'bg-app-emerald text-white border-app-emerald shadow-emerald'
                          : 'bg-app-surface border-app-border text-app-muted hover:text-app-text'
                      }`}
                    >
                      {m.nombre} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'todos', label: 'Todos los estados' },
                  { id: 'Obligatorio', label: 'Obligatorios' },
                  { id: 'Optativo', label: 'Optativos' },
                  { id: 'parcial', label: 'Van a Parcial' },
                  { id: 'Pendiente', label: 'Pendientes' },
                  { id: 'Resumiendo', label: 'Resumiendo' },
                  { id: 'Leído', label: 'Leídos' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setBiblioFilter(f.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold border transition-all ${
                      biblioFilter === f.id
                        ? 'bg-app-card text-app-emerald border-app-emerald shadow-sm'
                        : 'bg-app-surface border-app-border text-app-muted'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {biblio
                .filter(b => globalMateriaFilter === 'todas' || b.materia_id === globalMateriaFilter || b.materia === materias.find(m => m.id === globalMateriaFilter)?.nombre)
                .filter(b => {
                  if (biblioFilter === 'todos') return true;
                  if (biblioFilter === 'parcial') return b.va_parcial;
                  if (biblioFilter === 'Obligatorio' || biblioFilter === 'Optativo') return (b.caracter || 'Obligatorio') === biblioFilter;
                  return b.estado === biblioFilter;
                })
                .map(t => (
                  <div key={t.id} className="bg-app-card border border-app-border p-5 rounded-xl shadow-card flex flex-col justify-between hover:shadow-fluffy transition-all">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/20">
                            {t.materia || 'Materia'}
                          </span>
                          <span className="text-[10px] font-bold text-app-muted">{t.unidad}</span>
                        </div>
                        <button
                          onClick={() => handleToggleBiblioEstado(t.id)}
                          className={`text-xs font-bold px-3 py-0.5 rounded-md border transition-all ${
                            t.estado === 'Leído' ? 'bg-app-emerald-bg text-app-emerald border-app-emerald/40' :
                            t.estado === 'Resumiendo' ? 'bg-app-navy-bg text-app-navy border-app-navy/40' :
                            'bg-app-amber-bg text-app-amber border-app-amber/40'
                          }`}
                        >
                          {t.estado || 'Pendiente'}
                        </button>
                      </div>
                      <h4 className="text-base font-extrabold text-app-text mb-1 leading-snug">{t.titulo_texto}</h4>
                      <p className="text-xs text-app-muted mb-3 italic">Autor: {t.autores || 'No especificado'}</p>
                      {t.notas && <p className="text-xs text-app-muted bg-app-surface p-2.5 rounded-xl border border-app-border mb-3">{t.notas}</p>}
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-app-border text-xs">
                      <span className={`font-bold ${t.va_parcial ? 'text-app-amber' : 'text-app-muted'}`}>
                        {t.va_parcial ? 'Va al Parcial' : 'Lectura regular'}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          title="Copiar Prompt Académico para IA"
                          onClick={() => {
                            const prompt = generateAcademicPrompt(t.materia, `${t.unidad} - ${t.titulo_texto} (${t.autores || 'Autor'})`, t.notas || '');
                            navigator.clipboard.writeText(prompt);
                            showToast('📋 Prompt copiado para IA', 'sparkles');
                            triggerHaptic('success');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-app-surface border border-app-border hover:border-app-emerald text-app-emerald flex items-center gap-1 font-bold text-[11px]"
                        >
                          <Icon name="sparkles" className="w-3.5 h-3.5" />
                          <span>Prompt</span>
                        </button>
                        {t.link_resumen && (
                          <a href={t.link_resumen} target="_blank" className="p-1.5 rounded-lg bg-app-emerald-bg text-app-emerald border border-app-emerald/30 text-xs font-bold flex items-center gap-1">
                            <Icon name="external-link" className="w-3.5 h-3.5" /> Resumen
                          </a>
                        )}
                        <button onClick={() => setModalBiblio({ open: true, data: t })} className="p-1.5 rounded-lg bg-app-surface border border-app-border hover:border-app-emerald">
                          <Icon name="edit-2" className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteBiblio(t.id)} className="p-1.5 rounded-lg bg-app-ruby-bg text-app-ruby border border-app-ruby/30">
                          <Icon name="trash-2" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── TAB GLOBAL: CLASES & AUDIOS ── */}
        {activeTab === 'clases' && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-app-card p-5 rounded-xl border border-app-border shadow-card">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-app-text flex items-center gap-2">
                  <Icon name="presentation" className="w-6 h-6 text-app-emerald" size={24} /> Protocolos de Clase & Grabaciones
                </h2>
                <p className="text-xs text-app-muted">Audios, pizarras, diapositivas y temas clave dados en cátedra.</p>
              </div>
              <button
                onClick={() => { triggerHaptic('light'); setModalClase({ open: true, data: null }); }}
                className="px-4 py-2 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald hover:brightness-110 flex items-center gap-1.5"
              >
                <Icon name="plus-circle" className="w-4 h-4 text-white" /> Registrar Nueva Clase
              </button>
            </div>

            {/* Materia Filter Chips */}
            <div className="overflow-x-auto no-scrollbar flex gap-1.5 py-1">
              <button
                onClick={() => setGlobalMateriaFilter('todas')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold border whitespace-nowrap transition-all ${
                  globalMateriaFilter === 'todas'
                    ? 'bg-app-emerald text-white border-app-emerald shadow-emerald'
                    : 'bg-app-surface border-app-border text-app-muted hover:text-app-text'
                }`}
              >
                Todas las Materias ({clases.length})
              </button>
              {materias.map(m => {
                const count = clases.filter(c => c.materia_id === m.id || c.materia === m.nombre).length;
                return (
                  <button
                    key={m.id}
                    onClick={() => setGlobalMateriaFilter(m.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold border whitespace-nowrap transition-all ${
                      globalMateriaFilter === m.id
                        ? 'bg-app-emerald text-white border-app-emerald shadow-emerald'
                        : 'bg-app-surface border-app-border text-app-muted hover:text-app-text'
                    }`}
                  >
                    {m.nombre} ({count})
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {clases
                .filter(c => globalMateriaFilter === 'todas' || c.materia_id === globalMateriaFilter || c.materia === materias.find(m => m.id === globalMateriaFilter)?.nombre)
                .map(c => {
                  const grabacionesList = c.grabaciones || (c.link_grabacion ? [{ id: 1, url: c.link_grabacion, title: 'Audio de Clase' }] : []);
                  const imagenesList = c.imagenes || [];

                  return (
                    <div key={c.id} className="bg-app-card border border-app-border p-4 rounded-xl shadow-card space-y-4 flex flex-col justify-between hover:shadow-fluffy transition-all">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-extrabold px-3 py-1 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/30">
                            {c.materia || 'Materia'} • Clase #{c.nro_clase}
                          </span>
                          <span className="text-xs text-app-muted font-bold flex items-center gap-1">
                            <Icon name="calendar" className="w-3.5 h-3.5" /> {c.fecha}
                          </span>
                        </div>

                        <h4 className="text-lg font-black text-app-text leading-snug">{c.titulo_clase}</h4>

                        {c.aclaraciones && (
                          <div className="p-3.5 bg-app-emerald-bg border border-app-emerald/20 rounded-lg text-xs text-app-text space-y-1">
                            <div className="font-extrabold text-app-emerald flex items-center gap-1">
                              <Icon name="alert-triangle" className="w-3.5 h-3.5" /> Énfasis Docente / Examen:
                            </div>
                            <div className="leading-relaxed whitespace-pre-wrap">{c.aclaraciones}</div>
                          </div>
                        )}

                        {grabacionesList.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="text-[11px] font-bold text-app-muted flex items-center gap-1">
                              <Icon name="mic" className="w-3.5 h-3.5 text-app-navy" /> Grabaciones ({grabacionesList.length}):
                            </div>
                            <div className="space-y-2">
                              {grabacionesList.map((g, idx) => (
                                (g.url && (g.url.startsWith('data:audio') || g.url.startsWith('blob:') || g.isDirectFile)) ? (
                                  <div key={g.id || idx} className="p-2.5 rounded-xl bg-app-surface border border-app-border space-y-1 shadow-sm">
                                    <div className="flex items-center justify-between text-xs font-bold text-app-text">
                                      <span className="flex items-center gap-1.5 truncate">
                                        <Icon name="music" className="w-3.5 h-3.5 text-app-navy shrink-0" />
                                        <strong className="truncate">{g.title || `Audio ${idx + 1}`}</strong>
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          onClick={() => handleOpenClassInRecorder(c, g)}
                                          className="px-2 py-0.5 text-[10px] font-bold bg-app-emerald-bg border border-app-emerald/30 text-app-emerald rounded-md hover:bg-app-emerald hover:text-white flex items-center gap-1 transition-all"
                                          title="Abrir en Visor Verbatim / Desgrabar"
                                        >
                                          <Icon name="mic" className="w-3 h-3" /> Desgrabar
                                        </button>
                                        <span className="text-[10px] text-app-emerald font-bold bg-app-emerald-bg px-2 py-0.5 rounded-md">Audio Grabado</span>
                                      </div>
                                    </div>
                                    <audio controls src={g.url} className="w-full h-8 rounded-lg bg-app-card" preload="metadata" />
                                  </div>
                                ) : (
                                  <a
                                    key={g.id || idx}
                                    href={g.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex px-3 py-1.5 bg-app-navy-bg text-app-navy text-xs font-bold rounded-xl border border-app-navy/30 items-center gap-1.5 hover:brightness-110"
                                  >
                                    <Icon name="play-circle" className="w-3.5 h-3.5" /> {g.title || `Audio ${idx + 1}`}
                                  </a>
                                )
                              ))}
                            </div>
                          </div>
                        )}

                        {imagenesList.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="text-[11px] font-bold text-app-muted flex items-center gap-1">
                              <Icon name="image" className="w-3.5 h-3.5 text-app-emerald" /> Pizarras & Fotos ({imagenesList.length}):
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {imagenesList.map((img, idx) => (
                                <a key={img.id || idx} href={img.url} target="_blank" rel="noreferrer" className="block relative rounded-xl overflow-hidden border border-app-border group">
                                  <img src={img.url} alt={img.caption || 'Foto clase'} className="w-full h-20 object-cover group-hover:scale-105 transition-transform" />
                                  {img.caption && <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] p-1 truncate text-center">{img.caption}</span>}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-app-border text-xs">
                        {c.link_doc_resumen ? (
                          <a href={c.link_doc_resumen} target="_blank" rel="noreferrer" className="px-3 py-1 bg-app-surface text-app-text font-bold rounded-xl border border-app-border flex items-center gap-1 hover:border-app-emerald">
                            <Icon name="file-text" className="w-3.5 h-3.5 text-app-emerald" /> Documento
                          </a>
                        ) : (
                          <span></span>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => { triggerHaptic('light'); setModalClase({ open: true, data: c }); }}
                            className="px-3 py-1 bg-app-surface text-app-text font-bold rounded-xl border border-app-border hover:border-app-emerald flex items-center gap-1"
                          >
                            <Icon name="edit-2" className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button
                            onClick={() => { triggerHaptic('warning'); handleDeleteClase(c.id); }}
                            className="p-1.5 text-app-ruby hover:bg-app-ruby-bg rounded-xl border border-transparent hover:border-app-ruby/30"
                          >
                            <Icon name="trash-2" className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ── TAB GLOBAL: GUÍAS & APUNTES ── */}
        {activeTab === 'apuntes' && (
          <div className="space-y-5 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-app-card p-5 rounded-xl border border-app-border shadow-card">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-app-text flex items-center gap-2">
                  <Icon name="file-text" className="w-6 h-6 text-app-emerald" size={24} /> Guías de Estudio & Apuntes Académicos
                </h2>
                <p className="text-xs text-app-muted">Redacción de máxima densidad con soporte para fórmulas LaTeX y vista en hoja doble imprimible.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const prompt = generateAcademicPrompt('', 'Unidad 1', '');
                    navigator.clipboard.writeText(prompt);
                    showToast('📋 Prompt Académico copiado', 'sparkles');
                    triggerHaptic('success');
                  }}
                  className="px-3.5 py-2 bg-app-surface border border-app-border hover:border-app-emerald text-app-emerald font-bold text-xs rounded-xl flex items-center gap-1.5"
                >
                  <Icon name="sparkles" className="w-3.5 h-3.5" /> Copiar Prompt IA
                </button>
                <button
                  onClick={() => { triggerHaptic('light'); setModalUploadApuntePDF({ open: true, materiaId: globalMateriaFilter !== 'todas' ? globalMateriaFilter : null }); }}
                  className="px-3.5 py-2 bg-app-navy text-white font-extrabold text-xs rounded-xl shadow-card hover:brightness-110 flex items-center gap-1.5"
                >
                  <Icon name="upload-cloud" className="w-4 h-4 text-white" /> Subir PDF de Apunte
                </button>
                <button
                  onClick={() => { triggerHaptic('light'); setModalApunte({ open: true, data: null }); }}
                  className="px-4 py-2 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald hover:brightness-110 flex items-center gap-1.5"
                >
                  <Icon name="plus-circle" className="w-4 h-4 text-white" /> Crear Nuevo Apunte
                </button>
              </div>
            </div>

            {/* Materia Filter Chips */}
            <div className="overflow-x-auto no-scrollbar flex gap-1.5 py-1">
              <button
                onClick={() => setGlobalMateriaFilter('todas')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold border whitespace-nowrap transition-all ${
                  globalMateriaFilter === 'todas'
                    ? 'bg-app-emerald text-white border-app-emerald shadow-emerald'
                    : 'bg-app-surface border-app-border text-app-muted hover:text-app-text'
                }`}
              >
                Todas las Materias ({apuntes.length})
              </button>
              {materias.map(m => {
                const count = apuntes.filter(a => a.materia_id === m.id || a.materia === m.nombre).length;
                return (
                  <button
                    key={m.id}
                    onClick={() => setGlobalMateriaFilter(m.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold border whitespace-nowrap transition-all ${
                      globalMateriaFilter === m.id
                        ? 'bg-app-emerald text-white border-app-emerald shadow-emerald'
                        : 'bg-app-surface border-app-border text-app-muted hover:text-app-text'
                    }`}
                  >
                    {m.nombre} ({count})
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {apuntes
                .filter(a => globalMateriaFilter === 'todas' || a.materia_id === globalMateriaFilter || a.materia === materias.find(m => m.id === globalMateriaFilter)?.nombre)
                .map(a => (
                  <div key={a.id} className="bg-app-card border border-app-border p-5 rounded-xl shadow-card flex flex-col justify-between hover:shadow-fluffy transition-all">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/20">{a.materia || 'Apunte'}</span>
                          {(a.pdfData || a.pdfName) && (
                            <span className="text-[10px] font-bold text-app-navy bg-app-navy-bg px-2 py-0.5 rounded-md border border-app-navy/20 flex items-center gap-1">
                              <Icon name="file-text" className="w-3 h-3" /> PDF Original
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-app-muted font-bold">{a.unidad}</span>
                      </div>
                      <h4 className="text-base font-black text-app-text mb-2 leading-snug">{a.titulo}</h4>
                      <p className="text-xs text-app-muted line-clamp-3 leading-relaxed mb-4">{(a.contenido || '').replace(/[#*`>•◦]/g, '')}</p>
                    </div>
                    <div className="flex flex-wrap justify-between items-center pt-3 border-t border-app-border gap-2 text-xs">
                      <span className="font-bold text-app-amber text-[11px] truncate max-w-[120px]" title={a.nro_parcial || 'Para Parcial'}>
                        {a.va_parcial ? (a.nro_parcial ? `Para ${a.nro_parcial}` : 'Para Parcial') : 'Estudio'}
                      </span>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {(a.pdfData || a.pdfName) ? (
                          <>
                            <button
                              onClick={() => setModalPDFViewer({ open: true, data: a })}
                              className="px-2.5 py-1 bg-app-emerald-bg text-app-emerald border border-app-emerald/30 font-bold rounded-xl flex items-center gap-1 hover:brightness-110"
                              title="Visualizar documento PDF interactivo"
                            >
                              <Icon name="eye" className="w-3.5 h-3.5" /> Visualizar
                            </button>
                            <button
                              onClick={() => downloadPDFHelper({ pdfData: a.pdfData, fileName: a.pdfName || a.titulo, twoColumns: false, showToast })}
                              className="px-2 py-1 bg-app-surface text-app-navy border border-app-border hover:border-app-navy font-bold rounded-xl flex items-center gap-1"
                              title="Descargar PDF normal en A4"
                            >
                              <Icon name="download" className="w-3 h-3 text-app-navy" /> ⬇ A4
                            </button>
                            <button
                              onClick={() => downloadPDFHelper({ pdfData: a.pdfData, fileName: a.pdfName || a.titulo, twoColumns: true, showToast })}
                              className="px-2 py-1 bg-app-navy text-white font-bold rounded-xl flex items-center gap-1 shadow-sm hover:brightness-110"
                              title="Descargar en formato 2 páginas por hoja (cuadernillo)"
                            >
                              <Icon name="book-open" className="w-3 h-3 text-white" /> 📖 2 Págs
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setModalApunte({ open: true, data: a })}
                            className="px-3 py-1 bg-app-surface text-app-text font-bold rounded-xl border border-app-border hover:border-app-emerald flex items-center gap-1"
                          >
                            <Icon name="book-open" className="w-3.5 h-3.5 text-app-emerald" /> Ver / Hoja Doble
                          </button>
                        )}
                        <button
                          onClick={() => setModalApunte({ open: true, data: a })}
                          className="p-1.5 text-app-muted hover:text-app-text rounded-xl border border-transparent hover:border-app-border"
                          title="Editar apunte / Ver editor split"
                        >
                          <Icon name="edit-3" className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteApunte(a.id)}
                          className="p-1.5 text-app-ruby hover:bg-app-ruby-bg rounded-xl border border-transparent hover:border-app-ruby/30"
                          title="Eliminar apunte"
                        >
                          <Icon name="trash-2" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── TAB GLOBAL: EXÁMENES & SIMULACIONES ── */}
        {activeTab === 'examenes' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-app-card p-5 rounded-xl border border-app-border shadow-card">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-app-text flex items-center gap-2">
                  <Icon name="calendar-check" className="w-6 h-6 text-app-emerald" size={24} /> Exámenes, Parciales & Simulador
                </h2>
                <p className="text-xs text-app-muted">Cronograma completo de evaluaciones, vinculación de textos y simulación de preguntas.</p>
              </div>
              <button onClick={() => setModalExamen({ open: true, data: null })} className="bg-app-emerald text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-emerald hover:brightness-110">
                <Icon name="plus" className="w-4 h-4" /> Crear Examen
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {examenes.map(ex => {
                const mat = materias.find(m => m.id === ex.materia_id || m.nombre === ex.materia);
                const matTexts = biblio.filter(b => b.materia_id === ex.materia_id || b.materia === ex.materia);
                const includedUnits = ex.unidades_incluidas || [];
                const linkedIds = ex.textos_vinculados || ex.textos_ids || [];

                const relevantTexts = matTexts.filter(b => {
                  if (linkedIds.length > 0) return linkedIds.includes(b.id);
                  if (includedUnits.length > 0) return includedUnits.includes(b.unidad);
                  return b.va_parcial;
                });

                const readCount = relevantTexts.filter(t => t.estado === 'Leído' || t.estado === 'Salteado').length;
                const pct = relevantTexts.length > 0 ? Math.round((readCount / relevantTexts.length) * 100) : 100;

                return (
                  <div key={ex.id} className="bg-app-card border border-app-border p-4 rounded-xl shadow-card space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/20">
                            {ex.materia || mat?.nombre || 'Materia'}
                          </span>
                          <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-app-amber-bg text-app-amber border border-app-amber/30">
                            {ex.tipo}
                          </span>
                        </div>
                        <h4 className="text-xl font-extrabold text-app-text mt-1.5">{ex.nombre}</h4>
                        <p className="text-xs text-app-muted mt-0.5">Fecha: <strong>{ex.fecha}</strong> • Modalidad: {ex.modalidad}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            triggerHaptic('medium');
                            setModalFlashcards({
                              open: true,
                              title: `Simulación: ${ex.nombre}`,
                              items: relevantTexts.map(t => ({
                                id: t.id,
                                titulo_texto: `¿Qué tesis y conceptos clave plantea "${t.titulo_texto}"?`,
                                autores: `${t.autores || 'Autor'} • ${t.unidad}`,
                                notas: t.notas || 'Repasa las nociones centrales de este autor, sus definiciones axiomáticas y su articulación con el programa de la materia.'
                              }))
                            });
                          }}
                          className="px-3 py-1 bg-app-emerald-bg text-app-emerald font-bold text-xs rounded-xl border border-app-emerald/30 flex items-center gap-1.5 hover:brightness-110"
                        >
                          <Icon name="brain" className="w-3.5 h-3.5" /> Simular
                        </button>
                        <button onClick={() => setModalExamen({ open: true, data: ex })} className="text-app-muted hover:text-app-emerald p-1.5"><Icon name="edit-2" className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteExamen(ex.id)} className="text-app-ruby p-1.5"><Icon name="trash-2" className="w-4 h-4" /></button>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-app-muted">Textos Evaluados Leídos</span>
                        <span className="text-app-emerald">{readCount}/{relevantTexts.length} ({pct}%)</span>
                      </div>
                      <div className="w-full h-2.5 bg-app-surface rounded-full overflow-hidden border border-app-border">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-md transition-all duration-500" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB: BIBLIOTECA DE DOCUMENTOS PDF ── */}
        {activeTab === 'pdf' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-wrap justify-between items-center gap-4 bg-app-card p-5 rounded-xl border border-app-border shadow-card">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-app-text flex items-center gap-2.5">
                  <Icon name="file-text" className="w-6 h-6 text-app-emerald" size={24} /> Biblioteca de Documentos PDF
                </h2>
                <p className="text-xs text-app-muted mt-1">
                  Visualiza tus documentos PDF completos o descárgalos en formato Normal (A4) y Folleto (2 Páginas por Hoja).
                </p>
              </div>

              <button
                onClick={() => { triggerHaptic('light'); setModalUploadPDF({ open: true, materiaId: null }); }}
                className="px-4 py-2.5 bg-app-navy text-white font-extrabold text-xs rounded-xl shadow-card hover:brightness-110 flex items-center gap-2"
              >
                <Icon name="upload-cloud" className="w-4 h-4 text-white" /> Subir Archivo PDF
              </button>
            </div>

            {/* Quick Upload Banner */}
            <div
              onClick={() => { triggerHaptic('light'); setModalUploadPDF({ open: true, materiaId: null }); }}
              className="border-2 border-dashed border-app-emerald/60 hover:border-app-emerald bg-app-card/60 p-8 rounded-2xl text-center cursor-pointer shadow-card transition-all hover:bg-app-emerald-bg/10"
            >
              <div className="w-14 h-14 bg-app-emerald-bg text-app-emerald rounded-xl mx-auto flex items-center justify-center mb-2.5 border border-app-emerald/20">
                <Icon name="upload-cloud" className="w-7 h-7 text-app-emerald" size={28} />
              </div>
              <div className="text-base font-extrabold text-app-text">Haz clic aquí o arrastra un PDF para guardarlo en el sistema</div>
              <div className="text-xs text-app-muted mt-0.5">El archivo se conserva intacto, listo para visualizar y descargar en 1 o 2 columnas</div>
            </div>

            {/* Filter by Materia */}
            <div className="overflow-x-auto no-scrollbar flex gap-1.5 py-1">
              <button
                onClick={() => setGlobalMateriaFilter('todas')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  globalMateriaFilter === 'todas'
                    ? 'bg-app-emerald text-white shadow-emerald'
                    : 'bg-app-surface text-app-muted hover:text-app-text border border-app-border'
                }`}
              >
                Todas las Materias ({pdfs.length})
              </button>
              {materias.map(m => {
                const count = pdfs.filter(p => p.materia_id === m.id || p.materia === m.nombre).length;
                return (
                  <button
                    key={m.id}
                    onClick={() => setGlobalMateriaFilter(m.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      globalMateriaFilter === m.id
                        ? 'bg-app-emerald text-white shadow-emerald'
                        : 'bg-app-surface text-app-muted hover:text-app-text border border-app-border'
                    }`}
                  >
                    <span>{m.abreviatura || m.nombre}</span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-black/10 rounded-md">{count}</span>
                  </button>
                );
              })}
            </div>

            {/* PDF Grid */}
            {pdfs.length === 0 ? (
              <div className="bg-app-card border border-app-border rounded-2xl p-12 text-center space-y-4 shadow-card">
                <div className="w-16 h-16 rounded-2xl bg-app-emerald-bg text-app-emerald mx-auto flex items-center justify-center border border-app-emerald/20">
                  <Icon name="file-text" className="w-8 h-8" size={32} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-extrabold text-app-text">Aún no tienes documentos PDF guardados</h4>
                  <p className="text-xs text-app-muted max-w-sm mx-auto">
                    Sube tus apuntes en PDF o crea uno con el editor para tenerlos todos centralizados aquí.
                  </p>
                </div>
                <button
                  onClick={() => setModalUploadPDF({ open: true, materiaId: null })}
                  className="px-5 py-2.5 bg-app-emerald text-white font-bold text-xs rounded-xl shadow-emerald inline-flex items-center gap-2 hover:brightness-110"
                >
                  <Icon name="upload-cloud" className="w-4 h-4" /> Subir Primer PDF
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pdfs
                  .filter(p => globalMateriaFilter === 'todas' || p.materia_id === globalMateriaFilter || p.materia === materias.find(m => m.id === globalMateriaFilter)?.nombre)
                  .map(p => (
                    <div key={p.id} className="bg-app-card border border-app-border p-5 rounded-xl shadow-card flex flex-col justify-between hover:shadow-fluffy transition-all">
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/20">
                            {p.materia || 'General'}
                          </span>
                          <span className="text-xs text-app-muted font-bold">{p.num_paginas || 1} págs</span>
                        </div>
                        <h4 className="text-base font-black text-app-text mb-1.5 leading-snug line-clamp-2">
                          {p.nombre_archivo || p.titulo}
                        </h4>
                        <div className="text-[11px] text-app-muted font-bold flex items-center gap-2 mb-3">
                          <span>{p.unidad || 'Unidad 1'}</span>
                          {p.tipo && <span>• {p.tipo}</span>}
                          {p.va_parcial && p.nro_parcial && (
                            <span className="text-app-amber">• {p.nro_parcial}</span>
                          )}
                        </div>
                      </div>
                      <div className="pt-3 border-t border-app-border flex items-center justify-between gap-1.5">
                        <button
                          onClick={() => setModalPDFViewer({ open: true, data: p })}
                          className="flex-1 py-2 bg-app-emerald text-white font-bold text-xs rounded-xl shadow-emerald hover:brightness-110 flex items-center justify-center gap-1.5"
                        >
                          <Icon name="book-open" className="w-3.5 h-3.5" /> Visualizar
                        </button>
                        <button
                          onClick={() => downloadPDFHelper({ pdfData: p.pdfData, fileName: p.nombre_archivo || p.titulo, twoColumns: false, showToast })}
                          className="p-2 bg-app-surface text-app-text hover:border-app-navy border border-app-border rounded-xl text-xs font-bold"
                          title="Descargar Normal A4"
                        >
                          <Icon name="download" className="w-4 h-4 text-app-navy" />
                        </button>
                        <button
                          onClick={() => downloadPDFHelper({ pdfData: p.pdfData, fileName: p.nombre_archivo || p.titulo, twoColumns: true, showToast })}
                          className="p-2 bg-app-navy text-white rounded-xl text-xs font-bold shadow-card hover:brightness-110"
                          title="Descargar 2 Páginas por Hoja (Folleto)"
                        >
                          <span className="text-[11px] font-black">2P</span>
                        </button>
                        <button
                          onClick={() => handleDeleteDocumentoPDF(p.id)}
                          className="p-2 text-app-ruby hover:bg-app-ruby-bg rounded-xl border border-transparent hover:border-app-ruby/30"
                          title="Eliminar documento"
                        >
                          <Icon name="trash-2" className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: MI PERFIL (ADMINISTRACIÓN Y CREACIÓN DE MATERIAS) ── */}
        {activeTab === 'perfil' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-extrabold flex items-center gap-2 text-app-text">
                <Icon name="user-check" className="w-6 h-6 text-app-emerald" size={24} /> Mi Perfil & Gestión Académica
              </h2>
              <button
                onClick={() => setModalMateria({ open: true, data: null })}
                className="bg-app-emerald text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-emerald hover:brightness-110"
              >
                <Icon name="plus-circle" className="w-4 h-4 text-white" /> Crear Nueva Materia
              </button>
            </div>

            <div className="bg-gradient-to-br from-app-surface to-app-card border-2 border-app-border/70 p-4 md:p-5 rounded-2xl shadow-fluffy flex flex-wrap items-center gap-5 transition-transform hover:-translate-y-1 duration-300">
              <div className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-emerald border-4 border-app-surface overflow-visible group bg-app-card cursor-pointer">
                <input type="file" accept="image/*" onChange={handleProfileImageUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" title="Cambiar foto de perfil" />
                <div className="w-full h-full rounded-full overflow-hidden">
                  {profileImage ? (
                    <img src={profileImage} alt="Perfil" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-600 to-teal-900 flex items-center justify-center text-white">
                      <span className="text-3xl font-black tracking-tighter">FL</span>
                    </div>
                  )}
                </div>
                {/* Camera Badge Overlapping */}
                <div className="absolute -bottom-1 -right-1 bg-app-emerald text-white p-2 rounded-full shadow-card border-2 border-app-surface z-20 group-hover:scale-110 transition-transform">
                  <Icon name="camera" className="w-4 h-4" />
                </div>
              </div>
              <div className="flex-1 min-w-[220px]">
                <h3 className="text-2xl font-extrabold text-app-text">Facundo Lazarte</h3>
                <p className="text-sm font-semibold text-app-emerald mt-0.5">Licenciatura en Psicología — Cursado Académico 2026</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs px-3 py-1 rounded-md bg-app-card border border-app-border text-app-muted font-bold">React + Tailwind Engine</span>
                  <span className="text-xs px-3 py-1 rounded-md bg-app-card border border-app-border text-app-muted font-bold">Supabase Cloud Sync</span>
                  <span className="text-xs px-3 py-1 rounded-md bg-app-card border border-app-border text-app-muted font-bold">Dual Theme Active</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { lbl: 'Materias Activas', val: materias.length, icon: 'book' },
                { lbl: 'Textos en Biblioteca', val: biblio.length, icon: 'file-text' },
                { lbl: 'Lecturas Completadas', val: biblio.filter(b => b.estado === 'Leído' || b.estado === 'Salteado').length, icon: 'check-circle-2' },
                { lbl: 'Apuntes Generados', val: apuntes.length, icon: 'feather' }
              ].map((s, idx) => (
                <div key={idx} className="bg-app-card border-2 border-app-border/70 p-5 rounded-xl shadow-card flex items-center gap-4 transition-transform hover:scale-[1.02] duration-300">
                  <div className="w-12 h-12 rounded-xl bg-app-emerald-bg text-app-emerald flex items-center justify-center">
                    <Icon name={s.icon} className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-black text-app-text">{s.val}</div>
                    <div className="text-xs font-bold text-app-muted">{s.lbl}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Administrador de Materias */}
            <div className="bg-app-card border border-app-border p-4 rounded-xl shadow-card space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-extrabold text-app-text flex items-center gap-2">
                    <Icon name="sliders" className="w-5 h-5 text-app-emerald" /> Administración de Materias
                  </h3>
                  <p className="text-xs text-app-muted">Edita docentes, programas, cuatrimestres o elimina materias.</p>
                </div>
                <button onClick={() => setModalMateria({ open: true, data: null })} className="px-3 py-1.5 bg-app-emerald text-white text-xs font-bold rounded-xl shadow-emerald flex items-center gap-1.5">
                  <Icon name="plus" className="w-3.5 h-3.5" /> Nueva
                </button>
              </div>

              <div className="space-y-3">
                {materias.map(m => (
                  <div key={m.id} className="flex justify-between items-center p-4 rounded-xl bg-app-surface border border-app-border">
                    <div>
                      <div className="font-extrabold text-app-text text-sm">{m.nombre}</div>
                      <div className="text-xs text-app-muted">{m.docente || 'Sin docente'} • {m.cuatrimestre === 0 ? 'Anual' : `${m.cuatrimestre}° Cuatrimestre`}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setModalMateria({ open: true, data: m })} className="px-3 py-1.5 bg-app-card border border-app-border text-xs font-bold rounded-lg flex items-center gap-1">
                        <Icon name="edit-2" className="w-3.5 h-3.5" /> Editar
                      </button>
                      <button onClick={() => handleDeleteMateria(m.id)} className="px-3 py-1.5 bg-app-ruby-bg text-app-ruby text-xs font-bold rounded-lg border border-app-ruby/30 flex items-center gap-1">
                        <Icon name="trash-2" className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CARD: ACTUALIZACIONES DE LA APP ── */}
            <div className="bg-app-card border border-app-border p-4 rounded-xl shadow-card space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-app-emerald">Canal Oficial de Producción</div>
                  <h3 className="text-lg font-extrabold text-app-text flex items-center gap-2">
                    <Icon name="sparkles" className="w-5 h-5 text-app-emerald" /> Actualizaciones del Sistema
                  </h3>
                  <p className="text-xs text-app-muted">Versión instalada: <strong className="text-app-text">{currentVersion}</strong></p>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-md border ${
                  updateAvailable
                    ? 'bg-app-emerald-bg text-app-emerald border-app-emerald animate-pulse'
                    : 'bg-app-surface text-app-muted border-app-border'
                }`}>
                  {updateAvailable ? 'Nueva Versión Lista' : 'Al Día'}
                </span>
              </div>

              {updateAvailable ? (
                <div className="p-4 rounded-lg bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border-2 border-app-emerald space-y-3">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-app-text">
                    <Icon name="arrow-up-circle" className="w-5 h-5 text-app-emerald animate-bounce" />
                    ¡Hay una nueva actualización disponible en GitHub (main)!
                  </div>
                  <p className="text-xs text-app-muted">
                    Se detectaron cambios en el repositorio. Haz clic abajo para actualizar el caché local sin perder tus notas ni materias.
                  </p>
                  <button
                    onClick={applyUpdate}
                    className="w-full py-3 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald flex items-center justify-center gap-2 hover:brightness-110 animate-pulse"
                  >
                    <Icon name="download-cloud" className="w-4 h-4" /> Instalar Actualización Ahora
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    onClick={() => checkForUpdates(true)}
                    disabled={checkingUpdate}
                    className="px-4 py-2.5 bg-app-surface border border-app-border hover:border-app-emerald text-app-text font-bold text-xs rounded-xl shadow-card flex items-center gap-2 transition-all"
                  >
                    <Icon name="refresh-cw" className={`w-4 h-4 text-app-emerald ${checkingUpdate ? 'animate-spin' : ''}`} />
                    {checkingUpdate ? 'Verificando en la nube...' : 'Buscar Actualizaciones'}
                  </button>
                </div>
              )}
            </div>

            <div className="bg-app-card border border-app-border p-4 rounded-xl shadow-card space-y-4">
              <h3 className="text-lg font-extrabold text-app-text flex items-center gap-2">
                <Icon name="hard-drive" className="w-5 h-5 text-app-emerald" /> Respaldo y Sincronización en la Nube
              </h3>
              <p className="text-xs text-app-muted">
                Exporta copias de seguridad en JSON o sube todos tus datos locales de forma idempotente a Supabase.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={syncAllLocalDataToCloud}
                  disabled={isSyncingAll}
                  className="px-4 py-2.5 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald flex items-center gap-2 hover:brightness-110 disabled:opacity-50"
                >
                  <Icon name={isSyncingAll ? "refresh-cw" : "cloud-upload"} className={`w-4 h-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
                  {isSyncingAll ? 'Subiendo a Supabase...' : 'Subir Todo a Supabase'}
                </button>
                <label className="px-4 py-2.5 bg-app-surface border border-app-border hover:border-app-emerald text-app-text font-bold text-xs rounded-xl cursor-pointer shadow-card flex items-center gap-2 transition-all">
                  <Icon name="upload" className="w-4 h-4 text-app-emerald" />
                  <span>Importar Backup (JSON)</span>
                  <input type="file" accept=".json,application/json" onChange={handleImportBackupJSON} className="hidden" />
                </label>
                <button onClick={exportBackupJSON} className="px-4 py-2.5 bg-app-surface border border-app-border hover:border-app-emerald text-app-text font-bold text-xs rounded-xl shadow-card flex items-center gap-2">
                  <Icon name="download" className="w-4 h-4 text-app-emerald" /> Exportar Backup (JSON)
                </button>
                <button onClick={triggerPing} className="px-4 py-2.5 bg-app-navy text-white font-bold text-xs rounded-xl shadow-card flex items-center gap-2">
                  <Icon name="activity" className="w-4 h-4" /> Ping Keep-Alive
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: GRABADORA & DESGRABADOR VERBATIM ── */}
        {activeTab === 'grabadora' && (
          <GrabadoraDesgrabadorView
            materias={materias}
            selectedMateriaId={selectedMateriaId}
            clases={clases}
            presetData={recorderPresetData}
            showToast={showToast}
            onSaveApunte={handleSaveApunte}
            onOpenApunteModal={(apunteData) => setModalApunte({ open: true, data: apunteData })}
            onLinkToClase={handleLinkTranscriptToClass}
          />
        )}

        {/* ── TAB: SISTEMA ── */}
        {activeTab === 'system' && (
          <div className="space-y-6 animate-fade-in max-w-3xl">
            <h2 className="text-2xl font-extrabold flex items-center gap-2 text-app-text">
              <Icon name="database" className="w-6 h-6 text-app-emerald" size={24} /> Sistema & Sincronización en la Nube
            </h2>

            {/* Panel de Métricas de Datos Locales */}
            <div className="bg-app-card border border-app-border p-5 rounded-2xl shadow-card space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-extrabold text-app-text flex items-center gap-2">
                  <Icon name="layers" className="w-4 h-4 text-app-emerald" /> Inventario de Datos Locales en Memoria / IndexedDB
                </h3>
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold flex items-center gap-1.5 ${isOnline ? 'bg-app-emerald-bg text-app-emerald border border-app-emerald/30' : 'bg-app-ruby-bg text-app-ruby border border-app-ruby/30'}`}>
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-app-emerald' : 'bg-app-ruby'}`}></span>
                  {isOnline ? 'Conectado a Internet' : 'Sin Conexión'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Materias', count: materias.length, icon: 'book' },
                  { label: 'Bibliografía', count: biblio.length, icon: 'book-open' },
                  { label: 'Clases', count: clases.length, icon: 'presentation' },
                  { label: 'Apuntes', count: apuntes.length, icon: 'file-edit' },
                  { label: 'Documentos PDF', count: pdfs.length, icon: 'file-text' },
                  { label: 'Exámenes', count: examenes.length, icon: 'calendar-check' }
                ].map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-app-surface border border-app-border flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-app-muted">
                      <Icon name={item.icon} className="w-4 h-4 text-app-emerald" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-sm font-black text-app-text font-mono">{item.count}</span>
                  </div>
                ))}
              </div>

              {/* Botón Principal de Carga a Supabase */}
              <div className="pt-2 border-t border-app-border flex flex-wrap gap-3">
                <button
                  onClick={syncAllLocalDataToCloud}
                  disabled={isSyncingAll}
                  className="flex-1 py-3 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50"
                >
                  <Icon name={isSyncingAll ? "refresh-cw" : "cloud-upload"} className={`w-4 h-4 ${isSyncingAll ? 'animate-spin' : ''}`} />
                  {isSyncingAll ? 'Sincronizando todos los registros...' : 'Subir Todos los Datos Locales a Supabase'}
                </button>

                <button
                  onClick={processSyncQueue}
                  disabled={syncQueue.length === 0}
                  className="px-4 py-3 bg-app-surface border border-app-border hover:border-app-emerald font-bold text-xs rounded-xl flex items-center gap-2 text-app-text disabled:opacity-50"
                >
                  <Icon name="refresh-cw" className="w-4 h-4 text-app-emerald" />
                  <span>Sincronizar Cola ({syncQueue.length})</span>
                </button>
              </div>

              {/* Resumen del último resultado */}
              {syncStatusSummary && (
                <div className="p-3.5 rounded-xl bg-app-emerald-bg border border-app-emerald/30 text-xs text-app-text space-y-1.5 animate-fade-in">
                  <div className="font-extrabold text-app-emerald flex items-center gap-1.5">
                    <Icon name="check-circle-2" className="w-4 h-4 text-app-emerald" />
                    Último resultado de sincronización:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono font-bold text-app-muted">
                    <span>Materias: {syncStatusSummary.materias}</span>
                    <span>Lecturas: {syncStatusSummary.bibliografia}</span>
                    <span>Clases: {syncStatusSummary.clases}</span>
                    <span>Apuntes: {syncStatusSummary.apuntes}</span>
                    <span>PDFs: {syncStatusSummary.documentos_pdf}</span>
                    <span>Exámenes: {syncStatusSummary.examenes}</span>
                  </div>
                  {syncStatusSummary.errors && syncStatusSummary.errors.length > 0 && (
                    <div className="pt-2 text-app-ruby text-[11px]">
                      Advertencias: {syncStatusSummary.errors.join(' • ')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Credenciales y Diagnóstico */}
            <div className="bg-app-card border border-app-border p-5 rounded-2xl shadow-card space-y-4">
              <h3 className="text-base font-extrabold text-app-text flex items-center gap-2">
                <Icon name="key" className="w-4 h-4 text-app-emerald" /> Configuración de Supabase
              </h3>
              <div>
                <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Project URL</label>
                <input value={SUPABASE_CONFIG.url} readOnly className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-xs text-app-muted outline-none font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Anon Public Key</label>
                <input value={SUPABASE_CONFIG.key} readOnly type="password" className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-xs text-app-muted outline-none font-mono" />
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={triggerPing} className="px-4 py-2.5 bg-app-navy text-white font-bold text-xs rounded-xl shadow-card flex items-center gap-2">
                  <Icon name="activity" className="w-4 h-4" /> Ping de Prueba
                </button>
                <label className="px-4 py-2.5 bg-app-surface border border-app-border hover:border-app-emerald text-app-text font-bold text-xs rounded-xl cursor-pointer shadow-card flex items-center gap-2 transition-all">
                  <Icon name="upload" className="w-4 h-4 text-app-emerald" />
                  <span>Importar Backup (JSON)</span>
                  <input type="file" accept=".json,application/json" onChange={handleImportBackupJSON} className="hidden" />
                </label>
                <button onClick={exportBackupJSON} className="px-4 py-2.5 bg-app-surface border border-app-border hover:border-app-emerald text-app-text font-bold text-xs rounded-xl shadow-card flex items-center gap-2">
                  <Icon name="download" className="w-4 h-4 text-app-emerald" /> Exportar Backup (JSON)
                </button>
                <button
                  onClick={() => checkForUpdates(true)}
                  disabled={checkingUpdate}
                  className="px-4 py-2.5 bg-app-card border border-app-border hover:border-app-emerald text-app-text font-bold text-xs rounded-xl flex items-center gap-2"
                >
                  <Icon name="sparkles" className={`w-4 h-4 text-app-emerald ${checkingUpdate ? 'animate-spin' : ''}`} />
                  Buscar Actualizaciones
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ══ MODALS ══ */}
      {modalMateria.open && (
        <ModalMateria
          initialData={modalMateria.data}
          onClose={() => setModalMateria({ open: false, data: null })}
          onSave={handleSaveMateria}
        />
      )}

      {modalBiblio.open && (
        <ModalBiblio
          initialData={modalBiblio.data}
          onClose={() => setModalBiblio({ open: false, data: null })}
          onSave={handleSaveBiblio}
        />
      )}

      {modalBiblioBatch && (
        <ModalBiblioBatchImport
          onClose={() => setModalBiblioBatch(false)}
          onImport={handleBatchImportBiblio}
        />
      )}

      {modalClase.open && (
        <ModalClase
          initialData={modalClase.data}
          onClose={() => setModalClase({ open: false, data: null })}
          onSave={handleSaveClase}
          showToast={showToast}
          onOpenInDesgrabador={handleOpenClassInRecorder}
          onStartRecordingForClass={handleOpenClassInRecorder}
        />
      )}

      {modalApunte.open && (
        <ModalApunteSplitView
          initialData={modalApunte.data}
          materiaNombre={currentMateria?.nombre || ''}
          materias={materias}
          initialMateriaId={modalApunte.data?.materia_id || selectedMateriaId || (globalMateriaFilter !== 'todas' ? globalMateriaFilter : null)}
          availableUnits={currentMateriaUnits}
          showToast={showToast}
          onClose={() => setModalApunte({ open: false, data: null })}
          onSave={handleSaveApunte}
        />
      )}

      {(modalUploadPDF?.open || modalUploadApuntePDF?.open) && (
        <ModalSubirDocumentoPDF
          isOpen={true}
          initialMateriaId={(modalUploadPDF?.materiaId || modalUploadApuntePDF?.materiaId) || selectedMateriaId}
          materias={materias}
          showToast={showToast}
          onClose={() => {
            setModalUploadPDF({ open: false, materiaId: null });
          }}
          onSave={handleSaveDocumentoPDF}
        />
      )}

      {modalExamen.open && (
        <ModalExamenWithLinking
          initialData={modalExamen.data}
          availableTexts={currentMateriaTexts}
          availableUnits={currentMateriaUnits}
          onClose={() => setModalExamen({ open: false, data: null })}
          onSave={handleSaveExamen}
        />
      )}

      {modalPDFViewer.open && (
        <ModalPDFViewer
          data={modalPDFViewer.data}
          onClose={() => setModalPDFViewer({ open: false, data: null })}
          onDelete={handleDeleteDocumentoPDF}
          showToast={showToast}
        />
      )}

      {modalSearch && (
        <ModalSearch
          materias={materias}
          biblio={biblio}
          clases={clases}
          apuntes={apuntes}
          examenes={examenes}
          onClose={() => setModalSearch(false)}
          onSelectMateria={(id) => { setSelectedMateriaId(id); setActiveTab('materias'); setModalSearch(false); }}
        />
      )}

      {modalPomodoro && (
        <ModalPomodoro
          onClose={() => setModalPomodoro(false)}
          showToast={showToast}
        />
      )}

      {modalFlashcards.open && (
        <ModalFlashcards
          title={modalFlashcards.title}
          items={modalFlashcards.items}
          onClose={() => setModalFlashcards({ open: false, items: [], title: '' })}
        />
      )}

      {modalMoreMenu && (
        <ModalMoreMenu
          onClose={() => setModalMoreMenu(false)}
          onNavigate={(tab) => {
            setActiveTab(tab);
            setModalMoreMenu(false);
          }}
          onOpenPomodoro={() => {
            setModalMoreMenu(false);
            setModalPomodoro(true);
          }}
          onOpenSearch={() => {
            setModalMoreMenu(false);
            setModalSearch(true);
          }}
          onOpenFlashcards={() => {
            setModalMoreMenu(false);
            setModalFlashcards({
              open: true,
              items: [...biblio, ...apuntes],
              title: 'Repaso Rápido de Todo el Cursado'
            });
          }}
        />
      )}

      {/* ══ TOAST NOTIFICATION ══ */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 pointer-events-none ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="bg-app-card border border-app-emerald text-app-text px-6 py-3 rounded-md shadow-fluffy flex items-center gap-2.5 text-sm font-bold">
          <Icon name={toast.iconName} className="w-4 h-4 text-app-emerald" />
          <span>{toast.msg}</span>
        </div>
      </div>
    </div>
  );
}

// ── 5. DETAILED MODAL COMPONENTS ──

function ModalMoreMenu({ onClose, onNavigate, onOpenPomodoro, onOpenSearch, onOpenFlashcards }) {
  const options = [
    {
      id: 'grabadora',
      title: '🎙️ Grabadora & Desgrabador DSP',
      desc: 'Grabación de clases, filtrado acústico y transcripción palabra por palabra',
      icon: 'mic',
      action: () => onNavigate('grabadora'),
      badge: 'DSP + IA'
    },
    {
      id: 'pdf',
      title: 'Ingestión PDF & OCR',
      desc: 'Escanea textos, procesa documentos y genera prompts',
      icon: 'file-search',
      action: () => onNavigate('pdf'),
      badge: 'OCR IA'
    },
    {
      id: 'perfil',
      title: 'Mi Perfil & Materias',
      desc: 'Administración de cátedras, configuración y datos',
      icon: 'user-check',
      action: () => onNavigate('perfil')
    },
    {
      id: 'system',
      title: 'Sistema & Sincronización',
      desc: 'Estado de conexión, IndexedDB, Supabase y caché',
      icon: 'database',
      action: () => onNavigate('system')
    },
    {
      id: 'pomodoro',
      title: 'Temporizador Pomodoro',
      desc: 'Sesiones de estudio enfocadas de 25 minutos',
      icon: 'timer',
      action: onOpenPomodoro
    },
    {
      id: 'search',
      title: 'Búsqueda Global',
      desc: 'Encuentra cualquier lectura, apunte o clase al instante',
      icon: 'search',
      action: onOpenSearch
    },
    {
      id: 'flashcards',
      title: 'Fichas de Repaso',
      desc: 'Modo examen interactivo con todos los conceptos',
      icon: 'sparkles',
      action: onOpenFlashcards
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-0 md:items-center md:p-4 animate-fade-in">
      <div className="bg-app-modal border border-app-border w-full max-w-lg rounded-t-3xl md:rounded-xl p-5 shadow-fluffy space-y-4">
        <div className="flex justify-between items-center border-b border-app-border pb-3">
          <div className="flex items-center gap-2">
            <Icon name="grid" className="w-5 h-5 text-app-emerald" />
            <h3 className="text-base font-extrabold text-app-text">Módulos & Herramientas Adicionales</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-app-muted hover:text-app-text rounded-xl bg-app-surface border border-app-border">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[70vh] overflow-y-auto">
          {options.map(opt => (
            <div
              key={opt.id}
              onClick={opt.action}
              className="bg-app-surface border border-app-border hover:border-app-emerald p-3.5 rounded-lg flex items-start gap-3 cursor-pointer transition-all hover:bg-app-card"
            >
              <div className="p-2 rounded-xl bg-app-card border border-app-border text-app-emerald mt-0.5">
                <Icon name={opt.icon} className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <h4 className="text-xs font-extrabold text-app-text truncate">{opt.title}</h4>
                  {opt.badge && (
                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/20">
                      {opt.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-app-muted line-clamp-2 mt-0.5 leading-snug">{opt.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModalMateria({ initialData, onClose, onSave }) {
  const [form, setForm] = useState(() => {
    if (initialData) {
      let evals = Array.isArray(initialData.evaluaciones) && initialData.evaluaciones.length > 0
        ? [...initialData.evaluaciones]
        : [];

      // Migrar campos heredados si no existían en el array
      if (evals.length === 0) {
        if (initialData.fecha_parcial1 || initialData.temas_parcial1) {
          evals.push({
            id: 'eval_p1_' + Date.now(),
            tipo: '1° Parcial',
            nombre: 'Primer Parcial',
            fecha: initialData.fecha_parcial1 || '',
            modalidad: initialData.modalidad_parcial || 'Presencial Escrito',
            temario: initialData.temas_parcial1 || ''
          });
        }
        if (initialData.fecha_parcial2 || initialData.temas_parcial2) {
          evals.push({
            id: 'eval_p2_' + (Date.now() + 1),
            tipo: '2° Parcial',
            nombre: 'Segundo Parcial',
            fecha: initialData.fecha_parcial2 || '',
            modalidad: initialData.modalidad_parcial || 'Presencial Escrito',
            temario: initialData.temas_parcial2 || ''
          });
        }
        if (initialData.fecha_final || initialData.temas_final) {
          evals.push({
            id: 'eval_fin_' + (Date.now() + 2),
            tipo: 'Examen Final',
            nombre: 'Examen Final',
            fecha: initialData.fecha_final || '',
            modalidad: 'Presencial Oral/Escrito',
            temario: initialData.temas_final || ''
          });
        }
      }

      return {
        ...initialData,
        evaluaciones: evals
      };
    }

    return {
      nombre: '', abreviatura: '', docente: '', color: '#10B981',
      año_cursado: 2026, cuatrimestre: 2, descripcion: '',
      link_programa: '', link_drive: '',
      evaluaciones: []
    };
  });

  const handleAddEvaluacion = (tipoPreset) => {
    const id = 'eval_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    let nombre = tipoPreset;
    if (tipoPreset === 'Personalizado') nombre = 'Nueva Instancia Evaluativa';
    const newEval = {
      id,
      tipo: tipoPreset === 'Personalizado' ? 'Evaluación' : tipoPreset,
      nombre,
      fecha: '',
      modalidad: 'Presencial Escrito',
      temario: ''
    };
    setForm(prev => ({
      ...prev,
      evaluaciones: [...(prev.evaluaciones || []), newEval]
    }));
  };

  const handleUpdateEvaluacion = (index, field, value) => {
    setForm(prev => {
      const next = [...(prev.evaluaciones || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, evaluaciones: next };
    });
  };

  const handleRemoveEvaluacion = (index) => {
    setForm(prev => ({
      ...prev,
      evaluaciones: (prev.evaluaciones || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const evals = form.evaluaciones || [];
    const p1 = evals.find(e => e.tipo === '1° Parcial' || e.nombre?.includes('1°'));
    const p2 = evals.find(e => e.tipo === '2° Parcial' || e.nombre?.includes('2°'));
    const fin = evals.find(e => e.tipo === 'Examen Final' || e.nombre?.toLowerCase().includes('final'));

    const payload = {
      ...form,
      fecha_parcial1: p1 ? p1.fecha : (form.fecha_parcial1 || ''),
      temas_parcial1: p1 ? p1.temario : (form.temas_parcial1 || ''),
      fecha_parcial2: p2 ? p2.fecha : (form.fecha_parcial2 || ''),
      temas_parcial2: p2 ? p2.temario : (form.temas_parcial2 || ''),
      fecha_final: fin ? fin.fecha : (form.fecha_final || ''),
      temas_final: fin ? fin.temario : (form.temas_final || '')
    };
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-xl p-4 sm:p-6 shadow-fluffy space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-extrabold text-app-text">{initialData ? 'Editar Materia' : 'Nueva Materia'}</h3>
          <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text flex items-center justify-center">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Nombre</label>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" placeholder="Psicología de la Personalidad" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Sigla / Abreviatura</label>
              <input value={form.abreviatura} onChange={e => setForm({ ...form, abreviatura: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" placeholder="PERSO" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Docente / Cátedra</label>
              <input value={form.docente} onChange={e => setForm({ ...form, docente: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" placeholder="Titular y equipo docente..." />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Cuatrimestre</label>
              <select value={form.cuatrimestre} onChange={e => setForm({ ...form, cuatrimestre: parseInt(e.target.value) })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none">
                <option value="1">1° Cuatrimestre</option>
                <option value="2">2° Cuatrimestre</option>
                <option value="0">Anual</option>
              </select>
            </div>
          </div>

          {/* ── SECCIÓN DINÁMICA DE EVALUACIONES ── */}
          <div className="border-t border-app-border pt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-black uppercase text-app-emerald">
                  Evaluaciones & Exámenes ({form.evaluaciones?.length || 0})
                </label>
                <p className="text-[11px] text-app-muted">
                  Agrega libremente parciales (1, 2, 3), recuperatorios o TPs evaluativos.
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  onChange={e => {
                    if (!e.target.value) return;
                    handleAddEvaluacion(e.target.value);
                    e.target.value = '';
                  }}
                  className="text-xs font-bold py-1.5 px-3 rounded-xl bg-app-surface border border-app-border text-app-emerald outline-none hover:border-app-emerald cursor-pointer"
                  defaultValue=""
                >
                  <option value="" disabled>+ Agregar Instancia...</option>
                  <option value="1° Parcial">+ 1° Parcial</option>
                  <option value="2° Parcial">+ 2° Parcial</option>
                  <option value="3° Parcial">+ 3° Parcial</option>
                  <option value="Recuperatorio 1° Parcial">+ Recuperatorio 1° Parcial</option>
                  <option value="Recuperatorio 2° Parcial">+ Recuperatorio 2° Parcial</option>
                  <option value="Recuperatorio 3° Parcial">+ Recuperatorio 3° Parcial</option>
                  <option value="TP Evaluativo">+ TP Evaluativo</option>
                  <option value="Examen Final">+ Examen Final</option>
                  <option value="Personalizado">+ Personalizado...</option>
                </select>
              </div>
            </div>

            {(!form.evaluaciones || form.evaluaciones.length === 0) ? (
              <div className="p-4 rounded-xl bg-app-surface border border-dashed border-app-border text-center space-y-2">
                <p className="text-xs text-app-muted font-bold">No hay evaluaciones configuradas. Agrega una rápidamente:</p>
                <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                  {[
                    '1° Parcial',
                    '2° Parcial',
                    '3° Parcial',
                    'Recuperatorio 1° Parcial',
                    'TP Evaluativo'
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddEvaluacion(preset)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-app-card border border-app-border hover:border-app-emerald hover:text-app-emerald text-app-text transition-all"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {form.evaluaciones.map((ev, idx) => (
                  <div key={ev.id || idx} className="p-3.5 rounded-xl bg-app-surface border border-app-border space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <select
                          value={ev.tipo}
                          onChange={e => handleUpdateEvaluacion(idx, 'tipo', e.target.value)}
                          className="text-[11px] font-extrabold uppercase px-2.5 py-1 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/30 outline-none"
                        >
                          <option value="1° Parcial">1° Parcial</option>
                          <option value="2° Parcial">2° Parcial</option>
                          <option value="3° Parcial">3° Parcial</option>
                          <option value="Recuperatorio 1° Parcial">Recuperatorio 1° Parcial</option>
                          <option value="Recuperatorio 2° Parcial">Recuperatorio 2° Parcial</option>
                          <option value="Recuperatorio 3° Parcial">Recuperatorio 3° Parcial</option>
                          <option value="TP Evaluativo">TP Evaluativo</option>
                          <option value="Examen Final">Examen Final</option>
                          <option value="Evaluación">Personalizado</option>
                        </select>
                        <input
                          value={ev.nombre}
                          onChange={e => handleUpdateEvaluacion(idx, 'nombre', e.target.value)}
                          placeholder="Nombre de la evaluación"
                          className="flex-1 p-2 rounded-lg bg-app-card border border-app-border text-xs font-bold text-app-text outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEvaluacion(idx)}
                        className="p-1.5 text-app-ruby hover:bg-app-ruby-bg rounded-lg border border-transparent hover:border-app-ruby/20 transition-all"
                        title="Eliminar esta evaluación"
                      >
                        <Icon name="trash-2" className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-app-emerald mb-1">Fecha</label>
                        <input
                          type="date"
                          value={ev.fecha || ''}
                          onChange={e => handleUpdateEvaluacion(idx, 'fecha', e.target.value)}
                          className="w-full p-2 rounded-lg bg-app-card border border-app-border text-xs font-bold text-app-text outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-app-emerald mb-1">Modalidad</label>
                        <select
                          value={ev.modalidad || 'Presencial Escrito'}
                          onChange={e => handleUpdateEvaluacion(idx, 'modalidad', e.target.value)}
                          className="w-full p-2 rounded-lg bg-app-card border border-app-border text-xs font-bold text-app-text outline-none"
                        >
                          <option value="Presencial Escrito">Presencial Escrito</option>
                          <option value="Trabajo Domiciliario">Trabajo Domiciliario</option>
                          <option value="Oral">Oral</option>
                          <option value="Multiple Choice">Multiple Choice</option>
                          <option value="Práctico Evaluativo">Práctico Evaluativo</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-app-emerald mb-1">Temario / Contenidos a evaluar</label>
                      <textarea
                        value={ev.temario || ''}
                        onChange={e => handleUpdateEvaluacion(idx, 'temario', e.target.value)}
                        placeholder="Unidades, textos y autores evaluados..."
                        className="w-full p-2 rounded-lg bg-app-card border border-app-border text-xs text-app-text outline-none h-16 leading-relaxed"
                      />
                    </div>
                  </div>
                ))}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleAddEvaluacion('Evaluación')}
                    className="text-xs font-bold text-app-emerald hover:underline flex items-center gap-1"
                  >
                    <Icon name="plus" className="w-3.5 h-3.5" /> Agregar otra evaluación
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-app-border pt-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Link Programa</label>
              <input type="url" value={form.link_programa || ''} onChange={e => setForm({ ...form, link_programa: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm text-app-text outline-none" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Link Carpeta Drive</label>
              <input type="url" value={form.link_drive || ''} onChange={e => setForm({ ...form, link_drive: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm text-app-text outline-none" placeholder="https://drive..." />
            </div>
          </div>

          <button type="submit" className="w-full py-3.5 bg-app-emerald text-white font-bold rounded-xl shadow-emerald hover:brightness-110 flex items-center justify-center gap-2">
            <Icon name="check-circle" className="w-4 h-4 text-white" /> Guardar Materia
          </button>
        </form>
      </div>
    </div>
  );
}

function ModalBiblio({ initialData, onClose, onSave }) {
  const [form, setForm] = useState(initialData || {
    unidad: 'Unidad 1', nro_texto: 1, titulo_texto: '', autores: '',
    caracter: 'Obligatorio', estado: 'Pendiente', tipo_clase: 'Teórica', va_parcial: false, link_resumen: '', notas: ''
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-xl p-4 shadow-fluffy space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-extrabold text-app-text">{initialData ? 'Editar Texto' : 'Nuevo Texto'}</h3>
          <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text flex items-center justify-center">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Unidad</label>
              <input value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Carácter</label>
              <select value={form.caracter || 'Obligatorio'} onChange={e => setForm({ ...form, caracter: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none">
                <option value="Obligatorio">Obligatorio</option>
                <option value="Optativo">Optativo / Ampliatorio</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Título del Texto</label>
            <input value={form.titulo_texto} onChange={e => setForm({ ...form, titulo_texto: e.target.value })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Autores</label>
            <input value={form.autores} onChange={e => setForm({ ...form, autores: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" placeholder="Apellido, Nombre" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Estado de Lectura</label>
              <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none">
                <option value="Pendiente">Pendiente</option>
                <option value="Leído">Leído</option>
                <option value="Resumiendo">Resumiendo</option>
                <option value="Salteado">Salteado</option>
                <option value="No va">No va</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Link Resumen</label>
              <input type="url" value={form.link_resumen || ''} onChange={e => setForm({ ...form, link_resumen: e.target.value })} placeholder="https://docs..." className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-xs text-app-text outline-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="bibVaParcial" checked={form.va_parcial} onChange={e => setForm({ ...form, va_parcial: e.target.checked })} className="w-5 h-5 accent-emerald-500 rounded" />
            <label htmlFor="bibVaParcial" className="text-sm font-bold text-app-amber cursor-pointer">Texto Evaluado en Parcial</label>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Notas y Conceptos Clave</label>
            <textarea value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm text-app-text outline-none h-20" />
          </div>

          <button type="submit" className="w-full py-3.5 bg-app-emerald text-white font-bold rounded-xl shadow-emerald hover:brightness-110">
            Guardar Texto
          </button>
        </form>
      </div>
    </div>
  );
}

// ── BATCH IMPORT MODAL (ESTUDIO-APP STRUCTURED FORMAT) ──
function ModalBiblioBatchImport({ onClose, onImport }) {
  const [rawText, setRawText] = useState(`Unidad 1 | 1 | Curso de Lingüística General | Saussure, F. | Obligatorio
Unidad 1 | 2 | La Ciencia de la Semiótica | Peirce, C. S. | Obligatorio
Unidad 2 | 3 | La Semiosis Social | Verón, E. | Obligatorio
Unidad 2 | 4 | El Orden del Discurso | Foucault, M. | Optativo`);

  const handleProcess = () => {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsed = lines.map((line, idx) => {
      const parts = line.split('|').map(p => p.trim());
      return {
        unidad: parts[0] || 'Unidad 1',
        nro_texto: parseInt(parts[1]) || (idx + 1),
        titulo_texto: parts[2] || parts[0] || 'Texto sin título',
        autores: parts[3] || '',
        caracter: parts[4] && parts[4].toLowerCase().includes('opt') ? 'Optativo' : 'Obligatorio',
        estado: 'Pendiente',
        va_parcial: true,
        link_resumen: '',
        notas: ''
      };
    });

    if (parsed.length === 0) {
      alert('Ingresa al menos una línea válida');
      return;
    }
    onImport(parsed);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-2xl rounded-xl p-4 shadow-fluffy space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-extrabold text-app-text">Carga Rápida de Programa / Bibliografía</h3>
            <p className="text-xs text-app-muted">Pega tu lista de textos con formato separado por barras: <code>Unidad | Nº | Título | Autor | Obligatorio/Optativo</code></p>
          </div>
          <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text flex items-center justify-center">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <textarea
          value={rawText}
          onChange={e => setRawText(e.target.value)}
          className="w-full h-60 p-4 rounded-lg bg-app-surface border border-app-border text-xs font-mono text-app-text outline-none leading-relaxed"
          placeholder="Unidad 1 | 1 | Título del Texto | Autor | Obligatorio"
        />

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-app-surface border border-app-border font-bold text-xs rounded-xl">Cancelar</button>
          <button type="button" onClick={handleProcess} className="flex-1 py-3 bg-app-emerald text-white font-bold text-xs rounded-xl shadow-emerald hover:brightness-110">
            Importar Textos a la Materia
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EXAM CREATION & LINKING MODAL ──
function ModalExamenWithLinking({ initialData, availableTexts, availableUnits, onClose, onSave }) {
  const [form, setForm] = useState(initialData || {
    nombre: '',
    tipo: 'Parcial 1',
    fecha: new Date().toISOString().split('T')[0],
    modalidad: 'Presencial Escrito',
    unidades_incluidas: availableUnits || [],
    textos_vinculados: availableTexts.map(t => t.id) || [],
    temas: ''
  });

  const toggleUnit = (unit) => {
    const current = form.unidades_incluidas || [];
    const next = current.includes(unit) ? current.filter(u => u !== unit) : [...current, unit];
    // Also auto check texts in that unit
    const textsInUnit = availableTexts.filter(t => t.unidad === unit).map(t => t.id);
    let nextTexts = [...(form.textos_vinculados || [])];
    if (current.includes(unit)) {
      nextTexts = nextTexts.filter(id => !textsInUnit.includes(id));
    } else {
      nextTexts = Array.from(new Set([...nextTexts, ...textsInUnit]));
    }
    setForm({ ...form, unidades_incluidas: next, textos_vinculados: nextTexts });
  };

  const toggleText = (textId) => {
    const current = form.textos_vinculados || [];
    const next = current.includes(textId) ? current.filter(id => id !== textId) : [...current, textId];
    setForm({ ...form, textos_vinculados: next });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-2xl max-h-[92vh] flex flex-col rounded-xl p-4 shadow-fluffy space-y-4 overflow-hidden">
        <div className="flex justify-between items-center border-b border-app-border pb-3">
          <div>
            <h3 className="text-xl font-extrabold text-app-text">{initialData ? 'Editar Examen' : 'Crear Examen & Vincular Textos'}</h3>
            <p className="text-xs text-app-muted">Define unidades evaluadas y selecciona los textos específicos.</p>
          </div>
          <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text flex items-center justify-center">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Nombre de la Evaluación</label>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" placeholder="Ej: Primer Parcial Presencial" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Instancia / Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none">
                <option value="1° Parcial">1° Parcial</option>
                <option value="2° Parcial">2° Parcial</option>
                <option value="3° Parcial">3° Parcial</option>
                <option value="Recuperatorio 1° Parcial">Recuperatorio 1° Parcial</option>
                <option value="Recuperatorio 2° Parcial">Recuperatorio 2° Parcial</option>
                <option value="Recuperatorio 3° Parcial">Recuperatorio 3° Parcial</option>
                <option value="TP Evaluativo">TP Evaluativo</option>
                <option value="Examen Final">Examen Final</option>
                <option value="Coloquio">Coloquio</option>
                <option value="Evaluación">Otra Evaluación</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Fecha del Examen</label>
              <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Modalidad</label>
              <select value={form.modalidad} onChange={e => setForm({ ...form, modalidad: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none">
                <option value="Presencial Escrito">Presencial Escrito</option>
                <option value="Trabajo Domiciliario">Trabajo Domiciliario</option>
                <option value="Oral">Examen Oral</option>
                <option value="Multiple Choice">Multiple Choice</option>
              </select>
            </div>
          </div>

          {/* Unit Checkboxes */}
          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-2">Unidades que entran a este examen</label>
            <div className="flex flex-wrap gap-2">
              {availableUnits.map(unit => {
                const isSelected = (form.unidades_incluidas || []).includes(unit);
                return (
                  <button
                    type="button"
                    key={unit}
                    onClick={() => toggleUnit(unit)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      isSelected
                        ? 'bg-app-emerald text-white border-app-emerald shadow-emerald'
                        : 'bg-app-surface border-app-border text-app-muted'
                    }`}
                  >
                    {unit}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Selection List */}
          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-2">
              Textos Vinculados ({ (form.textos_vinculados || []).length } seleccionados)
            </label>
            <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-app-surface rounded-lg border border-app-border">
              {availableTexts.map(t => {
                const isChecked = (form.textos_vinculados || []).includes(t.id);
                return (
                  <label key={t.id} className="flex items-center gap-3 p-2 rounded-xl bg-app-card border border-app-border/60 hover:border-app-emerald cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleText(t.id)}
                      className="w-4 h-4 accent-emerald-500 rounded"
                    />
                    <div className="flex-1 truncate">
                      <span className="font-extrabold text-app-emerald mr-2">{t.unidad}:</span>
                      <span className="font-bold text-app-text">{t.titulo_texto}</span>
                      <span className="text-app-muted ml-2">({t.autores || 'Autor'})</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Temario / Notas de la Cátedra</label>
            <textarea value={form.temas || ''} onChange={e => setForm({ ...form, temas: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-xs text-app-text outline-none h-16" placeholder="Puntos específicos a evaluar..." />
          </div>

          <button type="submit" className="w-full py-3.5 bg-app-emerald text-white font-bold rounded-xl shadow-emerald hover:brightness-110">
            Guardar Examen y Vincular Textos
          </button>
        </form>
      </div>
    </div>
  );
}

function ModalClase({ initialData, onClose, onSave, showToast, onOpenInDesgrabador, onStartRecordingForClass }) {
  const [form, setForm] = useState(initialData || {
    fecha: new Date().toISOString().split('T')[0],
    nro_clase: 1,
    tipo: 'Teórica',
    titulo_clase: '',
    aclaraciones: '',
    contenido_ppt: '',
    grabaciones: [],
    imagenes: [],
    link_grabacion: '',
    link_doc_resumen: ''
  });

  const [audioUrlInput, setAudioUrlInput] = useState('');
  const [audioTitleInput, setAudioTitleInput] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageCaptionInput, setImageCaptionInput] = useState('');
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const audioFileInputRef = useRef(null);
  const imageFileInputRef = useRef(null);

  // Copiar Prompt de Extracción de Diapositivas para IA
  const handleCopyDiapositivasPrompt = () => {
    const promptText = `Actúa como un transcriptor y asistente académico universitario. A continuación te adjunto las imágenes o fotografías de las diapositivas proyectadas y las notas del pizarrón de la clase.

Por favor, extrae de manera exhaustiva, fiel y textual todo el contenido de cada diapositiva o lámina, sin resumir ni omitir definiciones, esquemas, clasificaciones ni notas clave del docente.

Estructura tu respuesta exactamente con este formato para cada diapositiva:

[DIAPOSITIVA 1: Título o Tema Principal]
- Contenido textual completo, conceptos, esquemas y clasificaciones exactas.

[DIAPOSITIVA 2: Título o Tema Principal]
- Contenido textual completo... (continúa así en orden numérico con todas las diapositivas)`;

    navigator.clipboard.writeText(promptText);
    triggerHaptic('success');
    if (showToast) showToast('¡Prompt para extraer Diapositivas con IA copiado!', 'sparkles');
  };

  const handleAddAudioUrl = () => {
    if (!audioUrlInput.trim()) return;
    const currentList = form.grabaciones || [];
    const item = {
      id: Date.now(),
      url: audioUrlInput.trim(),
      title: audioTitleInput.trim() || `Audio #${currentList.length + 1}`,
      isLink: true
    };
    setForm({ ...form, grabaciones: [...currentList, item] });
    setAudioUrlInput('');
    setAudioTitleInput('');
    triggerHaptic('light');
    if (showToast) showToast('Audio agregado a la clase', 'music');
  };

  const handleAudioFilesUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingAudio(true);
    triggerHaptic('medium');

    const fileList = Array.from(files);
    let loadedCount = 0;
    const newAudios = [];

    fileList.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target.result;
        newAudios.push({
          id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          url: base64Data,
          title: file.name.replace(/\.[^/.]+$/, ''),
          sizeBytes: file.size,
          isDirectFile: true
        });
        loadedCount++;
        if (loadedCount === fileList.length) {
          setForm(prev => ({
            ...prev,
            grabaciones: [...(prev.grabaciones || []), ...newAudios]
          }));
          setIsUploadingAudio(false);
          if (showToast) showToast(`${fileList.length} audio(s) cargado(s) directamente`, 'check-circle');
        }
      };
      reader.onerror = () => {
        loadedCount++;
        if (loadedCount === fileList.length) setIsUploadingAudio(false);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveAudio = (id) => {
    setForm({ ...form, grabaciones: (form.grabaciones || []).filter(a => a.id !== id) });
    triggerHaptic('warning');
  };

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    const currentList = form.imagenes || [];
    const item = {
      id: Date.now(),
      url: imageUrlInput.trim(),
      caption: imageCaptionInput.trim() || `Foto #${currentList.length + 1}`,
      isLink: true
    };
    setForm({ ...form, imagenes: [...currentList, item] });
    setImageUrlInput('');
    setImageCaptionInput('');
    triggerHaptic('light');
    if (showToast) showToast('Foto agregada', 'image');
  };

  const handleImageFilesUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingImage(true);
    triggerHaptic('medium');

    const fileList = Array.from(files);
    let loadedCount = 0;
    const newImgs = [];

    fileList.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        newImgs.push({
          id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          url: event.target.result,
          caption: file.name.replace(/\.[^/.]+$/, ''),
          isDirectFile: true
        });
        loadedCount++;
        if (loadedCount === fileList.length) {
          setForm(prev => ({
            ...prev,
            imagenes: [...(prev.imagenes || []), ...newImgs]
          }));
          setIsUploadingImage(false);
          if (showToast) showToast(`${fileList.length} imagen(es) subida(s) desde el dispositivo`, 'check-circle');
        }
      };
      reader.onerror = () => {
        loadedCount++;
        if (loadedCount === fileList.length) setIsUploadingImage(false);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (id) => {
    setForm({ ...form, imagenes: (form.imagenes || []).filter(img => img.id !== id) });
    triggerHaptic('warning');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-app-modal border border-app-border w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl p-5 sm:p-6 shadow-fluffy space-y-4 overflow-hidden">
        {/* Modal Header */}
        <div className="flex justify-between items-center border-b border-app-border pb-3">
          <div>
            <h3 className="text-xl font-black text-app-text">
              {initialData ? 'Editar Protocolo de Clase' : 'Registrar Protocolo de Clase'}
            </h3>
            <p className="text-xs text-app-muted">Audios grabados, fotos de pizarrón, diapositivas y énfasis de examen.</p>
          </div>
          <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text rounded-xl border border-transparent hover:border-app-border">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">N° Clase</label>
              <input type="number" value={form.nro_clase} onChange={e => setForm({ ...form, nro_clase: parseInt(e.target.value) || 1 })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Tipo de Clase</label>
              <select value={form.tipo || 'Teórica'} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none">
                <option value="Teórica">Teórica</option>
                <option value="Práctica">Práctica</option>
                <option value="Teórico-Práctica">Teórico-Práctica</option>
                <option value="Taller">Taller</option>
                <option value="Seminario">Seminario</option>
                <option value="Consulta / Repaso">Consulta / Repaso</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Tema Principal / Título de la Clase</label>
            <input value={form.titulo_clase} onChange={e => setForm({ ...form, titulo_clase: e.target.value })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" placeholder="Ej: Introducción a la Semiosis y Modelos Triádicos" />
          </div>

          {/* Énfasis y Aclaraciones del Docente */}
          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1 flex items-center gap-1.5">
              <Icon name="alert-triangle" className="w-4 h-4 text-app-amber" /> Énfasis y Aclaraciones del Docente (Para el Parcial)
            </label>
            <textarea value={form.aclaraciones || ''} onChange={e => setForm({ ...form, aclaraciones: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-xs text-app-text outline-none h-24 leading-relaxed" placeholder="Conceptos en los que el profesor hizo hincapié, preguntas tentativas de parcial, autores no evaluados..." />
          </div>

          {/* Diapositivas / Contenido de Pizarra con Prompt IA */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <label className="text-xs font-bold uppercase text-app-emerald flex items-center gap-1.5">
                <Icon name="presentation" className="w-4 h-4 text-app-navy" /> Contenido de Diapositivas / Notas de Pizarrón
              </label>
              <button
                type="button"
                onClick={handleCopyDiapositivasPrompt}
                className="px-3 py-1.5 rounded-xl bg-app-navy text-white text-xs font-bold flex items-center gap-1.5 shadow-sm hover:brightness-110 transition-all"
                title="Copia el prompt para pasárselo a la IA junto con las fotos de las diapositivas"
              >
                <Icon name="sparkles" className="w-3.5 h-3.5 text-white" /> Copiar Prompt IA Diapositivas
              </button>
            </div>
            <textarea
              value={form.contenido_ppt || ''}
              onChange={e => setForm({ ...form, contenido_ppt: e.target.value })}
              className="w-full p-3.5 rounded-xl bg-app-surface border border-app-border text-xs text-app-text outline-none h-28 font-mono leading-relaxed"
              placeholder="Pega aquí el texto exacto extraído de las diapositivas con el formato [DIAPOSITIVA N: Tema]..."
            />
          </div>

          {/* ── SECCIÓN DE AUDIOS (SUBIDA DIRECTA + ENLACE + GRABADORA EN VIVO) ── */}
          <div className="bg-app-surface p-4 rounded-xl border border-app-border space-y-3 shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <label className="text-xs font-bold uppercase text-app-emerald flex items-center gap-1.5">
                <Icon name="mic" className="w-4 h-4 text-app-navy" /> Grabaciones de Audio de la Clase ({(form.grabaciones || []).length})
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {onStartRecordingForClass && (
                  <button
                    type="button"
                    onClick={() => onStartRecordingForClass(form)}
                    className="px-3 py-1.5 bg-app-ruby-bg text-app-ruby font-bold text-xs rounded-xl border border-app-ruby/30 flex items-center gap-1.5 hover:bg-app-ruby hover:text-white transition-all shadow-sm"
                  >
                    <Icon name="mic" className="w-3.5 h-3.5 animate-pulse" />
                    <span>Grabar en Vivo</span>
                  </button>
                )}
                <label className="cursor-pointer px-3.5 py-1.5 bg-app-navy text-white font-bold text-xs rounded-xl shadow-card flex items-center gap-1.5 hover:brightness-110 transition-all">
                  <Icon name={isUploadingAudio ? "refresh-cw" : "upload"} className={`w-3.5 h-3.5 ${isUploadingAudio ? 'animate-spin' : ''}`} />
                  <span>{isUploadingAudio ? "Cargando..." : "Subir Archivo"}</span>
                  <input
                    type="file"
                    ref={audioFileInputRef}
                    accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.opus,.webm"
                    multiple
                    className="hidden"
                    onChange={handleAudioFilesUpload}
                  />
                </label>
              </div>
            </div>

            {/* Inserción por URL / Enlace */}
            <div className="flex gap-2">
              <input
                value={audioTitleInput}
                onChange={e => setAudioTitleInput(e.target.value)}
                placeholder="Título del audio (ej: Grabación Parte 1)"
                className="w-1/3 p-2.5 rounded-xl bg-app-card border border-app-border text-xs text-app-text outline-none"
              />
              <input
                value={audioUrlInput}
                onChange={e => setAudioUrlInput(e.target.value)}
                placeholder="O pega link URL (Drive / Grabadora)"
                className="flex-1 p-2.5 rounded-xl bg-app-card border border-app-border text-xs text-app-text outline-none"
              />
              <button
                type="button"
                onClick={handleAddAudioUrl}
                className="px-4 py-2.5 bg-app-card border border-app-border hover:border-app-navy text-app-navy text-xs font-bold rounded-xl flex items-center gap-1"
              >
                <Icon name="plus" className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>

            {/* Listado y Reproductor de Audios con Desgrabador Verbatim */}
            {(form.grabaciones || []).length > 0 && (
              <div className="space-y-2 pt-1">
                {(form.grabaciones || []).map(a => (
                  <div key={a.id} className="p-3 rounded-xl bg-app-card border border-app-border space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <div className="w-7 h-7 rounded-lg bg-app-navy-bg text-app-navy flex items-center justify-center shrink-0">
                          <Icon name="music" className="w-4 h-4" />
                        </div>
                        <span className="font-extrabold text-xs text-app-text truncate">{a.title}</span>
                        {a.isDirectFile && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-app-emerald-bg text-app-emerald">
                            Archivo Local
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {onOpenInDesgrabador && (
                          <button
                            type="button"
                            onClick={() => onOpenInDesgrabador(form, a)}
                            className="px-2.5 py-1 bg-app-emerald-bg border border-app-emerald/30 text-app-emerald text-[11px] font-bold rounded-lg hover:bg-app-emerald hover:text-white flex items-center gap-1 transition-all"
                            title="Abrir este audio en la grabadora y desgrabador Verbatim"
                          >
                            <Icon name="mic" className="w-3 h-3" /> Desgrabar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveAudio(a.id)}
                          className="p-1.5 text-app-ruby hover:bg-app-ruby-bg rounded-lg border border-transparent hover:border-app-ruby/30"
                          title="Eliminar audio"
                        >
                          <Icon name="trash-2" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Audio Player nativo */}
                    {a.url && (
                      <audio
                        controls
                        src={a.url}
                        className="w-full h-8 rounded-lg bg-app-surface border border-app-border"
                        preload="metadata"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── SECCIÓN DE FOTOS / PIZARRÓN (SUBIDA DIRECTA MULTIPLE + LINK) ── */}
          <div className="bg-app-surface p-4 rounded-xl border border-app-border space-y-3 shadow-sm">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <label className="text-xs font-bold uppercase text-app-emerald flex items-center gap-1.5">
                <Icon name="camera" className="w-4 h-4 text-app-emerald" /> Fotos de Pizarra / Diapositivas ({(form.imagenes || []).length})
              </label>
              <label className="cursor-pointer px-3.5 py-1.5 bg-app-emerald-bg text-app-emerald font-bold text-xs rounded-xl border border-app-emerald/30 flex items-center gap-1.5 hover:brightness-110 transition-all">
                <Icon name={isUploadingImage ? "refresh-cw" : "upload"} className={`w-3.5 h-3.5 ${isUploadingImage ? 'animate-spin' : ''}`} />
                <span>{isUploadingImage ? "Subiendo fotos..." : "Subir desde Cámara / Galería"}</span>
                <input
                  type="file"
                  ref={imageFileInputRef}
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageFilesUpload}
                />
              </label>
            </div>

            {/* Inserción por URL */}
            <div className="flex gap-2">
              <input
                value={imageCaptionInput}
                onChange={e => setImageCaptionInput(e.target.value)}
                placeholder="Descripción (ej: Esquema en pizarra)"
                className="w-1/3 p-2.5 rounded-xl bg-app-card border border-app-border text-xs text-app-text outline-none"
              />
              <input
                value={imageUrlInput}
                onChange={e => setImageUrlInput(e.target.value)}
                placeholder="O pega link URL de la foto"
                className="flex-1 p-2.5 rounded-xl bg-app-card border border-app-border text-xs text-app-text outline-none"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="px-4 py-2.5 bg-app-card border border-app-border hover:border-app-emerald text-app-emerald text-xs font-bold rounded-xl flex items-center gap-1"
              >
                <Icon name="plus" className="w-3.5 h-3.5" /> Añadir
              </button>
            </div>

            {/* Grid de Fotos */}
            {(form.imagenes || []).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                {(form.imagenes || []).map(img => (
                  <div key={img.id} className="relative rounded-xl overflow-hidden border border-app-border group bg-black/50">
                    <img src={img.url} alt={img.caption} className="w-full h-28 object-cover group-hover:scale-105 transition-transform" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/75 backdrop-blur-sm text-white text-[10px] p-1 truncate text-center font-bold">
                      {img.caption}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/80 text-white rounded-lg hover:bg-app-ruby transition-colors"
                      title="Eliminar foto"
                    >
                      <Icon name="x" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-app-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-muted hover:text-app-text font-bold text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-app-emerald text-white font-extrabold text-xs shadow-emerald hover:brightness-110 flex items-center gap-2"
            >
              <Icon name="check" className="w-4 h-4 text-white" /> Guardar Protocolo de Clase
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ── 4.8 MODAL APUNTE / GUÍA DE ESTUDIO SPLIT-VIEW CON GENERADOR PDF ──
function ModalApunteSplitView({
  initialData = null,
  materiaNombre = '',
  materias = [],
  initialMateriaId = null,
  availableUnits = [],
  showToast = () => {},
  onClose = () => {},
  onSave = () => {}
}) {
  const [form, setForm] = useState(() => ({
    id: initialData?.id || null,
    materia_id: initialData?.materia_id || initialMateriaId || (materias?.[0]?.id || null),
    titulo: initialData?.titulo || '',
    unidad: initialData?.unidad || (availableUnits?.[0] || 'Unidad 1'),
    tipo: initialData?.tipo || 'Resumen',
    va_parcial: Boolean(initialData?.va_parcial),
    nro_parcial: initialData?.nro_parcial || '1° Parcial',
    contenido: initialData?.contenido || '',
    pdfData: initialData?.pdfData || null,
    pdfName: initialData?.pdfName || null,
    created_at: initialData?.created_at || new Date().toISOString()
  }));

  const [activeViewTab, setActiveViewTab] = useState('editor'); // 'editor' | 'preview' | 'pdf'
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [compiledPDF, setCompiledPDF] = useState(null);
  const textareaRef = useRef(null);

  const unitsList = useMemo(() => {
    const std = ['Unidad 1', 'Unidad 2', 'Unidad 3', 'Unidad 4', 'Unidad 5', 'Unidad 6', 'Unidad 7', 'Unidad 8'];
    const combined = Array.from(new Set([...(availableUnits || []), ...std]));
    return combined;
  }, [availableUnits]);

  // Detección automática de variables de imagen / prompts en el contenido Markdown
  const pendingImagePrompts = useMemo(() => {
    if (!form.contenido) return [];
    const regex = /\[(?:IMAGEN_PROMPT|imagen_prompt|imagen|grafico|figura)\s*(\d*):?\s*([^\]]+)\]/gi;
    const items = [];
    let match;
    let fallbackIdx = 1;
    while ((match = regex.exec(form.contenido)) !== null) {
      items.push({
        rawMatch: match[0],
        num: match[1] || String(fallbackIdx++),
        promptText: match[2].trim()
      });
    }
    return items;
  }, [form.contenido]);

  // Reemplazar variable de prompt por imagen en base64
  const handleReplacePromptWithImage = (rawMatch, file, promptText) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      const cleanDesc = (promptText || 'Gráfico Conceptual').replace(/[\r\n]+/g, ' ').trim();
      const replacement = `\n\n![${cleanDesc}](${base64})\n\n`;
      const newContent = form.contenido.replace(rawMatch, replacement);
      setForm(prev => ({ ...prev, contenido: newContent }));
      if (showToast) showToast('¡Imagen insertada y variable reemplazada con éxito!', 'check-circle');
      triggerHaptic('success');
    };
    reader.readAsDataURL(file);
  };

  const handleCopyPrompt = (promptText, num) => {
    navigator.clipboard.writeText(promptText).then(() => {
      if (showToast) showToast(`Prompt #${num} copiado al portapapeles. Pégalo en Gemini.`, 'copy');
      triggerHaptic('light');
    }).catch(() => {
      if (showToast) showToast('No se pudo copiar el prompt', 'alert-circle');
    });
  };

  // Autocompletar título si comienza con # Encabezado y soportar pegado directo de imágenes
  const handleContentChange = (val) => {
    let updated = { ...form, contenido: val };
    if (!form.titulo.trim()) {
      const extracted = extractAcademicTitle(val);
      if (extracted) updated.titulo = extracted;
    }
    setForm(updated);
  };

  const handlePaste = (e) => {
    // Intercepción de imágenes pegadas desde el portapapeles (Ctrl + V)
    const items = e.clipboardData?.items;
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob && pendingImagePrompts.length > 0) {
            e.preventDefault();
            const targetPrompt = pendingImagePrompts[0];
            handleReplacePromptWithImage(targetPrompt.rawMatch, blob, targetPrompt.promptText);
            return;
          }
        }
      }
    }
    const text = e.clipboardData?.getData('text');
    if (text && !form.titulo.trim()) {
      const extracted = extractAcademicTitle(text);
      if (extracted) {
        setForm(prev => ({ ...prev, titulo: extracted }));
      }
    }
  };

  const insertSyntax = (before, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = form.contenido || '';
    const selected = current.substring(start, end);
    const replacement = before + selected + after;
    const newContent = current.substring(0, start) + replacement + current.substring(end);
    setForm(prev => ({ ...prev, contenido: newContent }));
    triggerHaptic('light');

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 50);
  };

  const handleInsertTemplate = () => {
    const cleanTit = form.titulo || 'TÍTULO DEL TEXTO ACADÉMICO';
    const template = `# ${cleanTit}\n\n## Introducción\nEl presente texto aborda de manera sistemática...\n\n## Primer Núcleo Temático\nExplicación fiel, desarrollada y extensa de cada punto conceptual...\n\n• Concepto clave de primer nivel.\n  ◦ Subclasificación o matiz teórico específico.\n\n[imagen 1: Esquema de articulación conceptual]\n`;
    setForm(prev => ({ ...prev, contenido: (prev.contenido ? prev.contenido + '\n\n' : '') + template }));
    triggerHaptic('light');
    if (showToast) showToast('Plantilla académica insertada', 'sparkles');
  };

  const handleCompilePDF = async (forDownload = false, twoColumns = false) => {
    if (!form.contenido.trim() && !form.pdfData) {
      if (showToast) showToast('Escribe o pega contenido Markdown para compilar el PDF', 'alert-triangle');
      return;
    }
    setIsGeneratingPDF(true);
    triggerHaptic('medium');
    try {
      const selectedMat = materias.find(m => m.id === form.materia_id);
      const activeMateriaName = selectedMat?.nombre || materiaNombre || 'Cátedra';

      if (form.pdfData) {
        await downloadPDFHelper({
          pdfData: form.pdfData,
          fileName: form.pdfName || `${activeMateriaName} - ${form.titulo}.pdf`,
          twoColumns,
          showToast
        });
      } else {
        const result = await generateAcademicPDFBlob({
          materia: activeMateriaName,
          unidad: form.unidad,
          titulo: form.titulo || 'Apunte Académico',
          contenido: form.contenido
        });

        if (forDownload) {
          if (twoColumns) {
            const bookletBlob = await convertPDFToTwoColumns(result.blob);
            const bookletUrl = URL.createObjectURL(bookletBlob);
            const a = document.createElement('a');
            a.href = bookletUrl;
            a.download = `${activeMateriaName} - ${form.titulo || 'Apunte'} (2_Pags_Hoja).pdf`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(bookletUrl), 10000);
            if (showToast) showToast('Descargando cuadernillo de 2 páginas...', 'book-open');
          } else {
            const a = document.createElement('a');
            a.href = result.blobUrl;
            a.download = result.fileName;
            a.click();
            if (showToast) showToast('Descargando PDF A4...', 'download');
          }
        } else {
          setCompiledPDF(result);
          setActiveViewTab('pdf');
          if (showToast) showToast(`PDF generado (${result.pageCount} páginas)`, 'check-circle');
        }
      }
    } catch (e) {
      console.error('Error al generar PDF:', e);
      if (showToast) showToast(`Error al compilar PDF: ${e.message}`, 'alert-circle');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!form.titulo.trim()) {
      if (showToast) showToast('Por favor ingresa un título para el apunte', 'alert-triangle');
      return;
    }
    triggerHaptic('success');
    const selectedMat = materias.find(m => m.id === form.materia_id);
    onSave({
      ...form,
      materia_id: form.materia_id || (materias[0]?.id || null),
      materia: selectedMat ? selectedMat.nombre : (materiaNombre || 'General')
    });
  };

  const currentDisplayMateria = materias.find(m => m.id === form.materia_id)?.nombre || materiaNombre || 'Cátedra';

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-app-modal border border-app-border w-full max-w-6xl h-full max-h-[94vh] flex flex-col rounded-2xl shadow-fluffy overflow-hidden">
        
        {/* Header Modal */}
        <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 border-b border-app-border bg-app-surface gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-app-emerald-bg text-app-emerald flex items-center justify-center border border-app-emerald/20">
              <Icon name="file-text" className="w-4 h-4 text-app-emerald" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-app-text">
                {form.id ? 'Editar Guía / Apunte de Estudio' : 'Nuevo Apunte Académico'}
              </h3>
              <span className="text-[11px] text-app-muted font-bold">
                {currentDisplayMateria} • {form.unidad}
              </span>
            </div>
          </div>

          {/* View Tab Selectors */}
          <div className="flex items-center gap-1 bg-app-card p-1 rounded-xl border border-app-border text-xs">
            <button
              type="button"
              onClick={() => setActiveViewTab('editor')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeViewTab === 'editor'
                  ? 'bg-app-emerald text-white shadow-emerald'
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              <Icon name="edit-3" className="w-3.5 h-3.5" />
              <span>Editor Markdown</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveViewTab('preview')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeViewTab === 'preview'
                  ? 'bg-app-emerald text-white shadow-emerald'
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              <Icon name="eye" className="w-3.5 h-3.5" />
              <span>Vista Previa</span>
            </button>
            <button
              type="button"
              onClick={() => handleCompilePDF(false)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeViewTab === 'pdf'
                  ? 'bg-app-navy text-white shadow-card'
                  : 'text-app-muted hover:text-app-text'
              }`}
            >
              <Icon name="book-open" className="w-3.5 h-3.5" />
              <span>PDF Hoja Doble</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-app-muted hover:text-app-text rounded-xl bg-app-card border border-app-border"
              title="Cerrar modal"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Top Form Controls Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-app-card border-b border-app-border grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          <div className="sm:col-span-5">
            <input
              type="text"
              value={form.titulo}
              onChange={e => setForm({ ...form, titulo: e.target.value })}
              placeholder="Título del Apunte (ej: WISC-IV - Consignas y Baremo)"
              className="w-full p-2.5 rounded-xl bg-app-surface border border-app-border text-xs sm:text-sm font-black text-app-text outline-none focus:border-app-emerald"
              required
            />
          </div>
          <div className="sm:col-span-3">
            <select
              value={form.materia_id || (materias[0]?.id || '')}
              onChange={e => {
                const targetMat = materias.find(m => m.id === e.target.value);
                setForm({ ...form, materia_id: e.target.value, materia: targetMat?.nombre || '' });
              }}
              className="w-full p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold text-app-text outline-none focus:border-app-emerald"
            >
              {materias.map(m => (
                <option key={m.id} value={m.id}>{m.abreviatura || m.nombre}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <select
              value={form.unidad}
              onChange={e => setForm({ ...form, unidad: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold text-app-text outline-none focus:border-app-emerald"
            >
              {unitsList.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <select
              value={form.tipo}
              onChange={e => setForm({ ...form, tipo: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold text-app-text outline-none focus:border-app-emerald"
            >
              <option value="Resumen">Resumen</option>
              <option value="Guía de Cátedra">Guía de Cátedra</option>
              <option value="Mapa Conceptual">Mapa Conceptual</option>
              <option value="Fichas de Examen">Fichas de Examen</option>
              <option value="Notas de Clase">Notas de Clase</option>
            </select>
          </div>
        </div>

        {/* Tab 1: Split-View Editor & Preview */}
        {activeViewTab === 'editor' && (
          <div className="flex-1 flex flex-col overflow-hidden p-3 sm:p-4 space-y-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 rounded-xl bg-app-surface border border-app-border text-xs font-bold">
              <div className="flex flex-wrap items-center gap-1">
                <button type="button" onClick={() => insertSyntax('**', '**')} className="px-2.5 py-1 rounded-lg bg-app-card border border-app-border hover:border-app-emerald text-app-text font-black" title="Negrita">B</button>
                <button type="button" onClick={() => insertSyntax('*', '*')} className="px-2.5 py-1 rounded-lg bg-app-card border border-app-border hover:border-app-emerald text-app-text italic" title="Cursiva">I</button>
                <button type="button" onClick={() => insertSyntax('# ')} className="px-2 py-1 rounded-lg bg-app-card border border-app-border hover:border-app-emerald text-app-text font-extrabold" title="Título H1">H1</button>
                <button type="button" onClick={() => insertSyntax('## ')} className="px-2 py-1 rounded-lg bg-app-card border border-app-border hover:border-app-emerald text-app-text font-bold" title="Título H2">H2</button>
                <button type="button" onClick={() => insertSyntax('### ')} className="px-2 py-1 rounded-lg bg-app-card border border-app-border hover:border-app-emerald text-app-text" title="Título H3">H3</button>
                <span className="w-px h-4 bg-app-border mx-1"></span>
                <button type="button" onClick={() => insertSyntax('• ')} className="px-2.5 py-1 rounded-lg bg-app-card border border-app-border hover:border-app-emerald text-app-text" title="Viñeta">Lista •</button>
                <button type="button" onClick={() => insertSyntax('  ◦ ')} className="px-2.5 py-1 rounded-lg bg-app-card border border-app-border hover:border-app-emerald text-app-text" title="Subviñeta">Sublista ◦</button>
                <button type="button" onClick={() => insertSyntax('> ')} className="px-2.5 py-1 rounded-lg bg-app-card border border-app-border hover:border-app-emerald text-app-text" title="Cita textual">Cita &gt;</button>
                <button type="button" onClick={() => insertSyntax('$', '$')} className="px-2 py-1 rounded-lg bg-app-card border border-app-border hover:border-app-navy text-app-navy font-mono" title="LaTeX inline">$f(x)$</button>
                <button type="button" onClick={() => insertSyntax('$$\n', '\n$$')} className="px-2 py-1 rounded-lg bg-app-card border border-app-border hover:border-app-navy text-app-navy font-mono" title="LaTeX display">$$...$$</button>
                <span className="w-px h-4 bg-app-border mx-1"></span>
                <button type="button" onClick={() => insertSyntax('[IMAGEN_PROMPT 1: "Describe aquí el diagrama o gráfico conceptual a generar..."]')} className="px-2.5 py-1 rounded-lg bg-app-card border border-amber-500/40 hover:border-amber-500 text-amber-500 text-[11px] font-extrabold flex items-center gap-1" title="Insertar variable de imagen con prompt para IA">
                  <Icon name="image" className="w-3.5 h-3.5 text-amber-500" /> + Prompt Imagen
                </button>
              </div>

              <button
                type="button"
                onClick={handleInsertTemplate}
                className="px-3 py-1 bg-app-emerald-bg text-app-emerald font-extrabold text-[11px] rounded-lg border border-app-emerald/30 hover:brightness-110 flex items-center gap-1"
              >
                <Icon name="sparkles" className="w-3.5 h-3.5 text-app-emerald" /> Plantilla IA
              </button>
            </div>

            {/* Panel Interactivo: Imágenes Solicitadas / Prompts para Gemini */}
            {pendingImagePrompts.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 animate-fade-in shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                    <span className="text-xs font-black text-amber-500 uppercase tracking-wide flex items-center gap-1.5">
                      <Icon name="image" className="w-3.5 h-3.5 text-amber-500" />
                      {pendingImagePrompts.length === 1 ? '1 Imagen / Gráfico Requerido en este Apunte' : `${pendingImagePrompts.length} Imágenes / Gráficos Requeridos en este Apunte`}
                    </span>
                  </div>
                  <span className="text-[11px] text-app-muted font-medium">
                    Copia el prompt, genera la imagen en Gemini y súbela aquí (o pega con Ctrl+V) para reemplazar la variable automáticamente.
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {pendingImagePrompts.map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-app-surface border border-app-border flex flex-col justify-between gap-2 shadow-sm">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-500">
                            Imagen #{item.num}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPrompt(item.promptText, item.num)}
                            className="px-2 py-1 rounded bg-app-card hover:bg-app-emerald-bg hover:text-app-emerald border border-app-border text-[11px] font-extrabold flex items-center gap-1 transition-all"
                            title="Copiar prompt para Gemini"
                          >
                            <Icon name="copy" className="w-3 h-3" /> Copiar Prompt
                          </button>
                        </div>
                        <p className="text-[11px] text-app-text font-mono line-clamp-2 bg-app-card p-1.5 rounded border border-app-border/40 select-all" title={item.promptText}>
                          {item.promptText}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-app-border/50">
                        <label className="cursor-pointer px-2.5 py-1 rounded-md bg-app-emerald text-white text-[11px] font-extrabold flex items-center gap-1.5 hover:brightness-110 shadow-emerald transition-all">
                          <Icon name="upload" className="w-3 h-3 text-white" />
                          <span>Subir Imagen</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleReplacePromptWithImage(item.rawMatch, file, item.promptText);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Side-by-Side Editor & Live Preview */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-hidden min-h-0">
              <div className="flex flex-col h-full overflow-hidden">
                <textarea
                  ref={textareaRef}
                  value={form.contenido}
                  onPaste={handlePaste}
                  onChange={e => handleContentChange(e.target.value)}
                  placeholder="Pega o redacta aquí el apunte en Markdown (compatible con KaTeX math, tablas y formato académico)..."
                  className="w-full flex-1 p-4 rounded-xl bg-app-surface border border-app-border text-xs sm:text-sm text-app-text outline-none font-mono resize-none leading-relaxed overflow-y-auto focus:border-app-emerald"
                />
              </div>

              <div className="hidden md:flex flex-col h-full bg-app-card border border-app-border rounded-xl p-4 overflow-y-auto">
                <div className="text-[10px] uppercase font-black tracking-wider text-app-emerald mb-2 flex items-center gap-1">
                  <Icon name="eye" className="w-3 h-3" /> Vista Previa en Vivo
                </div>
                <div
                  className="flex-1 text-xs sm:text-sm text-app-text leading-relaxed overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: parseMarkdownToHTML(form.contenido) || '<span class="text-app-muted italic">La vista previa en tiempo real aparecerá aquí...</span>' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Full Preview on Mobile / Desktop */}
        {activeViewTab === 'preview' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-8 bg-app-card space-y-4">
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="border-b border-app-border pb-3">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/20">
                  {materiaNombre} • {form.unidad}
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-app-text mt-2">{form.titulo || 'Apunte sin título'}</h1>
              </div>
              <div
                className="text-xs sm:text-sm text-app-text leading-relaxed space-y-2"
                dangerouslySetInnerHTML={{ __html: parseMarkdownToHTML(form.contenido) || '<p class="text-app-muted italic">No hay contenido escrito en este apunte.</p>' }}
              />
            </div>
          </div>
        )}

        {/* Tab 3: Vector PDF Print & Booklet Mode */}
        {activeViewTab === 'pdf' && (
          <div className="flex-1 flex flex-col p-3 sm:p-4 space-y-3 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-app-surface border border-app-border rounded-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-app-muted">
                <Icon name="book-open" className="w-4 h-4 text-app-emerald" />
                <span>{compiledPDF ? `PDF compilado (${compiledPDF.pageCount} páginas)` : 'Listo para exportar'}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCompilePDF(true, false)}
                  disabled={isGeneratingPDF}
                  className="px-3.5 py-1.5 bg-app-surface border border-app-border text-app-navy hover:border-app-navy font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
                >
                  <Icon name="download" className="w-3.5 h-3.5 text-app-navy" /> ⬇ A4
                </button>
                <button
                  type="button"
                  onClick={() => handleCompilePDF(true, true)}
                  disabled={isGeneratingPDF}
                  className="px-3.5 py-1.5 bg-app-navy text-white font-extrabold text-xs rounded-xl shadow-card flex items-center gap-1.5 hover:brightness-110"
                >
                  <Icon name="book-open" className="w-3.5 h-3.5 text-white" /> 📖 2 Págs / Hoja
                </button>
              </div>
            </div>

            <div className="flex-1 w-full bg-slate-900/60 rounded-xl border border-app-border overflow-hidden flex flex-col items-center justify-center">
              {compiledPDF ? (
                <iframe
                  src={compiledPDF.blobUrl}
                  className="w-full h-full border-0 bg-white"
                  title="Visor PDF Académico"
                />
              ) : (
                <div className="p-8 text-center space-y-3 max-w-md">
                  <div className="w-12 h-12 rounded-xl bg-app-emerald-bg text-app-emerald mx-auto flex items-center justify-center border border-app-emerald/20">
                    <Icon name="file-text" className="w-6 h-6 text-app-emerald" />
                  </div>
                  <h4 className="text-sm font-black text-app-text">Generador Vectorial de PDF</h4>
                  <p className="text-xs text-app-muted">
                    Compila tu apunte en PDF de alta fidelidad con encabezados de cátedra y formato de doble columna para impresión.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCompilePDF(false)}
                    disabled={isGeneratingPDF}
                    className="px-5 py-2.5 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald hover:brightness-110 flex items-center gap-2 mx-auto"
                  >
                    <Icon name={isGeneratingPDF ? "refresh-cw" : "sparkles"} className={`w-4 h-4 ${isGeneratingPDF ? 'animate-spin' : ''}`} />
                    <span>{isGeneratingPDF ? "Generando PDF..." : "Generar Vista Previa PDF"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 border-t border-app-border bg-app-surface gap-3">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-app-amber">
              <input
                type="checkbox"
                checked={form.va_parcial}
                onChange={e => setForm({ ...form, va_parcial: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
              <span>Entra al Parcial</span>
            </label>
            {form.va_parcial && (
              <select
                value={form.nro_parcial}
                onChange={e => setForm({ ...form, nro_parcial: e.target.value })}
                className="p-1.5 rounded-lg bg-app-card border border-app-border text-[11px] font-bold text-app-text outline-none"
              >
                <option value="1° Parcial">1° Parcial</option>
                <option value="2° Parcial">2° Parcial</option>
                <option value="3° Parcial">3° Parcial</option>
                <option value="Recuperatorio">Recuperatorio</option>
                <option value="Final">Examen Final</option>
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-app-card border border-app-border font-bold text-xs rounded-xl text-app-muted hover:text-app-text"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-6 py-2 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald hover:brightness-110 flex items-center gap-1.5"
            >
              <Icon name="check" className="w-4 h-4 text-white" />
              <span>Guardar Apunte</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── 5. MODAL: SUBIR DOCUMENTO PDF DIRECTO (SIN OCR / SIN DESTRUCTURAR) ──
function ModalSubirDocumentoPDF({
  isOpen,
  onClose,
  onSave,
  materias = [],
  initialMateriaId = null,
  showToast
}) {
  if (!isOpen) return null;

  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [materiaId, setMateriaId] = useState(initialMateriaId || (materias[0]?.id || ''));
  const [unidad, setUnidad] = useState('Unidad 1');
  const [isCustomUnidad, setIsCustomUnidad] = useState(false);
  const [customUnidad, setCustomUnidad] = useState('');
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('Resumen de Estudio');
  const [vaParcial, setVaParcial] = useState(false);
  const [instanciaParcial, setInstanciaParcial] = useState('1° Parcial');
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  const selectedMateria = materias.find(m => m.id === materiaId) || materias[0];

  const availableUnits = useMemo(() => {
    return ['Unidad 1', 'Unidad 2', 'Unidad 3', 'Unidad 4', 'Unidad 5', 'Unidad 6', 'Unidad 7', 'Unidad 8'];
  }, []);

  const availableEvaluaciones = useMemo(() => {
    const list = [];
    if (selectedMateria?.evaluaciones && selectedMateria.evaluaciones.length > 0) {
      selectedMateria.evaluaciones.forEach(ev => {
        if (ev.nombre || ev.tipo) list.push(ev.nombre || ev.tipo);
      });
    }
    const standard = ['1° Parcial', '2° Parcial', '3° Parcial', 'Recuperatorio 1° Parcial', 'Recuperatorio 2° Parcial', 'Recuperatorio 3° Parcial', 'TP Evaluativo', 'Examen Final'];
    standard.forEach(s => {
      if (!list.includes(s)) list.push(s);
    });
    return list;
  }, [selectedMateria]);

  const processFile = (selectedFile) => {
    if (!selectedFile || selectedFile.type !== 'application/pdf') {
      if (showToast) showToast('Por favor selecciona un archivo PDF válido (.pdf)', 'alert-circle');
      return;
    }
    setFile(selectedFile);
    const cleanName = selectedFile.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ').trim();
    if (!titulo) setTitulo(cleanName);

    // Auto-detect materia
    if (!initialMateriaId) {
      const match = materias.find(m =>
        selectedFile.name.toLowerCase().includes(m.nombre.toLowerCase()) ||
        (m.abreviatura && selectedFile.name.toLowerCase().includes(m.abreviatura.toLowerCase()))
      );
      if (match) setMateriaId(match.id);
    }

    // Auto-detect unit
    const unitMatch = selectedFile.name.match(/unidad\s*(\d+)/i) || selectedFile.name.match(/\bu(\d+)\b/i);
    if (unitMatch) {
      setUnidad(`Unidad ${unitMatch[1]}`);
    }

    // Conteo rápido de páginas sin OCR
    if (window.pdfjsLib) {
      const reader = new FileReader();
      reader.onload = async function() {
        try {
          const typedArray = new Uint8Array(this.result);
          const pdf = await window.pdfjsLib.getDocument({ data: typedArray }).promise;
          setPageCount(pdf.numPages);
        } catch (e) {
          setPageCount(1);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!file) {
      if (showToast) showToast('Por favor selecciona un archivo PDF para subir', 'alert-circle');
      return;
    }
    setIsSaving(true);
    triggerHaptic('medium');

    const finalUnidad = isCustomUnidad ? (customUnidad.trim() || 'Unidad 1') : unidad;
    const finalMateria = materias.find(m => m.id === materiaId) || selectedMateria;

    const reader = new FileReader();
    reader.onload = function() {
      const dataUrl = this.result;
      const docPayload = {
        id: 'pdf_' + Date.now(),
        nombre_archivo: file.name,
        titulo: titulo.trim() || file.name.replace(/\.pdf$/i, ''),
        materia_id: materiaId,
        materia: finalMateria ? finalMateria.nombre : 'General',
        unidad: finalUnidad,
        tipo,
        va_parcial: vaParcial,
        nro_parcial: vaParcial ? instanciaParcial : null,
        num_paginas: pageCount || 1,
        tamaño_bytes: file.size,
        pdfData: dataUrl,
        created_at: new Date().toISOString()
      };

      onSave(docPayload);
      setIsSaving(false);
      onClose();
    };
    reader.onerror = function() {
      setIsSaving(false);
      if (showToast) showToast('Error al leer el archivo PDF', 'alert-triangle');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-app-card border border-app-border w-full max-w-xl rounded-2xl shadow-fluffy overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-app-border bg-app-surface">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-app-emerald-bg text-app-emerald flex items-center justify-center border border-app-emerald/20">
              <Icon name="upload-cloud" className="w-5 h-5 text-app-emerald" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-app-text">Subir Archivo PDF</h3>
              <p className="text-xs text-app-muted">El archivo se guarda intacto para visualizarlo y descargarlo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-app-muted hover:text-app-text rounded-lg">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs font-sans">
          {/* Dropzone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-app-emerald bg-app-emerald-bg/20 scale-[0.99]'
                : file
                ? 'border-app-emerald/60 bg-app-emerald-bg/10'
                : 'border-app-border hover:border-app-emerald/60 hover:bg-app-surface'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) processFile(e.target.files[0]);
              }}
            />
            {file ? (
              <div className="space-y-1.5">
                <div className="w-12 h-12 rounded-xl bg-app-emerald text-white mx-auto flex items-center justify-center shadow-emerald">
                  <Icon name="file-text" className="w-6 h-6 text-white" />
                </div>
                <div className="font-extrabold text-sm text-app-text truncate max-w-sm mx-auto">{file.name}</div>
                <div className="text-[11px] text-app-muted flex items-center justify-center gap-2">
                  <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  {pageCount > 0 && <span>• {pageCount} páginas</span>}
                  <span className="text-app-emerald font-bold">• Clic para cambiar</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-xl bg-app-surface text-app-muted mx-auto flex items-center justify-center border border-app-border">
                  <Icon name="upload-cloud" className="w-6 h-6 text-app-muted" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-app-text">Arrastra tu archivo PDF aquí</div>
                  <div className="text-[11px] text-app-muted mt-0.5">o haz clic para seleccionar desde tu dispositivo</div>
                </div>
              </div>
            )}
          </div>

          {/* Materia y Unidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-app-emerald mb-1">Materia *</label>
              <select
                value={materiaId}
                onChange={e => setMateriaId(e.target.value)}
                required
                className="w-full p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold text-app-text outline-none"
              >
                {materias.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-bold uppercase text-app-emerald">Unidad *</label>
                <button
                  type="button"
                  onClick={() => setIsCustomUnidad(!isCustomUnidad)}
                  className="text-[10px] text-app-muted hover:text-app-emerald font-bold"
                >
                  {isCustomUnidad ? 'Elegir de lista' : 'Personalizada'}
                </button>
              </div>
              {isCustomUnidad ? (
                <input
                  value={customUnidad}
                  onChange={e => setCustomUnidad(e.target.value)}
                  placeholder="Ej: Unidad 2, Módulo A..."
                  className="w-full p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold text-app-text outline-none"
                />
              ) : (
                <select
                  value={unidad}
                  onChange={e => setUnidad(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold text-app-text outline-none"
                >
                  {availableUnits.map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Título del Documento */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-app-emerald mb-1">Título del Documento *</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              required
              placeholder="Ej: Resumen Unidad 2 - Freud y el Psicoanálisis"
              className="w-full p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold text-app-text outline-none"
            />
          </div>

          {/* Tipo de Documento */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-app-emerald mb-1">Tipo de Documento</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold text-app-text outline-none"
            >
              <option value="Resumen de Estudio">Resumen de Estudio</option>
              <option value="1° Parcial">1° Parcial</option>
              <option value="2° Parcial">2° Parcial</option>
              <option value="3° Parcial">3° Parcial</option>
              <option value="Recuperatorio">Recuperatorio</option>
              <option value="TP Evaluativo">TP Evaluativo</option>
              <option value="Bibliografía Oficial">Bibliografía Oficial</option>
              <option value="Otro">Otro Documento</option>
            </select>
          </div>

          {/* Evaluación / Parcial Toggle */}
          <div className="p-3 rounded-xl bg-app-surface border border-app-border space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-app-text block">¿Este archivo corresponde a un parcial o examen?</span>
                <span className="text-[11px] text-app-muted">Te ayudará a filtrarlo en el calendario de estudio.</span>
              </div>
              <input
                type="checkbox"
                checked={vaParcial}
                onChange={e => setVaParcial(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
            </div>

            {vaParcial && (
              <div className="pt-2 border-t border-app-border flex items-center gap-2">
                <label className="text-xs font-bold text-app-emerald whitespace-nowrap">Instancia:</label>
                <select
                  value={instanciaParcial}
                  onChange={e => setInstanciaParcial(e.target.value)}
                  className="flex-1 p-2 rounded-lg bg-app-card border border-app-border text-xs font-bold text-app-text outline-none"
                >
                  {availableEvaluaciones.map(evName => (
                    <option key={evName} value={evName}>{evName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end items-center gap-2 pt-3 border-t border-app-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-app-surface border border-app-border font-bold text-xs rounded-xl text-app-muted hover:text-app-text"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!file || isSaving}
              className="px-5 py-2.5 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald hover:brightness-110 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Icon name={isSaving ? "refresh-cw" : "check"} className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? "Guardando en el Sistema..." : "Guardar en el Sistema"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Alias de compatibilidad
const ModalSubirApuntePDF = ModalSubirDocumentoPDF;

// ── 6. VISOR ACADÉMICO DE PDF DE ALTA FIDELIDAD ──
function ModalPDFViewer({ data, onClose, onDelete, showToast }) {
  if (!data) return null;

  const pdfSrc = useMemo(() => {
    if (!data.pdfData) return null;
    if (typeof data.pdfData === 'string') return data.pdfData;
    if (data.pdfData instanceof Blob) return URL.createObjectURL(data.pdfData);
    return null;
  }, [data.pdfData]);

  const [isProcessing2Col, setIsProcessing2Col] = useState(false);

  const handleDownload2Col = async () => {
    if (!data.pdfData) {
      if (showToast) showToast('No hay archivo PDF para procesar', 'alert-triangle');
      return;
    }
    setIsProcessing2Col(true);
    await downloadPDFHelper({
      pdfData: data.pdfData,
      fileName: data.nombre_archivo || data.titulo,
      twoColumns: true,
      showToast
    });
    setIsProcessing2Col(false);
  };

  const handleDownloadNorm = () => {
    downloadPDFHelper({
      pdfData: data.pdfData,
      fileName: data.nombre_archivo || data.titulo,
      twoColumns: false,
      showToast
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-app-card border border-app-border w-full max-w-6xl h-[95vh] flex flex-col rounded-2xl shadow-fluffy overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center px-5 py-3.5 border-b border-app-border bg-app-surface gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/20">
                {data.materia || 'General'}
              </span>
              <span className="text-xs text-app-muted font-bold">• {data.unidad || 'Unidad 1'}</span>
              {data.num_paginas && (
                <span className="text-xs text-app-muted font-bold">• {data.num_paginas} págs</span>
              )}
              {data.va_parcial && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-app-amber-bg text-app-amber border border-app-amber/20">
                  {data.nro_parcial ? `Para ${data.nro_parcial}` : 'Para Parcial'}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-app-text mt-0.5 truncate max-w-xl">
              {data.nombre_archivo || data.titulo}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadNorm}
              className="px-3.5 py-2 bg-app-surface border border-app-border hover:border-app-navy text-app-navy font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              title="Descargar PDF original en A4 normal"
            >
              <Icon name="download" className="w-4 h-4 text-app-navy" />
              <span>⬇ Normal</span>
            </button>

            <button
              onClick={handleDownload2Col}
              disabled={isProcessing2Col}
              className="px-3.5 py-2 bg-app-navy text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 shadow-card hover:brightness-110 disabled:opacity-50 transition-all"
              title="Descargar en formato 2 páginas por hoja (apuntes imprimibles)"
            >
              <Icon name={isProcessing2Col ? "refresh-cw" : "book-open"} className={`w-4 h-4 ${isProcessing2Col ? 'animate-spin' : ''}`} />
              <span>{isProcessing2Col ? "Procesando..." : "📖 2 Págs / Hoja"}</span>
            </button>

            {onDelete && (
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar el documento "${data.nombre_archivo || data.titulo}" del sistema?`)) {
                    onDelete(data.id);
                    onClose();
                  }
                }}
                className="p-2 text-app-ruby hover:bg-app-ruby-bg rounded-xl border border-transparent hover:border-app-ruby/30"
                title="Eliminar documento del sistema"
              >
                <Icon name="trash-2" className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              className="px-3.5 py-2 bg-app-surface border border-app-border text-app-muted hover:text-app-text font-bold text-xs rounded-xl"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* PDF Viewer Body */}
        <div className="flex-1 w-full h-full bg-slate-900/60 relative overflow-hidden flex flex-col items-center justify-center">
          {pdfSrc ? (
            <iframe
              src={pdfSrc}
              className="w-full h-full border-0"
              title={data.nombre_archivo || data.titulo}
            />
          ) : (
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-app-amber-bg text-app-amber mx-auto flex items-center justify-center">
                <Icon name="file-text" className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-app-text">El archivo no contiene datos binarios para visualización directa</p>
              <p className="text-xs text-app-muted max-w-sm mx-auto">
                Puedes volver a subir el archivo PDF original para tener la vista previa interactiva completa.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── GLOBAL SEARCH MODAL ──
function ModalSearch({ materias, biblio, clases, apuntes, examenes, onClose, onSelectMateria }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const list = [];

    materias.forEach(m => {
      if (m.nombre.toLowerCase().includes(q) || (m.descripcion && m.descripcion.toLowerCase().includes(q))) {
        list.push({ type: 'Materia', title: m.nombre, sub: m.docente || m.descripcion, raw: m });
      }
    });

    biblio.forEach(b => {
      if (b.titulo_texto.toLowerCase().includes(q) || (b.autores && b.autores.toLowerCase().includes(q))) {
        list.push({ type: 'Bibliografía', title: b.titulo_texto, sub: `${b.materia} • ${b.unidad}`, raw: b });
      }
    });

    clases.forEach(c => {
      if (c.titulo_clase.toLowerCase().includes(q) || (c.aclaraciones && c.aclaraciones.toLowerCase().includes(q))) {
        list.push({ type: 'Clase', title: c.titulo_clase, sub: `${c.materia} • Clase #${c.nro_clase}`, raw: c });
      }
    });

    apuntes.forEach(a => {
      if (a.titulo.toLowerCase().includes(q) || (a.contenido && a.contenido.toLowerCase().includes(q))) {
        list.push({ type: 'Apunte', title: a.titulo, sub: `${a.materia} • ${a.tipo}`, raw: a });
      }
    });

    examenes.forEach(e => {
      if (e.nombre.toLowerCase().includes(q) || (e.temas && e.temas.toLowerCase().includes(q))) {
        list.push({ type: 'Examen', title: e.nombre, sub: `${e.materia} • ${e.tipo}`, raw: e });
      }
    });

    return list.slice(0, 15);
  }, [query, materias, biblio, clases, apuntes, examenes]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-3 pt-12 sm:pt-20">
      <div className="bg-app-modal border border-app-border w-full max-w-2xl rounded-xl p-5 shadow-fluffy space-y-4">
        <div className="flex justify-between items-center border-b border-app-border pb-3">
          <div className="flex items-center gap-2 flex-1 mr-4">
            <Icon name="search" className="w-5 h-5 text-app-emerald" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar materias, lecturas, apuntes o exámenes..."
              className="w-full bg-transparent text-base font-bold text-app-text outline-none"
            />
          </div>
          <button onClick={onClose} className="p-1.5 text-app-muted hover:text-app-text">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
          {query.trim() === '' && (
            <p className="text-xs text-app-muted text-center py-6">Escribe palabras clave para buscar en todo tu sistema académico.</p>
          )}

          {query.trim() !== '' && results.length === 0 && (
            <p className="text-xs text-app-muted text-center py-6">No se encontraron coincidencias para "{query}".</p>
          )}

          {results.map((item, idx) => (
            <div
              key={idx}
              onClick={() => {
                const matId = item.raw.materia_id || item.raw.id;
                if (matId) onSelectMateria(matId);
                onClose();
              }}
              className="p-3 rounded-lg bg-app-card border border-app-border/70 hover:border-app-emerald cursor-pointer transition-all flex items-center justify-between group"
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/20">
                  {item.type}
                </span>
                <h4 className="text-sm font-extrabold text-app-text mt-1 group-hover:text-app-emerald transition-colors">{item.title}</h4>
                <p className="text-xs text-app-muted">{item.sub}</p>
              </div>
              <Icon name="chevron-right" className="w-4 h-4 text-app-muted group-hover:text-app-emerald" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── POMODORO STUDY TIMER MODAL ──
function ModalPomodoro({ onClose, showToast }) {
  const [mode, setMode] = useState('work');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  useEffect(() => {
    let timer = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 587.33;
        osc.connect(ctx.destination);
        osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 600);
      } catch (e) {}

      if (mode === 'work') {
        showToast('¡Sesión de estudio finalizada! Hora de un descanso', 'coffee');
        setSessionsCompleted(prev => prev + 1);
        setMode('break');
        setTimeLeft(5 * 60);
      } else {
        showToast('¡Descanso terminado! Volvamos al estudio', 'zap');
        setMode('work');
        setTimeLeft(25 * 60);
      }
      setIsRunning(false);
    }
    return () => clearInterval(timer);
  }, [isRunning, timeLeft, mode]);

  const toggleTimer = () => setIsRunning(!isRunning);
  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(mode === 'work' ? 25 * 60 : 5 * 60);
  };

  const formatPomodoroTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalTime = mode === 'work' ? 25 * 60 : 5 * 60;
  const progressPct = Math.round(((totalTime - timeLeft) / totalTime) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-md rounded-xl p-4 shadow-fluffy text-center space-y-5">
        <div className="flex justify-between items-center border-b border-app-border pb-3">
          <div className="flex items-center gap-2">
            <Icon name="timer" className="w-5 h-5 text-app-amber" />
            <h3 className="text-lg font-extrabold text-app-text">Temporizador Pomodoro</h3>
          </div>
          <button onClick={onClose} className="p-1 text-app-muted hover:text-app-text">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center gap-2 p-1 bg-app-surface border border-app-border rounded-xl">
          <button
            onClick={() => { setMode('work'); setTimeLeft(25 * 60); setIsRunning(false); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'work' ? 'bg-app-emerald text-white shadow-emerald' : 'text-app-muted'}`}
          >
            Estudio (25m)
          </button>
          <button
            onClick={() => { setMode('break'); setTimeLeft(5 * 60); setIsRunning(false); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'break' ? 'bg-app-navy text-white shadow-card' : 'text-app-muted'}`}
          >
            Descanso (5m)
          </button>
        </div>

        <div className="relative py-6 bg-app-surface rounded-lg border border-app-border">
          <div className="text-5xl font-black font-mono tracking-wider text-app-text">{formatPomodoroTime(timeLeft)}</div>
          <div className="text-xs font-bold text-app-muted mt-2">
            {mode === 'work' ? 'Enfócate en tu bibliografía' : 'Tómate un respiro'}
          </div>

          <div className="w-4/5 mx-auto h-2 bg-app-border rounded-md mt-4 overflow-hidden">
            <div className="h-full bg-app-emerald transition-all duration-300" style={{ width: `${progressPct}%` }}></div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs font-bold text-app-muted px-2">
          <span>Sesiones: <strong className="text-app-emerald font-extrabold">{sessionsCompleted}</strong></span>
          <span>Tiempo estudiado: <strong className="text-app-emerald font-extrabold">{sessionsCompleted * 25} min</strong></span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={toggleTimer}
            className={`flex-1 py-3 font-extrabold text-sm rounded-xl shadow-card transition-all ${
              isRunning ? 'bg-app-ruby text-white' : 'bg-app-emerald text-white shadow-emerald'
            }`}
          >
            {isRunning ? 'Pausar' : 'Iniciar Sesión'}
          </button>
          <button
            onClick={resetTimer}
            className="px-4 py-3 bg-app-surface border border-app-border text-app-text font-bold text-sm rounded-xl hover:bg-app-card"
          >
            Reiniciar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FLASHCARDS / REPASO MODAL ──
function ModalFlashcards({ title, items, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState([]);

  if (!items || items.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-app-modal border border-app-border w-full max-w-md rounded-xl p-4 text-center space-y-4">
          <h3 className="text-lg font-extrabold text-app-text">Sin elementos para repasar</h3>
          <p className="text-xs text-app-muted">No hay textos o apuntes suficientes para generar fichas en esta vista.</p>
          <button onClick={onClose} className="py-2.5 px-6 bg-app-emerald text-white font-bold text-xs rounded-xl shadow-emerald">Cerrar</button>
        </div>
      </div>
    );
  }

  const currentItem = items[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const toggleMastered = (id) => {
    setMasteredIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const isMastered = masteredIds.includes(currentItem.id);
  const pctMastered = Math.round((masteredIds.length / items.length) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-xl rounded-xl p-4 shadow-fluffy space-y-4">
        <div className="flex justify-between items-center border-b border-app-border pb-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-app-emerald">Modo Repaso Activo</span>
            <h3 className="text-lg font-extrabold text-app-text">{title || 'Fichas de Repaso Académico'}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-app-muted hover:text-app-text">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center justify-between text-xs font-bold text-app-muted">
          <span>Ficha {currentIndex + 1} de {items.length}</span>
          <span>Dominadas: <strong className="text-app-emerald">{masteredIds.length}/{items.length} ({pctMastered}%)</strong></span>
        </div>
        <div className="w-full h-1.5 bg-app-surface rounded-full overflow-hidden">
          <div className="h-full bg-app-emerald transition-all duration-300" style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}></div>
        </div>

        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className={`relative min-h-[240px] p-4 rounded-lg border-2 transition-all cursor-pointer flex flex-col justify-between shadow-card ${
            isFlipped ? 'bg-app-surface border-app-emerald' : 'bg-app-card border-app-border hover:border-app-emerald/60'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-app-emerald bg-app-emerald-bg px-2.5 py-1 rounded-md border border-app-emerald/20">
              {isFlipped ? 'REVERSO — CONCEPTO / NOTAS' : 'FRENTE — TÍTULO / AUTOR'}
            </span>
            {isMastered && (
              <span className="text-xs font-bold text-app-emerald flex items-center gap-1">
                <Icon name="check-circle" className="w-4 h-4" /> Dominado
              </span>
            )}
          </div>

          <div className="py-6 text-center">
            {!isFlipped ? (
              <div>
                <h4 className="text-xl font-black text-app-text leading-snug mb-2">{currentItem.titulo_texto || currentItem.titulo}</h4>
                <p className="text-xs text-app-muted font-bold">{currentItem.autores || currentItem.unidad || currentItem.materia}</p>
              </div>
            ) : (
              <div className="text-left max-h-48 overflow-y-auto">
                <p className="text-sm text-app-text leading-relaxed whitespace-pre-wrap font-medium">
                  {currentItem.notas || currentItem.contenido || currentItem.texto_extraido || 'Sin notas de concepto asociadas.'}
                </p>
              </div>
            )}
          </div>

          <div className="text-center">
            <span className="text-[11px] font-bold text-app-muted italic">Toca la ficha para voltear ↺</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handlePrev}
            className="px-4 py-2.5 bg-app-surface border border-app-border rounded-xl font-bold text-xs text-app-text flex items-center gap-1 hover:bg-app-card"
          >
            <Icon name="chevron-left" className="w-4 h-4" /> Anterior
          </button>

          <button
            onClick={() => toggleMastered(currentItem.id)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs border transition-all flex items-center gap-1.5 ${
              isMastered ? 'bg-app-emerald text-white border-app-emerald' : 'bg-app-surface border-app-border text-app-muted hover:text-app-emerald'
            }`}
          >
            <Icon name="check" className="w-4 h-4" /> {isMastered ? 'Dominado' : 'Marcar Dominado'}
          </button>

          <button
            onClick={handleNext}
            className="px-4 py-2.5 bg-app-emerald text-white font-bold text-xs rounded-xl shadow-emerald flex items-center gap-1 hover:brightness-110"
          >
            Siguiente <Icon name="chevron-right" className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 5.8 GRABADORA ACADÉMICA & DESGRABADOR VERBATIM (DSP + WHISPER) ──
function GrabadoraDesgrabadorView({
  materias = [],
  selectedMateriaId = null,
  clases = [],
  presetData = null,
  showToast = () => {},
  onSaveApunte = () => {},
  onOpenApunteModal = () => {},
  onLinkToClase = () => {}
}) {
  const [activeSubTab, setActiveSubTab] = useState('record'); // 'record' | 'player' | 'history'
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('psi_audio_server_url') || 'http://localhost:8000');
  const [serverOnline, setServerOnline] = useState(null);
  const [showConfig, setShowConfig] = useState(false);

  // Máquina de estados de grabación en vivo: 'idle' | 'recording' | 'paused' | 'processing'
  const [recordingState, setRecordingState] = useState('idle');
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [targetMateriaId, setTargetMateriaId] = useState(selectedMateriaId || (materias[0]?.id || ''));
  const [targetClaseNum, setTargetClaseNum] = useState(1);
  const [temaClase, setTemaClase] = useState('');
  const [preset, setPreset] = useState('estudio_balanceado');

  // Hack Anti-Suspensión en Background para móviles (Reproducir audio silencioso)
  const silentAudioRef = useRef(null);
  useEffect(() => {
    // Un WAV vacío miniatura de 1 muestra para que el SO no suspenda el proceso del micrófono
    const silentWAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
    const audio = new Audio(silentWAV);
    audio.loop = true;
    audio.volume = 0.01;
    silentAudioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Recuperación ante recargas accidentales
  const [interruptedSession, setInterruptedSession] = useState(null);

  const [historyFilter, setHistoryFilter] = useState('');

  // Procesamiento y Jobs
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [processingError, setProcessingError] = useState(null);

  // Visor y Reproductor Dual (Apartado 4.2)
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcriptData, setTranscriptData] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [activeSegmentId, setActiveSegmentId] = useState(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  // Marcadores de momentos clave de examen
  const [bookmarks, setBookmarks] = useState([]);

  // Búsqueda interactiva no destructiva con navegación
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMatches, setSearchMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  // Historial de sesiones guardadas localmente
  const [savedSessions, setSavedSessions] = useState(() => safeGetLocalStorage('psi_audio_sessions_history', []));

  const speechRecognitionRef = useRef(null);
  const liveSegmentsRef = useRef([]);
  const recordingSecondsRef = useRef(0);

  // Mantener recordingSecondsRef sincronizado para timestamps de Web Speech API
  useEffect(() => {
    recordingSecondsRef.current = recordingSeconds;
  }, [recordingSeconds]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const wakeLockRef = useRef(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  };
  const audioRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const abortControllerRef = useRef(null);
  const transcriptContainerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  const handleTranscriptScroll = () => {
    setAutoScrollEnabled(false);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setAutoScrollEnabled(true);
    }, 5000);
  };

  // 1. Cargar datos pre-seleccionados desde la ficha de clase
  useEffect(() => {
    if (presetData) {
      if (presetData.materiaId) setTargetMateriaId(presetData.materiaId);
      if (presetData.claseNum) setTargetClaseNum(presetData.claseNum);
      if (presetData.tema) setTemaClase(presetData.tema);
      if (presetData.audioUrl) {
        setAudioUrl(presetData.audioUrl);
        setActiveSubTab('player');
        if (!transcriptData) {
          const matObj = materias.find(m => m.id === presetData.materiaId);
          const matName = matObj ? matObj.nombre : 'Clase';
          const emptyTranscript = {
            version: '2.0.0',
            subject: matName,
            duration_seconds: 0,
            total_segments: 0,
            paragraphs: [],
            segments: []
          };
          setTranscriptData(emptyTranscript);
        }
      } else if (presetData.autoStart) {
        setActiveSubTab('record');
      }
    }
  }, [presetData]);

  // 2. Protección contra cierre accidental (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (recordingState === 'recording' || recordingState === 'paused') {
        e.preventDefault();
        e.returnValue = 'Tienes una grabación de clase en curso. Si sales ahora, el audio podría perderse.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [recordingState]);

  // 3. Detección de sesión interrumpida previa
  useEffect(() => {
    try {
      const savedBackup = localStorage.getItem('psi_active_recording_backup_meta');
      if (savedBackup) {
        const parsed = JSON.parse(savedBackup);
        if (parsed && parsed.seconds > 5) {
          setInterruptedSession(parsed);
        }
      }
    } catch (e) {}
  }, []);

  // Verificar estado del servidor backend
  const checkServerStatus = async (urlToCheck = serverUrl) => {
    // El servidor de la PC solo existe cuando la web se abre en la propia PC.
    // En el sitio publicado se transcribe con Groq (función de Netlify) y no se le pregunta nada a la PC.
    const enLaPC = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (!enLaPC) { setServerOnline(false); return; }
    try {
      const res = await fetch(`${urlToCheck.replace(/\/$/, '')}/api/health`, { method: 'GET', signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const data = await res.json();
        setServerOnline(data.status === 'healthy' || data.status === 'ok');
      } else {
        setServerOnline(false);
      }
    } catch (e) {
      setServerOnline(false);
    }
  };

  useEffect(() => {
    checkServerStatus();
    const interval = setInterval(() => checkServerStatus(), 30000);
    return () => clearInterval(interval);
  }, [serverUrl]);

  // Selección defensiva de códec soportado por el navegador
  const getSupportedMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4;codecs=aac',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
    ];
    for (const t of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return '';
  };

  // Limpieza estricta de Web Audio API (evita límite de 6 AudioContexts)
  const cleanAudioContext = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (analyserRef.current) {
      try { analyserRef.current.disconnect(); } catch (e) {}
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close().catch(() => {});
        }
      } catch (e) {}
      audioContextRef.current = null;
    }
  };

  // Visualizador reactivo de ondas en Canvas
  const startCanvasWaveform = (stream) => {
    cleanAudioContext();
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const canvasCtx = canvas.getContext('2d');
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationFrameRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / bufferLength) * 2;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          canvasCtx.fillStyle = `rgba(16, 185, 129, ${0.35 + (dataArray[i] / 255) * 0.65})`;
          canvasCtx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
          x += barWidth;
        }
      };
      draw();
    } catch (e) {
      console.warn('Canvas visualizer init error:', e);
    }
  };

  // ── GRABADORA SEGMENTADA (todo va a la base; nada queda en el navegador) ──
  // Graba en fragmentos de 150 s. Cada fragmento se sube a Supabase Storage apenas se corta.
  // La grabación se registra en cargas_audio al empezar: lo ya subido queda recuperable aunque se corte.
  const SEGMENTO_MS = 150 * 1000;
  const segmentoRecorderRef = useRef(null);
  const segmentoTimerRef = useRef(null);
  const segmentoOrdenRef = useRef(0);
  const sesionGrabacionRef = useRef(null);
  const grabandoRef = useRef(false);
  const rutasRef = useRef([]);
  const subidasRef = useRef([]);

  const subirFragmentoConReintentos = async (ruta, blob, tipo) => {
    for (let intento = 1; ; intento++) {
      try {
        return await subirAudioABase(ruta, blob, tipo);
      } catch (e) {
        if (intento >= 5) throw e;
        await new Promise((r) => setTimeout(r, 3000 * intento));
      }
    }
  };

  const iniciarSegmento = (stream) => {
    const mimeType = getSupportedMimeType();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const trozos = [];
    const orden = segmentoOrdenRef.current++;
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) trozos.push(e.data); };
    rec.onstop = () => {
      const tipo = rec.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(trozos, { type: tipo });
      if (blob.size === 0) return;
      const sesionId = sesionGrabacionRef.current;
      const ext = tipo.includes('mp4') ? 'm4a' : 'webm';
      const ruta = `grabaciones/${sesionId}/${String(orden + 1).padStart(3, '0')}.${ext}`;
      const subida = subirFragmentoConReintentos(ruta, blob, tipo).then(async () => {
        rutasRef.current.push({ orden, ruta });
        await supabaseClient.from('cargas_audio').update({
          archivos: [...rutasRef.current].sort((a, b) => a.orden - b.orden).map((x) => x.ruta),
          partes_total: rutasRef.current.length,
          updated_at: new Date().toISOString(),
        }).eq('id', sesionId);
      });
      subidasRef.current.push(subida);
    };
    rec.start(1000);
    segmentoRecorderRef.current = rec;
  };

  const cortarSegmento = () => new Promise((resolve) => {
    const rec = segmentoRecorderRef.current;
    if (!rec || rec.state === 'inactive') return resolve();
    rec.addEventListener('stop', () => resolve(), { once: true });
    rec.stop();
  });

  const programarRotacion = (stream) => {
    clearTimeout(segmentoTimerRef.current);
    segmentoTimerRef.current = setTimeout(async () => {
      if (!grabandoRef.current) return;
      await cortarSegmento();
      if (!grabandoRef.current) return;
      iniciarSegmento(stream);
      programarRotacion(stream);
    }, SEGMENTO_MS);
  };

  const arrancarTimerVisible = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = setInterval(() => setRecordingSeconds(prev => prev + 1), 1000);
  };

  // Cierra la grabación: espera las subidas y deja la fila lista para que el proceso la desgrabe.
  const finalizarGrabacionEnBase = async () => {
    const sesionId = sesionGrabacionRef.current;
    if (!sesionId) return;
    const resultados = await Promise.allSettled(subidasRef.current);
    const fallidas = resultados.filter((r) => r.status === 'rejected').length;
    const archivos = [...rutasRef.current].sort((a, b) => a.orden - b.orden).map((x) => x.ruta);
    const sinAudio = archivos.length === 0;
    const { error } = await supabaseClient.from('cargas_audio').update({
      archivos,
      partes_total: archivos.length,
      estado: sinAudio ? 'error' : 'pendiente',
      error: sinAudio ? 'No se grabó audio' : (fallidas ? `${fallidas} fragmento(s) no se pudieron subir` : null),
      updated_at: new Date().toISOString(),
    }).eq('id', sesionId);
    if (error) showToast('No se pudo cerrar la grabación en la base: ' + error.message, 'alert-triangle');
    subidasRef.current = [];
    rutasRef.current = [];
    sesionGrabacionRef.current = null;
    refrescarCargas();
    avisarCargas();
  };

  const handleStartRecording = async () => {
    try {
      await requestWakeLock();
      if (silentAudioRef.current) silentAudioRef.current.play().catch(() => {});
      triggerHaptic('heavy');
      if (audioUrl && typeof audioUrl === 'string' && audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta captura de audio o requiere HTTPS.');
      }
      if (!supabaseClient) throw new Error('Sin conexión con la base: no se puede grabar sin guardar en la nube.');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const matObj = materias.find((m) => m.id === targetMateriaId);
      const sesionId = `grab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const { error } = await supabaseClient.from('cargas_audio').insert([{
        id: sesionId,
        origen: 'grabacion',
        nombre: `Grabación · ${matObj ? matObj.nombre : 'General'} · Clase ${targetClaseNum}`,
        materia_id: matObj ? matObj.id : null,
        materia: matObj ? matObj.nombre : 'General',
        clase_num: targetClaseNum,
        tema: temaClase || '',
        archivos: [],
        partes: {},
        partes_listas: 0,
        partes_total: 0,
        estado: 'grabando',
      }]);
      if (error) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error('No se pudo registrar la grabación en la base: ' + error.message);
      }

      mediaStreamRef.current = stream;
      sesionGrabacionRef.current = sesionId;
      rutasRef.current = [];
      subidasRef.current = [];
      segmentoOrdenRef.current = 0;
      grabandoRef.current = true;
      iniciarSegmento(stream);
      programarRotacion(stream);
      setRecordingState('recording');
      setRecordingSeconds(0);
      setProcessingError(null);
      startCanvasWaveform(stream);
      arrancarTimerVisible();
      showToast('Grabación de clase iniciada', 'mic');
      refrescarCargas();
    } catch (e) {
      console.error('Error al iniciar grabación:', e);
      alert('No se pudo empezar: ' + e.message);
    }
  };

  const handlePauseRecording = async () => {
    triggerHaptic('medium');
    grabandoRef.current = false;
    clearTimeout(segmentoTimerRef.current);
    await cortarSegmento();
    releaseWakeLock();
    if (silentAudioRef.current) silentAudioRef.current.pause();
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    setRecordingState('paused');
    showToast('Grabación pausada (Recreo)', 'pause');
  };

  const handleResumeRecording = async () => {
    triggerHaptic('heavy');
    await requestWakeLock();
    if (silentAudioRef.current) silentAudioRef.current.play().catch(() => {});
    const stream = mediaStreamRef.current;
    if (!stream || !stream.active) {
      showToast('El micrófono se cerró. Finalizando...', 'alert-triangle');
      return handleStopRecording(true);
    }
    grabandoRef.current = true;
    iniciarSegmento(stream);
    programarRotacion(stream);
    setRecordingState('recording');
    arrancarTimerVisible();
    showToast('Grabación reanudada', 'play');
  };

  const handleStopRecording = async (shouldProcess = true) => {
    triggerHaptic('medium');
    releaseWakeLock();
    if (silentAudioRef.current) silentAudioRef.current.pause();
    grabandoRef.current = false;
    clearTimeout(segmentoTimerRef.current);
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    setRecordingState('processing');
    await cortarSegmento();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    cleanAudioContext();
    await finalizarGrabacionEnBase();
    setRecordingState('idle');
    showToast('Clase guardada en la base. Se desgraba en segundo plano.', 'check');
  };

  // Cancelar Inferencia / Procesamiento en curso
  const handleCancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStep('');
    showToast('Procesamiento cancelado', 'x');
  };

  // Convierte un fragmento de audio a WAV 16 kHz mono 16 bits (mezcla los canales)
  const audioBufferToWav16kMono = (audioBuffer, desde, cantidad) => {
    const canales = audioBuffer.numberOfChannels;
    const muestras = new Float32Array(cantidad);
    for (let c = 0; c < canales; c++) {
      const datos = audioBuffer.getChannelData(c);
      for (let i = 0; i < cantidad; i++) muestras[i] += datos[desde + i] / canales;
    }
    const wav = new ArrayBuffer(44 + cantidad * 2);
    const vista = new DataView(wav);
    const escribir = (off, txt) => { for (let i = 0; i < txt.length; i++) vista.setUint8(off + i, txt.charCodeAt(i)); };
    escribir(0, 'RIFF'); vista.setUint32(4, 36 + cantidad * 2, true); escribir(8, 'WAVE');
    escribir(12, 'fmt '); vista.setUint32(16, 16, true); vista.setUint16(20, 1, true); vista.setUint16(22, 1, true);
    vista.setUint32(24, 16000, true); vista.setUint32(28, 32000, true); vista.setUint16(32, 2, true); vista.setUint16(34, 16, true);
    escribir(36, 'data'); vista.setUint32(40, cantidad * 2, true);
    for (let i = 0; i < cantidad; i++) {
      const v = Math.max(-1, Math.min(1, muestras[i]));
      vista.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7FFF, true);
    }
    return new Blob([wav], { type: 'audio/wav' });
  };

  // Transcribe con la función de Netlify en fragmentos de 150 s (≈4,8 MB, bajo el límite de 6 MB)
  const transcribeViaNetlify = async (audioBlob, signal, materiaName) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const decodificado = await ctx.decodeAudioData(await audioBlob.arrayBuffer());
    // Transcribir en fragmentos de 90 s (≈2,8 MB WAV), 100% seguro bajo el límite de 5,5 MB de Netlify
    const FRAGMENTO = 90 * 16000;
    const total = Math.ceil(decodificado.length / FRAGMENTO);
    const segmentos = [];
    let textoCompleto = '';
    let acumulado = 0;

    for (let i = 0; i < total; i++) {
      setProcessingStep(`Transcribiendo fragmento ${i + 1} de ${total} en la nube...`);
      const desde = i * FRAGMENTO;
      const cantidad = Math.min(FRAGMENTO, decodificado.length - desde);
      const wav = audioBufferToWav16kMono(decodificado, desde, cantidad);

      const res = await fetch('/.netlify/functions/transcribir', {
        method: 'POST',
        headers: psiApiHeaders({ 'Content-Type': 'audio/wav' }),
        body: wav,
        signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error en la transcripción en la nube (${res.status})`);

      (data.segments || []).forEach((seg) => {
        const inicio = acumulado + seg.start;
        segmentos.push({
          id: segmentos.length + 1,
          start: inicio,
          end: acumulado + seg.end,
          timestamp: formatTime(inicio),
          text: (seg.text || '').trim(),
          words: (seg.words || []).map((w) => ({ word: w.word, start: acumulado + w.start, end: acumulado + w.end })),
        });
      });
      textoCompleto += (data.text || '') + ' ';
      acumulado += data.duration || cantidad / 16000;
    }

    return {
      version: '2.0.0',
      subject: materiaName,
      duration_seconds: acumulado,
      total_segments: segmentos.length,
      paragraphs: [textoCompleto.trim()],
      segments: segmentos,
    };
  };



  // Subida HTTP de fragmento con seguimiento exacto por bytes reales y reintentos
  const uploadChunkWithProgress = async (url, formData, signal, onProgress, attempt = 1) => {
    try {
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        Object.entries(psiApiHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        
        if (signal) {
          signal.addEventListener('abort', () => {
            xhr.abort();
            reject(new Error('Subida cancelada por el usuario.'));
          });
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            const pct = (event.loaded / event.total) * 100;
            onProgress(pct, event.loaded, event.total, attempt);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              resolve({ status: 'ok' });
            }
          } else {
            try {
              const errJson = JSON.parse(xhr.responseText);
              reject(new Error(errJson.detail || errJson.message || `Error HTTP ${xhr.status}`));
            } catch (e) {
              reject(new Error(`Error HTTP ${xhr.status} al subir archivo.`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Error de red al conectar con el servidor backend.'));
        xhr.send(formData);
      });
    } catch (e) {
      if (attempt < 3 && e.message !== 'Subida cancelada por el usuario.') {
        const delay = attempt === 1 ? 1000 : 3000;
        await new Promise(r => setTimeout(r, delay));
        return uploadChunkWithProgress(url, formData, signal, onProgress, attempt + 1);
      }
      throw e;
    }
  };

  // ── CARGAS DE AUDIO (archivo subido o grabación): todo en la base ──
  // Un proceso toma las cargas pendientes de la tabla cargas_audio, lee el audio del bucket "audios",
  // desgraba por partes de 150 s y guarda cada parte en la base. Si se corta, retoma desde la última parte.
  const CARGA_PARTE_SEG = 150;
  const cargasRef = useRef({ procesando: false });
  const [cargas, setCargas] = useState([]);

  const subirAudioABase = async (ruta, blob, tipo) => {
    const { error } = await supabaseClient.storage.from('audios').upload(ruta, blob, { contentType: tipo, upsert: true });
    if (error) throw new Error('No se pudo subir el audio: ' + error.message);
    return ruta;
  };

  const urlAudioDeBase = async (ruta) => {
    const { data, error } = await supabaseClient.storage.from('audios').createSignedUrl(ruta, 3600);
    if (error || !data) throw new Error('No se pudo leer el audio: ' + (error ? error.message : 'sin URL'));
    return data.signedUrl;
  };

  const refrescarCargas = async () => {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
      .from('cargas_audio')
      .select('id,origen,nombre,materia,clase_num,estado,error,partes_listas,partes_total,apunte_id,created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (!error) setCargas(data || []);
  };

  const avisarCargas = () => window.dispatchEvent(new Event('psi-cargas'));

  const encolarCargaAudio = async (file) => {
    if (!supabaseClient) { alert('Sin conexión con la base: no se puede subir el audio.'); return; }
    const id = `carga_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const ext = ((file.name.split('.').pop() || 'audio').toLowerCase()).replace(/[^a-z0-9]/g, '') || 'audio';
    const ruta = `cargas/${id}/original.${ext}`;
    const matObj = materias.find((m) => m.id === targetMateriaId);
    try {
      showToast('Subiendo el audio a la base...', 'upload-cloud');
      await subirAudioABase(ruta, file, file.type || 'audio/mp4');
      const { error } = await supabaseClient.from('cargas_audio').insert([{
        id,
        origen: 'archivo',
        nombre: file.name,
        materia_id: matObj ? matObj.id : null,
        materia: matObj ? matObj.nombre : 'Psicología General',
        clase_num: targetClaseNum,
        tema: temaClase || '',
        archivos: [ruta],
        partes: {},
        partes_listas: 0,
        partes_total: 0,
        estado: 'pendiente',
      }]);
      if (error) throw new Error(error.message);
      showToast('Audio en la base. Se desgraba en segundo plano; podés seguir usando la app.', 'check');
    } catch (e) {
      alert('No se pudo subir el audio: ' + (e.message || e));
      return;
    }
    refrescarCargas();
    avisarCargas();
  };

  const reintentarCarga = async (id) => {
    await supabaseClient.from('cargas_audio').update({ estado: 'pendiente', error: null, updated_at: new Date().toISOString() }).eq('id', id);
    refrescarCargas();
    avisarCargas();
  };

  // Llama a la función de Netlify con reintentos. Un fallo transitorio no pierde lo ya desgrabado.
  const transcribirParte = async (cuerpo, tipo) => {
    for (let intento = 1; ; intento++) {
      try {
        const res = await fetch('/.netlify/functions/transcribir', {
          method: 'POST',
          headers: psiApiHeaders({ 'Content-Type': tipo }),
          body: cuerpo,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `respuesta ${res.status}`);
        return json;
      } catch (e) {
        if (intento >= 4) throw e;
        await new Promise((r) => setTimeout(r, 4000 * intento));
      }
    }
  };

  const tipoPorRuta = (ruta) => (ruta.endsWith('.m4a') ? 'audio/mp4' : ruta.endsWith('.wav') ? 'audio/wav' : 'audio/webm');

  // Arma la desgrabación completa a partir de las partes, con los tiempos corridos.
  const armarContenidoApunte = (carga, partes, total) => {
    const lineas = [`DESGRABACIÓN: ${carga.materia} - CLASE #${carga.clase_num}`];
    if (carga.tema) lineas.push(`Tema: ${carga.tema}`);
    lineas.push('');
    let acumulado = 0;
    for (let i = 0; i < total; i++) {
      const r = partes[i];
      if (!r) continue;
      const segs = (r.segments || []).filter((s) => (s.text || '').trim());
      if (segs.length > 0) {
        segs.forEach((seg) => lineas.push(`[${formatTime(acumulado + seg.start)}] ${seg.text.trim()}`));
      } else if ((r.text || '').trim()) {
        lineas.push(`[${formatTime(acumulado)}] ${r.text.trim()}`);
      }
      acumulado += r.duration || 0;
    }
    return { contenido: lineas.join('\n'), duracion: acumulado };
  };

  const marcar = (id, cambios) =>
    supabaseClient.from('cargas_audio').update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id);

  const procesarUnaCarga = async (carga) => {
    await marcar(carga.id, { estado: 'en_proceso', error: null });
    try {
      let decodificado = null;
      let total;
      if (carga.origen === 'archivo') {
        const blob = await (await fetch(await urlAudioDeBase(carga.archivos[0]))).blob();
        const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        decodificado = await ctx.decodeAudioData(await blob.arrayBuffer());
        try { ctx.close(); } catch (e) {}
        total = Math.ceil(decodificado.length / (CARGA_PARTE_SEG * 16000));
      } else {
        total = carga.archivos.length;
      }
      await marcar(carga.id, { partes_total: total });

      const partes = { ...(carga.partes || {}) };
      for (let i = 0; i < total; i++) {
        if (partes[i]) continue; // ya desgrabada en un intento anterior
        let cuerpo;
        let tipo;
        if (decodificado) {
          const PARTE = CARGA_PARTE_SEG * 16000;
          const desde = i * PARTE;
          const cantidad = Math.min(PARTE, decodificado.length - desde);
          cuerpo = audioBufferToWav16kMono(decodificado, desde, cantidad);
          tipo = 'audio/wav';
        } else {
          const ruta = carga.archivos[i];
          cuerpo = await (await fetch(await urlAudioDeBase(ruta))).blob();
          tipo = tipoPorRuta(ruta);
        }
        const data = await transcribirParte(cuerpo, tipo);
        partes[i] = { text: data.text || '', duration: data.duration || 0, segments: data.segments || [] };
        await marcar(carga.id, { partes, partes_listas: Object.keys(partes).length });
        refrescarCargas();
      }

      const { contenido } = armarContenidoApunte(carga, partes, total);
      const apunte = {
        id: `desgrab_${carga.id}`,
        materia_id: carga.materia_id,
        materia: carga.materia,
        unidad: 'Unidad 1',
        titulo: `Desgrabación: Clase ${carga.clase_num} - ${carga.tema || 'Audio'}`,
        tipo: 'texto',
        contenido,
        va_parcial: false,
        nro_parcial: 1,
        created_at: carga.created_at,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabaseClient.from('apuntes').upsert([apunte], { onConflict: 'id' });
      if (error) throw new Error('No se pudo guardar la desgrabación: ' + error.message);
      await marcar(carga.id, { estado: 'completada', error: null, apunte_id: apunte.id });
      showToast(`Desgrabación lista: ${carga.nombre}`, 'sparkles');
    } catch (e) {
      await marcar(carga.id, { estado: 'error', error: e.message || String(e) });
    }
  };

  const procesarCargas = async () => {
    if (cargasRef.current.procesando || !supabaseClient) return;
    cargasRef.current.procesando = true;
    try {
      for (;;) {
        if (!navigator.onLine) break;
        const { data, error } = await supabaseClient
          .from('cargas_audio')
          .select('*')
          .in('estado', ['pendiente', 'en_proceso'])
          .order('created_at', { ascending: true })
          .limit(1);
        if (error || !data || data.length === 0) break;
        await procesarUnaCarga(data[0]);
        refrescarCargas();
      }
    } catch (e) {
      console.warn('Proceso de cargas detenido:', e);
    } finally {
      cargasRef.current.procesando = false;
      refrescarCargas();
    }
  };

  useEffect(() => {
    refrescarCargas();
    procesarCargas();
    const despertar = () => { procesarCargas(); };
    window.addEventListener('psi-cargas', despertar);
    window.addEventListener('online', despertar);
    return () => {
      window.removeEventListener('psi-cargas', despertar);
      window.removeEventListener('online', despertar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Procesar Audio con Pipeline Multicapa (Telemetría Real, sin progresos simulados)
  const processAudioWithBackend = async (audioBlobOrFile, filename = 'clase.m4a') => {
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStep('Iniciando pipeline de transcripción...');
    setProcessingError(null);

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const targetMatObj = materias.find(m => m.id === targetMateriaId);
    const materiaName = targetMatObj ? targetMatObj.nombre : 'Psicología General';
    const cleanServerUrl = serverUrl.replace(/\/$/, '');

    try {
      if (serverOnline) {
        // ── MOTOR 1: SERVIDOR LOCAL FASTAPI (TELEMETRÍA REAL EN TIEMPO REAL) ──
        const sessionId = `web_${Date.now()}`;

        setProcessingStep('Creando sesión en servidor DSP local...');
        const createRes = await fetch(`${cleanServerUrl}/api/sessions/create`, {
          method: 'POST',
          headers: psiApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            session_id: sessionId,
            materia: materiaName,
            clase_numero: targetClaseNum,
            tema: temaClase || 'Clase Teórica',
          }),
          signal,
        });
        if (!createRes.ok) throw new Error('Fallo al crear sesión remota.');

        setProcessingStep('Subiendo audio al servidor...');
        const formData = new FormData();
        formData.append('file', audioBlobOrFile, filename);

        await uploadChunkWithProgress(
          `${cleanServerUrl}/api/sessions/${sessionId}/upload-chunk`,
          formData,
          signal,
          (pct, loaded, total, attempt = 1) => {
            const loadedMB = (loaded / (1024 * 1024)).toFixed(1);
            const totalMB = (total / (1024 * 1024)).toFixed(1);
            const realPct = Math.round((pct / 100) * 20); // 0% a 20%
            setProcessingProgress(realPct);
            const retryStr = attempt > 1 ? ` (Reintentando ${attempt}/3)` : '';
            setProcessingStep(`Subiendo audio${retryStr} (${loadedMB} MB / ${totalMB} MB - ${pct.toFixed(0)}%)...`);
          }
        );

        setProcessingProgress(20);
        setProcessingStep('Iniciando procesamiento acústico e inferencia...');
        const procRes = await fetch(`${cleanServerUrl}/api/sessions/${sessionId}/process`, {
          method: 'POST',
          headers: psiApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            preset,
            apply_dsp: true,
            transcribe: true,
          }),
          signal,
        });
        if (!procRes.ok) throw new Error('Error al iniciar procesamiento de audio.');
        const procData = await procRes.json();
        const jobId = procData.job_id;

        let completed = false;
        let pollCount = 0;

        while (!completed && pollCount < 7200) {
          if (signal.aborted) throw new Error('Procesamiento cancelado por el usuario.');
          
          let waitTime = 1000;
          if (pollCount > 60) waitTime = 3000;
          if (pollCount > 120) waitTime = 5000;
          
          await new Promise(r => setTimeout(r, waitTime));
          pollCount++;

          const jobRes = await fetch(`${cleanServerUrl}/api/jobs/${jobId}`, { signal, headers: psiApiHeaders() });
          if (jobRes.ok) {
            const jobData = await jobRes.json();
            const serverPct = jobData.progress_pct || 0;
            const realPct = Math.min(99, Math.max(20, Math.round(20 + serverPct * 0.79)));
            setProcessingProgress(realPct);
            setProcessingStep(jobData.step_detail || jobData.step || 'Procesando con Faster-Whisper...');

            if (jobData.status === 'completed') {
              completed = true;
              break;
            } else if (jobData.status === 'failed') {
              throw new Error(jobData.error || 'Fallo en la inferencia de audio.');
            }
          }
        }

        setProcessingProgress(100);
        setProcessingStep('Recuperando desgrabación verbatim...');
        const transcriptRes = await fetch(`${cleanServerUrl}/api/sessions/${sessionId}/transcript`, { signal, headers: psiApiHeaders() });
        if (!transcriptRes.ok) throw new Error('No se pudo recuperar la desgrabación generada.');
        const transcriptJson = await transcriptRes.json();

        setAudioUrl(`${cleanServerUrl}/api/sessions/${sessionId}/audio?token=${encodeURIComponent(localStorage.getItem('psi_api_token') || '')}`);
        setTranscriptData(transcriptJson);
        saveSessionToHistory(sessionId, materiaName, targetClaseNum, temaClase, transcriptJson, `${cleanServerUrl}/api/sessions/${sessionId}/audio?token=${encodeURIComponent(localStorage.getItem('psi_api_token') || '')}`);
      } else if (!serverOnline) {
        // ── MOTOR 2: FUNCIÓN DE NETLIFY (GROQ, la key vive en Netlify) ──
        setProcessingProgress(50);
        setProcessingStep('Transcribiendo en la nube...');
        const cloudTranscript = await transcribeViaNetlify(audioBlobOrFile, signal, materiaName);
        setTranscriptData(cloudTranscript);
        saveSessionToHistory(`cloud_${Date.now()}`, materiaName, targetClaseNum, temaClase, cloudTranscript, audioUrl);
      } else if (liveSegmentsRef.current && liveSegmentsRef.current.length > 0) {
        // ── MOTOR 3: TRANSCRIPCIÓN EN VIVO DEL NAVEGADOR (WEB SPEECH API) ──
        setProcessingProgress(90);
        setProcessingStep('Estructurando transcripción de voz capturada en vivo...');

        const liveSegs = liveSegmentsRef.current;
        const totalDuration = recordingSeconds || liveSegs[liveSegs.length - 1]?.end || 60;
        const fullText = liveSegs.map(s => s.text).join(' ');

        const realLiveTranscript = {
          version: '2.0.0',
          subject: materiaName,
          duration_seconds: totalDuration,
          total_segments: liveSegs.length,
          paragraphs: [fullText],
          segments: liveSegs
        };

        setTranscriptData(realLiveTranscript);
        saveSessionToHistory(`live_${Date.now()}`, materiaName, targetClaseNum, temaClase, realLiveTranscript, audioUrl);
      } else {
        // ── MOTOR 4: SOLO AUDIO REGISTRADO ──
        setProcessingProgress(90);
        setProcessingStep('Guardando pista de audio...');

        const fallbackTranscript = {
          version: '2.0.0',
          subject: materiaName,
          duration_seconds: recordingSeconds || 0,
          total_segments: 1,
          paragraphs: ['[Audio de clase grabado listo para escucha. Conecta el servidor Python o ingresa una API Key de Whisper en Ajustes para transcripción automática].'],
          segments: [
            {
              id: 1,
              start: 0.0,
              end: recordingSeconds || 60.0,
              timestamp: '00:00:00',
              text: '[Audio de clase grabado y disponible para reproducción]',
              words: []
            }
          ]
        };

        setTranscriptData(fallbackTranscript);
        saveSessionToHistory(`audio_${Date.now()}`, materiaName, targetClaseNum, temaClase, fallbackTranscript, audioUrl);
        showToast('Audio listo en reproductor', 'headphones');
      }

      setProcessingProgress(100);
      setIsProcessing(false);
      setActiveSubTab('player');
      showToast('Desgrabación completada con éxito', 'sparkles');
    } catch (e) {
      if (e.name === 'AbortError') {
        console.log('Procesamiento cancelado por el usuario.');
      } else {
        console.error('Error en procesamiento:', e);
        setProcessingError(e.message || 'Ocurrió un error al procesar el audio.');
      }
      setIsProcessing(false);
    }
  };

  // Guardar sesión en historial local
  const saveSessionToHistory = (sessionId, materia, claseNum, tema, transcript, audio) => {
    const sessionObj = {
      id: sessionId,
      materia,
      claseNum,
      tema: tema || `Clase #${claseNum}`,
      fecha: new Date().toISOString(),
      durationSeconds: transcript?.duration_seconds || recordingSeconds || 0,
      totalSegments: transcript?.total_segments || transcript?.segments?.length || 0,
      transcript,
      audioUrl: audio,
    };
    const updated = [sessionObj, ...savedSessions.filter(s => s.id !== sessionId)];
    setSavedSessions(updated);
    try {
      localStorage.setItem('psi_audio_sessions_history', JSON.stringify(updated.slice(0, 30)));
    } catch (e) {}

    // Guardar automáticamente en Supabase como "Apunte" para no perderlo nunca
    const targetMat = materias.find(m => m.nombre === materia);
    if (targetMat) {
      let contentText = `DESGRABACIÓN: ${materia} - CLASE #${claseNum}\n\n`;
      if (transcript.segments) {
        transcript.segments.forEach(s => { contentText += `[${s.timestamp}] ${s.text}\n`; });
      } else if (transcript.paragraphs) {
        transcript.paragraphs.forEach(p => { contentText += `${p}\n\n`; });
      }

      onSaveApunte({
        id: `desgrab_${sessionId}`,
        materia_id: targetMat.id,
        titulo: `Desgrabación: Clase ${claseNum} - ${tema || 'Audio'}`,
        tipo: 'texto',
        contenido: contentText,
        clase_relacionada: claseNum,
        tags: 'desgrabacion, respaldo_automatico'
      });
      console.log('Respaldo automático enviado a Supabase (Apuntes)');
    }
  };

  // Sincronización del Reproductor de Audio (Apartado 4.2)
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime;
    setCurrentTime(cur);

    if (transcriptData && transcriptData.segments) {
      let activeSeg = transcriptData.segments.find(s => cur >= s.start && cur <= s.end);
      if (!activeSeg) {
        activeSeg = [...transcriptData.segments].reverse().find(s => cur >= s.start);
      }
      if (activeSeg && activeSeg.id !== activeSegmentId) {
        setActiveSegmentId(activeSeg.id);
        if (autoScrollEnabled) {
          const el = document.getElementById(`seg-row-${activeSeg.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }
  };

  const handleSeek = (seconds) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(seconds, duration || 99999));
      if (!isPlaying) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => setIsPlaying(true)).catch(() => {});
        }
      }
    }
  };

  const handleSkip = (offsetSeconds) => {
    if (audioRef.current) {
      handleSeek(audioRef.current.currentTime + offsetSeconds);
    }
  };

  const handleTogglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const handleRateChange = (newRate) => {
    setPlaybackRate(newRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate;
    }
  };

  // Marcadores de momentos clave de examen
  const handleToggleBookmark = () => {
    const curSec = audioRef.current ? audioRef.current.currentTime : currentTime;
    const timeStr = formatTime(curSec);
    const newBm = {
      id: `bm_${Date.now()}`,
      time: curSec,
      timestamp: timeStr,
      label: `Clave de Examen (${timeStr})`,
    };
    setBookmarks(prev => [...prev, newBm]);
    showToast(`Momento clave guardado en ${timeStr}`, 'bookmark');
  };

  // Navegación de búsqueda no destructiva
  useEffect(() => {
    if (!searchTerm.trim() || !transcriptData?.segments) {
      setSearchMatches([]);
      setCurrentMatchIndex(0);
      return;
    }
    const term = searchTerm.toLowerCase();
    const matches = [];
    transcriptData.segments.forEach((seg, sIdx) => {
      if (seg.text.toLowerCase().includes(term)) {
        matches.push({ segmentId: seg.id, segmentIndex: sIdx, start: seg.start });
      }
    });
    setSearchMatches(matches);
    setCurrentMatchIndex(matches.length > 0 ? 0 : 0);
  }, [searchTerm, transcriptData]);

  const handleNextMatch = () => {
    if (searchMatches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(nextIdx);
    const targetMatch = searchMatches[nextIdx];
    const el = document.getElementById(`seg-row-${targetMatch.segmentId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handlePrevMatch = () => {
    if (searchMatches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(prevIdx);
    const targetMatch = searchMatches[prevIdx];
    const el = document.getElementById(`seg-row-${targetMatch.segmentId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // Función helper para resaltar el texto buscado
  const renderHighlightedText = (text, term) => {
    if (!term || !term.trim()) return text;
    const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === term.toLowerCase() ? (
        <mark key={i} className="bg-amber-400/40 text-amber-200 px-1 py-0.5 rounded font-bold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Utilidad universal para copiar al portapapeles con fallback robusto
  const copyToClipboardUniversal = async (text, msg = 'Texto copiado al portapapeles') => {
    if (!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      triggerHaptic('success');
      showToast(msg, 'clipboard');
    } catch (err) {
      console.error('Error al copiar:', err);
      showToast('No se pudo copiar automáticamente', 'alert-triangle');
    }
  };

  // Convertidores de Subtítulos y Formatos
  const formatTimeSubtitle = (seconds, isVTT = true) => {
    const s = Math.max(0, seconds || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    const delim = isVTT ? '.' : ',';
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}${delim}${String(ms).padStart(3, '0')}`;
  };

  const generateVTTContent = (segments = []) => {
    let vtt = 'WEBVTT - PsiEstudio Academic Transcription\n\n';
    segments.forEach((seg, idx) => {
      const start = formatTimeSubtitle(seg.start, true);
      const end = formatTimeSubtitle(seg.end, true);
      vtt += `${idx + 1}\n${start} --> ${end}\n${seg.text}\n\n`;
    });
    return vtt;
  };

  const generateSRTContent = (segments = []) => {
    let srt = '';
    segments.forEach((seg, idx) => {
      const start = formatTimeSubtitle(seg.start, false);
      const end = formatTimeSubtitle(seg.end, false);
      srt += `${idx + 1}\n${start} --> ${end}\n${seg.text}\n\n`;
    });
    return srt;
  };

  // Vincular Desgrabación a la Ficha de Clase en Aulas
  const handleLinkToClaseDirectly = () => {
    if (!transcriptData) return;
    onLinkToClase({
      materia_id: targetMateriaId,
      nro_clase: targetClaseNum,
      titulo_clase: temaClase,
      audioUrl: audioUrl,
      transcript: transcriptData
    });
    triggerHaptic('success');
  };

  // Transferir Desgrabación a Apunte de Clase
  const handleTransferToApunte = () => {
    if (!transcriptData) return;
    const targetMatObj = materias.find(m => m.id === targetMateriaId);
    const materiaName = targetMatObj ? targetMatObj.nombre : 'General';
    const titulo = `Desgrabación: ${materiaName} - Clase #${targetClaseNum}${temaClase ? ` (${temaClase})` : ''}`;

    let mdContent = `# ${titulo.toUpperCase()}\n\n`;
    mdContent += `> **Materia:** ${materiaName}  \n`;
    mdContent += `> **Clase:** #${targetClaseNum}  \n`;
    mdContent += `> **Fecha de Grabación:** ${new Date().toLocaleDateString('es-AR')}  \n`;
    mdContent += `> **Duración Total:** ${formatTime(duration || transcriptData.duration_seconds || 0)}  \n`;
    if (audioUrl) {
      mdContent += `> **Fuente de Audio:** [Reproducir Sesión de Clase](${audioUrl})  \n`;
    }
    mdContent += `\n---\n\n`;

    if (bookmarks.length > 0) {
      mdContent += `## ⭐ HITOS Y MOMENTOS CLAVE DE EXAMEN\n\n`;
      mdContent += `| Timestamp | Momento de Clase | Énfasis Cátedra |\n`;
      mdContent += `|:---:|:---|:---|\n`;
      bookmarks.forEach(bm => {
        mdContent += `| \`${bm.timestamp}\` | ${bm.label} | Concepto evaluable |\n`;
      });
      mdContent += `\n---\n\n`;
    }

    mdContent += `## 🎙️ TRANSCRIPCIÓN LITERAL VERBATIM (PALABRA POR PALABRA)\n\n`;

    if (transcriptData.segments && transcriptData.segments.length > 0) {
      transcriptData.segments.forEach(seg => {
        mdContent += `**[${seg.timestamp}]** ${seg.text}\n\n`;
      });
    } else if (transcriptData.paragraphs) {
      transcriptData.paragraphs.forEach(p => {
        mdContent += `${p}\n\n`;
      });
    }

    onSaveApunte({
      titulo,
      materia_id: targetMateriaId,
      materia: materiaName,
      unidad: 'Unidad 1',
      tipo: 'Desgrabación de Clase',
      contenido: mdContent,
      va_parcial: true,
    });
    triggerHaptic('success');
    showToast('Desgrabación transferida a Apunte de Clase', 'file-text');
  };

  // Generador de Protocolos de Estudio NEUROSCAN de Alta Densidad
  const handleGenerateNeuroscan = () => {
    if (!transcriptData) return;
    const targetMatObj = materias.find(m => m.id === targetMateriaId);
    const materiaName = targetMatObj ? targetMatObj.nombre : 'General';
    const titulo = `PROTOCOLO NEUROSCAN: ${materiaName} - CLASE #${targetClaseNum}${temaClase ? ` (${temaClase})` : ''}`;

    let md = `# ${titulo.toUpperCase()}\n\n`;
    md += `> **Cátedra:** ${materiaName} | **Clase:** #${targetClaseNum}  \n`;
    md += `> **Eje Temático:** ${temaClase || 'Desarrollo Teórico Integral'}  \n`;
    md += `> **Fecha:** ${new Date().toLocaleDateString('es-AR')} | **Duración del Registro:** ${formatTime(duration || transcriptData.duration_seconds || 0)}  \n\n`;
    md += `---\n\n`;

    md += `## DESARROLLO DE LA CLASE (DESGRABACIÓN RAW)\n\n`;

    if (transcriptData.segments && transcriptData.segments.length > 0) {
      transcriptData.segments.forEach((seg, idx) => {
        md += `**[${seg.timestamp}]** ${seg.text}\n\n`;
      });
    } else if (transcriptData.paragraphs) {
      transcriptData.paragraphs.forEach((p, idx) => {
        md += `${p}\n\n`;
      });
    }

    onOpenApunteModal({
      titulo: `Guía NEUROSCAN: ${materiaName} - C#${targetClaseNum}`,
      materia_id: targetMateriaId,
      materia: materiaName,
      unidad: 'Unidad 1',
      tipo: 'Guía de Estudio',
      contenido: md,
      va_parcial: true,
    });
    triggerHaptic('success');
    showToast('¡Protocolo NEUROSCAN generado en el editor!', 'sparkles');
  };

  // Copiar Prompt Académico Completo con Desgrabación Incrustada para IA (Gemini/Claude)
  const handleCopyAcademicPrompt = () => {
    if (!transcriptData) return;
    const targetMatObj = materias.find(m => m.id === targetMateriaId);
    const materiaName = targetMatObj ? targetMatObj.nombre : 'General';
    const rawTranscript = transcriptData.segments
      ? transcriptData.segments.map(s => `[${s.timestamp}] ${s.text}`).join('\n')
      : transcriptData.paragraphs?.join('\n\n') || '';

    const promptText = generateAcademicPrompt(
      materiaName,
      `Clase #${targetClaseNum}: ${temaClase || 'Desgrabación de Cátedra'}`,
      rawTranscript
    );

    copyToClipboardUniversal(promptText, '¡Prompt Académico con Desgrabación copiado para IA!');
  };

  // Copiar Transcripción Simple
  const handleCopyTranscript = () => {
    if (!transcriptData) return;
    const textToCopy = transcriptData.segments
      ? transcriptData.segments.map(s => `[${s.timestamp}] ${s.text}`).join('\n')
      : transcriptData.paragraphs?.join('\n\n') || '';
    copyToClipboardUniversal(textToCopy, 'Transcripción copiada al portapapeles');
  };

  // Helper para generar texto
  const getTranscriptText = (transcript) => {
    if (!transcript) return '';
    return transcript.segments
      ? transcript.segments.map(s => `[${s.timestamp}] ${s.text}`).join('\n')
      : transcript.paragraphs?.join('\n\n') || '';
  };

  // Descargar Archivos Multiformato (.md, .txt, .doc)
  const handleDownloadFile = (ext = 'md', explicitData = null, explicitMateria = null, explicitClase = null) => {
    const dataToUse = explicitData || transcriptData;
    if (!dataToUse) return;
    const targetMatObj = materias.find(m => m.id === targetMateriaId);
    const resolvedMateriaName = explicitMateria || (targetMatObj ? targetMatObj.nombre : 'Clase');
    const materiaName = resolvedMateriaName.replace(/\s+/g, '_');
    const resolvedClase = explicitClase || targetClaseNum;
    
    let content = '';
    let mime = 'text/plain;charset=utf-8';
    let filename = `desgrabacion_${materiaName}_c${resolvedClase}.${ext}`;

    if (ext === 'md') {
      mime = 'text/markdown;charset=utf-8';
      content = `# DESGRABACIÓN: ${materiaName.replace(/_/g, ' ')} - CLASE #${resolvedClase}\n\n`;
      content += `> **Fecha:** ${new Date().toLocaleDateString('es-AR')} | **Duración:** ${formatTime(duration || dataToUse.duration_seconds || 0)}\n\n`;
      if (dataToUse.segments) {
        dataToUse.segments.forEach(s => { content += `**[${s.timestamp}]** ${s.text}\n\n`; });
      } else if (dataToUse.paragraphs) {
        dataToUse.paragraphs.forEach(p => { content += `${p}\n\n`; });
      }
    } else if (ext === 'doc') {
      mime = 'application/msword;charset=utf-8';
      content = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Desgrabación</title></head><body>
<h1>DESGRABACIÓN: ${materiaName.replace(/_/g, ' ')} - CLASE #${resolvedClase}</h1>
<p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR')} | <strong>Duración:</strong> ${formatTime(duration || dataToUse.duration_seconds || 0)}</p><hr/>
`;
      if (dataToUse.segments) {
        dataToUse.segments.forEach(s => { content += `<p><strong>[${s.timestamp}]</strong> ${s.text}</p>\n`; });
      } else if (dataToUse.paragraphs) {
        dataToUse.paragraphs.forEach(p => { content += `<p>${p}</p>\n`; });
      }
      content += `</body></html>`;
    } else if (ext === 'txt') {
      content = getTranscriptText(dataToUse);
    }

    const blob = new Blob([content], { type: mime });
    const link = document.createElement('a');
    const blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    triggerHaptic('light');
    showToast(`Archivo ${filename} descargado`, 'download');
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* ── HEADER DEL MÓDULO ── */}
      <div className="bg-app-card border border-app-border p-5 rounded-2xl shadow-fluffy flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-app-emerald-bg text-app-emerald border border-app-emerald/30 flex items-center justify-center">
              <Icon name="mic" className="w-5 h-5" size={20} />
            </span>
            <h2 className="text-xl md:text-2xl font-black text-app-text tracking-tight">
              Grabadora & Desgrabador Verbatim (DSP)
            </h2>
          </div>
          <p className="text-xs text-app-muted font-medium">
            Captura clases universitarias, elimina ruidos con DSP EBU R128 y genera desgrabaciones palabra por palabra sincronizadas.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Indicador de Estado del Backend */}
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-card ${
            serverOnline ? 'bg-app-emerald-bg border-app-emerald/30 text-app-emerald' : 'bg-app-amber-bg border-app-amber/30 text-app-amber'
          }`}>
            <span className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-app-emerald animate-pulse' : 'bg-app-amber'}`}></span>
            <span>{serverOnline ? 'Backend DSP Conectado (FastAPI)' : 'Transcripción en la nube (Groq)'}</span>
          </div>

        </div>
      </div>

      {/* ── SUB-NAVEGACIÓN INTERNA ── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-app-border pb-2">
        {[
          { id: 'record', label: '🎙️ Grabar Audio', icon: 'mic' },
          { id: 'player', label: '🎧 Visor Interactivo', icon: 'headphones', disabled: !transcriptData },
          { id: 'history', label: `📚 Historial (${savedSessions.length})`, icon: 'archive' },
        ].map(tab => (
          <button
            key={tab.id}
            disabled={tab.disabled}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex-1 justify-center sm:flex-none sm:justify-start ${
              activeSubTab === tab.id
                ? 'bg-app-emerald text-white shadow-emerald'
                : (tab.disabled ? 'opacity-40 cursor-not-allowed text-app-muted' : 'bg-app-card text-app-muted hover:text-app-text border border-app-border')
            }`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ════ SUB-TAB 1: GRABAR / PROCESAR AUDIO ════ */}
      {activeSubTab === 'record' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Parámetros y Presets */}
          <div className="space-y-4">
            <div className="bg-app-card border border-app-border p-4 rounded-xl shadow-card space-y-3">
              <h3 className="text-sm font-extrabold text-app-text flex items-center gap-1.5">
                <Icon name="folder" className="w-4 h-4 text-app-emerald" /> Materia & Destino
              </h3>

              <div>
                <label className="block text-[11px] font-bold uppercase text-app-emerald mb-1">Materia</label>
                <select
                  value={targetMateriaId}
                  onChange={(e) => setTargetMateriaId(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold text-app-text outline-none"
                >
                  {materias.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-app-emerald mb-1">Nº de Clase</label>
                  <input
                    type="number"
                    min="1"
                    value={targetClaseNum}
                    onChange={(e) => setTargetClaseNum(parseInt(e.target.value, 10) || 1)}
                    className="w-full p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold text-app-text outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-app-emerald mb-1">Preset Acústico</label>
                  <select
                    value={preset}
                    onChange={(e) => setPreset(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold text-app-text outline-none"
                  >
                    <option value="estudio_balanceado">Balanceado</option>
                    <option value="aula_magna_eco">Aula con Eco</option>
                    <option value="docente_lejano">Docente Lejano</option>
                    <option value="ruido_ventilador">Ventilador / Ruido</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-app-emerald mb-1">Tema / Eje Teórico (Opcional)</label>
                <input
                  type="text"
                  value={temaClase}
                  onChange={(e) => setTemaClase(e.target.value)}
                  placeholder="Ej: Pulsión, Represión y Metapsicología"
                  className="w-full p-2.5 rounded-xl bg-app-surface border border-app-border text-xs text-app-text outline-none"
                />
              </div>
            </div>
          </div>

          {/* Columna Central y Derecha: Interfaz de Grabación y Carga de Archivos */}
          <div className="lg:col-span-2 space-y-4">
            {/* Banner de Recuperación de Sesión Interrumpida */}
            {interruptedSession && (
              <div className="bg-app-amber-bg border border-app-amber/40 p-4 rounded-2xl shadow-card flex items-center justify-between gap-3 animate-fade-in">
                <div className="flex items-center gap-2.5">
                  <Icon name="alert-circle" className="w-5 h-5 text-app-amber flex-shrink-0" />
                  <div>
                    <h5 className="text-xs font-black text-app-amber">Grabación previa interrumpida detectada</h5>
                    <p className="text-[11px] text-app-muted">
                      Se registraron {formatTime(interruptedSession.seconds)} de audio antes del cierre del navegador.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setInterruptedSession(null);
                      try { localStorage.removeItem('psi_active_recording_backup_meta'); } catch (e) {}
                    }}
                    className="px-2.5 py-1.5 text-xs text-app-muted hover:text-app-text font-bold"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}

            {/* Grabadora en Vivo */}
            <div className="bg-app-card border border-app-border p-6 rounded-2xl shadow-card text-center space-y-4">
              <div className="flex justify-between items-center border-b border-app-border pb-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-app-muted">Captura en Vivo Web Audio</span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-all ${
                  recordingState === 'recording'
                    ? 'bg-app-ruby-bg text-app-ruby animate-pulse border border-app-ruby/30'
                    : (recordingState === 'paused'
                        ? 'bg-app-amber-bg text-app-amber border border-app-amber/30 font-extrabold'
                        : 'bg-app-surface text-app-muted')
                }`}>
                  {recordingState === 'recording' && '● GRABANDO EN VIVO'}
                  {recordingState === 'paused' && '⏸️ EN PAUSA (RECREO)'}
                  {recordingState === 'idle' && 'EN ESPERA'}
                </span>
              </div>

              {/* Cronómetro */}
              <div className="py-2">
                <span className={`text-5xl md:text-6xl font-black font-mono tracking-tight transition-all ${
                  recordingState === 'recording' ? 'text-app-emerald' : (recordingState === 'paused' ? 'text-app-amber' : 'text-app-text')
                }`}>
                  {formatTime(recordingSeconds)}
                </span>
              </div>

              {/* Canvas Waveform */}
              <div className="w-full h-16 bg-app-surface rounded-xl border border-app-border overflow-hidden flex items-center justify-center relative">
                <canvas ref={canvasRef} width={500} height={64} className="w-full h-full" />
                {recordingState === 'idle' && (
                  <span className="absolute text-xs font-bold text-app-muted">Ondas de sonido en tiempo real</span>
                )}
                {recordingState === 'paused' && (
                  <span className="absolute text-xs font-extrabold text-app-amber bg-app-card/90 px-3 py-1 rounded-lg border border-app-amber/30">
                    Audio Pausado — Pulsa Reanudar al continuar la clase
                  </span>
                )}
              </div>

              {/* Botones de Control con Máquina de Estados */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {recordingState === 'idle' && (
                  <button
                    onClick={handleStartRecording}
                    className="px-6 py-3.5 bg-app-emerald text-white font-black text-sm rounded-2xl shadow-emerald hover:brightness-110 flex items-center gap-2 transition-all transform hover:scale-105"
                  >
                    <Icon name="mic" className="w-5 h-5 text-white" /> Iniciar Grabación de Clase
                  </button>
                )}

                {recordingState === 'recording' && (
                  <>
                    <button
                      onClick={handlePauseRecording}
                      className="px-5 py-3.5 bg-app-amber text-white font-bold text-xs rounded-2xl shadow-card hover:brightness-110 flex items-center gap-2"
                    >
                      <Icon name="pause" className="w-4 h-4 text-white" /> Pausar (Recreo)
                    </button>
                    <button
                      onClick={() => handleStopRecording(true)}
                      className="px-6 py-3.5 bg-app-ruby text-white font-black text-sm rounded-2xl shadow-card hover:brightness-110 flex items-center gap-2 animate-pulse"
                    >
                      <Icon name="square" className="w-5 h-5 text-white" /> Detener & Desgrabar
                    </button>
                  </>
                )}

                {recordingState === 'paused' && (
                  <>
                    <button
                      onClick={handleResumeRecording}
                      className="px-6 py-3.5 bg-app-emerald text-white font-black text-sm rounded-2xl shadow-emerald hover:brightness-110 flex items-center gap-2 animate-bounce"
                    >
                      <Icon name="play" className="w-5 h-5 text-white" /> Reanudar Grabación
                    </button>
                    <button
                      onClick={() => handleStopRecording(true)}
                      className="px-5 py-3.5 bg-app-ruby text-white font-bold text-xs rounded-2xl shadow-card hover:brightness-110 flex items-center gap-2"
                    >
                      <Icon name="check" className="w-4 h-4 text-white" /> Finalizar Clase
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Subir Archivo de Audio o JSON Existente */}
            <div className="bg-app-surface border border-app-border p-5 rounded-2xl shadow-card space-y-3">
              <h4 className="text-xs font-black uppercase text-app-text flex items-center gap-2">
                <Icon name="upload-cloud" className="w-4 h-4 text-app-emerald" /> O Cargar Archivo de Audio / Desgrabación JSON
              </h4>
              <div className="border-2 border-dashed border-app-border hover:border-app-emerald rounded-xl p-5 text-center transition-all">
                <input
                  type="file"
                  id="audioFileInput"
                  accept="audio/*,.caf,.m4a,.mp3,.wav,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.name.endsWith('.json')) {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                          try {
                            const parsed = JSON.parse(evt.target.result);
                            setTranscriptData(parsed);
                            setActiveSubTab('player');
                            showToast('Desgrabación JSON cargada', 'check');
                          } catch (err) {
                            alert('JSON inválido');
                          }
                        };
                        reader.readAsText(file);
                      } else {
                        encolarCargaAudio(file);
                      }
                    }
                  }}
                />
                <label htmlFor="audioFileInput" className="cursor-pointer flex flex-col items-center gap-2">
                  <Icon name="file-audio" className="w-8 h-8 text-app-emerald" />
                  <span className="text-xs font-extrabold text-app-text">Arrastra o haz clic para subir audio (.m4a, .mp3, .caf, .wav) o JSON</span>
                  <span className="text-[11px] text-app-muted">Soporta clases completas de 1 a 2 horas</span>
                </label>
              </div>
            </div>

            {/* Cargas en segundo plano: todo queda en la base; se puede seguir usando la app */}
            {cargas.length > 0 && (
              <div className="bg-app-card border border-app-border p-5 rounded-2xl shadow-card space-y-3">
                <h4 className="text-xs font-black uppercase text-app-text flex items-center gap-2">
                  <Icon name="list" className="w-4 h-4 text-app-emerald" /> Cargas en segundo plano (guardadas en la base)
                </h4>
                {cargas.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-app-text truncate">{c.nombre}</p>
                      <p className="text-app-muted truncate">{c.materia} · Clase {c.clase_num}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {c.estado === 'completada' && <span className="text-app-emerald font-bold">Lista en Apuntes</span>}
                      {(c.estado === 'pendiente' || c.estado === 'en_proceso') && (
                        <span className="text-app-amber font-bold">Desgrabando {c.partes_listas || 0}/{c.partes_total || '?'}</span>
                      )}
                      {c.estado === 'grabando' && sesionGrabacionRef.current !== c.id && (
                        <button onClick={() => reintentarCarga(c.id)} className="text-app-amber font-bold underline">
                          Grabación interrumpida: desgrabar lo subido
                        </button>
                      )}
                      {c.estado === 'grabando' && sesionGrabacionRef.current === c.id && (
                        <span className="text-app-emerald font-bold">Grabando ({c.partes_total || 0} fragmentos guardados)</span>
                      )}
                      {c.estado === 'error' && (
                        <button onClick={() => reintentarCarga(c.id)} className="text-app-ruby font-bold underline">
                          Reintentar ({c.partes_listas || 0} partes guardadas)
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Barra de Progreso durante Inferencia con botón de Cancelar */}
            {isProcessing && (
              <div className="bg-app-card border border-app-emerald/40 p-5 rounded-2xl shadow-card space-y-3 animate-fade-in">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-app-emerald flex items-center gap-2">
                    <Icon name="cpu" className="w-4 h-4 animate-spin text-app-emerald" /> {processingStep}
                  </span>
                  <span className="text-xs font-mono font-black text-app-text">{processingProgress.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2.5 bg-app-surface rounded-full overflow-hidden border border-app-border">
                  <div
                    className="h-full bg-app-emerald transition-all duration-300 shadow-[0_0_8px_var(--color-emerald-main)]"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center pt-1">
                  <p className="text-[11px] text-app-muted">
                    Filtrando armónicos, eliminando eco de aula y transcribiendo palabra por palabra con Faster-Whisper.
                  </p>
                  <button
                    onClick={handleCancelProcessing}
                    className="px-3 py-1 bg-app-ruby-bg border border-app-ruby/30 text-app-ruby font-bold text-xs rounded-lg hover:bg-app-ruby hover:text-white transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Mensaje de Error */}
            {processingError && (
              <div className="bg-app-ruby-bg border border-app-ruby/30 p-4 rounded-xl text-xs font-bold text-app-ruby flex items-center gap-2">
                <Icon name="alert-triangle" className="w-4 h-4" /> {processingError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ SUB-TAB 2: VISOR INTERACTIVO SINCRONIZADO (DUAL PLAYER) ════ */}
      {activeSubTab === 'player' && (
        <>
          {transcriptData ? (
            <div className="space-y-4">
          {/* Barra Flotante de Reproducción */}
          <div className="bg-app-card border border-app-border p-4 rounded-2xl shadow-fluffy sticky top-16 z-30 space-y-3 backdrop-blur-xl">
            <audio
              ref={audioRef}
              src={audioUrl || ''}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={() => setDuration(audioRef.current?.duration || transcriptData.duration_seconds || 0)}
              onEnded={() => setIsPlaying(false)}
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Información de la Clase */}
              <div>
                <h3 className="text-sm font-black text-app-text flex items-center gap-2">
                  <Icon name="headphones" className="w-4 h-4 text-app-emerald" />
                  {transcriptData.subject || 'Clase Universitaria'} — Clase #{targetClaseNum}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-app-muted">
                    {formatTime(currentTime)} / {formatTime(duration || transcriptData.duration_seconds || 0)}
                  </span>
                  {/* Toggle de Auto-Scroll */}
                  <button
                    onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all flex items-center gap-1 ${
                      autoScrollEnabled
                        ? 'bg-app-emerald-bg border-app-emerald/30 text-app-emerald'
                        : 'bg-app-surface border-app-border text-app-muted'
                    }`}
                    title="Desplazamiento automático al reproducir"
                  >
                    <Icon name="arrow-down" className="w-3 h-3" />
                    Auto-Scroll: {autoScrollEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Controles Principales */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSkip(-5)}
                  className="p-2 rounded-xl bg-app-surface border border-app-border text-app-text hover:bg-app-card transition-all"
                  title="Retroceder 5 segundos"
                >
                  <Icon name="rotate-ccw" className="w-4 h-4" />
                </button>

                <button
                  onClick={handleTogglePlay}
                  className="px-5 py-2.5 bg-app-emerald text-white font-black text-xs rounded-xl shadow-emerald flex items-center gap-1.5 hover:brightness-110"
                >
                  <Icon name={isPlaying ? 'pause' : 'play'} className="w-4 h-4 text-white" />
                  {isPlaying ? 'Pausar' : 'Reproducir'}
                </button>

                <button
                  onClick={() => handleSkip(5)}
                  className="p-2 rounded-xl bg-app-surface border border-app-border text-app-text hover:bg-app-card transition-all"
                  title="Adelantar 5 segundos"
                >
                  <Icon name="rotate-cw" className="w-4 h-4" />
                </button>

                {/* Selector de Velocidad */}
                <select
                  value={playbackRate}
                  onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                  className="p-2 rounded-xl bg-app-surface border border-app-border text-xs font-bold text-app-text outline-none"
                >
                  <option value="0.75">0.75x</option>
                  <option value="1.0">1.0x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2.0">2.0x</option>
                </select>

                {/* Botón de Marcar Momento Clave */}
                <button
                  onClick={handleToggleBookmark}
                  className="p-2 rounded-xl bg-app-surface border border-app-border text-app-amber hover:bg-app-card transition-all"
                  title="Marcar Punto Clave / Pregunta de Examen"
                >
                  <Icon name="bookmark" className="w-4 h-4" />
                </button>
              </div>

              {/* Botones de Acción y Exportación */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={handleCopyTranscript}
                  className="p-2 bg-app-surface border border-app-border rounded-xl text-app-text hover:border-app-emerald transition-all flex items-center gap-1.5 font-bold text-xs"
                  title="Copiar texto de la clase"
                >
                  <Icon name="clipboard" className="w-3.5 h-3.5" /> Copiar Todo
                </button>

                {/* Descarga Multiformato */}
                <div className="relative inline-flex items-center bg-app-surface border border-app-border rounded-xl p-0.5">
                  <button
                    onClick={() => handleDownloadFile('md')}
                    className="px-2 py-1.5 text-xs font-mono font-bold text-app-text hover:text-app-emerald"
                    title="Descargar Markdown (.md)"
                  >
                    .md
                  </button>
                  <button
                    onClick={() => handleDownloadFile('vtt')}
                    className="px-2 py-1.5 text-xs font-mono font-bold text-app-text hover:text-app-emerald"
                    title="Descargar Subtítulos WebVTT (.vtt)"
                  >
                    .vtt
                  </button>
                  <button
                    onClick={() => handleDownloadFile('srt')}
                    className="px-2 py-1.5 text-xs font-mono font-bold text-app-text hover:text-app-emerald"
                    title="Descargar Subtítulos SubRip (.srt)"
                  >
                    .srt
                  </button>
                  <button
                    onClick={() => handleDownloadFile('txt')}
                    className="px-2 py-1.5 text-xs font-mono font-bold text-app-text hover:text-app-emerald"
                    title="Descargar Texto Plano (.txt)"
                  >
                    .txt
                  </button>
                  <button
                    onClick={() => handleDownloadFile('json')}
                    className="px-2 py-1.5 text-xs font-mono font-bold text-app-text hover:text-app-emerald"
                    title="Descargar JSON Estructurado (.json)"
                  >
                    .json
                  </button>
                </div>
              </div>
            </div>

            {/* Marcadores de Momentos Clave en la Barra */}
            {bookmarks.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                <span className="text-[10px] font-bold text-app-amber uppercase flex items-center gap-1">
                  <Icon name="bookmark" className="w-3 h-3" /> Hitos:
                </span>
                {bookmarks.map((bm) => (
                  <button
                    key={bm.id}
                    onClick={() => handleSeek(bm.time)}
                    className="px-2 py-0.5 rounded-md bg-app-amber-bg border border-app-amber/30 text-app-amber text-[10px] font-mono font-bold hover:brightness-110 flex-shrink-0"
                  >
                    ⭐ {bm.timestamp}
                  </button>
                ))}
              </div>
            )}

            {/* Barra de Progreso de Seek */}
            <input
              type="range"
              min="0"
              max={duration || transcriptData.duration_seconds || 100}
              step="0.1"
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-app-surface rounded-lg"
            />
          </div>

          {/* Buscador dentro de la Desgrabación con Navegación Prev/Next */}
          <div className="flex items-center gap-2 bg-app-card border border-app-border p-2.5 rounded-xl shadow-card">
            <div className="relative flex-1">
              <Icon name="search" className="w-4 h-4 text-app-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar en la clase sin ocultar texto (ej: Freud, Lacan, pulsión, WISC)..."
                className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-app-surface border border-app-border text-xs text-app-text outline-none focus:border-app-emerald"
              />
            </div>

            {searchMatches.length > 0 && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs font-bold text-app-emerald font-mono">
                  {currentMatchIndex + 1} de {searchMatches.length}
                </span>
                <button
                  onClick={handlePrevMatch}
                  className="p-1.5 rounded-lg bg-app-surface border border-app-border text-app-text hover:bg-app-card"
                  title="Coincidencia anterior"
                >
                  <Icon name="chevron-up" className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleNextMatch}
                  className="p-1.5 rounded-lg bg-app-surface border border-app-border text-app-text hover:bg-app-card"
                  title="Siguiente coincidencia"
                >
                  <Icon name="chevron-down" className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Lista Completa de Segmentos con Karaoke y Timestamps Clickeables */}
          <div ref={transcriptContainerRef} onScroll={handleTranscriptScroll} className="space-y-3 overflow-y-auto max-h-[70vh]">
            {transcriptData.segments && transcriptData.segments.length > 0 ? (
              transcriptData.segments.map((seg) => {
                const isCurrent = currentTime >= seg.start && currentTime <= seg.end;
                return (
                  <div
                    key={seg.id}
                    id={`seg-row-${seg.id}`}
                    onClick={() => handleSeek(seg.start)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row gap-3 ${
                      isCurrent
                        ? 'bg-app-emerald-bg border-app-emerald/50 shadow-emerald ring-2 ring-app-emerald/30'
                        : 'bg-app-card border-app-border hover:border-app-emerald/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:flex-col sm:items-start flex-shrink-0">
                      <button
                        className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-black transition-all ${
                          isCurrent ? 'bg-app-emerald text-white' : 'bg-app-surface text-app-emerald border border-app-border hover:bg-app-card'
                        }`}
                      >
                        {seg.timestamp}
                      </button>
                    </div>

                    <div className="flex-1">
                      {seg.words && seg.words.length > 0 ? (
                        <p className="text-xs md:text-sm leading-relaxed flex flex-wrap gap-1">
                          {seg.words.map((w, wIdx) => {
                            const isWordActive = currentTime >= w.start && currentTime <= w.end;
                            return (
                              <span
                                key={wIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSeek(w.start);
                                }}
                                className={`transition-all rounded px-0.5 ${
                                  isWordActive
                                    ? 'bg-app-emerald text-white font-black scale-105 shadow-sm'
                                    : (isCurrent ? 'text-app-text font-bold' : 'text-app-text/90 hover:text-app-emerald')
                                }`}
                              >
                                {renderHighlightedText(w.word, searchTerm)}
                              </span>
                            );
                          })}
                        </p>
                      ) : (
                        <p className={`text-xs md:text-sm leading-relaxed ${isCurrent ? 'text-app-text font-bold' : 'text-app-text/90 font-medium'}`}>
                          {renderHighlightedText(seg.text, searchTerm)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 text-center bg-app-card border border-app-border rounded-xl text-app-muted text-xs">
                No hay segmentos disponibles en esta desgrabación.
              </div>
            )}
          </div>
        </div>
        ) : (
          <div className="p-12 mt-4 text-center bg-app-card border border-app-border rounded-2xl text-app-muted text-xs space-y-2 shadow-card">
            <Icon name="headphones" className="w-8 h-8 mx-auto text-app-muted" />
            <p className="font-bold">No hay desgrabación cargada.</p>
            <p>Graba una nueva clase o selecciona una del historial para visualizarla aquí.</p>
          </div>
        )}
        </>
      )}

      {/* ════ SUB-TAB 3: HISTORIAL DE SESIONES GUARDADAS ════ */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold text-app-text">Historial de Desgrabaciones Guardadas</h3>
            {savedSessions.length > 0 && (
              <input
                type="text"
                placeholder="🔍 Filtrar por materia o clase..."
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
                className="w-full sm:w-64 p-2 rounded-xl bg-app-surface border border-app-border text-xs text-app-text outline-none focus:border-app-emerald"
              />
            )}
          </div>

          {savedSessions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedSessions
                .filter(s => {
                  if (!historyFilter) return true;
                  const filterLower = historyFilter.toLowerCase();
                  return s.materia?.toLowerCase().includes(filterLower) || s.tema?.toLowerCase().includes(filterLower);
                })
                .map((s) => (
                <div key={s.id} className="bg-app-card border border-app-border p-4 rounded-xl shadow-card space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-extrabold text-app-text">{s.materia}</h4>
                      <p className="text-xs text-app-muted font-medium">{s.tema} • Clase #{s.claseNum}</p>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-app-emerald px-2 py-0.5 rounded-md bg-app-emerald-bg border border-app-emerald/30">
                      {formatTime(s.durationSeconds)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-app-border">
                    <span className="text-[10px] text-app-muted font-mono">{new Date(s.fecha).toLocaleDateString('es-AR')}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const apunteData = {
                            id: `hist_${s.id}`,
                            titulo: `Desgrabación: ${s.materia} - Clase #${s.claseNum}`,
                            tipo: 'texto',
                            contenido: getTranscriptText(s.transcript),
                            created_at: s.fecha
                          };
                          onOpenApunteModal(apunteData);
                        }}
                        className="px-3 py-1.5 bg-app-emerald text-white text-xs font-bold rounded-lg shadow-emerald flex items-center gap-1 hover:brightness-110"
                      >
                        <Icon name="book-open" className="w-3 h-3 text-white" /> Leer
                      </button>
                      
                      <button
                        onClick={() => handleDownloadFile('doc', s.transcript, s.materia, s.claseNum)}
                        className="px-3 py-1.5 bg-app-surface text-app-text border border-app-border text-xs font-bold rounded-lg flex items-center gap-1 hover:border-app-emerald transition-all"
                      >
                        <Icon name="download" className="w-3 h-3" /> Descargar (.doc)
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center bg-app-card border border-app-border rounded-2xl text-app-muted text-xs space-y-2">
              <Icon name="mic-off" className="w-8 h-8 text-app-muted mx-auto" />
              <p className="font-bold">No tienes desgrabaciones guardadas en el historial local.</p>
              <p>Graba una clase o sube un archivo de audio para empezar.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 6. ERROR BOUNDARY ANTI-BLANK-SCREEN (NO DESTRUCTIVO) ──
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[PsiEstudio ErrorBoundary] Error atrapado:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleResetState = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-app-base text-app-text flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-app-card border border-app-border p-6 sm:p-8 rounded-2xl shadow-fluffy text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-app-emerald-bg text-app-emerald border border-app-emerald/30 flex items-center justify-center">
              <Icon name="shield-check" className="w-7 h-7 text-app-emerald" size={28} />
            </div>
            <h2 className="text-xl font-black text-app-text">PsiEstudio • Protección de Datos</h2>
            <p className="text-xs text-app-muted leading-relaxed">
              Tus datos y apuntes están 100% seguros y sincronizados.
            </p>
            <div className="p-3 bg-app-surface border border-app-border rounded-xl text-left overflow-x-auto max-h-32 text-xs font-mono text-app-muted">
              {this.state.error?.message || String(this.state.error)}
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald hover:brightness-110 flex items-center justify-center gap-2"
              >
                <Icon name="refresh-cw" className="w-4 h-4" /> Recargar Página
              </button>
              <button
                type="button"
                onClick={this.handleResetState}
                className="w-full py-2.5 bg-app-surface border border-app-border text-app-muted hover:text-app-text font-bold text-xs rounded-xl"
              >
                Volver al Sistema
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── 7. MOUNT APP ──
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
