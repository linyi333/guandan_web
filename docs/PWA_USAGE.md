# PWA Usage (Web App Like Native)

## What this adds
- Can be added to phone home screen
- Opens in standalone app-like window
- Basic offline cache for app shell/static assets
- Local scoreboard state persists in browser storage

## iPhone (Safari)
1. Open your deployed URL in Safari
2. Tap Share button
3. Choose `Add to Home Screen`
4. Launch from home screen

## Android (Chrome)
1. Open your deployed URL in Chrome
2. Tap menu (`⋮`)
3. Choose `Install app` or `Add to Home screen`

## Notes
- Data is stored per browser/device via `localStorage`
- Clearing browser site data will reset saved scoreboard state
- Offline cache is basic (app shell + visited assets)
