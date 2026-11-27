#include <windows.h>
#include <shellscalingapi.h>

#include "app.h"

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int) {
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

    HRESULT comResult = CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    if (FAILED(comResult)) return 1;

    int exitCode = 1;
    {
        ts::App app;
        if (app.Initialize(instance, GetCommandLineW())) {
            exitCode = app.Run();
        } else if (app.AlreadyRunning()) {
            exitCode = 0;
        }
    }
    CoUninitialize();
    return exitCode;
}
