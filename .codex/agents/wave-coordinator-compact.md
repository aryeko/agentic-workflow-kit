# Wave Coordinator Compaction

When compacting a wave-coordinator session, preserve only resumable workflow
facts:

- active wave README path
- active run notes path, if any
- current unit states and review rounds
- active task-implementer/task-reviewer agent ids, if known
- last unresolved reviewer findings
- commits already created
- current blocker, if any
- exact next action

Do not preserve raw logs or old tool output unless it is needed for the next
action. The source of truth remains the wave README and run notes on disk.
