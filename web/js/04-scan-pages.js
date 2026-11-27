// ---- 第 4/8 块：本块起始于 async function setupCrop() { ----
async function setupCrop() {
  const canvas = $('#crop-canvas');
  const s = state.screenshot;
  if (!canvas || !s.cropping) return;
  const crop = s.cropping;
  if (!crop.path && !crop.dataUrl) return;
  if (crop.loading) return;
  crop.loading = true;
  let imageUrl = shotThumbUrl(crop.name);
  if (crop.dataUrl) {
    // 选区模式：内存中的全屏快照，稍后只保存框选区域
    imageUrl = crop.dataUrl;
  } else if (crop.path) {
    const res = await requestHost({ type: 'readFile', payload: { path: crop.path } });
    if (!state.screenshot.cropping || state.screenshot.cropping.path !== crop.path) return;
    if (!res.b64) {
      toast(res.error === 'timeout' ? '读取截图超时' : (res.error || '读取截图失败'), 'error');
      state.screenshot.cropping = null;
      render();
      return;
    }
    const blob = new Blob([b64ToBytes(res.b64)], { type: 'image/png' });
    imageUrl = URL.createObjectURL(blob);
    crop.blobUrl = imageUrl;
  }
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    crop.loading = false;
    if (!state.screenshot.cropping || state.screenshot.cropping !== crop) return;
    if (crop.blobUrl) {
      URL.revokeObjectURL(crop.blobUrl);
      crop.blobUrl = '';
    }
    const maxW = Math.max(320, (canvas.parentElement ? canvas.parentElement.clientWidth : 900) - 8);
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.max(100, Math.round(img.naturalWidth * scale));
    const h = Math.max(80, Math.round(img.naturalHeight * scale));
    canvas.width = w;
    canvas.height = h;
    const c = s.cropping;
    c.img = img;
    c.natW = img.naturalWidth;
    c.natH = img.naturalHeight;
    c.canvasW = w;
    c.canvasH = h;
    c.rect = null;
    c.dragging = false;
    drawCrop(canvas);

    canvas.onmousedown = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      c.dragging = true;
      c.rect = { left: x, top: y, right: x, bottom: y };
      drawCrop(canvas);
    };
    canvas.onmousemove = (e) => {
      if (!c.dragging) return;
      const r = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(canvas.width, e.clientX - r.left));
      const y = Math.max(0, Math.min(canvas.height, e.clientY - r.top));
      const rr = c.rect;
      c.rect = { left: Math.min(rr.left, x), top: Math.min(rr.top, y), right: Math.max(rr.left, x), bottom: Math.max(rr.top, y) };
      drawCrop(canvas);
    };
    const endDrag = () => {
      if (!c.dragging) return;
      c.dragging = false;
      if (c.rect && (c.rect.right - c.rect.left) < 5 && (c.rect.bottom - c.rect.top) < 5) c.rect = null;
      const saveBtn = $('#screenshot-crop-save');
      if (saveBtn) saveBtn.disabled = !c.rect;
    };
    canvas.onmouseup = endDrag;
    canvas.onmouseleave = endDrag;
    const saveBtn = $('#screenshot-crop-save');
    if (saveBtn) saveBtn.disabled = true;
  };
  img.onerror = () => {
    crop.loading = false;
    if (!state.screenshot.cropping || state.screenshot.cropping !== crop) return;
    if (crop.blobUrl) URL.revokeObjectURL(crop.blobUrl);
    toast('加载截图失败，无法裁剪', 'error');
    state.screenshot.cropping = null;
    render();
  };
  img.src = imageUrl;
}

function drawCrop(canvas) {
  const c = state.screenshot.cropping;
  if (!c || !c.img) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(c.img, 0, 0, canvas.width, canvas.height);
  if (c.rect) {
    const r = c.rect;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, canvas.width, r.top);
    ctx.fillRect(0, r.bottom, canvas.width, canvas.height - r.bottom);
    ctx.fillRect(0, r.top, r.left, r.bottom - r.top);
    ctx.fillRect(r.right, r.top, canvas.width - r.right, r.bottom - r.top);
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.left + 1, r.top + 1, r.right - r.left - 2, r.bottom - r.top - 2);
  }
}

function doScreenCapture(region) {
  if (state.screenshot.running) return;
  clearRunningStates();
  const s = state.screenshot;
  s.running = true;
  s.lastPath = '';
  s.cropping = null;
  if (region) {
    s.cropping = { img: null, name: '', path: '', dataUrl: '', rect: null, saving: false, natW: 0, natH: 0, canvasW: 0, canvasH: 0 };
  }
  render();
  post({ type: 'screenCapture', payload: { region: Boolean(region) } });
}

function saveCrop() {
  const c = state.screenshot.cropping;
  if (!c || !c.rect || !c.img || c.saving) return;
  const r = c.rect;
  const left = Math.round(r.left * c.natW / c.canvasW);
  const top = Math.round(r.top * c.natH / c.canvasH);
  const w = Math.max(1, Math.round((r.right - r.left) * c.natW / c.canvasW));
  const h = Math.max(1, Math.round((r.bottom - r.top) * c.natH / c.canvasH));
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  octx.drawImage(c.img, left, top, w, h, 0, 0, w, h);
  const dataUrl = out.toDataURL('image/png');
  c.saving = true;
  render();
  post({ type: 'saveCropped', payload: { dataUrl } });
}

function refreshShots() {
  post({ type: 'listScreenshots' });
}

function refreshScreenshotPage() {
  const s = state.screenshot;
  if (s.cropping) {
    if (!s.cropping.saving) {
      const saveBtn = $('#screenshot-crop-save');
      if (saveBtn) saveBtn.disabled = !s.cropping.rect;
    }
    return;
  }
  const status = $('#shot-status');
  const gallery = $('#shot-gallery');
  if (status) status.innerHTML = renderScreenshotStatus();
  if (gallery) gallery.innerHTML = renderScreenshotGallery();
}

