using UnityEngine;
using System.Collections.Generic;
using TMPro;

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
        private readonly List<GameObject> _allyFormationVisuals = new List<GameObject>();
        private readonly List<AllyCombatant> _allies = new List<AllyCombatant>();
        private bool _battleVisualsVisible = true;
        private string _selectedAllyName = "主角";

        private class AllyCombatant
        {
            public string name;
            public Transform transform;
            public SpriteRenderer renderer;
            public int attack;
            public float interval;
            public float timer;
        }

        public Monster SelectedMonster
        {
            get { return _selectedMonster; }
        }

        public string SelectedAllyName
        {
            get { return _selectedAllyName; }
        }

        public bool IsHeroSelected
        {
            get { return _selectedAllyName == "主角"; }
        }

        public Transform SelectedAllyTransform
        {
            get
            {
                if (IsHeroSelected || string.IsNullOrEmpty(_selectedAllyName))
                {
                    return hero != null ? hero.transform : null;
                }

                AllyCombatant ally = GetAllyCombatant(_selectedAllyName);
                return ally != null ? ally.transform : hero != null ? hero.transform : null;
            }
        }

        public int SelectedAllyAttack
        {
            get
            {
                if (IsHeroSelected || string.IsNullOrEmpty(_selectedAllyName))
                {
                    return hero != null ? hero.attack : 1;
                }

                AllyCombatant ally = GetAllyCombatant(_selectedAllyName);
                return ally != null ? ally.attack : 1;
            }
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

            TriggerAllyAttacks();

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

        private void TriggerAllyAttacks()
        {
            if (_allies.Count == 0)
            {
                return;
            }

            for (int i = 0; i < _allies.Count; i++)
            {
                AllyCombatant ally = _allies[i];
                if (ally == null || ally.transform == null)
                {
                    continue;
                }

                ally.timer += Time.deltaTime;
                if (ally.timer < ally.interval)
                {
                    continue;
                }

                ally.timer = 0f;
                Monster target = GetCurrentTarget();
                if (target == null)
                {
                    target = GetActiveBoss();
                }

                if (target == null)
                {
                    continue;
                }

                int damage = Mathf.Max(1, ally.attack);
                CombatFeedback.PlayBasicAttack(
                    this,
                    ally.transform,
                    target.transform,
                    damage,
                    new Color(0.35f, 0.75f, 1f, 1f),
                    () => target.TakeDamage(damage));
                Debug.Log($"{ally.name} attacks for {damage} damage.");
            }
        }

        private AllyCombatant GetAllyCombatant(string allyName)
        {
            for (int i = 0; i < _allies.Count; i++)
            {
                AllyCombatant ally = _allies[i];
                if (ally != null && ally.name == allyName)
                {
                    return ally;
                }
            }

            return null;
        }

        public void StartBattle()
        {
            ApplyMonsterFormationPositions();
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

        public void SetBattleVisualsVisible(bool visible)
        {
            _battleVisualsVisible = visible;
            if (hero != null)
            {
                hero.gameObject.SetActive(visible);
            }

            foreach (Monster monster in monsters)
            {
                if (monster != null)
                {
                    monster.gameObject.SetActive(visible);
                }
            }

            if (_activeBoss != null)
            {
                _activeBoss.gameObject.SetActive(visible);
            }

            foreach (GameObject visual in _allyFormationVisuals)
            {
                if (visual != null)
                {
                    visual.SetActive(visible);
                }
            }
        }

        public void ApplyFormationLayout(string[] recruitNames, Color[] recruitColors, int[] recruitAttacks, int heroSlotIndex)
        {
            if (hero != null)
            {
                hero.transform.position = GetPlayerFormationPosition(heroSlotIndex);
            }

            ClearAllyFormationVisuals();
            _allies.Clear();
            if (recruitNames != null)
            {
                int count = Mathf.Min(9, recruitNames.Length);
                for (int i = 0; i < count; i++)
                {
                    if (i == heroSlotIndex || string.IsNullOrEmpty(recruitNames[i]))
                    {
                        continue;
                    }

                    Color color = recruitColors != null && i < recruitColors.Length ? recruitColors[i] : new Color(0.32f, 0.58f, 0.82f, 1f);
                    int attack = recruitAttacks != null && i < recruitAttacks.Length ? recruitAttacks[i] : GetAllyAttack(recruitNames[i]);
                    CreateAllyFormationVisual(recruitNames[i], GetPlayerFormationPosition(i), color, attack);
                }
            }

            ApplyMonsterFormationPositions();
            SetBattleVisualsVisible(_battleVisualsVisible);
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

        public void SelectAlly(string allyName)
        {
            _selectedAllyName = string.IsNullOrEmpty(allyName) ? "主角" : allyName;
            RefreshAllySelectionVisuals();
            Debug.Log("Selected ally: " + _selectedAllyName);
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
                bossSpawnPoint.position = GetMonsterFormationPosition(4);
                _activeBoss = Instantiate(bossPrefab, bossSpawnPoint.position, Quaternion.identity);
                _activeBoss.Initialize(this, true);
                _activeBoss.ApplyStageScale(_currentStage);
                Debug.Log("BOSS has appeared!");
                return;
            }

            if (bossConfig != null && bossSpawnPoint != null)
            {
                bossSpawnPoint.position = GetMonsterFormationPosition(4);
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

            foreach (AllyCombatant ally in _allies)
            {
                if (ally != null)
                {
                    ally.timer = 0f;
                }
            }

            _selectedAllyName = "主角";
            SetBattleVisualsVisible(_battleVisualsVisible);
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

        private void ApplyMonsterFormationPositions()
        {
            for (int i = 0; i < monsters.Count; i++)
            {
                Monster monster = monsters[i];
                if (monster != null)
                {
                    monster.transform.position = GetMonsterFormationPosition(i);
                }
            }

            if (bossSpawnPoint != null)
            {
                bossSpawnPoint.position = GetMonsterFormationPosition(4);
            }
        }

        private static Vector3 GetPlayerFormationPosition(int slotIndex)
        {
            int row = Mathf.Clamp(slotIndex / 3, 0, 2);
            int col = Mathf.Clamp(slotIndex % 3, 0, 2);
            return new Vector3(-4.35f + col * 1.15f, 1.35f - row * 1.1f, 0f);
        }

        private static Vector3 GetMonsterFormationPosition(int slotIndex)
        {
            int safeIndex = Mathf.Clamp(slotIndex, 0, 8);
            int row = Mathf.Clamp(safeIndex / 3, 0, 2);
            int col = Mathf.Clamp(safeIndex % 3, 0, 2);
            return new Vector3(2.05f + col * 1.15f, 1.35f - row * 1.1f, 0f);
        }

        private void CreateAllyFormationVisual(string recruitName, Vector3 position, Color color, int attack)
        {
            GameObject visual = new GameObject("Ally_" + recruitName);
            visual.transform.position = position;

            SpriteRenderer renderer = visual.AddComponent<SpriteRenderer>();
            renderer.sprite = CreateAllySprite(recruitName, color);
            renderer.color = Color.white;
            renderer.sortingOrder = 11;
            visual.transform.localScale = new Vector3(1.15f, 1.15f, 1f);

            GameObject labelObject = new GameObject("Name");
            labelObject.transform.SetParent(visual.transform, false);
            labelObject.transform.localPosition = new Vector3(0f, 1.12f, 0f);
            TextMeshPro label = labelObject.AddComponent<TextMeshPro>();
            label.text = recruitName;
            label.fontSize = 2.2f;
            label.alignment = TextAlignmentOptions.Center;
            label.color = Color.white;
            label.enableWordWrapping = false;
            label.outlineWidth = 0.18f;
            label.outlineColor = Color.black;
            MeshRenderer labelRenderer = labelObject.GetComponent<MeshRenderer>();
            if (labelRenderer != null)
            {
                labelRenderer.sortingOrder = 14;
            }

            _allyFormationVisuals.Add(visual);
            _allies.Add(new AllyCombatant
            {
                name = recruitName,
                transform = visual.transform,
                renderer = renderer,
                attack = Mathf.Max(1, attack),
                interval = GetAllyAttackInterval(recruitName),
                timer = 0f
            });
            RefreshAllySelectionVisuals();
        }

        private void RefreshAllySelectionVisuals()
        {
            for (int i = 0; i < _allies.Count; i++)
            {
                AllyCombatant ally = _allies[i];
                if (ally == null || ally.renderer == null)
                {
                    continue;
                }

                ally.renderer.color = ally.name == _selectedAllyName
                    ? new Color(1.15f, 1.15f, 1.15f, 1f)
                    : Color.white;
                ally.transform.localScale = ally.name == _selectedAllyName
                    ? new Vector3(1.28f, 1.28f, 1f)
                    : new Vector3(1.15f, 1.15f, 1f);
            }
        }

        public bool TrySelectAllyAtWorldPosition(Vector3 worldPosition)
        {
            float bestDistance = 0.45f;
            AllyCombatant bestAlly = null;
            for (int i = 0; i < _allies.Count; i++)
            {
                AllyCombatant ally = _allies[i];
                if (ally == null || ally.transform == null)
                {
                    continue;
                }

                float distance = Vector2.Distance(new Vector2(worldPosition.x, worldPosition.y), new Vector2(ally.transform.position.x, ally.transform.position.y));
                if (distance <= bestDistance)
                {
                    bestDistance = distance;
                    bestAlly = ally;
                }
            }

            if (bestAlly == null && hero != null)
            {
                float heroDistance = Vector2.Distance(new Vector2(worldPosition.x, worldPosition.y), new Vector2(hero.transform.position.x, hero.transform.position.y));
                if (heroDistance <= 0.65f)
                {
                    SelectAlly("主角");
                    return true;
                }
            }

            if (bestAlly == null)
            {
                return false;
            }

            SelectAlly(bestAlly.name);
            return true;
        }

        private static int GetAllyAttack(string recruitName)
        {
            if (recruitName.Contains("铁甲"))
            {
                return 5;
            }

            if (recruitName.Contains("青木"))
            {
                return 7;
            }

            if (recruitName.Contains("炼药"))
            {
                return 4;
            }

            return 5;
        }

        private static float GetAllyAttackInterval(string recruitName)
        {
            if (recruitName.Contains("铁甲"))
            {
                return 1.35f;
            }

            if (recruitName.Contains("青木"))
            {
                return 1.15f;
            }

            if (recruitName.Contains("炼药"))
            {
                return 1.45f;
            }

            return 1.3f;
        }

        private static Sprite CreateAllySprite(string recruitName, Color bodyColor)
        {
            const int size = 96;
            Texture2D texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
            Color clear = new Color(0f, 0f, 0f, 0f);
            Color dark = new Color(0.06f, 0.075f, 0.08f, 1f);
            Color highlight = Color.Lerp(bodyColor, Color.white, 0.28f);
            Color accent = GetAllyAccentColor(recruitName);
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    texture.SetPixel(x, y, clear);
                }
            }

            FillCircle(texture, 48, 70, 11, highlight);
            FillRect(texture, 35, 43, 26, 24, bodyColor);
            FillRect(texture, 25, 48, 12, 9, bodyColor);
            FillRect(texture, 59, 48, 12, 9, bodyColor);
            FillRect(texture, 36, 24, 9, 22, dark);
            FillRect(texture, 51, 24, 9, 22, dark);
            FillRect(texture, 31, 38, 34, 7, accent);

            if (recruitName.Contains("铁甲"))
            {
                FillShield(texture, 60, 34, accent);
                FillRect(texture, 39, 50, 18, 16, dark);
            }
            else if (recruitName.Contains("青木"))
            {
                FillRect(texture, 66, 36, 5, 34, accent);
                FillCircle(texture, 68, 73, 7, accent);
            }
            else if (recruitName.Contains("炼药"))
            {
                FillCircle(texture, 67, 38, 8, accent);
                FillRect(texture, 64, 30, 7, 10, accent);
            }

            texture.Apply();
            texture.filterMode = FilterMode.Bilinear;
            return Sprite.Create(texture, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), size);
        }

        private static Color GetAllyAccentColor(string recruitName)
        {
            if (recruitName.Contains("铁甲"))
            {
                return new Color(0.25f, 0.5f, 0.85f, 1f);
            }

            if (recruitName.Contains("青木"))
            {
                return new Color(0.2f, 0.85f, 0.42f, 1f);
            }

            if (recruitName.Contains("炼药"))
            {
                return new Color(1f, 0.78f, 0.22f, 1f);
            }

            return new Color(0.75f, 0.9f, 1f, 1f);
        }

        private static void FillRect(Texture2D texture, int xMin, int yMin, int width, int height, Color color)
        {
            for (int y = yMin; y < yMin + height; y++)
            {
                for (int x = xMin; x < xMin + width; x++)
                {
                    SetPixelSafe(texture, x, y, color);
                }
            }
        }

        private static void FillCircle(Texture2D texture, int centerX, int centerY, int radius, Color color)
        {
            int radiusSquared = radius * radius;
            for (int y = centerY - radius; y <= centerY + radius; y++)
            {
                for (int x = centerX - radius; x <= centerX + radius; x++)
                {
                    int dx = x - centerX;
                    int dy = y - centerY;
                    if (dx * dx + dy * dy <= radiusSquared)
                    {
                        SetPixelSafe(texture, x, y, color);
                    }
                }
            }
        }

        private static void FillShield(Texture2D texture, int centerX, int centerY, Color color)
        {
            for (int y = 0; y < 28; y++)
            {
                int halfWidth = Mathf.Max(3, 15 - y / 2);
                for (int x = centerX - halfWidth; x <= centerX + halfWidth; x++)
                {
                    SetPixelSafe(texture, x, centerY + y, color);
                }
            }
        }

        private static void SetPixelSafe(Texture2D texture, int x, int y, Color color)
        {
            if (x >= 0 && x < texture.width && y >= 0 && y < texture.height)
            {
                texture.SetPixel(x, y, color);
            }
        }

        private void ClearAllyFormationVisuals()
        {
            for (int i = 0; i < _allyFormationVisuals.Count; i++)
            {
                if (_allyFormationVisuals[i] != null)
                {
                    Destroy(_allyFormationVisuals[i]);
                }
            }

            _allyFormationVisuals.Clear();
            _allies.Clear();
        }
    }
}
