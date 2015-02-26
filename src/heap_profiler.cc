#include "heap_profiler.h"
#include "snapshot.h"

namespace nodex {
    Persistent<ObjectTemplate> HeapProfiler::heap_profiler_template_;

    class ActivityControlAdapter : public ActivityControl {
        public:
            ActivityControlAdapter(Handle<Value> progress)
                :   reportProgress(Handle<Function>::Cast(progress)),
                    abort(NanFalse()) {}

            ControlOption ReportProgressValue(int done, int total) {
                NanScope();

                Local<Value> argv[2] = {
                    NanNew<Integer>(done),
                    NanNew<Integer>(total)
                };

                TryCatch try_catch;

                abort = reportProgress->Call(NanGetCurrentContext()->Global(), 2, argv);

                if (try_catch.HasCaught()) {
                    FatalException(try_catch);
                    return kAbort;
                }

                fprintf(stderr, "here!\n");

                if (abort.IsEmpty() || !abort->IsBoolean()) {
                    return kContinue;
                }

                return abort->IsTrue() ? kAbort : kContinue;
            }

        private:
            Handle<Function> reportProgress;
            Local<Value> abort;
    };

    void HeapProfiler::Initialize(Handle<Object> target) {
        NanScope();

        Handle<ObjectTemplate> heap_profiler_template = ObjectTemplate::New();
        NanAssignPersistent(heap_profiler_template_, heap_profiler_template);
        heap_profiler_template->SetInternalFieldCount(1);

        Local<Object> heapProfilerObj = heap_profiler_template->NewInstance();

        NODE_SET_METHOD(heapProfilerObj, "takeSnapshot", HeapProfiler::TakeSnapshot);
        NODE_SET_METHOD(heapProfilerObj, "getSnapshot", HeapProfiler::GetSnapshot);
        NODE_SET_METHOD(heapProfilerObj, "findSnapshot", HeapProfiler::FindSnapshot);
        NODE_SET_METHOD(heapProfilerObj, "getSnapshotsCount", HeapProfiler::GetSnapshotsCount);
        NODE_SET_METHOD(heapProfilerObj, "deleteAllSnapshots", HeapProfiler::DeleteAllSnapshots);

        target->Set(NanNew<String>("heapProfiler"), heapProfilerObj);
    }

    HeapProfiler::HeapProfiler() {}
    HeapProfiler::~HeapProfiler() {}

    NAN_METHOD(HeapProfiler::GetSnapshotsCount) {
        NanScope();
        NanReturnValue(NanNew<Integer>(v8::HeapProfiler::GetSnapshotsCount()));
    }

    NAN_METHOD(HeapProfiler::GetSnapshot) {
        NanScope();
        if (args.Length() < 1) {
            NanThrowError("No index specified");
        } else if (!args[0]->IsInt32()) {
            NanThrowTypeError("Argument must be an integer");
        }
        int32_t index = args[0]->Int32Value();
        const v8::HeapSnapshot* snapshot = v8::HeapProfiler::GetSnapshot(index);

        NanReturnValue(Snapshot::New(snapshot));
    }

    NAN_METHOD(HeapProfiler::FindSnapshot) {
        NanScope();
        if (args.Length() < 1) {
            NanThrowError("No uid specified");
        }

        uint32_t uid = args[0]->Uint32Value();
        const v8::HeapSnapshot* snapshot = v8::HeapProfiler::FindSnapshot(uid);

        NanReturnValue(Snapshot::New(snapshot));
    }

    NAN_METHOD(HeapProfiler::TakeSnapshot) {
        NanScope();
        Local<String> title = NanNew<String>("");
        uint32_t len = args.Length();

        ActivityControlAdapter *control = NULL;

        if (len == 1) {
            if (args[0]->IsString()) {
                title = args[0]->ToString();
            } else if (args[0]->IsFunction()) {
                //control = new ActivityControlAdapter(args[0]);
            }
        }

        if (len == 2) {
            if (args[0]->IsString()) {
                title = args[0]->ToString();
            }

            if (args[1]->IsFunction()) {
                //control = new ActivityControlAdapter(args[1]);
            }
        }

        const v8::HeapSnapshot* snapshot = v8::HeapProfiler::TakeSnapshot(title, HeapSnapshot::kFull, control);

        NanReturnValue(Snapshot::New(snapshot));
    }

    NAN_METHOD(HeapProfiler::DeleteAllSnapshots) {
        NanScope();
        v8::HeapProfiler::DeleteAllSnapshots();
        NanReturnUndefined();
    }
} //namespace nodex
