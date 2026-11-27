// ---- 磁盘体检：一次跑完四件事，给一张"能腾出多少空间"的总账 ----
//
// 能力全是现成的（scanEmpty / scanLarge / scanDuplicates / scanTemp），
// 这里只做编排：后端同一时间只跑一个主任务，所以四步严格串行——
// 上一步的 done 消息到了才发下一步，避免两条扫描互相覆盖进度。
// 体检期间不动 state.scan / state.empty 这些"单工具状态"，别人点开
// 对应工具页时看到的还是自己上一次的结果，不会串味。

const CHECKUP_STAGES = [
  { key: 'empty', label: '空文件夹', icon: 'folder-x', tool: 'empty-folders', hint: '自底向上找空目录' },
  { key: 'large', label: '大文件', icon: 'scan', tool: 'large-files', hint: '≥ 100 MB 的文件' },
  { key: 'dup', label: '重复文件', icon: 'copy', tool: 'duplicates', hint: '≥ 10 MB 的同内容副本' },
  { key: 'temp', label: '临时文件', icon: 'broom', tool: 'temp-cleaner', hint: '系统临时目录与缓存' },
];

// 体检只按"选中的盘"扫：它本来就是个磁盘级动作，不提供单目录入口。
function checkupRoots() {
  const scope = driveScope();
  const list = state.driveList || [];
  if (!list.length) return null;
  const letters = list.filter((d) => !scope.sel || scope.sel.includes(d.letter)).map((d) => d.letter);
  return letters.length ? letters : null;
}

function startCheckup() {
  const roots = checkupRoots();
  if (!roots) {
    toast('至少勾一块磁盘再体检', 'error');
    return;
  }
  state.checkup = {
    running: true,
    index: 0,
    stage: 'empty',
    roots,
    results: {},
    cancelled: false,
  };
  post({ type: 'scanEmpty', payload: { roots } });
  render();
}

function stopCheckup() {
  // 后端只认这一个取消入口，四个阶段的扫描器都会响应同一个 cancel 标志。
  post({ type: 'cancelScan' });
}

function checkupPostStage(stage, roots) {
  if (stage === 'empty') post({ type: 'scanEmpty', payload: { roots } });
  else if (stage === 'large') {
    post({ type: 'scanLarge', payload: { roots, minSizeBytes: 100 * 1024 * 1024, includeHidden: false } });
  } else if (stage === 'dup') {
    // 10MB 起跳：体检要的是"明显值得删"的重复，小文件交给专门页面按需细查。
    post({ type: 'scanDuplicates', payload: { roots, minSizeBytes: 10 * 1024 * 1024 } });
  } else {
    post({ type: 'scanTemp' });
  }
}

function checkupRecord(key, payload) {
  const results = state.checkup.results;
  if (key === 'empty') {
    results.empty = { count: (payload.folders || []).length, elapsedMs: payload.elapsedMs || 0 };
  } else if (key === 'large') {
    const items = payload.items || [];
    const bytes = items.reduce((sum, item) => sum + (item.size || 0), 0);
    results.large = {
      count: payload.totalMatched || items.length,
      bytes,
      listed: items.length,
      elapsedMs: payload.elapsedMs || 0,
    };
  } else if (key === 'dup') {
    results.dup = {
      groups: (payload.groups || []).length,
      bytes: payload.duplicateBytes || 0,
      elapsedMs: payload.elapsedMs || 0,
    };
  } else if (key === 'temp') {
    results.temp = {
      count: (payload.entries || []).length,
      bytes: payload.total || 0,
      elapsedMs: payload.elapsedMs || 0,
    };
  }
}

// 返回 true 表示这条 done 消息属于体检（已接手处理）；
// 返回 false 表示是用户在某个工具页自己发起的扫描，交给原有 handler。
function checkupAdvance(stage, payload) {
  const c = state.checkup;
  if (!c || !c.running || c.stage !== stage) return false;

  if (payload && payload.cancelled) {
    c.running = false;
    c.cancelled = true;
    render();
    toast('体检已取消', 'info');
    return true;
  }

  checkupRecord(stage, payload);

  const next = CHECKUP_STAGES[c.index + 1];
  if (next) {
    c.index += 1;
    c.stage = next.key;
    render();  // 先把卡片切到"检查中"，再发下一步
    checkupPostStage(next.key, c.roots);
  } else {
    c.running = false;
    render();
    toast(`体检完成，预计可释放 ${formatBytes(checkupReclaimable())}`, 'success');
  }
  return true;
}

// 进度消息只改一行文本，不整页重绘：全盘扫描时这类消息是高频的。
function onCheckupProgress(payload) {
  const el = document.getElementById('checkup-status');
  if (!el) return;
  const c = state.checkup;
  const stage = CHECKUP_STAGES.find((s) => s.key === c.stage);
  const counts = c.stage === 'temp'
    ? `${formatNumber(payload.files || 0)} 个文件 · ${formatBytes(payload.bytes || 0)}`
    : `${formatNumber(payload.files || 0)} 个文件 · ${formatNumber(payload.dirs || 0)} 个目录`;
  const tail = payload.current ? ` · ${payload.current}` : '';
  el.textContent = `正在检查${stage ? stage.label : ''} · ${counts}${tail}`;
}

