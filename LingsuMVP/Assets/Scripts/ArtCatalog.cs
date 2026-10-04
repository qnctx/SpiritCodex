using System.Collections.Generic;
using UnityEngine;

namespace LingsuMVP
{
    /// <summary>
    /// Stable runtime entry point for Image 2 generated sprites.
    /// Generated art can be added incrementally without changing gameplay code.
    /// </summary>
    public static class ArtCatalog
    {
        public const string GeneratedRoot = "Art/Generated";

        public const string TownBackgroundPath = GeneratedRoot + "/Backgrounds/bg_title_codex_hall";
        public const string TownAlchemyBackgroundPath = GeneratedRoot + "/Backgrounds/bg_town_alchemy_haven";
        public const string RosterBackgroundPath = GeneratedRoot + "/Backgrounds/bg_roster_archive";
        public const string FormationBackgroundPath = GeneratedRoot + "/Backgrounds/bg_formation_war_table";
        public const string BattleWaveOnePath = GeneratedRoot + "/Backgrounds/bg_battle_wave_01_shadow_ruins";
        public const string BattleWaveTwoPath = GeneratedRoot + "/Backgrounds/bg_battle_wave_02_elemental_foundry";
        public const string BattleWaveThreePath = GeneratedRoot + "/Backgrounds/bg_battle_wave_03_chaos_sanctum";
        public const string BattleBackgroundPath = BattleWaveOnePath;
        public const string HeroPath = GeneratedRoot + "/Characters/char_h1_fire_ranger";
        public const string FireGuardianPath = GeneratedRoot + "/Characters/char_h2_fire_guardian";
        public const string WaterHealerPath = GeneratedRoot + "/Characters/char_w1_water_healer";
        public const string TideWardenPath = GeneratedRoot + "/Characters/char_w2_tide_warden";
        public const string WindRangerPath = GeneratedRoot + "/Characters/char_a1_wind_ranger";
        public const string WindAlchemistPath = GeneratedRoot + "/Characters/char_a2_wind_alchemist";
        public const string ThunderWarriorPath = GeneratedRoot + "/Characters/char_t1_thunder_warrior";
        public const string ThunderMagePath = GeneratedRoot + "/Characters/char_t2_thunder_mage";
        public const string ShadowAssassinPath = GeneratedRoot + "/Characters/char_d1_shadow_assassin";
        public const string NecromancerPath = GeneratedRoot + "/Characters/char_d2_necromancer";
        public const string LightPriestessPath = GeneratedRoot + "/Characters/char_l1_light_priestess";
        public const string LightPaladinPath = GeneratedRoot + "/Characters/char_l2_light_paladin";
        public const string MonsterOnePath = GeneratedRoot + "/Enemies/monster_01";
        public const string MonsterTwoPath = GeneratedRoot + "/Enemies/monster_02";
        public const string MonsterThreePath = GeneratedRoot + "/Enemies/monster_03";
        public const string BossPath = GeneratedRoot + "/Enemies/boss_ember";
        public const string WoodMagePath = GeneratedRoot + "/Allies/ally_wood_mage";
        public const string IronGuardPath = GeneratedRoot + "/Allies/ally_iron_guard";
        public const string AlchemyChildPath = GeneratedRoot + "/Allies/ally_alchemy_child";
        public const string AlchemyApprenticePath = GeneratedRoot + "/Allies/ally_alchemy_apprentice";
        public const string ShadowWolfPath = GeneratedRoot + "/Enemies/enemy_shadow_wolf";
        public const string ShadowBatPath = GeneratedRoot + "/Enemies/enemy_shadow_bat";
        public const string FlameDemonSoldierPath = GeneratedRoot + "/Enemies/enemy_flame_demon_soldier";
        public const string FrostGuardianPath = GeneratedRoot + "/Enemies/enemy_frost_guardian";
        public const string StormHeraldPath = GeneratedRoot + "/Enemies/enemy_storm_herald";
        public const string ChaosElementalPath = GeneratedRoot + "/Enemies/enemy_chaos_elemental";
        public const string WindEaglePath = GeneratedRoot + "/Summons/summon_wind_eagle";
        public const string SkeletonWarriorPath = GeneratedRoot + "/Summons/summon_skeleton_warrior";

