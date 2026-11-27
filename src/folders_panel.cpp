#include "folders_panel.h"

#include "tools/tool_folders.h"

#include <windows.h>
#include <shellapi.h>
#include <windowsx.h>

#include <algorithm>
#include <cstring>
#include <string>
#include <vector>

namespace tb {
namespace {

constexpr wchar_t kPanelClass[] = L"Toolbox.FoldersPanel";

struct PanelState {
    HWND hwnd = nullptr;
    HINSTANCE instance = nullptr;
    std::vector<FolderEntry> items;
    int scroll = 0;     // 首个可见行
    int hover = -1;
    int pressed = -1;
    UINT dpi = 96;
    HFONT fontTitle = nullptr;
    HFONT fontName = nullptr;
    HFONT fontSub = nullptr;
    HFONT fontGlyph = nullptr;
    HFONT fontHint = nullptr;
};

PanelState g_panel;

int Scale(int value, UINT dpi) { return MulDiv(value, static_cast<int>(dpi), 96); }

int HeaderHeight() { return Scale(46, g_panel.dpi); }
int RowHeight() { return Scale(52, g_panel.dpi); }
int FooterHeight() { return Scale(40, g_panel.dpi); }
int PanelWidth() { return Scale(372, g_panel.dpi); }
int MaxPanelHeight() { return Scale(640, g_panel.dpi); }
int MinPanelHeight() { return Scale(196, g_panel.dpi); }

int VisibleRows() {
    RECT client{};
    GetClientRect(g_panel.hwnd, &client);
    const int body = static_cast<int>(client.bottom) - HeaderHeight() - FooterHeight();
    return std::max(0, body / RowHeight());
}

void MakeFonts() {
    auto drop = [](HFONT& font) {
        if (font) {
            DeleteObject(font);
            font = nullptr;
        }
    };
    drop(g_panel.fontTitle);
    drop(g_panel.fontName);
    drop(g_panel.fontSub);
    drop(g_panel.fontGlyph);
    drop(g_panel.fontHint);

    LOGFONTW lf{};
    lf.lfQuality = CLEARTYPE_QUALITY;
    wcscpy_s(lf.lfFaceName, L"Microsoft YaHei UI");
    lf.lfWeight = FW_SEMIBOLD;
    lf.lfHeight = -Scale(15, g_panel.dpi);
    g_panel.fontTitle = CreateFontIndirectW(&lf);

    lf.lfWeight = FW_SEMIBOLD;
    lf.lfHeight = -Scale(14, g_panel.dpi);
    g_panel.fontName = CreateFontIndirectW(&lf);

    lf.lfWeight = FW_NORMAL;
    lf.lfHeight = -Scale(12, g_panel.dpi);
    g_panel.fontSub = CreateFontIndirectW(&lf);

    lf.lfHeight = -Scale(12, g_panel.dpi);
    g_panel.fontHint = CreateFontIndirectW(&lf);

    wcscpy_s(lf.lfFaceName, L"Segoe MDL2 Assets");
    lf.lfWeight = FW_NORMAL;
    lf.lfHeight = -Scale(17, g_panel.dpi);
    g_panel.fontGlyph = CreateFontIndirectW(&lf);
}

void FillRectColor(HDC dc, const RECT& rect, COLORREF color) {
    HBRUSH brush = CreateSolidBrush(color);
    FillRect(dc, &rect, brush);
    DeleteObject(brush);
}

void DrawTextIn(HDC dc, const std::wstring& text, RECT rect, HFONT font, COLORREF color,
                UINT format) {
    if (!font) return;
    HGDIOBJ oldFont = SelectObject(dc, font);
    SetTextColor(dc, color);
    SetBkMode(dc, TRANSPARENT);
    DrawTextW(dc, text.c_str(), static_cast<int>(text.size()), &rect, format);
    SelectObject(dc, oldFont);
}

void PositionPanel() {
    if (!g_panel.hwnd) return;
    POINT cursor{};
    GetCursorPos(&cursor);
    HMONITOR monitor = MonitorFromPoint(cursor, MONITOR_DEFAULTTONEAREST);
    MONITORINFO info{};
    info.cbSize = sizeof(info);
    if (!GetMonitorInfoW(monitor, &info)) return;

    const int width = PanelWidth();
    const int rows = std::min<int>(8, static_cast<int>(g_panel.items.size()));
    const int height = std::min(MaxPanelHeight(),
                                std::max(MinPanelHeight(),
                                         HeaderHeight() + FooterHeight() +
                                             std::max(3, rows) * RowHeight()));
    const int x = info.rcWork.right - width - Scale(18, g_panel.dpi);
    const int y = info.rcWork.top + Scale(64, g_panel.dpi);
    SetWindowPos(g_panel.hwnd, HWND_TOPMOST, x, y, width, height,
                 SWP_NOACTIVATE | SWP_SHOWWINDOW);
    SetWindowRgn(g_panel.hwnd, CreateRoundRectRgn(0, 0, width + 1, height + 1,
                                                  Scale(14, g_panel.dpi),
                                                  Scale(14, g_panel.dpi)),
                 TRUE);
}

void PaintPanel() {
    if (!g_panel.hwnd) return;
    PAINTSTRUCT ps{};
    HDC dc = BeginPaint(g_panel.hwnd, &ps);
    RECT client{};
    GetClientRect(g_panel.hwnd, &client);
    const int width = static_cast<int>(client.right);
    const int height = static_cast<int>(client.bottom);

    FillRectColor(dc, client, RGB(255, 255, 255));

    // 顶部分隔线
    RECT headerLine{0, HeaderHeight() - 1, width, HeaderHeight()};
    FillRectColor(dc, headerLine, RGB(233, 238, 247));

    // 标题
    RECT titleRect{Scale(16, g_panel.dpi), Scale(4, g_panel.dpi), width - Scale(96, g_panel.dpi),
                   HeaderHeight() - 2};
    DrawTextIn(dc, L"常用文件夹", titleRect, g_panel.fontTitle, RGB(18, 26, 43),
               DT_SINGLELINE | DT_VCENTER | DT_END_ELLIPSIS);

    // 计数
    RECT countRect{width - Scale(96, g_panel.dpi), Scale(4, g_panel.dpi),
                   width - Scale(40, g_panel.dpi), HeaderHeight() - 2};
    wchar_t countText[32]{};
    swprintf_s(countText, L"%zu 项", g_panel.items.size());
    DrawTextIn(dc, countText, countRect, g_panel.fontHint, RGB(124, 138, 160),
               DT_SINGLELINE | DT_VCENTER | DT_RIGHT);

    // 关闭按钮
    RECT closeRect{width - Scale(38, g_panel.dpi), 0, width - Scale(6, g_panel.dpi),
                   HeaderHeight()};
    DrawTextIn(dc, L"\uE711", closeRect, g_panel.fontGlyph, RGB(124, 138, 160),
               DT_SINGLELINE | DT_VCENTER | DT_CENTER);

    // 列表
    const int visible = VisibleRows();
    const int total = static_cast<int>(g_panel.items.size());
    const int bodyTop = HeaderHeight();
    if (g_panel.items.empty()) {
        RECT emptyRect{Scale(16, g_panel.dpi), bodyTop, width - Scale(16, g_panel.dpi),
                       bodyTop + RowHeight() * 2};
        DrawTextIn(dc, L"清单是空的，去主窗口里加几个常用目录吧。", emptyRect, g_panel.fontSub,
                   RGB(124, 138, 160), DT_WORDBREAK | DT_EDITCONTROL);
    }

    for (int row = 0; row < visible && g_panel.scroll + row < total; ++row) {
        const int index = g_panel.scroll + row;
        const FolderEntry& item = g_panel.items[static_cast<size_t>(index)];
        RECT rowRect{Scale(6, g_panel.dpi), bodyTop + row * RowHeight(),
                     width - Scale(6, g_panel.dpi), bodyTop + (row + 1) * RowHeight()};
        if (index == g_panel.hover) {
            FillRectColor(dc, rowRect, index == g_panel.pressed ? RGB(232, 238, 250)
                                                                : RGB(243, 247, 253));
        }

        // 文件夹字形
        RECT glyphRect{Scale(14, g_panel.dpi), rowRect.top, Scale(40, g_panel.dpi),
                       rowRect.bottom};
        DrawTextIn(dc, L"\uE8B7", glyphRect, g_panel.fontGlyph,
                   item.exists ? RGB(91, 75, 255) : RGB(190, 198, 210),
                   DT_SINGLELINE | DT_VCENTER);

        const int textLeft = Scale(44, g_panel.dpi);
        const int textRight = width - Scale(14, g_panel.dpi);
        RECT nameRect{textLeft, rowRect.top + Scale(7, g_panel.dpi), textRight,
                      rowRect.top + Scale(27, g_panel.dpi)};
        DrawTextIn(dc, item.name.empty() ? item.path : item.name, nameRect, g_panel.fontName,
                   item.exists ? RGB(18, 26, 43) : RGB(150, 158, 172),
                   DT_SINGLELINE | DT_END_ELLIPSIS);

        std::wstring sub = item.note;
        if (sub.empty()) sub = item.path;
        if (!item.exists) sub = L"已缺失 · " + sub;
        RECT subRect{textLeft, rowRect.top + Scale(27, g_panel.dpi), textRight,
                     rowRect.top + Scale(45, g_panel.dpi)};
        DrawTextIn(dc, sub, subRect, g_panel.fontSub,
                   item.exists ? RGB(124, 138, 160) : RGB(225, 29, 72),
                   DT_SINGLELINE | DT_END_ELLIPSIS);
    }

    // 底部提示
    RECT footLine{0, height - FooterHeight(), width, height - FooterHeight() + 1};
    FillRectColor(dc, footLine, RGB(233, 238, 247));
    RECT hintRect{Scale(16, g_panel.dpi), height - FooterHeight() + Scale(8, g_panel.dpi),
                  width - Scale(16, g_panel.dpi), height - Scale(8, g_panel.dpi)};
    DrawTextIn(dc, L"单击打开 · 右键更多 · Ctrl+Alt+Shift+F 唤出/收起", hintRect,
               g_panel.fontHint, RGB(152, 162, 179),
               DT_SINGLELINE | DT_VCENTER | DT_END_ELLIPSIS);

    EndPaint(g_panel.hwnd, &ps);
}

int RowAtPoint(POINT point) {
    RECT client{};
    GetClientRect(g_panel.hwnd, &client);
    if (point.y < HeaderHeight() || point.y >= client.bottom - FooterHeight()) return -1;
    const int row = (point.y - HeaderHeight()) / RowHeight();
    const int index = g_panel.scroll + row;
    if (index < 0 || index >= static_cast<int>(g_panel.items.size())) return -1;
    return index;
}

void CopyText(const std::wstring& text) {
    if (!OpenClipboard(g_panel.hwnd)) return;
    EmptyClipboard();
    const size_t bytes = (text.size() + 1) * sizeof(wchar_t);
    HGLOBAL handle = GlobalAlloc(GMEM_MOVEABLE, bytes);
    if (handle) {
        void* dest = GlobalLock(handle);
        if (dest) {
            memcpy(dest, text.c_str(), bytes);
            GlobalUnlock(handle);
            SetClipboardData(CF_UNICODETEXT, handle);
        }
    }
    CloseClipboard();
}

void RevealEntry(const std::wstring& rawPath) {
    wchar_t buffer[32768];
    const DWORD size = ExpandEnvironmentStringsW(rawPath.c_str(), buffer,
                                                 static_cast<DWORD>(std::size(buffer)));
    const std::wstring expanded =
        (size > 0 && size <= std::size(buffer)) ? std::wstring(buffer) : rawPath;
    if (GetFileAttributesW(expanded.c_str()) == INVALID_FILE_ATTRIBUTES) return;
    const std::wstring command = L"/select,\"" + expanded + L"\"";
    ShellExecuteW(g_panel.hwnd, L"open", L"explorer.exe", command.c_str(), nullptr, SW_SHOWNORMAL);
}

void ShowRowMenu(int index) {
    if (index < 0 || index >= static_cast<int>(g_panel.items.size())) return;
    const FolderEntry item = g_panel.items[static_cast<size_t>(index)];
    HMENU menu = CreatePopupMenu();
    AppendMenuW(menu, MF_STRING, 1, L"打开");
    AppendMenuW(menu, MF_STRING, 2, L"在资源管理器中定位");
    AppendMenuW(menu, MF_STRING, 3, L"复制路径");
    POINT cursor{};
    GetCursorPos(&cursor);
    SetForegroundWindow(g_panel.hwnd);
    const UINT command = TrackPopupMenuEx(menu, TPM_RETURNCMD | TPM_RIGHTBUTTON | TPM_TOPALIGN |
                                              TPM_LEFTALIGN,
                                          cursor.x, cursor.y, g_panel.hwnd, nullptr);
    DestroyMenu(menu);
    if (command == 1) {
        OpenFolderEntry(item.path);
    } else if (command == 2) {
        RevealEntry(item.path);
    } else if (command == 3) {
        CopyText(item.path);
    }
}

LRESULT PanelProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
    switch (message) {
        case WM_CREATE:
            g_panel.hwnd = hwnd;
            g_panel.dpi = GetDpiForWindow(hwnd);
            if (g_panel.dpi == 0) g_panel.dpi = 96;
            MakeFonts();
            return 0;
        case WM_DPICHANGED:
            g_panel.dpi = HIWORD(wparam);
            MakeFonts();
            PositionPanel();
            return 0;
        case WM_PAINT:
            PaintPanel();
            return 0;
        case WM_NCHITTEST: {
            POINT point{GET_X_LPARAM(lparam), GET_Y_LPARAM(lparam)};
            ScreenToClient(hwnd, &point);
            RECT client{};
            GetClientRect(hwnd, &client);
            const int closeLeft = static_cast<int>(client.right) - Scale(38, g_panel.dpi);
            if (point.y < HeaderHeight() && point.x < closeLeft) return HTCAPTION;
            return HTCLIENT;
        }
        case WM_MOUSEMOVE: {
            const int index = RowAtPoint({GET_X_LPARAM(lparam), GET_Y_LPARAM(lparam)});
            if (index != g_panel.hover) {
                g_panel.hover = index;
                InvalidateRect(hwnd, nullptr, FALSE);
            }
            return 0;
        }
        case WM_LBUTTONDOWN: {
            POINT point{GET_X_LPARAM(lparam), GET_Y_LPARAM(lparam)};
            g_panel.pressed = RowAtPoint(point);
            return 0;
        }
        case WM_LBUTTONUP: {
            POINT point{GET_X_LPARAM(lparam), GET_Y_LPARAM(lparam)};
            RECT client{};
            GetClientRect(hwnd, &client);
            if (point.y < HeaderHeight() &&
                point.x >= static_cast<int>(client.right) - Scale(38, g_panel.dpi)) {
                HideFoldersPanel();
                return 0;
            }
            const int index = RowAtPoint(point);
            g_panel.pressed = -1;
            if (index >= 0) {
                const FolderEntry& item = g_panel.items[static_cast<size_t>(index)];
                if (item.exists) {
                    OpenFolderEntry(item.path);
                    HideFoldersPanel();
                }
            }
            return 0;
        }
        case WM_RBUTTONUP: {
            const int index = RowAtPoint({GET_X_LPARAM(lparam), GET_Y_LPARAM(lparam)});
            ShowRowMenu(index);
            return 0;
        }
        case WM_MOUSEWHEEL: {
            const int delta = GET_WHEEL_DELTA_WPARAM(wparam) > 0 ? -3 : 3;
            const int maxScroll = std::max(0, static_cast<int>(g_panel.items.size()) - VisibleRows());
            g_panel.scroll = std::clamp(g_panel.scroll + delta, 0, maxScroll);
            InvalidateRect(hwnd, nullptr, FALSE);
            return 0;
        }
        case WM_KEYDOWN: {
            if (wparam == VK_ESCAPE) {
                HideFoldersPanel();
                return 0;
            }
            if (wparam == VK_DOWN || wparam == VK_UP) {
                const int total = static_cast<int>(g_panel.items.size());
                if (total == 0) return 0;
                int next = g_panel.hover + (wparam == VK_DOWN ? 1 : -1);
                next = std::clamp(next, 0, total - 1);
                g_panel.hover = next;
                if (next < g_panel.scroll) g_panel.scroll = next;
                if (next >= g_panel.scroll + VisibleRows()) {
                    g_panel.scroll = next - VisibleRows() + 1;
                }
                InvalidateRect(hwnd, nullptr, FALSE);
                return 0;
            }
            if (wparam == VK_RETURN && g_panel.hover >= 0 &&
                g_panel.hover < static_cast<int>(g_panel.items.size())) {
                if (OpenFolderEntry(g_panel.items[static_cast<size_t>(g_panel.hover)].path)) {
                    HideFoldersPanel();
                }
                return 0;
            }
            return 0;
        }
        case WM_ACTIVATE:
            if (LOWORD(wparam) == WA_INACTIVE && IsWindowVisible(hwnd)) {
                // 点别处自动收起，保持“浮层”手感；右键菜单期间不会触发。
                HideFoldersPanel();
            }
            return 0;
        case WM_DESTROY:
            g_panel.hwnd = nullptr;
            return 0;
        default:
            return DefWindowProcW(hwnd, message, wparam, lparam);
    }
}

void EnsureWindow(HINSTANCE instance) {
    static bool registered = false;
    if (!registered) {
        WNDCLASSEXW wc{};
        wc.cbSize = sizeof(wc);
        wc.style = CS_HREDRAW | CS_VREDRAW | CS_DBLCLKS;
        wc.lpfnWndProc = PanelProc;
        wc.hInstance = instance;
        wc.hCursor = LoadCursorW(nullptr, IDC_HAND);
        wc.lpszClassName = kPanelClass;
        RegisterClassExW(&wc);
        registered = true;
    }
    if (g_panel.hwnd) return;
    g_panel.instance = instance;
    g_panel.hwnd = CreateWindowExW(WS_EX_TOPMOST | WS_EX_TOOLWINDOW, kPanelClass, L"常用文件夹",
                                   WS_POPUP, 0, 0, PanelWidth(), MinPanelHeight(), nullptr,
                                   nullptr, instance, nullptr);
}

}  // namespace

void ShowFoldersPanel(HINSTANCE instance) {
    EnsureWindow(instance);
    if (!g_panel.hwnd) return;
    g_panel.items = LoadFolderEntries();
    g_panel.scroll = 0;
    g_panel.hover = -1;
    g_panel.pressed = -1;
    PositionPanel();
    ShowWindow(g_panel.hwnd, SW_SHOW);
    SetForegroundWindow(g_panel.hwnd);
    InvalidateRect(g_panel.hwnd, nullptr, TRUE);
}

void HideFoldersPanel() {
    if (g_panel.hwnd) ShowWindow(g_panel.hwnd, SW_HIDE);
}

bool FoldersPanelVisible() {
    return g_panel.hwnd && IsWindowVisible(g_panel.hwnd);
}

bool ToggleFoldersPanel(HINSTANCE instance) {
    if (FoldersPanelVisible()) {
        HideFoldersPanel();
        return false;
    }
    ShowFoldersPanel(instance);
    return true;
}

}  // namespace tb
