# Workflow Engine

- Workflow is versioned
- Each service uses exactly one workflow version
- Workflow contains ordered stages
- Transitions define allowed stage changes
- Transition may require permission
- All stage changes must be logged

Contract status is derived from workflow stage, not enum.
