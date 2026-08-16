// ── Constants ────────────────────────────────────────────────
const STAMP_W = 60;
const STAMP_H = 60;

const STAMP_IMAGES = {
  'red':         '../../assets/red-stamp.jpeg',
  'yellow':      '../../assets/yellow-stamp.jpeg',
  'green':       '../../assets/green-stamp.png',
  'yellow-baby': '../../assets/yellow-baby-stamp.png',
  'white-baby':  '../../assets/white-baby-stamp.png',
  'green-baby':  '../../assets/green-baby-stamp.png',
};

const MARKERS = new Set(['P', '1', '2', '3', 'I']);

// ── State ────────────────────────────────────────────────────
const params  = new URLSearchParams(location.search);
const chartId = params.get('id');
let chartData = null;

const ZOOM_STEP  = 0.2;
const ZOOM_MAX   = 3.0;
let zoom         = 1.0;
let baseZoom     = 1.0;
let minZoom      = 1.0; // initial fit-to-window zoom; never shrink below this
let naturalWidth  = 0;
let naturalHeight = 0;

let isCorrectionMode = false;
let isTextBoxMode    = false;

// ── Undo / Redo stack ─────────────────────────────────────────
const undoStack = [];
const redoStack = [];
const MAX_UNDO  = 50;

function snapshot() {
  return JSON.parse(JSON.stringify({
    items:     chartData.items,
    textBoxes: chartData.textBoxes,
  }));
}

function updateHistoryBtns() {
  if (undoBtnEl) undoBtnEl.disabled = undoStack.length === 0;
  if (redoBtnEl) redoBtnEl.disabled = redoStack.length === 0;
}

function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
  updateHistoryBtns();
}

function applyUndo() {
  if (!undoStack.length || !chartData) return;
  redoStack.push(snapshot());
  const prev = undoStack.pop();
  chartData.items     = prev.items;
  chartData.textBoxes = prev.textBoxes;
  renderItems();
  updateHistoryBtns();
  setDirty();
}

function applyRedo() {
  if (!redoStack.length || !chartData) return;
  undoStack.push(snapshot());
  const next = redoStack.pop();
  chartData.items     = next.items;
  chartData.textBoxes = next.textBoxes;
  renderItems();
  updateHistoryBtns();
  setDirty();
}

// ── DOM refs ─────────────────────────────────────────────────
const photoArea       = document.getElementById('photo-area');
const photoCanvas     = document.getElementById('photo-canvas');
const chartPhoto      = document.getElementById('chart-photo');
const chartNameInput  = document.getElementById('chart-name-input');
const backBtn         = document.getElementById('back-btn');
const saveBtnEl       = document.getElementById('save-btn');
const toolOptions     = document.querySelectorAll('.stamp-option');
const zoomInBtn       = document.getElementById('zoom-in-btn');
const zoomOutBtn      = document.getElementById('zoom-out-btn');
const zoomResetBtn    = document.getElementById('zoom-reset-btn');
const zoomLevelEl     = document.getElementById('zoom-level');
const correctionToggle = document.getElementById('correction-toggle');
const textBoxBtn      = document.getElementById('text-box-btn');
const uploadPhotoBtn  = document.getElementById('upload-photo-btn');
const undoBtnEl       = document.getElementById('undo-btn');
const redoBtnEl       = document.getElementById('redo-btn');

// ── Dirty state & save ────────────────────────────────────────
let isDirty = false;

function setDirty() {
  if (isDirty) return;
  isDirty = true;
  document.title = `• ${chartData ? chartData.name : 'Photo Chart'}`;
  saveBtnEl.classList.replace('btn-secondary', 'btn-primary');
}

function setClean() {
  isDirty = false;
  document.title = chartData ? chartData.name : 'Photo Chart';
  saveBtnEl.textContent = 'Saved ✓';
  saveBtnEl.classList.replace('btn-primary', 'btn-secondary');
  setTimeout(() => { if (!isDirty) saveBtnEl.textContent = 'Save'; }, 2000);
}

async function save() {
  if (!chartData) return;
  await window.api.saveChart(chartId, chartData);
  setClean();
}

saveBtnEl.addEventListener('click', save);
undoBtnEl.addEventListener('click', applyUndo);
redoBtnEl.addEventListener('click', applyRedo);

// ── Navigation ───────────────────────────────────────────────
backBtn.addEventListener('click', async () => {
  if (isDirty && !confirm('You have unsaved changes. Leave without saving?')) return;
  location.href = 'home.html';
});

