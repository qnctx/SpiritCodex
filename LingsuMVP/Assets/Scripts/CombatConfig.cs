using System;
using UnityEngine;

namespace LingsuMVP
{
    [Serializable]
    public class CombatConfig
    {
        public HeroConfig hero;
        public BattleConfig battle;
        public MonsterConfig[] monsters;
        public MonsterConfig boss;
        public SkillConfig skills;
        public DropConfig drops;
        public BossSpawnConfig bossSpawn;

        public static CombatConfig CreateDefault()
        {
            return new CombatConfig
            {
                hero = new HeroConfig
                {
                    hp = 100,
                    attack = 10,
                    defense = 5,
                    positionX = 0f,
                    positionY = -2.35f,
                    spriteHeight = 2.8f
                },
                battle = new BattleConfig
                {
                    heroAttackInterval = 1f,
                    monsterAttackInterval = 1f,
                    bossAttackInterval = 0.8f
                },
                monsters = new[]
                {
                    new MonsterConfig { id = "Monster1", hp = 30, attack = 5, defense = 2, positionX = -3f, positionY = 1.15f, spriteHeight = 1.15f },
                    new MonsterConfig { id = "Monster2", hp = 30, attack = 5, defense = 2, positionX = 0f, positionY = 1.35f, spriteHeight = 1.15f },
                    new MonsterConfig { id = "Monster3", hp = 30, attack = 5, defense = 2, positionX = 3f, positionY = 1.15f, spriteHeight = 1.15f }
                },
                boss = new MonsterConfig
                {
                    id = "Boss",
                    hp = 90,
                    attack = 10,
                    defense = 4,
                    positionX = 0f,
                    positionY = 2f,
                    spriteHeight = 1.55f
                },
                skills = new SkillConfig
                {
                    skillOneCooldown = 4f,
                    skillOneDamageMultiplier = 2,
                    skillTwoCooldown = 5f,
                    skillTwoInitialDamage = 5,
                    skillTwoBurnDamage = 5,
                    skillTwoBurnTicks = 3,
                    skillTwoBurnInterval = 0.75f,
                    maxEnergy = 100,
                    basicAttackEnergyGain = 20,
                    skillOneEnergyGain = 25,
                    skillTwoEnergyGain = 25,
                    ultimateDamage = 18
                },
                drops = new DropConfig
                {
                    monsterDropAmount = 1,
                    bossDropAmount = 5
                },
                bossSpawn = new BossSpawnConfig
                {
                    positionX = 0f,
                    positionY = 2f
                }
            };
        }

        public void EnsureValid()
        {
            CombatConfig defaults = CreateDefault();

            if (hero == null)
            {
                hero = defaults.hero;
            }

            if (battle == null)
            {
                battle = defaults.battle;
            }

            if (monsters == null || monsters.Length == 0)
            {
                monsters = defaults.monsters;
            }

            if (skills == null)
            {
                skills = defaults.skills;
            }

            if (boss == null)
            {
                boss = defaults.boss;
            }

            if (drops == null)
            {
                drops = defaults.drops;
            }

            if (bossSpawn == null)
            {
                bossSpawn = defaults.bossSpawn;
            }

            hero.EnsureValid(defaults.hero);
            battle.EnsureValid(defaults.battle);
            skills.EnsureValid(defaults.skills);
            boss.EnsureValid(defaults.boss, 0);
            drops.EnsureValid(defaults.drops);
            bossSpawn.EnsureValid(defaults.bossSpawn);

            for (int i = 0; i < monsters.Length; i++)
            {
                if (monsters[i] == null)
                {
                    monsters[i] = defaults.monsters[Mathf.Min(i, defaults.monsters.Length - 1)];
                }

                monsters[i].EnsureValid(defaults.monsters[Mathf.Min(i, defaults.monsters.Length - 1)], i + 1);
            }
        }
    }

    [Serializable]
    public class HeroConfig
    {
        public int hp;
        public int attack;
        public int defense;
        public float positionX;
        public float positionY;
        public float spriteHeight;

        public void EnsureValid(HeroConfig defaults)
        {
            if (hp <= 0) hp = defaults.hp;
            if (attack <= 0) attack = defaults.attack;
            if (defense < 0) defense = defaults.defense;
            if (spriteHeight <= 0f) spriteHeight = defaults.spriteHeight;
        }
    }

    [Serializable]
    public class BattleConfig
    {
        public float heroAttackInterval;
        public float monsterAttackInterval;
        public float bossAttackInterval;

        public void EnsureValid(BattleConfig defaults)
        {
            if (heroAttackInterval <= 0f) heroAttackInterval = defaults.heroAttackInterval;
            if (monsterAttackInterval <= 0f) monsterAttackInterval = defaults.monsterAttackInterval;
            if (bossAttackInterval <= 0f) bossAttackInterval = defaults.bossAttackInterval;
        }
    }

