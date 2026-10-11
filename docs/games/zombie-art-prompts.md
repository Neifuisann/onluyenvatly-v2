# Bắn Zombie: art prompts

Prompts for generating the game's art with ChatGPT (GPT image). **Status (2026-10-11): all 24 images are in** (`public/games/zombie/`, made with `node scripts/zombie-art.ts <folder>`). The game falls back to drawn placeholders only for a name missing from `src/features/zombie/assets.ts`.

The game already runs with built-in placeholder art. Each image saved as `public/games/zombie/<name>.webp`, using the names below, replaces its placeholder. The list of files the game uses is in `src/features/zombie/assets.ts`. Images you generate as PNG/JPG get converted to WebP first (§7).

## 1. How to generate (read first)

1. **Make the hero first** (§3.1, `hero-idle`). Regenerate until you love it. Every later prompt says "same character as the attached image": **attach `hero-idle.png` to those chats.** This keeps the face, cap and outfit consistent.
2. Do the same for zombies: make `zombie-1-walk` first, then attach it when you ask for its `hit` pose.
3. Every character, prop and effect needs a **transparent background**. Say "transparent background, PNG" (already in the prompts). If ChatGPT returns a white background anyway, ask it to "remove the background and return a transparent PNG".
4. **No text inside any image.** All text (answers, "TRÚNG!", scores) is drawn by the game, so it stays sharp and in Vietnamese.
5. Export: keep PNG for transparent assets and JPG/WebP for the two backgrounds. Trim empty borders, but keep the character centered with ~5 % padding. Sizes below are what to ask for; anything close is fine.
6. Paste the **style block** (§2) at the start of every prompt.

## 2. Style block (paste before every prompt)

```
STYLE: flat 2D illustration in the style of a modern Japanese indie music-video animation. Bold, even black outlines (thick, slightly rounded), flat cel colours with at most one hard shadow tone, no gradients, no 3D, no glossy plastic look. Graphic poster composition with strong silhouettes. Limited palette only: signal red #E0262B, deep ink black #17161D, bone cream #F3ECDD, slate violet-grey #4B4A63, pale zombie blue-grey #A9B4C2, small touches of dusty pink #E9A3A8. Subtle halftone dot texture inside shadows and slight print misregistration (red layer offset 2–3 px), like a risograph print. Expressive, slightly edgy, but friendly for Vietnamese high-school students: absolutely no blood, gore, wounds or weapons that look real. Zombies are comical and clumsy, not scary.
```

## 3. Characters

### 3.1 Hero (6 poses, 1024 × 1024, transparent)
All six face **right** (the zombies come from the right), full body, feet on the same baseline, same size in the frame.

**`hero-idle.png`**
```
[STYLE BLOCK]
Character design, full body, side three-quarter view facing right, standing ready. A Vietnamese high-school girl, about 16, short black hair with two small low pigtails tied with red ribbons, a red baseball cap worn slightly tilted, determined red eyes, sticking-plaster on one cheek. White school shirt with rolled-up sleeves and a loose red tie, dark slate shorts over black leggings with a red stripe, chunky white-and-red sneakers, white tape wrapped around her hands. She holds a chunky toy-like "ink blaster": a fat rounded cartoon gun made of cream plastic with a red ink tank on top and a black nozzle, clearly a toy, held at her hip. Transparent background, PNG, 1024x1024, centered, no text.
```

**`hero-aim.png`** (attach `hero-idle.png`)
```
[STYLE BLOCK]
Same character as the attached image, same outfit and proportions, facing right. She raises the ink blaster to shoulder height and aims straight ahead, one eye squinting, cap brim low, knees bent, focused. Transparent background, PNG, 1024x1024, same framing and baseline as the reference, no text.
```

**`hero-shoot.png`** (attach `hero-idle.png`)
```
[STYLE BLOCK]
Same character as the attached image, facing right, firing the ink blaster: recoil pushes her shoulders back, pigtails and tie flick backwards, mouth open in a shout. Do NOT draw the shot or muzzle flash (the game adds it). Transparent background, PNG, 1024x1024, same framing and baseline as the reference, no text.
```

**`hero-hurt.png`** (attach `hero-idle.png`)
```
[STYLE BLOCK]
Same character as the attached image, facing right, flinching after a mistake: stumbling half a step back, eyes squeezed shut, a single big sweat drop, cap knocked askew, blaster lowered. Comical, not painful. Transparent background, PNG, 1024x1024, same framing and baseline, no text.
```

