# Project goal

Build a premium-feeling browser-based 2D horizontal bullet-hell shooter with modern anime-inspired visuals, polished UI, strong game feel, and snappy animation.

The game must be original. It may be inspired by the readability, pacing, and boss-focused structure of Touhou-like shooters, but it must not copy Touhou characters, names, story, music, or specific bullet patterns.

## Non-negotiables

- Prioritize visual fidelity and responsiveness over scope.
- Do not build the full campaign first.
- First build the asset pipeline.
- Then build one polished Stage 1 vertical slice.
- Only after Stage 1 feels premium should the project expand to later stages.

## Tech requirements

- Browser-based
- Phaser 3
- TypeScript
- Vite
- No backend
- All gameplay runs locally in the browser

## Asset pipeline rules

All major visual assets must be generated through the Gemini asset pipeline and integrated automatically.

Use a local MCP server for Gemini image generation.

The pipeline must support:
- styleframes
- player sprite generation
- enemy sprite generation
- boss sprite generation
- revision/editing of existing images

Use the Gemini asset pipeline before gameplay expansion.

## Visual standard

Target:
- crisp modern anime-inspired 2D visuals
- premium-feeling HUD
- sleek VFX
- readable bullets
- strong boss presentation
- polished menus and transitions

Avoid:
- programmer art
- generic placeholder UI
- weak explosions
- muddy palettes
- blurry sprites
- inconsistent styles

## Animation standard

Do not rely only on frame-by-frame generated art.
Prefer:
- layered cutout animation
- recoil
- flashes
- trails
- impact frames
- tweens
- polished transitions
- snappy hit feedback

## Vertical slice scope

Build Stage 1 only at first:
- title screen
- main menu
- options menu
- one full stage
- one elite or miniboss encounter
- one final boss with multiple phases
- one polished HUD
- game over / retry flow

## Audio standard

Create satisfying arcade-like sound effects for:
- player shot
- enemy shot
- hit
- graze
- pickup
- bomb
- explosion
- boss warning
- phase transition
- UI confirm/cancel
- death
- retry
- stage clear

## Gameplay standard

Movement must feel:
- immediate
- smooth
- precise

Feedback must feel:
- punchy
- readable
- satisfying

Required systems:
- movement
- focus mode
- shooting
- lives
- bombs
- graze
- score
- pickups
- power progression
- elite/boss support
- multi-phase boss fight
- pause
- options
- retry flow

## Quality gates

No asset is final unless:
- silhouette reads at gameplay size
- bullets are readable over backgrounds
- UI remains legible
- FX do not obscure gameplay
- palette is consistent
- motion feels snappy

## Player secondary motion rules

The player character should have subtle continuous secondary motion.

Use layered cutout-style animation for loose parts such as:
- hair
- ribbon
- skirt / coat tails
- sleeves or other cloth accents

Preferred implementation:
- Phaser Container for the player rig
- small desynced tweens and/or sinusoidal offsets on secondary parts
- no exaggerated full-body bobbing
- keep motion elegant, restrained, and premium

The constant rightward flight should create a soft airflow impression:
- hair drifts lightly
- ribbon flutters gently
- clothing sways subtly

Motion must remain readable during combat and must not interfere with hitbox clarity.

## Engineering rules

- Separate asset-generation code from runtime game code
- Keep asset prompts and manifests versioned
- Add cleanup and atlas-packing scripts if needed
- No core TODOs
- Run the game and fix errors before stopping
- Improve weak visuals instead of leaving them in place