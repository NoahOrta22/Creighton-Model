// ── Utilities ────────────────────────────────────────────────
function formatDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function newChartId() {
  return `chart_${Date.now()}`;
}

function openChart(id, type) {
  if (type === 'photo') {
    location.href = `photo-editor.html?id=${encodeURIComponent(id)}`;
  } else {
    location.href = `editor.html?id=${encodeURIComponent(id)}`;
  }
}

// ── Modal ─────────────────────────────────────────────────────
const overlay    = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalInput = document.getElementById('modal-input');
const modalConfirm = document.getElementById('modal-confirm');
const modalCancel  = document.getElementById('modal-cancel');

let _modalResolve = null;

function showModal({ title, placeholder, confirmLabel, defaultValue = '' }) {
  return new Promise((resolve) => {
    _modalResolve = resolve;
    modalTitle.textContent = title;
    modalInput.placeholder = placeholder;
    modalInput.value = defaultValue;
    modalConfirm.textContent = confirmLabel;
    overlay.classList.remove('hidden');
    modalInput.focus();
    modalInput.select();
  });
}

function closeModal(value) {
  overlay.classList.add('hidden');
  if (_modalResolve) { _modalResolve(value); _modalResolve = null; }
}

modalCancel.addEventListener('click', () => closeModal(null));
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(null); });
modalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitModal();
  if (e.key === 'Escape') closeModal(null);
});
modalConfirm.addEventListener('click', submitModal);

function submitModal() {
  const val = modalInput.value.trim();
  if (!val) { modalInput.focus(); return; }
  closeModal(val);
}

// ── New grid chart ────────────────────────────────────────────
async function createNewChart() {
  const today = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const name = await showModal({
    title: 'New Chart',
    placeholder: 'e.g. January 2026',
    confirmLabel: 'Create',
    defaultValue: today,
  });
  if (!name) return;

  const id   = newChartId();
  const data = { name, type: 'grid', rows: [], folderId: currentFolderId };
  await window.api.saveChart(id, data);
  openChart(id, 'grid');
}

// ── New photo chart ───────────────────────────────────────────
async function createNewPhotoChart() {
  const today = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const name = await showModal({
    title: 'New Photo Chart',
    placeholder: 'e.g. January 2026',
    confirmLabel: 'Next: Choose Photo',
    defaultValue: today,
  });
  if (!name) return;

  const imagePath = await window.api.selectChartImage();
  if (!imagePath) return;

  const id   = newChartId();
  const data = {
    name,
    type: 'photo',
    imagePath,
    items: [],
    textBoxes: [],
    folderId: currentFolderId,
  };
  await window.api.saveChart(id, data);
  openChart(id, 'photo');
}

// ── Folders ───────────────────────────────────────────────────
let allFolders = [];
let allCharts = [];
let currentFolderId = null; // null = root (unfiled charts + folder list)

async function createNewFolder() {
  const name = await showModal({
    title: 'New Folder',
    placeholder: 'e.g. 2026 Charts',
    confirmLabel: 'Create',
  });
  if (!name) return;
  await window.api.createFolder(name);
  init();
}

async function renameFolder(folder) {
  const name = await showModal({
    title: 'Rename Folder',
    placeholder: 'Folder name',
    confirmLabel: 'Save',
    defaultValue: folder.name,
  });
  if (!name || name === folder.name) return;
  await window.api.renameFolder(folder.id, name);
  init();
}

async function deleteFolder(folder) {
  const count = allCharts.filter(c => c.folderId === folder.id).length;
  const detail = count
    ? ` ${count} chart${count === 1 ? '' : 's'} inside will become unfiled.`
    : '';
  if (!confirm(`Delete "${folder.name}"?${detail} This cannot be undone.`)) return;
  await window.api.deleteFolder(folder.id);
  if (currentFolderId === folder.id) currentFolderId = null;
  init();
}

function openFolder(folderId) {
  currentFolderId = folderId;
  render();
}

// ── Move chart to folder ─────────────────────────────────────
const moveModalOverlay = document.getElementById('move-modal-overlay');
const folderPickerList = document.getElementById('folder-picker-list');

function closeMoveModal() {
  moveModalOverlay.classList.add('hidden');
}

document.getElementById('move-modal-cancel').addEventListener('click', closeMoveModal);
moveModalOverlay.addEventListener('click', (e) => { if (e.target === moveModalOverlay) closeMoveModal(); });

