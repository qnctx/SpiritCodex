using UnityEngine;

namespace LingsuMVP
{
    public class SkillController : MonoBehaviour
    {
        public BattleManager battleManager;
        public float skillOneCooldown = 4f;
        public int skillOneDamageMultiplier = 2;
        public float skillTwoCooldown = 5f;
        public int skillTwoInitialDamage = 5;
        public int skillTwoBurnDamage = 5;
        public int skillTwoBurnTicks = 3;
        public float skillTwoBurnInterval = 0.75f;
        public int maxEnergy = 100;
        public int basicAttackEnergyGain = 20;
        public int skillOneEnergyGain = 25;
        public int skillTwoEnergyGain = 25;
        public int ultimateDamage = 18;
        public System.Func<bool> potionProvider;
        public System.Func<int> potionCountProvider;
        public int potionHealAmount = 30;

        private float _skillOneTimer;
        private float _skillTwoTimer;
        private int _energy;
        private GUIStyle _buttonStyle;
        private GUIStyle _cooldownStyle;
        private GUIStyle _energyStyle;
        private GUIStyle _meterBackgroundStyle;
        private GUIStyle _meterFillStyle;
        private GUIStyle _barBackgroundStyle;
        private Font _runtimeGuiFont;
        private static Texture2D _whiteTexture;

        public void Configure(SkillConfig config)
        {
            if (config == null)
            {
                return;
            }

            skillOneCooldown = config.skillOneCooldown;
            skillOneDamageMultiplier = config.skillOneDamageMultiplier;
            skillTwoCooldown = config.skillTwoCooldown;
            skillTwoInitialDamage = config.skillTwoInitialDamage;
            skillTwoBurnDamage = config.skillTwoBurnDamage;
            skillTwoBurnTicks = config.skillTwoBurnTicks;
            skillTwoBurnInterval = config.skillTwoBurnInterval;
            maxEnergy = config.maxEnergy;
            basicAttackEnergyGain = config.basicAttackEnergyGain;
            skillOneEnergyGain = config.skillOneEnergyGain;
            skillTwoEnergyGain = config.skillTwoEnergyGain;
            ultimateDamage = config.ultimateDamage;
            ResetEnergy();
        }

        private void Update()
        {
            if (_skillOneTimer > 0f)
            {
                _skillOneTimer = Mathf.Max(0f, _skillOneTimer - Time.deltaTime);
            }

            if (_skillTwoTimer > 0f)
            {
                _skillTwoTimer = Mathf.Max(0f, _skillTwoTimer - Time.deltaTime);
            }
        }

        private void OnGUI()
        {
            if (battleManager == null || battleManager.hero == null)
            {
                return;
            }

            if (GameManager.Instance != null && GameManager.Instance.CurrentState != GameManager.GameState.Playing)
            {
                return;
            }

            EnsureStyles();

            Rect ultimateRect = GetUltimateRect();
            Rect skillOneRect = GetSkillOneRect();
            Rect skillTwoRect = GetSkillTwoRect();
            Rect potionRect = GetPotionRect();
            HandleTargetSelection(ultimateRect, skillOneRect, skillTwoRect, potionRect);

            DrawSkillBarPanel();
            DrawEnergyBar();
            DrawUltimateButton(ultimateRect);
            DrawPotionButton(potionRect);

            GUI.backgroundColor = _skillOneTimer <= 0f ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);

            string label = _skillOneTimer <= 0f ? GetSelectedSkillOneName() : Mathf.CeilToInt(_skillOneTimer) + "s";
            if (GUI.Button(skillOneRect, label, _buttonStyle) && _skillOneTimer <= 0f)
            {
                CastSkillOne();
            }

            GUI.backgroundColor = _skillTwoTimer <= 0f ? new Color(0.34f, 0.22f, 0.46f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);

            string skillTwoLabel = _skillTwoTimer <= 0f ? GetSelectedSkillTwoName() : Mathf.CeilToInt(_skillTwoTimer) + "s";
            if (GUI.Button(skillTwoRect, skillTwoLabel, _buttonStyle) && _skillTwoTimer <= 0f)
            {
                CastSkillTwo();
            }

            GUI.backgroundColor = Color.white;
        }

        public void SetSkillOneLevel(int level)
        {
            skillOneDamageMultiplier = Mathf.Clamp(level + 1, 2, 4);
        }

