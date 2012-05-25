### Breadcumbs to automate the process

~/Dropbox/Development/cloudescape/depot_tools/gclient config https://src.chromium.org/chrome/releases/18.0.1025.168

~/Dropbox/Development/cloudescape/depot_tools/gclient sync

cd ~/Development/chromium/src/third_party/WebKit &&
Source/WebCore/inspector/compile-front-end.sh

cp Source/WebCore/inspector/Inspector.json ~/Dropbox/Development/cloudescape/node-webkit-agent/18.0.1025.168

cd ~/Development/chromium/src/third_party/WebKit/Source/WebCore

./make-generated-sources.sh 

cp -r ~/Development/chromium/src/third_party/WebKit/Source/WebCore/inspector/front-end ~/Dropbox/Development/cloudescape/node-webkit-agent/18.0.1025.168

cp DerivedSources/WebCore/InspectorBackendCommands.js ~/Dropbox/Development/cloudescape/node-webkit-agent/18.0.1025.168/front-end
