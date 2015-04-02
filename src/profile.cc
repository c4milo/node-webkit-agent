#include "profile.h"
#include "profile_node.h"

using namespace v8;

namespace nodex {

Persistent<ObjectTemplate> Profile::profile_template_;

void Profile::Initialize() {
  Handle<ObjectTemplate> profile_template = ObjectTemplate::New();
  NanAssignPersistent(profile_template_, profile_template);
  profile_template->SetInternalFieldCount(1);
  profile_template->SetAccessor(NanNew<String>("title"), Profile::GetTitle);
#if (NODE_MODULE_VERSION < 12)
  profile_template->SetAccessor(NanNew<String>("uid"), Profile::GetUid);
#endif // (NODE_MODULE_VERSION < 12)
  profile_template->SetAccessor(NanNew<String>("topRoot"), Profile::GetTopRoot);
#if (NODE_MODULE_VERSION < 12)
  profile_template->SetAccessor(NanNew<String>("bottomRoot"), Profile::GetBottomRoot);
#endif // (NODE_MODULE_VERSION < 12)
  profile_template->Set(NanNew<String>("delete"), NanNew<FunctionTemplate>(Profile::Delete));
}

#if (NODE_MODULE_VERSION < 12)
NAN_PROPERTY_GETTER(Profile::GetUid) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  uint32_t uid = static_cast<CpuProfile*>(ptr)->GetUid();
  NanReturnValue(NanNew<Integer>(uid));
}
#endif // (NODE_MODULE_VERSION < 12)


NAN_PROPERTY_GETTER(Profile::GetTitle) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  Handle<String> title = static_cast<CpuProfile*>(ptr)->GetTitle();
  NanReturnValue(title);
}

NAN_PROPERTY_GETTER(Profile::GetTopRoot) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  const CpuProfileNode* node = static_cast<CpuProfile*>(ptr)->GetTopDownRoot();
  NanReturnValue(ProfileNode::New(node));
}


#if (NODE_MODULE_VERSION < 12)
NAN_PROPERTY_GETTER(Profile::GetBottomRoot) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  const CpuProfileNode* node = static_cast<CpuProfile*>(ptr)->GetBottomUpRoot();
  NanReturnValue(ProfileNode::New(node));
}
#endif // (NODE_MODULE_VERSION < 12)

NAN_METHOD(Profile::Delete) {
  NanScope();
  Handle<Object> self = args.This();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  static_cast<CpuProfile*>(ptr)->Delete();
  NanReturnUndefined();
}

Handle<Value> Profile::New(const CpuProfile* profile) {
  NanEscapableScope();

  if (profile_template_.IsEmpty()) {
    Profile::Initialize();
  }

  if(!profile) {
    return NanUndefined();
  }
  else {
    Local<Object> obj = NanNew<ObjectTemplate>(profile_template_)->NewInstance();
    NanSetInternalFieldPointer(obj, 0, const_cast<CpuProfile*>(profile));
    return NanEscapeScope(obj);
  }
}

} // namespace nodex
