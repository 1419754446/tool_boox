#include "tasks.h"

#include "tools/drives.h"

#include <bcrypt.h>
#include <restartmanager.h>
#include <shlobj.h>

#include <algorithm>
#include <chrono>
#include <cwctype>
#include <filesystem>
#include <map>
#include <set>
#include <vector>

namespace ts {
namespace {

using ProgressFn = std::function<void(const ScanProgress&)>;

struct FoundFile {
    std::wstring path;
    std::wstring name;
    uint64_t size = 0;
    int64_t mtimeMs = 0;
};


std::wstring LongPath(const std::wstring& path) {
    if (path.rfind(L"\\\\?\\", 0) == 0) return path;
    if (path.rfind(L"\\\\", 0) == 0) return L"\\\\?\\UNC\\" + path.substr(2);
    return L"\\\\?\\" + path;
}

std::wstring JoinPath(const std::wstring& directory, const std::wstring& name) {
    std::wstring result = directory;
    if (!result.empty() && result.back() != L'\\' && result.back() != L'/') result.push_back(L'\\');
    result += name;
    return result;
}

std::wstring TrimTrailingSlash(std::wstring path) {
    if (path.rfind(L"\\\\?\\", 0) == 0) return path;
    while (path.size() > 3 && (path.back() == L'\\' || path.back() == L'/')) path.pop_back();
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

HANDLE FindFirstCompat(const std::wstring& pattern, WIN32_FIND_DATAW& data) {
    HANDLE handle = FindFirstFileExW(pattern.c_str(), FindExInfoBasic, &data,
                                     FindExSearchNameMatch, nullptr,
                                     FIND_FIRST_EX_LARGE_FETCH);
    if (handle == INVALID_HANDLE_VALUE) {
        handle = FindFirstFileW(pattern.c_str(), &data);
    }
    return handle;
}

void Tick(const ProgressFn& progress, const ScanProgress& stats, ULONGLONG& last,
          bool force = false) {
    if (!progress) return;
    ULONGLONG now = GetTickCount64();
    if (force || now - last >= 120) {
        last = now;
        progress(stats);
    }
}

// Walks files; progress is throttled by the caller's callback.
bool WalkFiles(const std::wstring& root, bool recursive, bool includeHidden,
               const std::atomic<bool>& cancel, ScanProgress& stats,
               const ProgressFn& progress, ULONGLONG& last,
               const std::function<bool(const FoundFile&)>& visit) {
    std::vector<std::wstring> stack{root};
    ++stats.dirs;

    while (!stack.empty()) {
        if (cancel.load(std::memory_order_relaxed)) return false;

        std::wstring directory = std::move(stack.back());
        stack.pop_back();

        WIN32_FIND_DATAW data{};
        HANDLE handle = FindFirstCompat(LongPath(directory) + L"\\*", data);
        if (handle == INVALID_HANDLE_VALUE) {
            ++stats.skipped;
            continue;
        }

        do {
            if (cancel.load(std::memory_order_relaxed)) {
                FindClose(handle);
                return false;
            }
            if (wcscmp(data.cFileName, L".") == 0 || wcscmp(data.cFileName, L"..") == 0) continue;

            std::wstring path = JoinPath(directory, data.cFileName);
            if (data.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) {
                ++stats.skipped;
                continue;
            }
            if (!includeHidden &&
                (data.dwFileAttributes & (FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_SYSTEM))) {
                ++stats.skipped;
                continue;
            }

            if (data.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
                ++stats.dirs;
                if (recursive) stack.push_back(path);
                continue;
            }

            ULARGE_INTEGER size{};
            size.LowPart = data.nFileSizeLow;
            size.HighPart = data.nFileSizeHigh;
            ++stats.files;
            stats.bytes += size.QuadPart;
            stats.current = path;
            Tick(progress, stats, last);

            FoundFile file;
            file.path = path;
            file.name = data.cFileName;
            file.size = size.QuadPart;
            file.mtimeMs = FileTimeToUnixMs(data.ftLastWriteTime);
            if (!visit(file)) {
                FindClose(handle);
                return false;
            }
        } while (FindNextFileW(handle, &data));

        FindClose(handle);
    }

    Tick(progress, stats, last, true);
    return true;
}

bool HashFile(const std::wstring& path, uint64_t maxBytes, std::vector<BYTE>& digest,
              std::wstring& error, const std::atomic<bool>* cancel) {
    BCRYPT_ALG_HANDLE algorithm = nullptr;
    BCRYPT_HASH_HANDLE hash = nullptr;
    HANDLE file = INVALID_HANDLE_VALUE;
    bool ok = false;

    do {
        if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) < 0) {
            error = L"无法初始化哈希算法";
            break;
        }

        DWORD objectLength = 0;
        DWORD resultLength = 0;
        if (BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH,
                              reinterpret_cast<PUCHAR>(&objectLength), sizeof(objectLength),
                              &resultLength, 0) < 0) {
            error = L"无法读取哈希参数";
            break;
        }
        DWORD hashLength = 0;
        if (BCryptGetProperty(algorithm, BCRYPT_HASH_LENGTH,
                              reinterpret_cast<PUCHAR>(&hashLength), sizeof(hashLength),
                              &resultLength, 0) < 0) {
            error = L"无法读取哈希长度";
            break;
        }

