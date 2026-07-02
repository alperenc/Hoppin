import { defineConfig } from 'vitest/config';

// This project is an Expo/React Native app; most source files need a native
// runtime and are not meaningfully unit-testable without a much heavier
// setup. Scope vitest to plain TypeScript modules with no RN/Expo
// dependencies -- pure logic in src/lib and api -- rather than trying to
// run the whole tree under jsdom/react-native mocks.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts', 'api/**/*.test.ts'],
    environment: 'node',
  },
});
