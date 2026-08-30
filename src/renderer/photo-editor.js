// ── Constants ────────────────────────────────────────────────
// Size of stamps in logical photo pixels. Scales naturally with CSS zoom
// so stamps stay in the same position and proportion as the photo when zooming.
const DEFAULT_STAMP_SIZE = 100;
// Size applied to newly-placed stamps when nothing is selected. Existing
// stamps carry their own `size`; old saved items without one fall back to
// DEFAULT_STAMP_SIZE wherever they're read.
let newStampSize = DEFAULT_STAMP_SIZE;
let selectedItemId = null;

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
let isPanMode         = false;

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
  if (selectedItemId && !chartData.items.some(i => i.id === selectedItemId)) selectedItemId = null;
  renderItems();
  updateHistoryBtns();
  updateStampSizeDisplay();
  setDirty();
}

function applyRedo() {
  if (!redoStack.length || !chartData) return;
  undoStack.push(snapshot());
  const next = redoStack.pop();
  chartData.items     = next.items;
  chartData.textBoxes = next.textBoxes;
  if (selectedItemId && !chartData.items.some(i => i.id === selectedItemId)) selectedItemId = null;
  renderItems();
  updateHistoryBtns();
  updateStampSizeDisplay();
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
const panBtn          = document.getElementById('pan-toggle');
const uploadPhotoBtn  = document.getElementById('upload-photo-btn');
const undoBtnEl       = document.getElementById('undo-btn');
const redoBtnEl       = document.getElementById('redo-btn');
const stampSizeDownBtn = document.getElementById('stamp-size-down');
const stampSizeUpBtn   = document.getElementById('stamp-size-up');
const stampSizeDisplay = document.getElementById('stamp-size-display');

// ── Help modal ───────────────────────────────────────────────
const helpBtn           = document.getElementById('help-btn');
const helpModalOverlay  = document.getElementById('help-modal-overlay');
const helpModalClose    = document.getElementById('help-modal-close');

function openHelpModal()  { helpModalOverlay.classList.remove('hidden'); }
function closeHelpModal() { helpModalOverlay.classList.add('hidden'); }

helpBtn.addEventListener('click', openHelpModal);
helpModalClose.addEventListener('click', closeHelpModal);
helpModalOverlay.addEventListener('click', (e) => { if (e.target === helpModalOverlay) closeHelpModal(); });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !helpModalOverlay.classList.contains('hidden')) closeHelpModal();
});

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
  if (isDirty) {
    const response = await window.api.confirmUnsavedChanges(); // 0=Save, 1=Don't Save, 2=Cancel
    if (response === 2) return;
    if (response === 0) await save();
  }
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

function getSelectedItem() {
  return selectedItemId ? chartData.items.find(i => i.id === selectedItemId) : null;
}

// Reflects either the selected stamp's own size, or (nothing selected)
// the default size that will be used for the next new stamp.
function updateStampSizeDisplay() {
  const sel  = getSelectedItem();
  const size = sel ? (sel.size || DEFAULT_STAMP_SIZE) : newStampSize;
  // Don't stomp on what the user is mid-typing.
  if (document.activeElement !== stampSizeDisplay) stampSizeDisplay.value = size;
  stampSizeDownBtn.disabled = size <= 20;
  stampSizeUpBtn.disabled   = size >= 200;
}

function setStampSize(px) {
  const clamped = Math.min(200, Math.max(20, px));
  const sel = getSelectedItem();
  if (sel) {
    pushUndo();
    // Grow/shrink around the stamp's center instead of its top-left corner.
    const oldSize = sel.size || DEFAULT_STAMP_SIZE;
    const delta = (clamped - oldSize) / 2;
    sel.x = Math.max(0, sel.x - delta);
    sel.y = Math.max(0, sel.y - delta);
    sel.size = clamped;
    const el = photoCanvas.querySelector(`[data-item-id="${sel.id}"]`);
    if (el) {
      el.style.width  = clamped + 'px';
      el.style.height = clamped + 'px';
      el.style.left   = sel.x + 'px';
      el.style.top    = sel.y + 'px';
    }
    setDirty();
  } else {
    newStampSize = clamped;
  }
  updateStampSizeDisplay();
}

