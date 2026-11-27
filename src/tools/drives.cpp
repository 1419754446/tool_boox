#include "drives.h"

#include "../bridge.h"
#include "../json.h"

#include <windows.h>

#include <cstdint>
#include <string>
#include <vector>

namespace tb {

std::vector<std::wstring> FixedDriveRoots() {
    std::vector<std::wstring> drives;
    wchar_t buffer[512]{};
    const DWORD length = GetLogicalDriveStringsW(static_cast<DWORD>(std::size(buffer) - 1), buffer);
    if (length == 0) return drives;
    for (const wchar_t* p = buffer; *p; p += wcslen(p) + 1) {
        if (GetDriveTypeW(p) == DRIVE_FIXED) drives.emplace_back(p);
    }
    return drives;
}

std::string DrivesJson() {
    std::string json = "{\"drives\":[";
    bool first = true;
    for (const std::wstring& root : FixedDriveRoots()) {
        wchar_t label[128]{};
        DWORD serial = 0;
        GetVolumeInformationW(root.c_str(), label, static_cast<DWORD>(std::size(label)), &serial,
                              nullptr, nullptr, nullptr, 0);
        ULARGE_INTEGER freeBytes{}, totalBytes{}, totalFree{};
        GetDiskFreeSpaceExW(root.c_str(), &freeBytes, &totalBytes, &totalFree);
        if (!first) json += ",";
        first = false;
        json += "{\"letter\":\"" + ts::JsonEscape(ts::ToUtf8(root.substr(0, 2))) + "\"";
        json += ",\"label\":\"" + ts::JsonEscape(ts::ToUtf8(label)) + "\"";
        json += ",\"total\":" + std::to_string(totalBytes.QuadPart);
        json += ",\"free\":" + std::to_string(freeBytes.QuadPart) + "}";
    }
    json += "]}";
    return json;
}

void RegisterDriveCommands() {
    Bridge::Get().Add("fs.drives", [](const ts::Json&) { return Result::Ok(DrivesJson()); });
}

}  // namespace tb
