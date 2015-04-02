#ifndef NODE_PROFILE_
#define NODE_PROFILE_

#include <node.h>
#include <v8-profiler.h>
#include <nan.h>

using namespace v8;

namespace nodex {

class Profile {
 public:
  static Handle<Value> New(const CpuProfile* profile);
 
 private:
  static NAN_PROPERTY_GETTER(GetUid);
  static NAN_PROPERTY_GETTER(GetTitle);
  static NAN_PROPERTY_GETTER(GetTopRoot);
  static NAN_PROPERTY_GETTER(GetBottomRoot);
  static NAN_METHOD(Delete);
  static void Initialize();
  static Persistent<ObjectTemplate> profile_template_;
};

} //namespace nodex
#endif  // NODE_PROFILE_