stampSizeDownBtn.addEventListener('click', () => {
  const sel = getSelectedItem();
  setStampSize((sel ? (sel.size || DEFAULT_STAMP_SIZE) : newStampSize) - 10);
});
stampSizeUpBtn.addEventListener('click', () => {
  const sel = getSelectedItem();
  setStampSize((sel ? (sel.size || DEFAULT_STAMP_SIZE) : newStampSize) + 10);
});

stampSizeDisplay.addEventListener('focus', () => stampSizeDisplay.select());

// Escape cancels the edit — set on keydown, consumed by the blur handler,
// since updateStampSizeDisplay() (which restores the true value) refuses to
// touch the input's value while it's still focused.
let cancelSizeEdit = false;

stampSizeDisplay.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter')       { e.preventDefault(); stampSizeDisplay.blur(); }
  else if (e.key === 'Escape') { e.preventDefault(); cancelSizeEdit = true; stampSizeDisplay.blur(); }
  // Route arrow-key nudging through the same step logic as the +/- buttons,
  // instead of the native number-input spinner (which would desync from it).
  else if (e.key === 'ArrowUp')   { e.preventDefault(); stampSizeUpBtn.click(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); stampSizeDownBtn.click(); }
});

// Focused number inputs respond to mouse-wheel scrolling in Chromium; disable
// that so scrolling the toolbar area can't silently resize a selected stamp.
stampSizeDisplay.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

stampSizeDisplay.addEventListener('blur', () => {
  if (cancelSizeEdit) { cancelSizeEdit = false; updateStampSizeDisplay(); return; }
  const parsed = parseInt(stampSizeDisplay.value, 10);
  if (Number.isNaN(parsed)) { updateStampSizeDisplay(); return; }
  setStampSize(parsed);
});

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

// ── Stamp selection (Pan mode only) ───────────────────────────
function selectItem(id) {
  if (selectedItemId === id) return;
  const prevEl = selectedItemId && photoCanvas.querySelector(`[data-item-id="${selectedItemId}"]`);
  if (prevEl) prevEl.classList.remove('selected');
  selectedItemId = id;
  const el = id && photoCanvas.querySelector(`[data-item-id="${id}"]`);
  if (el) el.classList.add('selected');
  updateStampSizeDisplay();
}

function deselectItem() { selectItem(null); }