function handleScreenCaptureDone(payload) {
  const s = state.screenshot;
  s.running = false;
  if (payload.ok) {
    if (s.cropping) {
      if (payload.dataUrl) {
        // 选区模式：后端返回内存中的全屏快照，不产生全屏文件。
        s.cropping.dataUrl = payload.dataUrl;
        s.cropping.name = '选区.png';
        s.cropping.path = '';
      } else {
        const path = payload.path || '';
        s.cropping.name = (path.split(/[\\/]/).pop()) || 'shot.png';
        s.cropping.path = path;
      }
      render();
      return;
    }
    const path = payload.path || '';
    s.lastPath = path;
    toast('截图已保存');
    refreshShots();
  } else {
    toast(payload.error || '截图失败', 'error');
  }
  render();
}

function handleSaveCroppedDone(payload) {
  const s = state.screenshot;
  if (payload.ok) {
    s.cropping = null;
    s.lastPath = payload.path || '';
    toast('选区已保存');
    refreshShots();
  } else {
    if (s.cropping) s.cropping.saving = false;
    toast(payload.error || '保存选区失败', 'error');
  }
  render();
}

function handleShotCopyDone(payload) {
  if (payload.ok) toast('已复制到剪贴板，可直接粘贴（如画图、聊天窗口）', 'success');
  else toast(payload.error || '复制失败', 'error');
}

function handleScreenshotsLissDone(payload) {
  state.screenshot.files = Array.isArray(payload.items) ? payload.items : [];
  state.screenshot.dir = typeof payload.dir === 'string' ? payload.dir : '';
  if (state.view === 'tool' && state.toolId === 'screenshot') render();
}

function toggleShotCheck(i) {
  const f = state.screenshot.files[i];
  if (!f) return;
  const set = state.screenshot.selected;
  if (set.has(f.path)) set.delete(f.path);
  else set.add(f.path);
  const box = $('#shot-gallery') && $('#shot-gallery').querySelectorAll('.shot-check')[i];
  if (box) box.checked = set.has(f.path);
  const del = $('#screenshot-delete-selected');
  if (del) del.disabled = !set.size;
}

function deleteSingleShot(i) {
  const f = state.screenshot.files[i];
  if (!f) return;
  showConfirm({
    title: '删除这张截图？',
    message: `「${f.name}」会移到回收站，可以恢复。`,
    paths: [f.path],
    confirmLabel: '移到回收站',
    iconName: 'trash',
    danger: true,
  });
  modalConfirm = () => {
    const requestId = uid();
    post({ type: 'recycle', requestId, payload: { paths: [f.path] } });
    state.pendingRecycle = { kind: 'shot', paths: [f.path] };
    toast('正在删除这张截图…');
    setTimeout(refreshShots, 600);
  };
}

function deleteSelectedShots() {
  const s = state.screenshot;
  if (!s.selected.size) return;
  const paths = Array.from(s.selected);
  showConfirm({
    title: `删除选中的 ${paths.length} 张截图？`,
    message: '都会移到回收站，可以恢复。',
    paths,
    confirmLabel: '移到回收站',
    iconName: 'trash',
    danger: true,
  });
  modalConfirm = () => {
    const requestId = uid();
    post({ type: 'recycle', requestId, payload: { paths } });
    state.pendingRecycle = { kind: 'shot', paths };
    s.selected.clear();
    toast(`正在删除 ${paths.length} 张截图…`);
    setTimeout(refreshShots, 600);
  };
}