async function moveChartToFolder(chartId, folderId) {
  const data = await window.api.loadChart(chartId);
  if (!data) return;
  data.folderId = folderId;
  await window.api.saveChart(chartId, data);
  closeMoveModal();
  init();
}

function openMoveModal(chart) {
  folderPickerList.innerHTML = '';

  if (chart.folderId) {
    const btn = document.createElement('button');
    btn.className = 'folder-picker-item';
    btn.textContent = '⌫ No Folder (Unfiled)';
    btn.addEventListener('click', () => moveChartToFolder(chart.id, null));
    folderPickerList.appendChild(btn);
  }

  const otherFolders = allFolders.filter(f => f.id !== chart.folderId);
  for (const folder of otherFolders) {
    const btn = document.createElement('button');
    btn.className = 'folder-picker-item';
    btn.textContent = `📁 ${folder.name}`;
    btn.addEventListener('click', () => moveChartToFolder(chart.id, folder.id));
    folderPickerList.appendChild(btn);
  }

  if (!otherFolders.length && !chart.folderId) {
    folderPickerList.innerHTML = '<p class="folder-picker-empty">No folders yet. Create one first.</p>';
  }

  moveModalOverlay.classList.remove('hidden');
}

// ── Rename chart ──────────────────────────────────────────────
async function renameChart(id, currentName, type) {
  const name = await showModal({
    title: 'Rename Chart',
    placeholder: 'Chart name',
    confirmLabel: 'Save',
    defaultValue: currentName,
  });
  if (!name || name === currentName) return;

  const data = await window.api.loadChart(id);
  if (!data) return;
  data.name = name;
  await window.api.saveChart(id, data);
  init();
}

// ── Chart card ────────────────────────────────────────────────
const gridIcon = `
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="5" width="30" height="26" rx="3" stroke="#8a7060" stroke-width="2"/>
    <line x1="3" y1="11" x2="33" y2="11" stroke="#8a7060" stroke-width="1.5"/>
    <line x1="3" y1="17" x2="33" y2="17" stroke="#8a7060" stroke-width="1.5"/>
    <line x1="3" y1="23" x2="33" y2="23" stroke="#8a7060" stroke-width="1.5"/>
    <line x1="10" y1="5" x2="10" y2="31" stroke="#8a7060" stroke-width="1.5"/>
    <line x1="18" y1="5" x2="18" y2="31" stroke="#8a7060" stroke-width="1.5"/>
    <line x1="26" y1="5" x2="26" y2="31" stroke="#8a7060" stroke-width="1.5"/>
  </svg>`;

const photoIcon = `
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="6" width="30" height="24" rx="3" stroke="#8a7060" stroke-width="2"/>
    <circle cx="13" cy="15" r="3.5" stroke="#8a7060" stroke-width="1.5"/>
    <path d="M3 26 L11 19 L16 24 L22 17 L33 26" stroke="#8a7060" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`;

const folderIcon = `
  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 10a2 2 0 0 1 2-2h7l3 3h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10Z" stroke="#8a7060" stroke-width="2" stroke-linejoin="round"/>
  </svg>`;

function makeFolderCard(folder) {
  const card = document.createElement('div');
  card.className = 'chart-card';
  const count = allCharts.filter(c => c.folderId === folder.id).length;

  card.innerHTML = `
    <div class="chart-card-thumb folder-thumb">
      <div class="chart-card-thumb-inner">
        ${folderIcon}
        <span>${count} chart${count === 1 ? '' : 's'}</span>
      </div>
    </div>
    <div class="chart-card-body">
      <div class="chart-card-name" title="${folder.name}">${folder.name}</div>
      <div class="chart-card-date">Folder</div>
    </div>
    <div class="chart-card-actions">
      <button class="btn btn-primary open-folder-btn">Open</button>
      <button class="btn btn-ghost rename-folder-btn" title="Rename">✏️</button>
      <button class="btn btn-ghost delete-folder-btn" title="Delete">🗑</button>
    </div>`;

  card.querySelector('.chart-card-thumb').addEventListener('click', () => openFolder(folder.id));
  card.querySelector('.chart-card-body').addEventListener('click', () => openFolder(folder.id));
  card.querySelector('.open-folder-btn').addEventListener('click', () => openFolder(folder.id));
  card.querySelector('.rename-folder-btn').addEventListener('click', () => renameFolder(folder));
  card.querySelector('.delete-folder-btn').addEventListener('click', () => deleteFolder(folder));

  return card;
}

