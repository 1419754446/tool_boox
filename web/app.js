/* ============================================================
   ToolSoft · UI logic
   ============================================================ */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const viewEl = $('#view');
const searchBox = $('#search-box');
const searchInput = $('#search-input');
const toastRoot = $('#toast-root');
const modalRoot = $('#modal-root');

const ICON_PATHS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/>',
  drive: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  cpu: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.64 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.64 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.64h.09A1.7 1.7 0 0 0 10.12 3.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.64a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.36 9v.09A1.7 1.7 0 0 0 20.9 10.12H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M4 12h16"/>',
  'folder-x': '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/><path d="m14.5 12.5 4 4M18.5 12.5l-4 4"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  pie: '<path d="M21 12A9 9 0 1 1 12 3v9z"/><path d="M12 3a9 9 0 0 1 9 9h-9z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  broom: '<path d="m19 5-3 3"/><path d="M14 6 18 10"/><path d="M13 7 7 13"/><path d="m7 13-3 7 7-3 4-4"/>',
  unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  'arrow-left': '<path d="m15 18-6-6 6-6"/><path d="M9 12h12"/>',
  'arrow-up': '<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>',
  'arrow-down': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  'arrow-up-right': '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"/>',
  'folder-open': '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v1"/><path d="M3 11h18l-2.4 6.6a2 2 0 0 1-1.9 1.4H5.6a2 2 0 0 1-1.9-1.4z"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  sparkles: '<path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/><path d="m5 15 .6 1.7L7.3 17l-1.7.6L5 19.3l-.6-1.7L2.7 17l1.7-.3z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 3 2.8 19h18.4z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-right': '<path d="m9 6 6 6-6 6"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/>',
  terminal: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  file: '<path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.8"/><circle cx="17" cy="17" r="2.8"/>',
  banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>',
  pin: '<path d="M12 17v5"/><path d="M5.5 9.5 9 3h6l3.5 6.5a4 4 0 0 1-3.5 6h-6a4 4 0 0 1-3.5-6z"/><path d="M6.5 9.5h11"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  diff: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M9 12h6"/>',
  clipboard: '<rect x="8" y="2.5" width="8" height="4" rx="1.2"/><path d="M16 4.5h2a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>',
  pause: '<rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/>',
  usb: '<rect x="6" y="3" width="12" height="6" rx="1.5"/><rect x="4" y="9" width="16" height="12" rx="2"/><path d="M12 12v5M9.5 14.5 12 17l2.5-2.5"/>',
  eject: '<path d="m12 9 6 6H6z"/><path d="M6 17h12"/>',
  camera: '<path d="M4 7h3l2-2h6l2 2h3v13H4z"/><circle cx="12" cy="13" r="4"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  crop: '<path d="M6 2v16h16"/><path d="M2 6h16v16"/>',
  window: '<rect x="3" y="4.5" width="18" height="15" rx="2.4"/><path d="M3 9.5h18M8 4.5v5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.4 9.2a2.7 2.7 0 1 1 4.2 2.3c-.9.6-1.6 1.2-1.6 2.5"/><path d="M12 17.2h.01"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  'list-check': '<path d="m3 6 1.5 1.5L7 5"/><path d="m3 12 1.5 1.5L7 11"/><path d="m3 18 1.5 1.5L7 17"/><path d="M11 6h10M11 12h10M11 18h10"/>',
  'chevron-up': '<path d="m18 15-6-6-6 6"/>',
  'eye-off': '<path d="M10.6 5.2A9.6 9.6 0 0 1 12 5c5 0 9 4.5 9 7a11 11 0 0 1-3 4.3"/><path d="M6.3 6.3C3.6 8 2 10.6 2 12c0 2.5 4 7 10 7a10 10 0 0 0 4.4-1"/><path d="M9.6 9.6a3 3 0 0 0 4.3 4.3"/><path d="m3 3 18 18"/>',
  power: '<path d="M12 3v9"/><path d="M7.5 5.6a8 8 0 1 0 9 0"/>',
};

