// ---- 第 3/8 块：本块起始于 function cancelOrganizerPreview() { ----
function cancelOrganizerPreview() {
  const o = state.organizer;
  o.previewItems = [];
  o.previewPayload = null;
  o.previewWarning = '';
  o.previewing = false;
  o.items = [];
  o.stats = null;
  o.error = '';
  render();
}

function executeOrganizerPreview() {
  const o = state.organizer;
  const payload = o.previewPayload;
  if (!payload) return;
  const movable = o.previewItems.filter((it) => it.ok).length;
  if (!movable) {
    toast('预览里没有可执行的文件', 'error');
    return;
  }
  const runSubmit = () => {
    o.previewItems = [];
    o.previewPayload = null;
    o.previewWarning = '';
    o.previewing = false;
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
    post({ type: 'organizeFiles', payload: { ...payload, previewOnly: false } });
  };
  // 覆盖模式下如有目标重名，二次确认，避免静默覆盖用户文件
  const willOverwrite = o.conflict === 'overwrite' &&
    o.previewItems.some((it) => it.ok && it.conflict);
  if (willOverwrite) {
    showConfirm({
      title: '将覆盖同名文件？',
      message: '当前是「覆盖」重名策略，以下目标位置已有同名文件，执行会直接覆盖它们（原文件将丢失）。确认继续吗？',
      confirmLabel: '确认覆盖',
      iconName: 'trash',
      danger: true,
      onConfirm: runSubmit,
    });
    return;
  }
  runSubmit();
}

function persistOrganizerUndo() {
  try {
    if (state.organizer.lastMoved.length) {
      localStorage.setItem('toolsoft.organizerUndo.v1', JSON.stringify(state.organizer.lastMoved));
    } else {
      localStorage.removeItem('toolsoft.organizerUndo.v1');
    }
  } catch { /* localStorage full; keep the in-memory record */ }
}

function undoOrganizer() {
  const o = state.organizer;
  if (o.running || !o.lastMoved.length) return;
  showConfirm({
    title: '撤销这次整理？',
    message: `将把 ${o.lastMoved.length} 个文件移回原位置。已预检跳过、原位置被占用或文件已被移动的项会保留在撤销记录中，不会覆盖任何现有文件。`,
    confirmLabel: '撤销整理',
    iconName: 'refresh',
    danger: false,
    onConfirm: async () => {
      clearRunningStates();
      const all = o.lastMoved.slice();
      // 预检：确认每个待撤销文件(from)仍存在，且原位置(to)无同名冲突，避免覆盖用户文件
      const paths = [];
      all.forEach((pair) => { paths.push(pair.from); paths.push(pair.to); });
      const checked = await requestHost({ type: 'checkPaths', payload: { paths } });
      const ex = Array.isArray(checked.existing) ? checked.existing : [];
      const toUndo = [];
      const skipped = [];
      all.forEach((pair, i) => {
        const fromExists = !!ex[i * 2];
        const toFree = !ex[i * 2 + 1];
        if (fromExists && toFree) toUndo.push(pair);
        else skipped.push(pair);
      });
      if (!toUndo.length) {
        toast('没有可撤销的文件：源文件已不存在，或原位置已被同名文件占用', 'error');
        render();
        return;
      }
      o.pendingUndoFrom = new Set(toUndo.map((pair) => pair.from));
      o.undoSkip = skipped;
      const requestId = uid();
      o.undoing = true;
      o.running = true;
      o.error = '';
      render();
      post({ type: 'renamePairs', requestId, payload: { items: toUndo } });
    },
  });
}

function renameErrorFrom(line) {
  // 后端错误行形如 "from -> to (错误码 N)"；用 lastIndexOf 解析，容忍文件名本身含 " -> "
  const s = String(line);
  const errIdx = s.lastIndexOf(' (错误码 ');
  const fromTo = errIdx > 0 ? s.slice(0, errIdx) : s;
  const arrow = fromTo.lastIndexOf(' -> ');
  return arrow > 0 ? fromTo.slice(0, arrow) : fromTo;
}

function handleOrganizerUndoDone(payload) {
  const o = state.organizer;
  const okCount = Number(payload.okCount) || 0;
  const failCount = Number(payload.failCount) || 0;
  const failedFrom = new Set((Array.isArray(payload.errors) ? payload.errors : [])
    .map(renameErrorFrom));
  const currentByFrom = new Map((Array.isArray(o.lastMoved) ? o.lastMoved : [])
    .map((p) => [p.from, p]));
  const remaining = [];
  const pushUnique = (p) => {
    if (p && !remaining.some((x) => x.from === p.from)) remaining.push(p);
  };
  // 保留：源文件已不存在/原位置被占用的预检跳过项，以及本次撤销失败项
  (Array.isArray(o.undoSkip) ? o.undoSkip : []).forEach(pushUnique);
  Array.from(failedFrom).forEach((from) => pushUnique(currentByFrom.get(from)));
  o.lastMoved = remaining;
  o.pendingUndoFrom = null;
  o.undoSkip = [];
  o.undoing = false;
  o.running = false;
  if (!o.lastMoved.length && failCount === 0) {
    o.items = [];
    o.movedCount = 0;
    o.failCount = 0;
    o.stats = null;
  }
  persistOrganizerUndo();
  if (state.view === 'tool' && state.toolId === 'file-organizer') refreshOrganizePage();
  if (okCount) {
    const leftover = o.lastMoved.length;
    const tail = leftover ? `，${formatNumber(leftover)} 个仍待处理` : '';
    toast(`已撤销 ${formatNumber(okCount)} 个文件${failCount ? `，${formatNumber(failCount)} 个失败` : ''}${tail}`,
          failCount || leftover ? 'info' : 'success');
  } else {
    toast(`撤销失败${failCount ? `（${formatNumber(failCount)} 个文件，可重试）` : ''}`, 'error');
  }
}

function refreshOrganizePage() {
  const o = state.organizer;
  const preview = $('#organizer-preview');
  const undoBar = $('#organizer-undo-bar');
  const status = $('#organizer-status');
  const results = $('#organizer-results');
  const dup = $('#organizer-dup');
  if (preview) preview.innerHTML = renderOrganizerPreview();
  if (undoBar) undoBar.innerHTML = renderOrganizerUndoBar();
  if (status) status.innerHTML = renderOrganizerStatus();
  if (results) results.innerHTML = renderOrganizerResults();
  if (dup) dup.innerHTML = renderOrganizerDupHint();
  syncToolbarState();
}