function makeCard(chart) {
  const isPhoto = chart.type === 'photo';
  const card = document.createElement('div');
  card.className = 'chart-card';

  card.innerHTML = `
    <div class="chart-card-thumb">
      <div class="chart-card-thumb-inner">
        ${isPhoto ? photoIcon : gridIcon}
        <span>${isPhoto ? 'Photo Chart' : 'No preview yet'}</span>
      </div>
    </div>
    <div class="chart-card-body">
      <div class="chart-card-name" title="${chart.name}">${chart.name}</div>
      <div class="chart-card-date">Edited ${formatDate(chart.lastEdited)}</div>
    </div>
    <div class="chart-card-actions">
      <button class="btn btn-primary open-btn" data-id="${chart.id}">Open</button>
      <button class="btn btn-ghost move-btn" data-id="${chart.id}" title="Move to folder">
        📁
      </button>
      <button class="btn btn-ghost rename-btn" data-id="${chart.id}" data-name="${chart.name}" title="Rename">
        ✏️
      </button>
      <button class="btn btn-ghost delete-btn" data-id="${chart.id}" title="Delete">
        🗑
      </button>
    </div>`;

  card.querySelector('.chart-card-thumb').addEventListener('click', () => openChart(chart.id, chart.type));
  card.querySelector('.chart-card-body').addEventListener('click', () => openChart(chart.id, chart.type));
  card.querySelector('.open-btn').addEventListener('click', () => openChart(chart.id, chart.type));

  card.querySelector('.move-btn').addEventListener('click', () => openMoveModal(chart));

  card.querySelector('.rename-btn').addEventListener('click', async () => {
    await renameChart(chart.id, chart.name, chart.type);
  });

  card.querySelector('.delete-btn').addEventListener('click', async () => {
    if (!confirm(`Delete "${chart.name}"? This cannot be undone.`)) return;
    await window.api.deleteChart(chart.id);
    init();
  });

  return card;
}

// ── Render list ───────────────────────────────────────────────
const breadcrumbEl     = document.getElementById('folder-breadcrumb');
const breadcrumbNameEl = document.getElementById('breadcrumb-folder-name');

function render() {
  const list = document.getElementById('chart-list');
  list.innerHTML = '';

  const inFolder = currentFolderId !== null;
  breadcrumbEl.classList.toggle('hidden', !inFolder);

  let folders, charts;
  if (inFolder) {
    const folder = allFolders.find(f => f.id === currentFolderId);
    // Folder was deleted from under us (e.g. another window); bail to root.
    if (!folder) { currentFolderId = null; render(); return; }
    breadcrumbNameEl.textContent = folder.name;
    folders = [];
    charts = allCharts.filter(c => c.folderId === currentFolderId);
  } else {
    folders = allFolders;
    charts = allCharts.filter(c => !c.folderId);
  }

  if (!folders.length && !charts.length) {
    list.innerHTML = inFolder
      ? `
      <div class="empty-state">
        <div class="empty-state-icon">${gridIcon}</div>
        <h2>This folder is empty</h2>
        <p>Create a chart here, or move an existing one in.</p>
        <button class="btn btn-primary" id="empty-new-btn">+ New Chart</button>
      </div>`
      : `
      <div class="empty-state">
        <div class="empty-state-icon">${gridIcon}</div>
        <h2>No charts yet</h2>
        <p>Create your first chart to start tracking your cycle.</p>
        <button class="btn btn-primary" id="empty-new-btn">+ New Chart</button>
      </div>`;
    document.getElementById('empty-new-btn').addEventListener('click', createNewChart);
    return;
  }

  for (const folder of folders) {
    list.appendChild(makeFolderCard(folder));
  }
  for (const chart of charts) {
    list.appendChild(makeCard(chart));
  }
}

// ── Init ──────────────────────────────────────────────────────
async function init() {
  const [folders, charts] = await Promise.all([window.api.listFolders(), window.api.listCharts()]);
  allFolders = folders;
  allCharts  = charts;
  render();
}

document.getElementById('new-chart-btn').addEventListener('click', createNewChart);
document.getElementById('new-photo-chart-btn').addEventListener('click', createNewPhotoChart);
document.getElementById('new-folder-btn').addEventListener('click', createNewFolder);
document.getElementById('breadcrumb-back-btn').addEventListener('click', () => { currentFolderId = null; render(); });
init();
