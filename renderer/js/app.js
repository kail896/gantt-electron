/* ============================================================
   横道图 Gantt Chart — Desktop Application
   ============================================================ */

// ===== Data =====
const APP_VERSION = '1.0.010';
let tasks = [];
let nextId = 1;
let zoomLevel = 'week';
let selectedTaskId = null;
let dragState = null;
const DAY_MS = 86400000;
let columnWidths = { name: 200, start: 95, end: 95, duration: 55, owner: 60, plan: 130 };
let colResizeState = null;
let sortState = { key: null, asc: true };
let showTodayLine = true;

// ===== File Management =====
let currentFilePath = null;
let isDirty = false;
let autoSaveTimer = null;
const AUTO_SAVE_DELAY = 2000;

// ===== Undo/Redo =====
let undoStack = [];
let redoStack = [];
const MAX_UNDO = 50;

function captureSnapshot() {
  return {
    tasks: tasks.map(t => ({
      ...t,
      start_date: t.start_date ? fmtDate(t.start_date) : null,
      end_date: t.end_date ? fmtDate(t.end_date) : null
    })),
    nextId,
    selectedTaskId
  };
}

function pushUndoState() {
  undoStack.push(captureSnapshot());
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
}

function restoreState(s) {
  tasks = (s.tasks || []).map(t => ({
    ...t,
    start_date: t.start_date ? parseDate(t.start_date) : null,
    end_date: t.end_date ? parseDate(t.end_date) : null
  }));
  nextId = s.nextId;
  selectedTaskId = s.selectedTaskId;
  markDirty();
  fullRender();
}

function undo() {
  if (!undoStack.length) { updateStatus('没有可供撤销的操作'); return; }
  redoStack.push(captureSnapshot());
  const s = undoStack.pop();
  restoreState(s);
  updateStatus('已撤销');
}

function redo() {
  if (!redoStack.length) { updateStatus('没有可供重做的操作'); return; }
  undoStack.push(captureSnapshot());
  const s = redoStack.pop();
  restoreState(s);
  updateStatus('已重做');
}

// ===== Utilities =====
function fmtDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function parseDate(str) {
  if (!str) return null;
  const p = str.split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function daysBetween(a, b) { return Math.round((b - a) / DAY_MS); }
function getWeekStart(d) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay() + (r.getDay() === 0 ? -6 : 1));
  r.setHours(0, 0, 0, 0);
  return r;
}
function getMonthStart(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function fmtDateCN(d) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
function getFileName(p) {
  if (!p) return '未命名项目';
  return p.replace(/^.*[/\\]/, '').replace(/\.gantt$/i, '');
}
function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== Sample Data =====
function initSampleData() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rs = addDays(today, -15), re = addDays(today, 45);
  const p1 = nextId++, p2 = nextId++, p3 = nextId++, p4 = nextId++, p5 = nextId++;
  tasks = [
    { id: p1, text: '基础工程', start_date: rs, end_date: addDays(rs, 12), duration: 12, owner: '张工', progress: 100, actual_progress: 100, parent: null, sortorder: 1, open: true },
    { id: p2, text: '土方开挖', start_date: rs, end_date: addDays(rs, 5), duration: 5, owner: '李工', progress: 100, actual_progress: 100, parent: p1, sortorder: 1, open: true },
    { id: p3, text: '地基处理', start_date: addDays(rs, 5), end_date: addDays(rs, 12), duration: 7, owner: '王工', progress: 100, actual_progress: 85, parent: p1, sortorder: 2, open: true },
    { id: p4, text: '主体结构', start_date: addDays(rs, 12), end_date: addDays(rs, 35), duration: 23, owner: '张工', progress: 65, actual_progress: 60, parent: null, sortorder: 2, open: true },
    { id: nextId++, text: '一层钢筋绑扎', start_date: addDays(rs, 12), end_date: addDays(rs, 20), duration: 8, owner: '赵工', progress: 100, actual_progress: 95, parent: p4, sortorder: 1, open: true },
    { id: nextId++, text: '一层混凝土浇筑', start_date: addDays(rs, 20), end_date: addDays(rs, 24), duration: 4, owner: '赵工', progress: 100, actual_progress: 100, parent: p4, sortorder: 2, open: true },
    { id: nextId++, text: '二层钢筋绑扎', start_date: addDays(rs, 24), end_date: addDays(rs, 31), duration: 7, owner: '孙工', progress: 40, actual_progress: 35, parent: p4, sortorder: 3, open: true },
    { id: nextId++, text: '二层混凝土浇筑', start_date: addDays(rs, 31), end_date: addDays(rs, 35), duration: 4, owner: '孙工', progress: 0, actual_progress: 0, parent: p4, sortorder: 4, open: true },
    { id: p5, text: '装饰装修', start_date: addDays(rs, 35), end_date: re, duration: daysBetween(addDays(rs, 35), re), owner: '李工', progress: 10, actual_progress: 5, parent: null, sortorder: 3, open: true },
    { id: nextId++, text: '外墙粉刷', start_date: addDays(rs, 35), end_date: addDays(rs, 42), duration: 7, owner: '周工', progress: 20, actual_progress: 15, parent: p5, sortorder: 1, open: true },
    { id: nextId++, text: '内墙粉刷', start_date: addDays(rs, 40), end_date: re, duration: daysBetween(addDays(rs, 40), re), owner: '周工', progress: 0, actual_progress: 0, parent: p5, sortorder: 2, open: true }
  ];
}

// ===== Data Operations =====
function getTaskById(id) { return tasks.find(t => t.id === id); }
function getChildren(pid) { return tasks.filter(t => t.parent === pid).sort((a, b) => a.sortorder - b.sortorder); }
function getDescendants(pid) {
  const r = [];
  for (const c of getChildren(pid)) { r.push(c); r.push(...getDescendants(c.id)); }
  return r;
}
function getDisplayTasks() {
  if (!sortState.key) {
    // Tree-order (default)
    const visible = [];
    const roots = tasks.filter(t => t.parent === null).sort((a, b) => a.sortorder - b.sortorder);
    const stack = [...roots.reverse()];
    while (stack.length) {
      const t = stack.pop();
      visible.push(t);
      if (t.open) { const ch = getChildren(t.id); for (let i = ch.length - 1; i >= 0; i--) stack.push(ch[i]); }
    }
    return visible;
  }
  // Sort only root (parent) tasks, keep children in tree order within their parent
  const roots = tasks.filter(t => t.parent === null).sort((a, b) => {
    let va, vb;
    switch (sortState.key) {
      case 'name': va = a.text || ''; vb = b.text || ''; break;
      case 'start': va = a.start_date ? a.start_date.getTime() : 0; vb = b.start_date ? b.start_date.getTime() : 0; break;
      case 'end': va = a.end_date ? a.end_date.getTime() : 0; vb = b.end_date ? b.end_date.getTime() : 0; break;
      case 'duration': va = a.duration || 0; vb = b.duration || 0; break;
      case 'owner': va = a.owner || ''; vb = b.owner || ''; break;
      case 'plan': va = a.progress || 0; vb = b.progress || 0; break;
      default: return 0;
    }
    if (typeof va === 'string') {
      const cmp = va.localeCompare(vb, 'zh-CN');
      return sortState.asc ? cmp : -cmp;
    }
    if (va < vb) return sortState.asc ? -1 : 1;
    if (va > vb) return sortState.asc ? 1 : -1;
    return 0;
  });
  // Build display list: sorted roots + their children in tree order
  const result = [];
  for (const r of roots) {
    result.push(r);
    if (r.open) {
      const stack = [...getChildren(r.id).reverse()];
      while (stack.length) {
        const t = stack.pop();
        result.push(t);
        if (t.open) { const ch = getChildren(t.id); for (let i = ch.length - 1; i >= 0; i--) stack.push(ch[i]); }
      }
    }
  }
  return result;
}
function getTaskDepth(id) { let d = 0, t = getTaskById(id); while (t && t.parent) { d++; t = getTaskById(t.parent); } return d; }
function hasChildren(id) { return tasks.some(t => t.parent === id); }

