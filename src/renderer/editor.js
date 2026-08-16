// ── Constants ────────────────────────────────────────────────
const DAYS_PER_ROW = 35;

const STAMP_IMAGES = {
  'red':         '../../assets/red-stamp.jpeg',
  'yellow':      '../../assets/yellow-stamp.jpeg',
  'green':       '../../assets/green-stamp.png',
  'yellow-baby': '../../assets/yellow-baby-stamp.png',
  'white-baby':  '../../assets/white-baby-stamp.png',
  'green-baby':  '../../assets/green-baby-stamp.png',
};

// ── State ────────────────────────────────────────────────────
const params   = new URLSearchParams(location.search);
const chartId  = params.get('id');
let chartData  = null;

const MARKERS = new Set(['P', '1', '2', '3', 'I']);

const ZOOM_STEP    = 0.2;
const ZOOM_MAX     = 2.6;
let zoom           = 1.0;
let baseZoom       = 1.0;
let naturalWidth   = 0;

let isCorrectionMode = false;
let isTextBoxMode    = false;

// ── Undo / Redo stacks ───────────────────────────────────────
const undoStack = [];
const redoStack = [];
const MAX_UNDO  = 50;

function snapshot() {
  return JSON.parse(JSON.stringify({ rows: chartData.rows, textBoxes: chartData.textBoxes }));
}

function pushUndo() {
  undoStack.push(snapshot());
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0; // new action invalidates redo history
  updateHistoryBtns();
}

function applyUndo() {
  if (!undoStack.length || !chartData) return;
  redoStack.push(snapshot());
  const prev = undoStack.pop();
  chartData.rows      = prev.rows;
  chartData.textBoxes = prev.textBoxes;
  renderChart();
  applyZoom();
  updateHistoryBtns();
  setDirty();
}

function applyRedo() {
  if (!redoStack.length || !chartData) return;
  undoStack.push(snapshot());
  const next = redoStack.pop();
  chartData.rows      = next.rows;
  chartData.textBoxes = next.textBoxes;
  renderChart();
  applyZoom();
  updateHistoryBtns();
  setDirty();
}

function updateHistoryBtns() {
  if (undoBtnEl) undoBtnEl.disabled = undoStack.length === 0;
  if (redoBtnEl) redoBtnEl.disabled = redoStack.length === 0;
}

// ── DOM refs ─────────────────────────────────────────────────
const chartInner       = document.getElementById('chart-inner');
const chartNameInput   = document.getElementById('chart-name-input');
const backBtn          = document.getElementById('back-btn');
const saveBtnEl        = document.getElementById('save-btn');
const toolOptions      = document.querySelectorAll('.stamp-option');
const zoomInBtn        = document.getElementById('zoom-in-btn');
const zoomOutBtn       = document.getElementById('zoom-out-btn');
const zoomResetBtn     = document.getElementById('zoom-reset-btn');
const zoomLevelEl      = document.getElementById('zoom-level');
const correctionToggle = document.getElementById('correction-toggle');
const textBoxBtn       = document.getElementById('text-box-btn');
const undoBtnEl        = document.getElementById('undo-btn');
const redoBtnEl        = document.getElementById('redo-btn');

undoBtnEl.addEventListener('click', applyUndo);
redoBtnEl.addEventListener('click', applyRedo);

// ── Dirty state & save ────────────────────────────────────────
let isDirty = false;

function setDirty() {
  if (isDirty) return;
  isDirty = true;
  document.title = `• ${chartData ? chartData.name : 'Chart'}`;
  saveBtnEl.classList.replace('btn-secondary', 'btn-primary');
}

function setClean() {
  isDirty = false;
  document.title = chartData ? chartData.name : 'Chart';
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

// ── Navigation ───────────────────────────────────────────────
backBtn.addEventListener('click', async () => {
  if (isDirty) {
    if (!confirm('You have unsaved changes. Leave without saving?')) return;
  }
  location.href = 'home.html';
});

// ── Zoom ─────────────────────────────────────────────────────
const chartArea = document.getElementById('chart-area');

function computeBaseZoom() {
  if (!naturalWidth) return 1.0;
  const available = chartArea.clientWidth - 32;
  return Math.max(1.0, available / naturalWidth);
}

function applyZoom() {
  chartInner.style.zoom = zoom;
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
  naturalWidth = chartInner.offsetWidth;
  baseZoom = computeBaseZoom();
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
  if (!naturalWidth) return;
  const newBase = computeBaseZoom();
  const wasAtBase = zoom <= baseZoom + 0.001;
  baseZoom = newBase;
  zoom = wasAtBase ? newBase : Math.max(newBase, zoom);
  applyZoom();
});

