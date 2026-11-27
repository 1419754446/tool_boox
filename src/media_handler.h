#pragma once

#include "WebView2.h"

namespace ts {

// 为 https://media.local/* 安装一个本地文件处理器：支持 Range，可随当前预览目录
// 动态切换，不需要重建 WebView2 或重新导航页面。
void InstallMediaHandler(ICoreWebView2* webview, ICoreWebView2Environment* environment);

}  // namespace ts
