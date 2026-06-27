{
  "targets": [
    {
      "target_name": "wallpaper",
      "sources": [ "native/wallpaper.mm" ],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "CLANG_ENABLE_OBJC_ARC": "YES",
            "OTHER_CPLUSPLUSFLAGS": [ "-ObjC++" ],
            "MACOSX_DEPLOYMENT_TARGET": "11.0"
          },
          "link_settings": { "libraries": [ "-framework Cocoa" ] }
        }]
      ]
    }
  ]
}
