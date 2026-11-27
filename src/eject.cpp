#include "eject.h"

#include <windows.h>
#include <winioctl.h>

namespace ts {

std::vector<UsbVolume> ListRemovableVolumes() {
    std::vector<UsbVolume> volumes;
    const DWORD bufferSize = GetLogicalDriveStringsW(0, nullptr);
    if (bufferSize == 0) return volumes;

    std::vector<WCHAR> buffer(bufferSize);
    if (GetLogicalDriveStringsW(bufferSize, buffer.data()) == 0) return volumes;

    const WCHAR* p = buffer.data();
    while (p && *p) {
        const std::wstring drive(p);
        const DWORD type = GetDriveTypeW(drive.c_str());
        const bool isRemovable = (drive.size() >= 3 && type == DRIVE_REMOVABLE);
        if (isRemovable && drive[1] == L':') {
            std::wstring path = drive;
            path.resize(3);

            UsbVolume vol;
            vol.drive = path;

            WCHAR label[256]{};
            WCHAR fsName[64]{};
            DWORD maxCmp = 0;
            DWORD flags = 0;
            const BOOL okInfo = GetVolumeInformationW(
                path.c_str(), label, 256, nullptr, &maxCmp, &flags, fsName, 64);
            if (okInfo) {
                vol.label = label;
                vol.filesystem = fsName;
            }

            ULARGE_INTEGER freeBytes{}, totalBytes{}, totalFree{};
            if (GetDiskFreeSpaceExW(path.c_str(), &freeBytes, &totalBytes, &totalFree)) {
                vol.sizeBytes = totalBytes.QuadPart;
            }
            volumes.push_back(std::move(vol));
        }
        p += wcslen(p) + 1;
    }
    return volumes;
}

bool SafeEjectVolume(wchar_t driveLetter, bool force, std::wstring& error) {
    if (driveLetter < L'A' || driveLetter > L'Z') {
        error = L"无效的盘符";
        return false;
    }
    const std::wstring device = L"\\\\.\\" + std::wstring(1, driveLetter) + L":";

    HANDLE h = CreateFileW(device.c_str(), GENERIC_READ | GENERIC_WRITE,
                           FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING,
                           0, nullptr);
    if (h == INVALID_HANDLE_VALUE) {
        error = L"无法打开磁盘设备（可能没有管理员权限）。请以管理员身份运行后再试。";
        return false;
    }

    DWORD cb = 0;
    const BOOL locked =
        DeviceIoControl(h, FSCTL_LOCK_VOLUME, nullptr, 0, nullptr, 0, &cb, nullptr);
    if (!locked && !force) {
        error = L"卷仍被其他程序占用，无法锁定，已取消弹出（数据安全优先）。"
                L"请先释放占用进程，或选择“强制弹出”。";
        CloseHandle(h);
        return false;
    }

    // 即使锁定失败也尝试卸载卷，让系统把缓存落盘。
    DeviceIoControl(h, FSCTL_DISMOUNT_VOLUME, nullptr, 0, nullptr, 0, &cb, nullptr);
    CloseHandle(h);

    HANDLE h2 = CreateFileW(device.c_str(), GENERIC_READ | GENERIC_WRITE,
                            FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING,
                            0, nullptr);
    if (h2 == INVALID_HANDLE_VALUE) {
        error = L"卷已安全卸载，但弹出设备失败（无法重新打开设备）。您可手动拔出设备。";
        return false;
    }
    const BOOL ejected =
        DeviceIoControl(h2, IOCTL_STORAGE_EJECT_MEDIA, nullptr, 0, nullptr, 0, &cb, nullptr);
    const DWORD lastError = ejected ? 0 : GetLastError();
    CloseHandle(h2);

    if (!ejected) {
        error = L"弹出失败（错误 " + std::to_wstring(lastError) +
                L"）。设备可能不支持软件弹出，请确认数据已写回后手动拔出。";
        return false;
    }
    return true;
}

}  // namespace ts