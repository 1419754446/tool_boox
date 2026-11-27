// ---- 第 5/8 块：本块起始于 function handleDupDone(payload) { ----
function handleDupDone(payload) {
  const dup = state.dup;
  dup.running = false;
  dup.groups = Array.isArray(payload.groups) ? payload.groups : [];
  dup.stats = payload.stats || null;
  dup.candidateFiles = payload.candidateFiles || 0;
  dup.duplicateBytes = payload.duplicateBytes || 0;
  dup.truncated = Boolean(payload.truncated);
  dup.elapsedMs = payload.elapsedMs || 0;
  dup.cancelled = Boolean(payload.cancelled);
  dup.error = payload.error || '';
  dup.selected.clear();
  if (!dup.error && !dup.cancelled) {
    dup.groups.forEach((group) => {
      group.files.slice(1).forEach((file) => dup.selected.add(file.path));
    });
  }
  if (state.view === 'tool' && state.toolId === 'duplicates') refreshDupPage();
  if (dup.error) toast(dup.error, 'error');
  else if (dup.cancelled) toast('查找已取消');
  else toast(`找到 ${formatNumber(dup.groups.length)} 组重复文件，可释放 ${formatBytes(dup.duplicateBytes)}`, 'success');
}

function handleSpaceDone(payload) {
  const space = state.space;
  space.running = false;
  space.root = payload.root || space.root;
  space.entries = Array.isArray(payload.entries) ? payload.entries : [];
  space.total = payload.total || 0;
  space.stats = payload.stats || null;
  space.elapsedMs = payload.elapsedMs || 0;
  space.cancelled = Boolean(payload.cancelled);
  space.error = payload.error || '';
  if (state.view === 'tool' && state.toolId === 'space-analyzer') refreshSpacePage();
  if (space.error) toast(space.error, 'error');
}

function handleHashDone(payload) {
  const hash = state.hash;
  hash.running = false;
  hash.items = Array.isArray(payload.items) ? payload.items : [];
  hash.stats = payload.stats || null;
  hash.truncated = Boolean(payload.truncated);
  hash.elapsedMs = payload.elapsedMs || 0;
  hash.cancelled = Boolean(payload.cancelled);
  hash.error = payload.error || '';
  if (state.view === 'tool' && state.toolId === 'hash-check') refreshHashPage();
  if (hash.error) toast(hash.error, 'error');
  else if (hash.cancelled) toast('哈希计算已取消');
  else toast(`已计算 ${formatNumber(hash.items.length)} 个文件的 SHA-256`, 'success');
}

function handleTempDone(payload) {
  const temp = state.temp;
  temp.running = false;
  temp.categories = Array.isArray(payload.categories) ? payload.categories : [];
  temp.entries = Array.isArray(payload.entries) ? payload.entries : [];
  temp.total = payload.total || 0;
  temp.stats = payload.stats || null;
  temp.truncated = Boolean(payload.truncated);
  temp.elapsedMs = payload.elapsedMs || 0;
  temp.cancelled = Boolean(payload.cancelled);
  temp.error = payload.error || '';
  temp.selected.clear();
  if (state.view === 'tool' && state.toolId === 'temp-cleaner') refreshTempPage();
  if (temp.error) toast(temp.error, 'error');
  else if (temp.cancelled) toast('扫描已取消');
  else toast(`找到 ${formatBytes(temp.total)} 可清理内容`, 'success');
}

function handleFolderList(payload) {
  state.rename.files = Array.isArray(payload.files) ? payload.files : [];
  state.rename.loading = false;
  state.rename.error = payload.error || '';
  if (state.rename.error) toast(state.rename.error, 'error');
  if (state.view === 'tool' && state.toolId === 'batch-rename') {
    render();
  } else {
    state.rename.preview = computeRenamePreview().preview;
  }
}

function handleRenameDone(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const applied = items.filter((item) => item.ok);
  const failed = items.filter((item) => !item.ok);

  if (state.rename.pendingUndo) {
    state.rename.pendingUndo = false;
    if (applied.length) {
      state.rename.lastApplied = null;
      toast(`已撤销 ${applied.length} 个文件的重命名`, 'success');
    } else {
      toast(failed[0]?.error || '撤销失败', 'error');
    }
  } else if (applied.length) {
    state.rename.lastApplied = applied.map((item) => ({
      oldPath: item.newPath,
      newPath: item.oldPath,
    }));
    toast(`已重命名 ${applied.length} 个文件${failed.length ? `，${failed.length} 个失败` : ''}`,
      failed.length ? 'info' : 'success');
  } else if (failed.length) {
    toast(failed[0].error || '重命名失败', 'error');
  }

  if (state.view === 'tool' && state.toolId === 'batch-rename' && state.rename.root) {
    requestListFolder();
  }
}

function handleUnlockDone(payload) {
  const unlock = state.unlock;
  unlock.running = false;
  unlock.checked = true;
  unlock.processes = Array.isArray(payload.processes) ? payload.processes : [];
  unlock.error = payload.error || '';
  if (state.view === 'tool' && state.toolId === 'file-unlock') refreshUnlockPage();
  if (unlock.error) toast(unlock.error, 'error');
  else if (!unlock.processes.length) toast('没有发现占用进程');
  else toast(`发现 ${unlock.processes.length} 个占用进程`, 'success');
}

