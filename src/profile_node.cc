#include "profile_node.h"

using namespace v8;

namespace nodex {

Persistent<ObjectTemplate> ProfileNode::node_template_;

void ProfileNode::Initialize() {
  Handle<ObjectTemplate> node_template = ObjectTemplate::New();
  NanAssignPersistent(node_template_, node_template);
  node_template->SetInternalFieldCount(1);
  node_template->SetAccessor(NanNew<String>("functionName"), ProfileNode::GetFunctionName);
  node_template->SetAccessor(NanNew<String>("scriptName"), ProfileNode::GetScriptName);
  node_template->SetAccessor(NanNew<String>("lineNumber"), ProfileNode::GetLineNumber);
#if (NODE_MODULE_VERSION < 12)
  node_template->SetAccessor(NanNew<String>("totalTime"), ProfileNode::GetTotalTime);
  node_template->SetAccessor(NanNew<String>("selfTime"), ProfileNode::GetSelfTime);
  node_template->SetAccessor(NanNew<String>("totalSamplesCount"), ProfileNode::GetTotalSamplesCount);
  node_template->SetAccessor(NanNew<String>("selfSamplesCount"), ProfileNode::GetSelfSamplesCount);
  node_template->SetAccessor(NanNew<String>("callUid"), ProfileNode::GetCallUid);
#else // (NODE_MODULE_VERSION >= 12)
  // New in CpuProfileNode: GetHitCount, GetScriptId, GetColumnNumber, GetBailoutReason, GetNodeId.
  // GetHitCount replaces GetSelfSamplesCount.
  // Nothing on CpuProfileNode looks like a replacement for GetSelfTime, but the CpuProfile
  // object has GetSamplesCount, GetSample, GetSampleTimestamp, which might be good for something?
  // (Nothing replaces GetTotalSamplesCount and GetTotalTime, because bottom-up profiling is gone.)
  //
  // GetScriptId, GetBailoutReason, GetColumnNumber seem straightforward but not important.
  // I don't know what GetNodeId is used for.
  node_template->SetAccessor(NanNew<String>("hitCount"), ProfileNode::GetHitCount);
#endif // (NODE_MODULE_VERSION < 12)
  node_template->SetAccessor(NanNew<String>("childrenCount"), ProfileNode::GetChildrenCount);
  node_template->Set(NanNew<String>("getChild"), NanNew<FunctionTemplate>(ProfileNode::GetChild));
}

NAN_PROPERTY_GETTER(ProfileNode::GetFunctionName) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  Handle<String> fname = static_cast<CpuProfileNode*>(ptr)->GetFunctionName();
  NanReturnValue(fname);
}

NAN_PROPERTY_GETTER(ProfileNode::GetScriptName) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  Handle<String> sname = static_cast<CpuProfileNode*>(ptr)->GetScriptResourceName();
  NanReturnValue(sname);
}

NAN_PROPERTY_GETTER(ProfileNode::GetLineNumber) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  int32_t ln = static_cast<CpuProfileNode*>(ptr)->GetLineNumber();
  NanReturnValue(NanNew<Integer>(ln));
}

#if (NODE_MODULE_VERSION < 12)

NAN_PROPERTY_GETTER(ProfileNode::GetTotalTime) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  double ttime = static_cast<CpuProfileNode*>(ptr)->GetTotalTime();
  NanReturnValue(NanNew<Number>(ttime));
}

NAN_PROPERTY_GETTER(ProfileNode::GetSelfTime) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  double stime = static_cast<CpuProfileNode*>(ptr)->GetSelfTime();
  NanReturnValue(NanNew<Number>(stime));
}

NAN_PROPERTY_GETTER(ProfileNode::GetTotalSamplesCount) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  double samples = static_cast<CpuProfileNode*>(ptr)->GetTotalSamplesCount();
  NanReturnValue(NanNew<Number>(samples));
}

NAN_PROPERTY_GETTER(ProfileNode::GetSelfSamplesCount) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  double samples = static_cast<CpuProfileNode*>(ptr)->GetSelfSamplesCount();
  NanReturnValue(NanNew<Number>(samples));
}

NAN_PROPERTY_GETTER(ProfileNode::GetCallUid) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  uint32_t uid = static_cast<CpuProfileNode*>(ptr)->GetCallUid();
  NanReturnValue(NanNew<Integer>(uid));
}

#else // (NODE_MODULE_VERSION >= 12)

NAN_PROPERTY_GETTER(ProfileNode::GetHitCount) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  uint32_t hitCount = static_cast<CpuProfileNode*>(ptr)->GetHitCount();
  printf("HitCount %u\n", hitCount);
  NanReturnValue(NanNew<Integer>(hitCount));
}

#endif // (NODE_MODULE_VERSION < 12)

NAN_PROPERTY_GETTER(ProfileNode::GetChildrenCount) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  int32_t count = static_cast<CpuProfileNode*>(ptr)->GetChildrenCount();
  NanReturnValue(NanNew<Integer>(count));
}

NAN_METHOD(ProfileNode::GetChild) {
  NanScope();
  if (args.Length() < 1) {
    NanThrowError("No index specified");
  } else if (!args[0]->IsInt32()) {
    NanThrowError("Argument must be integer");
  }
  int32_t index = args[0]->Int32Value();
  Handle<Object> self = args.This();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  const CpuProfileNode* node = static_cast<CpuProfileNode*>(ptr)->GetChild(index);
  NanReturnValue(ProfileNode::New(node));
}

Handle<Value> ProfileNode::New(const CpuProfileNode* node) {
  NanEscapableScope();

  if (node_template_.IsEmpty()) {
    ProfileNode::Initialize();
  }

  if (!node) {
    return NanUndefined();
  }
  else {
    Local<Object> obj = NanNew<ObjectTemplate>(node_template_)->NewInstance();
    NanSetInternalFieldPointer(obj, 0, const_cast<CpuProfileNode*>(node));
    return NanEscapeScope(obj);
  }
}

} // namespace nodex