        std::vector<BYTE> object(objectLength);
        if (BCryptCreateHash(algorithm, &hash, object.data(), objectLength,
                             nullptr, 0, 0) < 0) {
            error = L"无法创建哈希对象";
            break;
        }

        file = CreateFileW(LongPath(path).c_str(), GENERIC_READ,
                           FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                           nullptr, OPEN_EXISTING, FILE_FLAG_SEQUENTIAL_SCAN, nullptr);
        if (file == INVALID_HANDLE_VALUE) {
            error = L"无法读取文件（可能被占用或没有权限）";
            break;
        }

        std::vector<BYTE> buffer(1024 * 1024);
        uint64_t remaining = maxBytes;
        while (true) {
            if (cancel && cancel->load(std::memory_order_relaxed)) {
                error = L"已取消";
                break;
            }
            DWORD toRead = static_cast<DWORD>(buffer.size());
            if (maxBytes != 0) {
                if (remaining == 0) break;
                toRead = static_cast<DWORD>(std::min<uint64_t>(remaining, buffer.size()));
            }
            DWORD read = 0;
            if (!ReadFile(file, buffer.data(), toRead, &read, nullptr)) {
                error = L"读取文件失败";
                break;
            }
            if (read == 0) break;
            if (BCryptHashData(hash, buffer.data(), read, 0) < 0) {
                error = L"哈希计算失败";
                break;
            }
            if (maxBytes != 0) remaining -= read;
        }
        if (!error.empty()) break;

        digest.resize(hashLength);
        if (BCryptFinishHash(hash, digest.data(), hashLength, 0) < 0) {
            error = L"哈希计算失败";
            break;
        }
        ok = true;
    } while (false);

    if (file != INVALID_HANDLE_VALUE) CloseHandle(file);
    if (hash) BCryptDestroyHash(hash);
    if (algorithm) BCryptCloseAlgorithmProvider(algorithm, 0);
    if (!ok && error.empty()) error = L"哈希计算失败";
    return ok;
}

std::wstring BytesToHex(const std::vector<BYTE>& bytes) {
    static const wchar_t* hex = L"0123456789abcdef";
    std::wstring text;
    text.reserve(bytes.size() * 2);
    for (BYTE byte : bytes) {
        text.push_back(hex[(byte >> 4) & 0xF]);
        text.push_back(hex[byte & 0xF]);
    }
    return text;
}

struct FileId {
    DWORD volume = 0;
    DWORD high = 0;
    DWORD low = 0;
    bool operator<(const FileId& other) const {
        if (volume != other.volume) return volume < other.volume;
        if (high != other.high) return high < other.high;
        return low < other.low;
    }
};

