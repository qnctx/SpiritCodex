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

        private float _skillOneTimer;
        private float _skillTwoTimer;
        private int _energy;
        private GUIStyle _buttonStyle;
        private GUIStyle _cooldownStyle;
        private GUIStyle _energyStyle;
        private GUIStyle _meterBackgroundStyle;
        private GUIStyle _meterFillStyle;
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
            HandleTargetSelection(ultimateRect, skillOneRect, skillTwoRect);

            DrawEnergyBar();
            DrawUltimateButton(ultimateRect);

            GUI.backgroundColor = _skillOneTimer <= 0f ? new Color(0.18f, 0.42f, 0.74f, 0.95f) : new Color(0.18f, 0.18f, 0.2f, 0.82f);

            string label = _skillOneTimer <= 0f ? "S1" : Mathf.CeilToInt(_skillOneTimer).ToString();
            if (GUI.Button(skillOneRect, label, _buttonStyle) && _skillOneTimer <= 0f)
            {
                CastSkillOne();
            }

            GUI.backgroundColor = _skillTwoTimer <= 0f ? new Color(0.42f, 0.22f, 0.68f, 0.95f) : new Color(0.18f, 0.18f, 0.2f, 0.82f);

            string skillTwoLabel = _skillTwoTimer <= 0f ? "Burn" : Mathf.CeilToInt(_skillTwoTimer).ToString();
            if (GUI.Button(skillTwoRect, skillTwoLabel, _buttonStyle) && _skillTwoTimer <= 0f)
            {
                CastSkillTwo();
            }

            GUI.backgroundColor = Color.white;
        }

        private void CastSkillOne()
        {
            Monster target = battleManager.GetCurrentTarget();
            if (target == null)
            {
                return;
            }

            int damage = battleManager.hero.attack * skillOneDamageMultiplier;
            CombatFeedback.PlayBasicAttack(
                battleManager.hero,
                battleManager.hero.transform,
                target.transform,
                damage,
                new Color(1f, 0.72f, 0.08f, 1f),
                () => target.TakeDamage(damage));

            _skillOneTimer = skillOneCooldown;
            AddEnergy(skillOneEnergyGain);
            Debug.Log($"Hero casts Skill 1 for {damage} damage!");
        }

        private void CastSkillTwo()
        {
            Monster target = battleManager.GetCurrentTarget();
            if (target == null)
            {
                return;
            }

            CombatFeedback.PlayBasicAttack(
                battleManager.hero,
                battleManager.hero.transform,
                target.transform,
                skillTwoInitialDamage,
                new Color(1f, 0.28f, 0.04f, 1f),
                () =>
                {
                    int actualDamage = target.TakeDamage(skillTwoInitialDamage);
                    target.ApplyBurn(skillTwoBurnDamage, skillTwoBurnTicks, skillTwoBurnInterval);
                    return actualDamage;
                });

            _skillTwoTimer = skillTwoCooldown;
            AddEnergy(skillTwoEnergyGain);
            Debug.Log($"Hero casts Skill 2 burn: hit {skillTwoInitialDamage}, burn {skillTwoBurnDamage} x {skillTwoBurnTicks}.");
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
            GUI.backgroundColor = isReady ? new Color(0.9f, 0.58f, 0.12f, 0.98f) : new Color(0.22f, 0.22f, 0.24f, 0.9f);
            int percent = maxEnergy > 0 ? Mathf.FloorToInt((float)_energy / maxEnergy * 100f) : 0;
            string label = isReady ? "Ult" : percent + "%";
            if (GUI.Button(ultimateRect, label, _buttonStyle) && isReady)
            {
                CastUltimate();
            }
        }

        private void DrawEnergyBar()
        {
            Rect barRect = GetEnergyBarRect();
            float ratio = maxEnergy > 0 ? Mathf.Clamp01((float)_energy / maxEnergy) : 0f;

            GUI.backgroundColor = new Color(0.03f, 0.035f, 0.04f, 0.92f);
            GUI.Box(barRect, GUIContent.none, _meterBackgroundStyle);

            Rect fillRect = new Rect(barRect.x + 3f, barRect.y + 3f, Mathf.Max(0f, (barRect.width - 6f) * ratio), barRect.height - 6f);
            GUI.backgroundColor = ratio >= 1f ? new Color(1f, 0.62f, 0.08f, 0.95f) : new Color(0.28f, 0.68f, 0.95f, 0.95f);
            GUI.Box(fillRect, GUIContent.none, _meterFillStyle);

            GUI.backgroundColor = Color.white;
            GUI.Label(barRect, "Energy " + _energy + "/" + maxEnergy, _energyStyle);
        }

        private void CastUltimate()
        {
            int hitCount = 0;
            Color damageColor = new Color(1f, 0.18f, 0.08f, 1f);

            foreach (Monster monster in battleManager.monsters)
            {
                if (monster == null || !monster.IsAlive)
                {
                    continue;
                }

                int actualDamage = monster.TakeRawDamage(ultimateDamage, "ultimate");
                CombatFeedback.ShowDamageNumber(monster.transform, actualDamage, new Vector3(0f, 1.42f, 0f), damageColor);
                hitCount++;
            }

            Monster boss = battleManager.GetActiveBoss();
            if (boss != null)
            {
                int actualDamage = boss.TakeRawDamage(ultimateDamage, "ultimate");
                CombatFeedback.ShowDamageNumber(boss.transform, actualDamage, new Vector3(0f, 1.42f, 0f), damageColor);
                hitCount++;
            }

            if (hitCount > 0)
            {
                _energy = 0;
                Debug.Log($"Hero casts Ultimate for {ultimateDamage} damage on {hitCount} target(s).");
            }
        }

        private void HandleTargetSelection(Rect ultimateRect, Rect skillOneRect, Rect skillTwoRect)
        {
            Event currentEvent = Event.current;
            if (currentEvent == null || currentEvent.type != EventType.MouseDown || currentEvent.button != 0)
            {
                return;
            }

            if (ultimateRect.Contains(currentEvent.mousePosition) || skillOneRect.Contains(currentEvent.mousePosition) || skillTwoRect.Contains(currentEvent.mousePosition))
            {
                return;
            }

            Monster target = FindMonsterAtGuiPosition(currentEvent.mousePosition);
            if (target != null)
            {
                battleManager.SelectMonster(target);
                currentEvent.Use();
            }
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
            float scale = Mathf.Sqrt((Screen.width / 1920f) * (Screen.height / 1080f));
            float width = 138f * scale;
            float height = 76f * scale;
            float x = (Screen.width - width) * 0.5f;
            float centerFromBottom = 62f * scale;
            float y = Screen.height - (centerFromBottom + height * 0.5f);
            return new Rect(x, y, width, height);
        }

        private Rect GetUltimateRect()
        {
            Rect skillOneRect = GetSkillOneRect();
            float scale = Mathf.Sqrt((Screen.width / 1920f) * (Screen.height / 1080f));
            float x = skillOneRect.x - 176f * scale;
            return new Rect(x, skillOneRect.y, skillOneRect.width, skillOneRect.height);
        }

        private Rect GetSkillTwoRect()
        {
            Rect skillOneRect = GetSkillOneRect();
            float scale = Mathf.Sqrt((Screen.width / 1920f) * (Screen.height / 1080f));
            float x = skillOneRect.x + 176f * scale;
            return new Rect(x, skillOneRect.y, skillOneRect.width, skillOneRect.height);
        }

        private Rect GetEnergyBarRect()
        {
            Rect skillOneRect = GetSkillOneRect();
            float scale = Mathf.Sqrt((Screen.width / 1920f) * (Screen.height / 1080f));
            float width = 504f * scale;
            float height = 30f * scale;
            float x = (Screen.width - width) * 0.5f;
            float y = skillOneRect.y - 38f * scale;
            return new Rect(x, y, width, height);
        }

        private void EnsureStyles()
        {
            if (_buttonStyle != null)
            {
                return;
            }

            _buttonStyle = new GUIStyle(GUI.skin.button);
            _buttonStyle.fontSize = Mathf.Max(16, Screen.height / 42);
            _buttonStyle.fontStyle = FontStyle.Bold;
            _buttonStyle.alignment = TextAnchor.MiddleCenter;
            _buttonStyle.padding = new RectOffset(4, 4, 4, 4);
            _buttonStyle.border = new RectOffset(0, 0, 0, 0);
            _buttonStyle.normal.background = GetWhiteTexture();
            _buttonStyle.hover.background = GetWhiteTexture();
            _buttonStyle.active.background = GetWhiteTexture();
            _buttonStyle.normal.textColor = Color.white;
            _buttonStyle.hover.textColor = Color.white;
            _buttonStyle.active.textColor = Color.white;

            _cooldownStyle = new GUIStyle(_buttonStyle);
            _cooldownStyle.normal.textColor = Color.white;

            _energyStyle = new GUIStyle(GUI.skin.label);
            _energyStyle.fontSize = Mathf.Max(13, Screen.height / 58);
            _energyStyle.fontStyle = FontStyle.Bold;
            _energyStyle.alignment = TextAnchor.MiddleCenter;
            _energyStyle.normal.textColor = Color.white;

            _meterBackgroundStyle = new GUIStyle(GUI.skin.box);
            _meterBackgroundStyle.border = new RectOffset(0, 0, 0, 0);
            _meterBackgroundStyle.normal.background = GetWhiteTexture();

            _meterFillStyle = new GUIStyle(_meterBackgroundStyle);
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
