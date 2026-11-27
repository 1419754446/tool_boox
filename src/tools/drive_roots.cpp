// 只回答一个问题：哪些盘算"可以全盘扫描的固定盘"。
//
// 刻意不依赖 bridge / json：扫描器和重复查找只需要这一份枚举结果，
// 这样回归测试可以单独链接本文件，而不必把一个函数的依赖拖成一整条
// 命令注册链路（bridge → 各工具 → 视频后端……）。
#include "drives.h"

#include <windows.h>

#include <string>
#include <vector>

namespace tb {

std::vector<std::wstring> FixedDriveRoots() {
    std::vector<std::wstring> drives;
    wchar_t buffer[512]{};
    const DWORD length = GetLogicalDriveStringsW(static_cast<DWORD>(std::size(buffer) - 1), buffer);
    if (length == 0) return drives;
    for (const wchar_t* p = buffer; *p; p += wcslen(p) + 1) {
        // 只取 DRIVE_FIXED：U 盘/网络盘/光驱不该出现在全盘扫描的候选里，
        // 否则用户会在盘符条上看到一块自己并不想扫的盘。
        if (GetDriveTypeW(p) == DRIVE_FIXED) drives.emplace_back(p);
    }
    return drives;
}

}  // namespace tb