chartArea.addEventListener('wheel', (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();

  const rect    = chartArea.getBoundingClientRect();
  const mouseX  = e.clientX - rect.left;
  const mouseY  = e.clientY - rect.top;
  const contentX = (chartArea.scrollLeft + mouseX) / zoom;
  const contentY = (chartArea.scrollTop  + mouseY) / zoom;

  smoothZoom(-e.deltaY * 0.004);

  chartArea.scrollLeft = contentX * zoom - mouseX;
  chartArea.scrollTop  = contentY * zoom - mouseY;
}, { passive: false });

// ── Correction mode toggle ────────────────────────────────────
correctionToggle.addEventListener('click', () => {
  isCorrectionMode = !isCorrectionMode;
  correctionToggle.classList.toggle('active', isCorrectionMode);
});

// ── Text Box mode toggle & placement ─────────────────────────
textBoxBtn.addEventListener('click', () => {
  isTextBoxMode = !isTextBoxMode;
  textBoxBtn.classList.toggle('active', isTextBoxMode);
  chartArea.style.cursor = isTextBoxMode ? 'crosshair' : '';
});

chartArea.addEventListener('click', (e) => {
  if (!isTextBoxMode) return;
  if (e.target.closest('.chart-text-box')) return;

  const rect = chartInner.getBoundingClientRect();
  const x = Math.max(0, (e.clientX - rect.left) / zoom);
  const y = Math.max(0, (e.clientY - rect.top)  / zoom);

  pushUndo();
  const tb = { id: `tb_${Date.now()}`, x, y, width: 160, height: 80, text: '' };
  chartData.textBoxes.push(tb);
  const el = createTextBoxEl(tb);
  chartInner.appendChild(el);
  el.querySelector('.text-box-textarea').focus();

  isTextBoxMode = false;
  textBoxBtn.classList.remove('active');
  chartArea.style.cursor = '';
  setDirty();
});

// ── Toolbar tool selection ────────────────────────────────────
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

// ── Cell render ───────────────────────────────────────────────
function updateStampCell(cell, day) {
  cell.innerHTML = '';

  if (day.stamp && STAMP_IMAGES[day.stamp]) {
    const img = document.createElement('img');
    img.src = STAMP_IMAGES[day.stamp];
    img.alt = day.stamp;
    img.draggable = false;
    cell.appendChild(img);
  }

  if (day.marker) {
    const lbl = document.createElement('span');
    lbl.className = 'marker-label';
    lbl.textContent = day.marker;
    cell.appendChild(lbl);
  }

  if (day.correctionStamp && STAMP_IMAGES[day.correctionStamp]) {
    const img = document.createElement('img');
    img.src = STAMP_IMAGES[day.correctionStamp];
    img.alt = day.correctionStamp;
    img.draggable = false;
    img.className = 'correction-img';
    cell.appendChild(img);
  }

  if (day.correctionMarker) {
    const lbl = document.createElement('span');
    lbl.className = 'marker-label correction-marker';
    lbl.textContent = day.correctionMarker;
    cell.appendChild(lbl);
  }

  cell.classList.toggle('has-correction', !!(day.correctionStamp || day.correctionMarker));
}

// ── Text field wiring (event delegation) ─────────────────────
let lastFocusedField = null;

chartInner.addEventListener('focusin', (e) => {
  const el = e.target.closest('[data-field]');
  if (el && el !== lastFocusedField) {
    pushUndo();
    lastFocusedField = el;
  }
}, true);

chartInner.addEventListener('focusout', (e) => {
  if (e.target.closest('[data-field]')) lastFocusedField = null;
}, true);