**`hero-win.png`** (attach `hero-idle.png`)
```
[STYLE BLOCK]
Same character as the attached image, victory pose: blaster rested on her shoulder, other hand making a V sign, big confident grin, cap pushed back, one foot up on a defeated cartoon zombie's empty paper costume lying flat on the ground. Transparent background, PNG, 1024x1024, no text.
```

**`hero-lose.png`** (attach `hero-idle.png`)
```
[STYLE BLOCK]
Same character as the attached image, sitting on the ground defeated but cute: legs out, empty ink blaster in her lap dripping a drop of red ink, dizzy spiral eyes, cap fallen over one eye, three cartoon zombie hands poking in from the right edge patting her head. Light-hearted, no fear. Transparent background, PNG, 1024x1024, no text.
```

### 3.2 Zombies (3 kinds × 2 poses, 768 × 1024, transparent)
All face **left** (walking toward the hero). Same height in the frame. Each one holds up **a blank, empty cardboard sign** on a stick in front of their chest. The game writes the answer on top of it, so the sign must be blank cream cardboard, roughly rectangular, about 60 % of the image width.

**`zombie-1-walk.png`**: the student
```
[STYLE BLOCK]
Comical zombie character, full body, side three-quarter view facing LEFT, shuffling forward with stiff legs. A zombie high-school boy: pale blue-grey skin, messy hair, droopy half-closed eyes with tiny pupils, one sock down, torn school shirt with red cloth patches sewn on (no wounds), backpack hanging off one shoulder. With both hands he holds up a BLANK empty cream cardboard sign on a wooden stick in front of his chest; nothing is written on the sign. Transparent background, PNG, 768x1024, no text.
```

**`zombie-2-walk.png`**: the office worker
```
[STYLE BLOCK]
Comical zombie character, full body, facing LEFT, shuffling forward. A tall skinny zombie office worker: pale blue-grey skin, crooked glasses, loosened red necktie, rumpled cream shirt and slate trousers, one shoe missing, a coffee mug stuck to one hand. With both hands he holds up a BLANK empty cream cardboard sign on a wooden stick in front of his chest; nothing written on it. Same height and framing as the attached zombie. Transparent background, PNG, 768x1024, no text.
```
(attach `zombie-1-walk.png` for size consistency)

**`zombie-3-walk.png`**: the lab assistant
```
[STYLE BLOCK]
Comical zombie character, full body, facing LEFT, shuffling forward. A short round zombie lab assistant girl: pale blue-grey skin, bun hairstyle with a pencil stuck in it, oversized cracked safety goggles on her forehead, too-long white lab coat with red patches, slippers. With both hands she holds up a BLANK empty cream cardboard sign on a wooden stick in front of her chest; nothing written on it. Same height and framing as the attached zombie. Transparent background, PNG, 768x1024, no text.
```
(attach `zombie-1-walk.png`)

