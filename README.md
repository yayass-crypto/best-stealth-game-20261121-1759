# Shadow Lantern — A Lantern Thief's Heist

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/yayass-crypto/best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/yayass-crypto/best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

An original top-down stealth game built for the make.fun competition
[best-stealth-game-20261121-1759](https://make.fun/bounty/best-stealth-game-20261121-1759).

You are a lantern thief in the night. Slip past the guards, take the gems,
and reach the glowing exit — unseen.

## Play

Open `game/index.html` in a desktop browser (or run `node serve.ts` and open
http://localhost:8080). No build step, no network requests, no libraries —
plain HTML, canvas and vanilla JavaScript, with all sounds synthesized by
WebAudio.

- **Move:** WASD / arrow keys, or click anywhere to walk there.
- **Sneak (Shift):** slower, quiet, and harder for guards to spot.
- **Hide:** bushes block a guard's sight and hide you; shadow patches slow
  the detection meter. Crates and walls block sight and movement.
- **Guards:** patrol waypoint loops with visible vision cones (yellow).
  A guard that half-sees you turns suspicious (orange cone, "?", and it
  comes to investigate); a full detection meter means the alarm (red cone,
  "!") and a chase. Break line of sight and the guard gives up and returns
  to patrol. Walking loud near a guard is heard — sneak past close ones.
- **Goal:** reach the glowing EXIT door. Gems are optional score; clearing a
  level earns up to 3 stars (win + all gems + never alerted).
- **Keys:** H hint (shows guard patrol routes and a safe path to the exit) ·
  R restart level · Esc pause · M sound · Q menu · 1/2/3 choose a level.
- **Levels:** The Museum → The Vault → Rooftop Garden, each a hand-built map
  with its own patrols, cover and loot.

## Screenshots

The cover (`screenshots/1-play.jpg`) shows a level from above with vision
cones, crates and bushes for cover, the exit door, the thief mid-heist and
the HUD with its detection meter. The other shots show the title screen,
a guard raising the alarm, and a level-clear screen.

## Files

- `game/index.html` — the page; `game/src/` — the game, one job per file:
  `config.js` (constants), `levels.js` (the three hand-built maps),
  `world.js` (thief, guard AI, detection, autopilot), `render.js` (canvas,
  lantern light, HUD, screens), `input.js` (keyboard + mouse),
  `audio.js` (synthesized sounds), `shots.js` (deterministic screenshot
  scenes), `main.js` (boot and the game loop).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` and
  writes `dossier.json` with the vendored make.fun library.
- `screenshots/` — four real renders of the game's own code, taken in
  headless Chrome from `?shot=play|title|alert|win` (see `shots.json`).
