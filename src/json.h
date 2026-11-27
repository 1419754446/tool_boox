#pragma once

#include <map>
#include <string>
#include <vector>

namespace ts {

class Json {
public:
    enum class Type { Null, Bool, Number, String, Array, Object };

    Type type = Type::Null;
    bool boolean = false;
    double number = 0.0;
    std::string string;
    std::vector<Json> array;
    std::map<std::string, Json> object;

    static Json Parse(const std::string& text, std::string* error = nullptr);

    const Json* Find(const std::string& key) const;
    std::string GetString(const std::string& key, const std::string& fallback = {}) const;
    double GetNumber(const std::string& key, double fallback = 0.0) const;
    bool GetBool(const std::string& key, bool fallback = false) const;
    const std::vector<Json>& GetArray(const std::string& key) const;
};

std::string JsonEscape(const std::string& value);
std::string ToUtf8(const std::wstring& value);
std::wstring FromUtf8(const std::string& value);

}  // namespace ts
