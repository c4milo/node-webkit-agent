#include "cpu_profiler.h"
#include "profile.h"

namespace nodex {
    Persistent<ObjectTemplate> CpuProfiler::cpu_profiler_template_;

    void CpuProfiler::Initialize(Handle<Object> target) {
        NanScope();

        Handle<ObjectTemplate> cpu_profiler_template = ObjectTemplate::New();
        NanAssignPersistent(cpu_profiler_template_, cpu_profiler_template);
        cpu_profiler_template->SetInternalFieldCount(1);

        Local<Object> cpuProfilerObj = cpu_profiler_template->NewInstance();

        NODE_SET_METHOD(cpuProfilerObj, "getProfilesCount", CpuProfiler::GetProfilesCount);
        NODE_SET_METHOD(cpuProfilerObj, "getProfile", CpuProfiler::GetProfile);
        NODE_SET_METHOD(cpuProfilerObj, "findProfile", CpuProfiler::FindProfile);
        NODE_SET_METHOD(cpuProfilerObj, "startProfiling", CpuProfiler::StartProfiling);
        NODE_SET_METHOD(cpuProfilerObj, "stopProfiling", CpuProfiler::StopProfiling);
        NODE_SET_METHOD(cpuProfilerObj, "deleteAllProfiles", CpuProfiler::DeleteAllProfiles);

        target->Set(NanNew<String>("cpuProfiler"), cpuProfilerObj);
    }

    CpuProfiler::CpuProfiler() {}
    CpuProfiler::~CpuProfiler() {}

    NAN_METHOD(CpuProfiler::GetProfilesCount) {
        NanScope();
        NanReturnValue(NanNew<Integer>(v8::CpuProfiler::GetProfilesCount()));
    }

    NAN_METHOD(CpuProfiler::GetProfile) {
        NanScope();
        if (args.Length() < 1) {
            NanThrowError("No index specified");
        } else if (!args[0]->IsInt32()) {
            NanThrowTypeError("Argument must be an integer");
        }
        int32_t index = args[0]->Int32Value();
        const CpuProfile* profile = v8::CpuProfiler::GetProfile(index);
        NanReturnValue(Profile::New(profile));
    }

    NAN_METHOD(CpuProfiler::FindProfile) {
        NanScope();
        if (args.Length() < 1) {
            NanThrowError("No index specified");
        } else if (!args[0]->IsInt32()) {
            NanThrowTypeError("Argument must be an integer");
        }
        uint32_t uid = args[0]->Uint32Value();
        const CpuProfile* profile = v8::CpuProfiler::FindProfile(uid);
        NanReturnValue(Profile::New(profile));
    }

    NAN_METHOD(CpuProfiler::StartProfiling) {
        NanScope();
        Local<String> title = args.Length() > 0 ? args[0]->ToString() : NanNew<String>("");
        v8::CpuProfiler::StartProfiling(title);
        NanReturnUndefined();
    }

    NAN_METHOD(CpuProfiler::StopProfiling) {
        NanScope();
        Local<String> title = args.Length() > 0 ? args[0]->ToString() : NanNew<String>("");
        const CpuProfile* profile = v8::CpuProfiler::StopProfiling(title);
        NanReturnValue(Profile::New(profile));
    }

    NAN_METHOD(CpuProfiler::DeleteAllProfiles) {
        v8::CpuProfiler::DeleteAllProfiles();
        NanReturnUndefined();
    }

} //namespace nodex
