#include "app.h"

#include "bridge.h"
#include "eject.h"
#include "folders_panel.h"
#include "host.h"
#include "media_handler.h"
#include "mini_window.h"

#include <windows.h>
#include <dwmapi.h>
#include <gdiplus.h>
#include <knownfolders.h>
#include <oleauto.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <shobjidl.h>

#include <algorithm>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <cwchar>
#include <exception>
#include <filesystem>
#include <fstream>
#include <memory>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

#include "json.h"

using Microsoft::WRL::ComPtr;

namespace {

std::wstring g_logPath;

// 新工具模块（bridge 那边）能看到的最小宿主信息
HWND g_hostWindow = nullptr;
std::wstring g_hostDataDir;
ts::App* g_hostApp = nullptr;

std::wstring ModulePath() {
    wchar_t buffer[32768]{};
    const DWORD length = GetModuleFileNameW(nullptr, buffer, static_cast<DWORD>(std::size(buffer)));
    if (length == 0) return L"Toolbox.exe";
    return std::wstring(buffer, length);
}

// query 参数编码：只保留 unreserved 字符，中文与反斜杠都会被转成 %XX。
std::wstring UrlEncodeParam(const std::wstring& text) {
    static const wchar_t kHex[] = L"0123456789ABCDEF";
    std::wstring out;
    out.reserve(text.size() * 3);
    for (const auto ch : ts::ToUtf8(text)) {
        const unsigned char byte = static_cast<unsigned char>(ch);
        const bool plain = (byte >= 'A' && byte <= 'Z') || (byte >= 'a' && byte <= 'z') ||
                           (byte >= '0' && byte <= '9') || byte == '-' || byte == '_' ||
                           byte == '.' || byte == '~';
        if (plain) {
            out.push_back(static_cast<wchar_t>(byte));
        } else {
            out.push_back(L'%');
            out.push_back(kHex[byte >> 4]);
            out.push_back(kHex[byte & 0x0F]);
        }
    }
    return out;
}

constexpr wchar_t kRunKey[] = L"Software\\Microsoft\\Windows\\CurrentVersion\\Run";
constexpr wchar_t kRunValue[] = L"Toolbox";

void Log(const std::string& text) {    if (g_logPath.empty()) return;
    std::error_code sizeError;
    const auto logSize = std::filesystem::file_size(g_logPath, sizeError);
    if (!sizeError && logSize > 4ull * 1024 * 1024) {
        std::error_code rotateError;
        const std::wstring oldLog = g_logPath + L".old";
        std::filesystem::remove(oldLog, rotateError);
        std::filesystem::rename(g_logPath, oldLog, rotateError);
    }
    std::ofstream stream(std::filesystem::path(g_logPath), std::ios::app);
    if (!stream) return;
    SYSTEMTIME time{};
    GetLocalTime(&time);
    char stamp[64]{};
    std::snprintf(stamp, sizeof(stamp), "%02d:%02d:%02d.%03d ",
                  time.wHour, time.wMinute, time.wSecond, time.wMilliseconds);
    stream << stamp << text << "\n";
}

void LogHr(const char* label, HRESULT hr) {
    char buffer[128]{};
    std::snprintf(buffer, sizeof(buffer), "%s hr=0x%08lx", label,
                  static_cast<unsigned long>(hr));
    Log(buffer);
}

constexpr UINT kMsgRecycleDone = WM_APP + 3;
constexpr UINT kMsgCaptureDone = WM_APP + 4;
constexpr UINT kMsgTaskJson = WM_APP + 5;
constexpr UINT kMsgScreenCaptureDone = WM_APP + 10;
constexpr UINT kMsgExportDone = WM_APP + 11;
constexpr UINT kMsgTray = WM_APP + 20;
constexpr UINT kMsgQuitApp = WM_APP + 21;
constexpr UINT kTrayCmdShow = 40001;
constexpr UINT kTrayCmdPanel = 40002;
constexpr UINT kTrayCmdAutostart = 40003;
constexpr UINT kTrayCmdQuit = 40004;
constexpr UINT kTrayCmdMiniBase = 40100;
constexpr UINT kTrayCmdMiniLauncher = 40120;
constexpr const wchar_t* kTrayMiniIds[] = {L"folders", L"clipboard-history", L"quick-search",
                                           L"video-collector"};
constexpr const wchar_t* kTrayMiniNames[] = {L"常用文件夹", L"剪贴板历史", L"快速文件搜索",
                                             L"视频整理"};
constexpr uint64_t kAuxGeneration = UINT64_MAX;
constexpr wchar_t kWindowClass[] = L"Toolbox.Main";
constexpr wchar_t kVirtualHost[] = L"toolsoft.local";
constexpr wchar_t kShotsHost[] = L"shots.local";

#ifndef WDA_EXCLUDEFROMCAPTURE
#define WDA_EXCLUDEFROMCAPTURE 0x00000011
#endif
constexpr wchar_t kAppVersion[] = L"0.4.0";
constexpr int kIdWebView2Loader = 100;
constexpr int kIdAppHtml = 101;

// ---- 启动窗口：WebView2 初始化期间仅浮出品牌图标（分层窗口，四周全透明） ----
ULONG_PTR g_gdiplusToken = 0;
const Gdiplus::GdiplusStartupInput g_gdiplusStartup{};
std::once_flag g_gdiplusOnce;
void EnsureGdiplus() {
    std::call_once(g_gdiplusOnce, [] {
        Gdiplus::GdiplusStartup(&g_gdiplusToken, &g_gdiplusStartup, nullptr);
    });
}

struct CaptureWindowState {
    HWND hwnd = nullptr;
    HWND previousForeground = nullptr;
    DWORD previousAffinity = 0;
    bool hadAffinity = false;
    bool excluded = false;
};

// 截图前把窗口隐藏。等待 WebView2 真正完成隐藏，以便无 WDA_EXCLUDEFROMCAPTURE
// 的旧系统上 BitBlt 不拍到窗口。等待策略：每轮都处理消息并刷 DWM；一旦窗口已
// 不可见就提前结束（通常几帧即可），250ms 只作为兜底上限，避免常态下白等这么久。
CaptureWindowState HideWindowForCapture(HWND hwnd) {
    CaptureWindowState state;
    state.hwnd = hwnd;
    state.previousForeground = GetForegroundWindow();
    state.hadAffinity = GetWindowDisplayAffinity(hwnd, &state.previousAffinity) != FALSE;
    state.excluded = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE) != FALSE;
    ShowWindow(hwnd, SW_HIDE);
    SetWindowPos(hwnd, nullptr, 0, 0, 0, 0,
                 SWP_HIDEWINDOW | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
    DwmFlush();
    const ULONGLONG deadline = GetTickCount64() + 250;
    while (GetTickCount64() < deadline) {
        MSG message{};
        while (PeekMessageW(&message, hwnd, 0, 0, PM_REMOVE)) {
            TranslateMessage(&message);
            DispatchMessageW(&message);
        }
        DwmFlush();
        if (!IsWindowVisible(hwnd)) break;
        Sleep(10);
    }
    return state;
}

void RestoreWindowAfterCapture(const CaptureWindowState& state) {
    if (!state.hwnd || !IsWindow(state.hwnd)) return;
    ShowWindow(state.hwnd, SW_SHOW);
    SetWindowPos(state.hwnd, nullptr, 0, 0, 0, 0,
                 SWP_SHOWWINDOW | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
    if (state.excluded) {
        SetWindowDisplayAffinity(state.hwnd,
                                 state.hadAffinity ? state.previousAffinity : WDA_NONE);
    }
    DwmFlush();
    UpdateWindow(state.hwnd);
    SetForegroundWindow(state.previousForeground && state.previousForeground != state.hwnd
                            ? state.previousForeground
                            : state.hwnd);
    SetFocus(state.hwnd);
}
LRESULT CALLBACK SplashProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
    switch (message) {
    case WM_NCHITTEST:
        return HTCAPTION;  // 无边框窗口允许拖动
    default:
        return DefWindowProcW(hwnd, message, wparam, lparam);
    }
}

#ifndef FOFX_RECYCLEONDELETE
#define FOFX_RECYCLEONDELETE 0x00080000
#endif

struct ScreenCaptureMsg {
    uint64_t generation = 0;
    bool ok = false;
    bool region = false;
    std::wstring path;
    std::string dataUrl;
};

struct RecycleDoneMsg {
    bool ok = false;
    size_t count = 0;
    std::string requestId;
    std::wstring message;
};

struct TaskJsonMsg {
    uint64_t generation = 0;
    std::string json;
};

// 导出文件写盘在工作线程完成后，通过该消息回传结果。
struct ExportDoneMsg {
    bool ok = false;
    std::string requestId;
    std::wstring path;
    std::string error;
};

using CreateEnvironmentFn = HRESULT(STDMETHODCALLTYPE*)(
    PCWSTR browserExecutableFolder,
    PCWSTR userDataFolder,
    ICoreWebView2EnvironmentOptions* environmentOptions,
    ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler* environmentCreatedHandler);

class EnvironmentHandler final : public ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler {
public:
    explicit EnvironmentHandler(ts::App* app) : app_(app) {}

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** result) override {
        if (!result) return E_POINTER;
        if (riid == IID_IUnknown ||
            riid == IID_ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler) {
            *result = static_cast<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler*>(this);
            AddRef();
            return S_OK;
        }
        *result = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG count = --refs_;
        if (count == 0) delete this;
        return count;
    }
    HRESULT STDMETHODCALLTYPE Invoke(HRESULT errorCode,
                                     ICoreWebView2Environment* environment) override {
        app_->OnEnvironmentCreated(errorCode, environment);
        return S_OK;
    }

private:
    std::atomic<ULONG> refs_{1};
    ts::App* app_;
};

class ControllerHandler final : public ICoreWebView2CreateCoreWebView2ControllerCompletedHandler {
public:
    explicit ControllerHandler(ts::App* app) : app_(app) {}

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** result) override {
        if (!result) return E_POINTER;
        if (riid == IID_IUnknown ||
            riid == IID_ICoreWebView2CreateCoreWebView2ControllerCompletedHandler) {
            *result = static_cast<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler*>(this);
            AddRef();
            return S_OK;
        }
        *result = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG count = --refs_;
        if (count == 0) delete this;
        return count;
    }
    HRESULT STDMETHODCALLTYPE Invoke(HRESULT errorCode,
                                     ICoreWebView2Controller* controller) override {
        app_->OnControllerCreated(errorCode, controller);
        return S_OK;
    }

private:
    std::atomic<ULONG> refs_{1};
    ts::App* app_;
};

class WebMessageHandler final : public ICoreWebView2WebMessageReceivedEventHandler {
public:
    explicit WebMessageHandler(ts::App* app) : app_(app) {}

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** result) override {
        if (!result) return E_POINTER;
        if (riid == IID_IUnknown ||
            riid == IID_ICoreWebView2WebMessageReceivedEventHandler) {
            *result = static_cast<ICoreWebView2WebMessageReceivedEventHandler*>(this);
            AddRef();
            return S_OK;
        }
        *result = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG count = --refs_;
        if (count == 0) delete this;
        return count;
    }
    HRESULT STDMETHODCALLTYPE Invoke(ICoreWebView2* /*sender*/,
                                     ICoreWebView2WebMessageReceivedEventArgs* args) override {
        LPWSTR json = nullptr;
        if (SUCCEEDED(args->get_WebMessageAsJson(&json)) && json) {
            app_->OnWebMessage(ts::ToUtf8(json));
            CoTaskMemFree(json);
        }
        return S_OK;
    }

private:
    std::atomic<ULONG> refs_{1};
    ts::App* app_;
};

class NavigationHandler final : public ICoreWebView2NavigationCompletedEventHandler {
public:
    explicit NavigationHandler(ts::App* app) : app_(app) {}

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** result) override {
        if (!result) return E_POINTER;
        if (riid == IID_IUnknown ||
            riid == IID_ICoreWebView2NavigationCompletedEventHandler) {
            *result = static_cast<ICoreWebView2NavigationCompletedEventHandler*>(this);
            AddRef();
            return S_OK;
        }
        *result = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG count = --refs_;
        if (count == 0) delete this;
        return count;
    }
    HRESULT STDMETHODCALLTYPE Invoke(ICoreWebView2* /*sender*/,
                                     ICoreWebView2NavigationCompletedEventArgs* args) override {
        BOOL success = FALSE;
        args->get_IsSuccess(&success);
        app_->OnNavigationCompleted(success != FALSE);
        return S_OK;
    }

private:
    std::atomic<ULONG> refs_{1};
    ts::App* app_;
};

class NavigationStartingHandler final : public ICoreWebView2NavigationStartingEventHandler {
public:
    explicit NavigationStartingHandler(ts::App* app) : app_(app) {}

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** result) override {
        if (!result) return E_POINTER;
        if (riid == IID_IUnknown ||
            riid == IID_ICoreWebView2NavigationStartingEventHandler) {
            *result = static_cast<ICoreWebView2NavigationStartingEventHandler*>(this);
            AddRef();
            return S_OK;
        }
        *result = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG count = --refs_;
        if (count == 0) delete this;
        return count;
    }
    HRESULT STDMETHODCALLTYPE Invoke(ICoreWebView2* /*sender*/,
                                     ICoreWebView2NavigationStartingEventArgs* args) override {
        LPWSTR uri = nullptr;
        if (SUCCEEDED(args->get_Uri(&uri)) && uri) {
            Log("NavigationStarting " + ts::ToUtf8(uri));
            CoTaskMemFree(uri);
        }
        return S_OK;
    }

private:
    std::atomic<ULONG> refs_{1};
    ts::App* app_;
};

class ContentLoadingHandler final : public ICoreWebView2ContentLoadingEventHandler {
public:
    explicit ContentLoadingHandler(ts::App* app) : app_(app) {}

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** result) override {
        if (!result) return E_POINTER;
        if (riid == IID_IUnknown || riid == IID_ICoreWebView2ContentLoadingEventHandler) {
            *result = static_cast<ICoreWebView2ContentLoadingEventHandler*>(this);
            AddRef();
            return S_OK;
        }
        *result = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG count = --refs_;
        if (count == 0) delete this;
        return count;
    }
    HRESULT STDMETHODCALLTYPE Invoke(ICoreWebView2* /*sender*/,
                                     ICoreWebView2ContentLoadingEventArgs* args) override {
        BOOL isErrorPage = FALSE;
        args->get_IsErrorPage(&isErrorPage);
        Log(std::string("ContentLoading errorPage=") + (isErrorPage ? "1" : "0"));
        return S_OK;
    }

private:
    std::atomic<ULONG> refs_{1};
    ts::App* app_;
};

class DomContentLoadedHandler final : public ICoreWebView2DOMContentLoadedEventHandler {
public:
    explicit DomContentLoadedHandler(ts::App* app) : app_(app) {}

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** result) override {
        if (!result) return E_POINTER;
        if (riid == IID_IUnknown || riid == IID_ICoreWebView2DOMContentLoadedEventHandler) {
            *result = static_cast<ICoreWebView2DOMContentLoadedEventHandler*>(this);
            AddRef();
            return S_OK;
        }
        *result = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG count = --refs_;
        if (count == 0) delete this;
        return count;
    }
    HRESULT STDMETHODCALLTYPE Invoke(ICoreWebView2* /*sender*/,
                                     ICoreWebView2DOMContentLoadedEventArgs* /*args*/) override {
        Log("DOMContentLoaded");
        return S_OK;
    }

private:
    std::atomic<ULONG> refs_{1};
    ts::App* app_;
};

class CaptureHandler final : public ICoreWebView2CapturePreviewCompletedHandler {
public:
    explicit CaptureHandler(ts::App* app) : app_(app) {}

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** result) override {
        if (!result) return E_POINTER;
        if (riid == IID_IUnknown || riid == IID_ICoreWebView2CapturePreviewCompletedHandler) {
            *result = static_cast<ICoreWebView2CapturePreviewCompletedHandler*>(this);
            AddRef();
            return S_OK;
        }
        *result = nullptr;
        return E_NOINTERFACE;
    }
    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG count = --refs_;
        if (count == 0) delete this;
        return count;
    }
    HRESULT STDMETHODCALLTYPE Invoke(HRESULT result) override {
        app_->OnCaptureCompleted(result);
        return S_OK;
    }

private:
    std::atomic<ULONG> refs_{1};
    ts::App* app_;
};

std::wstring NativeLongPath(const std::wstring& path) {
    if (path.rfind(L"\\\\?\\", 0) == 0) return path;
    if (path.rfind(L"\\\\", 0) == 0) return L"\\\\?\\UNC\\" + path.substr(2);
    return L"\\\\?\\" + path;
}

std::string JsonString(const std::wstring& value) {
    return "\"" + ts::JsonEscape(ts::ToUtf8(value)) + "\"";
}

// 扫描类消息的根目录集合：roots 数组（勾选的盘/目录）优先，其次单根 root，
// 两者都为空时交给扫描器枚举全部本地磁盘（界面上「全盘扫描」全选的语义）。
std::vector<std::wstring> ScanRootsFrom(const ts::Json& payload) {
    std::vector<std::wstring> roots;
    for (const auto& item : payload.GetArray("roots")) {
        if (item.type != ts::Json::Type::String) continue;
        std::wstring value = ts::FromUtf8(item.string);
        if (!value.empty()) roots.push_back(std::move(value));
    }
    if (roots.empty()) {
        const std::wstring single = ts::FromUtf8(payload.GetString("root"));
        if (!single.empty()) roots.push_back(single);
    }
    return roots;
}

std::string StatsJson(const ts::ScanProgress& stats) {
    std::string json;
    json += "\"files\":" + std::to_string(stats.files);
    json += ",\"dirs\":" + std::to_string(stats.dirs);
    json += ",\"bytes\":" + std::to_string(stats.bytes);
    json += ",\"matched\":" + std::to_string(stats.matched);
    json += ",\"skipped\":" + std::to_string(stats.skipped);
    return json;
}

std::string ProgressJson(const ts::ScanProgress& stats) {
    std::string json = "{\"type\":\"scanProgress\",\"payload\":{";
    json += StatsJson(stats);
    json += ",\"current\":" + JsonString(stats.current) + "}}";
    return json;
}

std::string LargeDoneJson(const ts::LargeScanResult& result) {
    std::string json = "{\"type\":\"scanDone\",\"payload\":{\"items\":[";
    for (size_t i = 0; i < result.items.size(); ++i) {
        const auto& item = result.items[i];
        if (i) json += ",";
        json += "{\"path\":" + JsonString(item.path);
        json += ",\"name\":" + JsonString(item.name);
        json += ",\"ext\":" + JsonString(item.ext);
        json += ",\"size\":" + std::to_string(item.size);
        json += ",\"mtime\":" + std::to_string(item.mtimeMs) + "}";
    }
    json += "],\"stats\":{" + StatsJson(result.stats) + "}";
    json += ",\"totalMatched\":" + std::to_string(result.totalMatched);
    json += ",\"elapsedMs\":" + std::to_string(static_cast<int64_t>(result.elapsedMs));
    json += ",\"cancelled\":";
    json += result.cancelled ? "true" : "false";
    json += "}}";
    return json;
}

