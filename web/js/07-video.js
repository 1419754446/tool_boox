// ---- 第 7/8 块：本块起始于 function updateCounts() { ----
function updateCounts() {
  $('#count-all').textContent = TOOLS.length;
  $('#count-file').textContent = TOOLS.filter((tool) => tool.category === 'file').length;
  $('#count-disk').textContent = TOOLS.filter((tool) => tool.category === 'disk').length;
  $('#count-system').textContent = TOOLS.filter((tool) => tool.category === 'system').length;
}

function applyLaunchParams() {
  const params = new URLSearchParams(window.location.search);
  state.mini = params.get('mini') === '1';
  if (state.mini) {
    document.documentElement.classList.add('mini-mode');
    // 悬浮窗按 1:1 排版，不继承主窗口的面板缩放。
    state.zoom = 1;
    // 窗口可能是上次折叠着关掉的，向宿主问一次真实状态再决定渲染哪种形态。
    post({ type: 'mini', payload: { action: 'state' } });
  }
  if (params.get('static') === '1') {
    document.documentElement.classList.add('no-anim');
    state.staticMode = true;
  }
  const theme = params.get('theme');
  if (theme === 'dark' || theme === 'light' || theme === 'system') {
    state.theme = theme;
  }
  const zoom = Number(params.get('zoom'));
  if (Number.isFinite(zoom) && zoom >= 0.8 && zoom <= 1.5) {
    state.zoom = zoom;
  }
  const category = params.get('category');
  if (CATEGORIES.some((item) => item.id === category)) {
    state.category = category;
    state.view = 'home';
    state.toolId = null;
  }
  const toolId = params.get('tool');
  if (toolId === 'launcher') {
    state.launcher = true;
    state.view = 'home';
    state.toolId = null;
  } else if (toolId) {
    const tool = toolById(toolId);
    if (tool) {
      state.toolId = tool.id;
      state.view = tool.status === 'ready' ? 'tool' : 'soon';
    }
  } else if (params.get('view') === 'settings') {
    state.view = 'settings';
  }

  // 视频整理的启动参数：--page "tool=video-collector&vroot=...&vdst=...&vauto=1"
  // 给脚本 / 快捷方式用，普通打开不受影响。
  const vroot = params.get('vroot');
  if (vroot) {
    const vs = videoState();
    vs.root = vroot;
    vs.autoScan = params.get('vauto') !== '0';
    const vdst = params.get('vdst');
    if (vdst) vs.dst = vdst;
  }

  // 独立预览窗：tool=video-preview&path=...&name=...
  if (state.toolId === 'video-preview') {
    state.previewPop = {
      path: params.get('path') || '',
      name: params.get('name') || '',
      url: '', error: '', loading: false,
    };
  }

  state.launch = {
    autorun: params.get('autorun') === '1',
    root: params.get('root') || '',
    minSize: Number(params.get('min') || 0),
  };
}

function autorunScan() {
  if (!state.launch?.autorun) return;
  // 右键「扫描此目录」带进来的路径是明确目标，所以先关掉可能残留的全盘扫描开关，
  // 否则会把一个右键请求变成整盘扫描。
  if (state.launch.root && DRIVE_SCOPED_TOOLS.includes(state.toolId)) {
    driveScope().allDrives = false;
    saveDriveScope();
  }
  if (state.view === 'tool' && state.toolId === 'large-files' && state.launch.root) {
    state.scan.root = state.launch.root;
    const input = $('#scan-path');
    if (input) input.value = state.launch.root;
    if (state.launch.minSize > 0) {
      state.scan.minSize = state.launch.minSize;
      state.scan.minUnit = pickSizeUnit(state.launch.minSize);
    }
    startLargeScan();
  } else if (state.view === 'tool' && state.toolId === 'empty-folders' && state.launch.root) {
    state.empty.root = state.launch.root;
    const input = $('#empty-path');
    if (input) input.value = state.launch.root;
    startEmptyScan();
  } else if (state.view === 'tool' && state.toolId === 'duplicates' && state.launch.root) {
    state.dup.root = state.launch.root;
    const input = $('#dup-path');
    if (input) input.value = state.launch.root;
    if (state.launch.minSize > 0) {
      state.dup.minSize = state.launch.minSize;
      state.dup.minUnit = pickSizeUnit(state.launch.minSize);
    }
    startDupScan();
  } else if (state.view === 'tool' && state.toolId === 'space-analyzer' && state.launch.root) {
    state.space.root = state.launch.root;
    const input = $('#space-path');
    if (input) input.value = state.launch.root;
    startSpaceScan();
  } else if (state.view === 'tool' && state.toolId === 'batch-rename' && state.launch.root) {
    state.rename.root = state.launch.root;
    const input = $('#rename-path');
    if (input) input.value = state.launch.root;
    requestListFolder();
  } else if (state.view === 'tool' && state.toolId === 'hash-check' && state.launch.root) {
    state.hash.root = state.launch.root;
    const input = $('#hash-path');
    if (input) input.value = state.launch.root;
    startHashScan();
  } else if (state.view === 'tool' && state.toolId === 'temp-cleaner') {
    startTempScan();
  } else if (state.view === 'tool' && state.toolId === 'file-unlock' && state.launch.root) {
    state.unlock.path = state.launch.root;
    const input = $('#unlock-path');
    if (input) input.value = state.launch.root;
    startUnlockCheck();
  }
}

function debugStage(name) {
  try {
    window.chrome?.webview?.postMessage({ type: 'debug', payload: { stage: name } });
  } catch {
    // Browser preview has no host bridge.
  }
}

