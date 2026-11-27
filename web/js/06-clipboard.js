// ---- 第 6/8 块：本块起始于 function exportScanCsv() { ----
function exportScanCsv() {
  const rows = sortedScanRows().map(({ item }, index) => [
    index + 1, item.name, item.size, formatBytes(item.size), formatDate(item.mtime), item.path,
  ]);
  exportCsv('大文件清单', ['序号', '文件名', '大小(字节)', '大小', '修改时间', '完整路径'], rows);
}

function exportEmptyCsv() {
  const rows = state.empty.folders.map((path, index) => [index + 1, path]);
  exportCsv('空文件夹清单', ['序号', '文件夹路径'], rows);
}

function exportDupCsv() {
  const rows = [];
  state.dup.groups.forEach((group, groupIndex) => {
    group.files.forEach((file, fileIndex) => {
      rows.push([
        groupIndex + 1, formatBytes(group.size), group.hash,
        file.name, file.size, formatBytes(file.size), formatDate(file.mtime),
        fileIndex === 0 ? '保留' : '重复', file.path,
      ]);
    });
  });
  exportCsv('重复文件清单', ['组号', '组大小', '哈希', '文件名', '大小(字节)', '大小', '修改时间', '标记', '完整路径'], rows);
}

/* ---- 剪贴板历史 ---- */

function syncClipboardListener() {
  post({ type: 'setClipboardEnabled', payload: { enabled: !state.clip.paused } });
}

function persistClips() {
  try {
    localStorage.removeItem('toolsoft.clips.v2');
    localStorage.setItem('toolsoft.clipsPaused.v2', JSON.stringify(state.clip.paused));
  } catch { /* 存储满时静默失败 */ }
  syncClipboardListener();
}

function pushClip(text) {
  if (state.clip.paused) return;
  const trimmed = text.replace(/\r\n/g, '\n');
  if (!trimmed.trim()) return;
  const items = state.clip.items.filter((item) => item.text !== trimmed);
  items.unshift({ text: trimmed, time: Date.now() });
  state.clip.items = items.slice(0, 50);
  persistClips();
  if (state.view === 'tool' && state.toolId === 'clipboard-history') refreshClipList();
}

function refreshClipList() {
  const list = $('#clip-list');
  if (list) list.innerHTML = clipItemsHtml();
}

function clipItemsHtml() {
  return `
    <div class="clip-list">
      ${state.clip.items.map((item, index) => `
        <div class="clip-item">
          <div class="clip-text">${escapeHtml(item.text.length > 400 ? `${item.text.slice(0, 400)}…` : item.text)}</div>
          <div class="clip-meta">
            <span>${formatDate(item.time)}</span>
            <span class="clip-actions">
              <button class="mini-btn" data-clip-copy="${index}">复制</button>
              <button class="mini-btn" data-clip-del="${index}">删除</button>
            </span>
          </div>
        </div>`).join('')}
    </div>`;
}

function renderClipboard(tool) {
  const clip = state.clip;
  return `
    ${pageHead(tool, '系统 / 效率')}
    <div class="panel">
      <div class="xl-toolbar">
        <div class="summary-strip xl-chips">
          <span class="summary-chip"><strong>${clip.items.length}</strong> 条记录</span>
          <span class="summary-chip ${clip.paused ? '' : 'good'}">${clip.paused ? '已暂停监听' : '监听中'}</span>
        </div>
        <div class="xl-actions">
          <button class="btn small ghost" id="clip-toggle">${clip.paused ? icon('refresh', 14) + ' 恢复监听' : icon('pause', 14) + ' 暂停监听'}</button>
          <button class="btn small danger-ghost" id="clip-clear" ${clip.items.length ? '' : 'disabled'}>${icon('trash', 14)} 清空记录</button>
        </div>
      </div>
      <div id="clip-list">${clip.items.length ? clipItemsHtml() : `
        <div class="empty-state">
          <div class="empty-orb">${icon('clipboard', 27)}</div>
          <h3>剪贴板历史默认暂停</h3>
          <p>点上方「恢复监听」后，在本机任意程序里按 Ctrl+C 复制的文本会保留最近 50 条；记录只在本次运行内有效，退出程序即清空，不写入磁盘。建议不要记录密码等敏感内容。</p>
        </div>`}</div>
    </div>`;
}