std::string EmptyDoneJson(const ts::EmptyFolderResult& result) {
    std::string json = "{\"type\":\"emptyDone\",\"payload\":{\"folders\":[";
    for (size_t i = 0; i < result.folders.size(); ++i) {
        if (i) json += ",";
        json += JsonString(result.folders[i]);
    }
    json += "],\"stats\":{" + StatsJson(result.stats) + "}";
    json += ",\"elapsedMs\":" + std::to_string(static_cast<int64_t>(result.elapsedMs));
    json += ",\"cancelled\":";
    json += result.cancelled ? "true" : "false";
    json += "}}";
    return json;
}

std::string ErrorJson(const std::wstring& message) {
    return "{\"type\":\"scanError\",\"payload\":{\"message\":" + JsonString(message) + "}}";
}

std::string SearchDoneJson(const ts::SearchResult& result) {
    std::string json = "{\"type\":\"searchDone\",\"payload\":{\"items\":[";
    for (size_t i = 0; i < result.items.size(); ++i) {
        const auto& item = result.items[i];
        if (i) json += ",";
        json += "{\"path\":" + JsonString(item.path);
        json += ",\"name\":" + JsonString(item.name);
        json += ",\"ext\":" + JsonString(item.ext);
        json += ",\"size\":" + std::to_string(item.size);
        json += ",\"mtime\":" + std::to_string(item.mtimeMs) + "}";
    }
    json += "],\"stats\":{" + StatsJson(result.stats) + "}";
    json += ",\"totalMatched\":" + std::to_string(result.totalMatched);
    json += ",\"elapsedMs\":" + std::to_string(static_cast<int64_t>(result.elapsedMs));
    json += ",\"cancelled\":";
    json += result.cancelled ? "true" : "false";
    json += ",\"error\":" + JsonString(result.error) + "}}";
    return json;
}

std::string FolderDiffJson(const ts::FolderDiffResult& result) {
    auto list = [](const std::vector<ts::DiffEntry>& entries, std::string& json) {
        for (size_t i = 0; i < entries.size(); ++i) {
            if (i) json += ",";
            const auto& entry = entries[i];
            json += "{\"relPath\":" + JsonString(entry.relPath);
            json += ",\"name\":" + JsonString(entry.name);
            json += ",\"isDir\":" + std::string(entry.isDir ? "true" : "false");
            json += ",\"sizeA\":" + std::to_string(entry.sizeA);
            json += ",\"sizeB\":" + std::to_string(entry.sizeB);
            json += ",\"mtimeA\":" + std::to_string(entry.mtimeA);
            json += ",\"mtimeB\":" + std::to_string(entry.mtimeB) + "}";
        }
    };
    std::string json = "{\"type\":\"compareDone\",\"payload\":{\"onlyA\":[";
    list(result.onlyA, json);
    json += "],\"onlyB\":[";
    list(result.onlyB, json);
    json += "],\"different\":[";
    list(result.different, json);
    json += "],\"stats\":{" + StatsJson(result.stats) + "}";
    json += ",\"elapsedMs\":" + std::to_string(static_cast<int64_t>(result.elapsedMs));
    json += ",\"cancelled\":" + std::string(result.cancelled ? "true" : "false");
    json += ",\"error\":" + JsonString(result.error) + "}}";
    return json;
}

std::string CopyDoneJson(const ts::CopyOutcome& outcome, const char* doneType) {
    std::string json = "{\"type\":\"";
    json += doneType;
    json += "\",\"payload\":{\"okCount\":" + std::to_string(outcome.okCount);
    json += ",\"failCount\":" + std::to_string(outcome.failCount);
    json += ",\"cancelled\":" + std::string(outcome.cancelled ? "true" : "false");
    json += ",\"errors\":[";
    for (size_t i = 0; i < outcome.errors.size(); ++i) {
        if (i) json += ",";
        json += JsonString(outcome.errors[i]);
    }
    json += "]}}";
    return json;
}

std::string OrganizeDoneJson(const ts::OrganizeResult& result) {
    std::string json = "{\"type\":\"organizeDone\",\"payload\":{\"items\":[";
    for (size_t i = 0; i < result.items.size(); ++i) {
        if (i) json += ",";
        const auto& item = result.items[i];
        json += "{\"from\":" + JsonString(item.from);
        json += ",\"to\":" + JsonString(item.to);
        json += ",\"rule\":" + JsonString(item.rule);
        json += ",\"ok\":" + std::string(item.ok ? "true" : "false");
        json += ",\"conflict\":" + std::string(item.conflict ? "true" : "false");
        json += ",\"skipped\":" + std::string(item.skipped ? "true" : "false");
        json += ",\"error\":" + JsonString(item.error) + "}";
    }
    json += "],\"stats\":{" + StatsJson(result.stats) + "}";
    json += ",\"matched\":" + std::to_string(result.matched);
    json += ",\"matchedBytes\":" + std::to_string(result.matchedBytes);
    json += ",\"elapsedMs\":" + std::to_string(result.elapsedMs);
    json += ",\"cancelled\":" + std::string(result.cancelled ? "true" : "false");
    json += ",\"truncated\":" + std::string(result.truncated ? "true" : "false");
    json += ",\"preview\":" + std::string(result.preview ? "true" : "false");
    json += ",\"error\":" + JsonString(result.error) + "}}";
    return json;
}

std::string DuplicateJson(const ts::DuplicateResult& result) {
    std::string json = "{\"type\":\"dupDone\",\"payload\":{\"groups\":[";
    for (size_t i = 0; i < result.groups.size(); ++i) {
        const auto& group = result.groups[i];
        if (i) json += ",";
        json += "{\"hash\":" + JsonString(group.hash);
        json += ",\"size\":" + std::to_string(group.size);
        json += ",\"files\":[";
        for (size_t j = 0; j < group.files.size(); ++j) {
            if (j) json += ",";
            const auto& file = group.files[j];
            json += "{\"path\":" + JsonString(file.path);
            json += ",\"name\":" + JsonString(file.name);
            json += ",\"size\":" + std::to_string(file.size);
            json += ",\"mtime\":" + std::to_string(file.mtimeMs) + "}";
        }
        json += "]}";
    }
    json += "],\"stats\":{" + StatsJson(result.stats) + "}";
    json += ",\"candidateFiles\":" + std::to_string(result.candidateFiles);
    json += ",\"duplicateBytes\":" + std::to_string(result.duplicateBytes);
    json += ",\"elapsedMs\":" + std::to_string(static_cast<int64_t>(result.elapsedMs));
    json += ",\"cancelled\":" + std::string(result.cancelled ? "true" : "false");
    json += ",\"truncated\":" + std::string(result.truncated ? "true" : "false");
    json += ",\"error\":" + JsonString(result.error) + "}}";
    return json;
}

std::string SpaceJson(const ts::SpaceResult& result) {
    std::string json = "{\"type\":\"spaceDone\",\"payload\":{\"root\":" +
                       JsonString(result.root) + ",\"entries\":[";
    for (size_t i = 0; i < result.entries.size(); ++i) {
        if (i) json += ",";
        const auto& entry = result.entries[i];
        json += "{\"path\":" + JsonString(entry.path);
        json += ",\"name\":" + JsonString(entry.name);
        json += ",\"isDir\":" + std::string(entry.isDir ? "true" : "false");
        json += ",\"size\":" + std::to_string(entry.size) + "}";
    }
    json += "],\"total\":" + std::to_string(result.total);
    json += ",\"stats\":{" + StatsJson(result.stats) + "}";
    json += ",\"elapsedMs\":" + std::to_string(static_cast<int64_t>(result.elapsedMs));
    json += ",\"cancelled\":" + std::string(result.cancelled ? "true" : "false");
    json += ",\"error\":" + JsonString(result.error) + "}}";
    return json;
}

std::string HashJson(const ts::HashResult& result) {
    std::string json = "{\"type\":\"hashDone\",\"payload\":{\"items\":[";
    for (size_t i = 0; i < result.items.size(); ++i) {
        if (i) json += ",";
        const auto& item = result.items[i];
        json += "{\"path\":" + JsonString(item.path);
        json += ",\"name\":" + JsonString(item.name);
        json += ",\"size\":" + std::to_string(item.size);
        json += ",\"hash\":" + JsonString(item.hash);
        json += ",\"ok\":" + std::string(item.ok ? "true" : "false");
        json += ",\"error\":" + JsonString(item.error) + "}";
    }
    json += "],\"stats\":{" + StatsJson(result.stats) + "}";
    json += ",\"elapsedMs\":" + std::to_string(static_cast<int64_t>(result.elapsedMs));
    json += ",\"cancelled\":" + std::string(result.cancelled ? "true" : "false");
    json += ",\"truncated\":" + std::string(result.truncated ? "true" : "false");
    json += ",\"error\":" + JsonString(result.error) + "}}";
    return json;
}

std::string TempJson(const ts::TempResult& result) {
    std::string json = "{\"type\":\"tempDone\",\"payload\":{\"categories\":[";
    for (size_t i = 0; i < result.categories.size(); ++i) {
        if (i) json += ",";
        const auto& category = result.categories[i];
        json += "{\"name\":" + JsonString(category.name);
        json += ",\"size\":" + std::to_string(category.size);
        json += ",\"count\":" + std::to_string(category.count) + "}";
    }
    json += "],\"entries\":[";
    for (size_t i = 0; i < result.entries.size(); ++i) {
        if (i) json += ",";
        const auto& entry = result.entries[i];
        json += "{\"path\":" + JsonString(entry.path);
        json += ",\"category\":" + JsonString(entry.category);
        json += ",\"size\":" + std::to_string(entry.size);
        json += ",\"mtime\":" + std::to_string(entry.mtimeMs) + "}";
    }
    json += "],\"total\":" + std::to_string(result.total);
    json += ",\"stats\":{" + StatsJson(result.stats) + "}";
    json += ",\"elapsedMs\":" + std::to_string(static_cast<int64_t>(result.elapsedMs));
    json += ",\"cancelled\":" + std::string(result.cancelled ? "true" : "false");
    json += ",\"truncated\":" + std::string(result.truncated ? "true" : "false");
    json += ",\"error\":" + JsonString(result.error) + "}}";
    return json;
}

std::string ListJson(const ts::ListResult& result) {
    std::string json = "{\"type\":\"folderList\",\"payload\":{\"files\":[";
    for (size_t i = 0; i < result.files.size(); ++i) {
        if (i) json += ",";
        const auto& file = result.files[i];
        json += "{\"path\":" + JsonString(file.path);
        json += ",\"name\":" + JsonString(file.name);
        json += ",\"size\":" + std::to_string(file.size);
        json += ",\"mtime\":" + std::to_string(file.mtimeMs) + "}";
    }
    json += "],\"error\":" + JsonString(result.error) + "}}";
    return json;
}

std::string RenameJson(const std::vector<ts::RenameItem>& items) {
    std::string json = "{\"type\":\"renameDone\",\"payload\":{\"items\":[";
    for (size_t i = 0; i < items.size(); ++i) {
        if (i) json += ",";
        const auto& item = items[i];
        json += "{\"oldPath\":" + JsonString(item.oldPath);
        json += ",\"newPath\":" + JsonString(item.newPath);
        json += ",\"ok\":" + std::string(item.ok ? "true" : "false");
        json += ",\"error\":" + JsonString(item.error) + "}";
    }
    json += "]}}";
    return json;
}

std::string LockersJson(const ts::LockResult& result, const char* typeName) {
    std::string json = "{\"type\":\"" + std::string(typeName) +
                       "\",\"payload\":{\"processes\":[";
    for (size_t i = 0; i < result.processes.size(); ++i) {
        if (i) json += ",";
        const auto& process = result.processes[i];
        json += "{\"pid\":" + std::to_string(process.pid);
        json += ",\"name\":" + JsonString(process.name);
        json += ",\"path\":" + JsonString(process.path) + "}";
    }
    json += "],\"error\":" + JsonString(result.error) + "}}";
    return json;
}

std::string UnlockJson(const ts::LockResult& result) {
    return LockersJson(result, "unlockDone");
}

std::string UsbVolumesJson(const std::vector<ts::UsbVolume>& volumes) {
    std::string json = "{\"type\":\"usbVolumesDone\",\"payload\":{\"volumes\":[";
    for (size_t i = 0; i < volumes.size(); ++i) {
        if (i) json += ",";
        const auto& vol = volumes[i];
        json += "{\"drive\":" + JsonString(vol.drive);
        json += ",\"label\":" + JsonString(vol.label);
        json += ",\"fs\":" + JsonString(vol.filesystem);
        json += ",\"size\":" + std::to_string(vol.sizeBytes) + "}";
    }
    json += "],\"error\":\"\"}}";
    return json;
}

std::string EjectJson(bool ok, const std::wstring& error) {
    return "{\"type\":\"usbEjectDone\",\"payload\":{\"ok\":" +
           std::string(ok ? "true" : "false") + ",\"error\":" + JsonString(error) + "}}";
}

std::string KillJson(bool ok, const std::wstring& error) {
    return "{\"type\":\"killDone\",\"payload\":{\"ok\":" +
           std::string(ok ? "true" : "false") + ",\"error\":" + JsonString(error) + "}}";
}

std::string TaskErrorJson(const std::string& message) {
    return "{\"type\":\"taskError\",\"payload\":{\"message\":\"" +
           ts::JsonEscape(message) + "\"}}";
}

bool RecycleImpl(const std::vector<std::wstring>& paths) {
    if (paths.empty()) return true;
    ComPtr<IFileOperation> operation;
    HRESULT hr = CoCreateInstance(CLSID_FileOperation, nullptr, CLSCTX_ALL,
                                  IID_IFileOperation,
                                  reinterpret_cast<void**>(operation.GetAddressOf()));
    if (FAILED(hr) || !operation) return false;

    operation->SetOperationFlags(FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT |
                                 FOF_NOERRORUI | FOFX_RECYCLEONDELETE);

    for (const auto& path : paths) {
        ComPtr<IShellItem> item;
        if (SUCCEEDED(SHCreateItemFromParsingName(path.c_str(), nullptr, IID_IShellItem,
                                                   reinterpret_cast<void**>(item.GetAddressOf())))) {
            operation->DeleteItem(item.Get(), nullptr);
        }
    }

    hr = operation->PerformOperations();
    BOOL aborted = FALSE;
    operation->GetAnyOperationsAborted(&aborted);
    return SUCCEEDED(hr) && !aborted;
}

uint32_t Fnv1a(const void* data, size_t size) {
    const auto* bytes = static_cast<const uint8_t*>(data);
    uint32_t hash = 2166136261u;
    for (size_t i = 0; i < size; ++i) {
        hash ^= bytes[i];
        hash *= 16777619u;
    }
    return hash;
}

// Extract an embedded RCDATA blob next to the user data folder. The hash in
// the filename keeps upgrades from fighting with files locked by an older
// instance, and lets us distribute the whole app as one executable.
std::wstring ExtractResourceFile(int id, const std::wstring& directory,
                                 const std::wstring& stem, const wchar_t* extension) {
    HMODULE module = GetModuleHandleW(nullptr);
    HRSRC resource = FindResourceW(module, MAKEINTRESOURCEW(id), RT_RCDATA);
    if (!resource) {
        Log("embedded resource missing: " + std::to_string(id));
        return {};
    }
    DWORD size = SizeofResource(module, resource);
    HGLOBAL loaded = LoadResource(module, resource);
    const void* data = loaded ? LockResource(loaded) : nullptr;
    if (!data || size == 0) {
        Log("embedded resource empty: " + std::to_string(id));
        return {};
    }

    wchar_t suffix[16]{};
    std::swprintf(suffix, 16, L"%08x", Fnv1a(data, size));
    std::wstring path = directory + L"\\" + stem + L"-" + suffix + extension;

    std::error_code ec;
    if (std::filesystem::exists(path, ec)) {
        auto existingSize = std::filesystem::file_size(path, ec);
        if (!ec && existingSize == size) {
            // Size alone is not integrity: the cache lives in a user-writable
            // directory. Reuse only when the bytes match the embedded resource.
            std::ifstream existing(std::filesystem::path(path), std::ios::binary);
            std::vector<char> buffer(static_cast<size_t>(size));
            if (existing && existing.read(buffer.data(), static_cast<std::streamsize>(size)) &&
                std::memcmp(buffer.data(), data, static_cast<size_t>(size)) == 0) {
                return path;
            }
        }
    }

    std::filesystem::create_directories(directory, ec);
    std::ofstream output(std::filesystem::path(path), std::ios::binary | std::ios::trunc);
    if (!output) {
        Log("resource write open failed: " + ts::ToUtf8(path));
        return {};
    }
    output.write(static_cast<const char*>(data), static_cast<std::streamsize>(size));
    output.close();
    if (!output) {
        Log("resource write failed: " + ts::ToUtf8(path));
        return {};
    }
    Log("extracted resource -> " + ts::ToUtf8(path));

    // 每个版本都按内容哈希留一份，一年下来 web\ 目录会堆几十个 index-*.html。
    // 这里顺手把同前缀的旧文件删掉；旧实例还锁着的就下次再说，删失败不影响启动。
    std::vector<std::wstring> stale;
    std::error_code scanError;
    for (auto& entry : std::filesystem::directory_iterator(directory, scanError)) {
        if (!entry.is_regular_file()) continue;
        const std::wstring name = entry.path().filename().wstring();
        const std::wstring prefix = stem + L"-";
        if (name == stem + L"-" + suffix + extension) continue;
        if (name.size() > prefix.size() && name.compare(0, prefix.size(), prefix) == 0 &&
            entry.path().extension().wstring() == std::wstring(extension)) {
            stale.push_back(entry.path().wstring());
        }
    }
    for (const std::wstring& old : stale) {
        std::error_code ignored;
        std::filesystem::remove(old, ignored);
    }
    return path;
}

}  // namespace

namespace tb {

HWND MainWindow() { return g_hostWindow; }

const std::wstring& DataDir() { return g_hostDataDir; }

void PostMessage(const std::string& json) {
    if (g_hostApp) g_hostApp->PostToWebThreaded(json);
}

bool MapMediaFolder(const std::wstring& folder) {
    return g_hostApp ? g_hostApp->MapMediaFolder(folder) : false;
}

void SetMediaFolder(const std::wstring& folder) {
    if (g_hostApp) g_hostApp->MapMediaFolder(folder);
}

const std::wstring& MediaFolder() {
    static const std::wstring empty;
    return g_hostApp ? g_hostApp->MediaFolderPath() : empty;
}

}  // namespace tb

