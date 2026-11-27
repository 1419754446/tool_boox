#pragma once

#include <windows.h>

// 常用文件夹置顶小窗：无边框、始终置顶、单击条目即打开。
namespace tb {

void ShowFoldersPanel(HINSTANCE instance);
void HideFoldersPanel();
bool ToggleFoldersPanel(HINSTANCE instance);
bool FoldersPanelVisible();

}  // namespace tb