// 刷新除「规则编辑区」外的所有组织容器，供预览失效等场景使用，
// 以免重建规则表导致用户正在编辑的输入框丢焦点。
function refreshOrganizeNonRules() {
  const preview = $('#organizer-preview');
  const undoBar = $('#organizer-undo-bar');
  const status = $('#organizer-status');
  const results = $('#organizer-results');
  const dup = $('#organizer-dup');
  if (preview) preview.innerHTML = renderOrganizerPreview();
  if (undoBar) undoBar.innerHTML = renderOrganizerUndoBar();
  if (status) status.innerHTML = renderOrganizerStatus();
  if (results) results.innerHTML = renderOrganizerResults();
  if (dup) dup.innerHTML = renderOrganizerDupHint();
}

function handleOrganizeDone(payload) {
  const o = state.organizer;
  const isPreview = Boolean(payload.preview) || o.previewing;
  o.running = false;
  const resultItems = Array.isArray(payload.items) ? payload.items : [];
  o.stats = payload.stats || null;
  o.matched = payload.matched || 0;
  o.matchedBytes = Number(payload.matchedBytes) || 0;
  o.elapsedMs = payload.elapsedMs || 0;
  o.cancelled = Boolean(payload.cancelled);
  o.truncated = Boolean(payload.truncated);
  o.error = payload.error || '';

  if (isPreview) {
    o.previewing = false;
    o.previewItems = resultItems;
    o.items = [];
    o.movedCount = 0;
    o.failCount = 0;
    o.skippedCount = resultItems.filter((it) => it.skipped).length;
    if (state.view === 'tool' && state.toolId === 'file-organizer') refreshOrganizePage();
    if (o.error) toast(o.error, 'error');
    else if (o.cancelled) toast('预览已取消');
    else if (resultItems.length) toast(`预览完成：${formatNumber(resultItems.filter((it) => it.ok).length)} 个文件待确认`, 'success');
    else toast('没有文件命中整理规则', 'info');
    return;
  }

  o.items = resultItems;
  o.previewItems = [];
  o.previewPayload = null;
  o.previewWarning = '';
  o.movedCount = o.items.filter((it) => it.ok).length;
  o.skippedCount = o.items.filter((it) => it.skipped).length;
  o.failCount = o.items.length - o.movedCount - o.skippedCount;
  o.lastMoved = o.items.filter((it) => it.ok).map((it) => ({ from: it.to, to: it.from }));
  persistOrganizerUndo();
  if (state.view === 'tool' && state.toolId === 'file-organizer') refreshOrganizePage();
  if (o.error) toast(o.error, 'error');
  else if (o.cancelled) toast('整理已取消');
  else toast(`已整理 ${formatNumber(o.movedCount)} 个文件` + (o.skippedCount ? `，跳过 ${formatNumber(o.skippedCount)} 个` : '') + (o.failCount ? `，${formatNumber(o.failCount)} 个失败` : ''), 'success');

  // 联动：整理后针对目标目录查找重复文件（复用后端 scanDuplicates + state.dup）
  if (!o.error && !o.cancelled && o.checkDuplicates && o.movedCount > 0) {
    const scanRoot = o.targetRoot || o.root;
    o.waitingDup = true;
    o.ranRecheck = false;
    state.dup.root = scanRoot;
    state.dup.source = 'organizer';
    state.dup.running = true;
    state.dup.error = '';
    post({ type: 'scanDuplicates', payload: { root: scanRoot, minSizeBytes: 1024 * 1024 } });
    // 立即展示联动扫重进度条（handleOrganizeDone 已在发起前刷新过页面）
    if (state.view === 'tool' && state.toolId === 'file-organizer') refreshOrganizePage();
  }
}

function renderSpaceAnalyzer(tool) {
  const space = state.space;
  return `
    ${pageHead(tool, '磁盘 / 空间分析')}
    <div class="panel">
      <div class="toolbar">
        <button class="mini-btn" id="space-up" ${space.history.length ? '' : 'disabled'}>${icon('arrow-left', 12)} 上一级</button>
        <div class="path-field">
          ${icon('drive', 15)}
          <input id="space-path" readonly placeholder="选择要分析的文件夹" value="${escapeHtml(space.root)}">
          <button class="mini-btn" id="space-pick">浏览</button>
        </div>
        <button class="btn primary" id="space-start" ${space.running ? 'disabled' : ''}>${icon('pie', 15)} 分析空间</button>
        <button class="btn danger-ghost" id="space-cancel" ${space.running ? '' : 'hidden'}>取消</button>
      </div>
      <div id="space-status">${renderSpaceStatus()}</div>
      <div id="space-results">${renderSpaceResults()}</div>
    </div>`;
}

function renderSpaceStatus() {
  const space = state.space;
  if (space.running) {
    return `
      <div class="progress-card">
        <div class="progress-top">
          <div class="progress-title"><span class="spinner"></span>正在统计子目录大小</div>
          <div class="progress-counts" id="space-counts">0 个目录</div>
        </div>
        <div class="progress-track"><span></span></div>
        <div class="progress-current" id="space-current">正在读取目录…</div>
      </div>`;
  }
  if (space.error) {
    return `<div class="summary-strip"><span class="summary-chip"><strong style="color:var(--danger)">${escapeHtml(space.error)}</strong></span></div>`;
  }
  if (space.stats) {
    return `<div class="summary-strip">
      <span class="summary-chip good">总计 <strong>${formatBytes(space.total)}</strong></span>
      <span class="summary-chip">${formatNumber(space.stats.dirs)} 个目录</span>
      <span class="summary-chip">${formatNumber(space.stats.files)} 个文件</span>
      <span class="summary-chip">用时 <strong>${formatElapsed(space.elapsedMs)}</strong></span>
      ${space.cancelled ? '<span class="summary-chip">已取消</span>' : ''}
    </div>`;
  }
  return '';
}

