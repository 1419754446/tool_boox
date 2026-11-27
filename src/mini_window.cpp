#include "mini_window.h"

#include "app.h"
#include "host.h"
#include "json.h"
#include "media_handler.h"

#include <shellapi.h>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <string>

namespace ts {
namespace {

constexpr wchar_t kMiniClass[] = L"Toolbox.Mini";
constexpr wchar_t kHost[] = L"toolsoft.local";
constexpr wchar_t kShotsHost[] = L"shots.local";
// 折叠后客户区高度：正好放下一行迷你顶栏（图标 + 名称 + 窗口按钮）
constexpr int kCollapsedClientHeight = 44;

const wchar_t* TitleFor(const std::wstring& id) {
    if (id == L"launcher") return L"悬浮工具箱";
    if (id == L"folders") return L"常用文件夹";
    if (id == L"clipboard-history") return L"剪贴板历史";
    if (id == L"quick-search") return L"快速文件搜索";
    if (id == L"video-collector") return L"视频整理";
    if (id == L"large-files") return L"大文件扫描";
    if (id == L"empty-folders") return L"空文件夹清理";
    if (id == L"duplicates") return L"重复文件查找";
    if (id == L"space-analyzer") return L"磁盘空间分析";
    if (id == L"batch-rename") return L"批量重命名";
    if (id == L"hash-check") return L"文件哈希校验";
    if (id == L"temp-cleaner") return L"临时文件清理";
    if (id == L"file-unlock") return L"文件占用解锁";
    if (id == L"folder-sync") return L"文件夹对比同步";
    if (id == L"file-organizer") return L"文件整理";
    if (id == L"eject-drive" || id == L"usb-eject") return L"U 盘安全弹出";
    if (id == L"screenshot") return L"截图工具";
    if (id == L"video-preview") return L"视频预览";
    return L"工具箱";
}

// 取"窗口所在显示器"的 DPI，而不是主屏 DPI（GetDpiForSystem）。
// WebView2 的内容是按窗口实际所在显示器的 DPI 渲染的（它默认开启
// ShouldDetectMonitorScaleChanges），所以原生这边也必须用同一个基准换算尺寸。
// 否则同一份配置在两台缩放不同的电脑上会得到不同的视觉大小：内容按 150% 放大，
// 窗口却按 100% 算，结果就是内容装不下、只剩一行，或下方多出一大片空白。
UINT DpiOfWindow(HWND hwnd) {
    if (hwnd) {
        const UINT dpi = GetDpiForWindow(hwnd);
        if (dpi) return dpi;
    }
    const UINT dpi = GetDpiForSystem();
    return dpi ? dpi : 96;
}

// 取某块显示器的工作区。只用 SPI_GETWORKAREA 拿到的是主屏的边界，
// 副屏上开窗时窗口会被按主屏范围夹回来，看起来像"自己跳回主屏"。
void WorkAreaNear(HWND hwnd, const POINT* probe, RECT* work) {
    HMONITOR monitor = nullptr;
    if (hwnd) {
        monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
    } else if (probe) {
        monitor = MonitorFromPoint(*probe, MONITOR_DEFAULTTONEAREST);
    } else {
        POINT origin{0, 0};
        monitor = MonitorFromPoint(origin, MONITOR_DEFAULTTONEAREST);
    }
    MONITORINFO info{};
    info.cbSize = sizeof(info);
    if (monitor && GetMonitorInfoW(monitor, &info)) {
        *work = info.rcWork;
        return;
    }
    SystemParametersInfoW(SPI_GETWORKAREA, 0, work, 0);
}

std::wstring StateFile() { return tb::DataDir() + L"\\mini-state.ini"; }

class MiniControllerHandler final
    : public ICoreWebView2CreateCoreWebView2ControllerCompletedHandler {
public:
    explicit MiniControllerHandler(MiniWindow* window) : window_(window) {}
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
        window_->OnControllerCreated(errorCode, controller);
        return S_OK;
    }

private:
    std::atomic<ULONG> refs_{1};
    MiniWindow* window_;
};

class MiniMessageHandler final : public ICoreWebView2WebMessageReceivedEventHandler {
public:
    explicit MiniMessageHandler(MiniWindow* window) : window_(window) {}
    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** result) override {
        if (!result) return E_POINTER;
        if (riid == IID_IUnknown || riid == IID_ICoreWebView2WebMessageReceivedEventHandler) {
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
            window_->OnWebMessage(ToUtf8(json));
            CoTaskMemFree(json);
        }
        return S_OK;
    }

private:
    std::atomic<ULONG> refs_{1};
    MiniWindow* window_;
};