bool GetFileId(const std::wstring& path, FileId& id) {
    HANDLE file = CreateFileW(LongPath(path).c_str(), FILE_READ_ATTRIBUTES,
                              FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                              nullptr, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, nullptr);
    if (file == INVALID_HANDLE_VALUE) return false;
    BY_HANDLE_FILE_INFORMATION info{};
    BOOL ok = GetFileInformationByHandle(file, &info);
    CloseHandle(file);
    if (!ok) return false;
    id = {info.dwVolumeSerialNumber, info.nFileIndexHigh, info.nFileIndexLow};
    return true;
}

uint64_t DirectorySize(const std::wstring& root, const std::atomic<bool>& cancel,
                       ScanProgress& stats, const ProgressFn& progress,
                       ULONGLONG& last) {
    uint64_t total = 0;
    std::vector<std::wstring> stack{root};
    while (!stack.empty()) {
        if (cancel.load(std::memory_order_relaxed)) break;
        std::wstring directory = std::move(stack.back());
        stack.pop_back();
        ++stats.dirs;

        WIN32_FIND_DATAW data{};
        HANDLE handle = FindFirstCompat(LongPath(directory) + L"\\*", data);
        if (handle == INVALID_HANDLE_VALUE) {
            ++stats.skipped;
            continue;
        }

        do {
            if (cancel.load(std::memory_order_relaxed)) break;
            if (wcscmp(data.cFileName, L".") == 0 || wcscmp(data.cFileName, L"..") == 0) continue;
            std::wstring path = JoinPath(directory, data.cFileName);
            if (data.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) {
                ++stats.skipped;
                continue;
            }
            if (data.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
                stack.push_back(path);
            } else {
                ULARGE_INTEGER size{};
                size.LowPart = data.nFileSizeLow;
                size.HighPart = data.nFileSizeHigh;
                total += size.QuadPart;
                ++stats.files;
                stats.bytes += size.QuadPart;
                stats.current = path;
                Tick(progress, stats, last);
            }
        } while (FindNextFileW(handle, &data));
        FindClose(handle);
    }
    return total;
}

std::wstring KnownFolder(REFKNOWNFOLDERID folder) {
    PWSTR path = nullptr;
    if (SUCCEEDED(SHGetKnownFolderPath(folder, KF_FLAG_CREATE, nullptr, &path))) {
        std::wstring result(path);
        CoTaskMemFree(path);
        return result;
    }
    return {};
}

std::wstring EnvironmentPath(const wchar_t* name) {
    DWORD needed = GetEnvironmentVariableW(name, nullptr, 0);
    if (needed == 0) return {};
    std::wstring value(needed, L'\0');
    DWORD written = GetEnvironmentVariableW(name, value.data(), needed);
    value.resize(written);
    return value;
}

bool HasPrefixNoCase(const std::wstring& value, const std::wstring& prefix) {
    if (value.size() < prefix.size()) return false;
    return _wcsnicmp(value.c_str(), prefix.c_str(), prefix.size()) == 0;
}

}  // namespace

std::wstring Sha256BytesHex(const void* data, size_t size) {
    BCRYPT_ALG_HANDLE algorithm = nullptr;
    BCRYPT_HASH_HANDLE hash = nullptr;
    std::wstring result;
    if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) < 0) {
        return result;
    }

    DWORD objectLength = 0;
    DWORD resultLength = 0;
    if (BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH,
                          reinterpret_cast<PUCHAR>(&objectLength), sizeof(objectLength),
                          &resultLength, 0) < 0) {
        BCryptCloseAlgorithmProvider(algorithm, 0);
        return result;
    }
    std::vector<BYTE> object(objectLength);
    if (BCryptCreateHash(algorithm, &hash, object.data(), objectLength, nullptr, 0, 0) >= 0) {
        if (BCryptHashData(hash, static_cast<PUCHAR>(const_cast<void*>(data)),
                           static_cast<ULONG>(size), 0) >= 0) {
            DWORD hashLength = 0;
            if (BCryptGetProperty(algorithm, BCRYPT_HASH_LENGTH,
                                  reinterpret_cast<PUCHAR>(&hashLength), sizeof(hashLength),
                                  &resultLength, 0) >= 0) {
                std::vector<BYTE> digest(hashLength);
                if (BCryptFinishHash(hash, digest.data(), hashLength, 0) >= 0) {
                    result = BytesToHex(digest);
                }
            }
        }
        BCryptDestroyHash(hash);
    }
    BCryptCloseAlgorithmProvider(algorithm, 0);
    return result;
}

