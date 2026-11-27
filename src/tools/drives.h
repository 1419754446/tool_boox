#pragma once

#include <string>
#include <vector>

namespace tb {

// 本地固定磁盘的根路径，形如 "C:\"。只取 DRIVE_FIXED：移动硬盘/U 盘时插时拔，
// 不适合作为"全盘扫描"的默认范围。
std::vector<std::wstring> FixedDriveRoots();

// 给前端画磁盘勾选条用：盘符、卷标、总容量、可用空间。
std::string DrivesJson();

// 注册 fs.drives（前端 toolCall 拉盘符列表）。
void RegisterDriveCommands();

}  // namespace tb