function bootstrap() {
  debugStage('start');
  applyLaunchParams();
  hydrateStaticIcons();
  debugStage('icons');
  updateCounts();
  debugStage('counts');
  applyTheme(state.theme, true);
  updateZoomControls();
  debugStage('theme');
  bindEvents();
  bindSearchEvents();
  bindClipboardEvents();
  debugStage('events');
  render();
  viewEl.scrollTop = 0;
  debugStage('render');
  post({ type: 'ready' });
  if (state.view === 'tool' && state.toolId === 'folders') loadFolders();
  if (state.view === 'tool' && state.toolId === 'video-preview') loadPreviewPop();
  if (state.view === 'tool' && state.toolId === 'video-collector' && state.video?.autoScan) {
    handleVideoAction('scan');
  }
  syncClipboardListener();
  post({ type: 'setTheme', payload: { theme: resolveTheme(state.theme) } });
  applyZoom(state.mini ? 1 : state.zoom, !state.staticMode && !state.mini);
  setTimeout(autorunScan, 250);

  debugStage('ready');
}

/* ============================================================
   常用文件夹（第一个走统一命令总线 tb.call 的工具页）
   ============================================================ */

function foldersState() {
  if (!state.folders) {
    state.folders = { items: [], file: '', loading: false, error: '', editing: null, busy: false,
                      miniQuery: '', miniAdding: false, miniEditing: null, miniSelected: new Set(),
                      miniMenu: null, miniLastIndex: null };
  }
  return state.folders;
}

function renderFolders(tool) {
  if (state.mini) return renderFoldersMini();
  const fs = foldersState();
  return `
    ${pageHead(tool, '文件 / 快捷入口', `<button class="btn small ghost" data-folder-action="reload">${icon('refresh', 14)} 重新读取</button>`)}
    <div class="panel">
      <div class="toolbar">
        <div class="path-field">
          ${icon('folder', 15)}
          <input id="folder-add-path" placeholder="文件夹路径，例如 D:\\Document\\Code_test" spellcheck="false">
          <button class="mini-btn" data-folder-action="pick">浏览</button>
        </div>
        <div class="path-field" style="flex:0 1 220px;max-width:220px">
          ${icon('edit', 15)}
          <input id="folder-add-note" placeholder="备注（可选）" spellcheck="false">
        </div>
        <button class="btn primary" data-folder-action="add">${icon('folder-open', 15)} 加入清单</button>
      </div>
      <div class="toolbar-note">清单文件：<span id="folders-file">${escapeHtml(fs.file || '读取中…')}</span>。格式是每行「路径 | 备注」，支持 %USERPROFILE% 这类环境变量；每次改动前自动备份成 folders.bak.txt。</div>
    </div>
    <div class="panel">
      <div id="folders-summary">${renderFoldersSummary()}</div>
      <div id="folders-body">${renderFoldersBody()}</div>
    </div>`;
}

/* ---- 悬浮小窗里的紧凑文件夹面板 ---- */
function miniFolderFiltered() {
  const fs = foldersState();
  const query = (fs.miniQuery || '').trim().toLowerCase();
  if (!query) return fs.items;
  return fs.items.filter((item) =>
    (item.name || '').toLowerCase().includes(query) ||
    (item.path || '').toLowerCase().includes(query) ||
    (item.note || '').toLowerCase().includes(query));
}

function renderFoldersMini() {
  const fs = foldersState();
  const items = miniFolderFiltered();
  const missing = fs.items.filter((item) => !item.exists).length;
  return `
    <div class="mini-folder-shell">
      <div class="mini-folder-bar">
        <div class="mini-search">
          ${icon('search', 14)}
          <input id="mini-folder-search" placeholder="搜索名称 / 路径 / 备注" value="${escapeHtml(fs.miniQuery || '')}" spellcheck="false">
        </div>
        <button class="icon-btn" data-folder-action="mini-add-toggle" title="新增">${icon('plus', 15)}</button>
        <button class="icon-btn" data-folder-action="openManifest" title="打开清单文件">${icon('file', 15)}</button>
        <button class="icon-btn" data-folder-action="reload" title="重新读取">${icon('refresh', 15)}</button>
      </div>
      <div class="mini-add-form ${fs.miniAdding ? 'open' : ''}" id="mini-folder-add">
        <div class="row">
          <input id="folder-add-path" placeholder="文件夹路径" spellcheck="false">
          <button class="mini-btn" data-folder-action="pick">浏览</button>
        </div>
        <div class="row">
          <input id="folder-add-note" placeholder="备注（可选）" spellcheck="false">
          <button class="btn primary small" data-folder-action="add">加入</button>
          <button class="btn ghost small" data-folder-action="mini-add-toggle">取消</button>
        </div>
      </div>
      <div id="folders-mini-body">${renderFoldersMiniBody(items)}</div>
      <div class="mini-folder-foot">
        <span>${fs.items.length ? `共 ${fs.items.length} 项${fs.miniQuery ? ` · 匹配 ${miniFolderFiltered().length}` : ''}${missing ? ` · <span style="color:var(--danger)">${missing} 个缺失</span>` : ''}` : '清单为空'}</span>
        ${fs.miniSelected.size
          ? `<span class="mini-selection">已选 ${fs.miniSelected.size}
              <button data-folder-action="removeSelected" title="删除选中">删除</button>
              <button data-folder-action="clearSelected" title="取消选择">取消</button></span>`
          : `<span class="mini-state-chip">${fs.loading ? '读取中…' : (fs.file ? '已同步' : '')}</span>`}
      </div>
      ${fs.miniMenu ? renderMiniFolderMenu(fs.miniMenu) : ''}
    </div>`;
}