**`zombie-1-hit.png`**, **`zombie-2-hit.png`**, **`zombie-3-hit.png`** (attach that zombie's walk image)
```
[STYLE BLOCK]
Same zombie as the attached image, same framing, hit by a splash of red ink: knocked backwards off balance, arms flung up, eyes turned into two X marks, tongue out, a big red ink splash across the chest. The blank sign flies up out of the hands, tilted. Comical, no blood. Transparent background, PNG, 768x1024, no text.
```

## 4. Scene

**`bg-sky.jpg`** (2400 × 640, no transparency): the band behind the question card.
```
[STYLE BLOCK]
Wide panoramic background, no characters. A ruined city skyline at dusk seen from a school rooftop: silhouettes of broken apartment blocks and a toppled water tower in slate violet-grey, layered in three flat depths, against a flat signal-red sky with a big pale cream sun circle low on the left. Halftone dots fading toward the top. Calm, empty, plenty of quiet space in the middle for a white card to sit on top. 2400x640, no text.
```

**`ground.jpg`** (1600 × 1600, seamless tile): the lanes' floor.
```
[STYLE BLOCK]
Seamless tileable texture, top-down flat view of a school rooftop floor: big worn concrete tiles in slate violet-grey with thin ink-black cracks, a few faded red painted lines, scattered tiny paper scraps and halftone stains. Low contrast so text on top stays readable. Must tile seamlessly in both directions. 1600x1600, no text.
```

**`barricade.png`** (512 × 1024, transparent, tileable top to bottom): the defence line between hero and zombies.
```
[STYLE BLOCK]
A vertical barricade segment seen from the side, made of stacked school desks, a flipped chair and wooden planks tied with red rope, strips of red-and-cream warning tape. Must tile vertically: the top and bottom edges connect seamlessly. Transparent background, PNG, 512x1024, no text.
```

## 5. Props and effects (transparent)

**`ink-shot.png`** (512 × 256)
```
[STYLE BLOCK]
A single cartoon blob of red ink flying to the right: round head, tapering wobbly tail with two small droplets behind it, thick black outline, a cream highlight. Transparent background, PNG, 512x256, no text.
```

**`ammo.png`** (256 × 256): one life in the HUD.
```
[STYLE BLOCK]
Icon: a small toy ink cartridge, capsule-shaped, cream body with a red ink window and a black cap, slightly tilted. Thick outline, flat. Transparent background, PNG, 256x256, no text.
```

**`ammo-empty.png`** (256 × 256)
```
[STYLE BLOCK]
The same toy ink cartridge as the attached image, but empty: the ink window is dark slate, the cap is cracked, a tiny dust puff. Transparent background, PNG, 256x256, no text.
```
(attach `ammo.png`)

**`splat-1.png`**, **`splat-2.png`** (768 × 768)
```
[STYLE BLOCK]
A big flat red ink splat seen straight on, with irregular blobs and a ring of smaller droplets, a thin black outline on some edges, halftone dots inside. Different shape for each image. Transparent background, PNG, 768x768, no text.
```

**`paper-bits.png`** (1024 × 1024): what a defeated zombie bursts into.
```
[STYLE BLOCK]
A burst of torn paper confetti scraps flying outward from the centre: cream, slate and red pieces of different shapes, some curled, with motion lines. Transparent background, PNG, 1024x1024, no text.
```

## 6. Screens

**`title.jpg`** (1920 × 1080): the start screen behind the "Bắt đầu" button.
```
[STYLE BLOCK]
Key art, wide cinematic composition. The hero girl from the attached image stands on the left on a school-rooftop barricade of desks, blaster raised, cap and tie blowing in the wind, looking toward the right where a crowd of comical zombies in school uniforms and office clothes shuffles in, each holding blank cardboard signs. Flat signal-red sky, ruined city silhouettes in slate violet, giant cream sun. Leave the centre-bottom third calm and empty for a button. 1920x1080, no text.
```
(attach `hero-idle.png`)

**`win.jpg`** (1600 × 900)
```
[STYLE BLOCK]
The hero girl from the attached image on the rooftop at sunrise: sky turns from red to cream, defeated zombies are just flat empty paper costumes scattered around, she cheers with the blaster raised. Leave the right half calm for the score panel. 1600x900, no text.
```
(attach `hero-win.png`)

**`lose.jpg`** (1600 × 900)
```
[STYLE BLOCK]
The hero girl from the attached image sitting dizzy on the rooftop, a ring of comical zombies around her, but they look friendly: one offers her a pencil, one pats her cap. Red sky, slate city. Leave the right half calm for the score panel. 1600x900, no text.
```
(attach `hero-lose.png`)

## 7. Checklist

| File | Size | Transparent |
|---|---|---|
| hero-idle / aim / shoot / hurt / win / lose `.png` | 1024 × 1024 | yes |
| zombie-1/2/3-walk `.png`, zombie-1/2/3-hit `.png` | 768 × 1024 | yes |
| bg-sky `.jpg` | 2400 × 640 | no |
| ground `.jpg` | 1600 × 1600, seamless | no |
| barricade `.png` | 512 × 1024, tiles vertically | yes |
| ink-shot `.png` | 512 × 256 | yes |
| ammo `.png`, ammo-empty `.png` | 256 × 256 | yes |
| splat-1 / splat-2 `.png` | 768 × 768 | yes |
| paper-bits `.png` | 1024 × 1024 | yes |
| title `.jpg` | 1920 × 1080 | no |
| win `.jpg`, lose `.jpg` | 1600 × 900 | no |

To replace an image, regenerate it with the same name and framing, then run `node scripts/zombie-art.ts <folder>`: it trims, resizes and writes WebP (characters ≈ 40–70 KB, backgrounds ≤ 230 KB). The answer sign is placed over the blank sign the zombies hold (x 12–46 %, y 24–45 % of the walk image, `zombie.module.css`); keep that framing in new zombie art.
