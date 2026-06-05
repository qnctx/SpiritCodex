using UnityEngine;
using System.Collections.Generic;

namespace LingsuMVP
{
    public class BattleManager : MonoBehaviour
    {
        [Header("References")]
        public Hero hero;
        public List<Monster> monsters = new List<Monster>();
        public SkillController skillController;
        public Monster bossPrefab;
        public Transform bossSpawnPoint;
        public MonsterConfig bossConfig;

        [Header("Attack Intervals")]
        public float heroAttackInterval = 1f;
        public float monsterAttackInterval = 1f;
        public float bossAttackInterval = 0.8f;

        private float _heroTimer = 0f;
        private float _monsterTimer = 0f;
        private float _bossTimer = 0f;
        private Monster _activeBoss;
        private Sprite _runtimeBossSprite;
        private bool _bossSpawned = false;
        private bool _battleActive = false;
        private int _nextMonsterAttackIndex = 0;
        private int _currentStage = 1;
        private UnitHealthBar _activeBossHealthBar;
        private Monster _selectedMonster;

        public Monster SelectedMonster
        {
            get { return _selectedMonster; }
        }

        private void Update()
        {
            if (!_battleActive) return;

            _monsterTimer += Time.deltaTime;
            _heroTimer += Time.deltaTime;

            if (_monsterTimer >= monsterAttackInterval)
            {
                _monsterTimer = 0f;
                TriggerMonsterAttacks();
            }

            if (_heroTimer >= heroAttackInterval)
            {
                _heroTimer = 0f;
                TriggerHeroAttack();
            }

            if (_bossSpawned && _activeBoss != null && _activeBoss.gameObject.activeSelf)
            {
                _bossTimer += Time.deltaTime;
                if (_bossTimer >= bossAttackInterval)
                {
                    _bossTimer = 0f;
                    _activeBoss.Attack(hero);
                }
            }

            if (!_bossSpawned && AreAllMonstersDead())
            {
                SpawnBoss();
            }
        }

        private void TriggerMonsterAttacks()
        {
            if (monsters.Count == 0)
            {
                return;
            }

            for (int i = 0; i < monsters.Count; i++)
            {
                int index = (_nextMonsterAttackIndex + i) % monsters.Count;
                Monster monster = monsters[index];
                if (monster != null && monster.IsAlive)
                {
                    monster.Attack(hero);
                    _nextMonsterAttackIndex = (index + 1) % monsters.Count;
                    return;
                }
            }
        }

        private void TriggerHeroAttack()
        {
            if (hero == null) return;

            Monster target = GetCurrentTarget();
            if (target != null)
            {
                hero.Attack(target);
                if (skillController != null)
                {
                    skillController.GrantBasicAttackEnergy();
                }
                return;
            }

            // If no monsters, attack boss if exists
            if (_activeBoss != null && _activeBoss.gameObject.activeSelf)
            {
                hero.Attack(_activeBoss);
                if (skillController != null)
                {
                    skillController.GrantBasicAttackEnergy();
                }
            }
        }

        public void StartBattle()
        {
            _battleActive = true;
            _heroTimer = 0f;
            _monsterTimer = 0f;
            _bossTimer = 0f;
            _nextMonsterAttackIndex = 0;
        }

        public void SetStage(int stageIndex)
        {
            _currentStage = Mathf.Max(1, stageIndex);
            foreach (Monster monster in monsters)
            {
                if (monster != null)
                {
                    monster.ApplyStageScale(_currentStage);
                }
            }
        }

        public void StopBattle()
        {
            _battleActive = false;
        }

        public Monster GetFirstAliveMonster()
        {
            foreach (Monster monster in monsters)
            {
                if (monster != null && monster.IsAlive)
                {
                    return monster;
                }
            }

            return null;
        }

        public Monster GetCurrentTarget()
        {
            if (_selectedMonster != null && _selectedMonster.IsAlive)
            {
                return _selectedMonster;
            }

            _selectedMonster = GetFirstAliveMonster();
            if (_selectedMonster != null)
            {
                return _selectedMonster;
            }

            return GetActiveBoss();
        }

        public Monster GetActiveBoss()
        {
            if (_activeBoss != null && _activeBoss.IsAlive)
            {
                return _activeBoss;
            }

            return null;
        }

        public void SelectMonster(Monster monster)
        {
            if (monster != null && monster.IsAlive)
            {
                _selectedMonster = monster;
            }
        }

        public void OnMonsterDead(Monster monster, bool isBoss)
        {
            // Trigger drop for every kill
            if (DropSystem.Instance != null)
            {
                Vector3 dropPosition = monster != null ? monster.transform.position : Vector3.zero;
                DropSystem.Instance.OnMonsterDead(isBoss, dropPosition);
            }

            if (isBoss)
            {
                OnBossDead();
                return;
            }

            if (_selectedMonster == monster)
            {
                _selectedMonster = null;
            }

            if (AreAllMonstersDead() && !_bossSpawned)
            {
                SpawnBoss();
            }
        }

        private bool AreAllMonstersDead()
        {
            if (monsters.Count == 0)
            {
                return false;
            }

            foreach (Monster monster in monsters)
            {
                if (monster != null && !monster.IsCleared)
                {
                    return false;
                }
            }

            return true;
        }

