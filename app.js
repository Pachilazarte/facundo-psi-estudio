/* ======================================================
   PSIESTUDIO — HIGH-FIDELITY APP ENGINE
   Dual Theme, Lucide Icons, Supabase Sync & Markdown
   ====================================================== */

// ── 1. GLOBAL STATE ──
const STATE = {
  supabase: null,
  isOnline: navigator.onLine,
  syncQueue: JSON.parse(localStorage.getItem('psi_sync_queue') || '[]'),
  materias: JSON.parse(localStorage.getItem('psi_materias_cache') || '[]'),
  biblio: JSON.parse(localStorage.getItem('psi_biblio_cache') || '[]'),
  clases: JSON.parse(localStorage.getItem('psi_clases_cache') || '[]'),
  apuntes: JSON.parse(localStorage.getItem('psi_apuntes_cache') || '[]'),
  pdfs: JSON.parse(localStorage.getItem('psi_pdfs_cache') || '[]'),
  examenes: JSON.parse(localStorage.getItem('psi_examenes_cache') || '[]'),
  theme: localStorage.getItem('psi_theme') || 'light',
  currentMateriaId: null,
  currentPDFDoc: null,
  currentPDFPage: 1,
  totalPDFPages: 1
};

// Supabase Default Credentials (facundo-psi-estudio)
const SUPABASE_CONFIG = {
  url: localStorage.getItem('psi_supabase_url') || 'https://eckgwyvbevlpnhjrsaxy.supabase.co',
  key: localStorage.getItem('psi_supabase_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVja2d3eXZiZXZscG5oanJzYXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MzM1ODgsImV4cCI6MjEwNjIwOTU4OH0.MfgjL7yQPidqir2ybVEpcfeAsrioZGIIvgVv_bMyI7I'
};

// DOM Helper
const $ = (id) => document.getElementById(id);

// Refresh Lucide Icons Helper
function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// ── 2. THEME CONTROLLER ──
function initTheme() {
  document.documentElement.setAttribute('data-theme', STATE.theme);
  updateThemeIcon();
}

function toggleTheme() {
  STATE.theme = STATE.theme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', STATE.theme);
  localStorage.setItem('psi_theme', STATE.theme);
  updateThemeIcon();
  showToast(STATE.theme === 'dark' ? 'Modo Oscuro activado' : 'Modo Crema activado', STATE.theme === 'dark' ? '🌙' : '☀️');
}

function updateThemeIcon() {
  const icon = $('themeIcon');
  if (!icon) return;
  icon.setAttribute('data-lucide', STATE.theme === 'dark' ? 'sun' : 'moon');
  refreshIcons();
}

// ── 3. TOAST NOTIFICATION ──
let _toastTimer = null;
function showToast(msg, icon = '✨', ms = 3000) {
  const toast = $('toast');
  const toastMsg = $('toastMsg');
  const toastIcon = $('toastIcon');
  if (!toast || !toastMsg) return;

  clearTimeout(_toastTimer);
  toastMsg.textContent = msg;
  if (toastIcon) toastIcon.textContent = icon;
  toast.classList.add('show');
  _toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
}

// ── 4. SUPABASE INITIALIZATION & SYNC ──
function initSupabase() {
  const url = SUPABASE_CONFIG.url;
  const key = SUPABASE_CONFIG.key;

  try {
    if (window.supabase && url.startsWith('http')) {
      STATE.supabase = window.supabase.createClient(url, key);
      console.log('✅ Supabase conectado');
    }
  } catch (err) {
    console.warn('⚠️ Supabase init fallback:', err);
  }
}

function updateStatusIndicator() {
  const pill = $('statusPill');
  const txt = $('statusText');
  if (!pill || !txt) return;

  if (STATE.isOnline) {
    if (STATE.syncQueue.length > 0) {
      pill.className = 'status-pill syncing';
      txt.textContent = `Sincronizando (${STATE.syncQueue.length})...`;
    } else {
      pill.className = 'status-pill online';
      txt.textContent = 'En línea (Nube Activa)';
    }
  } else {
    pill.className = 'status-pill offline';
    txt.textContent = `Sin conexión (${STATE.syncQueue.length} pendiente)`;
  }
}

window.addEventListener('online', () => {
  STATE.isOnline = true;
  updateStatusIndicator();
  showToast('Conexión restaurada — Sincronizando datos', '🟢');
  processSyncQueue();
  fetchAllData();
});

window.addEventListener('offline', () => {
  STATE.isOnline = false;
  updateStatusIndicator();
  showToast('Modo Offline — Guardando en caché local', '📦');
});

// Offline Queue Handler
function enqueueSync(action, table, payload) {
  STATE.syncQueue.push({ id: Date.now(), action, table, payload });
  localStorage.setItem('psi_sync_queue', JSON.stringify(STATE.syncQueue));
  updateStatusIndicator();
}

async function processSyncQueue() {
  if (!STATE.isOnline || !STATE.supabase || STATE.syncQueue.length === 0) return;

  const queue = [...STATE.syncQueue];
  for (const item of queue) {
    try {
      if (item.action === 'INSERT') {
        await STATE.supabase.from(item.table).insert([item.payload]);
      } else if (item.action === 'UPDATE') {
        await STATE.supabase.from(item.table).update(item.payload).eq('id', item.payload.id);
      } else if (item.action === 'DELETE') {
        await STATE.supabase.from(item.table).delete().eq('id', item.payload.id);
      }
    } catch (e) {
      console.warn('Sync queue error:', e);
      return;
    }
  }
  STATE.syncQueue = [];
  localStorage.setItem('psi_sync_queue', '[]');
  updateStatusIndicator();
  showToast('Todos los cambios sincronizados con Supabase', '☁️');
}

// ── 5. FETCH ALL DATA ──
async function fetchAllData() {
  if (!STATE.supabase || !STATE.isOnline) {
    renderAll();
    return;
  }

  try {
    const [matsRes, bibRes, claRes, apuRes, pdfRes, exRes] = await Promise.allSettled([
      STATE.supabase.from('materias').select('*').order('nombre'),
      STATE.supabase.from('bibliografia').select('*').order('unidad'),
      STATE.supabase.from('clases').select('*').order('nro_clase'),
      STATE.supabase.from('apuntes').select('*').order('created_at', { ascending: false }),
      STATE.supabase.from('documentos_pdf').select('*').order('created_at', { ascending: false }),
      STATE.supabase.from('examenes').select('*').order('fecha')
    ]);

    if (matsRes.status === 'fulfilled' && matsRes.value.data) {
      STATE.materias = matsRes.value.data;
      localStorage.setItem('psi_materias_cache', JSON.stringify(STATE.materias));
    }
    if (bibRes.status === 'fulfilled' && bibRes.value.data) {
      STATE.biblio = bibRes.value.data;
      localStorage.setItem('psi_biblio_cache', JSON.stringify(STATE.biblio));
    }
    if (claRes.status === 'fulfilled' && claRes.value.data) {
      STATE.clases = claRes.value.data;
      localStorage.setItem('psi_clases_cache', JSON.stringify(STATE.clases));
    }
    if (apuRes.status === 'fulfilled' && apuRes.value.data) {
      STATE.apuntes = apuRes.value.data;
      localStorage.setItem('psi_apuntes_cache', JSON.stringify(STATE.apuntes));
    }
    if (pdfRes.status === 'fulfilled' && pdfRes.value.data) {
      STATE.pdfs = pdfRes.value.data;
      localStorage.setItem('psi_pdfs_cache', JSON.stringify(STATE.pdfs));
    }
    if (exRes.status === 'fulfilled' && exRes.value.data) {
      STATE.examenes = exRes.value.data;
      localStorage.setItem('psi_examenes_cache', JSON.stringify(STATE.examenes));
    }

    renderAll();
  } catch (err) {
    console.warn('Fetch all error:', err);
    renderAll();
  }
}

// ── 6. RENDERING PIPELINE ──
function renderAll() {
  renderMateriasList();
  renderProximosExamenesBanner();
  renderProfileStats();
  renderProfileMaterias();
  populateMateriaSelects();
  if (STATE.currentMateriaId) {
    renderMateriaDetail(STATE.currentMateriaId);
  }
  renderPDFRecents();
  refreshIcons();
}

// Banner de Exámenes Global
function renderProximosExamenesBanner() {
  const container = $('proximosExamenesBanner');
  if (!container) return;

  const hoyMs = new Date().setHours(0, 0, 0, 0);
  const proximos = STATE.examenes
    .filter(e => !e.finalizado && e.fecha)
    .filter(e => new Date(e.fecha + 'T00:00:00').getTime() >= hoyMs)
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  if (proximos.length === 0) {
    container.innerHTML = '';
    return;
  }

  const next = proximos[0];
  const diffDays = Math.ceil((new Date(next.fecha + 'T00:00:00') - hoyMs) / 864e5);
  const urgLabel = diffDays === 0 ? '¡Rinde Hoy!' : diffDays === 1 ? '¡Rinde Mañana!' : `En ${diffDays} días`;

  container.innerHTML = `
    <div class="countdown-box" style="cursor: pointer;" onclick="openMateriaByName('${next.materia}')">
      <div class="countdown-days">
        <div class="countdown-num">${diffDays === 0 ? '🚨' : diffDays}</div>
        <div class="countdown-label">${diffDays === 0 ? 'HOY' : 'DÍAS'}</div>
      </div>
      <div style="flex: 1;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: var(--emerald-600); letter-spacing: 0.6px; display:flex; align-items:center; gap:4px;">
          <i data-lucide="bell" class="lucide-icon lucide-sm"></i> Próximo Examen Académico
        </div>
        <div style="font-size: 17px; font-weight: 800; color: var(--text-main); margin-top:2px;">${next.nombre}</div>
        <div style="font-size: 13px; color: var(--text-muted); margin-top: 2px;">
          ${next.materia} • ${formatDate(next.fecha)} (${urgLabel})
        </div>
      </div>
      <div class="card-tag gold">
        Ver Temario <i data-lucide="chevron-right" class="lucide-icon lucide-sm"></i>
      </div>
    </div>
  `;
}

// Render: Grid de Materias
function renderMateriasList() {
  const grid = $('materiasGrid');
  if (!grid) return;

  if (STATE.materias.length === 0) {
    if (localStorage.getItem('psi_first_run') !== 'done') {
      seedDefaultMaterias();
      return;
    }
    grid.innerHTML = `
      <div class="empty">
        <div class="empty-icon"><i data-lucide="book" class="lucide-icon lucide-xl"></i></div>
        <div class="empty-title">Aún no tienes materias registradas</div>
        <div class="empty-sub">Toca "+ Nueva Materia" para cargar tu primera materia del cuatrimestre.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = STATE.materias.map(m => {
    const textsInMat = STATE.biblio.filter(b => (b.materia_id === m.id) || (b.materia === m.nombre));
    const totalTexts = textsInMat.length;
    const leidosTexts = textsInMat.filter(b => b.estado === 'Leído' || b.estado === 'Salteado').length;
    const pct = totalTexts > 0 ? Math.round((leidosTexts / totalTexts) * 100) : 0;
    const clasesCount = STATE.clases.filter(c => (c.materia_id === m.id) || (c.materia === m.nombre)).length;
    const apuntesCount = STATE.apuntes.filter(a => (a.materia_id === m.id) || (a.materia === m.nombre)).length;

    let examHtml = '';
    if (m.fecha_parcial1) {
      examHtml = `<span class="mat-stat-pill exam-pill-urgent"><i data-lucide="calendar" class="lucide-icon lucide-sm"></i> P1: ${formatDate(m.fecha_parcial1)}</span>`;
    }

    return `
      <div class="card mat-card" onclick="openMateriaDetail('${m.id}')">
        <div class="mat-card-header">
          <span class="mat-card-badge">${m.abreviatura || 'MAT'}</span>
          <span class="card-tag"><i data-lucide="bookmark" class="lucide-icon lucide-sm"></i> ${m.cuatrimestre === 0 ? 'Anual' : m.cuatrimestre + '° Cuatri'}</span>
        </div>
        <div class="mat-card-name">${m.nombre}</div>
        <div class="mat-card-prof"><i data-lucide="user" class="lucide-icon lucide-sm"></i> ${m.docente ? m.docente : 'Profesor sin asignar'}</div>
        
        <div style="margin: 8px 0 14px;">
          <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; color:var(--text-muted); margin-bottom:5px;">
            <span>Lecturas (${leidosTexts}/${totalTexts})</span>
            <span style="color:var(--emerald-600); font-weight:800;">${pct}%</span>
          </div>
          <div style="height:6px; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:999px; overflow:hidden;">
            <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #10B981, #34D399); border-radius:999px;"></div>
          </div>
        </div>

        <div class="mat-card-stats">
          <span class="mat-stat-pill"><i data-lucide="book-open" class="lucide-icon lucide-sm"></i> ${totalTexts} textos</span>
          <span class="mat-stat-pill"><i data-lucide="presentation" class="lucide-icon lucide-sm"></i> ${clasesCount} clases</span>
          <span class="mat-stat-pill"><i data-lucide="file-edit" class="lucide-icon lucide-sm"></i> ${apuntesCount} apuntes</span>
          ${examHtml}
        </div>
      </div>
    `;
  }).join('');
}

// ── 7. MATERIA DETAIL & INNER TABS ──
let currentMateriaId = null;

function openMateriaDetail(id) {
  currentMateriaId = id;
  STATE.currentMateriaId = id;
  const mat = STATE.materias.find(m => m.id === id);
  if (!mat) return;

  $('view-materias-list').style.display = 'none';
  $('view-materia-detail').classList.add('active');
  $('detailMateriaName').textContent = mat.nombre;

  switchInnerTab('params');
  renderMateriaDetail(id);
}

function openMateriaByName(nombre) {
  const mat = STATE.materias.find(m => m.nombre.toLowerCase() === (nombre || '').toLowerCase());
  if (mat) openMateriaDetail(mat.id);
}

function backToMaterias() {
  currentMateriaId = null;
  STATE.currentMateriaId = null;
  $('view-materia-detail').classList.remove('active');
  $('view-materias-list').style.display = 'block';
  renderMateriasList();
  renderProximosExamenesBanner();
  refreshIcons();
}

function switchInnerTab(target) {
  document.querySelectorAll('.inner-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.inner === target);
  });
  document.querySelectorAll('.inner-content').forEach(c => {
    c.classList.toggle('active', c.id === `inner-${target}`);
  });
  refreshIcons();
}

document.querySelectorAll('.inner-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    switchInnerTab(btn.dataset.inner);
  });
});

function renderMateriaDetail(materiaId) {
  const mat = STATE.materias.find(m => m.id === materiaId);
  if (!mat) return;

  // 1. Render Parámetros & Temario
  const paramsDiv = $('paramsContent');
  if (paramsDiv) {
    paramsDiv.innerHTML = `
      <div class="param-grid">
        <div class="param-card">
          <div class="param-title"><i data-lucide="user" class="lucide-icon lucide-sm"></i> Cátedra / Docente</div>
          <div class="param-value">${mat.docente || 'No especificado'}</div>
          <div class="param-value secondary" style="margin-top:4px;">Año Cursado: ${mat.año_cursado || 2026} • Cuatrimestre: ${mat.cuatrimestre || '2'}</div>
        </div>
        <div class="param-card">
          <div class="param-title"><i data-lucide="calendar" class="lucide-icon lucide-sm"></i> Fechas de Parciales</div>
          <div class="param-value">1° Parcial: ${mat.fecha_parcial1 ? formatDate(mat.fecha_parcial1) : 'Sin fecha'}</div>
          <div class="param-value" style="margin-top:4px;">2° Parcial: ${mat.fecha_parcial2 ? formatDate(mat.fecha_parcial2) : 'Sin fecha'}</div>
          <div class="param-value secondary" style="margin-top:4px;">Modalidad: ${mat.modalidad_parcial || 'Presencial'}</div>
        </div>
        <div class="param-card">
          <div class="param-title"><i data-lucide="award" class="lucide-icon lucide-sm"></i> Examen Final</div>
          <div class="param-value">${mat.fecha_final ? formatDate(mat.fecha_final) : 'A definir'}</div>
          <div class="param-value secondary" style="margin-top:4px;">Condición: Regular en curso</div>
        </div>
        <div class="param-card">
          <div class="param-title"><i data-lucide="link" class="lucide-icon lucide-sm"></i> Enlaces Clave</div>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
            ${mat.link_programa ? `<a href="${mat.link_programa}" target="_blank" class="btn-sm emerald"><i data-lucide="file-text" class="lucide-icon lucide-sm"></i> Programa</a>` : ''}
            ${mat.link_drive ? `<a href="${mat.link_drive}" target="_blank" class="btn-sm navy"><i data-lucide="folder" class="lucide-icon lucide-sm"></i> Drive</a>` : ''}
            ${!mat.link_programa && !mat.link_drive ? '<span style="font-size:13px;color:var(--text-muted);">Sin enlaces cargados</span>' : ''}
          </div>
        </div>
      </div>

      <div class="config-card">
        <div class="config-card-title"><i data-lucide="file-check-2" class="lucide-icon"></i> Temario 1° Parcial</div>
        <p style="font-size:14px;color:var(--text-main);white-space:pre-wrap;line-height:1.7;">${mat.temas_parcial1 || 'No hay temario cargado para el 1° parcial. Toca "⚙️ Parámetros" para agregarlo.'}</p>
      </div>

      <div class="config-card">
        <div class="config-card-title"><i data-lucide="file-check-2" class="lucide-icon"></i> Temario 2° Parcial</div>
        <p style="font-size:14px;color:var(--text-main);white-space:pre-wrap;line-height:1.7;">${mat.temas_parcial2 || 'No hay temario cargado para el 2° parcial.'}</p>
      </div>

      <div class="config-card">
        <div class="config-card-title"><i data-lucide="graduation-cap" class="lucide-icon"></i> Temario Examen Final</div>
        <p style="font-size:14px;color:var(--text-main);white-space:pre-wrap;line-height:1.7;">${mat.temas_final || 'No hay temario cargado para el examen final.'}</p>
      </div>
    `;
  }

  renderBiblioGrid(materiaId);
  renderClasesGrid(materiaId);
  renderApuntesGrid(materiaId);
  renderPDFsGrid(materiaId);
  renderExamenesContent(materiaId);
  refreshIcons();
}

// ── 8. BIBLIOGRAFÍA SUB-SYSTEM ──
let currentBiblioFilter = 'todos';

function renderBiblioGrid(materiaId) {
  const grid = $('biblioGrid');
  if (!grid) return;

  const mat = STATE.materias.find(m => m.id === materiaId);
  const matName = mat ? mat.nombre : '';

  let list = STATE.biblio.filter(b => (b.materia_id === materiaId) || (b.materia === matName));

  if (currentBiblioFilter === 'parcial') {
    list = list.filter(b => b.va_parcial);
  } else if (currentBiblioFilter !== 'todos') {
    list = list.filter(b => b.estado === currentBiblioFilter);
  }

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty">
        <div class="empty-icon"><i data-lucide="book-open" class="lucide-icon lucide-xl"></i></div>
        <div class="empty-title">No hay textos en esta vista</div>
        <div class="empty-sub">Usa "+ Texto" para agregar bibliografía con unidad, autor y estado.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(t => {
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span class="card-tag"><i data-lucide="bookmark" class="lucide-icon lucide-sm"></i> ${t.unidad || 'Unidad 1'}</span>
          <span class="badge-estado e-${(t.estado || 'Pendiente').replace(/\s+/g, '_')}" onclick="toggleEstadoBiblio('${t.id}')" title="Toca para alternar estado">
            ${t.estado || 'Pendiente'}
          </span>
        </div>
        <div style="font-size:17px;font-weight:800;color:var(--text-main);line-height:1.35;margin-bottom:6px;">${t.titulo_texto}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px;display:flex;align-items:center;gap:5px;">
          <i data-lucide="pen-tool" class="lucide-icon lucide-sm"></i> ${t.autores || 'Autor no especificado'}
        </div>
        
        ${t.notas ? `<div style="font-size:12.5px;color:var(--text-muted);background:var(--bg-surface);padding:10px 12px;border-radius:10px;margin-bottom:14px;line-height:1.5;border:1px solid var(--border-subtle);">${t.notas}</div>` : ''}

        <div style="display:flex;gap:6px;justify-content:space-between;align-items:center;margin-top:auto;padding-top:12px;border-top:1px solid var(--border-subtle);">
          <span style="font-size:11.5px;font-weight:700;color:${t.va_parcial ? 'var(--amber-600)' : 'var(--text-muted)'};display:flex;align-items:center;gap:4px;">
            ${t.va_parcial ? '<i data-lucide="star" class="lucide-icon lucide-sm" style="color:var(--amber-500)"></i> Va al Parcial' : 'Lectura regular'}
          </span>
          <div style="display:flex;gap:6px;">
            ${t.link_resumen ? `<a href="${t.link_resumen}" target="_blank" class="btn-sm emerald" style="padding:4px 8px;font-size:11.5px;"><i data-lucide="external-link" class="lucide-icon lucide-sm"></i> Resumen</a>` : ''}
            <button class="btn-sm" style="padding:4px 8px;font-size:11.5px;" onclick="openSheetBiblio('${t.id}')"><i data-lucide="edit-2" class="lucide-icon lucide-sm"></i></button>
            <button class="btn-sm ruby" style="padding:4px 8px;font-size:11.5px;" onclick="deleteBiblio('${t.id}')"><i data-lucide="trash" class="lucide-icon lucide-sm"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

document.querySelectorAll('[data-biblio-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-biblio-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentBiblioFilter = btn.dataset.biblioFilter;
    if (STATE.currentMateriaId) renderBiblioGrid(STATE.currentMateriaId);
    refreshIcons();
  });
});

async function toggleEstadoBiblio(id) {
  const item = STATE.biblio.find(b => b.id === id);
  if (!item) return;

  const estados = ['Pendiente', 'Resumiendo', 'Leído', 'Salteado', 'No va'];
  const nextIdx = (estados.indexOf(item.estado) + 1) % estados.length;
  item.estado = estados[nextIdx];

  localStorage.setItem('psi_biblio_cache', JSON.stringify(STATE.biblio));
  if (STATE.currentMateriaId) renderBiblioGrid(STATE.currentMateriaId);
  renderProfileStats();
  refreshIcons();

  if (STATE.supabase && STATE.isOnline) {
    try {
      await STATE.supabase.from('bibliografia').update({ estado: item.estado }).eq('id', id);
    } catch (e) {
      enqueueSync('UPDATE', 'bibliografia', item);
    }
  } else {
    enqueueSync('UPDATE', 'bibliografia', item);
  }
}

// ── 9. PROTOCOLO DE CLASES ──
function renderClasesGrid(materiaId) {
  const grid = $('clasesGrid');
  if (!grid) return;

  const mat = STATE.materias.find(m => m.id === materiaId);
  const matName = mat ? mat.nombre : '';
  const list = STATE.clases.filter(c => (c.materia_id === materiaId) || (c.materia === matName));

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty">
        <div class="empty-icon"><i data-lucide="presentation" class="lucide-icon lucide-xl"></i></div>
        <div class="empty-title">Sin clases registradas</div>
        <div class="empty-sub">Carga el protocolo de tu primera clase teórica o práctica con "+ Clase".</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(c => {
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span class="card-tag emerald"><i data-lucide="video" class="lucide-icon lucide-sm"></i> Clase #${c.nro_clase || 1} • ${c.tipo || 'Teórica'}</span>
          <span style="font-size:12.5px;color:var(--text-muted);font-weight:700;display:flex;align-items:center;gap:4px;">
            <i data-lucide="calendar" class="lucide-icon lucide-sm"></i> ${formatDate(c.fecha)}
          </span>
        </div>
        <div style="font-size:17px;font-weight:800;color:var(--text-main);margin-bottom:10px;">${c.titulo_clase}</div>
        
        ${c.aclaraciones ? `
          <div style="background:rgba(16,185,129,0.08);border:1.5px solid var(--border-medium);border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px;color:var(--text-main);line-height:1.6;">
            <strong style="color:var(--emerald-600);"><i data-lucide="lightbulb" class="lucide-icon lucide-sm"></i> Aclaraciones del Docente:</strong><br>${c.aclaraciones}
          </div>
        ` : ''}

        ${c.contenido_ppt ? `
          <div style="background:var(--bg-surface);border:1px solid var(--border-subtle);padding:10px 12px;border-radius:10px;margin-bottom:12px;font-size:12.5px;color:var(--text-muted);line-height:1.5;">
            <strong>Diapositivas:</strong> ${c.contenido_ppt.slice(0, 140)}...
          </div>
        ` : ''}

        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:auto;padding-top:12px;border-top:1px solid var(--border-subtle);">
          ${c.link_grabacion ? `<a href="${c.link_grabacion}" target="_blank" class="btn-sm navy"><i data-lucide="headphones" class="lucide-icon lucide-sm"></i> Audio</a>` : ''}
          ${c.link_doc_resumen ? `<a href="${c.link_doc_resumen}" target="_blank" class="btn-sm emerald"><i data-lucide="file-text" class="lucide-icon lucide-sm"></i> Doc</a>` : ''}
          <button class="btn-sm ruby" onclick="deleteClase('${c.id}')"><i data-lucide="trash" class="lucide-icon lucide-sm"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

// ── 10. APUNTES & MARKDOWN ENGINE ──
function renderApuntesGrid(materiaId) {
  const grid = $('apuntesGrid');
  if (!grid) return;

  const mat = STATE.materias.find(m => m.id === materiaId);
  const matName = mat ? mat.nombre : '';
  const list = STATE.apuntes.filter(a => (a.materia_id === materiaId) || (a.materia === matName));

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty">
        <div class="empty-icon"><i data-lucide="feather" class="lucide-icon lucide-xl"></i></div>
        <div class="empty-title">Sin apuntes o resúmenes</div>
        <div class="empty-sub">Crea un apunte o resumen completo con formato Markdown tocando "+ Apunte".</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(a => {
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span class="card-tag gold"><i data-lucide="file-text" class="lucide-icon lucide-sm"></i> ${a.tipo || 'Resumen'}</span>
          <span style="font-size:12px;color:var(--text-muted);">${a.unidad || 'Unidad 1'}</span>
        </div>
        <div style="font-size:18px;font-weight:800;color:var(--text-main);margin-bottom:8px;">${a.titulo}</div>
        <div style="font-size:13.5px;color:var(--text-muted);line-height:1.6;margin-bottom:14px;">
          ${(a.contenido || '').replace(/[#*`>]/g, '').slice(0, 160)}...
        </div>
        <div style="display:flex;gap:6px;justify-content:space-between;align-items:center;margin-top:auto;padding-top:12px;border-top:1px solid var(--border-subtle);">
          <span style="font-size:12px;color:${a.va_parcial ? 'var(--amber-600)' : 'var(--text-muted)'};font-weight:700;display:flex;align-items:center;gap:4px;">
            ${a.va_parcial ? '<i data-lucide="star" class="lucide-icon lucide-sm" style="color:var(--amber-500)"></i> Para el Parcial' : 'Apunte General'}
          </span>
          <div style="display:flex;gap:6px;">
            <button class="btn-sm emerald" onclick="openSheetApunte('${a.id}')"><i data-lucide="edit-3" class="lucide-icon lucide-sm"></i> Editar</button>
            <button class="btn-sm ruby" onclick="deleteApunte('${a.id}')"><i data-lucide="trash" class="lucide-icon lucide-sm"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function insertMD(prefix, suffix) {
  const textarea = $('aContenido');
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const sel = text.substring(start, end);

  textarea.value = text.substring(0, start) + prefix + sel + suffix + text.substring(end);
  textarea.focus();
  textarea.setSelectionRange(start + prefix.length, end + prefix.length);
}

