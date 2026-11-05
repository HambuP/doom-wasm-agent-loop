# Playwright play session — 2026-11-04

- Source revision: 0784fa2 (platform/ and web/ clean; "dirty" = untracked artifacts only)
- Play run: `node tests/play.js --run-id play-0784fa2-142126` → exit 0, no page errors
  (raw: artifacts/runs/play-0784fa2-142126/screenshots/play.json)
- Acceptance suite: `node tests/run_all.js` → ALL PASS (self-tests, T1–T10)
  (artifacts/runs/test-2026-11-04T22-21-43-186Z/tests/results.json)

Screenshots 01–14 here are copies of that play run: title, main menu, episode/skill
select, level start, walk, turn L/R, fire (ammo 50→49), run, use, in-game menu, menu closed.
Visually checked: menu colors correct (red logo), E1M1 renders, HUD updates on firing.

Not covered: sound, save/load, mouse, other levels, enemy combat/death.
