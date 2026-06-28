#include <node_api.h>
#import <Cocoa/Cocoa.h>
#import <CoreGraphics/CoreGraphics.h>

static NSWindow* windowFromArg(napi_env env, napi_value arg) {
  void* data = nullptr; size_t len = 0;
  if (napi_get_buffer_info(env, arg, &data, &len) != napi_ok) return nil;
  if (!data || len < sizeof(void*)) return nil;
  NSView* view = *reinterpret_cast<NSView* __unsafe_unretained*>(data); // getNativeWindowHandle() = NSView* on macOS
  return view ? [view window] : nil;
}

static napi_value SetDesktopLevel(napi_env env, napi_callback_info info) {
  size_t argc = 1; napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  NSWindow* w = windowFromArg(env, args[0]);
  if (w) {
    // Just ABOVE the desktop-icon level (but still far below normal app windows, which sit at
    // level 0): the window must be the front-most surface over the bare desktop so macOS delivers
    // it forwarded mouse-MOVE events (hover detection for the now-playing card) and, once the
    // renderer asks to be interactive, the CLICK. Below the icon level the Finder desktop sits on
    // top and swallows both, so the card could never be hovered or clicked. The app hides the
    // desktop icons by default, so covering that (now-empty) layer has no visual cost.
    [w setLevel:(CGWindowLevelForKey(kCGDesktopIconWindowLevelKey) + 1)];
    [w setCollectionBehavior:(NSWindowCollectionBehaviorCanJoinAllSpaces |
                              NSWindowCollectionBehaviorStationary |
                              NSWindowCollectionBehaviorIgnoresCycle)];
    // click-through is owned by Electron's setIgnoreMouseEvents(true, {forward:true}) in main.js
    // (forwarding is what lets the renderer see the pointer over the card); don't set it here too.
  }
  return nullptr;
}

static napi_value SetNormalLevel(napi_env env, napi_callback_info info) {
  size_t argc = 1; napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  NSWindow* w = windowFromArg(env, args[0]);
  if (w) {
    [w setLevel:NSNormalWindowLevel];
    [w setIgnoresMouseEvents:NO];
    [w makeKeyAndOrderFront:nil];
  }
  return nullptr;
}

static napi_value Init(napi_env env, napi_value exports) {
  napi_value fnD, fnN;
  napi_create_function(env, nullptr, 0, SetDesktopLevel, nullptr, &fnD);
  napi_create_function(env, nullptr, 0, SetNormalLevel, nullptr, &fnN);
  napi_set_named_property(env, exports, "setDesktopLevel", fnD);
  napi_set_named_property(env, exports, "setNormalLevel", fnN);
  return exports;
}
NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