function handleKillDone(payload) {
  // U盘弹出工具：结束占用进程后自动重新检测，方便立即再弹
  if (state.view === 'tool' && state.toolId === 'usb-eject') {
    if (payload.ok) {
      toast('占用进程已结束，正在重新检测…', 'success');
      usbCheckLockers();
    } else {
      toast(payload.error || '结束进程失败', 'error');
    }
    return;
  }
  if (payload.ok) {
    toast('进程已结束，正在重新检查…', 'success');
    if (state.view === 'tool' && state.toolId === 'file-unlock') startUnlockCheck();
  } else {
    toast(payload.error || '结束进程失败', 'error');
    if (state.view === 'tool' && state.toolId === 'file-unlock') refreshUnlockPage();
  }
}

function updateAppInfoUI() {
  const version = $('#about-version');
  const navVersion = document.querySelector('.nav-version');
  const webview = $('#about-webview');
  const dataDir = $('#about-datadir');
  if (version) version.textContent = `v${state.appInfo.version}`;
  // 侧栏版本不再写死在 index.html，原生上报什么就显示什么，
  // 这样 version.txt 升级后不会出现"侧栏还是旧版本"的错位。
  if (navVersion) navVersion.textContent = `v${state.appInfo.version}`;
  if (webview) {
    webview.textContent = state.appInfo.webview;
    webview.title = state.appInfo.webview;
  }
  if (dataDir) {
    dataDir.textContent = state.appInfo.dataDir;
    dataDir.title = state.appInfo.dataDir;
  }
  const taskbar = $('#set-taskbar');
  if (taskbar) taskbar.checked = state.appInfo.taskbar !== false;
}

function syncScanChecks() {
  const scan = state.scan;
  const selectAll = $('#select-all');
  if (selectAll) {
    const rows = sortedScanRows();
    const selected = rows.filter(({ item }) => scan.selected.has(item.path)).length;
    selectAll.checked = rows.length > 0 && selected === rows.length;
    selectAll.indeterminate = selected > 0 && selected < rows.length;
  }
  const emptyAll = $('#empty-select-all');
  if (emptyAll) {
    const selected = state.empty.selected.size;
    emptyAll.checked = state.empty.folders.length > 0 && selected === state.empty.folders.length;
    emptyAll.indeterminate = selected > 0 && selected < state.empty.folders.length;
  }
}

function navigateHome(category = 'all') {
  state.view = 'home';
  state.toolId = null;
  state.category = category;
  state.query = '';
  searchInput.value = '';
  render();
  viewEl.scrollTop = 0;
}

function openTool(id) {
  const tool = toolById(id);
  if (!tool) return;
  if (state.mini && state.launcher) {
    post({ type: 'miniOpen', payload: { tool: id } });
    return;
  }
  state.view = tool.status === 'ready' ? 'tool' : 'soon';
  state.toolId = id;
  pushRecent(id);
  render();
  viewEl.scrollTop = 0;
  if (id === 'clipboard-history' && !state.clip.paused) post({ type: 'getClipboard' });
  if (id === 'usb-eject') usbRefresh();
  if (id === 'screenshot') refreshShots();
  if (id === 'folders') loadFolders();
}

function pickFolder(target) {
  state.pickerTarget = target;
  state.pickerRequest = uid();
  post({ type: 'pickFolder', requestId: state.pickerRequest });
}

function clearRunningStates() {
  state.scan.running = false;
  state.empty.running = false;
  state.dup.running = false;
  state.space.running = false;
  state.hash.running = false;
  state.temp.running = false;
  state.unlock.running = false;
  state.fdiff.running = false;
  state.fdiff.copying = false;
  state.search.running = false;
  state.organizer.running = false;
  state.organizer.waitingDup = false;
  state.organizer.undoing = false;
  state.organizer.previewing = false;
  state.organizer.previewItems = [];
  state.organizer.previewPayload = null;
  state.organizer.undoSkip = [];
  state.organizer.pendingUndoFrom = null;
  state.rename.loading = false;
  state.usb.checking = false;
  state.usb.ejecting = false;
  state.screenshot.running = false;
  state.screenshot.cropping = null;
}

function startLargeScan() {
  if (state.scan.running) return;
  clearRunningStates();
  const allDrives = driveScope().allDrives;
  const path = $('#scan-path')?.value?.trim() || state.scan.root;
  const rootsPayload = scanRootsPayload();
  if (!rootsPayload) {
    toast('「全盘扫描」至少勾一块磁盘，或者把开关关掉改选文件夹', 'error');
    return;
  }
  if (!allDrives && !path) {
    toast('请先选择一个文件夹', 'error');
    return;
  }
  if (!allDrives) state.scan.root = path;
  const scanSize = readSizeField('scan-min-size', state.scan.minUnit);
  if (!scanSize.empty) {
    state.scan.minUnit = scanSize.unit;
    state.scan.minSize = scanSize.bytes;
  }
  state.scan.includeHidden = Boolean($('#include-hidden')?.checked);
  state.scan.running = true;
  state.scan.items = [];
  state.scan.stats = null;
  state.scan.error = '';
  state.scan.cancelled = false;
  state.scan.selected.clear();
  render();
  post({
    type: 'scanLarge',
    payload: {
      ...rootsPayload,
      root: allDrives ? '' : path,
      minSizeBytes: state.scan.minSize,
      includeHidden: state.scan.includeHidden,
    },
  });
}