chartInner.addEventListener('input', (e) => {
  const el = e.target.closest('[data-field]');
  if (!el || !chartData) return;

  const rowIndex = parseInt(el.dataset.rowIndex, 10);
  const dayIndex = parseInt(el.dataset.dayIndex, 10);
  const field    = el.dataset.field;
  const day      = chartData.rows[rowIndex].days[dayIndex];

  day[field] = el.value;

  if (isCorrectionMode) {
    if (field === 'date')        { day.dateIsCorrection = true;  el.classList.add('correction-text'); }
    if (field === 'description') { day.descIsCorrection = true;  el.classList.add('correction-text'); }
  } else {
    if (field === 'date')        { day.dateIsCorrection = false; el.classList.remove('correction-text'); }
    if (field === 'description') { day.descIsCorrection = false; el.classList.remove('correction-text'); }
  }

  setDirty();
});

chartInner.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const el = e.target.closest('[data-field]');
  if (!el) return;

  e.preventDefault();
  const rowIndex = parseInt(el.dataset.rowIndex, 10);
  const dayIndex = parseInt(el.dataset.dayIndex, 10);
  const field    = el.dataset.field;

  const nextDay = e.shiftKey ? dayIndex - 1 : dayIndex + 1;
  if (nextDay < 0 || nextDay >= DAYS_PER_ROW) return;

  const selector = `[data-row-index="${rowIndex}"][data-day-index="${nextDay}"][data-field="${field}"]`;
  const next = chartInner.querySelector(selector);
  if (next) next.focus();
});

// ── Click handler (event delegation) ─────────────────────────
chartInner.addEventListener('click', (e) => {
  if (isTextBoxMode) return;
  const cell = e.target.closest('.stamp-cell');
  if (!cell) return;

  const rowIndex = parseInt(cell.dataset.rowIndex, 10);
  const dayIndex = parseInt(cell.dataset.dayIndex, 10);
  const tool     = getActiveTool();
  const day      = chartData.rows[rowIndex].days[dayIndex];

  pushUndo();

  if (isCorrectionMode) {
    if (tool === 'none') {
      day.correctionStamp  = null;
      day.correctionMarker = null;
    } else if (MARKERS.has(tool)) {
      day.correctionMarker = day.correctionMarker === tool ? null : tool;
    } else {
      day.correctionStamp = tool;
    }
  } else {
    if (tool === 'none') {
      day.stamp  = null;
      day.marker = null;
    } else if (MARKERS.has(tool)) {
      day.marker = day.marker === tool ? null : tool;
    } else {
      day.stamp = tool;
    }
  }

  updateStampCell(cell, day);
  setDirty();
});

// ── Build a blank cycle row data object ──────────────────────
function makeBlankRow() {
  return {
    id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    days: Array.from({ length: DAYS_PER_ROW }, () => ({
      stamp: null,
      marker: null,
      date: '',
      description: '',
      correctionStamp: null,
      correctionMarker: null,
      dateIsCorrection: false,
      descIsCorrection: false,
    })),
  };
}

// ── Text box helpers ──────────────────────────────────────────
function makeDraggable(el, handle, tb) {
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

  makeDraggable(div, handle, tb);

  const ro = new ResizeObserver(() => {
    tb.width  = Math.round(div.offsetWidth);
    tb.height = Math.round(div.offsetHeight);
    setDirty();
  });
  ro.observe(div);

  return div;
}

function renderTextBoxes() {
  (chartData.textBoxes || []).forEach(tb => {
    chartInner.appendChild(createTextBoxEl(tb));
  });
}

// ── Render the day-number header row ─────────────────────────
function renderHeader() {
  const row = document.createElement('div');
  row.className = 'chart-header-row';

  const corner = document.createElement('div');
  corner.className = 'header-corner';
  row.appendChild(corner);

  for (let d = 1; d <= DAYS_PER_ROW; d++) {
    const cell = document.createElement('div');
    cell.className = 'day-num-cell';
    cell.textContent = d;
    row.appendChild(cell);
  }

  return row;
}

