// Maida Vale — Brief QA & Continuity Desk
// Vanilla JS SPA (hash router). Keeps the bundle tiny and avoids a build step
// for the frontend, per the lightweight Cloudflare Pages architecture.

const state = {
  route: 'weeks',
  params: {},
  briefs: [],
  entities: [],
}

const SECTORS = [
  'Global', 'Asia Pacific', 'Malaysia Macro', 'Ports/Infrastructure/Logistics',
  'Automotive/Services', 'Agriculture/Food Security', 'Energy/Power/Sustainability',
  'Digital Economy/Technology/Data Centres', 'Property', 'Aviation',
  'Banking/Financial Services', 'Watchlist', 'Speed Read', 'Other',
]

const IMPACT_GRADES = ['Positive', 'Negative', 'Neutral', 'Mixed', 'Strategic Benchmark', 'Opportunity Watch', 'Policy Watch', 'High Strategic Relevance']

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  const [route, ...rest] = hash.split('/')
  return { route: route || 'weeks', params: rest }
}

window.addEventListener('hashchange', render)
window.addEventListener('DOMContentLoaded', () => {
  if (!window.location.hash) {
    // Setting the hash fires 'hashchange' asynchronously, which calls render().
    // Do NOT also call render() here directly — that races two renders against
    // two different #content DOM nodes and leaves event listeners bound to a
    // detached node (getElementById then returns null for its own button).
    window.location.hash = '#/weeks'
  } else {
    render()
  }
})

async function render() {
  const { route, params } = parseHash()
  state.route = route
  state.params = params
  const app = document.getElementById('app')
  app.innerHTML = layoutShell(route)
  const content = document.getElementById('content')

  try {
    if (route === 'weeks') {
      await renderWeeksArchive(content)
    } else if (route === 'brief') {
      await renderBriefDetail(content, params[0])
    } else if (route === 'daily-log') {
      await renderDailyLog(content)
    } else if (route === 'entities') {
      await renderEntities(content)
    } else {
      content.innerHTML = `<div class="p-8 text-slate-500">Not found.</div>`
    }
  } catch (err) {
    console.error(err)
    content.innerHTML = errorBanner(err)
  }
}

function layoutShell(activeRoute) {
  const navItem = (route, icon, label) => `
    <a href="#/${route}" class="tab-btn ${activeRoute === route ? 'active' : ''}">
      <i class="fas ${icon} mr-1.5"></i>${label}
    </a>`
  return `
    <header class="bg-teal-800 text-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 class="text-lg font-bold tracking-wide"><i class="fas fa-file-shield mr-2"></i>Maida Vale — Brief QA &amp; Continuity Desk</h1>
          <p class="text-teal-100 text-xs mt-0.5">Compliance • Redundancy • Daily Log • Source Cross-Check — companion to the Weekly Brief</p>
        </div>
        <a href="https://maida-vale-weekly-brief.pages.dev" target="_blank" class="btn btn-secondary text-teal-900">
          <i class="fas fa-arrow-up-right-from-square"></i> Live Brief Site
        </a>
      </div>
      <nav class="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 border-t border-teal-700/50">
        ${navItem('weeks', 'fa-calendar-week', 'Weekly Briefs (Archive)')}
        ${navItem('daily-log', 'fa-list-check', 'Daily News Log')}
        ${navItem('entities', 'fa-sitemap', 'Al Bukhary Entity Map')}
      </nav>
    </header>
    <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6" id="content"></main>
    <div id="modal-root"></div>
    <div id="toast-root" class="fixed bottom-4 right-4 z-50 flex flex-col gap-2"></div>
  `
}

function errorBanner(err) {
  const msg = err?.response?.data?.error || err?.message || String(err)
  return `<div class="card p-4 border-red-300 bg-red-50 text-red-800"><i class="fas fa-triangle-exclamation mr-2"></i>${escapeHtml(msg)}</div>`
}

function toast(message, type = 'ok') {
  const root = document.getElementById('toast-root')
  const el = document.createElement('div')
  const colors = { ok: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-slate-700' }
  el.className = `${colors[type] || colors.ok} text-white text-sm px-4 py-2 rounded-lg shadow-lg`
  el.textContent = message
  root.appendChild(el)
  setTimeout(() => el.remove(), 3500)
}

function escapeHtml(s) {
  if (s === null || s === undefined) return ''
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function openModal(html) {
  const root = document.getElementById('modal-root')
  root.innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><div class="modal-panel">${html}</div></div>`
  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal()
  })
}
function closeModal() {
  document.getElementById('modal-root').innerHTML = ''
}

// ===========================================================================
// VIEW 1: Weeks Archive
// ===========================================================================
async function renderWeeksArchive(content) {
  content.innerHTML = `<div class="flex items-center justify-center py-16"><div class="spinner"></div></div>`
  const briefs = await API.listBriefs()
  state.briefs = briefs

  // Group by period so draft1/draft2/final of the same week sit together
  const groups = {}
  for (const b of briefs) {
    const key = `${b.period_start}__${b.period_end}__${b.week_label}`
    if (!groups[key]) groups[key] = []
    groups[key].push(b)
  }
  const groupKeys = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1))

  content.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <div>
        <h2 class="text-xl font-bold text-teal-900">Weekly Briefs Archive</h2>
        <p class="text-sm text-slate-500 mt-1">Click any week to view, run compliance/redundancy checks, and edit rows. Upload Thursday's Draft 1, then Friday's Draft 2 under the same week.</p>
      </div>
      <button class="btn btn-primary" id="btn-new-brief"><i class="fas fa-upload"></i> Upload / New Brief</button>
    </div>
    ${briefs.length === 0 ? emptyState('No briefs yet', 'Upload your first Word or PDF brief, or create one manually, to get started.') : ''}
    <div class="space-y-4">
      ${groupKeys.map((key) => {
        const group = groups[key].sort(stageOrder)
        const first = group[0]
        return `
        <div class="card p-4">
          <div class="flex items-center justify-between mb-3">
            <div>
              <span class="font-bold text-teal-900">${escapeHtml(first.week_label)}</span>
              <span class="text-slate-500 text-sm ml-2">${escapeHtml(first.period_start)} → ${escapeHtml(first.period_end)}</span>
            </div>
          </div>
          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            ${group.map(briefCard).join('')}
          </div>
        </div>`
      }).join('')}
    </div>
  `

  document.getElementById('btn-new-brief').addEventListener('click', showUploadModal)
  content.querySelectorAll('[data-open-brief]').forEach((el) => {
    el.addEventListener('click', () => { window.location.hash = `#/brief/${el.dataset.openBrief}` })
  })
  content.querySelectorAll('[data-delete-brief]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation()
      if (!confirm('Delete this brief and all its rows/checks? This cannot be undone.')) return
      await API.deleteBrief(el.dataset.deleteBrief)
      toast('Brief deleted')
      renderWeeksArchive(content)
    })
  })
}