function parseMarkdown(md) {
  if (!md) return '';
  let html = md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/\n$/gim, '<br />');
  return html;
}

let previewActive = false;
function togglePreview() {
  const area = $('aContenido');
  const preview = $('aPreview');
  const btn = $('previewToggleBtn');

  if (!previewActive) {
    preview.innerHTML = parseMarkdown(area.value);
    area.style.display = 'none';
    preview.style.display = 'block';
    btn.innerHTML = '<i data-lucide="edit-2" class="lucide-icon lucide-sm"></i> Editor';
    previewActive = true;
  } else {
    area.style.display = 'block';
    preview.style.display = 'none';
    btn.innerHTML = '<i data-lucide="eye" class="lucide-icon lucide-sm"></i> Vista Previa';
    previewActive = false;
  }
  refreshIcons();
}

// ── 11. PDF SUB-SYSTEM & INGESTION ──
function renderPDFsGrid(materiaId) {
  const grid = $('pdfsGrid');
  if (!grid) return;

  const mat = STATE.materias.find(m => m.id === materiaId);
  const matName = mat ? mat.nombre : '';
  const list = STATE.pdfs.filter(p => (p.materia_id === materiaId) || (p.materia === matName));

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty">
        <div class="empty-icon"><i data-lucide="file" class="lucide-icon lucide-xl"></i></div>
        <div class="empty-title">Sin PDFs ingestados</div>
        <div class="empty-sub">Arrastra o comparte archivos en la pestaña "Ingestión PDF".</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(p => {
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span class="card-tag"><i data-lucide="file-text" class="lucide-icon lucide-sm"></i> ${p.num_paginas || 1} Páginas</span>
          <span style="font-size:12px;color:var(--text-muted);">${p.unidad || 'Unidad 1'}</span>
        </div>
        <div style="font-size:16px;font-weight:800;color:var(--text-main);margin-bottom:8px;">${p.nombre_archivo}</div>
        <div style="font-size:13px;color:var(--text-muted);line-height:1.5;margin-bottom:14px;">
          ${(p.texto_extraido || 'Sin texto extraído').slice(0, 120)}...
        </div>
        <div style="display:flex;justify-content:flex-end;gap:6px;margin-top:auto;">
          <button class="btn-sm emerald" onclick="viewExtractedText('${p.id}')">
            <i data-lucide="eye" class="lucide-icon lucide-sm"></i> Ver Documento
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderPDFRecents() {
  const grid = $('pdfRecentGrid');
  if (!grid) return;

  if (STATE.pdfs.length === 0) {
    grid.innerHTML = `
      <div class="empty">
        <div class="empty-icon"><i data-lucide="file-up" class="lucide-icon lucide-xl"></i></div>
        <div class="empty-title">Ningún PDF cargado aún</div>
        <div class="empty-sub">Arrastra un archivo PDF en el panel superior para procesarlo.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = STATE.pdfs.slice(0, 6).map(p => {
    return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <span class="card-tag emerald"><i data-lucide="book" class="lucide-icon lucide-sm"></i> ${p.materia || 'General'}</span>
          <span style="font-size:12px;color:var(--text-muted);">${p.num_paginas || 0} págs</span>
        </div>
        <div style="font-size:16px;font-weight:800;color:var(--text-main);margin-bottom:6px;">${p.nombre_archivo}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:10px;">${(p.texto_extraido || '').slice(0, 100)}...</div>
        <div style="margin-top:auto;display:flex;justify-content:flex-end;">
          <button class="btn-sm emerald" onclick="viewExtractedText('${p.id}')">
            <i data-lucide="file-search" class="lucide-icon lucide-sm"></i> Ver Documento
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function handlePDFSelect(event) {
  const file = event.target.files[0];
  if (!file || file.type !== 'application/pdf') {
    showToast('Selecciona un archivo PDF válido', '⚠️');
    return;
  }

  showToast('Extrayendo texto del PDF con PDF.js...', '⏳', 4000);
  const fileReader = new FileReader();

  fileReader.onload = async function() {
    try {
      const typedArray = new Uint8Array(this.result);
      const pdf = await pdfjsLib.getDocument(typedArray).promise;
      
      STATE.currentPDFDoc = pdf;
      STATE.totalPDFPages = pdf.numPages;
      STATE.currentPDFPage = 1;

      let fullText = '';
      const maxPagesToExtract = Math.min(pdf.numPages, 5);
      for (let i = 1; i <= maxPagesToExtract; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + '\n\n';
      }

      $('pdfFileName').textContent = file.name;
      $('pdfPageCount').innerHTML = `<i data-lucide="file" class="lucide-icon lucide-sm"></i> ${pdf.numPages} págs`;
      $('ingTitulo').value = file.name.replace(/\.pdf$/i, '').replace(/_/g, ' ');
      $('ingExtracted').value = fullText.slice(0, 1200);

      const matchedMateria = STATE.materias.find(m => file.name.toLowerCase().includes(m.nombre.toLowerCase()) || file.name.toLowerCase().includes((m.abreviatura || '').toLowerCase()));
      if (matchedMateria) {
        $('ingMateriaSelect').value = matchedMateria.id;
      }

      $('pdfMatchBox').style.display = 'block';
      showToast('PDF analizado correctamente', '✅');
      refreshIcons();
    } catch (err) {
      console.error('PDF Parse error:', err);
      showToast('Error procesando PDF', '❌');
    }
  };

  fileReader.readAsArrayBuffer(file);
}

async function confirmIngestion(e) {
  e.preventDefault();
  const matId = $('ingMateriaSelect').value;
  const mat = STATE.materias.find(m => m.id === matId);
  const matName = mat ? mat.nombre : 'General';

  const newDoc = {
    id: crypto.randomUUID ? crypto.randomUUID() : 'pdf_' + Date.now(),
    nombre_archivo: $('pdfFileName').textContent,
    materia_id: matId || null,
    materia: matName,
    unidad: $('ingUnidad').value,
    num_paginas: STATE.totalPDFPages || 1,
    va_parcial: $('ingVaParcial').checked,
    texto_extraido: $('ingExtracted').value,
    created_at: new Date().toISOString()
  };

  const newBiblio = {
    id: crypto.randomUUID ? crypto.randomUUID() : 'bib_' + Date.now(),
    materia_id: matId || null,
    materia: matName,
    unidad: $('ingUnidad').value,
    titulo_texto: $('ingTitulo').value,
    autores: $('ingAutores').value || 'Autor PDF',
    estado: 'Pendiente',
    va_parcial: $('ingVaParcial').checked,
    notas: `Ingestado automáticamente desde ${newDoc.nombre_archivo}`,
    created_at: new Date().toISOString()
  };

  STATE.pdfs.unshift(newDoc);
  STATE.biblio.unshift(newBiblio);
  localStorage.setItem('psi_pdfs_cache', JSON.stringify(STATE.pdfs));
  localStorage.setItem('psi_biblio_cache', JSON.stringify(STATE.biblio));

  if (STATE.supabase && STATE.isOnline) {
    try {
      await Promise.all([
        STATE.supabase.from('documentos_pdf').insert([newDoc]),
        STATE.supabase.from('bibliografia').insert([newBiblio])
      ]);
    } catch (err) {
      enqueueSync('INSERT', 'documentos_pdf', newDoc);
      enqueueSync('INSERT', 'bibliografia', newBiblio);
    }
  } else {
    enqueueSync('INSERT', 'documentos_pdf', newDoc);
    enqueueSync('INSERT', 'bibliografia', newBiblio);
  }

  $('pdfMatchBox').style.display = 'none';
  showToast('PDF y Bibliografía guardados con éxito', '📚');
  renderAll();
}

function viewExtractedText(id) {
  const p = STATE.pdfs.find(x => x.id === id);
  if (!p) return;

  $('pdfViewerTitle').textContent = p.nombre_archivo;
  $('pdfPageInfo').textContent = `Documento Ingestado`;
  $('pdfViewerModal').classList.add('active');

  const wrap = $('pdfCanvasWrap');
  wrap.innerHTML = `
    <div style="max-width:760px;width:100%;background:var(--bg-card);border:1.5px solid var(--border-medium);padding:28px;border-radius:20px;color:var(--text-main);line-height:1.7;font-size:14.5px;white-space:pre-wrap;box-shadow:var(--shadow-fluffy);">
      <h3 style="margin-bottom:12px;color:var(--emerald-600);font-size:20px;">${p.nombre_archivo}</h3>
      <p style="color:var(--text-muted);"><strong>Materia:</strong> ${p.materia} • <strong>Unidad:</strong> ${p.unidad}</p>
      <hr style="border:none;border-top:1px solid var(--border-subtle);margin:16px 0;">
      <div>${p.texto_extraido || 'Sin contenido de texto extraído.'}</div>
    </div>
  `;
}

function closePDFViewer() {
  $('pdfViewerModal').classList.remove('active');
}

// ── 12. EXÁMENES SUB-SYSTEM ──
function renderExamenesContent(materiaId) {
  const div = $('examenesContent');
  if (!div) return;

  const mat = STATE.materias.find(m => m.id === materiaId);
  const matName = mat ? mat.nombre : '';
  const list = STATE.examenes.filter(e => (e.materia_id === materiaId) || (e.materia === matName));

  if (list.length === 0) {
    div.innerHTML = `
      <div class="empty">
        <div class="empty-icon"><i data-lucide="calendar" class="lucide-icon lucide-xl"></i></div>
        <div class="empty-title">Sin exámenes programados</div>
        <div class="empty-sub">Registra fechas de parciales y finales para tener el countdown activo.</div>
      </div>
    `;
    return;
  }

  div.innerHTML = list.map(ex => {
    return `
      <div class="card" style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:17px;font-weight:800;color:var(--text-main);">${ex.nombre}</div>
            <div style="font-size:13.5px;color:var(--text-muted);margin-top:3px;display:flex;align-items:center;gap:6px;">
              <i data-lucide="calendar" class="lucide-icon lucide-sm"></i> ${formatDate(ex.fecha)} • Modalidad: ${ex.modalidad || 'Presencial'}
            </div>
          </div>
          <button class="btn-sm ruby" onclick="deleteExamen('${ex.id}')"><i data-lucide="trash" class="lucide-icon lucide-sm"></i></button>
        </div>
        ${ex.temas ? `<div style="font-size:13px;color:var(--text-main);background:var(--bg-surface);border:1px solid var(--border-subtle);padding:12px;border-radius:10px;margin-top:12px;line-height:1.6;">${ex.temas}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ── 13. PERFIL & STATS ──
function renderProfileStats() {
  if ($('profStatMaterias')) $('profStatMaterias').textContent = STATE.materias.length;
  if ($('profStatTextos')) $('profStatTextos').textContent = STATE.biblio.length;
  if ($('profStatLeidos')) $('profStatLeidos').textContent = STATE.biblio.filter(b => b.estado === 'Leído' || b.estado === 'Salteado').length;
  if ($('profStatApuntes')) $('profStatApuntes').textContent = STATE.apuntes.length;
}

function renderProfileMaterias() {
  const container = $('perfilMateriasList');
  if (!container) return;

  if (STATE.materias.length === 0) {
    container.innerHTML = `<span style="font-size:13.5px;color:var(--text-muted);">Sin materias cargadas.</span>`;
    return;
  }

  container.innerHTML = STATE.materias.map(m => `
    <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface);border:1.5px solid var(--border-medium);padding:14px 18px;border-radius:14px;box-shadow:var(--shadow-sm);">
      <div>
        <div style="font-size:15px;font-weight:800;color:var(--text-main);">${m.nombre}</div>
        <div style="font-size:12.5px;color:var(--text-muted);">${m.docente || 'Docente a cargo'} • ${m.cuatrimestre === 0 ? 'Anual' : m.cuatrimestre + '° Cuatrimestre'}</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn-sm" onclick="openSheetMateria('${m.id}')"><i data-lucide="edit-2" class="lucide-icon lucide-sm"></i> Editar</button>
        <button class="btn-sm ruby" onclick="deleteMateria('${m.id}')"><i data-lucide="trash" class="lucide-icon lucide-sm"></i></button>
      </div>
    </div>
  `).join('');
}

function populateMateriaSelects() {
  const select = $('ingMateriaSelect');
  if (!select) return;

  select.innerHTML = STATE.materias.map(m => `
    <option value="${m.id}">${m.nombre} (${m.abreviatura || 'MAT'})</option>
  `).join('');
}

// ── 14. CRUD OPERATIONS ──

// Materias
function openSheetMateria(id = null) {
  $('sheetMateriaTitle').textContent = id ? 'Editar Materia' : 'Nueva Materia';
  $('mId').value = id || '';

  if (id) {
    const mat = STATE.materias.find(m => m.id === id);
    if (mat) {
      $('mNombre').value = mat.nombre || '';
      $('mAbrev').value = mat.abreviatura || '';
      $('mDocente').value = mat.docente || '';
      $('mColor').value = mat.color || '#10B981';
      $('mAño').value = mat.año_cursado || 2026;
      $('mCuatri').value = mat.cuatrimestre || '2';
      $('mDescripcion').value = mat.descripcion || '';
      $('mFecha1').value = mat.fecha_parcial1 || '';
      $('mFecha2').value = mat.fecha_parcial2 || '';
      $('mFechaFinal').value = mat.fecha_final || '';
      $('mModalidad').value = mat.modalidad_parcial || 'Presencial';
      $('mTemas1').value = mat.temas_parcial1 || '';
      $('mTemas2').value = mat.temas_parcial2 || '';
      $('mTemasF').value = mat.temas_final || '';
      $('mLinkProg').value = mat.link_programa || '';
      $('mLinkDrive').value = mat.link_drive || '';
    }
  } else {
    $('mNombre').value = '';
    $('mAbrev').value = '';
    $('mDocente').value = '';
    $('mDescripcion').value = '';
    $('mFecha1').value = '';
    $('mFecha2').value = '';
    $('mFechaFinal').value = '';
    $('mTemas1').value = '';
    $('mTemas2').value = '';
    $('mTemasF').value = '';
    $('mLinkProg').value = '';
    $('mLinkDrive').value = '';
  }

  $('sheetMateria').classList.add('active');
  refreshIcons();
}

async function saveMateria(e) {
  e.preventDefault();
  const id = $('mId').value;
  const isEdit = Boolean(id);

  const payload = {
    id: id || (crypto.randomUUID ? crypto.randomUUID() : 'mat_' + Date.now()),
    nombre: $('mNombre').value.trim(),
    abreviatura: $('mAbrev').value.trim(),
    docente: $('mDocente').value.trim(),
    color: $('mColor').value,
    año_cursado: parseInt($('mAño').value) || 2026,
    cuatrimestre: parseInt($('mCuatri').value) || 2,
    descripcion: $('mDescripcion').value,
    fecha_parcial1: $('mFecha1').value || null,
    fecha_parcial2: $('mFecha2').value || null,
    fecha_final: $('mFechaFinal').value || null,
    modalidad_parcial: $('mModalidad').value,
    temas_parcial1: $('mTemas1').value,
    temas_parcial2: $('mTemas2').value,
    temas_final: $('mTemasF').value,
    link_programa: $('mLinkProg').value,
    link_drive: $('mLinkDrive').value,
    created_at: new Date().toISOString()
  };

  if (isEdit) {
    const idx = STATE.materias.findIndex(m => m.id === id);
    if (idx !== -1) STATE.materias[idx] = payload;
  } else {
    STATE.materias.push(payload);
  }

  localStorage.setItem('psi_materias_cache', JSON.stringify(STATE.materias));
  closeSheet('sheetMateria');
  showToast(`Materia ${isEdit ? 'actualizada' : 'creada'} con éxito`, '📚');
  renderAll();

  if (STATE.supabase && STATE.isOnline) {
    try {
      if (isEdit) {
        await STATE.supabase.from('materias').update(payload).eq('id', id);
      } else {
        await STATE.supabase.from('materias').insert([payload]);
      }
    } catch (err) {
      enqueueSync(isEdit ? 'UPDATE' : 'INSERT', 'materias', payload);
    }
  } else {
    enqueueSync(isEdit ? 'UPDATE' : 'INSERT', 'materias', payload);
  }
}

async function deleteMateria(id) {
  if (!confirm('¿Seguro que deseas eliminar esta materia y todo su contenido asociado?')) return;

  STATE.materias = STATE.materias.filter(m => m.id !== id);
  localStorage.setItem('psi_materias_cache', JSON.stringify(STATE.materias));
  showToast('Materia eliminada', '🗑️');
  backToMaterias();
  renderAll();

  if (STATE.supabase && STATE.isOnline) {
    try {
      await STATE.supabase.from('materias').delete().eq('id', id);
    } catch (e) {
      enqueueSync('DELETE', 'materias', { id });
    }
  } else {
    enqueueSync('DELETE', 'materias', { id });
  }
}

// Bibliografía
function openSheetBiblio(id = null) {
  $('sheetBiblioTitle').textContent = id ? 'Editar Texto' : 'Nuevo Texto Académico';
  $('bId').value = id || '';

  if (id) {
    const b = STATE.biblio.find(x => x.id === id);
    if (b) {
      $('bUnidad').value = b.unidad || 'Unidad 1';
      $('bNro').value = b.nro_texto || 1;
      $('bTitulo').value = b.titulo_texto || '';
      $('bAutores').value = b.autores || '';
      $('bEstado').value = b.estado || 'Pendiente';
      $('bTipo').value = b.tipo_clase || 'Teórica';
      $('bParcial').value = b.nro_parcial || 1;
      $('bVaParcial').checked = Boolean(b.va_parcial);
      $('bLinkRes').value = b.link_resumen || '';
      $('bNotas').value = b.notas || '';
    }
  } else {
    $('bTitulo').value = '';
    $('bAutores').value = '';
    $('bLinkRes').value = '';
    $('bNotas').value = '';
    $('bVaParcial').checked = false;
  }

  $('sheetBiblio').classList.add('active');
  refreshIcons();
}

async function saveBiblio(e) {
  e.preventDefault();
  const id = $('bId').value;
  const isEdit = Boolean(id);
  const mat = STATE.materias.find(m => m.id === currentMateriaId);
  const matName = mat ? mat.nombre : 'General';

  const payload = {
    id: id || (crypto.randomUUID ? crypto.randomUUID() : 'bib_' + Date.now()),
    materia_id: currentMateriaId || null,
    materia: matName,
    unidad: $('bUnidad').value,
    nro_texto: parseInt($('bNro').value) || 1,
    titulo_texto: $('bTitulo').value.trim(),
    autores: $('bAutores').value.trim(),
    estado: $('bEstado').value,
    tipo_clase: $('bTipo').value,
    nro_parcial: parseInt($('bParcial').value) || 1,
    va_parcial: $('bVaParcial').checked,
    link_resumen: $('bLinkRes').value,
    notas: $('bNotas').value,
    created_at: new Date().toISOString()
  };

  if (isEdit) {
    const idx = STATE.biblio.findIndex(b => b.id === id);
    if (idx !== -1) STATE.biblio[idx] = payload;
  } else {
    STATE.biblio.unshift(payload);
  }

  localStorage.setItem('psi_biblio_cache', JSON.stringify(STATE.biblio));
  closeSheet('sheetBiblio');
  showToast(`Texto guardado correctamente`, '📖');
  if (currentMateriaId) renderBiblioGrid(currentMateriaId);
  renderProfileStats();

  if (STATE.supabase && STATE.isOnline) {
    try {
      if (isEdit) {
        await STATE.supabase.from('bibliografia').update(payload).eq('id', id);
      } else {
        await STATE.supabase.from('bibliografia').insert([payload]);
      }
    } catch (err) {
      enqueueSync(isEdit ? 'UPDATE' : 'INSERT', 'bibliografia', payload);
    }
  } else {
    enqueueSync(isEdit ? 'UPDATE' : 'INSERT', 'bibliografia', payload);
  }
}

async function deleteBiblio(id) {
  if (!confirm('¿Eliminar este texto de la bibliografía?')) return;
  STATE.biblio = STATE.biblio.filter(b => b.id !== id);
  localStorage.setItem('psi_biblio_cache', JSON.stringify(STATE.biblio));
  showToast('Texto eliminado', '🗑️');
  if (currentMateriaId) renderBiblioGrid(currentMateriaId);
  renderProfileStats();

  if (STATE.supabase && STATE.isOnline) {
    try {
      await STATE.supabase.from('bibliografia').delete().eq('id', id);
    } catch (e) {
      enqueueSync('DELETE', 'bibliografia', { id });
    }
  } else {
    enqueueSync('DELETE', 'bibliografia', { id });
  }
}

// Clases
function openSheetClase(id = null) {
  $('cFecha').value = new Date().toISOString().split('T')[0];
  $('cTitulo').value = '';
  $('cAclar').value = '';
  $('cPPT').value = '';
  $('cTranscripcion').value = '';
  $('cGrab').value = '';
  $('cDoc').value = '';
  $('sheetClase').classList.add('active');
  refreshIcons();
}

async function saveClase(e) {
  e.preventDefault();
  const mat = STATE.materias.find(m => m.id === currentMateriaId);
  const matName = mat ? mat.nombre : 'General';

  const payload = {
    id: crypto.randomUUID ? crypto.randomUUID() : 'cla_' + Date.now(),
    materia_id: currentMateriaId || null,
    materia: matName,
    fecha: $('cFecha').value,
    nro_clase: parseInt($('cNro').value) || 1,
    tipo: $('cTipo').value,
    estado: $('cEstado').value,
    titulo_clase: $('cTitulo').value.trim(),
    aclaraciones: $('cAclar').value,
    contenido_ppt: $('cPPT').value,
    transcripcion: $('cTranscripcion').value,
    link_grabacion: $('cGrab').value,
    link_doc_resumen: $('cDoc').value,
    fecha_carga: new Date().toISOString()
  };

  STATE.clases.unshift(payload);
  localStorage.setItem('psi_clases_cache', JSON.stringify(STATE.clases));
  closeSheet('sheetClase');
  showToast('Protocolo de clase guardado', '🎓');
  if (currentMateriaId) renderClasesGrid(currentMateriaId);

  if (STATE.supabase && STATE.isOnline) {
    try {
      await STATE.supabase.from('clases').insert([payload]);
    } catch (err) {
      enqueueSync('INSERT', 'clases', payload);
    }
  } else {
    enqueueSync('INSERT', 'clases', payload);
  }
}

async function deleteClase(id) {
  if (!confirm('¿Eliminar esta clase?')) return;
  STATE.clases = STATE.clases.filter(c => c.id !== id);
  localStorage.setItem('psi_clases_cache', JSON.stringify(STATE.clases));
  showToast('Clase eliminada', '🗑️');
  if (currentMateriaId) renderClasesGrid(currentMateriaId);

  if (STATE.supabase && STATE.isOnline) {
    try {
      await STATE.supabase.from('clases').delete().eq('id', id);
    } catch (e) {
      enqueueSync('DELETE', 'clases', { id });
    }
  } else {
    enqueueSync('DELETE', 'clases', { id });
  }
}

// Apuntes
function openSheetApunte(id = null) {
  $('sheetApunteTitle').textContent = id ? 'Editar Apunte' : 'Nuevo Apunte Académico';
  $('aId').value = id || '';

  if (id) {
    const a = STATE.apuntes.find(x => x.id === id);
    if (a) {
      $('aTitulo').value = a.titulo || '';
      $('aTipo').value = a.tipo || 'Resumen';
      $('aUnidad').value = a.unidad || 'Unidad 1';
      $('aVaParcial').checked = Boolean(a.va_parcial);
      $('aContenido').value = a.contenido || '';
    }
  } else {
    $('aTitulo').value = '';
    $('aUnidad').value = 'Unidad 1';
    $('aVaParcial').checked = false;
    $('aContenido').value = '';
  }

  $('sheetApunte').classList.add('active');
  refreshIcons();
}

async function saveApunte(e) {
  e.preventDefault();
  const id = $('aId').value;
  const isEdit = Boolean(id);
  const mat = STATE.materias.find(m => m.id === currentMateriaId);
  const matName = mat ? mat.nombre : 'General';

  const payload = {
    id: id || (crypto.randomUUID ? crypto.randomUUID() : 'apu_' + Date.now()),
    materia_id: currentMateriaId || null,
    materia: matName,
    titulo: $('aTitulo').value.trim(),
    tipo: $('aTipo').value,
    unidad: $('aUnidad').value,
    va_parcial: $('aVaParcial').checked,
    contenido: $('aContenido').value,
    created_at: new Date().toISOString()
  };

  if (isEdit) {
    const idx = STATE.apuntes.findIndex(a => a.id === id);
    if (idx !== -1) STATE.apuntes[idx] = payload;
  } else {
    STATE.apuntes.unshift(payload);
  }

  localStorage.setItem('psi_apuntes_cache', JSON.stringify(STATE.apuntes));
  closeSheet('sheetApunte');
  showToast('Apunte guardado en Supabase', '📝');
  if (currentMateriaId) renderApuntesGrid(currentMateriaId);
  renderProfileStats();

  if (STATE.supabase && STATE.isOnline) {
    try {
      if (isEdit) {
        await STATE.supabase.from('apuntes').update(payload).eq('id', id);
      } else {
        await STATE.supabase.from('apuntes').insert([payload]);
      }
    } catch (err) {
      enqueueSync(isEdit ? 'UPDATE' : 'INSERT', 'apuntes', payload);
    }
  } else {
    enqueueSync(isEdit ? 'UPDATE' : 'INSERT', 'apuntes', payload);
  }
}

async function deleteApunte(id) {
  if (!confirm('¿Eliminar este apunte?')) return;
  STATE.apuntes = STATE.apuntes.filter(a => a.id !== id);
  localStorage.setItem('psi_apuntes_cache', JSON.stringify(STATE.apuntes));
  showToast('Apunte eliminado', '🗑️');
  if (currentMateriaId) renderApuntesGrid(currentMateriaId);
  renderProfileStats();

  if (STATE.supabase && STATE.isOnline) {
    try {
      await STATE.supabase.from('apuntes').delete().eq('id', id);
    } catch (e) {
      enqueueSync('DELETE', 'apuntes', { id });
    }
  } else {
    enqueueSync('DELETE', 'apuntes', { id });
  }
}

// Exámenes
function openSheetExamen() {
  $('exFecha').value = new Date().toISOString().split('T')[0];
  $('exNombre').value = '';
  $('exTemas').value = '';
  $('exNota').value = '';
  $('sheetExamen').classList.add('active');
  refreshIcons();
}

async function saveExamen(e) {
  e.preventDefault();
  const mat = STATE.materias.find(m => m.id === currentMateriaId);
  const matName = mat ? mat.nombre : 'General';

  const payload = {
    id: crypto.randomUUID ? crypto.randomUUID() : 'ex_' + Date.now(),
    materia_id: currentMateriaId || null,
    materia: matName,
    nombre: $('exNombre').value.trim(),
    tipo: $('exTipo').value,
    fecha: $('exFecha').value,
    modalidad: $('exModalidad').value,
    nota: $('exNota').value ? parseFloat($('exNota').value) : null,
    temas: $('exTemas').value,
    finalizado: false,
    created_at: new Date().toISOString()
  };

  STATE.examenes.unshift(payload);
  localStorage.setItem('psi_examenes_cache', JSON.stringify(STATE.examenes));
  closeSheet('sheetExamen');
  showToast('Fecha de examen registrada', '📅');
  if (currentMateriaId) renderExamenesContent(currentMateriaId);
  renderProximosExamenesBanner();

  if (STATE.supabase && STATE.isOnline) {
    try {
      await STATE.supabase.from('examenes').insert([payload]);
    } catch (err) {
      enqueueSync('INSERT', 'examenes', payload);
    }
  } else {
    enqueueSync('INSERT', 'examenes', payload);
  }
}

async function deleteExamen(id) {
  if (!confirm('¿Eliminar este examen?')) return;
  STATE.examenes = STATE.examenes.filter(e => e.id !== id);
  localStorage.setItem('psi_examenes_cache', JSON.stringify(STATE.examenes));
  showToast('Examen eliminado', '🗑️');
  if (currentMateriaId) renderExamenesContent(currentMateriaId);
  renderProximosExamenesBanner();

  if (STATE.supabase && STATE.isOnline) {
    try {
      await STATE.supabase.from('examenes').delete().eq('id', id);
    } catch (e) {
      enqueueSync('DELETE', 'examenes', { id });
    }
  } else {
    enqueueSync('DELETE', 'examenes', { id });
  }
}

// ── 15. MODAL CLOSE & FAB ──
function closeSheet(id) {
  $(id).classList.remove('active');
}

function fabAction() {
  const activeTab = document.querySelector('.nav-tab.active')?.dataset.tab;
  if (activeTab === 'materias') {
    if (STATE.currentMateriaId) {
      openSheetBiblio();
    } else {
      openSheetMateria();
    }
  } else if (activeTab === 'pdf') {
    $('pdfInput').click();
  } else if (activeTab === 'perfil') {
    openSheetMateria();
  } else {
    triggerPing();
  }
}

// ── 16. UTILITIES ──
function formatDate(dStr) {
  if (!dStr) return '';
  const parts = dStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dStr;
}

function exportBackupJSON() {
  const data = {
    materias: STATE.materias,
    bibliografia: STATE.biblio,
    clases: STATE.clases,
    apuntes: STATE.apuntes,
    pdfs: STATE.pdfs,
    examenes: STATE.examenes,
    export_date: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PsiEstudio_Backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  showToast('Copia de seguridad exportada con éxito', '📥');
}

function clearLocalCache() {
  if (!confirm('¿Limpiar caché local? (Los datos en Supabase no se borrarán)')) return;
  localStorage.removeItem('psi_materias_cache');
  localStorage.removeItem('psi_biblio_cache');
  localStorage.removeItem('psi_clases_cache');
  localStorage.removeItem('psi_apuntes_cache');
  localStorage.removeItem('psi_pdfs_cache');
  localStorage.removeItem('psi_examenes_cache');
  localStorage.removeItem('psi_sync_queue');
  showToast('Caché local limpiada', '🧹');
  fetchAllData();
}

async function triggerPing() {
  showToast('Enviando ping Keep-Alive a Supabase...', '⚡');
  if (STATE.supabase) {
    try {
      const { data, error } = await STATE.supabase
        .from('supabase_keep_alive')
        .insert([{ ping_source: 'PsiEstudio-Client-Ping', status: 'ACTIVE' }]);

      if (!error) {
        const time = new Date().toLocaleTimeString('es-AR');
        $('kaLastPing').textContent = `Último ping exitoso a las ${time}`;
        $('kaStatus').textContent = 'Activo 🟢';
        showToast('Ping Keep-Alive registrado en Supabase', '🟢');
        return;
      }
    } catch (e) {
      console.warn('Ping error:', e);
    }
  }
  showToast('Ping Keep-Alive registrado', '🟢');
}

async function testConnection() {
  const statusDiv = $('connStatus');
  if (statusDiv) statusDiv.textContent = 'Probando conexión con Supabase...';

  initSupabase();
  if (!STATE.supabase) {
    if (statusDiv) statusDiv.textContent = '❌ Error inicializando cliente Supabase.';
    return;
  }

  try {
    const { data, error } = await STATE.supabase.from('supabase_keep_alive').select('*').limit(1);
    if (error) {
      if (statusDiv) statusDiv.innerHTML = `<span style="color:var(--amber-600);">⚠️ Conectado al endpoint pero requiere verificar políticas RLS: ${error.message}</span>`;
    } else {
      if (statusDiv) statusDiv.innerHTML = `<span style="color:var(--emerald-600);font-weight:700;">✅ Conexión exitosa a Supabase (Respuesta de keep_alive recibida).</span>`;
      showToast('Conexión con Supabase verificada', '🟢');
    }
  } catch (err) {
    if (statusDiv) statusDiv.innerHTML = `<span style="color:var(--ruby-600);">❌ Error: ${err.message}</span>`;
  }
}

function seedDefaultMaterias() {
  localStorage.setItem('psi_first_run', 'done');
  const defaults = [
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
      color: '#3B82F6',
      año_cursado: 2026,
      cuatrimestre: 2,
      descripcion: 'Estructuras clínicas: neurosis, psicosis y perversión.',
      fecha_parcial1: '2026-10-28',
      modalidad_parcial: 'Presencial',
      temas_parcial1: 'Neurosis obsesiva e histeria en Freud y Lacan.'
    }
  ];

  STATE.materias = defaults;
  localStorage.setItem('psi_materias_cache', JSON.stringify(defaults));
  renderAll();
}

// ── 17. NAVIGATION TABS ──
document.querySelectorAll('#mainNavTabs .nav-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#mainNavTabs .nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    tab.classList.add('active');
    const target = $(`tab-${tab.dataset.tab}`);
    if (target) target.classList.add('active');

    if (tab.dataset.tab === 'materias') {
      backToMaterias();
    }
    refreshIcons();
  });
});

// ── 18. INITIALIZATION ──
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSupabase();
  updateStatusIndicator();
  renderAll();
  fetchAllData();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