        private const string LegacyHeroPath = "Art/Hero";
        private const string LegacyMonsterPath = "Art/Monster";

        private static readonly Dictionary<string, Sprite> SpriteCache = new Dictionary<string, Sprite>();
        private static readonly HashSet<string> ReportedFallbacks = new HashSet<string>();

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        private static void ResetRuntimeCache()
        {
            SpriteCache.Clear();
            ReportedFallbacks.Clear();
        }

        public static Sprite LoadTownBackground(string panelKey)
        {
            string normalizedKey = NormalizePanelKey(panelKey);
            string panelPath = GetTownPanelPath(normalizedKey);
            return LoadSprite("town:" + normalizedKey, panelPath, TownBackgroundPath);
        }

        public static Sprite LoadBattleBackground()
        {
            return LoadBattleBackground(1);
        }

        public static Sprite LoadBattleBackground(int stageIndex)
        {
            int safeStage = Mathf.Clamp(stageIndex, 1, 3);
            string stagePath = safeStage == 3
                ? BattleWaveThreePath
                : safeStage == 2 ? BattleWaveTwoPath : BattleWaveOnePath;
            return LoadSprite("battle-background:" + safeStage, stagePath, BattleWaveOnePath);
        }

        public static Sprite LoadHero()
        {
            return LoadSprite("hero", HeroPath, LegacyHeroPath);
        }

        public static Sprite LoadCharacter(string characterId)
        {
            string characterPath = GetCharacterPath(characterId);
            return string.IsNullOrEmpty(characterPath)
                ? null
                : LoadSprite("character:" + characterId, characterPath);
        }

        public static Sprite LoadMonster(string monsterId)
        {
            string generatedPath;
            switch (monsterId)
            {
                case "Monster2":
                    generatedPath = MonsterTwoPath;
                    break;
                case "Monster3":
                    generatedPath = MonsterThreePath;
                    break;
                default:
                    generatedPath = MonsterOnePath;
                    break;
            }

            return LoadSprite("monster:" + monsterId, generatedPath, LegacyMonsterPath);
        }

        public static Sprite LoadBoss()
        {
            return LoadSprite("boss", BossPath, LegacyMonsterPath);
        }

        public static Sprite LoadEnemy(string enemyId)
        {
            string enemyPath = GetEnemyPath(enemyId);
            return string.IsNullOrEmpty(enemyPath)
                ? null
                : LoadSprite("enemy:" + enemyId, enemyPath);
        }

        public static Sprite LoadSummon(string summonId)
        {
            string summonPath;
            switch (summonId)
            {
                case "summon_wind_eagle":
                    summonPath = WindEaglePath;
                    break;
                case "summon_skeleton_warrior":
                    summonPath = SkeletonWarriorPath;
                    break;
                default:
                    return null;
            }

            return LoadSprite("summon:" + summonId, summonPath);
        }

        public static Sprite LoadRecruit(string recruitName)
        {
            if (string.IsNullOrEmpty(recruitName))
            {
                return null;
            }

            if (recruitName.Contains("青木"))
            {
                return LoadSprite("recruit:wood-mage", WoodMagePath);
            }

            if (recruitName.Contains("铁甲"))
            {
                return LoadSprite("recruit:iron-guard", IronGuardPath);
            }

            if (recruitName.Contains("炼药"))
            {
                return LoadSprite("recruit:alchemy-child", AlchemyChildPath, AlchemyApprenticePath);
            }

            return null;
        }

        public static string[] GetExpectedGeneratedPaths()
        {
            return new[]
            {
                TownBackgroundPath,
                TownAlchemyBackgroundPath,
                RosterBackgroundPath,
                FormationBackgroundPath,
                BattleWaveOnePath,
                BattleWaveTwoPath,
                BattleWaveThreePath,
                HeroPath,
                FireGuardianPath,
                WaterHealerPath,
                TideWardenPath,
                WindRangerPath,
                WindAlchemistPath,
                ThunderWarriorPath,
                ThunderMagePath,
                ShadowAssassinPath,
                NecromancerPath,
                LightPriestessPath,
                LightPaladinPath,
                MonsterOnePath,
                MonsterTwoPath,
                MonsterThreePath,
                BossPath,
                WoodMagePath,
                IronGuardPath,
                AlchemyChildPath,
                AlchemyApprenticePath,
                ShadowWolfPath,
                ShadowBatPath,
                FlameDemonSoldierPath,
                FrostGuardianPath,
                StormHeraldPath,
                ChaosElementalPath,
                WindEaglePath,
                SkeletonWarriorPath
            };
        }