// 只把"重复 + 临时"算成可安全释放；大文件是"占用最多"，删不删得看用户。
function checkupReclaimable() {
  const r = state.checkup.results || {};
  return ((r.dup && r.dup.bytes) || 0) + ((r.temp && r.temp.bytes) || 0);
}

function gotoCheckupDetail(toolId) {
  if (!toolId) return;
  // 体检的盘选择就是共用那一份，跳过去时把"全盘模式"打开，
  // 用户能看到同样的盘符勾选，不用重新点一遍。
  const scope = driveScope();
  scope.allDrives = true;
  saveDriveScope();
  openTool(toolId);
}

function checkupCardHtml(stage) {
  const c = state.checkup;
  const r = c.results[stage.key];
  const running = c.running && c.stage === stage.key;
  const stateClass = running ? 'is-running' : r ? 'is-done' : 'is-idle';
  let value = '待检查';
  let note = stage.hint;
  if (r) {
    if (stage.key === 'empty') {
      value = `${formatNumber(r.count)} 个`;
      note = '删掉后目录树更清爽，本身不占空间';
    } else if (stage.key === 'large') {
      value = `${formatNumber(r.count)} 个`;
      // 命中数超过 1000 时只列前 1000 个，必须在文案里说清楚，
      // 否则用户会以为卡片上的合计就是全部体积。
      note = r.count > (r.listed || 0)
        ? `命中 ${formatNumber(r.count)} 个，已列出 ${formatNumber(r.listed || 0)} 个合计 ${formatBytes(r.bytes)}`
        : `合计 ${formatBytes(r.bytes)}（≥ 100 MB）`;
    } else if (stage.key === 'dup') {
      value = `${formatNumber(r.groups)} 组`;
      note = `可释放 ${formatBytes(r.bytes)}`;
    } else if (stage.key === 'temp') {
      value = formatBytes(r.bytes);
      note = `${formatNumber(r.count)} 个项目`;
    }
  }
  if (running) note = '正在检查…';
  return `
    <div class="checkup-card ${stateClass}">
      <div class="checkup-head">${icon(stage.icon, 16)}<span>${stage.label}</span></div>
      <div class="checkup-value">${value}</div>
      <div class="checkup-note">${escapeHtml(note)}</div>
      ${r ? `<button class="mini-btn" data-checkup="go" data-tool="${stage.tool}">查看明细</button>` : ''}
    </div>`;
}

function checkupSummaryHtml() {
  const c = state.checkup;
  const r = c.results || {};
  if (!Object.keys(r).length) return '';
  const dupBytes = (r.dup && r.dup.bytes) || 0;
  const tempBytes = (r.temp && r.temp.bytes) || 0;
  const largeBytes = (r.large && r.large.bytes) || 0;
  const emptyCount = (r.empty && r.empty.count) || 0;
  const extra = [];
  if (r.large) extra.push(`${formatNumber(r.large.count)} 个大文件占用 ${formatBytes(largeBytes)}`);
  if (r.empty) extra.push(`${formatNumber(emptyCount)} 个空文件夹`);
  return `
    <div class="checkup-total">
      <div class="checkup-total-main">
        <span>预计可安全释放</span>
        <strong>${formatBytes(checkupReclaimable())}</strong>
      </div>
      <div class="checkup-total-sub">
        重复文件 ${formatBytes(dupBytes)} + 临时文件 ${formatBytes(tempBytes)}${extra.length ? '；另有 ' + extra.join('，') : ''}
      </div>
    </div>`;
}

function renderCheckup(tool) {
  const c = state.checkup;
  const roots = checkupRoots();
  const cards = CHECKUP_STAGES.map(checkupCardHtml).join('');
  const canStart = Boolean(roots) && !c.running;
  let statusText = '选好磁盘后开始体检';
  if (c.running) {
    const stage = CHECKUP_STAGES.find((s) => s.key === c.stage);
    statusText = `正在检查${stage ? stage.label : ''}…`;
  } else if (c.cancelled) {
    statusText = '上次体检被取消，可重新开始';
  } else if (Object.keys(c.results || {}).length) {
    statusText = '可以在下方各工具里查看明细并处理';
  }
  return `
    ${pageHead(tool, '磁盘 / 系统体检')}
    <div class="panel">
      <div class="toolbar">
        ${driveBarHtml()}
      </div>
      <div class="checkup-actions">
        <button class="btn primary" data-checkup="start" ${canStart ? '' : 'disabled'}>
          ${icon('shield', 15)} ${c.running ? '体检中…' : '开始体检'}
        </button>
        ${c.running ? `<button class="btn ghost" data-checkup="stop">${icon('x', 14)} 停止</button>` : ''}
        <span class="progress-current" id="checkup-status">${escapeHtml(statusText)}</span>
      </div>
      <div class="checkup-grid">${cards}</div>
      ${c.running ? '' : checkupSummaryHtml()}
    </div>`;
}
