#include "snapshot.h"
#include "node.h"
#include "node_buffer.h"

using namespace v8;
using namespace node;

namespace nodex {

Persistent<ObjectTemplate> Snapshot::snapshot_template_;

void Snapshot::Initialize() {
  Handle<ObjectTemplate> snapshot_template = ObjectTemplate::New();
  NanAssignPersistent(snapshot_template_, snapshot_template);
  snapshot_template->SetInternalFieldCount(1);
  snapshot_template->SetAccessor(NanNew<String>("title"), Snapshot::GetTitle);
  snapshot_template->SetAccessor(NanNew<String>("uid"), Snapshot::GetUid);
#if (NODE_MODULE_VERSION < 12)
  snapshot_template->SetAccessor(NanNew<String>("type"), Snapshot::GetType);
#endif // (NODE_MODULE_VERSION < 12)
  snapshot_template->Set(NanNew<String>("delete"), NanNew<FunctionTemplate>(Snapshot::Delete));
  snapshot_template->Set(NanNew<String>("serialize"), NanNew<FunctionTemplate>(Snapshot::Serialize));
}

NAN_PROPERTY_GETTER(Snapshot::GetTitle) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  Handle<String> title = static_cast<HeapSnapshot*>(ptr)->GetTitle();
  NanReturnValue(title);
}

NAN_PROPERTY_GETTER(Snapshot::GetUid) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);
  uint32_t uid = static_cast<HeapSnapshot*>(ptr)->GetUid();
  NanReturnValue(NanNew<Integer>(uid));
}

#if (NODE_MODULE_VERSION < 12)
NAN_PROPERTY_GETTER(Snapshot::GetType) {
  NanScope();
  Local<Object> self = args.Holder();
  void* ptr = NanGetInternalFieldPointer(self, 0);

  HeapSnapshot::Type type = static_cast<HeapSnapshot*>(ptr)->GetType();
  Local<String> t;

  switch(type) {
    case HeapSnapshot::kFull:
      t = NanNew<String>("Full");
      break;
    default:
      t = NanNew<String>("Unknown");
  }

  NanReturnValue(t);
}
#endif // (NODE_MODULE_VERSION < 12)

NAN_METHOD(Snapshot::Delete) {
    NanScope();
    Handle<Object> self = args.This();
    void* ptr = NanGetInternalFieldPointer(self, 0);
    static_cast<HeapSnapshot*>(ptr)->Delete();
    NanReturnUndefined();
}

Handle<Value> Snapshot::New(const HeapSnapshot* snapshot) {
  NanEscapableScope();

  if (snapshot_template_.IsEmpty()) {
    Snapshot::Initialize();
  }

  if(!snapshot) {
    return NanUndefined();
  }
  else {
    Local<ObjectTemplate> snapshot_template = NanNew<ObjectTemplate>(snapshot_template_);
    Local<Object> obj = snapshot_template->NewInstance();
    NanSetInternalFieldPointer(obj, 0, const_cast<HeapSnapshot*>(snapshot));
    return NanEscapeScope(obj);
  }
}

class OutputStreamAdapter : public v8::OutputStream {
  public:
    OutputStreamAdapter(Handle<Value> arg) {
      Local<String> onEnd = NanNew<String>("onEnd");
      Local<String> onData = NanNew<String>("onData");

      if (!arg->IsObject()) {
        NanThrowTypeError("You must specify an Object as first argument");
      }

      obj = arg->ToObject();
      if (!obj->Has(onEnd) || !obj->Has(onData)) {
        NanThrowTypeError("You must specify properties 'onData' and 'onEnd' to invoke this function");
      }

      if (!obj->Get(onEnd)->IsFunction() || !obj->Get(onData)->IsFunction()) {
        NanThrowTypeError("Properties 'onData' and 'onEnd' have to be functions");
      }

      onEndFunction = Local<Function>::Cast(obj->Get(onEnd));
      onDataFunction = Local<Function>::Cast(obj->Get(onData));

      abort = NanFalse();
    }

    void EndOfStream() {
      TryCatch try_catch;
      onEndFunction->Call(obj, 0, NULL);

      if (try_catch.HasCaught()) {
        FatalException(try_catch);
      }
    }

    int GetChunkSize() {
      return 10240;
    }

    WriteResult WriteAsciiChunk(char* data, int size) {
      NanScope();

      Handle<Value> argv[2] = {
        NanNewBufferHandle(data, size),
        NanNew<Integer>(size)
      };

      TryCatch try_catch;
      abort = onDataFunction->Call(obj, 2, argv);

      if (try_catch.HasCaught()) {
        FatalException(try_catch);
        return kAbort;
      }

      if (abort.IsEmpty() || !abort->IsBoolean()) {
        return kContinue;
      }

      return abort->IsTrue() ? kAbort : kContinue;
    }

  private:
    Local<Value> abort;
    Handle<Object> obj;
    Handle<Function> onEndFunction;
    Handle<Function> onDataFunction;
};

NAN_METHOD(Snapshot::Serialize) {
  NanScope();
  Handle<Object> self = args.This();

  uint32_t argslen = args.Length();

  if (argslen == 0) {
    NanThrowTypeError("You must specify arguments to invoke this function");
  }

  OutputStreamAdapter *stream = new OutputStreamAdapter(args[0]);

  void* ptr = NanGetInternalFieldPointer(self, 0);
  static_cast<HeapSnapshot*>(ptr)->Serialize(stream, HeapSnapshot::kJSON);

  NanReturnUndefined();
}

} //namespace nodex
