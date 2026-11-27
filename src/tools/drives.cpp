#include "drives.h"

#include "../bridge.h"
#include "../json.h"

#include <windows.h>

#include <cstdint>
#include <string>
#include <vector>

namespace tb {

// 固定盘枚举在 drive_roots.cpp 里单独实现，这里只做"整理成 JSON"和"注册命令"。

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
