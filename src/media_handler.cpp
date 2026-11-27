#include "media_handler.h"

#include "host.h"

#include <windows.h>
#include <shlwapi.h>
#include <wrl/client.h>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <string>

using Microsoft::WRL::ComPtr;

namespace ts {
namespace {

std::wstring LowerExtension(const std::wstring& path) {
    const size_t dot = path.find_last_of(L'.');
    if (dot == std::wstring::npos) return {};
    std::wstring ext = path.substr(dot);
    for (wchar_t& c : ext) c = static_cast<wchar_t>(towlower(c));
    return ext;
}

const wchar_t* MimeFor(const std::wstring& path) {
    const std::wstring ext = LowerExtension(path);
    if (ext == L".mp4" || ext == L".m4v") return L"video/mp4";
    if (ext == L".webm") return L"video/webm";
    if (ext == L".mkv") return L"video/x-matroska";
    if (ext == L".mov") return L"video/quicktime";
    if (ext == L".avi") return L"video/x-msvideo";
    if (ext == L".wmv") return L"video/x-ms-wmv";
    if (ext == L".flv") return L"video/x-flv";
    if (ext == L".ts" || ext == L".m2ts") return L"video/mp2t";
    if (ext == L".m4a") return L"audio/mp4";
    if (ext == L".mp3") return L"audio/mpeg";
    return L"application/octet-stream";
}

// 只暴露长度受限的文件片段，WebView2 按 Range 读取时不会把整个大视频读进内存。
class FileRangeStream final : public IStream {
public:
    FileRangeStream(HANDLE file, uint64_t start, uint64_t length)
        : file_(file), start_(start), length_(length) {}

    ~FileRangeStream() {
        if (file_ != INVALID_HANDLE_VALUE) CloseHandle(file_);
    }

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** result) override {
        if (!result) return E_POINTER;
        if (riid == IID_IUnknown || riid == IID_IStream) {
            *result = static_cast<IStream*>(this);
            AddRef();
            return S_OK;
        }
        *result = nullptr;
        return E_NOINTERFACE;
    }

    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }

    ULONG STDMETHODCALLTYPE Release() override {
        ULONG count = --refs_;
        if (count == 0) delete this;
        return count;
    }

    HRESULT STDMETHODCALLTYPE Read(void* buffer, ULONG bytes, ULONG* read) override {
        if (read) *read = 0;
        if (!buffer) return E_POINTER;
        if (position_ >= length_) return S_OK;
        const uint64_t remain = length_ - position_;
        const ULONG want = static_cast<ULONG>(std::min<uint64_t>(bytes, remain));
        LARGE_INTEGER offset{};
        offset.QuadPart = static_cast<LONGLONG>(start_ + position_);
        if (!SetFilePointerEx(file_, offset, nullptr, FILE_BEGIN)) return E_FAIL;
        DWORD got = 0;
        if (!ReadFile(file_, buffer, want, &got, nullptr)) return E_FAIL;
        position_ += got;
        if (read) *read = got;
        return got == want ? S_OK : S_FALSE;
    }

    HRESULT STDMETHODCALLTYPE Write(const void*, ULONG, ULONG*) override { return E_NOTIMPL; }

    HRESULT STDMETHODCALLTYPE Seek(LARGE_INTEGER move, DWORD origin, ULARGE_INTEGER* newPosition) override {
        int64_t next = 0;
        if (origin == STREAM_SEEK_SET) next = move.QuadPart;
        else if (origin == STREAM_SEEK_CUR) next = static_cast<int64_t>(position_) + move.QuadPart;
        else if (origin == STREAM_SEEK_END) next = static_cast<int64_t>(length_) + move.QuadPart;
        else return STG_E_INVALIDFUNCTION;
        if (next < 0) return STG_E_INVALIDPOINTER;
        if (static_cast<uint64_t>(next) > length_) return STG_E_INVALIDPOINTER;
        position_ = static_cast<uint64_t>(next);
        if (newPosition) newPosition->QuadPart = position_;
        return S_OK;
    }

    HRESULT STDMETHODCALLTYPE SetSize(ULARGE_INTEGER) override { return E_NOTIMPL; }