std::wstring Sha256FileHex(const std::wstring& path, std::wstring& error,
                           uint64_t maxBytes, const std::atomic<bool>* cancel) {
    std::vector<BYTE> digest;
    if (!HashFile(path, maxBytes, digest, error, cancel)) return {};
    return BytesToHex(digest);
}

DuplicateResult FindDuplicates(const std::vector<std::wstring>& roots, uint64_t minSize,
                               const std::atomic<bool>& cancel,
                               const std::function<void(const ScanProgress&)>& progress) {
    DuplicateResult result;
    auto started = std::chrono::steady_clock::now();

    std::vector<std::wstring> normalizedRoots;
    std::wstring ignored;
    // 空 roots 表示「全部本地磁盘」（界面上全选所有盘符），和另外两个扫描器保持一致；
    // 不这么处理的话全盘查找会直接报「选中的目录都不可访问」。
    std::vector<std::wstring> rootCandidates = roots;
    if (rootCandidates.empty()) rootCandidates = tb::FixedDriveRoots();
    for (const auto& candidate : rootCandidates) {
        std::wstring normalized;
        if (ValidateRoot(candidate, normalized, ignored)) normalizedRoots.push_back(std::move(normalized));
    }
    if (normalizedRoots.empty()) {
        result.error = rootCandidates.empty() ? L"没有找到可扫描的本地磁盘" : L"选中的目录都不可访问，请重新选择";
        return result;
    }

    std::map<uint64_t, std::vector<DuplicateFile>> bySize;
    uint64_t duplicateFiles = 0;
    ULONGLONG last = 0;
    for (const auto& normalized : normalizedRoots) {
        WalkFiles(normalized, true, false, cancel, result.stats, progress, last,
                  [&](const FoundFile& file) {
                      if (file.size < minSize) return true;
                      ++result.candidateFiles;
                      result.stats.matched = result.candidateFiles;
                      bySize[file.size].push_back({file.path, file.name, file.size, file.mtimeMs});
                      return true;
                  });
        if (cancel.load(std::memory_order_relaxed)) break;
    }

    if (cancel.load(std::memory_order_relaxed)) result.cancelled = true;

    for (auto& [size, candidates] : bySize) {
        if (result.cancelled) break;
        if (candidates.size() < 2) continue;

        std::map<std::wstring, std::vector<DuplicateFile>> byPartial;
        for (const auto& file : candidates) {
            if (cancel.load(std::memory_order_relaxed)) {
                result.cancelled = true;
                break;
            }
            std::wstring error;
            std::wstring partial = Sha256FileHex(file.path, error, 64 * 1024, &cancel);
            if (partial.empty()) {
                ++result.stats.skipped;
                continue;
            }
            result.stats.current = file.path;
            Tick(progress, result.stats, last);
            byPartial[partial].push_back(file);
        }

        for (auto& [partial, sameHead] : byPartial) {
            if (result.cancelled) break;
            if (sameHead.size() < 2) continue;

            std::map<std::wstring, std::vector<DuplicateFile>> byFull;
            for (const auto& file : sameHead) {
                if (cancel.load(std::memory_order_relaxed)) {
                    result.cancelled = true;
                    break;
                }
                std::wstring error;
                std::wstring full = Sha256FileHex(file.path, error, 0, &cancel);
                if (full.empty()) {
                    ++result.stats.skipped;
                    continue;
                }
                result.stats.current = file.path;
                Tick(progress, result.stats, last);
                byFull[full].push_back(file);
            }

            for (auto& [hash, files] : byFull) {
                if (files.size() < 2) continue;
                std::set<FileId> ids;
                std::vector<DuplicateFile> unique;
                for (const auto& file : files) {
                    FileId id;
                    if (GetFileId(file.path, id) && !ids.insert(id).second) continue;
                    unique.push_back(file);
                }
                if (unique.size() < 2) continue;

                std::sort(unique.begin(), unique.end(), [](const DuplicateFile& a, const DuplicateFile& b) {
                    return a.path < b.path;
                });
                DuplicateGroup group;
                group.hash = hash;
                group.size = size;
                group.files = std::move(unique);
                result.duplicateBytes += size * (group.files.size() - 1);
                duplicateFiles += group.files.size();
                result.groups.push_back(std::move(group));
                if (result.groups.size() >= 500) { result.truncated = true; break; }
            }
            if (result.groups.size() >= 500) break;
        }
        if (result.groups.size() >= 500) break;
    }

    result.stats.matched = duplicateFiles;
    std::sort(result.groups.begin(), result.groups.end(), [](const DuplicateGroup& a, const DuplicateGroup& b) {
        return a.size * (a.files.size() - 1) > b.size * (b.files.size() - 1);
    });
    result.elapsedMs = std::chrono::duration<double, std::milli>(
                           std::chrono::steady_clock::now() - started)
                           .count();
    return result;
}