class MiniReadyHandler final : public ICoreWebView2DOMContentLoadedEventHandler {
public:
    explicit MiniReadyHandler(MiniWindow* window) : window_(window) {}
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
        window_->MarkContentReady();
        return S_OK;
    }

private:
    std::atomic<ULONG> refs_{1};
    MiniWindow* window_;
};

}  // namespace

MiniWindow::MiniWindow(App* app, ICoreWebView2Environment* environment, std::wstring toolId,
                       std::wstring extraQuery, std::wstring title)
    : app_(app), environment_(environment), toolId_(std::move(toolId)),
      extraQuery_(std::move(extraQuery)) {
    title_ = title.empty() ? std::wstring(L"工具箱 · ") + TitleFor(toolId_) : std::move(title);
    // 先按系统 DPI 猜一个，EnsureWindow() 创建出窗口后会换成它所在显示器的真实 DPI。
    dpi_ = static_cast<int>(DpiOfWindow(nullptr));
    LoadState();
}

MiniWindow::~MiniWindow() {
    if (webview_ && messageToken_.value != 0) {
        webview_->remove_WebMessageReceived(messageToken_);
        messageToken_.value = 0;
    }
    webview_.Reset();
    controller_.Reset();
}

void MiniWindow::DefaultSize(const std::wstring& id, int* width, int* height) const {
    if (id == L"launcher") {
        *width = Scale(420);
        *height = Scale(460);
    } else if (id == L"folders") {
        *width = Scale(320);
        *height = Scale(360);
    } else if (id == L"clipboard-history") {
        *width = Scale(340);
        *height = Scale(380);
    } else if (id == L"quick-search") {
        *width = Scale(470);
        *height = Scale(420);
    } else if (id == L"video-collector") {
        *width = Scale(720);
        *height = Scale(460);
    } else if (id == L"video-preview") {
        *width = Scale(760);
        *height = Scale(480);
    } else {
        // 其余工具都用更紧凑的默认尺寸：悬浮窗是随手的浮层，不该一开就占满桌面。
        // 真正打开后前端还会按内容高度 auto-fit 一次，这里只给一个不至于过大的起点。
        *width = Scale(570);
        *height = Scale(430);
    }
}

void MiniWindow::LoadState() {
    const std::wstring file = StateFile();
    const int x = GetPrivateProfileIntW(toolId_.c_str(), L"X", -999999, file.c_str());
    const int y = GetPrivateProfileIntW(toolId_.c_str(), L"Y", -999999, file.c_str());
    int w = GetPrivateProfileIntW(toolId_.c_str(), L"W", 0, file.c_str());
    int h = GetPrivateProfileIntW(toolId_.c_str(), L"H", 0, file.c_str());
    if (w <= 0 || h <= 0) {
        DefaultSize(toolId_, &w, &h);
    } else if (GetPrivateProfileIntW(toolId_.c_str(), L"UnitLogical", 0, file.c_str()) == 1) {
        // 新格式：W/H 是 96 DPI 基准的逻辑尺寸，换算到当前显示器后，
        // 同一份配置在任何缩放比例的电脑上打开都是相同视觉大小。
        w = MulDiv(w, Dpi(), 96);
        h = MulDiv(h, Dpi(), 96);
    } else {
        // 旧格式：W/H 是当时的物理像素，原样使用即可——它本来就是按那台
        // 机器的 DPI 算出来的，再乘一次就翻倍了。
    }
    width_ = w;
    height_ = h;
    expandedHeight_ = h;
    pinned_ = GetPrivateProfileIntW(toolId_.c_str(), L"Pinned", 1, file.c_str()) != 0;
    collapsed_ = GetPrivateProfileIntW(toolId_.c_str(), L"Collapsed", 0, file.c_str()) != 0;
    // 悬浮工具箱是"工具入口"面板，收起了就只剩一行标题、看起来像坏了。
    // 它不记忆收起状态，每次打开都直接铺开 16 格。
    if (toolId_ == L"launcher") collapsed_ = false;
    autoFit_ = GetPrivateProfileIntW(toolId_.c_str(), L"FitH", 1, file.c_str()) != 0;
    lastProgramHeight_ = height_;

    RECT work{};
    if (x == -999999 || y == -999999) {
        WorkAreaNear(nullptr, nullptr, &work);
    } else {
        // 按上次的位置判断它落在哪块屏，用那块屏的工作区来夹尺寸，
        // 而不是永远拿主屏的边界。
        POINT probe{x, y};
        WorkAreaNear(nullptr, &probe, &work);
    }
    const int workW = work.right - work.left;
    const int workH = work.bottom - work.top;
    // 高 DPI 下默认尺寸可能超过可用桌面：先夹到工作区，避免窗口一半在屏幕外。
    width_ = std::min(width_, workW - Scale(24));
    height_ = std::min(height_, workH - Scale(48));
    if (x == -999999 || y == -999999) {
        x_ = work.right - width_ - Scale(24);
        y_ = work.top + Scale(80);
    } else {
        x_ = x;
        y_ = y;
    }
    // 越界纠正（拔掉副屏 / 分辨率变化）
    if (x_ + width_ > work.right || x_ < work.left - width_ + Scale(80)) {
        x_ = work.right - width_ - Scale(24);
    }
    if (y_ + height_ > work.bottom || y_ < work.top) y_ = work.top + Scale(80);
    if (width_ > workW) width_ = workW;
    if (height_ > workH) height_ = workH;
}

