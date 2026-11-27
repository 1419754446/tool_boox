#include "scanner.h"

#include "tasks.h"

#include <algorithm>
#include <chrono>
#include <cwchar>
#include <cwctype>
#include <filesystem>
#include <map>
#include <queue>
#include <utility>

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

std::vector<std::wstring> EnumerateLocalSearchRoots() {
    std::vector<std::wstring> roots;
    const DWORD mask = GetLogicalDrives();
    for (int i = 0; i < 26; ++i) {
        if ((mask & (1u << i)) == 0) continue;
        wchar_t root[4] = {static_cast<wchar_t>(L'A' + i), L':', L'\\', L'\0'};
        const UINT type = GetDriveTypeW(root);
        // 只取固定磁盘，和界面上盘符条（drives.cpp 的 FixedDriveRoots）保持一致。
        // 早先这里还放过可移动盘，导致"全盘扫描"扫了 U 盘、但盘符条里看不到它。
        if (type != DRIVE_FIXED) continue;
        if (GetFileAttributesW(root) == INVALID_FILE_ATTRIBUTES) continue;
        roots.emplace_back(root);
    }
    return roots;
}

int64_t FileTimeToUnixMs(const FILETIME& time) {
    ULARGE_INTEGER value{};
    value.LowPart = time.dwLowDateTime;
    value.HighPart = time.dwHighDateTime;
    constexpr uint64_t kEpochDifference = 116444736000000000ull;
    if (value.QuadPart < kEpochDifference) return 0;
    return static_cast<int64_t>((value.QuadPart - kEpochDifference) / 10000ull);
}

std::wstring ExtensionOf(const std::wstring& name) {
    size_t dot = name.find_last_of(L'.');
    if (dot == std::wstring::npos || dot == 0 || dot + 1 >= name.size()) return {};
    std::wstring ext = name.substr(dot + 1);
    for (wchar_t& c : ext) c = static_cast<wchar_t>(std::towlower(c));
    return ext;
}

bool IsHiddenOrSystem(DWORD attributes) {
    return (attributes & (FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM)) != 0;
}

HANDLE FindFirstCompat(const std::wstring& pattern, WIN32_FIND_DATAW& data) {
    HANDLE handle = FindFirstFileExW(pattern.c_str(), FindExInfoBasic, &data,
                                     FindExSearchNameMatch, nullptr,
                                     FIND_FIRST_EX_LARGE_FETCH);
    if (handle == INVALID_HANDLE_VALUE) {
        handle = FindFirstFileW(pattern.c_str(), &data);
    }
    return handle;
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

struct MinSizeCompare {
    bool operator()(const FileItem& a, const FileItem& b) const {
        if (a.size != b.size) return a.size > b.size;
        return a.path < b.path;
    }
};

bool WalkEmpty(const std::wstring& directory, bool isRoot, int depth,
               const std::atomic<bool>& cancel,
               const std::function<void(const ScanProgress&)>& progress,
               ScanProgress& stats, ULONGLONG& last,
               std::vector<std::wstring>& folders, bool& cancelled) {
    if (cancelled || cancel.load(std::memory_order_relaxed)) {
        cancelled = true;
        return true;
    }
    if (depth > 512) return true;

    ++stats.dirs;
    stats.current = directory;
    Tick(progress, stats, last);

    bool hasContent = false;
    WIN32_FIND_DATAW data{};
    HANDLE handle = FindFirstCompat(LongPath(directory) + L"\\*", data);
    if (handle == INVALID_HANDLE_VALUE) {
        // 无法枚举就不要把它当空目录，避免误删。
        ++stats.skipped;
        return true;
    }

    do {
        if (cancelled || cancel.load(std::memory_order_relaxed)) {
            cancelled = true;
            break;
        }
        if (wcscmp(data.cFileName, L".") == 0 || wcscmp(data.cFileName, L"..") == 0) continue;

        std::wstring child = directory;
        if (!child.empty() && child.back() != L'\\' && child.back() != L'/') child.push_back(L'\\');
        child += data.cFileName;

        if (data.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) {
            // junction / symlink 一律视为有内容，不能删。
            hasContent = true;
            ++stats.skipped;
            continue;
        }

        if (data.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            if (WalkEmpty(child, false, depth + 1, cancel, progress, stats, last, folders, cancelled)) {
                hasContent = true;
            }
        } else {
            hasContent = true;
            ++stats.files;
            ULARGE_INTEGER size{};
            size.LowPart = data.nFileSizeLow;
            size.HighPart = data.nFileSizeHigh;
            stats.bytes += size.QuadPart;
        }
        Tick(progress, stats, last);
    } while (FindNextFileW(handle, &data));

    FindClose(handle);

    if (!hasContent && !isRoot) {
        folders.push_back(directory);
    }
    return hasContent || cancelled;
}

}  // namespace