    [Serializable]
    public class MonsterConfig
    {
        public string id;
        public int hp;
        public int attack;
        public int defense;
        public float positionX;
        public float positionY;
        public float spriteHeight;

        public void EnsureValid(MonsterConfig defaults, int index)
        {
            if (string.IsNullOrEmpty(id)) id = "Monster" + index;
            if (hp <= 0) hp = defaults.hp;
            if (attack <= 0) attack = defaults.attack;
            if (defense < 0) defense = defaults.defense;
            if (spriteHeight <= 0f) spriteHeight = defaults.spriteHeight;
        }
    }

    [Serializable]
    public class SkillConfig
    {
        public float skillOneCooldown;
        public int skillOneDamageMultiplier;
        public float skillTwoCooldown;
        public int skillTwoInitialDamage;
        public int skillTwoBurnDamage;
        public int skillTwoBurnTicks;
        public float skillTwoBurnInterval;
        public int maxEnergy;
        public int basicAttackEnergyGain;
        public int skillOneEnergyGain;
        public int skillTwoEnergyGain;
        public int ultimateDamage;

        public void EnsureValid(SkillConfig defaults)
        {
            if (skillOneCooldown <= 0f) skillOneCooldown = defaults.skillOneCooldown;
            if (skillOneDamageMultiplier <= 0) skillOneDamageMultiplier = defaults.skillOneDamageMultiplier;
            if (skillTwoCooldown <= 0f) skillTwoCooldown = defaults.skillTwoCooldown;
            if (skillTwoInitialDamage <= 0) skillTwoInitialDamage = defaults.skillTwoInitialDamage;
            if (skillTwoBurnDamage <= 0) skillTwoBurnDamage = defaults.skillTwoBurnDamage;
            if (skillTwoBurnTicks <= 0) skillTwoBurnTicks = defaults.skillTwoBurnTicks;
            if (skillTwoBurnInterval <= 0f) skillTwoBurnInterval = defaults.skillTwoBurnInterval;
            if (maxEnergy <= 0) maxEnergy = defaults.maxEnergy;
            if (basicAttackEnergyGain <= 0) basicAttackEnergyGain = defaults.basicAttackEnergyGain;
            if (skillOneEnergyGain <= 0) skillOneEnergyGain = defaults.skillOneEnergyGain;
            if (skillTwoEnergyGain <= 0) skillTwoEnergyGain = defaults.skillTwoEnergyGain;
            if (ultimateDamage <= 0) ultimateDamage = defaults.ultimateDamage;
        }
    }

    [Serializable]
    public class DropConfig
    {
        public int monsterDropAmount;
        public int bossDropAmount;

        public void EnsureValid(DropConfig defaults)
        {
            if (monsterDropAmount <= 0) monsterDropAmount = defaults.monsterDropAmount;
            if (bossDropAmount <= 0) bossDropAmount = defaults.bossDropAmount;
        }
    }

    [Serializable]
    public class BossSpawnConfig
    {
        public float positionX;
        public float positionY;

        public void EnsureValid(BossSpawnConfig defaults)
        {
            if (positionY == 0f)
            {
                positionY = defaults.positionY;
            }
        }
    }

    [Serializable]
    public class MapDropConfig
    {
        public MapDropEntry[] maps;

        public static MapDropConfig CreateDefault()
        {
            return new MapDropConfig
            {
                maps = new[]
                {
                    new MapDropEntry
                    {
                        page = 1,
                        map = 1,
                        name = "草木坡",
                        sweepSpiritDust = 3,
                        victoryHerbs = 2,
                        victoryOres = 0
                    },
                    new MapDropEntry
                    {
                        page = 1,
                        map = 2,
                        name = "铁砂岭",
                        sweepSpiritDust = 4,
                        victoryHerbs = 0,
                        victoryOres = 2
                    },
                    new MapDropEntry
                    {
                        page = 1,
                        map = 3,
                        name = "余烬祭坛",
                        sweepSpiritDust = 5,
                        victoryHerbs = 1,
                        victoryOres = 1
                    }
                }
            };
        }

        public void EnsureValid()
        {
            MapDropConfig defaults = CreateDefault();
            if (maps == null || maps.Length == 0)
            {
                maps = defaults.maps;
                return;
            }

            for (int i = 0; i < maps.Length; i++)
            {
                if (maps[i] == null)
                {
                    maps[i] = defaults.maps[Mathf.Min(i, defaults.maps.Length - 1)];
                }

                maps[i].EnsureValid(defaults.maps[Mathf.Min(i, defaults.maps.Length - 1)], i + 1);
            }
        }

