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

let supabaseClient = null;
try {
  if (window.supabase && SUPABASE_CONFIG.url.startsWith('http')) {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
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

function parseMarkdownToHTML(md) {
  if (!md) return '';
  let html = md;

  // Render Markdown Tables
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

  // KaTeX Display Math $$...$$
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    if (window.katex) {
      try {
        return `<div class="my-3 text-center p-2 rounded-xl bg-app-surface border border-app-border overflow-x-auto">${window.katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false })}</div>`;
      } catch (e) {
        return `<pre class="text-xs font-mono p-2 bg-app-surface rounded-lg">${formula}</pre>`;
      }
    }
    return `<pre class="text-xs font-mono p-2 bg-app-surface rounded-lg">${formula}</pre>`;
  });

  // KaTeX Inline Math $...$
  html = html.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
    if (window.katex) {
      try {
        return window.katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
      } catch (e) {
        return `<code>${formula}</code>`;
      }
    }
    return `<code>${formula}</code>`;
  });

  // Marcadores de imágenes [imagen N: descripcion]
  html = html.replace(/\[imagen\s*(\d+):?\s*([^\]]*)\]/gi, (match, num, desc) => {
    return `<div class="my-4 p-4 rounded-lg bg-app-surface border border-app-border text-center shadow-sm break-inside-avoid">
      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-app-emerald-bg text-app-emerald text-xs font-extrabold border border-app-emerald/20">
        <svg class="w-3.5 h-3.5 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg> FIGURA ${num}
      </div>
      <p class="text-xs text-app-muted mt-2 italic font-serif">${desc.trim() || 'Esquema o fotografía conceptual'}</p>
    </div>`;
  });

  html = html
    .replace(/^### (.*$)/gim, '<h3 class="text-sm font-extrabold text-app-text mt-3 mb-1 tracking-tight">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-base font-black text-app-text mt-4 mb-1.5 border-b border-app-border/40 pb-1 tracking-tight">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-xl font-black uppercase text-app-emerald mt-4 mb-2 tracking-tight">$1</h1>')
    .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-app-emerald bg-app-emerald-bg/20 p-3 my-2.5 rounded-r-xl text-xs italic text-app-text font-serif leading-relaxed">$1</blockquote>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong class="text-app-emerald font-extrabold">$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em class="text-app-navy font-semibold italic">$1</em>')
    .replace(/^[ \t]*◦ (.*$)/gim, '<li class="ml-8 list-[circle] text-app-text text-xs leading-relaxed my-0.5 opacity-90">$1</li>')
    .replace(/^[ \t]*• (.*$)/gim, '<li class="ml-4 list-disc text-app-text text-xs leading-relaxed my-0.5">$1</li>')
    .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-app-text text-xs leading-relaxed my-0.5">$1</li>')
    .replace(/\n$/gim, '<br />');

  return html;
}

// ── 3.5 LOCAL STORAGE & PERSISTENCE SAFE GUARDS ──
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

function safeSetLocalStorage(key, data) {
  try {
    let sanitized = data;
    if (Array.isArray(data)) {
      sanitized = data.map(item => {
        if (!item) return item;
        const clone = { ...item };
        // Si tiene archivo PDF binario, no meterlo a localStorage (IndexedDB lo guarda completo)
        if (clone.pdfData) delete clone.pdfData;
        if (typeof clone.contenido === 'string' && clone.contenido.length > 4000) {
          clone.contenido = clone.contenido.slice(0, 4000) + '\n\n... [Contenido completo guardado en IndexedDB]';
        }
        if (typeof clone.texto_extraido === 'string' && clone.texto_extraido.length > 4000) {
          clone.texto_extraido = clone.texto_extraido.slice(0, 4000) + '\n\n... [Texto completo guardado en IndexedDB]';
        }
        return clone;
      });
    }
    localStorage.setItem(key, typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized));
  } catch (err) {
    console.warn(`QuotaExceededError o error guardando '${key}' en localStorage:`, err);
  }
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

  // Configuración idéntica a generadordepdf.html (NEUROSCAN)
  const marginPt = 4 * 2.83465; // Estrecho (4mm)
  const gapPt = 4 * 2.83465; // Separación (4mm)
  const sheetW = 841.89; // A4 Horizontal (ancho)
  const sheetH = 595.28; // A4 Horizontal (alto)
  const slotW = (sheetW - (marginPt * 2) - gapPt) / 2;
  const slotH = sheetH - (marginPt * 2);

  const totalPages = sourceDoc.getPageCount();
  const zoom = 1.05; // 105% Ampliación del contenido

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
        const nw = Math.max(h * arHueco, w * 0.88);
        L += (w - nw) / 2; R -= (w - nw) / 2; w = nw;
      } else {
        const nh = Math.max(w / arHueco, h * 0.88);
        B += (h - nh) / 2; T -= (h - nh) / 2; h = nh;
      }

      // Ampliación 105%
      const nw2 = w / zoom, nh2 = h / zoom;
      L += (w - nw2) / 2; R -= (w - nw2) / 2;
      B += (h - nh2) / 2; T -= (h - nh2) / 2;

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
    .replace(/\*(.+?)\*/g, '$1');
}

function parseInline(str) {
  var segments = [];
  var re = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*/g;
  var last = 0, m;
  var safeStr = String(str || '');
  while ((m = re.exec(safeStr)) !== null) {
    if (m.index > last) {
      segments.push({ text: safeStr.slice(last, m.index), bold: false, italic: false });
    }
    if (m[1] !== undefined)      segments.push({ text: m[1], bold: true,  italic: true  });
    else if (m[2] !== undefined) segments.push({ text: m[2], bold: true,  italic: false });
    else if (m[3] !== undefined) segments.push({ text: m[3], bold: false, italic: true  });
    last = m.index + m[0].length;
  }
  if (last < safeStr.length) segments.push({ text: safeStr.slice(last), bold: false, italic: false });
  return segments.length ? segments : [{ text: safeStr, bold: false, italic: false }];
}