function renderSettings() {
  const info = state.appInfo;
  return `
    <div class="page-head">
      <button class="back-btn" data-nav="home" title="返回工具库" aria-label="返回工具库">${icon('arrow-left', 17)}</button>
      <div class="page-icon accent-slate">${icon('settings', 25)}</div>
      <div class="page-title">
        <div class="page-kicker">工具箱</div>
        <h1>设置</h1>
        <p>外观、数据与快捷键</p>
      </div>
      <div class="page-actions"><span class="status ready"><i></i>v${escapeHtml(info.version)}</span></div>
    </div>

    <div class="settings-grid">
      <section class="panel">
        <div class="panel-head"><div><h2>外观</h2><p>主题会同步到窗口标题栏</p></div></div>
        <div class="setting-row">
          <div><div class="setting-label">主题</div><div class="setting-desc">深色更适合晚上整理文件</div></div>
          <div class="segmented">
            <button data-theme-choice="dark" class="${state.theme === 'dark' ? 'active' : ''}">深色</button>
            <button data-theme-choice="light" class="${state.theme === 'light' ? 'active' : ''}">浅色</button>
            <button data-theme-choice="system" class="${state.theme === 'system' ? 'active' : ''}">跟随系统</button>
          </div>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">界面缩放</div><div class="setting-desc">整体放大文字和控件；觉得字小就调大一档</div></div>
          <div class="segmented" id="zoom-controls">
            ${[1, 1.1, 1.25, 1.4, 1.5].map((value) => {
              const tooLarge = value > maxZoomForViewport();
              return `
              <button data-zoom-choice="${value}" class="${Math.abs(state.zoom - value) < 0.001 ? 'active' : ''}"
                      ${tooLarge ? 'disabled title="当前窗口宽度放大会太挤，建议先放大窗口"' : ''}>${Math.round(value * 100)}%</button>`;
            }).join('')}
          </div>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">界面语言</div><div class="setting-desc">当前版本仅提供简体中文</div></div>
          <span class="mono">zh-CN</span>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">在任务栏显示</div><div class="setting-desc">关掉后主窗口不占任务栏按钮，用托盘或 Ctrl Alt Shift F 唤出</div></div>
          <label class="switch-field">
            <input type="checkbox" id="set-taskbar" ${info.taskbar === false ? '' : 'checked'}>
            <span class="switch"></span>
          </label>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>悬浮窗</h2><p>把常用工具钉在桌面上，随时收起或打开</p></div></div>
        <div class="settings-mini-grid">
          ${[
            ['launcher', 'grid', 'slate', '悬浮工具箱', '全部工具的入口'],
            ['folders', 'pin', 'violet', '常用文件夹', '一键打开常用目录'],
            ['clipboard-history', 'clipboard', 'cyan', '剪贴板历史', '回看复制内容'],
            ['quick-search', 'search', 'blue', '快速文件搜索', '按名称通配查找'],
            ['video-collector', 'film', 'pink', '视频整理', '扫描、预览、归档'],
          ].map(([id, ico, accent, name, desc]) => `
            <button class="settings-mini-card" data-mini-open="${id}">
              <span class="settings-mini-icon accent-${accent}">${icon(ico, 17)}</span>
              <span class="settings-mini-text"><strong>${name}</strong><span>${desc}</span></span>
              <span class="settings-mini-open">${icon('external', 13)}</span>
            </button>`).join('')}
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>数据与隐私</h2><p>没有账号，没有云端</p></div></div>
        <div class="setting-row">
          <div><div class="setting-label">本地数据目录</div><div class="setting-desc mono" id="about-datadir" title="${escapeHtml(info.dataDir)}">${escapeHtml(info.dataDir)}</div></div>
          <button class="btn small ghost" id="copy-data-folder">复制路径</button>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">上传</div><div class="setting-desc">扫描结果、文件路径不会离开本机</div></div>
          <span class="mono" style="color:var(--success)">0 B</span>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>关于</h2><p>构建信息</p></div></div>
        <div class="about-mark">
          <div class="brand-mark" aria-hidden="true"></div>
          <div><h3>工具箱</h3><p>Windows 小工具集合 · 让重复操作少一点</p></div>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">应用版本</div></div>
          <span class="mono" id="about-version">v${escapeHtml(info.version)}</span>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">WebView2 Runtime</div></div>
          <span class="mono" id="about-webview" title="${escapeHtml(info.webview)}">${escapeHtml(info.webview)}</span>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">重新加载界面</div><div class="setting-desc">修改前端文件后无需重启程序</div></div>
          <button class="btn small ghost" id="reload-ui">${icon('refresh', 13)} 重新加载</button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head"><div><h2>快捷键</h2><p>少点几下鼠标</p></div></div>
        <div class="kbd-list">
          <div class="kbd-row"><span>聚焦搜索</span><kbd>Ctrl K</kbd></div>
          <div class="kbd-row"><span>返回工具库</span><kbd>Esc</kbd></div>
          <div class="kbd-row"><span>返回上一页</span><kbd>Alt ←</kbd></div>
          <div class="kbd-row"><span>触发选中的卡片</span><kbd>Enter</kbd></div>
        </div>
      </section>
    </div>`;
}

function renderSoon() {
  const tool = toolById(state.toolId);
  if (!tool) return renderHome();
  const plans = PLANS[tool.id] || ['安全预览', '批量操作', '回收站兜底', '长路径处理'];
  return `
    ${pageHead(tool, '路线图 / 即将上线')}
    <div class="soon-wrap">
      <div class="soon-card">
        <div class="soon-icon accent-${tool.accent}">${icon(tool.icon, 34)}</div>
        <span class="status soon"><i></i>正在打磨</span>
        <h1>${tool.name}</h1>
        <p>${tool.desc} 这个工具已经排进路线图，先把大文件扫描和空文件夹清理打磨好，再把它接上来。</p>
        <ul class="soon-list">
          ${plans.map((plan) => `<li>${icon('check', 13)}${plan}</li>`).join('')}
        </ul>
        <div class="soon-actions">
          <button class="btn primary" data-nav="home">先去看看可用工具</button>
          <button class="btn ghost" id="notify-me">${icon('sparkles', 14)} 催更一下</button>
        </div>
      </div>
    </div>`;
}

function toast(message, kind = 'info') {
  const element = document.createElement('div');
  element.className = `toast ${kind}`;
  const iconName = kind === 'success' ? 'check-circle' : kind === 'error' ? 'alert' : 'info';
  element.innerHTML = `${icon(iconName, 15)}<span>${escapeHtml(message)}</span>`;
  toastRoot.appendChild(element);
  while (toastRoot.children.length > 3) toastRoot.removeChild(toastRoot.firstElementChild);
  setTimeout(() => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(6px)';
    element.style.transition = 'opacity .25s, transform .25s';
    setTimeout(() => element.remove(), 260);
  }, 3600);
}

let modalConfirm = null;

function closeModal() {
  modalRoot.innerHTML = '';
  modalConfirm = null;
}

function showConfirm({
  title, message, paths = [], confirmLabel = '移到回收站',
  iconName = 'trash', danger = true, onConfirm = null,
}) {
  const preview = paths.slice(0, 4);
  const remaining = paths.length - preview.length;
  modalRoot.innerHTML = `
    <div class="modal-overlay">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <div class="modal-icon">${icon(iconName, 21)}</div>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        ${preview.length ? `
          <div class="modal-preview">
            ${preview.map((path) => `<div>${escapeHtml(path)}</div>`).join('')}
            ${remaining > 0 ? `<div style="color:var(--text-dim)">… 以及另外 ${remaining} 项</div>` : ''}
          </div>` : ''}
        <div class="modal-actions">
          <button class="btn ghost" id="modal-cancel">取消</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" id="modal-confirm">${confirmLabel}</button>
        </div>
      </div>
    </div>`;

  const overlay = modalRoot.firstElementChild;
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  });
  $('#modal-cancel').addEventListener('click', closeModal);
  $('#modal-confirm').addEventListener('click', () => {
    const action = onConfirm || modalConfirm;
    closeModal();
    action?.();
  });
}

