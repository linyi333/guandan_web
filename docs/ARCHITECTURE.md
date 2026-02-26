# Architecture (Phase 1)

## Stack
- Next.js (App Router)
- React client component for scoreboard page
- CSS via `app/globals.css`
- Browser `localStorage` for persistence

## Runtime Model
- Pure client UI (`'use client'`)
- No API routes
- No database
- No authentication

## State Model
- `teamA`, `teamB`
  - `name`
  - `levelIndex`
  - `wins`
- `stageTeam`: `null | 'A' | 'B'`
- `lang`: `'zh' | 'en'`
- `seniorMode`: `boolean`

## Persistence Strategy
- Serialize state JSON under one `localStorage` key (e.g. `guandan-web-v1`)
- Read on first mount
- Write on every relevant state change

## Component Outline
- `ScoreboardPage` (state + actions)
  - Header (title, language, senior mode)
  - `TeamCard` x2
  - Bottom actions bar (Next Round, Toggle Stage)

## Deployment
- Static-compatible frontend deployment (Vercel / Netlify / Cloudflare Pages)
- No environment variables required for Phase 1
