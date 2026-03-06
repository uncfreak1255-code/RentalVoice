---
globs: **/__tests__/**/*.test.ts, **/__tests__/**/*.test.tsx
---

# Testing Rules

## Setup
- Jest + jest-expo + @testing-library/react-native
- Module alias `@/` configured in jest.config.js via `moduleNameMapper`
- Test files live in `__tests__/` directories adjacent to source

## Conventions
- Component tests: `@testing-library/react-native` (render, screen, fireEvent)
- Pure logic tests: `ts-jest` (no React rendering needed)
- Mock external dependencies (API clients, AsyncStorage, etc.)
- Test behavior, not implementation details

## Running
- `npx jest` — run all tests
- `npx jest --watch` — watch mode
- `npx jest path/to/file` — single file
