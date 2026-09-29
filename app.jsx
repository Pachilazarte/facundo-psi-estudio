/* ======================================================
   PSIESTUDIO ULTRA — REACT 18 & TAILWIND ARCHITECTURE
   Integrated with Centralized Color Tokens & Supabase Sync
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
  console.warn('Supabase fallback:', e);
}

// ── 2. LUCIDE SVG ICON COMPONENT ──
const Icon = ({ name, className = "w-5 h-5", size = 20 }) => {
  const iconRef = useRef(null);

  useEffect(() => {
    if (window.lucide && iconRef.current) {
      window.lucide.createIcons();
    }
  }, [name]);

  return <i ref={iconRef} data-lucide={name} className={className} style={{ width: size, height: size, display: 'inline-block' }}></i>;
};

// ── 3. MAIN REACT APPLICATION ──
function App() {
  // Theme state
  const [theme, setTheme] = useState(localStorage.getItem('psi_theme') || 'light');
  
  // Navigation state
  const [activeTab, setActiveTab] = useState('materias'); // 'materias', 'pdf', 'perfil', 'system'
  const [selectedMateriaId, setSelectedMateriaId] = useState(null);
  const [innerTab, setInnerTab] = useState('params'); // 'params', 'biblio', 'clases', 'apuntes', 'pdfs', 'examenes'
  const [biblioFilter, setBiblioFilter] = useState('todos');

  // Academic Data State (cached in localStorage)
  const [materias, setMaterias] = useState(() => JSON.parse(localStorage.getItem('psi_materias_cache') || '[]'));
  const [biblio, setBiblio] = useState(() => JSON.parse(localStorage.getItem('psi_biblio_cache') || '[]'));
  const [clases, setClases] = useState(() => JSON.parse(localStorage.getItem('psi_clases_cache') || '[]'));
  const [apuntes, setApuntes] = useState(() => JSON.parse(localStorage.getItem('psi_apuntes_cache') || '[]'));
  const [pdfs, setPdfs] = useState(() => JSON.parse(localStorage.getItem('psi_pdfs_cache') || '[]'));
  const [examenes, setExamenes] = useState(() => JSON.parse(localStorage.getItem('psi_examenes_cache') || '[]'));

  // Connectivity & Sync
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState(() => JSON.parse(localStorage.getItem('psi_sync_queue') || '[]'));
  const [toast, setToast] = useState({ show: false, msg: '', icon: '✨' });

  // Modals state
  const [modalMateria, setModalMateria] = useState({ open: false, data: null });
  const [modalBiblio, setModalBiblio] = useState({ open: false, data: null });
  const [modalClase, setModalClase] = useState({ open: false, data: null });
  const [modalApunte, setModalApunte] = useState({ open: false, data: null });
  const [modalExamen, setModalExamen] = useState({ open: false, data: null });
  const [modalPDFViewer, setModalPDFViewer] = useState({ open: false, data: null });

  // Ingestion form state
  const [ingestionData, setIngestionData] = useState(null);

  // Apply Theme on load / change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('psi_theme', theme);
  }, [theme]);

  // Online / Offline Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Conexión restaurada — Sincronizando', '🟢');
      processSyncQueue();
      fetchAllData();
    };
    const handleOffline = () => {
      setIsOnline(false);
      showToast('Modo Offline — Datos en caché local', '📦');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);

  // Initial Data Fetch & Seed
  useEffect(() => {
    if (materias.length === 0 && localStorage.getItem('psi_first_run') !== 'done') {
      seedInitialData();
    }
    fetchAllData();
  }, []);

  // Toast Helper
  const showToast = (msg, icon = '✨') => {
    setToast({ show: true, msg, icon });
    setTimeout(() => setToast({ show: false, msg: '', icon: '✨' }), 3200);
  };

  // Seed default subjects if empty
  const seedInitialData = () => {
    localStorage.setItem('psi_first_run', 'done');
    const initialMats = [
      {
        id: 'mat_semiosis',
        nombre: 'Semiosis Social',
        abreviatura: 'SEM',
        docente: 'Cátedra A',
        color: '#10B981',
        año_cursado: 2026,
        cuatrimestre: 2,
        descripcion: 'Teoría de la significación, discursos sociales y semiótica.',
        fecha_parcial1: '2026-10-15',
        modalidad_parcial: 'Presencial',
        temas_parcial1: 'Unidad 1: Saussure, Peirce. Unidad 2: Verón y discursos sociales.'
      },
      {
        id: 'mat_psicopatologia',
        nombre: 'Psicopatología I',
        abreviatura: 'PSICOPAT',
        docente: 'Cátedra Única',
        color: '#2563EB',
        año_cursado: 2026,
        cuatrimestre: 2,
        descripcion: 'Estructuras clínicas: neurosis, psicosis y perversión.',
        fecha_parcial1: '2026-10-28',
        modalidad_parcial: 'Presencial',
        temas_parcial1: 'Neurosis obsesiva e histeria en Freud y Lacan.'
      }
    ];
    setMaterias(initialMats);
    localStorage.setItem('psi_materias_cache', JSON.stringify(initialMats));
  };

  // Fetch all from Supabase
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

  // Enqueue offline action
  const enqueueAction = (action, table, payload) => {
    const newQueue = [...syncQueue, { id: Date.now(), action, table, payload }];
    setSyncQueue(newQueue);
    localStorage.setItem('psi_sync_queue', JSON.stringify(newQueue));
  };

  // Process offline queue
  const processSyncQueue = async () => {
    if (!navigator.onLine || !supabaseClient || syncQueue.length === 0) return;
    const queue = [...syncQueue];
    for (const item of queue) {
      try {
        if (item.action === 'INSERT') await supabaseClient.from(item.table).insert([item.payload]);
        if (item.action === 'UPDATE') await supabaseClient.from(item.table).update(item.payload).eq('id', item.payload.id);
        if (item.action === 'DELETE') await supabaseClient.from(item.table).delete().eq('id', item.payload.id);
      } catch (e) {
        console.warn('Queue err:', e);
        return;
      }
    }
    setSyncQueue([]);
    localStorage.setItem('psi_sync_queue', '[]');
    showToast('Cola offline sincronizada con Supabase', '☁️');
  };

  // Current selected materia object
  const currentMateria = useMemo(() => {
    return materias.find(m => m.id === selectedMateriaId) || null;
  }, [materias, selectedMateriaId]);

  // Global Next Exam Calculation
  const nextExam = useMemo(() => {
    const hoyMs = new Date().setHours(0, 0, 0, 0);
    const valid = examenes
      .filter(e => !e.finalizado && e.fecha)
      .filter(e => new Date(e.fecha + 'T00:00:00').getTime() >= hoyMs)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    return valid[0] || null;
  }, [examenes]);

  // ── SAVE HANDLERS ──
  const handleSaveMateria = async (formData) => {
    const isEdit = Boolean(formData.id);
    const payload = {
      ...formData,
      id: formData.id || 'mat_' + Date.now(),
      created_at: formData.created_at || new Date().toISOString()
    };

    let updated;
    if (isEdit) {
      updated = materias.map(m => m.id === payload.id ? payload : m);
    } else {
      updated = [...materias, payload];
    }

    setMaterias(updated);
    localStorage.setItem('psi_materias_cache', JSON.stringify(updated));
    setModalMateria({ open: false, data: null });
    showToast(isEdit ? 'Materia actualizada' : 'Materia creada', '📚');

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
    if (!confirm('¿Eliminar esta materia y todos sus datos?')) return;
    const updated = materias.filter(m => m.id !== id);
    setMaterias(updated);
    localStorage.setItem('psi_materias_cache', JSON.stringify(updated));
    if (selectedMateriaId === id) setSelectedMateriaId(null);
    showToast('Materia eliminada', '🗑️');

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

    let updated;
    if (isEdit) {
      updated = biblio.map(b => b.id === payload.id ? payload : b);
    } else {
      updated = [payload, ...biblio];
    }

    setBiblio(updated);
    localStorage.setItem('psi_biblio_cache', JSON.stringify(updated));
    setModalBiblio({ open: false, data: null });
    showToast('Texto guardado en bibliografía', '📖');

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
    showToast('Texto eliminado', '🗑️');

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
    showToast('Protocolo de clase guardado', '🎓');

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
    showToast('Clase eliminada', '🗑️');

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

    let updated;
    if (isEdit) {
      updated = apuntes.map(a => a.id === payload.id ? payload : a);
    } else {
      updated = [payload, ...apuntes];
    }

    setApuntes(updated);
    localStorage.setItem('psi_apuntes_cache', JSON.stringify(updated));
    setModalApunte({ open: false, data: null });
    showToast('Apunte guardado en Supabase', '📝');

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
    showToast('Apunte eliminado', '🗑️');

    if (supabaseClient && isOnline) {
      try { await supabaseClient.from('apuntes').delete().eq('id', id); }
      catch (e) { enqueueAction('DELETE', 'apuntes', { id }); }
    } else {
      enqueueAction('DELETE', 'apuntes', { id });
    }
  };

  const handleSaveExamen = async (formData) => {
    const payload = {
      ...formData,
      id: formData.id || 'ex_' + Date.now(),
      materia_id: selectedMateriaId,
      materia: currentMateria ? currentMateria.nombre : 'General',
      finalizado: false,
      created_at: new Date().toISOString()
    };

    const updated = [payload, ...examenes];
    setExamenes(updated);
    localStorage.setItem('psi_examenes_cache', JSON.stringify(updated));
    setModalExamen({ open: false, data: null });
    showToast('Fecha de examen registrada', '📅');

    if (supabaseClient && isOnline) {
      try { await supabaseClient.from('examenes').insert([payload]); }
      catch (e) { enqueueAction('INSERT', 'examenes', payload); }
    } else {
      enqueueAction('INSERT', 'examenes', payload);
    }
  };

  const handleDeleteExamen = async (id) => {
    if (!confirm('¿Eliminar examen?')) return;
    const updated = examenes.filter(e => e.id !== id);
    setExamenes(updated);
    localStorage.setItem('psi_examenes_cache', JSON.stringify(updated));
    showToast('Examen eliminado', '🗑️');

    if (supabaseClient && isOnline) {
      try { await supabaseClient.from('examenes').delete().eq('id', id); }
      catch (e) { enqueueAction('DELETE', 'examenes', { id }); }
    } else {
      enqueueAction('DELETE', 'examenes', { id });
    }
  };

  // PDF File Upload Handler (PDF.js OCR)
  const handlePDFUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      showToast('Selecciona un archivo PDF válido', '⚠️');
      return;
    }

    showToast('Procesando PDF con OCR...', '⏳');
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
          vaParcial: false,
          extractedText: fullText.slice(0, 1200)
        });
        showToast('PDF analizado correctamente', '✅');
      } catch (err) {
        showToast('Error procesando PDF', '❌');
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
      estado: 'Pendiente',
      va_parcial: ingestionData.vaParcial,
      notas: `Ingestado automáticamente desde ${newDoc.nombre_archivo}`,
      created_at: new Date().toISOString()
    };

    const updatedPdfs = [newDoc, ...pdfs];
    const updatedBib = [newBib, ...biblio];

    setPdfs(updatedPdfs);
    setBiblio(updatedBib);
    localStorage.setItem('psi_pdfs_cache', JSON.stringify(updatedPdfs));
    localStorage.setItem('psi_biblio_cache', JSON.stringify(updatedBib));
    setIngestionData(null);
    showToast('PDF y Bibliografía guardados con éxito', '📚');

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

  // Export & Utilities
  const exportBackupJSON = () => {
    const data = { materias, biblio, clases, apuntes, pdfs, examenes, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PsiEstudio_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast('Copia de seguridad exportada', '📥');
  };

  const clearCache = () => {
    if (!confirm('¿Limpiar caché local? (Supabase no se verá afectado)')) return;
    localStorage.clear();
    setMaterias([]);
    setBiblio([]);
    setClases([]);
    setApuntes([]);
    setPdfs([]);
    setExamenes([]);
    showToast('Caché limpiada', '🧹');
    fetchAllData();
  };

  const triggerPing = async () => {
    showToast('Enviando ping Keep-Alive...', '⚡');
    if (supabaseClient) {
      try {
        await supabaseClient.from('supabase_keep_alive').insert([{ ping_source: 'React-Tailwind-Client', status: 'ACTIVE' }]);
        showToast('Ping Keep-Alive registrado en Supabase', '🟢');
      } catch (e) {
        showToast('Ping registrado localmente', '🟢');
      }
    }
  };

  return (
    <div className="min-h-screen bg-app-base text-app-text transition-colors duration-300">
      
      {/* ══ HEADER ══ */}
      <header className="sticky top-0 z-40 bg-app-base/90 backdrop-blur-xl border-b border-app-border px-4 md:px-8 py-3 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-emerald border border-white/20">
              <Icon name="graduation-cap" className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight leading-none text-app-text">
                PsiEstudio <span className="text-app-emerald font-serif italic">Ultra</span>
              </h1>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-app-emerald">
                React & Tailwind Suite
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Switcher Toggle */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="w-10 h-10 rounded-full bg-app-card border border-app-border flex items-center justify-center text-app-text hover:border-app-emerald transition-all shadow-card hover:scale-105"
              title="Cambiar Tema"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="w-5 h-5 text-app-text" />
            </button>

            {/* Supabase Status Pill */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-app-card border border-app-border shadow-card ${isOnline ? 'text-app-emerald' : 'text-app-ruby'}`}>
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-app-emerald shadow-[0_0_8px_var(--color-emerald-main)]' : 'bg-app-ruby'}`}></span>
              <span className="hidden sm:inline">{isOnline ? 'En línea' : 'Sin conexión'}</span>
            </div>
          </div>
        </div>

        {/* ══ NAV TABS ══ */}
        <div className="max-w-7xl mx-auto mt-2 flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'materias', label: 'Materias', icon: 'book-open' },
            { id: 'pdf', label: 'Ingestión PDF', icon: 'file-text' },
            { id: 'perfil', label: 'Mi Perfil', icon: 'user' },
            { id: 'system', label: 'Sistema', icon: 'cpu' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedMateriaId(null); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-app-emerald text-app-emerald bg-app-emerald/10'
                  : 'border-transparent text-app-muted hover:text-app-text hover:bg-app-surface'
              }`}
            >
              <Icon name={tab.icon} className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ══ MAIN APP CONTENT ══ */}
      <main className="max-w-7xl mx-auto p-4 md:p-8 pb-32">

        {/* ── TAB: MATERIAS ── */}
        {activeTab === 'materias' && !selectedMateriaId && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2.5 text-app-text">
                <Icon name="layers" className="w-7 h-7 text-app-emerald" /> Materias en Cursado
              </h2>
              <button
                onClick={() => setModalMateria({ open: true, data: null })}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-emerald hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 text-sm"
              >
                <Icon name="plus" className="w-4 h-4" /> Nueva Materia
              </button>
            </div>

            {/* Next Exam Banner */}
            {nextExam && (
              <div
                onClick={() => {
                  const m = materias.find(x => x.nombre.toLowerCase() === nextExam.materia.toLowerCase());
                  if (m) setSelectedMateriaId(m.id);
                }}
                className="bg-gradient-to-r from-app-surface to-app-card border border-app-border hover:border-app-emerald p-5 rounded-2xl shadow-fluffy flex items-center gap-4 cursor-pointer transition-all hover:-translate-y-0.5"
              >
                <div className="w-14 text-center">
                  <div className="text-3xl font-black text-app-emerald leading-none">
                    {Math.ceil((new Date(nextExam.fecha + 'T00:00:00') - new Date().setHours(0,0,0,0)) / 864e5) || '🚨'}
                  </div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-app-muted mt-1">Días</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-app-emerald flex items-center gap-1.5">
                    <Icon name="bell" className="w-3.5 h-3.5" /> Próximo Examen Académico
                  </div>
                  <div className="text-lg font-extrabold text-app-text truncate">{nextExam.nombre}</div>
                  <div className="text-xs text-app-muted mt-0.5">{nextExam.materia} • {nextExam.fecha}</div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-app-amber-bg text-app-amber border border-app-amber/30">
                  Ver Temario <Icon name="chevron-right" className="w-3.5 h-3.5" />
                </span>
              </div>
            )}

            {/* Grid of Materias (Tablet 2 Cols, Desktop 3 Cols, Mobile 1 Col) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                    className="bg-app-card border border-app-border hover:border-app-emerald p-6 rounded-2xl shadow-card hover:shadow-fluffy transition-all duration-300 cursor-pointer flex flex-col justify-between hover:-translate-y-1"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-app-emerald-bg text-app-emerald border border-app-emerald/30 uppercase tracking-wider">
                          {m.abreviatura || 'MAT'}
                        </span>
                        <span className="text-xs font-semibold text-app-muted">
                          {m.cuatrimestre === 0 ? 'Anual' : `${m.cuatrimestre}° Cuatri`}
                        </span>
                      </div>
                      <h3 className="text-xl font-extrabold text-app-text leading-tight mb-1">{m.nombre}</h3>
                      <p className="text-xs text-app-muted flex items-center gap-1 mb-4">
                        <Icon name="user" className="w-3.5 h-3.5" /> {m.docente || 'Profesor no especificado'}
                      </p>

                      {/* Progress bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className="text-app-muted">Lecturas ({leidos}/{textsInMat.length})</span>
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

        {/* ── TAB: MATERIA DETALLE ── */}
        {activeTab === 'materias' && selectedMateriaId && currentMateria && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-app-border">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedMateriaId(null)}
                  className="px-3.5 py-2 rounded-xl bg-app-card border border-app-border hover:border-app-emerald text-sm font-bold text-app-text flex items-center gap-1.5 shadow-card transition-all"
                >
                  <Icon name="arrow-left" className="w-4 h-4" /> Materias
                </button>
                <h2 className="text-2xl md:text-3xl font-extrabold text-app-text">{currentMateria.nombre}</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => setModalMateria({ open: true, data: currentMateria })} className="px-3.5 py-2 rounded-xl bg-app-card border border-app-border text-xs font-bold flex items-center gap-1.5 shadow-card hover:border-app-emerald">
                  <Icon name="settings" className="w-3.5 h-3.5" /> Parámetros
                </button>
                <button onClick={() => setModalBiblio({ open: true, data: null })} className="px-3.5 py-2 rounded-xl bg-app-emerald text-white text-xs font-bold flex items-center gap-1.5 shadow-emerald hover:brightness-110">
                  <Icon name="plus" className="w-3.5 h-3.5" /> Texto
                </button>
                <button onClick={() => setModalClase({ open: true, data: null })} className="px-3.5 py-2 rounded-xl bg-app-navy text-white text-xs font-bold flex items-center gap-1.5 shadow-card hover:brightness-110">
                  <Icon name="video" className="w-3.5 h-3.5" /> Clase
                </button>
                <button onClick={() => setModalApunte({ open: true, data: null })} className="px-3.5 py-2 rounded-xl bg-app-amber text-black text-xs font-bold flex items-center gap-1.5 shadow-card hover:brightness-110">
                  <Icon name="edit-3" className="w-3.5 h-3.5" /> Apunte
                </button>
              </div>
            </div>

            {/* Inner Tabs Navigation */}
            <div className="flex gap-2 overflow-x-auto p-1.5 bg-app-surface border border-app-border rounded-2xl no-scrollbar">
              {[
                { id: 'params', label: 'Parámetros & Temario', icon: 'clipboard-list' },
                { id: 'biblio', label: 'Bibliografía', icon: 'book-marked' },
                { id: 'clases', label: 'Protocolo de Clases', icon: 'presentation' },
                { id: 'apuntes', label: 'Apuntes & Resúmenes', icon: 'file-edit' },
                { id: 'pdfs', label: 'PDFs', icon: 'file-check' },
                { id: 'examenes', label: 'Exámenes', icon: 'calendar' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setInnerTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold whitespace-nowrap transition-all ${
                    innerTab === t.id
                      ? 'bg-app-card text-app-emerald shadow-card border border-app-border'
                      : 'text-app-muted hover:text-app-text'
                  }`}
                >
                  <Icon name={t.icon} className="w-4 h-4" /> {t.label}
                </button>
              ))}
            </div>

            {/* 1. PARÁMETROS & TEMARIO */}
            {innerTab === 'params' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div className="bg-app-card border border-app-border p-5 rounded-2xl shadow-card">
                    <div className="text-xs font-extrabold uppercase text-app-emerald mb-1">Docente / Cátedra</div>
                    <div className="text-lg font-extrabold text-app-text">{currentMateria.docente || 'Sin docente'}</div>
                    <div className="text-xs text-app-muted mt-2">Año: {currentMateria.año_cursado || 2026} • Cuatri: {currentMateria.cuatrimestre || '2'}</div>
                  </div>
                  <div className="bg-app-card border border-app-border p-5 rounded-2xl shadow-card">
                    <div className="text-xs font-extrabold uppercase text-app-emerald mb-1">Fechas de Parciales</div>
                    <div className="text-sm font-extrabold text-app-text">1° Parcial: {currentMateria.fecha_parcial1 || 'A definir'}</div>
                    <div className="text-sm font-extrabold text-app-text mt-1">2° Parcial: {currentMateria.fecha_parcial2 || 'A definir'}</div>
                    <div className="text-xs text-app-muted mt-2">Modalidad: {currentMateria.modalidad_parcial || 'Presencial'}</div>
                  </div>
                  <div className="bg-app-card border border-app-border p-5 rounded-2xl shadow-card">
                    <div className="text-xs font-extrabold uppercase text-app-emerald mb-1">Examen Final & Links</div>
                    <div className="text-sm font-extrabold text-app-text">Final: {currentMateria.fecha_final || 'A definir'}</div>
                    <div className="flex gap-2 mt-3">
                      {currentMateria.link_programa && <a href={currentMateria.link_programa} target="_blank" className="px-3 py-1 bg-app-emerald-bg text-app-emerald text-xs font-bold rounded-lg border border-app-emerald/30">Programa</a>}
                      {currentMateria.link_drive && <a href={currentMateria.link_drive} target="_blank" className="px-3 py-1 bg-app-navy-bg text-app-navy text-xs font-bold rounded-lg border border-app-navy/30">Drive</a>}
                    </div>
                  </div>
                </div>

                <div className="bg-app-card border border-app-border p-6 rounded-2xl shadow-card space-y-3">
                  <h4 className="text-base font-extrabold text-app-text flex items-center gap-2">
                    <Icon name="file-text" className="w-5 h-5 text-app-emerald" /> Temario 1° Parcial
                  </h4>
                  <p className="text-sm text-app-text whitespace-pre-wrap leading-relaxed">{currentMateria.temas_parcial1 || 'No hay temario cargado para el 1° parcial.'}</p>
                </div>
                <div className="bg-app-card border border-app-border p-6 rounded-2xl shadow-card space-y-3">
                  <h4 className="text-base font-extrabold text-app-text flex items-center gap-2">
                    <Icon name="file-text" className="w-5 h-5 text-app-emerald" /> Temario 2° Parcial
                  </h4>
                  <p className="text-sm text-app-text whitespace-pre-wrap leading-relaxed">{currentMateria.temas_parcial2 || 'No hay temario cargado para el 2° parcial.'}</p>
                </div>
              </div>
            )}

            {/* 2. BIBLIOGRAFÍA */}
            {innerTab === 'biblio' && (
              <div className="space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {['todos', 'parcial', 'Pendiente', 'Leído', 'Resumiendo'].map(f => (
                    <button
                      key={f}
                      onClick={() => setBiblioFilter(f)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                        biblioFilter === f
                          ? 'bg-app-emerald text-white border-app-emerald shadow-emerald'
                          : 'bg-app-card border-app-border text-app-muted hover:text-app-text'
                      }`}
                    >
                      {f === 'todos' ? 'Todos los textos' : f === 'parcial' ? '⭐ Va al Parcial' : f}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {biblio
                    .filter(b => b.materia_id === selectedMateriaId || b.materia === currentMateria.nombre)
                    .filter(b => biblioFilter === 'todos' ? true : biblioFilter === 'parcial' ? b.va_parcial : b.estado === biblioFilter)
                    .map(t => (
                      <div key={t.id} className="bg-app-card border border-app-border p-5 rounded-2xl shadow-card flex flex-col justify-between hover:shadow-fluffy transition-all">
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-app-surface border border-app-border text-app-muted">
                              {t.unidad || 'Unidad 1'}
                            </span>
                            <span
                              onClick={() => handleToggleBiblioEstado(t.id)}
                              className={`text-xs font-bold px-3 py-1 rounded-full cursor-pointer border transition-all ${
                                t.estado === 'Leído' ? 'bg-app-emerald-bg text-app-emerald border-app-emerald/40' :
                                t.estado === 'Resumiendo' ? 'bg-app-navy-bg text-app-navy border-app-navy/40' :
                                'bg-app-amber-bg text-app-amber border-app-amber/40'
                              }`}
                            >
                              {t.estado || 'Pendiente'}
                            </span>
                          </div>
                          <h4 className="text-base font-extrabold text-app-text mb-1 leading-snug">{t.titulo_texto}</h4>
                          <p className="text-xs text-app-muted mb-3 italic">✍️ {t.autores || 'Autor no especificado'}</p>
                          {t.notas && <p className="text-xs text-app-muted bg-app-surface p-2.5 rounded-xl border border-app-border mb-3">{t.notas}</p>}
                        </div>

                        <div className="flex justify-between items-center pt-3 border-t border-app-border text-xs">
                          <span className={`font-bold ${t.va_parcial ? 'text-app-amber' : 'text-app-muted'}`}>
                            {t.va_parcial ? '⭐ Va al Parcial' : 'Lectura regular'}
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => setModalBiblio({ open: true, data: t })} className="p-1.5 rounded-lg bg-app-surface border border-app-border hover:border-app-emerald">
                              <Icon name="edit-2" className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteBiblio(t.id)} className="p-1.5 rounded-lg bg-app-ruby-bg text-app-ruby border border-app-ruby/30">
                              <Icon name="trash" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 3. PROTOCOLO DE CLASES */}
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
                        <strong className="text-app-emerald">💡 Énfasis del profesor:</strong><br />{c.aclaraciones}
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t border-app-border">
                      <div className="flex gap-2">
                        {c.link_grabacion && <a href={c.link_grabacion} target="_blank" className="px-2.5 py-1 bg-app-navy-bg text-app-navy text-xs font-bold rounded-lg border border-app-navy/30">Audio</a>}
                        {c.link_doc_resumen && <a href={c.link_doc_resumen} target="_blank" className="px-2.5 py-1 bg-app-emerald-bg text-app-emerald text-xs font-bold rounded-lg border border-app-emerald/30">Doc</a>}
                      </div>
                      <button onClick={() => handleDeleteClase(c.id)} className="p-1.5 text-app-ruby hover:bg-app-ruby-bg rounded-lg">
                        <Icon name="trash" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 4. APUNTES */}
            {innerTab === 'apuntes' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {apuntes.filter(a => a.materia_id === selectedMateriaId || a.materia === currentMateria.nombre).map(a => (
                  <div key={a.id} className="bg-app-card border border-app-border p-5 rounded-2xl shadow-card flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-app-amber-bg text-app-amber border border-app-amber/30">{a.tipo}</span>
                        <span className="text-xs text-app-muted">{a.unidad}</span>
                      </div>
                      <h4 className="text-lg font-extrabold text-app-text mb-2">{a.titulo}</h4>
                      <p className="text-xs text-app-muted line-clamp-4 leading-relaxed mb-4">{(a.contenido || '').replace(/[#*`>]/g, '')}</p>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-app-border text-xs">
                      <span className="font-bold text-app-amber">{a.va_parcial ? '⭐ Para Parcial' : 'Apunte General'}</span>
                      <div className="flex gap-2">
                        <button onClick={() => setModalApunte({ open: true, data: a })} className="px-3 py-1 bg-app-emerald-bg text-app-emerald font-bold rounded-lg border border-app-emerald/30">Editar</button>
                        <button onClick={() => handleDeleteApunte(a.id)} className="p-1.5 text-app-ruby hover:bg-app-ruby-bg rounded-lg"><Icon name="trash" className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 5. PDFs */}
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

            {/* 6. EXÁMENES */}
            {innerTab === 'examenes' && (
              <div className="space-y-4">
                <button onClick={() => setModalExamen({ open: true, data: null })} className="bg-app-emerald text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-emerald">
                  <Icon name="plus" className="w-4 h-4" /> Registrar Fecha de Examen
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {examenes.filter(e => e.materia_id === selectedMateriaId || e.materia === currentMateria.nombre).map(ex => (
                    <div key={ex.id} className="bg-app-card border border-app-border p-5 rounded-2xl shadow-card space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-lg font-extrabold text-app-text">{ex.nombre}</h4>
                          <p className="text-xs text-app-muted">📅 Fecha: {ex.fecha} • Modalidad: {ex.modalidad}</p>
                        </div>
                        <button onClick={() => handleDeleteExamen(ex.id)} className="text-app-ruby p-1.5"><Icon name="trash" className="w-4 h-4" /></button>
                      </div>
                      {ex.temas && <p className="text-xs text-app-text bg-app-surface p-3 rounded-xl border border-app-border">{ex.temas}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: INGESTIÓN PDF ── */}
        {activeTab === 'pdf' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-extrabold flex items-center gap-2 text-app-text">
              <Icon name="file-up" className="w-7 h-7 text-app-emerald" /> Ingestión Inteligente de PDFs
            </h2>

            {/* Dropzone */}
            <label className="block border-2 border-dashed border-app-emerald/60 hover:border-app-emerald bg-app-card/60 p-10 rounded-3xl text-center cursor-pointer shadow-fluffy transition-all hover:bg-app-emerald-bg/10">
              <div className="w-14 h-14 bg-app-emerald-bg text-app-emerald rounded-2xl mx-auto flex items-center justify-center mb-3">
                <Icon name="upload-cloud" className="w-8 h-8" />
              </div>
              <div className="text-lg font-extrabold text-app-text">Arrastra tu PDF o Toca para Subir</div>
              <div className="text-xs text-app-muted mt-1">Soporta iOS Share Sheet, WhatsApp, Tablets y computadoras</div>
              <input type="file" accept="application/pdf" className="hidden" onChange={handlePDFUpload} />
            </label>

            {/* Ingestion Match Form */}
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
                  <label htmlFor="ingVaParcial" className="text-sm font-bold text-app-amber cursor-pointer">⭐ ESTE TEXTO VA PARA EL PARCIAL</label>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Texto Extraído (OCR)</label>
                  <textarea value={ingestionData.extractedText} readOnly className="w-full h-28 p-3 rounded-xl bg-app-surface border border-app-border text-xs text-app-muted outline-none" />
                </div>

                <button type="submit" className="w-full py-3.5 bg-app-emerald text-white font-bold rounded-xl shadow-emerald hover:brightness-110">
                  ✅ Confirmar e Ingestar a Supabase
                </button>
              </form>
            )}

            {/* Recent Ingested PDFs */}
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

        {/* ── TAB: MI PERFIL ── */}
        {activeTab === 'perfil' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-extrabold flex items-center gap-2 text-app-text">
                <Icon name="user-check" className="w-7 h-7 text-app-emerald" /> Mi Perfil Académico
              </h2>
              <button onClick={() => setModalMateria({ open: true, data: null })} className="bg-app-emerald text-white font-bold px-4 py-2 rounded-xl text-xs shadow-emerald">
                + Crear Materia
              </button>
            </div>

            {/* Profile Hero */}
            <div className="bg-gradient-to-br from-app-surface to-app-card border border-app-border p-6 md:p-8 rounded-3xl shadow-fluffy flex flex-wrap items-center gap-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-blue-600 text-white flex items-center justify-center text-4xl shadow-emerald border-2 border-white/20">
                🧠
              </div>
              <div className="flex-1 min-w-[220px]">
                <h3 className="text-2xl font-extrabold text-app-text">Facundo Lazarte</h3>
                <p className="text-sm font-semibold text-app-emerald mt-0.5">Licenciatura en Psicología — Cursado 2026</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs px-3 py-1 rounded-full bg-app-card border border-app-border text-app-muted font-bold">📚 React + Tailwind Engine</span>
                  <span className="text-xs px-3 py-1 rounded-full bg-app-card border border-app-border text-app-muted font-bold">⚡ Supabase Cloud Sync</span>
                  <span className="text-xs px-3 py-1 rounded-full bg-app-card border border-app-border text-app-muted font-bold">✨ Dual Theme (Crema & Dark)</span>
                </div>
              </div>
            </div>

            {/* Global Stats */}
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

            {/* Materias Management in Profile */}
            <div className="bg-app-card border border-app-border p-6 rounded-3xl shadow-card space-y-4">
              <h3 className="text-lg font-extrabold text-app-text flex items-center gap-2">
                <Icon name="sliders" className="w-5 h-5 text-app-emerald" /> Configuración de Materias
              </h3>
              <div className="space-y-3">
                {materias.map(m => (
                  <div key={m.id} className="flex justify-between items-center p-4 rounded-xl bg-app-surface border border-app-border">
                    <div>
                      <div className="font-extrabold text-app-text text-sm">{m.nombre}</div>
                      <div className="text-xs text-app-muted">{m.docente || 'Sin docente'} • {m.cuatrimestre === 0 ? 'Anual' : `${m.cuatrimestre}° Cuatri`}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setModalMateria({ open: true, data: m })} className="px-3 py-1.5 bg-app-card border border-app-border text-xs font-bold rounded-lg">Editar</button>
                      <button onClick={() => handleDeleteMateria(m.id)} className="px-3 py-1.5 bg-app-ruby-bg text-app-ruby text-xs font-bold rounded-lg border border-app-ruby/30">Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Backups & Actions */}
            <div className="bg-app-card border border-app-border p-6 rounded-3xl shadow-card space-y-4">
              <h3 className="text-lg font-extrabold text-app-text flex items-center gap-2">
                <Icon name="hard-drive" className="w-5 h-5 text-app-emerald" /> Respaldo y Acciones Rápidas
              </h3>
              <div className="flex flex-wrap gap-3">
                <button onClick={exportBackupJSON} className="px-4 py-2.5 bg-app-emerald text-white font-bold text-xs rounded-xl shadow-emerald flex items-center gap-2">
                  <Icon name="download" className="w-4 h-4" /> Exportar Backup (JSON)
                </button>
                <button onClick={triggerPing} className="px-4 py-2.5 bg-app-navy text-white font-bold text-xs rounded-xl shadow-card flex items-center gap-2">
                  <Icon name="zap" className="w-4 h-4" /> Ping Keep-Alive
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
              <Icon name="database" className="w-7 h-7 text-app-emerald" /> Sistema y Conexión Supabase
            </h2>

            <div className="bg-app-card border border-app-border p-6 rounded-3xl shadow-card space-y-4">
              <h3 className="text-base font-extrabold text-app-text">🔌 Credenciales Activas de Supabase</h3>
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
                  <Icon name="zap" className="w-4 h-4" /> Probar Ping Supabase
                </button>
                <button onClick={processSyncQueue} className="px-4 py-2.5 bg-app-surface border border-app-border font-bold text-xs rounded-xl flex items-center gap-2 text-app-text">
                  <Icon name="refresh-cw" className="w-4 h-4" /> Sincronizar Cola Offline ({syncQueue.length})
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ══ MODAL MATERIA ══ */}
      {modalMateria.open && (
        <ModalMateria
          initialData={modalMateria.data}
          onClose={() => setModalMateria({ open: false, data: null })}
          onSave={handleSaveMateria}
        />
      )}

      {/* ══ MODAL BIBLIOGRAFIA ══ */}
      {modalBiblio.open && (
        <ModalBiblio
          initialData={modalBiblio.data}
          onClose={() => setModalBiblio({ open: false, data: null })}
          onSave={handleSaveBiblio}
        />
      )}

      {/* ══ MODAL CLASE ══ */}
      {modalClase.open && (
        <ModalClase
          initialData={modalClase.data}
          onClose={() => setModalClase({ open: false, data: null })}
          onSave={handleSaveClase}
        />
      )}

      {/* ══ MODAL APUNTE ══ */}
      {modalApunte.open && (
        <ModalApunte
          initialData={modalApunte.data}
          onClose={() => setModalApunte({ open: false, data: null })}
          onSave={handleSaveApunte}
        />
      )}

      {/* ══ MODAL EXAMEN ══ */}
      {modalExamen.open && (
        <ModalExamen
          initialData={modalExamen.data}
          onClose={() => setModalExamen({ open: false, data: null })}
          onSave={handleSaveExamen}
        />
      )}

      {/* ══ MODAL PDF VIEWER ══ */}
      {modalPDFViewer.open && (
        <ModalPDFViewer
          data={modalPDFViewer.data}
          onClose={() => setModalPDFViewer({ open: false, data: null })}
        />
      )}

      {/* ══ TOAST NOTIFICATION ══ */}
      <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 pointer-events-none ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="bg-app-card border border-app-emerald text-app-text px-6 py-3 rounded-full shadow-fluffy flex items-center gap-2.5 text-sm font-bold">
          <span>{toast.icon}</span>
          <span>{toast.msg}</span>
        </div>
      </div>
    </div>
  );
}

// ── 4. MODAL COMPONENTS ──

function ModalMateria({ initialData, onClose, onSave }) {
  const [form, setForm] = useState(initialData || {
    nombre: '', abreviatura: '', docente: '', color: '#10B981',
    año_cursado: 2026, cuatrimestre: 2, descripcion: '',
    fecha_parcial1: '', fecha_parcial2: '', fecha_final: '',
    modalidad_parcial: 'Presencial', temas_parcial1: '', temas_parcial2: '', temas_final: '',
    link_programa: '', link_drive: ''
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 shadow-fluffy space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-extrabold text-app-text">{initialData ? 'Editar Materia' : 'Nueva Materia'}</h3>
          <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text text-lg">✕</button>
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
            💾 Guardar Materia
          </button>
        </form>
      </div>
    </div>
  );
}

function ModalBiblio({ initialData, onClose, onSave }) {
  const [form, setForm] = useState(initialData || {
    unidad: 'Unidad 1', nro_texto: 1, titulo_texto: '', autores: '',
    estado: 'Pendiente', tipo_clase: 'Teórica', va_parcial: false, link_resumen: '', notas: ''
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 shadow-fluffy space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-extrabold text-app-text">{initialData ? 'Editar Texto' : 'Nuevo Texto Académico'}</h3>
          <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text">✕</button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Unidad</label>
              <input value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Estado</label>
              <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none">
                <option value="Pendiente">⏳ Pendiente</option>
                <option value="Leído">✅ Leído</option>
                <option value="Resumiendo">📝 Resumiendo</option>
                <option value="Salteado">⏩ Salteado</option>
                <option value="No va">❌ No va</option>
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

          <div className="flex items-center gap-2">
            <input type="checkbox" id="bibVaParcial" checked={form.va_parcial} onChange={e => setForm({ ...form, va_parcial: e.target.checked })} className="w-5 h-5 accent-emerald-500 rounded" />
            <label htmlFor="bibVaParcial" className="text-sm font-bold text-app-amber cursor-pointer">⭐ Va para el Parcial</label>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Notas y Conceptos Clave</label>
            <textarea value={form.notas || ''} onChange={e => setForm({ ...form, notas: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm text-app-text outline-none h-20" />
          </div>

          <button type="submit" className="w-full py-3.5 bg-app-emerald text-white font-bold rounded-xl shadow-emerald hover:brightness-110">
            📚 Guardar Texto
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
          <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text">✕</button>
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
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1">💡 Aclaraciones & Énfasis del Profesor</label>
            <textarea value={form.aclaraciones} onChange={e => setForm({ ...form, aclaraciones: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm text-app-text outline-none h-24" />
          </div>

          <button type="submit" className="w-full py-3.5 bg-app-navy text-white font-bold rounded-xl shadow-card hover:brightness-110">
            🎓 Guardar Protocolo de Clase
          </button>
        </form>
      </div>
    </div>
  );
}

function ModalApunte({ initialData, onClose, onSave }) {
  const [form, setForm] = useState(initialData || {
    titulo: '', tipo: 'Resumen', unidad: 'Unidad 1', va_parcial: false, contenido: ''
  });
  const [preview, setPreview] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 shadow-fluffy space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-extrabold text-app-text">{initialData ? 'Editar Apunte' : 'Nuevo Apunte'}</h3>
          <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text">✕</button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Título</label>
              <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Tipo</label>
              <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none">
                <option value="Resumen">📋 Resumen Completo</option>
                <option value="Mapa Conceptual">🗺️ Mapa Conceptual</option>
                <option value="Fichas">🗂️ Fichas de Repaso</option>
                <option value="Notas de Clase">🎓 Notas de Clase</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="apuVaParcial" checked={form.va_parcial} onChange={e => setForm({ ...form, va_parcial: e.target.checked })} className="w-5 h-5 accent-emerald-500 rounded" />
              <label htmlFor="apuVaParcial" className="text-sm font-bold text-app-amber cursor-pointer">⭐ Va para el Parcial</label>
            </div>
            <button type="button" onClick={() => setPreview(!preview)} className="px-3 py-1 bg-app-surface border border-app-border rounded-lg text-xs font-bold text-app-text">
              {preview ? '✏️ Modo Editor' : '👁️ Vista Previa'}
            </button>
          </div>

          {preview ? (
            <div className="p-4 bg-app-surface border border-app-border rounded-2xl min-h-[220px] text-sm text-app-text leading-relaxed whitespace-pre-wrap">
              {form.contenido || 'Sin contenido aún...'}
            </div>
          ) : (
            <textarea
              value={form.contenido}
              onChange={e => setForm({ ...form, contenido: e.target.value })}
              className="w-full h-56 p-4 rounded-2xl bg-app-surface border border-app-border text-sm text-app-text outline-none leading-relaxed font-mono"
              placeholder="## Ejes principales...&#10;&#10;**Concepto:** Definición..."
            />
          )}

          <button type="submit" className="w-full py-3.5 bg-app-emerald text-white font-bold rounded-xl shadow-emerald hover:brightness-110">
            📝 Guardar Apunte en Supabase
          </button>
        </form>
      </div>
    </div>
  );
}

function ModalExamen({ initialData, onClose, onSave }) {
  const [form, setForm] = useState(initialData || {
    nombre: '', tipo: 'Parcial 1', fecha: new Date().toISOString().split('T')[0], modalidad: 'Presencial', temas: ''
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-app-modal border border-app-border w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 shadow-fluffy space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-extrabold text-app-text">Registrar Examen</h3>
          <button onClick={onClose} className="p-2 text-app-muted hover:text-app-text">✕</button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Nombre</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" placeholder="Ej: Primer Parcial" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Fecha</label>
              <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} required className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Modalidad</label>
              <select value={form.modalidad} onChange={e => setForm({ ...form, modalidad: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm font-bold text-app-text outline-none">
                <option value="Presencial">Presencial</option>
                <option value="Domiciliario">Domiciliario</option>
                <option value="Oral">Oral</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-app-emerald mb-1">Temario</label>
            <textarea value={form.temas} onChange={e => setForm({ ...form, temas: e.target.value })} className="w-full p-3 rounded-xl bg-app-surface border border-app-border text-sm text-app-text outline-none h-20" />
          </div>

          <button type="submit" className="w-full py-3.5 bg-app-amber text-black font-bold rounded-xl shadow-card hover:brightness-110">
            📅 Guardar Examen
          </button>
        </form>
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
          <button onClick={onClose} className="px-3 py-1.5 bg-app-ruby-bg text-app-ruby font-bold text-xs rounded-xl border border-app-ruby/30">✕ Cerrar</button>
        </div>
        <div className="p-6 overflow-y-auto text-sm text-app-text leading-relaxed whitespace-pre-wrap">
          {data.texto_extraido || 'Sin texto extraído en este documento.'}
        </div>
      </div>
    </div>
  );
}

// ── 5. MOUNT REACT APP ──
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