// ── Zoom ─────────────────────────────────────────────────────
function computeBaseZoom() {
  if (!naturalWidth || !naturalHeight) return 1.0;
  const availableW = photoArea.clientWidth  - 32;
  const availableH = photoArea.clientHeight - 32;
  // fit-contain: scale down (or up) to show the whole image in the window
  return Math.min(availableW / naturalWidth, availableH / naturalHeight);
}

function applyZoom() {
  photoCanvas.style.zoom = zoom;
  zoomLevelEl.textContent = `${Math.round(zoom * 100)}%`;
  zoomOutBtn.disabled = zoom <= baseZoom;
  zoomInBtn.disabled  = zoom >= ZOOM_MAX;
}

function setZoom(next) {
  zoom = Math.min(ZOOM_MAX, Math.max(baseZoom, Math.round(next / ZOOM_STEP) * ZOOM_STEP));
  applyZoom();
}

function smoothZoom(delta) {
  zoom = Math.min(ZOOM_MAX, Math.max(baseZoom, zoom + delta));
  applyZoom();
}

function initZoom() {
  naturalWidth  = chartPhoto.naturalWidth  || photoCanvas.offsetWidth;
  naturalHeight = chartPhoto.naturalHeight || photoCanvas.offsetHeight;
  baseZoom = computeBaseZoom();
  minZoom  = baseZoom;
  zoom = baseZoom;
  applyZoom();
}

zoomInBtn.addEventListener('click',    () => setZoom(zoom + ZOOM_STEP));
zoomOutBtn.addEventListener('click',   () => setZoom(zoom - ZOOM_STEP));
zoomResetBtn.addEventListener('click', () => setZoom(baseZoom));

window.addEventListener('keydown', (e) => {
  if (!e.metaKey && !e.ctrlKey) return;
  if (e.key === 's')                        { e.preventDefault(); save(); }
  if (e.key === 'z' && !e.shiftKey)         { e.preventDefault(); applyUndo(); }
  if ((e.key === 'z' || e.key === 'Z') && e.shiftKey) { e.preventDefault(); applyRedo(); }
  if (e.key === '=' || e.key === '+')       { e.preventDefault(); setZoom(zoom + ZOOM_STEP); }
  if (e.key === '-')                        { e.preventDefault(); setZoom(zoom - ZOOM_STEP); }
  if (e.key === '0')                        { e.preventDefault(); setZoom(baseZoom); }
});

window.addEventListener('resize', () => {
  if (!naturalWidth || !naturalHeight) return;
  const newBase = computeBaseZoom();
  // Never let baseZoom drop below the initial fit zoom (minZoom).
  // Window shrinking just makes the image overflow (scrollable); it doesn't shrink the image.
  baseZoom = Math.max(minZoom, newBase);
  zoom = Math.max(baseZoom, zoom);
  applyZoom();
});

photoArea.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const rect    = photoArea.getBoundingClientRect();
  const mouseX  = e.clientX - rect.left;
  const mouseY  = e.clientY - rect.top;
  const contentX = (photoArea.scrollLeft + mouseX) / zoom;
  const contentY = (photoArea.scrollTop  + mouseY) / zoom;
  smoothZoom(-e.deltaY * 0.004);
  photoArea.scrollLeft = contentX * zoom - mouseX;
  photoArea.scrollTop  = contentY * zoom - mouseY;
}, { passive: false });

