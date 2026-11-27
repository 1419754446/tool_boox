// ---- 第 2/8 块：本块起始于 function renderSectionHead(count) { ----
function renderSectionHead(count) {
  const title = state.query
    ? '搜索结果'
    : state.category === 'all' ? '全部工具' : '工具列表';
  const subtitle = state.query
    ? `“${escapeHtml(state.query)}” · ${count} 个匹配`
    : state.category === 'all'
      ? `${count} 个工具 · 点卡片进入`
      : `${categoryName(state.category)} · ${count} 个工具`;
  return `
    <div class="section-head">
      <div>
        <h2>${title}</h2>
        <p>${subtitle}</p>
      </div>
      <div class="filter-tabs">
        ${CATEGORIES.map((category) => `
          <button data-filter="${category.id}" class="${state.category === category.id ? 'active' : ''}">${category.name}</button>
        `).join('')}
      </div>
    </div>`;
}

// 置顶 = 把卡片钉到首页顶部的「置顶」区。卡片会从原分类挪上去，
// 所以这里必须给反馈 + 把视线带过去，否则看起来像「点了没反应」。
function togglePin(id) {
  if (!id) return;
  const tool = toolById(id);
  if (!tool) return;
  const index = state.pinned.indexOf(id);
  const nowPinned = index === -1;
  if (nowPinned) state.pinned.push(id);
  else state.pinned.splice(index, 1);
  try {
    localStorage.setItem('toolsoft.pinned', JSON.stringify(state.pinned));
  } catch (_) {}
  render();
  if (nowPinned) {
    toast(`已置顶「${tool.name}」，可在首页顶部看到`, 'success');
    requestAnimationFrame(() => {
      const group = document.querySelector('.tool-group.is-pinned');
      // 减掉吸顶头部的高度，别让组标题被压在 header 下面
      viewEl.scrollTop = group ? Math.max(0, group.offsetTop - 96) : 0;
    });
  } else {
    toast(`已取消置顶「${tool.name}」，回到原分类`);
  }
}

function renderToolCard(tool, index) {
  const ready = tool.status === 'ready';
  const pinned = state.pinned.includes(tool.id);
  return `
    <article class="tool-card ${ready ? 'is-ready' : 'is-soon'}" data-open="${tool.id}"
             tabindex="0" role="button" aria-label="${escapeHtml(tool.name)}"
             style="--delay:${index * 45}ms">
      <div class="card-glow"></div>
      <div class="card-top">
        <div class="tool-icon accent-${tool.accent}">${icon(tool.icon, 21)}</div>
        <div class="card-actions">
          <button class="pin-btn ${pinned ? 'is-pinned' : ''}" data-pin="${tool.id}"
                  title="${pinned ? '取消置顶（回到原分类）' : '置顶到首页顶部'}"
                  aria-label="${pinned ? '取消置顶' : '置顶'}" aria-pressed="${pinned}">${icon('pin', 13)}</button>
          ${ready && !state.mini ? `<button class="pin-btn float-btn" data-mini-open="${tool.id}"
                  title="以悬浮小窗打开" aria-label="悬浮打开">${icon('external', 13)}</button>` : ''}
        </div>
        <span class="status ${ready ? 'ready' : 'soon'}"><i></i>${ready ? '可用' : '打磨中'}</span>
      </div>
      <div class="card-body">
        <h3>${tool.name}</h3>
        <p>${tool.desc}</p>
      </div>
      <div class="card-foot">
        <div class="tags">${tool.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>
        <span class="card-arrow">${icon('arrow-up-right', 13)}</span>
      </div>
    </article>`;
}

function renderNoResults() {
  return `
    <div class="empty-state">
      <div class="empty-orb">${icon('search', 27)}</div>
      <h3>没有找到匹配的工具</h3>
      <p>换个关键词，或者切回“全部工具”看看。</p>
      <button class="btn ghost small" id="clear-search" style="margin-top:16px">清除搜索</button>
    </div>`;
}

function pageHead(tool, kicker, actions = '') {
  const floatBtn = state.mini ? '' :
    `<button class="btn small ghost" data-mini-open="${tool.id}" title="以悬浮小窗打开">${icon('external', 14)} 悬浮</button>`;
  return `
    <div class="page-head">
      <button class="back-btn" data-nav="home" title="返回工具库" aria-label="返回工具库">${icon('arrow-left', 17)}</button>
      <div class="page-icon accent-${tool.accent}">${icon(tool.icon, 25)}</div>
      <div class="page-title">
        <div class="page-kicker">${kicker}</div>
        <h1>${tool.name}</h1>
        <p>${tool.desc}</p>
      </div>
      <div class="page-actions">${floatBtn}${actions}<span class="status ready"><i></i>本地处理</span></div>
    </div>`;
}

function renderToolPageBody() {
  const tool = toolById(state.toolId);
  if (!tool) return renderHome();
  if (tool.id === 'video-preview') return renderPreviewWindow();
  if (tool.id === 'folders') return renderFolders(tool);
  if (tool.id === 'video-collector') return renderVideoCollector(tool);
  if (tool.id === 'large-files') return renderLargeFiles(tool);
  if (tool.id === 'empty-folders') return renderEmptyFolders(tool);
  if (tool.id === 'duplicates') return renderDuplicates(tool);
  if (tool.id === 'space-analyzer') return renderSpaceAnalyzer(tool);
  if (tool.id === 'batch-rename') return renderRename(tool);
  if (tool.id === 'hash-check') return renderHashCheck(tool);
  if (tool.id === 'temp-cleaner') return renderTempCleaner(tool);
  if (tool.id === 'file-unlock') return renderUnlock(tool);
  if (tool.id === 'quick-search') return renderQuickSearch(tool);
  if (tool.id === 'folder-sync') return renderFolderSync(tool);
  if (tool.id === 'clipboard-history') return renderClipboard(tool);
  if (tool.id === 'file-organizer') return renderFileOrganizer(tool);
  if (tool.id === 'usb-eject') return renderUsb(tool);
  if (tool.id === 'screenshot') return renderScreenshot(tool);
  if (tool.id === 'disk-checkup') return renderCheckup(tool);
  return renderSoon();
}

