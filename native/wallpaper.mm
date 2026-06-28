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
  size_t argc = 2; napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  NSWindow* w = windowFromArg(env, args[0]);
  bool aboveIcons = false;
  if (argc >= 2) napi_get_value_bool(env, args[1], &aboveIcons); // chosen by main.js from desktopHidden
  if (w) {
    // Two desktop placements, both far below normal app windows (level 0):
    //  • ABOVE the icon level (+1): the window is the front-most surface over the bare desktop, so
    //    macOS delivers it forwarded mouse-MOVE events + clicks → the now-playing card is hoverable
    //    and clickable. Used ONLY when desktop icons are hidden (the app's clean-wallpaper default),
    //    so covering that now-empty layer costs nothing.
    //  • BELOW the icon level (-1): the Finder desktop + icons sit on top, so the user's icons stay
    //    visible (a true wallpaper). Used when icons are shown — the card can't be clicked in this
    //    mode (an opaque wallpaper can't be both above icons AND let them show through), but the
    //    user chose icons; they can still interact via the tray's 设置 mode.
    CGWindowLevel base = CGWindowLevelForKey(kCGDesktopIconWindowLevelKey);
    [w setLevel:(aboveIcons ? base + 1 : base - 1)];
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
