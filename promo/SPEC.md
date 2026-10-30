# Liinky — vertical promo (TikTok / Reels / Shorts)

1080×1920, 30 fps, 24 s, French with one Arabic beat. Silent-safe: every claim is on screen.

## Storyline

Paper menu → one photo → the AI types it in (FR + AR) → pick a look → diners order on
WhatsApp → same menu in Arabic → Liinky, free trial.

## Shots

| # | Scene | Time (s) | What is on screen | Caption |
|---|---|---|---|---|
| 1 | hook | 0.0–3.0 | Printed menu, tilted. Shutter flash at 2.45, the sheet shrinks into the upload thumbnail | "Votre menu papier / en menu QR, 5 min." |
| 2 | import | 3.0–7.2 | Real onboarding: upload (photo attached) → tap "Lire mon menu" → "Lecture du menu…" → "Vérifiez votre menu", punch-in on the FR/AR fields | "Une photo de la carte." → "L'IA recopie, FR + عربي" |
| 3 | templates | 7.2–10.8 | The 9 real demo templates, 0.36 s each, ending on Pizzeria Roma, which scrolls into the next scene | "9 modèles au choix." |
| 4 | order | 10.8–17.0 | Real ordering: dish → size Large → cart → Commander → "Envoyer sur WhatsApp" → the actual recap message the app writes | "Vos clients commandent…" → "…sur votre WhatsApp." |
| 5 | bilingual | 17.0–19.6 | Same menu, French then Arabic (RTL wipe from the right) | "Français · العربية" |
| 6 | endcard | 19.6–24.0 | Liinky symbol built (dots drop, cup fills), wordmark wipes in, CTA pill | "Votre menu QR en 5 minutes." / "Essai gratuit 14 jours" / "Sans carte bancaire" |

## Numbers

- Ground cream `#FFF5EC`, ink `#1C1433`, berry `#E5245E` (app tokens, `app/globals.css`). Nunito 900 for captions (the app's brand face), Cairo for Arabic.
- Phone card: 744×948 at (168, 378), 12 px ink border, 64 px radius; screens are 390 css px wide shown at 720 px (×1.846), so 14 px UI text reads at 26 px.
- Captions 76 px, in 190–360 px; product in 378–1326 px. Nothing readable below 1330 px (TikTok/Reels caption + buttons), nothing above 168 px.
- Taps: a 76 px touch dot, lands 0.35 s ease-out, press 0.1 s; the screen changes on the frame after the press, like the app does.
- Banned: click rings, floating/breathing loops, titles sliding after they land, invented UI.

## Sources

All UI is the real app (`pnpm stack:start` + `pnpm dev`, seed data, `AI_PROVIDER=fixture`), captured at 390×844 @2×.
The printed menu is a prop matching the fixture's canned extraction. Demo photos come from `public/templates/photos`
(see `public/templates/CREDITS.md`). SFX: HyperFrames bundled Pixabay set (`assets/sfx/CREDITS.md`).

## Sound

No music bed in the file: on TikTok/Reels, add a trending sound in-app (or drop a track into `assets/` and add an
`<audio>` in `index.html` at ~0.25 volume). Effects only on visible actions: shutter click, taps, one whoosh into the
montage, a pop on the WhatsApp message, the RTL wipe, riser → impact on the logo.
