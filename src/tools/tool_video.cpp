#include "../bridge.h"
#include "../host.h"
#include "../json.h"

#include <windows.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <propsys.h>
#include <propkey.h>
#include <propvarutil.h>
#include <gdiplus.h>

#include <atomic>
#include <algorithm>
#include <cstdint>
#include <cwctype>
#include <filesystem>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include "video/backend.h"
#include "drives.h"

namespace tb {
namespace {

std::shared_ptr<CollectorJob> g_job;

struct UndoOp {
    int id = 0;
    std::wstring source;
    std::wstring target;
    bool moved = false;
};
std::mutex g_undoMutex;
std::vector<UndoOp> g_undoOps;

void RecordOp(int id, const std::wstring& source, const std::wstring& target, bool moved) {
    std::lock_guard<std::mutex> lock(g_undoMutex);
    g_undoOps.push_back(UndoOp{id, source, target, moved});
}

ULONG_PTR g_metaGdiplusToken = 0;
std::once_flag g_metaGdiplusOnce;

void EnsureMetaGdiplus() {
    std::call_once(g_metaGdiplusOnce, [] {
        Gdiplus::GdiplusStartupInput input;
        Gdiplus::GdiplusStartup(&g_metaGdiplusToken, &input, nullptr);
    });
}

bool EncoderClsid(const wchar_t* mime, CLSID* clsid) {
    UINT count = 0;
    UINT bytes = 0;
    if (Gdiplus::GetImageEncodersSize(&count, &bytes) != Gdiplus::Ok || bytes == 0) return false;
    std::vector<BYTE> buffer(bytes);
    auto* codecs = reinterpret_cast<Gdiplus::ImageCodecInfo*>(buffer.data());
    if (Gdiplus::GetImageEncoders(count, bytes, codecs) != Gdiplus::Ok) return false;
    for (UINT i = 0; i < count; ++i) {
        if (wcscmp(codecs[i].MimeType, mime) == 0) {
            *clsid = codecs[i].Clsid;
            return true;
        }
    }
    return false;
}

std::string Base64(const std::vector<uint8_t>& data) {
    static const char kTable[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    out.reserve((data.size() * 4) / 3 + 4);
    size_t i = 0;
    while (i + 3 <= data.size()) {
        const uint32_t value = (static_cast<uint32_t>(data[i]) << 16) |
                               (static_cast<uint32_t>(data[i + 1]) << 8) |
                               static_cast<uint32_t>(data[i + 2]);
        out.push_back(kTable[(value >> 18) & 63]);
        out.push_back(kTable[(value >> 12) & 63]);
        out.push_back(kTable[(value >> 6) & 63]);
        out.push_back(kTable[value & 63]);
        i += 3;
    }
    const size_t rest = data.size() - i;
    if (rest == 1) {
        const uint32_t value = static_cast<uint32_t>(data[i]) << 16;
        out.push_back(kTable[(value >> 18) & 63]);
        out.push_back(kTable[(value >> 12) & 63]);
        out += "==";
    } else if (rest == 2) {
        const uint32_t value = (static_cast<uint32_t>(data[i]) << 16) |
                               (static_cast<uint32_t>(data[i + 1]) << 8);
        out.push_back(kTable[(value >> 18) & 63]);
        out.push_back(kTable[(value >> 12) & 63]);
        out.push_back(kTable[(value >> 6) & 63]);
        out += '=';
    }
    return out;
}

std::string HBitmapToDataUrl(HBITMAP bitmap) {
    if (!bitmap) return {};
    EnsureMetaGdiplus();
    // GDI+ 非线程安全，须持同一把进程级互斥锁，与外壳截图/剪贴板线程串行化。
    std::lock_guard<std::mutex> gdiplusLock(tb::GdiplusSync());
    if (g_metaGdiplusToken == 0) return {};
    std::string dataUrl;
    Gdiplus::Bitmap source(bitmap, nullptr);
    if (source.GetLastStatus() == Gdiplus::Ok) {
        const int boxWidth = 176;
        const int boxHeight = 100;
        Gdiplus::Bitmap canvas(boxWidth, boxHeight, PixelFormat32bppARGB);
        Gdiplus::Graphics graphics(&canvas);
        graphics.Clear(Gdiplus::Color(255, 255, 255));
        graphics.SetInterpolationMode(Gdiplus::InterpolationModeHighQualityBicubic);
        const int srcWidth = static_cast<int>(source.GetWidth());
        const int srcHeight = static_cast<int>(source.GetHeight());
        if (srcWidth > 0 && srcHeight > 0) {
            const double scale = std::min(static_cast<double>(boxWidth) / srcWidth,
                                          static_cast<double>(boxHeight) / srcHeight);
            const int drawWidth = std::max(1, static_cast<int>(srcWidth * scale));
            const int drawHeight = std::max(1, static_cast<int>(srcHeight * scale));
            graphics.DrawImage(&source, (boxWidth - drawWidth) / 2, (boxHeight - drawHeight) / 2,
                               drawWidth, drawHeight);
        }

        CLSID clsid{};
        if (EncoderClsid(L"image/jpeg", &clsid)) {
            IStream* stream = nullptr;
            if (SUCCEEDED(CreateStreamOnHGlobal(nullptr, TRUE, &stream)) && stream) {
                if (canvas.Save(stream, &clsid, nullptr) == Gdiplus::Ok) {
                    HGLOBAL handle = nullptr;
                    if (SUCCEEDED(GetHGlobalFromStream(stream, &handle)) && handle) {
                        const SIZE_T size = GlobalSize(handle);
                        void* memory = GlobalLock(handle);
                        if (memory && size > 0) {
                            std::vector<uint8_t> bytes(static_cast<uint8_t*>(memory),
                                                       static_cast<uint8_t*>(memory) + size);
                            dataUrl = "data:image/jpeg;base64," + Base64(bytes);
                            GlobalUnlock(handle);
                        }
                    }
                }
                stream->Release();
            }
        }
    }
    DeleteObject(bitmap);
    return dataUrl;
}

uint64_t PropUInt64(IShellItem2* item, REFPROPERTYKEY key, uint64_t fallback = 0) {
    PROPVARIANT value;
    PropVariantInit(&value);
    uint64_t result = fallback;
    if (SUCCEEDED(item->GetProperty(key, &value))) {
        if (value.vt == VT_UI8) {
            result = value.uhVal.QuadPart;
        } else if (value.vt == VT_UI4) {
            result = value.ulVal;
        } else if (value.vt == VT_UI2) {
            result = value.uiVal;
        } else if (value.vt == VT_NULL || value.vt == VT_EMPTY) {
            result = fallback;
        } else {
            PROPVARIANT converted;
            PropVariantInit(&converted);
            if (SUCCEEDED(PropVariantChangeType(&converted, value, 0, VT_UI8))) {
                result = converted.uhVal.QuadPart;
            }
            PropVariantClear(&converted);
        }
    }
    PropVariantClear(&value);
    return result;
}

void EmitMeta(int id, const std::wstring& path) {
    IShellItem2* item = nullptr;
    std::string json = "{\"type\":\"video.meta\",\"id\":" + std::to_string(id);
    const HRESULT hr = SHCreateItemFromParsingName(path.c_str(), nullptr, IID_PPV_ARGS(&item));
    if (FAILED(hr) || !item) {
        json += ",\"error\":1}";
        PostMessage(json);
        return;
    }

    const uint64_t duration = PropUInt64(item, PKEY_Media_Duration, 0);
    uint64_t width = PropUInt64(item, PKEY_Video_FrameWidth, 0);
    uint64_t height = PropUInt64(item, PKEY_Video_FrameHeight, 0);
    if (width == 0 || height == 0) {
        width = PropUInt64(item, PKEY_Image_HorizontalSize, width);
        height = PropUInt64(item, PKEY_Image_VerticalSize, height);
    }

    json += ",\"duration\":" + std::to_string(duration);
    json += ",\"width\":" + std::to_string(width);
    json += ",\"height\":" + std::to_string(height);

    IShellItemImageFactory* factory = nullptr;
    if (SUCCEEDED(item->QueryInterface(IID_PPV_ARGS(&factory))) && factory) {
        SIZE desired{176, 100};
        HBITMAP bitmap = nullptr;
        if (SUCCEEDED(factory->GetImage(desired, SIIGBF_THUMBNAILONLY | SIIGBF_BIGGERSIZEOK,
                                        &bitmap)) &&
            bitmap) {
            const std::string thumb = HBitmapToDataUrl(bitmap);
            if (!thumb.empty()) json += ",\"thumb\":\"" + thumb + "\"";
        }
        factory->Release();
    }
    item->Release();
    json += "}";
    PostMessage(json);
}

const wchar_t* const kDefaultExts[] = {
    L"mp4", L"mkv", L"avi", L"mov", L"wmv", L"flv", L"m4v", L"webm",
    L"mpg", L"mpeg", L"ts", L"m2ts", L"3gp", L"rmvb", L"rm", L"vob",
    L"asf", L"f4v", L"mts", L"divx", L"ogv",
};

bool JobBusy() { return g_job && g_job->Running(); }

// 诊断/枚举盘符的公共实现已挪到 tools/drives.cpp（大文件扫描、重复文件、空文件夹
// 复用同一份，避免三四处各写一遍 GetLogicalDriveStringsW）。
Result ListDrives(const ts::Json&) { return Result::Ok(DrivesJson()); }

// 解析前端传来的盘符数组（"C:"、"D:"）。只接受真实存在、可访问的盘符，
// 防止用户把盘拔掉后旧的选中项还留在配置里导致扫描直接失败。
std::vector<std::wstring> RootsFromArgs(const ts::Json& args) {
    std::vector<std::wstring> roots;
    const ts::Json* list = args.Find("drives");
    if (!list || list->array.empty()) return roots;
    for (const auto& item : list->array) {
        if (item.type != ts::Json::Type::String) continue;
        std::wstring letter = ts::FromUtf8(item.string);
        while (!letter.empty() && (letter.back() == L'\\' || letter.back() == L'/')) letter.pop_back();
        if (letter.size() != 2 || letter[1] != L':') continue;
        letter += L'\\';
        if (GetDriveTypeW(letter.c_str()) == DRIVE_NO_ROOT_DIR) continue;
        if (std::find(roots.begin(), roots.end(), letter) == roots.end()) roots.push_back(letter);
    }
    return roots;
}

std::vector<std::wstring> ExtsFromArgs(const ts::Json& args) {
    std::vector<std::wstring> exts;
    const ts::Json* array = args.Find("exts");
    if (array && !array->array.empty()) {
        for (const auto& item : array->array) {
            if (item.type != ts::Json::Type::String) continue;
            std::wstring ext = ts::FromUtf8(item.string);
            while (!ext.empty() && (ext.front() == L'.' || ext.front() == L' ')) ext.erase(0, 1);
            if (!ext.empty()) exts.push_back(ext);
        }
    }
    if (exts.empty()) {
        for (const auto* ext : kDefaultExts) exts.emplace_back(ext);
    }
    return exts;
}

// 把后台任务的消息统一加上 video. 前缀，避免和外壳其它 type 撞名。
std::string WrapType(std::string json) {
    const size_t pos = json.find("\"type\":\"");
    if (pos == std::string::npos) return json;
    json.insert(pos + 8, "video.");
    return json;
}

CollectorJob::Emit MakeEmit() {
    return [](const std::string& json) { PostMessage(WrapType(json)); };
}

Result StartScan(const ts::Json& args) {
    if (JobBusy()) return Result::Fail("已有扫描或整理任务在进行，请先取消");

    JobOptions options;
    options.scanOnly = true;
    options.recursive = true;

    const bool allDrives = args.GetBool("allDrives", false);
    const std::wstring root = ts::FromUtf8(args.GetString("root"));
    // 勾了全盘扫描又挑了具体磁盘时，只扫挑中的那几块；一块都没挑才退回"所有本地磁盘"。
    std::vector<std::wstring> chosen = RootsFromArgs(args);
    if (!chosen.empty()) {
        options.roots = chosen;
    } else if (root.empty() || allDrives) {
        options.roots = FixedDriveRoots();
        if (options.roots.empty()) return Result::Fail("没有找到可扫描的本地磁盘");
    } else {
        options.roots.push_back(root);
    }

    options.exts = ExtsFromArgs(args);
    const double minMB = args.GetNumber("minMB", 0);
    const double maxMB = args.GetNumber("maxMB", 0);
    if (minMB > 0) options.minBytes = static_cast<uint64_t>(minMB * 1024 * 1024);
    if (maxMB > 0) options.maxBytes = static_cast<uint64_t>(maxMB * 1024 * 1024);
    options.skipHidden = args.GetBool("skipHidden", true);
    options.dedupeScan = args.GetBool("dedupeScan", false);
    options.maxResults = 20000;

    const std::wstring exclude = ts::FromUtf8(args.GetString("exclude", ""));
    size_t begin = 0;
    while (begin < exclude.size()) {
        size_t end = exclude.find_first_of(L",，;； \t", begin);
        if (end == std::wstring::npos) end = exclude.size();
        std::wstring name = exclude.substr(begin, end - begin);
        begin = end + 1;
        if (name.empty()) continue;
        for (wchar_t& c : name) c = static_cast<wchar_t>(towlower(c));
        options.excludeNames.push_back(name);
    }

    const std::string dst = args.GetString("dst", "");
    options.dstPath = ts::FromUtf8(dst);

    g_job = std::make_shared<CollectorJob>(options, MakeEmit(),
                                          [](const ItemInfo&) {},
                                          []() { PostMessage("{\"type\":\"video.finished\"}"); });
    g_job->Start();
    return Result::Ok("{\"started\":true}");
}

Result StartCollect(const ts::Json& args) {
    if (JobBusy()) return Result::Fail("已有扫描或整理任务在进行，请先取消");

    JobOptions options;
    options.move = args.GetBool("move", false);
    options.skipConflict = args.GetBool("skipConflict", true);
    options.dedupe = args.GetBool("dedupe", true);
    options.dst = ts::FromUtf8(args.GetString("dst"));
    if (options.dst.empty()) return Result::Fail("先选一个目标文件夹");
    if (!DirExists(options.dst)) return Result::Fail("目标文件夹不存在");

    const ts::Json* files = args.Find("files");
    if (!files || files->array.empty()) return Result::Fail("没有选中任何视频");
    for (const auto& item : files->array) {
        if (item.type != ts::Json::Type::Object) continue;
        const std::string path = item.GetString("path");
        if (path.empty()) continue;
        const int id = static_cast<int>(item.GetNumber("id", 0));
        options.fileList.emplace_back(id, ts::FromUtf8(path));
    }
    if (options.fileList.empty()) return Result::Fail("没有选中任何视频");

    {
        std::lock_guard<std::mutex> lock(g_undoMutex);
        g_undoOps.clear();
    }
    const bool moved = options.move;
    g_job = std::make_shared<CollectorJob>(
        options, MakeEmit(),
        [moved](const ItemInfo& item) {
            if (!item.targetCreated || item.target.empty()) return;
            RecordOp(item.id, item.srcPath, item.target, moved);
        },
        []() { PostMessage("{\"type\":\"video.finished\"}"); });
    g_job->Start();
    return Result::Ok("{\"started\":true}");
}

bool RecycleOne(const std::wstring& path) {
    std::wstring from = path;
    from.push_back(L'\0');
    SHFILEOPSTRUCTW op{};
    op.hwnd = nullptr;
    op.wFunc = FO_DELETE;
    op.pFrom = from.c_str();
    op.fFlags = FOF_ALLOWUNDO | FOF_SILENT | FOF_NOCONFIRMATION | FOF_NOERRORUI;
    return SHFileOperationW(&op) == 0 && !op.fAnyOperationsAborted;
}

std::string UndoStatusJson(int id, const wchar_t* status) {
    return std::string("{\"type\":\"video.status\",\"id\":") + std::to_string(id) +
           ",\"status\":\"" + ts::JsonEscape(ts::ToUtf8(status)) + "\"}";
}

Result UndoLast() {
    if (JobBusy()) return Result::Fail("任务进行中，暂不能撤销");
    std::vector<UndoOp> ops;
    {
        std::lock_guard<std::mutex> lock(g_undoMutex);
        ops.swap(g_undoOps);
    }
    if (ops.empty()) return Result::Fail("没有可撤销的整理记录");
    const size_t count = ops.size();

    std::thread([ops = std::move(ops)]() {
        int restored = 0;
        int removed = 0;
        int failed = 0;
        for (const UndoOp& op : ops) {
            if (op.moved) {
                if (GetFileAttributesW(op.target.c_str()) == INVALID_FILE_ATTRIBUTES) {
                    ++failed;
                    PostMessage(UndoStatusJson(op.id, L"撤销失败：目标已不存在"));
                    continue;
                }
                if (GetFileAttributesW(op.source.c_str()) != INVALID_FILE_ATTRIBUTES) {
                    ++failed;
                    PostMessage(UndoStatusJson(op.id, L"撤销失败：原位置已有同名文件"));
                    continue;
                }
                if (MoveFileExW(op.target.c_str(), op.source.c_str(),
                                MOVEFILE_COPY_ALLOWED | MOVEFILE_WRITE_THROUGH)) {
                    ++restored;
                    PostMessage(UndoStatusJson(op.id, L"已撤销（移回原位）"));
                } else {
                    ++failed;
                    PostMessage(UndoStatusJson(op.id, L"撤销失败：无法移回原位"));
                }
            } else {
                if (GetFileAttributesW(op.target.c_str()) == INVALID_FILE_ATTRIBUTES) {
                    continue;
                }
                if (RecycleOne(op.target)) {
                    ++removed;
                    PostMessage(UndoStatusJson(op.id, L"已撤销（删除副本）"));
                } else {
                    ++failed;
                    PostMessage(UndoStatusJson(op.id, L"撤销失败：无法删除副本"));
                }
            }
        }
        std::string done = "{\"type\":\"video.undo_done\",\"stats\":{\"restored\":" +
                           std::to_string(restored) + ",\"removed\":" + std::to_string(removed) +
                           ",\"failed\":" + std::to_string(failed) + "}}";
        PostMessage(done);
        PostMessage("{\"type\":\"video.finished\"}");
    }).detach();
    return Result::Ok("{\"started\":true,\"count\":" + std::to_string(count) + "}");
}

Result FetchMeta(const ts::Json& args) {
    const ts::Json* files = args.Find("files");
    if (!files || files->array.empty()) return Result::Fail("没有要读取的视频");

    std::vector<std::pair<int, std::wstring>> list;
    for (const auto& item : files->array) {
        if (item.type != ts::Json::Type::Object) continue;
        const std::string path = item.GetString("path");
        if (path.empty()) continue;
        const int id = static_cast<int>(item.GetNumber("id", 0));
        list.emplace_back(id, ts::FromUtf8(path));
        if (list.size() >= 32) break;
    }
    if (list.empty()) return Result::Fail("没有要读取的视频");

    const int queued = static_cast<int>(list.size());
    std::thread([list = std::move(list)]() {
        CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
        for (const auto& [id, path] : list) EmitMeta(id, path);
        CoUninitialize();
    }).detach();

    return Result::Ok("{\"queued\":" + std::to_string(queued) + "}");
}

std::string UrlEncodeFileName(const std::wstring& name) {
    const std::string utf8 = ts::ToUtf8(name);
    static const char kHex[] = "0123456789ABCDEF";
    std::string out;
    for (unsigned char c : utf8) {
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') ||
            c == '-' || c == '_' || c == '.' || c == '~') {
            out.push_back(static_cast<char>(c));
        } else {
            out.push_back('%');
            out.push_back(kHex[(c >> 4) & 15]);
            out.push_back(kHex[c & 15]);
        }
    }
    return out;
}

// 为内嵌播放器准备一个 https://media.local/<文件名> 地址。
Result PreviewVideo(const ts::Json& args) {
    const std::wstring path = ts::FromUtf8(args.GetString("path"));
    if (path.empty()) return Result::Fail("路径为空");
    if (GetFileAttributesW(path.c_str()) == INVALID_FILE_ATTRIBUTES) {
        return Result::Fail("文件不存在或已移动");
    }
    std::filesystem::path fsPath(path);
    const std::wstring folder = fsPath.parent_path().wstring();
    const std::wstring name = fsPath.filename().wstring();
    if (!tb::MapMediaFolder(folder)) return Result::Fail("内置播放器初始化失败");

    const std::string url = "https://media.local/" + UrlEncodeFileName(name);
    std::string json = "{\"url\":\"" + ts::JsonEscape(url) + "\"";
    json += ",\"name\":\"" + ts::JsonEscape(ts::ToUtf8(name)) + "\"";
    json += ",\"dir\":\"" + ts::JsonEscape(ts::ToUtf8(folder)) + "\"";
    std::error_code sizeError;
    const auto fileSize = std::filesystem::file_size(path, sizeError);
    json += ",\"size\":" +
            std::to_string(sizeError ? 0ull : static_cast<unsigned long long>(fileSize)) + "}";
    return Result::Ok(json);
}

Result OpenOrReveal(const ts::Json& args, bool reveal) {    std::wstring path = ts::FromUtf8(args.GetString("path"));
    if (path.empty()) return Result::Fail("路径为空");
    if (reveal) {
        const std::wstring command = L"/select,\"" + path + L"\"";
        ShellExecuteW(nullptr, L"open", L"explorer.exe", command.c_str(), nullptr, SW_SHOWNORMAL);
    } else {
        if (GetFileAttributesW(path.c_str()) == INVALID_FILE_ATTRIBUTES) {
            return Result::Fail("文件不存在或已移动");
        }
        ShellExecuteW(nullptr, L"open", path.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
    }
    return Result::Ok("{\"ok\":true}");
}

}  // namespace

void RegisterVideoCommands() {
    Bridge& bridge = Bridge::Get();

    bridge.Add("video.scan", [](const ts::Json& args) { return StartScan(args); });
    bridge.Add("video.drives", [](const ts::Json& args) { return ListDrives(args); });
    bridge.Add("video.start", [](const ts::Json& args) { return StartCollect(args); });
    bridge.Add("video.cancel", [](const ts::Json&) {
        if (!g_job || !g_job->Running()) return Result::Ok("{\"running\":false}");
        g_job->Cancel();
        return Result::Ok("{\"cancelling\":true}");
    });
    bridge.Add("video.open", [](const ts::Json& args) { return OpenOrReveal(args, false); });
    bridge.Add("video.reveal", [](const ts::Json& args) { return OpenOrReveal(args, true); });
    bridge.Add("video.meta", [](const ts::Json& args) { return FetchMeta(args); });
    bridge.Add("video.preview", [](const ts::Json& args) { return PreviewVideo(args); });
    bridge.Add("video.undo", [](const ts::Json&) { return UndoLast(); });
}

}  // namespace tb
