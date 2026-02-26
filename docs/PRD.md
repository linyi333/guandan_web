# Guandan Web Scoreboard (Phase 1) PRD

## Goal
- Provide a shareable web version of the Guandan scoreboard so friends can use it without installing an app.
- Mobile-first, landscape-friendly, professional UI.
- No sign-in, no backend, no API.
- All state persists locally in browser storage.

## Scope (Phase 1)
- Two teams scoreboard (`A队`, `B队`) with editable team names
- Level sequence: `0,2,3,4,5,6,7,8,9,10,J,Q,K,A1,A2,A3`
- Stage rules
  - At initial `0`/`0`: no stage team
  - Stage starts only when any team reaches level `2+`
  - Level-up auto switches stage to that team
  - Manual stage toggle shown only when stage is available
- Wins counter `0..10`
- Next round (long-press): reset levels only, keep wins
- Chinese / English UI toggle
- Senior mode (larger text)
- Mute toggle placeholder not required in web phase (optional later)

## Non-Goals (Phase 1)
- Accounts / sync
- Server-side storage
- Match history cloud backup
- Multiplayer / shared state

## UX Priorities
- Stage team and level are primary visual focus
- Mobile landscape should not overlap/crowd
- Clear spacing and large tap targets
- Minimal chrome / no unnecessary text noise

## Persistence
- Use `localStorage` only
- Persist:
  - team names
  - levels
  - wins
  - stage team
  - language
  - senior mode

## Success Criteria
- Opens in mobile browser and is usable immediately
- Refreshing the page restores prior state
- No backend dependencies for deployment