function moveTaskBefore(draggedId, targetId) {
  const dragged = getTaskById(draggedId);
  const target = getTaskById(targetId);
  if (!dragged || !target || draggedId === targetId) return;
  pushUndoState();
  const oldParent = dragged.parent;
  // If target is a root task: keep dragged's parent (reorder within current group)
  // If target is a child: adopt target's parent (allows reparenting to other groups)
  const newParent = (target.parent === null) ? (dragged.parent !== null ? dragged.parent : null) : target.parent;
  const descIds = new Set([draggedId, ...getDescendants(draggedId).map(d => d.id)]);
  if (descIds.has(newParent)) return;
  dragged.parent = newParent;
  const siblings = tasks.filter(t => t.parent === newParent && !descIds.has(t.id)).sort((a, b) => a.sortorder - b.sortorder);
  // Insert before target if they share the new parent, otherwise append
  const idx = (target.parent === newParent) ? siblings.indexOf(target) : -1;
  siblings.splice(idx < 0 ? siblings.length : idx, 0, dragged);
  siblings.forEach((t, i) => t.sortorder = i + 1);
  if (oldParent !== null && oldParent !== newParent) {
    getChildren(oldParent).forEach((t, i) => t.sortorder = i + 1);
  }
  markDirty();
  fullRender();
  updateStatus('任务已重新排序');
}

// Auto-calculate parent progress as weighted average of direct children (by duration)
function recalcParentProgress() {
  const parentIds = tasks.filter(t => hasChildren(t.id)).map(t => t.id);
  parentIds.sort((a, b) => getTaskDepth(b) - getTaskDepth(a));
  for (const pid of parentIds) {
    const children = getChildren(pid);
    if (!children.length) continue;
    const totalDur = children.reduce((s, c) => s + Math.max(1, c.duration || 1), 0);
    if (totalDur <= 0) continue;
    const weighted = children.reduce((s, c) => s + (c.progress || 0) * Math.max(1, c.duration || 1), 0);
    const parent = getTaskById(pid);
    if (parent) parent.progress = Math.round(weighted / totalDur);
  }
}

// ===== Serialization =====
function serializeTasks() {
  return {
    version: 1,
    nextId,
    zoomLevel,
    showTodayLine,
    columnWidths,
    tasks: tasks.map(t => ({
      ...t,
      start_date: t.start_date ? fmtDate(t.start_date) : null,
      end_date: t.end_date ? fmtDate(t.end_date) : null
    }))
  };
}
function deserializeData(data) {
  nextId = data.nextId || 1;
  zoomLevel = data.zoomLevel || 'week';
  showTodayLine = data.showTodayLine !== undefined ? data.showTodayLine : true;
  columnWidths = { name: 200, start: 95, end: 95, duration: 55, owner: 60, plan: 130, ...(data.columnWidths || {}) };
  tasks = (data.tasks || []).map(t => ({
    ...t,
    start_date: t.start_date ? parseDate(t.start_date) : null,
    end_date: t.end_date ? parseDate(t.end_date) : null
  }));
  recalcParentProgress();
}

// ===== File Operations =====
function updateTitle() {
  const name = getFileName(currentFilePath);
  const dot = isDirty ? ' ●' : '';
  document.title = name + dot + ' - 横道图 Gantt v' + APP_VERSION;
  const fs = document.getElementById('fileStatus');
  if (fs) fs.textContent = (currentFilePath ? name : '未命名项目') + (isDirty ? ' (未保存)' : '');
}
function markDirty() {
  if (!isDirty) { isDirty = true; updateTitle(); }
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    if (currentFilePath) saveCurrentFile(true);
  }, AUTO_SAVE_DELAY);
}
async function saveCurrentFile(silent) {
  if (!currentFilePath) { await saveCurrentFileAs(); return; }
  try {
    const r = await window.electronAPI.saveFile(currentFilePath, serializeTasks());
    if (r.success) { isDirty = false; updateTitle(); if (!silent) updateStatus('已保存'); }
    else { updateStatus('保存失败: ' + r.error); }
  } catch (err) { updateStatus('保存失败: ' + err.message); }
}
async function saveCurrentFileAs() {
  try {
    const r = await window.electronAPI.saveFileAs(serializeTasks());
    if (r.success) { currentFilePath = r.filePath; isDirty = false; updateTitle(); updateStatus('已保存: ' + getFileName(r.filePath)); }
    else if (!r.canceled) { updateStatus('保存失败: ' + r.error); }
  } catch (err) { updateStatus('保存失败: ' + err.message); }
}
async function openProjectFile(filePath) {
  try {
    const r = filePath ? await window.electronAPI.openFileByPath(filePath) : await window.electronAPI.openFile();
    if (r.success) { deserializeData(r.data); currentFilePath = r.filePath; isDirty = false; selectedTaskId = null; fullRender(); updateTitle(); updateStatus('已打开: ' + getFileName(r.filePath)); }
    else if (!r.canceled) { updateStatus('打开失败: ' + (r.error || '未知错误')); }
  } catch (err) { updateStatus('打开失败: ' + err.message); }
}
function newProject() {
  if (isDirty && !confirm('当前项目未保存，确定新建？')) return;
  pushUndoState();
  currentFilePath = null; isDirty = false; tasks = []; nextId = 1; selectedTaskId = null; fullRender(); updateTitle(); updateStatus('新建项目 (空)');
}

function addTask(parentId) {
  pushUndoState();
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const id = nextId++;
  tasks.push({ id, text: '新任务', start_date: now, end_date: addDays(now, 5), duration: 5, owner: '', progress: 0, actual_progress: 0, parent: parentId || null, sortorder: (parentId ? getChildren(parentId).length : tasks.filter(t => t.parent === null).length) + 1, open: true });
  selectedTaskId = id;
  recalcParentProgress();
  markDirty();
  fullRender();
  updateStatus('已添加新任务');
}

function deleteTask(id) {
  pushUndoState();
  for (const d of getDescendants(id)) { const i = tasks.indexOf(d); if (i !== -1) tasks.splice(i, 1); }
  const i = tasks.indexOf(getTaskById(id));
  if (i !== -1) tasks.splice(i, 1);
  if (selectedTaskId === id) selectedTaskId = null;
  recalcParentProgress();
  markDirty();
  fullRender();
  updateStatus('已删除任务');
}

function updateTaskField(id, field, value) {
  pushUndoState();
  const t = getTaskById(id);
  if (!t) return;
  t[field] = value;
  if (field === 'start_date' || field === 'end_date') {
    if (t.start_date && t.end_date) t.duration = Math.max(1, daysBetween(t.start_date, t.end_date) + 1);
  }
  if (field === 'duration' && t.start_date) t.end_date = addDays(t.start_date, value - 1);
  recalcParentProgress();
  markDirty();
  fullRender();
}

function toggleTask(id) {
  pushUndoState();
  const t = getTaskById(id);
  if (t) { t.open = !t.open; markDirty(); fullRender(); }
}

// ===== Gantt Range & Time Units =====
function getGanttRange() {
  if (!tasks.length) { const n = new Date(); return { start: addDays(n, -7), end: addDays(n, 30) }; }
  let min = Infinity, max = -Infinity;
  for (const t of tasks) {
    if (t.start_date && t.start_date.getTime() < min) min = t.start_date.getTime();
    if (t.end_date && t.end_date.getTime() > max) max = t.end_date.getTime();
  }
  return { start: addDays(new Date(min), -7), end: addDays(new Date(max), 14) };
}

