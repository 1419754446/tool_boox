#include "organizer.h"

#include <algorithm>
#include <chrono>
#include <ctime>
#include <cwchar>
#include <cwctype>
#include <filesystem>
#include <set>
#include <string>

#include <shlwapi.h>

namespace ts {
namespace {

std::wstring LongPath(const std::wstring& path) {
    if (path.rfind(L"\\\\?\\", 0) == 0) return path;
    if (path.rfind(L"\\\\", 0) == 0) return L"\\\\?\\UNC\\" + path.substr(2);
    return L"\\\\?\\" + path;
}

std::wstring TrimTrailingSlash(std::wstring path) {
    if (path.rfind(L"\\\\?\\", 0) == 0) return path;
    while (path.size() > 3 && (path.back() == L'\\' || path.back() == L'/')) {
        path.pop_back();
    }
    if (path.size() == 2 && path[1] == L':') path.push_back(L'\\');
    return path;
}

bool ValidateRoot(const std::wstring& root, std::wstring& normalized, std::wstring& error) {
    if (root.empty()) {
        error = L"请选择一个文件夹";
        return false;
    }
    normalized = TrimTrailingSlash(root);
    DWORD attributes = GetFileAttributesW(LongPath(normalized).c_str());
    if (attributes == INVALID_FILE_ATTRIBUTES) {
        error = L"文件夹不存在，或当前账户没有访问权限";
        return false;
    }
    if ((attributes & FILE_ATTRIBUTE_DIRECTORY) == 0) {
        error = L"选择的路径不是文件夹";
        return false;
    }
    return true;
}

int64_t FileTimeToUnixMs(const FILETIME& time) {
    ULARGE_INTEGER value{};
    value.LowPart = time.dwLowDateTime;
    value.HighPart = time.dwHighDateTime;
    constexpr uint64_t kEpochDifference = 116444736000000000ull;
    if (value.QuadPart < kEpochDifference) return 0;
    return static_cast<int64_t>((value.QuadPart - kEpochDifference) / 10000ull);
}

std::wstring ToLower(std::wstring text) {
    for (wchar_t& c : text) c = static_cast<wchar_t>(std::towlower(c));
    return text;
}

void Tick(const std::function<void(const ScanProgress&)>& progress,
          const ScanProgress& stats, ULONGLONG& last, bool force = false) {
    if (!progress) return;
    ULONGLONG now = GetTickCount64();
    if (force || now - last >= 120) {
        last = now;
        progress(stats);
    }
}

std::wstring ExtensionOf(const std::wstring& name) {
    size_t dot = name.find_last_of(L'.');
    if (dot == std::wstring::npos || dot == 0 || dot + 1 >= name.size()) return {};
    return ToLower(name.substr(dot + 1));
}

// 生成目标子目录（不含 targetRoot）。空串表示直接放在目标根下。
std::wstring BuildTargetSubdir(const OrganizeRule& rule, const std::wstring& fileName,
                               int64_t mtimeMs) {
    switch (rule.target) {
        case OrganizeTarget::ByExt: {
            const std::wstring ext = ExtensionOf(fileName);
            if (!rule.groupExt.empty()) return rule.groupExt;
            if (!rule.dir.empty()) return rule.dir;
            return ext.empty() ? L"noext" : ext;
        }
        case OrganizeTarget::ByDate: {
            std::time_t seconds = static_cast<std::time_t>(mtimeMs / 1000);
            std::tm tm{};
            if (::localtime_s(&tm, &seconds) != 0) return L"";
            wchar_t year[8]{}, month[8]{}, day[8]{};
            std::swprintf(year, 8, L"%04d", tm.tm_year + 1900);
            std::swprintf(month, 8, L"%02d", tm.tm_mon + 1);
            std::swprintf(day, 8, L"%02d", tm.tm_mday);
            std::wstring mode = ToLower(rule.dateMode);
            if (mode == L"year") return year;
            if (mode == L"year-month-day") {
                return std::wstring(year) + L"\\" + month + L"\\" + day;
            }
            return std::wstring(year) + L"\\" + month;
        }
        case OrganizeTarget::Fixed:
        default:
            return rule.dir;
    }
}

// 把 "jpg, .jpeg;  PNG" 规范成小写、去前导点的扩展名列表，供 RuleMatches 缓存复用。
std::vector<std::wstring> NormalizeExtList(const std::wstring& raw) {
    std::vector<std::wstring> out;
    std::wstring current;
    auto flush = [&]() {
        std::wstring e = ToLower(current);
        if (!e.empty() && e.front() == L'.') e.erase(e.begin());
        while (!e.empty() && e.back() == L'.') e.pop_back();
        if (!e.empty()) out.push_back(std::move(e));
        current.clear();
    };
    for (wchar_t c : raw) {
        if (c == L',' || c == L';' || c == L' ') flush();
        else current.push_back(c);
    }
    flush();
    return out;
}

bool RuleMatches(const OrganizeRule& rule, const std::wstring& fileName,
                 uint64_t size, int64_t mtimeMs, int64_t nowMs,
                 const std::vector<std::wstring>* extCache = nullptr) {
    if (!rule.enabled) return false;

    if (!rule.exts.empty()) {
        const std::wstring ext = ExtensionOf(fileName);
        bool match = false;
        if (extCache) {
            for (const auto& e : *extCache) {
                if (e == ext) { match = true; break; }
            }
        } else {
            const std::vector<std::wstring> wanted = NormalizeExtList(rule.exts);
            for (const auto& e : wanted) {
                if (e == ext) { match = true; break; }
            }
        }
        if (!match) return false;
    }

    if (!rule.nameWildcard.empty()) {
        if (PathMatchSpecW(fileName.c_str(), rule.nameWildcard.c_str()) == FALSE) return false;
    } else if (!rule.nameContains.empty()) {
        if (StrStrIW(fileName.c_str(), rule.nameContains.c_str()) == nullptr) return false;
    }

    if (size < rule.minSize) return false;
    if (rule.maxSize > 0 && size > rule.maxSize) return false;

    if (mtimeMs > 0) {
        if (rule.olderThanDays > 0) {
            const int64_t cutoffMs = nowMs - static_cast<int64_t>(rule.olderThanDays) * 86400000ll;
            if (mtimeMs > cutoffMs) return false;
        }
        if (rule.newerThanDays > 0) {
            const int64_t cutoffMs = nowMs - static_cast<int64_t>(rule.newerThanDays) * 86400000ll;
            if (mtimeMs < cutoffMs) return false;
        }
    }

    return true;
}

// User-entered category names become directory components. Keep them relative
// so values such as "..\\..\\Windows" or "C:\\Temp" can never escape targetRoot.
std::wstring SanitizeRelativeSubdir(const std::wstring& raw) {
    std::wstring normalized = raw;
    for (wchar_t& c : normalized) {
        if (c == L'/') c = L'\\';
    }

    std::vector<std::wstring> segments;
    std::wstring current;
    auto flush = [&]() {
        while (!current.empty() && (current.front() == L' ' || current.front() == L'\t')) {
            current.erase(current.begin());
        }
        while (!current.empty() && (current.back() == L' ' || current.back() == L'\t' ||
                                    current.back() == L'.')) {
            current.pop_back();
        }
        if (!current.empty() && current != L"." && current != L"..") {
            for (wchar_t& c : current) {
                if (c < 32 || c == L'<' || c == L'>' || c == L':' ||
                    c == L'"' || c == L'|' || c == L'?' || c == L'*') {
                    c = L'_';
                }
            }
            segments.push_back(current);
        }
        current.clear();
    };
    for (wchar_t c : normalized) {
        if (c == L'\\') flush();
        else current.push_back(c);
    }
    flush();

    std::wstring result;
    for (const auto& segment : segments) {
        if (!result.empty()) result.push_back(L'\\');
        result += segment;
    }
    return result;
}

// 计算实际落盘路径；冲突策略在外部移动逻辑里处理，这里只负责"目标根\子目录\文件名"。
std::wstring BuildTargetPath(const std::wstring& targetRoot, const OrganizeRule& rule,
                             const std::wstring& fileName, int64_t mtimeMs) {
    // 异常文件名（仅可能来自非标准/网络挂载）直接拒绝对应目标，防止拼接出逃逸路径
    if (fileName.empty() || fileName == L"." || fileName == L".." ||
        fileName.find_first_of(L"\\/") != std::wstring::npos) {
        return {};
    }
    const std::wstring sub = SanitizeRelativeSubdir(BuildTargetSubdir(rule, fileName, mtimeMs));
    std::wstring base = TrimTrailingSlash(targetRoot);
    std::wstring result = base;
    if (!result.empty() && result.back() != L'\\') result.push_back(L'\\');
    if (!sub.empty()) {
        result += sub;
        if (result.back() != L'\\') result.push_back(L'\\');
    }
    result += fileName;
    return result;
}

// 在文件名扩展名前插入序号： "report.pdf" -> "report (1).pdf"。
std::wstring InsertCounter(const std::wstring& fileName, int counter) {
    size_t dot = fileName.find_last_of(L'.');
    // 无扩展名的点开头的隐藏文件不要当扩展名
    bool dotIsExt = dot != std::wstring::npos && dot > 0;
    std::wstring suffix = L" (" + std::to_wstring(counter) + L")";
    if (!dotIsExt) return fileName + suffix;
    return fileName.substr(0, dot) + suffix + fileName.substr(dot);
}

bool Exists(const std::wstring& path) {
    return GetFileAttributesW(LongPath(path).c_str()) != INVALID_FILE_ATTRIBUTES;
}

// 把 MoveFileExW/CopyFileExW 常见失败原因翻译成可读提示，否则返回空串。
const wchar_t* WinErrorHint(DWORD code) {
    switch (code) {
        case ERROR_DISK_FULL:
        case ERROR_HANDLE_DISK_FULL:   return L"磁盘空间不足";
        case ERROR_ACCESS_DENIED:      return L"没有访问权限";
        case ERROR_SHARING_VIOLATION:  return L"文件被占用，请先关闭正在使用它的程序";
        case ERROR_LOCK_VIOLATION:     return L"文件被锁定，请先释放占用";
        case ERROR_NOT_SAME_DEVICE:    return L"跨盘移动失败，请检查目标盘是否可写";
        case ERROR_FILE_EXISTS:
        case ERROR_ALREADY_EXISTS:     return L"目标已存在";
        case ERROR_PATH_NOT_FOUND:     return L"路径不存在";
        case ERROR_FILENAME_EXCED_RANGE: return L"路径过长";
        default:                       return L"";
    }
}

bool IsSameOrUnder(const std::wstring& path, const std::wstring& root) {
    if (root.empty()) return false;
    if (_wcsicmp(path.c_str(), root.c_str()) == 0) return true;
    if (path.size() <= root.size()) return false;
    if (_wcsnicmp(path.c_str(), root.c_str(), root.size()) != 0) return false;
    return path[root.size()] == L'\\' || path[root.size()] == L'/';
}

std::wstring AutoNameTarget(const std::wstring& goal) {
    if (!Exists(goal)) return goal;
    const std::wstring fileName = std::filesystem::path(goal).filename().wstring();
    for (int counter = 1; counter <= 10000; ++counter) {
        std::wstring candidate = goal;
        const size_t pos = candidate.rfind(fileName);
        if (pos == std::wstring::npos) return {};
        candidate.replace(pos, fileName.size(), InsertCounter(fileName, counter));
        if (!Exists(candidate)) return candidate;
    }
    return {};
}

}  // namespace

OrganizeResult OrganizeFiles(const OrganizeOptions& options,
                             const std::atomic<bool>& cancel,
                             const std::function<void(const ScanProgress&)>& progress) {
    OrganizeResult result;
    auto started = std::chrono::steady_clock::now();

    std::wstring scanRoot;
    if (!ValidateRoot(options.root, scanRoot, result.error)) return result;

    // 目标根：空则使用源目录本身（原地整理到子目录）。
    std::wstring targetRoot = TrimTrailingSlash(options.targetRoot.empty() ? scanRoot : options.targetRoot);
    if (!options.previewOnly &&
        GetFileAttributesW(LongPath(targetRoot).c_str()) == INVALID_FILE_ATTRIBUTES) {
        std::error_code ec;
        std::filesystem::create_directories(std::filesystem::path(LongPath(targetRoot)), ec);
        if (ec) {
            result.error = L"无法创建目标目录";
            return result;
        }
    }

    FILETIME nowFt{};
    GetSystemTimeAsFileTime(&nowFt);
    const int64_t nowMs = FileTimeToUnixMs(nowFt);

    const auto moveFile = [&](const std::wstring& from, const std::wstring& goal,
                              bool& skipped) -> std::pair<bool, std::wstring> {
        const auto errMsg = [](DWORD code) {
            std::wstring msg = L"移动失败（错误码 " + std::to_wstring(code);
            if (const wchar_t* hint = WinErrorHint(code); hint && *hint) {
                msg += L" · ";
                msg += hint;
            }
            msg += L"）";
            return msg;
        };
        skipped = false;
        if (LongPath(from) == LongPath(goal)) {
            return {true, L""};  // 已就位
        }
        // 确保目标所在目录存在
        std::filesystem::path targetPath(LongPath(goal));
        std::error_code ec;
        std::filesystem::create_directories(targetPath.parent_path(), ec);

        switch (options.conflict) {
            case OrganizeConflict::Skip:
                if (Exists(goal)) {
                    skipped = true;
                    return {false, L"目标已存在，已跳过"};
                }
                break;  // 继续用固定目标
            case OrganizeConflict::Overwrite:
                // 目标存在则覆盖
                break;
            case OrganizeConflict::AutoName:
            default: {
                const std::wstring candidate = AutoNameTarget(goal);
                if (candidate.empty()) return {false, L"自动命名失败"};
                return MoveFileExW(LongPath(from).c_str(), LongPath(candidate).c_str(),
                                   MOVEFILE_WRITE_THROUGH | MOVEFILE_COPY_ALLOWED)
                      ? std::pair<bool, std::wstring>{true, candidate}
                      : std::pair<bool, std::wstring>{false, errMsg(GetLastError())};
            }
        }

        int flags = MOVEFILE_WRITE_THROUGH | MOVEFILE_COPY_ALLOWED;
        if (options.conflict == OrganizeConflict::Overwrite && Exists(goal)) {
            flags |= MOVEFILE_REPLACE_EXISTING;
        }
        if (MoveFileExW(LongPath(from).c_str(), LongPath(goal).c_str(), flags)) {
            return {true, goal};
        }
        return {false, errMsg(GetLastError())};
    };

    struct Candidate {
        std::wstring path;
        std::wstring name;
        uint64_t size = 0;
        int64_t mtime = 0;
        const OrganizeRule* rule = nullptr;
    };
    std::vector<Candidate> candidates;
    // 预编译每条规则的扩展名集合，避免对每个文件重复解析 exts 字符串
    std::vector<std::vector<std::wstring>> preparedExts;
    preparedExts.reserve(options.rules.size());
    for (const auto& rule : options.rules) {
        preparedExts.emplace_back(rule.exts.empty() ? std::vector<std::wstring>{}
                                                    : NormalizeExtList(rule.exts));
    }
    std::vector<std::wstring> stack{scanRoot};
    ++result.stats.dirs;
    ULONGLONG last = 0;
    bool stopScan = false;

    // Phase 1: collect candidates without moving anything. Moving while the
    // same tree is being enumerated makes newly created target folders appear
    // in the walk and can double-count files.
    while (!stack.empty() && !stopScan) {
        if (cancel.load(std::memory_order_relaxed)) {
            result.cancelled = true;
            break;
        }
        std::wstring directory = std::move(stack.back());
        stack.pop_back();

        WIN32_FIND_DATAW data{};
        std::wstring findPattern = LongPath(directory);
        if (!findPattern.empty() && findPattern.back() != L'\\') findPattern.push_back(L'\\');
        findPattern.push_back(L'*');
        HANDLE handle = FindFirstFileExW(findPattern.c_str(), FindExInfoBasic, &data,
                                         FindExSearchNameMatch, nullptr,
                                         FIND_FIRST_EX_LARGE_FETCH);
        if (handle == INVALID_HANDLE_VALUE) {
            handle = FindFirstFileW(findPattern.c_str(), &data);
        }
        if (handle == INVALID_HANDLE_VALUE) {
            ++result.stats.skipped;
            continue;
        }

        uint64_t entries = 0;
        do {
            // 防呆：防止极端情况下目录枚举异常导致无限循环
            if (++entries > 5000000) break;
            if (cancel.load(std::memory_order_relaxed)) {
                result.cancelled = true;
                break;
            }
            if (wcscmp(data.cFileName, L".") == 0 || wcscmp(data.cFileName, L"..") == 0) continue;

            std::wstring path = directory;
            if (!path.empty() && path.back() != L'\\' && path.back() != L'/') path.push_back(L'\\');
            path += data.cFileName;

            if (data.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) {
                ++result.stats.skipped;
                continue;
            }
            if (!options.includeHidden &&
                (data.dwFileAttributes & (FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM))) {
                ++result.stats.skipped;
                continue;
            }

            if (data.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
                // If a custom target lives inside the source tree, do not scan
                // the files we just moved there again.
                if (_wcsicmp(scanRoot.c_str(), targetRoot.c_str()) != 0 &&
                    IsSameOrUnder(path, targetRoot)) {
                    ++result.stats.skipped;
                    continue;
                }
                ++result.stats.dirs;
                stack.push_back(std::move(path));
                continue;
            }

            ULARGE_INTEGER size{};
            size.LowPart = data.nFileSizeLow;
            size.HighPart = data.nFileSizeHigh;
            ++result.stats.files;
            result.stats.bytes += size.QuadPart;
            result.stats.current = path;
            Tick(progress, result.stats, last);

            // 首条命中规则
            const OrganizeRule* hit = nullptr;
            for (size_t ri = 0; ri < options.rules.size(); ++ri) {
                const auto& rule = options.rules[ri];
                if (RuleMatches(rule, data.cFileName, size.QuadPart,
                                FileTimeToUnixMs(data.ftLastWriteTime), nowMs,
                                &preparedExts[ri])) {
                    hit = &rule;
                    break;
                }
            }
            if (!hit) {
                ++result.stats.skipped;  // 无规则命中，本题未归类
                continue;
            }
            ++result.matched;
            ++result.stats.matched;
            result.matchedBytes += size.QuadPart;
            if (candidates.size() >= options.maxFiles) {
                result.truncated = true;
                stopScan = true;
                break;
            }
            candidates.push_back(Candidate{path, data.cFileName, size.QuadPart,
                                           FileTimeToUnixMs(data.ftLastWriteTime), hit});
        } while (FindNextFileW(handle, &data));

        FindClose(handle);
        if (result.cancelled) break;
    }

    if (result.cancelled) {
        result.elapsedMs = std::chrono::duration<double, std::milli>(
                               std::chrono::steady_clock::now() - started)
                               .count();
        return result;
    }

    if (options.previewOnly) {
        result.preview = true;
        for (const auto& candidate : candidates) {
            if (cancel.load(std::memory_order_relaxed)) {
                result.cancelled = true;
                break;
            }
            const std::wstring goal = BuildTargetPath(targetRoot, *candidate.rule,
                                                      candidate.name, candidate.mtime);
            if (goal.empty()) { ++result.stats.skipped; continue; }
            if (_wcsicmp(candidate.path.c_str(), goal.c_str()) == 0) continue;
            const bool exists = Exists(goal);
            std::wstring planned = goal;
            bool ok = true;
            bool conflict = false;
            bool skipped = false;
            std::wstring message;
            if (exists) {
                conflict = true;
                if (options.conflict == OrganizeConflict::Skip) {
                    ok = false;
                    skipped = true;
                    message = L"目标已存在，执行时将跳过";
                } else if (options.conflict == OrganizeConflict::Overwrite) {
                    message = L"目标已存在，执行时将覆盖";
                } else {
                    planned = AutoNameTarget(goal);
                    if (planned.empty()) {
                        ok = false;
                        message = L"目标已存在，自动命名失败";
                    } else {
                        message = L"目标已存在，执行时将自动改名";
                    }
                }
            }
            OrganizeItemResult item;
            item.from = candidate.path;
            item.to = planned;
            item.rule = candidate.rule->name;
            item.ok = ok;
            item.conflict = conflict;
            item.skipped = skipped;
            item.error = message;
            result.items.push_back(std::move(item));
        }
        result.elapsedMs = std::chrono::duration<double, std::milli>(
                               std::chrono::steady_clock::now() - started)
                               .count();
        return result;
    }

    // Phase 2: move the collected files. Cancellation here leaves already
    // finished moves in place, but never walks a directory while changing it.
    for (const auto& candidate : candidates) {
        if (cancel.load(std::memory_order_relaxed)) {
            result.cancelled = true;
            break;
        }
        std::wstring goal = BuildTargetPath(targetRoot, *candidate.rule, candidate.name,
                                            candidate.mtime);
        if (goal.empty()) { ++result.stats.skipped; continue; }
        if (_wcsicmp(candidate.path.c_str(), goal.c_str()) == 0) continue;
        bool skipped = false;
        auto [ok, actual] = moveFile(candidate.path, goal, skipped);

        OrganizeItemResult item;
        item.from = candidate.path;
        item.rule = candidate.rule->name;
        item.ok = ok;
        item.skipped = skipped;
        if (ok) {
            item.to = actual.empty() ? goal : actual;
        } else {
            item.to = goal;
            item.error = actual;
        }
        result.items.push_back(std::move(item));
        Tick(progress, result.stats, last, true);
    }

    result.elapsedMs = std::chrono::duration<double, std::milli>(
                           std::chrono::steady_clock::now() - started)
                           .count();
    return result;
}

}  // namespace ts
