# Allsvenskan Fantasy Tool

Chrome extension for `fantasy.allsvenskan.se` that adds an enhanced mini league table focused on points per budget played.

## What v1 does

- Detects a league page on `fantasy.allsvenskan.se`
- Fetches league standings, picks, fixtures, live player stats, and player prices from the public API
- Reads chip metadata from `bootstrap-static` and each entry's active chip from the picks endpoint
- Computes:
  - live points
  - played budget
  - points per million budget played
  - expected current gameweek points using a market-average projection
  - weighted scoring slots played
- Augments the site's native mini league table with:
  - `Pts/M`
  - `Left to play`
  - `xP`
- Defaults the native table sort to official rank
- Only supports mini leagues that fit on a single standings page (50 teams max)

## Current scoring rule

- Any pick with a positive API `multiplier` counts toward budget played and xP
- Chip-adjusted multipliers are included in both points and budget played
- Double gameweeks add one extra scoring slot and one extra unit of budget for each additional fixture
- Blank gameweeks contribute zero remaining slots and zero remaining budget for affected players
- Auto-subs are simulated live for starters who are definite no-shows: they have `0` minutes and all of their gameweek fixtures are finished, or they have no fixture at all
- Bench priority follows positions `12`, `13`, `14` for outfield players; the bench goalkeeper can only replace the starting goalkeeper
- A bench player is only eligible to come in once they have recorded minutes in the gameweek
- Auto-subs must preserve a valid formation: 1 goalkeeper, at least 3 defenders, and at least 1 forward
- Chip multipliers do not transfer to auto-subbed replacements; only normal captain-to-vice fallback is applied
- A scoring fixture opportunity counts as `played` if:
  - that fixture is finished, or
  - it is in progress and the player already has live minutes

This is intentionally conservative for in-progress matches.

Example:

- If 4 normal slots have played and your captain has also played, the count is shown as `5/12` because the captain occupies two scoring slots.
- If `Dynamisk duo` is active, the count can become `7/14` because the captain is worth 3 slots and the vice captain 2.
- If `Parkera bussen` is active, each defender's doubled slot weight is counted automatically from the API multiplier.
- If one of your weighted scoring picks belongs to a team with 2 fixtures, the denominator increases accordingly, so a row can show `5/13` instead of `5/12`.

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

Run unit tests:

```bash
npm test
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
