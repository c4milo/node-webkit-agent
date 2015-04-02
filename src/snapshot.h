

#ifndef NODE_SNAPSHOT_
#define NODE_SNAPSHOT_

#include <node.h>
#include <v8-profiler.h>
#include <nan.h>

using namespace v8;

namespace nodex {

class Snapshot {
  public:
    static Handle<Value> New(const HeapSnapshot* snapshot);

  private:
    Snapshot(const v8::HeapSnapshot* snapshot)
        : m_snapshot(snapshot){}

    const v8::HeapSnapshot* m_snapshot;

    static NAN_PROPERTY_GETTER(GetUid);
    static NAN_PROPERTY_GETTER(GetTitle);
    static NAN_PROPERTY_GETTER(GetType);
    static NAN_METHOD(Delete);
    static NAN_METHOD(Serialize);

    static void Initialize();
    static Persistent<ObjectTemplate> snapshot_template_;
};
} //namespace nodex
#endif  // NODE_SNAPSHOT_