function generateTimeUnits(range) {
  const units = [];
  let cursor;
  if (zoomLevel === 'day') {
    cursor = new Date(range.start); cursor.setHours(0, 0, 0, 0);
    while (cursor <= range.end) {
      const mk = cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0');
      units.push({ key: fmtDate(cursor), label: String(cursor.getDate()), groupLabel: (cursor.getMonth() + 1) + '月', groupKey: mk, date: new Date(cursor), width: 44 });
      cursor = addDays(cursor, 1);
    }
  } else if (zoomLevel === 'week') {
    cursor = getWeekStart(range.start);
    while (cursor <= range.end) {
      const we = addDays(cursor, 6), mk = cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0');
      units.push({ key: fmtDate(cursor), label: (cursor.getMonth() + 1) + '/' + cursor.getDate(), groupLabel: cursor.getFullYear() + '年' + (cursor.getMonth() + 1) + '月', groupKey: mk, date: new Date(cursor), width: 128 });
      cursor = addDays(cursor, 7);
    }
  } else {
    cursor = getMonthStart(range.start);
    while (cursor <= range.end) {
      units.push({ key: cursor.getFullYear() + '-' + String(cursor.getMonth() + 1).padStart(2, '0'), label: (cursor.getMonth() + 1) + '月', groupLabel: String(cursor.getFullYear()), groupKey: String(cursor.getFullYear()), date: new Date(cursor), width: 168 });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }
  return units;
}

function getPixelsPerDay(units) {
  if (zoomLevel === 'day') return 44;
  if (zoomLevel === 'week') return 128 / 7;
  if (zoomLevel === 'month' && units.length) { const d = new Date(units[0].date.getFullYear(), units[0].date.getMonth() + 1, 0); return 168 / d.getDate(); }
  return 44;
}

function dateToPixel(date, range, units, ppd) {
  if (zoomLevel !== 'month') return daysBetween(range.start, date) * ppd;
  let pos = 0;
  for (const u of units) {
    const ue = new Date(u.date.getFullYear(), u.date.getMonth() + 1, 0);
    if (date > ue) { pos += u.width; } else { pos += ((date.getDate() - 1) / ue.getDate()) * u.width; break; }
  }
  return pos;
}

// ===== Column Definitions =====
const tableColumns = [
  { key: 'name', label: '任务名称' },
  { key: 'start', label: '开始' },
  { key: 'end', label: '结束' },
  { key: 'duration', label: '工期' },
  { key: 'owner', label: '负责人' },
  { key: 'plan', label: '实际/计划' },
];

function renderTableStructure() {
  const colgroup = document.getElementById('colgroup');
  const thead = document.getElementById('tableHead');
  colgroup.innerHTML = '';
  thead.innerHTML = '';
  const tr = document.createElement('tr');
  tableColumns.forEach((c, idx) => {
    const col = document.createElement('col');
    col.dataset.colKey = c.key;
    col.style.width = columnWidths[c.key] + 'px';
    colgroup.appendChild(col);
    const th = document.createElement('th');
    th.dataset.colKey = c.key;
    th.textContent = c.label + (sortState.key === c.key ? (sortState.asc ? ' ▲' : ' ▼') : '');
    th.style.cursor = 'pointer';
    th.title = '点击为主任务排序';
    th.onclick = () => {
      if (sortState.key === c.key) {
        if (sortState.asc) sortState = { key: c.key, asc: false };
        else sortState = { key: null, asc: true };
      } else {
        sortState = { key: c.key, asc: true };
      }
      fullRender();
    };
    tr.appendChild(th);
    const h = document.createElement('div');
    h.className = 'col-resize-handle';
    h.onmousedown = (e) => startColResize(e, c.key);
    th.appendChild(h);
  });
  thead.appendChild(tr);
  updateTableWidth();
}

function updateTableWidth() {
  const table = document.getElementById('taskTable');
  const scrollEl = document.querySelector('.table-scroll');
  const panelWidth = scrollEl ? scrollEl.clientWidth : 460;
  let total = tableColumns.reduce((s, c) => s + (columnWidths[c.key] || 200), 0);
  if (total <= 0) return;
  // Always scale all columns proportionally to fill the panel exactly
  const scale = panelWidth / total;
  tableColumns.forEach(c => {
    columnWidths[c.key] = Math.max(40, Math.round((columnWidths[c.key] || 200) * scale));
    const col = document.querySelector(`#colgroup col[data-col-key="${c.key}"]`);
    if (col) col.style.width = columnWidths[c.key] + 'px';
  });
  table.style.width = panelWidth + 'px';
}

// ===== Render: Table =====
function renderTable() {
  const tbody = document.getElementById('taskTableBody');
  const visibleTasks = getDisplayTasks();
  tbody.innerHTML = '';
  for (const task of visibleTasks) {
    const depth = getTaskDepth(task.id), hasKids = hasChildren(task.id);
    const tr = document.createElement('tr');
    tr.className = (task.id === selectedTaskId ? 'selected' : '') + (hasKids ? ' task-parent' : '');
    tr.dataset.taskId = task.id;

    // Name column
    const tdName = document.createElement('td');
    tdName.className = 'name-cell';
    tdName.style.paddingLeft = (8 + depth * 20) + 'px';

    const toggleBtn = document.createElement('span');
    toggleBtn.className = 'toggle-btn' + (hasKids ? '' : ' placeholder');
    toggleBtn.textContent = hasKids ? (task.open ? '▼' : '▶') : '·';
    if (hasKids) toggleBtn.onclick = (e) => { e.stopPropagation(); toggleTask(task.id); };
    tdName.appendChild(toggleBtn);

    const ni = document.createElement('input');
    ni.type = 'text'; ni.className = 'task-text-input';
    ni.value = task.text;
    ni.title = task.text;
    ni.onchange = () => updateTaskField(task.id, 'text', ni.value);
    ni.onclick = e => e.stopPropagation();
    ni.onfocus = () => { selectedTaskId = task.id; };
    tdName.appendChild(ni);
    tr.appendChild(tdName);

    // Start date
    const tdStart = document.createElement('td');
    const si = document.createElement('input');
    si.type = 'date'; si.value = task.start_date ? fmtDate(task.start_date) : '';
    si.onchange = () => { const d = parseDate(si.value); if (d) updateTaskField(task.id, 'start_date', d); };
    si.onclick = e => e.stopPropagation();
    tdStart.appendChild(si);
    tr.appendChild(tdStart);

    // End date
    const tdEnd = document.createElement('td');
    const ei = document.createElement('input');
    ei.type = 'date'; ei.value = task.end_date ? fmtDate(task.end_date) : '';
    ei.onchange = () => { const d = parseDate(ei.value); if (d) updateTaskField(task.id, 'end_date', d); };
    ei.onclick = e => e.stopPropagation();
    tdEnd.appendChild(ei);
    tr.appendChild(tdEnd);

    // Duration
    const tdDur = document.createElement('td');
    tdDur.style.textAlign = 'center';
    const di = document.createElement('input');
    di.type = 'number'; di.min = 1; di.style.textAlign = 'center';
    di.value = task.duration || 1;
    di.onchange = () => {
      pushUndoState();
      const d = Math.max(1, +di.value || 1);
      const t = getTaskById(task.id);
      if (t) { t.duration = d; t.end_date = addDays(t.start_date, d - 1); markDirty(); fullRender(); }
    };
    di.onclick = e => e.stopPropagation();
    tdDur.appendChild(di);
    tr.appendChild(tdDur);

    // Owner
    const tdOwner = document.createElement('td');
    const oi = document.createElement('input');
    oi.type = 'text'; oi.value = task.owner || ''; oi.placeholder = '—';
    oi.onchange = () => updateTaskField(task.id, 'owner', oi.value);
    oi.onclick = e => e.stopPropagation();
    tdOwner.appendChild(oi);
    tr.appendChild(tdOwner);

    // Plan progress (editable input + mini bar)
    const tdPlan = document.createElement('td');
    tdPlan.style.padding = '0 4px';
    const planFlex = document.createElement('div');
    planFlex.style.cssText = 'display:flex;align-items:center;gap:3px;';
    const pi = document.createElement('input');
    pi.type = 'number'; pi.min = 0; pi.max = 100;
    pi.value = Math.min(100, Math.max(0, task.progress || 0));
    pi.style.cssText = 'width:36px;height:20px;padding:0 2px;font-size:11px;text-align:center;border:1px solid transparent;border-radius:3px;outline:none;background:transparent;font-family:inherit;color:inherit;flex:none;box-sizing:border-box;';
    pi.onfocus = () => { pi.style.borderColor = '#d0d5dd'; pi.style.background = '#fff'; };
    pi.onblur = () => { pi.style.borderColor = 'transparent'; pi.style.background = 'transparent'; };
    pi.onchange = () => updateTaskField(task.id, 'progress', Math.max(0, Math.min(100, +pi.value)));
    pi.onclick = e => e.stopPropagation();
    const planBar = document.createElement('div');
    planBar.style.cssText = 'flex:1;height:4px;background:#e8ecf0;border-radius:2px;overflow:hidden;min-width:16px;';
    const planPct = Math.min(100, Math.max(0, task.progress || 0));
    const planFill = document.createElement('div');
    planFill.style.cssText = 'height:100%;background:var(--accent-green);border-radius:2px;width:' + planPct + '%;transition:width 0.3s;';
    planBar.appendChild(planFill);
    planFlex.appendChild(pi);
    planFlex.appendChild(planBar);
    tdPlan.appendChild(planFlex);
    tr.appendChild(tdPlan);

    // Row click: select task
    tr.onmousedown = (e) => {
      if (e.target.closest('.toggle-btn')) return;
      selectedTaskId = task.id;
      document.querySelectorAll('#taskTable tbody tr.selected').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
    };
    // Drag-and-drop reorder (only when not sorting)
    tr.draggable = !sortState.key;
    tr.ondragstart = (e) => {
      if (sortState.key) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(task.id));
      tr.classList.add('dragging');
    };
    tr.ondragend = () => {
      tr.classList.remove('dragging');
      document.querySelectorAll('#taskTable tbody tr').forEach(r => r.classList.remove('drag-over'));
    };
    tr.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('#taskTable tbody tr').forEach(r => r.classList.remove('drag-over'));
      tr.classList.add('drag-over');
    };
    tr.ondragleave = () => tr.classList.remove('drag-over');
    tr.ondrop = (e) => {
      e.preventDefault();
      tr.classList.remove('drag-over');
      const draggedId = parseInt(e.dataTransfer.getData('text/plain'));
      if (!isNaN(draggedId) && draggedId !== task.id) moveTaskBefore(draggedId, task.id);
    };
    tbody.appendChild(tr);
  }
}