        private static Sprite LoadSprite(string semanticKey, string primaryPath, params string[] fallbackPaths)
        {
            if (SpriteCache.TryGetValue(semanticKey, out Sprite cached))
            {
                return cached;
            }

            Sprite sprite = Resources.Load<Sprite>(primaryPath);
            if (sprite != null)
            {
                SpriteCache[semanticKey] = sprite;
                return sprite;
            }

            for (int i = 0; i < fallbackPaths.Length; i++)
            {
                string fallbackPath = fallbackPaths[i];
                if (string.IsNullOrEmpty(fallbackPath))
                {
                    continue;
                }

                sprite = Resources.Load<Sprite>(fallbackPath);
                if (sprite != null)
                {
                    SpriteCache[semanticKey] = sprite;
                    ReportFallbackOnce(semanticKey, primaryPath, fallbackPath);
                    return sprite;
                }
            }

            SpriteCache[semanticKey] = null;
            ReportFallbackOnce(semanticKey, primaryPath, "runtime procedural art");
            return null;
        }

        private static void ReportFallbackOnce(string semanticKey, string expectedPath, string fallbackPath)
        {
            if (!ReportedFallbacks.Add(semanticKey))
            {
                return;
            }

            Debug.LogWarning($"Generated art '{expectedPath}' is not available. '{semanticKey}' is using {fallbackPath}.");
        }

        private static string NormalizePanelKey(string panelKey)
        {
            if (string.IsNullOrEmpty(panelKey))
            {
                return "home";
            }

            return panelKey.Trim().ToLowerInvariant().Replace(' ', '_');
        }

        private static string GetTownPanelPath(string panelKey)
        {
            switch (panelKey)
            {
                case "alchemy":
                    return TownAlchemyBackgroundPath;
                case "roster":
                case "stats":
                case "character":
                    return RosterBackgroundPath;
                case "formation":
                    return FormationBackgroundPath;
                default:
                    return GeneratedRoot + "/Backgrounds/bg_town_" + panelKey;
            }
        }

        private static string GetCharacterPath(string characterId)
        {
            switch (characterId)
            {
                case "char_h1_fire_ranger":
                    return HeroPath;
                case "char_h2_fire_guardian":
                    return FireGuardianPath;
                case "char_w1_water_healer":
                    return WaterHealerPath;
                case "char_w2_tide_warden":
                    return TideWardenPath;
                case "char_a1_wind_ranger":
                    return WindRangerPath;
                case "char_a2_wind_alchemist":
                    return WindAlchemistPath;
                case "char_t1_thunder_warrior":
                    return ThunderWarriorPath;
                case "char_t2_thunder_mage":
                    return ThunderMagePath;
                case "char_d1_shadow_assassin":
                    return ShadowAssassinPath;
                case "char_d2_necromancer":
                    return NecromancerPath;
                case "char_l1_light_priestess":
                    return LightPriestessPath;
                case "char_l2_light_paladin":
                    return LightPaladinPath;
                default:
                    return null;
            }
        }

        private static string GetEnemyPath(string enemyId)
        {
            switch (enemyId)
            {
                case "enemy_shadow_wolf":
                    return ShadowWolfPath;
                case "enemy_shadow_bat":
                    return ShadowBatPath;
                case "enemy_flame_demon_soldier":
                    return FlameDemonSoldierPath;
                case "enemy_frost_guardian":
                    return FrostGuardianPath;
                case "enemy_storm_herald":
                    return StormHeraldPath;
                case "enemy_chaos_elemental":
                    return ChaosElementalPath;
                default:
                    return null;
            }
        }
    }
}