function renderMiniFolderMenu(menu) {
  const fs = foldersState();
  const item = fs.items.find((entry) => entry.path === menu.path);
  if (!item) return '';
  const index = fs.items.indexOf(item);
  const path = escapeHtml(item.path);
  const left = Math.max(6, Math.min(menu.x, window.innerWidth - 196));
  const top = Math.max(6, Math.min(menu.y, window.innerHeight - 430));
  return `
    <div class="mini-folder-menu" style="left:${left}px;top:${top}px" role="menu">
      <button data-folder-action="open" data-path="${path}">${icon('folder', 13)} 打开文件夹</button>
      <button data-folder-action="reveal" data-path="${path}">${icon('search', 13)} 在资源管理器定位</button>
      <button data-folder-action="copy" data-path="${path}">${icon('copy', 13)} 复制完整路径</button>
      <div class="mini-menu-sep"></div>
      <button data-folder-action="up" data-path="${path}" ${index <= 0 ? 'disabled' : ''}>${icon('arrow-up', 13)} 上移${fs.miniSelected.size > 1 && fs.miniSelected.has(item.path) ? `（${fs.miniSelected.size} 项）` : ''}</button>
      <button data-folder-action="down" data-path="${path}" ${index >= fs.items.length - 1 ? 'disabled' : ''}>${icon('arrow-down', 13)} 下移${fs.miniSelected.size > 1 && fs.miniSelected.has(item.path) ? `（${fs.miniSelected.size} 项）` : ''}</button>
      <button data-folder-action="edit" data-path="${path}">${icon('edit', 13)} 编辑路径与备注</button>
      <button class="danger" data-folder-action="remove" data-path="${path}">${icon('trash', 13)} 从清单移除</button>
      <div class="mini-menu-sep"></div>
      <button data-folder-action="mini-add-toggle">${icon('plus', 13)} 新增文件夹</button>
      <button data-folder-action="openManifest">${icon('file', 13)} 打开清单文件</button>
      <button data-folder-action="reload">${icon('refresh', 13)} 重新加载清单</button>
      <div class="mini-menu-sep"></div>
      <button data-folder-action="mini-hide">${icon('eye-off', 13)} 隐藏悬浮窗</button>
      <button class="danger" data-folder-action="quit">${icon('power', 13)} 退出工具箱</button>
    </div>`;
}

function closeMiniFolderMenu() {
  const fs = foldersState();
  fs.miniMenu = null;
  document.querySelector('.mini-folder-menu')?.remove();
}