function startEmptyScan() {
  if (state.empty.running) return;
  clearRunningStates();
  const allDrives = driveScope().allDrives;
  const path = $('#empty-path')?.value?.trim() || state.empty.root;
  const rootsPayload = scanRootsPayload();
  if (!rootsPayload) {
    toast('「全盘扫描」至少勾一块磁盘，或者把开关关掉改选文件夹', 'error');
    return;
  }
  if (!allDrives && !path) {
    toast('请先选择一个文件夹', 'error');
    return;
  }
  if (!allDrives) state.empty.root = path;
  state.empty.running = true;
  state.empty.folders = [];
  state.empty.stats = null;
  state.empty.error = '';
  state.empty.cancelled = false;
  state.empty.selected.clear();
  render();
  post({ type: 'scanEmpty', payload: { ...rootsPayload, root: allDrives ? '' : path } });
}

function pickFile(target) {
  state.pickerTarget = target;
  state.pickerRequest = uid();
  post({ type: 'pickFile', requestId: state.pickerRequest, payload: { target } });
}

function startDupScan() {
  if (state.dup.running) return;
  clearRunningStates();
  const allDrives = driveScope().allDrives;
  const path = $('#dup-path')?.value?.trim() || state.dup.root;
  const rootsPayload = scanRootsPayload();
  if (!rootsPayload) {
    toast('「全盘扫描」至少勾一块磁盘，或者把开关关掉改选文件夹', 'error');
    return;
  }
  if (!allDrives && !path) {
    toast('请先选择一个文件夹', 'error');
    return;
  }
  if (!allDrives) state.dup.root = path;
  const dupSize = readSizeField('dup-min-size', state.dup.minUnit);
  if (!dupSize.empty) {
    state.dup.minUnit = dupSize.unit;
    state.dup.minSize = dupSize.bytes;
  }
  state.dup.source = 'manual';
  state.dup.running = true;
  state.dup.groups = [];
  state.dup.stats = null;
  state.dup.error = '';
  state.dup.cancelled = false;
  state.dup.selected.clear();
  render();
  post({
    type: 'scanDuplicates',
    payload: { ...rootsPayload, root: allDrives ? '' : path, minSizeBytes: state.dup.minSize },
  });
}

function refreshDupPage() {
  const status = $('#dup-status');
  const results = $('#dup-results');
  if (status) status.innerHTML = renderDupStatus();
  if (results) results.innerHTML = renderDupResults();
  syncToolbarState();
}

function startSpaceScan() {
  if (state.space.running) return;
  clearRunningStates();
  const path = state.space.root || $('#space-path')?.value?.trim();
  if (!path) {
    toast('请先选择一个文件夹', 'error');
    return;
  }
  state.space.root = path;
  state.space.running = true;
  state.space.entries = [];
  state.space.stats = null;
  state.space.error = '';
  state.space.cancelled = false;
  render();
  post({ type: 'analyzeSpace', payload: { root: path } });
}

function refreshSpacePage() {
  const status = $('#space-status');
  const results = $('#space-results');
  if (status) status.innerHTML = renderSpaceStatus();
  if (results) results.innerHTML = renderSpaceResults();
  syncToolbarState();
}

function requestListFolder() {
  if (!state.rename.root) {
    toast('请先选择一个文件夹', 'error');
    return;
  }
  clearRunningStates();
  state.rename.loading = true;
  state.rename.error = '';
  const preview = $('#rename-preview');
  if (preview) preview.innerHTML = renderSkeleton(5);
  post({ type: 'listFolder', payload: { root: state.rename.root } });
}

function applyRenameNow() {
  const result = computeRenamePreview();
  if (result.error) {
    toast(result.error, 'error');
    return;
  }
  const items = result.preview.filter((item) => item.ok);
  if (!items.length) {
    toast('没有需要重命名的文件', 'error');
    return;
  }
  if (result.preview.some((item) => item.conflict)) {
    toast('存在名称冲突，请先调整规则', 'error');
    return;
  }
  clearRunningStates();
  state.rename.pendingUndo = false;
  post({
    type: 'renameApply',
    payload: { items: items.map((item) => ({ oldPath: item.oldPath, newPath: item.newPath })) },
  });
  toast(`正在重命名 ${items.length} 个文件…`);
}

function undoRename() {
  if (!state.rename.lastApplied?.length) return;
  clearRunningStates();
  state.rename.pendingUndo = true;
  post({
    type: 'renameApply',
    payload: { items: state.rename.lastApplied },
  });
  toast('正在撤销上一次重命名…');
}

function startHashScan() {
  if (state.hash.running) return;
  clearRunningStates();
  const path = $('#hash-path')?.value?.trim() || state.hash.root;
  if (!path) {
    toast('请先选择一个文件夹', 'error');
    return;
  }
  state.hash.root = path;
  state.hash.recursive = Boolean($('#hash-recursive')?.checked);
  state.hash.running = true;
  state.hash.items = [];
  state.hash.stats = null;
  state.hash.error = '';
  state.hash.cancelled = false;
  render();
  post({
    type: 'hashFolder',
    payload: { root: path, recursive: state.hash.recursive },
  });
}

