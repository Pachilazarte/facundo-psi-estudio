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

// ── 2. LUCIDE SVG ICON WRAPPER (ZERO EMOJIS) ──
const Icon = ({ name, className = "w-4 h-4", size = 18 }) => {
  const iconRef = useRef(null);

  useEffect(() => {
    if (window.lucide && iconRef.current) {
      window.lucide.createIcons();
    }
  }, [name]);

  return <i ref={iconRef} data-lucide={name} className={className} style={{ width: size, height: size, display: 'inline-block' }}></i>;
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
    return `<div class="my-4 p-4 rounded-2xl bg-app-surface border border-app-border text-center shadow-sm break-inside-avoid">
      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-app-emerald-bg text-app-emerald text-xs font-extrabold border border-app-emerald/20">
        <i data-lucide="image" class="w-3.5 h-3.5 inline-block"></i> FIGURA ${num}
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

// ── 4. MAIN APP ──
function App() {
  const [theme, setTheme] = useState(localStorage.getItem('psi_theme') || 'light');
  const [activeTab, setActiveTab] = useState('materias'); // 'materias', 'pdf', 'perfil', 'system'
  const [selectedMateriaId, setSelectedMateriaId] = useState(null);
  const [innerTab, setInnerTab] = useState('params');
  const [biblioFilter, setBiblioFilter] = useState('todos');

  // Academic State (local cache)
  const [materias, setMaterias] = useState(() => JSON.parse(localStorage.getItem('psi_materias_cache') || '[]'));
  const [biblio, setBiblio] = useState(() => JSON.parse(localStorage.getItem('psi_biblio_cache') || '[]'));
  const [clases, setClases] = useState(() => JSON.parse(localStorage.getItem('psi_clases_cache') || '[]'));
  const [apuntes, setApuntes] = useState(() => JSON.parse(localStorage.getItem('psi_apuntes_cache') || '[]'));
  const [pdfs, setPdfs] = useState(() => JSON.parse(localStorage.getItem('psi_pdfs_cache') || '[]'));
  const [examenes, setExamenes] = useState(() => JSON.parse(localStorage.getItem('psi_examenes_cache') || '[]'));

  // Connectivity & Modals
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState(() => JSON.parse(localStorage.getItem('psi_sync_queue') || '[]'));
  const [toast, setToast] = useState({ show: false, msg: '', iconName: 'check-circle' });
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const currentVersion = 'v2.7.0';

  const [modalMateria, setModalMateria] = useState({ open: false, data: null });
  const [modalBiblio, setModalBiblio] = useState({ open: false, data: null });
  const [modalBiblioBatch, setModalBiblioBatch] = useState(false);
  const [modalClase, setModalClase] = useState({ open: false, data: null });
  const [modalApunte, setModalApunte] = useState({ open: false, data: null });
  const [modalExamen, setModalExamen] = useState({ open: false, data: null });
  const [modalPDFViewer, setModalPDFViewer] = useState({ open: false, data: null });
  const [modalSearch, setModalSearch] = useState(false);
  const [modalPomodoro, setModalPomodoro] = useState(false);
  const [modalFlashcards, setModalFlashcards] = useState({ open: false, items: [], title: '' });

  const [ingestionData, setIngestionData] = useState(null);

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
    localStorage.setItem('psi_materias_cache', JSON.stringify(initialMats));
    localStorage.setItem('psi_biblio_cache', JSON.stringify(initialBib));
    localStorage.setItem('psi_examenes_cache', JSON.stringify(initialExams));
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
        if (apus.length > 0) setApuntes(apus);
        if (pdfsList.length > 0) setPdfs(pdfsList);
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
        localStorage.setItem('psi_materias_cache', JSON.stringify(matsRes.value.data));
        saveToIndexedDB('materias', matsRes.value.data);
      }
      if (bibRes.status === 'fulfilled' && bibRes.value.data) {
        setBiblio(bibRes.value.data);
        localStorage.setItem('psi_biblio_cache', JSON.stringify(bibRes.value.data));
        saveToIndexedDB('bibliografia', bibRes.value.data);
      }
      if (claRes.status === 'fulfilled' && claRes.value.data) {
        setClases(claRes.value.data);
        localStorage.setItem('psi_clases_cache', JSON.stringify(claRes.value.data));
        saveToIndexedDB('clases', claRes.value.data);
      }
      if (apuRes.status === 'fulfilled' && apuRes.value.data) {
        setApuntes(apuRes.value.data);
        localStorage.setItem('psi_apuntes_cache', JSON.stringify(apuRes.value.data));
        saveToIndexedDB('apuntes', apuRes.value.data);
      }
      if (pdfRes.status === 'fulfilled' && pdfRes.value.data) {
        setPdfs(pdfRes.value.data);
        localStorage.setItem('psi_pdfs_cache', JSON.stringify(pdfRes.value.data));
        saveToIndexedDB('documentos_pdf', pdfRes.value.data);
      }
      if (exRes.status === 'fulfilled' && exRes.value.data) {
        setExamenes(exRes.value.data);
        localStorage.setItem('psi_examenes_cache', JSON.stringify(exRes.value.data));
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
    localStorage.setItem('psi_materias_cache', JSON.stringify(updated));
    setModalMateria({ open: false, data: null });
    showToast(isEdit ? 'Materia actualizada' : 'Materia creada', 'book');

    if (supabaseClient && isOnline) {
      try {
        if (isEdit) await supabaseClient.from('materias').update(payload).eq('id', payload.id);
        else await supabaseClient.from('materias').insert([payload]);
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
    localStorage.setItem('psi_materias_cache', JSON.stringify(updated));
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
    localStorage.setItem('psi_biblio_cache', JSON.stringify(updated));
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
    localStorage.setItem('psi_biblio_cache', JSON.stringify(updated));
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
    localStorage.setItem('psi_biblio_cache', JSON.stringify(updated));

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
    localStorage.setItem('psi_biblio_cache', JSON.stringify(updated));
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
    localStorage.setItem('psi_clases_cache', JSON.stringify(updated));
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
    localStorage.setItem('psi_clases_cache', JSON.stringify(updated));
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
    const payload = {
      ...formData,
      id: formData.id || 'apu_' + Date.now(),
      materia_id: selectedMateriaId,
      materia: currentMateria ? currentMateria.nombre : 'General',
      created_at: formData.created_at || new Date().toISOString()
    };

    const updated = isEdit ? apuntes.map(a => a.id === payload.id ? payload : a) : [payload, ...apuntes];
    setApuntes(updated);
    localStorage.setItem('psi_apuntes_cache', JSON.stringify(updated));
    setModalApunte({ open: false, data: null });
    showToast('Apunte guardado en Supabase', 'file-edit');

    if (supabaseClient && isOnline) {
      try {
        if (isEdit) await supabaseClient.from('apuntes').update(payload).eq('id', payload.id);
        else await supabaseClient.from('apuntes').insert([payload]);
      } catch (e) {
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
    localStorage.setItem('psi_apuntes_cache', JSON.stringify(updated));
    showToast('Apunte eliminado', 'trash-2');

    if (supabaseClient && isOnline) {
      try { await supabaseClient.from('apuntes').delete().eq('id', id); }
      catch (e) { enqueueAction('DELETE', 'apuntes', { id }); }
    } else {
      enqueueAction('DELETE', 'apuntes', { id });
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
    localStorage.setItem('psi_examenes_cache', JSON.stringify(updated));
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
    localStorage.setItem('psi_examenes_cache', JSON.stringify(updated));
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
    localStorage.setItem('psi_pdfs_cache', JSON.stringify(updatedPdfs));
    localStorage.setItem('psi_biblio_cache', JSON.stringify(updatedBib));
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
      
      {/* ══ HEADER ══ */}
      <header className="sticky top-0 z-40 bg-app-base/90 backdrop-blur-xl border-b border-app-border px-4 md:px-8 py-3 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setActiveTab('materias'); setSelectedMateriaId(null); }}>
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white shadow-emerald border border-white/20">
              <Icon name="graduation-cap" className="w-5 h-5 text-white" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none text-app-text">
                PsiEstudio
              </h1>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-app-emerald">
                Academic Management Suite
              </span>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <div className="hidden md:flex items-center gap-1.5 p-1 bg-app-surface border border-app-border rounded-2xl">
            {[
              { id: 'materias', label: 'Aulas & Materias', icon: 'book-open' },
              { id: 'pdf', label: 'Ingestión PDF', icon: 'file-text' },
              { id: 'perfil', label: 'Mi Perfil', icon: 'user' },
              { id: 'system', label: 'Sistema', icon: 'cpu' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedMateriaId(null); }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-app-card text-app-emerald shadow-card border border-app-border'
                    : 'text-app-muted hover:text-app-text'
                }`}
              >
                <Icon name={tab.icon} className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Global Search Button */}
            <button
              onClick={() => setModalSearch(true)}
              className="px-3 py-1.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold text-app-text hover:border-app-emerald transition-all shadow-card flex items-center gap-1.5"
              title="Buscar en todas las materias y textos"
            >
              <Icon name="search" className="w-3.5 h-3.5 text-app-emerald" />
              <span className="hidden sm:inline">Buscar...</span>
            </button>

            {/* Pomodoro Timer Button */}
            <button
              onClick={() => setModalPomodoro(true)}
              className="w-9 h-9 rounded-xl bg-app-card border border-app-border flex items-center justify-center text-app-text hover:border-app-amber transition-all shadow-card hover:scale-105"
              title="Temporizador Pomodoro de Estudio"
            >
              <Icon name="timer" className="w-4 h-4 text-app-amber" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="w-9 h-9 rounded-xl bg-app-card border border-app-border flex items-center justify-center text-app-text hover:border-app-emerald transition-all shadow-card hover:scale-105"
              title="Alternar Modo Crema / Oscuro"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="w-4 h-4 text-app-text" />
            </button>

            {/* Supabase Status */}
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-app-card border border-app-border shadow-card ${isOnline ? 'text-app-emerald' : 'text-app-ruby'}`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-app-emerald shadow-[0_0_8px_var(--color-emerald-main)]' : 'bg-app-ruby'}`}></span>
              <span className="hidden sm:inline">{isOnline ? 'Cloud Activo' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ══ MOBILE BOTTOM NAVIGATION DOCK (100% NATIVE MOBILE VIEW) ══ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-app-card/95 backdrop-blur-xl border-t border-app-border px-3 pt-2 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))] flex justify-around items-center shadow-fluffy">
        {[
          { id: 'materias', label: 'Aulas', icon: 'book-open' },
          { id: 'pdf', label: 'PDF OCR', icon: 'file-text' },
          { id: 'perfil', label: 'Mi Perfil', icon: 'user' },
          { id: 'system', label: 'Sistema', icon: 'cpu' },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); if (tab.id !== 'materias') setSelectedMateriaId(null); }}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
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
      </nav>

      {/* ══ MAIN VIEW CONTAINER ══ */}
      <main className="max-w-7xl mx-auto p-3.5 md:p-8 pb-28 md:pb-16">

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
                className="bg-gradient-to-r from-app-surface to-app-card border border-app-border hover:border-app-emerald p-4 sm:p-5 rounded-2xl shadow-fluffy flex items-center gap-3.5 cursor-pointer transition-all hover:-translate-y-0.5"
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
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-app-amber-bg text-app-amber border border-app-amber/30">
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
                    className="bg-app-card border border-app-border hover:border-app-emerald p-5 sm:p-6 rounded-3xl shadow-card hover:shadow-fluffy transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-app-emerald-bg text-app-emerald border border-app-emerald/30 uppercase tracking-wider">
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
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-3 border-t border-app-border text-xs text-app-muted font-bold">
                      <span className="px-2.5 py-1 rounded-full bg-app-surface border border-app-border flex items-center gap-1">
                        <Icon name="book-open" className="w-3.5 h-3.5" /> {textsInMat.length} textos
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-app-surface border border-app-border flex items-center gap-1">
                        <Icon name="presentation" className="w-3.5 h-3.5" /> {clasesCount} clases
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-app-surface border border-app-border flex items-center gap-1">
                        <Icon name="file-edit" className="w-3.5 h-3.5" /> {apuntesCount} apuntes
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB: AULA / MATERIA DETALLE ── */}
        {activeTab === 'materias' && selectedMateriaId && currentMateria && (
          <div className="space-y-5 animate-fade-in">
            
            {/* Aula Header & Quick Actions Card */}
            <div className="bg-app-card border border-app-border p-4 sm:p-6 rounded-3xl shadow-card space-y-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedMateriaId(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-app-surface border border-app-border hover:border-app-emerald text-xs font-bold text-app-text flex items-center gap-1.5 shadow-card transition-all"
                >
                  <Icon name="arrow-left" className="w-3.5 h-3.5" /> Volver a Aulas
                </button>
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-app-emerald-bg text-app-emerald border border-app-emerald/30 uppercase tracking-wider">
                  {currentMateria.abreviatura || 'MAT'}
                </span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-app-text leading-tight">{currentMateria.nombre}</h2>
                <p className="text-xs text-app-muted mt-1 flex items-center gap-1.5">
                  <Icon name="user" className="w-3.5 h-3.5 text-app-emerald" /> {currentMateria.docente || 'Docente no asignado'} • {currentMateria.cuatrimestre === 0 ? 'Anual' : `${currentMateria.cuatrimestre}° Cuatrimestre`}
                </p>
              </div>

              {/* Acciones Rápidas en Grid Móvil */}
              <div className="pt-3 border-t border-app-border">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-app-emerald mb-2 flex items-center gap-1">
                  <Icon name="zap" className="w-3.5 h-3.5 text-app-emerald" /> Acciones Rápidas
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

            {/* ══ SECCIONES DEL AULA EN GRID RESPONSIVO (NO SLIDE / 100% VISIBLE) ══ */}
            <div className="space-y-2">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-app-muted flex items-center gap-1.5">
                <Icon name="layout-grid" className="w-3.5 h-3.5 text-app-emerald" /> Secciones del Aula
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
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
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-app-card border-app-emerald shadow-card ring-1 ring-app-emerald scale-[1.02]'
                          : 'bg-app-surface border-app-border text-app-muted hover:border-app-emerald/50'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <Icon name={sec.icon} className={`w-4 h-4 ${isSelected ? 'text-app-emerald' : 'text-app-muted'}`} />
                        {sec.count !== null && (
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            isSelected ? 'bg-app-emerald text-white' : 'bg-app-card border border-app-border text-app-text'
                          }`}>
                            {sec.count}
                          </span>
                        )}
                      </div>
                      <div className={`text-xs font-extrabold leading-tight ${isSelected ? 'text-app-text' : 'text-app-muted'}`}>
                        {sec.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1. PARÁMETROS & TEMARIO */}
            {innerTab === 'params' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-app-card border border-app-border p-5 rounded-3xl shadow-card">
                    <div className="text-xs font-extrabold uppercase text-app-emerald mb-1">Docente / Cátedra</div>
                    <div className="text-lg font-extrabold text-app-text">{currentMateria.docente || 'Sin docente asignado'}</div>
                    <div className="text-xs text-app-muted mt-2">Año: {currentMateria.año_cursado || 2026} • Cuatrimestre: {currentMateria.cuatrimestre || '2'}</div>
                  </div>
                  <div className="bg-app-card border border-app-border p-5 rounded-3xl shadow-card">
                    <div className="text-xs font-extrabold uppercase text-app-emerald mb-1">Fechas de Parciales</div>
                    <div className="text-sm font-extrabold text-app-text">1° Parcial: {currentMateria.fecha_parcial1 || 'A definir'}</div>
                    <div className="text-sm font-extrabold text-app-text mt-1">2° Parcial: {currentMateria.fecha_parcial2 || 'A definir'}</div>
                    <div className="text-xs text-app-muted mt-2">Modalidad: {currentMateria.modalidad_parcial || 'Presencial'}</div>
                  </div>
                  <div className="bg-app-card border border-app-border p-5 rounded-3xl shadow-card">
                    <div className="text-xs font-extrabold uppercase text-app-emerald mb-1">Examen Final & Enlaces</div>
                    <div className="text-sm font-extrabold text-app-text">Final: {currentMateria.fecha_final || 'A definir'}</div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {currentMateria.link_programa && <a href={currentMateria.link_programa} target="_blank" className="px-3 py-1 bg-app-emerald-bg text-app-emerald text-xs font-bold rounded-lg border border-app-emerald/30">Programa Oficial</a>}
                      {currentMateria.link_drive && <a href={currentMateria.link_drive} target="_blank" className="px-3 py-1 bg-app-navy-bg text-app-navy text-xs font-bold rounded-lg border border-app-navy/30">Carpeta Drive</a>}
                    </div>
                  </div>
                </div>

                <div className="bg-app-card border border-app-border p-5 sm:p-6 rounded-3xl shadow-card space-y-3">
                  <h4 className="text-base font-extrabold text-app-text flex items-center gap-2">
                    <Icon name="file-text" className="w-4 h-4 text-app-emerald" /> Temario 1° Parcial
                  </h4>
                  <p className="text-sm text-app-text whitespace-pre-wrap leading-relaxed">{currentMateria.temas_parcial1 || 'No hay temario cargado para el 1° parcial.'}</p>
                </div>
                <div className="bg-app-card border border-app-border p-5 sm:p-6 rounded-3xl shadow-card space-y-3">
                  <h4 className="text-base font-extrabold text-app-text flex items-center gap-2">
                    <Icon name="file-text" className="w-4 h-4 text-app-emerald" /> Temario 2° Parcial
                  </h4>
                  <p className="text-sm text-app-text whitespace-pre-wrap leading-relaxed">{currentMateria.temas_parcial2 || 'No hay temario cargado para el 2° parcial.'}</p>
                </div>
              </div>
            )}

            {/* 2. BIBLIOGRAFÍA & FORMATO ESTABLECIDO (NO HORIZONTAL SLIDER) */}
            {innerTab === 'biblio' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  {/* Filter Chips wrapping cleanly */}
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
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
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
                      <div key={t.id} className="bg-app-card border border-app-border p-5 rounded-3xl shadow-card flex flex-col justify-between hover:shadow-fluffy transition-all">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex gap-1.5 items-center">
                              <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-app-surface border border-app-border text-app-muted">
                                {t.unidad || 'Unidad 1'}
                              </span>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${t.caracter === 'Optativo' ? 'bg-app-surface text-app-muted border-app-border' : 'bg-app-emerald-bg text-app-emerald border-app-emerald/30'}`}>
                                {t.caracter || 'Obligatorio'}
                              </span>
                            </div>
                            <button
                              onClick={() => handleToggleBiblioEstado(t.id)}
                              className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${
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

            {/* 3. EXÁMENES & VINCULACIÓN DE UNIDADES Y TEXTOS */}
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {examenes.filter(e => e.materia_id === selectedMateriaId || e.materia === currentMateria.nombre).map(ex => {
                    // Match texts linked explicitly or by included units
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
                      <div key={ex.id} className="bg-app-card border border-app-border p-6 rounded-3xl shadow-card space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-app-amber-bg text-app-amber border border-app-amber/30">
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

                        {/* Progress Bar */}
                        <div>
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-app-muted">Textos Evaluados Leídos</span>
                            <span className="text-app-emerald">{readCount}/{relevantTexts.length} ({pct}%)</span>
                          </div>
                          <div className="w-full h-2.5 bg-app-surface rounded-full overflow-hidden border border-app-border">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>

                        {/* Breakdown */}
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
                              <div key={unidad} className="bg-app-surface p-3.5 rounded-2xl border border-app-border space-y-2">
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

            {/* 4. CLASES */}
            {innerTab === 'clases' && (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-3 justify-between items-center bg-app-card p-5 rounded-3xl border border-app-border shadow-card">
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
                  <div className="bg-app-card border border-app-border rounded-3xl p-10 sm:p-14 text-center space-y-4 shadow-card">
                    <div className="w-16 h-16 rounded-3xl bg-app-emerald-bg text-app-emerald flex items-center justify-center mx-auto shadow-emerald border border-app-emerald/20">
                      <Icon name="monitor" className="w-8 h-8" size={32} />
                    </div>
                    <div className="max-w-md mx-auto">
                      <h4 className="text-lg font-extrabold text-app-text">Sin clases registradas en esta materia</h4>
                      <p className="text-xs text-app-muted mt-1 leading-relaxed">
                        Crea protocolos de tus clases teóricas, prácticas o talleres. Puedes adjuntar múltiples grabaciones de audio, fotos de la pizarra, contenido de diapositivas y los énfasis para el examen.
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
                        <div key={c.id} className="bg-app-card border border-app-border p-6 rounded-3xl shadow-card space-y-4 flex flex-col justify-between hover:shadow-fluffy transition-all">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-app-emerald-bg text-app-emerald border border-app-emerald/30">
                                Clase #{c.nro_clase} • {c.tipo || 'Teórica'}
                              </span>
                              <span className="text-xs text-app-muted font-bold flex items-center gap-1">
                                <Icon name="calendar" className="w-3.5 h-3.5" /> {c.fecha}
                              </span>
                            </div>

                            <h4 className="text-lg font-black text-app-text leading-snug">{c.titulo_clase}</h4>

                            {c.aclaraciones && (
                              <div className="p-3.5 bg-app-emerald-bg border border-app-emerald/20 rounded-2xl text-xs text-app-text space-y-1">
                                <div className="font-extrabold text-app-emerald flex items-center gap-1">
                                  <Icon name="alert-triangle" className="w-3.5 h-3.5" /> Énfasis del Docente / Examen:
                                </div>
                                <div className="leading-relaxed whitespace-pre-wrap">{c.aclaraciones}</div>
                              </div>
                            )}

                            {c.contenido_ppt && (
                              <div className="p-3 bg-app-surface border border-app-border rounded-2xl text-xs text-app-muted space-y-1">
                                <div className="font-bold text-app-text flex items-center gap-1">
                                  <Icon name="presentation" className="w-3.5 h-3.5 text-app-navy" /> Contenido de Diapositivas:
                                </div>
                                <div className="line-clamp-4 leading-relaxed whitespace-pre-wrap">{c.contenido_ppt}</div>
                              </div>
                            )}

                            {/* Grabaciones de audio */}
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

                            {/* Galería de imágenes / pizarra */}
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

            {/* 5. APUNTES */}
            {innerTab === 'apuntes' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2.5 justify-between items-center bg-app-card p-4 rounded-3xl border border-app-border shadow-card">
                  <div>
                    <h3 className="text-base font-black text-app-text flex items-center gap-2">
                      <Icon name="file-text" className="w-5 h-5 text-app-emerald" /> Guías de Estudio & Apuntes
                    </h3>
                    <p className="text-xs text-app-muted">Redactados con máxima densidad y formato de doble hoja imprimible.</p>
                  </div>
                  <div className="flex gap-2">
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
                      onClick={() => { triggerHaptic('light'); setModalApunte({ open: true, data: null }); }}
                      className="px-4 py-2 bg-app-emerald text-white font-extrabold text-xs rounded-xl shadow-emerald hover:brightness-110 flex items-center gap-1.5"
                    >
                      <Icon name="plus-circle" className="w-4 h-4 text-white" /> Crear Nuevo Apunte
                    </button>
                  </div>
                </div>

                {currentMateriaApuntes.length === 0 ? (
                  <div className="bg-app-card border border-app-border rounded-3xl p-10 text-center space-y-3 shadow-card">
                    <div className="w-14 h-14 rounded-2xl bg-app-emerald-bg text-app-emerald flex items-center justify-center mx-auto border border-app-emerald/20">
                      <Icon name="file-text" className="w-7 h-7" size={28} />
                    </div>
                    <h4 className="text-base font-extrabold text-app-text">Sin apuntes cargados en esta materia</h4>
                    <p className="text-xs text-app-muted max-w-sm mx-auto">
                      Copia el prompt académico, procésalo con tu IA preferida y pega el código aquí. Se auto-extraerá el título y quedará listo para leer o imprimir en hoja doble.
                    </p>
                    <button
                      onClick={() => setModalApunte({ open: true, data: null })}
                      className="px-5 py-2.5 bg-app-emerald text-white font-bold text-xs rounded-xl shadow-emerald"
                    >
                      Crear Primer Apunte
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {currentMateriaApuntes.map(a => (
                      <div key={a.id} className="bg-app-card border border-app-border p-5 rounded-3xl shadow-card flex flex-col justify-between hover:shadow-fluffy transition-all">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-app-emerald-bg text-app-emerald border border-app-emerald/20">{a.tipo || 'Resumen'}</span>
                            <span className="text-xs text-app-muted font-bold">{a.unidad}</span>
                          </div>
                          <h4 className="text-base font-black text-app-text mb-2 leading-snug">{a.titulo}</h4>
                          <p className="text-xs text-app-muted line-clamp-4 leading-relaxed mb-4">{(a.contenido || '').replace(/[#*`>•◦]/g, '')}</p>
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-app-border text-xs">
                          <span className="font-bold text-app-amber text-[11px]">{a.va_parcial ? 'Para Parcial' : 'Estudio'}</span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setModalApunte({ open: true, data: a })}
                              className="px-3 py-1 bg-app-surface text-app-text font-bold rounded-xl border border-app-border hover:border-app-emerald flex items-center gap-1"
                            >
                              <Icon name="book-open" className="w-3.5 h-3.5 text-app-emerald" /> Ver / Hoja Doble
                            </button>
                            <button onClick={() => handleDeleteApunte(a.id)} className="p-1.5 text-app-ruby hover:bg-app-ruby-bg rounded-xl border border-transparent hover:border-app-ruby/30">
                              <Icon name="trash-2" className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 6. PDFs */}
            {innerTab === 'pdfs' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pdfs.filter(p => p.materia_id === selectedMateriaId || p.materia === currentMateria.nombre).map(p => (
                  <div key={p.id} className="bg-app-card border border-app-border p-5 rounded-2xl shadow-card flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-app-emerald">{p.num_paginas} Páginas</span>
                        <span className="text-xs text-app-muted">{p.unidad}</span>
                      </div>
                      <h4 className="text-base font-extrabold text-app-text mb-2">{p.nombre_archivo}</h4>
                      <p className="text-xs text-app-muted line-clamp-3 leading-relaxed mb-4">{p.texto_extraido || 'Sin texto'}</p>
                    </div>
                    <button onClick={() => setModalPDFViewer({ open: true, data: p })} className="w-full py-2 bg-app-emerald-bg text-app-emerald font-bold text-xs rounded-xl border border-app-emerald/30">
                      Ver Documento Completo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: INGESTIÓN PDF ── */}
        {activeTab === 'pdf' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-extrabold flex items-center gap-2 text-app-text">
              <Icon name="file-up" className="w-6 h-6 text-app-emerald" size={24} /> Ingestión Inteligente de PDFs
            </h2>

            <label className="block border-2 border-dashed border-app-emerald/60 hover:border-app-emerald bg-app-card/60 p-10 rounded-3xl text-center cursor-pointer shadow-fluffy transition-all hover:bg-app-emerald-bg/10">
              <div className="w-14 h-14 bg-app-emerald-bg text-app-emerald rounded-2xl mx-auto flex items-center justify-center mb-3">
                <Icon name="upload-cloud" className="w-7 h-7" size={28} />
              </div>
              <div className="text-lg font-extrabold text-app-text">Arrastra tu PDF o Haz Clic para Cargar</div>
              <div className="text-xs text-app-muted mt-1">Soporta iOS Share Sheet, WhatsApp, Tablets y PC</div>
              <input type="file" accept="application/pdf" className="hidden" onChange={handlePDFUpload} />
            </label>

            {ingestionData && (
              <form onSubmit={handleConfirmIngestion} className="bg-app-card border border-app-border p-6 rounded-3xl shadow-fluffy space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-extrabold text-app-text">{ingestionData.fileName}</h3>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-app-emerald-bg text-app-emerald">{ingestionData.numPages} páginas</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Materia Asignada</label>
                    <select
                      value={ingestionData.materiaId}
                      onChange={e => setIngestionData({ ...ingestionData, materiaId: e.target.value })}
                      className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none"
                    >
                      {materias.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Unidad</label>
                    <input
                      value={ingestionData.unidad}
                      onChange={e => setIngestionData({ ...ingestionData, unidad: e.target.value })}
                      className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Título del Texto</label>
                  <input
                    value={ingestionData.titulo}
                    onChange={e => setIngestionData({ ...ingestionData, titulo: e.target.value })}
                    className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none"
                    required
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ingVaParcial"
                    checked={ingestionData.vaParcial}
                    onChange={e => setIngestionData({ ...ingestionData, vaParcial: e.target.checked })}
                    className="w-5 h-5 accent-emerald-500 rounded"
                  />
                  <label htmlFor="ingVaParcial" className="text-sm font-bold text-app-amber cursor-pointer">Texto Evaluado en Parcial</label>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold uppercase text-app-emerald">Texto Extraído (OCR)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const mat = materias.find(m => m.id === ingestionData.materiaId);
                        const prompt = generateAcademicPrompt(mat?.nombre || '', `${ingestionData.unidad} - ${ingestionData.titulo}`, ingestionData.extractedText);
                        navigator.clipboard.writeText(prompt);
                        showToast('📋 Prompt copiado con el texto OCR completo', 'sparkles');
                        triggerHaptic('success');
                      }}
                      className="px-3 py-1 bg-app-emerald-bg text-app-emerald border border-app-emerald/30 rounded-xl text-xs font-bold hover:brightness-110 flex items-center gap-1.5"
                    >
                      <Icon name="sparkles" className="w-3.5 h-3.5" /> Copiar Prompt IA con OCR
                    </button>
                  </div>
                  <textarea value={ingestionData.extractedText} readOnly className="w-full h-28 p-3 rounded-xl bg-app-surface border border-app-border text-xs text-app-muted outline-none" />
                </div>

                <button type="submit" className="w-full py-3.5 bg-app-emerald text-white font-bold rounded-xl shadow-emerald hover:brightness-110">
                  Confirmar e Ingestar a Supabase
                </button>
              </form>
            )}

            <div className="space-y-3">
              <h3 className="text-lg font-extrabold text-app-text flex items-center gap-2">
                <Icon name="history" className="w-5 h-5 text-app-emerald" /> Documentos Ingestados Recientemente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pdfs.slice(0, 6).map(p => (
                  <div key={p.id} className="bg-app-card border border-app-border p-5 rounded-2xl shadow-card flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-bold text-app-emerald">{p.materia}</span>
                      <h4 className="text-base font-extrabold text-app-text mt-1 truncate">{p.nombre_archivo}</h4>
                      <p className="text-xs text-app-muted line-clamp-2 mt-2">{p.texto_extraido || 'Sin preview'}</p>
                    </div>
                    <button onClick={() => setModalPDFViewer({ open: true, data: p })} className="mt-4 py-2 bg-app-emerald-bg text-app-emerald font-bold text-xs rounded-xl border border-app-emerald/30">
                      Ver Documento
                    </button>
                  </div>
                ))}
              </div>
            </div>
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

            <div className="bg-gradient-to-br from-app-surface to-app-card border border-app-border p-6 md:p-8 rounded-3xl shadow-fluffy flex flex-wrap items-center gap-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-900 text-white flex items-center justify-center shadow-emerald border-2 border-white/20">
                <Icon name="user" className="w-10 h-10 text-white" size={40} />
              </div>
              <div className="flex-1 min-w-[220px]">
                <h3 className="text-2xl font-extrabold text-app-text">Facundo Lazarte</h3>
                <p className="text-sm font-semibold text-app-emerald mt-0.5">Licenciatura en Psicología — Cursado Académico 2026</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs px-3 py-1 rounded-full bg-app-card border border-app-border text-app-muted font-bold">React + Tailwind Engine</span>
                  <span className="text-xs px-3 py-1 rounded-full bg-app-card border border-app-border text-app-muted font-bold">Supabase Cloud Sync</span>
                  <span className="text-xs px-3 py-1 rounded-full bg-app-card border border-app-border text-app-muted font-bold">Dual Theme Active</span>
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
                <div key={idx} className="bg-app-card border border-app-border p-5 rounded-2xl shadow-card flex items-center gap-4">
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
            <div className="bg-app-card border border-app-border p-6 rounded-3xl shadow-card space-y-4">
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
            <div className="bg-app-card border border-app-border p-6 rounded-3xl shadow-card space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-app-emerald">Canal Oficial de Producción</div>
                  <h3 className="text-lg font-extrabold text-app-text flex items-center gap-2">
                    <Icon name="sparkles" className="w-5 h-5 text-app-emerald" /> Actualizaciones del Sistema
                  </h3>
                  <p className="text-xs text-app-muted">Versión instalada: <strong className="text-app-text">{currentVersion}</strong></p>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                  updateAvailable
                    ? 'bg-app-emerald-bg text-app-emerald border-app-emerald animate-pulse'
                    : 'bg-app-surface text-app-muted border-app-border'
                }`}>
                  {updateAvailable ? 'Nueva Versión Lista' : 'Al Día'}
                </span>
              </div>

              {updateAvailable ? (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border-2 border-app-emerald space-y-3">
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

            <div className="bg-app-card border border-app-border p-6 rounded-3xl shadow-card space-y-4">
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

            <div className="bg-app-card border border-app-border p-6 rounded-3xl shadow-card space-y-4">
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
          onCreateApunte={(apunteData) => {
            setModalApunte({ open: true, data: apunteData });
          }}
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

      {/* ══ TOAST NOTIFICATION ══ */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 pointer-events-none ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="bg-app-card border border-app-emerald text-app-text px-6 py-3 rounded-full shadow-fluffy flex items-center gap-2.5 text-sm font-bold">
          <Icon name={toast.iconName} className="w-4 h-4 text-app-emerald" />
          <span>{toast.msg}</span>
        </div>
      </div>
    </div>
  );
}

// ── 5. DETAILED MODAL COMPONENTS ──

function ModalMateria({ initialData, onClose, onSave }) {
  const [form, setForm] = useState(initialData || {
    nombre: '', abreviatura: '', docente: '', color: '#10B981',
    año_cursado: 2026, cuatrimestre: 2, descripcion: '',
    fecha_parcial1: '', fecha_parcial2: '', fecha_final: '',
    modalidad_parcial: 'Presencial Escrito', temas_parcial1: '', temas_parcial2: '', temas_final: '',
    link_programa: '', link_drive: ''
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 shadow-fluffy space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-extrabold text-app-text">{initialData ? 'Editar Materia' : 'Nueva Materia'}</h3>
          <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text flex items-center justify-center">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Nombre</label>
              <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" placeholder="Semiosis Social" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Sigla / Abreviatura</label>
              <input value={form.abreviatura} onChange={e => setForm({ ...form, abreviatura: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" placeholder="SEM" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Docente / Cátedra</label>
              <input value={form.docente} onChange={e => setForm({ ...form, docente: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" />
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Fecha 1° Parcial</label>
              <input type="date" value={form.fecha_parcial1 || ''} onChange={e => setForm({ ...form, fecha_parcial1: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Fecha 2° Parcial</label>
              <input type="date" value={form.fecha_parcial2 || ''} onChange={e => setForm({ ...form, fecha_parcial2: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Temario 1° Parcial</label>
            <textarea value={form.temas_parcial1 || ''} onChange={e => setForm({ ...form, temas_parcial1: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm text-app-text outline-none h-20" placeholder="Unidades y autores..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Link Programa</label>
              <input type="url" value={form.link_programa || ''} onChange={e => setForm({ ...form, link_programa: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm text-app-text outline-none" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Link Carpeta Drive</label>
              <input type="url" value={form.link_drive || ''} onChange={e => setForm({ ...form, link_drive: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm text-app-text outline-none" placeholder="https://drive..." />
            </div>
          </div>

          <button type="submit" className="w-full py-3.5 bg-app-emerald text-white font-bold rounded-xl shadow-emerald hover:brightness-110">
            Guardar Materia
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
      <div className="bg-app-modal border border-app-border w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 shadow-fluffy space-y-4">
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
      <div className="bg-app-modal border border-app-border w-full max-w-2xl rounded-3xl p-6 shadow-fluffy space-y-4">
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
          className="w-full h-60 p-4 rounded-2xl bg-app-surface border border-app-border text-xs font-mono text-app-text outline-none leading-relaxed"
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
      <div className="bg-app-modal border border-app-border w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl p-6 shadow-fluffy space-y-4 overflow-hidden">
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
                <option value="Parcial 1">Parcial 1</option>
                <option value="Parcial 2">Parcial 2</option>
                <option value="Final">Examen Final</option>
                <option value="Recuperatorio">Recuperatorio</option>
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
            <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-app-surface rounded-2xl border border-app-border">
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
      <div className="bg-app-modal border border-app-border w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl p-6 shadow-fluffy space-y-4 overflow-hidden">
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
          <div className="bg-app-surface p-4 rounded-2xl border border-app-border space-y-3">
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
          <div className="bg-app-surface p-4 rounded-2xl border border-app-border space-y-3">
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
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'double_page'
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const textareaRef = useRef(null);

  // Auto-extraer título desde '# Título' si se pega contenido
  const handleContentChange = (newContent) => {
    const detectedTitle = extractAcademicTitle(newContent);
    if (detectedTitle && (!form.titulo || form.titulo.startsWith('Cita:') || form.titulo.startsWith('Resumen:') || form.titulo === '')) {
      setForm(prev => ({ ...prev, contenido: newContent, titulo: detectedTitle }));
    } else {
      setForm(prev => ({ ...prev, contenido: newContent }));
    }
  };

  const handlePaste = (e) => {
    const text = e.clipboardData?.getData('text') || '';
    const detectedTitle = extractAcademicTitle(text);
    if (detectedTitle && (!form.titulo || form.titulo.startsWith('Cita:') || form.titulo.startsWith('Resumen:'))) {
      setForm(prev => ({ ...prev, titulo: detectedTitle }));
    }
  };

  const handleCopyPrompt = () => {
    const prompt = generateAcademicPrompt(materiaNombre, form.titulo || form.unidad, '');
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    triggerHaptic('success');
    if (showToast) showToast('📋 Prompt Académico copiado al portapapeles', 'sparkles');
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  const handlePrintPDF = () => {
    triggerHaptic('medium');
    window.print();
  };

  const insertSyntax = (prefix, suffix = '') => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    const sel = text.substring(start, end);
    const newText = text.substring(0, start) + prefix + sel + suffix + text.substring(end);
    setForm({ ...form, contenido: newText });
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-6xl h-[94vh] flex flex-col rounded-3xl p-5 sm:p-6 shadow-fluffy space-y-3 sm:space-y-4 overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-app-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-app-emerald-bg text-app-emerald border border-app-emerald/20">
                {materiaNombre || 'Cátedra'}
              </span>
              <span className="text-xs text-app-muted font-bold">• {form.unidad}</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-app-text mt-0.5 truncate max-w-lg">
              {form.titulo || (initialData ? 'Editar Apunte' : 'Nuevo Apunte Académico')}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-app-surface p-1 rounded-2xl border border-app-border">
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

            {/* Prompt Copy Button */}
            <button
              type="button"
              onClick={handleCopyPrompt}
              className={`px-3.5 py-2 rounded-2xl text-xs font-extrabold border transition-all flex items-center gap-1.5 shadow-sm ${
                copiedPrompt
                  ? 'bg-app-emerald text-white border-app-emerald'
                  : 'bg-app-surface border-app-border text-app-emerald hover:border-app-emerald'
              }`}
            >
              <Icon name={copiedPrompt ? "check" : "sparkles"} className="w-4 h-4" />
              <span>{copiedPrompt ? "¡Prompt Copiado!" : "Copiar Prompt IA"}</span>
            </button>

            {viewMode === 'double_page' && (
              <button
                type="button"
                onClick={handlePrintPDF}
                className="px-3.5 py-2 bg-app-navy text-white rounded-2xl text-xs font-extrabold flex items-center gap-1.5 shadow-card hover:brightness-110"
              >
                <Icon name="printer" className="w-4 h-4" /> Imprimir / PDF
              </button>
            )}

            <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text flex items-center justify-center">
              <Icon name="x" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Inputs Header */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            value={form.titulo}
            onChange={e => setForm({ ...form, titulo: e.target.value })}
            placeholder="Título del Apunte (o pega el prompt y se detectará automáticamente)"
            className="p-2.5 rounded-2xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none sm:col-span-2"
            required
          />
          <select
            value={form.tipo}
            onChange={e => setForm({ ...form, tipo: e.target.value })}
            className="p-2.5 rounded-2xl bg-app-surface border border-app-border text-xs font-bold text-app-text outline-none"
          >
            <option value="Resumen">Resumen Completo</option>
            <option value="Guía de Estudio">Guía de Estudio</option>
            <option value="Mapa Conceptual">Mapa Conceptual</option>
            <option value="Fichas">Fichas de Repaso</option>
            <option value="Notas de Clase">Notas de Clase</option>
          </select>
          <input
            value={form.unidad}
            onChange={e => setForm({ ...form, unidad: e.target.value })}
            placeholder="Unidad (ej: Unidad 1)"
            className="p-2.5 rounded-2xl bg-app-surface border border-app-border text-xs font-bold text-app-text outline-none"
          />
        </div>

        {/* ── 1. SPLIT VIEW MODE ── */}
        {viewMode === 'split' && (
          <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
            {/* Toolbar with Markdown, Math & Smart Templates */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 p-2 bg-app-surface border border-app-border rounded-2xl">
              <div className="flex flex-wrap gap-1 items-center">
                <button type="button" onClick={() => insertSyntax('**', '**')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold hover:border-app-emerald">B</button>
                <button type="button" onClick={() => insertSyntax('*', '*')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs italic font-bold hover:border-app-emerald">I</button>
                <button type="button" onClick={() => insertSyntax('## ')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold hover:border-app-emerald">H2</button>
                <button type="button" onClick={() => insertSyntax('### ')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold hover:border-app-emerald">H3</button>
                <button type="button" onClick={() => insertSyntax('• ')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold hover:border-app-emerald">• Viñeta</button>
                <button type="button" onClick={() => insertSyntax('  ◦ ')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold hover:border-app-emerald">◦ Subviñeta</button>
                <button type="button" onClick={() => insertSyntax('> ')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold hover:border-app-emerald">Cita</button>
                <button type="button" onClick={() => insertSyntax('[imagen 1: ', ']')} className="px-2.5 py-1 rounded-xl bg-app-card border border-app-border text-xs font-bold text-app-emerald hover:border-app-emerald">Figura</button>
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
                  <Icon name="sparkles" className="w-3.5 h-3.5" /> Plantilla Universitaria
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
                className="w-full h-full p-4 rounded-2xl bg-app-surface border border-app-border text-xs sm:text-sm text-app-text outline-none font-mono resize-none overflow-y-auto leading-relaxed"
              />

              <div
                className="w-full h-full p-5 rounded-2xl bg-app-card border border-app-border overflow-y-auto prose dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: parseMarkdownToHTML(form.contenido) || '<span class="text-app-muted italic">La vista previa en vivo aparecerá aquí...</span>' }}
              />
            </div>
          </div>
        )}

        {/* ── 2. HOJA DOBLE / NEUROSCAN PDF PRINT PREVIEW MODE ── */}
        {viewMode === 'double_page' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-app-surface rounded-3xl border border-app-border">
            <div
              id="academic-pdf-print-area"
              className="max-w-4xl mx-auto bg-white text-slate-900 p-8 sm:p-12 rounded-3xl shadow-fluffy border border-slate-200"
            >
              {/* Document Header */}
              <div className="border-b-2 border-emerald-600 pb-4 mb-6 flex justify-between items-end">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-emerald-700 block">
                    PSIESTUDIO • GUÍA ACADÉMICA DE ESTUDIO
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1 uppercase tracking-tight">
                    {form.titulo || 'RESUMEN ACADÉMICO'}
                  </h1>
                  <p className="text-xs font-bold text-slate-600 mt-0.5">
                    {materiaNombre || 'Cátedra'} • {form.unidad} • {form.tipo}
                  </p>
                </div>
                <div className="text-right text-[10px] text-slate-400 font-mono">
                  {new Date().toLocaleDateString('es-AR')}
                </div>
              </div>

              {/* High Density Double-Column Content */}
              <div
                className="academic-double-column print-double-column text-[11.5px] leading-relaxed text-slate-800 space-y-2 text-justify"
                dangerouslySetInnerHTML={{ __html: parseMarkdownToHTML(form.contenido) || '<p class="italic text-slate-400">Sin contenido cargado.</p>' }}
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-5 bg-app-surface border border-app-border font-bold text-xs rounded-xl text-app-muted hover:text-app-text"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => { triggerHaptic('success'); onSave(form); }}
            className="flex-1 py-3 bg-app-emerald text-white font-extrabold text-sm rounded-xl shadow-emerald hover:brightness-110 flex items-center justify-center gap-2"
          >
            <Icon name="check-circle" className="w-4 h-4 text-white" />
            Guardar Apunte en Supabase & Local
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalPDFViewer({ data, onClose, onCreateApunte }) {
  if (!data) return null;
  const [selectedText, setSelectedText] = useState('');

  const handleTextSelection = () => {
    const sel = window.getSelection()?.toString();
    if (sel && sel.trim().length > 0) {
      setSelectedText(sel.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-app-card border border-app-border w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl shadow-fluffy overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-app-border bg-app-surface">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-app-emerald">Visor Académico de Documento</span>
            <h3 className="text-lg font-extrabold text-app-text truncate max-w-md">{data.nombre_archivo}</h3>
            <p className="text-xs text-app-muted">{data.materia} • {data.unidad}</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedText && (
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  if (onCreateApunte) {
                    onCreateApunte({
                      titulo: `Cita: ${data.nombre_archivo.slice(0, 30)}...`,
                      tipo: 'Resumen',
                      unidad: data.unidad || 'Unidad 1',
                      contenido: `> "${selectedText}"\n\n**Fuente:** ${data.nombre_archivo} (${data.materia} - ${data.unidad})`
                    });
                  }
                  onClose();
                }}
                className="px-3 py-1.5 bg-app-emerald text-white font-bold text-xs rounded-xl shadow-emerald flex items-center gap-1.5 animate-pulse"
              >
                <Icon name="bookmark-plus" className="w-3.5 h-3.5" /> Convertir Selección en Apunte
              </button>
            )}
            <button onClick={onClose} className="px-3 py-1.5 bg-app-ruby-bg text-app-ruby font-bold text-xs rounded-xl border border-app-ruby/30 hover:brightness-110">Cerrar</button>
          </div>
        </div>
        <div onMouseUp={handleTextSelection} onKeyUp={handleTextSelection} className="p-6 overflow-y-auto text-sm text-app-text leading-relaxed whitespace-pre-wrap select-text font-sans">
          {data.texto_extraido || 'Sin texto extraído en este documento.'}
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
      <div className="bg-app-modal border border-app-border w-full max-w-2xl rounded-3xl p-5 shadow-fluffy space-y-4">
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
              className="p-3 rounded-2xl bg-app-card border border-app-border/70 hover:border-app-emerald cursor-pointer transition-all flex items-center justify-between group"
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-app-emerald-bg text-app-emerald border border-app-emerald/20">
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
      <div className="bg-app-modal border border-app-border w-full max-w-md rounded-3xl p-6 shadow-fluffy text-center space-y-5">
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

        <div className="relative py-6 bg-app-surface rounded-2xl border border-app-border">
          <div className="text-5xl font-black font-mono tracking-wider text-app-text">{formatTime(timeLeft)}</div>
          <div className="text-xs font-bold text-app-muted mt-2">
            {mode === 'work' ? 'Enfócate en tu bibliografía' : 'Tómate un respiro'}
          </div>

          <div className="w-4/5 mx-auto h-2 bg-app-border rounded-full mt-4 overflow-hidden">
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
        <div className="bg-app-modal border border-app-border w-full max-w-md rounded-3xl p-6 text-center space-y-4">
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
      <div className="bg-app-modal border border-app-border w-full max-w-xl rounded-3xl p-6 shadow-fluffy space-y-4">
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
          className={`relative min-h-[240px] p-6 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between shadow-card ${
            isFlipped ? 'bg-app-surface border-app-emerald' : 'bg-app-card border-app-border hover:border-app-emerald/60'
          }`}
        >
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-app-emerald bg-app-emerald-bg px-2.5 py-1 rounded-full border border-app-emerald/20">
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

// ── 6. MOUNT APP ──
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