void MiniWindow::SaveState() {
    if (!hwnd_) return;
    // 写盘用 96 DPI 基准的逻辑尺寸：物理像素除以当前 DPI 再乘 96。
    // 这样窗口尺寸不再绑定"保存时那台电脑的缩放"，150% 机器上存的配置
    // 拿到 100% 机器上打开，视觉大小还是同一个。
    int saveW = width_;
    int saveH = height_;
    if (!collapsed_) {
        RECT rect{};
        GetWindowRect(hwnd_, &rect);
        // 存客户区尺寸：EnsureWindow 把 width_/height_ 当客户区交给
        // AdjustWindowRectEx，若这里存外框尺寸，反复开关窗口会一轮轮变大。
        RECT client{};
        GetClientRect(hwnd_, &client);
        x_ = rect.left;
        y_ = rect.top;
        width_ = client.right > 0 ? client.right : rect.right - rect.left;
        height_ = client.bottom > 0 ? client.bottom : rect.bottom - rect.top;
        expandedHeight_ = height_;
        saveW = MulDiv(width_, 96, Dpi());
        saveH = MulDiv(height_, 96, Dpi());
    }
    const std::wstring file = StateFile();
    WritePrivateProfileStringW(toolId_.c_str(), L"X", std::to_wstring(x_).c_str(), file.c_str());
    WritePrivateProfileStringW(toolId_.c_str(), L"Y", std::to_wstring(y_).c_str(), file.c_str());
    WritePrivateProfileStringW(toolId_.c_str(), L"W", std::to_wstring(saveW).c_str(), file.c_str());
    WritePrivateProfileStringW(toolId_.c_str(), L"H", std::to_wstring(saveH).c_str(),
                               file.c_str());
    WritePrivateProfileStringW(toolId_.c_str(), L"Pinned", pinned_ ? L"1" : L"0", file.c_str());
    WritePrivateProfileStringW(toolId_.c_str(), L"Collapsed", collapsed_ ? L"1" : L"0",
                               file.c_str());
    WritePrivateProfileStringW(toolId_.c_str(), L"FitH", autoFit_ ? L"1" : L"0", file.c_str());
    // 标记尺寸单位，读的时候才知道要不要按当前 DPI 换算。
    WritePrivateProfileStringW(toolId_.c_str(), L"UnitLogical", L"1", file.c_str());
}