function icon(name, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ICON_PATHS.grid}</svg>`;
}

const TOOLS = [
  {
    id: 'folders', name: '常用文件夹', desc: '把每天要去的目录收进一份清单，点一下就打开，也能定位、复制路径。',
    category: 'file', icon: 'pin', accent: 'slate', status: 'ready', tags: ['快捷入口', '日常'],
  },
  {
    id: 'video-collector', name: '视频整理', desc: '扫描散落的视频，挑出要留的，复制或移动到目标文件夹，自动去重、同名不覆盖。',
    category: 'file', icon: 'film', accent: 'pink', status: 'ready', tags: ['视频', '归档'],
  },
  {
    id: 'large-files', name: '大文件扫描', desc: '按体积找出最占空间的文件，支持复制路径与移到回收站。',
    category: 'disk', icon: 'scan', accent: 'violet', status: 'ready', tags: ['磁盘', '清理'],
  },
  {
    id: 'empty-folders', name: '空文件夹清理', desc: '自底向上找出空目录，确认后批量移到回收站。',
    category: 'file', icon: 'folder-x', accent: 'cyan', status: 'ready', tags: ['文件', '整理'],
  },
  {
    id: 'duplicates', name: '重复文件查找', desc: '按大小预筛，再用 SHA-256 校验，找出真正重复的文件。',
    category: 'file', icon: 'copy', accent: 'pink', status: 'ready', tags: ['文件', '去重'],
  },
  {
    id: 'space-analyzer', name: '磁盘空间分析', desc: '用可交互的图表看清每个文件夹吃掉了多少空间。',
    category: 'disk', icon: 'pie', accent: 'amber', status: 'ready', tags: ['磁盘', '可视化'],
  },
  {
    id: 'batch-rename', name: '批量重命名', desc: '正则、序号、日期模板，实时预览、冲突检测、一键撤销。',
    category: 'file', icon: 'edit', accent: 'emerald', status: 'ready', tags: ['文件', '批处理'],
  },
  {
    id: 'hash-check', name: '文件哈希校验', desc: 'SHA-256 批量计算，复制前后快速比对完整性。',
    category: 'file', icon: 'hash', accent: 'blue', status: 'ready', tags: ['文件', '校验'],
  },
  {
    id: 'temp-cleaner', name: '临时文件清理', desc: '按安全规则扫描临时目录与缓存，预览后再清理。',
    category: 'system', icon: 'broom', accent: 'rose', status: 'ready', tags: ['系统', '清理'],
  },
  {
    id: 'file-unlock', name: '文件占用解锁', desc: '查清哪个进程占用了文件，定位它，必要时结束进程。',
    category: 'system', icon: 'unlock', accent: 'slate', status: 'ready', tags: ['系统', '诊断'],
  },
  {
    id: 'quick-search', name: '快速文件搜索', desc: '按通配符、大小、修改时间在整个目录树里找文件。',
    category: 'file', icon: 'search', accent: 'blue', status: 'ready', tags: ['文件', '查找'],
  },
  {
    id: 'folder-sync', name: '文件夹对比同步', desc: '对比两份目录差异，一键把缺失或更新的文件复制过去。',
    category: 'file', icon: 'diff', accent: 'rose', status: 'ready', tags: ['文件', '同步'],
  },
  {
    id: 'clipboard-history', name: '剪贴板历史', desc: '手动开启后记录最近复制过的文本，随时找回、一键重新复制。',
    category: 'system', icon: 'clipboard', accent: 'cyan', status: 'ready', tags: ['剪贴板', '效率'],
  },
  {
    id: 'file-organizer', name: '文件整理', desc: '按规则把散乱文件自动归类到分类目录，完成后可顺手查找重复文件。',
    category: 'file', icon: 'folder-open', accent: 'emerald', status: 'ready', tags: ['文件', '整理', '归档'],
  },
  {
    id: 'usb-eject', name: 'U盘安全弹出', desc: 'U盘/移动硬盘弹不出去？检测占用进程，安全卸载并弹出磁盘。',
    category: 'disk', icon: 'usb', accent: 'blue', status: 'ready', tags: ['磁盘', 'U盘', '弹出'],
  },
  {
    id: 'screenshot', name: '截图工具', desc: '一键全屏截图，自动保存本地；支持矩形选框裁剪，历史可查看、复制路径或批量删除。',
    category: 'system', icon: 'camera', accent: 'amber', status: 'ready', tags: ['系统', '截图'],
  },
];

const CATEGORIES = [
  { id: 'all', name: '全部工具' },
  { id: 'file', name: '文件管理' },
  { id: 'disk', name: '磁盘空间' },
  { id: 'system', name: '系统效率' },
];

const PLANS = {
  duplicates: ['按大小分组预筛', 'SHA-256 全文件校验', '硬链接识别', '批量移入回收站'],
  'space-analyzer': ['目录大小聚合', '可交互矩形树图', '大文件下钻', '导出分析结果'],
  'batch-rename': ['正则与序号模板', '实时预览与冲突检测', '保留扩展名', '一键撤销'],
  'hash-check': ['SHA-256 / MD5', '批量校验', '粘贴比对', 'CSV 导出'],
  'temp-cleaner': ['安全规则库', '清理前预览', '跳过占用文件', '回收站兜底'],
  'file-unlock': ['Restart Manager 查询', '定位占用进程', '结束进程确认', '复制文件路径'],
};

const DEFAULT_ORGANIZER_RULES = [
  {
    enabled: true, name: '图片', exts: 'jpg,jpeg,png,gif,webp,bmp,svg,ico', nameContains: '',
    nameWildcard: '', minMB: 0, maxMB: 0, olderThanDays: 0, newerThanDays: 0,
    target: 'byExt', dir: '', groupExt: '图片', dateMode: 'year-month',
  },
  {
    enabled: true, name: '视频', exts: 'mp4,mkv,avi,mov,wmv,flv,m4v', nameContains: '',
    nameWildcard: '', minMB: 0, maxMB: 0, olderThanDays: 0, newerThanDays: 0,
    target: 'byExt', dir: '', groupExt: '视频', dateMode: 'year-month',
  },
  {
    enabled: true, name: '文档', exts: 'doc,docx,pdf,xls,xlsx,ppt,pptx,txt,md', nameContains: '',
    nameWildcard: '', minMB: 0, maxMB: 0, olderThanDays: 0, newerThanDays: 0,
    target: 'byExt', dir: '', groupExt: '文档', dateMode: 'year-month',
  },
  {
    enabled: true, name: '压缩包', exts: 'zip,rar,7z,tar,gz', nameContains: '',
    nameWildcard: '', minMB: 0, maxMB: 0, olderThanDays: 0, newerThanDays: 0,
    target: 'byExt', dir: '', groupExt: '压缩包', dateMode: 'year-month',
  },
  {
    enabled: true, name: '安装程序', exts: 'exe,msi', nameContains: '',
    nameWildcard: '', minMB: 0, maxMB: 0, olderThanDays: 0, newerThanDays: 0,
    target: 'byExt', dir: '', groupExt: '安装程序', dateMode: 'year-month',
  },
  {
    enabled: false, name: '满 30 天旧文件（默认关闭）', exts: '', nameContains: '',
    nameWildcard: '', minMB: 0, maxMB: 0, olderThanDays: 30, newerThanDays: 0,
    target: 'byDate', dir: '', groupExt: '', dateMode: 'year-month',
  },
];

function loadOrganizerRules() {
  const fallback = DEFAULT_ORGANIZER_RULES.map((rule) => ({ ...rule }));
  const stored = readJson('toolsoft.organizerRules.v1', fallback);
  const rules = (Array.isArray(stored) ? stored : fallback)
    .filter((rule) => rule && typeof rule === 'object');
  const safetyKey = 'toolsoft.organizerRules.safety.v1';
  let migrated = false;
  try {
    migrated = localStorage.getItem(safetyKey) === '1';
  } catch { /* ignore storage failures */ }

  let changed = false;
  rules.forEach((rule) => {
    const isOldCatchAll = rule.name === '满 30 天旧文件' &&
      !rule.exts && !rule.nameContains && !rule.nameWildcard &&
      !Number(rule.minMB) && !Number(rule.maxMB);
    if (isOldCatchAll) {
      if (!migrated && rule.enabled) {
        rule.enabled = false;
        changed = true;
      }
      if (!String(rule.name).includes('默认关闭')) {
        rule.name = '满 30 天旧文件（默认关闭）';
        changed = true;
      }
      return;
    }
    const unconditional = !rule.exts && !rule.nameContains && !rule.nameWildcard &&
      !Number(rule.minMB) && !Number(rule.maxMB) &&
      !Number(rule.olderThanDays) && !Number(rule.newerThanDays);
    if (!migrated && unconditional && rule.enabled) {
      rule.enabled = false;
      changed = true;
    }
  });
  try {
    if (!migrated) localStorage.setItem(safetyKey, '1');
    if (changed) localStorage.setItem('toolsoft.organizerRules.v1', JSON.stringify(rules));
  } catch { /* keep the migrated rules in memory */ }
  return rules;
}

const state = {
  view: 'home',
  category: 'all',
  query: '',
  toolId: null,
  mini: false,
  miniPinned: true,
  miniCollapsed: false,
  theme: localStorage.getItem('toolsoft.theme.v2') || 'light',
  recent: readJson('toolsoft.recent', []),
  appInfo: { version: '0.1.0', webview: '—', dataDir: '—' },
  pickerTarget: null,
  pickerRequest: null,
  pendingRecycle: null,
  launch: null,
  scan: {
    root: '',
    minSize: 100 * 1024 * 1024,
    minUnit: 'MB',
    includeHidden: false,
    running: false,
    items: [],
    stats: null,
    totalMatched: 0,
    elapsedMs: 0,
    cancelled: false,
    error: '',
    sortKey: 'size',
    sortDir: 'desc',
    selected: new Set(),
  },
  empty: {
    root: '',
    running: false,
    folders: [],
    stats: null,
    elapsedMs: 0,
    cancelled: false,
    error: '',
    source: 'manual',
    selected: new Set(),
  },
  dup: {
    root: '',
    minSize: 10 * 1024 * 1024,
    minUnit: 'MB',
    running: false,
    groups: [],
    stats: null,
    candidateFiles: 0,
    duplicateBytes: 0,
    truncated: false,
    elapsedMs: 0,
    cancelled: false,
    error: '',
    selected: new Set(),
  },
  space: {
    root: '',
    running: false,
    entries: [],
    total: 0,
    stats: null,
    truncated: false,
    elapsedMs: 0,
    cancelled: false,
    error: '',
    history: [],
  },
  rename: {
    root: '',
    files: [],
    loading: false,
    find: '',
    replace: '',
    regex: false,
    prefix: '',
    suffix: '',
    numbering: true,
    start: 1,
    digits: 3,
    preview: [],
    lastApplied: null,
    pendingUndo: false,
    error: '',
  },
  hash: {
    root: '',
    recursive: true,
    running: false,
    items: [],
    stats: null,
    truncated: false,
    elapsedMs: 0,
    cancelled: false,
    error: '',
  },
  temp: {
    running: false,
    categories: [],
    entries: [],
    total: 0,
    stats: null,
    truncated: false,
    elapsedMs: 0,
    cancelled: false,
    error: '',
    selected: new Set(),
  },
  unlock: {
    path: '',
    mode: 'file',
    running: false,
    processes: [],
    checked: false,
    error: '',
  },
  pinned: readJson('toolsoft.pinned', []),
  search: {
    root: '', pattern: '*.pdf', size: 0, sizeUnit: 'MB', time: '0', recursive: true,
    scope: 'folder',
    running: false, items: [], stats: null, totalMatched: 0, elapsedMs: 0,
    cancelled: false, error: '',
  },
  fdiff: {
    rootA: '', rootB: '', running: false, copying: false, compareContent: false,
    copyCopied: 0, copyTotal: 0, copyCurrent: '',
    onlyA: [], onlyB: [], different: [],
    stats: null, elapsedMs: 0, cancelled: false, error: '',
    selected: new Set(),
  },
  clip: {
    // Privacy-by-default: do not silently collect everything the user copies.
    // The .v2 key intentionally ignores the old opt-out=false value.
    items: [],  // session-only: never persist copied text in localStorage
    paused: readJson('toolsoft.clipsPaused.v2', true),
  },
  organizer: {
    root: '',
    targetRoot: '',
    includeHidden: false,
    conflict: 'autoname',
    running: false,
    items: [],          // 整理结果项 {from,to,rule,ok,error}
    stats: null,
    matched: 0,
    elapsedMs: 0,
    cancelled: false,
    truncated: false,
    error: '',
    rules: loadOrganizerRules(),
    checkDuplicates: true,
    movedCount: 0,
    failCount: 0,
    skippedCount: 0,
    matchedBytes: 0,
    previewItems: [],
    previewPayload: null,
    previewWarning: '',
    previewing: false,
    lastMoved: readJson('toolsoft.organizerUndo.v1', []),
    undoing: false,
    undoSkip: [],
    pendingUndoFrom: null,
  },
  usb: {
    devices: [],
    picked: '',
    drive: '',
    checking: false,
    ejecting: false,
    processes: [],
    checked: false,
    error: '',
  },
  screenshot: {
    running: false,
    files: [],
    dir: '',
    lastPath: '',
    selected: new Set(),
    cropping: null,
  },
  zoom: (() => {
    const value = Number(localStorage.getItem('toolsoft.zoom'));
    return Number.isFinite(value) && value >= 0.8 && value <= 1.5 ? value : 1;
  })(),
};

/* A long task is usually a native bug or a stuck worker. Keep a UI-level
   watchdog as a last line of defence; native code still owns the real
   done/cancel/error messages.
   计时语义：距「最近一次进度」超过阈值才复位（不是距任务开始）。任务只要还在
   持续上报进度，计时就会不断刷新，因此合法的超长扫描/哈希不会被误复位。
   只有真正卡死（3 分钟无任何进度、也无完成消息）的任务才会触发复位并通知
   后台取消；这种任务本就必须重新开始。 */
const WATCHDOG_MS = 180000;
const watchdogSince = new Map();
const watchdogTargets = {
  scan: () => { state.scan.running = false; },
  empty: () => { state.empty.running = false; },
  dup: () => { state.dup.running = false; },
  space: () => { state.space.running = false; },
  hash: () => { state.hash.running = false; },
  temp: () => { state.temp.running = false; },
  rename: () => { state.rename.loading = false; },
  unlock: () => { state.unlock.running = false; },
  search: () => { state.search.running = false; },
  fdiff: () => { state.fdiff.running = false; state.fdiff.copying = false; },
  organizer: () => {
    state.organizer.running = false;
    state.organizer.previewing = false;
    state.organizer.undoing = false;
  },
  usb: () => { state.usb.checking = false; state.usb.ejecting = false; },
  screenshot: () => { state.screenshot.running = false; },
};

function watchdogSnapshot() {
  return {
    scan: state.scan.running,
    empty: state.empty.running,
    dup: state.dup.running,
    space: state.space.running,
    hash: state.hash.running,
    temp: state.temp.running,
    rename: state.rename.loading,
    unlock: state.unlock.running,
    search: state.search.running,
    fdiff: state.fdiff.running || state.fdiff.copying,
    organizer: state.organizer.running || state.organizer.previewing || state.organizer.undoing,
    usb: state.usb.checking || state.usb.ejecting,
    screenshot: state.screenshot.running,
  };
}

setInterval(() => {
  const now = Date.now();
  const active = watchdogSnapshot();
  Object.entries(active).forEach(([key, running]) => {
    if (!running) {
      watchdogSince.delete(key);
      return;
    }
    if (!watchdogSince.has(key)) {
      watchdogSince.set(key, now);
      return;
    }
    if (now - watchdogSince.get(key) < WATCHDOG_MS) return;
    watchdogSince.delete(key);
    const reset = watchdogTargets[key];
    if (reset) reset();
    // 向 native 补发取消信号：让后台 worker 尽快停止并回馈终态（对非 scan 类
    // 任务同样生效），避免仅复位界面、后台仍长期占用。任务是主任务时 CancelScan
    // 会真正取消 currentTask_；无任务在跑时该消息无副作用。
    post({ type: 'cancelScan' });
    if (state.view === 'tool' || state.view === 'settings') render();
    toast('任务超过 3 分钟未返回，已复位界面状态；后台任务可能仍在结束', 'error');
  });
}, 1000);

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    if (value === null || value === undefined) return fallback;
    if (Array.isArray(fallback)) return Array.isArray(value) ? value : fallback;
    if (typeof fallback === 'boolean') return typeof value === 'boolean' ? value : fallback;
    return value;
  } catch {
    return fallback;
  }
}

function uid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function post(message) {
  try {
    window.chrome?.webview?.postMessage(message);
  } catch (error) {
    console.warn('postMessage failed', error);
  }
}

/* 宿主请求：post + 按 requestId 等待回包（filesPicked/fileContent/fileExported） */
const pendingHostRequests = new Map();

function requestHost(message) {
  return new Promise((resolve) => {
    const requestId = uid();
    message.requestId = requestId;
    pendingHostRequests.set(requestId, resolve);
    post(message);
    setTimeout(() => {
      if (pendingHostRequests.has(requestId)) {
        pendingHostRequests.delete(requestId);
        resolve({ ok: false, error: 'timeout' });
      }
    }, 60000);
  });
}

/* ---- Base64 / CSV 工具 ---- */

/* 统一命令总线：新工具全部走这里，{id, cmd, args} → {type:'response', id, ok, data} */
const bridgePending = new Map();

function toolCall(cmd, args = {}, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const id = uid();
    bridgePending.set(id, { resolve, reject });
    post({ id, cmd, args });
    setTimeout(() => {
      const pending = bridgePending.get(id);
      if (pending) {
        bridgePending.delete(id);
        pending.reject(new Error('命令超时'));
      }
    }, timeoutMs);
  });
}

function b64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToB64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function utf8ToB64(text) {
  return bytesToB64(new TextEncoder().encode(text));
}

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  // Neutralize spreadsheet formula injection while keeping numeric values
  // (including negative numbers) as numbers.
  const formulaLike = /^[=+@]/.test(text) ||
    (/^-/.test(text) && !/^-?\d+(\.\d+)?$/.test(text));
  if (formulaLike) text = `'${text}`;
  if (/[",\r\n\t]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function rowsToCsv(header, rows) {
  const lines = [header.map(csvCell).join(',')];
  rows.forEach((row) => lines.push(row.map(csvCell).join(',')));
  return `\ufeff${lines.join('\r\n')}\r\n`;
}

async function exportCsv(baseName, header, rows) {
  const result = await requestHost({
    type: 'exportFile',
    payload: {
      name: baseName,
      filter: 'CSV 文件|*.csv',
      content: utf8ToB64(rowsToCsv(header, rows)),
    },
  });
  if (result.error === 'cancelled') return;
  if (result.ok) toast(`已导出：${result.path}`, 'success');
  else toast(result.error === 'timeout' ? '导出超时' : `导出失败：${result.error || '未知错误'}`, 'error');
}

function xlDangerStrip(message) {
  return `
    <div class="summary-strip">
      <span class="summary-chip" style="border-color:rgba(251,113,133,.2);background:rgba(251,113,133,.06)">
        <strong style="color:var(--danger)">${escapeHtml(message)}</strong>
      </span>
    </div>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let index = -1;
  let size = value;
  do {
    size /= 1024;
    index += 1;
  } while (size >= 1024 && index < units.length - 1);
  const digits = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(digits)} ${units[index]}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('zh-CN');
}

// ---- 体积输入：数值可随便填，单位在 KB/MB/GB 里选 ----
const SIZE_UNITS = ['KB', 'MB', 'GB'];
const SIZE_FACTOR = { KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };

function pickSizeUnit(bytes) {
  const value = Number(bytes) || 0;
  if (!value) return 'MB';
  if (value >= SIZE_FACTOR.GB) return 'GB';
  if (value >= SIZE_FACTOR.MB) return 'MB';
  return 'KB';
}

function sizeToBytes(value, unit) {
  const number = Math.max(0, Number(value) || 0);
  const factor = SIZE_FACTOR[unit] || SIZE_FACTOR.MB;
  return Math.round(number * factor);
}

function sizeValueIn(bytes, unit) {
  const factor = SIZE_FACTOR[unit] || SIZE_FACTOR.MB;
  const value = (Number(bytes) || 0) / factor;
  if (!value) return '';
  return String(Number(value.toFixed(value < 10 ? 2 : value < 100 ? 1 : 0)));
}

// 一个数字框 + 一个 KB/MB/GB 下拉；id 约定为 `<id>` 与 `<id>-unit`，
// 取值统一走 readSizeField(id, fallbackUnit)：返回 { bytes, unit }。
function sizeFieldHtml(id, bytes, unit, options = {}) {
  const chosen = SIZE_UNITS.includes(unit) ? unit : pickSizeUnit(bytes);
  return `<span class="size-input">
      <input id="${id}" type="number" min="0" step="any" inputmode="decimal"
             placeholder="${options.placeholder || '不限'}" value="${sizeValueIn(bytes, chosen)}"
             aria-label="${options.label || '体积'}">
      <select id="${id}-unit" class="size-unit" aria-label="${options.label || '体积'}单位">
        ${SIZE_UNITS.map((item) => `<option value="${item}" ${item === chosen ? 'selected' : ''}>${item}</option>`).join('')}
      </select>
    </span>`;
}

function readSizeField(id, fallbackUnit) {
  const input = $(`#${id}`);
  const select = $(`#${id}-unit`);
  const unit = select?.value || fallbackUnit || 'MB';
  const bytes = sizeToBytes(input?.value || 0, unit);
  return { bytes, unit, empty: !(Number(input?.value) > 0) };
}

function formatDate(milliseconds) {
  const value = Number(milliseconds);
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

// 格式化「耗时（毫秒）」；与下方视频时长用的 formatDuration 名称区分开，
// 否则同一顶层作用域里后定义者会覆盖前者，导致扫描/整理等所有用时显示失效。
function formatElapsed(milliseconds) {
  const value = Number(milliseconds) || 0;
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60000) return `${(value / 1000).toFixed(1)} s`;
  const minutes = Math.floor(value / 60000);
  const seconds = Math.round((value % 60000) / 1000);
  return `${minutes} 分 ${seconds} 秒`;
}

function parentOf(path) {
  const value = String(path);
  const index = Math.max(value.lastIndexOf('\\'), value.lastIndexOf('/'));
  return index > 0 ? value.slice(0, index) : value;
}

function baseName(path) {
  const value = String(path);
  const index = Math.max(value.lastIndexOf('\\'), value.lastIndexOf('/'));
  return index >= 0 ? value.slice(index + 1) : value;
}

// 不出现在工具墙里的辅助页面（独立预览窗用它自己的路由）。
const AUX_TOOLS = {
  'video-preview': {
    id: 'video-preview', name: '视频预览', desc: '独立播放窗口',
    category: 'file', icon: 'film', accent: 'pink', status: 'ready', tags: ['视频', '预览'],
  },
};

function toolById(id) {
  return TOOLS.find((tool) => tool.id === id) || AUX_TOOLS[id] || null;
}

function categoryName(id) {
  return (CATEGORIES.find((category) => category.id === id) || CATEGORIES[0]).name;
}

function resolveTheme(theme) {
  if (theme !== 'system') return theme;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme, notify = true) {
  state.theme = theme;
  const actual = resolveTheme(theme);
  document.documentElement.dataset.theme = actual;
  localStorage.setItem('toolsoft.theme.v2', theme);
  if (notify) post({ type: 'setTheme', payload: { theme: actual } });
  updateThemeControls();
}

function updateThemeControls() {
  $$('[data-theme-choice]').forEach((button) => {
    button.classList.toggle('active', button.dataset.themeChoice === state.theme);
  });
}

function maxZoomForViewport() {
  if (window.innerWidth < 1400) return 1.25;
  if (window.innerWidth < 1600) return 1.4;
  return 1.5;
}

function applyZoom(value, persist = true) {
  const parsed = Number(value);
  state.zoom = Math.min(maxZoomForViewport(), Math.max(0.8, Number.isFinite(parsed) ? parsed : 1));
  // CSS zoom scales the UI in place: viewport size and layout breakpoints stay
  // tied to the real window, so zooming never re-triggers the compact layouts.
  document.body.style.zoom = state.zoom === 1 ? '' : String(state.zoom);
  document.documentElement.style.setProperty('--zoom', state.zoom === 1 ? '' : String(state.zoom));
  // Past 125% the enlarged text no longer shares the hero row with the art.
  document.documentElement.classList.toggle('zoom-lg', state.zoom > 1.25);
  if (persist) localStorage.setItem('toolsoft.zoom', String(state.zoom));
  updateZoomControls();
}

function updateZoomControls() {
  $$('[data-zoom-choice]').forEach((button) => {
    button.classList.toggle('active', Math.abs(Number(button.dataset.zoomChoice) - state.zoom) < 0.001);
  });
}

function hydrateStaticIcons() {
  $$('[data-icon]').forEach((element) => {
    element.innerHTML = icon(element.dataset.icon, 18);
  });
}

function pushRecent(id) {
  state.recent = [id, ...state.recent.filter((item) => item !== id)].slice(0, 6);
  localStorage.setItem('toolsoft.recent', JSON.stringify(state.recent));
}

function render() {
  document.body.dataset.view = state.view;
  document.documentElement.classList.toggle('mini-collapsed', !!(state.mini && state.miniCollapsed));
  if (state.view === 'home') {
    viewEl.innerHTML = renderHome();
  } else if (state.view === 'settings') {
    viewEl.innerHTML = renderSettings();
  } else if (state.view === 'soon') {
    viewEl.innerHTML = renderSoon();
  } else {
    viewEl.innerHTML = renderToolPage();
    if (state.toolId === 'screenshot' && state.screenshot.cropping) setupCrop();
  }
  updateChrome();
  requestAnimationFrame(syncScanChecks);
  requestAnimationFrame(clampMiniFolderMenu);
  // 视频页打开着"全盘扫描"时，第一次渲染就得把磁盘列表拉回来，否则盘符条是空的
  if (state.toolId === 'video-collector' && state.video && state.video.allDrives) {
    loadVideoDrives();
  }
  if (state.driveScope && state.driveScope.allDrives && !state.driveList &&
      DRIVE_SCOPED_TOOLS.includes(state.toolId)) {
    loadDriveList();
  }
  scheduleMiniFit();
}

// 悬浮窗高度跟随内容：所有工具窗都量一次内容高度交给原生窗口调整，
// 避免一打开就是一大片空白（以前只有「常用文件夹」会）。视频预览需要固定
// 播放器尺寸，不参与自适应。
let miniFitTimer = null;
function scheduleMiniFit() {
  // video-preview 需固定播放器尺寸；launcher 是固定两列网格、内容近似恒定，
  // 都不参与按内容自适应，避免多余的 fitHeight 往返。
  if (!state.mini || state.miniCollapsed || state.toolId === 'video-preview' ||
      state.toolId === 'launcher') {
    if (miniFitTimer) {
      clearTimeout(miniFitTimer);
      miniFitTimer = null;
    }
    return;
  }
  if (miniFitTimer) clearTimeout(miniFitTimer);
  miniFitTimer = setTimeout(() => {
    miniFitTimer = null;
    const view = viewEl;
    if (!view) return;
    const prevHeight = view.style.height;
    const prevFlex = view.style.flex;
    const prevMinHeight = view.style.minHeight;
    view.style.height = 'auto';
    view.style.flex = '0 0 auto';
    view.style.minHeight = '0';
    const content = Math.ceil(view.scrollHeight);
    view.style.height = prevHeight;
    view.style.flex = prevFlex;
    view.style.minHeight = prevMinHeight;
    if (content > 30) {
      // 内容很长时（文件整理这类一屏塞不下的表单页）不能照着内容把窗口一路拉高：
      // 窗口会顶出屏幕底部，剩下的内容既看不见也点不到。超过可用桌面高度就只报到
      // 上限，多出来的部分交给 .view 自己滚（mini-mode 下 .view 是可滚容器）。
      const cap = Math.max(240, (window.screen && screen.availHeight ? screen.availHeight : 900) - 96);
      post({ type: 'mini', payload: { action: 'fitHeight', height: Math.min(content, cap) } });
    }
  }, 90);
}

function renderHomeOnly() {
  viewEl.innerHTML = renderHome();
  updateChrome();
}

function updateChrome() {
  const tool = toolById(state.toolId);
  let crumb = '全部工具';
  if (state.view === 'home') {
    crumb = categoryName(state.category);
  } else if (state.view === 'settings') {
    crumb = '设置';
  } else if (tool) {
    crumb = tool.name;
  }
  $('#crumb-current').textContent = crumb;
  searchBox.classList.toggle('is-hidden', state.view !== 'home');
  document.title = `工具箱 · ${crumb}`;

  $$('.sidebar .nav-item').forEach((item) => {
    let active = false;
    if (state.view === 'settings') {
      active = item.dataset.nav === 'settings';
    } else if (state.view === 'home') {
      active = item.dataset.nav === 'home' && item.dataset.category === state.category;
    } else if (tool) {
      active = item.dataset.nav === 'home' && item.dataset.category === tool.category;
    }
    item.classList.toggle('active', active);
  });
}

function renderMiniLauncher() {
  const query = (state.launcherQuery || '').toLowerCase();
  const ready = TOOLS.filter((tool) => tool.status === 'ready');
  const shown = query
    ? ready.filter((tool) => `${tool.name} ${tool.desc} ${tool.tags.join(' ')}`.toLowerCase().includes(query))
    : ready;
  return `
    <div class="mini-launcher">
      <div class="mini-launcher-head">
        <span class="mini-tool-ico">${icon('grid', 15)}</span>
        <strong>悬浮工具箱</strong>
        <span class="mini-tool-drag"></span>
        <button class="icon-btn" data-mini-action="main" title="打开主窗口">${icon('window', 14)}</button>
        <button class="icon-btn ${state.miniPinned ? 'active' : ''}" data-mini-action="pin" title="置顶">${icon('pin', 14)}</button>
        <button class="icon-btn" data-mini-action="collapse" title="收起">${icon('arrow-down', 14)}</button>
        <button class="icon-btn" data-mini-action="hide" title="关闭">${icon('x', 14)}</button>
      </div>
      <label class="mini-launcher-search">
        ${icon('search', 13)}
        <input id="mini-launcher-search" placeholder="搜索工具…" value="${escapeHtml(state.launcherQuery || '')}" spellcheck="false" autocomplete="off">
        <kbd>F1</kbd>
      </label>
      <div class="mini-launch-grid">
        ${shown.map((tool) => `
          <button class="mini-launch-card" data-open="${tool.id}" data-launch-name="${escapeHtml(`${tool.name} ${tool.tags.join(' ')}`)}" title="以悬浮窗打开 ${escapeHtml(tool.name)}">
            <span class="mini-launch-icon accent-${tool.accent}">${icon(tool.icon, 17)}</span>
            <span class="mini-launch-name">${escapeHtml(tool.name)}</span>
          </button>`).join('')}
      </div>
      ${shown.length ? '' : '<div class="mini-launcher-empty">没有匹配的工具</div>'}
    </div>`;
}

function renderHome() {
  if (state.mini && state.launcher) {
    if (state.miniCollapsed) return renderMiniCollapsedBar({ icon: 'grid', name: '悬浮工具箱' });
    return renderMiniLauncher();
  }
  const query = state.query.toLowerCase();
  const filtered = TOOLS.filter((tool) => {
    if (state.category !== 'all' && tool.category !== state.category) return false;
    if (!query) return true;
    return `${tool.name} ${tool.desc} ${tool.tags.join(' ')} ${tool.id}`.toLowerCase().includes(query);
  });
  const recent = state.recent.map(toolById).filter(Boolean).slice(0, 6);
  const showHero = !state.query && state.category === 'all';

  let gridHtml;
  if (state.category === 'all' && !state.query && filtered.length) {
    // Grouped home: scan the card wall by category instead of one long grid.
    const groups = [];
    const pinnedTools = state.pinned.map(toolById).filter(Boolean)
      .filter((tool) => filtered.some((item) => item.id === tool.id));
    if (pinnedTools.length) {
      groups.push(`
        <div class="tool-group is-pinned">
          <div class="tool-group-head">
            <h3><span class="group-pin">${icon('pin', 14)}</span>置顶</h3>
            <span>${pinnedTools.length} 个工具 · 再点卡片上的图钉可取消</span>
          </div>
          <div class="tool-grid">${pinnedTools.map((tool, index) => renderToolCard(tool, index)).join('')}</div>
        </div>`);
    }
    groups.push(CATEGORIES
      .filter((category) => category.id !== 'all')
      .map((category) => {
        const group = filtered.filter((tool) => tool.category === category.id
          && !state.pinned.includes(tool.id));
        if (!group.length) return '';
        return `
          <div class="tool-group">
            <div class="tool-group-head">
              <h3>${category.name}</h3>
              <span>${group.length} 个工具</span>
            </div>
            <div class="tool-grid">${group.map((tool, index) => renderToolCard(tool, index)).join('')}</div>
          </div>`;
      })
      .join(''));
    gridHtml = groups.join('');
  } else {
    gridHtml = filtered.length
      ? `<div class="tool-grid">${filtered.map((tool, index) => renderToolCard(tool, index)).join('')}</div>`
      : renderNoResults();
  }

  return `
    ${showHero ? renderHero() : renderCompactHead(filtered.length)}
    ${!state.query && recent.length ? renderQuickRow(recent) : ''}
    <section class="tools-section">
      ${renderSectionHead(filtered.length)}
      ${gridHtml}
    </section>`;
}

function renderHero() {
  const readyCount = TOOLS.filter((tool) => tool.status === 'ready').length;
  return `
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow"><span class="pulse"></span>${readyCount} 个工具已就绪 · 完全本地运行</div>
        <h1>把 Windows<br><span class="gradient-text">调成顺手的样子。</span></h1>
        <p class="hero-desc">文件扫描、空间分析、批量整理。没有上传，没有广告，只有一堆让你少点几下鼠标的小工具。</p>
        <div class="hero-actions">
          <button class="btn primary" data-open="large-files">${icon('scan', 15)} 扫描大文件 <span class="btn-arrow">→</span></button>
          <button class="btn ghost" data-open="empty-folders">${icon('folder-x', 15)} 清理空文件夹</button>
        </div>
        <div class="hero-meta">
          <div><strong>${TOOLS.length}</strong><span>个工具</span></div>
          <div><strong>${readyCount}</strong><span>个可用</span></div>
          <div><strong>0</strong><span>字节上传</span></div>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="orb orb-a"></div>
        <div class="orb orb-b"></div>
        <div class="ring ring-a"></div>
        <div class="ring ring-b"></div>
        <div class="glass-card">
          <div class="glass-head"><span class="dot-row"><i></i><i></i><i></i></span><span>scan_preview</span></div>
          <div class="glass-row"><span class="file-ico">${icon('file', 13)}</span><span class="line w60"></span><span class="size">2.4 GB</span></div>
          <div class="glass-row"><span class="file-ico">${icon('file', 13)}</span><span class="line w40"></span><span class="size">1.1 GB</span></div>
          <div class="glass-row"><span class="file-ico">${icon('file', 13)}</span><span class="line w70"></span><span class="size">768 MB</span></div>
          <div class="glass-progress"><span></span></div>
          <div class="glass-foot"><span>正在扫描…</span><strong>68%</strong></div>
        </div>
        <div class="float-chip chip-a">${icon('shield', 12)} 本地处理</div>
        <div class="float-chip chip-b">${icon('check', 12)} 已发现 128 个大文件</div>
      </div>
    </section>`;
}

function renderCompactHead(count) {
  return `
    <div class="page-head">
      <div class="page-title">
        <div class="page-kicker">工具分类</div>
        <h1>${categoryName(state.category)}</h1>
        <p>${count} 个工具 · 全部本地运行</p>
      </div>
      <div class="page-actions"><span class="status ready"><i></i>离线可用</span></div>
    </div>`;
}

function renderQuickRow(recent) {
  return `
    <div class="quick-row">
      <span class="quick-label">最近使用</span>
      <div class="quick-list">
        ${recent.map((tool) => `
          <button class="recent-chip" data-open="${tool.id}">
            ${icon(tool.icon, 12)} ${escapeHtml(tool.name)}
          </button>`).join('')}
      </div>
    </div>`;
}

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
          </colgroup>
          <thead><tr><th></th><th>原文件</th><th>目标</th><th>规则</th></tr></thead>
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
          <thead><tr><th></th><th>原文件</th><th>移动到</th><th>规则</th></tr></thead>
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
          <thead><tr><th class="col-check"></th><th class="sortable" data-sort-scope="temp" data-sort-key="name" title="点击按名称排序">文件${sortMarkOf('temp', 'name')}</th><th class="sortable" data-sort-scope="temp" data-sort-key="category" title="点击按分类排序">分类${sortMarkOf('temp', 'category')}</th><th class="col-size sortable" data-sort-scope="temp" data-sort-key="size" title="点击按体积排序">大小${sortMarkOf('temp', 'size')}</th><th class="col-time sortable" data-sort-scope="temp" data-sort-key="mtime" title="点击按修改时间排序">修改时间${sortMarkOf('temp', 'mtime')}</th></tr></thead>
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
      state.temp.stats = payload;
      if (state.view === 'tool' && state.toolId === 'temp-cleaner') {
        const counts = $('#temp-counts');
        const current = $('#temp-current');
        if (counts) counts.textContent = `${formatNumber(payload.files)} 个文件 · ${formatBytes(payload.bytes)}`;
        if (current) current.textContent = payload.current || '正在读取…';
      }
      break;
    case 'tempDone':
      handleTempDone(payload);
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
      onScanProgress(payload);
      break;
    case 'scanDone':
      handleScanDone(payload);
      break;
    case 'emptyDone':
      handleEmptyDone(payload);
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
  const webview = $('#about-webview');
  const dataDir = $('#about-datadir');
  if (version) version.textContent = `v${state.appInfo.version}`;
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
            <button class="row-btn" data-search-action="reveal" data-path="${path}" title="定位">${icon('search', 12)}</button>
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
          <button class="row-btn" data-folder-action="reveal" data-path="${path}" title="在资源管理器中定位">${icon('search', 13)}</button>
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
const DRIVE_SCOPED_TOOLS = ['large-files', 'duplicates', 'empty-folders'];

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
