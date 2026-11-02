# LANDFALL 64

**Four missions. One island. No quarter required.**

An original C64-style arcade campaign in one HTML file: Canvas, vanilla JavaScript and Web Audio. No packages, installation, build step, external assets, accounts or runtime network requests. The complete game is under 65 KB uncompressed.

**[Play on GitHub Pages](https://qsolkcb.github.io/landfall-64/)** · [Source](index.html)

## Play locally

Download this repository and open `index.html` in a modern desktop browser. The game works directly from `file://`; nothing needs to be installed. Click **Deploy**, read the briefing, then click **Go**. Sound starts after a click or key press.

An optional local server also works:

```sh
cd landfall-64
python3 -m http.server 8000
```

Open `http://localhost:8000`. Python is optional and is not part of the game.

## The operation

| Mission | Your job | Special ability (`E`) |
| --- | --- | --- |
| **01 · Shore assault** | Move your squad through sandbag cover, silence three sentry guns, destroy the bunker and enter the amber gate. | Throw a grenade towards your aim, within a 175-pixel range. |
| **02 · Courtyard rescue** | Use a fixed gun to protect evacuees from rooftop attackers, mines, armoured vehicles and falling debris. Friendly fire is disabled. | Rally the crew: a short burst of speed and protection. |
| **03 · Helicopter escape** | Fly over the rock spires, hover above both amber pads to collect the survivors, then reach the offshore carrier. | Clear incoming shots and deploy a temporary defensive flare. |
| **04 · Last light duel** | Throw darts across the channel while the commander recovers. Jump low throws, duck high throws and watch the guard. | Raise a short-lived shield. |

Play the full campaign or select any mission for standalone practice. Briefings and controls are shown before every stage. Crew rescued in the courtyard become the helicopter's passengers. Campaign high scores are saved separately for each difficulty in browser storage; blocked storage does not prevent play. Practice does not overwrite campaign records.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` or arrow keys | Move / fly; move the aim in the fixed-gun rescue stage. |
| Mouse | Aim. |
| Left mouse button or `Space` | Fire / throw. Hold for continuous fire. |
| `W` / Up in the duel | Jump. Release before the next jump. |
| `S` / Down in the duel | Duck. You cannot throw while ducking. |
| `E` | Stage-specific ability; the HUD shows its recharge time. |
| `Shift` during shore assault | Move slowly for positioning. |
| `P` or `Escape` | Pause / resume. Leaving the tab also pauses. |
| `M` | Toggle all sound. Math pulse and voices have independent toggles. |
| `Enter` | Deploy / start / continue when the game canvas has focus. |

For keyboard-only shooting, keep the pointer away from the canvas: assault and flight select a nearby enemy automatically, and the duel targets the commander. Rescue uses the arrow keys or WASD to move the reticle. Touch controls appear on coarse-pointer devices and can also be enabled with the footer button. In rescue, tap/hold the canvas to aim and fire; in other stages touch firing uses the same automatic aim.

## Difficulty

| Rule | Easy | Hard |
| --- | --- | --- |
| Armour per stage | 8 | 4 |
| Campaign tries | 5, then unlimited stage continues | 3 total |
| Enemy projectiles | Slower | Faster |
| Evacuation requirement | 4 of 8 | 6 of 10 |
| Commander armour | 10 | 16 |
| Special recharge | 7 seconds | 10 seconds |

Both modes checkpoint at stage entry. Retrying restores that stage's starting score and crew, preventing score farming. Hard ends after the third failure; Easy can continue the current stage indefinitely. Weapons have unlimited ammunition. There are no timers forcing you to rush.

## Small by design

- One self-contained `index.html`; 480 × 270 pixel Canvas, scaled to the available screen.
- A fixed 120 Hz simulation with animation driven by `requestAnimationFrame`.
- Seeded encounter generation, deterministic physics and replayable input.
- Original sprite geometry, landscapes, layouts and interface drawn in code.
- Original looping mathematical pulse synthesized from waves, integer operations and seeded noise; no recorded soundtrack or borrowed melody.
- New digitized “ahhh” cries generated with harmonic formants, a falling fundamental and quantization. Allies, enemies and the commander have different timbres. No recordings, speech service or browser voice downloads.
- Grace periods after damage, clear attack warnings, independent audio controls, reduced-motion support and pause on loss of focus.

The game draws inspiration from the multi-stage arcade rescue genre. Its characters, story, artwork, level layouts, audio and code are original. See [ASSETS.md](ASSETS.md).

## Verification

The development checks use only Node's built-in test runner. **Node is not needed to play.**

```sh
node --test tests/game.test.cjs
```

The tests execute the engine extracted from the actual HTML. They cover deterministic replay in all stages and both modes, collisions, damage grace, checkpoints, continues, prisoner safety, hover extraction, duel dodges, stage progression, sound generation and an Easy controller that completes all four missions through normal game inputs.

## GitHub Pages

The workflow validates pull requests, then validates and deploys `main`. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. No secrets or custom domain are needed. The deployed artifact contains only the playable HTML and `.nojekyll`.

## Licence

Source code: [Apache-2.0](LICENSE), preserving the repository's original licence. Newly created game visuals and synthesized audio output: [CC0 dedication](ASSETS.md).