    HRESULT STDMETHODCALLTYPE CopyTo(IStream*, ULARGE_INTEGER, ULARGE_INTEGER*,
                                     ULARGE_INTEGER*) override { return E_NOTIMPL; }

    HRESULT STDMETHODCALLTYPE Commit(DWORD) override { return S_OK; }
    HRESULT STDMETHODCALLTYPE Revert() override { return S_OK; }
    HRESULT STDMETHODCALLTYPE LockRegion(ULARGE_INTEGER, ULARGE_INTEGER, DWORD) override { return E_NOTIMPL; }
    HRESULT STDMETHODCALLTYPE UnlockRegion(ULARGE_INTEGER, ULARGE_INTEGER, DWORD) override { return E_NOTIMPL; }

    HRESULT STDMETHODCALLTYPE Stat(STATSTG* stat, DWORD flags) override {
        if (!stat) return E_POINTER;
        ZeroMemory(stat, sizeof(*stat));
        stat->type = STGTY_STREAM;
        stat->cbSize.QuadPart = length_;
        stat->grfMode = STGM_READ;
        if (!(flags & STATFLAG_NONAME)) {
            const wchar_t* name = L"media";
            const size_t bytes = (wcslen(name) + 1) * sizeof(wchar_t);
            stat->pwcsName = static_cast<wchar_t*>(CoTaskMemAlloc(bytes));
            if (stat->pwcsName) memcpy(stat->pwcsName, name, bytes);
        }
        return S_OK;
    }

    HRESULT STDMETHODCALLTYPE Clone(IStream**) override { return E_NOTIMPL; }

private:
    std::atomic<ULONG> refs_{1};
    HANDLE file_ = INVALID_HANDLE_VALUE;
    uint64_t start_ = 0;
    uint64_t length_ = 0;
    uint64_t position_ = 0;
};

struct RangeSpec {
    bool valid = false;
    uint64_t start = 0;
    uint64_t end = 0;
};

RangeSpec ParseRange(const std::wstring& header, uint64_t size) {
    RangeSpec spec;
    if (header.rfind(L"bytes=", 0) != 0) return spec;
    const std::wstring value = header.substr(6);
    const size_t dash = value.find(L'-');
    if (dash == std::wstring::npos) return spec;
    try {
        const std::wstring startText = value.substr(0, dash);
        const std::wstring endText = value.substr(dash + 1);
        if (startText.empty()) {
            // bytes=-1024：最后 1024 字节
            const uint64_t suffix = std::stoull(endText);
            if (!suffix) return spec;
            spec.start = suffix >= size ? 0 : size - suffix;
            spec.end = size ? size - 1 : 0;
        } else {
            spec.start = std::stoull(startText);
            spec.end = endText.empty() ? (size ? size - 1 : 0) : std::stoull(endText);
        }
        if (size == 0 || spec.start >= size || spec.end < spec.start) return spec;
        spec.end = std::min(spec.end, size - 1);
        spec.valid = true;
    } catch (...) {
        return spec;
    }
    return spec;
}

class MediaHandler final : public ICoreWebView2WebResourceRequestedEventHandler {
public:
    explicit MediaHandler(ICoreWebView2Environment* environment) : environment_(environment) {}

    HRESULT STDMETHODCALLTYPE QueryInterface(REFIID riid, void** result) override {
        if (!result) return E_POINTER;
        if (riid == IID_IUnknown ||
            riid == IID_ICoreWebView2WebResourceRequestedEventHandler) {
            *result = static_cast<ICoreWebView2WebResourceRequestedEventHandler*>(this);
            AddRef();
            return S_OK;
        }
        *result = nullptr;
        return E_NOINTERFACE;
    }

    ULONG STDMETHODCALLTYPE AddRef() override { return ++refs_; }
    ULONG STDMETHODCALLTYPE Release() override {
        ULONG count = --refs_;
        if (count == 0) delete this;
        return count;
    }

