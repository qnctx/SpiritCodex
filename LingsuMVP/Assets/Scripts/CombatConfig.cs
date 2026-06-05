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
}