function refreshHashPage() {
  const status = $('#hash-status');
  const results = $('#hash-results');
  if (status) status.innerHTML = renderHashStatus();
  if (results) results.innerHTML = renderHashResults();
  syncToolbarState();
}

function startTempScan() {
  if (state.temp.running) return;
  clearRunningStates();
  state.temp.running = true;
  state.temp.categories = [];
  state.temp.entries = [];
  state.temp.total = 0;
  state.temp.stats = null;
  state.temp.error = '';
  state.temp.cancelled = false;
  state.temp.selected.clear();
  render();
  post({ type: 'scanTemp' });
}

function refreshTempPage() {
  const status = $('#temp-status');
  const results = $('#temp-results');
  if (status) status.innerHTML = renderTempStatus();
  if (results) results.innerHTML = renderTempResults();
  syncToolbarState();
}

function startUnlockCheck() {
  if (state.unlock.running) return;
  clearRunningStates();
  const mode = state.unlock.mode || 'file';
  const path = $('#unlock-path')?.value?.trim() || state.unlock.path;
  if (!path) {
    toast(mode === 'folder' ? '请先选择一个文件夹' : '请先选择一个文件', 'error');
    return;
  }
  state.unlock.path = path;
  state.unlock.running = true;
  state.unlock.checked = false;
  state.unlock.error = '';
  render();
  post({ type: 'unlockCheck', payload: { path, mode } });
}

function refreshUnlockPage() {
  const status = $('#unlock-status');
  const results = $('#unlock-results');
  if (status) status.innerHTML = renderUnlockStatus();
  if (results) results.innerHTML = renderUnlockResults();
  syncToolbarState();
}

function copyText(text) {
  if (!text) return;
  post({ type: 'copyText', payload: { text } });
}

// 复制完整路径到剪贴板，替代原先的“在资源管理器中显示”。
function copyPath(path) {
  if (!path) return;
  copyText(path);
}