// 菜单项目多了会超出小窗：渲染后按真实高度贴边，必要时内部滚动。
function clampMiniFolderMenu() {
  const menu = document.querySelector('.mini-folder-menu');
  if (!menu) return;
  const rect = menu.getBoundingClientRect();
  let left = rect.left;
  let top = rect.top;
  if (top + rect.height > window.innerHeight - 6) {
    top = Math.max(6, window.innerHeight - rect.height - 6);
  }
  if (left + rect.width > window.innerWidth - 6) {
    left = Math.max(6, window.innerWidth - rect.width - 6);
  }
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function miniHighlight(text) {
  const value = String(text == null ? '' : text);
  const query = (foldersState().miniQuery || '').trim();
  if (!query) return escapeHtml(value);
  const needle = query.toLowerCase();
  let cursor = 0;
  let html = '';
  while (cursor < value.length) {
    // 在原串上按下标做大小写不敏感匹配：直接比对等长切片的小写形式，
    // 避免 value.toLowerCase() 改变字符长度后得到与原串错位的下标。
    let hit = -1;
    for (let i = cursor; i + needle.length <= value.length; ++i) {
      if (value.substr(i, needle.length).toLowerCase() === needle) {
        hit = i;
        break;
      }
    }
    if (hit < 0) break;
    html += escapeHtml(value.slice(cursor, hit));
    html += `<mark class="search-hit">${escapeHtml(value.slice(hit, hit + needle.length))}</mark>`;
    cursor = hit + needle.length;
  }
  html += escapeHtml(value.slice(cursor));
  return html;
}

function renderFoldersMiniBody(items) {
  const fs = foldersState();
  if (fs.error) return `<div class="mini-folder-empty" style="color:var(--danger)">${escapeHtml(fs.error)}</div>`;
  if (fs.loading && !fs.items.length) return `<div class="mini-folder-empty">正在读取清单…</div>`;
  if (!fs.items.length) return `<div class="mini-folder-empty">还没有条目<br>点右上角 + 添加一个常用文件夹</div>`;
  if (!items.length) return `<div class="mini-folder-empty">没有匹配「${escapeHtml(fs.miniQuery || '')}」的文件夹</div>`;
  return items.map((item) => renderFolderMiniRow(item)).join('');
}

function renderFolderMiniRow(item) {
  const fs = foldersState();
  const total = fs.items.length;
  const index = fs.items.indexOf(item);
  const editing = fs.miniEditing === item.path;
  const path = escapeHtml(item.path);
  const edit = editing ? `
    <div class="mini-add-form open" style="margin:0 0 6px">
      <input id="folder-edit-path" value="${path}" spellcheck="false">
      <div class="row">
        <input id="folder-edit-note" value="${escapeHtml(item.note || '')}" placeholder="备注（可选）" spellcheck="false">
        <button class="btn primary small" data-folder-action="save-edit" data-path="${path}">保存</button>
        <button class="btn ghost small" data-folder-action="cancel-edit">取消</button>
      </div>
    </div>` : '';
  return `
    <div class="mini-folder-row ${item.exists ? '' : 'missing'}" data-folder-action="open" data-path="${path}" title="${path}">
      <input type="checkbox" class="mini-folder-check" data-path="${path}" ${fs.miniSelected.has(item.path) ? 'checked' : ''} aria-label="选择">
      <span class="mini-folder-icon">${icon('folder', 15)}</span>
      <div class="mini-folder-text">
        <div class="mini-folder-name">${miniHighlight(item.name || item.path)}</div>
        <div class="mini-folder-sub">${miniHighlight(item.path)}${item.note ? `<span class="mini-folder-note">${miniHighlight(item.note)}</span>` : ''}</div>
      </div>
      <div class="mini-actions">
        <button data-folder-action="up" data-path="${path}" title="上移" ${index <= 0 ? 'disabled' : ''}>${icon('arrow-up', 12)}</button>
        <button data-folder-action="down" data-path="${path}" title="下移" ${index >= total - 1 ? 'disabled' : ''}>${icon('arrow-down', 12)}</button>
        <button data-folder-action="edit" data-path="${path}" title="编辑">${icon('edit', 12)}</button>
        <button class="danger" data-folder-action="remove" data-path="${path}" title="移除">${icon('trash', 12)}</button>
      </div>
    </div>${edit}`;
}

function renderFoldersSummary() {
  const fs = foldersState();
  if (fs.error) {
    return `<div class="summary-strip"><span class="summary-chip"><strong style="color:var(--danger)">${escapeHtml(fs.error)}</strong></span></div>`;
  }
  const missing = fs.items.filter((item) => !item.exists).length;
  return `
    <div class="results-head">
      <div>
        <h3>清单 <span class="count-pill">${fs.items.length}</span></h3>
        <p>${fs.items.length ? '点「打开」直接进入目录，点「定位」在资源管理器里选中它。' : '还没有条目，用上面的输入框加一个。'}</p>
      </div>
      <div class="results-head-actions">
        ${missing ? `<span class="summary-chip" style="color:var(--danger)">${missing} 个已缺失</span>` : ''}
        <span class="summary-chip">共 ${fs.items.length} 项</span>
      </div>
    </div>`;
}

function renderFoldersBody() {
  const fs = foldersState();
  if (fs.loading && !fs.items.length) {
    return `<div class="table-wrap" style="margin-top:12px">${Array.from({ length: 5 }, () => `
      <div class="skeleton-row">
        <span class="skeleton" style="width:14px;height:14px;border-radius:4px"></span>
        <span class="skeleton" style="width:52%"></span>
        <span class="skeleton" style="width:80px;margin-left:auto"></span>
      </div>`).join('')}</div>`;
  }
  if (!fs.items.length) {
    return `
      <div class="empty-state">
        <div class="empty-orb">${icon('pin', 27)}</div>
        <h3>清单还是空的</h3>
        <p>把每天要去的目录加进来，下次一步就能打开。</p>
      </div>`;
  }
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="col-name">文件夹</th>
            <th style="width:26%">备注</th>
            <th style="width:88px">状态</th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>${fs.items.map((item, index) => renderFolderRow(item, index)).join('')}</tbody>
      </table>
    </div>`;
}

function renderFolderRow(item, index) {
  const fs = foldersState();
  const total = fs.items.length;
  const editing = fs.editing === item.path;
  const path = escapeHtml(item.path);
  const row = `
    <tr class="${editing ? 'selected' : ''}">
      <td class="col-name">
        <div class="cell-file">
          <span class="file-badge">${icon('folder', 13)}</span>
          <div class="file-meta">
            <div class="file-name" title="${path}">${escapeHtml(item.name || item.path)}</div>
            <div class="file-parent" title="${path}">${path}</div>
          </div>
        </div>
      </td>
      <td>${item.note ? escapeHtml(item.note) : '<span style="color:#98a2b3">—</span>'}</td>
      <td>${item.exists ? '<span class="summary-chip good">可用</span>' : '<span class="summary-chip" style="color:var(--danger)">缺失</span>'}</td>
      <td class="col-actions">
        <div class="row-actions">
          <button class="row-btn" data-folder-action="open" data-path="${path}" title="打开文件夹">${icon('external', 13)}</button>
          <button class="row-btn" data-folder-action="reveal" data-path="${path}" title="在资源管理器中定位">${icon('folder-open', 13)}</button>
          <button class="row-btn" data-folder-action="copy" data-path="${path}" title="复制路径">${icon('copy', 13)}</button>
          <button class="row-btn" data-folder-action="edit" data-path="${path}" title="编辑">${icon('edit', 13)}</button>
          <button class="row-btn" data-folder-action="up" data-path="${path}" title="上移" ${index === 0 ? 'disabled' : ''}>${icon('arrow-up', 13)}</button>
          <button class="row-btn" data-folder-action="down" data-path="${path}" title="下移" ${index === total - 1 ? 'disabled' : ''}>${icon('arrow-down', 13)}</button>
          <button class="row-btn danger" data-folder-action="remove" data-path="${path}" title="从清单移除">${icon('trash', 13)}</button>
        </div>
      </td>
    </tr>`;
  const editRow = editing ? `
    <tr class="selected">
      <td colspan="4">
        <div class="toolbar" style="margin:0">
          <div class="path-field">${icon('folder', 15)}<input id="folder-edit-path" value="${path}" spellcheck="false"></div>
          <div class="path-field" style="flex:0 1 220px;max-width:220px">${icon('edit', 15)}<input id="folder-edit-note" value="${escapeHtml(item.note || '')}" placeholder="备注（可选）" spellcheck="false"></div>
          <button class="btn primary small" data-folder-action="save-edit" data-path="${path}">保存</button>
          <button class="btn ghost small" data-folder-action="cancel-edit">取消</button>
        </div>
      </td>
    </tr>` : '';
  return row + editRow;
}

function paintFolders() {
  if (state.mini) {
    const body = $('#folders-mini-body');
    if (body) body.innerHTML = renderFoldersMiniBody(miniFolderFiltered());
    const foot = $('.mini-folder-foot');
    if (foot) {
      const fs = foldersState();
      foot.innerHTML = `<span>${fs.items.length ? `共 ${fs.items.length} 项${fs.miniQuery ? ` · 匹配 ${miniFolderFiltered().length}` : ''}${fs.items.some((item) => !item.exists) ? ` · <span style="color:var(--danger)">${fs.items.filter((item) => !item.exists).length} 个缺失</span>` : ''}` : '清单为空'}</span>` +
        (fs.miniSelected.size
          ? `<span class="mini-selection">已选 ${fs.miniSelected.size}<button data-folder-action="removeSelected">删除</button><button data-folder-action="clearSelected">取消</button></span>`
          : `<span class="mini-state-chip">${fs.loading ? '读取中…' : (fs.file ? '已同步' : '')}</span>`);
    }
    return;
  }
  const summary = $('#folders-summary');
  if (summary) summary.innerHTML = renderFoldersSummary();
  const body = $('#folders-body');
  if (body) body.innerHTML = renderFoldersBody();
  const file = $('#folders-file');
  if (file) file.textContent = foldersState().file || '';
}

function applyFolders(data) {
  const fs = foldersState();
  fs.items = data && Array.isArray(data.items) ? data.items : [];
  if (data && data.file) fs.file = data.file;
  fs.loading = false;
  fs.error = '';
  paintFolders();
  scheduleMiniFit();
}

function loadFolders() {
  const fs = foldersState();
  fs.loading = true;
  fs.error = '';
  paintFolders();
  toolCall('folders.load').then(applyFolders).catch((error) => {
    fs.loading = false;
    fs.error = error.message;
    paintFolders();
  });
}

function handleFolderAction(action, path) {
  const fs = foldersState();
  closeMiniFolderMenu();

  if (action === 'reload') {
    loadFolders();
    return;
  }
  if (action === 'mini-hide') {
    post({ type: 'mini', payload: { action: 'hide' } });
    return;
  }
  if (action === 'quit') {
    post({ type: 'quitApp' });
    return;
  }
  if (action === 'openManifest') {
    const file = fs.file || '';
    if (!file) {
      toast('清单还没加载完', 'error');
      return;
    }
    toolCall('video.open', { path: file }).catch((error) => toast(error.message, 'error'));
    return;
  }
  if (action === 'mini-add-toggle') {
    fs.miniAdding = !fs.miniAdding;
    const form = $('#mini-folder-add');
    if (form) form.classList.toggle('open', fs.miniAdding);
    if (fs.miniAdding) setTimeout(() => $('#folder-add-path')?.focus(), 60);
    return;
  }
  if (action === 'pick') {
    toolCall('folders.pick', {}, 120000).then((data) => {
      const input = $('#folder-add-path');
      if (input && data.path) {
        input.value = data.path;
        input.focus();
      }
    }).catch(() => { /* 用户取消选择，不提示 */ });
    return;
  }
  if (action === 'add') {
    const pathInput = $('#folder-add-path');
    const noteInput = $('#folder-add-note');
    const value = (pathInput?.value || '').trim();
    if (!value) {
      toast('先填一个文件夹路径', 'error');
      pathInput?.focus();
      return;
    }
    if (fs.busy) return;
    fs.busy = true;
    toolCall('folders.add', { path: value, note: (noteInput?.value || '').trim() })
      .then((data) => {
        fs.busy = false;
        applyFolders(data);
        if (pathInput) {
          pathInput.value = '';
          pathInput.focus();
        }
        if (noteInput) noteInput.value = '';
        if (state.mini) fs.miniAdding = false;
        toast('已加入清单', 'success');
      })
      .catch((error) => {
        fs.busy = false;
        toast(error.message, 'error');
      });
    return;
  }
  if (action === 'clearSelected') {
    fs.miniSelected.clear();
    paintFolders();
    return;
  }
  if (action === 'removeSelected') {
    const paths = Array.from(fs.miniSelected);
    if (!paths.length) return;
    showConfirm({
      title: `从清单移除 ${paths.length} 项？`,
      message: '只会删掉清单记录，文件夹本身不受影响。',
      confirmLabel: '移除',
      iconName: 'pin',
      danger: false,
      onConfirm: () => {
        let chain = Promise.resolve();
        paths.forEach((target) => {
          chain = chain.then(() => toolCall('folders.remove', { path: target }));
        });
        chain.then(() => {
          fs.miniSelected.clear();
          toast(`已移除 ${paths.length} 项`, 'success');
          loadFolders();
        }).catch((error) => toast(error.message, 'error'));
      },
    });
    return;
  }
  if (action === 'edit') {
    if (state.mini) {
      fs.miniEditing = path;
      paintFolders();
    } else {
      fs.editing = path;
      paintFolders();
    }
    return;
  }
  if (action === 'cancel-edit') {
    fs.editing = null;
    fs.miniEditing = null;
    paintFolders();
    return;
  }
  if (action === 'save-edit') {
    const newPath = ($('#folder-edit-path')?.value || '').trim();
    const note = ($('#folder-edit-note')?.value || '').trim();
    toolCall('folders.update', { oldPath: path, path: newPath, note })
      .then((data) => {
        fs.editing = null;
        fs.miniEditing = null;
        applyFolders(data);
        toast('已保存', 'success');
      })
      .catch((error) => toast(error.message, 'error'));
    return;
  }
  if (action === 'up' || action === 'down') {
    const moving = fs.miniSelected.has(path) && fs.miniSelected.size > 1
      ? Array.from(fs.miniSelected)
      : [path];
    toolCall('folders.move', { paths: moving, delta: action === 'up' ? -1 : 1 })
      .then(applyFolders)
      .catch((error) => toast(error.message, 'error'));
    return;
  }
  if (action === 'remove') {
    showConfirm({
      title: '从清单移除？',
      message: `只会删掉清单里的一条记录，文件夹本身不受影响。`,
      confirmLabel: '移除',
      iconName: 'pin',
      danger: false,
      onConfirm: () => {
        toolCall('folders.remove', { path })
          .then((data) => {
            if (foldersState().editing === path) foldersState().editing = null;
            if (foldersState().miniEditing === path) foldersState().miniEditing = null;
            applyFolders(data);
            toast('已从清单移除', 'success');
          })
          .catch((error) => toast(error.message, 'error'));
      },
    });
    return;
  }
  if (action === 'open' || action === 'reveal') {
    toolCall(action === 'open' ? 'folders.open' : 'folders.reveal', { path })
      .catch((error) => toast(error.message, 'error'));
    return;
  }
  if (action === 'copy') {
    toolCall('folders.copyPath', { path })
      .then(() => toast('路径已复制', 'success'))
      .catch((error) => toast(error.message, 'error'));
  }
}

/* 回车即提交，省得去点按钮 */
viewEl.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    if (event.target.id === 'folder-add-path' || event.target.id === 'folder-add-note') {
      event.preventDefault();
      handleFolderAction('add');
    } else if (event.target.id === 'folder-edit-path' || event.target.id === 'folder-edit-note') {
      event.preventDefault();
      handleFolderAction('save-edit',
        foldersState().editing || foldersState().miniEditing || '');
    }
    return;
  }
  if (!state.mini || state.view !== 'tool' || state.toolId !== 'folders') return;
  const fs = foldersState();
  const typing = event.target.matches && event.target.matches('input, textarea, select');
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    $('#mini-folder-search')?.focus();
    return;
  }
  if (event.key === 'Escape') {
    if (fs.miniMenu) {
      closeMiniFolderMenu();
      return;
    }
    if (fs.miniAdding) {
      fs.miniAdding = false;
      render();
      return;
    }
    if (fs.miniEditing) {
      fs.miniEditing = null;
      render();
      return;
    }
    if (fs.miniQuery) {
      fs.miniQuery = '';
      render();
    }
    return;
  }
  if (typing) return;
  if (event.key === 'Insert') {
    event.preventDefault();
    fs.miniAdding = true;
    render();
    setTimeout(() => $('#folder-add-path')?.focus(), 60);
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    miniFolderFiltered().forEach((item) => fs.miniSelected.add(item.path));
    paintFolders();
    return;
  }
  if (event.key === 'Delete') {
    event.preventDefault();
    handleFolderAction('removeSelected');
    return;
  }
  if (event.key === 'F2') {
    event.preventDefault();
    const first = Array.from(fs.miniSelected)[0] || (miniFolderFiltered()[0] || {}).path;
    if (first) handleFolderAction('edit', first);
    return;
  }
  if (/^[1-9]$/.test(event.key)) {
    const item = miniFolderFiltered()[Number(event.key) - 1];
    if (item) handleFolderAction('open', item.path);
  }
});

/* ============================================================
   视频整理（后端沿用 video-collector 的扫描/去重/复制引擎）
   ============================================================ */

function readVideoSettings() {
  try {
    return JSON.parse(localStorage.getItem('toolbox.videoSettings') || '{}') || {};
  } catch (_) {
    return {};
  }
}

// 常见的视频扩展名：勾选式面板用，顺序按「最常用在前」排。
const VIDEO_EXT_CHOICES = [
  'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'ts', 'm4v',
  'webm', 'mpg', 'mpeg', '3gp', 'rmvb', 'rm', 'vob', 'f4v',
  'asf', 'm2ts', 'mts', 'ogv', 'divx', 'dat', 'mxf', 'hevc',
];

function videoExtTokens() {
  return (videoState().exts || '')
    .split(',')
    .map((token) => token.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean);
}

function renderVideoExtChips() {
  const tokens = videoExtTokens();
  const extra = tokens.filter((token) => !VIDEO_EXT_CHOICES.includes(token));
  return VIDEO_EXT_CHOICES.map((ext) => `
      <button class="ext-chip ${tokens.includes(ext) ? 'on' : ''}" data-video-action="extToggle" data-path="${ext}"
              title="${tokens.includes(ext) ? '取消勾选' : '勾选'} .${ext}">${ext}</button>`).join('') +
    extra.map((ext) => `
      <button class="ext-chip on extra" data-video-action="extToggle" data-path="${escapeHtml(ext)}"
              title="点一下移除 .${escapeHtml(ext)}">${escapeHtml(ext)}</button>`).join('');
}

function renderVideoExtPanel() {
  const tokens = videoExtTokens();
  return `
    <div class="ext-panel">
      <div class="ext-panel-head">
        <span class="ext-title">扫描的扩展名</span>
        <span class="ext-count">${tokens.length ? `已勾选 ${tokens.length} 种` : '未勾选 = 全部格式'}</span>
        <span class="ext-spacer"></span>
        <button class="mini-btn" data-video-action="extAll">全选</button>
        <button class="mini-btn" data-video-action="extClear">清空</button>
      </div>
      <div class="ext-chips" id="video-ext-chips">${renderVideoExtChips()}</div>
      <div class="ext-add-row">
        <input class="ext-add" id="video-ext-add" placeholder="＋ 添加格式" spellcheck="false"
               title="输入后缀后按回车添加，可一次输入多个，用逗号分隔">
        <span class="ext-add-hint">回车添加，逗号可一次输多个</span>
      </div>
    </div>`;
}

// 把输入框里的内容并进 exts：去点、小写、去重。返回是否真的加进去了。
function addVideoExtTokens(raw) {
  const incoming = String(raw || '')
    .split(/[,，;；\s]+/)
    .map((token) => token.trim().replace(/^\./, '').toLowerCase())
    .filter(Boolean);
  if (!incoming.length) return false;
  const vs = videoState();
  const current = videoExtTokens();
  const next = current.slice();
  incoming.forEach((token) => {
    if (!next.includes(token)) next.push(token);
  });
  if (next.length === current.length) return false;
  vs.exts = next.join(',');
  saveVideoSettings(vs);
  syncVideoExtPanel();
  return true;
}

function syncVideoExtPanel() {
  const chips = $('#video-ext-chips');
  if (chips) chips.innerHTML = renderVideoExtChips();
  const count = document.querySelector('.ext-count');
  if (count) {
    const n = videoExtTokens().length;
    count.textContent = n ? `已勾选 ${n} 种` : '未勾选 = 全部格式';
  }
}

function saveVideoSettings(vs) {
  try {
    localStorage.setItem('toolbox.videoSettings', JSON.stringify({
      root: vs.root || '', allDrives: !!vs.allDrives,
      drives: vs.driveSel || null,
      minMB: Number(vs.minMB) || 0, maxMB: Number(vs.maxMB) || 0,
      minUnit: vs.minUnit || 'MB', maxUnit: vs.maxUnit || 'MB',
      exts: vs.exts || '', exclude: vs.exclude || '', skipHidden: !!vs.skipHidden,
      dst: vs.dst || '', move: !!vs.move, skipConflict: !!vs.skipConflict,
      dedupe: !!vs.dedupe, dedupeScan: !!vs.dedupeScan, openAfter: !!vs.openAfter,
    }));
  } catch (_) {}
}

function videoState() {
  if (!state.video) {
    const saved = readVideoSettings();
    state.video = {
      root: saved.root || '', allDrives: !!saved.allDrives,
      // null = 不限制（扫全部本地磁盘）；数组 = 用户勾中的盘符，空数组在扫描前会被拦下
      driveSel: Array.isArray(saved.drives) ? saved.drives : null, minMB: Number(saved.minMB) || 0,
      maxMB: Number(saved.maxMB) || 0, minUnit: saved.minUnit || 'MB', maxUnit: saved.maxUnit || 'MB',
      exts: saved.exts || '', exclude: saved.exclude || '', skipHidden: saved.skipHidden !== false,
      items: [], total: 0, scanning: false, dirs: 0, scanStats: null, truncated: false,
      dedupeScan: saved.dedupeScan === true, deduping: false, dupProgress: null, dupGroups: [],
      selected: new Set(),
      dst: saved.dst || '', move: !!saved.move, skipConflict: saved.skipConflict !== false, dedupe: saved.dedupe !== false,
      running: false, progress: null, collectStats: null, logs: [], undoing: false,
      meta: {}, metaPending: {}, metaQueue: [], metaTimer: null, observer: null, limit: 300,
      filter: '', statusFilter: 'all', openAfter: !!saved.openAfter, settingsOpen: !state.mini,
    };
  }
  return state.video;
}

// ── 通用磁盘勾选：大文件扫描 / 重复文件 / 空文件夹共用同一份选择 ──────────
// 三个工具都是"挑一个根目录扫"的模式，勾上全盘扫描后同样可以只挑某几块盘，
// 选择结果存一份，在三个页面之间保持一致。
const DRIVE_SCOPED_TOOLS = ['large-files', 'duplicates', 'empty-folders', 'disk-checkup'];

function driveScope() {
  if (!state.driveScope) {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem('toolbox.driveScope') || 'null');
    } catch (_) {}
    state.driveScope = {
      allDrives: !!(saved && saved.allDrives),
      sel: saved && Array.isArray(saved.sel) ? saved.sel : null,
    };
  }
  return state.driveScope;
}

function saveDriveScope() {
  const scope = driveScope();
  try {
    localStorage.setItem('toolbox.driveScope', JSON.stringify({ allDrives: scope.allDrives, sel: scope.sel }));
  } catch (_) {}
}

function loadDriveList() {
  if (state.driveListLoading || state.driveList) return;
  state.driveListLoading = true;
  toolCall('fs.drives', {}).then((data) => {
    state.driveList = (data && data.drives) || [];
    state.driveListLoading = false;
    if (DRIVE_SCOPED_TOOLS.includes(state.toolId)) render();
  }).catch(() => {
    state.driveListLoading = false;
  });
}

// 和视频页那套盘符条同构：默认全选，点一下取消/恢复，右侧按钮整体切换。
function driveBarHtml() {
  const list = state.driveList;
  const scope = driveScope();
  if (!list) {
    return `<div class="drive-picker is-loading"><span class="drive-picker-label">扫描磁盘</span><span class="muted">正在读取磁盘…</span></div>`;
  }
  if (!list.length) {
    return `<div class="drive-picker is-loading"><span class="drive-picker-label">扫描磁盘</span><span class="muted">没有找到本地磁盘</span></div>`;
  }
  const chosen = (letter) => !scope.sel || scope.sel.includes(letter);
  const count = scope.sel ? list.filter((d) => scope.sel.includes(d.letter)).length : list.length;
  const chips = list.map((d) => `
    <button class="drive-chip ${chosen(d.letter) ? 'on' : ''}" data-drive-pick="${escapeHtml(d.letter)}"
      title="${escapeHtml(d.label || '本地磁盘')} · 共 ${formatBytes(d.total)}，可用 ${formatBytes(d.free)}">
      <span class="drive-letter">${escapeHtml(d.letter)}</span>
      <span class="drive-free">${formatBytes(d.free)}</span>
    </button>`).join('');
  return `
    <div class="drive-picker">
      <span class="drive-picker-label">扫描磁盘 <span class="muted">${count}/${list.length}</span></span>
      <div class="drive-chips">${chips}</div>
      <button class="mini-btn" data-drive-all="1">${count === list.length ? '全不选' : '全选'}</button>
    </div>`;
}

// 组装扫描请求的根目录字段：
// - 没勾全盘：走单根 root
// - 勾了全盘且全选：roots 传空数组，由后端枚举全部本地磁盘
// - 勾了全盘但只挑了几块：roots 传选中的盘
// 返回 null 表示"一块盘都没选"，调用方应拦下并提示。
function scanRootsPayload() {
  const scope = driveScope();
  if (scope.allDrives && Array.isArray(scope.sel) && !scope.sel.length) return null;
  if (!scope.allDrives) return {};
  return { roots: Array.isArray(scope.sel) && scope.sel.length ? scope.sel : [] };
}

function loadVideoDrives() {
  if (state.videoDriveLoading || state.videoDriveList) return;
  state.videoDriveLoading = true;
  toolCall('video.drives', {}).then((data) => {
    state.videoDriveList = (data && data.drives) || [];
    state.videoDriveLoading = false;
    if (state.toolId === 'video-collector') render();
  }).catch(() => {
    state.videoDriveLoading = false;
  });
}

// 「全盘扫描」打开后，路径框换成磁盘勾选条：默认全选，可以只挑某几块盘。
// 这样开关才有明确含义——不然用户只能猜它到底扫哪几块盘。
function renderVideoDrivePicker(vs) {
  const list = state.videoDriveList;
  if (!list) {
    return `<div class="drive-picker is-loading"><span class="drive-picker-label">扫描磁盘</span><span class="muted">正在读取磁盘…</span></div>`;
  }
  if (!list.length) {
    return `<div class="drive-picker is-loading"><span class="drive-picker-label">扫描磁盘</span><span class="muted">没有找到本地磁盘</span></div>`;
  }
  const sel = vs.driveSel;
  const chosen = (letter) => !sel || sel.includes(letter);
  const count = sel ? list.filter((d) => sel.includes(d.letter)).length : list.length;
  const chips = list.map((d) => `
    <button class="drive-chip ${chosen(d.letter) ? 'on' : ''}" data-video-action="driveToggle"
      data-path="${escapeHtml(d.letter)}"
      title="${escapeHtml(d.label || '本地磁盘')} · 共 ${formatBytes(d.total)}，可用 ${formatBytes(d.free)}">
      <span class="drive-letter">${escapeHtml(d.letter)}</span>
      <span class="drive-free">${formatBytes(d.free)}</span>
    </button>`).join('');
  return `
    <div class="drive-picker">
      <span class="drive-picker-label">扫描磁盘 <span class="muted">${count}/${list.length}</span></span>
      <div class="drive-chips">${chips}</div>
      <button class="mini-btn" data-video-action="driveAll">${count === list.length ? '全不选' : '全选'}</button>
    </div>`;
}

function renderVideoCollector(tool) {
  const vs = videoState();
  return `
    ${pageHead(tool, '文件 / 视频归档')}    <div class="panel">
      <div class="toolbar">
        ${vs.allDrives ? renderVideoDrivePicker(vs) : `
        <div class="path-field">
          ${icon('folder', 15)}
          <input id="video-root" readonly placeholder="选择要扫描的文件夹" value="${escapeHtml(vs.root)}">
          <button class="mini-btn" data-video-action="pickSrc">浏览</button>
        </div>`}
        <label class="switch-field" title="打开后按磁盘扫描，可勾选要扫哪几块盘">
          <input type="checkbox" id="video-all-drives" ${vs.allDrives ? 'checked' : ''}>
          <span class="switch"></span>全盘扫描
        </label>
        <label class="field">最小体积
          ${sizeFieldHtml('video-min', (Number(vs.minMB) || 0) * SIZE_FACTOR.MB, vs.minUnit, { label: '最小体积', placeholder: '不限' })}
        </label>
        <button class="btn primary" id="video-scan-btn" data-video-action="scan" ${vs.scanning || vs.running ? 'disabled' : ''}>${icon('scan', 15)} 开始扫描</button>
        <button class="btn ghost small video-settings-toggle" data-video-action="toggleSettings" title="扫描设置">${icon('filter', 14)} <span class="btn-label">设置</span></button>
        <button class="btn danger-ghost" id="video-scan-cancel" data-video-action="cancel" ${vs.scanning ? '' : 'hidden'}>取消</button>
      </div>
      ${vs.settingsOpen ? `<div class="video-settings">
        ${renderVideoExtPanel()}
        <div class="video-settings-row">
          <label class="field">最大体积
            ${sizeFieldHtml('video-max', (Number(vs.maxMB) || 0) * SIZE_FACTOR.MB, vs.maxUnit, { label: '最大体积', placeholder: '不限' })}
          </label>
          <label class="switch-field">
            <input type="checkbox" id="video-hidden" ${vs.skipHidden ? 'checked' : ''}>
            <span class="switch"></span>跳过隐藏文件
          </label>
          <label class="switch-field" title="扫描结束后按大小与首/中/尾指纹找出同内容视频，只标记不删除">
            <input type="checkbox" id="video-dedupe-scan" ${vs.dedupeScan ? 'checked' : ''}>
            <span class="switch"></span>扫描后按内容分组
          </label>
          <label class="field" style="flex:1 1 220px">排除目录名
            <input id="video-exclude" placeholder="如 node_modules,缓存" value="${escapeHtml(vs.exclude)}" spellcheck="false">
          </label>
        </div>
      </div>` : ''}
      <div id="video-status">${renderVideoStatus()}</div>
    </div>
    <div class="panel">
      <div id="video-summary">${renderVideoSummary()}</div>
      <div id="video-list">${renderVideoBody()}</div>
    </div>
    <div class="panel">
      <div class="toolbar">
        <div class="path-field">
          ${icon('folder-open', 15)}
          <input id="video-dst" readonly placeholder="整理到哪个文件夹" value="${escapeHtml(vs.dst)}">
          <button class="mini-btn" data-video-action="pickDst">浏览</button>
        </div>
        <label class="field">方式
          <select id="video-mode">
            <option value="copy" ${vs.move ? '' : 'selected'}>复制（保留原文件）</option>
            <option value="move" ${vs.move ? 'selected' : ''}>移动</option>
          </select>
        </label>
        <label class="switch-field">
          <input type="checkbox" id="video-dedupe" ${vs.dedupe ? 'checked' : ''}>
          <span class="switch"></span>内容去重
        </label>
        <label class="switch-field">
          <input type="checkbox" id="video-skip" ${vs.skipConflict ? 'checked' : ''}>
          <span class="switch"></span>同名跳过
        </label>
        <label class="switch-field">
          <input type="checkbox" id="video-open-after" ${vs.openAfter ? 'checked' : ''}>
          <span class="switch"></span>完成后打开目标
        </label>
        <button class="btn ghost small" data-video-action="openDst" ${vs.dst ? '' : 'disabled'}>${icon('folder-open', 13)} 打开目标</button>
        <button class="btn primary" id="video-collect-btn" data-video-action="collect" ${vs.running || vs.scanning || !vs.selected.size ? 'disabled' : ''}>${icon('folder-open', 15)} 整理选中（${vs.selected.size}）</button>
        <button class="btn danger-ghost" id="video-collect-cancel" data-video-action="cancel" ${vs.running ? '' : 'hidden'}>取消</button>
      </div>
      <div id="video-progress">${renderVideoProgress()}</div>
      <div class="video-log" id="video-log">${renderVideoLog()}</div>
    </div>`;
}