        public MapDropEntry GetMap(int page, int map)
        {
            if (maps != null)
            {
                for (int i = 0; i < maps.Length; i++)
                {
                    if (maps[i] != null && maps[i].page == page && maps[i].map == map)
                    {
                        return maps[i];
                    }
                }
            }

            MapDropConfig defaults = CreateDefault();
            return defaults.maps[Mathf.Clamp(map, 1, defaults.maps.Length) - 1];
        }
    }

    [Serializable]
    public class MapDropEntry
    {
        public int page;
        public int map;
        public string name;
        public int sweepSpiritDust;
        public int victoryHerbs;
        public int victoryOres;

        public void EnsureValid(MapDropEntry defaults, int index)
        {
            if (page <= 0) page = defaults.page;
            if (map <= 0) map = index;
            if (string.IsNullOrEmpty(name)) name = defaults.name;
            if (sweepSpiritDust < 0) sweepSpiritDust = defaults.sweepSpiritDust;
            if (victoryHerbs < 0) victoryHerbs = defaults.victoryHerbs;
            if (victoryOres < 0) victoryOres = defaults.victoryOres;
        }
    }

    [Serializable]
    public class MaterialConfig
    {
        public MaterialEntry[] materials;

        public static MaterialConfig CreateDefault()
        {
            return new MaterialConfig
            {
                materials = new[]
                {
                    new MaterialEntry { id = "spirit_dust", name = "灵尘", quality = "普通", category = "货币", tradable = true, description = "基础货币，用于商店、打造和炼丹手续费。" },
                    new MaterialEntry { id = "spirit_jade", name = "灵玉", quality = "稀有", category = "珍贵货币", tradable = false, description = "珍贵货币，用于稀有商店和高阶材料兑换。" },
                    new MaterialEntry { id = "red_herb", name = "赤草", quality = "普通", category = "炼丹", tradable = true, description = "基础草药，用于小回血药和低阶生命丹。" },
                    new MaterialEntry { id = "clear_dew", name = "清露", quality = "普通", category = "炼丹", tradable = true, description = "基础露水，用于回灵丹和低阶防御丹。" },
                    new MaterialEntry { id = "iron_sand", name = "铁砂", quality = "普通", category = "锻造", tradable = true, description = "基础矿材，用于训练武器、普通护甲和低阶强化。" },
                    new MaterialEntry { id = "beast_hide", name = "兽皮", quality = "普通", category = "锻造", tradable = true, description = "基础皮革，用于皮甲、护手和鞋类装备。" },
                    new MaterialEntry { id = "skill_page", name = "技能残页", quality = "普通", category = "技能", tradable = true, description = "低阶技能升级材料。" },
                    new MaterialEntry { id = "vermillion_fruit", name = "朱果", quality = "稀有", category = "炼丹", tradable = true, description = "中阶炼丹材料，用于中回血药和攻击丹。" },
                    new MaterialEntry { id = "moon_dew", name = "月华露", quality = "稀有", category = "炼丹", tradable = true, description = "中阶炼丹材料，用于回灵丹和冷却类丹药。" },
                    new MaterialEntry { id = "red_copper", name = "赤铜", quality = "稀有", category = "锻造", tradable = true, description = "稀有矿材，用于稀有武器和装备强化。" },
                    new MaterialEntry { id = "demon_bone", name = "妖骨", quality = "稀有", category = "锻造", tradable = false, description = "特殊锻造材料，用于职业装备和饰品。" },
                    new MaterialEntry { id = "skill_secret_page", name = "技能秘页", quality = "稀有", category = "技能", tradable = false, description = "中阶技能升级材料。" },
                    new MaterialEntry { id = "phoenix_flower", name = "凤髓花", quality = "史诗", category = "炼丹", tradable = false, description = "高阶炼丹和进化丹材料。" },
                    new MaterialEntry { id = "star_dew", name = "星髓露", quality = "史诗", category = "炼丹", tradable = false, description = "高阶灵力丹和突破丹材料。" },
                    new MaterialEntry { id = "black_iron", name = "玄铁", quality = "史诗", category = "锻造", tradable = false, description = "史诗武器和装备突破材料。" },
                    new MaterialEntry { id = "dragon_scale", name = "龙鳞", quality = "史诗", category = "锻造", tradable = false, description = "高阶护甲和进化装备材料。" },
                    new MaterialEntry { id = "skill_true_scroll", name = "技能真卷", quality = "史诗", category = "技能", tradable = false, description = "高阶技能和奥义突破材料。" },
                    new MaterialEntry { id = "fire_shard", name = "火灵屑", quality = "普通", category = "进化", tradable = true, description = "火系低阶进化和元素技能材料。" },
                    new MaterialEntry { id = "fire_core", name = "火灵核", quality = "稀有", category = "进化", tradable = false, description = "火系正式进化材料。" },
                    new MaterialEntry { id = "flame_soul", name = "炎魄", quality = "史诗", category = "进化", tradable = false, description = "火系高阶进化和形态突破材料。" }
                }
            };
        }

