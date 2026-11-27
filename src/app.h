#pragma once

#include <windows.h>
#include <shellapi.h>
#include <wrl/client.h>

#include <atomic>
#include <functional>
#include <memory>
#include <stop_token>
#include <string>
#include <thread>
#include <vector>

#include "WebView2.h"
#include "organizer.h"
#include "scanner.h"
#include "tasks.h"

namespace ts {

class MiniWindow;

class App {
public:
    App() = default;
    ~App();

    bool Initialize(HINSTANCE instance, const std::wstring& commandLine);
    int Run();
    bool AlreadyRunning() const { return alreadyRunning_; }

    // WebView2 COM 回调（由 app.cpp 中的 handler 调用）
    void OnEnvironmentCreated(HRESULT hr, ICoreWebView2Environment* environment);
    void OnControllerCreated(HRESULT hr, ICoreWebView2Controller* controller);
    void OnWebMessage(const std::string& json);
    void OnNavigationCompleted(bool success);
    void OnCaptureCompleted(HRESULT hr);

    // 新工具模块（tb 命令总线）往界面推 JSON：任意线程安全，内部转投 UI 线程。
    void PostToWeb(const std::string& json);
    void PostToWebThreaded(const std::string& json);

    // 悬浮小窗（同一个环境里再建 WebView2 控制器）
    void ShowMiniWindow(const std::wstring& toolId, bool toggle = true,
                        const std::wstring& extraQuery = L"");
    void ShowPreviewWindow(const std::wstring& path, const std::wstring& name);
    void CloseMiniWindow(MiniWindow* window);
    void OnMiniMessage(MiniWindow* sender, const std::string& json);
    void BroadcastJson(const std::string& json);
    bool MapMediaFolder(const std::wstring& folder);
    const std::wstring& MediaFolderPath() const { return mediaFolder_; }
    void LogDebug(const std::string& text);
    std::wstring BuildPageUrl(const std::wstring& query) const;
    const std::wstring& WebDir() const { return webDir_; }
    std::wstring ShotsDir() const;

private:
    static LRESULT CALLBACK WindowProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam);
    LRESULT HandleMessage(UINT message, WPARAM wparam, LPARAM lparam);

    using TaskProgress = std::function<void(std::string)>;
    using TaskWork = std::function<std::string(std::stop_token, const std::atomic<bool>&,
                                              TaskProgress)>;

    struct TaskControl {
        uint64_t generation = 0;
        std::atomic<bool> cancel{false};
        std::atomic<bool> finished{false};
        std::stop_source stopSource;
        std::thread thread;
    };

    struct RecycleJob {
        std::atomic<bool> finished{false};
        std::thread thread;
    };

    // 排队等待执行的回收站请求（最多同时 2 个在执行，其余排队）。
    struct RecyclePending {
        std::vector<std::wstring> paths;
        std::string requestId;
    };

    bool CreateMainWindow();
    bool CreateSplash();
    void CloseSplash();
    bool PrepareAssets();
    void CreateWebView();
    void StartJsonTask(TaskWork work);
    void StartAuxTask(TaskWork work);
    void LaunchAuxTask(TaskWork work);
    void ReapAuxTasks();
    void PumpAuxTasks();
    void ShutdownAuxTasks();
    void PickFile(const std::string& requestId, const std::string& target);
    void PickFiles(const std::string& requestId, const std::string& title,
                   const std::string& filter);
    std::string ReadFileAsBase64Json(const std::string& requestId, const std::string& pathUtf8);
    void ExportFile(const std::string& requestId, const std::string& suggestedName,
                    const std::string& filter, const std::string& contentB64);
    void SetZoom(double factor);
    void ResizeWebView();
    void PostJson(const std::string& json);
    void DispatchWebMessage(const std::string& json, MiniWindow* sender = nullptr);
    // 托盘与置顶面板
    bool CreateTrayIcon();
    void RemoveTrayIcon();
    void HandleTrayMessage(WPARAM wparam, LPARAM lparam);
    void ShowTrayMenu();
    void ShowMainWindowNow();
    void HideMainWindowToTray();
    void ToggleFoldersPanel();
    bool AutostartEnabled();
    void SetAutostart(bool enable);
    void SendAppInfo();
    void ApplyTheme(const std::string& theme);
    std::wstring AppIniPath() const;
    void LoadAppPrefs();
    void ApplyTaskbarButton();
    void PickFolder(const std::string& requestId);
    void StartLargeScan(const std::vector<std::wstring>& roots, uint64_t minSize, bool includeHidden);
    void StartEmptyScan(const std::vector<std::wstring>& roots);
    void StartFileSearch(const std::string& root, const std::string& pattern,
                         uint64_t minSize, int64_t modifiedWithinMs,
                         bool includeHidden, bool recursive);
    void StartFolderCompare(const std::string& rootA, const std::string& rootB, bool compareContent);
    void StartFileCopy(std::vector<std::pair<std::wstring, std::wstring>> pairs);
    void StartFileRename(std::vector<std::pair<std::wstring, std::wstring>> pairs,
                             std::string requestId = {});
    void CancelScan();
    void RetireCurrentTask();
    void LaunchMainTask(TaskWork work);
    void ReapFinishedTasks();
    void PumpPendingTasks();
    void ShutdownTasks();
    void ReapRecycleJobs();
    void ShutdownRecycleJobs();
    void PumpRecycleQueue();
    void LaunchRecycleJob(RecyclePending item);
    void StartExportWrite(std::wstring saved, std::string contentB64,
                          std::string requestId);
    void ReapExportWriteThreads();
    void ShutdownExportJobs();
    void StartUnlockCheck(const std::wstring& path, const std::string& mode);
    void StartKillProcess(uint32_t pid);
    void StartScreenCapture(bool region);
    void FinishScreenCapture(void* payload);
    void ReapTimedOutScreenThreads();
    void HandleScreenCaptureTimeout();
    void ShutdownScreenCapture();
    void OnClipboardUpdate();
    void SetClipboardListening(bool enabled);
    void RecyclePaths(std::vector<std::wstring> paths, std::string requestId);
    std::wstring CaptureScreenToFile();
    std::string CaptureScreenToDataUrl(bool& ok);
    void CaptureScreenshot();
    void HandleRecycleDone(void* payload);
    std::wstring ExeDirectory() const;