namespace ts {

App::~App() {
    for (MiniWindow* window : miniWindows_) {
        window->Destroy();
        delete window;
    }
    miniWindows_.clear();
    ShutdownTasks();
    ShutdownAuxTasks();
    ShutdownRecycleJobs();
    ShutdownExportJobs();
    ShutdownScreenCapture();
    webview_.Reset();
    controller_.Reset();
    environment_.Reset();
    if (webviewLoader_) {
        FreeLibrary(webviewLoader_);
        webviewLoader_ = nullptr;
    }
    if (backgroundBrush_) {
        DeleteObject(backgroundBrush_);
        backgroundBrush_ = nullptr;
    }
    if (singleInstance_) {
        CloseHandle(singleInstance_);
        singleInstance_ = nullptr;
    }
}

bool App::Initialize(HINSTANCE instance, const std::wstring& commandLine) {
    instance_ = instance;
    g_logPath = ExeDirectory() + L"\\app.log";
    Log("Initialize start");

    int argc = 0;
    LPWSTR* argv = CommandLineToArgvW(commandLine.c_str(), &argc);
    std::wstring webDirArgument;
    std::wstring screenshotArgument;
    std::wstring userDataArgument;
    std::wstring assetDirArgument;
    std::wstring quitArgument;
    std::wstring autostartArgument;
    for (int i = 1; i < argc; ++i) {
        std::wstring argument = argv[i];
        if (argument == L"--dev") {
            devMode_ = true;
        } else if (argument == L"--quit") {
            quitArgument = L"1";
        } else if (argument.rfind(L"--autostart=", 0) == 0) {
            autostartArgument = argument.substr(12);
        } else if (argument == L"--startup" || argument == L"--minimized") {
            startHidden_ = true;
        } else if (argument == L"--panel") {
            showPanelAtStart_ = true;
        } else if (argument == L"--disable-gpu") {
            disableGpu_ = true;
        } else if (argument == L"--blank") {
            blankMode_ = true;
        } else if (argument == L"--file-url") {
            forceFileUrl_ = true;
        } else if (argument == L"--web-dir" && i + 1 < argc) {
            webDirArgument = argv[++i];
        } else if (argument == L"--screenshot" && i + 1 < argc) {
            screenshotArgument = argv[++i];
        } else if (argument == L"--user-data-dir" && i + 1 < argc) {
            userDataArgument = argv[++i];
        } else if (argument == L"--asset-dir" && i + 1 < argc) {
            assetDirArgument = argv[++i];
        } else if (argument == L"--page" && i + 1 < argc) {
            pageQuery_ = argv[++i];
            if (!pageQuery_.empty() && pageQuery_.front() == L'?') pageQuery_.erase(0, 1);
        }
    }
    if (argv) LocalFree(argv);

    if (!quitArgument.empty()) {
        // 给脚本/安装器用：请已经运行的实例正常退出。
        HWND existing = FindWindowW(kWindowClass, nullptr);
        if (existing) PostMessageW(existing, kMsgQuitApp, 0, 0);
        alreadyRunning_ = true;
        return false;
    }

    if (!autostartArgument.empty()) {
        // 给脚本/安装包用：无窗口地开关开机自启。
        if (autostartArgument == L"on") {
            SetAutostart(true);
        } else if (autostartArgument == L"off") {
            SetAutostart(false);
        }
        Log(std::string("autostart=") + (AutostartEnabled() ? "on" : "off"));
        alreadyRunning_ = true;
        return false;
    }

    std::error_code ec;
    const bool portableMode = std::filesystem::exists(
        std::filesystem::path(ExeDirectory()) / L"portable.ini", ec);
    if (!assetDirArgument.empty()) {
        cacheRoot_ = std::filesystem::absolute(assetDirArgument, ec).wstring();
        if (ec) cacheRoot_ = assetDirArgument;
    } else if (portableMode) {
        cacheRoot_ = ExeDirectory() + L"\\data";
    } else {
        PWSTR localAppData = nullptr;
        if (SUCCEEDED(SHGetKnownFolderPath(FOLDERID_LocalAppData, KF_FLAG_CREATE, nullptr, &localAppData))) {
            cacheRoot_ = std::wstring(localAppData) + L"\\Toolbox";
            CoTaskMemFree(localAppData);
        } else {
            cacheRoot_ = ExeDirectory() + L"\\data";
        }
    }
    std::filesystem::create_directories(cacheRoot_, ec);
    if (ec || !std::filesystem::exists(cacheRoot_)) {
        Log("cache directory failed: " + ec.message());
        cacheRoot_ = ExeDirectory() + L"\\data";
        ec.clear();
        std::filesystem::create_directories(cacheRoot_, ec);
    }
    Log("cacheRoot=" + ts::ToUtf8(cacheRoot_));
    g_hostDataDir = cacheRoot_;

    if (!webDirArgument.empty()) {
        webDir_ = std::filesystem::absolute(webDirArgument, ec).wstring();
        if (ec) webDir_ = webDirArgument;
    }
    if (!PrepareAssets()) return false;

    if (!screenshotArgument.empty()) {
        screenshotPath_ = std::filesystem::absolute(screenshotArgument, ec).wstring();
        if (ec) screenshotPath_ = screenshotArgument;
        screenshotMode_ = true;
        std::filesystem::create_directories(std::filesystem::path(screenshotPath_).parent_path(), ec);
    }

    if (!userDataArgument.empty()) {
        std::error_code pathError;
        userDataDir_ = std::filesystem::absolute(userDataArgument, pathError).wstring();
        if (pathError) userDataDir_ = userDataArgument;
    } else {
        userDataDir_ = cacheRoot_ + L"\\WebView2";
    }
    std::filesystem::create_directories(userDataDir_, ec);
    if (ec || !std::filesystem::exists(userDataDir_)) {
        Log("userData directory failed: " + ec.message());
        userDataDir_ = ExeDirectory() + L"\\data\\WebView2";
        ec.clear();
        std::filesystem::create_directories(userDataDir_, ec);
    }
    Log("userData=" + ts::ToUtf8(userDataDir_));
    Log("screenshot=" + ts::ToUtf8(screenshotPath_));

    if (!screenshotMode_) {
        singleInstance_ = CreateMutexW(nullptr, TRUE, L"Local\\Toolbox.WebView2.SingleInstance");
        if (GetLastError() == ERROR_ALREADY_EXISTS) {
            alreadyRunning_ = true;
            HWND existing = FindWindowW(kWindowClass, nullptr);
            if (existing) {
                ShowWindow(existing, SW_RESTORE);
                SetForegroundWindow(existing);
            }
            return false;
        }
    }

    if (!CreateMainWindow()) {
        Log("CreateMainWindow failed");
        return false;
    }
    Log("main window created");
    g_hostWindow = hwnd_;
    g_hostApp = this;
    LoadAppPrefs();
    ApplyTaskbarButton();
    tb::RegisterAllCommands();
    CreateTrayIcon();
    if (RegisterHotKey(hwnd_, 1, MOD_CONTROL | MOD_ALT | MOD_SHIFT, 'F')) {
        Log("hotkey Ctrl+Alt+Shift+F registered");
    } else {
        Log("hotkey registration failed (occupied)");
    }
    if (screenshotMode_) {
        ShowWindow(hwnd_, SW_SHOW);
        UpdateWindow(hwnd_);
    } else if (!startHidden_) {
        // 主窗口等首次 NavigationCompleted 再显示，期间由启动窗口占位，避免黑屏
        CreateSplash();
    }
    CreateWebView();
    return true;
}

bool App::PrepareAssets() {
    std::error_code ec;
    if (webDir_.empty()) {
        std::wstring exeWeb = ExeDirectory() + L"\\web";
        if (std::filesystem::exists(std::filesystem::path(exeWeb) / L"index.html", ec)) {
            webDir_ = exeWeb;
            webPage_ = L"index.html";
        } else {
            std::wstring html = ExtractResourceFile(kIdAppHtml, cacheRoot_ + L"\\web",
                                                    L"index", L".html");
            if (html.empty()) {
                MessageBoxW(nullptr,
                            L"找不到界面资源。请重新下载完整的 Toolbox.exe。",
                            L"工具箱", MB_ICONERROR | MB_OK);
                return false;
            }
            std::filesystem::path path(html);
            webDir_ = path.parent_path().wstring();
            webPage_ = path.filename().wstring();
        }
    } else {
        if (!std::filesystem::exists(std::filesystem::path(webDir_) / L"index.html", ec)) {
            MessageBoxW(nullptr, (L"找不到界面文件：\n" + webDir_ + L"\\index.html").c_str(),
                        L"工具箱", MB_ICONERROR | MB_OK);
            return false;
        }
        webPage_ = L"index.html";
    }

    std::wstring exeLoader = ExeDirectory() + L"\\WebView2Loader.dll";
    if (std::filesystem::exists(exeLoader, ec)) {
        loaderPath_ = exeLoader;
    } else {
        std::wstring loader = ExtractResourceFile(kIdWebView2Loader, cacheRoot_ + L"\\bin",
                                                  L"WebView2Loader", L".dll");
        if (!loader.empty()) loaderPath_ = loader;
    }

    Log("webDir=" + ts::ToUtf8(webDir_));
    Log("webPage=" + ts::ToUtf8(webPage_));
    Log("loader=" + ts::ToUtf8(loaderPath_));
    return true;
}

bool App::CreateSplash() {
    EnsureGdiplus();
    // 串行化 GDI+ 访问（截图线程、后台元数据线程、剪贴板线程会同用）。
    std::lock_guard<std::mutex> gdiplusLock(tb::GdiplusSync());
    if (g_gdiplusToken == 0) return false;
    UINT dpi = GetDpiForSystem();
    if (dpi == 0) dpi = 96;
    const int side = MulDiv(200, dpi, 96);
    HICON icon = static_cast<HICON>(LoadImageW(instance_, MAKEINTRESOURCEW(1),
                                               IMAGE_ICON, side, side, LR_DEFAULTCOLOR));
    if (!icon) return false;

    // HICON → 32 位 ARGB 位图（保留圆角处的真透明像素）
    Gdiplus::Bitmap* bitmapPtr = Gdiplus::Bitmap::FromHICON(icon);
    DestroyIcon(icon);
    if (!bitmapPtr) return false;
    std::unique_ptr<Gdiplus::Bitmap> bitmap(bitmapPtr);

    const UINT width = bitmap->GetWidth();
    const UINT height = bitmap->GetHeight();
    Gdiplus::Rect full(0, 0, static_cast<INT>(width), static_cast<INT>(height));
    Gdiplus::BitmapData data{};
    if (bitmap->LockBits(&full, Gdiplus::ImageLockModeRead, PixelFormat32bppARGB, &data)
        != Gdiplus::Ok) {
        return false;
    }
    // 拷贝并预乘 alpha（UpdateLayeredWindow 要求 premultiplied BGRA）
    std::vector<BYTE> pixels(static_cast<size_t>(width) * height * 4);
    const bool topDown = data.Stride >= 0;
    const UINT stride = topDown ? static_cast<UINT>(data.Stride)
                                : static_cast<UINT>(-data.Stride);
    for (UINT row = 0; row < height; ++row) {
        const BYTE* src = static_cast<const BYTE*>(data.Scan0)
                          + (topDown ? row : height - 1 - row) * stride;
        BYTE* dst = pixels.data() + static_cast<size_t>(row) * width * 4;
        for (UINT col = 0; col < width; ++col) {
            const BYTE b = src[col * 4 + 0];
            const BYTE g = src[col * 4 + 1];
            const BYTE r = src[col * 4 + 2];
            const BYTE a = src[col * 4 + 3];
            dst[col * 4 + 0] = static_cast<BYTE>(b * a / 255);
            dst[col * 4 + 1] = static_cast<BYTE>(g * a / 255);
            dst[col * 4 + 2] = static_cast<BYTE>(r * a / 255);
            dst[col * 4 + 3] = a;
        }
    }
    bitmap->UnlockBits(&data);

    WNDCLASSEXW wc{};
    wc.cbSize = sizeof(wc);
    wc.lpfnWndProc = SplashProc;
    wc.hInstance = instance_;
    wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    wc.hIcon = LoadIconW(instance_, MAKEINTRESOURCEW(1));
    wc.hIconSm = wc.hIcon;
    wc.lpszClassName = L"Toolbox.Splash";
    if (!RegisterClassExW(&wc) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) {
        return false;
    }

    RECT work{};
    SystemParametersInfoW(SPI_GETWORKAREA, 0, &work, 0);
    const int x = work.left + (work.right - work.left - static_cast<int>(width)) / 2;
    const int y = work.top + (work.bottom - work.top - static_cast<int>(height)) / 2;

    splash_ = CreateWindowExW(WS_EX_LAYERED, wc.lpszClassName, L"工具箱", WS_POPUP,
                              x, y, static_cast<int>(width), static_cast<int>(height),
                              nullptr, nullptr, instance_, nullptr);
    if (!splash_) return false;

    HDC screen = GetDC(nullptr);
    BITMAPINFO bi{};
    bi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bi.bmiHeader.biWidth = static_cast<LONG>(width);
    bi.bmiHeader.biHeight = -static_cast<LONG>(height);
    bi.bmiHeader.biPlanes = 1;
    bi.bmiHeader.biBitCount = 32;
    bi.bmiHeader.biCompression = BI_RGB;
    void* bits = nullptr;
    HBITMAP dib = CreateDIBSection(screen, &bi, DIB_RGB_COLORS, &bits, nullptr, 0);
    if (!dib) {
        ReleaseDC(nullptr, screen);
        return false;
    }
    memcpy(bits, pixels.data(), pixels.size());
    HDC mem = CreateCompatibleDC(screen);
    HGDIOBJ oldBitmap = SelectObject(mem, dib);
    BLENDFUNCTION blend{AC_SRC_OVER, 0, 255, AC_SRC_ALPHA};
    SIZE size{static_cast<LONG>(width), static_cast<LONG>(height)};
    POINT origin{0, 0};
    const BOOL ok = UpdateLayeredWindow(splash_, screen, nullptr, &size, mem, &origin,
                                        0, &blend, ULW_ALPHA);
    SelectObject(mem, oldBitmap);
    DeleteObject(dib);
    DeleteDC(mem);
    ReleaseDC(nullptr, screen);
    if (!ok) {
        Log("UpdateLayeredWindow failed");
        DestroyWindow(splash_);
        splash_ = nullptr;
        return false;
    }
    ShowWindow(splash_, SW_SHOWNA);
    Log("splash shown (layered)");
    return true;
}

void App::CloseSplash() {
    if (splash_ && IsWindow(splash_)) DestroyWindow(splash_);
    splash_ = nullptr;
}

bool App::CreateMainWindow() {
    WNDCLASSEXW windowClass{};
    windowClass.cbSize = sizeof(windowClass);
    windowClass.style = CS_HREDRAW | CS_VREDRAW;
    windowClass.lpfnWndProc = &App::WindowProc;
    windowClass.hInstance = instance_;
    windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
    // Resource ID 1 is the app icon (see resources/app.rc); without this the
    // title bar and taskbar fall back to the generic Windows icon.
    windowClass.hIcon = LoadIconW(instance_, MAKEINTRESOURCEW(1));
    windowClass.hIconSm = windowClass.hIcon;
    backgroundBrush_ = CreateSolidBrush(RGB(244, 246, 251));
    windowClass.hbrBackground = backgroundBrush_;
    windowClass.lpszClassName = kWindowClass;
    if (!RegisterClassExW(&windowClass) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) {
        MessageBoxW(nullptr, L"窗口类注册失败。", L"工具箱", MB_ICONERROR | MB_OK);
        return false;
    }

    UINT dpi = GetDpiForSystem();
    if (dpi == 0) dpi = 96;
    RECT frame{0, 0, MulDiv(1280, dpi, 96), MulDiv(820, dpi, 96)};
    AdjustWindowRectEx(&frame, WS_OVERLAPPEDWINDOW, FALSE, 0);
    int width = frame.right - frame.left;
    int height = frame.bottom - frame.top;

    RECT workArea{};
    SystemParametersInfoW(SPI_GETWORKAREA, 0, &workArea, 0);
    const int workWidth = workArea.right - workArea.left;
    const int workHeight = workArea.bottom - workArea.top;
    // 1366x768 laptops are still common; never create a window taller/wider
    // than the usable desktop, otherwise the bottom controls are unreachable.
    if (workWidth > 0) width = std::min(width, workWidth);
    if (workHeight > 0) height = std::min(height, workHeight);
    int x = workArea.left + (workWidth - width) / 2;
    int y = workArea.top + (workHeight - height) / 2;

    hwnd_ = CreateWindowExW(0, kWindowClass, L"工具箱",
                            WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN,
                            x, y, width, height, nullptr, nullptr, instance_, this);
    if (!hwnd_) {
        MessageBoxW(nullptr, L"主窗口创建失败。", L"工具箱", MB_ICONERROR | MB_OK);
        return false;
    }

    dpi_ = GetDpiForWindow(hwnd_);
    if (dpi_ == 0) dpi_ = 96;

    BOOL dark = TRUE;
    if (FAILED(DwmSetWindowAttribute(hwnd_, 20, &dark, sizeof(dark)))) {
        DwmSetWindowAttribute(hwnd_, 19, &dark, sizeof(dark));
    }
    // 剪贴板监听由前端按需开启（默认暂停），启动时不读取全局剪贴板。
    return true;
}

void App::CreateWebView() {
    std::wstring loaderPath = loaderPath_;
    if (loaderPath.empty()) loaderPath = ExeDirectory() + L"\\WebView2Loader.dll";
    webviewLoader_ = LoadLibraryW(loaderPath.c_str());
    if (!webviewLoader_ && loaderPath != L"WebView2Loader.dll") {
        webviewLoader_ = LoadLibraryW(L"WebView2Loader.dll");
    }
    if (!webviewLoader_) {
        CloseSplash();
        MessageBoxW(hwnd_,
                    L"未找到 WebView2Loader.dll。\n请确认它和 Toolbox.exe 在同一个目录。",
                    L"工具箱", MB_ICONERROR | MB_OK);
        PostQuitMessage(1);
        return;
    }

    auto createEnvironment = reinterpret_cast<CreateEnvironmentFn>(
        GetProcAddress(webviewLoader_, "CreateCoreWebView2EnvironmentWithOptions"));
    if (!createEnvironment) {
        CloseSplash();
        MessageBoxW(hwnd_, L"WebView2Loader.dll 版本不完整，缺少创建环境的入口。",
                    L"工具箱", MB_ICONERROR | MB_OK);
        PostQuitMessage(1);
        return;
    }

    Log("WebView2Loader loaded");
    // 三个虚拟主机名（toolsoft.local / shots.local / media.local）都不是真实域名，
    // Chromium 会先做一次 DNS 查询，查不到就卡在 ~2 秒超时才回落到本地映射 ——
    // 首屏和悬浮窗"慢半拍"几乎全耗在这里。先把名字钉成 127.0.0.1，导航立刻提交。
    // 顺便把外部已经设过的参数（调试用 --remote-debugging-port 等）保留下来。
    constexpr wchar_t kHostRules[] =
        L"--host-resolver-rules=\"MAP toolsoft.local 127.0.0.1,"
        L"MAP shots.local 127.0.0.1,MAP media.local 127.0.0.1\"";
    std::wstring browserArgs;
    {
        wchar_t existing[2048]{};
        DWORD got = GetEnvironmentVariableW(
            L"WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", existing, 2048);
        if (got > 0 && got < 2048) browserArgs.assign(existing, got);
    }
    if (disableGpu_) {
        browserArgs += L" --disable-gpu --disable-backgrounding-occluded-windows"
                       L" --disable-renderer-backgrounding"
                       L" --disable-features=CalculateNativeWinOcclusion";
        Log("Using software rendering args");
    }
    if (browserArgs.find(L"host-resolver-rules") == std::wstring::npos) {
        browserArgs += L" ";
        browserArgs += kHostRules;
    }
    SetEnvironmentVariableW(L"WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", browserArgs.c_str());
    if (!browserArgs.empty()) Log("Browser args applied");

    auto* handler = new EnvironmentHandler(this);
    HRESULT hr = createEnvironment(nullptr, userDataDir_.c_str(), nullptr, handler);
    handler->Release();
    LogHr("CreateEnvironment", hr);
    if (FAILED(hr)) {
        CloseSplash();
        MessageBoxW(hwnd_,
                    L"WebView2 环境创建失败。\n\n"
                    L"Windows 11 和大多数 Windows 10 已自带 WebView2 Runtime。\n"
                    L"如果缺失，请安装 Microsoft Edge WebView2 Runtime 后重试：\n"
                    L"https://go.microsoft.com/fwlink/p/?LinkId=2124703",
                    L"工具箱", MB_ICONERROR | MB_OK);
        PostQuitMessage(1);
    }
}

void App::OnEnvironmentCreated(HRESULT hr, ICoreWebView2Environment* environment) {
    LogHr("OnEnvironmentCreated", hr);
    {
        char buffer[160]{};
        std::snprintf(buffer, sizeof(buffer), "env thread=%lu window thread=%lu isWindow=%d",
                      GetCurrentThreadId(), GetWindowThreadProcessId(hwnd_, nullptr),
                      IsWindow(hwnd_) ? 1 : 0);
        Log(buffer);
    }
    if (FAILED(hr) || !environment) {
        CloseSplash();
        MessageBoxW(hwnd_,
                    L"WebView2 初始化失败。\n\n"
                    L"Windows 11 和大多数 Windows 10 已自带 WebView2 Runtime。\n"
                    L"如果缺失，请安装 Microsoft Edge WebView2 Runtime 后重试：\n"
                    L"https://go.microsoft.com/fwlink/p/?LinkId=2124703",
                    L"工具箱", MB_ICONERROR | MB_OK);
        PostQuitMessage(1);
        return;
    }
    environment_ = environment;
    auto* handler = new ControllerHandler(this);
    HRESULT result = environment_->CreateCoreWebView2Controller(hwnd_, handler);
    handler->Release();
    LogHr("CreateController", result);
    if (FAILED(result)) {
        CloseSplash();
        MessageBoxW(hwnd_, L"WebView2 控制器创建失败。", L"工具箱", MB_ICONERROR | MB_OK);
        PostQuitMessage(1);
    }
}

void App::OnControllerCreated(HRESULT hr, ICoreWebView2Controller* controller) {
    LogHr("OnControllerCreated", hr);
    if (FAILED(hr) || !controller) {
        CloseSplash();
        MessageBoxW(hwnd_, L"WebView2 页面初始化失败。", L"工具箱", MB_ICONERROR | MB_OK);
        PostQuitMessage(1);
        return;
    }

    controller_ = controller;
    ICoreWebView2* webview = nullptr;
    if (FAILED(controller_->get_CoreWebView2(&webview)) || !webview) {
        CloseSplash();
        MessageBoxW(hwnd_, L"无法获取 WebView2 页面对象。", L"工具箱", MB_ICONERROR | MB_OK);
        PostQuitMessage(1);
        return;
    }
    webview_.Attach(webview);

    controller_->put_IsVisible(TRUE);
    controller_->put_ZoomFactor(1.0);
    ResizeWebView();

    ICoreWebView2Settings* settings = nullptr;
    if (SUCCEEDED(webview_->get_Settings(&settings)) && settings) {
        settings->put_IsScriptEnabled(TRUE);
        settings->put_AreDefaultScriptDialogsEnabled(TRUE);
        settings->put_IsWebMessageEnabled(TRUE);
        settings->put_AreDevToolsEnabled(devMode_ ? TRUE : FALSE);
        settings->put_AreDefaultContextMenusEnabled(devMode_ ? TRUE : FALSE);
        settings->put_IsStatusBarEnabled(FALSE);
        settings->put_IsZoomControlEnabled(FALSE);
        settings->put_IsBuiltInErrorPageEnabled(FALSE);
        settings->Release();
    }

    EventRegistrationToken token{};
    InstallMediaHandler(webview_.Get(), environment_.Get());
    auto* messageHandler = new WebMessageHandler(this);
    LogHr("add_WebMessageReceived", webview_->add_WebMessageReceived(messageHandler, &token));
    messageHandler->Release();

    auto* navigationHandler = new NavigationHandler(this);
    LogHr("add_NavigationCompleted", webview_->add_NavigationCompleted(navigationHandler, &token));
    navigationHandler->Release();

    auto* startingHandler = new NavigationStartingHandler(this);
    LogHr("add_NavigationStarting", webview_->add_NavigationStarting(startingHandler, &token));
    startingHandler->Release();

    auto* contentLoadingHandler = new ContentLoadingHandler(this);
    LogHr("add_ContentLoading", webview_->add_ContentLoading(contentLoadingHandler, &token));
    contentLoadingHandler->Release();

    ComPtr<ICoreWebView2_2> webview2;
    if (SUCCEEDED(webview_->QueryInterface(IID_ICoreWebView2_2,
                                           reinterpret_cast<void**>(webview2.GetAddressOf())))) {
        auto* domHandler = new DomContentLoadedHandler(this);
        LogHr("add_DOMContentLoaded", webview2->add_DOMContentLoaded(domHandler, &token));
        domHandler->Release();
    }

    ApplyTheme(darkTheme_ ? "dark" : "light");

    if (blankMode_) {
        Log("NavigateToString blank");
        LogHr("NavigateToString blank", webview_->NavigateToString(
            L"<html><body style='background:#f4f6fb;color:#0f172a;font-family:sans-serif'>"
            L"<h1>Toolbox WebView2 OK</h1></body></html>"));
        return;
    }

    ComPtr<ICoreWebView2_3> webview3;
    if (!forceFileUrl_ && SUCCEEDED(webview_->QueryInterface(
            IID_ICoreWebView2_3, reinterpret_cast<void**>(webview3.GetAddressOf())))) {
        HRESULT mapping = webview3->SetVirtualHostNameToFolderMapping(
            kVirtualHost, webDir_.c_str(), COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);
        LogHr("SetVirtualHostNameToFolderMapping", mapping);
        // 截图目录单独映射到一个虚拟主机，前端缩略图可直接加载本地 PNG
        std::error_code shotsEc;
        const std::filesystem::path shotsDir =
            std::filesystem::path(cacheRoot_) / L"screenshots";
        std::filesystem::create_directories(shotsDir, shotsEc);
        HRESULT shotsMapping = webview3->SetVirtualHostNameToFolderMapping(
            kShotsHost, shotsDir.c_str(), COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);
        LogHr("SetVirtualHostNameToFolderMapping(shots)", shotsMapping);
        if (SUCCEEDED(mapping)) {
            Log("Navigate virtual host");
            std::wstring pageUrl = L"https://toolsoft.local/" + webPage_;
            std::wstring query;
            if (!pageQuery_.empty()) query = L"?" + pageQuery_;
            if (screenshotMode_) query += query.empty() ? L"?static=1" : L"&static=1";
            pageUrl += query;
            HRESULT navigation = webview_->Navigate(pageUrl.c_str());
            LogHr("Navigate", navigation);
            return;
        }
    }

    wchar_t fileUrl[2048]{};
    DWORD length = 2048;
    std::wstring indexPath = webDir_ + L"\\" + webPage_;
    if (SUCCEEDED(UrlCreateFromPathW(indexPath.c_str(), fileUrl, &length, 0))) {
        Log("Navigate file url");
        std::wstring url = fileUrl;
        std::wstring query;
        if (!pageQuery_.empty()) query = L"?" + pageQuery_;
        if (screenshotMode_) query += query.empty() ? L"?static=1" : L"&static=1";
        url += query;
        LogHr("Navigate file", webview_->Navigate(url.c_str()));
    } else {
        Log("Navigate raw path");
        LogHr("Navigate path", webview_->Navigate(indexPath.c_str()));
    }
}

void App::ResizeWebView() {
    if (!controller_ || !hwnd_) return;
    RECT client{};
    GetClientRect(hwnd_, &client);
    char buffer[128]{};
    std::snprintf(buffer, sizeof(buffer), "ResizeWebView %ld,%ld %ldx%ld visible=%d",
                  client.left, client.top, client.right - client.left,
                  client.bottom - client.top, IsWindowVisible(hwnd_) ? 1 : 0);
    Log(buffer);
    controller_->put_Bounds(client);
}

void App::PostJson(const std::string& json) {
    if (webview_) {
        const std::wstring message = FromUtf8(json);
        webview_->PostWebMessageAsJson(message.c_str());
    }
    for (MiniWindow* window : miniWindows_) window->Post(json);
}

void App::BroadcastJson(const std::string& json) { PostJson(json); }

std::wstring App::ShotsDir() const {
    return (std::filesystem::path(cacheRoot_) / L"screenshots").wstring();
}

std::wstring App::BuildPageUrl(const std::wstring& query) const {
    std::wstring url = L"https://toolsoft.local/" + webPage_;
    if (!query.empty()) url += L"?" + query;
    return url;
}

void App::ShowMiniWindow(const std::wstring& toolId, bool toggle, const std::wstring& extraQuery) {
    if (toolId.empty()) return;
    if (!environment_) return;
    for (MiniWindow* window : miniWindows_) {
        if (window->ToolId() == toolId) {
            if (toggle) {
                window->Toggle();
            } else {
                window->Show();
            }
            return;
        }
    }
    MiniWindow* window = new MiniWindow(this, environment_.Get(), toolId, extraQuery);
    miniWindows_.push_back(window);
    window->Show();
}

// 独立视频预览窗：每次打开都换一个新窗口，避免复用成上一部的画面。
void App::ShowPreviewWindow(const std::wstring& path, const std::wstring& name) {
    if (!environment_ || path.empty()) return;
    if (previewWindow_) CloseMiniWindow(previewWindow_);
    const std::wstring query =
        L"&path=" + UrlEncodeParam(path) + L"&name=" + UrlEncodeParam(name);
    MiniWindow* window = new MiniWindow(this, environment_.Get(), L"video-preview", query,
                                        name.empty() ? L"" : L"工具箱 · " + name);
    miniWindows_.push_back(window);
    previewWindow_ = window;
    window->Show();
}

void App::CloseMiniWindow(MiniWindow* window) {
    if (!window) return;
    auto it = std::find(miniWindows_.begin(), miniWindows_.end(), window);
    if (it != miniWindows_.end()) miniWindows_.erase(it);
    if (window == previewWindow_) previewWindow_ = nullptr;
    window->Destroy();
    delete window;
}

void App::OnMiniMessage(MiniWindow* sender, const std::string& json) {
    DispatchWebMessage(json, sender);
}

void App::LogDebug(const std::string& text) { Log(text); }

bool App::MapMediaFolder(const std::wstring& folder) {
    if (folder.empty()) return false;
    mediaFolder_ = folder;
    return GetFileAttributesW(folder.c_str()) != INVALID_FILE_ATTRIBUTES;
}


void App::PostToWeb(const std::string& json) { PostJson(json); }

void App::PostToWebThreaded(const std::string& json) {
    if (!hwnd_) return;
    auto* message = new TaskJsonMsg{kAuxGeneration, json};
    if (!PostMessageW(hwnd_, kMsgTaskJson, 0, reinterpret_cast<LPARAM>(message))) {
        delete message;
    }
}

bool App::CreateTrayIcon() {
    if (trayCreated_ || !hwnd_) return trayCreated_;
    trayIcon_.cbSize = sizeof(trayIcon_);
    trayIcon_.hWnd = hwnd_;
    trayIcon_.uID = 1;
    trayIcon_.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
    trayIcon_.uCallbackMessage = kMsgTray;
    HICON icon = LoadIconW(instance_, MAKEINTRESOURCEW(1));
    if (!icon) icon = LoadIconW(nullptr, IDI_APPLICATION);
    trayIcon_.hIcon = icon;
    wcscpy_s(trayIcon_.szTip, L"工具箱 · 单击打开常用文件夹");
    trayCreated_ = Shell_NotifyIconW(NIM_ADD, &trayIcon_) != FALSE;
    Log(std::string("tray icon ") + (trayCreated_ ? "created" : "failed"));
    return trayCreated_;
}

void App::RemoveTrayIcon() {
    if (!trayCreated_) return;
    Shell_NotifyIconW(NIM_DELETE, &trayIcon_);
    trayCreated_ = false;
}

void App::HandleTrayMessage(WPARAM, LPARAM lparam) {
    switch (LOWORD(lparam)) {
        case WM_LBUTTONUP:
            ToggleFoldersPanel();
            break;
        case WM_LBUTTONDBLCLK:
            ShowMainWindowNow();
            break;
        case WM_RBUTTONUP:
        case WM_CONTEXTMENU:
            ShowTrayMenu();
            break;
        default:
            break;
    }
}

void App::ShowTrayMenu() {
    HMENU menu = CreatePopupMenu();
    if (!menu) return;
    AppendMenuW(menu, MF_STRING, kTrayCmdShow, L"打开主窗口");
    AppendMenuW(menu, MF_STRING, kTrayCmdPanel, L"常用文件夹面板");

    HMENU miniMenu = CreatePopupMenu();
    AppendMenuW(miniMenu, MF_STRING, kTrayCmdMiniLauncher, L"悬浮工具箱（全部工具）");
    AppendMenuW(miniMenu, MF_SEPARATOR, 0, nullptr);
    for (size_t i = 0; i < std::size(kTrayMiniIds); ++i) {
        bool visible = false;
        for (MiniWindow* window : miniWindows_) {
            if (window->ToolId() == kTrayMiniIds[i] && window->Visible()) {
                visible = true;
                break;
            }
        }
        AppendMenuW(miniMenu, MF_STRING | (visible ? MF_CHECKED : 0), kTrayCmdMiniBase + i,
                    kTrayMiniNames[i]);
    }
    AppendMenuW(menu, MF_POPUP, reinterpret_cast<UINT_PTR>(miniMenu), L"悬浮工具");
    AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
    const UINT autoFlags = MF_STRING | (AutostartEnabled() ? MF_CHECKED : 0);
    AppendMenuW(menu, autoFlags, kTrayCmdAutostart, L"开机自启");
    AppendMenuW(menu, MF_SEPARATOR, 0, nullptr);
    AppendMenuW(menu, MF_STRING, kTrayCmdQuit, L"退出工具箱");

    POINT cursor{};
    GetCursorPos(&cursor);
    // 前台窗口必须是本窗口，否则点菜单外面时菜单不会消失。
    SetForegroundWindow(hwnd_);
    const UINT command = TrackPopupMenuEx(
        menu, TPM_RETURNCMD | TPM_RIGHTBUTTON | TPM_TOPALIGN | TPM_LEFTALIGN, cursor.x, cursor.y,
        hwnd_, nullptr);
    DestroyMenu(menu);
    PostMessageW(hwnd_, WM_NULL, 0, 0);

    if (command == kTrayCmdShow) {
        ShowMainWindowNow();
    } else if (command == kTrayCmdPanel) {
        ToggleFoldersPanel();
    } else if (command == kTrayCmdMiniLauncher) {
        ShowMiniWindow(L"launcher");
    } else if (command >= kTrayCmdMiniBase &&
               command < kTrayCmdMiniBase + std::size(kTrayMiniIds)) {
        ShowMiniWindow(kTrayMiniIds[command - kTrayCmdMiniBase]);
    } else if (command == kTrayCmdAutostart) {
        SetAutostart(!AutostartEnabled());
    } else if (command == kTrayCmdQuit) {
        quitting_ = true;
        PostMessageW(hwnd_, WM_CLOSE, 0, 0);
    }
}

void App::ShowMainWindowNow() {
    if (!hwnd_) return;
    ShowWindow(hwnd_, SW_SHOW);
    if (IsIconic(hwnd_)) ShowWindow(hwnd_, SW_RESTORE);
    SetForegroundWindow(hwnd_);
    ResizeWebView();
}

void App::HideMainWindowToTray() {
    if (!hwnd_) return;
    ShowWindow(hwnd_, SW_HIDE);
}

void App::ToggleFoldersPanel() { ShowMiniWindow(L"folders", true); }

bool App::AutostartEnabled() {
    HKEY key = nullptr;
    if (RegOpenKeyExW(HKEY_CURRENT_USER, kRunKey, 0, KEY_READ, &key) != ERROR_SUCCESS) return false;
    wchar_t value[1024]{};
    DWORD size = sizeof(value);
    DWORD type = 0;
    const bool exists =
        RegQueryValueExW(key, kRunValue, nullptr, &type, reinterpret_cast<LPBYTE>(value),
                         &size) == ERROR_SUCCESS;
    RegCloseKey(key);
    return exists;
}

void App::SetAutostart(bool enable) {
    HKEY key = nullptr;
    if (RegCreateKeyExW(HKEY_CURRENT_USER, kRunKey, 0, nullptr, 0, KEY_SET_VALUE, nullptr, &key,
                        nullptr) != ERROR_SUCCESS) {
        return;
    }
    if (enable) {
        std::wstring command = L"\"" + ModulePath() + L"\" --startup";
        RegSetValueExW(key, kRunValue, 0, REG_SZ, reinterpret_cast<const BYTE*>(command.c_str()),
                       static_cast<DWORD>((command.size() + 1) * sizeof(wchar_t)));
        Log("autostart enabled");
    } else {
        RegDeleteValueW(key, kRunValue);
        Log("autostart disabled");
    }
    RegCloseKey(key);
}

void App::SendAppInfo() {
    std::wstring browserVersion = L"WebView2";
    if (webviewLoader_) {
        using GetVersionFn = HRESULT(STDMETHODCALLTYPE*)(PCWSTR, LPWSTR*);
        auto getVersion = reinterpret_cast<GetVersionFn>(
            GetProcAddress(webviewLoader_, "GetAvailableCoreWebView2BrowserVersionString"));
        if (getVersion) {
            LPWSTR version = nullptr;
            if (SUCCEEDED(getVersion(nullptr, &version)) && version) {
                browserVersion = version;
                CoTaskMemFree(version);
            }
        }
    }

    std::string json = "{\"type\":\"appInfo\",\"payload\":{";
    json += "\"version\":\"" + ts::JsonEscape(ts::ToUtf8(kAppVersion)) + "\"";
    json += ",\"webview\":" + JsonString(browserVersion);
    json += ",\"dataDir\":" + JsonString(cacheRoot_);
    json += ",\"theme\":\"";
    json += darkTheme_ ? "dark" : "light";
    json += "\",\"taskbar\":";
    json += showTaskbar_ ? "true" : "false";
    json += "}}";
    PostJson(json);
}

std::wstring App::AppIniPath() const {
    return (std::filesystem::path(cacheRoot_) / L"app.ini").wstring();
}

void App::LoadAppPrefs() {
    const std::wstring file = AppIniPath();
    showTaskbar_ = GetPrivateProfileIntW(L"window", L"Taskbar", 1, file.c_str()) != 0;
}

// 用任务栏 COM 接口增删主窗口按钮：只影响任务栏/Alt-Tab，
// 不改窗口样式，所以标题栏外观保持原样。
void App::ApplyTaskbarButton() {
    if (!hwnd_) return;
    ComPtr<ITaskbarList> taskbar;
    if (FAILED(CoCreateInstance(CLSID_TaskbarList, nullptr, CLSCTX_INPROC_SERVER,
                                IID_ITaskbarList,
                                reinterpret_cast<void**>(taskbar.GetAddressOf()))) ||
        !taskbar) {
        Log("taskbar interface unavailable");
        return;
    }
    taskbar->HrInit();
    if (showTaskbar_) {
        taskbar->AddTab(hwnd_);
    } else {
        taskbar->DeleteTab(hwnd_);
    }
    Log(std::string("taskbar button ") + (showTaskbar_ ? "on" : "off"));
}

void App::ApplyTheme(const std::string& theme) {
    darkTheme_ = theme != "light";
    if (hwnd_) {
        BOOL dark = darkTheme_ ? TRUE : FALSE;
        if (FAILED(DwmSetWindowAttribute(hwnd_, 20, &dark, sizeof(dark)))) {
            DwmSetWindowAttribute(hwnd_, 19, &dark, sizeof(dark));
        }
        InvalidateRect(hwnd_, nullptr, FALSE);
    }
    if (controller_) {
        ComPtr<ICoreWebView2Controller2> controller2;
        if (SUCCEEDED(controller_->QueryInterface(
                IID_ICoreWebView2Controller2, reinterpret_cast<void**>(controller2.GetAddressOf())))) {
            COREWEBVIEW2_COLOR color{};
            if (darkTheme_) {
                color = COREWEBVIEW2_COLOR{255, 8, 11, 20};
            } else {
                color = COREWEBVIEW2_COLOR{255, 246, 247, 251};
            }
            controller2->put_DefaultBackgroundColor(color);
        }
    }
}

void App::PickFolder(const std::string& requestId) {
    ComPtr<IFileOpenDialog> dialog;
    HRESULT hr = CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_ALL,
                                  IID_IFileOpenDialog,
                                  reinterpret_cast<void**>(dialog.GetAddressOf()));
    std::wstring selected;
    if (SUCCEEDED(hr) && dialog) {
        FILEOPENDIALOGOPTIONS options{};
        if (SUCCEEDED(dialog->GetOptions(&options))) {
            dialog->SetOptions(options | FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST);
        }
        dialog->SetTitle(L"选择要处理的文件夹");
        hr = dialog->Show(hwnd_);
        if (SUCCEEDED(hr)) {
            ComPtr<IShellItem> item;
            if (SUCCEEDED(dialog->GetResult(item.GetAddressOf())) && item) {
                PWSTR path = nullptr;
                if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path)) && path) {
                    selected = path;
                    CoTaskMemFree(path);
                }
            }
        }
    }

    std::string json = "{\"type\":\"folderPicked\",\"payload\":{\"requestId\":\"";
    json += ts::JsonEscape(requestId);
    json += "\",\"path\":" + JsonString(selected) + "}}";
    PostJson(json);
}

