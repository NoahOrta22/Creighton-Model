function formatDate(ms) {
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function newChartId() {
  return `chart_${Date.now()}`;
}

function openEditor(id) {
  const url = `editor.html?id=${encodeURIComponent(id)}`;
  location.href = url;
}

async function createNewChart() {
  const id = newChartId();
  const name = `Chart ${new Date().toLocaleDateString()}`;
  const data = { name, rows: [] };
  await window.api.saveChart(id, data);
  openEditor(id);
}

function renderList(charts) {
  const list = document.getElementById('chart-list');
  list.innerHTML = '';

  if (!charts.length) {
    list.innerHTML = `
      <div class="empty-state">
        <p>No charts yet.</p>
        <button class="btn btn-primary" id="empty-new-btn">+ New Chart</button>
      </div>`;
    document.getElementById('empty-new-btn').addEventListener('click', createNewChart);
    return;
  }

  for (const chart of charts) {
    const card = document.createElement('div');
    card.className = 'chart-card';
    card.innerHTML = `
      <div class="chart-card-thumb">
        <span>No preview</span>
      </div>
      <div class="chart-card-info">
        <div class="chart-card-name" title="${chart.name}">${chart.name}</div>
        <div class="chart-card-date">Edited ${formatDate(chart.lastEdited)}</div>
      </div>
      <div class="chart-card-actions">
        <button class="btn btn-primary open-btn" data-id="${chart.id}">Open</button>
        <button class="btn btn-secondary delete-btn" data-id="${chart.id}">Delete</button>
      </div>`;
    list.appendChild(card);
  }

  list.querySelectorAll('.open-btn').forEach(btn =>
    btn.addEventListener('click', () => openEditor(btn.dataset.id)));

  list.querySelectorAll('.delete-btn').forEach(btn =>
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this chart? This cannot be undone.')) return;
      await window.api.deleteChart(btn.dataset.id);
      init();
    }));
}

async function init() {
  const charts = await window.api.listCharts();
  renderList(charts);
}

document.getElementById('new-chart-btn').addEventListener('click', createNewChart);
init();
