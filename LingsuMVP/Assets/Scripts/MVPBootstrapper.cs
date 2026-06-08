using TMPro;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace LingsuMVP
{
    public static class MVPBootstrapper
    {
        private static Material uiMaterial;
        private static Sprite uiSprite;
        private static Sprite arenaSprite;
        private static Sprite ellipseSprite;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            if (Object.FindObjectOfType<GameManager>() != null)
            {
                return;
            }

            CombatConfig config = CombatConfigLoader.Load();
            Camera camera = EnsureCamera();
            CreateLight();
            CreateArenaBackdrop();
            Canvas canvas = CreateCanvas(camera);
            EnsureEventSystem();

            TextMeshProUGUI materialText = CreateText("MaterialCountText", canvas.transform, new Vector2(24f, -24f), new Vector2(320f, 52f), "材料：0", 26f, TextAlignmentOptions.Left);
            TextMeshProUGUI stageText = CreateText("StageText", canvas.transform, new Vector2(0f, -24f), new Vector2(260f, 52f), "城镇", 26f, TextAlignmentOptions.Center);
            stageText.rectTransform.anchorMin = new Vector2(0.5f, 1f);
            stageText.rectTransform.anchorMax = new Vector2(0.5f, 1f);
            stageText.rectTransform.pivot = new Vector2(0.5f, 1f);
            Button evolutionButton = CreateButton("EvolutionButton", canvas.transform, new Vector2(0f, 46f), new Vector2(180f, 56f), "进化", out TextMeshProUGUI buttonText);
            TextMeshProUGUI statusText = CreateText("EvolutionStatusText", canvas.transform, new Vector2(0f, 24f), new Vector2(320f, 44f), "需要 3 材料", 22f, TextAlignmentOptions.Center);
            GameObject victoryPanel = CreateResultPanel(canvas.transform, "VictoryPanel", "胜利", "再次挑战", out Button playAgainButton);
            GameObject defeatPanel = CreateResultPanel(canvas.transform, "DefeatPanel", "失败", "重新挑战", out Button restartButton);
            playAgainButton.gameObject.SetActive(false);
            restartButton.gameObject.SetActive(false);
            TextMeshProUGUI resultText = victoryPanel.transform.Find("ResultText").GetComponent<TextMeshProUGUI>();
            TextMeshProUGUI summaryText = victoryPanel.transform.Find("SummaryText").GetComponent<TextMeshProUGUI>();

            Hero hero = CreateHero(config.hero);
            Monster[] monsters = new Monster[config.monsters.Length];
            for (int i = 0; i < config.monsters.Length; i++)
            {
                monsters[i] = CreateMonster(config.monsters[i]);
            }
            Transform bossSpawnPoint = CreateEmpty("BossSpawnPoint", new Vector3(config.boss.positionX, config.boss.positionY, 0f)).transform;

            GameObject managerObject = CreateEmpty("GameManager", Vector3.zero);
            GameManager gameManager = managerObject.AddComponent<GameManager>();
            DropSystem dropSystem = managerObject.AddComponent<DropSystem>();
            EvolutionUI evolutionUI = managerObject.AddComponent<EvolutionUI>();
            BattleManager battleManager = managerObject.AddComponent<BattleManager>();
            SkillController skillController = managerObject.AddComponent<SkillController>();
            TargetSelectionMarker targetMarker = managerObject.AddComponent<TargetSelectionMarker>();

            gameManager.victoryPanel = victoryPanel;
            gameManager.defeatPanel = defeatPanel;
            gameManager.resultText = resultText;
            gameManager.summaryText = summaryText;
            gameManager.stageText = stageText;
            gameManager.restartButton = restartButton;
            gameManager.playAgainButton = playAgainButton;
            gameManager.battleManager = battleManager;

            dropSystem.materialCountText = materialText;
            dropSystem.Configure(config.drops);

            evolutionUI.evolutionButton = evolutionButton;
            evolutionUI.buttonText = buttonText;
            evolutionUI.statusText = statusText;
            evolutionButton.gameObject.SetActive(false);
            statusText.gameObject.SetActive(false);
            evolutionUI.enabled = false;

            battleManager.bossSpawnPoint = bossSpawnPoint;
            battleManager.bossConfig = config.boss;
            battleManager.skillController = skillController;
            battleManager.heroAttackInterval = config.battle.heroAttackInterval;
            battleManager.monsterAttackInterval = config.battle.monsterAttackInterval;
            battleManager.bossAttackInterval = config.battle.bossAttackInterval;
            skillController.battleManager = battleManager;
            skillController.Configure(config.skills);
            targetMarker.battleManager = battleManager;
            battleManager.InitializeHero(hero);
            foreach (Monster monster in monsters)
            {
                battleManager.AddMonster(monster);
            }
        }

        private static Camera EnsureCamera()
        {
            Camera camera = Camera.main;
            if (camera == null)
            {
                GameObject cameraObject = new GameObject("Main Camera");
                cameraObject.tag = "MainCamera";
                camera = cameraObject.AddComponent<Camera>();
            }

            camera.transform.position = new Vector3(0f, 0f, -10f);
            camera.orthographic = true;
            camera.orthographicSize = 5f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.12f, 0.13f, 0.15f);
            return camera;
        }

        private static void CreateLight()
        {
            GameObject lightObject = new GameObject("Directional Light");
            lightObject.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
            Light light = lightObject.AddComponent<Light>();
            light.type = LightType.Directional;
            light.intensity = 1.2f;
        }

        private static void CreateArenaBackdrop()
        {
            GameObject root = CreateEmpty("ArenaBackdrop", Vector3.zero);
            CreateSpritePanel("PaintedArena", root.transform, new Vector3(0f, -0.08f, 3f), new Vector3(2.08f, 2.08f, 1f), GetArenaSprite(), Color.white, -20);
            CreateSpritePanel("PlayerGroundShadowTop", root.transform, new Vector3(-3.2f, 1.35f, 2.6f), new Vector3(2.8f, 0.36f, 1f), GetEllipseSprite(), new Color(0f, 0f, 0f, 0.18f), -16);
            CreateSpritePanel("PlayerGroundShadowMiddle", root.transform, new Vector3(-3.2f, 0.25f, 2.6f), new Vector3(2.8f, 0.36f, 1f), GetEllipseSprite(), new Color(0f, 0f, 0f, 0.24f), -16);
            CreateSpritePanel("PlayerGroundShadowBottom", root.transform, new Vector3(-3.2f, -0.85f, 2.6f), new Vector3(2.8f, 0.36f, 1f), GetEllipseSprite(), new Color(0f, 0f, 0f, 0.24f), -16);
            CreateSpritePanel("EnemyGroundShadowTop", root.transform, new Vector3(3.2f, 1.35f, 2.6f), new Vector3(2.8f, 0.36f, 1f), GetEllipseSprite(), new Color(0f, 0f, 0f, 0.16f), -16);
            CreateSpritePanel("EnemyGroundShadowMiddle", root.transform, new Vector3(3.2f, 0.25f, 2.6f), new Vector3(2.8f, 0.36f, 1f), GetEllipseSprite(), new Color(0f, 0f, 0f, 0.22f), -16);
            CreateSpritePanel("EnemyGroundShadowBottom", root.transform, new Vector3(3.2f, -0.85f, 2.6f), new Vector3(2.8f, 0.36f, 1f), GetEllipseSprite(), new Color(0f, 0f, 0f, 0.22f), -16);
        }

        private static void CreateSpritePanel(string name, Transform parent, Vector3 position, Vector3 scale, Sprite sprite, Color color, int sortingOrder)
        {
            GameObject panel = new GameObject(name);
            panel.transform.SetParent(parent, false);
            panel.transform.position = position;
            panel.transform.localScale = scale;

            SpriteRenderer renderer = panel.AddComponent<SpriteRenderer>();
            renderer.sprite = sprite;
            renderer.color = color;
            renderer.sortingOrder = sortingOrder;
        }

        private static Canvas CreateCanvas(Camera camera)
        {
            GameObject canvasObject = new GameObject("Canvas");
            Canvas canvas = canvasObject.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            CanvasScaler scaler = canvasObject.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.matchWidthOrHeight = 0.5f;

            canvasObject.AddComponent<GraphicRaycaster>();
            return canvas;
        }

        private static void EnsureEventSystem()
        {
            EventSystem[] eventSystems = Object.FindObjectsOfType<EventSystem>();
            EventSystem activeEventSystem = eventSystems.Length > 0 ? eventSystems[0] : null;

            for (int i = 1; i < eventSystems.Length; i++)
            {
                Object.Destroy(eventSystems[i].gameObject);
            }

            if (activeEventSystem == null)
            {
                GameObject eventSystemObject = new GameObject("EventSystem");
                activeEventSystem = eventSystemObject.AddComponent<EventSystem>();
            }

            foreach (BaseInputModule inputModule in activeEventSystem.GetComponents<BaseInputModule>())
            {
                Object.Destroy(inputModule);
            }
        }

        private static Hero CreateHero(HeroConfig config)
        {
            GameObject heroObject = new GameObject("Hero");
            heroObject.name = "Hero";
            heroObject.transform.position = new Vector3(config.positionX, config.positionY, 0f);
            SpriteRenderer renderer = heroObject.AddComponent<SpriteRenderer>();
            renderer.sprite = LoadOrCreateSprite("Art/Hero", new Color(0.18f, 0.72f, 1f), SpriteShape.Hero);
            ApplySpriteQuality(renderer.sprite);
            renderer.sortingOrder = 10;
            FitSpriteHeight(heroObject.transform, renderer, config.spriteHeight);
            Hero hero = heroObject.AddComponent<Hero>();
            hero.hp = config.hp;
            hero.maxHp = config.hp;
            hero.attack = config.attack;
            hero.defense = config.defense;
            CreateHealthBar("HeroHealthBar", heroObject.transform, hero, null, new Vector3(0f, 1.45f, 0f), 1f, new Color(0.15f, 0.9f, 0.32f, 1f));
            return hero;
        }

        private static Monster CreateMonster(MonsterConfig config)
        {
            string name = string.IsNullOrEmpty(config.id) ? "Monster" : config.id;
            GameObject monsterObject = new GameObject(name);
            monsterObject.name = name;
            monsterObject.transform.position = new Vector3(config.positionX, config.positionY, 0f);
            SpriteRenderer renderer = monsterObject.AddComponent<SpriteRenderer>();
            renderer.sprite = LoadOrCreateSprite("Art/Monster", new Color(1f, 0.32f, 0.42f), SpriteShape.Monster);
            ApplySpriteQuality(renderer.sprite);
            renderer.sortingOrder = 8;
            FitSpriteHeight(monsterObject.transform, renderer, config.spriteHeight);
            Monster monster = monsterObject.AddComponent<Monster>();
            monster.hp = config.hp;
            monster.maxHp = config.hp;
            monster.attack = config.attack;
            monster.defense = config.defense;
            CreateHealthBar(name + "HealthBar", monsterObject.transform, null, monster, new Vector3(0f, 0.72f, 0f), 0.72f, new Color(0.95f, 0.22f, 0.18f, 1f));
            return monster;
        }

        private static void CreateHealthBar(string name, Transform target, Hero hero, Monster monster, Vector3 offset, float width, Color fillColor)
        {
            GameObject barObject = new GameObject(name);
            UnitHealthBar healthBar = barObject.AddComponent<UnitHealthBar>();
            healthBar.target = target;
            healthBar.hero = hero;
            healthBar.monster = monster;
            healthBar.worldOffset = offset;
            healthBar.width = width;
            healthBar.fillColor = fillColor;
        }

        private static void FitSpriteHeight(Transform transform, SpriteRenderer renderer, float targetHeight)
        {
            if (renderer.sprite == null || renderer.sprite.bounds.size.y <= 0f)
            {
                transform.localScale = Vector3.one;
                return;
            }

            float scale = targetHeight / renderer.sprite.bounds.size.y;
            transform.localScale = new Vector3(scale, scale, 1f);
        }

        private enum SpriteShape
        {
            Hero,
            Monster
        }

        private static Sprite LoadOrCreateSprite(string resourcePath, Color color, SpriteShape shape)
        {
            Sprite sprite = Resources.Load<Sprite>(resourcePath);
            if (sprite != null)
            {
                return sprite;
            }

            Texture2D texture = new Texture2D(64, 64, TextureFormat.RGBA32, false);
            texture.filterMode = FilterMode.Point;
            Color clear = new Color(0f, 0f, 0f, 0f);

            for (int y = 0; y < texture.height; y++)
            {
                for (int x = 0; x < texture.width; x++)
                {
                    texture.SetPixel(x, y, clear);
                }
            }

            for (int y = 6; y < 58; y++)
            {
                for (int x = 6; x < 58; x++)
                {
                    if (shape == SpriteShape.Hero)
                    {
                        float dx = (x - 31.5f) / 26f;
                        float dy = (y - 31.5f) / 26f;
                        if (dx * dx + dy * dy <= 1f)
                        {
                            texture.SetPixel(x, y, color);
                        }
                    }
                    else
                    {
                        int distance = Mathf.Abs(x - 32) + Mathf.Abs(y - 32);
                        if (distance < 34)
                        {
                            texture.SetPixel(x, y, color);
                        }
                    }
                }
            }

            texture.Apply();
            return Sprite.Create(texture, new Rect(0, 0, texture.width, texture.height), new Vector2(0.5f, 0.5f), 64f);
        }

        private static void ApplySpriteQuality(Sprite sprite)
        {
            if (sprite == null || sprite.texture == null)
            {
                return;
            }

            sprite.texture.filterMode = FilterMode.Bilinear;
            sprite.texture.anisoLevel = 1;
        }

        private static GameObject CreateEmpty(string name, Vector3 position)
        {
            GameObject gameObject = new GameObject(name);
            gameObject.transform.position = position;
            return gameObject;
        }

        private static TextMeshProUGUI CreateText(string name, Transform parent, Vector2 anchoredPosition, Vector2 size, string text, float fontSize, TextAlignmentOptions alignment)
        {
            GameObject textObject = new GameObject(name);
            textObject.transform.SetParent(parent, false);

            RectTransform rectTransform = textObject.AddComponent<RectTransform>();
            rectTransform.anchorMin = new Vector2(0f, 1f);
            rectTransform.anchorMax = new Vector2(0f, 1f);
            rectTransform.pivot = new Vector2(0f, 1f);
            rectTransform.anchoredPosition = anchoredPosition;
            rectTransform.sizeDelta = size;

            TextMeshProUGUI label = textObject.AddComponent<TextMeshProUGUI>();
            label.text = text;
            label.fontSize = fontSize;
            label.alignment = alignment;
            label.color = new Color(0.82f, 0.82f, 0.76f, 1f);
            return label;
        }

        private static void CreateSkillBar(Transform parent)
        {
            GameObject barObject = new GameObject("SkillBar");
            barObject.transform.SetParent(parent, false);

            RectTransform barRect = barObject.AddComponent<RectTransform>();
            barRect.anchorMin = new Vector2(0.5f, 0f);
            barRect.anchorMax = new Vector2(0.5f, 0f);
            barRect.pivot = new Vector2(0.5f, 0f);
            barRect.anchoredPosition = new Vector2(0f, 10f);
            barRect.sizeDelta = new Vector2(736f, 108f);

            Image background = barObject.AddComponent<Image>();
            ConfigureImage(background, new Color(0f, 0f, 0f, 0.36f));

            CreateSkillSlot(barObject.transform, "Ult", new Vector2(-176f, 54f), new Color(0.82f, 0.32f, 0.14f, 0.95f));
            CreateSkillSlot(barObject.transform, "S1", new Vector2(0f, 54f), new Color(0.18f, 0.42f, 0.74f, 0.95f));
            CreateSkillSlot(barObject.transform, "Burn", new Vector2(176f, 54f), new Color(0.42f, 0.22f, 0.68f, 0.95f));
            CreateSkillSlot(barObject.transform, "Potion", new Vector2(352f, 54f), new Color(0.22f, 0.52f, 0.36f, 0.95f));
        }

        private static void CreateSkillSlot(Transform parent, string labelText, Vector2 anchoredPosition, Color color)
        {
            GameObject slotObject = new GameObject(labelText.Replace(" ", "") + "Button");
            slotObject.transform.SetParent(parent, false);

            RectTransform slotRect = slotObject.AddComponent<RectTransform>();
            slotRect.anchorMin = new Vector2(0.5f, 0f);
            slotRect.anchorMax = new Vector2(0.5f, 0f);
            slotRect.pivot = new Vector2(0.5f, 0.5f);
            slotRect.anchoredPosition = anchoredPosition;
            slotRect.sizeDelta = new Vector2(138f, 76f);

            Image slotImage = slotObject.AddComponent<Image>();
            ConfigureImage(slotImage, color);

            TextMeshProUGUI label = CreateCenteredText("Label", slotObject.transform, labelText, 24f);
            label.rectTransform.sizeDelta = new Vector2(128f, 42f);
            label.raycastTarget = false;
        }

        private static Button CreateButton(string name, Transform parent, Vector2 anchoredPosition, Vector2 size, string text, out TextMeshProUGUI label)
        {
            GameObject buttonObject = new GameObject(name);
            buttonObject.transform.SetParent(parent, false);

            RectTransform rectTransform = buttonObject.AddComponent<RectTransform>();
            rectTransform.anchorMin = new Vector2(0.5f, 0f);
            rectTransform.anchorMax = new Vector2(0.5f, 0f);
            rectTransform.pivot = new Vector2(0.5f, 0.5f);
            rectTransform.anchoredPosition = anchoredPosition;
            rectTransform.sizeDelta = size;

            Image image = buttonObject.AddComponent<Image>();
            ConfigureImage(image, new Color(0.18f, 0.36f, 0.62f, 0.95f));

            Button button = buttonObject.AddComponent<Button>();
            button.targetGraphic = image;

            label = CreateCenteredText("ButtonText", buttonObject.transform, text, 26f);
            return button;
        }

        private static GameObject CreateResultPanel(Transform parent, string name, string message, string buttonLabel, out Button button)
        {
            GameObject panel = new GameObject(name);
            panel.transform.SetParent(parent, false);

            RectTransform rectTransform = panel.AddComponent<RectTransform>();
            rectTransform.anchorMin = new Vector2(0.5f, 0.5f);
            rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            rectTransform.pivot = new Vector2(0.5f, 0.5f);
            rectTransform.anchoredPosition = new Vector2(0f, 230f);
            rectTransform.sizeDelta = new Vector2(460f, 238f);

            Image image = panel.AddComponent<Image>();
            ConfigureImage(image, new Color(0f, 0f, 0f, 0.78f));

            TextMeshProUGUI resultText = CreateCenteredText("ResultText", panel.transform, message, 38f);
            resultText.rectTransform.anchoredPosition = new Vector2(0f, 76f);
            resultText.rectTransform.sizeDelta = new Vector2(390f, 56f);

            TextMeshProUGUI summaryText = CreateCenteredText("SummaryText", panel.transform, "", 21f);
            summaryText.rectTransform.anchoredPosition = new Vector2(0f, 12f);
            summaryText.rectTransform.sizeDelta = new Vector2(390f, 92f);

            button = CreateButton("ActionButton", panel.transform, new Vector2(0f, -78f), new Vector2(260f, 58f), buttonLabel, out TextMeshProUGUI actionLabel);
            actionLabel.rectTransform.sizeDelta = new Vector2(250f, 46f);
            panel.SetActive(false);
            return panel;
        }

        private static TextMeshProUGUI CreateCenteredText(string name, Transform parent, string text, float fontSize)
        {
            GameObject textObject = new GameObject(name);
            textObject.transform.SetParent(parent, false);

            RectTransform rectTransform = textObject.AddComponent<RectTransform>();
            rectTransform.anchorMin = new Vector2(0.5f, 0.5f);
            rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            rectTransform.pivot = new Vector2(0.5f, 0.5f);
            rectTransform.anchoredPosition = Vector2.zero;
            rectTransform.sizeDelta = new Vector2(180f, 48f);

            TextMeshProUGUI label = textObject.AddComponent<TextMeshProUGUI>();
            label.text = text;
            label.fontSize = fontSize;
            label.alignment = TextAlignmentOptions.Center;
            label.color = Color.white;
            return label;
        }

        private static void ConfigureImage(Image image, Color color)
        {
            image.sprite = GetUiSprite();
            image.color = color;

            Material material = GetUiMaterial();
            if (material != null)
            {
                image.material = material;
            }
        }

        private static Sprite GetUiSprite()
        {
            if (uiSprite != null)
            {
                return uiSprite;
            }

            Texture2D texture = new Texture2D(1, 1, TextureFormat.RGBA32, false);
            texture.SetPixel(0, 0, Color.white);
            texture.Apply();
            uiSprite = Sprite.Create(texture, new Rect(0f, 0f, 1f, 1f), new Vector2(0.5f, 0.5f), 1f);
            return uiSprite;
        }

        private static Sprite GetArenaSprite()
        {
            if (arenaSprite != null)
            {
                return arenaSprite;
            }

            int width = 512;
            int height = 320;
            Texture2D texture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            texture.filterMode = FilterMode.Bilinear;

            for (int y = 0; y < height; y++)
            {
                float v = (float)y / (height - 1);
                for (int x = 0; x < width; x++)
                {
                    float u = (float)x / (width - 1);
                    Color color;

                    if (v > 0.5f)
                    {
                        float skyT = Mathf.InverseLerp(0.5f, 1f, v);
                        Color lowSky = new Color(0.16f, 0.17f, 0.2f, 1f);
                        Color highSky = new Color(0.07f, 0.08f, 0.1f, 1f);
                        color = Color.Lerp(lowSky, highSky, skyT);
                    }
                    else
                    {
                        float floorT = Mathf.InverseLerp(0f, 0.5f, v);
                        Color nearFloor = new Color(0.1f, 0.13f, 0.11f, 1f);
                        Color farFloor = new Color(0.22f, 0.12f, 0.15f, 1f);
                        color = Color.Lerp(nearFloor, farFloor, floorT);
                    }

                    float dx = (u - 0.5f) * 2f;
                    float dy = (v - 0.48f) * 2.2f;
                    float glow = Mathf.Clamp01(1f - Mathf.Sqrt(dx * dx + dy * dy));
                    color = Color.Lerp(color, new Color(0.34f, 0.22f, 0.15f, 1f), glow * 0.26f);

                    float horizon = Mathf.Abs(v - 0.5f);
                    if (horizon < 0.012f)
                    {
                        color = Color.Lerp(color, new Color(0.78f, 0.4f, 0.16f, 1f), 0.58f);
                    }

                    if (v < 0.5f)
                    {
                        float lane = Mathf.Abs(v - 0.34f);
                        if (lane < 0.008f && u > 0.12f && u < 0.88f)
                        {
                            color = Color.Lerp(color, new Color(0.86f, 0.48f, 0.18f, 1f), 0.34f);
                        }

                        float vignette = Mathf.Clamp01(Mathf.Abs(u - 0.5f) * 1.25f + Mathf.Abs(v - 0.35f) * 0.35f);
                        color = Color.Lerp(color, Color.black, vignette * 0.18f);
                    }

                    texture.SetPixel(x, y, color);
                }
            }

            texture.Apply();
            arenaSprite = Sprite.Create(texture, new Rect(0f, 0f, width, height), new Vector2(0.5f, 0.5f), 100f);
            return arenaSprite;
        }

        private static Sprite GetEllipseSprite()
        {
            if (ellipseSprite != null)
            {
                return ellipseSprite;
            }

            int width = 128;
            int height = 64;
            Texture2D texture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            texture.filterMode = FilterMode.Bilinear;

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    float dx = (x - (width - 1) * 0.5f) / ((width - 1) * 0.5f);
                    float dy = (y - (height - 1) * 0.5f) / ((height - 1) * 0.5f);
                    float distance = dx * dx + dy * dy;
                    float alpha = Mathf.Clamp01(1f - distance);
                    alpha *= alpha;
                    texture.SetPixel(x, y, new Color(1f, 1f, 1f, alpha));
                }
            }

            texture.Apply();
            ellipseSprite = Sprite.Create(texture, new Rect(0f, 0f, width, height), new Vector2(0.5f, 0.5f), 100f);
            return ellipseSprite;
        }

        private static Material GetUiMaterial()
        {
            if (uiMaterial != null)
            {
                return uiMaterial;
            }

            Shader shader = Shader.Find("UI/Default");
            if (shader == null)
            {
                shader = Shader.Find("Sprites/Default");
            }

            if (shader == null)
            {
                return null;
            }

            uiMaterial = new Material(shader);
            uiMaterial.name = "Runtime UI Material";
            return uiMaterial;
        }
    }
}
