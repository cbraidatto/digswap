import "@testing-library/jest-dom/vitest";

// React 19 requires this to be set for act() to work in test environments
// see: https://github.com/reactwg/react-18/discussions/102
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