void App::StartJsonTask(TaskWork work) {
    // 新请求总是顶掉正在运行的主任务；被顶掉的任务转入 retired 池快速收尾，
    // 而不是硬拒绝。这样"上一个任务还在结束"时新任务会排队等待，不会丢失。
    RetireCurrentTask();
    ReapFinishedTasks();
    pendingTasks_.push_back(std::move(work));
    PumpPendingTasks();
}

void App::LaunchMainTask(TaskWork work) {
    auto task = std::make_shared<TaskControl>();
    task->generation = ++scanGeneration_;
    currentTask_ = task;
    const HWND hwnd = hwnd_;
    TaskControl* control = task.get();
    try {
        // Capture a raw pointer, not the shared_ptr: the thread object lives
        // inside TaskControl, so a shared_ptr capture would create a cycle.
        task->thread = std::thread([hwnd, control, work = std::move(work)]() {
            auto progress = [hwnd, control](std::string json) {
                if (control->stopSource.stop_requested()) return;
                auto* message = new TaskJsonMsg{control->generation, std::move(json)};
                if (!PostMessageW(hwnd, kMsgTaskJson, 0, reinterpret_cast<LPARAM>(message))) {
                    delete message;
                }
            };

            std::string done;
            try {
                done = work(control->stopSource.get_token(), control->cancel, progress);
            } catch (const std::exception& error) {
                done = TaskErrorJson(error.what());
            } catch (...) {
                done = TaskErrorJson("任务执行失败");
            }

            if (done.empty()) done = TaskErrorJson("任务没有返回结果");
            auto* message = new TaskJsonMsg{control->generation, std::move(done)};
            if (!PostMessageW(hwnd, kMsgTaskJson, 0, reinterpret_cast<LPARAM>(message))) {
                delete message;
            }
            control->finished.store(true, std::memory_order_release);
        });
    } catch (const std::exception& error) {
        currentTask_.reset();
        PostJson(TaskErrorJson(error.what()));
    }
}