function renderSpaceResults() {
  const space = state.space;
  if (space.running) return renderSkeleton(6);
  if (!space.entries.length) {
    if (space.stats) {
      return `<div class="empty-state"><div class="empty-orb">${icon('check-circle', 27)}</div><h3>这个文件夹是空的</h3><p>没有可统计的文件或子目录。</p></div>`;
    }
    return `<div class="empty-state"><div class="empty-orb">${icon('pie', 27)}</div><h3>看看空间都被谁吃掉了</h3><p>选择文件夹后，列出每个子目录和文件的大小；点击目录可以继续下钻。</p></div>`;
  }

  const denominator = Math.max(space.total, 1);
  return `
    <div class="space-list">
      ${space.entries.map((entry, index) => {
        const percent = Math.min(100, (entry.size / denominator) * 100);
        return `
          <div class="space-row" ${entry.isDir ? `data-space-index="${index}" tabindex="0" role="button"` : ''}>
            <span class="space-icon ${entry.isDir ? 'folder' : 'file'}">${icon(entry.isDir ? 'folder' : 'file', 17)}</span>
            <div class="space-name">
              <strong>${escapeHtml(entry.name)}</strong>
              <span title="${escapeHtml(entry.path)}">${escapeHtml(entry.isDir ? '文件夹' : '文件')}</span>
            </div>
            <div class="space-bar"><span style="width:${percent}%"></span></div>
            <span class="space-size">${formatBytes(entry.size)}</span>
            <span class="space-pct">${percent.toFixed(percent >= 10 ? 0 : 1)}%</span>
            <button class="row-btn" data-action="reveal" data-path="${escapeHtml(entry.path)}" title="在资源管理器中定位">${icon('folder-open', 13)}</button>
            <button class="row-btn" data-action="copy-path" data-path="${escapeHtml(entry.path)}" title="复制完整路径">${icon('copy', 13)}</button>
            <span class="space-arrow">${entry.isDir ? icon('chevron-right', 14) : ''}</span>
          </div>`;
      }).join('')}
    </div>`;
}

function computeRenamePreview() {
  const rename = state.rename;
  const files = rename.files || [];
  const existing = new Set(files.map((file) => file.name.toLowerCase()));
  const used = new Set();
  const preview = [];
  let regex = null;
  let error = '';

  if (rename.regex && rename.find) {
    try {
      regex = new RegExp(rename.find, 'g');
    } catch {
      error = '正则表达式无效';
    }
  }

  files.forEach((file, index) => {
    const dot = file.name.lastIndexOf('.');
    const hasExtension = dot > 0;
    const stem = hasExtension ? file.name.slice(0, dot) : file.name;
    const extension = hasExtension ? file.name.slice(dot) : '';

    let nextStem = stem;
    if (rename.find && !error) {
      nextStem = regex
        ? nextStem.replace(regex, rename.replace)
        : nextStem.split(rename.find).join(rename.replace);
    }
    if (rename.prefix) nextStem = rename.prefix + nextStem;
    if (rename.suffix) nextStem = nextStem + rename.suffix;
    if (rename.numbering) {
      const start = Number(rename.start) || 1;
      const digits = Math.max(1, Math.min(8, Number(rename.digits) || 3));
      nextStem += `-${String(start + index).padStart(digits, '0')}`;
    }

    const newName = nextStem + extension;
    const unchanged = newName === file.name;
    const conflict = !unchanged && (existing.has(newName.toLowerCase()) || used.has(newName.toLowerCase()));
    used.add(newName.toLowerCase());
    preview.push({
      oldPath: file.path,
      name: file.name,
      newName,
      newPath: replaceFileName(file.path, newName),
      unchanged,
      conflict,
      ok: !unchanged && !conflict,
    });
  });

  return { preview, error };
}

function renderRename(tool) {
  const rename = state.rename;
  const result = computeRenamePreview();
  rename.preview = result.preview;
  const conflicts = result.preview.filter((item) => item.conflict).length;
  const readyCount = result.preview.filter((item) => item.ok).length;
  const canApply = readyCount > 0 && conflicts === 0;

  return `
    ${pageHead(tool, '文件 / 批处理')}
    <div class="panel">
      <div class="toolbar">
        <div class="path-field">
          ${icon('folder', 15)}
          <input id="rename-path" readonly placeholder="选择要重命名的文件夹" value="${escapeHtml(rename.root)}">
          <button class="mini-btn" id="rename-pick">浏览</button>
        </div>
        <button class="mini-btn" id="rename-refresh" ${rename.root ? '' : 'disabled'}>${icon('refresh', 12)} 重新读取</button>
        <button class="btn primary" id="rename-apply" ${canApply ? '' : 'disabled'}>${icon('edit', 15)} 应用重命名</button>
        <button class="btn ghost" id="rename-undo" ${rename.lastApplied ? '' : 'disabled'}>撤销上一次</button>
      </div>
      <div class="rename-form">
        <label class="form-field"><span>查找</span><input id="rename-find" value="${escapeHtml(rename.find)}" placeholder="要替换的文字"></label>
        <label class="form-field"><span>替换为</span><input id="rename-replace" value="${escapeHtml(rename.replace)}" placeholder="留空表示删除"></label>
        <label class="form-field"><span>前缀</span><input id="rename-prefix" value="${escapeHtml(rename.prefix)}" placeholder="可选"></label>
        <label class="form-field"><span>后缀</span><input id="rename-suffix" value="${escapeHtml(rename.suffix)}" placeholder="可选"></label>
        <label class="form-field"><span>序号起始</span><input id="rename-start" type="number" min="0" max="9999" value="${Number(rename.start) || 1}"></label>
        <label class="form-field"><span>序号位数</span>
          <select id="rename-digits">
            ${[2, 3, 4].map((value) => `<option value="${value}" ${Number(rename.digits) === value ? 'selected' : ''}>${value} 位</option>`).join('')}
          </select>
        </label>
        <label class="switch-field"><input type="checkbox" id="rename-regex" ${rename.regex ? 'checked' : ''}><span class="switch"></span>正则查找</label>
        <label class="switch-field"><input type="checkbox" id="rename-numbering" ${rename.numbering ? 'checked' : ''}><span class="switch"></span>追加序号</label>
      </div>
      <div id="rename-status" class="summary-strip">
        ${result.error
          ? `<span class="summary-chip"><strong style="color:var(--danger)">${escapeHtml(result.error)}</strong></span>`
          : `<span class="summary-chip">${rename.files.length} 个文件</span>
             <span class="summary-chip">${readyCount} 个待重命名</span>
             ${conflicts ? `<span class="summary-chip"><strong style="color:var(--danger)">${conflicts} 个冲突</strong></span>` : ''}`}
      </div>
      <div id="rename-preview">${renderRenamePreview(result)}</div>
    </div>`;
}

