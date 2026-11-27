#include "json.h"

#include <windows.h>

#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <limits>

namespace ts {
namespace {

void AppendUtf8(std::string& out, uint32_t cp) {
    if (cp <= 0x7F) {
        out.push_back(static_cast<char>(cp));
    } else if (cp <= 0x7FF) {
        out.push_back(static_cast<char>(0xC0 | (cp >> 6)));
        out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
    } else if (cp <= 0xFFFF) {
        out.push_back(static_cast<char>(0xE0 | (cp >> 12)));
        out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
    } else {
        out.push_back(static_cast<char>(0xF0 | (cp >> 18)));
        out.push_back(static_cast<char>(0x80 | ((cp >> 12) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | ((cp >> 6) & 0x3F)));
        out.push_back(static_cast<char>(0x80 | (cp & 0x3F)));
    }
}

int HexValue(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

class Parser {
public:
    explicit Parser(const std::string& text) : text_(text) {}

    bool Parse(Json& out, std::string& error) {
        SkipSpace();
        if (!ParseValue(out, 0)) {
            error = error_;
            return false;
        }
        SkipSpace();
        if (pos_ != text_.size()) {
            Fail("trailing characters");
            error = error_;
            return false;
        }
        return true;
    }

private:
    bool Fail(const char* message) {
        if (error_.empty()) {
            error_ = std::string(message) + " at byte " + std::to_string(pos_);
        }
        return false;
    }

    void SkipSpace() {
        while (pos_ < text_.size()) {
            char c = text_[pos_];
            if (c == ' ' || c == '\t' || c == '\n' || c == '\r') ++pos_;
            else break;
        }
    }

    bool ParseValue(Json& out, int depth) {
        if (depth > 64) return Fail("nesting too deep");
        SkipSpace();
        if (pos_ >= text_.size()) return Fail("unexpected end of input");
        char c = text_[pos_];
        switch (c) {
            case '{': return ParseObject(out, depth);
            case '[': return ParseArray(out, depth);
            case '"':
                out.type = Json::Type::String;
                return ParseString(out.string);
            case 't':
                if (text_.compare(pos_, 4, "true") == 0) {
                    pos_ += 4;
                    out.type = Json::Type::Bool;
                    out.boolean = true;
                    return true;
                }
                return Fail("invalid literal");
            case 'f':
                if (text_.compare(pos_, 5, "false") == 0) {
                    pos_ += 5;
                    out.type = Json::Type::Bool;
                    out.boolean = false;
                    return true;
                }
                return Fail("invalid literal");
            case 'n':
                if (text_.compare(pos_, 4, "null") == 0) {
                    pos_ += 4;
                    out.type = Json::Type::Null;
                    return true;
                }
                return Fail("invalid literal");
            default:
                if (c == '-' || (c >= '0' && c <= '9')) return ParseNumber(out);
                return Fail("unexpected character");
        }
    }

    bool ParseObject(Json& out, int depth) {
        ++pos_;  // {
        out.type = Json::Type::Object;
        SkipSpace();
        if (pos_ < text_.size() && text_[pos_] == '}') {
            ++pos_;
            return true;
        }
        while (pos_ < text_.size()) {
            SkipSpace();
            if (pos_ >= text_.size() || text_[pos_] != '"') return Fail("expected object key");
            std::string key;
            if (!ParseString(key)) return false;
            SkipSpace();
            if (pos_ >= text_.size() || text_[pos_] != ':') return Fail("expected ':'");
            ++pos_;
            Json value;
            if (!ParseValue(value, depth + 1)) return false;
            out.object.emplace(std::move(key), std::move(value));
            SkipSpace();
            if (pos_ >= text_.size()) return Fail("unterminated object");
            if (text_[pos_] == ',') {
                ++pos_;
                continue;
            }
            if (text_[pos_] == '}') {
                ++pos_;
                return true;
            }
            return Fail("expected ',' or '}'");
        }
        return Fail("unterminated object");
    }

    bool ParseArray(Json& out, int depth) {
        ++pos_;  // [
        out.type = Json::Type::Array;
        SkipSpace();
        if (pos_ < text_.size() && text_[pos_] == ']') {
            ++pos_;
            return true;
        }
        while (pos_ < text_.size()) {
            Json value;
            if (!ParseValue(value, depth + 1)) return false;
            out.array.push_back(std::move(value));
            SkipSpace();
            if (pos_ >= text_.size()) return Fail("unterminated array");
            if (text_[pos_] == ',') {
                ++pos_;
                SkipSpace();
                continue;
            }
            if (text_[pos_] == ']') {
                ++pos_;
                return true;
            }
            return Fail("expected ',' or ']'");
        }
        return Fail("unterminated array");
    }

    bool ParseString(std::string& out) {
        if (pos_ >= text_.size() || text_[pos_] != '"') return Fail("expected string");
        ++pos_;
        out.clear();
        while (pos_ < text_.size()) {
            unsigned char c = static_cast<unsigned char>(text_[pos_++]);
            if (c == '"') return true;
            if (c == '\\') {
                if (pos_ >= text_.size()) return Fail("unterminated escape");
                char esc = text_[pos_++];
                switch (esc) {
                    case '"': out.push_back('"'); break;
                    case '\\': out.push_back('\\'); break;
                    case '/': out.push_back('/'); break;
                    case 'b': out.push_back('\b'); break;
                    case 'f': out.push_back('\f'); break;
                    case 'n': out.push_back('\n'); break;
                    case 'r': out.push_back('\r'); break;
                    case 't': out.push_back('\t'); break;
                    case 'u': {
                        if (pos_ + 4 > text_.size()) return Fail("short unicode escape");
                        uint32_t cp = 0;
                        for (int i = 0; i < 4; ++i) {
                            int v = HexValue(text_[pos_ + i]);
                            if (v < 0) return Fail("invalid unicode escape");
                            cp = (cp << 4) | static_cast<uint32_t>(v);
                        }
                        pos_ += 4;
                        if (cp >= 0xD800 && cp <= 0xDBFF &&
                            pos_ + 6 <= text_.size() && text_[pos_] == '\\' && text_[pos_ + 1] == 'u') {
                            uint32_t low = 0;
                            bool valid = true;
                            for (int i = 0; i < 4; ++i) {
                                int v = HexValue(text_[pos_ + 2 + i]);
                                if (v < 0) { valid = false; break; }
                                low = (low << 4) | static_cast<uint32_t>(v);
                            }
                            if (valid && low >= 0xDC00 && low <= 0xDFFF) {
                                cp = 0x10000 + ((cp - 0xD800) << 10) + (low - 0xDC00);
                                pos_ += 6;
                            }
                        }
                        AppendUtf8(out, cp);
                        break;
                    }
                    default:
                        return Fail("invalid escape");
                }
            } else {
                if (c < 0x20) return Fail("control character in string");
                out.push_back(static_cast<char>(c));
            }
        }
        return Fail("unterminated string");
    }

    bool ParseNumber(Json& out) {
        const char* start = text_.c_str() + pos_;
        char* end = nullptr;
        double value = std::strtod(start, &end);
        if (end == start) return Fail("invalid number");
        size_t consumed = static_cast<size_t>(end - start);
        if (consumed == 0) return Fail("invalid number");
        if (!std::isfinite(value)) return Fail("number out of range");
        pos_ += consumed;
        out.type = Json::Type::Number;
        out.number = value;
        return true;
    }

    const std::string& text_;
    size_t pos_ = 0;
    std::string error_;
};

}  // namespace

Json Json::Parse(const std::string& text, std::string* error) {
    Json value;
    std::string localError;
    Parser parser(text);
    if (!parser.Parse(value, localError)) {
        if (error) *error = localError;
        return Json{};
    }
    if (error) error->clear();
    return value;
}

const Json* Json::Find(const std::string& key) const {
    if (type != Type::Object) return nullptr;
    auto it = object.find(key);
    return it == object.end() ? nullptr : &it->second;
}

std::string Json::GetString(const std::string& key, const std::string& fallback) const {
    const Json* value = Find(key);
    if (!value || value->type != Type::String) return fallback;
    return value->string;
}

double Json::GetNumber(const std::string& key, double fallback) const {
    const Json* value = Find(key);
    if (!value || value->type != Type::Number) return fallback;
    return value->number;
}

bool Json::GetBool(const std::string& key, bool fallback) const {
    const Json* value = Find(key);
    if (!value || value->type != Type::Bool) return fallback;
    return value->boolean;
}

const std::vector<Json>& Json::GetArray(const std::string& key) const {
    static const std::vector<Json> empty;
    const Json* value = Find(key);
    if (!value || value->type != Type::Array) return empty;
    return value->array;
}

std::string JsonEscape(const std::string& value) {
    static const char* hex = "0123456789abcdef";
    std::string out;
    out.reserve(value.size() + 16);
    for (unsigned char c : value) {
        switch (c) {
            case '"': out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\b': out += "\\b"; break;
            case '\f': out += "\\f"; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if (c < 0x20) {
                    out += "\\u00";
                    out.push_back(hex[(c >> 4) & 0xF]);
                    out.push_back(hex[c & 0xF]);
                } else {
                    out.push_back(static_cast<char>(c));
                }
        }
    }
    return out;
}

std::string ToUtf8(const std::wstring& value) {
    if (value.empty()) return {};
    int length = WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()),
                                     nullptr, 0, nullptr, nullptr);
    if (length <= 0) return {};
    std::string out(static_cast<size_t>(length), '\0');
    WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()),
                        out.data(), length, nullptr, nullptr);
    return out;
}

std::wstring FromUtf8(const std::string& value) {
    if (value.empty()) return {};
    int length = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, value.data(),
                                     static_cast<int>(value.size()), nullptr, 0);
    if (length <= 0) {
        length = MultiByteToWideChar(CP_UTF8, 0, value.data(),
                                     static_cast<int>(value.size()), nullptr, 0);
        if (length <= 0) return {};
    }
    std::wstring out(static_cast<size_t>(length), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()),
                        out.data(), length);
    return out;
}

}  // namespace ts
