#ifndef SRC_HEAP_PROFILER_H_
#define SRC_HEAP_PROFILER_H_
#include "NodeInspectorAgent.h"

namespace NodeInspectorAgent {
    class HeapProfiler : public ObjectWrap {
        public:
            static void Initialize(Handle<Object> target);

            HeapProfiler();
            virtual ~HeapProfiler();
        
        protected:
            static Handle<Value> TakeSnapshot(const Arguments& args);
            static Handle<Value> GetSnapshotsCount(const Arguments& args);
            static Handle<Value> FindSnapshot(const Arguments& args);
            static void DeleteAllSnapshots(const Arguments&);

        private:
            const HeapSnapshot* snapshot;
            static Persistent<FunctionTemplate> constructor_template;


    };

    class ActivityControlAdapter : public v8::ActivityControl {
        public:
            ActivityControlAdapter(HeapProfiler::HeapSnapshotProgress* progress)
            : m_progress(progress), m_firstReport(true) { }

            ControlOption ReportProgressValue(int done, int total) {
                ControlOption result = m_progress->isCanceled() ? kAbort : kContinue;
                if (m_firstReport) {
                    m_firstReport = false;
                    m_progress->Start(total);
                } else {
                    m_progress->Worked(done);
                }
        
                if (done >= total) {
                    m_progress->Done();
                }

                return result;
            }
        private:
            HeapProfler::HeapSnapshotProgress* m_progress;
            bool m_firstReport;
    };

    class OutputStreamAdapter : public v8::OutputStream {
        public:
            OutputStreamAdapter(HeapProfiler::OutputStream* output) : m_output(output) { }
            void EndOfStream() { m_output->Close(); }
            int GetChunkSize() { return 10240; }
            WriteResult WriteAsciiChunk(char* data, int size) {
                m_output->Write(String(data, size));
                return kContinue;
            }
        private:
            HeapProfiler::OutputStream* m_output;
    };
}//namespace NodeInspectorAgent

#endif  // SRC_HEAP_PROFILER_H