// ===== Column Resize =====
function syncColumnWidths() {
  const table = document.getElementById('taskTable');
  if (!table) return;
  const tableWidth = table.getBoundingClientRect().width;
  if (tableWidth <= 0) return;
  const totalPx = tableColumns.reduce((s, c) => s + (columnWidths[c.key] || 0), 0);
  if (totalPx <= 0) return;
  // Scale stored widths to actual rendered pixels
  for (const c of tableColumns) {
    columnWidths[c.key] = Math.round(columnWidths[c.key] / totalPx * tableWidth);
  }
}

function startColResize(e, colKey) {
  e.preventDefault();
  syncColumnWidths();
  const startX = e.clientX;
  colResizeState = { colKey, startX, startWidth: columnWidths[colKey] };
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.addEventListener('mousemove', onColResize);
  document.addEventListener('mouseup', endColResize);
}

function onColResize(e) {
  if (!colResizeState) return;
  const dx = e.clientX - colResizeState.startX;
  const newW = Math.max(40, colResizeState.startWidth + dx);
  const key = colResizeState.colKey;
  const delta = newW - columnWidths[key];
  if (delta === 0) return;

  columnWidths[key] = newW;
  // Redistribute delta inversely among other columns to keep total = panel width
  const otherKeys = tableColumns.map(c => c.key).filter(k => k !== key);
  const otherTotal = otherKeys.reduce((s, k) => s + (columnWidths[k] || 0), 0);
  if (otherTotal > 0) {
    for (const k of otherKeys) {
      const prop = (columnWidths[k] || 0) / otherTotal;
      columnWidths[k] = Math.max(40, Math.round((columnWidths[k] || 0) - delta * prop));
    }
  }
  // Update all column widths and table width in one pass
  const table = document.getElementById('taskTable');
  let total = 0;
  tableColumns.forEach(c => {
    const col = document.querySelector(`#colgroup col[data-col-key="${c.key}"]`);
    if (col) col.style.width = columnWidths[c.key] + 'px';
    total += columnWidths[c.key];
  });
  table.style.width = total + 'px';
}

function endColResize() {
  colResizeState = null;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  document.removeEventListener('mousemove', onColResize);
  document.removeEventListener('mouseup', endColResize);
  fullRender(); // Re-render to sync everything
}
// ===== Render: Timeline =====
function renderTimeline(units, totalWidth) {
  const container = document.getElementById('ganttTimeline');
  container.innerHTML = '';
  const inner = document.createElement('div');
  inner.className = 'timeline-inner';
  inner.style.cssText = 'width:' + totalWidth + 'px;position:relative;height:100%';

  const groups = {};
  for (const u of units) {
    if (!groups[u.groupKey]) groups[u.groupKey] = { label: u.groupLabel, units: [], width: 0 };
    groups[u.groupKey].units.push(u);
    groups[u.groupKey].width += u.width;
  }

  let left = 0;
  for (const gk of Object.keys(groups)) {
    const g = groups[gk];
    const top = document.createElement('div');
    top.style.cssText = 'position:absolute;top:0;left:' + left + 'px;width:' + g.width + 'px;height:20px;line-height:20px;border-bottom:1px solid #e0e4ea;text-align:center;font-weight:600;font-size:11px;color:#5a6a7a;background:#f0f2f6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;user-select:none;';
    top.textContent = g.label;
    inner.appendChild(top);
    left += g.width;
  }

  left = 0;
  for (const u of units) {
    const bottom = document.createElement('div');
    bottom.style.cssText = 'position:absolute;top:20px;left:' + left + 'px;width:' + u.width + 'px;height:24px;line-height:24px;border-right:1px solid #e8ecf0;text-align:center;font-size:10px;color:#8e9aab;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;user-select:none;';
    bottom.textContent = u.label;
    inner.appendChild(bottom);
    left += u.width;
  }
  container.appendChild(inner);
}

// ===== Render: Today Line =====
function renderTodayLine(range, units, ppd, container) {
  if (!showTodayLine) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (today < range.start || today > addDays(range.end, 1)) return;
  const x = dateToPixel(today, range, units, ppd);

  // Line in rows
  const line = document.createElement('div');
  line.className = 'today-line';
  line.style.left = x + 'px'; line.style.height = '100%';
  container.appendChild(line);

  // Line in timeline
  const timeline = document.getElementById('ganttTimeline');
  const inner = timeline.querySelector('.timeline-inner');
  if (inner) {
    const tl = document.createElement('div');
    tl.style.cssText = 'position:absolute;top:0;left:' + x + 'px;width:2px;height:100%;background:#e74c3c;z-index:5;pointer-events:none;';
    const dot = document.createElement('div');
    dot.style.cssText = 'position:absolute;top:-1px;left:-4px;width:10px;height:10px;background:#e74c3c;border-radius:50%;opacity:0.6;pointer-events:none;';
    tl.appendChild(dot);
    inner.appendChild(tl);
  }
}