// ── Render one cycle row (3 sub-rows) ────────────────────────
function renderCycleRow(rowData, rowIndex) {
  const wrapper = document.createElement('div');
  wrapper.className = 'cycle-row';
  wrapper.dataset.rowIndex = rowIndex;

  // — Stamp sub-row —
  const stampRow = document.createElement('div');
  stampRow.className = 'stamp-sub-row';

  const stampLabel = document.createElement('div');
  stampLabel.className = 'row-label-cell stamp-row-label';
  stampLabel.textContent = 'Stamp';

  const delRowBtn = document.createElement('button');
  delRowBtn.className = 'cycle-row-delete';
  delRowBtn.textContent = '✕ Del';
  delRowBtn.title = 'Delete this cycle row';
  delRowBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!confirm('Delete this cycle row?')) return;
    pushUndo();
    chartData.rows.splice(rowIndex, 1);
    renderChart();
    applyZoom();
    setDirty();
  });
  stampLabel.appendChild(delRowBtn);
  stampRow.appendChild(stampLabel);

  for (let d = 0; d < DAYS_PER_ROW; d++) {
    const cell = document.createElement('div');
    cell.className = 'stamp-cell';
    cell.dataset.rowIndex = rowIndex;
    cell.dataset.dayIndex = d;

    updateStampCell(cell, rowData.days[d]);
    stampRow.appendChild(cell);
  }

  // — Date sub-row —
  const dateRow = document.createElement('div');
  dateRow.className = 'date-sub-row';

  const dateLabel = document.createElement('div');
  dateLabel.className = 'row-label-cell';
  dateLabel.textContent = 'Date';
  dateRow.appendChild(dateLabel);

  for (let d = 0; d < DAYS_PER_ROW; d++) {
    const cell = document.createElement('div');
    cell.className = 'date-cell';

    const input = document.createElement('input');
    input.type = 'text';
    input.value = rowData.days[d].date;
    input.placeholder = '';
    input.dataset.rowIndex = rowIndex;
    input.dataset.dayIndex = d;
    input.dataset.field = 'date';
    if (rowData.days[d].dateIsCorrection) input.classList.add('correction-text');
    cell.appendChild(input);

    dateRow.appendChild(cell);
  }

  // — Description sub-row —
  const descRow = document.createElement('div');
  descRow.className = 'desc-sub-row';

  const descLabel = document.createElement('div');
  descLabel.className = 'row-label-cell';
  descLabel.textContent = 'Desc';
  descRow.appendChild(descLabel);

  for (let d = 0; d < DAYS_PER_ROW; d++) {
    const cell = document.createElement('div');
    cell.className = 'desc-cell';

    const ta = document.createElement('textarea');
    ta.value = rowData.days[d].description;
    ta.dataset.rowIndex = rowIndex;
    ta.dataset.dayIndex = d;
    ta.dataset.field = 'description';
    ta.spellcheck = false;
    if (rowData.days[d].descIsCorrection) ta.classList.add('correction-text');
    cell.appendChild(ta);

    descRow.appendChild(cell);
  }

  wrapper.appendChild(stampRow);
  wrapper.appendChild(dateRow);
  wrapper.appendChild(descRow);
  return wrapper;
}

// ── Render the full chart ─────────────────────────────────────
function renderChart() {
  chartInner.innerHTML = '';
  chartInner.appendChild(renderHeader());

  for (let i = 0; i < chartData.rows.length; i++) {
    chartInner.appendChild(renderCycleRow(chartData.rows[i], i));
  }

  renderTextBoxes();
}

// ── Load and initialise ───────────────────────────────────────
async function init() {
  if (!chartId) { location.href = 'home.html'; return; }

  chartData = await window.api.loadChart(chartId);
  if (!chartData) { location.href = 'home.html'; return; }

  chartData.textBoxes = chartData.textBoxes || [];

  chartNameInput.value = chartData.name;
  document.title = chartData.name;

  chartNameInput.addEventListener('input', () => {
    chartData.name = chartNameInput.value;
    document.title = `• ${chartData.name}`;
    setDirty();
  });

  if (!chartData.rows || chartData.rows.length === 0) {
    chartData.rows = [makeBlankRow()];
    await window.api.saveChart(chartId, chartData);
  }

  renderChart();
  initZoom();
}

// ── Add Cycle Row ─────────────────────────────────────────────
document.getElementById('add-row-btn').addEventListener('click', () => {
  pushUndo();
  const newRow = makeBlankRow();
  chartData.rows.push(newRow);

  const rowIndex = chartData.rows.length - 1;
  const rowEl    = renderCycleRow(newRow, rowIndex);

  const firstTb = chartInner.querySelector('.chart-text-box');
  if (firstTb) {
    chartInner.insertBefore(rowEl, firstTb);
  } else {
    chartInner.appendChild(rowEl);
  }

  rowEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setDirty();
});

init();