    HINSTANCE instance_ = nullptr;
    HWND hwnd_ = nullptr;
    HWND splash_ = nullptr;
    bool mainShown_ = false;
    HBRUSH backgroundBrush_ = nullptr;
    HMODULE webviewLoader_ = nullptr;
    HANDLE singleInstance_ = nullptr;

    Microsoft::WRL::ComPtr<ICoreWebView2Environment> environment_;
    Microsoft::WRL::ComPtr<ICoreWebView2Controller> controller_;
    Microsoft::WRL::ComPtr<ICoreWebView2> webview_;

    std::wstring cacheRoot_;
    std::wstring mediaFolder_;
    std::wstring webDir_;
    std::wstring webPage_ = L"index.html";
    std::wstring loaderPath_;
    std::wstring userDataDir_;
    std::wstring screenshotPath_;
    std::wstring pageQuery_;
    bool screenshotMode_ = false;
    bool screenshotOk_ = false;
    bool devMode_ = false;
    bool disableGpu_ = false;
    bool blankMode_ = false;
    bool forceFileUrl_ = false;
    bool alreadyRunning_ = false;
    bool darkTheme_ = false;
    bool clipboardListening_ = false;
    bool startHidden_ = false;
    bool showPanelAtStart_ = false;
    bool quitting_ = false;
    bool trayCreated_ = false;
    bool showTaskbar_ = true;
    NOTIFYICONDATAW trayIcon_{};
    int dpi_ = 96;

    std::vector<MiniWindow*> miniWindows_;
    MiniWindow* previewWindow_ = nullptr;

    std::shared_ptr<TaskControl> currentTask_;
    std::vector<std::shared_ptr<TaskControl>> retiredTasks_;
    std::vector<std::shared_ptr<TaskControl>> auxTasks_;
    std::vector<TaskWork> pendingTasks_;
    std::vector<TaskWork> pendingAux_;
    uint64_t scanGeneration_ = 0;

    std::vector<std::shared_ptr<RecycleJob>> recycleJobs_;
    std::vector<RecyclePending> pendingRecycle_;    // 导出写盘线程及其完成标志；完成后在 kMsgExportDone 里回收，避免运行期积压。
    std::vector<std::shared_ptr<RecycleJob>> exportWriteThreads_;

    std::thread screenCaptureThread_;
    // 超时的截图线程：不响应取消，会自行跑完后再回包。用带 finished 标志的结构
    // 便于在后续截图前非阻塞地回收已完成的线程，避免长期积压。
    std::vector<std::shared_ptr<RecycleJob>> timedOutScreenThreads_;
    bool screenCaptureInProgress_ = false;
    uint64_t screenCaptureGeneration_ = 0;
    HWND screenCapturePrevFore_ = nullptr;
    DWORD screenCapturePrevAffinity_ = 0;
    bool screenCaptureHadAffinity_ = false;
    bool screenCaptureExcluded_ = false;
};

}  // namespace ts