LargeScanResult ScanLargeFiles(const LargeScanOptions& options,
                               const std::atomic<bool>& cancel,
                               const std::function<void(const ScanProgress&)>& progress) {
    LargeScanResult result;
    auto started = std::chrono::steady_clock::now();

    // 根目录集合：优先 roots（勾选的盘），其次单根 root，都没有就扫全部本地磁盘。
    // 不可访问的根直接跳过，不让一块被拔掉的盘拖垮整次扫描。
    std::vector<std::wstring> roots;
    if (!options.roots.empty()) {
        std::wstring ignored;
        for (const auto& candidate : options.roots) {
            std::wstring normalized;
            if (ValidateRoot(candidate, normalized, ignored)) roots.push_back(std::move(normalized));
        }
        if (roots.empty()) {
            result.error = L"选中的磁盘都不可访问，请重新勾选";
            return result;
        }
    } else if (!options.root.empty()) {
        std::wstring root;
        if (!ValidateRoot(options.root, root, result.error)) {
            return result;
        }
        roots.push_back(std::move(root));
    } else {
        roots = EnumerateLocalSearchRoots();
        if (roots.empty()) {
            result.error = L"没有找到可扫描的本地磁盘";
            return result;
        }
    }

    const size_t maxResults = options.maxResults == 0 ? 1000 : options.maxResults;
    std::priority_queue<FileItem, std::vector<FileItem>, MinSizeCompare> top;
    std::vector<std::wstring> stack;
    for (auto it = roots.rbegin(); it != roots.rend(); ++it) stack.push_back(*it);
    ULONGLONG last = 0;
    uint64_t sinceCancelCheck = 0;

    while (!stack.empty()) {
        if (cancel.load(std::memory_order_relaxed)) {
            result.cancelled = true;
            break;
        }

        std::wstring directory = std::move(stack.back());
        stack.pop_back();
        ++result.stats.dirs;

        WIN32_FIND_DATAW data{};
        std::wstring findPattern = LongPath(directory);
        if (!findPattern.empty() && findPattern.back() != L'\\') findPattern.push_back(L'\\');
        findPattern.push_back(L'*');
        HANDLE handle = FindFirstCompat(findPattern, data);
        if (handle == INVALID_HANDLE_VALUE) {
            ++result.stats.skipped;
            continue;
        }

        do {
            if ((++sinceCancelCheck & 0xFF) == 0 &&
                cancel.load(std::memory_order_relaxed)) {
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
            if (!options.includeHidden && IsHiddenOrSystem(data.dwFileAttributes)) {
                ++result.stats.skipped;
                continue;
            }

            if (data.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
                stack.push_back(std::move(path));
                continue;
            }

            ++result.stats.files;
            ULARGE_INTEGER size{};
            size.LowPart = data.nFileSizeLow;
            size.HighPart = data.nFileSizeHigh;
            result.stats.bytes += size.QuadPart;

            if (size.QuadPart >= options.minSize) {
                ++result.stats.matched;
                FileItem item;
                item.path = path;
                item.name = data.cFileName;
                item.ext = ExtensionOf(item.name);
                item.size = size.QuadPart;
                item.mtimeMs = FileTimeToUnixMs(data.ftLastWriteTime);
                top.push(std::move(item));
                if (top.size() > maxResults) top.pop();
            }

            result.stats.current = path;
            Tick(progress, result.stats, last);
        } while (FindNextFileW(handle, &data));

        FindClose(handle);
        // 这里曾经用 force 每个目录都发一条进度：全盘几十万个目录时会瞬间灌出
        // 几万条 PostWebMessage，WebView2 的消息队列被塞满，页面表现为进度停住、
        // 取消无响应、扫描结束的 scanDone 也排不上队。交回 120ms 节流即可。
        Tick(progress, result.stats, last);
        if (result.cancelled) break;
    }

    result.totalMatched = result.stats.matched;
    result.items.reserve(top.size());
    while (!top.empty()) {
        result.items.push_back(std::move(const_cast<FileItem&>(top.top())));
        top.pop();
    }
    std::sort(result.items.begin(), result.items.end(), [](const FileItem& a, const FileItem& b) {
        if (a.size != b.size) return a.size > b.size;
        return a.path < b.path;
    });

    result.elapsedMs = std::chrono::duration<double, std::milli>(
                           std::chrono::steady_clock::now() - started)
                           .count();
    return result;
}

EmptyFolderResult ScanEmptyFolders(const std::vector<std::wstring>& roots,
                                   const std::atomic<bool>& cancel,
                                   const std::function<void(const ScanProgress&)>& progress) {
    EmptyFolderResult result;
    auto started = std::chrono::steady_clock::now();

    std::vector<std::wstring> normalizedRoots;
    if (roots.empty()) {
        normalizedRoots = EnumerateLocalSearchRoots();
        if (normalizedRoots.empty()) {
            result.error = L"没有找到可扫描的本地磁盘";
            return result;
        }
    } else {
        std::wstring ignored;
        for (const auto& candidate : roots) {
            std::wstring normalized;
            if (ValidateRoot(candidate, normalized, ignored)) {
                normalizedRoots.push_back(std::move(normalized));
            }
        }
        if (normalizedRoots.empty()) {
            result.error = L"选中的磁盘都不可访问，请重新勾选";
            return result;
        }
    }

    ULONGLONG last = 0;
    bool cancelled = false;
    for (const auto& root : normalizedRoots) {
        WalkEmpty(root, true, 0, cancel, progress, result.stats, last,
                  result.folders, cancelled);
        if (cancelled) break;
    }

    result.cancelled = cancelled;
    std::sort(result.folders.begin(), result.folders.end(), [](const std::wstring& a, const std::wstring& b) {
        return a.size() > b.size();
    });

    result.elapsedMs = std::chrono::duration<double, std::milli>(
                           std::chrono::steady_clock::now() - started)
                           .count();
    return result;
}

SearchResult SearchFiles(const SearchOptions& options,
                         const std::atomic<bool>& cancel,
                         const std::function<void(const ScanProgress&)>& progress) {
    SearchResult result;
    auto started = std::chrono::steady_clock::now();

    std::vector<std::wstring> roots;
    if (options.root.empty()) {
        roots = EnumerateLocalSearchRoots();
        if (roots.empty()) {
            result.error = L"没有找到可搜索的本地磁盘";
            return result;
        }
    } else {
        std::wstring root;
        if (!ValidateRoot(options.root, root, result.error)) {
            return result;
        }
        roots.push_back(std::move(root));
    }

    // 分号/逗号分隔的通配模式；空模式 = 匹配全部文件。PathMatchSpecW 自带大小写不敏感。
    std::vector<std::wstring> patterns;
    {
        std::wstring current;
        for (wchar_t c : options.patterns) {
            if (c == L';' || c == L',' || c == L'\uFF0C' || c == L'\uFF1B' || c == L' ') {
                if (!current.empty()) patterns.push_back(current);
                current.clear();
            } else {
                current.push_back(c);
            }
        }
        if (!current.empty()) patterns.push_back(current);
    }

    FILETIME nowFt{};
    GetSystemTimeAsFileTime(&nowFt);
    const int64_t nowMs = FileTimeToUnixMs(nowFt);
    const int64_t cutoffMs = options.modifiedWithinMs > 0 ? nowMs - options.modifiedWithinMs : 0;

    const size_t maxResults = options.maxResults == 0 ? 5000 : options.maxResults;
    // A bare term such as "invoice" means substring search; only terms with
    // * or ? use Windows wildcard semantics.
    auto matchesPattern = [](const wchar_t* name, const wchar_t* pattern) {
        if (std::wcschr(pattern, L'*') == nullptr && std::wcschr(pattern, L'?') == nullptr) {
            return StrStrIW(name, pattern) != nullptr;
        }
        return PathMatchSpecW(name, pattern) != FALSE;
    };
    std::vector<std::wstring> stack;
    for (auto it = roots.rbegin(); it != roots.rend(); ++it) {
        stack.push_back(*it);
    }
    ULONGLONG last = 0;
    uint64_t sinceCancelCheck = 0;

    while (!stack.empty()) {
        if (cancel.load(std::memory_order_relaxed)) {
            result.cancelled = true;
            break;
        }

        std::wstring directory = std::move(stack.back());
        stack.pop_back();
        ++result.stats.dirs;

        WIN32_FIND_DATAW data{};
        std::wstring findPattern = LongPath(directory);
        if (!findPattern.empty() && findPattern.back() != L'\\') findPattern.push_back(L'\\');
        findPattern.push_back(L'*');
        HANDLE handle = FindFirstCompat(findPattern, data);
        if (handle == INVALID_HANDLE_VALUE) {
            ++result.stats.skipped;
            continue;
        }

        do {
            if ((++sinceCancelCheck & 0xFF) == 0 &&
                cancel.load(std::memory_order_relaxed)) {
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
            if (!options.includeHidden && IsHiddenOrSystem(data.dwFileAttributes)) {
                ++result.stats.skipped;
                continue;
            }

            if (data.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
                if (options.recursive) stack.push_back(std::move(path));
                continue;
            }

            ++result.stats.files;
            ULARGE_INTEGER size{};
            size.LowPart = data.nFileSizeLow;
            size.HighPart = data.nFileSizeHigh;
            result.stats.bytes += size.QuadPart;

            bool matches = patterns.empty();
            for (const std::wstring& pattern : patterns) {
                if (matchesPattern(data.cFileName, pattern.c_str())) {
                    matches = true;
                    break;
                }
            }
            if (!matches) continue;
            if (options.minSize && size.QuadPart < options.minSize) continue;
            if (options.maxSize && size.QuadPart > options.maxSize) continue;
            const int64_t mtimeMs = FileTimeToUnixMs(data.ftLastWriteTime);
            if (cutoffMs && mtimeMs < cutoffMs) continue;

            ++result.stats.matched;
            if (result.items.size() < maxResults) {
                FileItem item;
                item.path = path;
                item.name = data.cFileName;
                item.ext = ExtensionOf(item.name);
                item.size = size.QuadPart;
                item.mtimeMs = mtimeMs;
                result.items.push_back(std::move(item));
            }

            result.stats.current = path;
            Tick(progress, result.stats, last);
        } while (FindNextFileW(handle, &data));

        FindClose(handle);
        // 这里曾经用 force 每个目录都发一条进度：全盘几十万个目录时会瞬间灌出
        // 几万条 PostWebMessage，WebView2 的消息队列被塞满，页面表现为进度停住、
        // 取消无响应、扫描结束的 scanDone 也排不上队。交回 120ms 节流即可。
        Tick(progress, result.stats, last);
        if (result.cancelled) break;
    }

    result.totalMatched = result.stats.matched;
    std::sort(result.items.begin(), result.items.end(), [](const FileItem& a, const FileItem& b) {
        if (a.mtimeMs != b.mtimeMs) return a.mtimeMs > b.mtimeMs;
        return _wcsicmp(a.path.c_str(), b.path.c_str()) < 0;
    });

    result.elapsedMs = std::chrono::duration<double, std::milli>(
                           std::chrono::steady_clock::now() - started)
                           .count();
    return result;
}

namespace {

struct DiffNode {
    std::wstring relPath;
    uint64_t size = 0;
    int64_t mtimeMs = 0;
    bool isDir = false;
};

using DiffMap = std::map<std::wstring, DiffNode>;  // key = 小写相对路径

std::wstring DiffKey(const std::wstring& rel) {
    std::wstring key = rel;
    for (wchar_t& c : key) c = static_cast<wchar_t>(std::towlower(c));
    return key;
}

void WalkForDiff(const std::wstring& directory, const std::wstring& prefix, int depth,
                 const std::atomic<bool>& cancel,
                 const std::function<void(const ScanProgress&)>& progress,
                 ScanProgress& stats, ULONGLONG& last, DiffMap& out, bool& cancelled) {
    if (cancelled || cancel.load(std::memory_order_relaxed)) {
        cancelled = true;
        return;
    }
    if (depth > 256) return;

    ++stats.dirs;
    stats.current = directory;
    Tick(progress, stats, last);

    WIN32_FIND_DATAW data{};
    HANDLE handle = FindFirstCompat(LongPath(directory) + L"\\*", data);
    if (handle == INVALID_HANDLE_VALUE) {
        ++stats.skipped;
        return;
    }

    do {
        if (cancelled || cancel.load(std::memory_order_relaxed)) {
            cancelled = true;
            break;
        }
        if (wcscmp(data.cFileName, L".") == 0 || wcscmp(data.cFileName, L"..") == 0) continue;
        if (data.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) {
            ++stats.skipped;
            continue;
        }

        const std::wstring rel = prefix.empty() ? data.cFileName : prefix + L"\\" + data.cFileName;

        if (data.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            DiffNode node;
            node.relPath = rel;
            node.isDir = true;
            node.mtimeMs = FileTimeToUnixMs(data.ftLastWriteTime);
            out[DiffKey(rel)] = std::move(node);

            std::wstring child = directory;
            if (!child.empty() && child.back() != L'\\' && child.back() != L'/') child.push_back(L'\\');
            child += data.cFileName;
            WalkForDiff(child, rel, depth + 1, cancel, progress, stats, last, out, cancelled);
            continue;
        }

        ULARGE_INTEGER size{};
        size.LowPart = data.nFileSizeLow;
        size.HighPart = data.nFileSizeHigh;
        ++stats.files;
        stats.bytes += size.QuadPart;

        DiffNode node;
        node.relPath = rel;
        node.size = size.QuadPart;
        node.mtimeMs = FileTimeToUnixMs(data.ftLastWriteTime);
        out[DiffKey(rel)] = std::move(node);

        stats.current = directory + L"\\" + data.cFileName;
        Tick(progress, stats, last);
    } while (FindNextFileW(handle, &data));

    FindClose(handle);
    Tick(progress, stats, last, true);
}

}  // namespace

FolderDiffResult CompareFolders(const std::wstring& rootA, const std::wstring& rootB,
                                const std::atomic<bool>& cancel,
                                const std::function<void(const ScanProgress&)>& progress,
                                bool compareContent) {
    FolderDiffResult result;
    auto started = std::chrono::steady_clock::now();

    std::wstring normA;
    if (!ValidateRoot(rootA, normA, result.error)) return result;
    std::wstring normB;
    if (!ValidateRoot(rootB, normB, result.error)) return result;

    ULONGLONG last = 0;
    bool cancelled = false;
    DiffMap mapA;
    DiffMap mapB;
    WalkForDiff(normA, L"", 0, cancel, progress, result.stats, last, mapA, cancelled);
    WalkForDiff(normB, L"", 0, cancel, progress, result.stats, last, mapB, cancelled);
    result.cancelled = cancelled;
    if (cancelled) return result;

    auto pushDiff = [](std::vector<DiffEntry>& list, const std::wstring& rel, bool isDir,
                       uint64_t sizeA, uint64_t sizeB, int64_t mtimeA, int64_t mtimeB) {
        DiffEntry entry;
        entry.relPath = rel;
        size_t slash = rel.find_last_of(L'\\');
        entry.name = slash == std::wstring::npos ? rel : rel.substr(slash + 1);
        entry.isDir = isDir;
        entry.sizeA = sizeA;
        entry.sizeB = sizeB;
        entry.mtimeA = mtimeA;
        entry.mtimeB = mtimeB;
        list.push_back(std::move(entry));
    };

    auto joinRoot = [](const std::wstring& root, const std::wstring& rel) {
        std::wstring path = root;
        if (!path.empty() && path.back() != L'\\' && path.back() != L'/') path.push_back(L'\\');
        path += rel;
        return path;
    };

    for (const auto& [key, nodeA] : mapA) {
        if (cancel.load(std::memory_order_relaxed)) {
            result.cancelled = true;
            break;
        }
        auto it = mapB.find(key);
        if (it == mapB.end()) {
            pushDiff(result.onlyA, nodeA.relPath, nodeA.isDir,
                     nodeA.size, 0, nodeA.mtimeMs, 0);
            continue;
        }
        const DiffNode& nodeB = it->second;
        if (nodeA.isDir != nodeB.isDir) {
            pushDiff(result.different, nodeA.relPath, false,
                     nodeA.size, nodeB.size, nodeA.mtimeMs, nodeB.mtimeMs);
        } else if (!nodeA.isDir) {
            const int64_t mtimeDelta = nodeA.mtimeMs > nodeB.mtimeMs
                ? nodeA.mtimeMs - nodeB.mtimeMs
                : nodeB.mtimeMs - nodeA.mtimeMs;
            bool different = nodeA.size != nodeB.size || mtimeDelta > 2000;
            if (!different && compareContent) {
                std::wstring errorA;
                std::wstring errorB;
                const std::wstring hashA = Sha256FileHex(
                    joinRoot(normA, nodeA.relPath), errorA, 0, &cancel);
                const std::wstring hashB = Sha256FileHex(
                    joinRoot(normB, nodeB.relPath), errorB, 0, &cancel);
                if (!hashA.empty() && !hashB.empty() && hashA != hashB) {
                    different = true;
                }
            }
            if (different) {
                pushDiff(result.different, nodeA.relPath, false,
                         nodeA.size, nodeB.size, nodeA.mtimeMs, nodeB.mtimeMs);
            }
        }
    }
    for (const auto& [key, nodeB] : mapB) {
        if (mapA.find(key) == mapA.end()) {
            pushDiff(result.onlyB, nodeB.relPath, nodeB.isDir,
                     0, nodeB.size, 0, nodeB.mtimeMs);
        }
    }

    result.elapsedMs = std::chrono::duration<double, std::milli>(
                           std::chrono::steady_clock::now() - started)
                           .count();
    return result;
}

namespace {

struct CopyProgressContext {
    const std::atomic<bool>* cancel = nullptr;
    const CopyProgress* progress = nullptr;
    uint64_t totalBytes = 0;
    uint64_t completedBytes = 0;
    uint64_t fileTotal = 0;
    uint64_t lastReported = 0;
    std::wstring current;
};

DWORD CALLBACK CopyProgressCallback(LARGE_INTEGER totalFileSize,
                                   LARGE_INTEGER totalBytesTransferred,
                                   LARGE_INTEGER, LARGE_INTEGER,
                                   DWORD, DWORD, HANDLE, HANDLE, LPVOID data) {
    auto* context = static_cast<CopyProgressContext*>(data);
    if (!context) return PROGRESS_CONTINUE;
    if (context->cancel && context->cancel->load(std::memory_order_relaxed)) {
        return PROGRESS_CANCEL;
    }
    const uint64_t transferred = static_cast<uint64_t>(totalBytesTransferred.QuadPart);
    const uint64_t fileTotal = static_cast<uint64_t>(totalFileSize.QuadPart);
    if (context->progress && *context->progress) {
        if (transferred == fileTotal || transferred - context->lastReported >= 4ull * 1024 * 1024) {
            context->lastReported = transferred;
            (*context->progress)(context->completedBytes + transferred,
                                 context->totalBytes, context->current);
        }
    }
    return PROGRESS_CONTINUE;
}

}  // namespace

CopyOutcome CopyFilePairs(const std::vector<std::pair<std::wstring, std::wstring>>& pairs,
                          const std::atomic<bool>& cancel,
                          const CopyProgress& progress) {
    CopyOutcome out;
    uint64_t totalBytes = 0;
    for (const auto& [from, to] : pairs) {
        (void)to;
        HANDLE handle = CreateFileW(LongPath(from).c_str(), GENERIC_READ,
                                    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                                    nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (handle != INVALID_HANDLE_VALUE) {
            LARGE_INTEGER size{};
            if (GetFileSizeEx(handle, &size) && size.QuadPart > 0) {
                totalBytes += static_cast<uint64_t>(size.QuadPart);
            }
            CloseHandle(handle);
        }
    }

    uint64_t completed = 0;
    for (const auto& [from, to] : pairs) {
        if (cancel.load(std::memory_order_relaxed)) {
            out.cancelled = true;
            break;
        }
        std::error_code ec;
        std::filesystem::path target(to);
        std::filesystem::create_directories(target.parent_path(), ec);

        LARGE_INTEGER size{};
        uint64_t fileSize = 0;
        HANDLE handle = CreateFileW(LongPath(from).c_str(), GENERIC_READ,
                                    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                                    nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (handle != INVALID_HANDLE_VALUE) {
            if (GetFileSizeEx(handle, &size) && size.QuadPart > 0) {
                fileSize = static_cast<uint64_t>(size.QuadPart);
            }
            CloseHandle(handle);
        }

        CopyProgressContext context;
        context.cancel = &cancel;
        context.progress = &progress;
        context.totalBytes = totalBytes;
        context.completedBytes = completed;
        context.fileTotal = fileSize;
        context.current = from;

        if (CopyFileExW(LongPath(from).c_str(), LongPath(to).c_str(),
                        CopyProgressCallback, &context, nullptr, 0)) {
            ++out.okCount;
            completed += fileSize;
            if (progress) progress(completed, totalBytes, from);
        } else if (cancel.load(std::memory_order_relaxed) ||
                   GetLastError() == ERROR_REQUEST_ABORTED) {
            out.cancelled = true;
            break;
        } else {
            ++out.failCount;
            out.errors.push_back(from + L" -> " + to + L" (错误码 " +
                                 std::to_wstring(GetLastError()) + L")");
        }
    }
    return out;
}

CopyOutcome RenameFilePairs(const std::vector<std::pair<std::wstring, std::wstring>>& pairs,
                            const std::atomic<bool>& cancel) {
    CopyOutcome out;
    for (const auto& [from, to] : pairs) {
        if (cancel.load(std::memory_order_relaxed)) {
            out.cancelled = true;
            break;
        }
        // MoveFileEx 不覆盖目标；COPY_ALLOWED 让撤销跨盘移动也能工作。
        if (MoveFileExW(LongPath(from).c_str(), LongPath(to).c_str(),
                        MOVEFILE_WRITE_THROUGH | MOVEFILE_COPY_ALLOWED)) {
            ++out.okCount;
        } else {
            ++out.failCount;
            out.errors.push_back(from + L" -> " + to + L" (错误码 " +
                                 std::to_wstring(GetLastError()) + L")");
        }
    }
    return out;
}

}  // namespace ts