bool MiniWindow::EnsureWindow() {
    if (hwnd_ && IsWindow(hwnd_)) return true;

    static bool registered = false;
    if (!registered) {
        WNDCLASSEXW wc{};
        wc.cbSize = sizeof(wc);
        wc.style = CS_HREDRAW | CS_VREDRAW;
        wc.lpfnWndProc = &MiniWindow::WindowProc;
        wc.hInstance = GetModuleHandleW(nullptr);
        wc.hCursor = LoadCursorW(nullptr, IDC_ARROW);
        wc.hIcon = LoadIconW(wc.hInstance, MAKEINTRESOURCEW(1));
        wc.hIconSm = wc.hIcon;
        wc.hbrBackground = CreateSolidBrush(RGB(244, 246, 251));
        wc.lpszClassName = kMiniClass;
        if (!RegisterClassExW(&wc) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) return false;
        registered = true;
    }

    const DWORD style = WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_THICKFRAME | WS_MINIMIZEBOX;
    const DWORD exStyle = pinned_ ? WS_EX_TOPMOST : 0;
    RECT frame{0, 0, width_, height_};
    AdjustWindowRectEx(&frame, style, FALSE, exStyle);
    const int outerWidth = frame.right - frame.left;
    const int outerHeight = frame.bottom - frame.top;

    hwnd_ = CreateWindowExW(exStyle, kMiniClass, title_.c_str(), style, x_, y_, outerWidth,
                            outerHeight, nullptr, nullptr, GetModuleHandleW(nullptr), this);
    if (!hwnd_) return false;

    // 窗口创建完才知道它落在哪块屏上（PerMonitorV2 下 GetDpiForWindow 直接给出
    // 该显示器的 DPI）。宽度/高度此前是按系统 DPI 估的，若不一致就按真实 DPI
    // 重算一次并重新定位，保证同一份配置在任何缩放的电脑上视觉尺寸一致。
    const int actualDpi = static_cast<int>(DpiOfWindow(hwnd_));
    if (actualDpi != Dpi()) {
        const int logicalW = MulDiv(width_, 96, Dpi());
        const int logicalH = MulDiv(height_, 96, Dpi());
        dpi_ = actualDpi;
        width_ = MulDiv(logicalW, dpi_, 96);
        height_ = MulDiv(logicalH, dpi_, 96);
        expandedWidth_ = width_;
        expandedHeight_ = height_;
        RECT fixFrame{0, 0, width_, height_};
        AdjustWindowRectEx(&fixFrame, style, FALSE, exStyle);
        SetWindowPos(hwnd_, nullptr, x_, y_, fixFrame.right - fixFrame.left,
                     fixFrame.bottom - fixFrame.top, SWP_NOZORDER | SWP_NOACTIVATE);
    }

    if (collapsed_) {
        expandedHeight_ = height_;
        expandedWidth_ = width_;
        RECT rect{};
        GetWindowRect(hwnd_, &rect);
        const DWORD exStyleNow = pinned_ ? WS_EX_TOPMOST : 0;
        // 初始即收起：同时收窄到窄条，和运行中收起的形态保持一致。
        const int collapsedWidth = std::min(width_, Scale(300));
        RECT collapsedFrame{0, 0, collapsedWidth, Scale(kCollapsedClientHeight)};
        AdjustWindowRectEx(&collapsedFrame, style, FALSE, exStyleNow);
        SetWindowPos(hwnd_, nullptr, rect.left, rect.top, collapsedFrame.right - collapsedFrame.left,
                     collapsedFrame.bottom - collapsedFrame.top, SWP_NOZORDER | SWP_NOACTIVATE);
    }

    if (environment_) {
        auto* handler = new MiniControllerHandler(this);
        environment_->CreateCoreWebView2Controller(hwnd_, handler);
        handler->Release();
    }
    return true;
}

void MiniWindow::Show(bool activate) {
    if (!EnsureWindow()) return;
    pendingActivate_ = activate;
    if (contentReady_) {
        // 已经加载过：窗口只是被隐藏了，直接亮出来，不能再等。
        FinishShow();
        return;
    }
    // 首次打开：窗口先别出场，把显示请求挂起；DOM 就绪后统一放行。
    // 500ms 兜底——页面通常 100~200ms 就绪，这个值只在异常（页面加载失败、
    // 事件丢了）时才用得上，窗口终究得出来，不能点了没反应。
    if (pendingShow_) return;  // 已经在等首帧了，别把兜底计时器重置回 500ms
    pendingShow_ = true;
    SetTimer(hwnd_, kShowTimerId, 500, nullptr);
}

