using LingsuMVP;
using TMPro;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace LingsuMVP.Editor
{
    public static class MVPSceneBuilder
    {
        private const string ScenePath = "Assets/Scenes/GameScene.unity";

        [MenuItem("LingsuMVP/Rebuild MVP Scene")]
        public static void RebuildScene()
        {
            Scene scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            Camera camera = CreateCamera();
            CreateLight();
            Canvas canvas = CreateCanvas(camera);
            CreateEventSystem();

            TextMeshProUGUI materialText = CreateText("MaterialCountText", canvas.transform, new Vector2(24, -24), new Vector2(260, 48), "材料数量：×0", 28, TextAlignmentOptions.Left);
            Button evolutionButton = CreateButton("EvolutionButton", canvas.transform, new Vector2(0, 76), new Vector2(180, 56), "进化", out TextMeshProUGUI buttonText);
            TextMeshProUGUI statusText = CreateText("EvolutionStatusText", canvas.transform, new Vector2(0, 24), new Vector2(260, 40), "需要3个材料", 24, TextAlignmentOptions.Center);
            GameObject victoryPanel = CreateResultPanel(canvas.transform, "VictoryPanel", "通关！", "再来一次", out Button playAgainButton, false);
            GameObject defeatPanel = CreateResultPanel(canvas.transform, "DefeatPanel", "挑战失败", "重来", out Button restartButton, false);
            TextMeshProUGUI resultText = victoryPanel.transform.Find("ResultText").GetComponent<TextMeshProUGUI>();

            Hero hero = CreateHero();
            Monster monster1 = CreateMonster("Monster1", new Vector3(-2.5f, 0f, 0f));
            Monster monster2 = CreateMonster("Monster2", new Vector3(0f, 0f, 0f));
            Monster monster3 = CreateMonster("Monster3", new Vector3(2.5f, 0f, 0f));
            Transform bossSpawnPoint = CreateEmpty("BossSpawnPoint", new Vector3(0f, 2f, 0f)).transform;

            GameObject managerObject = CreateEmpty("GameManager", Vector3.zero);
            GameManager gameManager = managerObject.AddComponent<GameManager>();
            DropSystem dropSystem = managerObject.AddComponent<DropSystem>();
            EvolutionUI evolutionUI = managerObject.AddComponent<EvolutionUI>();
            BattleManager battleManager = managerObject.AddComponent<BattleManager>();

            gameManager.victoryPanel = victoryPanel;
            gameManager.defeatPanel = defeatPanel;
            gameManager.resultText = resultText;
            gameManager.restartButton = restartButton;
            gameManager.playAgainButton = playAgainButton;
            gameManager.battleManager = battleManager;

            dropSystem.materialCountText = materialText;

            evolutionUI.evolutionButton = evolutionButton;
            evolutionUI.buttonText = buttonText;
            evolutionUI.statusText = statusText;

            battleManager.hero = hero;
            battleManager.monsters.Add(monster1);
            battleManager.monsters.Add(monster2);
            battleManager.monsters.Add(monster3);
            battleManager.bossSpawnPoint = bossSpawnPoint;

            EditorSceneManager.SaveScene(scene, ScenePath);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
        }

        private static Camera CreateCamera()
        {
            GameObject cameraObject = new GameObject("Main Camera");
            cameraObject.tag = "MainCamera";
            cameraObject.transform.position = new Vector3(0f, 0f, -10f);

            Camera camera = cameraObject.AddComponent<Camera>();
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
            lightObject.AddComponent<Light>().type = LightType.Directional;
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

        private static void CreateEventSystem()
        {
            GameObject eventSystem = new GameObject("EventSystem");
            eventSystem.AddComponent<EventSystem>();
            System.Type inputSystemModuleType = System.Type.GetType("UnityEngine.InputSystem.UI.InputSystemUIInputModule, Unity.InputSystem");
            if (inputSystemModuleType != null)
            {
                eventSystem.AddComponent(inputSystemModuleType);
            }
            else
            {
                eventSystem.AddComponent<StandaloneInputModule>();
            }
        }

        private static Hero CreateHero()
        {
            GameObject heroObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
            heroObject.name = "Hero";
            heroObject.transform.position = new Vector3(0f, -2.2f, 0f);
            heroObject.transform.localScale = new Vector3(1.2f, 1.2f, 1.2f);
            heroObject.GetComponent<Renderer>().sharedMaterial = CreateMaterial("HeroMaterial", new Color(0.2f, 0.55f, 1f));
            return heroObject.AddComponent<Hero>();
        }

        private static Monster CreateMonster(string name, Vector3 position)
        {
            GameObject monsterObject = GameObject.CreatePrimitive(PrimitiveType.Cube);
            monsterObject.name = name;
            monsterObject.transform.position = position;
            monsterObject.GetComponent<Renderer>().sharedMaterial = CreateMaterial(name + "Material", new Color(0.95f, 0.28f, 0.28f));
            return monsterObject.AddComponent<Monster>();
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
            label.color = Color.white;
            return label;
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
            image.color = new Color(0.25f, 0.55f, 0.9f);
            Button button = buttonObject.AddComponent<Button>();
            button.targetGraphic = image;

            label = CreateCenteredText("ButtonText", buttonObject.transform, text, 26f);
            return button;
        }

        private static GameObject CreateResultPanel(Transform parent, string name, string message, string buttonLabel, out Button button, bool active)
        {
            GameObject panel = new GameObject(name);
            panel.transform.SetParent(parent, false);

            RectTransform rectTransform = panel.AddComponent<RectTransform>();
            rectTransform.anchorMin = new Vector2(0.5f, 0.5f);
            rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            rectTransform.pivot = new Vector2(0.5f, 0.5f);
            rectTransform.anchoredPosition = Vector2.zero;
            rectTransform.sizeDelta = new Vector2(420f, 240f);

            Image image = panel.AddComponent<Image>();
            image.color = new Color(0f, 0f, 0f, 0.78f);

            TextMeshProUGUI resultText = CreateCenteredText("ResultText", panel.transform, message, 38f);
            resultText.rectTransform.anchoredPosition = new Vector2(0f, 42f);
            resultText.rectTransform.sizeDelta = new Vector2(360f, 64f);

            button = CreateButton("ActionButton", panel.transform, new Vector2(0f, -62f), new Vector2(180f, 54f), buttonLabel, out _);
            panel.SetActive(active);
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

        private static Material CreateMaterial(string name, Color color)
        {
            Material material = new Material(Shader.Find("Standard"));
            material.name = name;
            material.color = color;
            return material;
        }
    }
}
