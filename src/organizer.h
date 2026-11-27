#pragma once

#include <windows.h>

#include <atomic>
#include <cstdint>
#include <functional>
#include <string>
#include <vector>

#include "scanner.h"

namespace ts {

// 文件整理：按用户规则把文件移动到分类目录。
//
// 前端把「源目录 + 规则列表 + 冲突策略」作为 JSON 传进来，后端在这里
// 遍历目录、逐文件套用第一条命中规则生成目标路径并移动。移动采用
// MoveFileExW(带 MOVEFILE_COPY_ALLOWED)：同盘为原子 rename（瞬时），
// 跨盘自动退化为「复制 + 删源」，一次调用即可满足「同盘快、跨盘复制」。
//
// 全部数据仅在本机处理，绝不外发。

enum class OrganizeTarget : int {
    // 全部文件进入固定子目录（规则.dir 生效）
    Fixed = 0,
    // 按扩展名归档（后端取小写扩展名作为子目录；规则.groupExt 非空则优先用它）
    ByExt = 1,
    // 按修改时间归档（规则.dateMode 生效）
    ByDate = 2,
};

enum class OrganizeConflict : int {
    Skip = 0,        // 目标已存在则跳过，保留源文件
    AutoName = 1,    // 目标已存在则自动加 " (1)" "(2)" 序号
    Overwrite = 2,   // 覆盖同名目标文件
};

struct OrganizeRule {
    bool enabled = true;
    std::wstring name;          // 规则名（仅展示/上报用）

    // —— 条件（全部满足才命中；空/0 表示该条件不限）——
    std::wstring exts;          // 逗号分隔的扩展名列表，如 "jpg,png,gif"；空=不限
    std::wstring nameContains;  // 文件名子串（不含扩展名语义，取整个文件名）
    std::wstring nameWildcard;  // 文件名通配（含 */?，优先于 nameContains）；空=不限
    uint64_t minSize = 0;       // 字节；0=不限
    uint64_t maxSize = 0;       // 字节；0=不限
    int olderThanDays = 0;      // 修改时间距今超过 N 天；0=不限
    int newerThanDays = 0;      // 修改时间距今小于 N 天；0=不限

    // —— 动作 ——
    OrganizeTarget target = OrganizeTarget::Fixed;
    std::wstring dir;           // target=Fixed 时：目标子目录
    std::wstring groupExt;      // target=ByExt 时：用作子目录的分类名（空=用扩展名本身）
    std::wstring dateMode;      // target=ByDate 时：year | year-month | year-month-day
};

struct OrganizeOptions {
    std::wstring root;
    std::wstring targetRoot;    // 目标根目录；空=使用源目录原地整理
    bool includeHidden = false;
    OrganizeConflict conflict = OrganizeConflict::AutoName;
    bool previewOnly = false;   // 只计算目标，不移动文件
    std::vector<OrganizeRule> rules;
    size_t maxFiles = 20000;    // 单次整理上限，防止异常大目录卡住
};

// 单条文件的移动结果（回传给前端展示）
struct OrganizeItemResult {
    std::wstring from;
    std::wstring to;            // 实际落到的目标（可能含自动序号）
    std::wstring rule;          // 命中的规则名
    bool ok = false;
    bool conflict = false;      // 预览/执行时目标已存在
    bool skipped = false;       // 冲突策略 Skip 导致的跳过
    std::wstring error;
};

struct OrganizeResult {
    std::vector<OrganizeItemResult> items;
    ScanProgress stats;
    uint64_t matched = 0;       // 命中规则的文件数
    uint64_t matchedBytes = 0;  // 命中规则的文件总大小
    double elapsedMs = 0.0;
    bool cancelled = false;
    bool truncated = false;
    bool preview = false;
    std::wstring error;
};

OrganizeResult OrganizeFiles(const OrganizeOptions& options,
                             const std::atomic<bool>& cancel,
                             const std::function<void(const ScanProgress&)>& progress);

}  // namespace ts