SpaceResult AnalyzeSpace(const std::wstring& root, const std::atomic<bool>& cancel,
                         const std::function<void(const ScanProgress&)>& progress) {
    SpaceResult result;
    auto started = std::chrono::steady_clock::now();

    std::wstring normalized;
    if (!ValidateRoot(root, normalized, result.error)) return result;
    result.root = normalized;

    ULONGLONG last = 0;
    WIN32_FIND_DATAW data{};
    HANDLE handle = FindFirstCompat(LongPath(normalized) + L"\\*", data);
    if (handle == INVALID_HANDLE_VALUE) {
        result.error = L"无法读取该文件夹";
        return result;
    }

    do {
        if (cancel.load(std::memory_order_relaxed)) {
            result.cancelled = true;
            break;
        }
        if (wcscmp(data.cFileName, L".") == 0 || wcscmp(data.cFileName, L"..") == 0) continue;
        std::wstring path = JoinPath(normalized, data.cFileName);
        if (data.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) continue;

        SpaceEntry entry;
        entry.path = path;
        entry.name = data.cFileName;
        if (data.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            entry.isDir = true;
            entry.size = DirectorySize(path, cancel, result.stats, progress, last);
        } else {
            ULARGE_INTEGER size{};
            size.LowPart = data.nFileSizeLow;
            size.HighPart = data.nFileSizeHigh;
            entry.size = size.QuadPart;
            ++result.stats.files;
            result.stats.bytes += entry.size;
        }
        result.total += entry.size;
        result.stats.current = path;
        Tick(progress, result.stats, last);
        result.entries.push_back(std::move(entry));
    } while (FindNextFileW(handle, &data));
    FindClose(handle);

    std::sort(result.entries.begin(), result.entries.end(), [](const SpaceEntry& a, const SpaceEntry& b) {
        return a.size > b.size;
    });
    result.elapsedMs = std::chrono::duration<double, std::milli>(
                           std::chrono::steady_clock::now() - started)
                           .count();
    return result;
}

HashResult HashFolder(const std::wstring& root, bool includeSubdirs,
                      const std::atomic<bool>& cancel,
                      const std::function<void(const ScanProgress&)>& progress) {
    HashResult result;
    auto started = std::chrono::steady_clock::now();

    std::wstring normalized;
    if (!ValidateRoot(root, normalized, result.error)) return result;

    ULONGLONG last = 0;
    WalkFiles(normalized, includeSubdirs, false, cancel, result.stats, progress, last,
              [&](const FoundFile& file) {
                  if (result.items.size() >= 2000) {
                      result.truncated = true;
                      return false;
                  }
                  HashItem item;
                  item.path = file.path;
                  item.name = file.name;
                  item.size = file.size;
                  std::wstring error;
                  item.hash = Sha256FileHex(file.path, error, 0, &cancel);
                  item.ok = !item.hash.empty();
                  item.error = error;
                  result.items.push_back(std::move(item));
                  result.stats.current = file.path;
                  Tick(progress, result.stats, last);
                  return true;
              });

    result.cancelled = cancel.load(std::memory_order_relaxed);
    std::sort(result.items.begin(), result.items.end(), [](const HashItem& a, const HashItem& b) {
        return a.path < b.path;
    });
    result.elapsedMs = std::chrono::duration<double, std::milli>(
                           std::chrono::steady_clock::now() - started)
                           .count();
    return result;
}

