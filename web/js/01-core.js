// ---- 第 1/8 块：本块起始于 /* ============================================================ ----
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
