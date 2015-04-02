

#ifndef NODE_PROFILE_NODE_
#define NODE_PROFILE_NODE_

#include <node.h>
#include <v8-profiler.h>
#include <nan.h>

using namespace v8;

namespace nodex {

class ProfileNode {
 public:
   static Handle<Value> New(const CpuProfileNode* node);

 private:
   static NAN_PROPERTY_GETTER(GetFunctionName);
   static NAN_PROPERTY_GETTER(GetScriptName);
   static NAN_PROPERTY_GETTER(GetLineNumber);
#if (NODE_MODULE_VERSION < 12)
   static NAN_PROPERTY_GETTER(GetTotalTime);
   static NAN_PROPERTY_GETTER(GetSelfTime);
   static NAN_PROPERTY_GETTER(GetTotalSamplesCount);
   static NAN_PROPERTY_GETTER(GetSelfSamplesCount);
   static NAN_PROPERTY_GETTER(GetCallUid);
#else
   static NAN_PROPERTY_GETTER(GetHitCount);
#endif
   static NAN_PROPERTY_GETTER(GetChildrenCount);
   static NAN_METHOD(GetChild);

   static void Initialize();
   static Persistent<ObjectTemplate> node_template_;
};

}
#endif  // NODE_PROFILE_NODE_
