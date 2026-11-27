#include "bridge.h"

#include "tools/tool_folders.h"
#include "tools/tool_video.h"
#include "tools/drives.h"

namespace tb {

Bridge& Bridge::Get() {
    static Bridge instance;
    return instance;
}

void Bridge::Add(const std::string& command, Handler handler) {
    handlers_[command] = std::move(handler);
}

std::string Bridge::Handle(const std::string& requestJson) {
    std::string error;
    const ts::Json request = ts::Json::Parse(requestJson, &error);
    if (!request.object.size()) {
        return "{\"type\":\"response\",\"ok\":false,\"error\":\"" +
               ts::JsonEscape(error.empty() ? "请求不是合法的 JSON" : error) + "\"}";
    }

    const std::string id = request.GetString("id");
    const std::string command = request.GetString("cmd");
    const ts::Json* args = request.Find("args");

    std::string head = "{\"type\":\"response\",\"id\":\"" + ts::JsonEscape(id) + "\"";
    auto it = handlers_.find(command);
    if (it == handlers_.end()) {
        return head + ",\"ok\":false,\"error\":\"" +
               ts::JsonEscape("未注册的命令: " + command) + "\"}";
    }

    static const ts::Json kEmpty;
    Result result;
    try {
        result = it->second(args ? *args : kEmpty);
    } catch (const std::exception& e) {
        return head + ",\"ok\":false,\"error\":\"" + ts::JsonEscape(e.what()) + "\"}";
    } catch (...) {
        return head + ",\"ok\":false,\"error\":\"命令执行异常\"}";
    }

    if (!result.ok) {
        return head + ",\"ok\":false,\"error\":\"" + ts::JsonEscape(result.error) + "\"}";
    }
    return head + ",\"ok\":true,\"data\":" + result.data + "}";
}

void RegisterAllCommands() {
    RegisterFolderCommands();
    RegisterVideoCommands();
    RegisterDriveCommands();
}

}  // namespace tb