function bindClipboardEvents() {
  viewEl.addEventListener('click', (event) => {
    if (event.target.closest('#clip-toggle')) {
      state.clip.paused = !state.clip.paused;
      persistClips();
      if (!state.clip.paused) post({ type: 'getClipboard' });
      render();
      return;
    }
    if (event.target.closest('#clip-clear')) {
      state.clip.items = [];
      persistClips();
      render();
      toast('已清空剪贴板记录');
      return;
    }
    const copyBtn = event.target.closest('[data-clip-copy]');
    if (copyBtn) {
      const item = state.clip.items[Number(copyBtn.dataset.clipCopy)];
      if (item) {
        copyText(item.text);
      }
      return;
    }
    const delBtn = event.target.closest('[data-clip-del]');
    if (delBtn) {
      state.clip.items.splice(Number(delBtn.dataset.clipDel), 1);
      persistClips();
      refreshClipList();
    }
  });
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const nav = event.target.closest('.sidebar [data-nav], .top-actions [data-nav]');
    if (!nav) return;

    if (nav.dataset.nav === 'settings') {
      state.view = 'settings';
      state.toolId = null;
      render();
      viewEl.scrollTop = 0;
      return;
    }

    state.view = 'home';
    state.toolId = null;
    state.category = nav.dataset.category || 'all';
    state.query = '';
    searchInput.value = '';
    render();
    viewEl.scrollTop = 0;
  });

  viewEl.addEventListener('click', (event) => {
    const pin = event.target.closest('[data-pin]');
    if (pin) {
      togglePin(pin.dataset.pin);
      return;
    }

    // 表头排序：点同一列再点一次切升降序；用下标操作的表先原地重排
    const sortTh = event.target.closest('[data-sort-key]');
    if (sortTh) {
      const scope = sortTh.dataset.sortScope;
      const key = sortTh.dataset.sortKey;
      toggleSortOf(scope, key);
      if (SORT_INPLACE[scope]) SORT_INPLACE[scope]();
      const before = document.querySelector('#view');
      const keepTop = before ? before.scrollTop : 0;
      render();
      // render 会重建 DOM，滚动位置要还原，否则点一下表头整页跳回顶部
      const after = document.querySelector('#view');
      if (after) after.scrollTop = keepTop;
      return;
    }

    const exportBtn = event.target.closest('[data-export]');
    if (exportBtn) {
      handleExportClick(exportBtn.dataset.export);
      return;
    }

    // 悬浮按钮必须排在 [data-open] 之前：卡片本身就是 data-open，
    // 放在后面会被卡片的「打开工具页」抢走点击，按钮等于失灵。
    const miniOpenBtn = event.target.closest('[data-mini-open]');
    if (miniOpenBtn) {
      post({ type: 'miniOpen', payload: { tool: miniOpenBtn.dataset.miniOpen } });
      // 悬浮窗要等首帧画好才出场（避免先闪一个白壳），先把按钮点亮，
      // 让点击立刻有反馈。
      miniOpenBtn.classList.add('is-busy');
      setTimeout(() => miniOpenBtn.classList.remove('is-busy'), 600);
      toast('正在打开悬浮窗…');
      return;
    }

    const open = event.target.closest('[data-open]');
    if (open) {
      openTool(open.dataset.open);
      return;
    }

    const nav = event.target.closest('[data-nav]');
    if (nav) {
      navigateHome(nav.dataset.category || 'all');
      return;
    }

    const filter = event.target.closest('[data-filter]');
    if (filter) {
      state.category = filter.dataset.filter;
      state.query = '';
      searchInput.value = '';
      renderHomeOnly();
      return;
    }

    const themeChoice = event.target.closest('[data-theme-choice]');
    if (themeChoice) {
      applyTheme(themeChoice.dataset.themeChoice);
      updateThemeControls();
      return;
    }

    const zoomChoice = event.target.closest('[data-zoom-choice]');
    if (zoomChoice) {
      applyZoom(Number(zoomChoice.dataset.zoomChoice));
      return;
    }

    const sort = event.target.closest('[data-sort]');
    if (sort) {
      const key = sort.dataset.sort;
      if (state.scan.sortKey === key) {
        state.scan.sortDir = state.scan.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.scan.sortKey = key;
        state.scan.sortDir = key === 'name' ? 'asc' : 'desc';
      }
      const results = $('#scan-results');
      if (results) results.innerHTML = renderScanResults();
      requestAnimationFrame(syncScanChecks);
      return;
    }

    const folderBtn = event.target.closest('[data-folder-action]');
    if (folderBtn) {
      if (event.target.closest('.mini-folder-check')) return;
      handleFolderAction(folderBtn.dataset.folderAction, folderBtn.dataset.path || '');
      return;
    }

    const miniBtn = event.target.closest('[data-mini-action]');
    if (miniBtn) {
      const action = miniBtn.dataset.miniAction;
      if (action === 'main') {
        post({ type: 'miniOpenMain' });
        return;
      }
      if (action === 'pin') state.miniPinned = !state.miniPinned;
      if (action === 'collapse') state.miniCollapsed = !state.miniCollapsed;
      post({ type: 'mini', payload: { action } });
      if (action === 'collapse') render();
      if (action === 'pin') {
        miniBtn.classList.toggle('active', state.miniPinned);
        miniBtn.title = state.miniPinned ? '取消置顶' : '置顶';
      }
      return;
    }

    // 通用盘符条（大文件 / 重复 / 空文件夹）：点击单个盘 -> 切换选中，右侧按钮 -> 全选/全不选
    const drivePick = event.target.closest('[data-drive-pick]');
    if (drivePick) {
      const scope = driveScope();
      const letter = drivePick.dataset.drivePick;
      const letters = (state.driveList || []).map((d) => d.letter);
      let sel = scope.sel ? scope.sel.slice() : letters.slice();
      sel = sel.includes(letter) ? sel.filter((x) => x !== letter) : sel.concat(letter);
      scope.sel = sel;
      saveDriveScope();
      render();
      return;
    }
    if (event.target.closest('[data-drive-all]')) {
      const scope = driveScope();
      const letters = (state.driveList || []).map((d) => d.letter);
      const allChosen = !scope.sel || scope.sel.length === letters.length;
      scope.sel = allChosen ? [] : letters.slice();
      saveDriveScope();
      render();
      return;
    }

    const videoBtn = event.target.closest('[data-video-action]');
    if (videoBtn) {
      handleVideoAction(videoBtn.dataset.videoAction, videoBtn.dataset.path || '', videoBtn.dataset.status || '');
      return;
    }

    const popBtn = event.target.closest('[data-preview-pop]');
    if (popBtn) {
      const p = previewPopState();
      if (popBtn.dataset.previewPop === 'open') {
        toolCall('video.open', { path: p.path }).catch((error) => toast(error.message, 'error'));
      } else {
        post({ type: 'mini', payload: { action: 'hide' } });
      }
      return;
    }

    if (event.target.closest('[data-mini-launch]')) {
      post({ type: 'miniOpen', payload: { tool: 'launcher' } });
      return;
    }
    const action = event.target.closest('[data-action]');
    if (action) {
      const index = Number(action.dataset.index);
      if (action.dataset.action === 'copy-path') {
        copyPath(action.dataset.path);
      } else if (action.dataset.action === 'delete') {
        const item = state.scan.items[index];
        if (item) requestRecycle([item.path], 'large');
      } else if (action.dataset.action === 'delete-empty') {
        const path = state.empty.folders[index];
        if (path) requestRecycle([path], 'empty');
      } else if (action.dataset.action === 'copy-hash') {
        copyText(action.dataset.hash || '');
      }
      return;
    }

    const dupKeep = event.target.closest('[data-dup-keep]');
    if (dupKeep) {
      const group = state.dup.groups[Number(dupKeep.dataset.dupKeep)];
      if (group) {
        group.files.forEach((file, fileIndex) => {
          if (fileIndex > 0) state.dup.selected.add(file.path);
          else state.dup.selected.delete(file.path);
        });
        refreshDupPage();
      }
      return;
    }

    const spaceRow = event.target.closest('[data-space-index]');
    if (spaceRow) {
      const entry = state.space.entries[Number(spaceRow.dataset.spaceIndex)];
      if (entry && entry.isDir) {
        state.space.history.push(state.space.root);
        state.space.root = entry.path;
        startSpaceScan();
      }
      return;
    }

    const kill = event.target.closest('[data-kill-pid]');
    if (kill) {
      const pid = Number(kill.dataset.killPid);
      const name = kill.dataset.killName || '该进程';
      showConfirm({
        title: '结束这个进程？',
        message: `结束 ${name}（PID ${pid}）可能导致它正在处理的数据丢失。请确认不是系统关键进程。`,
        paths: [],
        confirmLabel: '结束进程',
      });
      modalConfirm = () => post({ type: 'killProcess', payload: { pid } });
      return;
    }

    if (event.target.closest('#dup-pick')) {
      pickFolder('dup');
      return;
    }
    if (event.target.closest('#dup-start')) {
      startDupScan();
      return;
    }
    if (event.target.closest('#dup-cancel') || event.target.closest('#space-cancel') ||
        event.target.closest('#hash-cancel') || event.target.closest('#temp-cancel')) {
      post({ type: 'cancelScan' });
      toast('正在取消…');
      return;
    }
    if (event.target.closest('#dup-select-all')) {
      state.dup.groups.forEach((group) => {
        group.files.forEach((file, fileIndex) => {
          if (fileIndex > 0) state.dup.selected.add(file.path);
        });
      });
      refreshDupPage();
      return;
    }
    if (event.target.closest('#dup-clear-selection')) {
      state.dup.selected.clear();
      refreshDupPage();
      return;
    }
    if (event.target.closest('#dup-delete-selected')) {
      requestRecycle(Array.from(state.dup.selected), 'dup');
      return;
    }
    if (event.target.closest('#organizer-pick')) {
      pickFolder('organizer');
      return;
    }
    if (event.target.closest('#organizer-target-pick')) {
      pickFolder('organizer-target');
      return;
    }
    if (event.target.closest('#organizer-target-clear')) {
      invalidateOrganizerPreview();
      state.organizer.targetRoot = '';
      const input = $('#organizer-target');
      if (input) input.value = '';
      render();
      return;
    }
    if (event.target.closest('#organizer-start')) {
      startOrganize();
      return;
    }
    if (event.target.closest('#organizer-preview-run')) {
      executeOrganizerPreview();
      return;
    }
    if (event.target.closest('#organizer-preview-cancel')) {
      cancelOrganizerPreview();
      return;
    }
    if (event.target.closest('#organizer-undo')) {
      undoOrganizer();
      return;
    }
    if (event.target.closest('#organizer-cancel')) {
      post({ type: 'cancelScan' });
      toast('正在取消…');
      return;
    }
    if (event.target.closest('#organizer-dup-cancel')) {
      post({ type: 'cancelScan' });
      toast('正在取消重复文件检查…');
      return;
    }
    if (event.target.closest('#organizer-add-rule')) {
      state.organizer.rules.push({
        enabled: true, name: '', exts: '', nameContains: '', nameWildcard: '',
        minMB: 0, maxMB: 0, olderThanDays: 0, newerThanDays: 0,
        target: 'byExt', dir: '', groupExt: '新分类', dateMode: 'year-month',
      });
      saveOrganizerRules();
      refreshOrganizeRules();
      return;
    }
    if (event.target.closest('[data-org-del]')) {
      const i = Number(event.target.closest('[data-org-del]').dataset.orgDel);
      if (i >= 0 && i < state.organizer.rules.length) {
        state.organizer.rules.splice(i, 1);
        saveOrganizerRules();
        refreshOrganizeRules();
      }
      return;
    }
    if (event.target.closest('[data-org-up]')) {
      const i = Number(event.target.closest('[data-org-up]').dataset.orgUp);
      const rules = state.organizer.rules;
      if (i > 0 && i < rules.length) {
        [rules[i - 1], rules[i]] = [rules[i], rules[i - 1]];
        saveOrganizerRules();
        refreshOrganizeRules();
      }
      return;
    }
    if (event.target.closest('[data-org-down]')) {
      const i = Number(event.target.closest('[data-org-down]').dataset.orgDown);
      const rules = state.organizer.rules;
      if (i >= 0 && i < rules.length - 1) {
        [rules[i], rules[i + 1]] = [rules[i + 1], rules[i]];
        saveOrganizerRules();
        refreshOrganizeRules();
      }
      return;
    }
    if (event.target.closest('#space-pick')) {
      pickFolder('space');
      return;
    }
    if (event.target.closest('#space-start')) {
      startSpaceScan();
      return;
    }
    if (event.target.closest('#space-up')) {
      if (state.space.history.length) {
        state.space.root = state.space.history.pop();
        startSpaceScan();
      }
      return;
    }
    if (event.target.closest('#rename-pick')) {
      pickFolder('rename');
      return;
    }
    if (event.target.closest('#rename-refresh')) {
      requestListFolder();
      return;
    }
    if (event.target.closest('#rename-apply')) {
      applyRenameNow();
      return;
    }
    if (event.target.closest('#rename-undo')) {
      undoRename();
      return;
    }
    if (event.target.closest('#hash-pick')) {
      pickFolder('hash');
      return;
    }
    if (event.target.closest('#hash-start')) {
      startHashScan();
      return;
    }
    if (event.target.closest('#temp-start')) {
      startTempScan();
      return;
    }
    if (event.target.closest('#temp-delete-selected')) {
      requestRecycle(Array.from(state.temp.selected), 'temp');
      return;
    }
    if (event.target.closest('#temp-clear-selection')) {
      state.temp.selected.clear();
      refreshTempPage();
      return;
    }
    if (event.target.closest('#unlock-pick')) {
      state.unlock.mode = 'file';
      pickFile('unlock');
      return;
    }
    if (event.target.closest('#unlock-pick-folder')) {
      state.unlock.mode = 'folder';
      pickFolder('unlock-folder');
      return;
    }
    if (event.target.closest('#unlock-start')) {
      startUnlockCheck();
      return;
    }

    if (event.target.closest('#usb-refresh')) {
      usbRefresh();
      return;
    }
    if (event.target.closest('#usb-check')) {
      usbCheckLockers();
      return;
    }
    if (event.target.closest('#usb-eject')) {
      usbDoEject(false);
      return;
    }
    if (event.target.closest('#usb-force-eject')) {
      usbDoEject(true);
      return;
    }
    const killUsb = event.target.closest('[data-kill-usb-pid]');
    if (killUsb) {
      const pid = Number(killUsb.dataset.killUsbPid);
      const name = killUsb.dataset.killUsbName || '该进程';
      showConfirm({
        title: '结束这个进程？',
        message: `「${name}」（PID ${pid}）正在占用这个磁盘。结束后会重新检测占用，便于再试弹出。结束用户进程有风险，请确认。`,
        paths: [],
        confirmLabel: '结束进程',
        iconName: 'terminal',
        danger: true,
      });
      modalConfirm = () => post({ type: 'killProcess', payload: { pid } });
      return;
    }

    if (event.target.closest('#screenshot-capture')) {
      doScreenCapture(false);
      return;
    }
    if (event.target.closest('#screenshot-capture-region')) {
      doScreenCapture(true);
      return;
    }
    if (event.target.closest('#shot-copy-dir')) {
      copyText(state.screenshot.dir);
      return;
    }
    if (event.target.closest('#shot-copy-file')) {
      copyText(state.screenshot.lastPath || (state.screenshot.files[0] && state.screenshot.files[0].path) || '');
      return;
    }
    if (event.target.closest('#screenshot-delete-selected')) {
      deleteSelectedShots();
      return;
    }
    if (event.target.closest('#screenshot-crop-cancel')) {
      const crop = state.screenshot.cropping;
      if (crop && crop.blobUrl) URL.revokeObjectURL(crop.blobUrl);
      state.screenshot.cropping = null;
      state.screenshot.lastPath = '';
      render();
      return;
    }
    if (event.target.closest('#screenshot-crop-save')) {
      saveCrop();
      return;
    }
    const shotCheck = event.target.closest('[data-shot-check]');
    if (shotCheck) {
      toggleShotCheck(Number(shotCheck.dataset.shotCheck));
      return;
    }
    const shotView = event.target.closest('[data-shot-view]');
    if (shotView) {
      const f = state.screenshot.files[Number(shotView.dataset.shotView)];
      if (f) openShotViewer(f.path, f.name);
      return;
    }
    const shotCopy = event.target.closest('[data-shot-copy]');
    if (shotCopy) {
      const f = state.screenshot.files[Number(shotCopy.dataset.shotCopy)];
      if (f) post({ type: 'copyShotToClipboard', payload: { path: f.path } });
      return;
    }
    const shotDel = event.target.closest('[data-shot-del]');
    if (shotDel) {
      deleteSingleShot(Number(shotDel.dataset.shotDel));
      return;
    }
    if (event.target.closest('#pick-folder')) {
      pickFolder('large');
      return;
    }
    if (event.target.closest('#pick-empty-folder')) {
      pickFolder('empty');
      return;
    }
    if (event.target.closest('#start-scan')) {
      startLargeScan();
      return;
    }
    if (event.target.closest('#empty-start')) {
      startEmptyScan();
      return;
    }
    if (event.target.closest('#cancel-scan') || event.target.closest('#empty-cancel')) {
      post({ type: 'cancelScan' });
      toast('正在取消…');
      return;
    }
    if (event.target.closest('#delete-selected')) {
      requestRecycle(selectedScanPaths(), 'large');
      return;
    }
    if (event.target.closest('#empty-delete-selected')) {
      requestRecycle(selectedEmptyPaths(), 'empty');
      return;
    }
    if (event.target.closest('#select-all')) {
      const checkbox = event.target.closest('#select-all');
      const rows = sortedScanRows();
      if (checkbox.checked) rows.forEach(({ item }) => state.scan.selected.add(item.path));
      else state.scan.selected.clear();
      const results = $('#scan-results');
      if (results) results.innerHTML = renderScanResults();
      requestAnimationFrame(syncScanChecks);
      return;
    }
    if (event.target.closest('#empty-select-all')) {
      const checkbox = event.target.closest('#empty-select-all');
      if (checkbox.checked) state.empty.folders.forEach((path) => state.empty.selected.add(path));
      else state.empty.selected.clear();
      const results = $('#empty-results');
      if (results) results.innerHTML = renderEmptyResults();
      requestAnimationFrame(syncScanChecks);
      return;
    }
    if (event.target.closest('#clear-selection')) {
      state.scan.selected.clear();
      const results = $('#scan-results');
      if (results) results.innerHTML = renderScanResults();
      requestAnimationFrame(syncScanChecks);
      return;
    }
    if (event.target.closest('#empty-clear-selection')) {
      state.empty.selected.clear();
      const results = $('#empty-results');
      if (results) results.innerHTML = renderEmptyResults();
      requestAnimationFrame(syncScanChecks);
      return;
    }
    if (event.target.closest('#clear-search')) {
      state.query = '';
      searchInput.value = '';
      renderHomeOnly();
      return;
    }
    if (event.target.closest('#copy-data-folder')) {
      copyText(state.appInfo.dataDir);
      return;
    }
    if (event.target.closest('#reload-ui')) {
      location.reload();
      return;
    }
    if (event.target.closest('#notify-me')) {
      toast('已记录，谢谢催更。先把手头的两个工具打磨好。', 'success');
      return;
    }
  });

  viewEl.addEventListener('change', (event) => {
    const driveSel = event.target.closest('#usb-drive');
    if (driveSel) {
      usbSetDrive(driveSel.value);
      return;
    }
    const rowCheck = event.target.closest('.row-check');
    if (rowCheck) {
      const index = Number(rowCheck.dataset.index);
      const item = state.scan.items[index];
      if (item) {
        if (rowCheck.checked) state.scan.selected.add(item.path);
        else state.scan.selected.delete(item.path);
      }
      const results = $('#scan-results');
      if (results) results.innerHTML = renderScanResults();
      requestAnimationFrame(syncScanChecks);
      return;
    }
    const emptyCheck = event.target.closest('.empty-row-check');
    if (emptyCheck) {
      const index = Number(emptyCheck.dataset.index);
      const path = state.empty.folders[index];
      if (path) {
        if (emptyCheck.checked) state.empty.selected.add(path);
        else state.empty.selected.delete(path);
      }
      const results = $('#empty-results');
      if (results) results.innerHTML = renderEmptyResults();
      requestAnimationFrame(syncScanChecks);
      return;
    }
    const dupCheck = event.target.closest('.dup-check');
    if (dupCheck) {
      const group = state.dup.groups[Number(dupCheck.dataset.group)];
      const file = group?.files[Number(dupCheck.dataset.file)];
      if (file) {
        if (dupCheck.checked) state.dup.selected.add(file.path);
        else state.dup.selected.delete(file.path);
      }
      refreshDupPage();
      return;
    }

    const tempCheck = event.target.closest('.temp-check');
    if (tempCheck) {
      const entry = state.temp.entries[Number(tempCheck.dataset.index)];
      if (entry) {
        if (tempCheck.checked) state.temp.selected.add(entry.path);
        else state.temp.selected.delete(entry.path);
      }
      refreshTempPage();
      return;
    }

    const tempCat = event.target.closest('.temp-cat-check');
    if (tempCat) {
      const category = tempCat.dataset.category;
      const entries = state.temp.entries.filter((entry) => entry.category === category);
      entries.forEach((entry) => {
        if (tempCat.checked) state.temp.selected.add(entry.path);
        else state.temp.selected.delete(entry.path);
      });
      refreshTempPage();
      return;
    }

    if (event.target.id === 'dup-min-size' || event.target.id === 'dup-min-size-unit') {
      const field = readSizeField('dup-min-size', state.dup.minUnit);
      state.dup.minUnit = field.unit;
      state.dup.minSize = field.empty ? 0 : field.bytes;
    }
    if (event.target.id === 'hash-recursive') {
      state.hash.recursive = event.target.checked;
    }
    if (event.target.id === 'rename-regex' || event.target.id === 'rename-numbering' ||
        event.target.id === 'rename-digits' || event.target.id === 'rename-start') {
      if (event.target.id === 'rename-regex') state.rename.regex = event.target.checked;
      if (event.target.id === 'rename-numbering') state.rename.numbering = event.target.checked;
      if (event.target.id === 'rename-digits') state.rename.digits = Number(event.target.value);
      if (event.target.id === 'rename-start') state.rename.start = Number(event.target.value);
      refreshRenamePreview();
      return;
    }
    if (event.target.id === 'scan-min-size' || event.target.id === 'scan-min-size-unit') {
      const field = readSizeField('scan-min-size', state.scan.minUnit);
      state.scan.minUnit = field.unit;
      state.scan.minSize = field.empty ? 0 : field.bytes;
    }
    if (event.target.id === 'include-hidden') {
      state.scan.includeHidden = event.target.checked;
    }
    if (event.target.closest('.org-enable')) {
      const i = Number(event.target.dataset.i);
      const rule = state.organizer.rules[i];
      if (rule) { rule.enabled = event.target.checked; saveOrganizerRules(); }
      return;
    }
    if (event.target.closest('.org-target') || event.target.closest('.org-datemode')) {
      const i = Number(event.target.dataset.i);
      const rule = state.organizer.rules[i];
      if (rule) {
        if (event.target.classList.contains('org-target')) {
          rule.target = event.target.value;
          if (rule.target === 'byExt' && !rule.groupExt) rule.groupExt = rule.dir;
          if (rule.target !== 'byExt' && !rule.dir) rule.dir = rule.groupExt;
          refreshOrganizeRules();
        } else {
          rule.dateMode = event.target.value;
        }
        saveOrganizerRules();
      }
      return;
    }
    if (event.target.id === 'organizer-conflict') {
      invalidateOrganizerPreview();
      state.organizer.conflict = event.target.value;
      return;
    }
    if (event.target.id === 'organizer-hidden') {
      invalidateOrganizerPreview();
      state.organizer.includeHidden = event.target.checked;
      return;
    }
    if (event.target.id === 'organizer-recheck') {
      state.organizer.checkDuplicates = event.target.checked;
      return;
    }
  });

  viewEl.addEventListener('input', (event) => {
    const id = event.target.id;
    if (id === 'rename-find') state.rename.find = event.target.value;
    else if (id === 'rename-replace') state.rename.replace = event.target.value;
    else if (id === 'rename-prefix') state.rename.prefix = event.target.value;
    else if (id === 'rename-suffix') state.rename.suffix = event.target.value;
    else {
      // 文件整理规则的体积输入：id 形如 org-min-size-<i> / org-max-size-<i>(-unit)
      const sizeMatch = /^org-(min|max)-size-(\d+)(-unit)?$/.exec(id);
      if (sizeMatch) {
        const rule = state.organizer.rules[Number(sizeMatch[2])];
        if (rule) {
          const field = readSizeField(`org-${sizeMatch[1]}-size-${sizeMatch[2]}`, rule[`${sizeMatch[1]}Unit`] || 'MB');
          rule[`${sizeMatch[1]}Unit`] = field.unit;
          rule[`${sizeMatch[1]}MB`] = field.empty ? 0 : Number((field.bytes / SIZE_FACTOR.MB).toFixed(4));
          saveOrganizerRules();
        }
        return;
      }
      const i = event.target.closest('[data-i]')?.dataset?.i;
      const rule = i !== undefined ? state.organizer.rules[Number(i)] : null;
      if (rule) {
        if (event.target.classList.contains('org-name')) rule.name = event.target.value;
        else if (event.target.classList.contains('org-exts')) rule.exts = event.target.value;
        else if (event.target.classList.contains('org-namecontains')) rule.nameContains = event.target.value;
        else if (event.target.classList.contains('org-namewildcard')) rule.nameWildcard = event.target.value;
        else if (event.target.classList.contains('org-dir')) {
          rule.dir = event.target.value;
          if (rule.target === 'byExt') rule.groupExt = event.target.value;
        }
        else if (event.target.classList.contains('org-older')) rule.olderThanDays = Math.max(0, Number(event.target.value) || 0);
        else return;
        saveOrganizerRules();
      }
      return;
    }
    refreshRenamePreview();
  });

  viewEl.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.tool-card[data-open]')) {
      event.preventDefault();
      openTool(event.target.dataset.open);
    }
  });

  $('#theme-btn').addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
    render();
  });
  $('#help-btn')?.addEventListener('click', showShortcutHelp);

  searchInput.addEventListener('input', () => {
    state.query = searchInput.value.trim();
    if (state.view !== 'home') {
      state.view = 'home';
      state.toolId = null;
      state.category = 'all';
    }
    renderHomeOnly();
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      searchInput.value = '';
      state.query = '';
      renderHomeOnly();
      searchInput.blur();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (state.mini) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && (key === '=' || key === '+')) {
      event.preventDefault();
      applyZoom(Math.min(1.5, state.zoom + 0.1));
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === '-') {
      event.preventDefault();
      applyZoom(Math.max(0.8, state.zoom - 0.1));
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === '0') {
      event.preventDefault();
      applyZoom(1);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'k') {
      event.preventDefault();
      if (state.view !== 'home') {
        state.view = 'home';
        state.toolId = null;
        state.category = 'all';
        render();
      }
      searchInput.focus();
      searchInput.select();
      return;
    }
    if (event.key === 'Escape') {
      if (modalRoot.firstElementChild) {
        closeModal();
        return;
      }
      if (state.view !== 'home') {
        navigateHome();
      }
      return;
    }
    if (event.altKey && event.key === 'ArrowLeft' && state.view !== 'home') {
      event.preventDefault();
      navigateHome();
    }
  });

  window.chrome?.webview?.addEventListener('message', handleHostMessage);

  if (window.matchMedia) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener?.('change', () => {
      if (state.theme === 'system') {
        document.documentElement.dataset.theme = resolveTheme(state.theme);
        post({ type: 'setTheme', payload: { theme: resolveTheme(state.theme) } });
      }
    });
  }
}
