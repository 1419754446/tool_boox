#pragma once

#include <windows.h>

#include <atomic>
#include <cstdint>
#include <functional>
#include <string>
#include <vector>

namespace ts {

struct ScanProgress {
    uint64_t files = 0;
    uint64_t dirs = 0;
    uint64_t bytes = 0;
    uint64_t matched = 0;
    uint64_t skipped = 0;
    std::wstring current;
};

struct FileItem {
    std::wstring path;
    std::wstring name;
    std::wstring ext;
    uint64_t size = 0;
    int64_t mtimeMs = 0;
};

struct LargeScanOptions {
    std::wstring root;                 // 单根（旧调用方还在用）
    std::vector<std::wstring> roots;    // 多根优先；roots 与 root 都空 = 全部本地磁盘
    uint64_t minSize = 100ull * 1024ull * 1024ull;
    bool includeHidden = false;
    size_t maxResults = 1000;
};

struct LargeScanResult {
    std::vector<FileItem> items;
    ScanProgress stats;
    uint64_t totalMatched = 0;
    double elapsedMs = 0.0;
    bool cancelled = false;
    std::wstring error;
};

struct EmptyFolderResult {
    std::vector<std::wstring> folders;
    ScanProgress stats;
    double elapsedMs = 0.0;
    bool cancelled = false;
    std::wstring error;
};

LargeScanResult ScanLargeFiles(const LargeScanOptions& options,
                               const std::atomic<bool>& cancel,
                               const std::function<void(const ScanProgress&)>& progress);

// 一次扫多个根（一块盘或一个目录都行）；传空数组 = 扫全部本地磁盘。
EmptyFolderResult ScanEmptyFolders(const std::vector<std::wstring>& roots,
                                   const std::atomic<bool>& cancel,
                                   const std::function<void(const ScanProgress&)>& progress);

struct SearchOptions {
    std::wstring root;
    std::wstring patterns;          // 分号分隔；无通配符时按子串匹配
    uint64_t minSize = 0;
    uint64_t maxSize = 0;           // 0 = 不限
    int64_t modifiedWithinMs = 0;   // 0 = 不限
    bool includeHidden = false;
    bool recursive = true;
    size_t maxResults = 5000;
};

struct SearchResult {
    std::vector<FileItem> items;
    ScanProgress stats;
    uint64_t totalMatched = 0;
    double elapsedMs = 0.0;
    bool cancelled = false;
    std::wstring error;
};

SearchResult SearchFiles(const SearchOptions& options, const std::atomic<bool>& cancel,
                         const std::function<void(const ScanProgress&)>& progress);

struct DiffEntry {
    std::wstring relPath;  // 相对根目录的路径
    std::wstring name;
    bool isDir = false;
    uint64_t sizeA = 0;
    uint64_t sizeB = 0;
    int64_t mtimeA = 0;
    int64_t mtimeB = 0;
};

struct FolderDiffResult {
    std::vector<DiffEntry> onlyA;
    std::vector<DiffEntry> onlyB;
    std::vector<DiffEntry> different;
    ScanProgress stats;
    double elapsedMs = 0.0;
    bool cancelled = false;
    std::wstring error;
};

FolderDiffResult CompareFolders(const std::wstring& rootA, const std::wstring& rootB,
                                const std::atomic<bool>& cancel,
                                const std::function<void(const ScanProgress&)>& progress,
                                bool compareContent = false);

struct CopyOutcome {
    int okCount = 0;
    int failCount = 0;
    std::vector<std::wstring> errors;
    bool cancelled = false;
};

using CopyProgress = std::function<void(uint64_t copied, uint64_t total,
                                        const std::wstring& current)>;

CopyOutcome CopyFilePairs(const std::vector<std::pair<std::wstring, std::wstring>>& pairs,
                          const std::atomic<bool>& cancel,
                          const CopyProgress& progress = {});

CopyOutcome RenameFilePairs(const std::vector<std::pair<std::wstring, std::wstring>>& pairs,
                            const std::atomic<bool>& cancel);

}  // namespace ts