// ── Toolbar ──────────────────────────────────────────────────
toolOptions.forEach(btn => {
  btn.addEventListener('click', () => {
    toolOptions.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

function getActiveTool() {
  const active = document.querySelector('.stamp-option.active');
  return active ? active.dataset.tool : 'none';
}

correctionToggle.addEventListener('click', () => {
  isCorrectionMode = !isCorrectionMode;
  correctionToggle.classList.toggle('active', isCorrectionMode);
});

textBoxBtn.addEventListener('click', () => {
  isTextBoxMode = !isTextBoxMode;
  textBoxBtn.classList.toggle('active', isTextBoxMode);
  photoArea.style.cursor = isTextBoxMode ? 'crosshair' : '';
});

// ── Upload / replace photo ────────────────────────────────────
uploadPhotoBtn.addEventListener('click', async () => {
  const newPath = await window.api.selectChartImage();
  if (!newPath) return;
  pushUndo();
  chartData.imagePath = newPath;
  chartPhoto.src = 'file://' + newPath;
  setDirty();
});

// ── Stamp item rendering ──────────────────────────────────────
function renderItemContent(contentEl, item) {
  contentEl.innerHTML = '';

  if (item.stamp && STAMP_IMAGES[item.stamp]) {
    const img = document.createElement('img');
    img.src = STAMP_IMAGES[item.stamp];
    img.draggable = false;
    contentEl.appendChild(img);
  }

  if (item.marker) {
    const lbl = document.createElement('span');
    lbl.className = 'marker-label';
    lbl.textContent = item.marker;
    contentEl.appendChild(lbl);
  }

  if (item.correctionStamp && STAMP_IMAGES[item.correctionStamp]) {
    const img = document.createElement('img');
    img.src = STAMP_IMAGES[item.correctionStamp];
    img.draggable = false;
    img.className = 'correction-img';
    contentEl.appendChild(img);
  }

  if (item.correctionMarker) {
    const lbl = document.createElement('span');
    lbl.className = 'marker-label correction-marker';
    lbl.textContent = item.correctionMarker;
    contentEl.appendChild(lbl);
  }
}

function createStampItemEl(item) {
  const el = document.createElement('div');
  el.className = 'photo-stamp-item';
  el.dataset.itemId = item.id;
  el.style.left   = item.x + 'px';
  el.style.top    = item.y + 'px';
  el.style.width  = STAMP_W + 'px';
  el.style.height = STAMP_H + 'px';

  const content = document.createElement('div');
  content.className = 'photo-item-content';
  el.appendChild(content);

  renderItemContent(content, item);
  el.classList.toggle('has-correction', !!(item.correctionStamp || item.correctionMarker));

  // Drag to reposition
  let dragged = false;
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragged = false;
    const startX    = e.clientX;
    const startY    = e.clientY;
    const startLeft = item.x;
    const startTop  = item.y;

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      if (!dragged && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) dragged = true;
      if (dragged) {
        item.x = Math.max(0, startLeft + dx);
        item.y = Math.max(0, startTop  + dy);
        el.style.left = item.x + 'px';
        el.style.top  = item.y + 'px';
        setDirty();
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Click to apply tool (marker, eraser, or stamp replacement)
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dragged) { dragged = false; return; }

    const tool = getActiveTool();

    if (tool === 'none') {
      pushUndo();
      if (isCorrectionMode) {
        item.correctionStamp  = null;
        item.correctionMarker = null;
        if (!item.stamp && !item.marker) {
          chartData.items = chartData.items.filter(i => i.id !== item.id);
          el.remove();
          setDirty();
          return;
        }
      } else {
        chartData.items = chartData.items.filter(i => i.id !== item.id);
        el.remove();
        setDirty();
        return;
      }
    } else if (MARKERS.has(tool)) {
      pushUndo();
      if (isCorrectionMode) {
        item.correctionMarker = item.correctionMarker === tool ? null : tool;
      } else {
        item.marker = item.marker === tool ? null : tool;
      }
    } else {
      pushUndo();
      if (isCorrectionMode) {
        item.correctionStamp = tool;
      } else {
        item.stamp = tool;
      }
    }

    renderItemContent(content, item);
    el.classList.toggle('has-correction', !!(item.correctionStamp || item.correctionMarker));
    setDirty();
  });

  return el;
}

// ── Text box helpers (same pattern as grid editor) ────────────
function makeTbDraggable(el, handle, tb) {
  let startX, startY, startLeft, startTop;

  handle.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('text-box-delete')) return;
    e.preventDefault();
    startX    = e.clientX;
    startY    = e.clientY;
    startLeft = tb.x;
    startTop  = tb.y;

    const onMove = (ev) => {
      tb.x = Math.max(0, startLeft + (ev.clientX - startX) / zoom);
      tb.y = Math.max(0, startTop  + (ev.clientY - startY) / zoom);
      el.style.left = tb.x + 'px';
      el.style.top  = tb.y + 'px';
      setDirty();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function createTextBoxEl(tb) {
  const div = document.createElement('div');
  div.className = 'chart-text-box';
  div.dataset.tbId = tb.id;
  div.style.left   = tb.x + 'px';
  div.style.top    = tb.y + 'px';
  div.style.width  = tb.width + 'px';
  div.style.height = tb.height + 'px';

  const handle = document.createElement('div');
  handle.className = 'text-box-handle';

  const del = document.createElement('button');
  del.className = 'text-box-delete';
  del.textContent = '×';
  del.title = 'Remove text box';
  handle.appendChild(del);

  const ta = document.createElement('textarea');
  ta.className = 'text-box-textarea';
  ta.value = tb.text;
  ta.placeholder = 'Add note…';
  ta.spellcheck = false;

  div.appendChild(handle);
  div.appendChild(ta);

  del.addEventListener('click', (e) => {
    e.stopPropagation();
    pushUndo();
    chartData.textBoxes = chartData.textBoxes.filter(t => t.id !== tb.id);
    div.remove();
    setDirty();
  });

  ta.addEventListener('input', () => {
    tb.text = ta.value;
    setDirty();
  });

  div.addEventListener('click', (e) => e.stopPropagation());

  makeTbDraggable(div, handle, tb);

  const ro = new ResizeObserver(() => {
    tb.width  = Math.round(div.offsetWidth);
    tb.height = Math.round(div.offsetHeight);
    setDirty();
  });
  ro.observe(div);

  return div;
}

// ── Place new stamp on canvas click ──────────────────────────
photoCanvas.addEventListener('click', (e) => {
  if (isTextBoxMode) return; // handled separately on photoArea

  const tool = getActiveTool();
  if (tool === 'none') return; // eraser on empty canvas does nothing
  if (MARKERS.has(tool)) return; // markers go on existing stamps

  const rect = chartPhoto.getBoundingClientRect();
  const x = (e.clientX - rect.left) / zoom - STAMP_W / 2;
  const y = (e.clientY - rect.top)  / zoom - STAMP_H / 2;

  pushUndo();

  const item = {
    id: `item_${Date.now()}`,
    x: Math.max(0, x),
    y: Math.max(0, y),
    stamp: isCorrectionMode ? null : tool,
    marker: null,
    correctionStamp:  isCorrectionMode ? tool : null,
    correctionMarker: null,
  };

  chartData.items.push(item);
  photoCanvas.appendChild(createStampItemEl(item));
  setDirty();
});

// ── Place text box on canvas click (text-box mode) ────────────
photoArea.addEventListener('click', (e) => {
  if (!isTextBoxMode) return;
  if (e.target.closest('.chart-text-box') || e.target.closest('.photo-stamp-item')) return;

  const rect = photoCanvas.getBoundingClientRect();
  const x = Math.max(0, (e.clientX - rect.left) / zoom);
  const y = Math.max(0, (e.clientY - rect.top)  / zoom);

  pushUndo();
  const tb = { id: `tb_${Date.now()}`, x, y, width: 160, height: 80, text: '' };
  chartData.textBoxes.push(tb);
  const el = createTextBoxEl(tb);
  photoCanvas.appendChild(el);
  el.querySelector('.text-box-textarea').focus();

  isTextBoxMode = false;
  textBoxBtn.classList.remove('active');
  photoArea.style.cursor = '';
  setDirty();
});

// ── Render all items onto the canvas ─────────────────────────
function renderItems() {
  // Remove all existing stamp items and text boxes (keep the photo img)
  photoCanvas.querySelectorAll('.photo-stamp-item, .chart-text-box').forEach(el => el.remove());

  (chartData.items || []).forEach(item => {
    photoCanvas.appendChild(createStampItemEl(item));
  });

  (chartData.textBoxes || []).forEach(tb => {
    photoCanvas.appendChild(createTextBoxEl(tb));
  });
}

// ── Init ─────────────────────────────────────────────────────
async function init() {
  if (!chartId) { location.href = 'home.html'; return; }

  chartData = await window.api.loadChart(chartId);
  if (!chartData || chartData.type !== 'photo') { location.href = 'home.html'; return; }

  chartData.items     = chartData.items     || [];
  chartData.textBoxes = chartData.textBoxes || [];

  chartNameInput.value = chartData.name;
  document.title = chartData.name;

  chartNameInput.addEventListener('input', () => {
    chartData.name = chartNameInput.value;
    document.title = `• ${chartData.name}`;
    setDirty();
  });

  // Load the chart photo
  chartPhoto.src = 'file://' + chartData.imagePath;
  chartPhoto.addEventListener('load', () => {
    renderItems();
    initZoom();
  }, { once: true });

  chartPhoto.addEventListener('error', () => {
    // Photo file missing; show placeholder and still allow editing
    chartPhoto.alt = 'Photo not found — use Upload Photo to relink';
    renderItems();
    initZoom();
  }, { once: true });
}

init();