function requestRecycle(paths, kind) {
  if (!paths.length) return;
  state.pendingRecycle = { paths, kind };
  let totalBytes = 0;
  if (kind === 'large') {
    totalBytes = state.scan.items.filter((item) => paths.includes(item.path))
      .reduce((sum, item) => sum + item.size, 0);
  } else if (kind === 'dup') {
    state.dup.groups.forEach((group) => group.files.forEach((file) => {
      if (paths.includes(file.path)) totalBytes += file.size;
    }));
  } else if (kind === 'temp') {
    totalBytes = state.temp.entries.filter((entry) => paths.includes(entry.path))
      .reduce((sum, entry) => sum + entry.size, 0);
  }
  showConfirm({
    title: paths.length === 1 ? '把这个项目移到回收站？' : `把这 ${paths.length} 个项目移到回收站？`,
    message: kind === 'empty'
      ? '只删除确认后仍为空的文件夹。回收站可以恢复，但仍建议先确认路径。'
      : `共 ${formatBytes(totalBytes)}。删除后可以在回收站里恢复。`,
    paths,
    confirmLabel: `移到回收站`,
  });
  modalConfirm = () => {
    const requestId = uid();
    post({ type: 'recycle', requestId, payload: { paths } });
    state.pendingRecycle = { kind, paths };
    toast(`正在把 ${paths.length} 个项目移到回收站…`);
  };
}

function requestVideoDelete(paths) {
  const vs = videoState();
  const items = vs.items.filter((item) => paths.includes(item.path));
  const targets = items.map((item) => item.target).filter(Boolean);
  const bytes = items.reduce((sum, item) => sum + (Number(item.size) || 0), 0);
  const preview = paths.slice(0, 4);
  modalRoot.innerHTML = `
    <div class="modal-overlay">
      <div class="modal" role="dialog" aria-modal="true" aria-label="删除视频">
        <div class="modal-icon">${icon('trash', 21)}</div>
        <h3>${paths.length === 1 ? '把这个视频移到回收站？' : `把这 ${paths.length} 个视频移到回收站？`}</h3>
        <p>共 ${formatBytes(bytes)}。删除后可以在回收站里恢复。</p>
        <div class="modal-preview">
          ${preview.map((path) => `<div>${escapeHtml(path)}</div>`).join('')}
          ${paths.length > preview.length ? `<div style="color:var(--text-dim)">… 以及另外 ${paths.length - preview.length} 项</div>` : ''}
        </div>
        ${targets.length ? `
          <label class="modal-check">
            <input type="checkbox" id="delete-with-targets" checked>
            <span>同时删除目标文件夹中的 ${targets.length} 个副本</span>
          </label>` : ''}
        <div class="modal-actions">
          <button class="btn ghost" id="modal-cancel">取消</button>
          <button class="btn danger" id="modal-confirm">移到回收站</button>
        </div>
      </div>
    </div>`;
  const overlay = modalRoot.firstElementChild;
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  });
  $('#modal-cancel').addEventListener('click', closeModal);
  $('#modal-confirm').addEventListener('click', () => {
    const withTargets = !!$('#delete-with-targets')?.checked;
    const all = withTargets ? paths.concat(targets) : paths.slice();
    const requestId = uid();
    state.pendingRecycle = { kind: 'video', paths: all };
    post({ type: 'recycle', requestId, payload: { paths: all } });
    toast(`正在把 ${all.length} 个项目移到回收站…`);
    closeModal();
  });
}

function onScanProgress(payload) {
  const progress = payload || {};
  if (state.view === 'tool' && state.toolId === 'large-files' && state.scan.running) {
    const counts = $('#scan-counts');
    const current = $('#scan-current');
    if (counts) counts.textContent = `${formatNumber(progress.files)} 个文件 · ${formatNumber(progress.dirs)} 个目录`;
    if (current) current.textContent = progress.current || '正在读取目录…';
  }
  if (state.view === 'tool' && state.toolId === 'empty-folders' && state.empty.running) {
    const counts = $('#empty-counts');
    const current = $('#empty-current');
    if (counts) counts.textContent = `${formatNumber(progress.dirs)} 个目录 · ${formatNumber(progress.files)} 个文件`;
    if (current) current.textContent = progress.current || '正在读取目录…';
  }
}

function syncToolbarState() {
  const start = $('#start-scan');
  const cancel = $('#cancel-scan');
  if (start) start.disabled = state.scan.running;
  if (cancel) cancel.hidden = !state.scan.running;

  const emptyStart = $('#empty-start');
  const emptyCancel = $('#empty-cancel');
  if (emptyStart) emptyStart.disabled = state.empty.running;
  if (emptyCancel) emptyCancel.hidden = !state.empty.running;

  const dupStart = $('#dup-start');
  const dupCancel = $('#dup-cancel');
  if (dupStart) dupStart.disabled = state.dup.running;
  if (dupCancel) dupCancel.hidden = !state.dup.running;

  const spaceStart = $('#space-start');
  const spaceCancel = $('#space-cancel');
  if (spaceStart) spaceStart.disabled = state.space.running;
  if (spaceCancel) spaceCancel.hidden = !state.space.running;
  const spaceUp = $('#space-up');
  if (spaceUp) spaceUp.disabled = state.space.running || !state.space.history.length;

  const hashStart = $('#hash-start');
  const hashCancel = $('#hash-cancel');
  if (hashStart) hashStart.disabled = state.hash.running;
  if (hashCancel) hashCancel.hidden = !state.hash.running;

  const tempStart = $('#temp-start');
  const tempCancel = $('#temp-cancel');
  if (tempStart) tempStart.disabled = state.temp.running;
  if (tempCancel) tempCancel.hidden = !state.temp.running;

  const unlockStart = $('#unlock-start');
  if (unlockStart) unlockStart.disabled = state.unlock.running;
}

