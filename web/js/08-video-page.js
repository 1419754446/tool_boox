// ---- 第 8/8 块：本块起始于 function renderVideoStatus() { ----
function renderVideoStatus() {
  const vs = videoState();
  if (vs.deduping) {
    const p = vs.dupProgress || { done: 0, total: 0, groups: 0 };
    return `
      <div class="progress-card">
        <div class="progress-top">
          <div class="progress-title"><span class="spinner"></span>正在按内容分组</div>
          <div class="progress-counts">已比对 ${formatNumber(p.done)} / ${formatNumber(p.total)} 个同体积文件 · 重复 ${formatNumber(p.groups)} 组</div>
        </div>
        <div class="progress-track"><span style="${p.total ? `width:${Math.min(100, Math.round((p.done / p.total) * 100))}%` : 'width:22%'}"></span></div>
        <div class="progress-current">只读首/中/尾各 64KB，不动任何文件；可随时取消。</div>
      </div>`;
  }
  if (vs.scanning) {
    return `
      <div class="progress-card">
        <div class="progress-top">
          <div class="progress-title"><span class="spinner"></span>正在扫描视频</div>
          <div class="progress-counts">已读 ${formatNumber(vs.dirs)} 个目录 · 找到 ${formatNumber(vs.total)} 个</div>
        </div>
        <div class="progress-track"><span></span></div>
        <div class="progress-current">${
          vs.allDrives
            ? (Array.isArray(vs.driveSel) && vs.driveSel.length
                ? `正在扫描 ${vs.driveSel.join(' / ')}，大目录会比较慢…`
                : '全盘扫描中，大目录会比较慢…')
            : '按扩展名筛选，只读取文件属性。'
        }</div>
      </div>`;
  }
  if (vs.scanStats) {
    const s = vs.scanStats;
    return `
      <div class="summary-strip">
        <span class="summary-chip good">找到 <strong>${formatNumber(vs.items.length)}</strong> 个视频</span>
        <span class="summary-chip">目录 <strong>${formatNumber(s.dirs || 0)}</strong> 个</span>
        <span class="summary-chip">用时 <strong>${Number(s.seconds || 0).toFixed(1)}s</strong></span>
        ${vs.truncated ? '<span class="summary-chip" style="color:var(--warning)">已到 2 万条上限，结果不完整</span>' : ''}
        ${s.dupGroups ? `<span class="summary-chip" style="color:var(--accent)">同内容 <strong>${formatNumber(s.dupGroups)}</strong> 组 · 涉及 ${formatNumber(s.dupFiles || 0)} 个</span>` : ''}
        ${s.cancelled ? '<span class="summary-chip">已取消</span>' : ''}
      </div>`;
  }
  return '';
}

function videoStatusKind(item) {
  const status = (item && item.status) || '';
  if (status.startsWith('失败')) return 'failed';
  if (status.startsWith('已')) return 'done';
  return 'pending';
}

function videoVisibleItems() {
  const vs = videoState();
  const query = (vs.filter || '').trim().toLowerCase();
  return vs.items.filter((item) => {
    if (vs.statusFilter !== 'all' && videoStatusKind(item) !== vs.statusFilter) return false;
    if (!query) return true;
    return (item.name || '').toLowerCase().includes(query) ||
      (item.dir || '').toLowerCase().includes(query);
  });
}

function videoCounts() {
  const vs = videoState();
  const counts = { all: vs.items.length, pending: 0, done: 0, failed: 0 };
  vs.items.forEach((item) => { counts[videoStatusKind(item)] += 1; });
  return counts;
}

function renderVideoSummary() {
  const vs = videoState();
  const counts = videoCounts();
  const filters = [
    ['all', '全部', counts.all],
    ['pending', '待整理', counts.pending],
    ['done', '已处理', counts.done],
    ['failed', '失败', counts.failed],
  ];
  return `
    <div class="results-head">
      <div>
        <h3>视频列表 <span class="count-pill">${formatNumber(counts.all)}</span></h3>
        <p>${vs.items.length ? '勾选要留下的视频，选好目标文件夹后点「整理选中」。' : '先在上方选择源文件夹或全盘扫描。'}</p>
      </div>
      <div class="results-head-actions">
        <span class="summary-chip">已选 <strong>${vs.selected.size}</strong></span>
        ${vs.dupGroups.length ? `<button class="btn small ghost" data-video-action="dedupeKeepOne" title="取消重复组里除第一个以外的勾选">${icon('copy', 13)} 每组保留一份（${formatNumber(vs.dupGroups.reduce((sum, g) => sum + Math.max(0, g.count - 1), 0))}）</button>` : ''}
        <button class="btn small ghost" data-video-action="exportCsv">${icon('download', 13)} 导出 CSV</button>
        <button class="btn small ghost" data-video-action="exportHtml">${icon('file', 13)} 导出 HTML 报告</button>
        <button class="btn small danger-ghost" data-video-action="deleteSelected" ${vs.selected.size ? '' : 'disabled'}>删除选中（${vs.selected.size}）</button>
        <button class="btn small ghost" data-video-action="selectAll">全选当前</button>
        <button class="btn small ghost" data-video-action="clearSel">清空选择</button>
      </div>
    </div>
    <div class="video-filters">
      <div class="video-search">
        ${icon('search', 14)}
        <input id="video-filter" placeholder="筛选文件名 / 目录" value="${escapeHtml(vs.filter || '')}" spellcheck="false">
      </div>
      ${filters.map(([key, label, count]) => `
        <button class="summary-chip ${vs.statusFilter === key ? 'active' : ''}" data-video-action="filterStatus" data-status="${key}">
          ${label} <strong>${formatNumber(count)}</strong>
        </button>`).join('')}
    </div>`;
}

