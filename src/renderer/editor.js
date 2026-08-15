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

// ── DOM refs ─────────────────────────────────────────────────
const chartInner      = document.getElementById('chart-inner');
const chartNameDisplay = document.getElementById('chart-name-display');
const backBtn         = document.getElementById('back-btn');
const stampOptions    = document.querySelectorAll('.stamp-option');

// ── Navigation ───────────────────────────────────────────────
backBtn.addEventListener('click', () => { location.href = 'home.html'; });

// ── Stamp toolbar selection (visual only for now) ─────────────
stampOptions.forEach(btn => {
  btn.addEventListener('click', () => {
    stampOptions.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── Build a blank cycle row data object ──────────────────────
function makeBlankRow() {
  return {
    id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    days: Array.from({ length: DAYS_PER_ROW }, () => ({
      stamp: null,
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

    if (rowData.days[d].stamp && STAMP_IMAGES[rowData.days[d].stamp]) {
      const img = document.createElement('img');
      img.src = STAMP_IMAGES[rowData.days[d].stamp];
      img.alt = rowData.days[d].stamp;
      cell.appendChild(img);
    }

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

    const input = document.createElement('input');
    input.type = 'text';
    input.value = rowData.days[d].description;
    input.placeholder = '';
    input.dataset.rowIndex = rowIndex;
    input.dataset.dayIndex = d;
    input.dataset.field = 'description';
    cell.appendChild(input);

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
