{
  'targets': [
    {
      'target_name': 'profiler',
       'include_dirs' : [
            'node_modules/nan',
       ],
      'sources': [
        'src/cpu_profiler.cc',
        'src/heap_profiler.cc',
        'src/profile.cc',
        'src/profile_node.cc',
        'src/profiler.cc',
        'src/snapshot.cc',
      ],
    }
  ]
}