function stageOrder(a, b) {
  const order = { draft1: 0, draft2: 1, final: 2 }
  return (order[a.draft_stage] ?? 9) - (order[b.draft_stage] ?? 9)
}

function stageBadge(stage) {
  const labels = { draft1: 'Draft 1 (Thu)', draft2: 'Draft 2 (Fri)', final: 'Final' }
  const colors = { draft1: 'badge-info', draft2: 'badge-warning', final: 'badge-ok' }
  return `<span class="badge ${colors[stage] || 'badge-neutral'}">${labels[stage] || stage}</span>`
}

function briefCard(b) {
  const hasIssues = b.error_count > 0
  const hasWarnings = b.warning_count > 0
  const hasDupes = b.duplicate_count > 0
  return `
    <div class="border border-slate-200 rounded-lg p-3 hover:border-teal-700 cursor-pointer transition-colors" data-open-brief="${b.id}">
      <div class="flex items-center justify-between mb-1.5">
        ${stageBadge(b.draft_stage)}
        <button class="text-slate-400 hover:text-red-600" data-delete-brief="${b.id}" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
      <div class="font-semibold text-sm text-slate-800 truncate">${escapeHtml(b.title || b.week_label)}</div>
      <div class="text-xs text-slate-500 mt-0.5">${b.row_count} rows${b.source_filename ? ' · ' + escapeHtml(b.source_filename) : ' · manual entry'}</div>
      <div class="flex gap-1.5 mt-2 flex-wrap">
        ${hasIssues ? `<span class="badge badge-error"><i class="fas fa-circle-exclamation"></i> ${b.error_count} errors</span>` : ''}
        ${hasWarnings ? `<span class="badge badge-warning"><i class="fas fa-triangle-exclamation"></i> ${b.warning_count} warnings</span>` : ''}
        ${hasDupes ? `<span class="badge badge-error"><i class="fas fa-clone"></i> ${b.duplicate_count} likely dupes</span>` : ''}
        ${!hasIssues && !hasWarnings && !hasDupes && b.status === 'checked' ? `<span class="badge badge-ok"><i class="fas fa-check"></i> Clean</span>` : ''}
        ${b.status === 'uploaded' ? `<span class="badge badge-neutral"><i class="fas fa-clock"></i> Not checked yet</span>` : ''}
      </div>
    </div>
  `
}

function emptyState(title, sub) {
  return `<div class="card p-10 text-center text-slate-500 mb-4">
    <i class="fas fa-inbox text-3xl mb-3 text-slate-300"></i>
    <div class="font-semibold text-slate-600">${escapeHtml(title)}</div>
    <div class="text-sm mt-1">${escapeHtml(sub)}</div>
  </div>`
}

// --- Upload / New brief modal ----------------------------------------------
function showUploadModal() {
  const today = dayjs()
  const monday = today.day() === 0 ? today.subtract(6, 'day') : today.subtract(today.day() - 1, 'day')
  const friday = monday.add(4, 'day')
  const defaultWeekLabel = `Week ${monday.week ? monday.week() : ''}`.trim() || `Week of ${monday.format('D MMM')}`

  openModal(`
    <div class="p-5 border-b flex items-center justify-between">
      <h3 class="font-bold text-teal-900"><i class="fas fa-upload mr-2"></i>Upload / New Brief</h3>
      <button class="text-slate-400 hover:text-slate-700" onclick="closeModal()"><i class="fas fa-xmark text-lg"></i></button>
    </div>
    <div class="p-5 space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-semibold text-slate-600">Week label</label>
          <input type="text" id="nf-week-label" value="${escapeHtml(defaultWeekLabel)}" placeholder="e.g. Week 39">
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600">Draft stage</label>
          <select id="nf-stage">
            <option value="draft1">Draft 1 (Thursday)</option>
            <option value="draft2">Draft 2 (Friday, incl. Friday developments)</option>
            <option value="final">Final</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600">Period start</label>
          <input type="date" id="nf-start" value="${monday.format('YYYY-MM-DD')}">
        </div>
        <div>
          <label class="text-xs font-semibold text-slate-600">Period end</label>
          <input type="date" id="nf-end" value="${friday.format('YYYY-MM-DD')}">
        </div>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-600">Title (optional)</label>
        <input type="text" id="nf-title" placeholder="Weekly Brief — Week 39">
      </div>

      <div class="dropzone" id="dropzone">
        <i class="fas fa-file-arrow-up text-2xl text-slate-400 mb-2"></i>
        <div class="text-sm text-slate-600">Drag a .docx or .pdf here, or</div>
        <input type="file" id="nf-file" accept=".docx,.pdf" class="hidden">
        <button class="btn btn-secondary mt-2" id="btn-browse-file"><i class="fas fa-folder-open"></i> Browse file</button>
        <div id="file-name" class="text-xs text-teal-800 font-semibold mt-2"></div>
        <div id="parse-status" class="text-xs mt-2"></div>
      </div>
      <p class="text-xs text-slate-400"><i class="fas fa-circle-info mr-1"></i>Word (.docx) parses precisely from real table cells. PDF parsing is best-effort (reconstructed from text patterns) — review rows after upload. You can also skip the file and add rows manually.</p>
    </div>
    <div class="p-5 border-t flex justify-end gap-2">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-create-brief"><i class="fas fa-check"></i> Create Brief</button>
    </div>
  `)

  let parsedRows = []
  let parsedRawText = ''
  let selectedFile = null

  const dropzone = document.getElementById('dropzone')
  const fileInput = document.getElementById('nf-file')
  document.getElementById('btn-browse-file').addEventListener('click', () => fileInput.click())
  ;['dragover', 'dragenter'].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('dragover') }))
  ;['dragleave', 'drop'].forEach((evt) => dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('dragover') }))
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  })
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (file) handleFile(file)
  })

  async function handleFile(file) {
    selectedFile = file
    document.getElementById('file-name').textContent = file.name
    const statusEl = document.getElementById('parse-status')
    statusEl.innerHTML = `<div class="flex items-center gap-2 text-slate-500"><div class="spinner" style="width:14px;height:14px"></div> Parsing…</div>`
    try {
      const result = await Parser.parseFile(file)
      parsedRows = result.rows
      parsedRawText = result.raw_text
      statusEl.innerHTML = `<span class="text-emerald-700 font-semibold"><i class="fas fa-check"></i> Parsed ${result.rows.length} rows</span>` +
        (result.warnings.length ? `<div class="text-amber-700 mt-1">${result.warnings.map((w) => `<div><i class="fas fa-triangle-exclamation"></i> ${escapeHtml(w)}</div>`).join('')}</div>` : '')
    } catch (err) {
      statusEl.innerHTML = `<span class="text-red-600"><i class="fas fa-xmark"></i> ${escapeHtml(err.message)}</span>`
    }
  }

  document.getElementById('btn-create-brief').addEventListener('click', async () => {
    const btn = document.getElementById('btn-create-brief')
    btn.disabled = true
    btn.innerHTML = `<div class="spinner" style="width:14px;height:14px"></div> Creating…`
    try {
      const payload = {
        week_label: document.getElementById('nf-week-label').value.trim(),
        period_start: document.getElementById('nf-start').value,
        period_end: document.getElementById('nf-end').value,
        draft_stage: document.getElementById('nf-stage').value,
        title: document.getElementById('nf-title').value.trim() || undefined,
        source_filename: selectedFile ? selectedFile.name : undefined,
        source_file_type: selectedFile ? selectedFile.name.split('.').pop() : 'manual',
        raw_text: parsedRawText || undefined,
        rows: parsedRows,
      }
      const { id } = await API.createBrief(payload)
      if (selectedFile) {
        await API.uploadBriefFile(id, selectedFile)
      }
      closeModal()
      toast('Brief created')
      window.location.hash = `#/brief/${id}`
    } catch (err) {
      toast(err?.response?.data?.error || err.message, 'error')
      btn.disabled = false
      btn.innerHTML = `<i class="fas fa-check"></i> Create Brief`
    }
  })
}