// ===== Render: Gantt =====
function renderGantt() {
  const range = getGanttRange();
  const units = generateTimeUnits(range);
  const ppd = getPixelsPerDay(units);
  const totalWidth = units.reduce((s, u) => s + u.width, 0);
  const visibleTasks = getDisplayTasks();
  const rowHeight = 34;

  renderTimeline(units, totalWidth);

  const body = document.getElementById('ganttBody');
  body.innerHTML = '';
  const rc = document.createElement('div');
  rc.id = 'ganttRows'; rc.className = 'gantt-rows';
  const spacerH = 30; // match table sticky thead height
  rc.style.cssText = 'width:' + totalWidth + 'px;height:' + (spacerH + visibleTasks.length * rowHeight) + 'px;position:relative;min-height:100%;';

  // Spacer to align with table's sticky thead
  const spacer = document.createElement('div');
  spacer.className = 'gantt-row-spacer';
  rc.appendChild(spacer);

  for (let i = 0; i < visibleTasks.length; i++) {
    const task = visibleTasks[i];
    const rd = document.createElement('div');
    rd.className = 'gantt-row';
    rd.style.width = totalWidth + 'px';
    rd.dataset.taskId = task.id;

    if (task.start_date && task.end_date) {
      const x1 = dateToPixel(task.start_date, range, units, ppd);
      const x2 = dateToPixel(addDays(task.end_date, 1), range, units, ppd);
      const bw = Math.max(10, x2 - x1);

      const wrap = document.createElement('div');
      wrap.className = 'gantt-bar-wrapper';
      wrap.style.cssText = 'left:' + x1 + 'px;width:' + bw + 'px;';
      wrap.dataset.taskId = task.id;

      // Bar: plan progress (green fill)
      const barColor = hasChildren(task.id) ? '#7BB3E0' : '#4A90D9';
      const planColor = '#5CB85C';
      const planPct = Math.min(100, Math.max(0, task.progress || 0));

      const planFill = document.createElement('div');
      planFill.style.cssText = 'position:absolute;top:0;left:0;height:100%;width:' + planPct + '%;background:' + planColor + ';z-index:1;';
      // Bar text
      const bt = document.createElement('div');
      bt.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;padding:0 8px;font-size:11px;font-weight:500;color:#fff;z-index:2;pointer-events:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      bt.textContent = task.text;

      wrap.style.background = barColor;
      wrap.appendChild(planFill);
      wrap.appendChild(bt);

      const lh = document.createElement('div');
      lh.className = 'gantt-bar-handle left';
      lh.title = '拖动调整开始日期';
      lh.onmousedown = (e) => startDrag('resize-left', task.id, e);
      const rh = document.createElement('div');
      rh.className = 'gantt-bar-handle right';
      rh.title = '拖动调整结束日期';
      rh.onmousedown = (e) => startDrag('resize-right', task.id, e);
      wrap.appendChild(lh);
      wrap.appendChild(rh);
      wrap.onmousedown = (e) => { if (!e.target.closest('.gantt-bar-handle')) startDrag('move', task.id, e); };
      rd.appendChild(wrap);
    }
    rc.appendChild(rd);
  }
  // Vertical grid lines aligned with time units
  let gridX = 0;
  for (const u of units) {
    gridX += u.width;
    const gl = document.createElement("div");
    gl.style.cssText = "position:absolute;top:0;left:" + gridX + "px;width:1px;height:100%;background:var(--border-light);pointer-events:none;z-index:1;";
    rc.appendChild(gl);
  }


  renderTodayLine(range, units, ppd, rc);
  body.appendChild(rc);

  // Scroll sync
  body.onscroll = () => {
    if (!window.syncScrollDest) window.syncScrollDest = {};
    if (!window.syncScrollDest.gantt) {
      window.syncScrollDest.table = true;
      const sc = document.querySelector('.table-scroll');
      if (sc) sc.scrollTop = body.scrollTop;
      window.syncScrollDest.table = false;
    }
    const tl = document.getElementById('ganttTimeline');
    const inn = tl.querySelector('.timeline-inner');
    if (inn) inn.style.transform = 'translateX(' + (-body.scrollLeft) + 'px)';
  };
}

// ===== Dependency Arrows =====
// ===== Drag =====
function startDrag(type, taskId, e) {
  const task = getTaskById(taskId);
  if (!task) return;
  pushUndoState();
  e.preventDefault();
  const range = getGanttRange(), units = generateTimeUnits(range), ppd = getPixelsPerDay(units);
  dragState = { type, taskId, startX: e.clientX, originalStart: new Date(task.start_date), originalEnd: new Date(task.end_date), range, units, ppd };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);
}

function onDrag(e) {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const { type, taskId, originalStart, originalEnd, range, units, ppd } = dragState;
  const task = getTaskById(taskId);
  if (!task) return;

  if (type === 'move') {
    const dd = Math.round(dx / ppd);
    if (dd === 0) return;
    const ns = addDays(originalStart, dd), dur = daysBetween(originalStart, originalEnd);
    task.start_date = ns; task.end_date = addDays(ns, dur); task.duration = dur + 1;
  } else if (type === 'resize-right') {
    const dd = Math.round(dx / ppd);
    if (dd === 0) return;
    const ne = addDays(originalEnd, dd);
    if (ne <= originalStart) return;
    task.end_date = ne; task.duration = Math.max(1, daysBetween(task.start_date, ne) + 1);
  } else if (type === 'resize-left') {
    const dd = Math.round(dx / ppd);
    if (dd === 0) return;
    const ns = addDays(originalStart, dd);
    if (ns >= originalEnd) return;
    task.start_date = ns; task.duration = Math.max(1, daysBetween(ns, originalEnd) + 1);
  }
  renderTable(); renderGantt();
}

function endDrag() {
  if (dragState) { markDirty(); fullRender(); updateStatus('任务时间已更新'); }
  dragState = null;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', endDrag);
}

// ===== Zoom =====
function setZoom(level) {
  zoomLevel = level;
  document.querySelectorAll('.zoom-btn').forEach(b => b.classList.toggle('active', b.dataset.zoom === level));
  const names = { day: '日视图', week: '周视图', month: '月视图' };
  document.getElementById('zoomStatus').textContent = names[level] || level;
  fullRender();
}

function toggleTodayLine() {
  showTodayLine = !showTodayLine;
  const btn = document.getElementById('btnTodayLine');
  if (btn) btn.classList.toggle('active', showTodayLine);
  const names = { true: '今日线: 开', false: '今日线: 关' };
  updateStatus(names[showTodayLine]);
  fullRender();
}

// ===== Panel Resize =====
function initResize() {
  const handle = document.getElementById('resizeHandle');
  const panel = document.getElementById('tablePanel');
  let isResizing = false;

  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    handle.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const w = Math.max(100, e.clientX);
    panel.style.width = w + 'px';
    updateTableWidth();
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      handle.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      fullRender(); // Re-render to fill panel with no gaps
    }
  });
}

