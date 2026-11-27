#pragma once

#include <windows.h>

#include <atomic>
#include <cstdint>
#include <functional>
#include <string>
#include <utility>
#include <vector>

#include "scanner.h"

namespace ts {

struct DuplicateFile {
    std::wstring path;
    std::wstring name;
    uint64_t size = 0;
    int64_t mtimeMs = 0;
};

struct DuplicateGroup {
    std::wstring hash;
    uint64_t size = 0;
    std::vector<DuplicateFile> files;
};

struct DuplicateResult {
    std::vector<DuplicateGroup> groups;
    ScanProgress stats;
    uint64_t candidateFiles = 0;
    uint64_t duplicateBytes = 0;
    double elapsedMs = 0.0;
    bool cancelled = false;
    bool truncated = false;
    std::wstring error;
};

// 一次可扫多个根（多块盘/多个目录），跨根的重复文件也能归到同一组。
DuplicateResult FindDuplicates(const std::vector<std::wstring>& roots, uint64_t minSize,
                               const std::atomic<bool>& cancel,
                               const std::function<void(const ScanProgress&)>& progress);

struct SpaceEntry {
    std::wstring path;
    std::wstring name;
    bool isDir = false;
    uint64_t size = 0;
};

struct SpaceResult {
    std::wstring root;
    std::vector<SpaceEntry> entries;
    uint64_t total = 0;
    ScanProgress stats;
    double elapsedMs = 0.0;
    bool cancelled = false;
    std::wstring error;
};

SpaceResult AnalyzeSpace(const std::wstring& root, const std::atomic<bool>& cancel,
                         const std::function<void(const ScanProgress&)>& progress);

struct HashItem {
    std::wstring path;
    std::wstring name;
    uint64_t size = 0;
    std::wstring hash;
    bool ok = false;
    std::wstring error;
};

struct HashResult {
    std::vector<HashItem> items;
    ScanProgress stats;
    double elapsedMs = 0.0;
    bool cancelled = false;
    bool truncated = false;
    std::wstring error;
};

HashResult HashFolder(const std::wstring& root, bool includeSubdirs,
                      const std::atomic<bool>& cancel,
                      const std::function<void(const ScanProgress&)>& progress);

struct TempEntry {
    std::wstring path;
    std::wstring category;
    uint64_t size = 0;
    int64_t mtimeMs = 0;
};

struct TempCategory {
    std::wstring name;
    uint64_t size = 0;
    uint64_t count = 0;
};

struct TempResult {
    std::vector<TempEntry> entries;
    std::vector<TempCategory> categories;
    uint64_t total = 0;
    ScanProgress stats;
    double elapsedMs = 0.0;
    bool cancelled = false;
    bool truncated = false;
    std::wstring error;
};

TempResult ScanTemp(const std::atomic<bool>& cancel,
                    const std::function<void(const ScanProgress&)>& progress);

struct RenameItem {
    std::wstring oldPath;
    std::wstring newPath;
    bool ok = false;
    std::wstring error;
};

std::vector<RenameItem> ApplyRename(const std::vector<std::pair<std::wstring, std::wstring>>& pairs);

struct FileEntry {
    std::wstring path;
    std::wstring name;
    uint64_t size = 0;
    int64_t mtimeMs = 0;
};

struct ListResult {
    std::vector<FileEntry> files;
    std::wstring error;
};

ListResult ListFolder(const std::wstring& root);

struct LockProcess {
    uint32_t pid = 0;
    std::wstring name;
    std::wstring path;
};

struct LockResult {
    std::vector<LockProcess> processes;
    std::wstring error;
};

LockResult FindLockers(const std::wstring& path);
// 递归扫描一个文件夹（含子目录），报告占用其中任何文件的进程。
LockResult FindFolderLockers(const std::wstring& path);
// 递归扫描一个卷/盘符的根目录，报告占用该卷上任何文件的进程。
LockResult FindVolumeLockers(const std::wstring& rootPath);
bool TerminateProcessById(uint32_t pid, std::wstring& error);

std::wstring Sha256FileHex(const std::wstring& path, std::wstring& error,
                           uint64_t maxBytes = 0,
                           const std::atomic<bool>* cancel = nullptr);
std::wstring Sha256BytesHex(const void* data, size_t size);

}  // namespace ts