function renderVideoBody() {
  const vs = videoState();
  if (!vs.items.length) {
    return `
      <div class="empty-state">
        <div class="empty-orb">${icon('film', 27)}</div>
        <h3>${vs.scanning ? '正在扫描…' : '还没有扫描到视频'}</h3>
        <p>${vs.scanning ? '结果会边扫边出现在这里。' : '支持 mp4 / mkv / avi / mov / wmv / flv / ts 等常见格式。'}</p>
      </div>`;
  }
  // 表头点击可排序：名称 / 时长 / 大小 / 修改时间 / 状态
  const visible = applyTableSort(videoVisibleItems(), 'video', {
    name: (item) => item.name || '',
    duration: (item) => {
      const meta = vs.meta && vs.meta[item.id];
      return meta && meta.duration ? Number(meta.duration) : -1;
    },
    size: (item) => Number(item.size) || 0,
    mtime: (item) => Number(item.mtime) || 0,
    status: (item) => item.status || '',
  }, 'name');
  const shown = visible.slice(0, vs.limit);
  const rest = visible.length - shown.length;
  const allSelected = visible.length && visible.every((item) => vs.selected.has(item.path));
  const someSelected = visible.some((item) => vs.selected.has(item.path));
  return `
    <div class="table-wrap" style="max-height:460px;overflow:auto">
      <table>
        <thead>
          <tr>
            <th class="col-check"><input type="checkbox" id="video-select-all" ${allSelected ? 'checked' : ''} data-some="${someSelected ? '1' : '0'}" aria-label="全选当前"></th>
            <th style="width:100px">预览</th>
            <th class="col-name sortable" data-sort-scope="video" data-sort-key="name" title="点击按名称排序">视频${sortMarkOf('video', 'name')}</th>
            <th style="width:118px" class="sortable" data-sort-scope="video" data-sort-key="duration" title="点击按时长排序（长的在前）">时长 / 分辨率${sortMarkOf('video', 'duration')}</th>
            <th style="width:96px" class="sortable" data-sort-scope="video" data-sort-key="size" title="点击按体积排序">大小${sortMarkOf('video', 'size')}</th>
            <th style="width:104px" class="sortable video-time" data-sort-scope="video" data-sort-key="mtime" title="点击按修改时间排序">修改时间${sortMarkOf('video', 'mtime')}</th>
            <th style="width:92px" class="sortable video-status-col" data-sort-scope="video" data-sort-key="status" title="点击按状态排序">状态${sortMarkOf('video', 'status')}</th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          ${shown.map((item) => renderVideoRow(item, vs)).join('')}
        </tbody>
      </table>
      ${rest > 0 ? `<div class="table-more"><button class="btn small ghost" data-video-action="more">显示更多（还有 ${formatNumber(rest)} 条）</button></div>` : ''}
    </div>`;
}