// ===========================================================================
// VIEW 2: Brief Detail
// ===========================================================================
async function renderBriefDetail(content, briefId) {
  content.innerHTML = `<div class="flex items-center justify-center py-16"><div class="spinner"></div></div>`
  const { brief, rows } = await API.getBrief(briefId)
  const activeTab = state.params[1] || 'rows'

  content.innerHTML = `
    <div class="mb-4">
      <a href="#/weeks" class="text-sm text-teal-800 hover:underline"><i class="fas fa-arrow-left mr-1"></i>Back to archive</a>
    </div>
    <div class="card p-4 mb-5">
      <div class="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-bold text-teal-900">${escapeHtml(brief.title || brief.week_label)}</h2>
            ${stageBadge(brief.draft_stage)}
          </div>
          <div class="text-sm text-slate-500 mt-1">${escapeHtml(brief.period_start)} → ${escapeHtml(brief.period_end)} · ${rows.length} rows</div>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button class="btn btn-secondary" id="btn-edit-meta"><i class="fas fa-pen"></i> Edit week info</button>
          ${brief.r2_key ? `<a class="btn btn-secondary" href="${API.briefFileUrl(brief.id)}"><i class="fas fa-file-arrow-down"></i> Download original</a>` : ''}
          <label class="btn btn-secondary cursor-pointer">
            <i class="fas fa-upload"></i> ${brief.r2_key ? 'Replace' : 'Attach'} file
            <input type="file" accept=".docx,.pdf" class="hidden" id="btn-attach-file">
          </label>
          <button class="btn btn-primary" id="btn-run-check"><i class="fas fa-magnifying-glass"></i> Run Compliance + Redundancy Check</button>
        </div>
      </div>
    </div>

    <div class="flex gap-1 border-b mb-4">
      <a href="#/brief/${briefId}/rows" class="tab-btn ${activeTab === 'rows' ? 'active' : ''}"><i class="fas fa-table-list mr-1"></i>Rows (${rows.length})</a>
      <a href="#/brief/${briefId}/compliance" class="tab-btn ${activeTab === 'compliance' ? 'active' : ''}"><i class="fas fa-clipboard-check mr-1"></i>Compliance</a>
      <a href="#/brief/${briefId}/redundancy" class="tab-btn ${activeTab === 'redundancy' ? 'active' : ''}"><i class="fas fa-clone mr-1"></i>Redundancy vs Prior Weeks</a>
      <a href="#/brief/${briefId}/source-check" class="tab-btn ${activeTab === 'source-check' ? 'active' : ''}"><i class="fas fa-link mr-1"></i>Source Cross-Check</a>
    </div>

    <div id="tab-content"></div>
  `

  document.getElementById('btn-edit-meta').addEventListener('click', () => showEditMetaModal(brief))
  document.getElementById('btn-attach-file').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    if (!file) return
    toast('Uploading…', 'info')
    await API.uploadBriefFile(brief.id, file)
    toast('File attached')
    renderBriefDetail(content, briefId)
  })
  document.getElementById('btn-run-check').addEventListener('click', async () => {
    const btn = document.getElementById('btn-run-check')
    btn.disabled = true
    btn.innerHTML = `<div class="spinner" style="width:14px;height:14px"></div> Checking…`
    try {
      const result = await API.runCheck(brief.id)
      toast(`Check complete: ${result.compliance_issue_count} compliance findings, ${result.redundancy_match_count} redundancy matches`)
      window.location.hash = `#/brief/${briefId}/compliance`
      render()
    } catch (err) {
      toast(err?.response?.data?.error || err.message, 'error')
    } finally {
      btn.disabled = false
      btn.innerHTML = `<i class="fas fa-magnifying-glass"></i> Run Compliance + Redundancy Check`
    }
  })

  const tabContent = document.getElementById('tab-content')
  if (activeTab === 'rows') {
    renderRowsTab(tabContent, brief, rows)
  } else if (activeTab === 'compliance') {
    await renderComplianceTab(tabContent, brief)
  } else if (activeTab === 'redundancy') {
    await renderRedundancyTab(tabContent, brief)
  } else if (activeTab === 'source-check') {
    renderSourceCheckTab(tabContent, rows)
  }
}