void MiniWindow::FinishShow() {
    if (!hwnd_ || destroying_) return;
    const bool activate = pendingActivate_;
    pendingShow_ = false;
    KillTimer(hwnd_, kShowTimerId);
    if (controller_) controller_->put_IsVisible(TRUE);
    ShowWindow(hwnd_, activate ? SW_SHOW : SW_SHOWNOACTIVATE);
    if (activate) {
        SetForegroundWindow(hwnd_);
        SetFocus(hwnd_);
    }
    SaveState();
}

void MiniWindow::MarkContentReady() {
    if (destroying_ || !hwnd_) return;
    contentReady_ = true;
    if (!pendingShow_) return;
    // DOM 建完到首帧合成还差一两帧，压 50ms 再出场，看到的就是画好的内容。
    KillTimer(hwnd_, kShowTimerId);
    SetTimer(hwnd_, kShowTimerId, 50, nullptr);
}

void MiniWindow::Hide() {
    if (hwnd_) {
        pendingShow_ = false;
        KillTimer(hwnd_, kShowTimerId);
        SaveState();
        ShowWindow(hwnd_, SW_HIDE);
    }
}

void MiniWindow::Toggle() {
    // pendingShow_ 也算"已经在显示的队列里"，这时再点一下应当是收起来，而不是排队两次。
    if (Visible() || pendingShow_) {
        Hide();
    } else {
        Show();
    }
}

bool MiniWindow::Visible() const { return hwnd_ && IsWindowVisible(hwnd_); }

void MiniWindow::Destroy() {
    destroying_ = true;
    if (hwnd_ && IsWindow(hwnd_)) {
        KillTimer(hwnd_, kShowTimerId);
        DestroyWindow(hwnd_);
    }
    hwnd_ = nullptr;
    if (webview_ && messageToken_.value != 0) {
        webview_->remove_WebMessageReceived(messageToken_);
        messageToken_.value = 0;
    }
    webview_.Reset();
    controller_.Reset();
}

void MiniWindow::Post(const std::string& json) {
    if (!webview_) return;
    const std::wstring message = FromUtf8(json);
    webview_->PostWebMessageAsJson(message.c_str());
}

void MiniWindow::TogglePin() {
    pinned_ = !pinned_;
    ApplyPin();
    SaveState();
    Post(std::string("{\"type\":\"miniState\",\"pinned\":") + (pinned_ ? "true" : "false") +
         ",\"collapsed\":" + (collapsed_ ? "true" : "false") + "}");
}

