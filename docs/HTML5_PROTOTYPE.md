# SpiritCodex HTML5 Prototype Documentation

> **File:** `playable/spirit-codex.html`  
> **Version:** 1.0 (2026-07-06)  
> **Status:** Playable prototype — all assets procedurally generated, zero external dependencies

---

## How to Play

### Launching

Open `playable/spirit-codex.html` directly in any modern browser. No server, npm, or network connection required.

### Screens

| Screen | Purpose | Navigation |
|--------|---------|------------|
| **Title** | Game branding and entry point | Click "开始游戏" → Roster |
| **Roster** | Browse all 12 characters, view stats and skills | Click card → Detail modal; "组队 →" → Formation |
| **Team Formation** | Build a team of 3–6 characters | Click roster to add, click slot to remove |
| **Battle** | Turn-based combat against 3 enemy waves | Automatic turn progression, choose skills on your turn |
| **Result** | Victory/defeat summary | "返回主界面" → Title |

### Controls

- **Title Screen:** Click start button
- **Roster Screen:** Tap any character card to open detailed stats panel
- **Formation Screen:** Tap characters in the bottom roster bar to add them to team slots (3 minimum, 6 maximum). Tap an occupied slot to remove that character
- **Battle Screen:** When it's your character's turn, tap one of the skill buttons:
  - Regular skills (no energy cost) can be used any time
  - Ultimate skills (marked with ✦) require a full energy bar (100 energy)
  - Energy is gained by attacking (20 per attack) and being hit (10 per hit taken)

---

## Character Roster

12 characters — 2 per element (6 elements total)

### 🔥 Fire Element

| Name | Role | HP | ATK | DEF | SPD | Skill 1 | Skill 2 | Ultimate |
|------|------|----|-----|-----|-----|---------|---------|----------|
| **炎舞** | 输出 (DPS) | 280 | 95 | 40 | 72 | 烈焰斩 (1.2× ATK) | 炎爆弹 (1.6× ATK, 30% burn) | 炎狱天舞 (2.5× ATK) |
| **灼心** | 输出 (DOT) | 250 | 80 | 35 | 68 | 灼心焰 (1.0× ATK, 3-turn burn) | 焚烬 (detonate all burns) | 灭世之焰 (2.2× ATK, 5-turn burn) |

### 💧 Water Element

| Name | Role | HP | ATK | DEF | SPD | Skill 1 | Skill 2 | Ultimate |
|------|------|----|-----|-----|-----|---------|---------|----------|
| **寒渊** | 控制 (Control) | 300 | 60 | 55 | 60 | 冰刺 (1.1× ATK, 20% freeze) | 寒潮 (1.3× ATK, 30% freeze) | 深渊冰封 (2.0× ATK, guaranteed freeze) |
| **潮汐** | 治疗 (Healer) | 320 | 45 | 50 | 55 | 涌泉 (1.0× ATK) | 治愈之泉 (heal team 20% HP) | 深澜之颂 (heal 40% + cleanse) |

### 🌪 Wind Element

| Name | Role | HP | ATK | DEF | SPD | Skill 1 | Skill 2 | Ultimate |
|------|------|----|-----|-----|-----|---------|---------|----------|
| **疾风** | 输出 (Speed DPS) | 240 | 85 | 30 | 95 | 风刃 (1.1× ATK) | 疾风突袭 (1.5× ATK) | 风神之怒 (2.3× ATK, -30% DEF) |
| **飓影** | 输出 (Evasion) | 230 | 75 | 28 | 90 | 影袭 (1.0× ATK) | 飓风斩 (1.4× ATK) | 暴风骤影 (2.0× ATK, +50% dodge) |

### ⚡ Thunder Element

| Name | Role | HP | ATK | DEF | SPD | Skill 1 | Skill 2 | Ultimate |
|------|------|----|-----|-----|-----|---------|---------|----------|
| **雷鸣** | 输出 (Burst) | 260 | 100 | 35 | 80 | 雷击 (1.2× ATK) | 雷霆万钧 (1.8× ATK, 15% stun) | 万雷天牢 (2.6× ATK, 30% stun) |
| **电弧** | 输出 (Chain) | 245 | 85 | 32 | 82 | 电弧 (1.0× ATK, chain 1) | 连锁闪电 (1.3× ATK, chain 2) | 雷霆风暴 (2.2× ATK, chain all) |

### 🌑 Dark Element

| Name | Role | HP | ATK | DEF | SPD | Skill 1 | Skill 2 | Ultimate |
|------|------|----|-----|-----|-----|---------|---------|----------|
| **暗蚀** | 输出 (Lifesteal) | 270 | 88 | 38 | 70 | 暗影刺 (1.1× ATK, 20% lifesteal) | 暗蚀之触 (1.4× ATK, 30% lifesteal) | 暗影吞噬 (2.3× ATK, 40% lifesteal) |
| **诅咒** | 控制 (Debuff) | 290 | 65 | 45 | 62 | 诅咒之矢 (1.0× ATK, -15% ATK) | 虚弱诅咒 (1.2× ATK, -25% ATK) | 永恒诅咒 (2.0× ATK, -30% ATK & DEF) |

