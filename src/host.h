#pragma once

#include <windows.h>

#include <mutex>
#include <string>

// 外壳提供给「新工具模块」的最小接口。
// 新工具只需要这几样东西：主窗口、数据目录、往界面推消息（可从任意线程调用）。
namespace tb {

HWND MainWindow();
const std::wstring& DataDir();
void PostMessage(const std::string& json);

// 把某个目录临时映射到 https://media.local，供内嵌播放器直接读取本地视频。
bool MapMediaFolder(const std::wstring& folder);
void SetMediaFolder(const std::wstring& folder);
const std::wstring& MediaFolder();

// GDI+ 的全局状态不是线程安全的：截图线程、后台元数据线程、剪贴板辅助线程与
// 启动闪屏（UI 线程）可能同时在用 GDI+，会产生竞争。所有 GDI+ 临界区都必须
// 持有这把进程级互斥锁串行化访问。
inline std::mutex& GdiplusSync() {
    static std::mutex mutex;
    return mutex;
}

}  // namespace tb