void MiniWindow::ApplyPin() {
    if (!hwnd_) return;
    SetWindowPos(hwnd_, pinned_ ? HWND_TOPMOST : HWND_NOTOPMOST, 0, 0, 0, 0,
                 SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
}

void MiniWindow::ToggleCollapse() { SetCollapsed(!collapsed_); }

void MiniWindow::SetCollapsed(bool collapse) {
    if (!hwnd_ || collapsed_ == collapse) return;
    RECT rect{};
    GetWindowRect(hwnd_, &rect);
    RECT client{};
    GetClientRect(hwnd_, &client);
    const DWORD style = static_cast<DWORD>(GetWindowLongPtrW(hwnd_, GWL_STYLE));
    const DWORD exStyle = static_cast<DWORD>(GetWindowLongPtrW(hwnd_, GWL_EXSTYLE));
    const int currentWidth = client.right > 0 ? client.right : width_;
    // 折叠/展开都按「客户区」算外框：窗口带标题栏与非客户区，直接设外框会被
    // AdjustWindowRectEx 的差值吃掉。
    if (collapse) {
        if (client.bottom > 0) expandedHeight_ = client.bottom;
        if (currentWidth > 0) expandedWidth_ = currentWidth;
        collapsed_ = true;
        // 收起成一条窄标题条：宽度收到不超过 300，高度只剩一行，别留一大片空条。
        const int collapsedWidth = std::min(expandedWidth_ > 0 ? expandedWidth_ : currentWidth,
                                            Scale(300));
        RECT frame{0, 0, collapsedWidth, Scale(kCollapsedClientHeight)};
        AdjustWindowRectEx(&frame, style, FALSE, exStyle);
        SetWindowPos(hwnd_, nullptr, rect.left, rect.top, frame.right - frame.left,
                     frame.bottom - frame.top, SWP_NOZORDER | SWP_NOACTIVATE);
    } else {
        collapsed_ = false;
        const int restoredWidth = expandedWidth_ > 0 ? expandedWidth_ : currentWidth;
        RECT frame{0, 0, restoredWidth, expandedHeight_ > 0 ? expandedHeight_ : Scale(300)};
        AdjustWindowRectEx(&frame, style, FALSE, exStyle);
        SetWindowPos(hwnd_, nullptr, rect.left, rect.top, frame.right - frame.left,
                     frame.bottom - frame.top, SWP_NOZORDER | SWP_NOACTIVATE);
    }
    // 折叠条也是网页画出来的（含「展开」按钮），所以不能隐藏 WebView。
    UpdateBounds();
    SaveState();
    Post(std::string("{\"type\":\"miniState\",\"pinned\":") + (pinned_ ? "true" : "false") +
         ",\"collapsed\":" + (collapsed_ ? "true" : "false") + "}");
}

void MiniWindow::UpdateBounds() {
    if (!controller_ || !hwnd_) return;
    RECT client{};
    GetClientRect(hwnd_, &client);
    controller_->put_Bounds(client);
}

void MiniWindow::Navigate() {
    if (!webview_) return;
    const std::wstring url =
        app_->BuildPageUrl(std::wstring(L"mini=1&tool=") + toolId_ + L"&miniwin=1" + extraQuery_);
    const HRESULT hr = webview_->Navigate(url.c_str());
    char log[256]{};
    std::snprintf(log, sizeof(log), "mini navigate %ls hr=0x%08lx", url.c_str(),
                  static_cast<unsigned long>(hr));
    app_->LogDebug(log);
}

void MiniWindow::OnControllerCreated(HRESULT hr, ICoreWebView2Controller* controller) {
    app_->LogDebug("mini OnControllerCreated hr=" + std::to_string(static_cast<long>(hr)));
    if (destroying_ || FAILED(hr) || !controller) return;
    controller_ = controller;
    ICoreWebView2* webview = nullptr;
    HRESULT getHr = controller_->get_CoreWebView2(&webview);
    app_->LogDebug("mini get webview hr=" + std::to_string(static_cast<long>(getHr)));
    if (FAILED(getHr) || !webview) return;
    webview_.Attach(webview);

    controller_->put_IsVisible(TRUE);
    controller_->put_ZoomFactor(1.0);
    // 页面首帧出来之前 WebView 默认是纯白，换成界面底色 #F4F6FB，
    // 即使抢在内容前露脸也不会是一块刺眼的白板。
    {
        Microsoft::WRL::ComPtr<ICoreWebView2Controller2> controller2;
        if (SUCCEEDED(controller_->QueryInterface(
                IID_ICoreWebView2Controller2,
                reinterpret_cast<void**>(controller2.GetAddressOf()))) &&
            controller2) {
            COREWEBVIEW2_COLOR color{255, 244, 246, 251};
            controller2->put_DefaultBackgroundColor(color);
        }
    }
    // 折叠条同样是网页画出来的（renderMiniCollapsedBar），这里绝不能隐藏 WebView，
    // 否则上次折叠着关掉的窗口一打开就是一片空白。
    UpdateBounds();

    ICoreWebView2Settings* settings = nullptr;
    if (SUCCEEDED(webview_->get_Settings(&settings)) && settings) {
        settings->put_IsScriptEnabled(TRUE);
        settings->put_AreDefaultScriptDialogsEnabled(TRUE);
        settings->put_IsWebMessageEnabled(TRUE);
        settings->put_AreDevToolsEnabled(FALSE);
        settings->put_AreDefaultContextMenusEnabled(TRUE);
        settings->put_IsStatusBarEnabled(FALSE);
        settings->put_IsZoomControlEnabled(FALSE);
        settings->put_IsBuiltInErrorPageEnabled(FALSE);
        settings->Release();
    }

    Microsoft::WRL::ComPtr<ICoreWebView2_3> webview3;
    if (SUCCEEDED(webview_->QueryInterface(IID_ICoreWebView2_3,
                                           reinterpret_cast<void**>(webview3.GetAddressOf()))) &&
        webview3) {
        webview3->SetVirtualHostNameToFolderMapping(
            kHost, app_->WebDir().c_str(), COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);
        webview3->SetVirtualHostNameToFolderMapping(
            kShotsHost, app_->ShotsDir().c_str(), COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);
    }
    InstallMediaHandler(webview_.Get(), environment_.Get());
    auto* handler = new MiniMessageHandler(this);
    webview_->add_WebMessageReceived(handler, &messageToken_);
    handler->Release();

    // 等页面 DOM 建完再让窗口出场（Window 的显示请求被 pendingShow_ 挂起）。
    Microsoft::WRL::ComPtr<ICoreWebView2_2> webview2;
    if (SUCCEEDED(webview_->QueryInterface(IID_ICoreWebView2_2,
                                           reinterpret_cast<void**>(webview2.GetAddressOf()))) &&
        webview2) {
        auto* readyHandler = new MiniReadyHandler(this);
        webview2->add_DOMContentLoaded(readyHandler, &domToken_);
        readyHandler->Release();
    }

    Navigate();
}

void MiniWindow::SnapToEdges() {
    if (!hwnd_ || collapsed_) return;
    RECT rect{};
    GetWindowRect(hwnd_, &rect);
    RECT work{};
    WorkAreaNear(hwnd_, nullptr, &work);
    const int margin = Scale(18);
    int x = rect.left;
    int y = rect.top;
    if (std::abs(rect.left - work.left) <= margin) x = work.left;
    if (std::abs(rect.right - work.right) <= margin) x = work.right - (rect.right - rect.left);
    if (std::abs(rect.top - work.top) <= margin) y = work.top;
    if (std::abs(rect.bottom - work.bottom) <= margin) y = work.bottom - (rect.bottom - rect.top);
    if (x != rect.left || y != rect.top) {
        SetWindowPos(hwnd_, nullptr, x, y, 0, 0,
                     SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE);
    }
}

void MiniWindow::FitHeight(int cssHeight) {
    if (!hwnd_ || collapsed_ || cssHeight <= 0 || !autoFit_) return;
    const int clientH = MulDiv(cssHeight, Dpi(), 96);
    const DWORD style = static_cast<DWORD>(GetWindowLongPtrW(hwnd_, GWL_STYLE));
    const DWORD exStyle = static_cast<DWORD>(GetWindowLongPtrW(hwnd_, GWL_EXSTYLE));
    RECT frame{0, 0, width_, clientH};
    AdjustWindowRectEx(&frame, style, FALSE, exStyle);
    const int outer = frame.bottom - frame.top;
    const int frameExtra = outer - clientH;

    RECT work{};
    WorkAreaNear(hwnd_, nullptr, &work);
    const int workH = work.bottom - work.top;
    const int minOuter = Scale(120);
    const int maxOuter = std::max(minOuter, workH - Scale(48));
    const int desired = std::clamp(outer, minOuter, maxOuter);
    const int desiredClient = std::max(Scale(90), desired - frameExtra);

    RECT rect{};
    GetWindowRect(hwnd_, &rect);
    const int currentOuter = rect.bottom - rect.top;
    if (std::abs(currentOuter - desired) <= Scale(4)) {
        lastProgramHeight_ = desiredClient;
        return;
    }
    height_ = desiredClient;
    expandedHeight_ = desiredClient;
    lastProgramHeight_ = desiredClient;
    SetWindowPos(hwnd_, nullptr, rect.left, rect.top, rect.right - rect.left, desired,
                 SWP_NOZORDER | SWP_NOACTIVATE);
}

void MiniWindow::MapMediaFolder(const std::wstring& folder) {
    if (!webview_) return;
    Microsoft::WRL::ComPtr<ICoreWebView2_3> webview3;
    if (SUCCEEDED(webview_->QueryInterface(IID_ICoreWebView2_3,
                                           reinterpret_cast<void**>(webview3.GetAddressOf()))) &&
        webview3) {
        webview3->SetVirtualHostNameToFolderMapping(
            L"media.local", folder.c_str(), COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);
    }
}

void MiniWindow::OnWebMessage(const std::string& json) {
    std::string error;
    const ts::Json root = ts::Json::Parse(json, &error);
    if (!error.empty()) return;
    if (root.GetString("type") == "mini") {
        std::string action = root.GetString("action");
        if (action.empty()) {
            const ts::Json* payload = root.Find("payload");
            if (payload) action = payload->GetString("action");
        }
        if (action == "collapse") {
            ToggleCollapse();
        } else if (action == "hide") {
            Hide();
        } else if (action == "pin") {
            TogglePin();
        } else if (action == "fitHeight") {
            int height = 0;
            const ts::Json* payload = root.Find("payload");
            if (payload) height = static_cast<int>(payload->GetNumber("height", 0));
            if (height <= 0) height = static_cast<int>(root.GetNumber("height", 0));
            FitHeight(height);
        } else if (action == "state") {
            Post(std::string("{\"type\":\"miniState\",\"pinned\":") +
                 (pinned_ ? "true" : "false") + ",\"collapsed\":" +
                 (collapsed_ ? "true" : "false") + "}");
        }
        return;
    }
    app_->OnMiniMessage(this, json);
}

LRESULT CALLBACK MiniWindow::WindowProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
    MiniWindow* self = reinterpret_cast<MiniWindow*>(GetWindowLongPtrW(hwnd, GWLP_USERDATA));
    if (message == WM_NCCREATE) {
        auto* create = reinterpret_cast<CREATESTRUCTW*>(lparam);
        self = static_cast<MiniWindow*>(create->lpCreateParams);
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(self));
        self->hwnd_ = hwnd;
    }
    if (self) return self->HandleMessage(message, wparam, lparam);
    return DefWindowProcW(hwnd, message, wparam, lparam);
}

