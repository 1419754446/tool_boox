// 常用文件夹：folders.txt 清单的读取、增删改、排序，以及打开目录/选目录。
// 清单格式与旧版 常用文件夹.exe 完全兼容：一行一条 "路径 | 备注"，# 或 ; 开头为注释。
#include "tools/tool_folders.h"

#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shlwapi.h>

#include <algorithm>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

#include "../bridge.h"
#include "../host.h"
#include "../json.h"

namespace tb {
namespace {

struct Entry {
    std::wstring path;   // 原始写法，可能含 %USERPROFILE%
    std::wstring note;
    int raw = 0;         // 在 rawLines 中的下标
};

struct Manifest {
    std::vector<std::wstring> rawLines;
    std::vector<Entry> entries;
};

std::wstring FoldersFile() { return DataDir() + L"\\folders.txt"; }
std::wstring BackupFile() { return DataDir() + L"\\folders.bak.txt"; }

std::wstring Trim(const std::wstring& value) {
    const size_t begin = value.find_first_not_of(L" \t\r\n");
    if (begin == std::wstring::npos) return L"";
    const size_t end = value.find_last_not_of(L" \t\r\n");
    return value.substr(begin, end - begin + 1);
}

std::wstring Expand(const std::wstring& text) {
    wchar_t buffer[32768];
    DWORD size = ExpandEnvironmentStringsW(text.c_str(), buffer,
                                           static_cast<DWORD>(std::size(buffer)));
    if (size > 0 && size <= std::size(buffer)) return std::wstring(buffer);
    return text;
}

bool IsDirectory(const std::wstring& path) {
    if (path.empty()) return false;
    const DWORD attr = GetFileAttributesW(path.c_str());
    return attr != INVALID_FILE_ATTRIBUTES && (attr & FILE_ATTRIBUTE_DIRECTORY);
}

std::wstring LeafName(const std::wstring& path) {
    std::wstring clean = path;
    while (!clean.empty() && (clean.back() == L'\\' || clean.back() == L'/')) clean.pop_back();
    const size_t pos = clean.find_last_of(L"\\/");
    std::wstring leaf = pos == std::wstring::npos ? clean : clean.substr(pos + 1);
    return leaf.empty() ? clean : leaf;
}

std::wstring ReadText(const std::wstring& file) {
    std::ifstream in(std::filesystem::path(file), std::ios::binary);
    if (!in) return L"";
    std::string bytes((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
    if (bytes.size() >= 3 && bytes[0] == '\xEF' && bytes[1] == '\xBB' && bytes[2] == '\xBF') {
        bytes.erase(0, 3);
    }
    if (bytes.empty()) return L"";
    int need = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, bytes.c_str(),
                                   static_cast<int>(bytes.size()), nullptr, 0);
    if (need <= 0) {
        need = MultiByteToWideChar(CP_ACP, 0, bytes.c_str(), static_cast<int>(bytes.size()),
                                   nullptr, 0);
        if (need <= 0) return L"";
        std::wstring out(static_cast<size_t>(need), L'\0');
        MultiByteToWideChar(CP_ACP, 0, bytes.c_str(), static_cast<int>(bytes.size()),
                            out.data(), need);
        return out;
    }
    std::wstring out(static_cast<size_t>(need), L'\0');
    MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, bytes.c_str(),
                        static_cast<int>(bytes.size()), out.data(), need);
    return out;
}

// 统一写 UTF-8 with BOM，和旧版行为一致（记事本打开不乱码）。
bool WriteText(const std::wstring& file, const std::vector<std::wstring>& lines) {
    std::wstring joined;
    for (const auto& line : lines) {
        joined += line;
        joined += L"\r\n";
    }
    const int need = WideCharToMultiByte(CP_UTF8, 0, joined.c_str(),
                                         static_cast<int>(joined.size()), nullptr, 0, nullptr,
                                         nullptr);
    if (need <= 0) return false;
    std::string bytes(static_cast<size_t>(need), '\0');
    WideCharToMultiByte(CP_UTF8, 0, joined.c_str(), static_cast<int>(joined.size()),
                        bytes.data(), need, nullptr, nullptr);

    std::string payload = "\xEF\xBB\xBF";
    payload += bytes;
    std::ofstream out(std::filesystem::path(file), std::ios::binary | std::ios::trunc);
    if (!out) return false;
    out.write(payload.data(), static_cast<std::streamsize>(payload.size()));
    return out.good();
}

void SplitLines(const std::wstring& text, std::vector<std::wstring>& lines) {
    std::wstring current;
    for (wchar_t ch : text) {
        if (ch == L'\n') {
            if (!current.empty() && current.back() == L'\r') current.pop_back();
            lines.push_back(current);
            current.clear();
        } else {
            current += ch;
        }
    }
    if (!current.empty()) lines.push_back(current);
}

bool IsComment(const std::wstring& trimmed) {
    return trimmed.empty() || trimmed[0] == L'#' || trimmed[0] == L';';
}

void Parse(const std::vector<std::wstring>& lines, Manifest& manifest) {
    manifest.rawLines = lines;
    manifest.entries.clear();
    for (size_t i = 0; i < lines.size(); ++i) {
        const std::wstring trimmed = Trim(lines[i]);
        if (IsComment(trimmed)) continue;
        Entry entry;
        entry.raw = static_cast<int>(i);
        const size_t bar = trimmed.find(L'|');
        if (bar == std::wstring::npos) {
            entry.path = Trim(trimmed);
        } else {
            entry.path = Trim(trimmed.substr(0, bar));
            entry.note = Trim(trimmed.substr(bar + 1));
        }
        manifest.entries.push_back(entry);
    }
}

Manifest LoadManifest() {
    std::vector<std::wstring> lines;
    SplitLines(ReadText(FoldersFile()), lines);
    Manifest manifest;
    Parse(lines, manifest);
    return manifest;
}

void Backup() {
    const std::wstring source = FoldersFile();
    const std::wstring target = BackupFile();
    if (!std::filesystem::exists(source)) return;
    std::error_code ec;
    std::filesystem::copy_file(source, target, std::filesystem::copy_options::overwrite_existing, ec);
}

std::wstring EntryLine(const Entry& entry) {
    if (entry.note.empty()) return entry.path;
    return entry.path + L" | " + entry.note;
}

std::string ItemsJson(const Manifest& manifest) {
    std::string json = "{\"file\":\"" + ts::JsonEscape(ts::ToUtf8(FoldersFile())) + "\",\"items\":[";
    for (size_t i = 0; i < manifest.entries.size(); ++i) {
        const Entry& entry = manifest.entries[i];
        const std::wstring expanded = Expand(entry.path);
        const bool exists = IsDirectory(expanded);
        if (i) json += ",";
        json += "{\"path\":\"" + ts::JsonEscape(ts::ToUtf8(entry.path));
        json += "\",\"note\":\"" + ts::JsonEscape(ts::ToUtf8(entry.note));
        json += "\",\"name\":\"" + ts::JsonEscape(ts::ToUtf8(LeafName(expanded)));
        json += "\",\"exists\":" + std::string(exists ? "true" : "false");
        json += "}";
    }
    json += "]}";
    return json;
}

Result SaveAndReport(Manifest& manifest, const std::vector<std::wstring>& newLines) {
    Backup();
    if (!WriteText(FoldersFile(), newLines)) {
        return Result::Fail("清单写入失败，请检查数据目录是否可写");
    }
    return Result::Ok(ItemsJson(LoadManifest()));
}

std::vector<std::wstring> PathsOf(const ts::Json& args) {
    std::vector<std::wstring> paths;
    const ts::Json* array = args.Find("paths");
    if (!array) {
        const std::string single = args.GetString("path");
        if (!single.empty()) paths.push_back(ts::FromUtf8(single));
        return paths;
    }
    for (const auto& item : array->array) {
        if (item.type == ts::Json::Type::String) paths.push_back(ts::FromUtf8(item.string));
    }
    return paths;
}

// 按原始行整理出新的行序列：选中项整块上/下移，注释与空行留在原位。
std::vector<std::wstring> MoveBlock(const Manifest& manifest, const std::vector<std::wstring>& paths,
                                    int delta) {
    std::vector<Entry> entries = manifest.entries;
    std::vector<Entry> moving;
    std::vector<Entry> rest;
    for (const auto& entry : entries) {
        const bool selected =
            std::find(paths.begin(), paths.end(), entry.path) != paths.end();
        (selected ? moving : rest).push_back(entry);
    }
    if (moving.empty()) return manifest.rawLines;

    // 计算落点：块在"去掉选中项后"的顺序里的位置。
    int anchor = static_cast<int>(rest.size());
    for (size_t i = 0; i < rest.size(); ++i) {
        if (paths.size() && rest[i].raw > moving[0].raw) {
            anchor = static_cast<int>(i);
            break;
        }
    }
    anchor = std::min(anchor, static_cast<int>(rest.size()));
    int at = std::clamp(anchor + delta, 0, static_cast<int>(rest.size()));

    std::vector<Entry> ordered;
    ordered.insert(ordered.end(), rest.begin(), rest.begin() + at);
    ordered.insert(ordered.end(), moving.begin(), moving.end());
    ordered.insert(ordered.end(), rest.begin() + at, rest.end());

    std::vector<int> slots;
    for (const auto& entry : manifest.entries) slots.push_back(entry.raw);
    std::sort(slots.begin(), slots.end());

    std::vector<std::wstring> lines = manifest.rawLines;
    for (size_t i = 0; i < ordered.size() && i < slots.size(); ++i) {
        lines[static_cast<size_t>(slots[i])] = EntryLine(ordered[i]);
    }
    return lines;
}

bool PickFolderNative(std::wstring& out) {
    IFileOpenDialog* dialog = nullptr;
    if (FAILED(CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_INPROC_SERVER,
                                IID_IFileOpenDialog, reinterpret_cast<void**>(&dialog))) ||
        !dialog) {
        return false;
    }
    DWORD options = 0;
    dialog->GetOptions(&options);
    dialog->SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
    dialog->SetTitle(L"选择一个文件夹");
    HRESULT hr = dialog->Show(MainWindow());
    bool ok = false;
    if (SUCCEEDED(hr)) {
        IShellItem* item = nullptr;
        if (SUCCEEDED(dialog->GetResult(&item)) && item) {
            LPWSTR path = nullptr;
            if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path)) && path) {
                out = path;
                ok = true;
                CoTaskMemFree(path);
            }
            item->Release();
        }
    }
    dialog->Release();
    return ok;
}

}  // namespace