TempResult ScanTemp(const std::atomic<bool>& cancel,
                    const std::function<void(const ScanProgress&)>& progress) {
    TempResult result;
    auto started = std::chrono::steady_clock::now();

    struct Rule {
        std::wstring category;
        std::wstring path;
        std::wstring namePrefix;
    };

    const std::wstring temp = EnvironmentPath(L"TEMP");
    const std::wstring local = KnownFolder(FOLDERID_LocalAppData);
    const std::wstring windows = EnvironmentPath(L"WINDIR");

    std::vector<Rule> rules;
    if (!temp.empty()) rules.push_back({L"用户临时文件", temp, L""});
    rules.push_back({L"用户临时文件", JoinPath(local, L"Temp"), L""});
    rules.push_back({L"Chrome 缓存", JoinPath(local, L"Google\\Chrome\\User Data\\Default\\Cache"), L""});
    rules.push_back({L"Chrome 代码缓存", JoinPath(local, L"Google\\Chrome\\User Data\\Default\\Code Cache"), L""});
    rules.push_back({L"Edge 缓存", JoinPath(local, L"Microsoft\\Edge\\User Data\\Default\\Cache"), L""});
    rules.push_back({L"Edge 代码缓存", JoinPath(local, L"Microsoft\\Edge\\User Data\\Default\\Code Cache"), L""});
    rules.push_back({L"缩略图缓存", JoinPath(local, L"Microsoft\\Windows\\Explorer"), L"thumbcache_"});
    rules.push_back({L"缩略图缓存", JoinPath(local, L"Microsoft\\Windows\\Explorer"), L"iconcache_"});
    rules.push_back({L"系统临时文件", JoinPath(windows, L"Temp"), L""});
    rules.push_back({L"更新下载缓存", JoinPath(windows, L"SoftwareDistribution\\Download"), L""});

    std::set<std::wstring> seen;
    std::map<std::wstring, TempCategory> categories;
    const int64_t cutoff = static_cast<int64_t>(
        std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch())
            .count()) - 7ll * 24 * 60 * 60 * 1000;
    ULONGLONG last = 0;

    for (const auto& rule : rules) {
        if (cancel.load(std::memory_order_relaxed)) {
            result.cancelled = true;
            break;
        }
        if (rule.path.empty()) continue;
        std::wstring key = rule.path + L"|" + rule.namePrefix;
        if (!seen.insert(key).second) continue;
        if (GetFileAttributesW(LongPath(rule.path).c_str()) == INVALID_FILE_ATTRIBUTES) continue;

        WalkFiles(rule.path, true, true, cancel, result.stats, progress, last,
                  [&](const FoundFile& file) {
                      if (file.mtimeMs > cutoff) return true;
                      if (!rule.namePrefix.empty() &&
                          !HasPrefixNoCase(file.name, rule.namePrefix)) {
                          return true;
                      }
                      if (result.entries.size() >= 4000) {
                          result.truncated = true;
                          return false;
                      }

                      TempEntry entry;
                      entry.path = file.path;
                      entry.category = rule.category;
                      entry.size = file.size;
                      entry.mtimeMs = file.mtimeMs;
                      result.entries.push_back(entry);
                      result.total += file.size;
                      auto& category = categories[rule.category];
                      category.name = rule.category;
                      category.size += file.size;
                      category.count += 1;
                      result.stats.current = file.path;
                      Tick(progress, result.stats, last);
                      return true;
                  });
    }

    for (auto& [name, category] : categories) result.categories.push_back(category);
    std::sort(result.categories.begin(), result.categories.end(), [](const TempCategory& a, const TempCategory& b) {
        return a.size > b.size;
    });
    std::sort(result.entries.begin(), result.entries.end(), [](const TempEntry& a, const TempEntry& b) {
        return a.size > b.size;
    });
    result.cancelled = result.cancelled || cancel.load(std::memory_order_relaxed);
    result.elapsedMs = std::chrono::duration<double, std::milli>(
                           std::chrono::steady_clock::now() - started)
                           .count();
    return result;
}