function parseMarkdown(text) {
  var rawLines = String(text || '').split('\n');
  var tokens = [];
  var secCount = 0, formulaCount = 0, wordCount = 0;

  var i = 0;
  while (i < rawLines.length) {
    var rawLine = rawLines[i];
    var line = rawLine.trimEnd();

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

    var imgMatch = line.match(/^\s*(\[(?:imagen|FIGURA|IMAGEN|grafico)\s*\d*:?\s*([^\]]+)\]|!\[(.*?)\]\((.*?)\))\s*$/i);
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
    } else if (/^---+$/.test(line.trim())) {
      tokens.push({ type: 'hr' });
    } else if (/^\$\$.*\$\$$/.test(line.trim())) {
      var formula = line.trim().slice(2, -2).trim();
      tokens.push({ type: 'formula', text: formula });
      formulaCount++;
    } else if (/^◦ /.test(line)) {
      var t2 = line.slice(2).trim();
      tokens.push({ type: 'li2', text: t2, segs: parseInline(t2) });
      wordCount += line.split(/\s+/).length;
    } else if (/^• /.test(line)) {
      var t1 = line.slice(2).trim();
      tokens.push({ type: 'li1', text: t1, segs: parseInline(t1) });
      wordCount += line.split(/\s+/).length;
    } else if (/^[-*] /.test(line)) {
      var tl = line.slice(2).trim();
      tokens.push({ type: 'li1', text: tl, segs: parseInline(tl) });
      wordCount += line.split(/\s+/).length;
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

  var C_BLACK  = [0, 0, 0];
  var C_DARK   = [20, 20, 20];
  var C_ACCENT = [0, 70, 140];
  var C_SUB    = [60, 40, 120];
  var C_DIM    = [110, 110, 120];
  var C_RULE   = [180, 190, 205];
  var C_FORM   = [130, 90, 0];

  var FS_H1   = 12;
  var FS_H2   = 10;
  var FS_H3   = 10;
  var FS_BODY = 9;
  var FS_LI   = FS_BODY;
  var FS_HDR  = 7;

  function lh(fs) { return fs * 0.353 * 1.0; }

  var y = MT;

  function setColor(arr) { doc.setTextColor(arr[0], arr[1], arr[2]); }
  function setDraw(arr)  { doc.setDrawColor(arr[0], arr[1], arr[2]); }

  function needSpace(needed) {
    if (y + needed > PH - MB) { addPage(); return true; }
    return false;
  }

  function addPage() {
    doc.setFontSize(FS_HDR);
    doc.setFont(fontSel, 'normal');
    setColor(C_DIM);
    doc.text(String(pageNum), PW / 2, PH - 8, { align: 'center' });

    doc.setFontSize(FS_HDR - 0.5);
    doc.setFont(fontSel, 'italic');
    setColor(C_DIM);
    doc.text(materia + ' · ' + unidad, ML, PH - 8);
    doc.text(titulo, PW - MR, PH - 8, { align: 'right' });

    doc.addPage('a4', 'portrait');
    pageNum++;
    y = MT;
    drawPageHeader();
  }

  function drawPageHeader() {
    doc.setFontSize(FS_HDR);
    doc.setFont(fontSel, 'normal');
    setColor(C_DIM);
    doc.text(materia + ' · ' + unidad + ' · ' + titulo, ML, MT - 8);
    setDraw(C_RULE);
    doc.setLineWidth(0.18);
    doc.line(ML, MT - 5, PW - MR, MT - 5);
  }

  function renderInline(segs, startX, maxW, fs, baseColor, baseBold) {
    var words = [];
    (segs || []).forEach(function(seg) {
      var parts = String(seg.text || '').split(/(\s+)/);
      parts.forEach(function(p) {
        if (p === '') return;
        var isSpace = /^\s+$/.test(p);
        words.push({ text: p, bold: seg.bold || baseBold, italic: seg.italic, isSpace: isSpace });
      });
    });

    var lineH = lh(fs);
    var lines = [];
    var curr = [];
    var currW = 0;

    words.forEach(function(w) {
      var style = (w.bold && w.italic) ? 'bolditalic' : w.bold ? 'bold' : w.italic ? 'italic' : 'normal';
      doc.setFont(fontSel, style);
      doc.setFontSize(fs);
      var ww = doc.getTextWidth(w.text);

      if (!w.isSpace && currW + ww > maxW && curr.length > 0) {
        if (curr.length && curr[curr.length-1].isSpace) curr.pop();
        lines.push(curr);
        curr = [{ text: w.text, bold: w.bold, italic: w.italic, isSpace: false, width: ww }];
        currW = ww;
      } else {
        curr.push({ text: w.text, bold: w.bold, italic: w.italic, isSpace: w.isSpace, width: ww });
        currW += ww;
      }
    });
    if (curr.length) {
      if (curr[curr.length-1].isSpace) curr.pop();
      lines.push(curr);
    }

    lines.forEach(function(line) {
      needSpace(lineH + 0.5);
      var cx = startX;
      line.forEach(function(w) {
        var style = (w.bold && w.italic) ? 'bolditalic' : w.bold ? 'bold' : w.italic ? 'italic' : 'normal';
        doc.setFont(fontSel, style);
        doc.setFontSize(fs);
        setColor(baseColor);
        doc.text(w.text, cx, y);
        cx += w.width;
      });
      y += lineH;
    });
    y += 0.3;
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
        setColor(C_DARK);
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
          doc.text('📷 [Variable de imagen pendiente: ' + tok.label + ']', PW / 2, y + 5.5, { align: 'center' });
          y += 11;
        }
        break;
      }

      case 'li1': {
        needSpace(lh(FS_LI) + 1);
        doc.setFontSize(FS_LI + 0.5);
        doc.setFont(fontSel,'normal');
        setColor(C_ACCENT);
        doc.text('•', ML + 4, y);
        renderInline(tok.segs || [{ text: tok.text, bold: false, italic: false }], ML + 9, TW - 9, FS_LI, C_DARK, false);
        break;
      }

      case 'li2': {
        needSpace(lh(FS_LI) + 1);
        doc.setFontSize(FS_LI - 0.5);
        doc.setFont(fontSel,'normal');
        setColor(C_SUB);
        doc.text('◦', ML + 10, y);
        renderInline(tok.segs || [{ text: tok.text, bold: false, italic: false }], ML + 14, TW - 15, FS_LI - 0.5, C_DIM, false);
        break;
      }

      case 'formula': {
        needSpace(lh(FS_BODY) + 2);
        doc.setFontSize(FS_BODY);
        doc.setFont(fontSel, 'italic');
        setColor(C_FORM);
        doc.text(tok.text, PW / 2, y, { align: 'center' });
        y += lh(FS_BODY) + 1;
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
              fontSize: 7.5,
              cellPadding: 1.6,
              lineColor: C_RULE,
              lineWidth: 0.15,
              textColor: C_DARK
            },
            headStyles: {
              fillColor: C_ACCENT,
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 8
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

  if (opts && opts.nums) {
    doc.setFontSize(FS_HDR);
    doc.setFont(fontSel,'normal');
    setColor(C_DIM);
    doc.text(String(pageNum), PW / 2, PH - 8, { align: 'center' });
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

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('psi_theme') || 'light');
  const [activeTab, setActiveTab] = useState('materias'); // 'materias', 'pdf', 'perfil', 'system'
  const [selectedMateriaId, setSelectedMateriaId] = useState(null);
  const [innerTab, setInnerTab] = useState('params');
  const [biblioFilter, setBiblioFilter] = useState('todos');

  // Academic State (con safe storage anti-crash)
  const [materias, setMaterias] = useState(() => safeGetLocalStorage('psi_materias_cache', []));
  const [biblio, setBiblio] = useState(() => safeGetLocalStorage('psi_biblio_cache', []));
  const [clases, setClases] = useState(() => safeGetLocalStorage('psi_clases_cache', []));
  const [apuntes, setApuntes] = useState(() => safeGetLocalStorage('psi_apuntes_cache', []));
  const [pdfs, setPdfs] = useState(() => safeGetLocalStorage('psi_pdfs_cache', []));
  const [examenes, setExamenes] = useState(() => safeGetLocalStorage('psi_examenes_cache', []));

  // Connectivity & Modals
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState(() => safeGetLocalStorage('psi_sync_queue', []));
  const [toast, setToast] = useState({ show: false, msg: '', iconName: 'check-circle' });
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const currentVersion = 'v2.12.3';

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

  const [ingestionData, setIngestionData] = useState(null);
  const [profileImage, setProfileImage] = useState(localStorage.getItem('psi_profile_image') || null);

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

    if (materias.length === 0 && localStorage.getItem('psi_first_run') !== 'done') {
      seedInitialData();
    }
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

  const seedInitialData = () => {
    localStorage.setItem('psi_first_run', 'done');
    const initialMats = [
      {
        id: 'mat_semiosis',
        nombre: 'Semiosis Social',
        abreviatura: 'SEM',
        docente: 'Cátedra A (Prof. González)',
        color: '#10B981',
        año_cursado: 2026,
        cuatrimestre: 2,
        descripcion: 'Teoría de la significación, discursos sociales y semiótica.',
        fecha_parcial1: '2026-10-15',
        modalidad_parcial: 'Presencial Escrito',
        temas_parcial1: 'Unidad 1: Saussure y Peirce. Unidad 2: Verón y discursos sociales.'
      },
      {
        id: 'mat_psicopatologia',
        nombre: 'Psicopatología I',
        abreviatura: 'PSICOPAT',
        docente: 'Cátedra Única (Prof. Martínez)',
        color: '#2563EB',
        año_cursado: 2026,
        cuatrimestre: 2,
        descripcion: 'Estructuras clínicas: neurosis, psicosis y perversión.',
        fecha_parcial1: '2026-10-28',
        modalidad_parcial: 'Presencial Escrito',
        temas_parcial1: 'Neurosis obsesiva e histeria en Freud y Lacan.'
      }
    ];

    const initialBib = [
      {
        id: 'bib_saussure',
        materia_id: 'mat_semiosis',
        materia: 'Semiosis Social',
        unidad: 'Unidad 1',
        nro_texto: 1,
        titulo_texto: 'Curso de Lingüística General (Cap. 1 a 4)',
        autores: 'Saussure, F. (1916)',
        caracter: 'Obligatorio',
        estado: 'Leído',
        va_parcial: true,
        nro_parcial: 1,
        link_resumen: 'https://docs.google.com',
        notas: 'Signo lingüístico, significante/significado, arbitrariedad y valor.'
      },
      {
        id: 'bib_peirce',
        materia_id: 'mat_semiosis',
        materia: 'Semiosis Social',
        unidad: 'Unidad 1',
        nro_texto: 2,
        titulo_texto: 'La Ciencia de la Semiótica',
        autores: 'Peirce, C. S. (1931)',
        caracter: 'Obligatorio',
        estado: 'Pendiente',
        va_parcial: true,
        nro_parcial: 1,
        link_resumen: '',
        notas: 'Representamen, Objeto e Interpretante. Semiosis infinita.'
      },
      {
        id: 'bib_veron',
        materia_id: 'mat_semiosis',
        materia: 'Semiosis Social',
        unidad: 'Unidad 2',
        nro_texto: 3,
        titulo_texto: 'La Semiosis Social: Fragmentos de una Teoría de la Discursividad',
        autores: 'Verón, E. (1987)',
        caracter: 'Obligatorio',
        estado: 'Pendiente',
        va_parcial: true,
        nro_parcial: 1,
        link_resumen: '',
        notas: 'Condiciones de producción y de reconocimiento. Gramática discursiva.'
      }
    ];

    const initialExams = [
      {
        id: 'ex_semiosis_p1',
        materia_id: 'mat_semiosis',
        materia: 'Semiosis Social',
        nombre: 'Primer Parcial Presencial',
        tipo: 'Parcial 1',
        fecha: '2026-10-15',
        modalidad: 'Presencial Escrito',
        unidades_incluidas: ['Unidad 1', 'Unidad 2'],
        textos_vinculados: ['bib_saussure', 'bib_peirce', 'bib_veron'],
        temas: 'Unidad 1 y Unidad 2 completas. Autores: Saussure, Peirce, Verón.',
        finalizado: false
      }
    ];

    setMaterias(initialMats);
    setBiblio(initialBib);
    setExamenes(initialExams);
    safeSetLocalStorage('psi_materias_cache', initialMats);
    safeSetLocalStorage('psi_biblio_cache', initialBib);
    safeSetLocalStorage('psi_examenes_cache', initialExams);
    saveToIndexedDB('materias', initialMats);
    saveToIndexedDB('bibliografia', initialBib);
    saveToIndexedDB('examenes', initialExams);
  };

  const saveToIndexedDB = async (tableName, items) => {
    if (psiDB && psiDB[tableName] && Array.isArray(items)) {
      try {
        await psiDB[tableName].clear();
        await psiDB[tableName].bulkPut(items);
      } catch (e) {
        console.warn(`IndexedDB save error (${tableName}):`, e);
      }
    }
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
        if (mats.length > 0) setMaterias(mats);
        if (bibs.length > 0) setBiblio(bibs);
        if (clas.length > 0) setClases(clas);
        if (pdfsList.length > 0) setPdfs(pdfsList);
        
        let mergedApuntes = apus || [];
        if (pdfsList && pdfsList.length > 0) {
          pdfsList.forEach(p => {
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
        if (mergedApuntes.length > 0) setApuntes(mergedApuntes);
        if (exas.length > 0) setExamenes(exas);
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

      if (matsRes.status === 'fulfilled' && matsRes.value.data?.length) {
        setMaterias(matsRes.value.data);
        safeSetLocalStorage('psi_materias_cache', matsRes.value.data);
        saveToIndexedDB('materias', matsRes.value.data);
      }
      if (bibRes.status === 'fulfilled' && bibRes.value.data) {
        setBiblio(bibRes.value.data);
        safeSetLocalStorage('psi_biblio_cache', bibRes.value.data);
        saveToIndexedDB('bibliografia', bibRes.value.data);
      }
      if (claRes.status === 'fulfilled' && claRes.value.data) {
        setClases(claRes.value.data);
        safeSetLocalStorage('psi_clases_cache', claRes.value.data);
        saveToIndexedDB('clases', claRes.value.data);
      }
      if (apuRes.status === 'fulfilled' && apuRes.value.data) {
        setApuntes(apuRes.value.data);
        safeSetLocalStorage('psi_apuntes_cache', apuRes.value.data);
        saveToIndexedDB('apuntes', apuRes.value.data);
      }
      if (pdfRes.status === 'fulfilled' && pdfRes.value.data) {
        setPdfs(pdfRes.value.data);
        safeSetLocalStorage('psi_pdfs_cache', pdfRes.value.data);
        saveToIndexedDB('documentos_pdf', pdfRes.value.data);
      }
      if (exRes.status === 'fulfilled' && exRes.value.data) {
        setExamenes(exRes.value.data);
        safeSetLocalStorage('psi_examenes_cache', exRes.value.data);
        saveToIndexedDB('examenes', exRes.value.data);
      }
    } catch (err) {
      console.warn('Sync error:', err);
    }
  };

  const enqueueAction = async (action, table, payload) => {
    const item = { id: Date.now(), action, table, payload, timestamp: new Date().toISOString() };
    const newQueue = [...syncQueue, item];
    setSyncQueue(newQueue);
    localStorage.setItem('psi_sync_queue', JSON.stringify(newQueue));
    if (psiDB && psiDB.syncQueue) {
      try {
        await psiDB.syncQueue.add(item);
      } catch (e) {
        console.warn('IndexedDB enqueue error:', e);
      }
    }
  };

  const processSyncQueue = async () => {
    if (!navigator.onLine || !supabaseClient || syncQueue.length === 0) return;
    const queue = [...syncQueue];
    for (const item of queue) {
      try {
        if (item.action === 'INSERT') await supabaseClient.from(item.table).insert([item.payload]);
        if (item.action === 'UPDATE') await supabaseClient.from(item.table).update(item.payload).eq('id', item.payload.id);
        if (item.action === 'DELETE') await supabaseClient.from(item.table).delete().eq('id', item.payload.id);
      } catch (e) {
        console.warn('Queue error:', e);
        return;
      }
    }
    setSyncQueue([]);
    localStorage.setItem('psi_sync_queue', '[]');
    if (psiDB && psiDB.syncQueue) {
      try {
        await psiDB.syncQueue.clear();
      } catch (e) {
        console.warn('IndexedDB syncQueue clear error:', e);
      }
    }
    showToast('Cola sincronizada con Supabase', 'cloud-check');
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
      id: formData.id || 'mat_' + Date.now(),
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
          id: ev.id || ('ex_' + Date.now() + '_' + idx),
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
    if (!confirm('¿Eliminar esta materia y todos sus datos asociados?')) return;
    const updated = materias.filter(m => m.id !== id);
    setMaterias(updated);
    safeSetLocalStorage('psi_materias_cache', updated);
    if (selectedMateriaId === id) setSelectedMateriaId(null);
    showToast('Materia eliminada', 'trash-2');

    if (supabaseClient && isOnline) {
      try { await supabaseClient.from('materias').delete().eq('id', id); }
      catch (e) { enqueueAction('DELETE', 'materias', { id }); }
    } else {
      enqueueAction('DELETE', 'materias', { id });
    }
  };

  const handleSaveBiblio = async (formData) => {
    const isEdit = Boolean(formData.id);
    const payload = {
      ...formData,
      id: formData.id || 'bib_' + Date.now(),
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
    const newItems = parsedItems.map((item, idx) => ({
      ...item,
      id: 'bib_' + Date.now() + '_' + idx,
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
    const updated = biblio.filter(b => b.id !== id);
    setBiblio(updated);
    safeSetLocalStorage('psi_biblio_cache', updated);
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
      id: formData.id || 'cla_' + Date.now(),
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
    const updated = clases.filter(c => c.id !== id);
    setClases(updated);
    safeSetLocalStorage('psi_clases_cache', updated);
    showToast('Clase eliminada', 'trash-2');

    if (supabaseClient && isOnline) {
      try { await supabaseClient.from('clases').delete().eq('id', id); }
      catch (e) { enqueueAction('DELETE', 'clases', { id }); }
    } else {
      enqueueAction('DELETE', 'clases', { id });
    }
  };

  const handleSaveApunte = async (formData) => {
    const isEdit = Boolean(formData.id);
    const targetMatId = formData.materia_id || selectedMateriaId || (materias[0]?.id || null);
    const targetMatObj = materias.find(m => m.id === targetMatId);
    const targetMatName = targetMatObj ? targetMatObj.nombre : (currentMateria ? currentMateria.nombre : 'General');

    const payload = {
      ...formData,
      id: formData.id || 'apu_' + Date.now(),
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
        id: 'pdf_' + Date.now(),
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
        enqueueAction(isEdit ? 'UPDATE' : 'INSERT', 'apuntes', payload);
      }
    } else {
      enqueueAction(isEdit ? 'UPDATE' : 'INSERT', 'apuntes', payload);
    }
  };

  const handleDeleteApunte = async (id) => {
    if (!confirm('¿Eliminar este apunte?')) return;
    const updated = apuntes.filter(a => a.id !== id);
    setApuntes(updated);
    safeSetLocalStorage('psi_apuntes_cache', updated);
    saveToIndexedDB('apuntes', updated);

    // Si también está en pdfs, eliminarlo
    if (pdfs.some(p => p.id === id)) {
      const updatedP = pdfs.filter(p => p.id !== id);
      setPdfs(updatedP);
      safeSetLocalStorage('psi_pdfs_cache', updatedP);
      saveToIndexedDB('documentos_pdf', updatedP);
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
    const updated = pdfs.filter(p => p.id !== id);
    setPdfs(updated);
    safeSetLocalStorage('psi_pdfs_cache', updated);
    saveToIndexedDB('documentos_pdf', updated);
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
    const updated = examenes.filter(e => e.id !== id);
    setExamenes(updated);
    safeSetLocalStorage('psi_examenes_cache', updated);
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
        await supabaseClient.from('supabase_keep_alive').insert([{ ping_source: 'PsiEstudio-Client', status: 'ACTIVE' }]);
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
      <main className="max-w-7xl mx-auto p-3.5 md:p-5 pb-24 md:pb-8">

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
                                <div className="flex flex-wrap gap-1.5">
                                  {grabacionesList.map((g, idx) => (
                                    <a
                                      key={g.id || idx}
                                      href={g.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-2.5 py-1 bg-app-navy-bg text-app-navy text-xs font-bold rounded-xl border border-app-navy/30 flex items-center gap-1.5 hover:brightness-110"
                                    >
                                      <Icon name="play-circle" className="w-3.5 h-3.5" /> {g.title || `Audio ${idx + 1}`}
                                    </a>
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
                            <div className="flex flex-wrap gap-1.5">
                              {grabacionesList.map((g, idx) => (
                                <a
                                  key={g.id || idx}
                                  href={g.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1 bg-app-navy-bg text-app-navy text-xs font-bold rounded-xl border border-app-navy/30 flex items-center gap-1.5 hover:brightness-110"
                                >
                                  <Icon name="play-circle" className="w-3.5 h-3.5" /> {g.title || `Audio ${idx + 1}`}
                                </a>
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
                <Icon name="hard-drive" className="w-5 h-5 text-app-emerald" /> Respaldo y Mantenimiento
              </h3>
              <div className="flex flex-wrap gap-3">
                <button onClick={exportBackupJSON} className="px-4 py-2.5 bg-app-emerald text-white font-bold text-xs rounded-xl shadow-emerald flex items-center gap-2">
                  <Icon name="download" className="w-4 h-4" /> Exportar Backup (JSON)
                </button>
                <button onClick={triggerPing} className="px-4 py-2.5 bg-app-navy text-white font-bold text-xs rounded-xl shadow-card flex items-center gap-2">
                  <Icon name="activity" className="w-4 h-4" /> Ping Keep-Alive Supabase
                </button>
                <button onClick={clearCache} className="px-4 py-2.5 bg-app-ruby-bg text-app-ruby font-bold text-xs rounded-xl border border-app-ruby/30 flex items-center gap-2">
                  <Icon name="trash-2" className="w-4 h-4" /> Limpiar Caché Local
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: SISTEMA ── */}
        {activeTab === 'system' && (
          <div className="space-y-6 animate-fade-in max-w-2xl">
            <h2 className="text-2xl font-extrabold flex items-center gap-2 text-app-text">
              <Icon name="database" className="w-6 h-6 text-app-emerald" size={24} /> Sistema & Conexión Supabase
            </h2>

            <div className="bg-app-card border border-app-border p-4 rounded-xl shadow-card space-y-4">
              <h3 className="text-base font-extrabold text-app-text">Credenciales de Base de Datos</h3>
              <div>
                <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Project URL</label>
                <input value={SUPABASE_CONFIG.url} readOnly className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-xs text-app-muted outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Anon Public Key</label>
                <input value={SUPABASE_CONFIG.key} readOnly type="password" className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-xs text-app-muted outline-none" />
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={triggerPing} className="px-4 py-2.5 bg-app-emerald text-white font-bold text-xs rounded-xl shadow-emerald flex items-center gap-2">
                  <Icon name="activity" className="w-4 h-4" /> Ping de Prueba
                </button>
                <button onClick={processSyncQueue} className="px-4 py-2.5 bg-app-surface border border-app-border font-bold text-xs rounded-xl flex items-center gap-2 text-app-text">
                  <Icon name="refresh-cw" className="w-4 h-4" /> Sincronizar Cola ({syncQueue.length})
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
        />
      )}

      {modalApunte.open && (
        <ModalApunteSplitView
          initialData={modalApunte.data}
          materiaNombre={currentMateria?.nombre || ''}
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

function ModalClase({ initialData, onClose, onSave }) {
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

  const handleAddAudio = () => {
    if (!audioUrlInput.trim()) return;
    const currentList = form.grabaciones || [];
    const item = {
      id: Date.now(),
      url: audioUrlInput.trim(),
      title: audioTitleInput.trim() || `Audio #${currentList.length + 1}`
    };
    setForm({ ...form, grabaciones: [...currentList, item] });
    setAudioUrlInput('');
    setAudioTitleInput('');
    triggerHaptic('light');
  };

  const handleRemoveAudio = (id) => {
    setForm({ ...form, grabaciones: (form.grabaciones || []).filter(a => a.id !== id) });
  };

  const handleAddImageUrl = () => {
    if (!imageUrlInput.trim()) return;
    const currentList = form.imagenes || [];
    const item = {
      id: Date.now(),
      url: imageUrlInput.trim(),
      caption: imageCaptionInput.trim() || `Foto #${currentList.length + 1}`
    };
    setForm({ ...form, imagenes: [...currentList, item] });
    setImageUrlInput('');
    setImageCaptionInput('');
    triggerHaptic('light');
  };

  const handleImageFileUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      const currentList = form.imagenes || [];
      const item = {
        id: Date.now(),
        url: base64,
        caption: file.name.replace(/\.[^/.]+$/, '')
      };
      setForm({ ...form, imagenes: [...currentList, item] });
      triggerHaptic('light');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (id) => {
    setForm({ ...form, imagenes: (form.imagenes || []).filter(img => img.id !== id) });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-2xl max-h-[92vh] flex flex-col rounded-xl p-4 shadow-fluffy space-y-4 overflow-hidden">
        <div className="flex justify-between items-center border-b border-app-border pb-3">
          <div>
            <h3 className="text-xl font-extrabold text-app-text">
              {initialData ? 'Editar Protocolo de Clase' : 'Registrar Protocolo de Clase'}
            </h3>
            <p className="text-xs text-app-muted">Audios, diapositivas, fotos del pizarrón y advertencias de examen.</p>
          </div>
          <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text flex items-center justify-center">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="flex-1 overflow-y-auto space-y-4 pr-1">
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
              <Icon name="alert-triangle" className="w-3.5 h-3.5 text-app-amber" /> Énfasis y Aclaraciones del Docente (Para el Parcial)
            </label>
            <textarea value={form.aclaraciones || ''} onChange={e => setForm({ ...form, aclaraciones: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-xs text-app-text outline-none h-24" placeholder="Conceptos en los que el profesor hizo hincapié, preguntas tentativas de parcial, autores no evaluados..." />
          </div>

          {/* Diapositivas / Contenido de Pizarra */}
          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1 flex items-center gap-1.5">
              <Icon name="presentation" className="w-3.5 h-3.5 text-app-navy" /> Contenido de Diapositivas / Notas de Pizarrón
            </label>
            <textarea value={form.contenido_ppt || ''} onChange={e => setForm({ ...form, contenido_ppt: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-xs text-app-text outline-none h-24 font-mono" placeholder="Esquemas, diapositivas proyectadas o apuntes textuales de clase..." />
          </div>

          {/* Subir Grabaciones de Audio */}
          <div className="bg-app-surface p-4 rounded-lg border border-app-border space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase text-app-emerald flex items-center gap-1.5">
                <Icon name="mic" className="w-4 h-4 text-app-navy" /> Grabaciones de Audio de la Clase ({(form.grabaciones || []).length})
              </label>
            </div>

            <div className="flex gap-2">
              <input
                value={audioTitleInput}
                onChange={e => setAudioTitleInput(e.target.value)}
                placeholder="Título (ej: Audio Parte 1)"
                className="w-1/3 p-2.5 rounded-xl bg-app-card border border-app-border text-xs text-app-text outline-none"
              />
              <input
                value={audioUrlInput}
                onChange={e => setAudioUrlInput(e.target.value)}
                placeholder="Enlace URL del Audio / Drive / Grabadora"
                className="flex-1 p-2.5 rounded-xl bg-app-card border border-app-border text-xs text-app-text outline-none"
              />
              <button
                type="button"
                onClick={handleAddAudio}
                className="px-4 py-2.5 bg-app-navy text-white text-xs font-bold rounded-xl shadow-card hover:brightness-110 flex items-center gap-1"
              >
                <Icon name="plus" className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>

            {(form.grabaciones || []).length > 0 && (
              <div className="space-y-1.5 pt-1">
                {(form.grabaciones || []).map(a => (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded-xl bg-app-card border border-app-border text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <Icon name="music" className="w-4 h-4 text-app-navy shrink-0" />
                      <span className="font-bold text-app-text">{a.title}</span>
                      <span className="text-app-muted text-[11px] truncate">({a.url})</span>
                    </div>
                    <button type="button" onClick={() => handleRemoveAudio(a.id)} className="p-1 text-app-ruby hover:bg-app-ruby-bg rounded-lg">
                      <Icon name="trash-2" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fotos de Pizarrón e Imágenes */}
          <div className="bg-app-surface p-4 rounded-lg border border-app-border space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase text-app-emerald flex items-center gap-1.5">
                <Icon name="camera" className="w-4 h-4 text-app-emerald" /> Fotos de Pizarra / Diapositivas ({(form.imagenes || []).length})
              </label>
              <label className="cursor-pointer px-3 py-1.5 bg-app-emerald-bg text-app-emerald font-bold text-xs rounded-xl border border-app-emerald/30 flex items-center gap-1.5 hover:brightness-110">
                <Icon name="upload" className="w-3.5 h-3.5" /> Subir desde Cámara / Galería
                <input type="file" accept="image/*" className="hidden" onChange={handleImageFileUpload} />
              </label>
            </div>

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
                placeholder="O pega el link URL de la foto"
                className="flex-1 p-2.5 rounded-xl bg-app-card border border-app-border text-xs text-app-text outline-none"
              />
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="px-4 py-2.5 bg-app-emerald text-white text-xs font-bold rounded-xl shadow-emerald hover:brightness-110 flex items-center gap-1"
              >
                <Icon name="plus" className="w-3.5 h-3.5" /> Añadir
              </button>
            </div>

            {(form.imagenes || []).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {(form.imagenes || []).map(img => (
                  <div key={img.id} className="relative rounded-xl overflow-hidden border border-app-border group">
                    <img src={img.url} alt={img.caption} className="w-full h-24 object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[10px] p-1 truncate text-center font-bold">
                      {img.caption}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute top-1 right-1 p-1 bg-black/80 text-white rounded-lg hover:bg-app-ruby transition-colors"
                    >
                      <Icon name="x" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Link Resumen / Documento */}
          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Enlace a Documento / Apunte de Clase</label>
            <input
              value={form.link_doc_resumen || ''}
              onChange={e => setForm({ ...form, link_doc_resumen: e.target.value })}
              className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-xs text-app-text outline-none"
              placeholder="https://docs.google.com/..."
            />
          </div>

          <button type="submit" className="w-full py-3.5 bg-app-emerald text-white font-extrabold text-sm rounded-xl shadow-emerald hover:brightness-110">
            {initialData ? 'Actualizar Protocolo de Clase' : 'Guardar Protocolo de Clase'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ModalApunteSplitView({ initialData, materiaNombre = '', availableUnits = [], onClose, onSave, showToast }) {
  const [form, setForm] = useState(initialData || {
    titulo: '', tipo: 'Resumen', unidad: availableUnits[0] || 'Unidad 1', va_parcial: false, contenido: ''
  });
  const [viewMode, setViewMode] = useState(initialData?.pdfData ? 'double_page' : 'split'); // 'split' | 'double_page'
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  const [compiledPDF, setCompiledPDF] = useState(() => {
    if (initialData?.pdfData) {
      const src = typeof initialData.pdfData === 'string' ? initialData.pdfData : (initialData.pdfData instanceof Blob ? URL.createObjectURL(initialData.pdfData) : null);
      if (src) {
        return {
          blobUrl: src,
          fileName: initialData.pdfName || initialData.nombre_archivo || `${initialData.titulo || 'Documento'}.pdf`,
          pageCount: initialData.num_paginas || initialData.numPages || 1,
          isDirectPDF: true
        };
      }
    }
    return null;
  });

  const textareaRef = useRef(null);
  const pdfImportRef = useRef(null);

  const handleCompilePDF = async (forceDownload = false) => {
    if (form.pdfData && (!form.contenido || form.contenido.trim().length === 0)) {
      if (showToast) showToast('Mostrando PDF original cargado', 'check-circle');
      return compiledPDF;
    }
    if (!form.contenido?.trim()) {
      if (showToast) showToast('El apunte no tiene contenido para generar PDF.', 'alert-triangle');
      return null;
    }
    setIsGeneratingPDF(true);
    triggerHaptic('medium');
    try {
      const res = await generateAcademicPDFBlob({
        materia: materiaNombre || form.materia || '',
        unidad: form.unidad || 'Unidad 1',
        titulo: form.titulo || 'Resumen Académico',
        contenido: form.contenido
      });
      setCompiledPDF(res);
      setIsGeneratingPDF(false);

      if (forceDownload) {
        const a = document.createElement('a');
        a.href = res.blobUrl;
        a.download = res.fileName;
        a.click();
        if (showToast) showToast(`PDF descargado con éxito (${res.pageCount} págs)`, 'download');
      } else {
        if (showToast) showToast(`PDF listo para ver (${res.pageCount} págs)`, 'check-circle');
      }
      return res;
    } catch (err) {
      console.error('Error generando PDF:', err);
      setIsGeneratingPDF(false);
      if (showToast) showToast('Error al generar PDF: ' + err.message, 'alert-triangle');
      return null;
    }
  };

  const handleDownloadNormal = async () => {
    // 1. Si es un PDF ya subido intacto y no se editó texto, descargar el original exacto
    if (form.pdfData && (!form.contenido || form.contenido.trim().length === 0)) {
      downloadPDFHelper({
        pdfData: form.pdfData,
        fileName: form.pdfName || form.nombre_archivo || form.titulo,
        twoColumns: false,
        showToast
      });
      return;
    }

    // 2. Si es texto escrito en el editor, compilar con motor exacto de Scanner OCR
    if (!form.contenido?.trim()) {
      if (showToast) showToast('El apunte no tiene contenido para generar PDF.', 'alert-triangle');
      return;
    }
    setIsGeneratingPDF(true);
    triggerHaptic('medium');
    try {
      const res = await generateAcademicPDFBlob({
        materia: materiaNombre || form.materia || '',
        unidad: form.unidad || 'Unidad 1',
        titulo: form.titulo || 'Resumen Académico',
        contenido: form.contenido
      });
      setCompiledPDF(res);

      const a = document.createElement('a');
      a.href = res.blobUrl;
      a.download = res.fileName;
      a.click();

      const reader = new FileReader();
      reader.onloadend = () => {
        onSave({
          ...form,
          pdfName: res.fileName,
          numPages: res.pageCount,
          saveToPdfDocs: true,
          pdfData: reader.result
        });
      };
      reader.readAsDataURL(res.blob);

      if (showToast) showToast(`PDF Normal descargado (${res.pageCount} págs)`, 'download');
    } catch (err) {
      console.error('Error generando PDF:', err);
      if (showToast) showToast('Error al generar PDF: ' + err.message, 'alert-triangle');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDownloadTwoColumns = async () => {
    // 1. Si es un PDF ya subido y no se editó texto, convertir ese PDF exacto a 2 páginas por hoja
    if (form.pdfData && (!form.contenido || form.contenido.trim().length === 0)) {
      setIsGeneratingPDF(true);
      await downloadPDFHelper({
        pdfData: form.pdfData,
        fileName: form.pdfName || form.nombre_archivo || form.titulo,
        twoColumns: true,
        showToast
      });
      setIsGeneratingPDF(false);
      return;
    }

    // 2. Si es texto de editor, compilar con Scanner OCR y convertir a 2 columnas
    if (!form.contenido?.trim()) {
      if (showToast) showToast('El apunte no tiene contenido para generar PDF.', 'alert-triangle');
      return;
    }
    setIsGeneratingPDF(true);
    triggerHaptic('medium');
    try {
      const res = await generateAcademicPDFBlob({
        materia: materiaNombre || form.materia || '',
        unidad: form.unidad || 'Unidad 1',
        titulo: form.titulo || 'Resumen Académico',
        contenido: form.contenido
      });

      const twoColBlob = await convertPDFToTwoColumns(res.blob);
      const twoColUrl = URL.createObjectURL(twoColBlob);
      const cleanBase = (res.fileName || 'Apunte').replace(/\.pdf$/i, '');
      const twoColName = `${cleanBase} (2 Paginas por hoja).pdf`;

      const a = document.createElement('a');
      a.href = twoColUrl;
      a.download = twoColName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(twoColUrl), 10000);

      const reader = new FileReader();
      reader.onloadend = () => {
        onSave({
          ...form,
          pdfName: twoColName,
          numPages: res.pageCount,
          saveToPdfDocs: true,
          pdfData: reader.result
        });
      };
      reader.readAsDataURL(twoColBlob);

      if (showToast) showToast(`PDF 2 Págs / Hoja descargado`, 'download');
    } catch (err) {
      console.error('Error generando PDF 2 columnas:', err);
      if (showToast) showToast('Error al procesar formato 2 páginas: ' + err.message, 'alert-triangle');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSaveOnly = () => {
    onSave(form);
    if (showToast) showToast('Apunte guardado con éxito', 'check-circle');
    onClose();
  };

  const handleImportPDF = (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;
    if (showToast) showToast('Extrayendo texto del PDF...', 'loader');
    const cleanName = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ').trim();
    const reader = new FileReader();
    reader.onload = async function() {
      try {
        const typedArray = new Uint8Array(this.result);
        if (window.pdfjsLib) {
          try {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          } catch(e) {}
        }
        const pdf = await window.pdfjsLib.getDocument({ data: typedArray }).promise;
        let fullText = `# ${form.titulo || cleanName}\n\n`;
        const maxPages = Math.min(pdf.numPages, 30);
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ').trim();
          if (pageText) {
            fullText += `### Página ${i}\n${pageText}\n\n`;
          }
        }
        setForm(prev => ({
          ...prev,
          titulo: prev.titulo || cleanName,
          contenido: fullText
        }));
        if (showToast) showToast(`Texto extraído con éxito (${maxPages} págs)`, 'check-circle');
      } catch (err) {
        console.error('Error procesando PDF a texto:', err);
        if (showToast) showToast('Error al procesar PDF: ' + err.message, 'alert-triangle');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleContentChange = (newContent) => {
    const titleMatch = newContent.match(/^#\s+(.+)$/m);
    if (titleMatch && titleMatch[1]) {
      const extracted = titleMatch[1].trim();
      setForm(prev => ({ ...prev, contenido: newContent, titulo: extracted }));
    } else {
      setForm(prev => ({ ...prev, contenido: newContent }));
    }
  };

  const handlePaste = (e) => {
    const textPasted = e.clipboardData.getData('text');
    if (textPasted && textPasted.length > 30) {
      triggerHaptic('light');
    }
  };

  const handleCopyPrompt = () => {
    const promptText = `Actúa como un profesor universitario experto en ${materiaNombre || 'la materia'}. Estructura y desarrolla un apunte exhaustivo, riguroso y conceptualmente denso basado en los siguientes temas, utilizando la sintaxis estricta de Scanner OCR:

1. TÍTULOS Y JERARQUÍA:
- Título principal con '# TÍTULO'
- Subtítulos principales con '## Título'
- Subtítulos secundarios con '### Subtítulo'

2. CONTENIDO Y FORMATO:
- Viñetas de primer nivel con '• Texto' (resalta conceptos clave con **negritas**)
- Viñetas de segundo nivel con '  ◦ Subdetalle'
- Redacta explicaciones teóricas extensas, completas y fieles al autor (sin recortes superficiales).

3. TABLAS Y CUADROS COMPARATIVOS (MUY IMPORTANTE):
- Cuando haya protocolos, clasificaciones, baremos, comparación de subtests, puntuaciones o pasos de análisis, genera SIEMPRE tablas Markdown estructuradas:
| Columna 1 | Columna 2 | Columna 3 |
|---|---|---|
| Fila 1 | Dato A | Dato B |
| Fila 2 | Dato C | Dato D |

4. FIGURAS Y FÓRMULAS:
- Para esquemas o gráficos usa '[imagen 1: Descripción de la lámina]'
- Para fórmulas matemáticas o estadísticas usa '$f(x)$' o '$$ecuación$$'`;

    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    triggerHaptic('success');
    if (showToast) showToast('¡Prompt con soporte de Tablas copiado!', 'sparkles');
    setTimeout(() => setCopiedPrompt(false), 3000);
  };

  const insertSyntax = (prefix, suffix = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = form.contenido || '';
    const selected = current.substring(start, end);
    const updated = current.substring(0, start) + prefix + selected + suffix + current.substring(end);
    setForm(prev => ({ ...prev, contenido: updated }));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-6xl h-[94vh] flex flex-col rounded-xl p-5 sm:p-4 shadow-fluffy space-y-3 sm:space-y-4 overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-app-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-app-emerald-bg text-app-emerald border border-app-emerald/20">
                {materiaNombre || 'Cátedra'}
              </span>
              <span className="text-xs text-app-muted font-bold">• {form.unidad}</span>
              {form.pdfData && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-app-navy-bg text-app-navy border border-app-navy/20">
                  PDF Original Vinculado
                </span>
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-black text-app-text mt-0.5 truncate max-w-lg">
              {form.titulo || (initialData ? 'Editar Apunte' : 'Nuevo Apunte Académico')}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-app-surface p-1 rounded-lg border border-app-border">
              <button
                type="button"
                onClick={() => { setViewMode('split'); triggerHaptic('light'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'split' ? 'bg-app-card text-app-emerald shadow-card border border-app-border' : 'text-app-muted hover:text-app-text'
                }`}
              >
                <Icon name="columns" className="w-3.5 h-3.5" /> Editor Split
              </button>
              <button
                type="button"
                onClick={() => { setViewMode('double_page'); triggerHaptic('light'); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'double_page' ? 'bg-app-card text-app-emerald shadow-card border border-app-border' : 'text-app-muted hover:text-app-text'
                }`}
              >
                <Icon name="book-open" className="w-3.5 h-3.5" /> Hoja Doble / PDF
              </button>
            </div>

            {/* Import PDF Button */}
            <input
              type="file"
              ref={pdfImportRef}
              accept="application/pdf"
              className="hidden"
              onChange={handleImportPDF}
            />
            <button
              type="button"
              onClick={() => pdfImportRef.current?.click()}
              className="px-3 py-2 rounded-lg text-xs font-extrabold border bg-app-surface border-app-border text-app-navy hover:border-app-navy transition-all flex items-center gap-1.5 shadow-sm"
              title="Importar y extraer texto desde un archivo PDF"
            >
              <Icon name="upload-cloud" className="w-4 h-4 text-app-navy" />
              <span>Importar PDF</span>
            </button>

            {/* Prompt Copy Button */}
            <button
              type="button"
              onClick={handleCopyPrompt}
              className={`px-3.5 py-2 rounded-lg text-xs font-extrabold border transition-all flex items-center gap-1.5 shadow-sm ${
                copiedPrompt
                  ? 'bg-app-emerald text-white border-app-emerald'
                  : 'bg-app-surface border-app-border text-app-emerald hover:border-app-emerald'
              }`}
            >
              <Icon name={copiedPrompt ? "check" : "sparkles"} className="w-4 h-4" />
              <span>{copiedPrompt ? "¡Prompt Copiado!" : "Copiar Prompt IA"}</span>
            </button>

            {/* Descargar Normal A4 Button */}
            <button
              type="button"
              onClick={handleDownloadNormal}
              disabled={isGeneratingPDF}
              className="px-3 py-2 bg-app-surface border border-app-border hover:border-app-navy text-app-navy rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-all"
              title="Descargar PDF normal en A4"
            >
              <Icon name="download" className="w-3.5 h-3.5 text-app-navy" />
              <span className="hidden sm:inline">⬇ Normal</span>
            </button>

            {/* Descargar 2 Págs / Hoja Button */}
            <button
              type="button"
              onClick={handleDownloadTwoColumns}
              disabled={isGeneratingPDF}
              className="px-3 py-2 bg-app-navy text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-card hover:brightness-110 disabled:opacity-50 transition-all"
              title="Descargar en formato 2 páginas por hoja (apuntes imprimibles)"
            >
              <Icon name="book-open" className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">📖 2 Págs / Hoja</span>
            </button>

            {/* Guardar Apunte Button */}
            <button
              type="button"
              onClick={handleSaveOnly}
              className="px-3 py-2 bg-app-emerald text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-emerald hover:brightness-110"
              title="Guardar apunte en la base de datos"
            >
              <Icon name="check" className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">Guardar</span>
            </button>

            <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text flex items-center justify-center">
              <Icon name="x" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 1. SPLIT VIEW MODE ── */}
        {viewMode === 'split' && (
          <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 bg-app-surface border border-app-border rounded-lg">
              <div className="flex flex-wrap gap-1 items-center">
                <button type="button" onClick={() => insertSyntax('**', '**')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold hover:border-app-emerald">B</button>
                <button type="button" onClick={() => insertSyntax('*', '*')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs italic font-bold hover:border-app-emerald">I</button>
                <button type="button" onClick={() => insertSyntax('## ')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold hover:border-app-emerald">H2</button>
                <button type="button" onClick={() => insertSyntax('### ')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold hover:border-app-emerald">H3</button>
                <button type="button" onClick={() => insertSyntax('• ')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold hover:border-app-emerald">• Viñeta</button>
                <button type="button" onClick={() => insertSyntax('  ◦ ')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold hover:border-app-emerald">◦ Subviñeta</button>
                <button type="button" onClick={() => insertSyntax('> ')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold hover:border-app-emerald">Cita</button>
                <button type="button" onClick={() => insertSyntax('[imagen 1: ', ']')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold text-app-emerald hover:border-app-emerald">Figura</button>
                <button type="button" onClick={() => insertSyntax('| Columna 1 | Columna 2 | Columna 3 |\n|---|---|---|\n| Dato A | Dato B | Dato C |\n')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold text-app-navy hover:border-app-navy">📊 Tabla</button>
                <div className="h-4 w-px bg-app-border mx-1"></div>
                <button type="button" onClick={() => insertSyntax('$', '$')} title="Fórmula en línea (LaTeX)" className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-mono font-bold text-app-navy hover:border-app-navy">$f(x)$</button>
                <button type="button" onClick={() => insertSyntax('$$\n', '\n$$')} title="Ecuación en bloque (LaTeX)" className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-mono font-bold text-app-navy hover:border-app-navy">$$\Sigma$$</button>
              </div>
              
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const template = `# ${form.titulo || 'TÍTULO DEL TEXTO'}\n\n## Introducción\nEl presente texto aborda de manera sistemática...\n\n## Primer Núcleo Temático\nExplicación fiel, desarrollada y extensa de cada punto conceptual...\n\n• Concepto clave de primer nivel.\n  ◦ Subclasificación o matiz teórico específico.\n\n[imagen 1: Esquema de articulación conceptual]\n`;
                    setForm({ ...form, contenido: (form.contenido || '') + template });
                    triggerHaptic('light');
                  }}
                  className="px-3 py-1 rounded-xl bg-app-emerald-bg border border-app-emerald/30 text-xs font-extrabold text-app-emerald hover:brightness-110 flex items-center gap-1"
                >
                  <Icon name="sparkles" className="w-3.5 h-3.5" /> Plantilla Scanner OCR
                </button>
              </div>
            </div>

            {/* Split View Editor & Live Preview */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
              <textarea
                ref={textareaRef}
                value={form.contenido}
                onPaste={handlePaste}
                onChange={e => handleContentChange(e.target.value)}
                placeholder="Pega aquí el código Markdown generado por la IA (el título se extraerá automáticamente desde #)..."
                className="w-full h-full p-4 rounded-lg bg-app-surface border border-app-border text-xs sm:text-sm text-app-text outline-none font-mono resize-none overflow-y-auto leading-relaxed"
              />

              <div
                className="w-full h-full p-5 rounded-lg bg-app-card border border-app-border overflow-y-auto prose dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: parseMarkdownToHTML(form.contenido) || '<span class="text-app-muted italic">La vista previa en vivo aparecerá aquí...</span>' }}
              />
            </div>
          </div>
        )}

        {/* ── 2. HOJA DOBLE / NEUROSCAN PDF PRINT PREVIEW MODE ── */}
        {viewMode === 'double_page' && (
          <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
            {/* Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-app-surface border border-app-border rounded-xl">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCompilePDF(false)}
                  disabled={isGeneratingPDF}
                  className="px-3.5 py-1.5 bg-app-card border border-app-emerald/40 text-app-emerald rounded-lg text-xs font-bold hover:border-app-emerald flex items-center gap-1.5"
                >
                  <Icon name={isGeneratingPDF ? "refresh-cw" : "play"} className={`w-3.5 h-3.5 ${isGeneratingPDF ? 'animate-spin' : ''}`} />
                  <span>{compiledPDF ? "Recompilar PDF" : "Compilar y Ver PDF"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadNormal}
                  disabled={isGeneratingPDF}
                  className="px-3.5 py-1.5 bg-app-surface border border-app-border text-app-navy rounded-xl text-xs font-extrabold flex items-center gap-1.5 hover:border-app-navy shadow-sm"
                >
                  <Icon name="download" className="w-3.5 h-3.5 text-app-navy" /> ⬇ Normal
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTwoColumns}
                  disabled={isGeneratingPDF}
                  className="px-3.5 py-1.5 bg-app-navy text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-card hover:brightness-110"
                >
                  <Icon name="book-open" className="w-3.5 h-3.5" /> 📖 2 Págs / Hoja
                </button>
                <button
                  type="button"
                  onClick={handleSaveOnly}
                  className="px-3.5 py-1.5 bg-app-emerald text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-emerald hover:brightness-110"
                >
                  <Icon name="check" className="w-3.5 h-3.5" /> Guardar
                </button>
              </div>
            </div>

            {/* Live PDF Viewer */}
            <div className="flex-1 overflow-hidden p-2 bg-slate-900/60 rounded-xl border border-app-border flex flex-col items-center justify-center">
              {compiledPDF ? (
                <div className="w-full h-full flex flex-col space-y-1">
                  <div className="flex justify-between items-center text-xs px-2 text-app-muted">
                    <span className="font-bold text-app-emerald flex items-center gap-1">
                      <Icon name="check-circle" className="w-3.5 h-3.5" /> {compiledPDF.isDirectPDF ? 'Documento PDF Original Vinculado' : `Documento Vectorial PDF Listo (${compiledPDF.pageCount} páginas)`}
                    </span>
                    <span className="truncate max-w-xs">{compiledPDF.fileName}</span>
                  </div>
                  <iframe
                    src={compiledPDF.blobUrl}
                    className="w-full flex-1 rounded-xl border-0 bg-white"
                    title="Visor PDF Académico"
                  />
                </div>
              ) : (
                <div className="max-w-md mx-auto text-center p-8 bg-app-card border border-app-border rounded-xl shadow-card space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-app-emerald-bg text-app-emerald flex items-center justify-center mx-auto border border-app-emerald/20">
                    <Icon name="file-text" className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-black text-app-text">Visualizador de PDF Scanner OCR</h4>
                  <p className="text-xs text-app-muted">
                    Compila este apunte con el diseño editorial exacto de Scanner OCR o visualiza el archivo PDF original cargado.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCompilePDF(false)}
                    disabled={isGeneratingPDF}
                    className="w-full py-2.5 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald hover:brightness-110 flex items-center justify-center gap-2"
                  >
                    <Icon name="sparkles" className="w-4 h-4" /> Generar y Ver PDF Directamente
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
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

  const formatTime = (seconds) => {
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
          <div className="text-5xl font-black font-mono tracking-wider text-app-text">{formatTime(timeLeft)}</div>
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

// ── 6. ERROR BOUNDARY ANTI-BLANK-SCREEN ──
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

  handleCleanCorruptedCache = () => {
    try {
      localStorage.removeItem('psi_apuntes_cache');
      localStorage.removeItem('psi_pdfs_cache');
      localStorage.removeItem('psi_sync_queue');
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-app-base text-app-text flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-app-card border border-app-border p-6 sm:p-8 rounded-2xl shadow-fluffy text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-app-amber-bg text-app-amber border border-app-amber/30 flex items-center justify-center">
              <Icon name="alert-triangle" className="w-7 h-7 text-app-amber" size={28} />
            </div>
            <h2 className="text-xl font-black text-app-text">PsiEstudio • Recuperación Automática</h2>
            <p className="text-xs text-app-muted leading-relaxed">
              Se detectó un problema en los datos cacheados localmente. Tu información en Supabase e IndexedDB permanece a salvo.
            </p>
            <div className="p-3 bg-app-surface border border-app-border rounded-xl text-left overflow-x-auto max-h-32 text-xs font-mono text-app-ruby">
              {this.state.error?.message || String(this.state.error)}
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleCleanCorruptedCache}
                className="w-full py-3 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald hover:brightness-110 flex items-center justify-center gap-2"
              >
                <Icon name="refresh-cw" className="w-4 h-4" /> Limpiar Caché y Reabrir
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-2.5 bg-app-surface border border-app-border text-app-muted hover:text-app-text font-bold text-xs rounded-xl"
              >
                Reintentar sin limpiar
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