        private void CastSkillOne()
        {
            Monster target = battleManager.GetCurrentTarget();
            if (target == null)
            {
                return;
            }

            Transform caster = battleManager.SelectedAllyTransform;
            int damage = GetSelectedSkillOneDamage();
            CombatFeedback.PlayBasicAttack(
                this,
                caster,
                target.transform,
                damage,
                GetSelectedSkillOneColor(),
                () => target.TakeDamage(damage));

            _skillOneTimer = skillOneCooldown;
            AddEnergy(skillOneEnergyGain);
            Debug.Log($"{GetSelectedCharacterName()} casts {GetSelectedSkillOneName()} for {damage} damage!");
        }

        private void CastSkillTwo()
        {
            Monster target = battleManager.GetCurrentTarget();
            if (target == null)
            {
                return;
            }

            Transform caster = battleManager.SelectedAllyTransform;
            int damage = GetSelectedSkillTwoDamage();
            CombatFeedback.PlayBasicAttack(
                this,
                caster,
                target.transform,
                damage,
                GetSelectedSkillTwoColor(),
                () => ApplySelectedSkillTwo(target, damage));

            _skillTwoTimer = skillTwoCooldown;
            AddEnergy(skillTwoEnergyGain);
            Debug.Log($"{GetSelectedCharacterName()} casts {GetSelectedSkillTwoName()} for {damage} damage.");
        }

        private int ApplySelectedSkillTwo(Monster target, int damage)
        {
            if (target == null)
            {
                return 0;
            }

            int actualDamage = target.TakeDamage(damage);
            if (GetSelectedCharacterName() == "主角" || GetSelectedCharacterName().Contains("青木"))
            {
                target.ApplyBurn(skillTwoBurnDamage, skillTwoBurnTicks, skillTwoBurnInterval);
            }

            return actualDamage;
        }

        public void GrantBasicAttackEnergy()
        {
            AddEnergy(basicAttackEnergyGain);
        }

        public void ResetEnergy()
        {
            _energy = 0;
        }

        private void AddEnergy(int amount)
        {
            if (amount <= 0 || maxEnergy <= 0)
            {
                return;
            }

            _energy = Mathf.Clamp(_energy + amount, 0, maxEnergy);
        }

