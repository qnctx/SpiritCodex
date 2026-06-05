using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace LingsuMVP
{
    public class GameManager : MonoBehaviour
    {
        public enum GameState
        {
            Playing,
            Victory,
            Defeat,
            Home
        }

        [Header("Game Settings")]
        private GameState _currentState = GameState.Playing;

        [Header("UI References")]
        public GameObject victoryPanel;
        public GameObject defeatPanel;
        public TextMeshProUGUI resultText;
        public TextMeshProUGUI summaryText;
        public TextMeshProUGUI stageText;
        public Button restartButton;
        public Button playAgainButton;

        [Header("Scene References")]
        public BattleManager battleManager;
        public Hero heroPrefab;
        public Monster[] monsterPrefabs;

        private static GameManager _instance;
        private GUIStyle _runtimeButtonStyle;
        private GUIStyle _runtimeTitleStyle;
        private GUIStyle _runtimeInfoStyle;
        private int _stageIndex = 1;
        public static GameManager Instance
        {
            get { return _instance; }
        }

        public GameState CurrentState
        {
            get { return _currentState; }
        }

        private void Awake()
        {
            if (_instance == null)
            {
                _instance = this;
            }
            else if (_instance != this)
            {
                Destroy(gameObject);
            }
        }

        private void Start()
        {
            if (restartButton != null)
            {
                restartButton.onClick.AddListener(RestartGame);
            }
            if (playAgainButton != null)
            {
                playAgainButton.onClick.AddListener(RestartGame);
            }

            HideResultPanels();
            StartGame();
        }

        private void OnGUI()
        {
            if (_currentState == GameState.Playing)
            {
                return;
            }

            EnsureRuntimeGuiStyles();

            if (_currentState == GameState.Home)
            {
                DrawHomeGui();
                return;
            }

            DrawResultGui();

        }

        public void StartGame()
        {
            _currentState = GameState.Playing;
            HideResultPanels();
            UpdateStageText();

            if (battleManager != null)
            {
                battleManager.SetStage(_stageIndex);
                battleManager.ResetBattle();
                battleManager.StartBattle();
            }

            if (DropSystem.Instance != null)
            {
                DropSystem.Instance.ResetAllDrops();
            }
        }

        public void SetGameState(GameState newState)
        {
            if (_currentState != GameState.Playing && newState != GameState.Playing)
            {
                return;
            }

            _currentState = newState;

            switch (newState)
            {
                case GameState.Victory:
                    ShowVictory();
                    break;
                case GameState.Defeat:
                    ShowDefeat();
                    break;
                case GameState.Home:
                    HideResultPanels();
                    break;
                case GameState.Playing:
                    HideResultPanels();
                    break;
            }
        }

        private void ShowVictory()
        {
            HideResultPanels();

            if (victoryPanel != null)
            {
                victoryPanel.SetActive(false);
            }

            if (resultText != null)
            {
                resultText.text = "Victory";
            }
            UpdateSummaryText();

            Debug.Log("Victory! You have defeated all enemies!");
        }

        private void ShowDefeat()
        {
            HideResultPanels();

            if (defeatPanel != null)
            {
                defeatPanel.SetActive(false);
            }

            if (resultText != null)
            {
                resultText.text = "Defeat";
            }
            UpdateSummaryText();

            Debug.Log("Defeat! The hero has fallen...");
        }

        private void UpdateSummaryText()
        {
            string summary = BuildResultSummary();

            SetPanelSummary(victoryPanel, summary);
            SetPanelSummary(defeatPanel, summary);
            if (summaryText != null)
            {
                summaryText.text = summary;
            }
        }

        private string BuildResultSummary()
        {
            DropSystem drops = DropSystem.Instance;
            if (drops == null)
            {
                return $"Stage: {_stageIndex}";
            }

            string materialLabel = _currentState == GameState.Defeat ? "Lost Materials" : "Materials";
            return $"Stage: {_stageIndex}\nKills: {drops.normalKills} + Boss {drops.bossKills}\n{materialLabel}: +{drops.runMaterials}";
        }

        private void SetPanelSummary(GameObject panel, string summary)
        {
            if (panel == null)
            {
                return;
            }

            Transform summaryTransform = panel.transform.Find("SummaryText");
            if (summaryTransform == null)
            {
                return;
            }

            TextMeshProUGUI label = summaryTransform.GetComponent<TextMeshProUGUI>();
            if (label != null)
            {
                label.text = summary;
            }
        }

        private void SetPanelActionButton(GameObject panel, string labelText, UnityEngine.Events.UnityAction action)
        {
            if (panel == null)
            {
                return;
            }

            Transform buttonTransform = panel.transform.Find("ActionButton");
            if (buttonTransform == null)
            {
                return;
            }

            Button button = buttonTransform.GetComponent<Button>();
            if (button != null)
            {
                button.onClick.RemoveAllListeners();
                button.onClick.AddListener(action);
                button.gameObject.SetActive(true);
            }

            Transform labelTransform = buttonTransform.Find("ButtonText");
            if (labelTransform == null)
            {
                return;
            }

            TextMeshProUGUI label = labelTransform.GetComponent<TextMeshProUGUI>();
            if (label != null)
            {
                label.text = labelText;
            }
        }

        private void HideResultPanels()
        {
            if (victoryPanel != null)
            {
                victoryPanel.SetActive(false);
            }

            if (defeatPanel != null)
            {
                defeatPanel.SetActive(false);
            }

            if (summaryText != null)
            {
                summaryText.text = "";
            }

            SetPanelSummary(victoryPanel, "");
            SetPanelSummary(defeatPanel, "");
        }

        public void RestartGame()
        {
            _currentState = GameState.Playing;
            HideResultPanels();
            UpdateStageText();

            // Reset hero
            if (battleManager != null && battleManager.hero != null)
            {
                battleManager.hero.ResetStats();
            }

            // Reset drop system
            if (DropSystem.Instance != null)
            {
                DropSystem.Instance.RollbackRunMaterials();
            }

            // Reset battle manager
            if (battleManager != null)
            {
                battleManager.SetStage(_stageIndex);
                battleManager.ResetBattle();
                battleManager.StartBattle();
            }

            Debug.Log("Game restarted!");
        }

        public void ReturnHome()
        {
            _currentState = GameState.Home;
            HideResultPanels();
            UpdateStageText();

            if (battleManager != null && battleManager.hero != null)
            {
                battleManager.hero.ResetStats();
            }

            if (DropSystem.Instance != null)
            {
                DropSystem.Instance.RollbackRunMaterials();
            }

            if (battleManager != null)
            {
                battleManager.SetStage(_stageIndex);
                battleManager.ResetBattle();
            }

            Debug.Log("Returned home.");
        }

        public void StartNextStage()
        {
            if (DropSystem.Instance != null)
            {
                DropSystem.Instance.CommitStageMaterials();
            }

            _stageIndex++;
            RestartGame();
        }

        private void EnsureRuntimeGuiStyles()
        {
            if (_runtimeButtonStyle == null)
            {
                _runtimeButtonStyle = new GUIStyle(GUI.skin.button);
                _runtimeButtonStyle.fontSize = Mathf.Max(18, Screen.height / 32);
                _runtimeButtonStyle.normal.textColor = Color.white;
                _runtimeButtonStyle.hover.textColor = Color.white;
                _runtimeButtonStyle.active.textColor = Color.white;
            }

            if (_runtimeTitleStyle == null)
            {
                _runtimeTitleStyle = new GUIStyle(GUI.skin.label);
                _runtimeTitleStyle.fontSize = Mathf.Max(24, Screen.height / 24);
                _runtimeTitleStyle.fontStyle = FontStyle.Bold;
                _runtimeTitleStyle.alignment = TextAnchor.MiddleCenter;
                _runtimeTitleStyle.normal.textColor = Color.white;
            }

            if (_runtimeInfoStyle == null)
            {
                _runtimeInfoStyle = new GUIStyle(GUI.skin.label);
                _runtimeInfoStyle.fontSize = Mathf.Max(16, Screen.height / 42);
                _runtimeInfoStyle.alignment = TextAnchor.MiddleCenter;
                _runtimeInfoStyle.normal.textColor = new Color(0.88f, 0.9f, 0.94f, 1f);
            }
        }

        private void DrawHomeGui()
        {
            float panelWidth = Mathf.Min(420f, Screen.width * 0.44f);
            float panelHeight = Mathf.Min(320f, Screen.height * 0.72f);
            panelHeight = Mathf.Max(260f, panelHeight);
            Rect panelRect = new Rect((Screen.width - panelWidth) * 0.5f, Screen.height * 0.12f, panelWidth, panelHeight);

            GUI.backgroundColor = new Color(0f, 0f, 0f, 0.82f);
            GUI.Box(panelRect, GUIContent.none);
            GUI.backgroundColor = Color.white;

            GUI.Label(new Rect(panelRect.x, panelRect.y + 24f, panelRect.width, 54f), "Home", _runtimeTitleStyle);
            GUI.Label(new Rect(panelRect.x, panelRect.y + 92f, panelRect.width, 78f), $"Stage {_stageIndex}\nMaterials: {GetMaterialCount()}", _runtimeInfoStyle);

            float buttonWidth = Mathf.Min(220f, panelRect.width * 0.62f);
            Rect buttonRect = new Rect(panelRect.x + (panelRect.width - buttonWidth) * 0.5f, panelRect.y + panelRect.height - 82f, buttonWidth, 58f);
            GUI.backgroundColor = new Color(0.18f, 0.36f, 0.62f, 0.95f);
            if (GUI.Button(buttonRect, "Enter Battle", _runtimeButtonStyle))
            {
                RestartGame();
            }
            GUI.backgroundColor = Color.white;
        }

        private void DrawResultGui()
        {
            float panelWidth = Mathf.Min(460f, Screen.width * 0.48f);
            float panelHeight = Mathf.Min(300f, Screen.height * 0.68f);
            panelHeight = Mathf.Max(250f, panelHeight);
            Rect panelRect = new Rect((Screen.width - panelWidth) * 0.5f, Screen.height * 0.14f, panelWidth, panelHeight);

            GUI.backgroundColor = new Color(0f, 0f, 0f, 0.84f);
            GUI.Box(panelRect, GUIContent.none);
            GUI.backgroundColor = Color.white;

            string title = _currentState == GameState.Victory ? "Victory" : "Defeat";
            GUI.Label(new Rect(panelRect.x, panelRect.y + 24f, panelRect.width, 54f), title, _runtimeTitleStyle);
            GUI.Label(new Rect(panelRect.x, panelRect.y + 86f, panelRect.width, 100f), BuildResultSummary(), _runtimeInfoStyle);

            string buttonLabel = _currentState == GameState.Victory ? "Next Stage" : "Return Home";
            float buttonWidth = Mathf.Min(240f, panelRect.width * 0.62f);
            Rect buttonRect = new Rect(panelRect.x + (panelRect.width - buttonWidth) * 0.5f, panelRect.y + panelRect.height - 82f, buttonWidth, 58f);

            GUI.backgroundColor = new Color(0.18f, 0.36f, 0.62f, 0.95f);
            if (GUI.Button(buttonRect, buttonLabel, _runtimeButtonStyle))
            {
                if (_currentState == GameState.Victory)
                {
                    StartNextStage();
                }
                else
                {
                    ReturnHome();
                }
            }
            GUI.backgroundColor = Color.white;
        }

        private int GetMaterialCount()
        {
            return DropSystem.Instance != null ? DropSystem.Instance.materialCount : 0;
        }

        private void UpdateStageText()
        {
            if (stageText != null)
            {
                stageText.text = $"Stage {_stageIndex}";
            }
        }
    }
}
