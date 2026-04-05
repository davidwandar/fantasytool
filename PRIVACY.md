# Privacy Policy for Fantasy Tool

Last updated: 2026-04-05

Fantasy Tool is a Chrome extension for `fantasy.allsvenskan.se` that enhances mini league standings with additional metrics such as `Pts/M`, `Left to play`, `xP`, and `Projected Rank`.

## What Data The Extension Accesses

The extension runs only on `https://fantasy.allsvenskan.se/*`.

It accesses:

- Public fantasy data shown on `fantasy.allsvenskan.se`
- Public fantasy API responses used to calculate enhanced standings
- The current league page URL and page content needed to identify the active mini league table

## What Data Is Stored

The extension uses `chrome.storage.local` to store short-lived cached API responses locally in the user's browser.

This cache may include:

- League standings data
- Team picks for the current gameweek
- Live player and event data
- Fixture data
- Cache expiry metadata

The stored data is used only to reduce repeated requests and improve extension performance.

## How The Data Is Used

The extension uses fetched and cached data only to calculate and display enhanced mini league information inside `fantasy.allsvenskan.se`, including:

- `Pts/M`
- `Left to play`
- `xP`
- `Projected Rank`

## Data Sharing

Fantasy Tool does not sell user data.

Fantasy Tool does not share personal data with third parties.

## Remote Code

Fantasy Tool does not use remote code.

All executable extension code is packaged with the extension submitted to the Chrome Web Store. The extension only fetches data from `fantasy.allsvenskan.se` API endpoints and does not download or execute external scripts.

## Permissions

Fantasy Tool requests the following permissions:

- `storage`: used for short-lived local caching of fantasy API responses
- Host permission for `https://fantasy.allsvenskan.se/*`: used so the extension can run on the fantasy site and fetch the data required to enhance mini league standings

## Your Choices

If you do not want the extension to access or cache fantasy site data, you can disable or uninstall the extension at any time through Chrome's extension settings.

## Contact

If you have questions about this privacy policy, contact:

- `https://github.com/davidwandar/fantasytool/issues`