        private void SpawnBoss()
        {
            _bossSpawned = true;
            if (bossPrefab != null && bossSpawnPoint != null)
            {
                _activeBoss = Instantiate(bossPrefab, bossSpawnPoint.position, Quaternion.identity);
                _activeBoss.Initialize(this, true);
                _activeBoss.ApplyStageScale(_currentStage);
                Debug.Log("BOSS has appeared!");
                return;
            }

            if (bossConfig != null && bossSpawnPoint != null)
            {
                _activeBoss = CreateRuntimeBoss();
                Debug.Log("Runtime BOSS has appeared!");
                return;
            }

            Debug.LogWarning("Boss config not set. Auto-victory after clearing all monsters.");
            OnBossDead();
        }

        private Monster CreateRuntimeBoss()
        {
            GameObject bossObject = new GameObject(string.IsNullOrEmpty(bossConfig.id) ? "Boss" : bossConfig.id);
            bossObject.transform.position = bossSpawnPoint.position;

            SpriteRenderer renderer = bossObject.AddComponent<SpriteRenderer>();
            renderer.sprite = GetRuntimeBossSprite();
            renderer.color = new Color(1f, 0.22f, 0.2f, 1f);
            renderer.sortingOrder = 9;

            Monster boss = bossObject.AddComponent<Monster>();
            boss.hp = ScaleHpForStage(bossConfig.hp);
            boss.maxHp = boss.hp;
            boss.attack = ScaleAttackForStage(bossConfig.attack);
            boss.defense = bossConfig.defense;

            FitSpriteHeight(bossObject.transform, renderer, bossConfig.spriteHeight);
            boss.Initialize(this, true);
            _activeBossHealthBar = CreateBossHealthBar(bossObject.transform, boss);
            return boss;
        }

        private int ScaleHpForStage(int baseHp)
        {
            float scale = 1f + (_currentStage - 1) * 0.25f;
            return Mathf.Max(1, Mathf.RoundToInt(baseHp * scale));
        }

        private int ScaleAttackForStage(int baseAttack)
        {
            float scale = 1f + (_currentStage - 1) * 0.15f;
            return Mathf.Max(1, Mathf.RoundToInt(baseAttack * scale));
        }

        private Sprite GetRuntimeBossSprite()
        {
            if (_runtimeBossSprite != null)
            {
                return _runtimeBossSprite;
            }

            foreach (Monster monster in monsters)
            {
                if (monster == null)
                {
                    continue;
                }

                SpriteRenderer renderer = monster.GetComponent<SpriteRenderer>();
                if (renderer != null && renderer.sprite != null)
                {
                    _runtimeBossSprite = renderer.sprite;
                    return _runtimeBossSprite;
                }
            }

            return null;
        }

        private static void FitSpriteHeight(Transform transform, SpriteRenderer renderer, float targetHeight)
        {
            if (renderer == null || renderer.sprite == null || renderer.sprite.bounds.size.y <= 0f || targetHeight <= 0f)
            {
                return;
            }

            float scale = targetHeight / renderer.sprite.bounds.size.y;
            transform.localScale = new Vector3(scale, scale, 1f);
        }

        private static UnitHealthBar CreateBossHealthBar(Transform target, Monster boss)
        {
            GameObject barObject = new GameObject("BossHealthBar");
            UnitHealthBar healthBar = barObject.AddComponent<UnitHealthBar>();
            healthBar.target = target;
            healthBar.monster = boss;
            healthBar.worldOffset = new Vector3(0f, 0.92f, 0f);
            healthBar.width = 1.05f;
            healthBar.fillColor = new Color(0.95f, 0.15f, 0.12f, 1f);
            return healthBar;
        }

        public void OnHeroDead()
        {
            if (_bossSpawned && _activeBoss != null && !_activeBoss.IsAlive)
            {
                StopBattle();
                return;
            }

            StopBattle();
            GameManager gameManager = GameManager.Instance != null ? GameManager.Instance : FindObjectOfType<GameManager>();
            if (gameManager != null)
            {
                gameManager.SetGameState(GameManager.GameState.Defeat);
            }
        }

        public void OnBossDead()
        {
            StopBattle();
            GameManager gameManager = GameManager.Instance != null ? GameManager.Instance : FindObjectOfType<GameManager>();
            if (gameManager != null)
            {
                gameManager.SetGameState(GameManager.GameState.Victory);
            }
        }

        public void ResetBattle()
        {
            _battleActive = false;
            _bossSpawned = false;
            _heroTimer = 0f;
            _monsterTimer = 0f;
            _bossTimer = 0f;
            _nextMonsterAttackIndex = 0;
            _selectedMonster = null;

            if (skillController != null)
            {
                skillController.ResetEnergy();
            }

            // Reset all monsters
            foreach (Monster monster in monsters)
            {
                if (monster != null)
                {
                    monster.ResetMonster();
                }
            }

            if (_activeBoss != null)
            {
                Destroy(_activeBoss.gameObject);
                _activeBoss = null;
            }

            if (_activeBossHealthBar != null)
            {
                Destroy(_activeBossHealthBar.gameObject);
                _activeBossHealthBar = null;
            }
        }

        public void InitializeHero(Hero heroRef)
        {
            hero = heroRef;
            hero.Initialize(this);
        }

        public void AddMonster(Monster monster)
        {
            if (!monsters.Contains(monster))
            {
                monsters.Add(monster);
                monster.Initialize(this, false);
            }
        }
    }
}
