// ── Constants ────────────────────────────────────────────────
const DAYS_PER_ROW = 35;

const STAMP_IMAGES = {
  'red':         '../../assets/red-stamp.jpeg',
  'yellow':      '../../assets/yellow-stamp.jpeg',
  'green':       '../../assets/green-stamp.png',
  'yellow-baby': '../../assets/yellow-baby-stamp.jpg',
  'white-baby':  '../../assets/white-baby-stamp.jpeg',
};

// ── State ────────────────────────────────────────────────────
const params   = new URLSearchParams(location.search);
const chartId  = params.get('id');
let chartData  = null;

const MARKERS = new Set(['P', '1', '2', '3']);

// ── DOM refs ─────────────────────────────────────────────────
const chartInner       = document.getElementById('chart-inner');
const chartNameDisplay = document.getElementById('chart-name-display');
const backBtn          = document.getElementById('back-btn');
const toolOptions      = document.querySelectorAll('.stamp-option');

// ── Navigation ───────────────────────────────────────────────
backBtn.addEventListener('click', () => { location.href = 'home.html'; });

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
function updateStampCell(cell, stamp, marker) {
  cell.innerHTML = '';

  if (stamp && STAMP_IMAGES[stamp]) {
    const img = document.createElement('img');
    img.src = STAMP_IMAGES[stamp];
    img.alt = stamp;
    img.draggable = false;
    cell.appendChild(img);
  }

  if (marker) {
    const lbl = document.createElement('span');
    lbl.className = 'marker-label';
    lbl.textContent = marker;
    cell.appendChild(lbl);
  }
}

// ── Text field wiring (event delegation) ─────────────────────
chartInner.addEventListener('input', (e) => {
  const el = e.target.closest('[data-field]');
  if (!el || !chartData) return;
  const rowIndex = parseInt(el.dataset.rowIndex, 10);
  const dayIndex = parseInt(el.dataset.dayIndex, 10);
  chartData.rows[rowIndex].days[dayIndex][el.dataset.field] = el.value;
});

// Tab / Shift-Tab moves between cells in the same sub-row
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
  const cell = e.target.closest('.stamp-cell');
  if (!cell) return;

  const rowIndex = parseInt(cell.dataset.rowIndex, 10);
  const dayIndex = parseInt(cell.dataset.dayIndex, 10);
  const tool     = getActiveTool();
  const day      = chartData.rows[rowIndex].days[dayIndex];

  if (tool === 'none') {
    // Eraser: clear stamp and marker
    day.stamp  = null;
    day.marker = null;
  } else if (MARKERS.has(tool)) {
    // Marker tool: toggle — clicking same marker twice removes it
    day.marker = day.marker === tool ? null : tool;
  } else {
    // Stamp tool: replace stamp, leave marker alone
    day.stamp = tool;
  }

  updateStampCell(cell, day.stamp, day.marker);
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
    })),
  };
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
  stampLabel.className = 'row-label-cell';
  stampLabel.textContent = 'Stamp';
  stampRow.appendChild(stampLabel);

  for (let d = 0; d < DAYS_PER_ROW; d++) {
    const cell = document.createElement('div');
    cell.className = 'stamp-cell';
    cell.dataset.rowIndex = rowIndex;
    cell.dataset.dayIndex = d;

    updateStampCell(cell, rowData.days[d].stamp, rowData.days[d].marker ?? null);
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
}

// ── Load and initialise ───────────────────────────────────────
async function init() {
  if (!chartId) { location.href = 'home.html'; return; }

  chartData = await window.api.loadChart(chartId);
  if (!chartData) { location.href = 'home.html'; return; }

  chartNameDisplay.textContent = chartData.name;
  document.title = chartData.name;

  // New charts start with one blank row
  if (!chartData.rows || chartData.rows.length === 0) {
    chartData.rows = [makeBlankRow()];
  }

  renderChart();
}

init();