// ===== Excel Export =====
async function exportToExcel() {
  if (typeof XLSX === 'undefined') { updateStatus('XLSX 库未加载'); return; }
  if (typeof ExcelJS === 'undefined') { updateStatus('ExcelJS 库未加载'); return; }

  const visibleTasks = getDisplayTasks();

  // --- Workbook using ExcelJS (full style support) ---
  const wb = new ExcelJS.Workbook();
  wb.creator = '横道图 Gantt';
  wb.created = new Date();

  // --- Sheet 1: Task Data ---
  const ws1 = wb.addWorksheet('任务列表');

  const hdrStyle = {
    font: { bold: true, color: { argb: 'FF333333' }, size: 11 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECF0' } },
    border: { bottom: { style: 'thin', color: { argb: 'FFD0D5DD' } } }
  };

  const hRow = ws1.addRow(['任务名称', '开始时间', '结束时间', '工期(天)', '负责人', '计划进度(%)', '实际进度(%)', '父任务ID']);
  hRow.eachCell((cell) => { cell.font = hdrStyle.font; cell.fill = hdrStyle.fill; cell.border = hdrStyle.border; cell.alignment = { vertical: 'middle' }; });

  for (const t of visibleTasks) {
    const row = ws1.addRow([t.text, t.start_date ? fmtDate(t.start_date) : '', t.end_date ? fmtDate(t.end_date) : '', t.duration || 0, t.owner || '', t.progress || 0, t.actual_progress || 0, t.parent || '']);
    row.eachCell((cell) => { cell.alignment = { vertical: 'middle' }; });
  }

  const colW = [20, 12, 12, 10, 10, 12, 12, 12];
  colW.forEach((w, i) => { ws1.getColumn(i + 1).width = w; });
  ws1.views = [{ state: 'frozen', ySplit: 1 }];

  // --- Sheet 2: Gantt Chart (colored cell bars) ---
  const range = getGanttRange();
  const units = generateTimeUnits(range);

  if (units.length === 0) {
    // Fallback: export just the task data sheet
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = '横道图_' + fmtDate(new Date()) + '.xlsx';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    updateStatus('已导出 Excel');
    return;
  }

  function unitEnd(u) {
    if (zoomLevel === 'day') return addDays(u.date, 1);
    if (zoomLevel === 'week') return addDays(u.date, 7);
    return new Date(u.date.getFullYear(), u.date.getMonth() + 1, 1);
  }

  // Group info
  const groupKeys = [];
  const groupMap = {};
  for (const u of units) {
    if (!groupMap[u.groupKey]) {
      groupMap[u.groupKey] = { label: u.groupLabel, count: 0 };
      groupKeys.push(u.groupKey);
    }
    groupMap[u.groupKey].count++;
  }

  const ws2 = wb.addWorksheet('横道图');

  // Row 0: group labels
  const r0v = [''];
  for (const gk of groupKeys) {
    r0v.push(groupMap[gk].label);
    for (let i = 1; i < groupMap[gk].count; i++) r0v.push('');
  }
  const r0 = ws2.addRow(r0v);
  r0.height = 20;
  r0.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: 'FF333333' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8ECF0' } };
  });

  // Row 1: unit labels
  const r1v = ['任务名称'];
  for (const u of units) r1v.push(u.label);
  const r1 = ws2.addRow(r1v);
  r1.height = 18;
  r1.eachCell((cell, col) => {
    cell.font = { size: 8, color: { argb: 'FF666666' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F6F8' } };
    if (col > 1) cell.border = { bottom: { style: 'thin', color: { argb: 'FFD0D5DD' } } };
  });

  // Merge group header cells (exceljs: mergeCells(startRow, startCol, endRow, endCol), all 1-indexed)
  let mi = 2;
  for (const gk of groupKeys) {
    const cnt = groupMap[gk].count;
    if (cnt > 1) ws2.mergeCells(1, mi, 1, mi + cnt - 1);
    mi += cnt;
  }

  // Task rows
  for (const t of visibleTasks) {
    const indent = '  '.repeat(getTaskDepth(t.id));
    const rv = [indent + t.text];
    for (const u of units) {
      const ts = t.start_date, te = t.end_date;
      rv.push(ts && te && ts < unitEnd(u) && te >= u.date ? ' ' : '');
    }
    const row = ws2.addRow(rv);
    row.height = 18;

    const nc = row.getCell(1);
    const parent = hasChildren(t.id);
    nc.font = { size: 9, bold: parent, color: { argb: parent ? 'FF333333' : 'FF555555' } };
    nc.alignment = { vertical: 'middle' };

    const barColor = parent ? 'FFA8C8E8' : 'FF4472C4';
    for (let j = 0; j < units.length; j++) {
      const cell = row.getCell(2 + j);
      if (rv[1 + j] === ' ') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: barColor } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }
  }

  // Today marker row
  if (showTodayLine) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tv = ['今天'];
    let tCol = -1;
    for (const u of units) {
      const ue = unitEnd(u);
      if (today >= u.date && today < ue) { tv.push('▼'); tCol = tv.length - 1; }
      else tv.push('');
    }
    const tr = ws2.addRow(tv);
    tr.height = 18;
    const tnc = tr.getCell(1);
    tnc.font = { bold: true, color: { argb: 'FFE74C3C' }, size: 9 };
    tnc.alignment = { vertical: 'middle' };
    if (tCol > 0) {
      const mc = tr.getCell(1 + tCol);
      mc.font = { bold: true, color: { argb: 'FFE74C3C' }, size: 10 };
      mc.alignment = { horizontal: 'center', vertical: 'middle' };
      mc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } };
    }
  }

  // Column widths
  ws2.getColumn(1).width = 22;
  for (let i = 0; i < units.length; i++) {
    ws2.getColumn(2 + i).width = zoomLevel === 'day' ? 4 : zoomLevel === 'week' ? 8 : 10;
  }

  // Freeze panes (first col + first 2 rows)
  ws2.views = [{ state: 'frozen', xSplit: 1, ySplit: 2, activePane: 'bottomRight' }];

  // --- Export ---
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = '横道图_' + fmtDate(new Date()) + '.xlsx';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  updateStatus('已导出 Excel (含甘特图)');
}