    HRESULT STDMETHODCALLTYPE Invoke(ICoreWebView2* /*sender*/,
                                     ICoreWebView2WebResourceRequestedEventArgs* args) override {
        if (!args || !environment_) return S_OK;
        ComPtr<ICoreWebView2WebResourceRequest> request;
        if (FAILED(args->get_Request(&request)) || !request) return S_OK;
        LPWSTR rawUri = nullptr;
        if (FAILED(request->get_Uri(&rawUri)) || !rawUri) return S_OK;
        std::wstring uri(rawUri);
        CoTaskMemFree(rawUri);
        if (uri.rfind(L"https://media.local/", 0) != 0) return S_OK;

        std::wstring path = uri.substr(20);
        const size_t query = path.find_first_of(L"?#");
        if (query != std::wstring::npos) path.resize(query);
        std::wstring decoded(path);
        if (!decoded.empty()) {
            DWORD chars = static_cast<DWORD>(decoded.size() + 1);
            UrlUnescapeW(decoded.data(), nullptr, &chars, URL_UNESCAPE_INPLACE | URL_ESCAPE_PERCENT);
        }
        if (decoded.empty() || decoded.find(L"..") != std::wstring::npos ||
            decoded.find(L'/') != std::wstring::npos || decoded.find(L'\\') != std::wstring::npos) {
            Respond(args, 404, L"Not Found", L"Content-Length: 0\r\n");
            return S_OK;
        }

        const std::wstring folder = tb::MediaFolder();
        if (folder.empty()) {
            Respond(args, 404, L"Not Found", L"Content-Length: 0\r\n");
            return S_OK;
        }
        const std::wstring full = folder + L"\\" + decoded;
        HANDLE file = CreateFileW(full.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                                  nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (file == INVALID_HANDLE_VALUE) {
            Respond(args, 404, L"Not Found", L"Content-Length: 0\r\n");
            return S_OK;
        }
        LARGE_INTEGER size{};
        if (!GetFileSizeEx(file, &size) || size.QuadPart <= 0) {
            CloseHandle(file);
            Respond(args, 404, L"Not Found", L"Content-Length: 0\r\n");
            return S_OK;
        }

        std::wstring rangeHeader;
        ComPtr<ICoreWebView2HttpRequestHeaders> headers;
        if (SUCCEEDED(request->get_Headers(&headers)) && headers) {
            LPWSTR value = nullptr;
            if (SUCCEEDED(headers->GetHeader(L"Range", &value)) && value) {
                rangeHeader = value;
                CoTaskMemFree(value);
            }
        }
        const uint64_t total = static_cast<uint64_t>(size.QuadPart);
        const RangeSpec range = ParseRange(rangeHeader, total);
        const uint64_t start = range.valid ? range.start : 0;
        const uint64_t end = range.valid ? range.end : total - 1;
        const uint64_t length = end - start + 1;

        ComPtr<IStream> stream;
        stream.Attach(new FileRangeStream(file, start, length));
        wchar_t extra[512]{};
        if (range.valid) {
            swprintf_s(extra, L"Content-Range: bytes %llu-%llu/%llu\r\n", start, end, total);
        } else {
            extra[0] = L'\0';
        }
        wchar_t allHeaders[1024]{};
        swprintf_s(allHeaders,
                   L"Content-Type: %s\r\nAccept-Ranges: bytes\r\nContent-Length: %llu\r\n"
                   L"Cache-Control: no-store\r\n%s",
                   MimeFor(decoded), length, extra);
        Respond(args, range.valid ? 206 : 200, range.valid ? L"Partial Content" : L"OK",
                allHeaders, stream.Get());
        return S_OK;
    }

private:
    void Respond(ICoreWebView2WebResourceRequestedEventArgs* args, int status,
                 const wchar_t* reason, const wchar_t* headers, IStream* stream = nullptr) {
        ComPtr<ICoreWebView2WebResourceResponse> response;
        if (SUCCEEDED(environment_->CreateWebResourceResponse(stream, status, reason, headers,
                                                              &response)) && response) {
            args->put_Response(response.Get());
        }
    }

    std::atomic<ULONG> refs_{1};
    ComPtr<ICoreWebView2Environment> environment_;
};

}  // namespace

void InstallMediaHandler(ICoreWebView2* webview, ICoreWebView2Environment* environment) {
    if (!webview || !environment) return;
    webview->AddWebResourceRequestedFilter(L"https://media.local/*",
                                           COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL);
    auto* handler = new MediaHandler(environment);
    EventRegistrationToken token{};
    webview->add_WebResourceRequested(handler, &token);
    handler->Release();
}

}  // namespace ts