std::vector<RenameItem> ApplyRename(const std::vector<std::pair<std::wstring, std::wstring>>& pairs) {
    std::vector<RenameItem> results;
    results.reserve(pairs.size());

    for (const auto& [oldPath, newPath] : pairs) {
        RenameItem item;
        item.oldPath = oldPath;
        item.newPath = newPath;
        if (oldPath.empty() || newPath.empty()) {
            item.error = L"路径为空";
            results.push_back(std::move(item));
            continue;
        }
        if (oldPath == newPath) {
            item.ok = true;
            results.push_back(std::move(item));
            continue;
        }

        std::filesystem::path oldFile(oldPath);
        std::filesystem::path newFile(newPath);
        std::error_code ec;
        if (_wcsicmp(oldFile.parent_path().wstring().c_str(),
                     newFile.parent_path().wstring().c_str()) != 0) {
            item.error = L"只能重命名当前目录内的文件";
            results.push_back(std::move(item));
            continue;
        }
        if (!std::filesystem::exists(oldFile, ec)) {
            item.error = L"原文件不存在";
            results.push_back(std::move(item));
            continue;
        }
        if (std::filesystem::exists(newFile, ec)) {
            item.error = L"目标名称已存在";
            results.push_back(std::move(item));
            continue;
        }
        if (!MoveFileExW(LongPath(oldPath).c_str(), LongPath(newPath).c_str(),
                         MOVEFILE_WRITE_THROUGH)) {
            item.error = L"重命名失败（文件可能被占用）";
            results.push_back(std::move(item));
            continue;
        }
        item.ok = true;
        results.push_back(std::move(item));
    }
    return results;
}

ListResult ListFolder(const std::wstring& root) {
    ListResult result;
    std::wstring normalized;
    if (!ValidateRoot(root, normalized, result.error)) return result;

    WIN32_FIND_DATAW data{};
    HANDLE handle = FindFirstCompat(LongPath(normalized) + L"\\*", data);
    if (handle == INVALID_HANDLE_VALUE) {
        result.error = L"无法读取该文件夹";
        return result;
    }
    do {
        if (wcscmp(data.cFileName, L".") == 0 || wcscmp(data.cFileName, L"..") == 0) continue;
        if (data.dwFileAttributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT)) continue;
        ULARGE_INTEGER size{};
        size.LowPart = data.nFileSizeLow;
        size.HighPart = data.nFileSizeHigh;
        FileEntry entry;
        entry.path = JoinPath(normalized, data.cFileName);
        entry.name = data.cFileName;
        entry.size = size.QuadPart;
        entry.mtimeMs = FileTimeToUnixMs(data.ftLastWriteTime);
        result.files.push_back(std::move(entry));
        if (result.files.size() >= 2000) break;
    } while (FindNextFileW(handle, &data));
    FindClose(handle);

    std::sort(result.files.begin(), result.files.end(), [](const FileEntry& a, const FileEntry& b) {
        return _wcsicmp(a.name.c_str(), b.name.c_str()) < 0;
    });
    return result;
}