std::vector<FolderEntry> LoadFolderEntries() {
    std::vector<FolderEntry> entries;
    Manifest manifest = LoadManifest();
    entries.reserve(manifest.entries.size());
    for (const Entry& entry : manifest.entries) {
        const std::wstring expanded = Expand(entry.path);
        FolderEntry item;
        item.path = entry.path;
        item.note = entry.note;
        item.name = LeafName(expanded);
        item.exists = IsDirectory(expanded);
        entries.push_back(std::move(item));
    }
    return entries;
}

bool OpenFolderEntry(const std::wstring& path) {
    const std::wstring expanded = Expand(path);
    if (!IsDirectory(expanded)) return false;
    return ShellExecuteW(nullptr, L"open", expanded.c_str(), nullptr, nullptr, SW_SHOWNORMAL) !=
           nullptr;
}

void RegisterFolderCommands() {
    Bridge& bridge = Bridge::Get();

    bridge.Add("folders.load", [](const ts::Json&) { return Result::Ok(ItemsJson(LoadManifest())); });

    bridge.Add("folders.pick", [](const ts::Json&) {
        std::wstring picked;
        if (!PickFolderNative(picked)) return Result::Fail("没有选择文件夹");
        return Result::Ok("{\"path\":\"" + ts::JsonEscape(ts::ToUtf8(picked)) + "\"}");
    });

    bridge.Add("folders.add", [](const ts::Json& args) {
        std::wstring path = ts::FromUtf8(args.GetString("path"));
        std::wstring note = ts::FromUtf8(args.GetString("note"));
        path = Trim(path);
        if (path.empty()) return Result::Fail("路径不能为空");

        Manifest manifest = LoadManifest();
        for (const auto& entry : manifest.entries) {
            if (Expand(Trim(entry.path)) == Expand(path)) return Result::Fail("这个文件夹已经在清单里了");
        }
        Entry entry;
        entry.path = path;
        entry.note = note;
        std::vector<std::wstring> lines = manifest.rawLines;
        lines.push_back(EntryLine(entry));
        return SaveAndReport(manifest, lines);
    });

    bridge.Add("folders.update", [](const ts::Json& args) {
        const std::wstring oldPath = ts::FromUtf8(args.GetString("oldPath"));
        std::wstring newPath = Trim(ts::FromUtf8(args.GetString("path")));
        const std::wstring note = ts::FromUtf8(args.GetString("note"));

        Manifest manifest = LoadManifest();
        for (const auto& entry : manifest.entries) {
            if (entry.path != oldPath) continue;
            if (newPath.empty()) newPath = entry.path;
            std::vector<std::wstring> lines = manifest.rawLines;
            Entry updated = entry;
            updated.path = newPath;
            updated.note = note;
            lines[static_cast<size_t>(entry.raw)] = EntryLine(updated);
            return SaveAndReport(manifest, lines);
        }
        return Result::Fail("清单里找不到这一项");
    });

    bridge.Add("folders.remove", [](const ts::Json& args) {
        const std::vector<std::wstring> paths = PathsOf(args);
        if (paths.empty()) return Result::Fail("没有选中要删除的项");

        Manifest manifest = LoadManifest();
        std::vector<std::wstring> lines;
        for (size_t i = 0; i < manifest.rawLines.size(); ++i) {
            bool drop = false;
            for (const auto& entry : manifest.entries) {
                if (entry.raw == static_cast<int>(i) &&
                    std::find(paths.begin(), paths.end(), entry.path) != paths.end()) {
                    drop = true;
                    break;
                }
            }
            if (!drop) lines.push_back(manifest.rawLines[i]);
        }
        return SaveAndReport(manifest, lines);
    });

    bridge.Add("folders.move", [](const ts::Json& args) {
        const std::vector<std::wstring> paths = PathsOf(args);
        if (paths.empty()) return Result::Fail("没有选中要移动的项");
        const int delta = static_cast<int>(args.GetNumber("delta", 1));
        Manifest manifest = LoadManifest();
        return SaveAndReport(manifest, MoveBlock(manifest, paths, delta < 0 ? -1 : 1));
    });

    bridge.Add("folders.open", [](const ts::Json& args) {
        const std::wstring path = Expand(ts::FromUtf8(args.GetString("path")));
        if (!IsDirectory(path)) return Result::Fail("目录不存在或已移动");
        ShellExecuteW(nullptr, L"open", path.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
        return Result::Ok("{\"ok\":true}");
    });

    bridge.Add("folders.reveal", [](const ts::Json& args) {
        std::wstring path = Expand(ts::FromUtf8(args.GetString("path")));
        if (path.empty()) return Result::Fail("路径为空");
        const std::wstring command = L"/select,\"" + path + L"\"";
        ShellExecuteW(nullptr, L"open", L"explorer.exe", command.c_str(), nullptr, SW_SHOWNORMAL);
        return Result::Ok("{\"ok\":true}");
    });

    bridge.Add("file.open", [](const ts::Json& args) {
        const std::wstring path = Expand(ts::FromUtf8(args.GetString("path")));
        if (path.empty()) return Result::Fail("路径为空");
        if (GetFileAttributesW(path.c_str()) == INVALID_FILE_ATTRIBUTES) {
            return Result::Fail("文件不存在或已移动");
        }
        ShellExecuteW(nullptr, L"open", path.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
        return Result::Ok("{\"ok\":true}");
    });

    bridge.Add("file.reveal", [](const ts::Json& args) {
        const std::wstring path = Expand(ts::FromUtf8(args.GetString("path")));
        if (path.empty()) return Result::Fail("路径为空");
        const std::wstring command = L"/select,\"" + path + L"\"";
        ShellExecuteW(nullptr, L"open", L"explorer.exe", command.c_str(), nullptr, SW_SHOWNORMAL);
        return Result::Ok("{\"ok\":true}");
    });

    bridge.Add("folders.copyPath", [](const ts::Json& args) {
        const std::wstring text = ts::FromUtf8(args.GetString("path"));
        if (!OpenClipboard(MainWindow())) return Result::Fail("剪贴板被占用");
        EmptyClipboard();
        const size_t bytes = (text.size() + 1) * sizeof(wchar_t);
        HGLOBAL handle = GlobalAlloc(GMEM_MOVEABLE, bytes);
        if (handle) {
            void* dest = GlobalLock(handle);
            if (dest) {
                std::memcpy(dest, text.c_str(), bytes);
                GlobalUnlock(handle);
                SetClipboardData(CF_UNICODETEXT, handle);
            }
        }
        CloseClipboard();
        return Result::Ok("{\"ok\":true}");
    });
}

}  // namespace tb
