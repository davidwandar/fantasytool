# Fantasy Tool

Chrome extension for `fantasy.allsvenskan.se` that adds an enhanced mini league table focused on points per budget played.

## What v1 does

- Detects a league page on `fantasy.allsvenskan.se`
- Fetches league standings, picks, fixtures, live player stats, and player prices from the public API
- Computes:
  - live points
  - played budget
  - points per million budget played
  - expected current gameweek points using a market-average projection
  - starters played
- Augments the site's native mini league table with:
  - `Pts/M`
  - `Left to play`
  - `xP`
- Defaults the native table sort to official rank
- Only supports mini leagues that fit on a single standings page (50 teams max)

## Current scoring rule

- Only starting XI players count toward budget played
- Captain multiplier is included in both points and budget played
- A starter counts as `played` if:
  - they have live minutes greater than zero, or
  - their team's fixture is finished

This is intentionally conservative for in-progress matches.

Example:

- If 4 starters have played and your captain has also played, the count is shown as `5/12` only when that means 4 normal starter slots plus the captain's double slot.
- The captain's price is counted twice in `Played Budget`, matching the doubled points.

## xP model

- `xP` is projected current gameweek points, not season points.
- Simply: it starts with the points a team has already scored, then adds an estimate for the budget still left to play.
- That estimate uses the mini league's live average `points per million` from starters who have already played.
- Projected rank is then based on `previous season total + xP` for the current gameweek.

## Development

Install dependencies:

```bash
npm install
```

Type-check:

```bash
npm run check
```

Build:

```bash
npm run build
```

Watch mode:

```bash
npm run watch
```

## Load in Chrome

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click `Load unpacked`
4. Select the `dist` folder

## Notes

- Caching currently uses `chrome.storage.local` with short TTLs for live data.
- The site appears to be a SPA, so the content script watches for URL and DOM changes.
- If the league ID cannot be inferred from the page URL, the extension will not inject yet.
- If a league has more than one standings page, v1 shows an unsupported notice instead of computing partial rankings.