function formatDuration(duration) {
  if (!duration) return '';
  const seconds = Math.round(duration / 10000000);
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function renderVideoTech(meta) {
  if (!meta) return '<span class="video-tech-empty">读取中…</span>';
  if (meta.failed) return '<span class="video-tech-empty">—</span>';
  const duration = formatDuration(meta.duration);
  const size = meta.width && meta.height ? `${meta.width}×${meta.height}` : '';
  const lines = [duration, size].filter(Boolean);
  if (!lines.length) return '<span class="video-tech-empty">—</span>';
  return lines.map((line) => `<span>${escapeHtml(line)}</span>`).join('');
}

function renderVideoThumb(meta) {
  if (meta && meta.thumb) {
    return `<img src="${meta.thumb}" alt="" loading="lazy">`;
  }
  return '<span class="thumb-empty"></span>';
}

function videoStatusClass(status) {
  if (!status) return '';
  if (status.startsWith('失败')) return 'color:var(--danger)';
  if (status.startsWith('已')) return 'color:var(--success)';
  return 'color:var(--text-dim)';
}

function renderVideoRow(item, vs) {
  const path = escapeHtml(item.path);
  const meta = vs.meta ? vs.meta[item.id] : null;
  return `
    <tr data-vid="${item.id}" data-path="${path}">
      <td class="col-check"><input type="checkbox" class="video-check" data-path="${path}" ${vs.selected.has(item.path) ? 'checked' : ''} aria-label="选择"></td>
      <td><div class="video-thumb" data-vthumb="${item.id}">${renderVideoThumb(meta)}</div></td>
      <td class="col-name">
        <div class="cell-file">
          <span class="file-badge">${icon('film', 13)}</span>
          <div class="file-meta">
            <div class="file-name" title="${path}">${escapeHtml(item.name)}${item.dup ? `<span class="dup-chip ${item.dup.keep ? 'keep' : ''}">${item.dup.keep ? '同内容 1/' + item.dup.count + ' 保留' : '同内容 ' + item.dup.position + '/' + item.dup.count}</span>` : ''}</div>
            <div class="file-parent" title="${path}">${escapeHtml(item.dir || '')}</div>
          </div>
        </div>
      </td>
      <td class="video-tech" data-vmeta="${item.id}">${renderVideoTech(meta)}</td>
      <td>${formatBytes(item.size)}</td>
      <td class="time-cell video-time">${formatDate(item.mtime)}</td>
      <td class="video-status-col"><span class="video-status-cell" data-vstatus="${item.id}" style="${videoStatusClass(item.status)}">${escapeHtml(item.status || '—')}</span></td>
      <td class="col-actions">
        <div class="row-actions">
          <button class="row-btn" data-video-action="preview" data-path="${path}" title="内置预览播放">${icon('play', 13)}</button>
          <button class="row-btn" data-video-action="open" data-path="${path}" title="用系统播放器打开">${icon('external', 13)}</button>
          <button class="row-btn" data-video-action="reveal" data-path="${path}" title="在资源管理器中定位">${icon('search', 13)}</button>
          <button class="row-btn danger" data-video-action="delete" data-path="${path}" title="移到回收站">${icon('trash', 13)}</button>
        </div>
      </td>
    </tr>`;
}

function updateVideoMetaCell(id) {
  const vs = videoState();
  const meta = vs.meta[id];
  if (!meta) return;
  const thumb = viewEl.querySelector(`[data-vthumb="${id}"]`);
  if (thumb) thumb.innerHTML = renderVideoThumb(meta);
  const tech = viewEl.querySelector(`[data-vmeta="${id}"]`);
  if (tech) tech.innerHTML = renderVideoTech(meta);
}

function queueVideoMeta(id, path) {
  const vs = videoState();
  if (id === null || id === undefined || !path || vs.meta[id] || vs.metaPending[id]) return;
  vs.metaPending[id] = 1;
  vs.metaQueue.push({ id, path });
  setTimeout(() => {
    if (!vs.meta[id]) {
      vs.meta[id] = { duration: 0, width: 0, height: 0, thumb: '', failed: true };
      updateVideoMetaCell(id);
    }
  }, 15000);
  if (!vs.metaTimer) vs.metaTimer = setTimeout(pumpVideoMeta, 260);
}

function pumpVideoMeta() {
  const vs = videoState();
  vs.metaTimer = null;
  const batch = vs.metaQueue.splice(0, 24);
  if (!batch.length) return;
  toolCall('video.meta', { files: batch }, 60000).catch(() => {});
  if (vs.metaQueue.length) vs.metaTimer = setTimeout(pumpVideoMeta, 320);
}

function queueVisibleVideoMeta() {
  const vs = videoState();
  const wrap = viewEl.querySelector('#video-list .table-wrap');
  if (!wrap) return;
  if (!wrap.dataset.metaBound) {
    wrap.dataset.metaBound = '1';
    wrap.addEventListener('scroll', () => queueVisibleVideoMeta(), { passive: true });
  }
  const box = wrap.getBoundingClientRect();
  wrap.querySelectorAll('tr[data-vid]').forEach((row) => {
    const rect = row.getBoundingClientRect();
    if (rect.bottom >= box.top - 80 && rect.top <= box.bottom + 80) {
      queueVideoMeta(Number(row.dataset.vid), row.dataset.path);
    }
  });
}

function renderVideoProgress() {
  const vs = videoState();
  if (!vs.running) {
    if (vs.collectStats) {
      const s = vs.collectStats;
      return `
        <div class="summary-strip">
          <span class="summary-chip good">成功 <strong>${s.success || 0}</strong></span>
          <span class="summary-chip">跳过 <strong>${s.skipped || 0}</strong></span>
          <span class="summary-chip">已在目标内 <strong>${s.inplace || 0}</strong></span>
          <span class="summary-chip">失败 <strong style="color:${s.failed ? 'var(--danger)' : 'inherit'}">${s.failed || 0}</strong></span>
          <span class="summary-chip">共 <strong>${formatBytes(s.bytes || 0)}</strong> · ${Number(s.seconds || 0).toFixed(1)}s</span>
          ${s.cancelled ? '<span class="summary-chip">已取消</span>' : ''}
          ${s.success ? `<button class="btn small ghost" data-video-action="undo" ${vs.undoing ? 'disabled' : ''}>${icon('refresh', 12)} 撤销本次整理</button>` : ''}
        </div>`;
    }
    return '';
  }
  const p = vs.progress || { done: 0, total: 0, name: '' };
  const percent = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return `
    <div class="progress-card">
      <div class="progress-top">
        <div class="progress-title"><span class="spinner"></span>正在${vs.move ? '移动' : '复制'}视频</div>
        <div class="progress-counts">${p.done} / ${p.total} · ${percent}%</div>
      </div>
      <div class="progress-track"><span style="width:${percent}%"></span></div>
      <div class="progress-current">${escapeHtml(p.name || '准备中…')}</div>
    </div>`;
}

function renderVideoLog() {
  const vs = videoState();
  if (!vs.logs.length) {
    return '<div class="vlog-line" style="color:var(--text-muted)">运行日志会显示在这里。</div>';
  }
  // 类名不能用 .line：那是加载骨架的占位灰条（高 5px、胶囊圆角），
  // 复用会把每行日志压成一条灰带、文字被裁掉 —— 之前"日志显示异常"就是这么来的。
  return vs.logs.map((entry) => `<div class="vlog-line ${entry.level}">${escapeHtml(entry.text)}</div>`).join('');
}

function paintVideoStatus() {
  const vs = videoState();
  const status = $('#video-status');
  if (status) status.innerHTML = renderVideoStatus();
  const progress = $('#video-progress');
  if (progress) progress.innerHTML = renderVideoProgress();
  const summary = $('#video-summary');
  if (summary) summary.innerHTML = renderVideoSummary();
  const scanBtn = $('#video-scan-btn');
  if (scanBtn) scanBtn.disabled = vs.scanning || vs.running;
  const scanCancel = $('#video-scan-cancel');
  if (scanCancel) scanCancel.hidden = !vs.scanning;
  const collectBtn = $('#video-collect-btn');
  if (collectBtn) {
    collectBtn.disabled = vs.running || vs.scanning || !vs.selected.size;
    collectBtn.innerHTML = `${icon('folder-open', 15)} 整理选中（${vs.selected.size}）`;
  }
  const collectCancel = $('#video-collect-cancel');
  if (collectCancel) collectCancel.hidden = !vs.running;
}

function paintVideoList() {
  const body = $('#video-list');
  if (body) {
    body.innerHTML = renderVideoBody();
    const selectAll = document.getElementById('video-select-all');
    if (selectAll) selectAll.indeterminate = selectAll.dataset.some === '1' && !selectAll.checked;
    queueVisibleVideoMeta();
  }
  paintVideoStatus();
}

function paintVideoLog() {
  const box = $('#video-log');
  if (!box) return;
  box.innerHTML = renderVideoLog();
  box.scrollTop = box.scrollHeight;
}

function closeVideoPreview() {
  const mask = $('#video-player-mask');
  if (mask) mask.remove();
}

/* ---- 独立预览窗（preview_popout）：一个只放播放器的小窗 ---- */
function previewPopState() {
  if (!state.previewPop) {
    state.previewPop = { path: '', name: '', url: '', error: '', loading: false };
  }
  return state.previewPop;
}

function renderPreviewWindow() {
  const p = previewPopState();
  return `
    <div class="preview-pop">
      <div class="preview-pop-stage">
        ${p.error
          ? `<div class="preview-pop-tip">${icon('alert', 20)}<p>${escapeHtml(p.error)}</p></div>`
          : p.url
            ? `<video class="preview-pop-video" controls autoplay playsinline src="${escapeHtml(p.url)}"></video>`
            : `<div class="preview-pop-tip"><span class="spinner"></span><p>正在打开视频…</p></div>`}
      </div>
      <div class="preview-pop-foot">
        <span class="preview-pop-name" title="${escapeHtml(p.path)}">${escapeHtml(p.name || '视频预览')}</span>
        <button class="btn small ghost" data-preview-pop="open">${icon('external', 13)} 系统播放器</button>
        <button class="btn small ghost" data-preview-pop="close">${icon('x', 13)} 关闭窗口</button>
      </div>
    </div>`;
}

function loadPreviewPop() {
  const p = previewPopState();
  if (!p.path || p.url || p.loading) return;
  p.loading = true;
  toolCall('video.preview', { path: p.path }, 30000)
    .then((data) => {
      p.loading = false;
      p.url = (data && data.url) || '';
      if (data && !p.name && data.name) p.name = data.name;
      if (!p.url) p.error = '这个视频的内嵌解码打不开，可以点「系统播放器」直接播放。';
      if (state.toolId === 'video-preview') render();
    })
    .catch((error) => {
      p.loading = false;
      p.error = (error && error.message) || '打开视频失败';
      if (state.toolId === 'video-preview') render();
    });
}

function openVideoPreview(info, path) {
  closeVideoPreview();
  const mask = document.createElement('div');
  mask.id = 'video-player-mask';
  mask.className = 'video-player-mask';
  mask.innerHTML = `
    <div class="video-player-card" role="dialog" aria-modal="true">
      <div class="video-player-head">
        <span class="mini-tool-ico">${icon('play', 14)}</span>
        <div class="vp-title" title="${escapeHtml(info.name || '')}">${escapeHtml(info.name || '视频预览')}</div>
        <button class="icon-btn" data-vp="close" title="关闭">${icon('x', 14)}</button>
      </div>
      <div class="video-player-body">
        <video controls autoplay playsinline src="${escapeHtml(info.url)}"></video>
      </div>
      <div class="video-player-foot">
        <span class="vp-path" title="${escapeHtml(info.dir || '')}">${escapeHtml(info.dir || '')}</span>
        <button class="btn small ghost" data-vp="popout">${icon('window', 13)} 独立窗口</button>
        <button class="btn small ghost" data-vp="open">${icon('external', 13)} 系统播放器</button>
        <button class="btn small primary" data-vp="close">关闭</button>
      </div>
    </div>`;
  document.body.appendChild(mask);
  const video = mask.querySelector('video');
  video.addEventListener('error', () => {
    const body = mask.querySelector('.video-player-body');
    if (body) body.innerHTML = `<div class="video-player-tip">这个格式的内嵌解码失败了<br>可以点右下角「系统播放器」直接播放</div>`;
  }, { once: true });
  mask.addEventListener('click', (event) => {
    if (event.target === mask || event.target.closest('[data-vp="close"]')) {
      closeVideoPreview();
    } else if (event.target.closest('[data-vp="open"]')) {
      toolCall('video.open', { path }).catch((error) => toast(error.message, 'error'));
    } else if (event.target.closest('[data-vp="popout"]')) {
      post({ type: 'previewPopout', payload: { path, name: info.name || '' } });
      closeVideoPreview();
    }
  });
}

function videoReportClass(status) {
  const text = status || '';
  if (text.startsWith('已复制') || text.startsWith('已移动') || text.startsWith('已撤销')) return 'ok';
  if (text.startsWith('失败') || text.startsWith('撤销失败')) return 'fail';
  if (text.startsWith('已在目标') || text.startsWith('已跳过')) return 'warn';
  return 'pend';
}

async function exportVideoHtml() {
  const vs = videoState();
  if (!vs.items.length) {
    toast('还没有可导出的视频记录', 'error');
    return;
  }
  const groups = {};
  vs.items.forEach((item) => {
    const key = item.status || '待处理';
    groups[key] = (groups[key] || 0) + 1;
  });
  const stats = Object.entries(groups).map(([label, count]) =>
    `<div class="stat"><div class="stat-num">${count}</div><div class="stat-label">${escapeHtml(label)}</div></div>`).join('');
  const rows = vs.items.map((item, index) => {
    const status = item.status || '待处理';
    const target = item.target || '';
    return `<tr><td>${index + 1}</td><td class="cell-name">${escapeHtml(item.name || '')}</td>` +
      `<td>${escapeHtml(formatBytes(Number(item.size) || 0))}</td>` +
      `<td><span class="tag ${videoReportClass(status)}">${escapeHtml(status)}</span></td>` +
      `<td class="cell-large">${escapeHtml(item.path || '')}</td>` +
      `<td class="cell-large">${escapeHtml(target)}</td></tr>`;
  }).join('');
  const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>视频整理报告</title><style>` +
    `*{box-sizing:border-box}body{margin:0;background:#f4f6fb;color:#20242e;font-family:"Segoe UI","Microsoft YaHei",sans-serif}` +
    `.wrap{max-width:1160px;margin:0 auto;padding:32px 20px 56px}h1{font-size:22px;margin:0 0 4px}` +
    `.sub{color:#6b7280;font-size:13px;margin-bottom:22px}.stats{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:22px}` +
    `.stat{background:#fff;border:1px solid #e6eaf5;border-radius:14px;box-shadow:0 6px 18px rgba(80,100,160,.08);padding:14px 20px;min-width:120px}` +
    `.stat-num{font-size:22px;font-weight:700;color:#4f46e5}.stat-label{font-size:12px;color:#7c8290;margin-top:2px}` +
    `table{width:100%;border-collapse:collapse;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(80,100,160,.10)}` +
    `th,td{text-align:left;padding:10px 14px;font-size:13px}thead th{background:#eef1fb;color:#4b5264;font-weight:600;white-space:nowrap}` +
    `tbody tr{border-top:1px solid #eef1f8}.cell-name{font-weight:600}.cell-large{max-width:360px;word-break:break-all;color:#5b6270;font-size:12px}` +
    `.tag{display:inline-block;padding:2px 10px;border-radius:20px;font-size:12px;white-space:nowrap}` +
    `.tag.ok{background:#e6f7ef;color:#0f9d68}.tag.fail{background:#fdeaea;color:#d03434}.tag.warn{background:#fdf3e4;color:#b97f10}.tag.pend{background:#eaf0fe;color:#4f6fd6}` +
    `</style></head><body><div class="wrap"><h1>视频整理报告</h1>` +
    `<div class="sub">生成时间：${escapeHtml(new Date().toLocaleString('zh-CN'))} · 共 ${vs.items.length} 条记录</div>` +
    `<div class="stats">${stats}</div><table><thead><tr><th>#</th><th>文件名</th><th>大小</th><th>状态</th><th>源文件路径</th><th>目标文件路径</th></tr></thead>` +
    `<tbody>${rows}</tbody></table></div></body></html>`;
  const result = await requestHost({
    type: 'exportFile',
    payload: {
      name: '视频整理报告',
      filter: 'HTML 文件|*.html',
      content: utf8ToB64(html),
    },
  });
  if (result && result.ok !== false) toast('HTML 报告已导出', 'success');
}

function handleVideoAction(action, path, status) {
  const vs = videoState();

  if (action === 'extToggle') {
    const ext = String(path || '').trim().replace(/^\./, '').toLowerCase();
    if (!ext) return;
    const tokens = videoExtTokens();
    const next = tokens.includes(ext) ? tokens.filter((token) => token !== ext) : tokens.concat(ext);
    vs.exts = next.join(',');
    saveVideoSettings(vs);
    syncVideoExtPanel();
    return;
  }
  if (action === 'extAll') {
    vs.exts = VIDEO_EXT_CHOICES.join(',');
    saveVideoSettings(vs);
    syncVideoExtPanel();
    return;
  }
  if (action === 'extClear') {
    vs.exts = '';
    saveVideoSettings(vs);
    syncVideoExtPanel();
    return;
  }

  if (action === 'preview') {
    toolCall('video.preview', { path }, 30000).then((data) => openVideoPreview(data, path))
      .catch((error) => toast(error.message, 'error'));
    return;
  }

  if (action === 'pickSrc') {
    toolCall('folders.pick', {}, 120000).then((data) => {
      if (!data.path) return;
      vs.root = data.path;
      const input = $('#video-root');
      if (input) input.value = data.path;
      saveVideoSettings(vs);
    }).catch(() => {});
    return;
  }
  if (action === 'pickDst') {
    toolCall('folders.pick', {}, 120000).then((data) => {
      if (!data.path) return;
      vs.dst = data.path;
      const input = $('#video-dst');
      if (input) input.value = data.path;
      saveVideoSettings(vs);
    }).catch(() => {});
    return;
  }
  if (action === 'driveToggle') {
    const letter = path;
    const list = state.videoDriveList || [];
    // 第一次点：把"不限制（全选）"展开成显式列表，再单独去掉点中的那块盘
    let sel = vs.driveSel ? vs.driveSel.slice() : list.map((d) => d.letter);
    if (sel.includes(letter)) sel = sel.filter((item) => item !== letter);
    else sel.push(letter);
    vs.driveSel = sel;
    saveVideoSettings(vs);
    render();
    return;
  }
  if (action === 'driveAll') {
    const list = state.videoDriveList || [];
    const all = !vs.driveSel || vs.driveSel.length === list.length;
    vs.driveSel = all ? [] : list.map((d) => d.letter);
    saveVideoSettings(vs);
    render();
    return;
  }
  if (action === 'scan') {
    if (vs.scanning || vs.running) return;
    const root = ($('#video-root')?.value || '').trim();
    const allDrives = !!$('#video-all-drives')?.checked;
    if (!root && !allDrives) {
      toast('先选一个源文件夹，或者勾上「全盘扫描」', 'error');
      return;
    }
    if (allDrives && Array.isArray(vs.driveSel) && !vs.driveSel.length) {
      toast('「全盘扫描」至少勾一块磁盘，或者把开关关掉改选文件夹', 'error');
      return;
    }
    vs.root = root;
    vs.allDrives = allDrives;
    const videoMin = readSizeField('video-min', vs.minUnit);
    const videoMax = readSizeField('video-max', vs.maxUnit);
    vs.minUnit = videoMin.unit;
    vs.maxUnit = videoMax.unit;
    vs.minMB = videoMin.empty ? 0 : videoMin.bytes / SIZE_FACTOR.MB;
    vs.maxMB = videoMax.empty ? 0 : videoMax.bytes / SIZE_FACTOR.MB;
    // 输入框里还压着没回车的后缀，先并进 exts 再取。
    const pendingExt = ($('#video-ext-add')?.value || '').trim();
    if (pendingExt) {
      addVideoExtTokens(pendingExt);
      const extInput = $('#video-ext-add');
      if (extInput) extInput.value = '';
    }
    vs.exts = videoExtTokens().join(',');
    vs.exclude = ($('#video-exclude')?.value || '').trim();
    vs.skipHidden = !!$('#video-hidden')?.checked;
    vs.dedupeScan = !!$('#video-dedupe-scan')?.checked;
    saveVideoSettings(vs);
    vs.items = [];
    vs.total = 0;
    vs.dirs = 0;
    vs.selected.clear();
    vs.scanStats = null;
    vs.truncated = false;
    vs.logs = [];
    vs.scanning = true;
    vs.meta = {};
    vs.metaPending = {};
    vs.metaQueue = [];
    vs.limit = 300;
    vs.dupGroups = [];
    vs.deduping = false;
    vs.dupProgress = null;
    if (vs.metaTimer) {
      clearTimeout(vs.metaTimer);
      vs.metaTimer = null;
    }
    paintVideoList();
    paintVideoLog();
    toolCall('video.scan', {
      root, allDrives, minMB: vs.minMB, maxMB: vs.maxMB,
      drives: allDrives && Array.isArray(vs.driveSel) ? vs.driveSel : [],
      exts: vs.exts ? vs.exts.split(/[,，;\s]+/).filter(Boolean) : [],
      exclude: vs.exclude, skipHidden: vs.skipHidden, dedupeScan: !!vs.dedupeScan,
    }).catch((error) => {
      vs.scanning = false;
      toast(error.message, 'error');
      paintVideoStatus();
    });
    return;
  }
  if (action === 'toggleSettings') {
    vs.settingsOpen = !vs.settingsOpen;
    render();
    return;
  }
  if (action === 'dedupeKeepOne') {
    const vs = videoState();
    let removed = 0;
    vs.dupGroups.forEach((group) => {
      (group.paths || []).forEach((path) => {
        if (vs.selected.delete(path)) removed += 1;
      });
    });
    toast(removed ? '已取消 ' + removed + ' 个重复副本的勾选' : '选中项里没有重复副本', removed ? 'ok' : 'info');
    paintVideoList();
    return;
  }
  if (action === 'filterStatus') {
    vs.statusFilter = status || 'all';
    vs.limit = 300;
    paintVideoList();
    return;
  }
  if (action === 'exportCsv') {
    const rows = videoVisibleItems().map((item, index) => [
      index + 1, item.name, item.size, formatBytes(item.size),
      formatDuration((vs.meta[item.id] || {}).duration), item.dir || '', item.path,
    ]);
    if (!rows.length) {
      toast('当前筛选下没有可导出的视频', 'error');
      return;
    }
    exportCsv('视频清单', ['序号', '文件名', '大小(字节)', '大小', '时长', '目录', '完整路径'], rows);
    return;
  }
  if (action === 'exportHtml') {
    exportVideoHtml();
    return;
  }
  if (action === 'selectAll') {
    videoVisibleItems().forEach((item) => vs.selected.add(item.path));
    paintVideoList();
    return;
  }
  if (action === 'clearSel') {
    vs.selected.clear();
    paintVideoList();
    return;
  }
  if (action === 'more') {
    vs.limit += 300;
    paintVideoList();
    return;
  }
  if (action === 'collect') {
    if (vs.running || vs.scanning) return;
    const dst = ($('#video-dst')?.value || '').trim();
    if (!dst) {
      toast('先选一个目标文件夹', 'error');
      return;
    }
    if (!vs.selected.size) {
      toast('先勾选要整理的视频', 'error');
      return;
    }
    vs.dst = dst;
    vs.move = ($('#video-mode')?.value || 'copy') === 'move';
    vs.dedupe = !!$('#video-dedupe')?.checked;
    vs.skipConflict = !!$('#video-skip')?.checked;
    vs.openAfter = !!$('#video-open-after')?.checked;
    saveVideoSettings(vs);
    const files = vs.items
      .filter((item) => vs.selected.has(item.path))
      .map((item) => ({ id: item.id, path: item.path }));
    const start = () => {
      vs.running = true;
      vs.progress = { done: 0, total: files.length, name: '' };
      vs.collectStats = null;
      vs.logs = [];
      paintVideoStatus();
      paintVideoList();
      paintVideoLog();
      toolCall('video.start', { dst, move: vs.move, dedupe: vs.dedupe, skipConflict: vs.skipConflict, files })
        .catch((error) => {
          vs.running = false;
          toast(error.message, 'error');
          paintVideoStatus();
        });
    };
    if (vs.move) {
      showConfirm({
        title: `移动这 ${files.length} 个视频？`,
        message: `移动到：${dst}\n移动后源位置不再保留这些文件，请确认目标目录无误。`,
        confirmLabel: '开始移动',
        iconName: 'film',
        danger: true,
        onConfirm: start,
      });
    } else {
      start();
    }
    return;
  }
  if (action === 'cancel') {
    toolCall('video.cancel').catch(() => {});
    return;
  }
  if (action === 'undo') {
    if (vs.undoing) return;
    showConfirm({
      title: '撤销本次整理？',
      message: '移动过的文件会移回原位；复制产生的目标副本会移入回收站。',
      confirmLabel: '撤销',
      iconName: 'refresh',
      danger: false,
      onConfirm: () => {
        vs.undoing = true;
        paintVideoStatus();
        toolCall('video.undo').then(() => toast('正在撤销…'))
          .catch((error) => {
            vs.undoing = false;
            paintVideoStatus();
            toast(error.message, 'error');
          });
      },
    });
    return;
  }
  if (action === 'openDst') {
    const dst = ($('#video-dst')?.value || vs.dst || '').trim();
    if (!dst) return;
    toolCall('folders.open', { path: dst }).catch((error) => toast(error.message, 'error'));
    return;
  }
  if (action === 'delete') {
    requestVideoDelete([path]);
    return;
  }
  if (action === 'deleteSelected') {
    const paths = Array.from(vs.selected);
    if (!paths.length) {
      toast('先勾选要删除的视频', 'error');
      return;
    }
    requestVideoDelete(paths);
    return;
  }
  if (action === 'open' || action === 'reveal') {
    toolCall(action === 'open' ? 'video.open' : 'video.reveal', { path })
      .catch((error) => toast(error.message, 'error'));
  }
}

viewEl.addEventListener('dblclick', (event) => {
  const row = event.target.closest('#video-list tr[data-vid]');
  if (!row || event.target.closest('input, button')) return;
  handleVideoAction('preview', row.dataset.path);
});

viewEl.addEventListener('contextmenu', (event) => {
  if (!state.mini || state.view !== 'tool' || state.toolId !== 'folders') return;
  const row = event.target.closest('.mini-folder-row');
  if (!row) return;
  event.preventDefault();
  const fs = foldersState();
  fs.miniMenu = { path: row.dataset.path || '', x: event.clientX, y: event.clientY };
  render();
});

viewEl.addEventListener('click', (event) => {
  const check = event.target.closest('.mini-folder-check');
  if (!check || !event.shiftKey) return;
  event.preventDefault();
  const fs = foldersState();
  const list = miniFolderFiltered();
  const index = list.findIndex((item) => item.path === check.dataset.path);
  if (index < 0) return;
  if (fs.miniLastIndex == null) {
    fs.miniSelected.add(list[index].path);
  } else {
    const [from, to] = fs.miniLastIndex < index
      ? [fs.miniLastIndex, index]
      : [index, fs.miniLastIndex];
    list.slice(from, to + 1).forEach((item) => fs.miniSelected.add(item.path));
  }
  fs.miniLastIndex = index;
  paintFolders();
}, true);

document.addEventListener('click', (event) => {
  if (!foldersState().miniMenu) return;
  if (event.target.closest('.mini-folder-menu') || event.target.closest('.mini-folder-row')) return;
  closeMiniFolderMenu();
});

viewEl.addEventListener('change', (event) => {
  const vs = videoState();
  const target = event.target;
  if (target.id === 'set-taskbar') {
    post({ type: 'setTaskbar', payload: { show: !!target.checked } });
    state.appInfo = { ...(state.appInfo || {}), taskbar: !!target.checked };
    toast(target.checked ? '主窗口会显示在任务栏' : '主窗口已从任务栏移除，可从托盘唤出', 'info');
    return;
  }
  if (target.classList && target.classList.contains('mini-folder-check')) {
    const fs = foldersState();
    if (target.checked) fs.miniSelected.add(target.dataset.path);
    else fs.miniSelected.delete(target.dataset.path);
    fs.miniLastIndex = miniFolderFiltered().findIndex((item) => item.path === target.dataset.path);
    paintFolders();
    return;
  }
  if (target.classList && target.classList.contains('video-check')) {
    if (target.checked) vs.selected.add(target.dataset.path);
    else vs.selected.delete(target.dataset.path);
    paintVideoStatus();
    return;
  }
  if (target.id === 'video-select-all') {
    const visible = videoVisibleItems();
    if (target.checked) visible.forEach((item) => vs.selected.add(item.path));
    else visible.forEach((item) => vs.selected.delete(item.path));
    paintVideoList();
    return;
  }
  if (target.id === 'video-mode') vs.move = target.value === 'move';
  if (target.id === 'video-min' || target.id === 'video-min-unit') {
    const field = readSizeField('video-min', vs.minUnit);
    vs.minUnit = field.unit;
    vs.minMB = field.empty ? 0 : field.bytes / SIZE_FACTOR.MB;
  }
  if (target.id === 'video-dedupe') vs.dedupe = target.checked;
  if (target.id === 'video-skip') vs.skipConflict = target.checked;
  if (target.id === 'video-open-after') vs.openAfter = target.checked;
  if (target.id === 'video-all-drives') {
    vs.allDrives = target.checked;
    saveVideoSettings(vs);
    // 勾上后整个工具栏要换成磁盘勾选条（关掉换回路径框），所以得重渲染一次
    if (vs.allDrives) loadVideoDrives();
    render();
    return;
  }
  if (target.id === 'video-hidden') vs.skipHidden = target.checked;
  if (target.id === 'video-dedupe-scan') vs.dedupeScan = target.checked;
  if (/^video-(mode|min|min-unit|dedupe|skip|open-after|all-drives|hidden|dedupe-scan)$/.test(target.id)) saveVideoSettings(vs);

  // 大文件 / 重复 / 空文件夹共用的「全盘扫描」开关
  if (['scan-all-drives', 'dup-all-drives', 'empty-all-drives'].includes(target.id)) {
    driveScope().allDrives = target.checked;
    saveDriveScope();
    if (target.checked) loadDriveList();
    render();
    return;
  }
});

function showShortcutHelp() {
  const groups = [
    { title: '通用', rows: [['Ctrl K', '搜索工具'], ['F1', '打开这份快捷键说明'], ['Esc', '关闭弹层 / 返回上一步']] },
    { title: '悬浮窗', rows: [['Ctrl Alt Shift F', '显示或隐藏常用文件夹面板'], ['双击标题栏', '收起 / 展开悬浮窗'], ['Alt F4', '隐藏悬浮窗（不退出）']] },
    { title: '常用文件夹', rows: [['Insert', '新增文件夹'], ['Shift 点击', '连续多选'], ['Ctrl A', '全选清单'], ['Esc', '依次关闭菜单 / 表单 / 搜索']] },
    { title: '视频整理', rows: [['Ctrl F', '筛选视频'], ['Ctrl A', '全选当前结果'], ['Delete', '删除选中到回收站'], ['Enter', '预览第一个选中'], ['Esc', '清筛选 / 取消选择']] },
  ];
  modalRoot.innerHTML = `
    <div class="modal-overlay">
      <div class="modal shortcut-modal" role="dialog" aria-modal="true" aria-label="快捷键">
        <div class="modal-icon">${icon('keyboard', 21)}</div>
        <h3>快捷键</h3>
        <p>所有操作都在本地完成；下面这些键位能少点几次鼠标。</p>
        <div class="shortcut-groups">
          ${groups.map((group) => `
            <div class="shortcut-group">
              <h4>${group.title}</h4>
              ${group.rows.map(([keys, label]) => `
                <div class="shortcut-row"><kbd>${keys}</kbd><span>${label}</span></div>`).join('')}
            </div>`).join('')}
        </div>
        <div class="modal-actions">
          <button class="btn primary" id="modal-cancel">知道了</button>
        </div>
      </div>
    </div>`;
  const overlay = modalRoot.firstElementChild;
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  });
  $('#modal-cancel').addEventListener('click', closeModal);
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'F1') {
    event.preventDefault();
    showShortcutHelp();
    return;
  }
  if (event.key === 'Escape' && document.querySelector('.shortcut-modal')) {
    closeModal();
    return;
  }
  if (event.key === 'Escape' && $('#video-player-mask')) closeVideoPreview();
  if (state.view !== 'tool' || state.toolId !== 'video-collector' || $('#video-player-mask')) return;
  const vs = videoState();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    $('#video-filter')?.focus();
    return;
  }
  if (event.key === 'Escape') {
    if (vs.filter) {
      vs.filter = '';
      vs.limit = 300;
      render();
    } else if (vs.selected.size) {
      vs.selected.clear();
      paintVideoList();
    }
    return;
  }
  const typing = event.target.matches && event.target.matches('input, textarea, select');
  if (typing) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.preventDefault();
    videoVisibleItems().forEach((item) => vs.selected.add(item.path));
    paintVideoList();
    return;
  }
  if (event.key === 'Delete') {
    event.preventDefault();
    handleVideoAction('deleteSelected');
    return;
  }
  if (event.key === 'Enter') {
    const first = Array.from(vs.selected)[0] || (videoVisibleItems()[0] || {}).path;
    if (first) handleVideoAction('preview', first);
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}