function renderMiniCollapsedBar(tool) {
  const name = tool ? tool.name : '工具箱';
  const glyph = tool ? tool.icon : 'terminal';
  return `
    <div class="mini-tool-head mini-collapsed-bar">
      <span class="mini-tool-ico">${icon(glyph, 15)}</span>
      <strong>${escapeHtml(name)}</strong>
      <span class="mini-tool-drag"></span>
      <button class="icon-btn" data-mini-action="main" title="打开主窗口">${icon('window', 14)}</button>
      <button class="icon-btn" data-mini-action="pin" title="${state.miniPinned ? '取消置顶' : '置顶'}">${icon('pin', 14)}</button>
      <button class="icon-btn expand" data-mini-action="collapse" title="展开">${icon('arrow-up', 14)}</button>
      <button class="icon-btn" data-mini-action="hide" title="关闭悬浮窗">${icon('x', 14)}</button>
    </div>`;
}

function renderToolPage() {
  const body = renderToolPageBody();
  if (!state.mini) return body;
  const tool = toolById(state.toolId);
  if (state.miniCollapsed) return renderMiniCollapsedBar(tool);
  return `
    <div class="mini-tool-head">
      <span class="mini-tool-ico">${icon(tool ? tool.icon : 'terminal', 15)}</span>
      <strong>${escapeHtml(tool ? tool.name : '工具箱')}</strong>
      <span class="mini-tool-drag"></span>
      ${state.launcher ? '' : `<button class="icon-btn" data-mini-launch title="打开悬浮工具箱">${icon('grid', 14)}</button>`}
      <button class="icon-btn" data-mini-action="main" title="打开主窗口">${icon('window', 14)}</button>
      <button class="icon-btn ${state.miniPinned ? 'active' : ''}" data-mini-action="pin" title="${state.miniPinned ? '取消置顶' : '置顶'}">${icon('pin', 14)}</button>
      <button class="icon-btn" data-mini-action="collapse" title="收起为标题条">${icon('arrow-down', 14)}</button>
      <button class="icon-btn" data-mini-action="hide" title="关闭悬浮窗">${icon('x', 14)}</button>
    </div>${body}`;
}

function renderLargeFiles(tool) {
  const scan = state.scan;
  return `
    ${pageHead(tool, '磁盘 / 文件管理')}
    <div class="panel">
      <div class="toolbar">
        ${driveScope().allDrives ? driveBarHtml() : `
        <div class="path-field">
          ${icon('folder', 15)}
          <input id="scan-path" readonly placeholder="选择一个文件夹开始扫描" value="${escapeHtml(scan.root)}">
          <button class="mini-btn" id="pick-folder">浏览</button>
        </div>`}
        <label class="switch-field" title="打开后按磁盘扫描，可勾选要扫哪几块盘">
          <input type="checkbox" id="scan-all-drives" ${driveScope().allDrives ? 'checked' : ''}>
          <span class="switch"></span>全盘扫描
        </label>
        <label class="field">最小体积
          ${sizeFieldHtml('scan-min-size', scan.minSize, scan.minUnit, { label: '最小体积' })}
        </label>
        <label class="switch-field">
          <input type="checkbox" id="include-hidden" ${scan.includeHidden ? 'checked' : ''}>
          <span class="switch"></span>包含隐藏文件
        </label>
        <button class="btn primary" id="start-scan" ${scan.running ? 'disabled' : ''}>${icon('scan', 15)} 开始扫描</button>
        <button class="btn danger-ghost" id="cancel-scan" ${scan.running ? '' : 'hidden'}>取消</button>
      </div>
      <div id="scan-status">${renderScanStatus()}</div>
      <div id="scan-results">${renderScanResults()}</div>
    </div>`;
}

// 全盘模式下的进度首行：说清楚实际在扫哪几块盘（未勾全盘时沿用原来的占位文案）
function scanScopeHint(verb) {
  const scope = driveScope();
  if (!scope.allDrives) return '正在读取目录…';
  const sel = Array.isArray(scope.sel) && scope.sel.length
    ? scope.sel
    : (state.driveList || []).map((d) => d.letter);
  return sel.length ? `${verb} ${sel.join(' / ')}，大目录会比较慢…` : '正在读取目录…';
}

function renderScanStatus() {
  const scan = state.scan;
  if (scan.running) {
    return `
      <div class="progress-card">
        <div class="progress-top">
          <div class="progress-title"><span class="spinner"></span>正在扫描文件</div>
          <div class="progress-counts" id="scan-counts">0 个文件 · 0 个目录</div>
        </div>
        <div class="progress-track"><span></span></div>
        <div class="progress-current" id="scan-current">${scanScopeHint('正在扫描')}</div>
      </div>`;
  }
  if (scan.error) {
    return `<div class="summary-strip"><span class="summary-chip good" style="border-color:rgba(251,113,133,.2);background:rgba(251,113,133,.06)"><strong style="color:var(--danger)">${escapeHtml(scan.error)}</strong></span></div>`;
  }
  if (scan.stats) {
    return `<div class="summary-strip">
      <span class="summary-chip">扫描 <strong>${formatNumber(scan.stats.files)}</strong> 个文件</span>
      <span class="summary-chip">目录 <strong>${formatNumber(scan.stats.dirs)}</strong> 个</span>
      <span class="summary-chip good">命中 <strong>${formatNumber(scan.stats.matched)}</strong> 个</span>
      ${scan.stats.skipped ? `<span class="summary-chip">跳过 <strong>${formatNumber(scan.stats.skipped)}</strong> 个</span>` : ''}
      <span class="summary-chip">用时 <strong>${formatElapsed(scan.elapsedMs)}</strong></span>
      ${scan.cancelled ? '<span class="summary-chip">已取消</span>' : ''}
    </div>`;
  }
  return '';
}

/* ---- 表头排序：点一列表头按它排，再点一次反向 ---- */
// 每个列表一份排序状态（只在本次会话有效，不写盘）。
// 'scan' 不在表里，它沿用 state.scan 上早就有的 sortKey / sortDir。
const tableSort = {};
const SORT_DEFAULTS = {
  video: { key: 'size', dir: 'desc' },
  temp: { key: 'size', dir: 'desc' },
  hash: { key: 'name', dir: 'asc' },
  empty: { key: 'path', dir: 'asc' },
};
// 数值 / 时间列第一次点击默认从大到小（先看大的、新近的），文本列默认正序
const SORT_DESC_FIRST = ['size', 'mtime', 'duration'];

function sortStateOf(scope) {
  if (scope === 'scan') {
    return { key: state.scan.sortKey || 'size', dir: state.scan.sortDir || 'desc' };
  }
  if (!tableSort[scope]) {
    tableSort[scope] = Object.assign({}, SORT_DEFAULTS[scope] || { key: 'name', dir: 'asc' });
  }
  return tableSort[scope];
}

function sortMarkOf(scope, key) {
  const st = sortStateOf(scope);
  if (st.key !== key) return '';
  return `<span class="sort-mark">${st.dir === 'asc' ? '▲' : '▼'}</span>`;
}

