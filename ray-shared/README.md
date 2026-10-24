# Shared client rules

Framework-independent TypeScript used directly by ray-web and ray-mobile.
The small re-export modules in each client preserve existing import paths.

- types.ts: common API data, based on mobile; authentication and upload transports stay in each client.
- formatSmartDate.ts, truncateWords.ts: the existing mobile presentation rules.
- feed.ts: tab membership, local-calendar Looking Ahead ordering, and separate upcoming summaries.

Metro watches this directory, and Vite permits it in development. No separate
package installation or build step is required. Include ray-shared when
building or deploying either client from source.

Run regression checks from the repository root:

    node --test ray-shared/tests/domain.test.cjs ray-mobile/tests/moment-feed.test.cjs

The tests use the existing mobile development dependencies.