### ☀️ Light Element

| Name | Role | HP | ATK | DEF | SPD | Skill 1 | Skill 2 | Ultimate |
|------|------|----|-----|-----|-----|---------|---------|----------|
| **圣辉** | 治疗 (Cleanse) | 310 | 50 | 52 | 58 | 圣光 (1.0× ATK) | 净化之光 (cleanse + 15% HP heal) | 神圣洗礼 (35% HP heal + cleanse + 20% damage reduction) |
| **晨曦** | 治疗 (Shield) | 330 | 42 | 58 | 52 | 曙光 (0.9× ATK) | 晨曦护盾 (shield = DEF×200%) | 黎明之盾 (shield DEF×300% + 20% HP heal) |

---

## Battle Mechanics

### Turn System

- **Speed (SPD)** determines turn order — highest speed acts first each round
- When multiple units have similar speed, order is slightly randomized
- All allies and enemies share the same turn queue

### Turn Actions

On your turn you choose from 4 options:
1. **Attack (Skill 1)** — Basic attack, always available
2. **Skill 2** — Stronger attack with special effects, always available
3. **Ultimate** — Most powerful skill, requires full energy bar (100/100)

### Energy System

| Source | Energy Gained |
|--------|--------------|
| Using a regular attack/skill | +20 energy |
| Being hit by enemy | +10 energy |
| Using an ultimate | -100 energy (costs full bar) |

### Damage Calculation

```
Base Damage = ATK × Skill Multiplier × Element Advantage
Final Damage = Base Damage × (1 - Target DEF reduction)
```

- **Critical Hit:** 15% chance for player, 10% for enemies → 1.5× damage
- **Element Advantage:** 1.5× damage
- **Element Disadvantage:** 0.5× damage

### Status Effects

| Effect | Duration | Description |
|--------|----------|-------------|
| **Burn (灼烧)** | 2–5 turns | 5% max HP damage per turn |
| **Freeze (冰冻)** | 1 turn | Target skips turn |
| **Stun (麻痹)** | 1 turn | Target skips turn |
| **ATK Break** | 2–3 turns | Reduces target ATK by 15–30% |
| **DEF Break** | 2 turns | Reduces target DEF by 30% |
| **Lifesteal** | Instant | Heals attacker for 20–40% of damage dealt |
| **Shield** | Until broken | Absorbs damage before HP is affected |

### Healing & Shields

- **Heal skills** restore a percentage of max HP to allies
- **Shield skills** add a shield value equal to DEF × multiplier
- Shields absorb damage before HP is affected
- Ultimate heal/cleanse skills also remove all debuffs and DOT effects

---

## Element Advantage Chart

```
  🔥 Fire ── beats ──→ 🌪 Wind
   ↑                        ↓
   ↑                    ⚡ Thunder
   ↑                        ↓
💧 Water ←── beats ──── ⚡ Thunder

🔥 Fire ←→ 💧 Water (circular advantage)

🌑 Dark ←→ ☀️ Light (mutual advantage)
```

| Attacker ↓ \ Defender → | 🔥 Fire | 💧 Water | 🌪 Wind | ⚡ Thunder | 🌑 Dark | ☀️ Light |
|--------------------------|---------|----------|---------|-----------|---------|---------|
| 🔥 **Fire** | — | 0.5× | **1.5×** | 0.5× | 1.0× | 1.0× |
| 💧 **Water** | **1.5×** | — | 0.5× | 0.5× | 1.0× | 1.0× |
| 🌪 **Wind** | 0.5× | **1.5×** | — | **1.5×** | 1.0× | 1.0× |
| ⚡ **Thunder** | 0.5× | **1.5×** | 0.5× | — | 1.0× | 1.0× |
| 🌑 **Dark** | 1.0× | 1.0× | 1.0× | 1.0× | — | **1.5×** |
| ☀️ **Light** | 1.0× | 1.0× | 1.0× | 1.0× | **1.5×** | — |

> **Tip:** Use the element chart strategically — match Fire against Wind enemies, Water against Fire enemies, etc.

---

## Enemy Waves

| Wave | Enemies | Difficulty |
|------|---------|------------|
| **1** | 2× 暗影狼 (Dark) + 1× 暗影蝠 (Dark) | Easy — introduce basic combat |
| **2** | 炎魔兵 (Fire) + 冰霜守卫 (Water) + 风暴使者 (Wind) | Medium — mixed elements |
| **3** | 混沌元素 (Dark, Boss) — 800 HP | Hard — single powerful boss |

