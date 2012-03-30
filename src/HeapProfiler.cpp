#include "HeapProfiler.h"

namespace NodeInspectorAgent {
	Persistent<FunctionTemplate> HeapProfiler::constructor_template;

	void HeapProfiler::Initialize(Handle<Object> target) {
		Local<FunctionTemplate> t = FunctionTemplate::New(HeapProfiler::New);

        t->InstanceTemplate()->SetInternalFieldCount(1);

        NODE_SET_PROTOTYPE_METHOD(t, "takeHeapSnapshot",
                                      HeapProfiler::TakeHeapSnapshot);
        NODE_SET_PROTOTYPE_METHOD(t, "getSnapshotsCount",
                                      HeapProfiler::GetSnapshotsCount);
        NODE_SET_PROTOTYPE_METHOD(t, "findSnapshot",
                                      HeapProfiler::FindSnapshot);
        NODE_SET_PROTOTYPE_METHOD(t, "deleteAllSnapshots",
                                      HeapProfiler::DeleteAllSnapshots);

        constructor_template = Persistent<FunctionTemplate>::New(t);
        constructor_template->SetClassName(String::NewSymbol("HeapProfiler"));

        target->Set(String::NewSymbol("HeapProfiler"), constructor_template->GetFunction());
    }
	
	HeapProfiler::HeapProfiler : ObjectWrap() {}
	HeapProfiler::~HeapProfiler() {}

	Handle<Value> HeapProfiler::New(const Arguments& args) {
        HandleScope scope;

        HeapProfiler *profiler = new HeapProfiler();
        Local<Object> obj = args.This();
        profiler->Wrap(obj);

        return obj;
    }

    Handle<Value> HeapProfiler::TakeSnapshot(const Arguments& args) {
    	HandleScope scope;

    	//get title from args
    	//get update progress function from args

    	ActivityControlAdapter adapter(control);
    	const v8::HeapSnapshot* snapshot = v8::HeapProfiler::TakeSnapshot(title, v8::HeapSnapshot::kFull, &adapter);

    	return scope.Close(snapshot);
    }
}