LRESULT MiniWindow::HandleMessage(UINT message, WPARAM wparam, LPARAM lparam) {
    switch (message) {
        case WM_SIZE:
            if (wparam != SIZE_MINIMIZED) UpdateBounds();
            return 0;
        case WM_DPICHANGED: {
            const RECT* suggested = reinterpret_cast<RECT*>(lparam);
            const int newDpi = HIWORD(wparam) ? static_cast<int>(HIWORD(wparam))
                                              : static_cast<int>(DpiOfWindow(hwnd_));
            if (newDpi != Dpi()) dpi_ = newDpi;
            SetWindowPos(hwnd_, nullptr, suggested->left, suggested->top,
                         suggested->right - suggested->left, suggested->bottom - suggested->top,
                         SWP_NOZORDER | SWP_NOACTIVATE);
            // WebView2 默认自己跟随显示器 DPI（ShouldDetectMonitorScaleChanges 为
            // true），这里不能再改 ZoomFactor，否则会按 dpi 比例放大两次。
            // 只需要把新的客户区尺寸同步给它，并记下当前物理尺寸供 SaveState 用。
            RECT client{};
            GetClientRect(hwnd_, &client);
            width_ = client.right - client.left;
            height_ = client.bottom - client.top;
            UpdateBounds();
            return 0;
        }
        case WM_GETMINMAXINFO: {
            auto* info = reinterpret_cast<MINMAXINFO*>(lparam);
            info->ptMinTrackSize.x = Scale(236);
            info->ptMinTrackSize.y = collapsed_ ? Scale(kCollapsedClientHeight) : Scale(150);
            return 0;
        }
        case WM_EXITSIZEMOVE: {
            SnapToEdges();
            // 用户手拖过高度就关掉自动适配，避免和手动尺寸互相拉扯。
            if (!collapsed_ && autoFit_ && lastProgramHeight_ > 0) {
                RECT client{};
                GetClientRect(hwnd_, &client);
                if (std::abs(client.bottom - lastProgramHeight_) > Scale(4)) autoFit_ = false;
            }
            SaveState();
            return 0;
        }
        case WM_TIMER:
            if (wparam == kShowTimerId) {
                FinishShow();
                return 0;
            }
            break;
        case WM_NCLBUTTONDBLCLK:
            if (wparam == HTCAPTION) {
                ToggleCollapse();
                return 0;
            }
            break;
        case WM_CLOSE:
            Hide();
            return 0;
        case WM_DESTROY:
            if (webview_ && messageToken_.value != 0) {
                webview_->remove_WebMessageReceived(messageToken_);
                messageToken_.value = 0;
            }
            webview_.Reset();
            controller_.Reset();
            hwnd_ = nullptr;
            return 0;
        default:
            break;
    }
    return DefWindowProcW(hwnd_, message, wparam, lparam);
}

}  // namespace ts