// ── Toolbar ──────────────────────────────────────────────────
toolOptions.forEach(btn => {
  btn.addEventListener('click', () => {
    toolOptions.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // A stamp tool places new stamps; that's mutually exclusive with Pan mode's select/move.
    if (isPanMode) { isPanMode = false; panBtn.classList.remove('active'); deselectItem(); updateModeCursor(); }
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

function updateModeCursor() {
  photoArea.style.cursor = isPanMode ? 'grab' : (isTextBoxMode ? 'crosshair' : '');
}

// ── Pan mode ─────────────────────────────────────────────────
// Pan mode is also the only mode where existing stamps can be selected
// (bordered), dragged to a new position, or resized via the +/- control.
// While active, no stamp tool shows as selected; the tool that was active
// beforehand is remembered and restored when Pan mode ends.
let toolBeforePan = null;

function exitPanMode() {
  isPanMode = false;
  panBtn.classList.remove('active');
  deselectItem();
  (toolBeforePan || toolOptions[0]).classList.add('active');
  toolBeforePan = null;
}

textBoxBtn.addEventListener('click', () => {
  isTextBoxMode = !isTextBoxMode;
  if (isTextBoxMode) {
    if (isPanMode) exitPanMode();
    else deselectItem();
  }
  textBoxBtn.classList.toggle('active', isTextBoxMode);
  updateModeCursor();
});

panBtn.addEventListener('click', () => {
  if (isPanMode) {
    exitPanMode();
  } else {
    isPanMode = true;
    isTextBoxMode = false;
    textBoxBtn.classList.remove('active');
    toolBeforePan = document.querySelector('.stamp-option.active');
    toolOptions.forEach(b => b.classList.remove('active'));
    panBtn.classList.add('active');
  }
  updateModeCursor();
});

photoArea.addEventListener('mousedown', (e) => {
  if (!isPanMode || e.button !== 0) return;
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const startScrollLeft = photoArea.scrollLeft;
  const startScrollTop  = photoArea.scrollTop;
  photoArea.style.cursor = 'grabbing';

  const onMove = (ev) => {
    photoArea.scrollLeft = startScrollLeft - (ev.clientX - startX);
    photoArea.scrollTop  = startScrollTop  - (ev.clientY - startY);
  };
  const onUp = () => {
    photoArea.style.cursor = 'grab';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
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
  const sz = item.size || DEFAULT_STAMP_SIZE;
  el.style.width  = sz + 'px';
  el.style.height = sz + 'px';

  const content = document.createElement('div');
  content.className = 'photo-item-content';
  el.appendChild(content);

  renderItemContent(content, item);
  el.classList.toggle('has-correction', !!(item.correctionStamp || item.correctionMarker));
  el.classList.toggle('selected', item.id === selectedItemId);

  return el; // interaction is handled at the canvas level
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

  div.addEventListener('click',     (e) => e.stopPropagation());
  // Interacting with a text box (dragging its handle, clicking into it to
  // type) is its own kind of selection — clear any selected stamp so only
  // one thing is selected at a time.
  div.addEventListener('mousedown', (e) => { e.stopPropagation(); deselectItem(); });

  makeTbDraggable(div, handle, tb);

  // ResizeObserver fires once immediately on observe() with the current
  // size — skip that initial report so loading a chart with existing text
  // boxes doesn't mark it dirty before the user has touched anything.
  let isInitialResize = true;
  const ro = new ResizeObserver(() => {
    tb.width  = Math.round(div.offsetWidth);
    tb.height = Math.round(div.offsetHeight);
    if (isInitialResize) { isInitialResize = false; return; }
    setDirty();
  });
  ro.observe(div);

  return div;
}

// ── Canvas-level stamp interaction ────────────────────────────
// Hit test in logical coords. Checks stamps back-to-front (topmost first).
function stampAt(logX, logY) {
  return [...chartData.items].reverse().find(item => {
    const sz = item.size || DEFAULT_STAMP_SIZE;
    return logX >= item.x && logX <= item.x + sz &&
           logY >= item.y && logY <= item.y + sz;
  });
}

// Track active drag so the click handler can tell drag-ends from real clicks.
// Dragging an existing stamp is only possible in Pan mode — outside Pan
// mode, mousedown/click on a stamp is handled entirely by the click handler
// below (edit-in-place for marker/eraser tools, always-place-new for stamps).
let activeDrag = null; // { item, el, startX, startY, startItemX, startItemY, moved }

photoCanvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || isTextBoxMode || !isPanMode) return;

  // Use photoCanvas as origin — stamps are positioned relative to it.
  const rect = photoCanvas.getBoundingClientRect();
  const logX = (e.clientX - rect.left) / zoom;
  const logY = (e.clientY - rect.top)  / zoom;
  const hit  = stampAt(logX, logY);
  if (!hit) return; // let it bubble to photoArea's pan-scroll handler

  e.preventDefault();
  e.stopPropagation(); // don't also start a page-pan drag
  const el = photoCanvas.querySelector(`[data-item-id="${hit.id}"]`);
  activeDrag = { item: hit, el, startX: e.clientX, startY: e.clientY,
                 startItemX: hit.x, startItemY: hit.y, moved: false };

  const onMove = (ev) => {
    const dx = ev.clientX - activeDrag.startX;
    const dy = ev.clientY - activeDrag.startY;
    if (!activeDrag.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) activeDrag.moved = true;
    if (activeDrag.moved) {
      activeDrag.item.x = Math.max(0, activeDrag.startItemX + dx / zoom);
      activeDrag.item.y = Math.max(0, activeDrag.startItemY + dy / zoom);
      activeDrag.el.style.left = activeDrag.item.x + 'px';
      activeDrag.el.style.top  = activeDrag.item.y + 'px';
      setDirty();
    }
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  photoCanvas.style.cursor = 'grabbing';

  const onUpCursor = () => {
    photoCanvas.style.cursor = '';
    document.removeEventListener('mouseup', onUpCursor);
  };
  document.addEventListener('mouseup', onUpCursor);
});

// Show grab cursor when hovering a stamp in Pan mode (the only mode stamps can be picked up in)
photoCanvas.addEventListener('mousemove', (e) => {
  if (activeDrag || !isPanMode) { photoCanvas.style.cursor = ''; return; }
  const rect = photoCanvas.getBoundingClientRect();
  const logX = (e.clientX - rect.left) / zoom;
  const logY = (e.clientY - rect.top)  / zoom;
  photoCanvas.style.cursor = stampAt(logX, logY) ? 'grab' : '';
});

photoCanvas.addEventListener('mouseleave', () => {
  if (!activeDrag) photoCanvas.style.cursor = '';
});

photoCanvas.addEventListener('click', (e) => {
  if (isTextBoxMode) return;

  const rect = photoCanvas.getBoundingClientRect();
  const logX = (e.clientX - rect.left) / zoom;
  const logY = (e.clientY - rect.top)  / zoom;

  // ── Pan mode: click selects/deselects a stamp; never places or edits one ──
  if (isPanMode) {
    if (activeDrag && activeDrag.moved) { activeDrag = null; return; } // end of a drag, not a select
    activeDrag = null;
    const hit = stampAt(logX, logY);
    selectItem(hit ? hit.id : null);
    return;
  }

  const tool = getActiveTool();
  // Only the marker and eraser tools still edit whatever's under the click —
  // a color/stamp tool always places a brand-new stamp, even on top of one.
  const hit = (tool === 'none' || MARKERS.has(tool)) ? stampAt(logX, logY) : null;

  if (hit) {
    const el      = photoCanvas.querySelector(`[data-item-id="${hit.id}"]`);
    const content = el.querySelector('.photo-item-content');

    pushUndo();
    if (tool === 'none') {
      if (isCorrectionMode) {
        hit.correctionStamp  = null;
        hit.correctionMarker = null;
        if (!hit.stamp && !hit.marker) { chartData.items = chartData.items.filter(i => i.id !== hit.id); el.remove(); setDirty(); return; }
      } else {
        chartData.items = chartData.items.filter(i => i.id !== hit.id); el.remove(); setDirty(); return;
      }
    } else { // marker tool
      if (isCorrectionMode) hit.correctionMarker = hit.correctionMarker === tool ? null : tool;
      else                   hit.marker           = hit.marker           === tool ? null : tool;
    }
    renderItemContent(content, hit);
    el.classList.toggle('has-correction', !!(hit.correctionStamp || hit.correctionMarker));
    setDirty();
    return;
  }

  if (tool === 'none' || MARKERS.has(tool)) return; // nothing under an eraser/marker click on empty canvas

  // Color/stamp tool: always place a brand-new stamp here.
  const sz   = newStampSize;
  const item = {
    id: `item_${Date.now()}`,
    x: Math.max(0, logX - sz / 2),
    y: Math.max(0, logY - sz / 2),
    size: sz,
    stamp: isCorrectionMode ? null : tool, marker: null,
    correctionStamp: isCorrectionMode ? tool : null, correctionMarker: null,
  };
  pushUndo();
  chartData.items.push(item);
  photoCanvas.appendChild(createStampItemEl(item));
  setDirty();
});

// ── Delete the selected stamp (Pan mode) ───────────────────────
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Backspace' && e.key !== 'Delete') return;
  if (!isPanMode || !selectedItemId) return;
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

  e.preventDefault();
  const item = getSelectedItem();
  if (!item) return;

  pushUndo();
  chartData.items = chartData.items.filter(i => i.id !== item.id);
  const el = photoCanvas.querySelector(`[data-item-id="${item.id}"]`);
  if (el) el.remove();
  selectItem(null);
  setDirty();
});

// ── Place text box on canvas click (text-box mode) ────────────
photoArea.addEventListener('click', (e) => {
  if (!isTextBoxMode) return;
  if (e.target.closest('.chart-text-box')) return;

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
