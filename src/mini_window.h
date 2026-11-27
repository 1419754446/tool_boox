#pragma once

#include <windows.h>
#include <wrl/client.h>

#include <string>

#include "WebView2.h"

namespace ts {

class App;

// 一个独立的 WebView2 悬浮小窗：加载同一份内嵌页面（?mini=1&tool=xxx），
// 复用主程序的 HTML/JS 与命令总线，因此任何工具页都能直接浮起来用。
class MiniWindow {
public:
    MiniWindow(App* app, ICoreWebView2Environment* environment, std::wstring toolId,
               std::wstring extraQuery = L"", std::wstring title = L"");
    ~MiniWindow();

    void Show(bool activate = true);
    void Hide();
    void Toggle();
    bool Visible() const;
    void Destroy();
    void Post(const std::string& json);
    void TogglePin();
    void ToggleCollapse();
    void MapMediaFolder(const std::wstring& folder);
    void SnapToEdges();
    void FitHeight(int cssHeight);

    const std::wstring& ToolId() const { return toolId_; }
    HWND Hwnd() const { return hwnd_; }
    bool Pinned() const { return pinned_; }
    bool Collapsed() const { return collapsed_; }

    void OnControllerCreated(HRESULT hr, ICoreWebView2Controller* controller);
    void OnWebMessage(const std::string& json);
    // 页面 DOM 就绪后回调：首次显示必须等它，否则用户先看到一片空白壳。
    void MarkContentReady();

private:
    static LRESULT CALLBACK WindowProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam);
    LRESULT HandleMessage(UINT message, WPARAM wparam, LPARAM lparam);

    bool EnsureWindow();
    void UpdateBounds();
    // 尺寸一律按"窗口所在显示器"的 DPI 换算，而不是主屏 DPI：
    // WebView2 内容就是按所在显示器 DPI 渲染的，两边基准必须一致。
    int Dpi() const { return static_cast<int>(dpi_); }
    int Scale(int value) const { return MulDiv(value, Dpi(), 96); }
    void DefaultSize(const std::wstring& id, int* width, int* height) const;
    void Navigate();
    void FinishShow();
    void SaveState();
    void LoadState();
    void ApplyPin();
    void SetCollapsed(bool collapse);

    App* app_ = nullptr;
    Microsoft::WRL::ComPtr<ICoreWebView2Environment> environment_;
    Microsoft::WRL::ComPtr<ICoreWebView2Controller> controller_;
    Microsoft::WRL::ComPtr<ICoreWebView2> webview_;

    HWND hwnd_ = nullptr;
    // 当前窗口所在显示器的 DPI（96 为基准），WM_DPICHANGED 时更新。
    UINT dpi_ = 96;
    std::wstring toolId_;
    std::wstring title_;
    std::wstring extraQuery_;
    int x_ = 0;
    int y_ = 0;
    int width_ = 0;
    int height_ = 0;
    int expandedHeight_ = 0;
    int expandedWidth_ = 0;
    bool pinned_ = true;
    bool collapsed_ = false;
    // 高度随内容变化：用户手动拖过高度后自动关闭，避免和手动尺寸打架。
    bool autoFit_ = true;
    int lastProgramHeight_ = 0;
    bool pendingNavigate_ = false;
    // 首帧前的显示请求：squash 成一次，DOM 就绪后统一放行。
    bool contentReady_ = false;
    bool pendingShow_ = false;
    bool pendingActivate_ = true;
    bool destroying_ = false;
    EventRegistrationToken messageToken_{};
    EventRegistrationToken domToken_{};
    enum { kShowTimerId = 0x51 };
};

}  // namespace ts
