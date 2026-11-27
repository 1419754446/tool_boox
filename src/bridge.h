#pragma once

#include <functional>
#include <map>
#include <string>

#include "json.h"

namespace tb {

// 一次调用的结果：data 是直接拼进响应的 JSON 文本，避免二次解析。
struct Result {
    bool ok = true;
    std::string data = "{}";
    std::string error;

    static Result Ok(std::string json) {
        Result r;
        r.data = std::move(json);
        return r;
    }
    static Result Fail(std::string message) {
        Result r;
        r.ok = false;
        r.error = std::move(message);
        return r;
    }
};

using Handler = std::function<Result(const ts::Json& args)>;

// 全局命令表。新增工具只需要 Add("xxx.yyy", ...)，不必改外壳。
// 命令名统一 "<工具>.<动作>"，前端用 tb.call('folders.load') 调用。
class Bridge {
public:
    static Bridge& Get();

    void Add(const std::string& command, Handler handler);

    // 收到 {"id":"1","cmd":"folders.load","args":{...}}，返回完整响应 JSON。
    std::string Handle(const std::string& requestJson);

private:
    std::map<std::string, Handler> handlers_;
};

// 注册所有内置工具的命令。
void RegisterAllCommands();

}  // namespace tb