function refreshScanPage() {
  const status = $('#scan-status');
  const results = $('#scan-results');
  if (status) status.innerHTML = renderScanStatus();
  if (results) results.innerHTML = renderScanResults();
  syncToolbarState();
  requestAnimationFrame(syncScanChecks);
}

function refreshEmptyPage() {
  const status = $('#empty-status');
  const results = $('#empty-results');
  if (status) status.innerHTML = renderEmptyStatus();
  if (results) results.innerHTML = renderEmptyResults();
  syncToolbarState();
  requestAnimationFrame(syncScanChecks);
}

function handleScanDone(payload) {
  state.scan.running = false;
  state.scan.error = '';
  state.scan.items = Array.isArray(payload.items) ? payload.items : [];
  state.scan.stats = payload.stats || null;
  state.scan.totalMatched = payload.totalMatched || 0;
  state.scan.elapsedMs = payload.elapsedMs || 0;
  state.scan.cancelled = Boolean(payload.cancelled);
  state.scan.selected.clear();

  if (state.view === 'tool' && state.toolId === 'large-files') refreshScanPage();
  if (state.scan.cancelled) {
    toast('扫描已取消', 'info');
  } else {
    toast(`扫描完成，找到 ${formatNumber(state.scan.items.length)} 个大文件`, 'success');
  }
}

function handleEmptyDone(payload) {
  state.empty.running = false;
  state.empty.error = '';
  state.empty.folders = Array.isArray(payload.folders) ? payload.folders : [];
  state.empty.stats = payload.stats || null;
  state.empty.elapsedMs = payload.elapsedMs || 0;
  state.empty.cancelled = Boolean(payload.cancelled);
  state.empty.selected.clear();

  if (state.view === 'tool' && state.toolId === 'empty-folders') refreshEmptyPage();
  if (state.empty.cancelled) {
    toast('检查已取消', 'info');
  } else {
    toast(`检查完成，找到 ${formatNumber(state.empty.folders.length)} 个空文件夹`, 'success');
  }
}

function handleRecycleDone(payload) {
  const pending = state.pendingRecycle;
  if (payload.ok && pending) {
    if (pending.kind === 'shot') {
      const removed = new Set(pending.paths);
      state.screenshot.files = state.screenshot.files.filter((file) => !removed.has(file.path));
      pending.paths.forEach((path) => state.screenshot.selected.delete(path));
      state.screenshot.lastPath = '';
      if (state.view === 'tool' && state.toolId === 'screenshot') render();
      toast(`已把 ${formatNumber(payload.count || pending.paths.length)} 张截图移到回收站`, 'success');
      state.pendingRecycle = null;
      return;
    }
    const removed = new Set(pending.paths);
    if (pending.kind === 'video') {
      const vs = videoState();
      vs.items = vs.items.filter((item) => !removed.has(item.path));
      vs.selected.clear();
      if (state.view === 'tool' && state.toolId === 'video-collector') {
        paintVideoList();
        paintVideoStatus();
      }
      toast(`已把 ${formatNumber(payload.count || pending.paths.length)} 个视频移到回收站`, 'success');
      state.pendingRecycle = null;
      return;
    }
    if (pending.kind === 'large') {
      state.scan.items = state.scan.items.filter((item) => !removed.has(item.path));
      state.scan.selected.clear();
      if (state.view === 'tool' && state.toolId === 'large-files') refreshScanPage();
    } else if (pending.kind === 'dup') {
      state.dup.groups = state.dup.groups
        .map((group) => ({
          ...group,
          files: group.files.filter((file) => !removed.has(file.path)),
        }))
        .filter((group) => group.files.length > 1);
      state.dup.selected.clear();
      state.dup.groups.forEach((group) => group.files.slice(1).forEach((file) => state.dup.selected.add(file.path)));
      if (state.view === 'tool' && state.toolId === 'duplicates') refreshDupPage();
    } else if (pending.kind === 'temp') {
      state.temp.entries = state.temp.entries.filter((entry) => !removed.has(entry.path));
      state.temp.selected.clear();
      const categories = new Map();
      state.temp.entries.forEach((entry) => {
        const current = categories.get(entry.category) || { name: entry.category, size: 0, count: 0 };
        current.size += entry.size;
        current.count += 1;
        categories.set(entry.category, current);
      });
      state.temp.categories = Array.from(categories.values()).sort((a, b) => b.size - a.size);
      state.temp.total = state.temp.entries.reduce((sum, entry) => sum + entry.size, 0);
      if (state.view === 'tool' && state.toolId === 'temp-cleaner') refreshTempPage();
    } else {
      state.empty.folders = state.empty.folders.filter((path) => !removed.has(path));
      state.empty.selected.clear();
      if (state.view === 'tool' && state.toolId === 'empty-folders') refreshEmptyPage();
    }
    toast(`已把 ${formatNumber(payload.count || pending.paths.length)} 个项目移到回收站`, 'success');
  } else {
    toast(payload.message || '操作未完成，请检查文件是否被占用', 'error');
  }
  state.pendingRecycle = null;
}

/* 各类进度消息 → 对应的看门狗任务键。只要任务还在持续发送进度，
   看门狗计时就不断刷新，合法的超长扫描/哈希不会被误复位；
   只有真正卡住（长时间无进度）的任务才会触发复位。 */