function showEditMetaModal(brief) {
  openModal(`
    <div class="p-5 border-b flex items-center justify-between">
      <h3 class="font-bold text-teal-900"><i class="fas fa-pen mr-2"></i>Edit Week Info</h3>
      <button class="text-slate-400 hover:text-slate-700" onclick="closeModal()"><i class="fas fa-xmark text-lg"></i></button>
    </div>
    <div class="p-5 space-y-3">
      <div><label class="text-xs font-semibold text-slate-600">Week label</label><input type="text" id="em-week-label" value="${escapeHtml(brief.week_label)}"></div>
      <div><label class="text-xs font-semibold text-slate-600">Title</label><input type="text" id="em-title" value="${escapeHtml(brief.title || '')}"></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-xs font-semibold text-slate-600">Period start</label><input type="date" id="em-start" value="${brief.period_start}"></div>
        <div><label class="text-xs font-semibold text-slate-600">Period end</label><input type="date" id="em-end" value="${brief.period_end}"></div>
      </div>
      <div><label class="text-xs font-semibold text-slate-600">Draft stage</label>
        <select id="em-stage">
          <option value="draft1" ${brief.draft_stage === 'draft1' ? 'selected' : ''}>Draft 1 (Thursday)</option>
          <option value="draft2" ${brief.draft_stage === 'draft2' ? 'selected' : ''}>Draft 2 (Friday)</option>
          <option value="final" ${brief.draft_stage === 'final' ? 'selected' : ''}>Final</option>
        </select>
      </div>
    </div>
    <div class="p-5 border-t flex justify-end gap-2">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-meta"><i class="fas fa-check"></i> Save</button>
    </div>
  `)
  document.getElementById('btn-save-meta').addEventListener('click', async () => {
    await API.updateBrief(brief.id, {
      week_label: document.getElementById('em-week-label').value.trim(),
      title: document.getElementById('em-title').value.trim(),
      period_start: document.getElementById('em-start').value,
      period_end: document.getElementById('em-end').value,
      draft_stage: document.getElementById('em-stage').value,
    })
    closeModal()
    toast('Saved')
    render()
  })
}

// --- Rows tab (view / edit / delete / add rows) -----------------------------
function renderRowsTab(el, brief, rows) {
  const bySector = {}
  for (const r of rows) {
    if (!bySector[r.sector]) bySector[r.sector] = []
    bySector[r.sector].push(r)
  }
  const sectorOrder = SECTORS.filter((s) => bySector[s]).concat(Object.keys(bySector).filter((s) => !SECTORS.includes(s)))

  el.innerHTML = `
    <div class="flex justify-end mb-3">
      <button class="btn btn-primary" id="btn-add-row"><i class="fas fa-plus"></i> Add Row</button>
    </div>
    ${rows.length === 0 ? emptyState('No rows yet', 'Add rows manually, or go back and re-upload a file to parse rows automatically.') : ''}
    ${sectorOrder.map((sector) => `
      <div class="card mb-4 overflow-hidden">
        <div class="bg-slate-100 px-4 py-2 font-bold text-teal-900 text-sm">${escapeHtml(sector)} <span class="text-slate-400 font-normal">(${bySector[sector].length})</span></div>
        <div class="overflow-x-auto">
          <table class="data-table">
            <thead><tr><th style="width:22%">Headline</th><th style="width:26%">Summary</th><th style="width:26%">Impact</th><th style="width:16%">Regulatory</th><th style="width:10%">Actions</th></tr></thead>
            <tbody>
              ${bySector[sector].map((r) => rowTr(r)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `).join('')}
  `

  document.getElementById('btn-add-row').addEventListener('click', () => showRowEditModal(brief.id, null))
  el.querySelectorAll('[data-edit-row]').forEach((btn) => btn.addEventListener('click', () => {
    const row = rows.find((r) => r.id === Number(btn.dataset.editRow))
    showRowEditModal(brief.id, row)
  }))
  el.querySelectorAll('[data-delete-row]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('Delete this row?')) return
    await API.deleteRow(btn.dataset.deleteRow)
    toast('Row deleted')
    render()
  }))
}

function gradeSlug(grade) {
  return grade ? `impact-${grade.replace(/\s+/g, '-')}` : ''
}

function rowTr(r) {
  const gradeClass = gradeSlug(r.impact_grade)
  return `
    <tr>
      <td>
        <div class="font-semibold text-slate-800">${escapeHtml(r.headline)}</div>
        <div class="text-xs text-slate-400 mt-0.5">${escapeHtml(r.source_name || '—')}${r.source_date ? ', ' + escapeHtml(r.source_date) : ''}</div>
      </td>
      <td class="text-slate-600">${escapeHtml(truncate(r.summary, 140))}</td>
      <td><span class="${gradeClass}">${escapeHtml(r.impact_grade || '—')}.</span> <span class="text-slate-600">${escapeHtml(truncate((r.impact_text || '').replace(/^[A-Za-z][A-Za-z\s]*?\.\s*/, ''), 140))}</span></td>
      <td class="text-slate-600">${escapeHtml(truncate(r.regulatory_text, 80) || '-')}</td>
      <td>
        <button class="text-teal-700 hover:text-teal-900 mr-2" data-edit-row="${r.id}" title="Edit"><i class="fas fa-pen"></i></button>
        <button class="text-slate-400 hover:text-red-600" data-delete-row="${r.id}" title="Delete"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `
}

function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}

