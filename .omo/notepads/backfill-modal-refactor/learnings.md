# BackfillModal Refactor - Learnings

## Changes Made

1. **Removed direct engine import**: Removed `import { BackfillResult, runHistoricalBackfill } from '../engine/backfillEngine';`

2. **Defined BackfillResult locally**: Copied the interface definition directly into the component file to avoid dependency on the engine module.

3. **Refactored handleRunBackfill()**: 
   - Removed the fallback logic that called `runHistoricalBackfill()` directly
   - Now only uses `fetch()` to `/api/v8/backtest/backfill`
   - If the fetch fails (network error or non-OK response), throws an error instead of falling back to local engine
   - Properly parses the response: `data.result` contains the BackfillResult

4. **Maintained all UI/UX**: All state variables, step timer animations, and JSX structure remain unchanged.

## Architecture Decision

This refactor is part of a larger security effort to remove browser-to-database access. All business logic (historical data fetching, point-in-time simulation, DB persistence) now runs exclusively on the server (Cloudflare Functions). The frontend only triggers the operation via API and displays results.

## API Contract

The endpoint `/api/v8/backtest/backfill` accepts POST with:
```json
{
  "lookbackRange": "6m" | "1y" | "2y",
  "opportunityThreshold": number,
  "replaceExisting": boolean
}
```

Returns:
```json
{
  "success": true,
  "result": BackfillResult,
  "message": string
}
```