const watchdogKeyByType = {
  scanProgress: ['scan', 'empty'],
  dupProgress: ['dup'],
  spaceProgress: ['space'],
  hashProgress: ['hash'],
  tempProgress: ['temp'],
  organizeProgress: ['organizer'],
  searchProgress: ['search'],
  compareProgress: ['fdiff'],
  copyProgress: ['fdiff'],
};

function handleHostMessage(event) {
  let data = event.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return;
    }
  }
  if (!data || typeof data !== 'object') return;
  const payload = data.payload || {};

  if (data.type === 'response') {
    const pending = bridgePending.get(data.id);
    if (!pending) return;
    bridgePending.delete(data.id);
    if (data.ok) pending.resolve(data.data || {});
    else pending.reject(new Error(data.error || '命令执行失败'));
    return;
  }

  if (data.type === 'miniState') {
    const wasCollapsed = !!state.miniCollapsed;
    state.miniPinned = data.pinned !== false;
    state.miniCollapsed = !!data.collapsed;
    document.documentElement.classList.toggle('mini-pinned', state.miniPinned);
    const pinBtn = document.querySelector('[data-mini-action="pin"]');
    if (pinBtn) {
      pinBtn.classList.toggle('active', state.miniPinned);
      pinBtn.title = state.miniPinned ? '取消置顶' : '置顶';
    }
    if (wasCollapsed !== state.miniCollapsed) render();
    return;
  }

  const watchdogKeys = watchdogKeyByType[data.type];
  if (watchdogKeys) {
    const now = Date.now();
    // scanProgress 同时服务大文件扫描与空文件夹扫描，而 native 一次只跑一个主
    // 任务。只刷新当前确实在运行的键，避免某个工具已被 clearRunningStates 复位后，
    // 仍被另一工具的残留进度无限续期看门狗计时，导致其真正卡死时无法被复位。
    watchdogKeys.forEach((key) => {
      const running = watchdogSnapshot()[key];
      if (running) watchdogSince.set(key, now);
    });
  }

  switch (data.type) {
    case 'video.items': {
      const vs = videoState();
      (data.items || []).forEach((item) => vs.items.push(item));
      vs.total = data.total || vs.items.length;
      paintVideoList();
      break;
    }
    case 'video.scan_progress': {
      const vs = videoState();
      vs.scanning = true;
      vs.dirs = data.dirs || 0;
      if (data.found) vs.total = data.found;
      paintVideoStatus();
      break;
    }
    case 'video.dedupe_progress': {
      const vs = videoState();
      vs.scanning = false;
      vs.deduping = true;
      vs.dupProgress = { done: data.done || 0, total: data.total || 0, groups: data.groups || 0 };
      paintVideoStatus();
      break;
    }
    case 'video.dedupe_group': {
      const vs = videoState();
      const ids = data.ids || [];
      const paths = [];
      ids.forEach((id, index) => {
        const item = vs.items.find((entry) => entry.id === id);
        if (!item) return;
        item.dup = { count: data.count || ids.length, keep: id === data.keep, position: index + 1 };
        if (id !== data.keep) paths.push(item.path);
      });
      vs.dupGroups.push({ keep: data.keep, count: data.count || ids.length, paths });
      // 分组可能连续上报很多条，合并成一次重绘
      if (!vs.dupPaintTimer) {
        vs.dupPaintTimer = setTimeout(() => {
          vs.dupPaintTimer = null;
          paintVideoList();
          paintVideoStatus();
        }, 80);
      }
      break;
    }
    case 'video.scan_done': {
      const vs = videoState();
      vs.scanning = false;
      vs.deduping = false;
      vs.dupProgress = null;
      vs.scanStats = data.stats || null;
      vs.truncated = !!(data.stats && data.stats.truncated);
      paintVideoStatus();
      paintVideoList();
      break;
    }
    case 'video.meta': {
      const vs = videoState();
      vs.meta[data.id] = {
        duration: data.duration || 0,
        width: data.width || 0,
        height: data.height || 0,
        thumb: data.thumb || '',
        failed: !!data.error,
      };
      updateVideoMetaCell(data.id);
      break;
    }
    case 'video.status': {
      const vs = videoState();
      const item = vs.items.find((entry) => entry.id === data.id);
      if (item) item.status = data.status || '';
      const cell = viewEl.querySelector(`[data-vstatus="${data.id}"]`);
      if (cell) {
        cell.innerHTML = escapeHtml(data.status || '—');
        cell.setAttribute('style', videoStatusClass(data.status || ''));
      } else {
        paintVideoList();
      }
      break;
    }
    case 'video.progress': {
      const vs = videoState();
      vs.running = true;
      vs.progress = { done: data.done || 0, total: data.total || 0, name: data.name || '' };
      paintVideoStatus();
      break;
    }
    case 'video.done': {
      const vs = videoState();
      vs.running = false;
      vs.collectStats = data.stats || null;
      vs.progress = null;
      paintVideoStatus();
      paintVideoList();
      const s = data.stats || {};
      toast(`整理结束：成功 ${s.success || 0}，跳过 ${s.skipped || 0}，失败 ${s.failed || 0}`,
        s.failed ? 'error' : 'success');
      if (vs.openAfter && vs.dst) {
        toolCall('folders.open', { path: vs.dst }).catch(() => {});
      }
      break;
    }
    case 'video.undo_done': {
      const vs = videoState();
      const s = data.stats || {};
      vs.undoing = false;
      vs.collectStats = null;
      paintVideoStatus();
      toast(`撤销完成：移回 ${s.restored || 0}，删除副本 ${s.removed || 0}，失败 ${s.failed || 0}`,
        s.failed ? 'error' : 'success');
      break;
    }
    case 'video.log': {
      const vs = videoState();
      vs.logs.push({ text: data.text || '', level: data.level || 'info' });
      if (vs.logs.length > 80) vs.logs.splice(0, vs.logs.length - 80);
      paintVideoLog();
      break;
    }
    case 'video.finished': {
      const vs = videoState();
      vs.scanning = false;
      vs.running = false;
      paintVideoStatus();
      break;
    }
    case 'appInfo':
      state.appInfo = {
        version: payload.version || '0.1.0',
        webview: payload.webview || '—',
        dataDir: payload.dataDir || '—',
        taskbar: payload.taskbar !== false,
      };
      updateAppInfoUI();
      break;
    case 'folderPicked': {
      const folderResolve = payload.requestId ? pendingHostRequests.get(payload.requestId) : null;
      if (folderResolve) {
        pendingHostRequests.delete(payload.requestId);
        folderResolve(payload);
        state.pickerTarget = null;
        break;
      }
      const target = state.pickerTarget;
      if (payload.path) {
        if (target === 'empty') {
          state.empty.root = payload.path;
          const input = $('#empty-path');
          if (input) input.value = payload.path;
        } else if (target === 'dup') {
          state.dup.root = payload.path;
          const input = $('#dup-path');
          if (input) input.value = payload.path;
        } else if (target === 'space') {
          state.space.root = payload.path;
          state.space.history = [];
          const input = $('#space-path');
          if (input) input.value = payload.path;
        } else if (target === 'rename') {
          state.rename.root = payload.path;
          const input = $('#rename-path');
          if (input) input.value = payload.path;
          requestListFolder();
        } else if (target === 'hash') {
          state.hash.root = payload.path;
          const input = $('#hash-path');
          if (input) input.value = payload.path;
        } else if (target === 'organizer') {
          invalidateOrganizerPreview();
          state.organizer.root = payload.path;
          const input = $('#organizer-path');
          if (input) input.value = payload.path;
        } else if (target === 'organizer-target') {
          invalidateOrganizerPreview();
          state.organizer.targetRoot = payload.path;
          const input = $('#organizer-target');
          if (input) input.value = payload.path;
          const clear = $('#organizer-target-clear');
          if (clear) clear.disabled = false;
        } else if (target === 'unlock-folder') {
          state.unlock.path = payload.path;
          state.unlock.processes = [];
          state.unlock.checked = false;
          state.unlock.error = '';
          const input = $('#unlock-path');
          if (input) input.value = payload.path;
          refreshUnlockPage();
        } else {
          state.scan.root = payload.path;
          const input = $('#scan-path');
          if (input) input.value = payload.path;
        }
      }
      state.pickerTarget = null;
      break;
    }
    case 'filePicked': {
      const hostResolve = payload.requestId ? pendingHostRequests.get(payload.requestId) : null;
      if (hostResolve) {
        pendingHostRequests.delete(payload.requestId);
        hostResolve(payload);
        state.pickerTarget = null;
        break;
      }
      const target = state.pickerTarget || payload.target;
      if (payload.path) {
        if (target === 'unlock') {
          state.unlock.path = payload.path;
          state.unlock.processes = [];
          state.unlock.checked = false;
          state.unlock.error = '';
          const input = $('#unlock-path');
          if (input) input.value = payload.path;
          refreshUnlockPage();
        }
      }
      state.pickerTarget = null;
      break;
    }
    case 'filesPicked':
    case 'fileContent':
    case 'fileExported':
    case 'pathsChecked': {
      const resolve = pendingHostRequests.get(payload.requestId);
      if (resolve) {
        pendingHostRequests.delete(payload.requestId);
        resolve(payload);
      }
      break;
    }
    case 'dupProgress':
      state.dup.stats = payload;
      if (state.view === 'tool' && state.toolId === 'file-organizer') {
        // 联动扫重：增量更新进度条文本，避免整页重绘拖慢高频消息
        const counts = $('#organizer-dup-counts');
        const current = $('#organizer-dup-current');
        if (counts) counts.textContent =
          `已扫描 ${formatNumber(payload.files)} 个文件 · 候选 ${formatNumber(payload.matched)} 个`;
        if (current) current.textContent = payload.current || '正在比对文件…';
      } else if (state.view === 'tool' && state.toolId === 'duplicates') {
        const counts = $('#dup-counts');
        const current = $('#dup-current');
        if (counts) counts.textContent = `${formatNumber(payload.files)} 个文件 · 候选 ${formatNumber(payload.matched)} 个`;
        if (current) current.textContent = payload.current || '正在比对…';
      }
      break;
    case 'dupDone':
      if (checkupAdvance('dup', payload)) break;
      if (state.organizer.waitingDup) {
        state.organizer.waitingDup = false;
        state.organizer.ranRecheck = true;
        handleDupDone(payload);
        if (state.view === 'tool' && state.toolId === 'file-organizer') {
          refreshOrganizePage();
        }
      } else {
        handleDupDone(payload);
      }
      break;
    case 'organizeProgress':
      state.organizer.stats = payload;
      if (state.view === 'tool' && state.toolId === 'file-organizer') {
        const counts = $('#organizer-counts');
        const current = $('#organizer-current');
        if (counts) counts.textContent = `${formatNumber(payload.files)} 个文件 · 已匹配 ${formatNumber(payload.matched)}`;
        if (current) current.textContent = payload.current || '正在读取目录…';
      }
      break;
    case 'organizeDone':
      handleOrganizeDone(payload);
      break;
    case 'spaceProgress':
      state.space.stats = payload;
      if (state.view === 'tool' && state.toolId === 'space-analyzer') {
        const counts = $('#space-counts');
        const current = $('#space-current');
        if (counts) counts.textContent = `${formatNumber(payload.dirs)} 个目录 · ${formatNumber(payload.files)} 个文件`;
        if (current) current.textContent = payload.current || '正在统计…';
      }
      break;
    case 'spaceDone':
      handleSpaceDone(payload);
      break;
    case 'hashProgress':
      state.hash.stats = payload;
      if (state.view === 'tool' && state.toolId === 'hash-check') {
        const counts = $('#hash-counts');
        const current = $('#hash-current');
        if (counts) counts.textContent = `${formatNumber(payload.files)} 个文件 · ${formatBytes(payload.bytes)}`;
        if (current) current.textContent = payload.current || '正在计算…';
      }
      break;
    case 'hashDone':
      handleHashDone(payload);
      break;
    case 'tempProgress':
      if (state.checkup && state.checkup.running) onCheckupProgress(payload);
      state.temp.stats = payload;
      if (state.view === 'tool' && state.toolId === 'temp-cleaner') {
        const counts = $('#temp-counts');
        const current = $('#temp-current');
        if (counts) counts.textContent = `${formatNumber(payload.files)} 个文件 · ${formatBytes(payload.bytes)}`;
        if (current) current.textContent = payload.current || '正在读取…';
      }
      break;
    case 'tempDone':
      if (!checkupAdvance('temp', payload)) handleTempDone(payload);
      break;
    case 'folderList':
      handleFolderList(payload);
      break;
    case 'renameDone':
      handleRenameDone(payload);
      break;
    case 'unlockDone':
      handleUnlockDone(payload);
      break;
    case 'killDone':
      handleKillDone(payload);
      break;
    case 'usbVolumesDone':
      handleUsbVolumesDone(payload);
      break;
    case 'usbCheckDone':
      handleUsbCheckDone(payload);
      break;
    case 'usbEjectDone':
      handleUsbEjectDone(payload);
      break;
    case 'screenCaptureDone':
      handleScreenCaptureDone(payload);
      break;
    case 'saveCroppedDone':
      handleSaveCroppedDone(payload);
      break;
    case 'copyShotDone':
      handleShotCopyDone(payload);
      break;
    case 'screenshotsListDone':
      handleScreenshotsLissDone(payload);
      break;
    case 'scanProgress':
      if (state.checkup && state.checkup.running) onCheckupProgress(payload);
      onScanProgress(payload);
      break;
    case 'scanDone':
      if (!checkupAdvance('large', payload)) handleScanDone(payload);
      break;
    case 'emptyDone':
      if (!checkupAdvance('empty', payload)) handleEmptyDone(payload);
      break;
    case 'scanError':
      state.scan.running = false;
      state.empty.running = false;
      state.scan.error = payload.message || '扫描失败';
      state.empty.error = payload.message || '扫描失败';
      if (state.view === 'tool' && state.toolId === 'large-files') refreshScanPage();
      if (state.view === 'tool' && state.toolId === 'empty-folders') refreshEmptyPage();
      toast(payload.message || '扫描失败', 'error');
      break;
    case 'taskError':
      clearRunningStates();
      if (state.view === 'tool') render();
      toast(payload.message || '任务执行失败', 'error');
      break;
    case 'recycleDone':
      handleRecycleDone(payload);
      break;
    case 'searchProgress': {
      const search = state.search;
      search.stats = payload;
      const counts = $('#search-counts');
      const current = $('#search-current');
      if (counts) counts.textContent = `${formatNumber(payload.matched || 0)} 个匹配 / 已扫 ${formatNumber(payload.files || 0)} 文件`;
      if (current) current.textContent = payload.current || '正在遍历…';
      break;
    }
    case 'searchDone':
      handleSearchDone(payload);
      break;
    case 'compareProgress': {
      const fdiff = state.fdiff;
      fdiff.stats = payload;
      const cmpCounts = $('#fdiff-counts');
      const cmpCurrent = $('#fdiff-current');
      if (cmpCounts) cmpCounts.textContent = `A ${formatNumber(payload.files || 0)} · B 进行中`;
      if (cmpCurrent) cmpCurrent.textContent = payload.current || '正在遍历…';
      break;
    }
    case 'compareDone':
      handleCompareDone(payload);
      break;
    case 'copyProgress':
      state.fdiff.copyCopied = Number(payload.copied) || 0;
      state.fdiff.copyTotal = Number(payload.total) || 0;
      state.fdiff.copyCurrent = payload.current || '';
      if (state.view === 'tool' && state.toolId === 'folder-sync') render();
      break;
    case 'copyDone': {
      const outcome = payload || {};
      state.fdiff.copying = false;
      if (outcome.failCount) {
        toast(`复制完成：成功 ${outcome.okCount} 个，失败 ${outcome.failCount} 个`, 'error');
        const firstError = (outcome.errors || [])[0];
        if (firstError) console.warn('copy error:', firstError);
      } else if (outcome.cancelled) {
        toast('复制已取消');
      } else {
        toast(`已复制 ${outcome.okCount || 0} 个文件`, 'success');
      }
      state.fdiff.selected.clear();
      if (state.view === 'tool' && state.toolId === 'folder-sync') runFolderCompare();
      break;
    }
    case 'toast':
      toast(payload.message || '', payload.kind || 'info');
      break;
    case 'clipboardChanged':
      pushClip(typeof payload.text === 'string' ? payload.text : '');
      break;
    case 'copyTextDone':
      if (payload.ok === false) toast('写入剪贴板失败', 'error');
      else toast('已复制到剪贴板', 'success');
      break;
    case 'renamePairsDone':
      handleOrganizerUndoDone(payload);
      break;
    default:
      break;
  }
}