function showRowEditModal(briefId, row) {
  const isNew = !row
  row = row || { sector: 'Other', headline: '', source_name: '', source_date: '', source_url: '', summary: '', impact_grade: '', impact_text: '', regulatory_text: '' }
  openModal(`
    <div class="p-5 border-b flex items-center justify-between">
      <h3 class="font-bold text-teal-900">${isNew ? 'Add Row' : 'Edit Row'}</h3>
      <button class="text-slate-400 hover:text-slate-700" onclick="closeModal()"><i class="fas fa-xmark text-lg"></i></button>
    </div>
    <div class="p-5 space-y-3">
      <div>
        <label class="text-xs font-semibold text-slate-600">Sector</label>
        <select id="rf-sector">${SECTORS.map((s) => `<option value="${s}" ${row.sector === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      </div>
      <div><label class="text-xs font-semibold text-slate-600">Headline</label><input type="text" id="rf-headline" value="${escapeHtml(row.headline)}"></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-xs font-semibold text-slate-600">Source outlet</label><input type="text" id="rf-source-name" value="${escapeHtml(row.source_name)}" placeholder="e.g. The Star"></div>
        <div><label class="text-xs font-semibold text-slate-600">Source date (as in brief)</label><input type="text" id="rf-source-date" value="${escapeHtml(row.source_date)}" placeholder="e.g. 22 Sept 2026"></div>
      </div>
      <div><label class="text-xs font-semibold text-slate-600">Source URL (optional)</label><input type="url" id="rf-source-url" value="${escapeHtml(row.source_url)}" placeholder="https://…"></div>
      <div><label class="text-xs font-semibold text-slate-600">Summary</label><textarea id="rf-summary" rows="3">${escapeHtml(row.summary)}</textarea></div>
      <div>
        <label class="text-xs font-semibold text-slate-600">Impact grade</label>
        <select id="rf-grade">
          <option value="">— none —</option>
          ${IMPACT_GRADES.map((g) => `<option value="${g}" ${row.impact_grade === g ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      </div>
      <div><label class="text-xs font-semibold text-slate-600">Near-term Impact &amp; Strategic Implications</label><textarea id="rf-impact" rows="3" placeholder="Positive. …">${escapeHtml(row.impact_text)}</textarea></div>
      <div><label class="text-xs font-semibold text-slate-600">Regulatory/Policy Changes</label><textarea id="rf-regulatory" rows="2">${escapeHtml(row.regulatory_text)}</textarea></div>
    </div>
    <div class="p-5 border-t flex justify-end gap-2">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-row"><i class="fas fa-check"></i> Save</button>
    </div>
  `)

  document.getElementById('btn-save-row').addEventListener('click', async () => {
    const gradeVal = document.getElementById('rf-grade').value
    let impactText = document.getElementById('rf-impact').value.trim()
    // Auto-prefix the grade if the user selected one but didn't type it into the text
    // (grades can be multi-word, e.g. "Strategic Benchmark.", so escape + match loosely)
    const escapedGrade = gradeVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (gradeVal && !new RegExp(`^${escapedGrade}\\.`).test(impactText)) {
      impactText = impactText ? `${gradeVal}. ${impactText.replace(/^[A-Z][A-Za-z\s]*?\.\s*/, '')}` : `${gradeVal}. `
    }
    const payload = {
      sector: document.getElementById('rf-sector').value,
      headline: document.getElementById('rf-headline').value.trim(),
      source_name: document.getElementById('rf-source-name').value.trim(),
      source_date: document.getElementById('rf-source-date').value.trim(),
      source_url: document.getElementById('rf-source-url').value.trim(),
      summary: document.getElementById('rf-summary').value.trim(),
      impact_grade: gradeVal || null,
      impact_text: impactText,
      regulatory_text: document.getElementById('rf-regulatory').value.trim(),
    }
    if (!payload.headline) { toast('Headline is required', 'error'); return }

    if (isNew) {
      await API.addRow(briefId, payload)
    } else {
      await API.updateRow(row.id, payload)
    }
    closeModal()
    toast('Row saved')
    render()
  })
}

// --- Compliance tab ----------------------------------------------------------
async function renderComplianceTab(el, brief) {
  el.innerHTML = `<div class="flex items-center justify-center py-10"><div class="spinner"></div></div>`
  const issues = await API.getCompliance(brief.id)

  if (brief.status === 'uploaded') {
    el.innerHTML = emptyState('Not checked yet', 'Click "Run Compliance + Redundancy Check" above to scan this brief against the house rules.')
    return
  }
  if (issues.length === 0) {
    el.innerHTML = `<div class="card p-8 text-center"><i class="fas fa-circle-check text-3xl text-emerald-500 mb-2"></i><div class="font-semibold text-emerald-700">No compliance issues found</div></div>`
    return
  }

  const bySeverity = { error: [], warning: [], info: [] }
  for (const i of issues) bySeverity[i.severity]?.push(i)

  const ruleLabel = {
    banned_word: 'Banned word', impact_opener: 'Impact opener format', x_from_y: 'Missing "X from Y" base',
    entity_generic: 'Generic Group reference', entity_alias: 'Entity name/ownership', no_source: 'Missing source', weak_language: 'Certainty language',
    transmission_mechanism: 'Missing transmission mechanism', entity_missing_in_impact: 'No named business in Impact',
    headline_summary_mismatch: 'Headline/Summary mismatch', abbreviation_expansion: 'Abbreviation not expanded',
  }

  el.innerHTML = `
    <div class="flex gap-3 mb-4">
      <div class="card p-3 flex-1 text-center"><div class="text-2xl font-bold text-red-600">${bySeverity.error.length}</div><div class="text-xs text-slate-500">Errors</div></div>
      <div class="card p-3 flex-1 text-center"><div class="text-2xl font-bold text-amber-600">${bySeverity.warning.length}</div><div class="text-xs text-slate-500">Warnings</div></div>
      <div class="card p-3 flex-1 text-center"><div class="text-2xl font-bold text-blue-600">${bySeverity.info.length}</div><div class="text-xs text-slate-500">Info</div></div>
    </div>
    <div class="space-y-2">
      ${issues.map((i) => `
        <div class="card p-3 flex items-start gap-3">
          <span class="badge badge-${i.severity} mt-0.5">${i.severity}</span>
          <div class="flex-1">
            <div class="text-sm font-semibold text-slate-700">${escapeHtml(ruleLabel[i.rule_code] || i.rule_code)} ${i.sector ? `<span class="text-slate-400 font-normal">· ${escapeHtml(i.sector)}</span>` : ''}</div>
            <div class="text-sm text-slate-600 mt-0.5">${escapeHtml(i.message)}</div>
            ${i.headline ? `<div class="text-xs text-slate-400 mt-1"><i class="fas fa-quote-left mr-1"></i>${escapeHtml(i.headline)}</div>` : ''}
            ${i.excerpt ? `<div class="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 mt-1 font-mono text-slate-500">${escapeHtml(i.excerpt)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `
}

// --- Redundancy tab ----------------------------------------------------------
async function renderRedundancyTab(el, brief) {
  el.innerHTML = `<div class="flex items-center justify-center py-10"><div class="spinner"></div></div>`
  const matches = await API.getRedundancy(brief.id)

  if (brief.status === 'uploaded') {
    el.innerHTML = emptyState('Not checked yet', 'Click "Run Compliance + Redundancy Check" above to compare this brief against the last 4 prior weeks.')
    return
  }
  if (matches.length === 0) {
    el.innerHTML = `<div class="card p-8 text-center"><i class="fas fa-circle-check text-3xl text-emerald-500 mb-2"></i><div class="font-semibold text-emerald-700">No redundancy detected against prior weeks</div></div>`
    return
  }

  const typeLabel = { likely_duplicate: 'Likely duplicate', continuing_story: 'Continuing story', similar_topic: 'Similar topic' }
  const typeBadge = { likely_duplicate: 'badge-error', continuing_story: 'badge-warning', similar_topic: 'badge-neutral' }

  el.innerHTML = `
    <p class="text-sm text-slate-500 mb-3"><i class="fas fa-circle-info mr-1"></i>Compared against prior briefs by headline/summary text overlap. "Likely duplicate" = same story restated; "Continuing story" is acceptable only if the angle/figures genuinely moved this week.</p>
    <div class="space-y-3">
      ${matches.map((m) => `
        <div class="card p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="badge ${typeBadge[m.match_type]}">${typeLabel[m.match_type]} · ${Math.round(m.similarity_score * 100)}% overlap</span>
            <span class="text-xs text-slate-400">vs ${escapeHtml(m.prior_week_label)} (${escapeHtml(m.prior_period_start)})</span>
          </div>
          <div class="grid sm:grid-cols-2 gap-3">
            <div class="border border-slate-200 rounded p-2">
              <div class="text-xs text-slate-400 mb-1">This week — ${escapeHtml(m.row_sector)}</div>
              <div class="text-sm font-semibold text-slate-800">${escapeHtml(m.row_headline)}</div>
            </div>
            <div class="border border-slate-200 rounded p-2 bg-slate-50">
              <div class="text-xs text-slate-400 mb-1">Prior — ${escapeHtml(m.prior_sector)}</div>
              <div class="text-sm font-semibold text-slate-600">${escapeHtml(m.prior_headline)}</div>
            </div>
          </div>
          <div class="text-xs text-slate-500 mt-2">${escapeHtml(m.note)}</div>
        </div>
      `).join('')}
    </div>
  `
}

// --- Source cross-check tab ---------------------------------------------
function renderSourceCheckTab(el, rows) {
  if (rows.length === 0) {
    el.innerHTML = emptyState('No rows to check', 'Add rows first.')
    return
  }
  el.innerHTML = `
    <div class="card p-3 mb-4 text-sm text-slate-600">
      <i class="fas fa-circle-info mr-1 text-teal-700"></i>
      Reuters, The Star, The Edge, Malay Mail and The Sun block automated fetching, so verification opens a site-restricted search per outlet in one click.
      Bernama, NST and The Guardian have public feeds — where available, today's headlines are pulled directly for a quick eyeball match.
    </div>
    <div class="space-y-3">
      ${rows.map((r, idx) => `
        <div class="card p-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="font-semibold text-sm text-slate-800">${escapeHtml(r.headline)}</div>
              <div class="text-xs text-slate-400">${escapeHtml(r.source_name || 'no source listed')}${r.source_date ? ', ' + escapeHtml(r.source_date) : ''} · ${escapeHtml(r.sector)}</div>
            </div>
            <button class="btn btn-ghost text-xs" data-check-idx="${idx}"><i class="fas fa-magnifying-glass"></i> Check sources</button>
          </div>
          <div id="source-links-${idx}" class="mt-2"></div>
        </div>
      `).join('')}
    </div>
  `

  el.querySelectorAll('[data-check-idx]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const idx = btn.dataset.checkIdx
      const row = rows[idx]
      const target = document.getElementById(`source-links-${idx}`)
      target.innerHTML = `<div class="text-xs text-slate-400"><div class="spinner" style="width:12px;height:12px;display:inline-block;vertical-align:middle"></div> Loading…</div>`
      const links = await API.sourceLinks(row.headline)
      target.innerHTML = `<div class="flex flex-wrap gap-1.5 mt-1">${links.map((l) => `<a href="${l.url}" target="_blank" class="btn btn-secondary text-xs"><i class="fas fa-arrow-up-right-from-square"></i> ${escapeHtml(l.name)}</a>`).join('')}</div>`

      // Try live feeds for the outlets that support it
      for (const outlet of ['Bernama', 'NST', 'The Guardian']) {
        const feed = await API.sourceFeed(outlet)
        if (feed.available && feed.items?.length) {
          const feedDiv = document.createElement('div')
          feedDiv.className = 'mt-2 text-xs border-t pt-2'
          feedDiv.innerHTML = `<div class="font-semibold text-slate-500 mb-1">${outlet} — latest headlines</div>` +
            feed.items.slice(0, 5).map((it) => `<div class="truncate"><a href="${it.link}" target="_blank" class="text-teal-700 hover:underline">${escapeHtml(it.title)}</a></div>`).join('')
          target.appendChild(feedDiv)
        }
      }
    })
  })
}

// ===========================================================================
// VIEW 3: Daily News Log
// ===========================================================================
async function renderDailyLog(content) {
  content.innerHTML = `<div class="flex items-center justify-center py-16"><div class="spinner"></div></div>`
  const { entries, sweep } = await API.listDailyLog()

  content.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <div>
        <h2 class="text-xl font-bold text-teal-900">Daily News Log</h2>
        <p class="text-sm text-slate-500 mt-1">Track Monday–Thursday developments so Friday's brief draft isn't starting cold. Mirrors your Gen Team's daily sweep.</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="btn btn-secondary" id="btn-run-sweep"><i class="fas fa-arrows-rotate"></i> Run Sweep Now</button>
        <button class="btn btn-primary" id="btn-add-log"><i class="fas fa-plus"></i> Add Entry</button>
      </div>
    </div>
    ${sweepBanner(sweep)}
    ${entries.length === 0 ? emptyState('No entries yet', 'Auto-sweep runs once a day against Bernama/NST/Guardian for your watchlist — or add developments manually as you find them.') : ''}
    <div class="card overflow-hidden">
      <table class="data-table">
        <thead><tr><th style="width:9%">Date</th><th style="width:14%">Sector</th><th style="width:27%">Headline</th><th style="width:11%">Source</th><th style="width:9%">Priority</th><th style="width:8%">Origin</th><th style="width:12%">Used in</th><th style="width:10%">Actions</th></tr></thead>
        <tbody>
          ${entries.map((e) => `
            <tr>
              <td>${escapeHtml(e.log_date)}</td>
              <td>${escapeHtml(e.sector)}</td>
              <td>
                <div class="font-semibold text-slate-800">${escapeHtml(e.headline)}</div>
                ${e.note ? `<div class="text-xs text-slate-400">${escapeHtml(e.note)}</div>` : ''}
                ${e.matched_term ? `<div class="text-xs text-slate-400">matched: "${escapeHtml(e.matched_term)}"</div>` : ''}
              </td>
              <td>${e.source_url ? `<a href="${escapeHtml(e.source_url)}" target="_blank" class="text-teal-700 hover:underline">${escapeHtml(e.source_name || 'link')}</a>` : escapeHtml(e.source_name || '—')}</td>
              <td>${priorityBadge(e.priority)}</td>
              <td>${originBadge(e.origin)}</td>
              <td>${e.used_in_brief_id ? `<a href="#/brief/${e.used_in_brief_id}" class="text-teal-700 hover:underline text-xs">Brief #${e.used_in_brief_id}</a>` : '<span class="text-slate-300 text-xs">not yet</span>'}</td>
              <td>
                <button class="text-teal-700 hover:text-teal-900 mr-2" data-edit-log="${e.id}" title="Edit"><i class="fas fa-pen"></i></button>
                <button class="text-slate-400 hover:text-red-600" data-delete-log="${e.id}" title="Delete"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `

  document.getElementById('btn-add-log').addEventListener('click', () => showLogEditModal(null))
  document.getElementById('btn-run-sweep').addEventListener('click', async (ev) => {
    ev.target.closest('button').disabled = true
    ev.target.closest('button').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sweeping…'
    try {
      const result = await API.runDailyLogSweep()
      toast(`Sweep complete — ${result.new_entries} new item(s) logged`)
    } catch {
      toast('Sweep failed — feeds may be unreachable right now', 'error')
    }
    renderDailyLog(content)
  })
  content.querySelectorAll('[data-edit-log]').forEach((btn) => btn.addEventListener('click', () => {
    const entry = entries.find((e) => e.id === Number(btn.dataset.editLog))
    showLogEditModal(entry)
  }))
  content.querySelectorAll('[data-delete-log]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('Delete this log entry?')) return
    await API.deleteDailyLog(btn.dataset.deleteLog)
    toast('Deleted')
    renderDailyLog(content)
  }))
}

function sweepBanner(sweep) {
  if (!sweep) return ''
  if (sweep.ran) {
    return `<div class="mb-4 text-sm rounded-lg border border-teal-200 bg-teal-50 text-teal-800 px-4 py-2.5 flex items-center gap-2">
      <i class="fas fa-circle-check"></i>
      <span>Auto-sweep just ran against ${sweep.checked_outlets.join(', ')} — <strong>${sweep.new_entries} new item(s)</strong> logged from ${sweep.items_seen} headlines checked.</span>
    </div>`
  }
  return `<div class="mb-4 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-500 px-4 py-2.5 flex items-center gap-2">
    <i class="fas fa-circle-info"></i>
    <span>${escapeHtml(sweep.reason || 'Sweep already ran today.')} Use "Run Sweep Now" to check again.</span>
  </div>`
}

function originBadge(origin) {
  return origin === 'auto'
    ? `<span class="badge badge-info"><i class="fas fa-robot"></i> Auto</span>`
    : `<span class="badge badge-neutral">Manual</span>`
}

function priorityBadge(p) {
  const map = { high: 'badge-error', normal: 'badge-neutral', watch: 'badge-info' }
  return `<span class="badge ${map[p] || 'badge-neutral'}">${p}</span>`
}

function showLogEditModal(entry) {
  const isNew = !entry
  entry = entry || { log_date: dayjs().format('YYYY-MM-DD'), sector: 'Global', headline: '', source_name: '', source_url: '', note: '', priority: 'normal' }
  openModal(`
    <div class="p-5 border-b flex items-center justify-between">
      <h3 class="font-bold text-teal-900">${isNew ? 'Add Log Entry' : 'Edit Log Entry'}</h3>
      <button class="text-slate-400 hover:text-slate-700" onclick="closeModal()"><i class="fas fa-xmark text-lg"></i></button>
    </div>
    <div class="p-5 space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-xs font-semibold text-slate-600">Date</label><input type="date" id="lf-date" value="${entry.log_date}"></div>
        <div><label class="text-xs font-semibold text-slate-600">Sector</label>
          <select id="lf-sector">${SECTORS.filter((s) => s !== 'Watchlist' && s !== 'Speed Read').map((s) => `<option value="${s}" ${entry.sector === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      <div><label class="text-xs font-semibold text-slate-600">Headline</label><input type="text" id="lf-headline" value="${escapeHtml(entry.headline)}"></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-xs font-semibold text-slate-600">Source outlet</label><input type="text" id="lf-source-name" value="${escapeHtml(entry.source_name)}"></div>
        <div><label class="text-xs font-semibold text-slate-600">Priority</label>
          <select id="lf-priority">
            <option value="high" ${entry.priority === 'high' ? 'selected' : ''}>High priority</option>
            <option value="normal" ${entry.priority === 'normal' ? 'selected' : ''}>Normal</option>
            <option value="watch" ${entry.priority === 'watch' ? 'selected' : ''}>Watch only</option>
          </select>
        </div>
      </div>
      <div><label class="text-xs font-semibold text-slate-600">Source URL</label><input type="url" id="lf-source-url" value="${escapeHtml(entry.source_url)}"></div>
      <div><label class="text-xs font-semibold text-slate-600">Note</label><textarea id="lf-note" rows="2">${escapeHtml(entry.note)}</textarea></div>
    </div>
    <div class="p-5 border-t flex justify-end gap-2">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-log"><i class="fas fa-check"></i> Save</button>
    </div>
  `)

  document.getElementById('btn-save-log').addEventListener('click', async () => {
    const payload = {
      log_date: document.getElementById('lf-date').value,
      sector: document.getElementById('lf-sector').value,
      headline: document.getElementById('lf-headline').value.trim(),
      source_name: document.getElementById('lf-source-name').value.trim(),
      source_url: document.getElementById('lf-source-url').value.trim(),
      note: document.getElementById('lf-note').value.trim(),
      priority: document.getElementById('lf-priority').value,
    }
    if (!payload.headline) { toast('Headline is required', 'error'); return }
    if (isNew) await API.createDailyLog(payload)
    else await API.updateDailyLog(entry.id, payload)
    closeModal()
    toast('Saved')
    render()
  })
}

// ===========================================================================
// VIEW 4: Al Bukhary Entity Map
// ===========================================================================
async function renderEntities(content) {
  content.innerHTML = `<div class="flex items-center justify-center py-16"><div class="spinner"></div></div>`
  const entities = await API.listEntities()
  state.entities = entities

  content.innerHTML = `
    <div class="flex items-center justify-between mb-5">
      <div>
        <h2 class="text-xl font-bold text-teal-900">Al Bukhary Group Entity Map</h2>
        <p class="text-sm text-slate-500 mt-1">Used by the compliance checker to catch generic "across the Group" phrasing, wrong entity names, and associate vs. subsidiary mistakes.</p>
      </div>
      <button class="btn btn-primary" id="btn-add-entity"><i class="fas fa-plus"></i> Add Entity</button>
    </div>
    <div class="card overflow-hidden">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Sector</th><th>Relationship</th><th>Parent</th><th>Known aliases (flagged if used)</th><th>Notes</th><th style="width:8%">Actions</th></tr></thead>
        <tbody>
          ${entities.map((e) => `
            <tr>
              <td class="font-semibold text-slate-800">${escapeHtml(e.name)}</td>
              <td>${escapeHtml(e.sector || '—')}</td>
              <td>${e.relationship === 'associate' ? `${escapeHtml(e.relationship)}${e.ownership_pct ? ` (${e.ownership_pct}%)` : ''}` : escapeHtml(e.relationship || '—')}</td>
              <td>${escapeHtml(e.parent_entity || '—')}</td>
              <td>${(safeParseJson(e.aliases) || []).map((a) => `<span class="badge badge-warning">${escapeHtml(a)}</span>`).join(' ') || '<span class="text-slate-300">none</span>'}</td>
              <td class="text-slate-500 text-xs">${escapeHtml(e.notes || '')}</td>
              <td>
                <button class="text-teal-700 hover:text-teal-900 mr-2" data-edit-entity="${e.id}"><i class="fas fa-pen"></i></button>
                <button class="text-slate-400 hover:text-red-600" data-delete-entity="${e.id}"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `

  document.getElementById('btn-add-entity').addEventListener('click', () => showEntityEditModal(null))
  content.querySelectorAll('[data-edit-entity]').forEach((btn) => btn.addEventListener('click', () => {
    const entity = entities.find((e) => e.id === Number(btn.dataset.editEntity))
    showEntityEditModal(entity)
  }))
  content.querySelectorAll('[data-delete-entity]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('Delete this entity from the map?')) return
    await API.deleteEntity(btn.dataset.deleteEntity)
    toast('Deleted')
    renderEntities(content)
  }))
}

function safeParseJson(s) {
  try { return JSON.parse(s) } catch { return null }
}

function showEntityEditModal(entity) {
  const isNew = !entity
  entity = entity || { name: '', sector: '', relationship: 'subsidiary', ownership_pct: '', parent_entity: '', aliases: '[]', notes: '' }
  openModal(`
    <div class="p-5 border-b flex items-center justify-between">
      <h3 class="font-bold text-teal-900">${isNew ? 'Add Entity' : 'Edit Entity'}</h3>
      <button class="text-slate-400 hover:text-slate-700" onclick="closeModal()"><i class="fas fa-xmark text-lg"></i></button>
    </div>
    <div class="p-5 space-y-3">
      <div><label class="text-xs font-semibold text-slate-600">Business name</label><input type="text" id="ef-name" value="${escapeHtml(entity.name)}" placeholder="e.g. Malakoff"></div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-xs font-semibold text-slate-600">Sector</label><input type="text" id="ef-sector" value="${escapeHtml(entity.sector)}" placeholder="e.g. Energy/Power"></div>
        <div><label class="text-xs font-semibold text-slate-600">Relationship</label>
          <select id="ef-relationship">
            <option value="subsidiary" ${entity.relationship === 'subsidiary' ? 'selected' : ''}>Subsidiary</option>
            <option value="associate" ${entity.relationship === 'associate' ? 'selected' : ''}>Associate</option>
            <option value="jv" ${entity.relationship === 'jv' ? 'selected' : ''}>Joint venture</option>
            <option value="parent" ${entity.relationship === 'parent' ? 'selected' : ''}>Parent</option>
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div><label class="text-xs font-semibold text-slate-600">Ownership % (if associate/JV)</label><input type="text" id="ef-ownership" value="${entity.ownership_pct ?? ''}" placeholder="e.g. 38.45"></div>
        <div><label class="text-xs font-semibold text-slate-600">Parent entity</label><input type="text" id="ef-parent" value="${escapeHtml(entity.parent_entity)}" placeholder="e.g. MMC Corporation"></div>
      </div>
      <div><label class="text-xs font-semibold text-slate-600">Known aliases / misnomers to flag (comma-separated)</label><input type="text" id="ef-aliases" value="${escapeHtml((safeParseJson(entity.aliases) || []).join(', '))}" placeholder="e.g. Air Selangor"></div>
      <div><label class="text-xs font-semibold text-slate-600">Notes</label><textarea id="ef-notes" rows="2">${escapeHtml(entity.notes)}</textarea></div>
    </div>
    <div class="p-5 border-t flex justify-end gap-2">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-save-entity"><i class="fas fa-check"></i> Save</button>
    </div>
  `)

  document.getElementById('btn-save-entity').addEventListener('click', async () => {
    const aliasesRaw = document.getElementById('ef-aliases').value.trim()
    const aliases = aliasesRaw ? aliasesRaw.split(',').map((a) => a.trim()).filter(Boolean) : []
    const payload = {
      name: document.getElementById('ef-name').value.trim(),
      sector: document.getElementById('ef-sector').value.trim(),
      relationship: document.getElementById('ef-relationship').value,
      ownership_pct: document.getElementById('ef-ownership').value ? parseFloat(document.getElementById('ef-ownership').value) : null,
      parent_entity: document.getElementById('ef-parent').value.trim(),
      aliases,
      notes: document.getElementById('ef-notes').value.trim(),
    }
    if (!payload.name) { toast('Name is required', 'error'); return }
    if (isNew) await API.createEntity(payload)
    else await API.updateEntity(entity.id, payload)
    closeModal()
    toast('Saved')
    render()
  })
}