---

## What Is Implemented vs Simplified

### ✅ Implemented (matches GDD)

- [x] 12 unique characters across 6 elements
- [x] Turn-based combat with speed-based turn order
- [x] Element advantage system (+50% / -50% damage)
- [x] Energy bar system for ultimate skills
- [x] All 3 skills per character (basic + skill + ultimate)
- [x] Status effects: burn, freeze, stun, ATK/DEF break
- [x] Lifesteal mechanic (Dark element)
- [x] Shield mechanic (Light element)
- [x] Healing mechanic (Water/Light support)
- [x] Cleanse mechanic (remove debuffs)
- [x] Chain/lightning mechanic (Thunder element)
- [x] 3-wave enemy progression with boss
- [x] Team formation (3–6 characters)
- [x] Character detail view with full stats
- [x] Procedural canvas-drawn character portraits
- [x] Dark fantasy visual theme

### ⚠️ Simplified / Not Implemented

| Feature | GDD Version | Prototype Version |
|---------|-------------|-------------------|
| **Evolution system** | Multiple evolution paths with materials | Not implemented — characters at fixed stats |
| **Rarity tiers** | N / R / SR / SSR with stat multipliers | All characters at base power (no rarity) |
| **Level system** | XP → level up → stat growth | No levels — fixed stats |
| **Equipment/Relics** | Gear slots with set bonuses | Not implemented |
| **Element fusion** | 2–3 element fusion combos | Not implemented |
| **Passive skills** | Passive ability system | Not implemented (only active skills) |
| **Intelligence (INT)** | Skill-learning prerequisite system | Not implemented |
| **Map exploration** | Fog-of-war, resource nodes | Not implemented |
| **Gacha/summoning** | Pull system for characters | All 12 characters available by default |
| **PvP modes** | Arena, guild wars, tournaments | PvE only |
| **Guild system** | Social features, guild battles | Not implemented |
| **Daily quests** | Recurring objectives | Not implemented |
| **Stamina/AP system** | Energy-gated gameplay | Not implemented |
| **Multiple target targeting** | Manual target selection | Auto-targets first alive enemy |
| **AI enemy behavior** | Strategic enemy AI | Enemies choose random targets/skills |
| **Audio** | SFX and music | No audio |
| **Save/load** | Persistent game state | No persistence — session only |

---

## Mapping to Unity Version

### Architecture Mapping

| Prototype | Unity Equivalent |
|-----------|-----------------|
| `CHARACTERS[]` array | `ScriptableObject` per character |
| `state.team[]` | `TeamManager` component |
| `makeBattleChar()` | `BattleUnit` MonoBehaviour |
| `nextTurn()` | `TurnManager` state machine |
| `playerAction()` | `SkillSystem.ExecuteSkill()` |
| `getAdvantage()` | `ElementChart.GetMultiplier()` |
| Canvas rendering | Unity URP + VFX Graph particles |
| `drawPortrait()` | Character portrait `Sprite` assets |

### What Changes in Unity

1. **Graphics:** Replace procedural canvas drawing with URP shaders, sprite sheets, and VFX Graph particle systems
2. **Audio:** Add SFX (skill sounds, hit impacts, ambient music) via Unity Audio
3. **Networking:** Add PvP, gacha, and social features via server backend
4. **Save System:** Persistent data via `PlayerPrefs` or JSON serialization
5. **UI:** Replace HTML/CSS with Unity UI Toolkit or UGUI with proper animations
6. **Targeting:** Add manual target selection in battle
7. **AI:** Implement strategic enemy AI (target weakest, use heals when low HP)
8. **Evolution:** Add evolution UI, material system, and stat modification
9. **Gacha:** Implement summoning system with pity counter

---

## Known Limitations

1. **No save/load** — game state is lost on page refresh
2. **No audio** — silent experience
3. **Auto-targeting only** — player cannot choose which enemy to attack (always targets first alive)
4. **Enemy AI is random** — enemies don't strategize
5. **No skill cooldowns** — skills can be spammed every turn
6. **Single-file constraint** — all code in one HTML file limits maintainability
7. **No animations** — character sprites are static canvas drawings, no walk/attack animations
8. **Mobile touch only** — no keyboard shortcuts for desktop play
9. **Fixed enemy阵容** — no procedural/random enemy generation
10. **Balance not tuned** — stats are illustrative, not competitively balanced

---

## Technical Notes

- **Zero external dependencies** — no CDN, npm, fetch, or system commands
- **Pure static HTML + CSS + JavaScript** — single file, ~1000 lines
- **All graphics procedural** — canvas-drawn character portraits with element-colored silhouettes
- **Works offline** — open the HTML file directly in a browser
- **Responsive** — adapts to different screen sizes via CSS viewport units
