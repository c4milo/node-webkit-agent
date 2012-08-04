### Breadcumbs to automate the process

~/Dropbox/Development/cloudescape/depot_tools/gclient config https://src.chromium.org/chrome/releases/18.0.1025.168

Include the following in .gclient to reduce the size of the checkout
```json
  "custom_deps": {      
    "src/third_party/WebKit/LayoutTests": None,
    "src/chrome/tools/test/reference_build/chrome_win": None,
    "src/chrome_frame/tools/test/reference_build/chrome_win": None,
    "src/chrome/tools/test/reference_build/chrome_linux": None,
    "src/chrome/tools/test/reference_build/chrome_mac": None,
    "src/third_party/hunspell_dictionaries": None,
  },
```

~/Dropbox/Development/cloudescape/depot_tools/gclient sync

cd ~/Development/chromium/src/third_party/WebKit &&
Source/WebCore/inspector/compile-front-end.sh

cp Source/WebCore/inspector/Inspector.json ~/Dropbox/Development/cloudescape/node-webkit-agent/18.0.1025.168

cd ~/Development/chromium/src/third_party/WebKit/Source/WebCore

./make-generated-sources.sh 

cp -r ~/Development/chromium/src/third_party/WebKit/Source/WebCore/inspector/front-end ~/Dropbox/Development/cloudescape/node-webkit-agent/18.0.1025.168

cp DerivedSources/WebCore/InspectorBackendCommands.js ~/Dropbox/Development/cloudescape/node-webkit-agent/18.0.1025.168/front-end