function renderQuickSearch(tool) {
  const search = state.search;
  const times = [
    [0, '不限'],
    [24 * 60 * 60 * 1000, '最近一天'],
    [7 * 24 * 60 * 60 * 1000, '最近一周'],
    [30 * 24 * 60 * 60 * 1000, '最近一月'],
    [365 * 24 * 60 * 60 * 1000, '最近一年'],
  ];
  const folderScope = search.scope !== 'all';
  return `
    ${pageHead(tool, '磁盘 / 文件管理')}
    <div class="panel search-panel">
      <div class="search-scope">
        <button class="seg-btn ${folderScope ? 'active' : ''}" data-search-scope="folder">指定目录</button>
        <button class="seg-btn ${folderScope ? '' : 'active'}" data-search-scope="all">本机</button>
        <span class="search-scope-tip">${folderScope ? '在选定目录里递归查找' : '扫描所有固定磁盘，跳过系统目录'}</span>
      </div>
      <div class="search-form">
        <div class="path-field search-root-field ${folderScope ? '' : 'is-disabled'}">
          ${icon('folder', 15)}
          <input id="search-root" readonly placeholder="选择一个搜索目录" value="${escapeHtml(search.root)}">
          <button class="mini-btn" id="search-pick" ${folderScope ? '' : 'disabled'}>浏览</button>
        </div>
        <label class="field search-pattern-field">文件名
          <input id="search-pattern" value="${escapeHtml(search.pattern)}" placeholder="*.pdf、报告*、*2025*" spellcheck="false">
        </label>
        <label class="field">最小体积
          ${sizeFieldHtml('search-min-size', search.size, search.sizeUnit, { label: '最小体积', placeholder: '不限' })}
        </label>
        <label class="field">修改时间
          <select id="search-time">
            ${times.map(([value, label]) => `<option value="${value}" ${Number(search.time) === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
        <label class="switch-field search-recursive">
          <input type="checkbox" id="search-recursive" ${search.recursive ? 'checked' : ''}>
          <span class="switch"></span>包含子目录
        </label>
        <button class="btn primary" id="search-run" ${search.running ? 'disabled' : ''}>${icon('search', 15)} ${search.running ? '搜索中…' : '开始搜索'}</button>
      </div>
      <div id="search-status">${renderSearchStatus()}</div>
    </div>
    <div class="panel search-results-panel">
      ${renderSearchResults()}
    </div>`;
}

function renderSearchStatus() {
  const search = state.search;
  if (search.running) {
    return `
      <div class="progress-card">
        <div class="progress-top">
          <div class="progress-title"><span class="spinner"></span>正在遍历文件</div>
          <div class="progress-counts" id="search-counts">${formatNumber(search.stats?.matched || 0)} 个匹配 / 已扫 ${formatNumber(search.stats?.files || 0)} 文件</div>
        </div>
        <div class="progress-track"><span></span></div>
        <div class="progress-current" id="search-current">正在读取目录…</div>
      </div>`;
  }
  if (search.error) {
    return `<div class="summary-strip"><span class="summary-chip" style="color:var(--danger)">${escapeHtml(search.error)}</span></div>`;
  }
  if (search.stats) {
    return `<div class="summary-strip">
      <span class="summary-chip">扫描 <strong>${formatNumber(search.stats.files || 0)}</strong> 个文件</span>
      <span class="summary-chip good">命中 <strong>${formatNumber(search.totalMatched || search.stats.matched || 0)}</strong> 个</span>
      <span class="summary-chip">用时 <strong>${formatElapsed(search.elapsedMs || 0)}</strong></span>
      ${search.cancelled ? '<span class="summary-chip">已取消</span>' : ''}
    </div>`;
  }
  return '<div class="search-hint">先用通配符缩小范围；留空文件名会匹配全部文件，可能比较慢。</div>';
}

function renderSearchResults() {
  const search = state.search;
  const items = Array.isArray(search.items) ? search.items : [];
  if (search.running && !items.length) {
    return '<div class="empty-state compact"><strong>正在搜索…</strong><p>结果会在搜索结束后一次性列出。</p></div>';
  }
  if (!items.length) {
    return `<div class="empty-state compact">
      <div class="empty-ico">${icon('search', 26)}</div>
      <strong>${search.stats ? '没有匹配的文件' : '还没有搜索结果'}</strong>
      <p>${search.stats ? '换一个通配符，或放宽体积、时间条件再试。' : '选好目录和条件后点「开始搜索」，只读遍历，不会修改任何文件。'}</p>
    </div>`;
  }
  const shown = items.slice(0, 600);
  return `
    <div class="results-head">
      <div><h3>搜索结果 <span class="count-pill">${formatNumber(search.totalMatched || items.length)}</span></h3>
        <p>${items.length > shown.length ? `仅显示前 ${shown.length} 条，缩小条件可以看到更精确的结果。` : '点文件名直接打开，或到资源管理器定位。'}</p></div>
    </div>
    <div class="search-result-list">
      ${shown.map((item) => {
        const path = escapeHtml(item.path || '');
        const mtime = Number(item.mtime) || 0;
        return `<div class="search-result-row">
          <span class="search-file-ico">${icon('file', 16)}</span>
          <div class="search-file-text">
            <div class="search-file-name">${escapeHtml(item.name || item.path || '')}</div>
            <div class="search-file-path" title="${path}">${path}</div>
            <div class="search-file-meta"><span>${formatBytes(Number(item.size) || 0)}</span><span>${mtime ? new Date(mtime).toLocaleString('zh-CN') : '—'}</span></div>
          </div>
          <div class="search-file-actions">
            <button class="row-btn" data-search-action="open" data-path="${path}" title="打开">${icon('play', 12)}</button>
            <button class="row-btn" data-search-action="reveal" data-path="${path}" title="在资源管理器中定位">${icon('folder-open', 12)}</button>
            <button class="row-btn" data-search-action="copy" data-path="${path}" title="复制路径">${icon('copy', 12)}</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function handleSearchDone(payload) {
  const search = state.search;
  search.running = false;
  search.items = Array.isArray(payload.items) ? payload.items : [];
  search.stats = payload.stats || null;
  search.totalMatched = Number(payload.totalMatched) || search.items.length;
  search.elapsedMs = Number(payload.elapsedMs) || 0;
  search.cancelled = !!payload.cancelled;
  search.error = payload.error || '';
  if (state.view === 'tool' && state.toolId === 'quick-search') render();
  if (search.error) toast(search.error, 'error');
}

function renderFolderSync(tool) {
  const fdiff = state.fdiff;
  return `
    ${pageHead(tool, '磁盘 / 文件管理')}
    <div class="panel">
      <div class="xl-pick-grid">
        <div class="xl-pick-row">
          <span class="xl-pick-tag">A 源</span>
          <div class="path-field">${icon('drive', 14)}<input id="fdiff-root-a" readonly placeholder="选择 A 目录（改动较多的一侧）" value="${escapeHtml(fdiff.rootA)}"></div>
          <button class="mini-btn" id="fdiff-pick-a">浏览</button>
        </div>
        <div class="xl-pick-row">
          <span class="xl-pick-tag alt">B 目标</span>
          <div class="path-field">${icon('drive', 14)}<input id="fdiff-root-b" readonly placeholder="选择 B 目录（要同步到的一侧）" value="${escapeHtml(fdiff.rootB)}"></div>
          <button class="mini-btn" id="fdiff-pick-b">浏览</button>
        </div>
      </div>
      <div class="calc-form">
        <button class="btn primary" id="fdiff-run" ${fdiff.running ? 'disabled' : ''}>${icon('diff', 15)} 开始对比</button>
        ${fdiff.running ? `<button class="btn danger-ghost" id="fdiff-cancel">取消</button>` : ''}
        <label class="switch-field">
          <input type="checkbox" id="fdiff-content" ${fdiff.compareContent ? 'checked' : ''}>
          <span class="switch"></span>按内容 SHA-256 比对（较慢）
        </label>
        <p class="fin-note">默认按相对路径 + 文件大小 + 修改时间（>2 秒）比对；勾选内容比对后，同大小同时间的文件也会校验 SHA-256。目录差异仅作提示。复制会覆盖同名文件，删除请到重复文件工具里走回收站。</p>
      </div>
      ${fdiff.error ? xlDangerStrip(fdiff.error) : ''}
      ${fdiff.running ? `
        <div class="progress-card">
          <div class="progress-top">
            <div class="progress-title"><span class="spinner"></span>正在对比</div>
            <div class="progress-counts" id="fdiff-counts">遍历中…</div>
          </div>
          <div class="progress-track"><span></span></div>
          <div class="progress-current" id="fdiff-current">${fdiff.stats?.current || '正在遍历…'}</div>
        </div>` : renderFdiffResult()}
    </div>`;
}

function fdiffRowsHtml(entries, side) {
  return entries.map((entry) => {
    const checked = state.fdiff.selected.has(entry.relPath) && !entry.isDir;
    return `
      <tr>
        <td class="cell-check">
          ${entry.isDir ? '<span class="diff-dir-tag">目录</span>'
            : `<input type="checkbox" data-diff-check="${escapeHtml(entry.relPath)}" data-diff-side="${side}" ${checked ? 'checked' : ''}>`}
        </td>
        <td class="cell-name" title="${escapeHtml(entry.relPath)}">${escapeHtml(entry.name)}${entry.relPath.includes('\\') ? `<em class="diff-rel">${escapeHtml(entry.relPath)}</em>` : ''}</td>
        <td class="mono">${entry.isDir ? '—' : formatBytes(side === 'B' ? entry.sizeB : entry.sizeA)}</td>
        <td class="mono">${side === 'AB' ? `${formatDate(entry.mtimeA)} → ${formatDate(entry.mtimeB)}` : formatDate(side === 'B' ? entry.mtimeB : entry.mtimeA)}</td>
      </tr>`;
  }).join('');
}

function renderFdiffResult() {
  const fdiff = state.fdiff;
  if (!fdiff.stats || (fdiff.error)) return '';
  const hasResult = fdiff.onlyA.length || fdiff.onlyB.length || fdiff.different.length;
  if (!hasResult && !fdiff.elapsedMs) return '';
  if (!hasResult) {
    return `
      <div class="empty-state">
        <div class="empty-orb">${icon('check-circle', 24)}</div>
        <h3>两边内容一致</h3>
        <p>共扫描 ${formatNumber(fdiff.stats.files || 0)} 个文件，没有发现差异。</p>
      </div>`;
  }
  const copyable = fdiff.onlyA.filter((e) => !e.isDir).length
    + fdiff.onlyB.filter((e) => !e.isDir).length + fdiff.different.length;
  return `
    <div class="xl-toolbar">
      <div class="summary-strip xl-chips">
        <span class="summary-chip">A 独有 <strong>${formatNumber(fdiff.onlyA.length)}</strong></span>
        <span class="summary-chip">B 独有 <strong>${formatNumber(fdiff.onlyB.length)}</strong></span>
        <span class="summary-chip" style="border-color:rgba(251,191,36,.25);background:rgba(251,191,36,.06)">内容不同 <strong style="color:var(--warning)">${formatNumber(fdiff.different.length)}</strong></span>
        <span class="summary-chip">耗时 <strong>${(fdiff.elapsedMs / 1000).toFixed(1)}s</strong></span>
      </div>
      <div class="xl-actions">
        <button class="btn small ghost" id="fdiff-copy-ba" ${copyable && !fdiff.copying ? '' : 'disabled'}>${icon('refresh', 14)} B → A 复制选中</button>
        <button class="btn small primary" id="fdiff-copy-ab" ${copyable && !fdiff.copying ? '' : 'disabled'}>${icon('copy', 14)} A → B 复制选中</button>
      </div>
    </div>
    ${fdiff.copying ? `
      <div class="progress-card">
        <div class="progress-top">
          <div class="progress-title"><span class="spinner"></span>正在复制文件</div>
          <div class="progress-counts">${formatBytes(fdiff.copyCopied)} / ${fdiff.copyTotal ? formatBytes(fdiff.copyTotal) : '计算中…'}</div>
        </div>
        <div class="progress-track"><span style="width:${fdiff.copyTotal ? Math.min(100, fdiff.copyCopied / fdiff.copyTotal * 100) : 0}%"></span></div>
        <div class="progress-current">${escapeHtml(fdiff.copyCurrent || '准备复制…')}</div>
        <div class="xl-actions"><button class="btn small danger-ghost" id="fdiff-copy-cancel">取消复制</button></div>
      </div>` : ''}
    ${fdiff.onlyA.length ? `
      <div class="results-head"><div><h3>A 独有 <span class="count-pill">${formatNumber(fdiff.onlyA.length)}</span></h3><p>B 目录里没有这些文件</p></div></div>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>文件名</th><th>大小</th><th>修改时间</th></tr></thead>
        <tbody>${fdiffRowsHtml(fdiff.onlyA, 'A')}</tbody>
      </table></div>` : ''}
    ${fdiff.onlyB.length ? `
      <div class="results-head"><div><h3>B 独有 <span class="count-pill">${formatNumber(fdiff.onlyB.length)}</span></h3><p>A 目录里没有这些文件</p></div></div>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>文件名</th><th>大小</th><th>修改时间</th></tr></thead>
        <tbody>${fdiffRowsHtml(fdiff.onlyB, 'B')}</tbody>
      </table></div>` : ''}
    ${fdiff.different.length ? `
      <div class="results-head"><div><h3>内容不同 <span class="count-pill">${formatNumber(fdiff.different.length)}</span></h3><p>大小或修改时间不同；复制时 A 侧文件会覆盖 B 侧（或反向）</p></div></div>
      <div class="table-wrap"><table>
        <thead><tr><th></th><th>文件名</th><th>A 大小</th><th>B 大小</th><th>A 修改时间</th><th>B 修改时间</th></tr></thead>
        <tbody>${fdiff.different.map((entry) => `
          <tr>
            <td class="cell-check"><input type="checkbox" data-diff-check="${escapeHtml(entry.relPath)}" data-diff-side="AB" ${state.fdiff.selected.has(entry.relPath) ? 'checked' : ''}></td>
            <td class="cell-name" title="${escapeHtml(entry.relPath)}">${escapeHtml(entry.name)}${entry.relPath.includes('\\') ? `<em class="diff-rel">${escapeHtml(entry.relPath)}</em>` : ''}</td>
            <td class="mono">${formatBytes(entry.sizeA)}</td>
            <td class="mono">${formatBytes(entry.sizeB)}</td>
            <td class="mono">${formatDate(entry.mtimeA)}</td>
            <td class="mono">${formatDate(entry.mtimeB)}</td>
          </tr>`).join('')}</tbody>
      </table></div>` : ''}`;
}

function handleCompareDone(payload) {
  const fdiff = state.fdiff;
  fdiff.running = false;
  fdiff.onlyA = Array.isArray(payload.onlyA) ? payload.onlyA : [];
  fdiff.onlyB = Array.isArray(payload.onlyB) ? payload.onlyB : [];
  fdiff.different = Array.isArray(payload.different) ? payload.different : [];
  fdiff.stats = payload.stats || null;
  fdiff.elapsedMs = payload.elapsedMs || 0;
  fdiff.cancelled = Boolean(payload.cancelled);
  fdiff.error = payload.error || '';
  fdiff.selected.clear();
  if (state.view === 'tool' && state.toolId === 'folder-sync') render();
  if (fdiff.error) toast(fdiff.error, 'error');
  else if (fdiff.cancelled) toast('对比已取消');
  else {
    const total = fdiff.onlyA.length + fdiff.onlyB.length + fdiff.different.length;
    toast(total ? `发现 ${formatNumber(total)} 处差异` : '两边内容一致', total ? 'success' : 'info');
  }
}

function runFolderCompare() {
  const fdiff = state.fdiff;
  if (!fdiff.rootA || !fdiff.rootB) {
    toast('请先选择 A、B 两个目录', 'error');
    return;
  }
  clearRunningStates();
  fdiff.running = true;
  fdiff.error = '';
  fdiff.stats = null;
  fdiff.selected.clear();
  if (state.view === 'tool' && state.toolId === 'folder-sync') render();
  post({ type: 'compareFolders', payload: { rootA: fdiff.rootA, rootB: fdiff.rootB, compareContent: fdiff.compareContent } });
}

function collectFdiffPairs(direction) {
  const fdiff = state.fdiff;
  const pairs = [];
  const sepA = fdiff.rootA.endsWith('\\') ? '' : '\\';
  const sepB = fdiff.rootB.endsWith('\\') ? '' : '\\';
  const add = (entries) => {
    entries.forEach((entry) => {
      if (entry.isDir || !fdiff.selected.has(entry.relPath)) return;
      if (direction === 'ab') pairs.push({ from: fdiff.rootA + sepA + entry.relPath, to: fdiff.rootB + sepB + entry.relPath });
      else pairs.push({ from: fdiff.rootB + sepB + entry.relPath, to: fdiff.rootA + sepA + entry.relPath });
    });
  };
  if (direction === 'ab') {
    add(fdiff.onlyA);
    add(fdiff.different);
  } else {
    add(fdiff.onlyB);
    add(fdiff.different);
  }
  return pairs;
}

async function requestFolderCopy(direction) {
  const pairs = collectFdiffPairs(direction);
  if (!pairs.length) {
    toast('请先勾选要复制的文件', 'error');
    return;
  }
  const fromLabel = direction === 'ab' ? 'A' : 'B';
  const toLabel = direction === 'ab' ? 'B' : 'A';
  const checked = await requestHost({ type: 'checkPaths', payload: { paths: pairs.map((pair) => pair.to) } });
  const existing = Array.isArray(checked.existing) ? checked.existing.filter(Boolean).length : 0;
  showConfirm({
    title: `确认从 ${fromLabel} 复制到 ${toLabel}？`,
    message: `将复制 ${pairs.length} 个文件。${existing ? `目标位置已有 ${existing} 个同名文件，会被覆盖；` : ''}没有自动备份，请确认后再继续。`,
    confirmLabel: '开始复制',
    iconName: 'copy',
    danger: false,
    onConfirm: () => {
      clearRunningStates();
      state.fdiff.copying = true;
      state.fdiff.copyCopied = 0;
      state.fdiff.copyTotal = 0;
      state.fdiff.copyCurrent = '';
      render();
      post({ type: 'copyFiles', payload: { pairs } });
    },
  });
}

function bindSearchEvents() {
  viewEl.addEventListener('click', (event) => {
    const resultButton = event.target.closest('[data-search-action]');
    if (resultButton) {
      const action = resultButton.dataset.searchAction;
      const path = resultButton.dataset.path || '';
      if (action === 'copy') {
        copyText(path);
      } else if (action === 'open' || action === 'reveal') {
        toolCall(action === 'open' ? 'file.open' : 'file.reveal', { path })
          .catch((error) => toast(error.message, 'error'));
      }
      return;
    }
    const scopeButton = event.target.closest('[data-search-scope]');
    if (scopeButton) {
      state.search.scope = scopeButton.dataset.searchScope;
      render();
      return;
    }
    if (event.target.closest('#search-pick')) {
      state.search.scope = 'folder';
      requestHost({ type: 'pickFolder' }).then((res) => {
        if (res.path) {
          state.search.root = res.path;
          const input = $('#search-root');
          if (input) input.value = res.path;
        }
        render();
      });
      return;
    }
    if (event.target.closest('#search-run')) {
      const search = state.search;
      if (search.scope === 'folder' && !search.root) {
        toast('请先选择搜索目录，或切换到“本机”', 'error');
        return;
      }
      const searchSize = readSizeField('search-min-size', search.sizeUnit);
      search.sizeUnit = searchSize.unit;
      search.size = searchSize.empty ? 0 : searchSize.bytes;
      clearRunningStates();
      search.running = true;
      search.error = '';
      search.items = [];
      search.stats = null;
      render();
      post({
        type: 'searchFiles',
        payload: {
          root: search.scope === 'all' ? '' : search.root,
          pattern: search.pattern,
          minSizeBytes: search.size,
          withinMs: Number(search.time) || 0,
          recursive: search.recursive,
        },
      });
      return;
    }
    if (event.target.closest('#search-cancel')) { post({ type: 'cancelScan' }); return; }
    if (event.target.closest('#fdiff-pick-a')) { requestHost({ type: 'pickFolder' }).then((res) => {
      if (res.path) { state.fdiff.rootA = res.path; const input = $('#fdiff-root-a'); if (input) input.value = res.path; }
    }); return; }
    if (event.target.closest('#fdiff-pick-b')) { requestHost({ type: 'pickFolder' }).then((res) => {
      if (res.path) { state.fdiff.rootB = res.path; const input = $('#fdiff-root-b'); if (input) input.value = res.path; }
    }); return; }
    if (event.target.closest('#fdiff-run')) { runFolderCompare(); return; }
    if (event.target.closest('#fdiff-cancel')) { post({ type: 'cancelScan' }); return; }
    if (event.target.closest('#fdiff-copy-cancel')) { post({ type: 'cancelScan' }); return; }
    if (event.target.closest('#fdiff-copy-ab')) {
      requestFolderCopy('ab');
      return;
    }
    if (event.target.closest('#fdiff-copy-ba')) {
      requestFolderCopy('ba');
      return;
    }
  });

  viewEl.addEventListener('change', (event) => {
    const id = event.target.id;
    if (id === 'search-min-size' || id === 'search-min-size-unit') {
      const field = readSizeField('search-min-size', state.search.sizeUnit);
      state.search.sizeUnit = field.unit;
      state.search.size = field.empty ? 0 : field.bytes;
    }
    else if (id === 'search-time') state.search.time = event.target.value;
    else if (id === 'search-scope') state.search.scope = event.target.value;
    else if (id === 'fdiff-content') state.fdiff.compareContent = event.target.checked;
    else if (id === 'search-recursive') state.search.recursive = event.target.checked;
    else if (event.target.dataset?.diffCheck !== undefined) {
      const rel = event.target.dataset.diffCheck;
      if (event.target.checked) state.fdiff.selected.add(rel);
      else state.fdiff.selected.delete(rel);
    }
  });

  viewEl.addEventListener('keydown', (event) => {
    if (event.target.id === 'search-pattern' && event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      $('#search-run')?.click();
    }
    if (event.target.id === 'video-ext-add' && !event.isComposing) {
      if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
        event.preventDefault();
        addVideoExtTokens(event.target.value);
        event.target.value = '';
      } else if (event.key === 'Escape') {
        event.target.value = '';
      }
    }
  });

  // 输完直接点「开始扫描」时输入框还没来得及回车，补一次。
  viewEl.addEventListener('blur', (event) => {
    if (event.target.id === 'video-ext-add' && event.target.value.trim()) {
      addVideoExtTokens(event.target.value);
      event.target.value = '';
    }
  }, true);

  viewEl.addEventListener('input', (event) => {
    if (event.target.id === 'mini-launcher-search') {
      const query = event.target.value.trim().toLowerCase();
      let shown = 0;
      document.querySelectorAll('.mini-launch-card').forEach((card) => {
        const match = !query
          || (card.dataset.launchName || card.textContent || '').toLowerCase().includes(query);
        card.hidden = !match;
        if (match) shown += 1;
      });
      const empty = document.querySelector('.mini-launcher-empty');
      if (empty) empty.hidden = shown > 0;
      return;
    }
    if (event.target.id === 'search-pattern') state.search.pattern = event.target.value;
    if (event.target.id === 'mini-folder-search') {
      foldersState().miniQuery = event.target.value;
      paintFolders();
    }
    if (event.target.id === 'video-filter') {
      videoState().filter = event.target.value;
      videoState().limit = 300;
      paintVideoList();
    }
    if (event.target.id === 'video-max' || event.target.id === 'video-max-unit' ||
        event.target.id === 'video-exclude') {
      const vs = videoState();
      if (event.target.id === 'video-exclude') {
        vs.exclude = event.target.value;
      } else {
        const field = readSizeField('video-max', vs.maxUnit);
        vs.maxUnit = field.unit;
        vs.maxMB = field.empty ? 0 : field.bytes / SIZE_FACTOR.MB;
      }
      saveVideoSettings(vs);
    }
  });
}
