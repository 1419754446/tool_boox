#pragma once

#include <string>
#include <vector>

namespace tb {

// 给置顶小窗用的只读视图：路径保持原始写法（可能含 %USERPROFILE%）。
struct FolderEntry {
    std::wstring path;
    std::wstring note;
    std::wstring name;
    bool exists = false;
};

std::vector<FolderEntry> LoadFolderEntries();
bool OpenFolderEntry(const std::wstring& path);

void RegisterFolderCommands();

}  // namespace tb