function toggleSortOf(scope, key) {
  if (scope === 'scan') {
    if (state.scan.sortKey === key) {
      state.scan.sortDir = state.scan.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      state.scan.sortKey = key;
      state.scan.sortDir = SORT_DESC_FIRST.includes(key) ? 'desc' : 'asc';
    }
    return;
  }
  const st = sortStateOf(scope);
  if (st.key === key) {
    st.dir = st.dir === 'asc' ? 'desc' : 'asc';
  } else {
    st.key = key;
    st.dir = SORT_DESC_FIRST.includes(key) ? 'desc' : 'asc';
  }
}

// 返回排好序的副本（不动原数组）；getters 形如 { size: (row) => 数值 }
function applyTableSort(rows, scope, getters, tieKey) {
  const st = sortStateOf(scope);
  const get = getters[st.key];
  const tie = tieKey ? getters[tieKey] : null;
  const factor = st.dir === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    let r = 0;
    if (get) {
      const va = get(a);
      const vb = get(b);
      if (typeof va === 'string' || typeof vb === 'string') {
        r = String(va == null ? '' : va).localeCompare(String(vb == null ? '' : vb), 'zh-CN', { numeric: true });
      } else {
        r = (Number(va) || 0) - (Number(vb) || 0);
      }
    }
    if (!r && tie) {
      const ta = tie(a);
      const tb = tie(b);
      r = ta > tb ? 1 : ta < tb ? -1 : 0;
    }
    return r * factor;
  });
}

// 有些表用下标操作（勾选 / 删除），排序必须落在原数组上，否则会操作错行
function sortInPlace(arr, scope, getters, tieKey) {
  const sorted = applyTableSort(arr, scope, getters, tieKey);
  for (let i = 0; i < arr.length; i += 1) arr[i] = sorted[i];
  return arr;
}

function sortLabelOf(scope) {
  const st = sortStateOf(scope);
  const labels = { name: '名称', size: '大小', mtime: '修改时间', duration: '时长', path: '路径', status: '状态', category: '分类' };
  return `${labels[st.key] || st.key}${st.dir === 'asc' ? '升序' : '降序'}`;
}

// 这两张表靠下标勾选 / 删除，排序必须落在原数组上，否则会操作错行
const SORT_INPLACE = {
  temp: () => sortInPlace(state.temp.entries, 'temp', {
    name: (entry) => baseName(entry.path || ''),
    category: (entry) => entry.category || '',
    size: (entry) => Number(entry.size) || 0,
    mtime: (entry) => Number(entry.mtime) || 0,
  }, 'name'),
  empty: () => sortInPlace(state.empty.folders, 'empty', {
    path: (path) => path,
    name: (path) => baseName(path),
  }, 'path'),
};

function sortedScanRows() {
  const rows = state.scan.items.map((item, index) => ({ item, index }));
  const key = state.scan.sortKey;
  const direction = state.scan.sortDir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    let result = 0;
    if (key === 'name') result = a.item.name.localeCompare(b.item.name, 'zh-CN');
    else if (key === 'mtime') result = a.item.mtime - b.item.mtime;
    else result = a.item.size - b.item.size;
    return result * direction;
  });
  return rows;
}

function renderScanResults() {
  const scan = state.scan;
  if (scan.running) return renderSkeleton(6);
  if (!scan.items.length) {
    if (scan.stats) {
      return `
        <div class="empty-state">
          <div class="empty-orb">${icon('scan', 27)}</div>
          <h3>没有找到符合条件的文件</h3>
          <p>共扫描 ${formatNumber(scan.stats.files)} 个文件，没有大于 ${formatBytes(scan.minSize)} 的结果。试试降低最小体积，或者换一个目录。</p>
        </div>`;
    }
    return `
      <div class="empty-state">
        <div class="empty-orb">${icon('folder-open', 27)}</div>
        <h3>${driveScope().allDrives ? '开始扫描全部磁盘' : '选择一个文件夹开始'}</h3>
        <p>扫描会跳过 junction、符号链接和隐藏系统文件，所有操作都在本地完成。</p>
      </div>`;
  }

  const rows = sortedScanRows();
  const allSelected = rows.length > 0 && rows.every(({ item }) => scan.selected.has(item.path));
  const selectedBytes = scan.items
    .filter((item) => scan.selected.has(item.path))
    .reduce((total, item) => total + item.size, 0);

  return `
    <div class="results">
      <div class="results-head">
        <div>
          <h3>扫描结果 <span class="count-pill">${rows.length}</span></h3>
          <p>共匹配 ${formatNumber(scan.totalMatched)} 个文件，展示体积最大的 ${rows.length} 个</p>
        </div>
        <div class="results-head-actions">
          <button class="btn small ghost" data-export="scan">${icon('download', 14)} 导出 CSV</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="col-check"><input type="checkbox" id="select-all" ${allSelected ? 'checked' : ''} aria-label="全选"></th>
              <th class="col-name sortable" data-sort="name">名称${sortMark('name')}</th>
              <th class="col-size sortable" data-sort="size">大小${sortMark('size')}</th>
              <th class="col-time sortable" data-sort="mtime">修改时间${sortMark('mtime')}</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(({ item, index }) => renderFileRow(item, index, scan.selected.has(item.path))).join('')}
          </tbody>
        </table>
      </div>
      <div class="selection-bar ${scan.selected.size ? '' : 'is-hidden'}" id="selection-bar">
        <span>已选择 <strong>${formatNumber(scan.selected.size)}</strong> 项 · ${formatBytes(selectedBytes)}</span>
        <div class="sel-actions">
          <button class="btn small ghost" id="clear-selection">取消选择</button>
          <button class="btn small danger" id="delete-selected">${icon('trash', 14)} 移到回收站</button>
        </div>
      </div>
    </div>`;
}

function sortMark(key) {
  if (state.scan.sortKey !== key) return '';
  return `<span class="sort-mark">${state.scan.sortDir === 'asc' ? '▲' : '▼'}</span>`;
}

