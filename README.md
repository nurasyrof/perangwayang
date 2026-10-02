# Perang Wayang — Tarung di Balik Kelir

A 1-vs-1 fighting game in the browser (three.js / WebGL). The fighters are Javanese
wayang kulit puppets: flat, jointed leather figures with carved holes, stuck on their
horn rod (gapit). The blencong oil lamp throws their shadows onto the kelir screen.

## Run

ES modules need to be served over HTTP:

```bash
python3 -m http.server 8123
```

Then open http://localhost:8123. It needs an internet connection the first time, because
three.js and the fonts load from a CDN.

## Modes
- **1 Pemain vs Bot**: three bot levels (Mudah / Sedang / Sulit)
- **2 Pemain lokal**: two players on one keyboard, or with gamepads
- **Latihan**: training dummy that regenerates, with an ultimate meter that refills

## Controls
| Action | 1P / Training | 2P — P1 | 2P — P2 |
|---|---|---|---|
| Move / jump / crouch | WASD or arrows | WASD | Arrows |
| Punch | J | F | , or Num1 |
| Kick | K | G | . or Num2 |
| Block (or hold back) | L | H | / or Num3 |
| Roll (+ direction) | Space | Q | Right Shift or Num0 |
| Aji (ultimate) | U / I | R | ' or Num5 |

**Controller (Xbox / PlayStation / any standard gamepad):** stick or D-pad to move (up jumps, down crouches) · X/□ punch · A/✕ kick · B/○ roll · Y/△ or RT/R2 aji · LB/RB/LT (L1/R1/L2) block · Start/Options pauses. Menus: A select, B back. In 1P mode any connected controller drives P1. In 2P mode the first controller is P1 and the second is P2, and the keyboard keeps working alongside. Controllers rumble on hits, blocks, perfect blocks, ultimates and KOs.

Esc pauses. M toggles music. **Tab** (or **Select/Back** on a controller) toggles the in-fight button guide. The guide shows keyboard or controller labels to match the device you last used, and remembers whether you turned it on or off.

## Fighting system
- Strings: P,P,P · P,K / P,P,K (knockdown) · Fwd+P heavy that breaks guard · Down+P anti-air launcher · Down+K low sweep · air P/K overheads
- High attacks whiff against a crouching opponent. Lows must be blocked crouching, and air attacks standing.
- **Perfect block**: press block just before a hit lands to stagger the attacker.
- **Counter hit**: hitting an opponent during their startup does +25% damage.
- **Juggles** with damage scaling, **hit-stop**, screen shake, combo counter.
- **Tech roll**: press roll right after being knocked down.
- **Super cancel**: press Aji while a normal attack connects.
- Ult meter fills when you deal, take or block damage.

## Characters
| | Trait | Aji (ultimate) |
|---|---|---|
| Arjuna | Long reach | **Panah Pasopati**: a crescent energy arrow that crosses the screen |
| Bima | Slow and heavy. Armored heavy punch | **Kuku Pancanaka**: a claw rush that grabs, mauls, then slams |
| Gatotkaca | Double jump (he flies) | **Aji Brajamusti**: flies off-screen, then dives with a lightning fist |
| Srikandi | Fast attacks, long roll | **Hujan Panah**: a rain of arrows that tracks the opponent |

## Code map
- `js/main.js`: game loop at a fixed 60 Hz, match and round flow, menus, hit detection
- `js/fighter.js`: fighter state machine, move frame data, hit resolution
- `js/puppet.js` + `js/poses.js`: jointed puppet rig and pose library
- `js/textures.js`: procedural canvas art for puppet parts, gunungan, kelir and floor
- `js/ultimates.js`: the four ultimates and their projectiles
- `js/ai.js`: bot, driven through the same input interface as a player (so you can swap in a human for 2P or online play)
- `js/audio.js`: WebAudio SFX and a procedural slendro gamelan (saron, bonang, kenong, gong, kendang)
- `js/stage.js`: renderer, lighting and shadows, set dressing, camera, bloom
- `js/fx.js`: particles, rings, slashes, lightning