// 只有空闲的主任务槽位才能启动；其余任务留在 pending 队列里等待。
void App::PumpPendingTasks() {
    if (currentTask_) return;
    if (pendingTasks_.empty()) return;
    auto work = std::move(pendingTasks_.front());
    pendingTasks_.erase(pendingTasks_.begin());
    LaunchMainTask(std::move(work));
}

void App::StartAuxTask(TaskWork work) {
    ReapAuxTasks();
    // 辅助任务可排队：超过 2 个并发时进入队列，不再拒绝。
    pendingAux_.push_back(std::move(work));
    PumpAuxTasks();
}

void App::LaunchAuxTask(TaskWork work) {
    auto task = std::make_shared<TaskControl>();
    task->generation = kAuxGeneration;
    auxTasks_.push_back(task);
    TaskControl* control = task.get();
    const HWND hwnd = hwnd_;
    try {
        task->thread = std::thread([hwnd, control, work = std::move(work)]() {
            auto progress = [hwnd, control](std::string json) {
                auto* message = new TaskJsonMsg{control->generation, std::move(json)};
                if (!PostMessageW(hwnd, kMsgTaskJson, 0, reinterpret_cast<LPARAM>(message))) {
                    delete message;
                }
            };
            std::string done;
            try {
                done = work(std::stop_token{}, control->cancel, progress);
            } catch (const std::exception& error) {
                done = TaskErrorJson(error.what());
            } catch (...) {
                done = TaskErrorJson("后台任务执行失败");
            }
            if (done.empty()) done = TaskErrorJson("后台任务没有返回结果");
            auto* message = new TaskJsonMsg{control->generation, std::move(done)};
            if (!PostMessageW(hwnd, kMsgTaskJson, 0, reinterpret_cast<LPARAM>(message))) {
                delete message;
            }
            control->finished.store(true, std::memory_order_release);
        });
    } catch (const std::exception& error) {
        auxTasks_.pop_back();
        PostJson(TaskErrorJson(error.what()));
    }
}

void App::PumpAuxTasks() {
    while (auxTasks_.size() < 2 && !pendingAux_.empty()) {
        auto work = std::move(pendingAux_.front());
        pendingAux_.erase(pendingAux_.begin());
        LaunchAuxTask(std::move(work));
    }
}

void App::ReapAuxTasks() {
    for (auto it = auxTasks_.begin(); it != auxTasks_.end();) {
        if (!(*it)->finished.load(std::memory_order_acquire)) {
            ++it;
            continue;
        }
        if ((*it)->thread.joinable()) (*it)->thread.join();
        it = auxTasks_.erase(it);
    }
    // 有空位时补进排队的辅助任务。
    PumpAuxTasks();
}

void App::ShutdownAuxTasks() {
    pendingAux_.clear();
    for (const auto& task : auxTasks_) {
        task->cancel.store(true, std::memory_order_release);
        task->stopSource.request_stop();
    }
    for (const auto& task : auxTasks_) {
        if (task->thread.joinable()) task->thread.join();
    }
    auxTasks_.clear();
}

void App::RetireCurrentTask() {
    if (!currentTask_) return;
    currentTask_->cancel.store(true, std::memory_order_release);
    currentTask_->stopSource.request_stop();
    retiredTasks_.push_back(currentTask_);
    currentTask_.reset();
}

void App::ReapFinishedTasks() {
    for (auto it = retiredTasks_.begin(); it != retiredTasks_.end();) {
        if (!(*it)->finished.load(std::memory_order_acquire)) {
            ++it;
            continue;
        }
        if ((*it)->thread.joinable()) (*it)->thread.join();
        it = retiredTasks_.erase(it);
    }
    // 回收后可能有空闲槽位，尝试启动排队的任务。
    PumpPendingTasks();
}

void App::ShutdownTasks() {
    // 关闭时清空排队中的任务：不再执行，也不回发结果。
    pendingTasks_.clear();
    RetireCurrentTask();
    for (const auto& task : retiredTasks_) {
        task->cancel.store(true, std::memory_order_release);
        task->stopSource.request_stop();
    }
    for (const auto& task : retiredTasks_) {
        if (task->thread.joinable()) task->thread.join();
    }
    retiredTasks_.clear();
    currentTask_.reset();
}

void App::SetZoom(double factor) {
    if (!controller_) return;
    factor = std::clamp(factor, 0.8, 2.0);
    controller_->put_ZoomFactor(factor);
}

void App::PickFile(const std::string& requestId, const std::string& target) {
    ComPtr<IFileOpenDialog> dialog;
    HRESULT hr = CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_ALL,
                                  IID_IFileOpenDialog,
                                  reinterpret_cast<void**>(dialog.GetAddressOf()));
    std::wstring selected;
    if (SUCCEEDED(hr) && dialog) {
        FILEOPENDIALOGOPTIONS options{};
        if (SUCCEEDED(dialog->GetOptions(&options))) {
            dialog->SetOptions(options | FOS_FILEMUSTEXIST | FOS_FORCEFILESYSTEM |
                               FOS_PATHMUSTEXIST);
        }
        dialog->SetTitle(L"选择文件");
        hr = dialog->Show(hwnd_);
        if (SUCCEEDED(hr)) {
            ComPtr<IShellItem> item;
            if (SUCCEEDED(dialog->GetResult(item.GetAddressOf())) && item) {
                PWSTR path = nullptr;
                if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path)) && path) {
                    selected = path;
                    CoTaskMemFree(path);
                }
            }
        }
    }

    std::string json = "{\"type\":\"filePicked\",\"payload\":{\"requestId\":\"";
    json += ts::JsonEscape(requestId);
    json += "\",\"target\":\"" + ts::JsonEscape(target);
    json += "\",\"path\":" + JsonString(selected) + "}}";
    PostJson(json);
}

// "名称|*.a;*.b|名称2|*.c" -> COMDLG_FILTERSPEC 列表；storage 保证字符串生命周期。
std::vector<COMDLG_FILTERSPEC> ParseFilterSpec(const std::string& filter,
                                               std::vector<std::wstring>& storage) {
    storage.clear();
    std::vector<std::string> parts;
    std::string current;
    for (char c : filter) {
        if (c == '|') {
            parts.push_back(current);
            current.clear();
        } else {
            current += c;
        }
    }
    if (!current.empty()) parts.push_back(current);
    for (size_t i = 0; i + 1 < parts.size(); i += 2) {
        storage.push_back(FromUtf8(parts[i]));
        storage.push_back(FromUtf8(parts[i + 1]));
    }
    std::vector<COMDLG_FILTERSPEC> specs;
    for (size_t i = 0; i + 1 < storage.size(); i += 2) {
        specs.push_back({storage[i].c_str(), storage[i + 1].c_str()});
    }
    return specs;
}

std::string Base64Encode(const std::vector<unsigned char>& data) {
    static const char kTable[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;
    out.reserve((data.size() + 2) / 3 * 4);
    for (size_t i = 0; i < data.size(); i += 3) {
        unsigned value = static_cast<unsigned>(data[i]) << 16;
        if (i + 1 < data.size()) value |= static_cast<unsigned>(data[i + 1]) << 8;
        if (i + 2 < data.size()) value |= static_cast<unsigned>(data[i + 2]);
        out += kTable[(value >> 18) & 63];
        out += kTable[(value >> 12) & 63];
        out += i + 1 < data.size() ? kTable[(value >> 6) & 63] : '=';
        out += i + 2 < data.size() ? kTable[value & 63] : '=';
    }
    return out;
}

bool Base64Decode(const std::string& input, std::vector<unsigned char>& out) {
    auto valueOf = [](char c) -> int {
        if (c >= 'A' && c <= 'Z') return c - 'A';
        if (c >= 'a' && c <= 'z') return c - 'a' + 26;
        if (c >= '0' && c <= '9') return c - '0' + 52;
        if (c == '+') return 62;
        if (c == '/') return 63;
        return -1;
    };
    out.clear();
    out.reserve(input.size() / 4 * 3);
    int buffer = 0;
    int bits = 0;
    for (char c : input) {
        if (c == '=' || c == '\r' || c == '\n') continue;
        const int v = valueOf(c);
        if (v < 0) return false;
        buffer = (buffer << 6) | v;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            out.push_back(static_cast<unsigned char>((buffer >> bits) & 0xFF));
        }
    }
    return true;
}

void App::PickFiles(const std::string& requestId, const std::string& title,
                    const std::string& filter) {
    ComPtr<IFileOpenDialog> dialog;
    HRESULT hr = CoCreateInstance(CLSID_FileOpenDialog, nullptr, CLSCTX_ALL,
                                  IID_IFileOpenDialog,
                                  reinterpret_cast<void**>(dialog.GetAddressOf()));
    std::vector<std::wstring> picked;
    if (SUCCEEDED(hr) && dialog) {
        FILEOPENDIALOGOPTIONS options{};
        if (SUCCEEDED(dialog->GetOptions(&options))) {
            dialog->SetOptions(options | FOS_FILEMUSTEXIST | FOS_FORCEFILESYSTEM |
                               FOS_PATHMUSTEXIST | FOS_ALLOWMULTISELECT);
        }
        dialog->SetTitle(FromUtf8(title).c_str());
        std::vector<std::wstring> storage;
        auto specs = ParseFilterSpec(filter, storage);
        if (!specs.empty()) dialog->SetFileTypes(static_cast<UINT>(specs.size()), specs.data());
        hr = dialog->Show(hwnd_);
        if (SUCCEEDED(hr)) {
            ComPtr<IShellItemArray> results;
            if (SUCCEEDED(dialog->GetResults(results.GetAddressOf())) && results) {
                DWORD count = 0;
                results->GetCount(&count);
                for (DWORD i = 0; i < count; ++i) {
                    ComPtr<IShellItem> item;
                    if (FAILED(results->GetItemAt(i, item.GetAddressOf())) || !item) continue;
                    PWSTR path = nullptr;
                    if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path)) && path) {
                        picked.emplace_back(path);
                        CoTaskMemFree(path);
                    }
                }
            }
        }
    }

    std::string json = "{\"type\":\"filesPicked\",\"payload\":{\"requestId\":\"";
    json += ts::JsonEscape(requestId);
    json += "\",\"paths\":[";
    for (size_t i = 0; i < picked.size(); ++i) {
        if (i) json += ',';
        json += JsonString(picked[i]);
    }
    json += "]}}";
    PostJson(json);
}