function renderFileRow(item, index, selected) {
  return `
    <tr class="${selected ? 'selected' : ''}">
      <td class="col-check"><input type="checkbox" class="row-check" data-index="${index}" ${selected ? 'checked' : ''} aria-label="选择 ${escapeHtml(item.name)}"></td>
      <td class="col-name">
        <div class="cell-file">
          <span class="file-badge">${icon('file', 13)}</span>
          <div class="file-meta">
            <div class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
            <div class="file-parent" title="${escapeHtml(item.path)}">${escapeHtml(parentOf(item.path))}</div>
          </div>
        </div>
      </td>
      <td class="size-cell">${formatBytes(item.size)}</td>
      <td class="time-cell">${formatDate(item.mtime)}</td>
      <td class="col-actions">
        <div class="row-actions">
          <button class="row-btn" data-action="reveal" data-path="${escapeHtml(item.path)}" title="在资源管理器中定位">${icon('folder-open', 13)}</button>
          <button class="row-btn" data-action="copy-path" data-path="${escapeHtml(item.path)}" title="复制完整路径">${icon('copy', 13)}</button>
          <button class="row-btn danger" data-action="delete" data-index="${index}" title="移到回收站">${icon('trash', 13)}</button>
        </div>
      </td>
    </tr>`;
}

function renderSkeleton(count) {
  return `
    <div class="table-wrap" style="margin-top:15px">
      ${Array.from({ length: count }, (_, index) => `
        <div class="skeleton-row">
          <span class="skeleton" style="width:14px;height:14px;border-radius:4px"></span>
          <span class="skeleton" style="width:${44 + (index % 3) * 8}%"></span>
          <span class="skeleton" style="width:54px;margin-left:auto"></span>
          <span class="skeleton" style="width:86px"></span>
        </div>`).join('')}
    </div>`;
}

function renderEmptyFolders(tool) {
  const empty = state.empty;
  return `
    ${pageHead(tool, '文件 / 整理')}
    <div class="panel">
      <div class="toolbar">
        ${driveScope().allDrives ? driveBarHtml() : `
        <div class="path-field">
          ${icon('folder', 15)}
          <input id="empty-path" readonly placeholder="选择要检查的文件夹" value="${escapeHtml(empty.root)}">
          <button class="mini-btn" id="pick-empty-folder">浏览</button>
        </div>`}
        <label class="switch-field" title="打开后检查各类磁盘，可勾选要检查哪几块盘">
          <input type="checkbox" id="empty-all-drives" ${driveScope().allDrives ? 'checked' : ''}>
          <span class="switch"></span>全盘扫描
        </label>
        <button class="btn primary" id="empty-start" ${empty.running ? 'disabled' : ''}>${icon('scan', 15)} 检查空文件夹</button>
        <button class="btn danger-ghost" id="empty-cancel" ${empty.running ? '' : 'hidden'}>取消</button>
      </div>
      <div id="empty-status">${renderEmptyStatus()}</div>
      <div id="empty-results">${renderEmptyResults()}</div>
    </div>`;
}

function renderEmptyStatus() {
  const empty = state.empty;
  if (empty.running) {
    return `
      <div class="progress-card">
        <div class="progress-top">
          <div class="progress-title"><span class="spinner"></span>正在检查目录</div>
          <div class="progress-counts" id="empty-counts">0 个目录</div>
        </div>
        <div class="progress-track"><span></span></div>
        <div class="progress-current" id="empty-current">${scanScopeHint('正在检查')}</div>
      </div>`;
  }
  if (empty.error) {
    return `<div class="summary-strip"><span class="summary-chip"><strong style="color:var(--danger)">${escapeHtml(empty.error)}</strong></span></div>`;
  }
  if (empty.stats) {
    return `<div class="summary-strip">
      <span class="summary-chip">检查 <strong>${formatNumber(empty.stats.dirs)}</strong> 个目录</span>
      <span class="summary-chip good">空文件夹 <strong>${formatNumber(empty.folders.length)}</strong> 个</span>
      <span class="summary-chip">用时 <strong>${formatElapsed(empty.elapsedMs)}</strong></span>
      ${empty.cancelled ? '<span class="summary-chip">已取消</span>' : ''}
    </div>`;
  }
  return '';
}

