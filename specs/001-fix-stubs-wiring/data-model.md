# Data Model: Stabilize Unfinished Commerce Flows

## Entities

### Commerce Flow

- **Purpose**: Represents an end-to-end business journey that spans one or more UI surfaces and backend handlers.
- **Key attributes**:
  - flow name
  - entry point
  - linked route targets
  - required validation rules
  - expected state transitions
  - failure mode

### Route Target

- **Purpose**: Represents a page route, API endpoint, or handler destination that a flow depends on.
- **Key attributes**:
  - source trigger
  - destination path
  - owning module
  - fallback/error boundary

### Validation Rule

- **Purpose**: Represents the accepted and rejected input conditions for a business action.
- **Key attributes**:
  - rule name
  - affected inputs
  - allowed values or invariants
  - error message contract
  - enforcing surfaces

### Workflow Transition

- **Purpose**: Represents a state mutation that must either complete coherently or fail before mutation.
- **Key attributes**:
  - current state
  - attempted action
  - next state
  - guard conditions
  - side effects

### Unsupported Path Record

- **Purpose**: Represents an incomplete path that remains intentionally blocked.
- **Key attributes**:
  - path identifier
  - reason blocked
  - user-facing or caller-facing response
  - follow-up implementation owner

## Relationships

- A **Commerce Flow** depends on one or more **Route Targets**.
- A **Commerce Flow** is constrained by one or more **Validation Rules**.
- A **Commerce Flow** may trigger one or more **Workflow Transitions**.
- A **Workflow Transition** may be guarded by multiple **Validation Rules**.
- A broken or deferred **Commerce Flow** may produce an **Unsupported Path Record**.