function renderRenamePreview(result) {
  const rename = state.rename;
  if (rename.loading) return renderSkeleton(5);
  if (!rename.root) {
    return `<div class="empty-state"><div class="empty-orb">${icon('edit', 27)}</div><h3>先选择一个文件夹</h3><p>只处理当前目录下的文件，不会递归进入子目录。所有改动先预览，再执行。</p></div>`;
  }
  if (!rename.files.length) {
    return `<div class="empty-state"><div class="empty-orb">${icon('folder-open', 27)}</div><h3>这个目录里没有文件</h3><p>换一个目录，或者刷新后再试。</p></div>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>原名称</th><th>新名称</th><th class="col-rename-state">状态</th></tr></thead>
        <tbody>
          ${result.preview.map((item) => `
            <tr class="${item.conflict ? 'rename-conflict' : ''}">
              <td class="rename-old">${escapeHtml(item.name)}</td>
              <td class="rename-new">${escapeHtml(item.newName)}</td>
              <td class="rename-state ${item.conflict ? 'bad' : item.unchanged ? 'same' : 'good'}">
                ${item.conflict ? '冲突' : item.unchanged ? '不变' : '待重命名'}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function refreshRenamePreview() {
  const result = computeRenamePreview();
  state.rename.preview = result.preview;
  const preview = $('#rename-preview');
  const status = $('#rename-status');
  if (preview) preview.innerHTML = renderRenamePreview(result);
  if (status) {
    const conflicts = result.preview.filter((item) => item.conflict).length;
    const readyCount = result.preview.filter((item) => item.ok).length;
    status.innerHTML = result.error
      ? `<span class="summary-chip"><strong style="color:var(--danger)">${escapeHtml(result.error)}</strong></span>`
      : `<span class="summary-chip">${state.rename.files.length} 个文件</span>
         <span class="summary-chip">${readyCount} 个待重命名</span>
         ${conflicts ? `<span class="summary-chip"><strong style="color:var(--danger)">${conflicts} 个冲突</strong></span>` : ''}`;
  }
  const apply = $('#rename-apply');
  if (apply) {
    apply.disabled = !(result.preview.some((item) => item.ok) && !result.preview.some((item) => item.conflict));
  }
  const undo = $('#rename-undo');
  if (undo) undo.disabled = !state.rename.lastApplied;
}

function renderHashCheck(tool) {
  const hash = state.hash;
  return `
    ${pageHead(tool, '文件 / 校验')}
    <div class="panel">
      <div class="toolbar">
        <div class="path-field">
          ${icon('folder', 15)}
          <input id="hash-path" readonly placeholder="选择要计算哈希的文件夹" value="${escapeHtml(hash.root)}">
          <button class="mini-btn" id="hash-pick">浏览</button>
        </div>
        <label class="switch-field"><input type="checkbox" id="hash-recursive" ${hash.recursive ? 'checked' : ''}><span class="switch"></span>包含子目录</label>
        <button class="btn primary" id="hash-start" ${hash.running ? 'disabled' : ''}>${icon('hash', 15)} 计算 SHA-256</button>
        <button class="btn danger-ghost" id="hash-cancel" ${hash.running ? '' : 'hidden'}>取消</button>
      </div>
      <div id="hash-status">${renderHashStatus()}</div>
      <div id="hash-results">${renderHashResults()}</div>
    </div>`;
}

function renderHashStatus() {
  const hash = state.hash;
  if (hash.running) {
    return `
      <div class="progress-card">
        <div class="progress-top">
          <div class="progress-title"><span class="spinner"></span>正在计算 SHA-256</div>
          <div class="progress-counts" id="hash-counts">0 个文件</div>
        </div>
        <div class="progress-track"><span></span></div>
        <div class="progress-current" id="hash-current">正在读取文件…</div>
      </div>`;
  }
  if (hash.error) {
    return `<div class="summary-strip"><span class="summary-chip"><strong style="color:var(--danger)">${escapeHtml(hash.error)}</strong></span></div>`;
  }
  if (hash.stats) {
    return `<div class="summary-strip">
      <span class="summary-chip">文件 <strong>${formatNumber(hash.stats.files)}</strong> 个</span>
      <span class="summary-chip">大小 <strong>${formatBytes(hash.stats.bytes)}</strong></span>
      <span class="summary-chip">用时 <strong>${formatElapsed(hash.elapsedMs)}</strong></span>
      ${hash.cancelled ? '<span class="summary-chip">已取消</span>' : ''}
    </div>`;
  }
  return '';
}

function renderHashResults() {
  const hash = state.hash;
  if (hash.running) return renderSkeleton(5);
  if (!hash.items.length) {
    if (hash.stats) {
      return `<div class="empty-state"><div class="empty-orb">${icon('hash', 27)}</div><h3>没有可计算的文件</h3><p>这个文件夹里没有文件。</p></div>`;
    }
    return `<div class="empty-state"><div class="empty-orb">${icon('hash', 27)}</div><h3>批量计算 SHA-256</h3><p>选择文件夹后，为每个文件生成 SHA-256；复制前后对比，就能确认文件是否完整。</p></div>`;
  }

  // 表头点击可按名称 / 大小排序（行操作都靠路径，不依赖下标）
  const rows = applyTableSort(hash.items, 'hash', {
    name: (item) => item.name || '',
    size: (item) => Number(item.size) || 0,
  }, 'name');
  return `
    <div class="results">
      <div class="results-head"><div><h3>哈希结果 <span class="count-pill">${hash.items.length}</span></h3><p>点击右侧按钮复制完整哈希</p></div></div>
      ${hash.truncated ? `<p class="fin-note">文件过多，仅计算前 2000 个；可分批选择子目录。</p>` : ''}
      <div class="table-wrap">
        <table>
          <thead><tr><th class="col-name sortable" data-sort-scope="hash" data-sort-key="name" title="点击按名称排序">文件${sortMarkOf('hash', 'name')}</th><th class="col-size sortable" data-sort-scope="hash" data-sort-key="size" title="点击按体积排序">大小${sortMarkOf('hash', 'size')}</th><th>SHA-256</th><th class="col-actions"></th></tr></thead>
          <tbody>
            ${rows.map((item, index) => `
              <tr>
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
                <td><code class="hash-cell" title="${escapeHtml(item.hash || item.error)}">${item.ok ? `${escapeHtml(item.hash.slice(0, 20))}…` : `<span style="color:var(--danger)">${escapeHtml(item.error || '失败')}</span>`}</code></td>
                <td class="col-actions">
                  <div class="row-actions">
                    <button class="row-btn" data-action="copy-hash" data-hash="${escapeHtml(item.hash)}" title="复制哈希">${icon('copy', 13)}</button>
                    <button class="row-btn" data-action="reveal" data-path="${escapeHtml(item.path)}" title="在资源管理器中定位">${icon('folder-open', 13)}</button>
                    <button class="row-btn" data-action="copy-path" data-path="${escapeHtml(item.path)}" title="复制完整路径">${icon('copy', 13)}</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderTempCleaner(tool) {
  const temp = state.temp;
  return `
    ${pageHead(tool, '系统 / 清理')}
    <div class="panel">
      <div class="warn-panel">
        <span class="warn-icon">${icon('alert', 18)}</span>
        <div><strong>只清理 7 天未修改的临时文件与缓存</strong><p>不会碰文档、下载和系统目录；默认不勾选任何项目，确认列表后再操作。</p></div>
      </div>
      <div class="toolbar">
        <button class="btn primary" id="temp-start" ${temp.running ? 'disabled' : ''}>${icon('broom', 15)} 扫描临时文件</button>
        <button class="btn danger-ghost" id="temp-cancel" ${temp.running ? '' : 'hidden'}>取消</button>
        <span class="toolbar-note">扫描可能在几秒到几十秒之间，取决于缓存大小。</span>
      </div>
      <div id="temp-status">${renderTempStatus()}</div>
      <div id="temp-results">${renderTempResults()}</div>
    </div>`;
}

function renderTempStatus() {
  const temp = state.temp;
  if (temp.running) {
    return `
      <div class="progress-card">
        <div class="progress-top">
          <div class="progress-title"><span class="spinner"></span>正在检查缓存目录</div>
          <div class="progress-counts" id="temp-counts">0 个文件</div>
        </div>
        <div class="progress-track"><span></span></div>
        <div class="progress-current" id="temp-current">正在读取目录…</div>
      </div>`;
  }
  if (temp.error) {
    return `<div class="summary-strip"><span class="summary-chip"><strong style="color:var(--danger)">${escapeHtml(temp.error)}</strong></span></div>`;
  }
  if (temp.stats) {
    return `<div class="summary-strip">
      <span class="summary-chip good">可清理 <strong>${formatBytes(temp.total)}</strong></span>
      <span class="summary-chip">${formatNumber(temp.entries.length)} 个文件</span>
      <span class="summary-chip">用时 <strong>${formatElapsed(temp.elapsedMs)}</strong></span>
      ${temp.cancelled ? '<span class="summary-chip">已取消</span>' : ''}
    </div>`;
  }
  return '';
}

function renderTempResults() {
  const temp = state.temp;
  if (temp.running) return renderSkeleton(4);
  if (!temp.entries.length) {
    if (temp.stats) {
      return `<div class="empty-state"><div class="empty-orb">${icon('check-circle', 27)}</div><h3>缓存很干净</h3><p>没有发现 7 天未修改的临时文件；没有做任何修改。</p></div>`;
    }
    return `<div class="empty-state"><div class="empty-orb">${icon('broom', 27)}</div><h3>先扫描，再决定清理什么</h3><p>会检查用户临时目录、Chrome/Edge 缓存、缩略图缓存和系统临时目录。</p></div>`;
  }

  const selectedCount = temp.entries.filter((entry) => temp.selected.has(entry.path)).length;
  const selectedSize = selectedBytes(temp.entries, temp.selected);
  const visible = temp.entries.slice(0, 200);

  return `
    <div class="temp-cats">
      ${temp.categories.map((category) => {
        const entries = temp.entries.filter((entry) => entry.category === category.name);
        const allSelected = entries.length > 0 && entries.every((entry) => temp.selected.has(entry.path));
        return `
          <label class="temp-cat">
            <input type="checkbox" class="temp-cat-check" data-category="${escapeHtml(category.name)}" ${allSelected ? 'checked' : ''}>
            <div class="temp-cat-icon">${icon('broom', 16)}</div>
            <div class="temp-cat-body"><strong>${escapeHtml(category.name)}</strong><span>${formatNumber(category.count)} 个文件</span></div>
            <span class="temp-cat-size">${formatBytes(category.size)}</span>
          </label>`;
      }).join('')}
    </div>
    <div class="results">
      <div class="results-head"><div><h3>文件列表 <span class="count-pill">${formatNumber(temp.entries.length)}</span></h3><p>${temp.entries.length > visible.length ? `按${sortLabelOf('temp')}排列，只展示前 ${visible.length} 个，分类勾选仍会包含全部` : `按${sortLabelOf('temp')}排列，点表头可换一列`}</p></div></div>
      ${temp.truncated ? `<p class="fin-note">临时文件超过 4000 条，仅列出前 4000 条；建议分批清理。</p>` : ''}
      <div class="table-wrap">
        <table>
          <thead><tr><th class="col-check"></th><th class="sortable" data-sort-scope="temp" data-sort-key="name" title="点击按名称排序">文件${sortMarkOf('temp', 'name')}</th><th class="sortable" data-sort-scope="temp" data-sort-key="category" title="点击按分类排序">分类${sortMarkOf('temp', 'category')}</th><th class="col-size sortable" data-sort-scope="temp" data-sort-key="size" title="点击按体积排序">大小${sortMarkOf('temp', 'size')}</th><th class="col-time sortable" data-sort-scope="temp" data-sort-key="mtime" title="点击按修改时间排序">修改时间${sortMarkOf('temp', 'mtime')}</th><th class="col-actions"></th></tr></thead>
          <tbody>
            ${visible.map((entry, index) => `
              <tr>
                <td class="col-check"><input type="checkbox" class="temp-check" data-index="${index}" ${temp.selected.has(entry.path) ? 'checked' : ''}></td>
                <td>
                  <div class="file-meta">
                    <div class="file-name" title="${escapeHtml(entry.path)}">${escapeHtml(baseName(entry.path))}</div>
                    <div class="file-parent" title="${escapeHtml(entry.path)}">${escapeHtml(parentOf(entry.path))}</div>
                  </div>
                </td>
                <td><span class="tag-plain">${escapeHtml(entry.category)}</span></td>
                <td class="size-cell">${formatBytes(entry.size)}</td>
                <td class="time-cell">${formatDate(entry.mtime)}</td>
                <td class="col-actions">
                  <div class="row-actions">
                    <button class="row-btn" data-action="reveal" data-path="${escapeHtml(entry.path)}" title="在资源管理器中定位">${icon('folder-open', 13)}</button>
                    <button class="row-btn" data-action="copy-path" data-path="${escapeHtml(entry.path)}" title="复制完整路径">${icon('copy', 13)}</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="selection-bar ${selectedCount ? '' : 'is-hidden'}" id="temp-selection-bar">
        <span>已选择 <strong>${selectedCount}</strong> 个文件 · ${formatBytes(selectedSize)}</span>
        <div class="sel-actions">
          <button class="btn small ghost" id="temp-clear-selection">取消选择</button>
          <button class="btn small danger" id="temp-delete-selected">${icon('trash', 14)} 移到回收站</button>
        </div>
      </div>
    </div>`;
}

function renderUnlock(tool) {
  const unlock = state.unlock;
  return `
    ${pageHead(tool, '系统 / 诊断')}
    <div class="panel">
      <div class="toolbar">
        <div class="path-field">
          ${icon('unlock', 15)}
          <input id="unlock-path" readonly placeholder="选择被占用的文件或文件夹" value="${escapeHtml(unlock.path)}">
          <button class="mini-btn" id="unlock-pick">选择文件</button>
          <button class="mini-btn" id="unlock-pick-folder">选择文件夹</button>
        </div>
        <button class="btn primary" id="unlock-start" ${unlock.running ? 'disabled' : ''}>${icon('unlock', 15)} 检查占用</button>
      </div>
      <div id="unlock-status">${renderUnlockStatus()}</div>
      <div id="unlock-results">${renderUnlockResults()}</div>
    </div>`;
}

function renderUnlockStatus() {
  const unlock = state.unlock;
  if (unlock.running) {
    return `<div class="progress-card"><div class="progress-top"><div class="progress-title"><span class="spinner"></span>正在查询 Restart Manager</div></div><div class="progress-current">这一步可能需要几秒…</div></div>`;
  }
  if (unlock.error) {
    return `<div class="summary-strip"><span class="summary-chip"><strong style="color:var(--danger)">${escapeHtml(unlock.error)}</strong></span></div>`;
  }
  return '';
}

function renderUnlockResults() {
  const unlock = state.unlock;
  const isFolder = unlock.mode === 'folder';
  if (unlock.running) return renderSkeleton(3);
  if (!unlock.path) {
    return `${isFolder
      ? `<div class="empty-state"><div class="empty-orb">${icon('folder', 27)}</div><h3>谁占用了这个文件夹？</h3><p>选一个删不掉、移动不了、无法重命名的文件夹，查询占用其中文件的进程。结束进程有风险，确认后再操作。</p></div>`
      : `<div class="empty-state"><div class="empty-orb">${icon('unlock', 27)}</div><h3>谁占用了这个文件？</h3><p>选一个删不掉、改不了的文件，查询正在使用它的进程。结束进程有风险，确认后再操作。</p></div>`}`;
  }
  if (unlock.error) {
    return `<div class="empty-state"><div class="empty-orb">${icon('alert', 27)}</div><h3>查询没有完成</h3><p>${escapeHtml(unlock.error)}</p></div>`;
  }
  if (!unlock.checked) {
    return `<div class="empty-state"><div class="empty-orb">${icon('search', 27)}</div><h3>准备好了</h3><p>点击“检查占用”开始查询。</p></div>`;
  }
  if (!unlock.processes.length) {
    return `<div class="empty-state"><div class="empty-orb">${icon('check-circle', 27)}</div><h3>没有发现占用进程</h3><p>${isFolder ? '文件夹内的文件可能都已释放，或占用来自内核/驱动，Restart Manager 查不到。' : '文件可能已经释放，或占用来自内核/驱动，Restart Manager 查不到。'}</p></div>`;
  }
  return `
    <div class="process-list">
      ${unlock.processes.map((process) => `
        <div class="process-card">
          <div class="process-icon">${icon('terminal', 17)}</div>
          <div class="process-meta">
            <strong>${escapeHtml(process.name || '未知进程')}</strong>
            <span>PID ${process.pid}</span>
            <span class="process-path" title="${escapeHtml(process.path)}">${escapeHtml(process.path || '路径不可见')}</span>
          </div>
          <button class="btn small danger" data-kill-pid="${process.pid}" data-kill-name="${escapeHtml(process.name || '')}">结束进程</button>
        </div>`).join('')}
    </div>`;
}

function renderUsb(tool) {
  const usb = state.usb;
  return `
    ${pageHead(tool, '磁盘 · 安全弹出')}
    <div class="panel">
      <div class="toolbar">
        <div class="path-field">
          ${icon('usb', 15)}
          <select id="usb-drive" ${usb.checking || usb.ejecting ? 'disabled' : ''}>
            ${renderUsbDriveOptions()}
          </select>
        </div>
        <button class="btn ghost" id="usb-refresh" ${usb.checking || usb.ejecting ? 'disabled' : ''}>${icon('refresh', 15)} 刷新设备</button>
        <button class="btn primary" id="usb-check" ${usb.drive && !usb.checking && !usb.ejecting ? '' : 'disabled'}>${icon('scan', 15)} 检测占用</button>
        <button class="btn danger" id="usb-eject" ${usb.drive && !usb.checking && !usb.ejecting ? '' : 'disabled'}>${icon('eject', 15)} 安全弹出</button>
      </div>
      <div id="usb-status">${renderUsbStatus()}</div>
      <div id="usb-results">${renderUsbResults()}</div>
    </div>`;
}

function renderUsbDriveOptions() {
  const usb = state.usb;
  if (!usb.devices.length) return '<option value="">未检测到可移动磁盘</option>';
  return usb.devices.map((v) => {
    const label = v.label ? `${v.label}（${v.drive}）` : `本地磁盘（${v.drive}）`;
    let suffix = '';
    if (v.fs) suffix += ` · ${v.fs}`;
    if (Number(v.size) > 0) suffix += ` · ${formatBytes(Number(v.size))}`;
    return `<option value="${escapeHtml(v.drive)}" ${v.drive === usb.drive ? 'selected' : ''}>${escapeHtml(label)}${escapeHtml(suffix)}</option>`;
  }).join('');
}

function renderUsbStatus() {
  const usb = state.usb;
  if (usb.checking) return `<div class="progress-card"><div class="progress-top"><div class="progress-title"><span class="spinner"></span>正在检测磁盘占用…</div></div><div class="progress-current">会扫描整个磁盘上被打开的文件，可能需要几秒到几十秒。</div></div>`;
  if (usb.ejecting) return `<div class="progress-card"><div class="progress-top"><div class="progress-title"><span class="spinner"></span>正在写入缓存并弹出磁盘…</div></div></div>`;
  if (usb.error) return `<div class="summary-strip"><span class="summary-chip"><strong style="color:var(--danger)">${escapeHtml(usb.error)}</strong></span></div>`;
  return '';
}

function renderUsbResults() {
  const usb = state.usb;
  if (!usb.drive) {
    return `<div class="empty-state"><div class="empty-orb">${icon('usb', 27)}</div><h3>插入U盘后点击「刷新设备」</h3><p>工具会列出所有可移动磁盘，选择后检查是否有程序占用再安全弹出。</p></div>`;
  }
  const blocked = usb.checked && usb.processes.length > 0;
  let html = `<div class="results" style="margin-top:14px"><div class="results-head"><div><h3>${escapeHtml(usb.drive)} 的占用进程</h3><p>下方进程正在读取这个磁盘上的文件，可能正是它们阻止了弹出。</p></div></div>`;
  if (!usb.checked) {
    html += `<div class="empty-state" style="border:none;padding:10px 0"><p>点击「检测占用」查询当前占用该磁盘的进程。</p></div>`;
  } else if (!usb.processes.length) {
    html += `<div class="summary-strip"><span class="summary-chip good">没有检测到占用进程，现在可以「安全弹出」。</span></div>`;
  } else {
    html += `<div class="process-list">${usb.processes.map((p) => `
      <div class="process-card">
        <div class="process-icon">${icon('terminal', 17)}</div>
        <div class="process-meta">
          <strong>${escapeHtml(p.name || '未知进程')}</strong>
          <span>PID ${p.pid}</span>
          <span class="process-path" title="${escapeHtml(p.path)}">${escapeHtml(p.path || '路径不可见')}</span>
        </div>
        <button class="btn small danger-ghost" data-kill-usb-pid="${p.pid}" data-kill-usb-name="${escapeHtml(p.name || '')}">结束后重弹</button>
      </div>`).join('')}</div>`;
  }
  html += `</div>`;
  if (blocked) {
    html += `<div class="summary-strip" style="margin-top:10px;justify-content:space-between;gap:10px"><span class="summary-chip">仍有进程占用：可先「结束后重弹」。</span><button class="btn small danger" id="usb-force-eject">${icon('alert', 14)} 强制弹出</button></div>`;
  }
  return html;
}

function usbRefresh() {
  if (state.usb.checking || state.usb.ejecting) return;
  state.usb.checking = true;
  state.usb.error = '';
  post({ type: 'usbVolumes' });
}

function usbSetDrive(value) {
  state.usb.drive = value || '';
  state.usb.processes = [];
  state.usb.checked = false;
  state.usb.error = '';
  refreshUsbPage();
}

function usbCheckLockers() {
  if (state.usb.checking || state.usb.ejecting || !state.usb.drive) return;
  clearRunningStates();
  state.usb.checking = true;
  state.usb.checked = false;
  state.usb.processes = [];
  state.usb.error = '';
  refreshUsbPage();
  post({ type: 'usbCheck', payload: { drive: state.usb.drive } });
}

function usbDoEject(force) {
  if (!state.usb.drive || state.usb.checking || state.usb.ejecting) return;
  if (force) {
    showConfirm({
      title: '强制弹出这个磁盘？',
      message: '这个磁盘仍被其他程序占用。强制弹出会中断占用的进程并卸载卷。如果有程序正在写文件，未保存的数据可能丢失。',
      confirmLabel: '强制弹出并结束占用',
      iconName: 'alert',
      danger: true,
      onConfirm: () => {
        state.usb.ejecting = true;
        state.usb.error = '';
        refreshUsbPage();
        post({ type: 'usbEject', payload: { drive: state.usb.drive, force: true } });
      },
    });
    return;
  }
  state.usb.ejecting = true;
  state.usb.error = '';
  refreshUsbPage();
  post({ type: 'usbEject', payload: { drive: state.usb.drive, force: false } });
}

function handleUsbVolumesDone(payload) {
  const usb = state.usb;
  usb.checking = false;
  usb.devices = Array.isArray(payload.volumes) ? payload.volumes : [];
  if (!usb.drive && usb.devices.length) usb.drive = usb.devices[0].drive;
  if (usb.drive && !usb.devices.some((v) => v.drive === usb.drive)) {
    usb.drive = usb.devices.length ? usb.devices[0].drive : '';
  }
  refreshUsbPage();
  if (!usb.devices.length) toast('未检测到可移动磁盘', 'info');
}

function handleUsbCheckDone(payload) {
  const usb = state.usb;
  usb.checking = false;
  usb.checked = true;
  usb.processes = Array.isArray(payload.processes) ? payload.processes : [];
  usb.error = payload.error || '';
  refreshUsbPage();
  if (usb.error) toast(usb.error, 'error');
  else if (!usb.processes.length) toast('没有检测到占用进程，现在可以安全弹出', 'success');
  else toast(`检测到 ${usb.processes.length} 个进程占用这个磁盘`, 'info');
}

function handleUsbEjectDone(payload) {
  const usb = state.usb;
  usb.ejecting = false;
  usb.error = payload.error || '';
  refreshUsbPage();
  if (payload.ok) {
    toast('磁盘已安全弹出，现在可以拔出了', 'success');
    usbRefresh();
  } else {
    toast(usb.error || '弹出失败', 'error');
  }
}

function refreshUsbPage() {
  const sel = $('#usb-drive');
  if (sel) {
    const current = state.usb.drive;
    sel.innerHTML = renderUsbDriveOptions();
    sel.value = current || '';
    sel.disabled = state.usb.checking || state.usb.ejecting;
  }
  const status = $('#usb-status');
  const results = $('#usb-results');
  if (status) status.innerHTML = renderUsbStatus();
  if (results) results.innerHTML = renderUsbResults();
  syncToolbarState();
}


function renderScreenshot(tool) {
  return `
    ${pageHead(tool, '系统 · 截图')}
    <div class="panel">${renderScreenshotBody()}</div>`;
}

function shotThumbUrl(name) {
  return 'https://shots.local/' + encodeURIComponent(name);
}

function renderScreenshotBody() {
  const s = state.screenshot;
  if (s.cropping) return renderScreenshotCrop();
  return `
    <div class="toolbar">
      <button class="btn primary" id="screenshot-capture" ${s.running ? 'disabled' : ''}>${icon('camera', 16)} 全屏截图</button>
      <button class="btn primary" id="screenshot-capture-region" ${s.running ? 'disabled' : ''}>${icon('crop', 16)} 截取选区</button>
      <button class="btn danger-ghost" id="screenshot-delete-selected" ${s.selected.size ? '' : 'disabled'}>${icon('trash', 15)} 删除选中（${s.selected.size}）</button>
    </div>
    ${renderScreenshotPathBar()}
    <div id="shot-status">${renderScreenshotStatus()}</div>
    <div id="shot-gallery">${renderScreenshotGallery()}</div>`;
}

function renderScreenshotPathBar() {
  const s = state.screenshot;
  const latest = s.lastPath || (s.files[0] ? s.files[0].path : '');
  const dir = s.dir || (latest ? parentOf(latest) : '');
  if (!dir && !latest) return '';
  return `
    <div class="shot-pathbar">
      <div class="shot-path-text">
        ${dir ? `<div>截图目录：<code>${escapeHtml(dir)}</code></div>` : ''}
        ${latest ? `<div>最新截图：<code>${escapeHtml(latest)}</code></div>` : ''}
      </div>
      <div class="shot-path-actions">
        ${dir ? `<button class="mini-btn" id="shot-copy-dir">复制目录</button>` : ''}
        ${latest ? `<button class="mini-btn" id="shot-copy-file">复制文件路径</button>` : ''}
      </div>
    </div>`;
}

function renderScreenshotStatus() {
  const s = state.screenshot;
  if (s.running) return `<div class="progress-card"><div class="progress-top"><div class="progress-title"><span class="spinner"></span>正在截取屏幕…</div></div><div class="progress-current">窗口会暂时隐藏，几秒后自动恢复。</div></div>`;
  if (s.lastPath) return `<div class="summary-strip"><span class="summary-chip good">已保存截图</span><span class="shot-lastpath">${escapeHtml(s.lastPath)}</span></div>`;
  return '';
}

function renderScreenshotGallery() {
  const s = state.screenshot;
  if (!s.files.length) {
    return `<div class="empty-state"><div class="empty-orb">${icon('camera', 27)}</div><h3>还没有截图</h3><p>点击「全屏截图」或「截取选区」保存第一张截图。截取后会自动保存到本地，未删除会一直保留。</p></div>`;
  }
  const cards = s.files.map((f, i) => {
    const checked = s.selected.has(f.path) ? 'checked' : '';
    return `
      <div class="shot-card">
        <div class="shot-thumb-wrap">
          <input type="checkbox" class="shot-check" data-shot-check="${i}" ${checked} aria-label="选择">
          <button class="shot-thumb" data-shot-view="${i}" title="查看大图">${icon('search', 14)}</button>
          <img data-shot-view="${i}" src="${shotThumbUrl(f.name)}" loading="lazy" alt="${escapeHtml(f.name)}">
        </div>
        <div class="shot-meta">
          <span class="shot-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
          <span class="shot-actions">
            <button class="mini-btn" data-shot-copy="${i}" title="复制到剪贴板">${icon('copy', 14)}</button>
            <button class="mini-btn danger-ghost" data-shot-del="${i}" title="删除（移到回收站）">${icon('trash', 14)}</button>
          </span>
        </div>
      </div>`;
  }).join('');
  return `<div class="shot-grid">${cards}</div>`;
}

function renderScreenshotCrop() {
  const message = state.screenshot.cropping && state.screenshot.cropping.saving
    ? '<div class="progress-card"><div class="progress-top"><div class="progress-title"><span class="spinner"></span>正在保存选区…</div></div></div>'
    : '';
  return `
    <div class="toolbar">
      <button class="btn ghost" id="screenshot-crop-cancel" ${state.screenshot.cropping && state.screenshot.cropping.saving ? 'disabled' : ''}>${icon('x', 15)} 取消裁剪</button>
      <button class="btn primary" id="screenshot-crop-save" disabled>${icon('check', 15)} 保存选区</button>
      <span class="tip">${icon('info', 14)} 在图上按住拖动，框选要保留的区域</span>
    </div>
    <div class="crop-wrap" id="crop-wrap"><canvas id="crop-canvas" class="crop-canvas"></canvas></div>
    ${message}`;
}

function openShotViewer(path, name) {
  const overlay = document.createElement('div');
  overlay.className = 'shot-viewer';
  overlay.innerHTML = `
    <div class="shot-viewer-head">
      <span title="${escapeHtml(name)}">${escapeHtml(name)}</span>
      <button class="mini-btn" data-vclose>${icon('x', 16)}</button>
    </div>
    <div class="shot-viewer-img"><img src="${shotThumbUrl(name)}" alt=""></div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-vclose]') || e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}
