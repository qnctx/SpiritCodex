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
            Defeat
        }

        [Header("Game Settings")]
        private GameState _currentState = GameState.Playing;

        [Header("UI References")]
        public GameObject victoryPanel;
        public GameObject defeatPanel;
        public TextMeshProUGUI resultText;
        public Button restartButton;
        public Button playAgainButton;

        [Header("Scene References")]
        public BattleManager battleManager;
        public Hero heroPrefab;
        public Monster[] monsterPrefabs;

        private static GameManager _instance;
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

        public void StartGame()
        {
            _currentState = GameState.Playing;
            HideResultPanels();

            if (battleManager != null)
            {
                battleManager.ResetBattle();
                battleManager.StartBattle();
            }

            if (DropSystem.Instance != null)
            {
                DropSystem.Instance.ResetDrops();
            }
        }

        public void SetGameState(GameState newState)
        {
            _currentState = newState;

            switch (newState)
            {
                case GameState.Victory:
                    ShowVictory();
                    break;
                case GameState.Defeat:
                    ShowDefeat();
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
                victoryPanel.SetActive(true);
            }

            if (resultText != null)
            {
                resultText.text = "通关！";
            }

            Debug.Log("Victory! You have defeated all enemies!");
        }

        private void ShowDefeat()
        {
            HideResultPanels();

            if (defeatPanel != null)
            {
                defeatPanel.SetActive(true);
            }

            if (resultText != null)
            {
                resultText.text = "挑战失败";
            }

            Debug.Log("Defeat! The hero has fallen...");
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
        }

        public void RestartGame()
        {
            _currentState = GameState.Playing;
            HideResultPanels();

            // Reset hero
            if (battleManager != null && battleManager.hero != null)
            {
                battleManager.hero.ResetStats();
            }

            // Reset drop system
            if (DropSystem.Instance != null)
            {
                DropSystem.Instance.ResetDrops();
            }

            // Reset battle manager
            if (battleManager != null)
            {
                battleManager.ResetBattle();
                battleManager.StartBattle();
            }

            Debug.Log("Game restarted!");
        }
    }
}