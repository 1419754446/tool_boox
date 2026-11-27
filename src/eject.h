#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace ts {

// 一个可移动卷的描述
struct UsbVolume {
    std::wstring drive;       // "E:\"
    std::wstring label;       // 卷标
    std::wstring filesystem;  // FAT32 / exFAT / NTFS ...
    uint64_t sizeBytes = 0;   // 卷容量
};

// 枚举所有可移动（U盘 / 读卡器 / 移动硬盘）盘符。
std::vector<UsbVolume> ListRemovableVolumes();

// 安全弹出指定盘符：
//   1. 尝试 LOCK_VOLUME；非 force 时锁定失败即中止（数据安全优先）。
//   2. DISMOUNT_VOLUME（此时由系统负责把缓存写回）。
//   3. IOCTL_STORAGE_EJECT_MEDIA 弹出介质。
// force=true 表示调用方已确认结束占用进程，锁定失败也继续卸载。
// 返回 true 表示成功弹出；失败时用 error 给出可读原因。
bool SafeEjectVolume(wchar_t driveLetter, bool force, std::wstring& error);

}  // namespace ts