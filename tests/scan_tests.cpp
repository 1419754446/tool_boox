// 扫描逻辑的回归测试：不依赖 GUI 和 WebView2，只验证"扫得对不对"。
//
// 上一轮全盘扫描假死（每个目录都强发一次进度，把 WebView2 消息队列灌满）
// 就是靠手动开 CDP 才发现、才验证的。把核心行为固化成断言后，这类改动
// 改坏了能在一秒内发现，不必再起界面手点。
//
// 造一棵临时目录树，断言三件事：
//   1) 空目录识别（含"只由空目录组成的父目录"，且根目录本身不报）
//   2) 大文件筛选（minSize 生效、结果按体积倒序、totalMatched 正确）
//   3) 重复文件归组（同大小同内容归一组、同大小不同内容不归组、可释放字节正确）
#include "../src/scanner.h"
#include "../src/tasks.h"

#include <windows.h>

#include <atomic>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

namespace fs = std::filesystem;

namespace {

int g_failures = 0;

void Check(bool ok, const std::string& what) {
    std::cout << (ok ? "[PASS] " : "[FAIL] ") << what << "\n";
    if (!ok) ++g_failures;
}

// 用重复片段凑出指定长度的确定性内容：两次同样参数必然得到同样的字节，
// 这样"同内容"和"同大小不同内容"都能精确构造，不依赖随机数。
std::string Blob(const std::string& seed, size_t bytes) {
    std::string out;
    out.reserve(bytes + seed.size());
    while (out.size() < bytes) out += seed;
    out.resize(bytes);
    return out;
}

void WriteFile(const fs::path& path, const std::string& content) {
    std::ofstream out(path, std::ios::binary);
    out.write(content.data(), static_cast<std::streamsize>(content.size()));
}

size_t CountByFilename(const std::vector<std::wstring>& paths, const std::wstring& name) {
    size_t n = 0;
    for (const auto& p : paths) {
        if (fs::path(p).filename() == name) ++n;
    }
    return n;
}

}  // namespace

int wmain() {
    const fs::path base = fs::temp_directory_path() /
                          ("toolbox-scan-tests-" + std::to_string(GetCurrentProcessId()));
    fs::remove_all(base);

    fs::create_directories(base / "empty-a");
    fs::create_directories(base / "empty-b" / "empty-c");
    fs::create_directories(base / "data");
    fs::create_directories(base / "dup");

    WriteFile(base / "data" / "keep.txt", "x");
    WriteFile(base / "data" / "small.bin", Blob("SMALL-", 100 * 1024));
    WriteFile(base / "data" / "big.bin", Blob("BIG-", 2 * 1024 * 1024));
    WriteFile(base / "dup" / "a.dat", Blob("SAME-", 200 * 1024));
    WriteFile(base / "dup" / "b.dat", Blob("SAME-", 200 * 1024));
    WriteFile(base / "dup" / "c.dat", Blob("DIFF-", 200 * 1024));

    std::atomic<bool> cancel{false};
    auto silent = [](const ts::ScanProgress&) {};

    // ---- 1. 空目录 ----
    auto empty = ts::ScanEmptyFolders({base.wstring()}, cancel, silent);
    Check(empty.error.empty(), "empty scan reports no error");
    Check(empty.folders.size() == 3,
          "empty scan finds 3 folders, got " + std::to_string(empty.folders.size()));
    Check(CountByFilename(empty.folders, L"empty-a") == 1, "empty-a listed");
    Check(CountByFilename(empty.folders, L"empty-b") == 1, "empty-b listed");
    Check(CountByFilename(empty.folders, L"empty-c") == 1, "empty-c listed");
    Check(CountByFilename(empty.folders, L"data") == 0, "folder with files is not empty");
    Check(CountByFilename(empty.folders, L"dup") == 0, "duplicate folder is not empty");

    // ---- 2. 大文件 ----
    ts::LargeScanOptions opts;
    opts.roots = {base.wstring()};
    opts.minSize = 1024 * 1024;
    auto large = ts::ScanLargeFiles(opts, cancel, silent);
    Check(large.error.empty(), "large scan reports no error");
    Check(large.items.size() == 1,
          "minSize=1MB keeps only one file, got " + std::to_string(large.items.size()));
    Check(large.totalMatched == 1, "totalMatched counts all matches, not just shown ones");
    if (!large.items.empty()) {
        Check(large.items[0].name == L"big.bin", "kept file is big.bin");
        Check(large.items[0].size == 2ull * 1024 * 1024, "big.bin size is 2MB");
    }

    opts.minSize = 64 * 1024;
    auto large2 = ts::ScanLargeFiles(opts, cancel, silent);
    Check(large2.items.size() == 5,
          "minSize=64KB keeps 5 files, got " + std::to_string(large2.items.size()));
    if (large2.items.size() == 5) {
        Check(large2.items[0].name == L"big.bin", "results sorted by size descending");
    }

    // ---- 3. 重复文件 ----
    auto dup = ts::FindDuplicates({base.wstring()}, 1024, cancel, silent);
    Check(dup.error.empty(), "duplicate scan reports no error");
    Check(dup.groups.size() == 1,
          "one duplicate group, got " + std::to_string(dup.groups.size()));
    if (dup.groups.size() == 1) {
        const auto& group = dup.groups[0];
        Check(group.files.size() == 2,
              "group holds two copies, got " + std::to_string(group.files.size()));
        Check(group.size == 200ull * 1024, "group size is 200KB");
        // 同大小不同内容的 c.dat 不能被归进这一组。
        bool hasC = false;
        for (const auto& f : group.files) {
            if (f.name == L"c.dat") hasC = true;
        }
        Check(!hasC, "same-size different-content file is not grouped");
    }
    Check(dup.duplicateBytes == 200ull * 1024, "reclaimable bytes equals one copy");

    fs::remove_all(base);

    if (g_failures == 0) {
        std::cout << "ALL PASSED\n";
        return 0;
    }
    std::cout << g_failures << " CHECK(S) FAILED\n";
    return 1;
}