        private void DrawUltimateButton(Rect ultimateRect)
        {
            bool isReady = maxEnergy > 0 && _energy >= maxEnergy;
            GUI.backgroundColor = isReady ? new Color(0.75f, 0.38f, 0.14f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            int percent = maxEnergy > 0 ? Mathf.FloorToInt((float)_energy / maxEnergy * 100f) : 0;
            string label = isReady ? "奥义" : percent + "%";
            if (GUI.Button(ultimateRect, label, _buttonStyle) && isReady)
            {
                CastUltimate();
            }
        }

        private void DrawPotionButton(Rect potionRect)
        {
            bool canUse = potionProvider != null && battleManager != null && battleManager.hero != null && battleManager.hero.hp < battleManager.hero.maxHp;
            int potionCount = potionCountProvider != null ? potionCountProvider() : 0;
            canUse = canUse && potionCount > 0;
            GUI.backgroundColor = canUse ? new Color(0.2f, 0.38f, 0.24f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (GUI.Button(potionRect, $"药水 x{potionCount}", _buttonStyle) && canUse)
            {
                if (potionProvider())
                {
                    int healed = battleManager.hero.Heal(potionHealAmount);
                    CombatFeedback.ShowDamageNumber(battleManager.hero.transform, healed, new Vector3(0f, 1.62f, 0f), new Color(0.22f, 1f, 0.48f, 1f));
                    Debug.Log($"Hero uses Potion and heals {healed} HP.");
                }
            }
        }

        private void DrawEnergyBar()
        {
            Rect barRect = GetEnergyBarRect();
            float ratio = maxEnergy > 0 ? Mathf.Clamp01((float)_energy / maxEnergy) : 0f;

            GUI.backgroundColor = new Color(0.035f, 0.04f, 0.038f, 1f);
            GUI.Box(barRect, GUIContent.none, _meterBackgroundStyle);

            Rect fillRect = new Rect(barRect.x + 3f, barRect.y + 3f, Mathf.Max(0f, (barRect.width - 6f) * ratio), barRect.height - 6f);
            GUI.backgroundColor = ratio >= 1f ? new Color(0.95f, 0.58f, 0.16f, 1f) : new Color(0.55f, 0.78f, 0.86f, 1f);
            GUI.Box(fillRect, GUIContent.none, _meterFillStyle);

            GUI.backgroundColor = Color.white;
            string selectedName = battleManager != null ? battleManager.SelectedAllyName : "主角";
            GUI.Label(barRect, selectedName + "  灵力 " + _energy + "/" + maxEnergy, _energyStyle);
        }

        private void DrawSkillBarPanel()
        {
            Rect panelRect = GetSkillBarPanelRect();
            GUI.backgroundColor = new Color(0.035f, 0.04f, 0.038f, 1f);
            GUI.Box(panelRect, GUIContent.none, _barBackgroundStyle);
        }

        private void CastUltimate()
        {
            int hitCount = 0;
            int damage = GetUltimateDamage();
            Color damageColor = new Color(1f, 0.18f, 0.08f, 1f);

            foreach (Monster monster in battleManager.monsters)
            {
                if (monster == null || !monster.IsAlive)
                {
                    continue;
                }

                int actualDamage = monster.TakeRawDamage(damage, "ultimate");
                CombatFeedback.ShowDamageNumber(monster.transform, actualDamage, new Vector3(0f, 1.42f, 0f), damageColor);
                hitCount++;
            }

            Monster boss = battleManager.GetActiveBoss();
            if (boss != null)
            {
                int actualDamage = boss.TakeRawDamage(damage, "ultimate");
                CombatFeedback.ShowDamageNumber(boss.transform, actualDamage, new Vector3(0f, 1.42f, 0f), damageColor);
                hitCount++;
            }

            if (hitCount > 0)
            {
                _energy = 0;
                Debug.Log($"Hero casts Ultimate for {damage} damage on {hitCount} target(s).");
            }
        }

        private int GetUltimateDamage()
        {
            int heroAttack = battleManager != null && battleManager.hero != null ? battleManager.hero.attack : 0;
            return Mathf.Max(1, ultimateDamage + heroAttack);
        }

        private string GetSelectedCharacterName()
        {
            return battleManager != null && !string.IsNullOrEmpty(battleManager.SelectedAllyName)
                ? battleManager.SelectedAllyName
                : "主角";
        }

        private string GetSelectedSkillOneName()
        {
            string name = GetSelectedCharacterName();
            if (name.Contains("铁甲"))
            {
                return "盾击";
            }

            if (name.Contains("青木"))
            {
                return "青木术";
            }

            if (name.Contains("炼药"))
            {
                return "回春弹";
            }

            return "技能一";
        }

        private string GetSelectedSkillTwoName()
        {
            string name = GetSelectedCharacterName();
            if (name.Contains("铁甲"))
            {
                return "铁壁";
            }

            if (name.Contains("青木"))
            {
                return "缠木";
            }

            if (name.Contains("炼药"))
            {
                return "药雾";
            }

            return "灼烧";
        }

        private int GetSelectedSkillOneDamage()
        {
            string name = GetSelectedCharacterName();
            int attack = battleManager != null ? battleManager.SelectedAllyAttack : 1;
            if (name.Contains("铁甲"))
            {
                return Mathf.Max(1, attack + 4);
            }

            if (name.Contains("青木"))
            {
                return Mathf.Max(1, attack * 2);
            }

            if (name.Contains("炼药"))
            {
                return Mathf.Max(1, attack + 3);
            }

            return Mathf.Max(1, attack * skillOneDamageMultiplier);
        }

        private int GetSelectedSkillTwoDamage()
        {
            string name = GetSelectedCharacterName();
            int attack = battleManager != null ? battleManager.SelectedAllyAttack : 1;
            if (name.Contains("铁甲"))
            {
                return Mathf.Max(1, attack + 2);
            }

            if (name.Contains("青木"))
            {
                return Mathf.Max(1, attack + 5);
            }

            if (name.Contains("炼药"))
            {
                return Mathf.Max(1, attack + 1);
            }

            return skillTwoInitialDamage;
        }

        private Color GetSelectedSkillOneColor()
        {
            string name = GetSelectedCharacterName();
            if (name.Contains("铁甲"))
            {
                return new Color(0.45f, 0.72f, 1f, 1f);
            }

            if (name.Contains("青木"))
            {
                return new Color(0.25f, 0.9f, 0.38f, 1f);
            }

            if (name.Contains("炼药"))
            {
                return new Color(1f, 0.82f, 0.24f, 1f);
            }

            return new Color(1f, 0.72f, 0.08f, 1f);
        }

        private Color GetSelectedSkillTwoColor()
        {
            string name = GetSelectedCharacterName();
            if (name.Contains("铁甲"))
            {
                return new Color(0.25f, 0.45f, 0.95f, 1f);
            }

            if (name.Contains("青木"))
            {
                return new Color(0.18f, 0.72f, 0.28f, 1f);
            }

            if (name.Contains("炼药"))
            {
                return new Color(0.95f, 0.68f, 0.18f, 1f);
            }

            return new Color(1f, 0.28f, 0.04f, 1f);
        }

        private void HandleTargetSelection(Rect ultimateRect, Rect skillOneRect, Rect skillTwoRect, Rect potionRect)
        {
            Event currentEvent = Event.current;
            if (currentEvent == null || currentEvent.type != EventType.MouseDown || currentEvent.button != 0)
            {
                return;
            }

            if (ultimateRect.Contains(currentEvent.mousePosition) || skillOneRect.Contains(currentEvent.mousePosition) || skillTwoRect.Contains(currentEvent.mousePosition) || potionRect.Contains(currentEvent.mousePosition))
            {
                return;
            }

            if (TrySelectAllyAtGuiPosition(currentEvent.mousePosition))
            {
                currentEvent.Use();
                return;
            }

            Monster target = FindMonsterAtGuiPosition(currentEvent.mousePosition);
            if (target != null)
            {
                battleManager.SelectMonster(target);
                currentEvent.Use();
            }
        }

        private bool TrySelectAllyAtGuiPosition(Vector2 guiPosition)
        {
            Camera camera = Camera.main;
            if (camera == null || battleManager == null)
            {
                return false;
            }

            Vector3 screenPosition = new Vector3(guiPosition.x, Screen.height - guiPosition.y, Mathf.Abs(camera.transform.position.z));
            Vector3 worldPosition = camera.ScreenToWorldPoint(screenPosition);
            worldPosition.z = 0f;
            return battleManager.TrySelectAllyAtWorldPosition(worldPosition);
        }

        private Monster FindMonsterAtGuiPosition(Vector2 guiPosition)
        {
            Camera camera = Camera.main;
            if (camera == null || battleManager == null)
            {
                return null;
            }

            Vector3 screenPosition = new Vector3(guiPosition.x, Screen.height - guiPosition.y, -camera.transform.position.z);
            Vector3 worldPosition = camera.ScreenToWorldPoint(screenPosition);
            worldPosition.z = 0f;

            Monster bestTarget = null;
            float bestDistance = 0.75f * 0.75f;
            foreach (Monster monster in battleManager.monsters)
            {
                if (monster == null || !monster.IsAlive)
                {
                    continue;
                }

                SpriteRenderer renderer = monster.GetComponent<SpriteRenderer>();
                if (renderer != null)
                {
                    Bounds bounds = renderer.bounds;
                    bounds.Expand(0.25f);
                    if (bounds.Contains(worldPosition))
                    {
                        return monster;
                    }
                }

                float distance = (monster.transform.position - worldPosition).sqrMagnitude;
                if (distance < bestDistance)
                {
                    bestDistance = distance;
                    bestTarget = monster;
                }
            }

            return bestTarget;
        }

        private Rect GetSkillOneRect()
        {
            float scale = GetSkillUiScale();
            float width = Mathf.Max(96f, 126f * scale);
            float height = Mathf.Max(50f, 60f * scale);
            float x = (Screen.width - width) * 0.5f;
            float centerFromBottom = Mathf.Max(48f, 58f * scale);
            float y = Screen.height - (centerFromBottom + height * 0.5f);
            return new Rect(x, y, width, height);
        }

        private Rect GetUltimateRect()
        {
            Rect skillOneRect = GetSkillOneRect();
            float scale = GetSkillUiScale();
            float x = skillOneRect.x - Mathf.Max(108f, 142f * scale);
            return new Rect(x, skillOneRect.y, skillOneRect.width, skillOneRect.height);
        }

        private Rect GetSkillTwoRect()
        {
            Rect skillOneRect = GetSkillOneRect();
            float scale = GetSkillUiScale();
            float x = skillOneRect.x + Mathf.Max(108f, 142f * scale);
            return new Rect(x, skillOneRect.y, skillOneRect.width, skillOneRect.height);
        }

        private Rect GetPotionRect()
        {
            Rect skillOneRect = GetSkillOneRect();
            float scale = GetSkillUiScale();
            float x = skillOneRect.x + Mathf.Max(216f, 284f * scale);
            return new Rect(x, skillOneRect.y, skillOneRect.width, skillOneRect.height);
        }

        private Rect GetEnergyBarRect()
        {
            Rect skillOneRect = GetSkillOneRect();
            float scale = GetSkillUiScale();
            float width = Mathf.Max(360f, 430f * scale);
            float height = Mathf.Max(26f, 28f * scale);
            float x = (Screen.width - width) * 0.5f;
            float y = skillOneRect.y - Mathf.Max(36f, 42f * scale);
            return new Rect(x, y, width, height);
        }

        private Rect GetSkillBarPanelRect()
        {
            Rect ultimateRect = GetUltimateRect();
            Rect potionRect = GetPotionRect();
            Rect energyRect = GetEnergyBarRect();
            float scale = GetSkillUiScale();
            float padding = Mathf.Max(12f, 14f * scale);
            float x = ultimateRect.x - padding;
            float y = energyRect.y - padding * 0.7f;
            float width = potionRect.xMax - ultimateRect.x + padding * 2f;
            float height = potionRect.yMax - energyRect.y + padding * 1.6f;
            return new Rect(x, y, width, height);
        }

        private float GetSkillUiScale()
        {
            float screenScale = Mathf.Sqrt((Screen.width / 1920f) * (Screen.height / 1080f));
            return Mathf.Clamp(screenScale, 0.72f, 1.1f);
        }

        private void EnsureStyles()
        {
            if (_buttonStyle != null)
            {
                return;
            }

            _buttonStyle = new GUIStyle(GUI.skin.button);
            _buttonStyle.fontSize = Mathf.Max(16, Screen.height / 50);
            _buttonStyle.fontStyle = FontStyle.Bold;
            _buttonStyle.alignment = TextAnchor.MiddleCenter;
            _buttonStyle.padding = new RectOffset(4, 4, 4, 4);
            _buttonStyle.border = new RectOffset(0, 0, 0, 0);
            ApplyRuntimeFont(_buttonStyle);
            _buttonStyle.normal.background = GetWhiteTexture();
            _buttonStyle.hover.background = GetWhiteTexture();
            _buttonStyle.active.background = GetWhiteTexture();
            _buttonStyle.normal.textColor = new Color(0.95f, 0.9f, 0.78f, 1f);
            _buttonStyle.hover.textColor = new Color(1f, 0.94f, 0.78f, 1f);
            _buttonStyle.active.textColor = new Color(1f, 0.88f, 0.56f, 1f);

            _cooldownStyle = new GUIStyle(_buttonStyle);
            _cooldownStyle.normal.textColor = Color.white;

            _energyStyle = new GUIStyle(GUI.skin.label);
            _energyStyle.fontSize = Mathf.Max(14, Screen.height / 58);
            _energyStyle.fontStyle = FontStyle.Bold;
            _energyStyle.alignment = TextAnchor.MiddleCenter;
            ApplyRuntimeFont(_energyStyle);
            _energyStyle.normal.textColor = new Color(0.92f, 0.88f, 0.78f, 1f);

            _meterBackgroundStyle = new GUIStyle(GUI.skin.box);
            _meterBackgroundStyle.border = new RectOffset(0, 0, 0, 0);
            _meterBackgroundStyle.normal.background = GetWhiteTexture();

            _meterFillStyle = new GUIStyle(_meterBackgroundStyle);

            _barBackgroundStyle = new GUIStyle(GUI.skin.box);
            _barBackgroundStyle.border = new RectOffset(0, 0, 0, 0);
            _barBackgroundStyle.normal.background = GetWhiteTexture();
        }

        private void ApplyRuntimeFont(GUIStyle style)
        {
            Font font = GetRuntimeGuiFont();
            if (font != null)
            {
                style.font = font;
            }
        }

        private Font GetRuntimeGuiFont()
        {
            if (_runtimeGuiFont != null)
            {
                return _runtimeGuiFont;
            }

            string[] fontNames = { "Microsoft YaHei UI", "Microsoft YaHei", "SimHei", "Arial Unicode MS", "Arial" };
            for (int i = 0; i < fontNames.Length; i++)
            {
                try
                {
                    _runtimeGuiFont = Font.CreateDynamicFontFromOSFont(fontNames[i], 16);
                    if (_runtimeGuiFont != null)
                    {
                        return _runtimeGuiFont;
                    }
                }
                catch
                {
                    _runtimeGuiFont = null;
                }
            }

            return _runtimeGuiFont;
        }

        private static Texture2D GetWhiteTexture()
        {
            if (_whiteTexture != null)
            {
                return _whiteTexture;
            }

            _whiteTexture = new Texture2D(1, 1, TextureFormat.RGBA32, false);
            _whiteTexture.SetPixel(0, 0, Color.white);
            _whiteTexture.Apply();
            return _whiteTexture;
        }
    }
}