namespace {
// Restart Manager 枚举核心：把若干文件/目录资源注册进 RM，汇总占用这些资源的进程。
// RM 对传入的目录会递归枚举其中被占用的文件，故「文件夹/卷全盘排查」可直接整目录上报，
// 无需手动遍历文件。
LockResult CollectLockersFromResources(const std::vector<std::wstring>& resources) {
    LockResult result;
    if (resources.empty()) {
        result.error = L"没有可检查的目标";
        return result;
    }
    DWORD session = 0;
    WCHAR sessionKey[CCH_RM_SESSION_KEY + 1]{};
    DWORD startError = RmStartSession(&session, 0, sessionKey);
    if (startError != ERROR_SUCCESS) {
        result.error =
            L"无法启动 Restart Manager（错误 " + std::to_wstring(startError) +
            L"）。请确认 RmSvc 服务正在运行。";
        return result;
    }
    // 保持字符串稳定，再取指针
    std::vector<std::wstring> owned = resources;
    std::vector<const WCHAR*> rp;
    rp.reserve(owned.size());
    for (const auto& s : owned) rp.push_back(s.c_str());

    DWORD error = RmRegisterResources(session, static_cast<DWORD>(rp.size()), rp.data(),
                                      0, nullptr, 0, nullptr);
    if (error == ERROR_SUCCESS) {
        UINT needed = 0;
        UINT count = 0;
        DWORD rebootReasons = 0;
        error = RmGetList(session, &needed, &count, nullptr, &rebootReasons);
        if (error == ERROR_MORE_DATA || (error == ERROR_SUCCESS && needed > 0)) {
            std::vector<RM_PROCESS_INFO> processes(needed);
            count = needed;
            error = RmGetList(session, &needed, &count, processes.data(), &rebootReasons);
            if (error == ERROR_SUCCESS) {
                std::set<DWORD> pids;
                for (UINT i = 0; i < count; ++i) {
                    DWORD pid = processes[i].Process.dwProcessId;
                    if (!pids.insert(pid).second) continue;
                    LockProcess process;
                    process.pid = pid;
                    process.name = processes[i].strAppName;
                    HANDLE handle =
                        OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
                    if (handle) {
                        WCHAR buffer[1024]{};
                        DWORD length = 1024;
                        if (QueryFullProcessImageNameW(handle, 0, buffer, &length)) {
                            process.path.assign(buffer, length);
                        }
                        CloseHandle(handle);
                    }
                    if (process.name.empty() && !process.path.empty()) {
                        process.name =
                            std::filesystem::path(process.path).filename().wstring();
                    }
                    result.processes.push_back(std::move(process));
                }
            }
        }
    }
    RmEndSession(session);
    if (error != ERROR_SUCCESS && error != ERROR_MORE_DATA) {
        result.error = L"查询占用进程失败";
    }
    return result;
}
}  // namespace

LockResult FindLockers(const std::wstring& path) {
    LockResult result;
    if (path.empty()) {
        result.error = L"请选择一个文件";
        return result;
    }
    if (GetFileAttributesW(LongPath(path).c_str()) == INVALID_FILE_ATTRIBUTES) {
        result.error = L"文件不存在，或没有访问权限";
        return result;
    }
    return CollectLockersFromResources({path});
}

LockResult FindFolderLockers(const std::wstring& path) {
    LockResult result;
    if (path.empty()) {
        result.error = L"请选择一个文件夹";
        return result;
    }
    DWORD attrs = GetFileAttributesW(LongPath(path).c_str());
    if (attrs == INVALID_FILE_ATTRIBUTES || !(attrs & FILE_ATTRIBUTE_DIRECTORY)) {
        result.error = L"文件夹不存在，或所选不是目录";
        return result;
    }
    // 去掉末尾分隔符后整目录交给 RM 递归枚举
    std::wstring dir = path;
    while (dir.size() > 1 && (dir.back() == L'\\' || dir.back() == L'/')) {
        dir.pop_back();
    }
    return CollectLockersFromResources({dir});
}

LockResult FindVolumeLockers(const std::wstring& rootPath) {
    LockResult result;
    if (rootPath.size() < 2 || rootPath[1] != L':') {
        result.error = L"不是有效的盘符";
        return result;
    }
    // 卷根目录整体交给 RM 递归枚举其上被占用文件
    std::wstring root = rootPath;
    while (root.size() > 0 && (root.back() == L'\\' || root.back() == L'/')) {
        root.pop_back();
    }
    if (root.empty()) root = rootPath;
    return CollectLockersFromResources({root});
}

bool TerminateProcessById(uint32_t pid, std::wstring& error) {
    if (pid == 0) {
        error = L"无效的进程 ID";
        return false;
    }
    HANDLE process = OpenProcess(PROCESS_TERMINATE, FALSE, pid);
    if (!process) {
        error = L"没有权限结束该进程（可能需要管理员）";
        return false;
    }
    BOOL ok = TerminateProcess(process, 1);
    CloseHandle(process);
    if (!ok) {
        error = L"结束进程失败";
        return false;
    }
    return true;
}

}  // namespace ts