        public void EnsureValid()
        {
            MaterialConfig defaults = CreateDefault();
            if (materials == null || materials.Length == 0)
            {
                materials = defaults.materials;
                return;
            }

            for (int i = 0; i < materials.Length; i++)
            {
                if (materials[i] == null)
                {
                    materials[i] = defaults.materials[Mathf.Min(i, defaults.materials.Length - 1)];
                }

                materials[i].EnsureValid(defaults.materials[Mathf.Min(i, defaults.materials.Length - 1)]);
            }
        }

        public MaterialEntry GetMaterial(string id)
        {
            if (materials != null)
            {
                for (int i = 0; i < materials.Length; i++)
                {
                    if (materials[i] != null && materials[i].id == id)
                    {
                        return materials[i];
                    }
                }
            }

            MaterialConfig defaults = CreateDefault();
            for (int i = 0; i < defaults.materials.Length; i++)
            {
                if (defaults.materials[i].id == id)
                {
                    return defaults.materials[i];
                }
            }

            return new MaterialEntry { id = id, name = id, quality = "普通", category = "未知", tradable = false, description = "" };
        }
    }

    [Serializable]
    public class MaterialEntry
    {
        public string id;
        public string name;
        public string quality;
        public string category;
        public bool tradable;
        public string description;

        public void EnsureValid(MaterialEntry defaults)
        {
            if (string.IsNullOrEmpty(id)) id = defaults.id;
            if (string.IsNullOrEmpty(name)) name = defaults.name;
            if (string.IsNullOrEmpty(quality)) quality = defaults.quality;
            if (string.IsNullOrEmpty(category)) category = defaults.category;
            if (string.IsNullOrEmpty(description)) description = defaults.description;
        }
    }

    public static class CombatConfigLoader
    {
        private const string ResourcePath = "Data/combat_config";

        public static CombatConfig Load()
        {
            TextAsset asset = Resources.Load<TextAsset>(ResourcePath);
            if (asset == null)
            {
                Debug.LogWarning("Combat config not found. Using built-in defaults.");
                CombatConfig fallback = CombatConfig.CreateDefault();
                fallback.EnsureValid();
                return fallback;
            }

            try
            {
                CombatConfig config = JsonUtility.FromJson<CombatConfig>(asset.text);
                if (config == null)
                {
                    config = CombatConfig.CreateDefault();
                }

                config.EnsureValid();
                return config;
            }
            catch (Exception exception)
            {
                Debug.LogWarning("Combat config parse failed. Using built-in defaults. " + exception.Message);
                CombatConfig fallback = CombatConfig.CreateDefault();
                fallback.EnsureValid();
                return fallback;
            }
        }
    }

    public static class MapDropConfigLoader
    {
        private const string ResourcePath = "Data/map_drop_config";

        public static MapDropConfig Load()
        {
            TextAsset asset = Resources.Load<TextAsset>(ResourcePath);
            if (asset == null)
            {
                Debug.LogWarning("Map drop config not found. Using built-in defaults.");
                MapDropConfig fallback = MapDropConfig.CreateDefault();
                fallback.EnsureValid();
                return fallback;
            }

            try
            {
                MapDropConfig config = JsonUtility.FromJson<MapDropConfig>(asset.text);
                if (config == null)
                {
                    config = MapDropConfig.CreateDefault();
                }

                config.EnsureValid();
                return config;
            }
            catch (Exception exception)
            {
                Debug.LogWarning("Map drop config parse failed. Using built-in defaults. " + exception.Message);
                MapDropConfig fallback = MapDropConfig.CreateDefault();
                fallback.EnsureValid();
                return fallback;
            }
        }
    }

    public static class MaterialConfigLoader
    {
        private const string ResourcePath = "Data/material_config";

        public static MaterialConfig Load()
        {
            TextAsset asset = Resources.Load<TextAsset>(ResourcePath);
            if (asset == null)
            {
                Debug.LogWarning("Material config not found. Using built-in defaults.");
                MaterialConfig fallback = MaterialConfig.CreateDefault();
                fallback.EnsureValid();
                return fallback;
            }

            try
            {
                MaterialConfig config = JsonUtility.FromJson<MaterialConfig>(asset.text);
                if (config == null)
                {
                    config = MaterialConfig.CreateDefault();
                }

                config.EnsureValid();
                return config;
            }
            catch (Exception exception)
            {
                Debug.LogWarning("Material config parse failed. Using built-in defaults. " + exception.Message);
                MaterialConfig fallback = MaterialConfig.CreateDefault();
                fallback.EnsureValid();
                return fallback;
            }
        }
    }
}
