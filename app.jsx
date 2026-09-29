/* ======================================================
   PSIESTUDIO ULTRA — PROFESSIONAL REACT SUITE
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

// ── 3. MARKDOWN PARSER ──
function parseMarkdownToHTML(md) {
  if (!md) return '';
  let html = md
    .replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-app-text mt-3 mb-1">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-base font-extrabold text-app-text mt-4 mb-1">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-lg font-black text-app-emerald mt-4 mb-2">$1</h1>')
    .replace(/^\> (.*$)/gim, '<blockquote class="border-l-4 border-app-emerald bg-app-emerald-bg/20 p-2.5 my-2 rounded-r-lg text-xs italic text-app-text">$1</blockquote>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong class="text-app-emerald font-bold">$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em class="text-app-navy font-semibold">$1</em>')
    .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-app-text text-xs leading-relaxed">$1</li>')
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

  const [modalMateria, setModalMateria] = useState({ open: false, data: null });
  const [modalBiblio, setModalBiblio] = useState({ open: false, data: null });
  const [modalBiblioBatch, setModalBiblioBatch] = useState(false);
  const [modalClase, setModalClase] = useState({ open: false, data: null });
  const [modalApunte, setModalApunte] = useState({ open: false, data: null });
  const [modalExamen, setModalExamen] = useState({ open: false, data: null });
  const [modalPDFViewer, setModalPDFViewer] = useState({ open: false, data: null });

  const [ingestionData, setIngestionData] = useState(null);

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('psi_theme', theme);
  }, [theme]);

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
  };

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
      }
      if (bibRes.status === 'fulfilled' && bibRes.value.data) {
        setBiblio(bibRes.value.data);
        localStorage.setItem('psi_biblio_cache', JSON.stringify(bibRes.value.data));
      }
      if (claRes.status === 'fulfilled' && claRes.value.data) {
        setClases(claRes.value.data);
        localStorage.setItem('psi_clases_cache', JSON.stringify(claRes.value.data));
      }
      if (apuRes.status === 'fulfilled' && apuRes.value.data) {
        setApuntes(apuRes.value.data);
        localStorage.setItem('psi_apuntes_cache', JSON.stringify(apuRes.value.data));
      }
      if (pdfRes.status === 'fulfilled' && pdfRes.value.data) {
        setPdfs(pdfRes.value.data);
        localStorage.setItem('psi_pdfs_cache', JSON.stringify(pdfRes.value.data));
      }
      if (exRes.status === 'fulfilled' && exRes.value.data) {
        setExamenes(exRes.value.data);
        localStorage.setItem('psi_examenes_cache', JSON.stringify(exRes.value.data));
      }
    } catch (err) {
      console.warn('Sync error:', err);
    }
  };

  const enqueueAction = (action, table, payload) => {
    const newQueue = [...syncQueue, { id: Date.now(), action, table, payload }];
    setSyncQueue(newQueue);
    localStorage.setItem('psi_sync_queue', JSON.stringify(newQueue));
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
    const payload = {
      ...formData,
      id: formData.id || 'cla_' + Date.now(),
      materia_id: selectedMateriaId,
      materia: currentMateria ? currentMateria.nombre : 'General',
      fecha_carga: new Date().toISOString()
    };

    const updated = [payload, ...clases];
    setClases(updated);
    localStorage.setItem('psi_clases_cache', JSON.stringify(updated));
    setModalClase({ open: false, data: null });
    showToast('Protocolo de clase guardado', 'presentation');

    if (supabaseClient && isOnline) {
      try { await supabaseClient.from('clases').insert([payload]); }
      catch (e) { enqueueAction('INSERT', 'clases', payload); }
    } else {
      enqueueAction('INSERT', 'clases', payload);
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
    const payload = {
      ...formData,
      id: formData.id || 'ex_' + Date.now(),
      materia_id: selectedMateriaId,
      materia: currentMateria ? currentMateria.nombre : 'General',
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
                PsiEstudio <span className="text-app-emerald font-serif italic">Ultra</span>
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

          <div className="flex items-center gap-2.5">
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-app-card/95 backdrop-blur-xl border-t border-app-border px-3 py-2 flex justify-around items-center shadow-fluffy">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  <button onClick={() => setModalExamen({ open: true, data: null })} className="p-2.5 rounded-xl bg-app-emerald text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-emerald hover:brightness-110">
                    <Icon name="calendar-plus" className="w-3.5 h-3.5 text-white" /> Crear Examen
                  </button>
                  <button onClick={() => setModalBiblio({ open: true, data: null })} className="p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold flex items-center justify-center gap-1.5 hover:border-app-emerald text-app-text">
                    <Icon name="plus" className="w-3.5 h-3.5 text-app-emerald" /> Agregar Texto
                  </button>
                  <button onClick={() => setModalBiblioBatch(true)} className="p-2.5 rounded-xl bg-app-surface border border-app-border text-xs font-bold flex items-center justify-center gap-1.5 hover:border-app-emerald text-app-text col-span-2 sm:col-span-1">
                    <Icon name="file-spreadsheet" className="w-3.5 h-3.5 text-app-emerald" /> Carga Rápida
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
                    const linkedIds = ex.textos_vinculados || [];

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
                          <div className="flex gap-2">
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clases.filter(c => c.materia_id === selectedMateriaId || c.materia === currentMateria.nombre).map(c => (
                  <div key={c.id} className="bg-app-card border border-app-border p-5 rounded-2xl shadow-card space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-app-emerald-bg text-app-emerald border border-app-emerald/30">
                        Clase #{c.nro_clase} • {c.tipo}
                      </span>
                      <span className="text-xs text-app-muted font-bold">{c.fecha}</span>
                    </div>
                    <h4 className="text-base font-extrabold text-app-text">{c.titulo_clase}</h4>
                    {c.aclaraciones && (
                      <div className="p-3 bg-app-emerald-bg border border-app-emerald/20 rounded-xl text-xs text-app-text">
                        <strong className="text-app-emerald">Énfasis del Docente:</strong><br />{c.aclaraciones}
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-app-border">
                      <div className="flex gap-2">
                        {c.link_grabacion && <a href={c.link_grabacion} target="_blank" className="px-2.5 py-1 bg-app-navy-bg text-app-navy text-xs font-bold rounded-lg border border-app-navy/30">Audio</a>}
                        {c.link_doc_resumen && <a href={c.link_doc_resumen} target="_blank" className="px-2.5 py-1 bg-app-emerald-bg text-app-emerald text-xs font-bold rounded-lg border border-app-emerald/30">Doc</a>}
                      </div>
                      <button onClick={() => handleDeleteClase(c.id)} className="p-1.5 text-app-ruby hover:bg-app-ruby-bg rounded-lg">
                        <Icon name="trash-2" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 5. APUNTES */}
            {innerTab === 'apuntes' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {apuntes.filter(a => a.materia_id === selectedMateriaId || a.materia === currentMateria.nombre).map(a => (
                  <div key={a.id} className="bg-app-card border border-app-border p-5 rounded-2xl shadow-card flex flex-col justify-between hover:shadow-fluffy transition-all">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-app-amber-bg text-app-amber border border-app-amber/30">{a.tipo}</span>
                        <span className="text-xs text-app-muted">{a.unidad}</span>
                      </div>
                      <h4 className="text-lg font-extrabold text-app-text mb-2">{a.titulo}</h4>
                      <p className="text-xs text-app-muted line-clamp-4 leading-relaxed mb-4">{(a.contenido || '').replace(/[#*`>]/g, '')}</p>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-app-border text-xs">
                      <span className="font-bold text-app-amber">{a.va_parcial ? 'Para Parcial' : 'Apunte General'}</span>
                      <div className="flex gap-2">
                        <button onClick={() => setModalApunte({ open: true, data: a })} className="px-3 py-1 bg-app-emerald-bg text-app-emerald font-bold rounded-lg border border-app-emerald/30">Editar</button>
                        <button onClick={() => handleDeleteApunte(a.id)} className="p-1.5 text-app-ruby hover:bg-app-ruby-bg rounded-lg"><Icon name="trash-2" className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
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
                  <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Texto Extraído (OCR)</label>
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
              <div className="flex gap-3 pt-2">
                <button onClick={triggerPing} className="px-4 py-2.5 bg-app-emerald text-white font-bold text-xs rounded-xl shadow-emerald flex items-center gap-2">
                  <Icon name="activity" className="w-4 h-4" /> Ping de Prueba
                </button>
                <button onClick={processSyncQueue} className="px-4 py-2.5 bg-app-surface border border-app-border font-bold text-xs rounded-xl flex items-center gap-2 text-app-text">
                  <Icon name="refresh-cw" className="w-4 h-4" /> Sincronizar Cola ({syncQueue.length})
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
    fecha: new Date().toISOString().split('T')[0], nro_clase: 1, tipo: 'Teórica',
    titulo_clase: '', aclaraciones: '', contenido_ppt: '', link_grabacion: '', link_doc_resumen: ''
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 shadow-fluffy space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-extrabold text-app-text">Protocolo de Clase</h3>
          <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text flex items-center justify-center">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">N° Clase</label>
              <input type="number" value={form.nro_clase} onChange={e => setForm({ ...form, nro_clase: parseInt(e.target.value) })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Tema Principal</label>
            <input value={form.titulo_clase} onChange={e => setForm({ ...form, titulo_clase: e.target.value })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Énfasis y Aclaraciones del Docente</label>
            <textarea value={form.aclaraciones} onChange={e => setForm({ ...form, aclaraciones: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm text-app-text outline-none h-24" />
          </div>

          <button type="submit" className="w-full py-3.5 bg-app-navy text-white font-bold rounded-xl shadow-card hover:brightness-110">
            Guardar Protocolo de Clase
          </button>
        </form>
      </div>
    </div>
  );
}

function ModalApunteSplitView({ initialData, onClose, onSave }) {
  const [form, setForm] = useState(initialData || {
    titulo: '', tipo: 'Resumen', unidad: 'Unidad 1', va_parcial: false, contenido: ''
  });
  const textareaRef = useRef(null);

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
      <div className="bg-app-modal border border-app-border w-full max-w-5xl h-[92vh] flex flex-col rounded-3xl p-6 shadow-fluffy space-y-4 overflow-hidden">
        <div className="flex justify-between items-center border-b border-app-border pb-3">
          <div>
            <h3 className="text-xl font-extrabold text-app-text">{initialData ? 'Editar Apunte' : 'Nuevo Apunte Académico'}</h3>
            <span className="text-xs text-app-muted font-bold">Editor Split-View en Tiempo Real</span>
          </div>
          <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text flex items-center justify-center">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            value={form.titulo}
            onChange={e => setForm({ ...form, titulo: e.target.value })}
            placeholder="Título del Apunte"
            className="p-2.5 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none col-span-1 sm:col-span-2"
            required
          />
          <select
            value={form.tipo}
            onChange={e => setForm({ ...form, tipo: e.target.value })}
            className="p-2.5 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none"
          >
            <option value="Resumen">Resumen Completo</option>
            <option value="Mapa Conceptual">Mapa Conceptual</option>
            <option value="Fichas">Fichas de Repaso</option>
            <option value="Notas de Clase">Notas de Clase</option>
          </select>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap gap-1.5 p-2 bg-app-surface border border-app-border rounded-xl">
          <button type="button" onClick={() => insertSyntax('**', '**')} className="px-2.5 py-1 rounded bg-app-card border border-app-border text-xs font-bold">B</button>
          <button type="button" onClick={() => insertSyntax('*', '*')} className="px-2.5 py-1 rounded bg-app-card border border-app-border text-xs italic font-bold">I</button>
          <button type="button" onClick={() => insertSyntax('## ')} className="px-2.5 py-1 rounded bg-app-card border border-app-border text-xs font-bold">H2</button>
          <button type="button" onClick={() => insertSyntax('### ')} className="px-2.5 py-1 rounded bg-app-card border border-app-border text-xs font-bold">H3</button>
          <button type="button" onClick={() => insertSyntax('- ')} className="px-2.5 py-1 rounded bg-app-card border border-app-border text-xs font-bold">• Lista</button>
          <button type="button" onClick={() => insertSyntax('> ')} className="px-2.5 py-1 rounded bg-app-card border border-app-border text-xs font-bold">Cita</button>
        </div>

        {/* Split View Editor & Live Preview */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={form.contenido}
            onChange={e => setForm({ ...form, contenido: e.target.value })}
            placeholder="Escribe tu apunte con Markdown..."
            className="w-full h-full p-4 rounded-2xl bg-app-surface border border-app-border text-sm text-app-text outline-none font-mono resize-none overflow-y-auto"
          />

          <div
            className="w-full h-full p-5 rounded-2xl bg-app-card border border-app-border overflow-y-auto prose dark:prose-invert max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: parseMarkdownToHTML(form.contenido) || '<span class="text-app-muted italic">La vista previa en vivo aparecerá aquí...</span>' }}
          />
        </div>

        <button
          type="button"
          onClick={() => onSave(form)}
          className="w-full py-3 bg-app-emerald text-white font-bold rounded-xl shadow-emerald hover:brightness-110"
        >
          Guardar Apunte en Supabase
        </button>
      </div>
    </div>
  );
}

function ModalPDFViewer({ data, onClose }) {
  if (!data) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-app-card border border-app-border w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl shadow-fluffy overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-app-border bg-app-surface">
          <div>
            <h3 className="text-lg font-extrabold text-app-text truncate max-w-md">{data.nombre_archivo}</h3>
            <p className="text-xs text-app-muted">{data.materia} • {data.unidad}</p>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 bg-app-ruby-bg text-app-ruby font-bold text-xs rounded-xl border border-app-ruby/30">Cerrar</button>
        </div>
        <div className="p-6 overflow-y-auto text-sm text-app-text leading-relaxed whitespace-pre-wrap">
          {data.texto_extraido || 'Sin texto extraído en este documento.'}
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
