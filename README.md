# LANDFALL 64

**Four missions. Two naval bonuses. No quarter required.**

An original C64-style arcade campaign in one HTML file: Canvas, vanilla JavaScript and Web Audio. No packages, installation, build step, external assets, accounts or runtime network requests. The complete game, including both bonuses, is under 85 KB uncompressed.

**[Play on GitHub Pages](https://qsolkcb.github.io/landfall-64/)** · [Source](index.html)

## Current build — v1.2.0

This build polishes controls, collision physics and combat graphics across the four campaign missions and two standalone bonuses.

- **Reliable inputs:** short mouse, keyboard and touch taps reach the next simulation step. Cancelled touches and loss of focus clear pending actions. Ducking no longer consumes a ready throw.
- **Better collisions:** shots resolve the first contact along their path, and vehicle hit areas include their visible turrets. Squad and helicopter movement stop at solid surfaces and slide along them; descending onto a rock no longer pushes the helicopter sideways.
- **Clearer combat:** aimed weapons, gun recoil, muzzle and enemy hit flashes, brighter tracers, tumbling darts and walking tied to actual movement. Reduced-motion mode suppresses the new flashes, recoil and dart spin. Naval splash reports stay visible through the next launch.
- **Verified and lean:** 67 automated checks pass, including completion controllers for the Easy campaign missions and both bonuses on Easy and Hard. The playable HTML is 83,757 bytes, with no dependencies or runtime downloads.

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
| **03 · Helicopter escape** | Fly over the rock spires, land or hover above both amber pads to collect the survivors, then reach the offshore carrier. | Clear incoming shots and deploy a temporary defensive flare. |
| **04 · Last light duel** | Throw darts across the channel while the commander recovers. Jump low throws, duck high throws and watch the guard. | Raise a short-lived shield. |

Play the full campaign or select any mission for standalone practice. Briefings and controls are shown before every stage. Crew rescued in the courtyard become the helicopter's passengers. Follow the amber arrow to the nearest uncollected pad, land or hover low, and stop horizontal movement for one second to board them. Collect both pads before returning to the cyan carrier. Pads behind you display a left arrow and their actual distance; pads and the carrier support safe landings. Campaign high scores are saved separately for each difficulty in browser storage; blocked storage does not prevent play. Practice does not overwrite campaign records.

## Bonus operations

Both bonus games are available directly from the menu, in either difficulty. The original campaign still ends after the commander duel; its debrief also offers a shortcut to the bonus menu. Bonus scores do not overwrite campaign records.

| Bonus | Mechanics | Controls |
| --- | --- | --- |
| **B1 · Skyshield** | Defend the fleet with shipboard anti-aircraft guns. Lead approaching planes, intercept falling bombs and catch scout aircraft for extra points. Six ready shells replenish continuously, encouraging short bursts. Survive the complete raid. | Mouse or WASD/arrows aim; click/Space fires; `E` deploys a flak barrage and reloads the ready shells. |
| **B2 · Iron Horizon** | Sink the opposing fleet with heavy naval guns. Mouse/touch aiming at a visible hull or mast sets bearing and range together. Manual ranging uses LONG/SHORT splash reports; one degree adds 200m of arcade range. Incoming salvos are telegraphed; smoke disrupts them. | Mouse/touch aims both axes; A/D sets bearing; W/S sets elevation; Shift gives fine elevation control; click/Space fires; `E` lays smoke. A slider also controls elevation. |

The bonus mechanics reference the anti-aircraft and ranging-gun sequences in the [1983 Beach-Head manual](https://www.mocagh.org/miscgame/beachhead-manual.pdf). Skyshield and Iron Horizon have original names, artwork, layouts, code and synthesized sound.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` or arrow keys | Move / fly; move the aim in the fixed-gun rescue stage. Use `S` / Down to land the helicopter on amber pads or the carrier. |
| Mouse | Aim. |
| Left mouse button or `Space` | Fire / throw. Hold for continuous fire. |
| `W` / Up in the duel | Jump. Release before the next jump. |
| `S` / Down in the duel | Duck. You cannot throw while ducking. |
| `E` | Stage-specific ability; the HUD shows its recharge time. |
| `Shift` during shore assault | Move slowly for positioning. |
| `P` or `Escape` | Pause / resume. Leaving the tab also pauses. |
| `M` | Toggle all sound. Math pulse and voices have independent toggles. |
| `Enter` | Deploy / start / continue when the game canvas has focus. |

For keyboard-only shooting, keep the pointer away from the canvas: assault and flight select a nearby enemy automatically, and the duel targets the commander. Rescue and Skyshield use the arrow keys or WASD to move the reticle. Touch controls appear on coarse-pointer devices and can also be enabled with the footer button. In rescue and both naval bonuses, tap or drag the canvas to aim and fire; Iron Horizon sets bearing and range together when you aim at a visible hull or mast. In assault, flight and the duel, touch firing uses automatic aim.

## Difficulty

| Rule | Easy | Hard |
| --- | --- | --- |
| Armour per stage | 8 | 4 |
| Campaign tries | 5, then unlimited stage continues | 3 total |
| Enemy projectiles | Slower | Faster |
| Evacuation requirement | 4 of 8 | 6 of 10 |
| Commander armour | 10 | 16 |
| Special recharge | 7 seconds | 10 seconds |

Both modes checkpoint at stage entry. Retrying restores that stage's starting score and crew, preventing score farming. Hard ends after the third failure; Easy can continue the current stage indefinitely. Ammunition is unlimited; Skyshield has six ready shells that replenish automatically. There are no timers forcing you to rush.

## Small by design

- One self-contained `index.html`; 480 × 270 pixel Canvas, scaled to the available screen.
- A fixed 120 Hz simulation with animation driven by `requestAnimationFrame`.
- Short mouse, keyboard and touch taps are retained until the next simulation step. Cancelled touches and loss of focus clear pending actions.
- Seeded encounter generation, deterministic physics and replayable input.
- Swept projectile collisions resolve the first wall, enemy or hazard along a shot's path. Hit areas include visible heads and vehicle turrets. Helicopter and squad movement stop at solid surfaces and slide along them.
- Original sprite geometry, landscapes, layouts and interface drawn in code.
- Aimed weapons, gun recoil, muzzle flashes, enemy hit flashes, bright tracer tips and tumbling duel darts. Walking follows actual movement, including touch controls; reduced-motion mode suppresses the new flashes, recoil and dart spin.
- Original looping mathematical pulse synthesized from waves, integer operations and seeded noise; no recorded soundtrack or borrowed melody.
- Digitized enemy hit voices cycle between a brisk **“Allons-y!”**, a long falling **“Owwww…”**, and the original **“ahhh”**. Phoneme formants, nasal resonance, fricative noise, pitch glides and sample quantization generate them entirely in code. Ally and commander death cries retain their own timbres. Try the two preview buttons in Mission Control. Voices play one at a time; mute, pause and the Voices checkbox stop speech immediately. No recordings, speech service or browser voice downloads.
- Grace periods after damage, clear attack warnings, independent audio controls, reduced-motion support and pause on loss of focus.

The game draws inspiration from the multi-stage arcade rescue genre. Its characters, story, artwork, level layouts, audio and code are original. See [ASSETS.md](ASSETS.md).

## Verification

The development checks use only Node's built-in test runner. **Node is not needed to play.**

```sh
node --test tests/*.test.cjs
```

The tests execute the engine and UI handlers extracted from the actual HTML. They cover deterministic replay across all six games in both modes; sprite-aligned hits and first-contact swept collisions; helicopter landing, rock contacts, sliding, pickup and return guidance; damage grace, checkpoints, prisoner safety, duel dodges and campaign progression; readable naval splash reports during continuous fire; bounded deterministic sound; and controllers that complete the campaign stages on Easy and both bonuses on Easy and Hard through normal inputs. UI checks cover short taps, touch aiming and cancellation, keyboard focus, bonus selection, elevation controls, rendering and the campaign debrief shortcut.

## GitHub Pages

The workflow validates pull requests, then validates and deploys `main`. In **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. No secrets or custom domain are needed. The deployed artifact contains only the playable HTML and `.nojekyll`.

## Licence

Source code: [Apache-2.0](LICENSE), preserving the repository's original licence. Newly created game visuals and synthesized audio output: [CC0 dedication](ASSETS.md).