std::string App::ReadFileAsBase64Json(const std::string& requestId, const std::string& pathUtf8) {
    const std::wstring path = FromUtf8(pathUtf8);
    // Selected documents are normally small. A
    // larger cap turns into a base64 + JSON + UTF-16 copy and can freeze or
    // exhaust WebView2; reject early instead.
    constexpr uint64_t kMaxReadBytes = 32ull * 1024 * 1024;

    std::string error;
    std::vector<unsigned char> bytes;
    HANDLE handle = CreateFileW(NativeLongPath(path).c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE,
                                nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (handle == INVALID_HANDLE_VALUE) {
        error = "无法打开文件";
    } else {
        LARGE_INTEGER size{};
        if (!GetFileSizeEx(handle, &size) || size.QuadPart < 0 ||
            static_cast<uint64_t>(size.QuadPart) > kMaxReadBytes) {
            error = "文件超过 32MB，超出读取限制";
        } else {
            bytes.resize(static_cast<size_t>(size.QuadPart));
            DWORD read = 0;
            if (!bytes.empty() &&
                (!ReadFile(handle, bytes.data(), static_cast<DWORD>(bytes.size()), &read,
                           nullptr) ||
                 read != bytes.size())) {
                error = "读取文件失败";
            }
        }
        CloseHandle(handle);
    }

    std::string json = "{\"type\":\"fileContent\",\"payload\":{\"requestId\":\"";
    json += ts::JsonEscape(requestId);
    json += "\",\"path\":" + JsonString(path);
    if (error.empty()) {
        json += ",\"size\":" + std::to_string(bytes.size());
        json += ",\"b64\":\"" + Base64Encode(bytes) + "\"";
    } else {
        json += ",\"error\":\"" + ts::JsonEscape(error) + "\"";
    }
    json += "}}";
    return json;
}

void App::ExportFile(const std::string& requestId, const std::string& suggestedName,
                     const std::string& filter, const std::string& contentB64) {
    ComPtr<IFileSaveDialog> dialog;
    HRESULT hr = CoCreateInstance(CLSID_FileSaveDialog, nullptr, CLSCTX_ALL,
                                  IID_IFileSaveDialog,
                                  reinterpret_cast<void**>(dialog.GetAddressOf()));
    std::wstring saved;
    std::string error;
    if (FAILED(hr) || !dialog) {
        error = "无法创建保存对话框";
    } else {
        FILEOPENDIALOGOPTIONS options{};
        if (SUCCEEDED(dialog->GetOptions(&options))) {
            dialog->SetOptions(options | FOS_OVERWRITEPROMPT | FOS_FORCEFILESYSTEM);
        }
        dialog->SetFileName(FromUtf8(suggestedName).c_str());
        std::vector<std::wstring> storage;
        auto specs = ParseFilterSpec(filter, storage);
        if (!specs.empty()) {
            dialog->SetFileTypes(static_cast<UINT>(specs.size()), specs.data());
            dialog->SetFileTypeIndex(1);
        }
        hr = dialog->Show(hwnd_);
        if (SUCCEEDED(hr)) {
            ComPtr<IShellItem> item;
            if (SUCCEEDED(dialog->GetResult(item.GetAddressOf())) && item) {
                PWSTR path = nullptr;
                if (SUCCEEDED(item->GetDisplayName(SIGDN_FILESYSPATH, &path)) && path) {
                    saved = path;
                    CoTaskMemFree(path);
                }
            }
        } else if (hr == HRESULT_FROM_WIN32(ERROR_CANCELLED)) {
            error = "cancelled";
        } else {
            error = "保存对话框失败";
        }
    }

    // 确定要写入目标时，把 base64 解码 + 落盘放到工作线程，避免大文件写盘
    // 阻塞 UI；对话框与错误路径仍在 UI 线程同步回包。
    if (saved.empty()) {
        std::string json = "{\"type\":\"fileExported\",\"payload\":{\"requestId\":\"";
        json += ts::JsonEscape(requestId);
        json += "\",\"ok\":false";
        json += ",\"path\":" + JsonString(std::wstring()) + "}";
        if (!error.empty()) json += ",\"error\":\"" + ts::JsonEscape(error) + "\"";
        json += "}}";
        PostJson(json);
        return;
    }

    StartExportWrite(std::move(saved), contentB64, requestId);
}

void App::StartExportWrite(std::wstring saved, std::string contentB64,
                           std::string requestId) {
    ReapExportWriteThreads();
    const HWND hwnd = hwnd_;
    auto job = std::make_shared<RecycleJob>();  // 复用带 finished 标志 + thread 的结构
    exportWriteThreads_.push_back(job);
    RecycleJob* jobPtr = job.get();
    try {
        job->thread = std::thread([hwnd, jobPtr, saved = std::move(saved),
                                    contentB64 = std::move(contentB64),
                                    requestId = std::move(requestId)]() {
            std::string error;
            bool ok = false;
            std::vector<unsigned char> bytes;
            if (Base64Decode(contentB64, bytes)) {
                HANDLE handle = CreateFileW(NativeLongPath(saved).c_str(), GENERIC_WRITE, 0,
                                            nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL,
                                            nullptr);
                if (handle != INVALID_HANDLE_VALUE) {
                    DWORD written = 0;
                    ok = bytes.empty() ||
                         (WriteFile(handle, bytes.data(),
                                     static_cast<DWORD>(bytes.size()), &written, nullptr) &&
                          written == bytes.size());
                    CloseHandle(handle);
                    if (!ok) error = "写入文件失败";
                } else {
                    error = "无法创建文件";
                }
            } else {
                error = "数据解码失败";
            }

            auto* message = new ExportDoneMsg{ok, requestId, saved, error};
            if (!PostMessageW(hwnd, kMsgExportDone, 0,
                              reinterpret_cast<LPARAM>(message))) {
                delete message;
            }
            jobPtr->finished.store(true, std::memory_order_release);
        });
    } catch (...) {
        // 线程创建失败：回退为同步回包，保证请求一定有响应。
        exportWriteThreads_.pop_back();
        std::string json = "{\"type\":\"fileExported\",\"payload\":{\"requestId\":\"";
        json += ts::JsonEscape(requestId);
        json += "\",\"ok\":false,\"path\":" + JsonString(saved) +
                ",\"error\":\"启动写入线程失败\"}}";
        PostJson(json);
    }
}

// 导出写盘完成后回到 UI 线程，顺带回收已完成的线程，避免运行期积压句柄。
void App::ReapExportWriteThreads() {
    for (auto it = exportWriteThreads_.begin(); it != exportWriteThreads_.end();) {
        if (!(*it)->finished.load(std::memory_order_acquire)) {
            ++it;
            continue;
        }
        if ((*it)->thread.joinable()) (*it)->thread.join();
        it = exportWriteThreads_.erase(it);
    }
}

void App::ShutdownExportJobs() {
    // 关闭时等待所有仍在运行的写盘线程结束。
    for (auto& job : exportWriteThreads_) {
        if (job->thread.joinable()) job->thread.join();
    }
    exportWriteThreads_.clear();
}

void App::StartLargeScan(const std::vector<std::wstring>& roots, uint64_t minSize, bool includeHidden) {
    ts::LargeScanOptions options;
    options.roots = roots;  // 空数组由扫描器解释成"全部本地磁盘"
    options.minSize = minSize;
    options.includeHidden = includeHidden;
    options.maxResults = 1000;

    StartJsonTask([options = std::move(options)](std::stop_token stopToken,
                                                 const std::atomic<bool>& cancel,
                                                 TaskProgress progress) {
        auto result = ts::ScanLargeFiles(
            options, cancel, [&progress](const ts::ScanProgress& stats) {
                std::string json = "{\"type\":\"scanProgress\",\"payload\":{";
                json += StatsJson(stats);
                json += ",\"current\":" + JsonString(stats.current) + "}}";
                progress(std::move(json));
            });
        (void)stopToken;
        if (!result.error.empty()) return ErrorJson(result.error);
        return LargeDoneJson(result);
    });
}

void App::StartEmptyScan(const std::vector<std::wstring>& roots) {
    StartJsonTask([roots](std::stop_token stopToken,
                             const std::atomic<bool>& cancel,
                             TaskProgress progress) {
        auto result = ts::ScanEmptyFolders(
            roots, cancel, [&progress](const ts::ScanProgress& stats) {
                std::string json = "{\"type\":\"scanProgress\",\"payload\":{";
                json += StatsJson(stats);
                json += ",\"current\":" + JsonString(stats.current) + "}}";
                progress(std::move(json));
            });
        (void)stopToken;
        if (!result.error.empty()) return ErrorJson(result.error);
        return EmptyDoneJson(result);
    });
}

void App::StartUnlockCheck(const std::wstring& path, const std::string& mode) {
    StartJsonTask([path, mode](std::stop_token stopToken, const std::atomic<bool>& cancel,
                               TaskProgress progress) {
        (void)stopToken;
        (void)cancel;
        (void)progress;
        const ts::LockResult result = (mode == "folder")
            ? ts::FindFolderLockers(path)
            : ts::FindLockers(path);
        return UnlockJson(result);
    });
}

void App::StartKillProcess(uint32_t pid) {
    StartJsonTask([pid](std::stop_token stopToken, const std::atomic<bool>& cancel,
                        TaskProgress progress) {
        (void)stopToken;
        (void)cancel;
        (void)progress;
        std::wstring error;
        const bool ok = ts::TerminateProcessById(pid, error);
        return KillJson(ok, error);
    });
}

void App::CancelScan() {
    if (currentTask_) {
        currentTask_->cancel.store(true, std::memory_order_release);
        currentTask_->stopSource.request_stop();
    }
}

void App::StartFileSearch(const std::string& root, const std::string& pattern,
                          uint64_t minSize, int64_t modifiedWithinMs,
                          bool includeHidden, bool recursive) {
    ts::SearchOptions options;
    options.root = FromUtf8(root);
    options.patterns = FromUtf8(pattern);
    options.minSize = minSize;
    options.modifiedWithinMs = modifiedWithinMs;
    options.includeHidden = includeHidden;
    options.recursive = recursive;
    options.maxResults = 5000;
    StartJsonTask([options = std::move(options)](std::stop_token stopToken,
                                                const std::atomic<bool>& cancel,
                                                TaskProgress progress) {
        std::string done = SearchDoneJson(ts::SearchFiles(
            options, cancel, [&progress](const ts::ScanProgress& stats) {
                std::string json = "{\"type\":\"searchProgress\",\"payload\":{";
                json += StatsJson(stats);
                json += ",\"current\":" + JsonString(stats.current) + "}}";
                progress(std::move(json));
            }));
        (void)stopToken;
        return done;
    });
}

void App::StartFolderCompare(const std::string& rootA, const std::string& rootB, bool compareContent) {
    const std::wstring wideA = FromUtf8(rootA);
    const std::wstring wideB = FromUtf8(rootB);
    StartJsonTask([wideA, wideB, compareContent](std::stop_token stopToken,
                                 const std::atomic<bool>& cancel,
                                 TaskProgress progress) {
        std::string done = FolderDiffJson(ts::CompareFolders(
            wideA, wideB, cancel, [&progress](const ts::ScanProgress& stats) {
                std::string json = "{\"type\":\"compareProgress\",\"payload\":{";
                json += StatsJson(stats);
                json += ",\"current\":" + JsonString(stats.current) + "}}";
                progress(std::move(json));
            }, compareContent));
        (void)stopToken;
        return done;
    });
}

void App::StartFileCopy(std::vector<std::pair<std::wstring, std::wstring>> pairs) {
    StartJsonTask([pairs = std::move(pairs)](std::stop_token stopToken,
                                             const std::atomic<bool>& cancel,
                                             TaskProgress progress) {
        auto outcome = ts::CopyFilePairs(
            pairs, cancel,
            [&progress](uint64_t copied, uint64_t total, const std::wstring& current) {
                std::string json = "{\"type\":\"copyProgress\",\"payload\":{\"copied\":" +
                    std::to_string(copied) + ",\"total\":" + std::to_string(total) +
                    ",\"current\":" + JsonString(current) + "}}";
                progress(std::move(json));
            });
        (void)stopToken;
        return CopyDoneJson(outcome, "copyDone");
    });
}

void App::StartFileRename(std::vector<std::pair<std::wstring, std::wstring>> pairs,
                          std::string requestId) {
    StartJsonTask([pairs = std::move(pairs),
                   requestId = std::move(requestId)](std::stop_token stopToken,
                                                     const std::atomic<bool>& cancel,
                                                     TaskProgress) {
        (void)stopToken;
        auto json = CopyDoneJson(ts::RenameFilePairs(pairs, cancel), "renamePairsDone");
        if (!requestId.empty()) {
            // 注入 requestId，便于前端按请求精确匹配撤销结果
            const std::string marker = "\"payload\":{";
            const size_t pos = json.find(marker);
            if (pos != std::string::npos) {
                json.insert(pos + marker.size(),
                            "\"requestId\":\"" + ts::JsonEscape(requestId) + "\",");
            }
        }
        return json;
    });
}

void App::ReapRecycleJobs() {
    for (auto it = recycleJobs_.begin(); it != recycleJobs_.end();) {
        if (!(*it)->finished.load(std::memory_order_acquire)) {
            ++it;
            continue;
        }
        if ((*it)->thread.joinable()) (*it)->thread.join();
        it = recycleJobs_.erase(it);
    }
    // 有空位时，把排队中的请求补进执行。
    PumpRecycleQueue();
}

void App::ShutdownRecycleJobs() {
    // 关闭时清空排队中的请求；已执行的线程仍等待收尾。
    pendingRecycle_.clear();
    for (const auto& job : recycleJobs_) {
        if (job->thread.joinable()) job->thread.join();
    }
    recycleJobs_.clear();
}

// 从排队队列取请求，补到执行中的槽位（最多同时 2 个）。
void App::PumpRecycleQueue() {
    while (recycleJobs_.size() < 2 && !pendingRecycle_.empty()) {
        auto item = std::move(pendingRecycle_.front());
        pendingRecycle_.erase(pendingRecycle_.begin());
        LaunchRecycleJob(std::move(item));
    }
}

void App::LaunchRecycleJob(RecyclePending item) {
    const HWND hwnd = hwnd_;
    const std::string errorRequestId = item.requestId;
    auto job = std::make_shared<RecycleJob>();
    recycleJobs_.push_back(job);
    RecycleJob* jobPtr = job.get();
    try {
        // Raw pointer avoids a shared_ptr cycle through the thread object.
        job->thread = std::thread([hwnd, jobPtr, paths = std::move(item.paths),
                                   requestId = std::move(item.requestId)]() mutable {
            const HRESULT init = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
            bool ok = false;
            try {
                ok = RecycleImpl(paths);
            } catch (...) {
                ok = false;
            }
            if (SUCCEEDED(init)) CoUninitialize();

            auto* message = new RecycleDoneMsg{ok, paths.size(), requestId,
                                               ok ? L"" : L"回收站操作未完成"};
            if (!PostMessageW(hwnd, kMsgRecycleDone, 0, reinterpret_cast<LPARAM>(message))) {
                delete message;
            }
            jobPtr->finished.store(true, std::memory_order_release);
        });
    } catch (const std::exception& error) {
        recycleJobs_.pop_back();
        std::string json = "{\"type\":\"recycleDone\",\"payload\":{\"ok\":false,\"count\":0";
        json += ",\"requestId\":" + JsonString(FromUtf8(errorRequestId));
        json += ",\"message\":" + JsonString(FromUtf8(error.what())) + "}}";
        PostJson(json);
    }
}

// 回收站操作可排队：超过 2 个并发时不再失败，而是进入队列按序执行。
void App::RecyclePaths(std::vector<std::wstring> paths, std::string requestId) {
    ReapRecycleJobs();
    pendingRecycle_.push_back(RecyclePending{std::move(paths), std::move(requestId)});
    PumpRecycleQueue();
}


namespace {
int GetPngEncoderClsid(CLSID* pClsid) {
    UINT num = 0;
    UINT size = 0;
    Gdiplus::GetImageEncodersSize(&num, &size);
    if (size == 0) return -1;
    std::vector<BYTE> buffer(size);
    auto* pInfo = reinterpret_cast<Gdiplus::ImageCodecInfo*>(buffer.data());
    Gdiplus::GetImageEncoders(num, size, pInfo);
    for (UINT i = 0; i < num; ++i) {
        if (wcscmp(pInfo[i].MimeType, L"image/png") == 0) {
            *pClsid = pInfo[i].Clsid;
            return static_cast<int>(i);
        }
    }
    return -1;
}
}  // namespace

void App::StartScreenCapture(bool region) {
    if (screenCaptureInProgress_) {
        PostJson("{\"type\":\"screenCaptureDone\",\"payload\":{\"ok\":false}}");
        return;
    }
    // 回收已推送到超时池中、已经跑完的截图线程，防止在超时频发时积压句柄。只
    // join 已结束(置过 finished)的线程，避免阻塞 UI。
    ReapTimedOutScreenThreads();
    if (screenCaptureThread_.joinable()) screenCaptureThread_.join();
    const uint64_t generation = ++screenCaptureGeneration_;

    const CaptureWindowState state = HideWindowForCapture(hwnd_);
    screenCapturePrevFore_ = state.previousForeground;
    screenCapturePrevAffinity_ = state.previousAffinity;
    screenCaptureHadAffinity_ = state.hadAffinity;
    screenCaptureExcluded_ = state.excluded;
    screenCaptureInProgress_ = true;

    const HWND hwnd = hwnd_;
    SetTimer(hwnd_, 6, 15000, nullptr);
    try {
        screenCaptureThread_ = std::thread([this, hwnd, region, generation]() {
            auto* message = new ScreenCaptureMsg;
            message->generation = generation;
            message->region = region;
            try {
                if (region) {
                    message->dataUrl = CaptureScreenToDataUrl(message->ok);
                } else {
                    message->path = CaptureScreenToFile();
                    message->ok = !message->path.empty();
                }
            } catch (...) {
                message->ok = false;
            }
            if (!PostMessageW(hwnd, kMsgScreenCaptureDone, 0,
                              reinterpret_cast<LPARAM>(message))) {
                delete message;
            }
        });
    } catch (...) {
        screenCaptureInProgress_ = false;
        RestoreWindowAfterCapture(state);
        PostJson("{\"type\":\"screenCaptureDone\",\"payload\":{\"ok\":false}}");
    }
}

// 回收超时池中已结束的截图线程。截图线程不响应取消，会自行跑完后回包；但其
// 完成消息因代次过期会被 FinishScreenCapture 丢弃，因此超时后无法凭消息回收。
// 采用兜底策略：在每次新截图前，把池里线程全部 join（截图线程通常秒级完成，
// 只在快速连续触发超时、且旧线程尚未结束时会有轻微等待）。
void App::ReapTimedOutScreenThreads() {
    for (auto it = timedOutScreenThreads_.begin(); it != timedOutScreenThreads_.end();) {
        if ((*it)->thread.joinable()) (*it)->thread.join();
        it = timedOutScreenThreads_.erase(it);
    }
}

void App::FinishScreenCapture(void* payload) {
    std::unique_ptr<ScreenCaptureMsg> message(static_cast<ScreenCaptureMsg*>(payload));
    if (!screenCaptureInProgress_ || message->generation != screenCaptureGeneration_) return;
    KillTimer(hwnd_, 6);
    CaptureWindowState state;
    state.hwnd = hwnd_;
    state.previousForeground = screenCapturePrevFore_;
    state.previousAffinity = screenCapturePrevAffinity_;
    state.hadAffinity = screenCaptureHadAffinity_;
    state.excluded = screenCaptureExcluded_;
    RestoreWindowAfterCapture(state);
    screenCaptureInProgress_ = false;
    if (screenCaptureThread_.joinable()) screenCaptureThread_.join();
    screenCaptureThread_ = std::thread();

    std::string json;
    if (message->region) {
        json = "{\"type\":\"screenCaptureDone\",\"payload\":{\"ok\":";
        json += message->ok ? "true" : "false";
        json += ",\"dataUrl\":\"" + message->dataUrl + "\"}}";
    } else {
        json = "{\"type\":\"screenCaptureDone\",\"payload\":{\"ok\":";
        json += message->ok ? "true" : "false";
        json += ",\"path\":" + JsonString(message->path) + "}}";
    }
    PostJson(json);
}

void App::HandleScreenCaptureTimeout() {
    if (!screenCaptureInProgress_) return;
    KillTimer(hwnd_, 6);
    CaptureWindowState state;
    state.hwnd = hwnd_;
    state.previousForeground = screenCapturePrevFore_;
    state.previousAffinity = screenCapturePrevAffinity_;
    state.hadAffinity = screenCaptureHadAffinity_;
    state.excluded = screenCaptureExcluded_;
    RestoreWindowAfterCapture(state);
    screenCaptureInProgress_ = false;
    if (screenCaptureThread_.joinable()) {
        auto job = std::make_shared<RecycleJob>();
        job->thread = std::move(screenCaptureThread_);
        timedOutScreenThreads_.push_back(std::move(job));
    }
    ++screenCaptureGeneration_;
    PostJson("{\"type\":\"screenCaptureDone\",\"payload\":{\"ok\":false}}");
}

void App::ShutdownScreenCapture() {
    KillTimer(hwnd_, 6);
    if (screenCaptureInProgress_) {
        CaptureWindowState state;
        state.hwnd = hwnd_;
        state.previousForeground = screenCapturePrevFore_;
        state.previousAffinity = screenCapturePrevAffinity_;
        state.hadAffinity = screenCaptureHadAffinity_;
        state.excluded = screenCaptureExcluded_;
        RestoreWindowAfterCapture(state);
        screenCaptureInProgress_ = false;
    }
    if (screenCaptureThread_.joinable()) screenCaptureThread_.join();
    for (auto& job : timedOutScreenThreads_) {
        if (job->thread.joinable()) job->thread.join();
    }
    timedOutScreenThreads_.clear();
}

std::wstring App::CaptureScreenToFile() {
    EnsureGdiplus();
    // GDI+ 非线程安全，须持锁串行化（与后台元数据线程/剪贴板线程隔离）。
    std::lock_guard<std::mutex> gdiplusLock(tb::GdiplusSync());

    std::filesystem::path dir = std::filesystem::path(cacheRoot_) / L"screenshots";
    std::error_code ec;
    std::filesystem::create_directories(dir, ec);

    SYSTEMTIME st{};
    GetLocalTime(&st);
    wchar_t stamp[64]{};
    swprintf_s(stamp, L"_%04d%02d%02d-%02d%02d%02d-%03d",
               st.wYear, st.wMonth, st.wDay, st.wHour, st.wMinute, st.wSecond,
               st.wMilliseconds);
    const std::wstring file = dir.native() + L"\\截图" + stamp + L".png";

    // 多显示器虚拟桌面范围
    const int vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
    const int vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
    const int width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
    const int height = GetSystemMetrics(SM_CYVIRTUALSCREEN);

    HDC screen = GetDC(nullptr);
    if (!screen) return {};

    bool saved = false;
    BITMAPINFO bmi{};
    bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bmi.bmiHeader.biWidth = width;
    bmi.bmiHeader.biHeight = -height;  // 自顶向下
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB;
    void* bits = nullptr;
    HBITMAP dib = CreateDIBSection(screen, &bmi, DIB_RGB_COLORS, &bits, nullptr, 0);
    if (dib) {
        HDC dibDC = CreateCompatibleDC(screen);
        HGDIOBJ oldDib = SelectObject(dibDC, dib);
        const BOOL copied = BitBlt(dibDC, 0, 0, width, height, screen, vx, vy,
                                   SRCCOPY | CAPTUREBLT);
        SelectObject(dibDC, oldDib);
        DeleteDC(dibDC);
        if (copied) {
            Gdiplus::Bitmap bitmap(dib, nullptr);
            CLSID pngClsid;
            if (GetPngEncoderClsid(&pngClsid) >= 0) {
                bitmap.Save(file.c_str(), &pngClsid, nullptr);
                saved = std::filesystem::exists(file, ec);
            }
        }
        DeleteObject(dib);
    }

    ReleaseDC(nullptr, screen);
    return saved ? file : std::wstring();
}

std::string App::CaptureScreenToDataUrl(bool& ok) {
    EnsureGdiplus();
    // GDI+ 非线程安全，须持锁串行化（与后台元数据线程/剪贴板线程隔离）。
    std::lock_guard<std::mutex> gdiplusLock(tb::GdiplusSync());
    ok = false;
    const int vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
    const int vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
    const int width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
    const int height = GetSystemMetrics(SM_CYVIRTUALSCREEN);

    HDC screen = GetDC(nullptr);
    if (!screen) return {};

    BITMAPINFO bmi{};
    bmi.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
    bmi.bmiHeader.biWidth = width;
    bmi.bmiHeader.biHeight = -height;
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = BI_RGB;
    void* bits = nullptr;
    HBITMAP dib = CreateDIBSection(screen, &bmi, DIB_RGB_COLORS, &bits, nullptr, 0);

    std::string dataUrl;
    if (dib) {
        HDC dibDC = CreateCompatibleDC(screen);
        HGDIOBJ oldDib = SelectObject(dibDC, dib);
        const BOOL copied = BitBlt(dibDC, 0, 0, width, height, screen, vx, vy,
                                   SRCCOPY | CAPTUREBLT);
        SelectObject(dibDC, oldDib);
        DeleteDC(dibDC);
        if (copied) {
            Gdiplus::Bitmap bitmap(dib, nullptr);
            CLSID pngClsid;
            if (GetPngEncoderClsid(&pngClsid) >= 0) {
                IStream* stream = nullptr;
                if (SUCCEEDED(CreateStreamOnHGlobal(nullptr, TRUE, &stream)) && stream) {
                    if (bitmap.Save(stream, &pngClsid, nullptr) == Gdiplus::Ok) {
                        STATSTG stat{};
                        if (stream->Stat(&stat, STATFLAG_NONAME) == S_OK) {
                            const ULONG size = stat.cbSize.LowPart;
                            std::vector<unsigned char> bytes(size);
                            LARGE_INTEGER origin{};
                            stream->Seek(origin, STREAM_SEEK_SET, nullptr);
                            ULONG read = 0;
                            if (stream->Read(bytes.data(), size, &read) == S_OK && read == size) {
                                dataUrl = "data:image/png;base64," + Base64Encode(bytes);
                                ok = !bytes.empty();
                            }
                        }
                    }
                    stream->Release();
                }
            }
        }
        DeleteObject(dib);
    }

    ReleaseDC(nullptr, screen);
    return dataUrl;
}

void App::CaptureScreenshot() {
    if (!webview_ || screenshotPath_.empty()) return;
    Log("CaptureScreenshot start");
    ComPtr<IStream> stream;
    HRESULT hr = SHCreateStreamOnFileEx(NativeLongPath(screenshotPath_).c_str(),
                                        STGM_CREATE | STGM_WRITE | STGM_SHARE_DENY_NONE,
                                        FILE_ATTRIBUTE_NORMAL, TRUE, nullptr,
                                        stream.GetAddressOf());
    if (FAILED(hr) || !stream) {
        OnCaptureCompleted(hr);
        return;
    }

    auto* captureHandler = new CaptureHandler(this);
    hr = webview_->CapturePreview(COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,
                                  stream.Get(), captureHandler);
    LogHr("CapturePreview", hr);
    // CapturePreview 内部会自行 AddRef，这里释放调用方持有的初始引用，避免 COM 对象泄漏。
    captureHandler->Release();
    if (FAILED(hr)) OnCaptureCompleted(hr);
}

void App::OnNavigationCompleted(bool success) {
    Log(std::string("NavigationCompleted success=") + (success ? "1" : "0"));
    if (!screenshotMode_) {
        // 首页渲染完成：收起启动窗口，显示主界面
        if (!mainShown_) {
            mainShown_ = true;
            CloseSplash();
            if (!startHidden_) {
                ShowWindow(hwnd_, SW_SHOW);
                UpdateWindow(hwnd_);
                SetForegroundWindow(hwnd_);
                Log("main window shown");
            } else {
                Log("main window kept hidden (startup mode)");
            }
        }
        if (showPanelAtStart_) {
            showPanelAtStart_ = false;
            ShowMiniWindow(L"folders", false);
        }
        return;
    }
    if (!success) {
        screenshotOk_ = false;
        PostMessageW(hwnd_, kMsgCaptureDone, 0, 0);
        return;
    }
    SetTimer(hwnd_, 1, 1800, nullptr);
}

void App::OnCaptureCompleted(HRESULT hr) {
    LogHr("OnCaptureCompleted", hr);
    screenshotOk_ = SUCCEEDED(hr);
    if (hwnd_) PostMessageW(hwnd_, kMsgCaptureDone, 0, 0);
}

static bool ReadClipboardText(HWND hwnd, std::wstring& text) {
    if (!OpenClipboard(hwnd)) return false;
    HANDLE handle = GetClipboardData(CF_UNICODETEXT);
    if (handle) {
        const size_t chars = GlobalSize(handle) / sizeof(wchar_t);
        const wchar_t* data = static_cast<const wchar_t*>(GlobalLock(handle));
        if (data && chars > 0) {
            size_t length = 0;
            while (length < chars && data[length] != L'\0') ++length;
            text.assign(data, length);
        }
        if (data) GlobalUnlock(handle);
    }
    CloseClipboard();
    return !text.empty();
}

void App::SetClipboardListening(bool enabled) {
    if (!hwnd_ || enabled == clipboardListening_) return;
    if (enabled) {
        if (AddClipboardFormatListener(hwnd_)) clipboardListening_ = true;
    } else {
        RemoveClipboardFormatListener(hwnd_);
        clipboardListening_ = false;
    }
}

void App::OnClipboardUpdate() {
    if (!clipboardListening_) return;
    std::wstring text;
    if (!ReadClipboardText(hwnd_, text)) return;
    if (text.size() > 100000) text.resize(100000);
    std::string json = "{\"type\":\"clipboardChanged\",\"payload\":{\"text\":";
    json += JsonString(text);
    json += "}}";
    PostJson(json);
}

std::string SaveCroppedJson(const std::wstring& cacheRoot, const std::string& dataUrl) {
    std::string b64 = dataUrl;
    const std::string prefix = "base64,";
    const auto commaPos = b64.find(prefix);
    if (commaPos != std::string::npos) {
        b64 = b64.substr(commaPos + prefix.size());
    }
    std::wstring path;
    std::string error;
    std::vector<unsigned char> bytes;
    if (!b64.empty() && Base64Decode(b64, bytes)) {
        std::filesystem::path dir = std::filesystem::path(cacheRoot) / L"screenshots";
        std::error_code cEc;
        std::filesystem::create_directories(dir, cEc);

        SYSTEMTIME cst{};
        GetLocalTime(&cst);
        wchar_t cstamp[64]{};
        swprintf_s(cstamp, L"_%04d%02d%02d-%02d%02d%02d-%03d",
                   cst.wYear, cst.wMonth, cst.wDay, cst.wHour, cst.wMinute,
                   cst.wSecond, cst.wMilliseconds);
        const std::wstring file = dir.native() + L"\\截图_裁剪" + cstamp + L".png";
        HANDLE handle = CreateFileW(NativeLongPath(file).c_str(), GENERIC_WRITE, 0,
                                    nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (handle != INVALID_HANDLE_VALUE) {
            DWORD written = 0;
            const bool ok = bytes.empty() ||
                            (WriteFile(handle, bytes.data(), static_cast<DWORD>(bytes.size()),
                                       &written, nullptr) &&
                             written == bytes.size());
            CloseHandle(handle);
            if (ok) path = file;
            else error = "写入裁剪结果失败";
        } else {
            error = "无法创建裁剪文件";
        }
    } else {
        error = "裁剪数据解码失败";
    }
    std::string json = "{\"type\":\"saveCroppedDone\",\"payload\":{\"ok\":" +
                       std::string(path.empty() ? "false" : "true") + ",\"path\":" +
                       JsonString(path) + ",\"error\":" + JsonString(FromUtf8(error)) + "}}";
    return json;
}

std::string CopyShotJson(HWND hwnd, const std::wstring& filePath) {
        std::string error;
        bool ok = false;
        if (!filePath.empty()) {
            EnsureGdiplus();
            // GDI+ 非线程安全，须持锁串行化（与截图线程/后台元数据线程隔离）。
            std::lock_guard<std::mutex> gdiplusLock(tb::GdiplusSync());
            Gdiplus::Bitmap bitmap(filePath.c_str());
            if (bitmap.GetLastStatus() == Gdiplus::Ok) {
                bool opened = false;
                for (int attempt = 0; attempt < 8 && !opened; ++attempt) {
                    opened = OpenClipboard(hwnd) != FALSE;
                    if (!opened) Sleep(20);
                }
                if (opened) {
                    EmptyClipboard();
                    HBITMAP hbmp = nullptr;
                    if (bitmap.GetHBITMAP(Gdiplus::Color(0, 0, 0), &hbmp) == Gdiplus::Ok && hbmp) {
                        BITMAP bm{};
                        if (GetObjectW(hbmp, sizeof(bm), &bm) && bm.bmWidth > 0 && bm.bmHeight > 0) {
                            const DWORD width = static_cast<DWORD>(bm.bmWidth);
                            const DWORD height = static_cast<DWORD>(bm.bmHeight);
                            const ULONGLONG pixelBytes =
                                static_cast<ULONGLONG>(width) * height * 4ULL;
                            if (pixelBytes <= 0xFFFFFFFFULL - sizeof(BITMAPINFOHEADER)) {
                                BITMAPINFOHEADER header{};
                                header.biSize = sizeof(BITMAPINFOHEADER);
                                header.biWidth = static_cast<LONG>(width);
                                header.biHeight = static_cast<LONG>(height);
                                header.biPlanes = 1;
                                header.biBitCount = 32;
                                header.biCompression = BI_RGB;
                                header.biSizeImage = static_cast<DWORD>(pixelBytes);
                                const SIZE_T total = sizeof(BITMAPINFOHEADER) +
                                                     static_cast<SIZE_T>(pixelBytes);
                                HGLOBAL dib = GlobalAlloc(GMEM_MOVEABLE, total);
                                if (dib) {
                                    auto* info = static_cast<BITMAPINFO*>(GlobalLock(dib));
                                    bool dibOk = false;
                                    if (info) {
                                        info->bmiHeader = header;
                                        HDC dc = GetDC(nullptr);
                                        if (dc) {
                                            HGDIOBJ old = SelectObject(dc, hbmp);
                                            const int lines = GetDIBits(
                                                dc, hbmp, 0, height,
                                                reinterpret_cast<BYTE*>(info) +
                                                    sizeof(BITMAPINFOHEADER),
                                                info, DIB_RGB_COLORS);
                                            SelectObject(dc, old);
                                            ReleaseDC(nullptr, dc);
                                            dibOk = lines == static_cast<int>(height);
                                        }
                                        GlobalUnlock(dib);
                                    }
                                    if (dibOk && SetClipboardData(CF_DIB, dib)) {
                                        ok = true;
                                        dib = nullptr;  // clipboard owns it now
                                    }
                                    if (dib) GlobalFree(dib);
                                }
                            }
                        }
                        if (SetClipboardData(CF_BITMAP, hbmp)) {
                            ok = true;
                            hbmp = nullptr;  // clipboard owns it now
                        }
                        if (hbmp) DeleteObject(hbmp);
                    }

                    // Chromium-based chat clients prefer PNG over CF_BITMAP.
                    CLSID pngClsid{};
                    if (GetPngEncoderClsid(&pngClsid) >= 0) {
                        IStream* stream = nullptr;
                        if (SUCCEEDED(CreateStreamOnHGlobal(nullptr, TRUE, &stream)) && stream) {
                            if (bitmap.Save(stream, &pngClsid, nullptr) == Gdiplus::Ok) {
                                STATSTG stat{};
                                if (stream->Stat(&stat, STATFLAG_NONAME) == S_OK &&
                                    stat.cbSize.QuadPart > 0 &&
                                    stat.cbSize.QuadPart <= static_cast<ULONGLONG>(SIZE_MAX)) {
                                    const ULONG size = static_cast<ULONG>(stat.cbSize.QuadPart);
                                    HGLOBAL png = GlobalAlloc(GMEM_MOVEABLE, size);
                                    if (png) {
                                        void* dst = GlobalLock(png);
                                        LARGE_INTEGER origin{};
                                        ULONG read = 0;
                                        stream->Seek(origin, STREAM_SEEK_SET, nullptr);
                                        const bool readOk =
                                            dst && stream->Read(dst, size, &read) == S_OK &&
                                            read == size;
                                        if (dst) GlobalUnlock(png);
                                        if (readOk) {
                                            const UINT format = RegisterClipboardFormatW(L"PNG");
                                            if (format && SetClipboardData(format, png)) {
                                                ok = true;
                                                png = nullptr;  // clipboard owns it
                                            }
                                        }
                                        if (png) GlobalFree(png);
                                    }
                                }
                            }
                            stream->Release();
                        }
                    }
                    CloseClipboard();
                } else {
                    error = "剪贴板被其他程序占用";
                }
            } else {
                error = "无法打开截图文件";
            }
        } else {
            error = "路径为空";
        }
        if (!ok && error.empty()) error = "写入剪贴板失败";
        std::string json = "{\"type\":\"copyShotDone\",\"payload\":{\"ok\":" +
                           std::string(ok ? "true" : "false") + ",\"error\":" +
                           JsonString(FromUtf8(error)) + "}}";
    return json;
}

void App::OnWebMessage(const std::string& json) { DispatchWebMessage(json, nullptr); }

void App::DispatchWebMessage(const std::string& json, MiniWindow* sender) {
    std::string parseError;
    ts::Json root = ts::Json::Parse(json, &parseError);
    if (!parseError.empty()) return;
    static const ts::Json emptyPayload;
    const ts::Json* payload = root.Find("payload");
    if (!payload) payload = &emptyPayload;
    const std::string type = root.GetString("type");

    // 统一命令总线：{"id":"1","cmd":"folders.load","args":{...}}
    // 新接入的工具（常用文件夹、视频整理……）都走这里，老 type 协议保持原样。
    if (root.Find("cmd")) {
        const std::string command = root.GetString("cmd");
        const std::string response = tb::Bridge::Get().Handle(json);
        Log("bridge " + command + " -> " + std::to_string(response.size()) + "B");
        if (sender) {
            sender->Post(response);
        } else {
            PostJson(response);
        }
        return;
    }

    if (type == "ready") {
        SendAppInfo();
        return;
    }
    if (type == "miniOpen") {
        // 从主窗口点「悬浮」意图是把它开出来，不是开关：已经开着就前置，
        // 否则连点两次会把刚开出来的窗口关掉，看起来像按钮没反应。
        ShowMiniWindow(ts::FromUtf8(payload->GetString("tool")), false);
        return;
    }
    if (type == "previewPopout") {
        ShowPreviewWindow(ts::FromUtf8(payload->GetString("path")),
                          ts::FromUtf8(payload->GetString("name")));
        return;
    }
    if (type == "miniOpenMain") {
        ShowMainWindowNow();
        return;
    }
    if (type == "quitApp") {
        Log("quitApp from web");
        PostMessageW(hwnd_, kMsgQuitApp, 0, 0);
        return;
    }
    if (type == "setTaskbar") {
        showTaskbar_ = payload->GetBool("show", true);
        const std::wstring file = AppIniPath();
        WritePrivateProfileStringW(L"window", L"Taskbar", showTaskbar_ ? L"1" : L"0",
                                   file.c_str());
        ApplyTaskbarButton();
        SendAppInfo();
        return;
    }
    if (type == "scanLarge") {
        StartLargeScan(ScanRootsFrom(*payload),
                       static_cast<uint64_t>(payload->GetNumber("minSizeBytes", 0)),
                       payload->GetBool("includeHidden", false));
        return;
    }
    if (type == "scanEmpty") {
        StartEmptyScan(ScanRootsFrom(*payload));
        return;
    }
    if (type == "cancelScan") {
        CancelScan();
        return;
    }
    if (type == "screenCapture") {
        StartScreenCapture(payload->GetBool("region", false));
        return;
    }
    if (type == "saveCropped") {
        StartAuxTask([root = cacheRoot_, dataUrl = payload->GetString("dataUrl", "")](std::stop_token, const std::atomic<bool>&, TaskProgress) {
            return SaveCroppedJson(root, dataUrl);
        });
        return;
    }
    if (type == "copyShotToClipboard") {
        StartAuxTask([hwnd = hwnd_, filePath = FromUtf8(payload->GetString("path"))](std::stop_token, const std::atomic<bool>&, TaskProgress) {
            return CopyShotJson(hwnd, filePath);
        });
        return;
    }

    if (type == "listScreenshots") {
        std::filesystem::path dir = std::filesystem::path(cacheRoot_) / L"screenshots";
        std::string json = "{\"type\":\"screenshotsListDone\",\"payload\":{\"dir\":" +
                           JsonString(dir.wstring()) + ",\"items\":[";
        std::error_code ec;
        std::vector<std::pair<std::wstring, std::wstring>> files;
        bool listed = false;
        for (std::filesystem::directory_iterator it(dir, ec), end;
             it != end && !ec; it.increment(ec)) {
            listed = true;
            if (!it->is_regular_file(ec)) {
                if (ec) ec.clear();
                continue;
            }
            if (ec) { ec.clear(); continue; }
            const std::wstring ext = it->path().extension().wstring();
            if (ext != L".png" && ext != L".PNG") continue;
            files.emplace_back(it->path().filename().wstring(), it->path().wstring());
        }
        std::sort(files.rbegin(), files.rend());  // 按文件名（含时间戳）降序
        size_t count = 0;
        for (const auto& f : files) {
            if (count >= 200) break;
            if (count) json += ",";
            json += "{\"name\":" + JsonString(f.first) + ",\"path\":" +
                    JsonString(f.second) + "}";
            ++count;
        }
        json += "]}}";
        PostJson(json);
        return;
    }
    if (type == "recycle") {
        std::vector<std::wstring> paths;
        for (const auto& item : payload->GetArray("paths")) {
            if (item.type == ts::Json::Type::String) paths.push_back(FromUtf8(item.string));
        }
        if (!paths.empty()) RecyclePaths(std::move(paths), root.GetString("requestId"));
        return;
    }
    if (type == "pickFile") {
        PickFile(root.GetString("requestId"), payload->GetString("target"));
        return;
    }
    if (type == "pickFolder") {
        PickFolder(root.GetString("requestId"));
        return;
    }
    if (type == "pickFiles") {
        PickFiles(root.GetString("requestId"), payload->GetString("title", "选择文件"),
                  payload->GetString("filter"));
        return;
    }
    if (type == "readFile") {
        StartAuxTask([this, requestId = root.GetString("requestId"),
                      path = payload->GetString("path")](std::stop_token, const std::atomic<bool>&, TaskProgress) {
            return ReadFileAsBase64Json(requestId, path);
        });
        return;
    }
    if (type == "exportFile") {
        ExportFile(root.GetString("requestId"), payload->GetString("name", "export"),
                   payload->GetString("filter"), payload->GetString("content"));
        return;
    }
    if (type == "setClipboardEnabled") {
        SetClipboardListening(payload->GetBool("enabled", false));
        return;
    }
    if (type == "checkPaths") {
        std::string json = "{\"type\":\"pathsChecked\",\"payload\":{\"requestId\":\"" +
            ts::JsonEscape(root.GetString("requestId")) + "\",\"existing\":[";
        bool first = true;
        for (const auto& item : payload->GetArray("paths")) {
            if (item.type != ts::Json::Type::String) continue;
            if (!first) json += ",";
            first = false;
            const std::wstring path = FromUtf8(item.string);
            const DWORD attributes = GetFileAttributesW(NativeLongPath(path).c_str());
            json += (attributes != INVALID_FILE_ATTRIBUTES) ? "true" : "false";
        }
        json += "]}}";
        PostJson(json);
        return;
    }
    if (type == "getClipboard") {
        if (!clipboardListening_) return;
        std::wstring text;
        if (ReadClipboardText(hwnd_, text)) {
            if (text.size() > 100000) text.resize(100000);
            std::string json = "{\"type\":\"clipboardChanged\",\"payload\":{\"text\":";
            json += JsonString(text);
            json += "}}";
            PostJson(json);
        }
        return;
    }
    if (type == "copyText") {
        const std::wstring text = FromUtf8(payload->GetString("text"));
        bool ok = false;
        bool opened = false;
        for (int attempt = 0; attempt < 8 && !opened; ++attempt) {
            opened = OpenClipboard(hwnd_) != FALSE;
            if (!opened) Sleep(20);
        }
        if (!text.empty() && opened) {
            EmptyClipboard();
            const size_t bytes = (text.size() + 1) * sizeof(wchar_t);
            HGLOBAL global = GlobalAlloc(GMEM_MOVEABLE, bytes);
            if (global) {
                void* dst = GlobalLock(global);
                if (dst) {
                    memcpy(dst, text.c_str(), bytes);
                    GlobalUnlock(global);
                    if (SetClipboardData(CF_UNICODETEXT, global)) ok = true;
                    else GlobalFree(global);
                } else {
                    GlobalFree(global);
                }
            }
            CloseClipboard();
        }
        std::string json = "{\"type\":\"copyTextDone\",\"payload\":{\"ok\":";
        json += ok ? "true" : "false";
        json += "}}";
        PostJson(json);
        return;
    }
    if (type == "searchFiles") {
        const uint64_t minSize = static_cast<uint64_t>(
            std::max(0.0, payload->GetNumber("minSizeBytes", 0.0)));
        const int64_t withinMs = static_cast<int64_t>(
            std::max(0.0, payload->GetNumber("withinMs", 0.0)));
        StartFileSearch(payload->GetString("root"), payload->GetString("pattern"),
                        minSize, withinMs, payload->GetBool("includeHidden", false),
                        payload->GetBool("recursive", true));
        return;
    }
    if (type == "compareFolders") {
        StartFolderCompare(payload->GetString("rootA"), payload->GetString("rootB"),
                           payload->GetBool("compareContent", false));
        return;
    }
    if (type == "copyFiles") {
        std::vector<std::pair<std::wstring, std::wstring>> pairs;
        for (const auto& item : payload->GetArray("pairs")) {
            const auto* pair = item.Find("from");
            const auto* to = item.Find("to");
            if (pair && to && pair->type == ts::Json::Type::String &&
                to->type == ts::Json::Type::String) {
                pairs.emplace_back(FromUtf8(pair->string), FromUtf8(to->string));
            }
        }
        if (!pairs.empty()) StartFileCopy(std::move(pairs));
        return;
    }
    if (type == "renamePairs") {
        std::vector<std::pair<std::wstring, std::wstring>> pairs;
        for (const auto& item : payload->GetArray("pairs")) {
            const auto* pair = item.Find("from");
            const auto* to = item.Find("to");
            if (pair && to && pair->type == ts::Json::Type::String &&
                to->type == ts::Json::Type::String) {
                pairs.emplace_back(FromUtf8(pair->string), FromUtf8(to->string));
            }
        }
        if (!pairs.empty()) {
            StartFileRename(std::move(pairs), root.GetString("requestId"));
        }
        return;
    }
    if (type == "setZoom") {
        SetZoom(payload->GetNumber("factor", 1.0));
        return;
    }
    if (type == "scanDuplicates") {
        const std::vector<std::wstring> scanRoots = ScanRootsFrom(*payload);
        const uint64_t minSize = static_cast<uint64_t>(
            std::max(0.0, payload->GetNumber("minSizeBytes", 1024.0 * 1024)));
        StartJsonTask([scanRoots, minSize](std::stop_token,
                                          const std::atomic<bool>& cancel,
                                          TaskProgress progress) {
            auto result = ts::FindDuplicates(
                scanRoots, minSize, cancel, [&](const ts::ScanProgress& p) {
                    progress("{\"type\":\"dupProgress\",\"payload\":{" + StatsJson(p) +
                             ",\"current\":" + JsonString(p.current) + "}}");
                });
            return DuplicateJson(result);
        });
        return;
    }
    if (type == "organizeFiles") {
        ts::OrganizeOptions options;
        options.root = FromUtf8(payload->GetString("root"));
        options.targetRoot = FromUtf8(payload->GetString("targetRoot"));
        options.includeHidden = payload->GetBool("includeHidden", false);
        options.previewOnly = payload->GetBool("previewOnly", false);
        const std::string conflict = payload->GetString("conflict", "autoname");
        options.conflict = conflict == "skip" ? ts::OrganizeConflict::Skip
                         : conflict == "overwrite" ? ts::OrganizeConflict::Overwrite
                         : ts::OrganizeConflict::AutoName;

        for (const auto& item : payload->GetArray("rules")) {
            if (item.type != ts::Json::Type::Object) continue;
            ts::OrganizeRule rule;
            rule.enabled = item.GetBool("enabled", true);
            rule.name = FromUtf8(item.GetString("name"));
            rule.exts = FromUtf8(item.GetString("exts"));
            rule.nameContains = FromUtf8(item.GetString("nameContains"));
            rule.nameWildcard = FromUtf8(item.GetString("nameWildcard"));
            rule.minSize = static_cast<uint64_t>(
                std::max(0.0, item.GetNumber("minSize", 0.0)));
            rule.maxSize = static_cast<uint64_t>(
                std::max(0.0, item.GetNumber("maxSize", 0.0)));
            rule.olderThanDays = static_cast<int>(item.GetNumber("olderThanDays", 0.0));
            rule.newerThanDays = static_cast<int>(item.GetNumber("newerThanDays", 0.0));
            const std::string target = item.GetString("target", "fixed");
            rule.target = target == "byExt" ? ts::OrganizeTarget::ByExt
                        : target == "byDate" ? ts::OrganizeTarget::ByDate
                        : ts::OrganizeTarget::Fixed;
            rule.dir = FromUtf8(item.GetString("dir"));
            rule.groupExt = FromUtf8(item.GetString("groupExt"));
            rule.dateMode = FromUtf8(item.GetString("dateMode"));
            options.rules.push_back(std::move(rule));
        }

        StartJsonTask([options = std::move(options)](std::stop_token,
                                                     const std::atomic<bool>& cancel,
                                                     TaskProgress progress) {
            auto result = ts::OrganizeFiles(
                options, cancel, [&progress](const ts::ScanProgress& p) {
                    progress("{\"type\":\"organizeProgress\",\"payload\":{" + StatsJson(p) +
                             ",\"current\":" + JsonString(p.current) + "}}");
                });
            return OrganizeDoneJson(result);
        });
        return;
    }
    if (type == "analyzeSpace") {
        const std::wstring scanRoot = FromUtf8(payload->GetString("root"));
        StartJsonTask([scanRoot](std::stop_token, const std::atomic<bool>& cancel,
                                 TaskProgress progress) {
            auto result = ts::AnalyzeSpace(
                scanRoot, cancel, [&](const ts::ScanProgress& p) {
                    progress("{\"type\":\"spaceProgress\",\"payload\":{" + StatsJson(p) +
                             ",\"current\":" + JsonString(p.current) + "}}");
                });
            return SpaceJson(result);
        });
        return;
    }
    if (type == "hashFolder") {
        const std::wstring scanRoot = FromUtf8(payload->GetString("root"));
        const bool recursive = payload->GetBool("recursive", true);
        StartJsonTask([scanRoot, recursive](std::stop_token,
                                            const std::atomic<bool>& cancel,
                                            TaskProgress progress) {
            auto result = ts::HashFolder(
                scanRoot, recursive, cancel, [&](const ts::ScanProgress& p) {
                    progress("{\"type\":\"hashProgress\",\"payload\":{" + StatsJson(p) +
                             ",\"current\":" + JsonString(p.current) + "}}");
                });
            return HashJson(result);
        });
        return;
    }
    if (type == "scanTemp") {
        StartJsonTask([](std::stop_token, const std::atomic<bool>& cancel,
                         TaskProgress progress) {
            auto result = ts::ScanTemp(cancel, [&](const ts::ScanProgress& p) {
                progress("{\"type\":\"tempProgress\",\"payload\":{" + StatsJson(p) +
                         ",\"current\":" + JsonString(p.current) + "}}");
            });
            return TempJson(result);
        });
        return;
    }
    if (type == "listFolder") {
        const std::wstring scanRoot = FromUtf8(payload->GetString("root"));
        StartJsonTask([scanRoot](std::stop_token, const std::atomic<bool>&,
                                 TaskProgress) {
            return ListJson(ts::ListFolder(scanRoot));
        });
        return;
    }
    if (type == "renameApply") {
        std::vector<std::pair<std::wstring, std::wstring>> pairs;
        for (const auto& item : payload->GetArray("items")) {
            if (item.type != ts::Json::Type::Object) continue;
            const ts::Json* oldPath = item.Find("oldPath");
            const ts::Json* newPath = item.Find("newPath");
            if (!oldPath || !newPath) continue;
            if (oldPath->type != ts::Json::Type::String ||
                newPath->type != ts::Json::Type::String) {
                continue;
            }
            pairs.emplace_back(FromUtf8(oldPath->string), FromUtf8(newPath->string));
            if (pairs.size() >= 2000) break;
        }
        StartJsonTask([pairs](std::stop_token, const std::atomic<bool>&,
                              TaskProgress) {
            return RenameJson(ts::ApplyRename(pairs));
        });
        return;
    }
    if (type == "unlockCheck") {
        StartUnlockCheck(FromUtf8(payload->GetString("path")),
                         payload->GetString("mode", "file"));
        return;
    }
    if (type == "usbVolumes") {
        PostJson(UsbVolumesJson(ts::ListRemovableVolumes()));
        return;
    }
    if (type == "usbCheck") {
        const std::wstring drive = FromUtf8(payload->GetString("drive"));
        StartJsonTask([drive](std::stop_token, const std::atomic<bool>&,
                              TaskProgress) {
            ts::LockResult result;
            if (drive.size() < 2 || drive[1] != L':') {
                result.error = L"无效的盘符";
            } else {
                result = ts::FindVolumeLockers(drive);
            }
            return LockersJson(result, "usbCheckDone");
        });
        return;
    }
    if (type == "usbEject") {
        const std::wstring drive = FromUtf8(payload->GetString("drive"));
        const bool force = payload->GetBool("force", false);
        if (drive.empty()) {
            PostJson(EjectJson(false, L"无效的盘符"));
            return;
        }
        StartJsonTask([drive, force](std::stop_token, const std::atomic<bool>&,
                                     TaskProgress) {
            const wchar_t drv = static_cast<wchar_t>(towupper(drive[0]));
            std::wstring error;
            const bool ok = ts::SafeEjectVolume(drv, force, error);
            return EjectJson(ok, error);
        });
        return;
    }
    if (type == "killProcess") {
        const uint32_t pid = static_cast<uint32_t>(
            std::max(0.0, payload->GetNumber("pid", 0)));
        StartKillProcess(pid);
        return;
    }
    if (type == "setTheme") {
        ApplyTheme(payload->GetString("theme", "dark"));
        return;
    }
    if (type == "quit") {
        PostMessageW(hwnd_, WM_CLOSE, 0, 0);
        return;
    }
}

void App::HandleRecycleDone(void* payload) {
    std::unique_ptr<RecycleDoneMsg> message(static_cast<RecycleDoneMsg*>(payload));
    std::string json = "{\"type\":\"recycleDone\",\"payload\":{\"ok\":";
    json += message->ok ? "true" : "false";
    json += ",\"count\":" + std::to_string(message->count);
    json += ",\"requestId\":\"" + ts::JsonEscape(message->requestId) + "\"";
    json += ",\"message\":" + JsonString(message->message) + "}}";
    PostJson(json);
    // 回收站任务完成：回收已完成线程，让排队中的下一个请求自动开始执行。
    ReapRecycleJobs();
}

std::wstring App::ExeDirectory() const {
    wchar_t path[MAX_PATH]{};
    DWORD length = GetModuleFileNameW(nullptr, path, MAX_PATH);
    if (length == 0) return L".";
    std::filesystem::path exePath(std::wstring(path, length));
    return exePath.parent_path().wstring();
}

LRESULT CALLBACK App::WindowProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
    App* self = reinterpret_cast<App*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    if (message == WM_NCCREATE) {
        auto* create = reinterpret_cast<CREATESTRUCTW*>(lparam);
        self = static_cast<App*>(create->lpCreateParams);
        self->hwnd_ = hwnd;
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
    }
    if (self) return self->HandleMessage(message, wparam, lparam);
    return DefWindowProcW(hwnd, message, wparam, lparam);
}

LRESULT App::HandleMessage(UINT message, WPARAM wparam, LPARAM lparam) {
    switch (message) {
        case WM_SIZE:
            ResizeWebView();
            return 0;
        case WM_DPICHANGED: {
            dpi_ = HIWORD(wparam);
            auto* suggested = reinterpret_cast<RECT*>(lparam);
            SetWindowPos(hwnd_, nullptr, suggested->left, suggested->top,
                         suggested->right - suggested->left,
                         suggested->bottom - suggested->top,
                         SWP_NOZORDER | SWP_NOACTIVATE);
            ResizeWebView();
            return 0;
        }
        case WM_GETMINMAXINFO: {
            auto* info = reinterpret_cast<MINMAXINFO*>(lparam);
            info->ptMinTrackSize.x = MulDiv(1024, dpi_, 96);
            info->ptMinTrackSize.y = MulDiv(700, dpi_, 96);
            return 0;
        }
        case WM_ERASEBKGND:
            return 1;
        case WM_PAINT: {
            PAINTSTRUCT paint{};
            HDC dc = BeginPaint(hwnd_, &paint);
            RECT client{};
            GetClientRect(hwnd_, &client);
            FillRect(dc, &client, backgroundBrush_);
            EndPaint(hwnd_, &paint);
            return 0;
        }
        case WM_TIMER:
            if (wparam == 1) {
                KillTimer(hwnd_, 1);
                CaptureScreenshot();
            } else if (wparam == 6) {
                HandleScreenCaptureTimeout();

            }
            return 0;
        case WM_CLOSE:
            Log("WM_CLOSE");
            if (!quitting_ && !screenshotMode_) {
                // 关闭按钮收进托盘，真正退出走托盘菜单或 WM_QUERYENDSESSION。
                HideMainWindowToTray();
                if (!trayCreated_) CreateTrayIcon();
                return 0;
            }
            // 先关窗，不在此处等待工作线程。真正的 stop+join 放到 App 析构里
            // （消息循环退出后）执行，这样即使某个线程还没结束，窗口也能立刻消失。
            DestroyWindow(hwnd_);
            return 0;
        case WM_DESTROY:
            RemoveTrayIcon();
            UnregisterHotKey(hwnd_, 1);
            if (clipboardListening_) {
                RemoveClipboardFormatListener(hwnd_);
                clipboardListening_ = false;
            }
            Log(std::string("WM_DESTROY screenshotOk=") + (screenshotOk_ ? "1" : "0"));
            PostQuitMessage(screenshotMode_ && !screenshotOk_ ? 1 : 0);
            return 0;
        case kMsgScreenCaptureDone:
            FinishScreenCapture(reinterpret_cast<void*>(lparam));
            return 0;
        case kMsgRecycleDone:
            HandleRecycleDone(reinterpret_cast<void*>(lparam));
            return 0;
        case kMsgExportDone: {
            std::unique_ptr<ExportDoneMsg> message(
                static_cast<ExportDoneMsg*>(reinterpret_cast<void*>(lparam)));
            std::string json = "{\"type\":\"fileExported\",\"payload\":{\"requestId\":\"";
            json += ts::JsonEscape(message->requestId);
            json += "\",\"ok\":" + std::string(message->ok ? "true" : "false");
            json += ",\"path\":" + JsonString(message->path);
            if (!message->error.empty()) json += ",\"error\":\"" + ts::JsonEscape(message->error) + "\"";
            json += "}}";
            PostJson(json);
            // 导出完成即回收已结束的写盘线程，避免运行期积压。
            ReapExportWriteThreads();
            return 0;
        }
        case kMsgTaskJson: {
            std::unique_ptr<TaskJsonMsg> message(
                static_cast<TaskJsonMsg*>(reinterpret_cast<void*>(lparam)));
            if (message->generation == scanGeneration_ || message->generation == kAuxGeneration) {
                PostJson(message->json);
            }
            // 辅助任务完成时：回收已完成线程并启动排队的下一个辅助任务。
            if (message->generation == kAuxGeneration) {
                ReapAuxTasks();
            }
            // 主任务完成：把它转入 retired 池；随后统一回收（join）已完成线程并推进排队队列。
            bool isMainGeneration = message->generation != kAuxGeneration;
            if (currentTask_ && currentTask_->generation == message->generation) {
                currentTask_->finished.store(true, std::memory_order_release);
                retiredTasks_.push_back(std::move(currentTask_));
                currentTask_.reset();
            }
            // 无论是最新主任务代，还是已被顶替的旧主任务代，都触发一次回收，
            // 让已完成但尚未 join 的 retired 线程被及时回收并推进排队队列。
            if (isMainGeneration) {
                ReapFinishedTasks();
            }
            return 0;
        }
        case kMsgCaptureDone:
            PostMessageW(hwnd_, WM_CLOSE, 0, 0);
            return 0;
        case WM_CLIPBOARDUPDATE:
            OnClipboardUpdate();
            return 0;
        case WM_APP + 9:
            SendAppInfo();
            return 0;
        case kMsgTray:
            HandleTrayMessage(wparam, lparam);
            return 0;
        case kMsgQuitApp:
            quitting_ = true;
            DestroyWindow(hwnd_);
            return 0;
        case WM_HOTKEY:
            Log("WM_HOTKEY");
            if (wparam == 1) {
                ToggleFoldersPanel();
            }
            return 0;
        default:
            return DefWindowProcW(hwnd_, message, wparam, lparam);
    }
}

int App::Run() {
    Log("Run message loop");
    MSG message{};
    while (GetMessageW(&message, nullptr, 0, 0) > 0) {
        TranslateMessage(&message);
        DispatchMessageW(&message);
    }
    char buffer[96]{};
    std::snprintf(buffer, sizeof(buffer), "Run exit message=%u wparam=%llu", message.message,
                  static_cast<unsigned long long>(message.wParam));
    Log(buffer);
    return static_cast<int>(message.wParam);
}

}  // namespace ts