// ===== PDF Export =====
async function exportToPdf() {
  if (!window.electronAPI || !window.electronAPI.exportPdf) { updateStatus('PDF 导出不可用'); return; }
  const visibleTasks = getDisplayTasks();
  if (!visibleTasks.length) { updateStatus('没有任务可供导出'); return; }
  updateStatus('正在生成 PDF...');
  const range = getGanttRange();
  const units = generateTimeUnits(range);
  const ppd = getPixelsPerDay(units);
  const totalWidth = units.reduce((s, u) => s + u.width, 0);
  const rowHeight = 30, timelineH = 44;
  // Group units for timeline
  const groups = {};
  for (const u of units) {
    if (!groups[u.groupKey]) groups[u.groupKey] = { label: u.groupLabel, units: [], width: 0 };
    groups[u.groupKey].units.push(u);
    groups[u.groupKey].width += u.width;
  }
  let groupHTML = '', unitHTML = '', gridHTML = '', left = 0;
  for (const gk of Object.keys(groups)) {
    const g = groups[gk];
    groupHTML += `<div style="position:absolute;top:0;left:${left}px;width:${g.width}px;height:22px;line-height:22px;border-bottom:1px solid #d0d5dd;border-right:1px solid #e0e4ea;text-align:center;font-weight:600;font-size:11px;color:#333;background:#e8ecf0;overflow:hidden;box-sizing:border-box;">${escHtml(g.label)}</div>`;
    left += g.width;
  }
  left = 0;
  for (const u of units) {
    unitHTML += `<div style="position:absolute;top:22px;left:${left}px;width:${u.width}px;height:22px;line-height:22px;border-right:1px solid #e0e4ea;text-align:center;font-size:9px;color:#666;overflow:hidden;box-sizing:border-box;">${escHtml(u.label)}</div>`;
    left += u.width;
  }
  let gx = 0;
  for (const u of units) { gx += u.width; gridHTML += `<div style="position:absolute;top:0;left:${gx}px;width:0;height:100%;border-left:1px solid #e8ecf0;pointer-events:none;z-index:1;"></div>`; }
  // Task bars with zebra rows
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let barsHTML = '';
  for (let i = 0; i < visibleTasks.length; i++) {
    const task = visibleTasks[i];
    const y = timelineH + i * rowHeight;
    const bg = i % 2 === 0 ? '#fff' : '#fafbfc';
    barsHTML += `<div style="position:absolute;top:${y}px;left:0;width:${totalWidth}px;height:${rowHeight}px;background:${bg};z-index:0;"></div>`;
    if (task.start_date && task.end_date) {
      const x1 = dateToPixel(task.start_date, range, units, ppd);
      const x2 = dateToPixel(addDays(task.end_date, 1), range, units, ppd);
      const bw = Math.max(10, x2 - x1);
      const barColor = hasChildren(task.id) ? '#7BB3E0' : '#4A90D9';
      const planPct = Math.min(100, Math.max(0, task.progress || 0));
      barsHTML += `<div style="position:absolute;top:${y + 5}px;left:${x1}px;width:${bw}px;height:${rowHeight - 10}px;background:${barColor};border-radius:3px;overflow:hidden;z-index:2;"><div style="position:absolute;top:0;left:0;height:100%;width:${planPct}%;background:#5CB85C;"></div><div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;padding:0 6px;font-size:10px;font-weight:500;color:#fff;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;z-index:3;">${escHtml(task.text)}</div></div>`;
    }
  }
  // Today line
  let todayLineHTML = '';
  if (showTodayLine && today >= range.start && today <= addDays(range.end, 1)) {
    const tx = dateToPixel(today, range, units, ppd);
    todayLineHTML = `<div style="position:absolute;top:0;left:${tx}px;width:2px;height:100%;background:#e74c3c;z-index:5;pointer-events:none;"></div>`;
  }
  const ganttHeight = timelineH + visibleTasks.length * rowHeight + 10;
  // Task table HTML
  let tableRows = '';
  for (const task of visibleTasks) {
    const indent = '&nbsp;'.repeat(getTaskDepth(task.id) * 4);
    const parent = hasChildren(task.id);
    tableRows += `<tr${parent ? ' style="background:#f8f9fa;"' : ''}>
      <td style="padding:3px 8px;font-size:11px;border-bottom:1px solid #eee;${parent ? 'font-weight:600;' : ''}text-align:left;">${indent}${escHtml(task.text)}</td>
      <td style="padding:3px 8px;font-size:11px;border-bottom:1px solid #eee;text-align:center;">${task.start_date ? fmtDate(task.start_date) : ''}</td>
      <td style="padding:3px 8px;font-size:11px;border-bottom:1px solid #eee;text-align:center;">${task.end_date ? fmtDate(task.end_date) : ''}</td>
      <td style="padding:3px 8px;font-size:11px;border-bottom:1px solid #eee;text-align:center;">${task.duration || 0}</td>
      <td style="padding:3px 8px;font-size:11px;border-bottom:1px solid #eee;text-align:center;">${escHtml(task.owner || '')}</td>
      <td style="padding:3px 8px;font-size:11px;border-bottom:1px solid #eee;text-align:center;">${task.progress || 0}%</td>
    </tr>`;
  }
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8">
<style>
  @page{size:A4 landscape;margin:12mm;}
  body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;margin:0;padding:0;color:#333;}
  h2{font-size:16px;margin:0 0 8px 0;padding:0;}
  table{width:100%;border-collapse:collapse;}
  th{background:#e8ecf0;padding:4px 8px;font-size:11px;font-weight:600;text-align:center;border-bottom:2px solid #d0d5dd;}
  .page-break{page-break-before:always;}
  .gantt-wrap{position:relative;}
</style></head>
<body>
<div style="margin-bottom:20px;">
  <h2>任务列表</h2>
  <table><thead><tr>
    <th style="text-align:left;">任务名称</th>
    <th style="width:80px;">开始</th><th style="width:80px;">结束</th>
    <th style="width:50px;">工期</th><th style="width:60px;">负责人</th>
    <th style="width:70px;">进度</th>
  </tr></thead><tbody>${tableRows}</tbody></table>
</div>
<div class="page-break">
  <h2>横道图</h2>
  <div class="gantt-wrap" style="width:${totalWidth}px;height:${ganttHeight}px;">
    ${groupHTML}${unitHTML}${gridHTML}${barsHTML}${todayLineHTML}
  </div>
</div>
</body></html>`;
  try {
    const result = await window.electronAPI.exportPdf(html);
    if (result.success) { updateStatus('PDF 已导出: ' + getFileName(result.filePath)); }
    else if (!result.canceled) { updateStatus('PDF 导出失败: ' + (result.error || '未知错误')); }
  } catch (err) { updateStatus('PDF 导出失败: ' + err.message); }
}

// ===== Excel Import =====
function importFromExcel(file) {
  if (typeof XLSX === 'undefined') { updateStatus('XLSX 库未加载'); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (json.length < 2) { updateStatus('Excel 文件格式不正确'); return; }
      const h = json[0];
      const ni = h.indexOf('任务名称'), si = h.indexOf('开始时间'), ei = h.indexOf('结束时间');
      const di = h.indexOf('工期(天)'), oi = h.indexOf('负责人'), pi = h.indexOf('计划进度(%)'), ai = h.indexOf('实际进度(%)'), pri = h.indexOf('父任务ID');
      if (ni === -1 || si === -1 || ei === -1) { updateStatus('Excel 缺少必要列'); return; }
      pushUndoState();
      tasks = []; nextId = 1;
      for (let i = 1; i < json.length; i++) {
        const row = json[i];
        if (!row || !row[ni]) continue;
        let sd = parseExcelDate(String(row[si] || '').trim()), ed = parseExcelDate(String(row[ei] || '').trim());
        if (!sd) sd = new Date(); if (!ed) ed = addDays(sd, 5);
        tasks.push({ id: nextId++, text: String(row[ni]).trim(), start_date: sd, end_date: ed, duration: (di !== -1 ? parseInt(row[di]) || 0 : 0) || Math.max(1, daysBetween(sd, ed) + 1), owner: oi !== -1 ? String(row[oi] || '') : '', progress: Math.min(100, Math.max(0, pi !== -1 ? parseFloat(row[pi]) || 0 : 0)), actual_progress: Math.min(100, Math.max(0, ai !== -1 ? parseFloat(row[ai]) || 0 : 0)), parent: null, sortorder: i, open: true });
      }
      if (pri !== -1) {
        for (let i = 1; i < json.length; i++) {
          const row = json[i]; if (!row || !row[ni]) continue;
          const p = row[pri] != null ? String(row[pri]).trim() : '';
          if (p) { const t = tasks.find(x => x.text === String(row[ni]).trim()); const par = tasks.find(x => x.text === p || String(x.id) === p); if (t && par) t.parent = par.id; }
        }
      }
      tasks.forEach((t, idx) => t.sortorder = idx + 1);
      selectedTaskId = null; markDirty(); fullRender();
      updateStatus('导入成功！共 ' + tasks.length + ' 条任务');
    } catch (err) { updateStatus('导入失败：' + err.message); }
  };
  reader.readAsArrayBuffer(file);
}

function parseExcelDate(value) {
  if (typeof value === 'number') { const ee = new Date(1899, 11, 30); return new Date(ee.getTime() + value * DAY_MS); }
  const s = String(value).trim();
  const m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const m2 = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);
  const d = new Date(s); if (!isNaN(d.getTime())) return d;
  return null;
}

// ===== Full Render =====
function fullRender() {
  // Save scroll positions before DOM rebuild
  const scrollEl = document.querySelector('.table-scroll');
  const ganttBody = document.getElementById('ganttBody');
  const savedTableScroll = scrollEl ? scrollEl.scrollTop : 0;
  const savedGanttScroll = ganttBody ? ganttBody.scrollTop : 0;
  const savedGanttScrollLeft = ganttBody ? ganttBody.scrollLeft : 0;

  renderTableStructure();
  renderTable();
  renderGantt();
  syncColumnWidths();

  // Restore scroll positions after re-render
  const newScroll = document.querySelector('.table-scroll');
  const newGantt = document.getElementById('ganttBody');
  if (newScroll) newScroll.scrollTop = savedTableScroll;
  if (newGantt) { newGantt.scrollTop = savedGanttScroll; newGantt.scrollLeft = savedGanttScrollLeft; }

  const count = document.getElementById('taskCount');
  if (count) count.textContent = tasks.length + ' 项';
  // Update date in status bar
  const ds = document.getElementById('dateStatus');
  if (ds) ds.textContent = fmtDateCN(new Date());
  // Update zoom status
  const names = { day: '日视图', week: '周视图', month: '月视图' };
  const zs = document.getElementById('zoomStatus');
  const vs = document.getElementById("versionStatus");
  if (vs) vs.textContent = "v" + APP_VERSION;
  if (zs) zs.textContent = names[zoomLevel] || zoomLevel;
  // Sync today line toggle button state
  const tlBtn = document.getElementById('btnTodayLine');
  if (tlBtn) tlBtn.classList.toggle('active', showTodayLine);
}

function updateStatus(msg) {
  const el = document.getElementById('taskStatus');
  if (el) { el.textContent = msg; setTimeout(() => { if (el.textContent === msg) el.textContent = '准备就绪'; }, 3000); }
}

// ===== About Modal =====
function showAboutModal() {
  const modal = document.getElementById('aboutModal');
  const ver = document.getElementById('aboutVersion');
  if (ver) ver.textContent = 'v' + APP_VERSION;
  if (modal) modal.style.display = 'flex';
}
function hideAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (modal) modal.style.display = 'none';
}
// Bind about modal events on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.getElementById('aboutModalClose');
  const okBtn = document.getElementById('aboutModalOk');
  const modal = document.getElementById('aboutModal');
  if (closeBtn) closeBtn.onclick = hideAboutModal;
  if (okBtn) okBtn.onclick = hideAboutModal;
  if (modal) modal.onclick = (e) => { if (e.target === modal) hideAboutModal(); };
});

// ===== Electron Integration =====
function initElectronAPI() {
  if (!window.electronAPI) return;
  // File
  window.electronAPI.onMenuNew(() => newProject());
  window.electronAPI.onMenuOpen(() => openProjectFile());
  window.electronAPI.onMenuSave(() => saveCurrentFile());
  window.electronAPI.onMenuSaveAs(() => saveCurrentFileAs());
  window.electronAPI.onMenuOpenFile((filePath) => openProjectFile(filePath));
  // Existing
  window.electronAPI.onMenuImport(() => document.getElementById('fileInput').click());
  window.electronAPI.onMenuExport(() => exportToExcel());
  window.electronAPI.onMenuExportPdf(() => exportToPdf());
  window.electronAPI.onMenuAddTask(() => addTask(selectedTaskId));
  window.electronAPI.onMenuAddChild(() => { if (selectedTaskId) addTask(selectedTaskId); else updateStatus('请先选择父任务'); });
  window.electronAPI.onMenuDelete(() => { if (selectedTaskId) { const t = getTaskById(selectedTaskId); if (t && confirm('确定删除"' + t.text + '"及其子任务？')) deleteTask(selectedTaskId); } else updateStatus('请先选择任务'); });
  window.electronAPI.onMenuZoom((level) => setZoom(level));
  window.electronAPI.onMenuExpand(() => { pushUndoState(); tasks.forEach(t => t.open = true); markDirty(); fullRender(); });
  window.electronAPI.onMenuCollapse(() => { pushUndoState(); tasks.forEach(t => t.open = false); markDirty(); fullRender(); });
  window.electronAPI.onMenuUndo(() => undo());
  window.electronAPI.onMenuRedo(() => redo());
  window.electronAPI.onMenuAbout(() => showAboutModal());
}

// ===== Menu Bar =====
function initMenubar() {
  const menubar = document.getElementById('menubar');
  if (!menubar) return;

  const actionMap = {
    'new': () => { newProject(); closeAllMenus(); },
    'open': () => { openProjectFile(); closeAllMenus(); },
    'save': () => { saveCurrentFile(); closeAllMenus(); },
    'save-as': () => { saveCurrentFileAs(); closeAllMenus(); },
    'import': () => { document.getElementById('fileInput').click(); closeAllMenus(); },
    'export': () => { exportToExcel(); closeAllMenus(); },
    'export-pdf': () => { exportToPdf(); closeAllMenus(); },
    'add-task': () => { addTask(selectedTaskId); closeAllMenus(); },
    'add-child': () => { if (selectedTaskId) addTask(selectedTaskId); else updateStatus('请先选择父任务'); closeAllMenus(); },
    'delete': () => {
      if (selectedTaskId) { const t = getTaskById(selectedTaskId); if (t && confirm('确定删除"' + t.text + '"及其子任务？')) deleteTask(selectedTaskId); }
      else updateStatus('请先选择任务');
      closeAllMenus();
    },
    'undo': () => { undo(); closeAllMenus(); },
    'redo': () => { redo(); closeAllMenus(); },
    'expand-all': () => { pushUndoState(); tasks.forEach(t => t.open = true); markDirty(); fullRender(); closeAllMenus(); },
    'collapse-all': () => { pushUndoState(); tasks.forEach(t => t.open = false); markDirty(); fullRender(); closeAllMenus(); },
    'zoom-day': () => { setZoom('day'); closeAllMenus(); },
    'zoom-week': () => { setZoom('week'); closeAllMenus(); },
    'zoom-month': () => { setZoom('month'); closeAllMenus(); },
    'about': () => { showAboutModal(); closeAllMenus(); },
    'toggle-today-line': () => { toggleTodayLine(); closeAllMenus(); },
  };

  function closeAllMenus() {
    menubar.querySelectorAll('.menu-item.open').forEach(el => el.classList.remove('open'));
  }

  // Toggle dropdown on menu title click
  menubar.addEventListener('click', (e) => {
    const title = e.target.closest('.menu-title');
    if (!title) return;
    e.stopPropagation();
    const item = title.closest('.menu-item');
    if (!item) return;
    const isOpen = item.classList.contains('open');
    closeAllMenus();
    if (!isOpen) item.classList.add('open');
  });

  // Handle option clicks
  menubar.addEventListener('click', (e) => {
    const option = e.target.closest('.menu-option');
    if (!option) return;
    e.stopPropagation();
    const action = option.dataset.action;
    if (action && actionMap[action]) actionMap[action]();
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menubar')) closeAllMenus();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllMenus();
  });
}

// ===== Context Menu =====
let ctxTargetId = null;

function showCtxMenu(e, taskId) {
  e.preventDefault();
  ctxTargetId = taskId;
  selectedTaskId = taskId;
  const menu = document.getElementById('ctxMenu');
  menu.style.display = 'block';
  menu.style.left = Math.min(e.clientX, window.innerWidth - menu.offsetWidth) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight - menu.offsetHeight) + 'px';
}

function hideCtxMenu() {
  document.getElementById('ctxMenu').style.display = 'none';
  ctxTargetId = null;
}

function initCtxMenu() {
  document.addEventListener('contextmenu', (e) => {
    const tr = e.target.closest('#taskTable tbody tr');
    const ganttRow = e.target.closest('.gantt-row');
    if (tr) {
      showCtxMenu(e, +tr.dataset.taskId);
    } else if (ganttRow) {
      showCtxMenu(e, +ganttRow.dataset.taskId);
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ctx-menu')) hideCtxMenu();
  });
  document.querySelectorAll('.ctx-option').forEach(el => {
    el.onclick = () => {
      const action = el.dataset.action;
      if (action === 'add-task') addTask(selectedTaskId);
      else if (action === 'add-child') { if (selectedTaskId) addTask(selectedTaskId); else updateStatus('请先选择父任务'); }
      else if (action === 'delete') { if (selectedTaskId) { const t = getTaskById(selectedTaskId); if (t && confirm('确定删除"' + t.text + '"及其子任务？')) deleteTask(selectedTaskId); } else updateStatus('请先选择任务'); }
      hideCtxMenu();
    };
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideCtxMenu(); });
}

// ===== Init =====
function init() {
  initSampleData();
  recalcParentProgress();
  fullRender();
  updateTitle();
  initResize();
  initMenubar();
  initCtxMenu();
  initElectronAPI();

  // Toolbar buttons
  document.getElementById('btnAddTask').onclick = () => addTask(selectedTaskId);
  document.getElementById('btnAddChild').onclick = () => { if (selectedTaskId) addTask(selectedTaskId); else updateStatus('请先选择父任务'); };
  document.getElementById('btnDelete').onclick = () => { if (selectedTaskId) { const t = getTaskById(selectedTaskId); if (t && confirm('确定删除"' + t.text + '"及其子任务？')) deleteTask(selectedTaskId); } else updateStatus('请先选择任务'); };
  document.getElementById('btnExpandAll').onclick = () => { pushUndoState(); tasks.forEach(t => t.open = true); markDirty(); fullRender(); };
  document.getElementById('btnCollapseAll').onclick = () => { pushUndoState(); tasks.forEach(t => t.open = false); markDirty(); fullRender(); };
  document.getElementById('btnExport').onclick = exportToExcel;
  document.getElementById('btnExportPdf').onclick = exportToPdf;
  document.getElementById('btnImport').onclick = () => document.getElementById('fileInput').click();
  document.getElementById('btnTodayLine').onclick = toggleTodayLine;
  document.getElementById('fileInput').onchange = (e) => { if (e.target.files.length) { importFromExcel(e.target.files[0]); e.target.value = ''; } };

  // Zoom buttons
  document.querySelectorAll('.zoom-btn').forEach(b => { b.onclick = () => setZoom(b.dataset.zoom); });

  // Scroll sync between table and gantt
  window.syncScrollDest = {};
  const scrollEl = document.querySelector('.table-scroll');
  if (scrollEl) {
    scrollEl.onscroll = () => {
      if (window.syncScrollDest.table) return;
      window.syncScrollDest.gantt = true;
      const gb = document.getElementById('ganttBody');
      if (gb) gb.scrollTop = scrollEl.scrollTop;
      window.syncScrollDest.gantt = false;
    };
  }

  // Focus-in on table body: select row when any input gets focus
  document.getElementById('taskTableBody').addEventListener('focusin', (e) => {
    if (e.target.tagName !== 'INPUT') return;
    const row = e.target.closest('tr');
    if (!row) return;
    const id = +row.dataset.taskId;
    if (id !== selectedTaskId) {
      selectedTaskId = id;
      document.querySelectorAll('#taskTable tbody tr.selected').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
    }
  });

  // Keyboard shortcuts for undo/redo
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); redo(); }
  });

  updateStatus('准备就绪 — 横道图 v1.0');
}

// ===== Boot =====
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