function renderEmptyResults() {
  const empty = state.empty;
  if (empty.running) return renderSkeleton(5);
  if (!empty.folders.length) {
    if (empty.stats) {
      return `
        <div class="empty-state">
          <div class="empty-orb">${icon('check-circle', 27)}</div>
          <h3>没有发现空文件夹</h3>
          <p>这个目录很干净，或者空目录里还藏着文件。没有做任何修改。</p>
        </div>`;
    }
    return `
      <div class="empty-state">
        <div class="empty-orb">${icon('folder-x', 27)}</div>
        <h3>找出没有内容的文件夹</h3>
        <p>只会删除确认后仍为空的目录，包含文件、隐藏文件或 junction 的目录都会被跳过。</p>
      </div>`;
  }

  const allSelected = empty.folders.every((path) => empty.selected.has(path));
  return `
    <div class="results">
      <div class="results-head">
        <div>
          <h3>空文件夹 <span class="count-pill">${formatNumber(empty.folders.length)}</span></h3>
          <p>按层级从深到浅排列，删除子目录后父目录也会变空</p>
        </div>
        <div class="results-head-actions">
          <button class="btn small ghost" data-export="empty">${icon('download', 14)} 导出 CSV</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="col-check"><input type="checkbox" id="empty-select-all" ${allSelected ? 'checked' : ''} aria-label="全选"></th>
              <th class="sortable" data-sort-scope="empty" data-sort-key="path" title="点击按路径排序">文件夹路径${sortMarkOf('empty', 'path')}</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            ${empty.folders.map((path, index) => `
              <tr class="${empty.selected.has(path) ? 'selected' : ''}">
                <td class="col-check"><input type="checkbox" class="empty-row-check" data-index="${index}" ${empty.selected.has(path) ? 'checked' : ''}></td>
                <td>
                  <div class="cell-file">
                    <span class="file-badge">${icon('folder', 13)}</span>
                    <div class="file-meta">
                      <div class="file-name" title="${escapeHtml(path)}">${escapeHtml(baseName(path))}</div>
                      <div class="file-parent" title="${escapeHtml(path)}">${escapeHtml(parentOf(path))}</div>
                    </div>
                  </div>
                </td>
                <td class="col-actions">
                  <div class="row-actions">
                    <button class="row-btn" data-action="reveal" data-path="${escapeHtml(path)}" title="在资源管理器中定位">${icon('folder-open', 13)}</button>
                    <button class="row-btn" data-action="copy-path" data-path="${escapeHtml(path)}" title="复制完整路径">${icon('copy', 13)}</button>
                    <button class="row-btn danger" data-action="delete-empty" data-index="${index}" title="移到回收站">${icon('trash', 13)}</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="selection-bar ${empty.selected.size ? '' : 'is-hidden'}" id="empty-selection-bar">
        <span>已选择 <strong>${formatNumber(empty.selected.size)}</strong> 个空文件夹</span>
        <div class="sel-actions">
          <button class="btn small ghost" id="empty-clear-selection">取消选择</button>
          <button class="btn small danger" id="empty-delete-selected">${icon('trash', 14)} 移到回收站</button>
        </div>
      </div>
    </div>`;
}

function selectedBytes(items, selected) {
  return items.filter((item) => selected.has(item.path)).reduce((sum, item) => sum + item.size, 0);
}

function replaceFileName(path, name) {
  const value = String(path);
  const index = Math.max(value.lastIndexOf('\\'), value.lastIndexOf('/'));
  return index >= 0 ? value.slice(0, index + 1) + name : name;
}

function renderDuplicates(tool) {
  const dup = state.dup;
  return `
    ${pageHead(tool, '文件 / 去重')}
    <div class="panel">
      <div class="toolbar">
        ${driveScope().allDrives ? driveBarHtml() : `
        <div class="path-field">
          ${icon('folder', 15)}
          <input id="dup-path" readonly placeholder="选择要查找重复文件的文件夹" value="${escapeHtml(dup.root)}">
          <button class="mini-btn" id="dup-pick">浏览</button>
        </div>`}
        <label class="switch-field" title="打开后跨磁盘查找重复文件，可勾选要查哪几块盘">
          <input type="checkbox" id="dup-all-drives" ${driveScope().allDrives ? 'checked' : ''}>
          <span class="switch"></span>全盘扫描
        </label>
        <label class="field">最小体积
          ${sizeFieldHtml('dup-min-size', dup.minSize, dup.minUnit, { label: '最小体积' })}
        </label>
        <button class="btn primary" id="dup-start" ${dup.running ? 'disabled' : ''}>${icon('copy', 15)} 查找重复</button>
        <button class="btn danger-ghost" id="dup-cancel" ${dup.running ? '' : 'hidden'}>取消</button>
      </div>
      <div id="dup-status">${renderDupStatus()}</div>
      <div id="dup-results">${renderDupResults()}</div>
    </div>`;
}

function renderDupStatus() {
  const dup = state.dup;
  if (dup.running) {
    return `
      <div class="progress-card">
        <div class="progress-top">
          <div class="progress-title"><span class="spinner"></span>正在比对文件内容</div>
          <div class="progress-counts" id="dup-counts">0 个候选文件</div>
        </div>
        <div class="progress-track"><span></span></div>
        <div class="progress-current" id="dup-current">${scanScopeHint('正在查找')}</div>
      </div>`;
  }
  if (dup.error) {
    return `<div class="summary-strip"><span class="summary-chip"><strong style="color:var(--danger)">${escapeHtml(dup.error)}</strong></span></div>`;
  }
  if (dup.stats) {
    return `<div class="summary-strip">
      <span class="summary-chip">扫描 <strong>${formatNumber(dup.stats.files)}</strong> 个文件</span>
      <span class="summary-chip">重复组 <strong>${formatNumber(dup.groups.length)}</strong> 个</span>
      <span class="summary-chip good">可释放 <strong>${formatBytes(dup.duplicateBytes)}</strong></span>
      <span class="summary-chip">用时 <strong>${formatElapsed(dup.elapsedMs)}</strong></span>
      ${dup.cancelled ? '<span class="summary-chip">已取消</span>' : ''}
    </div>`;
  }
  return '';
}

function renderDupResults() {
  const dup = state.dup;
  if (dup.running) return renderSkeleton(5);
  if (!dup.groups.length) {
    if (dup.stats) {
      return `
        <div class="empty-state">
          <div class="empty-orb">${icon('check-circle', 27)}</div>
          <h3>没有发现重复文件</h3>
          <p>已扫描 ${formatNumber(dup.stats.files)} 个文件，没有找到内容相同、且大于 ${formatBytes(dup.minSize)} 的文件。</p>
        </div>`;
    }
    return `
      <div class="empty-state">
        <div class="empty-orb">${icon('copy', 27)}</div>
        <h3>找出真正重复的文件</h3>
        <p>先按大小分组，再用 SHA-256 校验完整内容；硬链接会被识别并跳过。</p>
      </div>`;
  }

  const selectedBytes = dup.groups.reduce((sum, group) => {
    return sum + group.files.filter((file) => dup.selected.has(file.path))
      .reduce((sub, file) => sub + file.size, 0);
  }, 0);
  const selectedCount = dup.groups.reduce((sum, group) =>
    sum + group.files.filter((file) => dup.selected.has(file.path)).length, 0);

  return `
    <div class="results">
      <div class="results-head">
        <div>
          <h3>重复文件 <span class="count-pill">${dup.groups.length}</span></h3>
          <p>默认每组保留第一个，勾选其余需要清理的副本</p>
        </div>
        <div class="results-head-actions">
          <button class="btn small ghost" data-export="dup">${icon('download', 14)} 导出 CSV</button>
          <button class="btn small ghost" id="dup-select-all">选择所有重复项</button>
        </div>
      </div>
      ${dup.truncated ? `<p class="fin-note">重复组过多，仅显示前 500 组；请缩小目录范围或提高最小体积。</p>` : ''}
      <div class="dup-groups">
        ${dup.groups.map((group, groupIndex) => `
          <div class="dup-group">
            <div class="dup-group-head">
              <div class="dup-title">
                <span class="dup-size">${formatBytes(group.size)}</span>
                <span class="muted">${group.files.length} 个文件</span>
                <code class="dup-hash">#${escapeHtml(group.hash.slice(0, 12))}</code>
              </div>
              <button class="mini-btn" data-dup-keep="${groupIndex}">保留第一个</button>
            </div>
            ${group.files.map((file, fileIndex) => {
              const selected = dup.selected.has(file.path);
              return `
                <div class="dup-file ${selected ? 'selected' : ''}">
                  <input type="checkbox" class="dup-check" data-group="${groupIndex}" data-file="${fileIndex}" ${selected ? 'checked' : ''}>
                  <span class="file-badge">${icon('file', 13)}</span>
                  <div class="dup-file-meta">
                    <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}${fileIndex === 0 ? '<span class="keep-tag">保留</span>' : ''}</div>
                    <div class="file-parent" title="${escapeHtml(file.path)}">${escapeHtml(file.path)}</div>
                  </div>
                  <span class="dup-time">${formatDate(file.mtime)}</span>
                  <button class="row-btn" data-action="reveal" data-path="${escapeHtml(file.path)}" title="在资源管理器中定位">${icon('folder-open', 13)}</button>
                  <button class="row-btn" data-action="copy-path" data-path="${escapeHtml(file.path)}" title="复制完整路径">${icon('copy', 13)}</button>
                </div>`;
            }).join('')}
          </div>`).join('')}
      </div>
      <div class="selection-bar ${selectedCount ? '' : 'is-hidden'}" id="dup-selection-bar">
        <span>已选择 <strong>${selectedCount}</strong> 个副本 · ${formatBytes(selectedBytes)}</span>
        <div class="sel-actions">
          <button class="btn small ghost" id="dup-clear-selection">取消选择</button>
          <button class="btn small danger" id="dup-delete-selected">${icon('trash', 14)} 移到回收站</button>
        </div>
      </div>
    </div>`;
}

function renderFileOrganizer(tool) {
  const o = state.organizer;
  return `
    ${pageHead(tool, '文件 / 整理')}
    <div class="panel">
      <div class="toolbar">
        <div class="path-field">
          ${icon('folder', 15)}
          <input id="organizer-path" readonly placeholder="选择要整理的文件夹" value="${escapeHtml(o.root)}">
          <button class="mini-btn" id="organizer-pick">浏览</button>
        </div>
        <div class="path-field">
          ${icon('folder-open', 15)}
          <input id="organizer-target" readonly placeholder="目标目录（留空则整理到源目录下）" value="${escapeHtml(o.targetRoot)}">
          <button class="mini-btn" id="organizer-target-pick">浏览</button>
          <button class="mini-btn" id="organizer-target-clear" title="清空目标目录，改为整理到源目录下" ${o.targetRoot ? '' : 'disabled'}>${icon('x', 12)}</button>
        </div>
      </div>
      <div class="toolbar">
        <label class="switch-field">
          <input type="checkbox" id="organizer-hidden" ${o.includeHidden ? 'checked' : ''}>
          <span class="switch"></span>包含隐藏/系统文件
        </label>
        <label class="field">重名处理
          <select id="organizer-conflict">
            <option value="autoname" ${o.conflict === 'autoname' ? 'selected' : ''}>自动加序号</option>
            <option value="skip" ${o.conflict === 'skip' ? 'selected' : ''}>跳过保留原文件</option>
            <option value="overwrite" ${o.conflict === 'overwrite' ? 'selected' : ''}>覆盖</option>
          </select>
        </label>
        <label class="switch-field">
          <input type="checkbox" id="organizer-recheck" ${o.checkDuplicates ? 'checked' : ''}>
          <span class="switch"></span>整理后检查重复文件
        </label>
        <button class="btn primary" id="organizer-start" ${o.running ? 'disabled' : ''}>${icon('folder-open', 15)} 开始整理</button>
        <button class="btn danger-ghost" id="organizer-cancel" ${o.running ? '' : 'hidden'}>取消</button>
      </div>

      <div class="org-section">
        <div class="org-section-head">
          <h3>整理规则</h3>
          <p>按顺序从上到下匹配，每个文件归属第一条命中的规则。</p>
        </div>
        <div id="organizer-rules">${renderOrganizerRules()}</div>
        <div class="org-actions">
          <button class="btn small ghost" id="organizer-add-rule">${icon('sparkles', 13)} 添加规则</button>
        </div>
      </div>

      <div id="organizer-preview">${renderOrganizerPreview()}</div>
      <div id="organizer-undo-bar">${renderOrganizerUndoBar()}</div>
      <div id="organizer-status">${renderOrganizerStatus()}</div>
      <div id="organizer-results">${renderOrganizerResults()}</div>
      <div id="organizer-dup">${renderOrganizerDupHint()}</div>
    </div>`;
}

function renderOrganizerRules() {
  const o = state.organizer;
  if (!o.rules.length) {
    return `<p class="muted">还没有规则，点下方「添加规则」开始。</p>`;
  }
  const catchAll = o.rules.some((r) => r.enabled && !r.exts && !r.nameContains &&
    !r.nameWildcard && !Number(r.minMB) && !Number(r.maxMB));
  const warning = catchAll
    ? `<p class="fin-note org-warning">有启用规则没有扩展名/文件名/大小条件，会匹配大量文件；请确认这是你想要的归档范围。</p>`
    : '';
  return warning + o.rules.map((r, i) => `
    <div class="org-rule">
      <div class="org-rule-grid">
        <label class="switch-field" title="启用/停用此规则">
          <input type="checkbox" class="org-enable" data-i="${i}" ${r.enabled ? 'checked' : ''}>
          <span class="switch"></span>启用
        </label>
        <input class="org-name" data-i="${i}" value="${escapeHtml(r.name)}" placeholder="规则名">
        <div class="org-ops">
          <button class="mini-btn" data-org-up="${i}" title="上移" ${i === 0 ? 'disabled' : ''}><span style="display:inline-flex;transform:rotate(180deg)">${icon('chevron-down', 12)}</span></button>
          <button class="mini-btn" data-org-down="${i}" title="下移" ${i === o.rules.length - 1 ? 'disabled' : ''}>${icon('chevron-down', 12)}</button>
          <button class="mini-btn danger" data-org-del="${i}" title="删除">${icon('trash', 12)}</button>
        </div>
      </div>
      <div class="org-rule-grid2">
        <label class="field">扩展名<input class="org-exts" data-i="${i}" value="${escapeHtml(r.exts)}" placeholder="jpg,png …空=全部"></label>
        <label class="field">文件名含<input class="org-namecontains" data-i="${i}" value="${escapeHtml(r.nameContains)}" placeholder="test"></label>
        <label class="field">文件名通配<input class="org-namewildcard" data-i="${i}" value="${escapeHtml(r.nameWildcard)}" placeholder="*.part"></label>
        <label class="field">最小体积${sizeFieldHtml(`org-min-size-${i}`, (Number(r.minMB) || 0) * SIZE_FACTOR.MB, r.minUnit, { label: '最小体积', placeholder: '不限' })}</label>
        <label class="field">最大体积${sizeFieldHtml(`org-max-size-${i}`, (Number(r.maxMB) || 0) * SIZE_FACTOR.MB, r.maxUnit, { label: '最大体积', placeholder: '不限' })}</label>
        <label class="field">归档 N 天前<input type="number" min="0" class="org-older" data-i="${i}" value="${r.olderThanDays}"></label>
      </div>
      <div class="org-rule-grid3">
        <label class="field">归档方式
          <select class="org-target" data-i="${i}">
            <option value="byExt" ${r.target === 'byExt' ? 'selected' : ''}>按扩展名</option>
            <option value="byDate" ${r.target === 'byDate' ? 'selected' : ''}>按修改日期</option>
            <option value="fixed" ${r.target === 'fixed' ? 'selected' : ''}>固定目录</option>
          </select>
        </label>
        <label class="field">分类名 / 目录<input class="org-dir" data-i="${i}" value="${escapeHtml(r.target === 'byExt' ? (r.groupExt || r.dir) : r.dir)}" placeholder="按扩展名时留空则用扩展名"></label>
        <label class="field">日期粒度
          <select class="org-datemode" data-i="${i}">
            <option value="year" ${r.dateMode === 'year' ? 'selected' : ''}>年</option>
            <option value="year-month" ${r.dateMode === 'year-month' ? 'selected' : ''}>年 / 月</option>
            <option value="year-month-day" ${r.dateMode === 'year-month-day' ? 'selected' : ''}>年 / 月 / 日</option>
          </select>
        </label>
      </div>
    </div>`).join('');
}

function renderOrganizerUndoBar() {
  const o = state.organizer;
  if (!o.lastMoved.length || o.running) return '';
  return `
    <div class="summary-strip" style="margin:10px 0">
      <span class="summary-chip">可撤销上次整理的 <strong>${formatNumber(o.lastMoved.length)}</strong> 个文件</span>
      <span class="sel-actions"><button class="btn small ghost" id="organizer-undo">${icon('refresh', 14)} 撤销这次整理</button></span>
    </div>`;
}
function renderOrganizerPreview() {
  const o = state.organizer;
  if (!o.previewItems.length) return '';
  const movable = o.previewItems.filter((it) => it.ok).length;
  const conflicts = o.previewItems.filter((it) => it.conflict).length;
  const skipped = o.previewItems.filter((it) => it.skipped).length;
  const failed = o.previewItems.length - movable - skipped;
  return `
    <div class="results org-preview">
      <div class="results-head">
        <div>
          <h3>移动预览 <span class="count-pill">${formatNumber(o.previewItems.length)}</span></h3>
          <p>将移动 ${formatNumber(movable)} 个文件 · ${formatBytes(o.matchedBytes || 0)}${conflicts ? `，${formatNumber(conflicts)} 个目标已存在` : ''}${skipped ? `，${formatNumber(skipped)} 个将跳过` : ''}${failed ? `，${formatNumber(failed)} 个失败` : ''}；确认后才会真正移动。</p>
        </div>
        <div class="results-head-actions">
          <button class="btn small ghost" id="organizer-preview-cancel">取消预览</button>
          <button class="btn small primary" id="organizer-preview-run" ${movable ? '' : 'disabled'}>确认执行</button>
        </div>
      </div>
      ${o.previewWarning ? `<p class="fin-note org-warning">${escapeHtml(o.previewWarning)}</p>` : ''}
      <div class="table-wrap">
        <table class="org-preview-table">
          <colgroup>
            <col class="org-col-status"><col class="org-col-name">
            <col class="org-col-target"><col class="org-col-rule">
            <col class="org-col-actions">
          </colgroup>
          <thead><tr><th></th><th>原文件</th><th>目标</th><th>规则</th><th></th></tr></thead>
          <tbody>
            ${o.previewItems.map((it) => `
              <tr>
                <td class="size-cell">${it.ok
                  ? (it.conflict ? `<span style="color:var(--warning)" title="${escapeHtml(it.error || '目标已存在')}">${icon('alert', 13)}</span>` : `<span style="color:var(--success)">${icon('check', 13)}</span>`)
                  : it.skipped
                    ? `<span style="color:var(--warning)" title="${escapeHtml(it.error || '将跳过')}">${icon('alert', 13)}</span>`
                    : `<span style="color:var(--danger)" title="${escapeHtml(it.error || '失败')}">${icon('x', 13)}</span>`}</td>
                <td class="file-name" title="${escapeHtml(it.from)}">${escapeHtml(baseName(it.from))}</td>
                <td class="file-parent" title="${escapeHtml(it.to)}">${escapeHtml(it.to)}</td>
                <td><span class="tag-plain">${escapeHtml(it.rule)}</span></td>
                <td class="col-actions">
                  <div class="row-actions">
                    <button class="row-btn" data-action="reveal" data-path="${escapeHtml(it.from)}" title="在资源管理器中定位">${icon('folder-open', 13)}</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="fin-note">执行时会重新计算一次目标；如果目标在这期间发生变化，以实际结果为准。</p>
    </div>`;
}

function renderOrganizerStatus() {
  const o = state.organizer;
  if (o.running) {
    return `
      <div class="progress-card">
        <div class="progress-top">
          <div class="progress-title"><span class="spinner"></span>正在整理文件</div>
          <div class="progress-counts" id="organizer-counts">0 / 0</div>
        </div>
        <div class="progress-track"><span></span></div>
        <div class="progress-current" id="organizer-current">正在读取目录…</div>
      </div>`;
  }
  if (o.error) {
    return `<div class="summary-strip"><span class="summary-chip"><strong style="color:var(--danger)">${escapeHtml(o.error)}</strong></span></div>`;
  }
  if (o.stats && (o.movedCount || o.failCount || o.skippedCount || o.cancelled)) {
    return `<div class="summary-strip">
      <span class="summary-chip good">已整理 <strong>${formatNumber(o.movedCount)}</strong> 个文件</span>
      ${o.skippedCount ? `<span class="summary-chip">跳过 <strong>${formatNumber(o.skippedCount)}</strong> 个</span>` : ''}
      <span class="summary-chip">失败 <strong>${formatNumber(o.failCount)}</strong> 个</span>
      <span class="summary-chip">用时 <strong>${formatElapsed(o.elapsedMs)}</strong></span>
      ${o.cancelled ? '<span class="summary-chip">已取消</span>' : ''}
    </div>`;
  }
  return '';
}

function renderOrganizerResults() {
  const o = state.organizer;
  if (o.running) return renderSkeleton(4);
  if (o.previewItems.length) return '';
  if (!o.items.length) {
    if (o.stats) {
      return `<div class="empty-state"><div class="empty-orb">${icon('check-circle', 27)}</div><h3>没有可整理的文件</h3><p>指定目录下没有文件命中已有规则。</p></div>`;
    }
    return `<div class="empty-state"><div class="empty-orb">${icon('folder-open', 27)}</div><h3>把散乱文件归归类</h3><p>选一个文件夹，定义整理规则，点击「开始整理」即可自动归类。</p></div>`;
  }
  return `
    <div class="results">
      <div class="results-head">
        <div><h3>整理结果 <span class="count-pill">${formatNumber(o.items.length)}</span></h3></div>

      </div>
      ${o.truncated ? '<p class="fin-note">文件过多，仅显示前一部分；请分批整理。</p>' : ''}
      <div class="table-wrap">
        <table>
          <thead><tr><th></th><th>原文件</th><th>移动到</th><th>规则</th><th class="col-actions"></th></tr></thead>
          <tbody>
            ${o.items.map((it) => `
              <tr>
                <td class="size-cell">${it.ok
                  ? `<span style="color:var(--success)">${icon('check', 13)}</span>`
                  : it.skipped
                    ? `<span style="color:var(--warning)" title="${escapeHtml(it.error || '已跳过')}">${icon('alert', 13)}</span>`
                    : `<span style="color:var(--danger)" title="${escapeHtml(it.error || '失败')}">${icon('alert', 13)}</span>`}</td>
                <td class="file-name">${escapeHtml(baseName(it.from))}</td>
                <td class="file-parent" title="${escapeHtml(it.to)}">${escapeHtml(it.to)}</td>
                <td><span class="tag-plain">${escapeHtml(it.rule)}</span></td>
                <td class="col-actions">
                  <div class="row-actions">
                    <button class="row-btn" data-action="reveal" data-path="${escapeHtml(it.from)}" title="在资源管理器中定位">${icon('folder-open', 13)}</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderOrganizerDupHint() {
  // 整理后联动重复文件查找的结果展示（复用 state.dup）
  const dup = state.dup;
  const o = state.organizer;
  // 联动扫重进行中：不确定进度条 + 取消按钮，避免让用户误判为卡死
  if (o.waitingDup && dup.running) {
    const stats = dup.stats || {};
    return `
      <div class="progress-card" style="margin-top:16px">
        <div class="progress-top">
          <div class="progress-title">${icon('scan', 15)} 整理后检查重复文件…</div>
        </div>
        <div class="progress-track"><span></span></div>
        <div class="progress-counts">
          <span id="organizer-dup-counts">已扫描 ${formatNumber(stats.files || 0)} 个文件 · 候选 ${formatNumber(stats.matched || 0)} 个</span>
        </div>
        <div class="progress-current" id="organizer-dup-current">${escapeHtml(stats.current || '正在比对文件…')}</div>
        <div class="progress-top" style="margin-top:10px">
          <button class="btn small danger-ghost" id="organizer-dup-cancel">${icon('x', 13)} 取消检查</button>
        </div>
      </div>`;
  }
  if (o.waitingDup) {
    return `<div class="summary-strip"><span class="summary-chip">正在检查重复文件…</span></div>`;
  }
  // 取消后不误报「没有发现重复」
  if (o.ranRecheck && dup.cancelled) {
    return `<div class="summary-strip"><span class="summary-chip">检查已取消</span></div>`;
  }
  if (o.ranRecheck && dup.groups.length) {
    return `
      <div class="results" style="margin-top:16px">
        <div class="results-head">
          <div><h3>整理后检查：发现重复文件 <span class="count-pill">${formatNumber(dup.groups.length)}</span></h3>
              <p>可释放约 ${formatBytes(dup.duplicateBytes)}。可在「重复文件查找」工具里逐组确认清理。</p></div>
          <div class="results-head-actions"><button class="btn small ghost" data-open="duplicates">${icon('copy', 14)} 去处理</button></div>
        </div>
      </div>`;
  }
  if (o.ranRecheck && dup.stats) {
    return `<div class="summary-strip"><span class="summary-chip good">已检查 ${formatNumber(dup.stats.files)} 个文件，没有发现重复</span></div>`;
  }
  return '';
}

function refreshOrganizeRules() {
  const container = $('#organizer-rules');
  if (container) container.innerHTML = renderOrganizerRules();
}

function invalidateOrganizerPreview() {
  const o = state.organizer;
  if (!o.previewItems.length && !o.previewPayload) return;
  o.previewItems = [];
  o.previewPayload = null;
  o.previewWarning = '';
  o.previewing = false;
  // 只刷新结果/预览类区域，绝不重建规则编辑区，避免正在输入时丢焦点
  if (state.view === 'tool' && state.toolId === 'file-organizer') refreshOrganizeNonRules();
}

function saveOrganizerRules() {
  try {
    localStorage.setItem('toolsoft.organizerRules.v1', JSON.stringify(state.organizer.rules));
  } catch { /* localStorage full — 忽略，规则仍在内存中生效 */ }
  invalidateOrganizerPreview();
}

function startOrganize() {
  const o = state.organizer;
  if (o.running) return;
  clearRunningStates();
  const path = $('#organizer-path')?.value?.trim() || o.root;
  if (!path) { toast('请先选择一个文件夹', 'error'); return; }
  o.root = path;
  const targetRoot = $('#organizer-target')?.value?.trim() || o.targetRoot;
  o.targetRoot = targetRoot;
  o.includeHidden = Boolean($('#organizer-hidden')?.checked);
  o.conflict = $('#organizer-conflict')?.value || o.conflict;
  o.checkDuplicates = Boolean($('#organizer-recheck')?.checked);
  saveOrganizerRules();
  // 过滤仅启用规则
  const rules = o.rules.filter((r) => r.enabled);
  if (!rules.length) { toast('请至少启用一条整理规则', 'error'); return; }
  const payload = {
    root: path,
    targetRoot,
    includeHidden: o.includeHidden,
    conflict: o.conflict,
    rules: rules.map((r) => ({
      enabled: true,
      name: r.name,
      exts: r.exts,
      nameContains: r.nameContains,
      nameWildcard: r.nameWildcard,
      minSize: (Number(r.minMB) || 0) * 1024 * 1024,
      maxSize: (Number(r.maxMB) || 0) * 1024 * 1024,
      olderThanDays: Number(r.olderThanDays) || 0,
      newerThanDays: Number(r.newerThanDays) || 0,
      target: r.target,
      dir: r.dir,
      groupExt: r.target === 'byExt' ? r.groupExt : '',
      dateMode: r.dateMode,
    })),
  };

  const catchAll = rules.some((r) => !r.exts && !r.nameContains && !r.nameWildcard &&
    !Number(r.minMB) && !Number(r.maxMB));
  o.previewWarning = catchAll
    ? '注意：至少有一条规则没有扩展名/文件名/大小条件，可能匹配大量文件。'
    : '';
  o.previewPayload = { ...payload, previewOnly: true };
  o.previewItems = [];
  o.previewing = true;
  o.running = true;
  o.items = [];
  o.stats = null;
  o.movedCount = 0;
  o.failCount = 0;
  o.error = '';
  o.cancelled = false;
  o.truncated = false;
  o.waitingDup = false;
  o.ranRecheck = false;
  render();
  post({ type: 'organizeFiles', payload: o.previewPayload });
}
