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
            Home,
            Codex
        }

        [Header("Game Settings")]
        private GameState _currentState = GameState.Home;
        private enum TownPanel
        {
            None,
            Shop,
            Blacksmith,
            Evolution,
            Alchemy,
            Training,
            Character,
            Equipment,
            Inventory,
            Recruit,
            TaskBoard
        }

        private enum EquipmentSlot
        {
            Weapon,
            Helmet,
            Armor,
            Gloves,
            Boots,
            Accessory
        }

        private enum BlacksmithTab
        {
            Craft,
            Enhance
        }

        private enum CodexTaskTab
        {
            Main,
            Side
        }

        private enum CharacterTab
        {
            Stats,
            Formation,
            Roster
        }

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
        private GUIStyle _runtimePanelInfoStyle;
        private GUIStyle _runtimeSmallStyle;
        private GUIStyle _runtimeBuildingTitleStyle;
        private GUIStyle _runtimeDisabledButtonStyle;
        private GUIStyle _runtimeMapButtonStyle;
        private GUIStyle _runtimeHudStyle;
        private Font _runtimeGuiFont;
        private const string SavePrefix = "LingsuMVP.Progress.";
        private const string SaveVersionKey = SavePrefix + "Version";
        private const int CurrentSaveVersion = 1;
        private const string PremiumCurrencyName = "仙玉";
        private const string RecruitTokenName = "招贤令";
        private const int FormationSlotCount = 9;
        private const int HeroFormationSlot = 3;
        private MapDropConfig _mapDropConfig;
        private MaterialConfig _materialConfig;
        private static Texture2D _runtimeWhiteTexture;
        private int _runtimeStyleScreenWidth;
        private int _runtimeStyleScreenHeight;
        private int _stageIndex = 1;
        private int _selectedMapIndex = 1;
        private int _unlockedMapIndex = 1;
        private int _completedMapIndex = 0;
        private int _sweepAttempts = 3;
        private int _sweepPurchaseCount = 0;
        private string _sweepPurchaseDate = "";
        private int _heroLevel = 1;
        private int _heroExp = 0;
        private int _pendingVictoryExp = 0;
        private int _potionCount = 0;
        private int _skillOneLevel = 1;
        private int _bodyPillLevel = 0;
        private int _evolutionStage = 0;
        private int _premiumCurrencyCount = 9999;
        private int _recruitTokenCount = 0;
        private string _lastRecruitResultText = "暂无";
        private int _selectedShopCategoryIndex = 0;
        private int _selectedShopItemIndex = -1;
        private int _shopBuyQuantity = 1;
        private string _shopBuyQuantityInput = "1";
        private int _shopPageIndex = 0;
        private int _townPageIndex = 0;
        private int _selectedCraftRecipeIndex = 0;
        private bool _hasSelectedCraftRecipe = false;
        private bool _hasSweptOnce = false;
        private bool[] _mainTaskRewardClaimed = { false, false, false };
        private bool[] _sideTaskRewardClaimed = { false };
        private CodexTaskTab _selectedCodexTaskTab = CodexTaskTab.Main;
        private CharacterTab _selectedCharacterTab = CharacterTab.Stats;
        private int _selectedCharacterStatIndex = -1;
        private int _selectedInventoryCategoryIndex = 0;
        private int _selectedInventorySlotIndex = 0;
        private int _selectedEquipmentIndex = -1;
        private EquipmentSlot _selectedEquipmentSlot = EquipmentSlot.Weapon;
        private int _selectedRecruitRosterIndex = -1;
        private int _selectedFormationSlotIndex = -1;
        private int _teamRecruitSlot2Index = -1;
        private int _teamRecruitSlot3Index = -1;
        private int[] _formationRecruitSlots;
        private bool _hasSelectedEquipmentSlot = false;
        private bool _showEquipmentBag = false;
        private bool _showTownModal = false;
        private bool _showRetreatConfirm = false;
        private bool _showDismantleConfirm = false;
        private string _townModalTitle = "";
        private string _townModalMessage = "";
        private bool _progressLoaded = false;
        private bool[] _equipmentOwned;
        private int[] _equipmentEnhanceLevels;
        private bool[] _recruitOwned;
        private int[] _recruitFragments;
        private int[] _recruitRanks;
        private EquipmentSlot _selectedBlacksmithSlot = EquipmentSlot.Weapon;
        private bool _hasSelectedBlacksmithSlot = false;
        private BlacksmithTab _selectedBlacksmithTab = BlacksmithTab.Enhance;
        private readonly string[] _shopCategories =
        {
            "消耗",
            "炼丹",
            "锻造",
            "进化",
            "招募"
        };
        private readonly ShopItem[] _shopItems =
        {
            new ShopItem("小回血药", "消耗", "potion_small", 3, 0, 0, 0, 1, 0, "战斗中回复 30 生命"),
            new ShopItem("赤草", "炼丹", "red_herb", 2, 0, 1, 0, 0, 0, "基础炼丹材料"),
            new ShopItem("铁砂", "锻造", "iron_sand", 3, 0, 0, 1, 0, 0, "基础锻造材料"),
            new ShopItem("招贤令", "招募", "recruit_token", 0, 1, 0, 0, 0, 1, "招贤阁招募消耗道具。当前测试版可用仙玉直接购买。")
        };
        private readonly InventorySlot[] _inventorySlots =
        {
            new InventorySlot("spirit_dust", "通用", 0),
            new InventorySlot("red_herb", "炼丹", 1),
            new InventorySlot("iron_sand", "炼器", 1),
            new InventorySlot("potion_small", "成品丹药", 0),
            new InventorySlot("recruit_token", "招募", 0)
        };
        private readonly string[] _inventoryCategories =
        {
            "全部",
            "炼丹",
            "炼器",
            "成品丹药",
            "招募",
            "进化"
        };
        private readonly EquipmentItem[] _equipmentInventory =
        {
            new EquipmentItem("训练长弓", 1, "普通", EquipmentSlot.Weapon, "Ranger", 3, 0, 0),
            new EquipmentItem("粗布帽", 1, "普通", EquipmentSlot.Helmet, "All", 0, 5, 1),
            new EquipmentItem("灰革甲", 1, "普通", EquipmentSlot.Armor, "All", 0, 10, 1),
            new EquipmentItem("皮护手", 1, "普通", EquipmentSlot.Gloves, "Ranger", 1, 0, 0),
            new EquipmentItem("猎人短靴", 1, "普通", EquipmentSlot.Boots, "All", 0, 0, 1),
            new EquipmentItem("余烬戒指", 1, "稀有", EquipmentSlot.Accessory, "All", 1, 0, 0),
            new EquipmentItem("猎焰长弓", 3, "稀有", EquipmentSlot.Weapon, "Ranger", 6, 0, 0),
            new EquipmentItem("赤纹护手", 3, "稀有", EquipmentSlot.Gloves, "Ranger", 3, 0, 0),
            new EquipmentItem("守护重甲", 3, "稀有", EquipmentSlot.Armor, "Guardian", 0, 25, 4),
            new EquipmentItem("烬火长弓", 3, "稀有", EquipmentSlot.Weapon, "Ranger", 7, 0, 0),
            new EquipmentItem("炼火护手", 3, "稀有", EquipmentSlot.Gloves, "Ranger", 4, 0, 0),
            new EquipmentItem("药炉护符", 2, "稀有", EquipmentSlot.Accessory, "All", 0, 10, 1)
        };
        private readonly CraftRecipe[] _craftRecipes =
        {
            new CraftRecipe(9, 10, 6, "稳定输出武器，适合游侠前期过渡。"),
            new CraftRecipe(10, 8, 5, "提升普攻与技能伤害的手部装备。"),
            new CraftRecipe(11, 6, 4, "偏生存的通用饰品，适合开荒。")
        };
        private readonly RecruitCandidate[] _recruitCandidates =
        {
            new RecruitCandidate("青木术士", "普通", "法师", "中排", 5),
            new RecruitCandidate("铁甲卫", "普通", "守卫", "前排", 5),
            new RecruitCandidate("炼药童子", "稀有", "辅助", "后排", 10)
        };
        private EquipmentItem _equippedWeapon;
        private EquipmentItem _equippedHelmet;
        private EquipmentItem _equippedArmor;
        private EquipmentItem _equippedGloves;
        private EquipmentItem _equippedBoots;
        private EquipmentItem _equippedAccessory;
        private string _codexNotice = "通关地图后可以扫荡。";
        private string _townNotice = "选择灵素图谱开始挑战。";
        private TownPanel _activeTownPanel = TownPanel.None;
        private struct EquipmentItem
        {
            public string name;
            public int levelRequirement;
            public string quality;
            public EquipmentSlot slot;
            public string requiredClass;
            public int attackBonus;
            public int hpBonus;
            public int defenseBonus;

            public EquipmentItem(string name, int levelRequirement, string quality, EquipmentSlot slot, string requiredClass, int attackBonus, int hpBonus, int defenseBonus)
            {
                this.name = name;
                this.levelRequirement = levelRequirement;
                this.quality = quality;
                this.slot = slot;
                this.requiredClass = requiredClass;
                this.attackBonus = attackBonus;
                this.hpBonus = hpBonus;
                this.defenseBonus = defenseBonus;
            }
        }
        private struct ShopItem
        {
            public string name;
            public string category;
            public string materialId;
            public int dustCost;
            public int jadeCost;
            public int herbGain;
            public int oreGain;
            public int potionGain;
            public int recruitTokenGain;
            public string description;

            public ShopItem(string name, string category, string materialId, int dustCost, int jadeCost, int herbGain, int oreGain, int potionGain, int recruitTokenGain, string description)
            {
                this.name = name;
                this.category = category;
                this.materialId = materialId;
                this.dustCost = dustCost;
                this.jadeCost = jadeCost;
                this.herbGain = herbGain;
                this.oreGain = oreGain;
                this.potionGain = potionGain;
                this.recruitTokenGain = recruitTokenGain;
                this.description = description;
            }
        }

        private struct InventorySlot
        {
            public string materialId;
            public string category;
            public int sellPrice;

            public InventorySlot(string materialId, string category, int sellPrice)
            {
                this.materialId = materialId;
                this.category = category;
                this.sellPrice = sellPrice;
            }
        }

        private struct CraftRecipe
        {
            public int equipmentIndex;
            public int dustCost;
            public int oreCost;
            public string description;

            public CraftRecipe(int equipmentIndex, int dustCost, int oreCost, string description)
            {
                this.equipmentIndex = equipmentIndex;
                this.dustCost = dustCost;
                this.oreCost = oreCost;
                this.description = description;
            }
        }

        private struct RecruitCandidate
        {
            public string name;
            public string rarity;
            public string role;
            public string position;
            public int duplicateFragments;

            public RecruitCandidate(string name, string rarity, string role, string position, int duplicateFragments)
            {
                this.name = name;
                this.rarity = rarity;
                this.role = role;
                this.position = position;
                this.duplicateFragments = duplicateFragments;
            }
        }
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

            ConfigureRuntimeSystems();
            HideResultPanels();
            LoadProgress();
            ReturnHome();
        }

        private void OnApplicationQuit()
        {
            SaveProgress();
        }

        private void OnGUI()
        {
            EnsureRuntimeGuiStyles();
            if (_currentState != GameState.Home || _activeTownPanel == TownPanel.None)
            {
                DrawRuntimeTopHud();
            }

            if (_currentState == GameState.Playing)
            {
                DrawRetreatConfirmIfNeeded();
                return;
            }

            if (_currentState == GameState.Home)
            {
                DrawHomeGui();
                return;
            }

            if (_currentState == GameState.Codex)
            {
                DrawCodexGui();
                return;
            }

            DrawResultGui();

        }

        public void StartGame()
        {
            _activeTownPanel = TownPanel.None;
            _currentState = GameState.Playing;
            HideResultPanels();
            SetBattleHudVisible(true);
            SetBattleVisualsVisible(true);
            UpdateStageText();

            if (DropSystem.Instance != null)
            {
                DropSystem.Instance.ResetRunStats();
            }

            if (battleManager != null)
            {
                battleManager.SetStage(_stageIndex);
                ApplyBattleFormation();
                if (battleManager.hero != null)
                {
                    battleManager.hero.ResetStats();
                    ApplyHeroLevelStats();
                }
                battleManager.ResetBattle();
                SetBattleVisualsVisible(true);
                battleManager.StartBattle();
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
                    SetBattleHudVisible(false);
                    RefreshDropUi();
                    ShowVictory();
                    break;
                case GameState.Defeat:
                    SetBattleHudVisible(false);
                    RefreshDropUi();
                    ShowDefeat();
                    break;
                case GameState.Home:
                    HideResultPanels();
                    SetBattleHudVisible(false);
                    RefreshDropUi();
                    UpdateStageText();
                    break;
                case GameState.Codex:
                    HideResultPanels();
                    SetBattleHudVisible(false);
                    RefreshDropUi();
                    UpdateStageText();
                    break;
                case GameState.Playing:
                    HideResultPanels();
                    SetBattleHudVisible(true);
                    RefreshDropUi();
                    UpdateStageText();
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
                resultText.text = "胜利";
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
                resultText.text = "失败";
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
                return $"图谱一  地图 {_selectedMapIndex}";
            }

            string materialLabel = _currentState == GameState.Defeat ? "损失材料" : "获得材料";
            int expGain = _currentState == GameState.Victory ? CalculateVictoryExp() : 0;
            string expLine = _currentState == GameState.Victory ? $"\n经验：+{expGain}{(WillLevelUp(expGain) ? "  升级！" : "")}" : "";
            string mapMaterialLine = _currentState == GameState.Victory ? "\n" + GetMapMaterialPreviewText(_selectedMapIndex) : "";
            return $"图谱一  地图 {_selectedMapIndex}\n击杀：小怪 {drops.normalKills}  Boss {drops.bossKills}\n{materialLabel}：+{drops.runMaterials}{mapMaterialLine}{expLine}";
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
            if (_currentState == GameState.Defeat && DropSystem.Instance != null)
            {
                DropSystem.Instance.RollbackRunMaterials();
            }

            _currentState = GameState.Playing;
            HideResultPanels();
            SetBattleHudVisible(true);
            SetBattleVisualsVisible(true);
            UpdateStageText();

            // Reset hero
            if (battleManager != null && battleManager.hero != null)
            {
                battleManager.hero.ResetStats();
                ApplyHeroLevelStats();
            }

            // Reset drop system
            if (DropSystem.Instance != null)
            {
                DropSystem.Instance.ResetRunStats();
            }

            // Reset battle manager
            if (battleManager != null)
            {
                battleManager.SetStage(_stageIndex);
                ApplyBattleFormation();
                battleManager.ResetBattle();
                SetBattleVisualsVisible(true);
                battleManager.StartBattle();
            }

            Debug.Log("Game restarted!");
        }

        public void ReturnHome()
        {
            _activeTownPanel = TownPanel.None;
            _currentState = GameState.Home;
            HideResultPanels();
            SetBattleHudVisible(false);
            UpdateStageText();

            if (battleManager != null && battleManager.hero != null)
            {
                battleManager.hero.ResetStats();
                ApplyHeroLevelStats();
            }

            if (DropSystem.Instance != null)
            {
                DropSystem.Instance.RollbackRunMaterials();
            }

            if (battleManager != null)
            {
                battleManager.SetStage(_stageIndex);
                ApplyBattleFormation();
                battleManager.ResetBattle();
                SetBattleVisualsVisible(false);
            }

            RefreshDropUi();

            Debug.Log("Returned home.");
        }

        private void RetreatBattle()
        {
            if (_currentState != GameState.Playing)
            {
                return;
            }

            if (DropSystem.Instance != null)
            {
                DropSystem.Instance.RollbackRunMaterials();
            }

            if (battleManager != null)
            {
                battleManager.StopBattle();
                battleManager.ResetBattle();
                SetBattleVisualsVisible(false);
            }

            _codexNotice = $"已退出地图 {_selectedMapIndex}，本场未结算掉落已放弃。";
            SaveProgress();
            EnterCodex();
        }

        private void RequestRetreatBattle()
        {
            if (_currentState != GameState.Playing)
            {
                return;
            }

            _showRetreatConfirm = true;
            if (battleManager != null)
            {
                battleManager.StopBattle();
            }
        }

        public void StartNextStage()
        {
            CompleteCurrentMapAndReturnCodex();
        }

        public void CompleteCurrentMapAndReturnCodex()
        {
            AwardPendingVictoryExp();

            if (DropSystem.Instance != null)
            {
                AwardMapMaterialsToRun(DropSystem.Instance, _selectedMapIndex);
                DropSystem.Instance.CommitStageMaterials();
            }

            _completedMapIndex = Mathf.Max(_completedMapIndex, _selectedMapIndex);
            if (_unlockedMapIndex < 3 && _completedMapIndex >= _unlockedMapIndex)
            {
                _unlockedMapIndex++;
            }

            SaveProgress();
            EnterCodex();
        }

        private void EnsureRuntimeGuiStyles()
        {
            if (_runtimeStyleScreenWidth != Screen.width || _runtimeStyleScreenHeight != Screen.height)
            {
                _runtimeButtonStyle = null;
                _runtimeTitleStyle = null;
                _runtimeInfoStyle = null;
                _runtimePanelInfoStyle = null;
                _runtimeSmallStyle = null;
                _runtimeBuildingTitleStyle = null;
                _runtimeDisabledButtonStyle = null;
                _runtimeMapButtonStyle = null;
                _runtimeHudStyle = null;
                _runtimeStyleScreenWidth = Screen.width;
                _runtimeStyleScreenHeight = Screen.height;
            }

            if (_runtimeButtonStyle == null)
            {
                _runtimeButtonStyle = new GUIStyle(GUI.skin.button);
                _runtimeButtonStyle.fontSize = Mathf.Max(15, Mathf.Min(18, Screen.height / 42));
                ApplyRuntimeFont(_runtimeButtonStyle);
                _runtimeButtonStyle.normal.textColor = new Color(0.92f, 0.88f, 0.78f, 1f);
                _runtimeButtonStyle.hover.textColor = new Color(1f, 0.94f, 0.78f, 1f);
                _runtimeButtonStyle.active.textColor = new Color(1f, 0.88f, 0.56f, 1f);
                _runtimeButtonStyle.normal.background = GetRuntimeWhiteTexture();
                _runtimeButtonStyle.hover.background = GetRuntimeWhiteTexture();
                _runtimeButtonStyle.active.background = GetRuntimeWhiteTexture();
            }

            if (_runtimeTitleStyle == null)
            {
                _runtimeTitleStyle = new GUIStyle(GUI.skin.label);
                _runtimeTitleStyle.fontSize = Mathf.Max(21, Mathf.Min(25, Screen.height / 32));
                _runtimeTitleStyle.fontStyle = FontStyle.Bold;
                _runtimeTitleStyle.alignment = TextAnchor.MiddleCenter;
                ApplyRuntimeFont(_runtimeTitleStyle);
                _runtimeTitleStyle.normal.textColor = new Color(0.96f, 0.8f, 0.48f, 1f);
            }

            if (_runtimeInfoStyle == null)
            {
                _runtimeInfoStyle = new GUIStyle(GUI.skin.label);
                _runtimeInfoStyle.fontSize = Mathf.Max(15, Mathf.Min(17, Screen.height / 48));
                _runtimeInfoStyle.alignment = TextAnchor.MiddleCenter;
                ApplyRuntimeFont(_runtimeInfoStyle);
                _runtimeInfoStyle.normal.textColor = new Color(0.82f, 0.82f, 0.76f, 1f);
            }

            if (_runtimePanelInfoStyle == null)
            {
                _runtimePanelInfoStyle = new GUIStyle(_runtimeInfoStyle);
                _runtimePanelInfoStyle.fontSize = Mathf.Max(13, Mathf.Min(15, Screen.height / 54));
                _runtimePanelInfoStyle.alignment = TextAnchor.UpperLeft;
                _runtimePanelInfoStyle.wordWrap = true;
                ApplyRuntimeFont(_runtimePanelInfoStyle);
            }

            if (_runtimeSmallStyle == null)
            {
                _runtimeSmallStyle = new GUIStyle(GUI.skin.label);
                _runtimeSmallStyle.fontSize = Mathf.Max(13, Mathf.Min(15, Screen.height / 56));
                _runtimeSmallStyle.alignment = TextAnchor.MiddleCenter;
                _runtimeSmallStyle.wordWrap = true;
                ApplyRuntimeFont(_runtimeSmallStyle);
                _runtimeSmallStyle.normal.textColor = new Color(0.72f, 0.74f, 0.68f, 1f);
            }

            if (_runtimeBuildingTitleStyle == null)
            {
                _runtimeBuildingTitleStyle = new GUIStyle(GUI.skin.label);
                _runtimeBuildingTitleStyle.fontSize = Mathf.Max(13, Mathf.Min(15, Screen.height / 52));
                _runtimeBuildingTitleStyle.fontStyle = FontStyle.Bold;
                _runtimeBuildingTitleStyle.alignment = TextAnchor.MiddleCenter;
                _runtimeBuildingTitleStyle.wordWrap = false;
                ApplyRuntimeFont(_runtimeBuildingTitleStyle);
                _runtimeBuildingTitleStyle.normal.textColor = new Color(0.95f, 0.9f, 0.78f, 1f);
            }

            if (_runtimeDisabledButtonStyle == null)
            {
                _runtimeDisabledButtonStyle = new GUIStyle(_runtimeButtonStyle);
                _runtimeDisabledButtonStyle.normal.textColor = new Color(0.42f, 0.46f, 0.5f, 1f);
                _runtimeDisabledButtonStyle.hover.textColor = new Color(0.42f, 0.46f, 0.5f, 1f);
                _runtimeDisabledButtonStyle.active.textColor = new Color(0.42f, 0.46f, 0.5f, 1f);
            }

            if (_runtimeMapButtonStyle == null)
            {
                _runtimeMapButtonStyle = new GUIStyle(_runtimeButtonStyle);
                _runtimeMapButtonStyle.fontSize = Mathf.Max(12, Mathf.Min(14, Screen.height / 64));
                _runtimeMapButtonStyle.wordWrap = true;
                _runtimeMapButtonStyle.alignment = TextAnchor.MiddleCenter;
                ApplyRuntimeFont(_runtimeMapButtonStyle);
            }

            if (_runtimeHudStyle == null)
            {
                _runtimeHudStyle = new GUIStyle(GUI.skin.label);
                _runtimeHudStyle.fontSize = Mathf.Max(14, Mathf.Min(17, Screen.height / 54));
                _runtimeHudStyle.fontStyle = FontStyle.Bold;
                _runtimeHudStyle.alignment = TextAnchor.MiddleCenter;
                ApplyRuntimeFont(_runtimeHudStyle);
                _runtimeHudStyle.normal.textColor = new Color(0.9f, 0.88f, 0.78f, 1f);
            }
        }

        private void DrawRuntimeTopHud()
        {
            float top = Mathf.Max(8f, Screen.height * 0.018f);
            float height = Mathf.Max(24f, Screen.height * 0.038f);
            float leftWidth = Mathf.Min(180f, Screen.width * 0.24f);
            Rect materialRect = new Rect(14f, top, leftWidth, height);
            Rect stageRect = new Rect((Screen.width - 220f) * 0.5f, top, 220f, height);
            Rect retreatRect = new Rect(Screen.width - 96f, top, 82f, height);

            DrawSolidRect(materialRect, new Color(0.03f, 0.035f, 0.032f, 0.58f));
            DrawSolidRect(stageRect, new Color(0.03f, 0.035f, 0.032f, 0.58f));
            GUI.Label(materialRect, GetRuntimeMaterialText(), _runtimeHudStyle);
            GUI.Label(stageRect, GetRuntimeStageText(), _runtimeHudStyle);

            if (_currentState == GameState.Playing)
            {
                GUI.backgroundColor = new Color(0.18f, 0.22f, 0.22f, 1f);
                if (GUI.Button(retreatRect, "退出", _runtimeMapButtonStyle))
                {
                    RequestRetreatBattle();
                }
                GUI.backgroundColor = Color.white;
            }
        }

        private void DrawRetreatConfirmIfNeeded()
        {
            if (!_showRetreatConfirm)
            {
                return;
            }

            Rect screenRect = new Rect(0f, 0f, Screen.width, Screen.height);
            DrawSolidRect(screenRect, new Color(0f, 0f, 0f, 0.48f));

            float width = Mathf.Min(420f, Screen.width * 0.46f);
            float height = 190f;
            Rect modalRect = new Rect((Screen.width - width) * 0.5f, (Screen.height - height) * 0.5f, width, height);
            DrawSolidRect(modalRect, new Color(0.028f, 0.034f, 0.032f, 1f));

            GUI.Label(new Rect(modalRect.x + 24f, modalRect.y + 22f, modalRect.width - 48f, 34f), "确认退出", _runtimeInfoStyle);
            GUI.Label(new Rect(modalRect.x + 34f, modalRect.y + 66f, modalRect.width - 68f, 46f), "退出当前关卡后，本场未结算收获会丢失。", _runtimePanelInfoStyle);

            float gap = 12f;
            float buttonWidth = 138f;
            Rect cancelRect = new Rect(modalRect.x + modalRect.width * 0.5f - buttonWidth - gap * 0.5f, modalRect.yMax - 54f, buttonWidth, 36f);
            Rect confirmRect = new Rect(modalRect.x + modalRect.width * 0.5f + gap * 0.5f, modalRect.yMax - 54f, buttonWidth, 36f);

            GUI.backgroundColor = new Color(0.18f, 0.22f, 0.22f, 1f);
            if (GUI.Button(cancelRect, "继续战斗", _runtimeButtonStyle))
            {
                _showRetreatConfirm = false;
                if (battleManager != null)
                {
                    battleManager.StartBattle();
                }
            }

            GUI.backgroundColor = new Color(0.34f, 0.18f, 0.16f, 1f);
            if (GUI.Button(confirmRect, "确认退出", _runtimeButtonStyle))
            {
                _showRetreatConfirm = false;
                RetreatBattle();
            }

            GUI.backgroundColor = Color.white;
        }

        private string GetRuntimeMaterialText()
        {
            DropSystem drops = DropSystem.Instance;
            if (drops == null)
            {
                return $"{GetMaterialName("spirit_dust")} 0";
            }

            bool showBackpackMaterials = _currentState == GameState.Home || _currentState == GameState.Codex;
            return showBackpackMaterials ? $"{GetMaterialName("spirit_dust")} {drops.materialCount}" : $"本场 {drops.runMaterials}";
        }

        private string GetRuntimeStageText()
        {
            if (_currentState == GameState.Home)
            {
                return "城镇";
            }

            if (_currentState == GameState.Codex)
            {
                return "灵素图谱";
            }

            return $"图谱一 地图 {_selectedMapIndex}";
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

        private void DrawHomeGui()
        {
            if (_activeTownPanel != TownPanel.None)
            {
                Rect pageRect = GetTownFullPageRect();
                DrawSolidRect(pageRect, new Color(0.035f, 0.04f, 0.038f, 1f));

                DrawTownOverlayPanel(pageRect);
                DrawTownModalIfNeeded(pageRect);
                return;
            }

            float panelWidth = Mathf.Min(720f, Screen.width * 0.78f);
            float panelHeight = Mathf.Min(500f, Screen.height * 0.84f);
            panelHeight = Mathf.Max(400f, panelHeight);
            Rect panelRect = new Rect((Screen.width - panelWidth) * 0.5f, Screen.height * 0.06f, panelWidth, panelHeight);

            GUI.backgroundColor = new Color(0.035f, 0.04f, 0.038f, 1f);
            GUI.Box(panelRect, GUIContent.none);
            GUI.backgroundColor = Color.white;

            DrawTownBackdrop(panelRect);

            GUI.Label(new Rect(panelRect.x, panelRect.y + 18f, panelRect.width, 34f), "城镇", _runtimeTitleStyle);
            GUI.Label(new Rect(panelRect.x, panelRect.y + 60f, panelRect.width, 24f), $"{GetMaterialName("spirit_dust")} {GetMaterialCount()}    {PremiumCurrencyName} {_premiumCurrencyCount}    {RecruitTokenName} {_recruitTokenCount}    图谱一 {_completedMapIndex}/3    {GetTownPageLabel()}", _runtimeInfoStyle);
            string[] buildingNames = GetTownBuildingNames();

            float gap = 12f;
            float gridWidth = panelRect.width - 76f;
            float buttonWidth = (gridWidth - gap * 2f) / 3f;
            float buttonHeight = Mathf.Min(74f, (panelRect.height - 178f) / 3f);
            buttonHeight = Mathf.Max(68f, buttonHeight);
            float startX = panelRect.x + 38f;
            float startY = panelRect.y + 108f;

            for (int i = 0; i < buildingNames.Length; i++)
            {
                int row = i / 3;
                int col = i % 3;
                Rect buttonRect = new Rect(startX + col * (buttonWidth + gap), startY + row * (buttonHeight + gap), buttonWidth, buttonHeight);
                if (DrawTownBuildingButton(buttonRect, i, buildingNames[i]))
                {
                    HandleTownBuildingClick(i, buildingNames[i]);
                }
            }

            GUI.backgroundColor = Color.white;
            float noticeWidth = panelRect.width - 84f;
            Rect noticeRect = new Rect(panelRect.x + 42f, panelRect.y + panelRect.height - 38f, noticeWidth - 96f, 24f);
            DrawSolidRect(noticeRect, new Color(0.07f, 0.078f, 0.07f, 1f));
            GUI.Label(noticeRect, _townNotice, _runtimeSmallStyle);

            Rect clearSaveRect = new Rect(noticeRect.xMax + 8f, noticeRect.y, 88f, 24f);
            GUI.backgroundColor = new Color(0.12f, 0.13f, 0.13f, 1f);
            if (GUI.Button(clearSaveRect, "清存档", _runtimeMapButtonStyle))
            {
                ClearProgress();
            }

            DrawTownPageControls(panelRect);
            GUI.backgroundColor = Color.white;
        }

        private string GetTownPageLabel()
        {
            return $"城镇 {_townPageIndex + 1}/2";
        }

        private string[] GetTownBuildingNames()
        {
            if (_townPageIndex == 0)
            {
                return new string[]
                {
                    "灵素图谱",
                    "商店",
                    "铁匠铺",
                    "进化塔",
                    "炼药铺",
                    "修炼场",
                    "角色阁",
                    "装备阁",
                    "背包"
                };
            }

            return new string[]
            {
                "招贤阁",
                "任务榜",
                "成就",
                "邮件",
                "图鉴",
                "设置",
                "占位",
                "占位",
                "占位"
            };
        }

        private void HandleTownBuildingClick(int index, string buildingName)
        {
            if (_townPageIndex == 1)
            {
                if (index == 0)
                {
                    _activeTownPanel = TownPanel.Recruit;
                    _townNotice = $"招贤阁：使用{RecruitTokenName}获得队友。";
                    return;
                }

                if (index == 1)
                {
                    _activeTownPanel = TownPanel.TaskBoard;
                    _selectedCodexTaskTab = CodexTaskTab.Main;
                    _townNotice = "任务榜：领取主线和支线奖励。";
                    return;
                }

                _activeTownPanel = TownPanel.None;
                _townNotice = buildingName + "：功能占位，后续接入。";
                return;
            }

            if (index == 0)
            {
                _activeTownPanel = TownPanel.None;
                EnterCodex();
            }
            else if (index == 1)
            {
                _activeTownPanel = TownPanel.Shop;
                _selectedShopItemIndex = -1;
                _townNotice = "商店：点击商品格购买。出售请去背包。";
            }
            else if (index == 2)
            {
                _activeTownPanel = TownPanel.Blacksmith;
                _hasSelectedBlacksmithSlot = false;
                _hasSelectedCraftRecipe = false;
                _selectedBlacksmithTab = BlacksmithTab.Enhance;
                _townNotice = "铁匠铺：选择已穿戴装备进行强化。";
            }
            else if (index == 3)
            {
                _activeTownPanel = TownPanel.Evolution;
                _townNotice = "进化塔：消耗材料提升主角阶段。";
            }
            else if (index == 4)
            {
                _activeTownPanel = TownPanel.Alchemy;
                _townNotice = "炼药铺：炼制丹药获得永久属性。";
            }
            else if (index == 5)
            {
                _activeTownPanel = TownPanel.Training;
                _townNotice = "修炼场：升级当前技能。";
            }
            else if (index == 6)
            {
                _activeTownPanel = TownPanel.Character;
                _townNotice = "角色阁：查看当前主角属性。";
            }
            else if (index == 7)
            {
                _activeTownPanel = TownPanel.Equipment;
                _showEquipmentBag = false;
                _showDismantleConfirm = false;
                _hasSelectedEquipmentSlot = false;
                _selectedEquipmentIndex = -1;
                _townNotice = "装备阁：查看和穿戴装备。";
            }
            else if (index == 8)
            {
                _activeTownPanel = TownPanel.Inventory;
                _townNotice = "背包：选择材料格，可卖 1 或全卖。";
            }
        }

        private void DrawTownPageControls(Rect panelRect)
        {
            float controlWidth = 154f;
            float buttonWidth = 34f;
            Rect labelRect = new Rect(panelRect.x + (panelRect.width - controlWidth) * 0.5f + buttonWidth + 6f, panelRect.y + panelRect.height - 38f, controlWidth - buttonWidth * 2f - 12f, 24f);
            Rect prevRect = new Rect(labelRect.x - buttonWidth - 6f, labelRect.y, buttonWidth, 24f);
            Rect nextRect = new Rect(labelRect.xMax + 6f, labelRect.y, buttonWidth, 24f);

            bool canPrev = _townPageIndex > 0;
            bool canNext = _townPageIndex < 1;
            GUI.backgroundColor = canPrev ? new Color(0.18f, 0.22f, 0.22f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (canPrev)
            {
                if (GUI.Button(prevRect, "<", _runtimeMapButtonStyle))
                {
                    _townPageIndex--;
                    _townNotice = "城镇第一页：核心养成入口。";
                }
            }
            else
            {
                GUI.Box(prevRect, "<", _runtimeDisabledButtonStyle);
            }

            DrawSolidRect(labelRect, new Color(0.028f, 0.034f, 0.032f, 1f));
            GUI.Label(labelRect, GetTownPageLabel(), _runtimeSmallStyle);

            GUI.backgroundColor = canNext ? new Color(0.18f, 0.22f, 0.22f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (canNext)
            {
                if (GUI.Button(nextRect, ">", _runtimeMapButtonStyle))
                {
                    _townPageIndex++;
                    _townNotice = "城镇第二页：扩展系统测试入口。";
                }
            }
            else
            {
                GUI.Box(nextRect, ">", _runtimeDisabledButtonStyle);
            }
        }

        private Rect GetTownFullPageRect()
        {
            float marginX = Mathf.Clamp(Screen.width * 0.035f, 18f, 56f);
            float top = Mathf.Clamp(Screen.height * 0.045f, 24f, 52f);
            float bottom = Mathf.Clamp(Screen.height * 0.035f, 18f, 40f);
            return new Rect(marginX, top, Screen.width - marginX * 2f, Screen.height - top - bottom);
        }

        private void DrawTownBackdrop(Rect panelRect)
        {
            Rect innerRect = new Rect(panelRect.x + 118f, panelRect.y + 70f, panelRect.width - 236f, panelRect.height - 92f);
            DrawSolidRect(innerRect, new Color(0.055f, 0.065f, 0.06f, 1f));
        }

        private bool DrawTownBuildingButton(Rect rect, int index, string title)
        {
            bool placeholder = _townPageIndex == 1 && index > 1;
            bool hovered = rect.Contains(Event.current.mousePosition);
            Color baseColor = placeholder
                ? new Color(0.045f, 0.05f, 0.05f, 1f)
                : hovered ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.075f, 0.095f, 0.09f, 1f);
            GUI.backgroundColor = baseColor;
            bool clicked = GUI.Button(rect, GUIContent.none, _runtimeButtonStyle);

            Rect iconRect = new Rect(rect.x + rect.width * 0.5f - 18f, rect.y + 7f, 36f, 25f);
            DrawBuildingIcon(iconRect, index);

            GUI.Label(new Rect(rect.x + 6f, rect.y + rect.height - 30f, rect.width - 12f, 24f), title, _runtimeBuildingTitleStyle);

            GUI.backgroundColor = Color.white;
            return clicked;
        }

        private void DrawBuildingIcon(Rect rect, int index)
        {
            Color accent = GetBuildingAccent(index);
            DrawSolidRect(new Rect(rect.x - 5f, rect.y + rect.height - 2f, rect.width + 10f, 3f), new Color(0f, 0f, 0f, 0.75f));

            switch (index)
            {
                case 0:
                    DrawSolidRect(new Rect(rect.x, rect.y + 3f, rect.width * 0.46f, rect.height - 6f), new Color(0.78f, 0.86f, 0.95f, 0.95f));
                    DrawSolidRect(new Rect(rect.x + rect.width * 0.54f, rect.y + 3f, rect.width * 0.46f, rect.height - 6f), new Color(0.68f, 0.78f, 0.9f, 0.95f));
                    DrawSolidRect(new Rect(rect.x + rect.width * 0.48f, rect.y + 1f, rect.width * 0.04f, rect.height - 2f), accent);
                    break;
                case 1:
                    DrawSolidRect(new Rect(rect.x + 3f, rect.y + 12f, rect.width - 6f, rect.height - 12f), new Color(0.25f, 0.18f, 0.13f, 0.95f));
                    DrawSolidRect(new Rect(rect.x, rect.y + 7f, rect.width, 8f), accent);
                    DrawSolidRect(new Rect(rect.x + 6f, rect.y + 18f, rect.width - 12f, 7f), new Color(0.95f, 0.72f, 0.3f, 0.9f));
                    break;
                case 2:
                    DrawSolidRect(new Rect(rect.x + 6f, rect.y + 16f, rect.width - 12f, 7f), accent);
                    DrawSolidRect(new Rect(rect.x + 12f, rect.y + 10f, rect.width - 24f, 7f), new Color(0.58f, 0.62f, 0.66f, 0.95f));
                    DrawSolidRect(new Rect(rect.x + 26f, rect.y + 2f, 5f, rect.height - 2f), new Color(0.6f, 0.38f, 0.2f, 0.95f));
                    break;
                case 3:
                    DrawSolidRect(new Rect(rect.x + 13f, rect.y + 4f, rect.width - 26f, rect.height - 4f), new Color(0.24f, 0.24f, 0.32f, 0.95f));
                    DrawSolidRect(new Rect(rect.x + 7f, rect.y + 13f, rect.width - 14f, 5f), accent);
                    DrawSolidRect(new Rect(rect.x + 4f, rect.y + rect.height - 5f, rect.width - 8f, 5f), accent);
                    break;
                case 4:
                    DrawSolidRect(new Rect(rect.x + 8f, rect.y + 15f, rect.width - 16f, 10f), accent);
                    DrawSolidRect(new Rect(rect.x + 12f, rect.y + 7f, 6f, 10f), new Color(0.6f, 0.9f, 0.7f, 0.9f));
                    DrawSolidRect(new Rect(rect.x + 24f, rect.y + 5f, 6f, 12f), new Color(0.55f, 0.78f, 0.95f, 0.9f));
                    break;
                case 5:
                    DrawSolidRect(new Rect(rect.x + 5f, rect.y + 6f, rect.width - 10f, rect.height - 10f), new Color(0.16f, 0.2f, 0.2f, 0.9f));
                    DrawSolidRect(new Rect(rect.x + 11f, rect.y + 12f, rect.width - 22f, 5f), accent);
                    DrawSolidRect(new Rect(rect.x + rect.width * 0.5f - 3f, rect.y + 7f, 6f, rect.height - 8f), accent);
                    break;
                case 6:
                    DrawSolidRect(new Rect(rect.x + 15f, rect.y + 4f, 10f, 10f), accent);
                    DrawSolidRect(new Rect(rect.x + 10f, rect.y + 16f, 20f, 12f), new Color(0.36f, 0.48f, 0.72f, 0.95f));
                    break;
                case 7:
                    DrawSolidRect(new Rect(rect.x + 10f, rect.y + 5f, 8f, rect.height - 6f), accent);
                    DrawSolidRect(new Rect(rect.x + 21f, rect.y + 8f, 8f, rect.height - 9f), new Color(0.55f, 0.62f, 0.74f, 0.95f));
                    DrawSolidRect(new Rect(rect.x + 7f, rect.y + 14f, rect.width - 14f, 5f), new Color(0.78f, 0.78f, 0.84f, 0.95f));
                    break;
                default:
                    DrawSolidRect(new Rect(rect.x + 8f, rect.y + 11f, rect.width - 16f, rect.height - 10f), accent);
                    DrawSolidRect(new Rect(rect.x + 14f, rect.y + 5f, rect.width - 28f, 9f), new Color(0.38f, 0.28f, 0.18f, 0.95f));
                    break;
            }
        }

        private Color GetBuildingAccent(int index)
        {
            if (_townPageIndex == 1)
            {
                return index == 0 ? new Color(0.88f, 0.7f, 0.36f, 0.95f) : new Color(0.34f, 0.38f, 0.38f, 0.85f);
            }

            switch (index)
            {
                case 0:
                    return new Color(0.55f, 0.78f, 0.86f, 0.95f);
                case 1:
                    return new Color(0.9f, 0.56f, 0.26f, 0.95f);
                case 2:
                    return new Color(0.7f, 0.66f, 0.58f, 0.95f);
                case 3:
                    return new Color(0.58f, 0.46f, 0.76f, 0.95f);
                case 4:
                    return new Color(0.38f, 0.72f, 0.56f, 0.95f);
                case 5:
                    return new Color(0.82f, 0.34f, 0.26f, 0.95f);
                case 6:
                    return new Color(0.9f, 0.66f, 0.34f, 0.95f);
                case 7:
                    return new Color(0.6f, 0.72f, 0.9f, 0.95f);
                default:
                    return new Color(0.72f, 0.5f, 0.3f, 0.95f);
            }
        }

        private void DrawSolidRect(Rect rect, Color color)
        {
            Color previousColor = GUI.color;
            GUI.color = color;
            GUI.DrawTexture(rect, GetRuntimeWhiteTexture());
            GUI.color = previousColor;
        }

        private static Texture2D GetRuntimeWhiteTexture()
        {
            if (_runtimeWhiteTexture != null)
            {
                return _runtimeWhiteTexture;
            }

            _runtimeWhiteTexture = new Texture2D(1, 1, TextureFormat.RGBA32, false);
            _runtimeWhiteTexture.SetPixel(0, 0, Color.white);
            _runtimeWhiteTexture.Apply();
            return _runtimeWhiteTexture;
        }

        private void DrawTownDetailPanel(Rect townRect)
        {
            if (_activeTownPanel == TownPanel.None)
            {
                return;
            }

            float panelWidth = townRect.width * 0.4f;
            float panelHeight = townRect.height - 148f;
            Rect detailRect = new Rect(townRect.x + townRect.width - panelWidth - 30f, townRect.y + 126f, panelWidth, panelHeight);

            GUI.backgroundColor = new Color(0.045f, 0.052f, 0.05f, 1f);
            GUI.Box(detailRect, GUIContent.none);
            GUI.backgroundColor = Color.white;

            string title = GetTownPanelTitle();
            string body = GetTownPanelBody();

            GUI.Label(new Rect(detailRect.x, detailRect.y + 18f, detailRect.width, 40f), title, _runtimeTitleStyle);
            if (_activeTownPanel != TownPanel.Shop && _activeTownPanel != TownPanel.Inventory && _activeTownPanel != TownPanel.Equipment && _activeTownPanel != TownPanel.Blacksmith && _activeTownPanel != TownPanel.Alchemy && _activeTownPanel != TownPanel.Evolution && _activeTownPanel != TownPanel.Character)
            {
                float bodyHeight = detailRect.height - 128f;
                GUI.Label(new Rect(detailRect.x + 24f, detailRect.y + 62f, detailRect.width - 48f, bodyHeight), body, _runtimePanelInfoStyle);
            }

            DrawTownPanelAction(detailRect);

            float buttonWidth = Mathf.Min(150f, detailRect.width * 0.36f);
            Rect closeRect = new Rect(detailRect.x + detailRect.width - buttonWidth - 20f, detailRect.y + detailRect.height - 48f, buttonWidth, 36f);
            GUI.backgroundColor = new Color(0.18f, 0.22f, 0.22f, 1f);
            if (GUI.Button(closeRect, "关闭", _runtimeButtonStyle))
            {
                _activeTownPanel = TownPanel.None;
                _showEquipmentBag = false;
                _showDismantleConfirm = false;
                _hasSelectedEquipmentSlot = false;
                _hasSelectedBlacksmithSlot = false;
                _hasSelectedCraftRecipe = false;
                _selectedBlacksmithTab = BlacksmithTab.Enhance;
                _selectedEquipmentIndex = -1;
                _townNotice = "选择灵素图谱开始挑战。";
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawTownOverlayPanel(Rect townRect)
        {
            Rect overlayRect = new Rect(townRect.x + 18f, townRect.y + 14f, townRect.width - 36f, townRect.height - 28f);
            DrawSolidRect(overlayRect, new Color(0.045f, 0.052f, 0.05f, 1f));

            GUI.Label(new Rect(overlayRect.x, overlayRect.y + 12f, overlayRect.width, 36f), GetTownPanelTitle(), _runtimeTitleStyle);
            if (_activeTownPanel != TownPanel.Shop && _activeTownPanel != TownPanel.Inventory && _activeTownPanel != TownPanel.Blacksmith && _activeTownPanel != TownPanel.Alchemy && _activeTownPanel != TownPanel.Evolution && _activeTownPanel != TownPanel.Character && _activeTownPanel != TownPanel.Recruit && _activeTownPanel != TownPanel.TaskBoard)
            {
                string body = GetTownPanelBody();
                float bodyHeight = overlayRect.height - 128f;
                GUI.Label(new Rect(overlayRect.x + 36f, overlayRect.y + 66f, overlayRect.width - 72f, bodyHeight), body, _runtimePanelInfoStyle);
            }

            if (!_showTownModal)
            {
                DrawTownPanelAction(overlayRect);
            }

            if (_activeTownPanel != TownPanel.Blacksmith && _activeTownPanel != TownPanel.Alchemy && _activeTownPanel != TownPanel.Evolution && _activeTownPanel != TownPanel.Character && _activeTownPanel != TownPanel.Recruit && _activeTownPanel != TownPanel.TaskBoard)
            {
                Rect noticeRect = new Rect(overlayRect.x + 48f, overlayRect.y + overlayRect.height - 44f, overlayRect.width - 96f, 24f);
                DrawSolidRect(noticeRect, new Color(0.028f, 0.034f, 0.032f, 1f));
                GUI.Label(noticeRect, _townNotice, _runtimeSmallStyle);
            }

            Rect closeRect = new Rect(overlayRect.x + overlayRect.width - 48f, overlayRect.y + 12f, 32f, 32f);
            GUI.backgroundColor = new Color(0.18f, 0.22f, 0.22f, 1f);
            if (_showTownModal)
            {
                GUI.Box(closeRect, "X", _runtimeDisabledButtonStyle);
            }
            else if (GUI.Button(closeRect, "X", _runtimeButtonStyle))
            {
                _activeTownPanel = TownPanel.None;
                _showEquipmentBag = false;
                _showDismantleConfirm = false;
                _hasSelectedEquipmentSlot = false;
                _hasSelectedBlacksmithSlot = false;
                _hasSelectedCraftRecipe = false;
                _selectedBlacksmithTab = BlacksmithTab.Enhance;
                _selectedEquipmentIndex = -1;
                _townNotice = "选择灵素图谱开始挑战。";
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawTownModalIfNeeded(Rect pageRect)
        {
            if (!_showTownModal)
            {
                return;
            }

            DrawSolidRect(pageRect, new Color(0f, 0f, 0f, 0.42f));

            float width = Mathf.Min(460f, pageRect.width * 0.58f);
            int lineCount = string.IsNullOrEmpty(_townModalMessage) ? 1 : _townModalMessage.Split('\n').Length;
            float height = Mathf.Clamp(148f + lineCount * 24f, 190f, Mathf.Min(360f, pageRect.height * 0.72f));
            Rect modalRect = new Rect(pageRect.x + (pageRect.width - width) * 0.5f, pageRect.y + (pageRect.height - height) * 0.5f, width, height);
            DrawSolidRect(modalRect, new Color(0.028f, 0.034f, 0.032f, 1f));

            GUI.Label(new Rect(modalRect.x + 24f, modalRect.y + 22f, modalRect.width - 48f, 34f), _townModalTitle, _runtimeInfoStyle);
            GUI.Label(new Rect(modalRect.x + 34f, modalRect.y + 68f, modalRect.width - 68f, modalRect.height - 132f), _townModalMessage, _runtimePanelInfoStyle);

            Rect okRect = new Rect(modalRect.x + modalRect.width * 0.5f - 78f, modalRect.yMax - 54f, 156f, 36f);
            GUI.backgroundColor = new Color(0.12f, 0.32f, 0.29f, 1f);
            if (GUI.Button(okRect, "确定", _runtimeButtonStyle))
            {
                _showTownModal = false;
            }

            GUI.backgroundColor = Color.white;
        }

        private string GetTownPanelTitle()
        {
            switch (_activeTownPanel)
            {
                case TownPanel.Shop:
                    return "商店";
                case TownPanel.Blacksmith:
                    return "铁匠铺";
                case TownPanel.Evolution:
                    return "进化塔";
                case TownPanel.Alchemy:
                    return "炼药铺";
                case TownPanel.Training:
                    return "修炼场";
                case TownPanel.Character:
                    return "角色阁";
                case TownPanel.Equipment:
                    return "装备阁";
                case TownPanel.Inventory:
                    return "背包";
                case TownPanel.Recruit:
                    return "招贤阁";
                case TownPanel.TaskBoard:
                    return "任务榜";
                default:
                    return "";
            }
        }

        private string GetTownPanelBody()
        {
            switch (_activeTownPanel)
            {
                case TownPanel.Shop:
                    return BuildShopInfo();
                case TownPanel.Blacksmith:
                    return BuildBlacksmithInfo();
                case TownPanel.Evolution:
                    return BuildEvolutionInfo();
                case TownPanel.Alchemy:
                    return BuildAlchemyInfo();
                case TownPanel.Training:
                    string costText = _skillOneLevel >= 3 ? "已达当前上限" : $"{GetSkillOneUpgradeCost()} 材料";
                    return $"技能一  等级 {_skillOneLevel}\n当前倍率：{GetSkillOneMultiplier()}x\n升级消耗：{costText}";
                case TownPanel.Character:
                    return BuildCharacterInfo();
                case TownPanel.Equipment:
                    return BuildEquipmentInfo();
                case TownPanel.Inventory:
                    return BuildInventoryInfo();
                case TownPanel.Recruit:
                    return BuildRecruitInfo();
                case TownPanel.TaskBoard:
                    return "";
                default:
                    return "";
            }
        }

        private void DrawTownPanelAction(Rect detailRect)
        {
            if (_activeTownPanel == TownPanel.Equipment)
            {
                DrawEquipmentPanelActions(detailRect);
                return;
            }

            if (_activeTownPanel == TownPanel.Blacksmith)
            {
                DrawBlacksmithPanelActions(detailRect);
                return;
            }

            if (_activeTownPanel == TownPanel.Shop)
            {
                DrawShopPanelActions(detailRect);
                return;
            }

            if (_activeTownPanel == TownPanel.Inventory)
            {
                DrawInventoryPanelActions(detailRect);
                return;
            }

            if (_activeTownPanel == TownPanel.Alchemy)
            {
                DrawAlchemyPanelActions(detailRect);
                return;
            }

            if (_activeTownPanel == TownPanel.Evolution)
            {
                DrawEvolutionPanelActions(detailRect);
                return;
            }

            if (_activeTownPanel == TownPanel.Character)
            {
                DrawCharacterPanelActions(detailRect);
                return;
            }

            if (_activeTownPanel == TownPanel.Recruit)
            {
                DrawRecruitPanelActions(detailRect);
                return;
            }

            if (_activeTownPanel == TownPanel.TaskBoard)
            {
                DrawTaskBoardPanelActions(detailRect);
                return;
            }

            if (_activeTownPanel != TownPanel.Training)
            {
                return;
            }

            float buttonWidth = detailRect.width - 40f;
            Rect actionRect = new Rect(detailRect.x + 20f, detailRect.y + detailRect.height - 92f, buttonWidth, 36f);

            bool canAct = CanUpgradeSkillOne();
            GUI.backgroundColor = canAct ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            string label = "升级 S1";
            if (canAct)
            {
                if (GUI.Button(actionRect, label, _runtimeButtonStyle))
                {
                    UpgradeSkillOne();
                }
            }
            else
            {
                GUI.Box(actionRect, label, _runtimeDisabledButtonStyle);
            }
        }

        private void DrawShopPanelActions(Rect detailRect)
        {
            DrawShopGrid(detailRect);
        }

        private void DrawShopGrid(Rect detailRect)
        {
            ValidateSelectedShopItem();
            DrawShopCategoryTabs(detailRect);
            DrawShopItemSlots(detailRect);
            DrawSelectedShopItemDetail(detailRect);
            DrawShopBottomActions(detailRect);
        }

        private void DrawShopCategoryTabs(Rect detailRect)
        {
            float gap = 5f;
            float tabY = detailRect.y + 54f;
            float tabWidth = (detailRect.width - 40f - gap * (_shopCategories.Length - 1)) / _shopCategories.Length;
            for (int i = 0; i < _shopCategories.Length; i++)
            {
                Rect tabRect = new Rect(detailRect.x + 20f + i * (tabWidth + gap), tabY, tabWidth, 28f);
                GUI.backgroundColor = i == _selectedShopCategoryIndex ? new Color(0.16f, 0.38f, 0.34f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
                if (_showTownModal)
                {
                    GUI.Box(tabRect, _shopCategories[i], i == _selectedShopCategoryIndex ? _runtimeMapButtonStyle : _runtimeDisabledButtonStyle);
                    continue;
                }

                if (GUI.Button(tabRect, _shopCategories[i], _runtimeMapButtonStyle))
                {
                    _selectedShopCategoryIndex = i;
                    _shopPageIndex = 0;
                    _selectedShopItemIndex = -1;
                    _shopBuyQuantity = 1;
                    _shopBuyQuantityInput = "1";
                }
            }
        }

        private void DrawShopItemSlots(Rect detailRect)
        {
            const int columns = 5;
            const int rows = 2;
            const int pageSize = columns * rows;
            float slotSize = Mathf.Clamp(detailRect.width / 24f, 48f, 68f);
            float gap = 8f;
            float totalWidth = columns * slotSize + (columns - 1) * gap;
            float startX = detailRect.x + 32f;
            float startY = detailRect.y + 100f;
            int firstItem = _shopPageIndex * pageSize;
            int visibleIndex = 0;
            int categoryItemIndex = 0;
            string category = GetSelectedShopCategory();

            for (int i = 0; i < _shopItems.Length; i++)
            {
                if (_shopItems[i].category != category)
                {
                    continue;
                }

                if (categoryItemIndex >= firstItem && visibleIndex < pageSize)
                {
                    int row = visibleIndex / columns;
                    int col = visibleIndex % columns;
                    Rect slotRect = new Rect(startX + col * (slotSize + gap), startY + row * (slotSize + gap), slotSize, slotSize);
                    DrawShopItemSlot(slotRect, i);
                    visibleIndex++;
                }

                categoryItemIndex++;
            }

            if (categoryItemIndex == 0)
            {
                GUI.Label(new Rect(startX, startY + 26f, totalWidth, 24f), "暂无商品", _runtimeSmallStyle);
            }
        }

        private void DrawShopItemSlot(Rect slotRect, int itemIndex)
        {
            ShopItem item = _shopItems[itemIndex];
            bool selected = itemIndex == _selectedShopItemIndex;
            bool canBuy = CanBuyShopItem(item);
            GUI.backgroundColor = selected ? new Color(0.16f, 0.38f, 0.34f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (_showTownModal)
            {
                GUI.Box(slotRect, GUIContent.none, selected ? _runtimeButtonStyle : _runtimeDisabledButtonStyle);
                DrawShopItemIcon(new Rect(slotRect.x + 13f, slotRect.y + 7f, 22f, 20f), item);
                GUI.Label(new Rect(slotRect.x + 2f, slotRect.y + 28f, slotRect.width - 4f, 16f), canBuy ? GetShopItemPriceShortText(item) : "不足", _runtimeSmallStyle);
                GUI.backgroundColor = Color.white;
                return;
            }

            if (GUI.Button(slotRect, GUIContent.none, _runtimeButtonStyle))
            {
                _selectedShopItemIndex = itemIndex;
                _shopBuyQuantity = 1;
                _shopBuyQuantityInput = "1";
            }

            DrawShopItemIcon(new Rect(slotRect.x + 13f, slotRect.y + 7f, 22f, 20f), item);
            GUI.Label(new Rect(slotRect.x + 2f, slotRect.y + 28f, slotRect.width - 4f, 16f), canBuy ? GetShopItemPriceShortText(item) : "不足", _runtimeSmallStyle);
        }

        private void DrawShopItemIcon(Rect iconRect, ShopItem item)
        {
            Color baseColor = GetShopItemColor(item);
            DrawSolidRect(iconRect, baseColor);
            DrawSolidRect(new Rect(iconRect.x + 4f, iconRect.y - 4f, iconRect.width * 0.42f, iconRect.height * 0.55f), new Color(baseColor.r + 0.18f, baseColor.g + 0.18f, baseColor.b + 0.18f, 1f));
            DrawSolidRect(new Rect(iconRect.x - 4f, iconRect.y + iconRect.height - 4f, iconRect.width + 8f, 4f), new Color(0.02f, 0.025f, 0.024f, 1f));
        }

        private Color GetShopItemColor(ShopItem item)
        {
            if (item.materialId == "potion_small")
            {
                return new Color(0.74f, 0.24f, 0.22f, 1f);
            }

            if (item.category == "炼丹")
            {
                return new Color(0.34f, 0.78f, 0.52f, 1f);
            }

            if (item.category == "锻造")
            {
                return new Color(0.62f, 0.62f, 0.58f, 1f);
            }

            if (item.category == "进化")
            {
                return new Color(0.68f, 0.42f, 0.86f, 1f);
            }

            if (item.category == "招募")
            {
                return new Color(0.82f, 0.68f, 0.24f, 1f);
            }

            return new Color(0.72f, 0.5f, 0.28f, 1f);
        }

        private void DrawSelectedShopItemDetail(Rect detailRect)
        {
            float detailX = detailRect.x + detailRect.width * 0.58f;
            if (!HasSelectedShopItemInCategory())
            {
                Rect emptyBox = new Rect(detailX, detailRect.y + 100f, detailRect.xMax - detailX - 32f, 154f);
                DrawSolidRect(emptyBox, new Color(0.025f, 0.03f, 0.028f, 1f));
                GUI.Label(new Rect(emptyBox.x + 18f, emptyBox.y + 54f, emptyBox.width - 36f, 32f), "请选择商品", _runtimeInfoStyle);
                return;
            }

            ShopItem item = _shopItems[_selectedShopItemIndex];
            Rect detailBox = new Rect(detailX, detailRect.y + 100f, detailRect.xMax - detailX - 32f, 154f);
            DrawSolidRect(detailBox, new Color(0.025f, 0.03f, 0.028f, 1f));
            DrawShopItemIcon(new Rect(detailBox.x + 16f, detailBox.y + 22f, 38f, 34f), item);

            string currencyName = GetShopItemCurrencyName(item);
            string detail = $"{item.name}\n单价：{GetShopItemUnitCost(item)} {currencyName}\n数量：x{_shopBuyQuantity}    总价：{GetShopBuyTotalCost(item, _shopBuyQuantity)} {currencyName}\n{item.description}";
            GUI.Label(new Rect(detailBox.x + 68f, detailBox.y + 16f, detailBox.width - 84f, detailBox.height - 28f), detail, _runtimePanelInfoStyle);
        }

        private void DrawShopBottomActions(Rect detailRect)
        {
            const int pageSize = 10;
            string category = GetSelectedShopCategory();
            int itemCount = GetShopItemCountInCategory(category);
            int maxPage = Mathf.Max(0, (itemCount - 1) / pageSize);
            float gap = 8f;
            bool hasSelection = HasSelectedShopItemInCategory();

            DrawShopQuantityActions(detailRect, hasSelection);

            float y = detailRect.y + detailRect.height - 92f;
            float sideWidth = 58f;
            float actionWidth = Mathf.Min(520f, detailRect.width - 64f);
            float buyWidth = actionWidth - sideWidth * 2f - gap * 2f;
            Rect prevRect = new Rect(detailRect.x + (detailRect.width - actionWidth) * 0.5f, y, sideWidth, 36f);
            Rect buyRect = new Rect(prevRect.xMax + gap, y, buyWidth, 36f);
            Rect nextRect = new Rect(buyRect.xMax + gap, y, sideWidth, 36f);

            GUI.backgroundColor = _shopPageIndex > 0 ? new Color(0.18f, 0.22f, 0.22f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (_showTownModal)
            {
                GUI.Box(prevRect, "<", _runtimeDisabledButtonStyle);
            }
            else if (_shopPageIndex > 0)
            {
                if (GUI.Button(prevRect, "<", _runtimeButtonStyle))
                {
                    _shopPageIndex--;
                    _selectedShopItemIndex = -1;
                    _shopBuyQuantity = 1;
                    _shopBuyQuantityInput = "1";
                }
            }
            else
            {
                GUI.Box(prevRect, "<", _runtimeDisabledButtonStyle);
            }

            bool hasQuantityInput = !string.IsNullOrEmpty(_shopBuyQuantityInput);
            bool canBuy = hasSelection && hasQuantityInput && CanBuyShopItem(_shopItems[_selectedShopItemIndex], _shopBuyQuantity);
            GUI.backgroundColor = canBuy ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            string buyLabel = !hasSelection ? "选择商品" : !hasQuantityInput ? "输入数量" : !canBuy ? $"{GetShopItemCurrencyName(_shopItems[_selectedShopItemIndex])}不足" : $"购买 x{_shopBuyQuantity}";
            if (_showTownModal)
            {
                GUI.Box(buyRect, buyLabel, _runtimeDisabledButtonStyle);
            }
            else if (canBuy)
            {
                if (GUI.Button(buyRect, buyLabel, _runtimeButtonStyle))
                {
                    ClampShopBuyQuantity();
                    BuyShopItem(_shopItems[_selectedShopItemIndex], _shopBuyQuantity);
                }
            }
            else
            {
                GUI.Box(buyRect, buyLabel, _runtimeDisabledButtonStyle);
            }

            GUI.backgroundColor = _shopPageIndex < maxPage ? new Color(0.18f, 0.22f, 0.22f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (_showTownModal)
            {
                GUI.Box(nextRect, ">", _runtimeDisabledButtonStyle);
            }
            else if (_shopPageIndex < maxPage)
            {
                if (GUI.Button(nextRect, ">", _runtimeButtonStyle))
                {
                    _shopPageIndex++;
                    _selectedShopItemIndex = -1;
                    _shopBuyQuantity = 1;
                    _shopBuyQuantityInput = "1";
                }
            }
            else
            {
                GUI.Box(nextRect, ">", _runtimeDisabledButtonStyle);
            }
        }

        private void DrawShopQuantityActions(Rect detailRect, bool hasSelection)
        {
            float y = detailRect.y + detailRect.height - 136f;
            float gap = 8f;
            float totalWidth = Mathf.Min(360f, detailRect.width - 96f);
            float sideWidth = 48f;
            float maxWidth = 76f;
            float quantityWidth = totalWidth - sideWidth * 2f - maxWidth - gap * 3f;
            Rect minusRect = new Rect(detailRect.x + (detailRect.width - totalWidth) * 0.5f, y, sideWidth, 32f);
            Rect quantityRect = new Rect(minusRect.xMax + gap, y, quantityWidth, 32f);
            Rect plusRect = new Rect(quantityRect.xMax + gap, y, sideWidth, 32f);
            Rect maxRect = new Rect(plusRect.xMax + gap, y, maxWidth, 32f);

            if (!hasSelection)
            {
                GUI.backgroundColor = new Color(0.07f, 0.075f, 0.078f, 1f);
                GUI.Box(minusRect, "-", _runtimeDisabledButtonStyle);
                GUI.Box(quantityRect, "1", _runtimeDisabledButtonStyle);
                GUI.Box(plusRect, "+", _runtimeDisabledButtonStyle);
                GUI.Box(maxRect, "最大", _runtimeDisabledButtonStyle);
                return;
            }

            ShopItem item = _shopItems[_selectedShopItemIndex];
            int maxQuantity = GetMaxAffordableShopQuantity(item);
            bool canDecrease = _shopBuyQuantity > 1;
            bool canIncrease = _shopBuyQuantity < maxQuantity;
            bool canMax = maxQuantity > 0 && _shopBuyQuantity != maxQuantity;

            GUI.backgroundColor = canDecrease ? new Color(0.18f, 0.22f, 0.22f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (!_showTownModal && canDecrease)
            {
                if (GUI.Button(minusRect, "-", _runtimeButtonStyle))
                {
                    _shopBuyQuantity = Mathf.Max(1, _shopBuyQuantity - 1);
                    _shopBuyQuantityInput = _shopBuyQuantity.ToString();
                }
            }
            else
            {
                GUI.Box(minusRect, "-", _runtimeDisabledButtonStyle);
            }

            GUI.backgroundColor = new Color(0.028f, 0.034f, 0.032f, 1f);
            string input = GUI.TextField(quantityRect, _shopBuyQuantityInput, _runtimeMapButtonStyle);
            if (!_showTownModal && input != _shopBuyQuantityInput)
            {
                ApplyShopQuantityInput(input, maxQuantity);
            }

            GUI.backgroundColor = canIncrease ? new Color(0.18f, 0.22f, 0.22f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (!_showTownModal && canIncrease)
            {
                if (GUI.Button(plusRect, "+", _runtimeButtonStyle))
                {
                    _shopBuyQuantity = Mathf.Min(maxQuantity, _shopBuyQuantity + 1);
                    _shopBuyQuantityInput = _shopBuyQuantity.ToString();
                }
            }
            else
            {
                GUI.Box(plusRect, "+", _runtimeDisabledButtonStyle);
            }

            GUI.backgroundColor = canMax ? new Color(0.18f, 0.22f, 0.22f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (!_showTownModal && canMax)
            {
                if (GUI.Button(maxRect, "最大", _runtimeButtonStyle))
                {
                    _shopBuyQuantity = maxQuantity;
                    _shopBuyQuantityInput = _shopBuyQuantity.ToString();
                }
            }
            else
            {
                GUI.Box(maxRect, "最大", _runtimeDisabledButtonStyle);
            }
        }

        private void DrawInventoryPanelActions(Rect detailRect)
        {
            ValidateSelectedInventorySlot();
            DrawInventoryCategoryTabs(detailRect);
            DrawInventoryGrid(detailRect);
            DrawSelectedInventoryItemDetail(detailRect);
            DrawInventorySellActions(detailRect);
        }

        private void DrawInventoryCategoryTabs(Rect detailRect)
        {
            float gap = 5f;
            float tabY = detailRect.y + 54f;
            float tabWidth = (detailRect.width - 40f - gap * (_inventoryCategories.Length - 1)) / _inventoryCategories.Length;
            for (int i = 0; i < _inventoryCategories.Length; i++)
            {
                Rect tabRect = new Rect(detailRect.x + 20f + i * (tabWidth + gap), tabY, tabWidth, 28f);
                bool selected = i == _selectedInventoryCategoryIndex;
                GUI.backgroundColor = selected ? new Color(0.16f, 0.38f, 0.34f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
                if (GUI.Button(tabRect, _inventoryCategories[i], _runtimeMapButtonStyle))
                {
                    _selectedInventoryCategoryIndex = i;
                    _selectedInventorySlotIndex = 0;
                }
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawInventoryGrid(Rect detailRect)
        {
            const int columns = 5;
            float gap = 8f;
            float slotSize = Mathf.Clamp(detailRect.width / 24f, 48f, 68f);
            float startX = detailRect.x + 32f;
            float startY = detailRect.y + 96f;
            int visibleIndex = 0;

            for (int i = 0; i < _inventorySlots.Length; i++)
            {
                InventorySlot slot = _inventorySlots[i];
                if (!IsInventorySlotVisible(slot))
                {
                    continue;
                }

                int row = visibleIndex / columns;
                int col = visibleIndex % columns;
                Rect slotRect = new Rect(startX + col * (slotSize + gap), startY + row * (slotSize + gap), slotSize, slotSize);
                bool selected = visibleIndex == _selectedInventorySlotIndex;
                int count = GetInventorySlotCount(slot);
                GUI.backgroundColor = selected ? new Color(0.16f, 0.38f, 0.34f, 1f) : new Color(0.075f, 0.095f, 0.09f, 1f);
                string label = $"{GetInventorySlotName(slot)}\nx{count}";
                if (GUI.Button(slotRect, label, _runtimeMapButtonStyle))
                {
                    _selectedInventorySlotIndex = visibleIndex;
                }

                visibleIndex++;
            }

            if (visibleIndex == 0)
            {
                GUI.Label(new Rect(startX, startY + 22f, detailRect.width * 0.48f, 24f), "当前分类暂无物品", _runtimeSmallStyle);
            }
        }

        private void DrawSelectedInventoryItemDetail(Rect detailRect)
        {
            InventorySlot slot = GetSelectedInventorySlot();
            int count = GetInventorySlotCount(slot);
            bool tradable = slot.sellPrice > 0 && IsMaterialTradable(slot.materialId);
            float detailX = detailRect.x + detailRect.width * 0.58f;
            Rect detailBox = new Rect(detailX, detailRect.y + 96f, detailRect.xMax - detailX - 32f, 156f);
            DrawSolidRect(detailBox, new Color(0.025f, 0.03f, 0.028f, 1f));

            string sellText = slot.sellPrice > 0 && tradable ? $"卖价：{slot.sellPrice} {GetMaterialName("spirit_dust")}" : "不可出售";
            string detail = $"{GetInventorySlotName(slot)}\n数量：{count}\n{sellText}\n{GetInventorySlotDescription(slot)}";
            GUI.Label(new Rect(detailBox.x + 18f, detailBox.y + 18f, detailBox.width - 36f, detailBox.height - 32f), detail, _runtimePanelInfoStyle);
        }

        private void DrawInventorySellActions(Rect detailRect)
        {
            InventorySlot slot = GetSelectedInventorySlot();
            int count = GetInventorySlotCount(slot);
            bool canSell = count > 0 && slot.sellPrice > 0 && IsMaterialTradable(slot.materialId);
            float gap = 8f;
            float y = detailRect.y + detailRect.height - 92f;
            float actionWidth = Mathf.Min(420f, detailRect.width - 64f);
            float buttonWidth = (actionWidth - gap) * 0.5f;
            Rect sellOneRect = new Rect(detailRect.x + (detailRect.width - actionWidth) * 0.5f, y, buttonWidth, 36f);
            Rect sellAllRect = new Rect(sellOneRect.xMax + gap, y, buttonWidth, 36f);

            GUI.backgroundColor = canSell ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (canSell)
            {
                if (GUI.Button(sellOneRect, "卖 1", _runtimeButtonStyle))
                {
                    SellInventorySlot(slot, 1);
                }

                if (GUI.Button(sellAllRect, "全卖", _runtimeButtonStyle))
                {
                    SellInventorySlot(slot, count);
                }
            }
            else
            {
                GUI.Box(sellOneRect, "卖 1", _runtimeDisabledButtonStyle);
                GUI.Box(sellAllRect, "全卖", _runtimeDisabledButtonStyle);
            }
        }

        private string BuildCharacterInfo()
        {
            if (battleManager == null || battleManager.hero == null)
            {
                return "角色数据未初始化。";
            }

            EnsureRecruitState();
            Hero hero = battleManager.hero;
            return $"主角  等级 {_heroLevel}    经验 {_heroExp}/{GetExpRequiredForLevel(_heroLevel)}\n生命 {hero.maxHp}    攻击 {hero.attack}    防御 {hero.defense}\n阶段：{GetEvolutionStageName(_evolutionStage)}\n装备加成：攻击 +{GetEquippedAttackBonus()}  生命 +{GetEquippedHpBonus()}  防御 +{GetEquippedDefenseBonus()}\n丹药加成：生命 +{GetBodyPillHpBonus()}\n进化加成：生命 +{GetEvolutionHpBonus()}  攻击 +{GetEvolutionAttackBonus()}  防御 +{GetEvolutionDefenseBonus()}\n\n队伍\n1. 主角 / 游侠 / 前排 / 已参战\n2. {GetTeamSlotText(2)}\n3. {GetTeamSlotText(3)}\n{GetNextTeamUnlockText()}";
        }

        private void DrawCharacterPanelActions(Rect detailRect)
        {
            Rect tabRect = new Rect(detailRect.x + 42f, detailRect.y + 58f, detailRect.width - 84f, 32f);
            DrawCharacterTabs(tabRect);

            Rect contentRect = new Rect(detailRect.x + 42f, tabRect.yMax + 12f, detailRect.width - 84f, detailRect.yMax - tabRect.yMax - 50f);
            if (_selectedCharacterTab == CharacterTab.Stats)
            {
                DrawCharacterStatCard(contentRect);
                return;
            }

            if (_selectedCharacterTab == CharacterTab.Formation)
            {
                DrawCharacterFormationPanel(contentRect);
                return;
            }

            DrawCharacterRecruitRoster(contentRect);
        }

        private void DrawCharacterTabs(Rect rect)
        {
            float gap = 8f;
            float tabWidth = (rect.width - gap * 2f) / 3f;
            DrawCharacterTabButton(new Rect(rect.x, rect.y, tabWidth, rect.height), CharacterTab.Stats, "属性");
            DrawCharacterTabButton(new Rect(rect.x + tabWidth + gap, rect.y, tabWidth, rect.height), CharacterTab.Formation, "布阵");
            DrawCharacterTabButton(new Rect(rect.x + (tabWidth + gap) * 2f, rect.y, tabWidth, rect.height), CharacterTab.Roster, "名册");
            GUI.backgroundColor = Color.white;
        }

        private void DrawCharacterTabButton(Rect rect, CharacterTab tab, string label)
        {
            bool selected = _selectedCharacterTab == tab;
            GUI.backgroundColor = selected ? new Color(0.16f, 0.38f, 0.34f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (GUI.Button(rect, label, selected ? _runtimeButtonStyle : _runtimeMapButtonStyle))
            {
                _selectedCharacterTab = tab;
            }
        }

        private void DrawCharacterStatCard(Rect rect)
        {
            DrawSolidRect(rect, new Color(0.025f, 0.03f, 0.028f, 1f));

            if (battleManager == null || battleManager.hero == null)
            {
                GUI.Label(new Rect(rect.x + 18f, rect.y + 18f, rect.width - 36f, rect.height - 36f), "角色数据未初始化。", _runtimePanelInfoStyle);
                return;
            }

            float listWidth = Mathf.Clamp(rect.width * 0.28f, 150f, 220f);
            Rect listRect = new Rect(rect.x + 18f, rect.y + 18f, listWidth, rect.height - 36f);
            Rect detailRect = new Rect(listRect.xMax + 14f, rect.y + 18f, rect.xMax - listRect.xMax - 32f, rect.height - 36f);
            DrawCharacterStatSelector(listRect);
            if (_selectedCharacterStatIndex < 0)
            {
                DrawHeroStatDetail(detailRect);
            }
            else
            {
                DrawRecruitStatDetail(detailRect, _selectedCharacterStatIndex);
            }
        }

        private void DrawCharacterStatSelector(Rect rect)
        {
            EnsureRecruitState();
            DrawSolidRect(rect, new Color(0.035f, 0.04f, 0.038f, 1f));
            GUI.Label(new Rect(rect.x + 12f, rect.y + 10f, rect.width - 24f, 24f), "角色", _runtimeInfoStyle);

            float rowY = rect.y + 42f;
            float rowHeight = 34f;
            DrawCharacterStatSelectorButton(new Rect(rect.x + 10f, rowY, rect.width - 20f, rowHeight), -1, "主角");
            rowY += rowHeight + 8f;
            for (int i = 0; i < _recruitCandidates.Length; i++)
            {
                if (!IsRecruitOwned(i))
                {
                    continue;
                }

                DrawCharacterStatSelectorButton(new Rect(rect.x + 10f, rowY, rect.width - 20f, rowHeight), i, _recruitCandidates[i].name);
                rowY += rowHeight + 8f;
            }
        }

        private void DrawCharacterStatSelectorButton(Rect rect, int index, string label)
        {
            bool selected = _selectedCharacterStatIndex == index;
            GUI.backgroundColor = selected ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.055f, 0.062f, 0.058f, 1f);
            if (GUI.Button(rect, label, selected ? _runtimeButtonStyle : _runtimeMapButtonStyle))
            {
                _selectedCharacterStatIndex = index;
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawHeroStatDetail(Rect rect)
        {
            DrawSolidRect(rect, new Color(0.025f, 0.03f, 0.028f, 1f));
            Hero hero = battleManager.hero;
            Rect portraitRect = new Rect(rect.x + 18f, rect.y + 16f, Mathf.Min(104f, rect.width * 0.32f), 112f);
            DrawSolidRect(portraitRect, new Color(0.055f, 0.065f, 0.06f, 1f));
            DrawSolidRect(new Rect(portraitRect.x + portraitRect.width * 0.5f - 16f, portraitRect.y + 14f, 32f, 30f), new Color(0.6f, 0.28f, 0.18f, 1f));
            DrawSolidRect(new Rect(portraitRect.x + portraitRect.width * 0.5f - 28f, portraitRect.y + 52f, 56f, 44f), new Color(0.12f, 0.32f, 0.29f, 1f));

            GUIStyle leftInfoStyle = new GUIStyle(_runtimePanelInfoStyle);
            leftInfoStyle.wordWrap = false;
            leftInfoStyle.fontSize = Mathf.Max(11, leftInfoStyle.fontSize - 1);
            Rect nameRect = new Rect(portraitRect.xMax + 16f, rect.y + 16f, rect.xMax - portraitRect.xMax - 34f, 112f);
            string nameText = $"主角\n游侠 / 前排\n等级 {_heroLevel}    经验 {_heroExp}/{GetExpRequiredForLevel(_heroLevel)}\n阶段：{GetEvolutionStageName(_evolutionStage)}";
            GUI.Label(nameRect, nameText, leftInfoStyle);

            float gridY = portraitRect.yMax + 18f;
            float gridGap = 8f;
            float cellWidth = (rect.width - 48f - gridGap) * 0.5f;
            float cellHeight = 44f;
            DrawCharacterStatRow(new Rect(rect.x + 24f, gridY, cellWidth, cellHeight), "基础", $"生{hero.maxHp} 攻{hero.attack} 防{hero.defense}");
            DrawCharacterStatRow(new Rect(rect.x + 24f + cellWidth + gridGap, gridY, cellWidth, cellHeight), "装备", $"生+{GetEquippedHpBonus()} 攻+{GetEquippedAttackBonus()} 防+{GetEquippedDefenseBonus()}");
            DrawCharacterStatRow(new Rect(rect.x + 24f, gridY + cellHeight + gridGap, cellWidth, cellHeight), "丹药", $"生+{GetBodyPillHpBonus()}");
            DrawCharacterStatRow(new Rect(rect.x + 24f + cellWidth + gridGap, gridY + cellHeight + gridGap, cellWidth, cellHeight), "进化", $"生+{GetEvolutionHpBonus()} 攻+{GetEvolutionAttackBonus()} 防+{GetEvolutionDefenseBonus()}");
        }

        private void DrawRecruitStatDetail(Rect rect, int recruitIndex)
        {
            DrawSolidRect(rect, new Color(0.025f, 0.03f, 0.028f, 1f));
            if (!IsRecruitOwned(recruitIndex))
            {
                GUI.Label(new Rect(rect.x + 18f, rect.y + 18f, rect.width - 36f, 30f), "该角色尚未招募。", _runtimeSmallStyle);
                return;
            }

            RecruitCandidate recruit = _recruitCandidates[recruitIndex];
            Rect portraitRect = new Rect(rect.x + 18f, rect.y + 16f, Mathf.Min(104f, rect.width * 0.28f), 112f);
            Color recruitColor = GetRecruitFormationColor(recruitIndex);
            DrawSolidRect(portraitRect, new Color(0.055f, 0.065f, 0.06f, 1f));
            DrawSolidRect(new Rect(portraitRect.x + 22f, portraitRect.y + 18f, portraitRect.width - 44f, 28f), recruitColor);
            DrawSolidRect(new Rect(portraitRect.x + 16f, portraitRect.y + 54f, portraitRect.width - 32f, 42f), recruitColor);

            GUIStyle infoStyle = new GUIStyle(_runtimePanelInfoStyle);
            infoStyle.wordWrap = true;
            infoStyle.fontSize = Mathf.Max(11, infoStyle.fontSize - 1);
            Rect infoRect = new Rect(portraitRect.xMax + 16f, rect.y + 16f, rect.xMax - portraitRect.xMax - 34f, 112f);
            GUI.Label(infoRect, $"{recruit.name}\n{recruit.rarity} / {recruit.role} / {recruit.position}\n{GetRecruitStarText(recruitIndex)}    碎片 {GetRecruitFragments(recruitIndex)}\n{GetRecruitIntro(recruitIndex)}", infoStyle);

            float gridY = portraitRect.yMax + 18f;
            float gridGap = 8f;
            float cellWidth = (rect.width - 48f - gridGap) * 0.5f;
            float cellHeight = 44f;
            DrawCharacterStatRow(new Rect(rect.x + 24f, gridY, cellWidth, cellHeight), "属性", $"生{GetRecruitHp(recruitIndex)} 攻{GetRecruitAttack(recruitIndex)} 防{GetRecruitDefense(recruitIndex)}");
            DrawCharacterStatRow(new Rect(rect.x + 24f + cellWidth + gridGap, gridY, cellWidth, cellHeight), "普攻", $"{GetRecruitAttack(recruitIndex)} 伤害");
            DrawCharacterStatRow(new Rect(rect.x + 24f, gridY + cellHeight + gridGap, cellWidth, cellHeight), GetRecruitSkillOneName(recruitIndex), $"{GetRecruitSkillOneDamage(recruitIndex)} 伤害");
            DrawCharacterStatRow(new Rect(rect.x + 24f + cellWidth + gridGap, gridY + cellHeight + gridGap, cellWidth, cellHeight), GetRecruitSkillTwoName(recruitIndex), $"{GetRecruitSkillTwoDamage(recruitIndex)} 伤害");
        }

        private void DrawCharacterStatRow(Rect rect, string label, string value)
        {
            DrawSolidRect(rect, new Color(0.045f, 0.052f, 0.05f, 1f));
            GUIStyle labelStyle = new GUIStyle(_runtimeSmallStyle);
            labelStyle.alignment = TextAnchor.UpperLeft;
            labelStyle.wordWrap = false;
            labelStyle.fontSize = Mathf.Max(10, _runtimeSmallStyle.fontSize - 2);
            GUI.Label(new Rect(rect.x + 8f, rect.y + 4f, rect.width - 16f, 16f), label, labelStyle);

            GUIStyle valueStyle = new GUIStyle(_runtimeSmallStyle);
            valueStyle.alignment = TextAnchor.LowerLeft;
            valueStyle.wordWrap = false;
            valueStyle.fontSize = Mathf.Max(10, _runtimeSmallStyle.fontSize - 2);
            GUI.Label(new Rect(rect.x + 8f, rect.y + 19f, rect.width - 16f, rect.height - 22f), value, valueStyle);
        }

        private void DrawCharacterTeamCards(Rect rect)
        {
            EnsureRecruitState();
            DrawSolidRect(rect, new Color(0.025f, 0.03f, 0.028f, 1f));
            GUI.Label(new Rect(rect.x + 18f, rect.y + 16f, rect.width - 36f, 28f), "队伍槽", _runtimeInfoStyle);

            float cardGap = 10f;
            float top = rect.y + 44f;
            float cardHeight = Mathf.Clamp((rect.height - 54f - cardGap * 2f) / 3f, 30f, 58f);
            DrawCharacterTeamSlotCard(new Rect(rect.x + 18f, top, rect.width - 36f, cardHeight), 1, "主角", "游侠", "前排", "参战", true);
            DrawRecruitTeamSlotCard(new Rect(rect.x + 18f, top + cardHeight + cardGap, rect.width - 36f, cardHeight), 2, _heroLevel >= 3, 3, _teamRecruitSlot2Index);
            DrawRecruitTeamSlotCard(new Rect(rect.x + 18f, top + (cardHeight + cardGap) * 2f, rect.width - 36f, cardHeight), 3, _heroLevel >= 6, 6, _teamRecruitSlot3Index);
        }

        private void DrawCharacterFormationPanel(Rect rect)
        {
            EnsureRecruitState();
            EnsureFormationState();
            ValidateRecruitSelections();
            float gap = 14f;
            float gridWidth = Mathf.Clamp(rect.width * 0.48f, 300f, 430f);
            Rect gridRect = new Rect(rect.x, rect.y, gridWidth, rect.height);
            Rect detailRect = new Rect(gridRect.xMax + gap, rect.y, rect.xMax - gridRect.xMax - gap, rect.height);

            DrawFormationGrid(gridRect);
            DrawFormationRecruitPanel(detailRect);
        }

        private void DrawFormationGrid(Rect rect)
        {
            DrawSolidRect(rect, new Color(0.025f, 0.03f, 0.028f, 1f));
            GUI.Label(new Rect(rect.x + 18f, rect.y + 12f, rect.width - 36f, 24f), "九宫布阵", _runtimeInfoStyle);
            GUI.Label(new Rect(rect.x + 18f, rect.y + 38f, rect.width - 36f, 20f), "先选阵位，再选队友，最后确认上阵。", _runtimeSmallStyle);

            float gap = 8f;
            float availableWidth = rect.width - 36f - gap * 2f;
            float availableHeight = rect.height - 74f - gap * 2f;
            float cellSize = Mathf.Floor(Mathf.Min(availableWidth / 3f, availableHeight / 3f));
            cellSize = Mathf.Clamp(cellSize, 48f, 104f);
            float startX = rect.x + (rect.width - cellSize * 3f - gap * 2f) * 0.5f;
            float startY = rect.y + 64f;

            for (int slot = 0; slot < FormationSlotCount; slot++)
            {
                int row = slot / 3;
                int col = slot % 3;
                Rect cellRect = new Rect(startX + col * (cellSize + gap), startY + row * (cellSize + gap), cellSize, cellSize);
                DrawFormationCell(cellRect, slot);
            }

            Rect hintRect = new Rect(rect.x + 18f, rect.yMax - 22f, rect.width - 36f, 18f);
            GUI.Label(hintRect, GetFormationSelectionHint(), _runtimeSmallStyle);
        }

        private void DrawFormationCell(Rect rect, int slotIndex)
        {
            bool isHeroSlot = slotIndex == HeroFormationSlot;
            int recruitIndex = GetFormationRecruitSlot(slotIndex);
            bool hasRecruit = IsRecruitOwned(recruitIndex);
            bool selectedSlot = slotIndex == _selectedFormationSlotIndex;
            Color baseColor = isHeroSlot
                ? new Color(0.10f, 0.22f, 0.30f, 1f)
                : hasRecruit ? new Color(0.055f, 0.075f, 0.066f, 1f) : new Color(0.04f, 0.045f, 0.044f, 1f);
            GUI.backgroundColor = selectedSlot ? new Color(0.14f, 0.36f, 0.32f, 1f) : baseColor;

            string label;
            if (isHeroSlot)
            {
                label = "主角\n游侠";
            }
            else if (hasRecruit)
            {
                label = $"{_recruitCandidates[recruitIndex].name}\n{GetRecruitStarText(recruitIndex)}";
            }
            else
            {
                label = "空位";
            }

            if (GUI.Button(rect, label, hasRecruit || isHeroSlot ? _runtimeButtonStyle : _runtimeMapButtonStyle))
            {
                HandleFormationCellClick(slotIndex);
            }

            GUI.backgroundColor = Color.white;
        }

        private void HandleFormationCellClick(int slotIndex)
        {
            if (slotIndex == HeroFormationSlot)
            {
                ShowTownModal("主角固定", "主角固定在当前 MVP 的左侧中位，后续开放主角换位时再解锁。");
                return;
            }

            int currentRecruit = GetFormationRecruitSlot(slotIndex);
            if (_selectedFormationSlotIndex == slotIndex && IsRecruitOwned(currentRecruit) && !IsRecruitOwned(_selectedRecruitRosterIndex))
            {
                ClearFormationSlot(slotIndex);
                _townNotice = "角色阁：已清空该阵位。";
                SaveProgress();
                ApplyBattleFormation();
                return;
            }

            _selectedFormationSlotIndex = slotIndex;
            if (IsRecruitOwned(currentRecruit))
            {
                _selectedRecruitRosterIndex = currentRecruit;
                _townNotice = $"角色阁：已选择阵位 {GetFormationSlotLabel(slotIndex)}，当前为 {_recruitCandidates[currentRecruit].name}。";
            }
            else
            {
                _townNotice = $"角色阁：已选择阵位 {GetFormationSlotLabel(slotIndex)}。";
            }
        }

        private void DrawFormationRecruitPanel(Rect rect)
        {
            DrawSolidRect(rect, new Color(0.025f, 0.03f, 0.028f, 1f));
            GUI.Label(new Rect(rect.x + 18f, rect.y + 12f, rect.width - 36f, 24f), "队友", _runtimeInfoStyle);

            int ownedCount = GetOwnedRecruitCount();
            if (ownedCount <= 0)
            {
                GUI.Label(new Rect(rect.x + 18f, rect.y + 46f, rect.width - 36f, 30f), "暂无队友，可前往招贤阁招募。", _runtimeSmallStyle);
                return;
            }

            Rect listRect = new Rect(rect.x + 18f, rect.y + 44f, rect.width - 36f, rect.height - 94f);
            float actionGap = 8f;
            float actionWidth = (rect.width - 36f - actionGap) * 0.5f;
            Rect clearRect = new Rect(rect.x + 18f, rect.yMax - 40f, actionWidth, 30f);
            Rect actionRect = new Rect(clearRect.xMax + actionGap, rect.yMax - 40f, actionWidth, 30f);

            DrawRecruitNameList(listRect);
            DrawFormationClearAction(clearRect);
            DrawFormationConfirmAction(actionRect);
        }

        private void DrawRecruitNameList(Rect rect)
        {
            DrawSolidRect(rect, new Color(0.035f, 0.04f, 0.038f, 1f));
            int ownedCount = GetOwnedRecruitCount();
            float rowGap = 6f;
            float rowY = rect.y + 10f;
            float rowHeight = Mathf.Clamp((rect.height - 20f - rowGap * Mathf.Max(0, ownedCount - 1)) / Mathf.Max(1, ownedCount), 28f, 40f);
            int visibleOrder = 0;
            for (int i = 0; i < _recruitCandidates.Length; i++)
            {
                if (!IsRecruitOwned(i))
                {
                    continue;
                }

                Rect rowRect = new Rect(rect.x + 8f, rowY + visibleOrder * (rowHeight + rowGap), rect.width - 16f, rowHeight);
                DrawRecruitNameRow(rowRect, i);
                visibleOrder++;
            }
        }

        private void DrawRecruitNameRow(Rect rect, int recruitIndex)
        {
            RecruitCandidate recruit = _recruitCandidates[Mathf.Clamp(recruitIndex, 0, _recruitCandidates.Length - 1)];
            bool selected = recruitIndex == _selectedRecruitRosterIndex;
            GUI.backgroundColor = selected ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.055f, 0.062f, 0.058f, 1f);
            if (GUI.Button(rect, recruit.name, selected ? _runtimeButtonStyle : _runtimeMapButtonStyle))
            {
                _selectedRecruitRosterIndex = recruitIndex;
            }

            GUI.backgroundColor = Color.white;
        }

        private string GetFormationSelectionHint()
        {
            string slotText = _selectedFormationSlotIndex >= 0 && _selectedFormationSlotIndex < FormationSlotCount && _selectedFormationSlotIndex != HeroFormationSlot
                ? $"阵位 {GetFormationSlotLabel(_selectedFormationSlotIndex)}"
                : "未选阵位";
            string recruitText = IsRecruitOwned(_selectedRecruitRosterIndex)
                ? _recruitCandidates[_selectedRecruitRosterIndex].name
                : "未选队友";
            return $"{slotText} / {recruitText}";
        }

        private void DrawFormationConfirmAction(Rect rect)
        {
            bool hasSlot = _selectedFormationSlotIndex >= 0 && _selectedFormationSlotIndex < FormationSlotCount && _selectedFormationSlotIndex != HeroFormationSlot;
            bool hasRecruit = IsRecruitOwned(_selectedRecruitRosterIndex);
            string label = hasSlot && hasRecruit ? "确认上阵" : hasSlot ? "选择队友" : "先选阵位";
            GUI.backgroundColor = hasSlot && hasRecruit ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (GUI.Button(rect, label, hasSlot && hasRecruit ? _runtimeButtonStyle : _runtimeDisabledButtonStyle))
            {
                if (hasSlot && hasRecruit)
                {
                    PlaceSelectedRecruitInFormation(_selectedFormationSlotIndex);
                    SaveProgress();
                    ApplyBattleFormation();
                }
                else
                {
                    ShowTownModal("布阵未完成", hasSlot ? "请选择右侧一个已招募队友。" : "请先点击左侧九宫格中的一个非主角阵位。");
                }
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawFormationClearAction(Rect rect)
        {
            bool hasSlot = _selectedFormationSlotIndex >= 0 && _selectedFormationSlotIndex < FormationSlotCount && _selectedFormationSlotIndex != HeroFormationSlot;
            bool hasRecruitInSlot = hasSlot && IsRecruitOwned(GetFormationRecruitSlot(_selectedFormationSlotIndex));
            GUI.backgroundColor = hasRecruitInSlot ? new Color(0.18f, 0.22f, 0.22f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (GUI.Button(rect, "清空阵位", hasRecruitInSlot ? _runtimeButtonStyle : _runtimeDisabledButtonStyle))
            {
                if (hasRecruitInSlot)
                {
                    ClearFormationSlot(_selectedFormationSlotIndex);
                    _townNotice = "角色阁：已清空该阵位。";
                    SaveProgress();
                    ApplyBattleFormation();
                }
                else
                {
                    ShowTownModal("无法清空", hasSlot ? "当前阵位没有队友。" : "请先选择一个非主角阵位。");
                }
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawSelectedRecruitDetail(Rect rect, bool showFormationAction)
        {
            DrawSolidRect(rect, new Color(0.035f, 0.04f, 0.038f, 1f));
            if (!IsRecruitOwned(_selectedRecruitRosterIndex))
            {
                GUI.Label(new Rect(rect.x + 12f, rect.y + 12f, rect.width - 24f, rect.height - 24f), "选择左侧姓名查看简介和技能。", _runtimeSmallStyle);
                return;
            }

            RecruitCandidate recruit = _recruitCandidates[_selectedRecruitRosterIndex];
            GUI.Label(new Rect(rect.x + 12f, rect.y + 10f, rect.width - 24f, 26f), recruit.name, _runtimeInfoStyle);
            string detail = $"{recruit.rarity} / {recruit.role} / {recruit.position} / {GetRecruitStarText(_selectedRecruitRosterIndex)}\n碎片 {GetRecruitFragments(_selectedRecruitRosterIndex)}\n\n简介：{GetRecruitIntro(_selectedRecruitRosterIndex)}\n技能：{GetRecruitSkillSummary(_selectedRecruitRosterIndex)}";
            GUI.Label(new Rect(rect.x + 12f, rect.y + 42f, rect.width - 24f, rect.height - 86f), detail, _runtimeSmallStyle);

            if (showFormationAction)
            {
                Rect actionRect = new Rect(rect.x + 12f, rect.yMax - 34f, rect.width - 24f, 26f);
                GUI.backgroundColor = new Color(0.12f, 0.32f, 0.29f, 1f);
                if (GUI.Button(actionRect, "选择后点击左侧阵位", _runtimeButtonStyle))
                {
                    _townNotice = $"角色阁：已选中 {recruit.name}，点击左侧空位上阵。";
                }

                GUI.backgroundColor = Color.white;
            }
        }

        private void DrawRecruitTeamSlotCard(Rect rect, int slotIndex, bool unlocked, int requiredLevel, int recruitIndex)
        {
            if (!unlocked)
            {
                DrawCharacterTeamSlotCard(rect, slotIndex, "未解锁", $"主角等级 {requiredLevel}", "待解锁", "升级后解锁", false);
                return;
            }

            if (!IsRecruitOwned(recruitIndex))
            {
                DrawCharacterTeamSlotCard(rect, slotIndex, "未招募队友", "职业待选择", slotIndex == 2 ? "中排" : "后排", "前往招贤阁", true);
                return;
            }

            RecruitCandidate recruit = _recruitCandidates[recruitIndex];
            DrawCharacterTeamSlotCard(rect, slotIndex, recruit.name, recruit.role, recruit.position, $"{GetRecruitStarText(recruitIndex)} / 备战", true);
        }

        private void DrawCharacterTeamSlotCard(Rect rect, int slotIndex, string name, string role, string position, string status, bool unlocked)
        {
            DrawSolidRect(rect, unlocked ? new Color(0.055f, 0.075f, 0.066f, 1f) : new Color(0.035f, 0.04f, 0.04f, 1f));
            DrawSolidRect(new Rect(rect.x + 10f, rect.y + 10f, 42f, rect.height - 20f), unlocked ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.08f, 0.085f, 0.085f, 1f));
            GUI.Label(new Rect(rect.x + 10f, rect.y + 10f, 42f, rect.height - 20f), slotIndex.ToString(), _runtimeInfoStyle);

            GUIStyle cardStyle = new GUIStyle(_runtimeSmallStyle);
            cardStyle.alignment = TextAnchor.MiddleLeft;
            cardStyle.wordWrap = false;
            string text = rect.height < 48f
                ? $"{name}  {role}/{position}  {status}"
                : $"{name}\n{role} / {position} / {status}";
            GUI.Label(new Rect(rect.x + 66f, rect.y + 4f, rect.width - 80f, rect.height - 8f), text, cardStyle);
        }

        private void DrawCharacterRecruitRoster(Rect rect)
        {
            EnsureRecruitState();
            ValidateRecruitSelections();
            DrawSolidRect(rect, new Color(0.025f, 0.03f, 0.028f, 1f));
            GUI.Label(new Rect(rect.x + 18f, rect.y + 12f, rect.width - 36f, 24f), "已招募名册", _runtimeInfoStyle);

            int ownedCount = GetOwnedRecruitCount();
            if (ownedCount <= 0)
            {
                GUI.Label(new Rect(rect.x + 18f, rect.y + 50f, rect.width - 36f, 28f), "暂无已招募队友，可前往招贤阁招募。", _runtimeSmallStyle);
                return;
            }

            float listWidth = Mathf.Clamp(rect.width * 0.36f, 140f, 220f);
            Rect listRect = new Rect(rect.x + 16f, rect.y + 44f, listWidth, rect.height - 58f);
            Rect detailRect = new Rect(listRect.xMax + 12f, rect.y + 44f, rect.xMax - listRect.xMax - 28f, rect.height - 58f);
            DrawRecruitNameList(listRect);
            DrawSelectedRecruitDetail(new Rect(detailRect.x, detailRect.y, detailRect.width, detailRect.height - 46f), false);
            DrawRecruitSynthesisAction(new Rect(detailRect.x, detailRect.yMax - 36f, detailRect.width, 30f));
        }

        private void DrawRecruitRosterRow(Rect rect, int recruitIndex)
        {
            RecruitCandidate recruit = _recruitCandidates[Mathf.Clamp(recruitIndex, 0, _recruitCandidates.Length - 1)];
            bool selected = recruitIndex == _selectedRecruitRosterIndex;
            Color baseColor = recruit.rarity == "稀有" ? new Color(0.07f, 0.065f, 0.043f, 1f) : new Color(0.045f, 0.052f, 0.05f, 1f);
            GUI.backgroundColor = selected ? new Color(0.12f, 0.32f, 0.29f, 1f) : baseColor;
            if (GUI.Button(rect, GUIContent.none, selected ? _runtimeButtonStyle : _runtimeMapButtonStyle))
            {
                _selectedRecruitRosterIndex = recruitIndex;
            }

            GUIStyle rowStyle = new GUIStyle(_runtimeSmallStyle);
            rowStyle.alignment = TextAnchor.MiddleLeft;
            rowStyle.wordWrap = false;
            rowStyle.fontSize = Mathf.Max(11, _runtimeSmallStyle.fontSize - 2);
            string text = $"{recruit.rarity}  {recruit.name}    {recruit.role} / {recruit.position}    {GetRecruitStarText(recruitIndex)}    碎片 {GetRecruitFragments(recruitIndex)}";
            GUI.Label(new Rect(rect.x + 12f, rect.y + 2f, rect.width - 24f, rect.height - 4f), text, rowStyle);
            GUI.backgroundColor = Color.white;
        }

        private void DrawRecruitSynthesisAction(Rect rect)
        {
            bool hasSelection = IsRecruitOwned(_selectedRecruitRosterIndex);
            bool canSynthesize = hasSelection && CanSynthesizeRecruit(_selectedRecruitRosterIndex);
            string synthLabel = !hasSelection ? "选队友" : canSynthesize ? $"升至{GetRecruitRank(_selectedRecruitRosterIndex) + 1}星 {GetRecruitSynthesisCost(_selectedRecruitRosterIndex)}" : GetRecruitSynthesisBlockLabel(_selectedRecruitRosterIndex);
            GUI.backgroundColor = canSynthesize ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (GUI.Button(rect, synthLabel, canSynthesize ? _runtimeButtonStyle : _runtimeDisabledButtonStyle))
            {
                if (canSynthesize)
                {
                    SynthesizeSelectedRecruit();
                }
                else if (hasSelection)
                {
                    ShowTownModal("碎片不足", BuildRecruitSynthesisBlockMessage(_selectedRecruitRosterIndex));
                }
            }

            GUI.backgroundColor = Color.white;
        }

        private bool CanSynthesizeRecruit(int recruitIndex)
        {
            return IsRecruitOwned(recruitIndex)
                && GetRecruitRank(recruitIndex) < GetRecruitMaxRank()
                && GetRecruitFragments(recruitIndex) >= GetRecruitSynthesisCost(recruitIndex);
        }

        private void SynthesizeSelectedRecruit()
        {
            int recruitIndex = _selectedRecruitRosterIndex;
            if (!IsRecruitOwned(recruitIndex))
            {
                ShowTownModal("请选择队友", "先在已招募名册中选择一个队友。");
                return;
            }

            if (!CanSynthesizeRecruit(recruitIndex))
            {
                ShowTownModal("无法合成", BuildRecruitSynthesisBlockMessage(recruitIndex));
                return;
            }

            int cost = GetRecruitSynthesisCost(recruitIndex);
            _recruitFragments[recruitIndex] -= cost;
            _recruitRanks[recruitIndex] = Mathf.Clamp(_recruitRanks[recruitIndex] + 1, 1, GetRecruitMaxRank());

            RecruitCandidate recruit = _recruitCandidates[recruitIndex];
            _townNotice = $"角色阁：{recruit.name} 升至 {_recruitRanks[recruitIndex]} 星。";
            ShowTownModal("升星成功", $"{recruit.name} {_recruitRanks[recruitIndex]} 星\n消耗碎片：{cost}\n剩余碎片：{_recruitFragments[recruitIndex]}");
            SaveProgress();
        }

        private int GetRecruitMaxRank()
        {
            return 10;
        }

        private int GetRecruitSynthesisCost(int recruitIndex)
        {
            int nextStar = Mathf.Clamp(GetRecruitRank(recruitIndex) + 1, 2, GetRecruitMaxRank());
            switch (nextStar)
            {
                case 2:
                    return 20;
                case 3:
                    return 40;
                case 4:
                    return 70;
                case 5:
                    return 110;
                case 6:
                    return 160;
                case 7:
                    return 220;
                case 8:
                    return 290;
                case 9:
                    return 370;
                default:
                    return 460;
            }
        }

        private string GetRecruitSynthesisBlockLabel(int recruitIndex)
        {
            if (!IsRecruitOwned(recruitIndex))
            {
                return "选择队友";
            }

            int currentStar = GetRecruitRank(recruitIndex);
            if (currentStar >= GetRecruitMaxRank())
            {
                return "已满星";
            }

            return $"升至{currentStar + 1}星 碎片{GetRecruitFragments(recruitIndex)}/{GetRecruitSynthesisCost(recruitIndex)}";
        }

        private string BuildRecruitSynthesisBlockMessage(int recruitIndex)
        {
            if (!IsRecruitOwned(recruitIndex))
            {
                return "先在已招募名册中选择一个队友。";
            }

            RecruitCandidate recruit = _recruitCandidates[recruitIndex];
            if (GetRecruitRank(recruitIndex) >= GetRecruitMaxRank())
            {
                return $"{recruit.name} 已达到 10 星。";
            }

            return $"{recruit.name} 升至 {GetRecruitRank(recruitIndex) + 1} 星需要：\n碎片 {GetRecruitSynthesisCost(recruitIndex)}\n当前持有：{GetRecruitFragments(recruitIndex)}";
        }

        private string GetTeamSlotText(int slotIndex)
        {
            int formationSlot = slotIndex == 2 ? 4 : 7;
            int recruitIndex = GetFormationRecruitSlot(formationSlot);
            if (!IsRecruitOwned(recruitIndex))
            {
                return slotIndex == 2 ? "中位空位 / 前往布阵" : "后位空位 / 前往布阵";
            }

            RecruitCandidate recruit = _recruitCandidates[recruitIndex];
            return $"{recruit.name} / {recruit.role} / {recruit.position} / {GetRecruitStarText(recruitIndex)}";
        }

        private string GetNextTeamUnlockText()
        {
            return "布阵页已开放 3x3 站位；当前战斗先同步站位视觉。";
        }

        private void EnsureFormationState()
        {
            if (_formationRecruitSlots == null || _formationRecruitSlots.Length != FormationSlotCount)
            {
                _formationRecruitSlots = new int[FormationSlotCount];
                for (int i = 0; i < _formationRecruitSlots.Length; i++)
                {
                    _formationRecruitSlots[i] = -1;
                }
            }
        }

        private int GetFormationRecruitSlot(int slotIndex)
        {
            EnsureFormationState();
            if (slotIndex < 0 || slotIndex >= _formationRecruitSlots.Length)
            {
                return -1;
            }

            return _formationRecruitSlots[slotIndex];
        }

        private void ClearFormationSlot(int slotIndex)
        {
            EnsureFormationState();
            if (slotIndex >= 0 && slotIndex < _formationRecruitSlots.Length && slotIndex != HeroFormationSlot)
            {
                _formationRecruitSlots[slotIndex] = -1;
                SyncLegacyTeamSlotsFromFormation();
            }
        }

        private void PlaceSelectedRecruitInFormation(int slotIndex)
        {
            if (!IsRecruitOwned(_selectedRecruitRosterIndex) || slotIndex == HeroFormationSlot)
            {
                return;
            }

            EnsureFormationState();
            for (int i = 0; i < _formationRecruitSlots.Length; i++)
            {
                if (i != slotIndex && _formationRecruitSlots[i] == _selectedRecruitRosterIndex)
                {
                    _formationRecruitSlots[i] = -1;
                }
            }

            _formationRecruitSlots[slotIndex] = _selectedRecruitRosterIndex;
            SyncLegacyTeamSlotsFromFormation();
            RecruitCandidate recruit = _recruitCandidates[_selectedRecruitRosterIndex];
            _townNotice = $"角色阁：{recruit.name} 已放入阵位 {GetFormationSlotLabel(slotIndex)}。";
        }

        private string GetFormationSlotLabel(int slotIndex)
        {
            int row = slotIndex / 3 + 1;
            int col = slotIndex % 3 + 1;
            return $"{row}-{col}";
        }

        private void SyncLegacyTeamSlotsFromFormation()
        {
            _teamRecruitSlot2Index = GetFirstFormationRecruitExcept(-1);
            _teamRecruitSlot3Index = GetFirstFormationRecruitExcept(_teamRecruitSlot2Index);
        }

        private int GetFirstFormationRecruitExcept(int excludedIndex)
        {
            EnsureFormationState();
            for (int i = 0; i < _formationRecruitSlots.Length; i++)
            {
                int recruitIndex = _formationRecruitSlots[i];
                if (recruitIndex != excludedIndex && IsRecruitOwned(recruitIndex))
                {
                    return recruitIndex;
                }
            }

            return -1;
        }

        private void MigrateLegacyTeamSlotsToFormation()
        {
            EnsureFormationState();
            bool hasAnyFormationRecruit = false;
            for (int i = 0; i < _formationRecruitSlots.Length; i++)
            {
                if (IsRecruitOwned(_formationRecruitSlots[i]))
                {
                    hasAnyFormationRecruit = true;
                    break;
                }
            }

            if (hasAnyFormationRecruit)
            {
                return;
            }

            if (IsRecruitOwned(_teamRecruitSlot2Index))
            {
                _formationRecruitSlots[4] = _teamRecruitSlot2Index;
            }
            else
            {
                _formationRecruitSlots[4] = GetFirstOwnedRecruitIndex();
            }

            if (IsRecruitOwned(_teamRecruitSlot3Index) && _teamRecruitSlot3Index != _teamRecruitSlot2Index)
            {
                _formationRecruitSlots[7] = _teamRecruitSlot3Index;
            }
            else
            {
                _formationRecruitSlots[7] = GetFirstOwnedRecruitIndexExcept(_formationRecruitSlots[4]);
            }
        }

        private void ApplyBattleFormation()
        {
            if (battleManager == null)
            {
                return;
            }

            EnsureFormationState();
            MigrateLegacyTeamSlotsToFormation();
            string[] recruitNames = new string[FormationSlotCount];
            Color[] recruitColors = new Color[FormationSlotCount];
            int[] recruitAttacks = new int[FormationSlotCount];
            for (int i = 0; i < FormationSlotCount; i++)
            {
                int recruitIndex = _formationRecruitSlots[i];
                if (!IsRecruitOwned(recruitIndex))
                {
                    recruitNames[i] = string.Empty;
                    recruitColors[i] = Color.white;
                    recruitAttacks[i] = 0;
                    continue;
                }

                recruitNames[i] = _recruitCandidates[recruitIndex].name;
                recruitColors[i] = GetRecruitFormationColor(recruitIndex);
                recruitAttacks[i] = GetRecruitAttack(recruitIndex);
            }

            battleManager.ApplyFormationLayout(recruitNames, recruitColors, recruitAttacks, HeroFormationSlot);
        }

        private Color GetRecruitFormationColor(int recruitIndex)
        {
            switch (recruitIndex)
            {
                case 0:
                    return new Color(0.22f, 0.72f, 0.44f, 1f);
                case 1:
                    return new Color(0.34f, 0.62f, 0.95f, 1f);
                case 2:
                    return new Color(0.92f, 0.68f, 0.28f, 1f);
                default:
                    return new Color(0.32f, 0.58f, 0.82f, 1f);
            }
        }

        private string GetRecruitIntro(int recruitIndex)
        {
            switch (recruitIndex)
            {
                case 0:
                    return "擅长青木术的中排法师，适合补充单体法术输出。";
                case 1:
                    return "披甲守卫，适合放在前排承担压力。";
                case 2:
                    return "熟悉药理的后排辅助，后续会接入治疗和续航技能。";
                default:
                    return "已招募队友。";
            }
        }

        private string GetRecruitSkillSummary(int recruitIndex)
        {
            switch (recruitIndex)
            {
                case 0:
                    return "青木术 - 法术单体伤害。";
                case 1:
                    return "铁壁 - 守护前排，降低承伤。";
                case 2:
                    return "回春 - 辅助治疗，恢复友方生命。";
                default:
                    return "技能待配置。";
            }
        }

        private int GetRecruitHp(int recruitIndex)
        {
            int star = GetRecruitRank(recruitIndex);
            switch (recruitIndex)
            {
                case 0:
                    return 70 + star * 6;
                case 1:
                    return 100 + star * 10;
                case 2:
                    return 80 + star * 7;
                default:
                    return 70 + star * 5;
            }
        }

        private int GetRecruitAttack(int recruitIndex)
        {
            int star = GetRecruitRank(recruitIndex);
            switch (recruitIndex)
            {
                case 0:
                    return 7 + star;
                case 1:
                    return 5 + star;
                case 2:
                    return 4 + star;
                default:
                    return 5 + star;
            }
        }

        private int GetRecruitDefense(int recruitIndex)
        {
            int star = GetRecruitRank(recruitIndex);
            switch (recruitIndex)
            {
                case 0:
                    return 2 + star / 3;
                case 1:
                    return 6 + star;
                case 2:
                    return 3 + star / 2;
                default:
                    return 2 + star / 2;
            }
        }

        private string GetRecruitSkillOneName(int recruitIndex)
        {
            switch (recruitIndex)
            {
                case 0:
                    return "青木术";
                case 1:
                    return "盾击";
                case 2:
                    return "回春弹";
                default:
                    return "技能一";
            }
        }

        private string GetRecruitSkillTwoName(int recruitIndex)
        {
            switch (recruitIndex)
            {
                case 0:
                    return "缠木";
                case 1:
                    return "铁壁";
                case 2:
                    return "药雾";
                default:
                    return "技能二";
            }
        }

        private int GetRecruitSkillOneDamage(int recruitIndex)
        {
            int attack = GetRecruitAttack(recruitIndex);
            switch (recruitIndex)
            {
                case 0:
                    return attack * 2;
                case 1:
                    return attack + 4;
                case 2:
                    return attack + 3;
                default:
                    return attack + 2;
            }
        }

        private int GetRecruitSkillTwoDamage(int recruitIndex)
        {
            int attack = GetRecruitAttack(recruitIndex);
            switch (recruitIndex)
            {
                case 0:
                    return attack + 5;
                case 1:
                    return attack + 2;
                case 2:
                    return attack + 1;
                default:
                    return attack + 1;
            }
        }

        private string BuildInventoryInfo()
        {
            return "";
        }

        private string BuildRecruitInfo()
        {
            EnsureRecruitState();
            return $"招贤令 {_recruitTokenCount}\n已招募队友 {GetOwnedRecruitCount()}/{_recruitCandidates.Length}\n最近结果：{_lastRecruitResultText}";
        }

        private void DrawTaskBoardPanelActions(Rect detailRect)
        {
            float sidePadding = Mathf.Clamp(detailRect.width * 0.065f, 30f, 56f);
            Rect contentRect = new Rect(detailRect.x + sidePadding, detailRect.y + 66f, detailRect.width - sidePadding * 2f, detailRect.height - 96f);
            DrawCodexTaskPanel(contentRect, true);
        }

        private void DrawRecruitPanelActions(Rect detailRect)
        {
            EnsureRecruitState();
            float sidePadding = Mathf.Clamp(detailRect.width * 0.055f, 24f, 42f);
            Rect contentRect = new Rect(detailRect.x + sidePadding, detailRect.y + 56f, detailRect.width - sidePadding * 2f, detailRect.height - 78f);
            Rect currencyRect = new Rect(contentRect.x, contentRect.y, contentRect.width, 30f);
            DrawSolidRect(currencyRect, new Color(0.025f, 0.03f, 0.028f, 1f));
            GUI.Label(new Rect(currencyRect.x + 16f, currencyRect.y + 5f, currencyRect.width - 32f, 20f), $"持有：{RecruitTokenName} {_recruitTokenCount}    已招募 {GetOwnedRecruitCount()}/{_recruitCandidates.Length}    单次 1    十次 10", _runtimeSmallStyle);

            float gap = 8f;
            float availableBodyHeight = Mathf.Max(0f, contentRect.height - currencyRect.height - gap * 2f);
            float desiredActionHeight = Mathf.Clamp(contentRect.height * 0.28f, 64f, 84f);
            float minimumPoolHeight = Mathf.Min(56f, availableBodyHeight * 0.5f);
            float actionHeight = Mathf.Min(desiredActionHeight, Mathf.Max(44f, availableBodyHeight - minimumPoolHeight));
            actionHeight = Mathf.Min(actionHeight, availableBodyHeight);
            float poolHeight = Mathf.Max(0f, availableBodyHeight - actionHeight);
            Rect poolRect = new Rect(contentRect.x, currencyRect.yMax + gap, contentRect.width, poolHeight);
            Rect actionRect = new Rect(contentRect.x, poolRect.yMax + gap, contentRect.width, actionHeight);
            DrawSolidRect(poolRect, new Color(0.025f, 0.03f, 0.028f, 1f));
            DrawSolidRect(actionRect, new Color(0.025f, 0.03f, 0.028f, 1f));

            bool tinyPool = poolRect.height < 58f;
            if (!tinyPool)
            {
                GUI.Label(new Rect(poolRect.x + 16f, poolRect.y + 6f, poolRect.width - 32f, 28f), "当前招募池", _runtimeInfoStyle);
            }

            float cardGap = 8f;
            float cardY = poolRect.y + (tinyPool ? 7f : 44f);
            float cardHeight = Mathf.Max(24f, poolRect.yMax - cardY - (tinyPool ? 7f : 12f));
            bool stackedCards = poolRect.width < 520f;
            if (stackedCards)
            {
                cardHeight = Mathf.Max(18f, (poolRect.yMax - cardY - (tinyPool ? 7f : 12f) - cardGap * (_recruitCandidates.Length - 1)) / _recruitCandidates.Length);
                for (int i = 0; i < _recruitCandidates.Length; i++)
                {
                    DrawRecruitCandidateCard(new Rect(poolRect.x + 16f, cardY + (cardHeight + cardGap) * i, poolRect.width - 32f, cardHeight), i);
                }
            }
            else
            {
                float cardWidth = (poolRect.width - 32f - cardGap * (_recruitCandidates.Length - 1)) / _recruitCandidates.Length;
                for (int i = 0; i < _recruitCandidates.Length; i++)
                {
                    DrawRecruitCandidateCard(new Rect(poolRect.x + 16f + (cardWidth + cardGap) * i, cardY, cardWidth, cardHeight), i);
                }
            }

            bool tinyAction = actionRect.height < 58f;
            if (!tinyAction)
            {
                GUI.Label(new Rect(actionRect.x + 16f, actionRect.y + 6f, actionRect.width - 32f, 20f), "招募操作", _runtimeInfoStyle);
            }

            float buttonGap = 10f;
            float buttonWidth = Mathf.Min(196f, (actionRect.width - 42f - buttonGap) * 0.5f);
            float buttonHeight = tinyAction ? 24f : 32f;
            float buttonY = tinyAction ? actionRect.y + 4f : actionRect.y + 28f;
            Rect singleRect = new Rect(actionRect.x + actionRect.width * 0.5f - buttonWidth - buttonGap * 0.5f, buttonY, buttonWidth, buttonHeight);
            Rect tenRect = new Rect(actionRect.x + actionRect.width * 0.5f + buttonGap * 0.5f, buttonY, buttonWidth, buttonHeight);
            DrawRecruitActionButton(singleRect, 1, _recruitTokenCount >= 1);
            DrawRecruitActionButton(tenRect, 10, _recruitTokenCount >= 10);
            GUI.backgroundColor = Color.white;

            if (!tinyAction)
            {
                GUI.Label(new Rect(actionRect.x + 16f, actionRect.yMax - 22f, actionRect.width - 32f, 18f), $"最近结果：{_lastRecruitResultText}    十次保底：至少 1 名稀有", _runtimeSmallStyle);
            }
        }

        private void DrawRecruitCandidateCard(Rect rect, int recruitIndex)
        {
            RecruitCandidate recruit = _recruitCandidates[Mathf.Clamp(recruitIndex, 0, _recruitCandidates.Length - 1)];
            bool owned = IsRecruitOwned(recruitIndex);
            Color baseColor = recruit.rarity == "稀有" ? new Color(0.08f, 0.075f, 0.045f, 1f) : new Color(0.045f, 0.052f, 0.05f, 1f);
            DrawSolidRect(rect, owned ? new Color(baseColor.r + 0.035f, baseColor.g + 0.055f, baseColor.b + 0.04f, 1f) : baseColor);
            GUIStyle leftStyle = new GUIStyle(_runtimeSmallStyle);
            leftStyle.alignment = TextAnchor.MiddleLeft;
            leftStyle.wordWrap = false;
            leftStyle.fontSize = Mathf.Max(12, Mathf.Min(14, _runtimeSmallStyle.fontSize));
            leftStyle.padding = new RectOffset(0, 0, 0, 0);

            string role = $"{recruit.role} / {recruit.position}";
            string state = owned ? $"已拥有  碎片 {GetRecruitFragments(recruitIndex)}" : "未拥有";
            if (rect.height < 74f)
            {
                GUI.Label(new Rect(rect.x + 12f, rect.y + Mathf.Max(4f, (rect.height - 26f) * 0.5f), rect.width - 24f, 26f), $"{recruit.rarity}  {recruit.name}  {role}  {state}", leftStyle);
                return;
            }

            float lineHeight = 24f;
            float textY = rect.y + Mathf.Max(10f, (rect.height - lineHeight * 3f) * 0.5f);
            GUI.Label(new Rect(rect.x + 12f, textY, rect.width - 24f, lineHeight), $"{recruit.rarity}  {state}", leftStyle);
            GUI.Label(new Rect(rect.x + 12f, textY + lineHeight, rect.width - 24f, lineHeight), recruit.name, leftStyle);
            GUI.Label(new Rect(rect.x + 12f, textY + lineHeight * 2f, rect.width - 24f, lineHeight), role, leftStyle);
        }

        private void DrawRecruitActionButton(Rect rect, int count, bool canRecruit)
        {
            string label = count == 1 ? "单次招募" : "十次招募";
            GUI.backgroundColor = canRecruit ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (GUI.Button(rect, canRecruit ? label : $"需要 {count} {RecruitTokenName}", canRecruit ? _runtimeButtonStyle : _runtimeDisabledButtonStyle))
            {
                if (canRecruit)
                {
                    RecruitCharacters(count);
                }
                else
                {
                    ShowTownModal($"{RecruitTokenName}不足", $"{label}需要 {count} {RecruitTokenName}\n当前持有：{_recruitTokenCount}\n可在商店的招募分类购买，或在任务榜领取奖励。");
                }
            }
        }

        private void RecruitCharacters(int count)
        {
            EnsureRecruitState();
            int safeCount = Mathf.Clamp(count, 1, 10);
            if (_recruitTokenCount < safeCount)
            {
                ShowTownModal($"{RecruitTokenName}不足", $"本次招募需要 {safeCount} {RecruitTokenName}\n当前持有：{_recruitTokenCount}");
                return;
            }

            int[] results = new int[safeCount];
            bool hasRare = false;
            for (int i = 0; i < safeCount; i++)
            {
                results[i] = RollRecruitCandidateIndex();
                if (IsRareRecruit(results[i]))
                {
                    hasRare = true;
                }
            }

            if (safeCount >= 10 && !hasRare)
            {
                int rareIndex = GetFirstRareRecruitIndex();
                if (rareIndex >= 0)
                {
                    results[safeCount - 1] = rareIndex;
                    hasRare = true;
                }
            }

            _recruitTokenCount -= safeCount;
            int newCount = 0;
            int fragmentGain = 0;
            int rareCount = 0;
            string detail = $"消耗：{RecruitTokenName} x{safeCount}\n";
            for (int i = 0; i < results.Length; i++)
            {
                int recruitIndex = Mathf.Clamp(results[i], 0, _recruitCandidates.Length - 1);
                RecruitCandidate recruit = _recruitCandidates[recruitIndex];
                bool alreadyOwned = _recruitOwned[recruitIndex];
                if (alreadyOwned)
                {
                    _recruitFragments[recruitIndex] += recruit.duplicateFragments;
                    fragmentGain += recruit.duplicateFragments;
                    detail += $"{i + 1}. {recruit.rarity} {recruit.name}  碎片 +{recruit.duplicateFragments}\n";
                }
                else
                {
                    _recruitOwned[recruitIndex] = true;
                    newCount++;
                    detail += $"{i + 1}. {recruit.rarity} {recruit.name}  新角色\n";
                }

                if (IsRareRecruit(recruitIndex))
                {
                    rareCount++;
                }
            }

            if (safeCount == 1)
            {
                RecruitCandidate recruit = _recruitCandidates[Mathf.Clamp(results[0], 0, _recruitCandidates.Length - 1)];
                _lastRecruitResultText = newCount > 0 ? $"新角色 {recruit.name}" : $"{recruit.name} 碎片 +{recruit.duplicateFragments}";
            }
            else
            {
                _lastRecruitResultText = $"十连：新 {newCount}，稀有 {rareCount}，碎片 +{fragmentGain}";
            }

            ValidateRecruitSelections();
            _townNotice = $"招贤阁：{_lastRecruitResultText}。";
            ShowTownModal(safeCount == 1 ? "招募结果" : "十连结果", detail.TrimEnd('\n'));
            SaveProgress();
        }

        private int RollRecruitCandidateIndex()
        {
            if (_recruitCandidates.Length <= 0)
            {
                return 0;
            }

            int rareIndex = GetFirstRareRecruitIndex();
            if (rareIndex >= 0 && Random.value < 0.2f)
            {
                return rareIndex;
            }

            int commonCount = 0;
            for (int i = 0; i < _recruitCandidates.Length; i++)
            {
                if (!IsRareRecruit(i))
                {
                    commonCount++;
                }
            }

            if (commonCount <= 0)
            {
                return Mathf.Max(0, rareIndex);
            }

            int targetCommon = Random.Range(0, commonCount);
            for (int i = 0; i < _recruitCandidates.Length; i++)
            {
                if (IsRareRecruit(i))
                {
                    continue;
                }

                if (targetCommon == 0)
                {
                    return i;
                }

                targetCommon--;
            }

            return 0;
        }

        private bool IsRareRecruit(int recruitIndex)
        {
            if (recruitIndex < 0 || recruitIndex >= _recruitCandidates.Length)
            {
                return false;
            }

            return _recruitCandidates[recruitIndex].rarity == "稀有";
        }

        private int GetFirstRareRecruitIndex()
        {
            for (int i = 0; i < _recruitCandidates.Length; i++)
            {
                if (IsRareRecruit(i))
                {
                    return i;
                }
            }

            return -1;
        }

        private string BuildEquipmentInfo()
        {
            return "";
        }

        private string BuildAlchemyInfo()
        {
            return $"淬体丹 Lv.{_bodyPillLevel}/{GetBodyPillMaxLevel()}\n永久生命 +{GetBodyPillHpBonus()}";
        }

        private string BuildEvolutionInfo()
        {
            return $"主角阶段：{GetEvolutionStageName(_evolutionStage)}\n进化加成：生命 +{GetEvolutionHpBonus()}  攻击 +{GetEvolutionAttackBonus()}  防御 +{GetEvolutionDefenseBonus()}";
        }

        private void DrawEvolutionPanelActions(Rect detailRect)
        {
            Rect contentRect = new Rect(detailRect.x + 42f, detailRect.y + 70f, detailRect.width - 84f, detailRect.height - 132f);
            DropSystem drops = DropSystem.Instance;
            int dust = drops != null ? drops.materialCount : 0;
            int herbs = drops != null ? drops.herbCount : 0;
            int ores = drops != null ? drops.oreCount : 0;

            Rect materialRect = new Rect(contentRect.x, contentRect.y, contentRect.width, 34f);
            DrawSolidRect(materialRect, new Color(0.025f, 0.03f, 0.028f, 1f));
            GUI.Label(new Rect(materialRect.x + 18f, materialRect.y + 6f, materialRect.width - 36f, 22f), $"持有：{GetMaterialName("spirit_dust")} {dust}    {GetMaterialName("red_herb")} {herbs}    {GetMaterialName("iron_sand")} {ores}", _runtimeSmallStyle);

            bool maxStage = _evolutionStage >= GetEvolutionMaxStage();
            int nextStage = Mathf.Clamp(_evolutionStage + 1, 1, GetEvolutionMaxStage());

            float leftWidth = Mathf.Min(250f, contentRect.width * 0.32f);
            Rect summaryRect = new Rect(contentRect.x + 18f, contentRect.y + 62f, leftWidth, contentRect.height - 96f);
            Rect evolutionRect = new Rect(summaryRect.xMax + 18f, contentRect.y + 62f, contentRect.xMax - summaryRect.xMax - 36f, contentRect.height - 96f);
            DrawSolidRect(summaryRect, new Color(0.025f, 0.03f, 0.028f, 1f));
            DrawSolidRect(evolutionRect, new Color(0.025f, 0.03f, 0.028f, 1f));

            GUIStyle compactStyle = new GUIStyle(_runtimeSmallStyle);
            compactStyle.alignment = TextAnchor.UpperLeft;
            compactStyle.fontSize = Mathf.Max(11, _runtimeSmallStyle.fontSize - 1);

            GUI.Label(new Rect(summaryRect.x + 20f, summaryRect.y + 20f, summaryRect.width - 40f, 28f), "当前阶段", _runtimeInfoStyle);
            string summaryText = $"{GetEvolutionStageName(_evolutionStage)}\n生命 +{GetEvolutionHpBonus()}\n攻击 +{GetEvolutionAttackBonus()}\n防御 +{GetEvolutionDefenseBonus()}";
            GUI.Label(new Rect(summaryRect.x + 22f, summaryRect.y + 64f, summaryRect.width - 44f, 100f), summaryText, compactStyle);

            string nextTitle = maxStage ? "当前 MVP 阶段已满" : $"下一阶段：{GetEvolutionStageName(nextStage)}";
            GUI.Label(new Rect(evolutionRect.x + 24f, evolutionRect.y + 20f, evolutionRect.width - 48f, 28f), nextTitle, _runtimeInfoStyle);

            Rect effectRect = new Rect(evolutionRect.x + 24f, evolutionRect.y + 54f, evolutionRect.width - 48f, 26f);
            string effectText = maxStage
                ? "后续阶段会在图谱二、职业分支和专属材料上线后开放。"
                : $"进化后：生命 +{GetEvolutionStageHpBonus(nextStage)}  攻击 +{GetEvolutionStageAttackBonus(nextStage)}  防御 +{GetEvolutionStageDefenseBonus(nextStage)}";
            GUI.Label(effectRect, effectText, compactStyle);

            bool canEvolve = CanEvolveHero();
            Rect statusRect = new Rect(evolutionRect.x + 24f, evolutionRect.y + 96f, evolutionRect.width - 48f, Mathf.Max(56f, evolutionRect.height - 164f));
            DrawSolidRect(statusRect, new Color(0.018f, 0.024f, 0.023f, 1f));
            string statusText = maxStage
                ? "当前测试版本只开放到二阶。"
                : canEvolve
                    ? "条件已满足\n点击下方完成进化"
                    : "条件未满足\n点击下方查看所需条件";
            GUI.Label(new Rect(statusRect.x + 20f, statusRect.y + 16f, statusRect.width - 40f, statusRect.height - 32f), statusText, _runtimeInfoStyle);

            Rect evolveRect = new Rect(evolutionRect.x + evolutionRect.width * 0.5f - 96f, evolutionRect.yMax - 48f, 192f, 36f);
            string buttonLabel = maxStage ? "已满阶" : canEvolve ? "进化" : GetEvolutionBlockLabel();
            GUI.backgroundColor = canEvolve
                ? new Color(0.12f, 0.32f, 0.29f, 1f)
                : maxStage ? new Color(0.07f, 0.075f, 0.078f, 1f) : new Color(0.18f, 0.22f, 0.22f, 1f);
            if (_showTownModal)
            {
                GUI.Box(evolveRect, buttonLabel, _runtimeDisabledButtonStyle);
            }
            else if (canEvolve)
            {
                if (GUI.Button(evolveRect, buttonLabel, _runtimeButtonStyle))
                {
                    EvolveHero();
                }
            }
            else
            {
                if (maxStage)
                {
                    GUI.Box(evolveRect, buttonLabel, _runtimeDisabledButtonStyle);
                }
                else if (GUI.Button(evolveRect, buttonLabel, _runtimeButtonStyle))
                {
                    ShowTownModal("所需条件", BuildEvolutionBlockMessage(nextStage));
                }
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawEvolutionAvatar(Rect avatarRect)
        {
            Rect headRect = new Rect(avatarRect.x + avatarRect.width * 0.5f - 22f, avatarRect.y + 36f, 44f, 38f);
            Rect bodyRect = new Rect(avatarRect.x + avatarRect.width * 0.5f - 42f, headRect.yMax + 12f, 84f, Mathf.Max(72f, avatarRect.height * 0.3f));
            Rect auraRect = new Rect(bodyRect.x - 12f, bodyRect.y - 8f, bodyRect.width + 24f, bodyRect.height + 22f);
            DrawSolidRect(auraRect, GetEvolutionAuraColor());
            DrawSolidRect(headRect, new Color(0.68f, 0.32f, 0.2f, 1f));
            DrawSolidRect(bodyRect, new Color(0.16f, 0.36f, 0.32f, 1f));
            GUI.Label(new Rect(avatarRect.x + 16f, avatarRect.yMax - 78f, avatarRect.width - 32f, 56f), $"{GetEvolutionStageName(_evolutionStage)}\n生命 +{GetEvolutionHpBonus()}  攻击 +{GetEvolutionAttackBonus()}  防御 +{GetEvolutionDefenseBonus()}", _runtimeSmallStyle);
        }

        private void DrawAlchemyPanelActions(Rect detailRect)
        {
            Rect contentRect = new Rect(detailRect.x + 42f, detailRect.y + 70f, detailRect.width - 84f, detailRect.height - 132f);
            DropSystem drops = DropSystem.Instance;
            int dust = drops != null ? drops.materialCount : 0;
            int herbs = drops != null ? drops.herbCount : 0;

            Rect materialRect = new Rect(contentRect.x, contentRect.y, contentRect.width, 34f);
            DrawSolidRect(materialRect, new Color(0.025f, 0.03f, 0.028f, 1f));
            GUI.Label(new Rect(materialRect.x + 18f, materialRect.y + 6f, materialRect.width - 36f, 22f), $"持有：{GetMaterialName("spirit_dust")} {dust}    {GetMaterialName("red_herb")} {herbs}", _runtimeSmallStyle);

            float furnaceWidth = Mathf.Min(260f, contentRect.width * 0.36f);
            Rect furnaceRect = new Rect(contentRect.x + 18f, contentRect.y + 62f, furnaceWidth, contentRect.height - 96f);
            DrawSolidRect(furnaceRect, new Color(0.025f, 0.03f, 0.028f, 1f));
            DrawSolidRect(new Rect(furnaceRect.x + furnaceRect.width * 0.5f - 46f, furnaceRect.y + 42f, 92f, 72f), new Color(0.18f, 0.34f, 0.28f, 1f));
            DrawSolidRect(new Rect(furnaceRect.x + furnaceRect.width * 0.5f - 58f, furnaceRect.y + 112f, 116f, 10f), new Color(0.42f, 0.26f, 0.16f, 1f));
            DrawSolidRect(new Rect(furnaceRect.x + furnaceRect.width * 0.5f - 26f, furnaceRect.y + 26f, 52f, 18f), new Color(0.58f, 0.72f, 0.54f, 1f));
            GUI.Label(new Rect(furnaceRect.x + 16f, furnaceRect.yMax - 62f, furnaceRect.width - 32f, 44f), $"炼药炉\n生命丹药加成 +{GetBodyPillHpBonus()}", _runtimeSmallStyle);

            float recipeX = furnaceRect.xMax + 18f;
            Rect recipeRect = new Rect(recipeX, contentRect.y + 62f, contentRect.xMax - recipeX - 18f, contentRect.height - 96f);
            DrawSolidRect(recipeRect, new Color(0.025f, 0.03f, 0.028f, 1f));

            int currentLevel = _bodyPillLevel;
            bool maxLevel = currentLevel >= GetBodyPillMaxLevel();
            int dustCost = GetBodyPillDustCost(currentLevel);
            int herbCost = GetBodyPillHerbCost(currentLevel);
            string costText = maxLevel ? "已达当前上限" : $"{GetMaterialName("red_herb")} {herbCost}    {GetMaterialName("spirit_dust")} {dustCost}";
            string nextText = maxLevel ? "当前阶段已炼满" : $"下级效果：永久生命 +{GetBodyPillNextHpBonus()}";
            string recipeText = $"淬体丹  Lv.{currentLevel}/{GetBodyPillMaxLevel()}\n当前效果：永久生命 +{GetBodyPillHpBonus()}\n炼制消耗：{costText}\n{nextText}";
            GUI.Label(new Rect(recipeRect.x + 24f, recipeRect.y + 24f, recipeRect.width - 48f, recipeRect.height - 86f), recipeText, _runtimePanelInfoStyle);

            Rect refineRect = new Rect(recipeRect.x + recipeRect.width * 0.5f - 92f, recipeRect.yMax - 54f, 184f, 36f);
            bool canRefine = CanRefineBodyPill();
            GUI.backgroundColor = canRefine ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            string buttonLabel = maxLevel ? "已满级" : canRefine ? "炼制" : "材料不足";
            if (_showTownModal)
            {
                GUI.Box(refineRect, buttonLabel, _runtimeDisabledButtonStyle);
            }
            else if (canRefine)
            {
                if (GUI.Button(refineRect, buttonLabel, _runtimeButtonStyle))
                {
                    RefineBodyPill();
                }
            }
            else
            {
                if (GUI.Button(refineRect, buttonLabel, _runtimeDisabledButtonStyle) && !maxLevel)
                {
                    ShowTownModal("材料不足", $"炼制淬体丹需要：\n{GetMaterialName("red_herb")} {herbCost}    {GetMaterialName("spirit_dust")} {dustCost}");
                }
            }

            GUI.backgroundColor = Color.white;
        }

        private string BuildBlacksmithInfo()
        {
            return "炼器用于打造新装备。\n强化用于提升已穿戴装备。";
        }

        private void DrawBlacksmithPanelActions(Rect detailRect)
        {
            Rect contentRect = new Rect(detailRect.x + 42f, detailRect.y + 62f, detailRect.width - 84f, detailRect.height - 116f);
            DrawBlacksmithTabs(contentRect);
            Rect pageRect = new Rect(contentRect.x, contentRect.y + 46f, contentRect.width, contentRect.height - 52f);
            if (_selectedBlacksmithTab == BlacksmithTab.Craft)
            {
                DrawBlacksmithCraftPage(pageRect);
                return;
            }

            DrawBlacksmithEnhancePage(pageRect);
        }

        private void DrawBlacksmithTabs(Rect contentRect)
        {
            float tabWidth = 112f;
            float tabHeight = 32f;
            float gap = 8f;
            float startX = contentRect.x + (contentRect.width - tabWidth * 2f - gap) * 0.5f;
            DrawBlacksmithTabButton(new Rect(startX, contentRect.y, tabWidth, tabHeight), BlacksmithTab.Craft, "炼器");
            DrawBlacksmithTabButton(new Rect(startX + tabWidth + gap, contentRect.y, tabWidth, tabHeight), BlacksmithTab.Enhance, "强化");
        }

        private void DrawBlacksmithTabButton(Rect rect, BlacksmithTab tab, string label)
        {
            bool selected = _selectedBlacksmithTab == tab;
            GUI.backgroundColor = selected ? new Color(0.16f, 0.38f, 0.34f, 1f) : new Color(0.075f, 0.095f, 0.09f, 1f);
            if (GUI.Button(rect, label, _runtimeButtonStyle))
            {
                _selectedBlacksmithTab = tab;
                _hasSelectedBlacksmithSlot = false;
                _hasSelectedCraftRecipe = false;
                _townNotice = tab == BlacksmithTab.Craft
                    ? "铁匠铺：选择配方打造装备。"
                    : "铁匠铺：选择已穿戴装备进行强化。";
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawBlacksmithCraftPage(Rect contentRect)
        {
            ValidateSelectedCraftRecipe();
            DropSystem drops = DropSystem.Instance;
            int dust = drops != null ? drops.materialCount : 0;
            int ore = drops != null ? drops.oreCount : 0;

            Rect materialRect = new Rect(contentRect.x + 18f, contentRect.y + 8f, contentRect.width - 36f, 32f);
            DrawSolidRect(materialRect, new Color(0.025f, 0.03f, 0.028f, 1f));
            GUI.Label(new Rect(materialRect.x + 18f, materialRect.y + 5f, materialRect.width - 36f, 22f), $"持有：{GetMaterialName("spirit_dust")} {dust}    {GetMaterialName("iron_sand")} {ore}", _runtimeSmallStyle);

            float recipeWidth = Mathf.Min(280f, contentRect.width * 0.34f);
            Rect listRect = new Rect(contentRect.x + 18f, contentRect.y + 46f, recipeWidth, contentRect.height - 86f);

            float slotHeight = 58f;
            float gap = 8f;
            for (int i = 0; i < _craftRecipes.Length; i++)
            {
                Rect recipeRect = new Rect(listRect.x, listRect.y + i * (slotHeight + gap), listRect.width, slotHeight);
                DrawCraftRecipeButton(recipeRect, i);
            }

            Rect detailRect = new Rect(listRect.xMax + 18f, contentRect.y + 46f, contentRect.xMax - listRect.xMax - 36f, contentRect.height - 86f);
            DrawSelectedCraftRecipeDetail(detailRect);
        }

        private void DrawCraftRecipeButton(Rect recipeRect, int recipeIndex)
        {
            CraftRecipe recipe = _craftRecipes[recipeIndex];
            EquipmentItem item = GetCraftRecipeItem(recipe);
            bool selected = _hasSelectedCraftRecipe && recipeIndex == _selectedCraftRecipeIndex;
            bool owned = IsEquipmentOwned(recipe.equipmentIndex);
            GUI.backgroundColor = selected ? new Color(0.16f, 0.38f, 0.34f, 1f) : new Color(0.075f, 0.095f, 0.09f, 1f);

            string ownedText = owned ? "已拥有" : "可打造";
            string label = $"{item.name}\n{ownedText}";
            if (_showTownModal)
            {
                GUI.Box(recipeRect, label, selected ? _runtimeButtonStyle : _runtimeDisabledButtonStyle);
            }
            else if (GUI.Button(recipeRect, label, _runtimeMapButtonStyle))
            {
                _selectedCraftRecipeIndex = recipeIndex;
                _hasSelectedCraftRecipe = true;
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawSelectedCraftRecipeDetail(Rect detailRect)
        {
            DrawSolidRect(detailRect, new Color(0.025f, 0.03f, 0.028f, 1f));
            if (!_hasSelectedCraftRecipe)
            {
                Rect hintRect = new Rect(detailRect.x + 24f, detailRect.y + detailRect.height * 0.5f - 18f, detailRect.width - 48f, 36f);
                GUI.Label(hintRect, "请选择图纸", _runtimeInfoStyle);
                GUI.Label(new Rect(hintRect.x, hintRect.yMax + 4f, hintRect.width, 22f), "选中图纸后查看消耗材料与装备属性。", _runtimeSmallStyle);
                return;
            }

            CraftRecipe recipe = GetSelectedCraftRecipe();
            EquipmentItem item = GetCraftRecipeItem(recipe);
            bool owned = IsEquipmentOwned(recipe.equipmentIndex);
            bool canCraft = CanCraftSelectedRecipe();

            string ownedText = owned ? "已拥有" : "未拥有";
            string classText = item.requiredClass == "All" ? "全职业" : GetClassName(item.requiredClass);
            GUIStyle compactStyle = new GUIStyle(_runtimeSmallStyle);
            compactStyle.alignment = TextAnchor.UpperLeft;
            compactStyle.fontSize = Mathf.Max(10, _runtimeSmallStyle.fontSize - 2);

            Rect titleRect = new Rect(detailRect.x + 22f, detailRect.y + 16f, detailRect.width - 44f, 24f);
            GUI.Label(titleRect, $"{item.name}  {item.quality}  Lv.{item.levelRequirement}", compactStyle);

            Rect metaRect = new Rect(detailRect.x + 22f, titleRect.yMax + 2f, detailRect.width - 44f, 22f);
            GUI.Label(metaRect, $"{GetSlotName(item.slot)} / {classText} / {ownedText}", compactStyle);

            float statY = metaRect.yMax + 10f;
            float statHeight = Mathf.Max(34f, detailRect.yMax - 96f - statY);
            Rect statRect = new Rect(detailRect.x + 22f, statY, detailRect.width - 44f, statHeight);
            DrawSolidRect(statRect, new Color(0.018f, 0.024f, 0.023f, 1f));
            GUI.Label(new Rect(statRect.x + 12f, statRect.y + 6f, statRect.width - 24f, statRect.height - 12f), $"属性：{BuildEquipmentStatShortText(item)}\n{recipe.description}", compactStyle);

            Rect costRect = new Rect(detailRect.x + 22f, detailRect.yMax - 88f, detailRect.width - 44f, 28f);
            DrawSolidRect(costRect, new Color(0.018f, 0.024f, 0.023f, 1f));
            GUI.Label(new Rect(costRect.x + 12f, costRect.y + 5f, costRect.width - 24f, 18f), $"消耗：{GetMaterialName("spirit_dust")} {recipe.dustCost}    {GetMaterialName("iron_sand")} {recipe.oreCost}", compactStyle);

            Rect craftRect = new Rect(detailRect.x + detailRect.width * 0.5f - 96f, detailRect.yMax - 44f, 192f, 34f);
            string buttonLabel = owned ? "已拥有" : canCraft ? "打造" : "材料不足";
            GUI.backgroundColor = canCraft ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (_showTownModal)
            {
                GUI.Box(craftRect, buttonLabel, _runtimeDisabledButtonStyle);
            }
            else if (canCraft)
            {
                if (GUI.Button(craftRect, buttonLabel, _runtimeButtonStyle))
                {
                    CraftSelectedRecipe();
                }
            }
            else
            {
                if (GUI.Button(craftRect, buttonLabel, _runtimeDisabledButtonStyle) && !owned)
                {
                    ShowTownModal("材料不足", $"打造 {item.name} 需要：\n{GetMaterialName("spirit_dust")} {recipe.dustCost}    {GetMaterialName("iron_sand")} {recipe.oreCost}");
                }
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawCraftEquipmentIcon(Rect iconRect, EquipmentItem item)
        {
            Color color = item.slot == EquipmentSlot.Weapon
                ? new Color(0.62f, 0.24f, 0.16f, 1f)
                : item.slot == EquipmentSlot.Gloves
                    ? new Color(0.58f, 0.42f, 0.26f, 1f)
                    : new Color(0.42f, 0.68f, 0.56f, 1f);
            DrawSolidRect(iconRect, color);
            DrawSolidRect(new Rect(iconRect.x + 8f, iconRect.y + 8f, iconRect.width - 16f, iconRect.height - 16f), new Color(color.r + 0.12f, color.g + 0.12f, color.b + 0.12f, 1f));
            DrawSolidRect(new Rect(iconRect.x - 4f, iconRect.yMax - 6f, iconRect.width + 8f, 5f), new Color(0.02f, 0.024f, 0.022f, 1f));
        }

        private void DrawBlacksmithEnhancePage(Rect contentRect)
        {
            float detailHeight = 104f;
            float detailGap = 10f;
            float equipmentHeight = Mathf.Max(168f, contentRect.height - detailHeight - detailGap);
            Rect equipmentRect = new Rect(contentRect.x, contentRect.y, contentRect.width, equipmentHeight);
            Rect detailRect = new Rect(contentRect.x, equipmentRect.yMax + detailGap, contentRect.width, contentRect.yMax - equipmentRect.yMax - detailGap);
            DrawEquipmentCharacterPanel(equipmentRect);
            DrawBlacksmithEnhanceSlots(equipmentRect);
            DrawSelectedBlacksmithDetail(detailRect);
        }

        private void DrawBlacksmithEnhanceSlots(Rect contentRect)
        {
            EquipmentSlot[] leftSlots = { EquipmentSlot.Helmet, EquipmentSlot.Armor, EquipmentSlot.Boots };
            EquipmentSlot[] rightSlots = { EquipmentSlot.Weapon, EquipmentSlot.Gloves, EquipmentSlot.Accessory };
            float slotWidth = Mathf.Clamp(contentRect.width * 0.24f, 132f, 178f);
            float topPadding = 12f;
            float gapY = Mathf.Clamp(contentRect.height * 0.045f, 8f, 16f);
            float slotHeight = Mathf.Clamp((contentRect.height - topPadding * 2f - gapY * 2f) / 3f, 46f, 66f);
            float startY = contentRect.y + topPadding;

            for (int i = 0; i < leftSlots.Length; i++)
            {
                Rect slotRect = new Rect(contentRect.x + 16f, startY + i * (slotHeight + gapY), slotWidth, slotHeight);
                DrawBlacksmithSlotButton(slotRect, leftSlots[i]);
            }

            for (int i = 0; i < rightSlots.Length; i++)
            {
                Rect slotRect = new Rect(contentRect.xMax - slotWidth - 16f, startY + i * (slotHeight + gapY), slotWidth, slotHeight);
                DrawBlacksmithSlotButton(slotRect, rightSlots[i]);
            }
        }

        private void DrawBlacksmithSlotButton(Rect slotRect, EquipmentSlot slot)
        {
            EquipmentItem item = GetEquippedItem(slot);
            bool hasItem = !string.IsNullOrEmpty(item.name);
            bool selected = _hasSelectedBlacksmithSlot && _selectedBlacksmithSlot == slot;
            GUI.backgroundColor = selected ? new Color(0.16f, 0.38f, 0.34f, 1f) : hasItem ? new Color(0.075f, 0.095f, 0.09f, 1f) : new Color(0.045f, 0.05f, 0.048f, 1f);

            string itemText = hasItem ? $"{item.name} +{GetEquipmentEnhanceLevel(item)}" : "未穿戴";
            string label = $"{GetSlotName(slot)}\n{itemText}";
            GUIStyle slotStyle = new GUIStyle(_runtimeMapButtonStyle);
            slotStyle.fontSize = Mathf.Max(12, _runtimeMapButtonStyle.fontSize - 2);
            if (!hasItem)
            {
                GUI.Box(slotRect, label, _runtimeDisabledButtonStyle);
            }
            else if (GUI.Button(slotRect, label, slotStyle))
            {
                _selectedBlacksmithSlot = slot;
                _hasSelectedBlacksmithSlot = true;
                _townNotice = $"铁匠铺：已选择 {item.name}。";
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawSelectedBlacksmithDetail(Rect contentRect)
        {
            if (!_hasSelectedBlacksmithSlot)
            {
                float hintWidth = Mathf.Min(420f, contentRect.width - 96f);
                Rect hintRect = new Rect(contentRect.x + (contentRect.width - hintWidth) * 0.5f, contentRect.y + 14f, hintWidth, 32f);
                DrawSolidRect(hintRect, new Color(0.028f, 0.034f, 0.032f, 1f));
                GUI.Label(hintRect, "请选择一件已穿戴装备。", _runtimeSmallStyle);
                return;
            }

            EquipmentItem item = GetEquippedItem(_selectedBlacksmithSlot);
            if (string.IsNullOrEmpty(item.name))
            {
                float hintWidth = Mathf.Min(420f, contentRect.width - 96f);
                Rect hintRect = new Rect(contentRect.x + (contentRect.width - hintWidth) * 0.5f, contentRect.y + 14f, hintWidth, 32f);
                DrawSolidRect(hintRect, new Color(0.028f, 0.034f, 0.032f, 1f));
                GUI.Label(hintRect, "该部位没有已穿戴装备。", _runtimeSmallStyle);
                return;
            }

            float detailWidth = contentRect.width - 32f;
            float detailHeight = Mathf.Min(92f, contentRect.height - 8f);
            float detailY = contentRect.y + 4f;
            Rect detailBox = new Rect(contentRect.x + (contentRect.width - detailWidth) * 0.5f, detailY, detailWidth, detailHeight);
            DrawSolidRect(detailBox, new Color(0.025f, 0.03f, 0.028f, 1f));

            int level = GetEquipmentEnhanceLevel(item);
            string detail = $"{item.name}  +{level}/+3\n{BuildEquipmentStatShortText(item)}\n{GetEnhanceNextStatPreview(item)}";
            float buttonGap = 7f;
            float buttonWidth = 88f;
            float buttonHeight = 30f;
            float buttonTotalWidth = buttonWidth * 3f + buttonGap * 2f;
            Rect buttonGroupRect = new Rect(detailBox.x + (detailBox.width - buttonTotalWidth) * 0.5f, detailBox.y + (detailBox.height - buttonHeight) * 0.5f, buttonTotalWidth, buttonHeight);
            Rect textRect = new Rect(detailBox.x + 16f, detailBox.y + 10f, Mathf.Min(210f, detailBox.width * 0.28f), detailBox.height - 20f);
            GUIStyle detailStyle = new GUIStyle(_runtimePanelInfoStyle);
            detailStyle.fontSize = Mathf.Max(12, _runtimePanelInfoStyle.fontSize - 1);
            GUI.Label(textRect, detail, detailStyle);

            float materialX = buttonGroupRect.xMax + 12f;
            float materialWidth = Mathf.Max(64f, detailBox.xMax - materialX - 16f);
            Rect materialRect = new Rect(materialX, detailBox.y + 10f, materialWidth, detailBox.height - 20f);
            DrawSolidRect(materialRect, new Color(0.018f, 0.024f, 0.023f, 1f));
            GUIStyle materialStyle = new GUIStyle(_runtimeSmallStyle);
            materialStyle.alignment = TextAnchor.UpperLeft;
            materialStyle.fontSize = Mathf.Max(11, _runtimeSmallStyle.fontSize - 2);
            GUI.Label(new Rect(materialRect.x + 10f, materialRect.y + 6f, materialRect.width - 20f, materialRect.height - 12f), BuildBlacksmithMaterialText(level), materialStyle);

            int[] enhanceCounts = { 1, 5, 10 };
            for (int i = 0; i < enhanceCounts.Length; i++)
            {
                int count = enhanceCounts[i];
                Rect actionRect = new Rect(buttonGroupRect.x + i * (buttonWidth + buttonGap), buttonGroupRect.y, buttonWidth, buttonHeight);
                DrawEnhanceButton(actionRect, item, count);
            }

            GUI.backgroundColor = Color.white;
        }

        private string BuildBlacksmithMaterialText(int level)
        {
            DropSystem drops = DropSystem.Instance;
            int dust = drops != null ? drops.materialCount : 0;
            int ore = drops != null ? drops.oreCount : 0;
            string text = $"持有：灵尘 {dust}  铁砂 {ore}";
            int[] counts = { 1, 5, 10 };
            for (int i = 0; i < counts.Length; i++)
            {
                int safeCount = Mathf.Min(counts[i], Mathf.Max(0, 3 - level));
                int dustCost;
                int oreCost;
                GetEnhanceBatchCost(level, safeCount, out dustCost, out oreCost);
                string label = counts[i] == 1 ? "1次" : $"最多{counts[i]}次";
                string cost = safeCount <= 0 ? "已满" : $"{dustCost}尘 {oreCost}砂";
                text += $"\n{label}：{cost}";
            }

            return text;
        }

        private string GetEnhanceNextStatPreview(EquipmentItem item)
        {
            int level = GetEquipmentEnhanceLevel(item);
            if (level >= 3)
            {
                return "已达当前强化上限";
            }

            if (IsOffensiveEnhanceSlot(item.slot))
            {
                return "下级：攻击 +2";
            }

            return "下级：生命 +5  防御 +1";
        }

        private void DrawEnhanceButton(Rect actionRect, EquipmentItem item, int requestedCount)
        {
            int level = GetEquipmentEnhanceLevel(item);
            string label = requestedCount == 1 ? "强化1次" : $"最多{requestedCount}次";
            bool canEnhance = CanEnhanceEquipment(item, requestedCount);
            GUIStyle buttonStyle = new GUIStyle(_runtimeButtonStyle);
            buttonStyle.fontSize = Mathf.Max(11, _runtimeButtonStyle.fontSize - 3);
            GUI.backgroundColor = canEnhance ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (canEnhance)
            {
                if (GUI.Button(actionRect, label, buttonStyle))
                {
                    EnhanceEquipment(item, requestedCount);
                }
                return;
            }

            string disabledLabel = level >= 3 ? "已满" : requestedCount == 1 ? "1次不足" : $"{requestedCount}次不足";
            if (GUI.Button(actionRect, disabledLabel, buttonStyle) && level < 3)
            {
                int dustCost = GetEnhanceDustCost(level);
                int oreCost = GetEnhanceOreCost(level);
                _townNotice = $"铁匠铺：材料不足，下次强化需要灵尘 {dustCost}、铁砂 {oreCost}。";
            }
        }

        private void DrawEquipmentPanelActions(Rect detailRect)
        {
            Rect contentRect = new Rect(detailRect.x + 42f, detailRect.y + 62f, detailRect.width - 84f, detailRect.height - 116f);
            Rect equipmentRect = new Rect(contentRect.x, contentRect.y, contentRect.width, contentRect.height - 58f);
            DrawEquipmentCharacterPanel(equipmentRect);
            DrawEquipmentSlots(equipmentRect);
            if (!_showEquipmentBag)
            {
                DrawSelectedEquipmentSlotInfo(contentRect);
            }

            if (_showEquipmentBag)
            {
                DrawEquipmentBagPopup(contentRect);
            }
        }

        private void DrawEquipmentCharacterPanel(Rect contentRect)
        {
            float centerWidth = Mathf.Min(240f, contentRect.width * 0.32f);
            Rect characterRect = new Rect(contentRect.x + (contentRect.width - centerWidth) * 0.5f, contentRect.y + 8f, centerWidth, contentRect.height - 16f);
            DrawSolidRect(characterRect, new Color(0.025f, 0.03f, 0.028f, 1f));

            Rect headRect = new Rect(characterRect.x + characterRect.width * 0.5f - 18f, characterRect.y + 28f, 36f, 34f);
            Rect bodyRect = new Rect(characterRect.x + characterRect.width * 0.5f - 34f, headRect.yMax + 10f, 68f, Mathf.Max(72f, characterRect.height * 0.34f));
            Rect legRect = new Rect(characterRect.x + characterRect.width * 0.5f - 28f, bodyRect.yMax + 8f, 56f, Mathf.Max(42f, characterRect.yMax - bodyRect.yMax - 72f));

            DrawSolidRect(headRect, new Color(0.6f, 0.28f, 0.18f, 1f));
            DrawSolidRect(bodyRect, new Color(0.12f, 0.32f, 0.29f, 1f));
            DrawSolidRect(legRect, new Color(0.08f, 0.18f, 0.2f, 1f));

            string stats = $"主角 Lv.{_heroLevel}\n攻击 +{GetEquippedAttackBonus()}  生命 +{GetEquippedHpBonus()}  防御 +{GetEquippedDefenseBonus()}";
            GUI.Label(new Rect(characterRect.x + 12f, characterRect.yMax - 56f, characterRect.width - 24f, 48f), stats, _runtimeSmallStyle);
        }

        private void DrawEquipmentSlots(Rect contentRect)
        {
            EquipmentSlot[] leftSlots = { EquipmentSlot.Helmet, EquipmentSlot.Armor, EquipmentSlot.Boots };
            EquipmentSlot[] rightSlots = { EquipmentSlot.Weapon, EquipmentSlot.Gloves, EquipmentSlot.Accessory };
            float slotWidth = Mathf.Clamp(contentRect.width * 0.24f, 132f, 178f);
            float topPadding = 12f;
            float gapY = Mathf.Clamp(contentRect.height * 0.045f, 8f, 16f);
            float slotHeight = Mathf.Clamp((contentRect.height - topPadding * 2f - gapY * 2f) / 3f, 46f, 66f);
            float startY = contentRect.y + topPadding;

            for (int i = 0; i < leftSlots.Length; i++)
            {
                Rect slotRect = new Rect(contentRect.x + 16f, startY + i * (slotHeight + gapY), slotWidth, slotHeight);
                DrawEquipmentSlotButton(slotRect, leftSlots[i]);
            }

            for (int i = 0; i < rightSlots.Length; i++)
            {
                Rect slotRect = new Rect(contentRect.xMax - slotWidth - 16f, startY + i * (slotHeight + gapY), slotWidth, slotHeight);
                DrawEquipmentSlotButton(slotRect, rightSlots[i]);
            }
        }

        private void DrawEquipmentSlotButton(Rect slotRect, EquipmentSlot slot)
        {
            EquipmentItem equipped = GetEquippedItem(slot);
            bool selected = _hasSelectedEquipmentSlot && slot == _selectedEquipmentSlot;
            GUI.backgroundColor = selected ? new Color(0.16f, 0.38f, 0.34f, 1f) : new Color(0.075f, 0.095f, 0.09f, 1f);

            string itemName = string.IsNullOrEmpty(equipped.name) ? "空" : equipped.name;
            string label = $"{GetSlotName(slot)}\n{itemName}";
            GUIStyle slotStyle = new GUIStyle(_runtimeMapButtonStyle);
            slotStyle.fontSize = Mathf.Max(12, _runtimeMapButtonStyle.fontSize - 2);
            if (_showEquipmentBag)
            {
                GUI.Box(slotRect, label, selected ? slotStyle : _runtimeDisabledButtonStyle);
                GUI.backgroundColor = Color.white;
                return;
            }

            if (GUI.Button(slotRect, label, slotStyle))
            {
                _selectedEquipmentSlot = slot;
                _hasSelectedEquipmentSlot = true;
                _showEquipmentBag = true;
                _showDismantleConfirm = false;
                ClearSelectedEquipmentForSlot(slot);
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawSelectedEquipmentSlotInfo(Rect contentRect)
        {
            Rect quickEquipRect = new Rect(contentRect.x + 16f, contentRect.yMax - 48f, 122f, 36f);
            Rect infoRect = new Rect(quickEquipRect.xMax + 10f, contentRect.yMax - 48f, contentRect.width - 48f - quickEquipRect.width - 10f, 36f);
            bool canAutoEquip = CanAutoEquipBestSet();
            GUI.backgroundColor = canAutoEquip ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (canAutoEquip)
            {
                if (GUI.Button(quickEquipRect, "一键穿戴", _runtimeButtonStyle))
                {
                    AutoEquipBestSet();
                }
            }
            else
            {
                GUI.Box(quickEquipRect, "一键穿戴", _runtimeDisabledButtonStyle);
            }

            if (!_hasSelectedEquipmentSlot)
            {
                DrawSolidRect(infoRect, new Color(0.028f, 0.034f, 0.032f, 1f));
                GUI.Label(infoRect, "请选择装备部位。", _runtimeSmallStyle);
                GUI.backgroundColor = Color.white;
                return;
            }

            EquipmentItem equipped = GetEquippedItem(_selectedEquipmentSlot);
            string equippedText = string.IsNullOrEmpty(equipped.name)
                ? "当前为空，点击槽位选择可穿戴装备。"
                : $"当前：{BuildEquipmentLine(equipped)}";
            DrawSolidRect(infoRect, new Color(0.028f, 0.034f, 0.032f, 1f));
            GUI.Label(infoRect, $"{GetSlotName(_selectedEquipmentSlot)}  {equippedText}", _runtimeSmallStyle);
            GUI.backgroundColor = Color.white;
        }

        private void DrawEquipmentBagPopup(Rect contentRect)
        {
            Rect popupRect = new Rect(contentRect.x + contentRect.width * 0.18f, contentRect.y + 24f, contentRect.width * 0.64f, contentRect.height - 56f);
            DrawSolidRect(popupRect, new Color(0.018f, 0.022f, 0.021f, 0.98f));
            GUI.Label(new Rect(popupRect.x, popupRect.y + 12f, popupRect.width, 30f), $"{GetSlotName(_selectedEquipmentSlot)}装备库", _runtimeInfoStyle);
            bool interactionLocked = _showDismantleConfirm;

            Rect closeRect = new Rect(popupRect.xMax - 42f, popupRect.y + 10f, 28f, 28f);
            GUI.backgroundColor = new Color(0.18f, 0.22f, 0.22f, 1f);
            if (interactionLocked)
            {
                GUI.Box(closeRect, "X", _runtimeDisabledButtonStyle);
            }
            else if (GUI.Button(closeRect, "X", _runtimeMapButtonStyle))
            {
                _showEquipmentBag = false;
                _showDismantleConfirm = false;
            }

            float slotSize = Mathf.Clamp(popupRect.width / 5.8f, 68f, 86f);
            float gap = 8f;
            int columns = Mathf.Max(3, Mathf.FloorToInt((popupRect.width - 44f + gap) / (slotSize + gap)));
            float startX = popupRect.x + 22f;
            float startY = popupRect.y + 58f;
            int visibleIndex = 0;

            for (int i = 0; i < _equipmentInventory.Length; i++)
            {
                EquipmentItem item = _equipmentInventory[i];
                if (!IsEquipmentOwned(i) || item.slot != _selectedEquipmentSlot)
                {
                    continue;
                }

                int row = visibleIndex / columns;
                int col = visibleIndex % columns;
                Rect itemRect = new Rect(startX + col * (slotSize + gap), startY + row * (slotSize + gap), slotSize, slotSize);
                DrawEquipmentBagItemSlot(itemRect, i, interactionLocked);
                visibleIndex++;
            }

            if (visibleIndex == 0)
            {
                GUI.Label(new Rect(popupRect.x + 22f, startY + 20f, popupRect.width - 44f, 28f), "当前没有这个部位的装备。", _runtimeSmallStyle);
            }

            if (interactionLocked)
            {
                DrawEquipmentDismantleConfirm(popupRect);
            }
            else
            {
                DrawSelectedEquipmentBagAction(popupRect);
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawSelectedEquipmentBagAction(Rect popupRect)
        {
            Rect actionRect = new Rect(popupRect.x + 28f, popupRect.yMax - 46f, popupRect.width - 56f, 32f);
            if (!TryGetSelectedEquipmentForCurrentSlot(out EquipmentItem item))
            {
                GUI.backgroundColor = new Color(0.07f, 0.075f, 0.078f, 1f);
                GUI.Box(actionRect, "请选择装备", _runtimeDisabledButtonStyle);
                return;
            }

            bool equipped = IsEquipped(item);
            bool canEquip = CanEquip(item);
            if (equipped)
            {
                GUI.backgroundColor = new Color(0.22f, 0.22f, 0.18f, 1f);
                if (GUI.Button(actionRect, "卸下当前", _runtimeButtonStyle))
                {
                    UnequipSlot(_selectedEquipmentSlot);
                }
                return;
            }

            float gap = 8f;
            float halfWidth = (actionRect.width - gap) * 0.5f;
            Rect dismantleRect = new Rect(actionRect.x, actionRect.y, halfWidth, actionRect.height);
            Rect equipRect = new Rect(dismantleRect.xMax + gap, actionRect.y, halfWidth, actionRect.height);

            GUI.backgroundColor = new Color(0.24f, 0.2f, 0.16f, 1f);
            if (GUI.Button(dismantleRect, $"拆解 +{GetDismantleDustReward(item)}尘 +{GetDismantleOreReward(item)}砂", _runtimeButtonStyle))
            {
                RequestDismantleSelectedEquipment();
            }

            if (canEquip)
            {
                bool replacing = !string.IsNullOrEmpty(GetEquippedItem(_selectedEquipmentSlot).name);
                GUI.backgroundColor = new Color(0.12f, 0.32f, 0.29f, 1f);
                if (GUI.Button(equipRect, replacing ? "替换" : "穿戴", _runtimeButtonStyle))
                {
                    EquipItem(item);
                }
                return;
            }

            GUI.backgroundColor = new Color(0.07f, 0.075f, 0.078f, 1f);
            GUI.Box(equipRect, GetEquipBlockShortReason(item), _runtimeDisabledButtonStyle);
        }

        private void DrawEquipmentDismantleConfirm(Rect popupRect)
        {
            if (!TryGetSelectedEquipmentForCurrentSlot(out EquipmentItem item))
            {
                _showDismantleConfirm = false;
                return;
            }

            DrawSolidRect(popupRect, new Color(0f, 0f, 0f, 0.48f));
            float width = Mathf.Min(360f, popupRect.width * 0.82f);
            float height = 158f;
            Rect confirmRect = new Rect(popupRect.x + (popupRect.width - width) * 0.5f, popupRect.y + (popupRect.height - height) * 0.5f, width, height);
            DrawSolidRect(confirmRect, new Color(0.028f, 0.034f, 0.032f, 1f));

            GUI.Label(new Rect(confirmRect.x + 18f, confirmRect.y + 16f, confirmRect.width - 36f, 28f), "确认拆解", _runtimeInfoStyle);
            string message = $"{item.name}\n获得：{GetDismantleDustReward(item)} 灵尘  {GetDismantleOreReward(item)} 铁砂";
            GUI.Label(new Rect(confirmRect.x + 24f, confirmRect.y + 52f, confirmRect.width - 48f, 42f), message, _runtimePanelInfoStyle);

            float gap = 10f;
            float buttonWidth = (confirmRect.width - 54f - gap) * 0.5f;
            Rect cancelRect = new Rect(confirmRect.x + 27f, confirmRect.yMax - 46f, buttonWidth, 32f);
            Rect confirmButtonRect = new Rect(cancelRect.xMax + gap, cancelRect.y, buttonWidth, 32f);

            GUI.backgroundColor = new Color(0.18f, 0.22f, 0.22f, 1f);
            if (GUI.Button(cancelRect, "取消", _runtimeButtonStyle))
            {
                _showDismantleConfirm = false;
            }

            GUI.backgroundColor = new Color(0.34f, 0.18f, 0.16f, 1f);
            if (GUI.Button(confirmButtonRect, "确认拆解", _runtimeButtonStyle))
            {
                DismantleSelectedEquipment();
            }
        }

        private void DrawEquipmentBagItemSlot(Rect itemRect, int itemIndex, bool interactionLocked)
        {
            EquipmentItem item = _equipmentInventory[itemIndex];
            bool selected = itemIndex == _selectedEquipmentIndex;
            bool equipped = IsEquipped(item);
            bool canEquip = CanEquip(item);
            GUI.backgroundColor = equipped ? new Color(0.2f, 0.34f, 0.24f, 1f) : selected ? new Color(0.16f, 0.38f, 0.34f, 1f) : canEquip ? new Color(0.075f, 0.095f, 0.09f, 1f) : new Color(0.045f, 0.05f, 0.048f, 1f);

            string status = GetEquipmentSlotStatusText(item, equipped, canEquip);
            string label = $"{item.name}\n{item.quality}\n{BuildEquipmentStatShortText(item)}\n{status}";
            GUIStyle itemStyle = new GUIStyle(_runtimeMapButtonStyle);
            itemStyle.fontSize = Mathf.Max(11, _runtimeMapButtonStyle.fontSize - 1);
            if (interactionLocked)
            {
                GUI.Box(itemRect, label, itemStyle);
            }
            else if (GUI.Button(itemRect, label, itemStyle))
            {
                _selectedEquipmentIndex = itemIndex;
                if (!canEquip)
                {
                    _townNotice = $"装备阁：{item.name}不能穿戴，{GetEquipBlockReason(item)}。";
                }
            }

            GUI.backgroundColor = Color.white;
        }

        private string GetEquipmentSlotStatusText(EquipmentItem item, bool equipped, bool canEquip)
        {
            if (equipped)
            {
                return "已穿";
            }

            if (canEquip)
            {
                return $"Lv.{item.levelRequirement}";
            }

            if (_heroLevel < item.levelRequirement)
            {
                return $"Lv.{item.levelRequirement}不足";
            }

            return "职业不符";
        }

        private void DrawCodexGui()
        {
            RefreshDailySweepPurchases();

            float panelWidth = Mathf.Min(720f, Screen.width * 0.78f);
            float panelHeight = Mathf.Min(500f, Screen.height * 0.84f);
            float maxPanelHeight = Mathf.Max(280f, Screen.height - 36f);
            float minPanelHeight = Mathf.Min(360f, maxPanelHeight);
            panelHeight = Mathf.Clamp(panelHeight, minPanelHeight, maxPanelHeight);
            Rect panelRect = new Rect((Screen.width - panelWidth) * 0.5f, Screen.height * 0.05f, panelWidth, panelHeight);

            GUI.backgroundColor = new Color(0.035f, 0.04f, 0.038f, 1f);
            GUI.Box(panelRect, GUIContent.none);
            GUI.backgroundColor = Color.white;

            DrawCodexBookBackdrop(panelRect);
            GUI.Label(new Rect(panelRect.x, panelRect.y + 18f, panelRect.width, 34f), "灵素图谱 一", _runtimeTitleStyle);
            GUI.Label(new Rect(panelRect.x, panelRect.y + 60f, panelRect.width, 24f), $"{GetMaterialName("spirit_dust")} {GetMaterialCount()}    {PremiumCurrencyName} {_premiumCurrencyCount}    {RecruitTokenName} {_recruitTokenCount}    已通关 {_completedMapIndex}/3    扫荡次数 {_sweepAttempts}", _runtimeInfoStyle);
            GUI.Label(new Rect(panelRect.x + 54f, panelRect.y + 88f, panelRect.width - 108f, 20f), GetPageUnlockText(), _runtimeSmallStyle);

            Rect mapAreaRect = new Rect(panelRect.x + 54f, panelRect.y + 112f, panelRect.width - 108f, Mathf.Max(132f, panelRect.height - 260f));
            DrawSolidRect(mapAreaRect, new Color(0.028f, 0.034f, 0.032f, 1f));
            float nodeGap = 14f;
            float nodeWidth = (mapAreaRect.width - 32f - nodeGap * 2f) / 3f;
            float nodeHeight = Mathf.Max(102f, mapAreaRect.height - 28f);
            float nodeY = mapAreaRect.y + 14f;
            float nodeStartX = mapAreaRect.x + 16f;

            for (int mapIndex = 1; mapIndex <= 3; mapIndex++)
            {
                bool unlocked = mapIndex <= _unlockedMapIndex;
                bool completed = mapIndex <= _completedMapIndex;
                Rect nodeRect = new Rect(nodeStartX + (mapIndex - 1) * (nodeWidth + nodeGap), nodeY, nodeWidth, nodeHeight);
                Rect challengeRect = new Rect(nodeRect.x, nodeRect.y, nodeRect.width, nodeRect.height - 38f);
                string status = completed ? "已通关" : unlocked ? "可挑战" : "未解锁";
                string label = $"地图 {mapIndex}\n{status}\n等级 {GetRecommendedLevel(mapIndex)}    经验 {GetMapPreviewExp(mapIndex)}";

                GUI.backgroundColor = unlocked ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
                if (unlocked)
                {
                    if (GUI.Button(challengeRect, label, _runtimeMapButtonStyle))
                    {
                        ChallengeMap(mapIndex);
                    }
                }
                else
                {
                    GUI.Box(challengeRect, label, _runtimeDisabledButtonStyle);
                }

                Rect sweepRect = new Rect(nodeRect.x + 12f, nodeRect.yMax - 34f, nodeRect.width - 24f, 26f);
                bool canSweep = completed && _sweepAttempts > 0;
                GUI.backgroundColor = canSweep ? new Color(0.22f, 0.36f, 0.24f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
                string sweepLabel = GetSweepButtonLabel(mapIndex, completed, canSweep);
                if (canSweep)
                {
                    if (GUI.Button(sweepRect, sweepLabel, _runtimeButtonStyle))
                    {
                        SweepMap(mapIndex);
                    }
                }
                else
                {
                    GUI.Box(sweepRect, sweepLabel, _runtimeDisabledButtonStyle);
                }
            }

            float backWidth = Mathf.Min(220f, panelRect.width * 0.3f);
            Rect backRect = new Rect(panelRect.x + (panelRect.width - backWidth) * 0.5f, panelRect.y + panelRect.height - 54f, backWidth, 36f);
            Rect utilityRect = new Rect(panelRect.x + 88f, backRect.y - 38f, panelRect.width - 176f, 28f);
            Rect noticeRect = new Rect(panelRect.x + 72f, utilityRect.y - 30f, panelRect.width - 144f, 22f);

            GUI.backgroundColor = Color.white;
            DrawSolidRect(noticeRect, new Color(0.07f, 0.078f, 0.07f, 1f));
            GUI.Label(noticeRect, _codexNotice, _runtimeSmallStyle);
            DrawCodexUtilityActions(utilityRect);

            GUI.backgroundColor = new Color(0.18f, 0.22f, 0.22f, 1f);
            if (GUI.Button(backRect, "返回城镇", _runtimeButtonStyle))
            {
                ReturnHome();
            }
            GUI.backgroundColor = Color.white;
        }

        private void DrawCodexBookBackdrop(Rect panelRect)
        {
            Rect pageRect = new Rect(panelRect.x + 94f, panelRect.y + 64f, panelRect.width - 188f, panelRect.height - 138f);
            DrawSolidRect(pageRect, new Color(0.065f, 0.06f, 0.052f, 1f));
        }

        private void DrawCodexTaskPanel(Rect taskRect, bool showUtilityActions)
        {
            DrawSolidRect(taskRect, new Color(0.025f, 0.03f, 0.028f, 1f));
            DrawCodexTaskTabs(new Rect(taskRect.x + 14f, taskRect.y + 6f, taskRect.width - 28f, 24f));

            float utilityHeight = showUtilityActions ? 32f : 0f;
            Rect listRect = new Rect(taskRect.x + 14f, taskRect.y + 36f, taskRect.width - 28f, Mathf.Max(40f, taskRect.height - 42f - utilityHeight));
            if (_selectedCodexTaskTab == CodexTaskTab.Main)
            {
                DrawMainTaskRows(listRect);
            }
            else
            {
                DrawSideTaskRows(listRect);
            }

            if (showUtilityActions)
            {
                Rect bottomRect = new Rect(taskRect.x + 14f, taskRect.yMax - 28f, taskRect.width - 28f, 22f);
                DrawCodexUtilityActions(bottomRect);
            }
        }

        private void DrawCodexTaskTabs(Rect tabArea)
        {
            float gap = 8f;
            float tabWidth = Mathf.Min(116f, (tabArea.width - gap) * 0.5f);
            DrawCodexTaskTabButton(new Rect(tabArea.x, tabArea.y, tabWidth, tabArea.height), CodexTaskTab.Main, "主线任务");
            DrawCodexTaskTabButton(new Rect(tabArea.x + tabWidth + gap, tabArea.y, tabWidth, tabArea.height), CodexTaskTab.Side, "支线任务");
        }

        private void DrawCodexTaskTabButton(Rect rect, CodexTaskTab tab, string label)
        {
            bool selected = _selectedCodexTaskTab == tab;
            GUI.backgroundColor = selected ? new Color(0.16f, 0.38f, 0.34f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (GUI.Button(rect, label, _runtimeMapButtonStyle))
            {
                _selectedCodexTaskTab = tab;
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawMainTaskRows(Rect listRect)
        {
            float gap = 6f;
            float rowHeight = Mathf.Max(18f, (listRect.height - gap * 2f) / 3f);
            for (int i = 0; i < 3; i++)
            {
                int taskIndex = i;
                Rect rowRect = new Rect(listRect.x, listRect.y + i * (rowHeight + gap), listRect.width, rowHeight);
                DrawTaskRewardRow(rowRect, $"首通图谱一 地图 {taskIndex + 1}", BuildMainTaskRewardText(taskIndex), _completedMapIndex >= taskIndex + 1, _mainTaskRewardClaimed[taskIndex], () => ClaimMainTaskReward(taskIndex));
            }
        }

        private void DrawSideTaskRows(Rect listRect)
        {
            Rect rowRect = new Rect(listRect.x, listRect.y, listRect.width, Mathf.Min(42f, listRect.height));
            DrawTaskRewardRow(rowRect, "完成任意一次扫荡", $"奖励：{RecruitTokenName} x1  {GetMaterialName("spirit_dust")} x5", _hasSweptOnce, _sideTaskRewardClaimed[0], () => ClaimSideTaskReward(0));
        }

        private void DrawTaskRewardRow(Rect rowRect, string title, string rewardText, bool completed, bool claimed, System.Action claimAction)
        {
            DrawSolidRect(rowRect, new Color(0.035f, 0.04f, 0.038f, 1f));
            GUIStyle rowStyle = new GUIStyle(_runtimeSmallStyle);
            rowStyle.alignment = TextAnchor.MiddleLeft;
            rowStyle.wordWrap = false;
            rowStyle.fontSize = Mathf.Max(10, _runtimeSmallStyle.fontSize - 2);
            string rowText = rowRect.height < 32f ? $"{title}  {rewardText}" : $"{title}\n{rewardText}";
            GUI.Label(new Rect(rowRect.x + 12f, rowRect.y + 2f, rowRect.width - 138f, rowRect.height - 4f), rowText, rowStyle);

            float actionHeight = Mathf.Min(24f, Mathf.Max(18f, rowRect.height - 6f));
            Rect actionRect = new Rect(rowRect.xMax - 108f, rowRect.y + (rowRect.height - actionHeight) * 0.5f, 94f, actionHeight);
            string label = claimed ? "已领取" : completed ? "领取" : "未完成";
            bool canClaim = completed && !claimed;
            GUI.backgroundColor = canClaim ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            if (canClaim)
            {
                if (GUI.Button(actionRect, label, _runtimeMapButtonStyle))
                {
                    claimAction();
                }
            }
            else
            {
                GUI.Box(actionRect, label, _runtimeDisabledButtonStyle);
            }

            GUI.backgroundColor = Color.white;
        }

        private void DrawCodexUtilityActions(Rect bottomRect)
        {
            float gap = 8f;
            float halfWidth = (bottomRect.width - gap) * 0.5f;
            Rect buySweepRect = new Rect(bottomRect.x, bottomRect.y, halfWidth, bottomRect.height);
            bool canBuySweep = CanBuySweepAttempt();
            GUI.backgroundColor = canBuySweep ? new Color(0.12f, 0.32f, 0.29f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            string buySweepLabel = $"扫荡 +1  {GetSweepPurchaseCost()} {GetMaterialName("spirit_dust")}";
            if (canBuySweep)
            {
                if (GUI.Button(buySweepRect, buySweepLabel, _runtimeMapButtonStyle))
                {
                    BuySweepAttempt();
                }
            }
            else
            {
                GUI.Box(buySweepRect, buySweepLabel, _runtimeDisabledButtonStyle);
            }

            Rect pageTwoRect = new Rect(buySweepRect.xMax + gap, bottomRect.y, halfWidth, bottomRect.height);
            GUI.backgroundColor = _completedMapIndex >= 3 ? new Color(0.2f, 0.34f, 0.24f, 1f) : new Color(0.07f, 0.075f, 0.078f, 1f);
            GUI.Box(pageTwoRect, _completedMapIndex >= 3 ? "图谱二已解锁（占位）" : "通关图谱一解锁图谱二", _runtimeMapButtonStyle);
            GUI.backgroundColor = Color.white;
        }

        private string BuildMainTaskRewardText(int taskIndex)
        {
            switch (taskIndex)
            {
                case 0:
                    return $"奖励：{RecruitTokenName} x1  {GetMaterialName("spirit_dust")} x10";
                case 1:
                    return $"奖励：{RecruitTokenName} x2  {PremiumCurrencyName} x100";
                default:
                    return $"奖励：{RecruitTokenName} x5  {PremiumCurrencyName} x300";
            }
        }

        private void ClaimMainTaskReward(int taskIndex)
        {
            if (taskIndex < 0 || taskIndex >= _mainTaskRewardClaimed.Length || _mainTaskRewardClaimed[taskIndex] || _completedMapIndex < taskIndex + 1)
            {
                return;
            }

            _mainTaskRewardClaimed[taskIndex] = true;
            switch (taskIndex)
            {
                case 0:
                    AwardTaskReward(10, 0, 1);
                    break;
                case 1:
                    AwardTaskReward(0, 100, 2);
                    break;
                default:
                    AwardTaskReward(0, 300, 5);
                    break;
            }

            _codexNotice = $"主线任务奖励已领取：{BuildMainTaskRewardText(taskIndex)}。";
            SaveProgress();
        }

        private void ClaimSideTaskReward(int taskIndex)
        {
            if (taskIndex != 0 || _sideTaskRewardClaimed[0] || !_hasSweptOnce)
            {
                return;
            }

            _sideTaskRewardClaimed[0] = true;
            AwardTaskReward(5, 0, 1);
            _codexNotice = $"支线任务奖励已领取：{RecruitTokenName} x1，{GetMaterialName("spirit_dust")} x5。";
            SaveProgress();
        }

        private void AwardTaskReward(int dust, int premiumCurrency, int recruitToken)
        {
            if (dust > 0 && DropSystem.Instance != null)
            {
                DropSystem.Instance.AwardMaterials(dust);
            }

            _premiumCurrencyCount += Mathf.Max(0, premiumCurrency);
            _recruitTokenCount += Mathf.Max(0, recruitToken);
            RefreshDropUi();
        }

        private void DrawCodexNodeFrame(Rect rect, int mapIndex, bool unlocked, bool completed)
        {
            Color nodeColor = completed
                ? new Color(0.2f, 0.42f, 0.28f, 1f)
                : unlocked ? new Color(0.14f, 0.28f, 0.46f, 1f) : new Color(0.08f, 0.08f, 0.09f, 1f);

            DrawSolidRect(new Rect(rect.x + 12f, rect.y + rect.height * 0.5f - 3f, rect.width - 24f, 6f), new Color(0.38f, 0.16f, 0.06f, 1f));
            DrawSolidRect(new Rect(rect.x + rect.width * 0.5f - 22f, rect.y + 14f, 44f, 44f), nodeColor);
            DrawSolidRect(new Rect(rect.x + rect.width * 0.5f - 12f, rect.y + 24f, 24f, 24f), GetBuildingAccent(mapIndex));
        }

        private void DrawResultGui()
        {
            float panelWidth = Mathf.Min(460f, Screen.width * 0.48f);
            float panelHeight = Mathf.Min(300f, Screen.height * 0.68f);
            panelHeight = Mathf.Max(250f, panelHeight);
            Rect panelRect = new Rect((Screen.width - panelWidth) * 0.5f, Screen.height * 0.14f, panelWidth, panelHeight);

            GUI.backgroundColor = new Color(0.035f, 0.04f, 0.038f, 1f);
            GUI.Box(panelRect, GUIContent.none);
            GUI.backgroundColor = Color.white;

            string title = _currentState == GameState.Victory ? "胜利" : "失败";
            GUI.Label(new Rect(panelRect.x, panelRect.y + 24f, panelRect.width, 54f), title, _runtimeTitleStyle);
            GUI.Label(new Rect(panelRect.x, panelRect.y + 86f, panelRect.width, 100f), BuildResultSummary(), _runtimeInfoStyle);

            string buttonLabel = _currentState == GameState.Victory ? "返回图谱" : "返回城镇";
            float buttonWidth = Mathf.Min(240f, panelRect.width * 0.62f);
            Rect buttonRect = new Rect(panelRect.x + (panelRect.width - buttonWidth) * 0.5f, panelRect.y + panelRect.height - 82f, buttonWidth, 58f);

            GUI.backgroundColor = new Color(0.12f, 0.32f, 0.29f, 1f);
            if (GUI.Button(buttonRect, buttonLabel, _runtimeButtonStyle))
            {
                if (_currentState == GameState.Victory)
                {
                    CompleteCurrentMapAndReturnCodex();
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

        private void ConfigureRuntimeSystems()
        {
            _mapDropConfig = MapDropConfigLoader.Load();
            _materialConfig = MaterialConfigLoader.Load();

            if (battleManager != null && battleManager.skillController != null)
            {
                battleManager.skillController.potionProvider = TryConsumePotion;
                battleManager.skillController.potionCountProvider = GetPotionCount;
                battleManager.skillController.SetSkillOneLevel(_skillOneLevel);
            }
        }

        private void LoadProgress()
        {
            EnsureEquipmentOwnership();
            EnsureEquipmentEnhanceLevels();
            EnsureRecruitState();
            EnsureFormationState();
            DropSystem drops = DropSystem.Instance;
            if (!PlayerPrefs.HasKey(SaveVersionKey))
            {
                if (drops != null)
                {
                    drops.ResetAllDrops();
                }

                _premiumCurrencyCount = 9999;
                _recruitTokenCount = 0;
                _lastRecruitResultText = "暂无";
                _selectedRecruitRosterIndex = -1;
                _teamRecruitSlot2Index = -1;
                _teamRecruitSlot3Index = -1;
                ResetFormationState();
                _hasSweptOnce = false;
                ResetTaskRewardStates();
                ResetRecruitState();

                for (int i = 0; i < _equipmentOwned.Length; i++)
                {
                    _equipmentOwned[i] = IsDefaultOwnedEquipment(i);
                    _equipmentEnhanceLevels[i] = 0;
                }

                _progressLoaded = true;
                return;
            }

            _completedMapIndex = Mathf.Clamp(PlayerPrefs.GetInt(GetSaveKey("CompletedMap"), 0), 0, 3);
            _unlockedMapIndex = Mathf.Clamp(PlayerPrefs.GetInt(GetSaveKey("UnlockedMap"), Mathf.Max(1, _completedMapIndex + 1)), 1, 3);
            _unlockedMapIndex = Mathf.Max(_unlockedMapIndex, Mathf.Clamp(_completedMapIndex + 1, 1, 3));
            _selectedMapIndex = Mathf.Clamp(PlayerPrefs.GetInt(GetSaveKey("SelectedMap"), Mathf.Max(1, _unlockedMapIndex)), 1, 3);
            _stageIndex = _selectedMapIndex;
            _sweepAttempts = Mathf.Max(0, PlayerPrefs.GetInt(GetSaveKey("SweepAttempts"), 3));
            _sweepPurchaseCount = Mathf.Max(0, PlayerPrefs.GetInt(GetSaveKey("SweepPurchaseCount"), 0));
            _sweepPurchaseDate = PlayerPrefs.GetString(GetSaveKey("SweepPurchaseDate"), "");
            RefreshDailySweepPurchases();
            _heroLevel = Mathf.Max(1, PlayerPrefs.GetInt(GetSaveKey("HeroLevel"), 1));
            _heroExp = Mathf.Max(0, PlayerPrefs.GetInt(GetSaveKey("HeroExp"), 0));
            _potionCount = Mathf.Max(0, PlayerPrefs.GetInt(GetSaveKey("PotionCount"), 0));
            _skillOneLevel = Mathf.Clamp(PlayerPrefs.GetInt(GetSaveKey("SkillOneLevel"), 1), 1, 3);
            _bodyPillLevel = Mathf.Clamp(PlayerPrefs.GetInt(GetSaveKey("BodyPillLevel"), 0), 0, GetBodyPillMaxLevel());
            _evolutionStage = Mathf.Clamp(PlayerPrefs.GetInt(GetSaveKey("EvolutionStage"), 0), 0, GetEvolutionMaxStage());
            _premiumCurrencyCount = Mathf.Max(0, PlayerPrefs.GetInt(GetSaveKey("PremiumCurrency"), 9999));
            _recruitTokenCount = Mathf.Max(0, PlayerPrefs.GetInt(GetSaveKey("RecruitToken"), 0));
            _selectedRecruitRosterIndex = PlayerPrefs.GetInt(GetSaveKey("SelectedRecruitRoster"), -1);
            _teamRecruitSlot2Index = PlayerPrefs.GetInt(GetSaveKey("TeamRecruitSlot2"), -1);
            _teamRecruitSlot3Index = PlayerPrefs.GetInt(GetSaveKey("TeamRecruitSlot3"), -1);
            _hasSweptOnce = PlayerPrefs.GetInt(GetSaveKey("HasSweptOnce"), 0) == 1;
            _lastRecruitResultText = "暂无";
            LoadRecruitStates();
            LoadFormationState();
            MigrateLegacyTeamSlotsToFormation();
            ValidateRecruitSelections();
            ApplyBattleFormation();
            LoadTaskRewardStates();

            if (drops != null)
            {
                drops.SetBackpackCounts(
                    PlayerPrefs.GetInt(GetSaveKey("SpiritDust"), 0),
                    PlayerPrefs.GetInt(GetSaveKey("RedHerb"), 0),
                    PlayerPrefs.GetInt(GetSaveKey("IronSand"), 0));
            }

            RestoreEquippedItem(EquipmentSlot.Weapon, PlayerPrefs.GetString(GetEquipmentSaveKey(EquipmentSlot.Weapon), string.Empty));
            RestoreEquippedItem(EquipmentSlot.Helmet, PlayerPrefs.GetString(GetEquipmentSaveKey(EquipmentSlot.Helmet), string.Empty));
            RestoreEquippedItem(EquipmentSlot.Armor, PlayerPrefs.GetString(GetEquipmentSaveKey(EquipmentSlot.Armor), string.Empty));
            RestoreEquippedItem(EquipmentSlot.Gloves, PlayerPrefs.GetString(GetEquipmentSaveKey(EquipmentSlot.Gloves), string.Empty));
            RestoreEquippedItem(EquipmentSlot.Boots, PlayerPrefs.GetString(GetEquipmentSaveKey(EquipmentSlot.Boots), string.Empty));
            RestoreEquippedItem(EquipmentSlot.Accessory, PlayerPrefs.GetString(GetEquipmentSaveKey(EquipmentSlot.Accessory), string.Empty));
            for (int i = 0; i < _equipmentOwned.Length; i++)
            {
                _equipmentOwned[i] = PlayerPrefs.GetInt(GetEquipmentOwnedSaveKey(i), IsDefaultOwnedEquipment(i) ? 1 : 0) == 1;
                _equipmentEnhanceLevels[i] = Mathf.Clamp(PlayerPrefs.GetInt(GetEquipmentEnhanceSaveKey(i), 0), 0, 3);
            }

            if (battleManager != null && battleManager.skillController != null)
            {
                battleManager.skillController.SetSkillOneLevel(_skillOneLevel);
            }

            _progressLoaded = true;
        }

        private void SaveProgress()
        {
            if (!_progressLoaded)
            {
                return;
            }

            DropSystem drops = DropSystem.Instance;
            PlayerPrefs.SetInt(SaveVersionKey, CurrentSaveVersion);
            PlayerPrefs.SetInt(GetSaveKey("CompletedMap"), _completedMapIndex);
            PlayerPrefs.SetInt(GetSaveKey("UnlockedMap"), _unlockedMapIndex);
            PlayerPrefs.SetInt(GetSaveKey("SelectedMap"), _selectedMapIndex);
            PlayerPrefs.SetInt(GetSaveKey("SweepAttempts"), _sweepAttempts);
            PlayerPrefs.SetInt(GetSaveKey("SweepPurchaseCount"), _sweepPurchaseCount);
            PlayerPrefs.SetString(GetSaveKey("SweepPurchaseDate"), _sweepPurchaseDate);
            PlayerPrefs.SetInt(GetSaveKey("HeroLevel"), _heroLevel);
            PlayerPrefs.SetInt(GetSaveKey("HeroExp"), _heroExp);
            PlayerPrefs.SetInt(GetSaveKey("PotionCount"), _potionCount);
            PlayerPrefs.SetInt(GetSaveKey("SkillOneLevel"), _skillOneLevel);
            PlayerPrefs.SetInt(GetSaveKey("BodyPillLevel"), _bodyPillLevel);
            PlayerPrefs.SetInt(GetSaveKey("EvolutionStage"), _evolutionStage);
            PlayerPrefs.SetInt(GetSaveKey("PremiumCurrency"), _premiumCurrencyCount);
            PlayerPrefs.SetInt(GetSaveKey("RecruitToken"), _recruitTokenCount);
            PlayerPrefs.SetInt(GetSaveKey("SelectedRecruitRoster"), _selectedRecruitRosterIndex);
            PlayerPrefs.SetInt(GetSaveKey("TeamRecruitSlot2"), _teamRecruitSlot2Index);
            PlayerPrefs.SetInt(GetSaveKey("TeamRecruitSlot3"), _teamRecruitSlot3Index);
            SaveFormationState();
            PlayerPrefs.SetInt(GetSaveKey("HasSweptOnce"), _hasSweptOnce ? 1 : 0);
            PlayerPrefs.SetInt(GetSaveKey("SpiritDust"), drops != null ? drops.materialCount : 0);
            PlayerPrefs.SetInt(GetSaveKey("RedHerb"), drops != null ? drops.herbCount : 0);
            PlayerPrefs.SetInt(GetSaveKey("IronSand"), drops != null ? drops.oreCount : 0);
            PlayerPrefs.SetString(GetEquipmentSaveKey(EquipmentSlot.Weapon), _equippedWeapon.name ?? string.Empty);
            PlayerPrefs.SetString(GetEquipmentSaveKey(EquipmentSlot.Helmet), _equippedHelmet.name ?? string.Empty);
            PlayerPrefs.SetString(GetEquipmentSaveKey(EquipmentSlot.Armor), _equippedArmor.name ?? string.Empty);
            PlayerPrefs.SetString(GetEquipmentSaveKey(EquipmentSlot.Gloves), _equippedGloves.name ?? string.Empty);
            PlayerPrefs.SetString(GetEquipmentSaveKey(EquipmentSlot.Boots), _equippedBoots.name ?? string.Empty);
            PlayerPrefs.SetString(GetEquipmentSaveKey(EquipmentSlot.Accessory), _equippedAccessory.name ?? string.Empty);
            EnsureEquipmentOwnership();
            EnsureEquipmentEnhanceLevels();
            for (int i = 0; i < _equipmentOwned.Length; i++)
            {
                PlayerPrefs.SetInt(GetEquipmentOwnedSaveKey(i), _equipmentOwned[i] ? 1 : 0);
                PlayerPrefs.SetInt(GetEquipmentEnhanceSaveKey(i), Mathf.Clamp(_equipmentEnhanceLevels[i], 0, 3));
            }
            SaveTaskRewardStates();
            SaveRecruitStates();
            PlayerPrefs.Save();
        }

        private void ClearProgress()
        {
            PlayerPrefs.DeleteKey(SaveVersionKey);
            PlayerPrefs.DeleteKey(GetSaveKey("CompletedMap"));
            PlayerPrefs.DeleteKey(GetSaveKey("UnlockedMap"));
            PlayerPrefs.DeleteKey(GetSaveKey("SelectedMap"));
            PlayerPrefs.DeleteKey(GetSaveKey("SweepAttempts"));
            PlayerPrefs.DeleteKey(GetSaveKey("SweepPurchaseCount"));
            PlayerPrefs.DeleteKey(GetSaveKey("SweepPurchaseDate"));
            PlayerPrefs.DeleteKey(GetSaveKey("HeroLevel"));
            PlayerPrefs.DeleteKey(GetSaveKey("HeroExp"));
            PlayerPrefs.DeleteKey(GetSaveKey("PotionCount"));
            PlayerPrefs.DeleteKey(GetSaveKey("SkillOneLevel"));
            PlayerPrefs.DeleteKey(GetSaveKey("BodyPillLevel"));
            PlayerPrefs.DeleteKey(GetSaveKey("EvolutionStage"));
            PlayerPrefs.DeleteKey(GetSaveKey("PremiumCurrency"));
            PlayerPrefs.DeleteKey(GetSaveKey("RecruitToken"));
            PlayerPrefs.DeleteKey(GetSaveKey("SelectedRecruitRoster"));
            PlayerPrefs.DeleteKey(GetSaveKey("TeamRecruitSlot2"));
            PlayerPrefs.DeleteKey(GetSaveKey("TeamRecruitSlot3"));
            DeleteFormationStateKeys();
            PlayerPrefs.DeleteKey(GetSaveKey("HasSweptOnce"));
            PlayerPrefs.DeleteKey(GetSaveKey("SpiritDust"));
            PlayerPrefs.DeleteKey(GetSaveKey("RedHerb"));
            PlayerPrefs.DeleteKey(GetSaveKey("IronSand"));
            DeleteTaskRewardStateKeys();
            DeleteRecruitStateKeys();
            PlayerPrefs.DeleteKey(GetEquipmentSaveKey(EquipmentSlot.Weapon));
            PlayerPrefs.DeleteKey(GetEquipmentSaveKey(EquipmentSlot.Helmet));
            PlayerPrefs.DeleteKey(GetEquipmentSaveKey(EquipmentSlot.Armor));
            PlayerPrefs.DeleteKey(GetEquipmentSaveKey(EquipmentSlot.Gloves));
            PlayerPrefs.DeleteKey(GetEquipmentSaveKey(EquipmentSlot.Boots));
            PlayerPrefs.DeleteKey(GetEquipmentSaveKey(EquipmentSlot.Accessory));
            for (int i = 0; i < _equipmentInventory.Length; i++)
            {
                PlayerPrefs.DeleteKey(GetEquipmentOwnedSaveKey(i));
                PlayerPrefs.DeleteKey(GetEquipmentEnhanceSaveKey(i));
            }
            PlayerPrefs.Save();

            _completedMapIndex = 0;
            _unlockedMapIndex = 1;
            _selectedMapIndex = 1;
            _stageIndex = 1;
            _sweepAttempts = 3;
            _sweepPurchaseCount = 0;
            _sweepPurchaseDate = GetTodayKey();
            _heroLevel = 1;
            _heroExp = 0;
            _potionCount = 0;
            _skillOneLevel = 1;
            _bodyPillLevel = 0;
            _evolutionStage = 0;
            _premiumCurrencyCount = 9999;
            _recruitTokenCount = 0;
            _lastRecruitResultText = "暂无";
            _selectedRecruitRosterIndex = -1;
            _teamRecruitSlot2Index = -1;
            _teamRecruitSlot3Index = -1;
            ResetFormationState();
            _hasSweptOnce = false;
            ResetTaskRewardStates();
            ResetRecruitState();
            _selectedCodexTaskTab = CodexTaskTab.Main;
            _selectedCharacterTab = CharacterTab.Stats;
            _showEquipmentBag = false;
            _showDismantleConfirm = false;
            _hasSelectedEquipmentSlot = false;
            _hasSelectedBlacksmithSlot = false;
            _hasSelectedCraftRecipe = false;
            _selectedBlacksmithTab = BlacksmithTab.Enhance;
            _selectedEquipmentIndex = -1;
            _selectedEquipmentSlot = EquipmentSlot.Weapon;
            _equippedWeapon = default(EquipmentItem);
            _equippedHelmet = default(EquipmentItem);
            _equippedArmor = default(EquipmentItem);
            _equippedGloves = default(EquipmentItem);
            _equippedBoots = default(EquipmentItem);
            _equippedAccessory = default(EquipmentItem);
            EnsureEquipmentOwnership();
            EnsureEquipmentEnhanceLevels();
            for (int i = 0; i < _equipmentOwned.Length; i++)
            {
                _equipmentOwned[i] = IsDefaultOwnedEquipment(i);
                _equipmentEnhanceLevels[i] = 0;
            }

            if (DropSystem.Instance != null)
            {
                DropSystem.Instance.ResetAllDrops();
            }

            if (battleManager != null && battleManager.skillController != null)
            {
                battleManager.skillController.SetSkillOneLevel(_skillOneLevel);
            }

            ApplyHeroLevelStats();
            _townNotice = "测试存档已清除。";
            RefreshDropUi();
        }

        private void EnsureRecruitState()
        {
            if (_recruitOwned == null || _recruitOwned.Length != _recruitCandidates.Length)
            {
                _recruitOwned = new bool[_recruitCandidates.Length];
            }

            if (_recruitFragments == null || _recruitFragments.Length != _recruitCandidates.Length)
            {
                _recruitFragments = new int[_recruitCandidates.Length];
            }

            if (_recruitRanks == null || _recruitRanks.Length != _recruitCandidates.Length)
            {
                _recruitRanks = new int[_recruitCandidates.Length];
                for (int i = 0; i < _recruitRanks.Length; i++)
                {
                    _recruitRanks[i] = 1;
                }
            }

            EnsureFormationState();
        }

        private void ResetRecruitState()
        {
            EnsureRecruitState();
            for (int i = 0; i < _recruitCandidates.Length; i++)
            {
                _recruitOwned[i] = false;
                _recruitFragments[i] = 0;
                _recruitRanks[i] = 1;
            }

            _selectedRecruitRosterIndex = -1;
            _teamRecruitSlot2Index = -1;
            _teamRecruitSlot3Index = -1;
            ResetFormationState();
        }

        private void LoadRecruitStates()
        {
            EnsureRecruitState();
            for (int i = 0; i < _recruitCandidates.Length; i++)
            {
                _recruitOwned[i] = PlayerPrefs.GetInt(GetRecruitOwnedSaveKey(i), 0) == 1;
                _recruitFragments[i] = Mathf.Max(0, PlayerPrefs.GetInt(GetRecruitFragmentsSaveKey(i), 0));
                if (!PlayerPrefs.HasKey(GetRecruitStarSaveKey(i)))
                {
                    PlayerPrefs.DeleteKey(GetRecruitRankSaveKey(i));
                }

                _recruitRanks[i] = Mathf.Clamp(PlayerPrefs.GetInt(GetRecruitStarSaveKey(i), 1), 1, GetRecruitMaxRank());
            }
        }

        private void SaveRecruitStates()
        {
            EnsureRecruitState();
            for (int i = 0; i < _recruitCandidates.Length; i++)
            {
                PlayerPrefs.SetInt(GetRecruitOwnedSaveKey(i), _recruitOwned[i] ? 1 : 0);
                PlayerPrefs.SetInt(GetRecruitFragmentsSaveKey(i), Mathf.Max(0, _recruitFragments[i]));
                PlayerPrefs.SetInt(GetRecruitStarSaveKey(i), Mathf.Clamp(_recruitRanks[i], 1, GetRecruitMaxRank()));
            }
        }

        private void DeleteRecruitStateKeys()
        {
            for (int i = 0; i < _recruitCandidates.Length; i++)
            {
                PlayerPrefs.DeleteKey(GetRecruitOwnedSaveKey(i));
                PlayerPrefs.DeleteKey(GetRecruitFragmentsSaveKey(i));
                PlayerPrefs.DeleteKey(GetRecruitStarSaveKey(i));
                PlayerPrefs.DeleteKey(GetRecruitRankSaveKey(i));
            }
        }

        private void ResetFormationState()
        {
            EnsureFormationState();
            for (int i = 0; i < _formationRecruitSlots.Length; i++)
            {
                _formationRecruitSlots[i] = -1;
            }
        }

        private void LoadFormationState()
        {
            EnsureFormationState();
            for (int i = 0; i < _formationRecruitSlots.Length; i++)
            {
                _formationRecruitSlots[i] = PlayerPrefs.GetInt(GetFormationSlotSaveKey(i), -1);
            }
        }

        private void SaveFormationState()
        {
            EnsureFormationState();
            for (int i = 0; i < _formationRecruitSlots.Length; i++)
            {
                PlayerPrefs.SetInt(GetFormationSlotSaveKey(i), _formationRecruitSlots[i]);
            }
        }

        private void DeleteFormationStateKeys()
        {
            for (int i = 0; i < FormationSlotCount; i++)
            {
                PlayerPrefs.DeleteKey(GetFormationSlotSaveKey(i));
            }
        }

        private void ValidateRecruitSelections()
        {
            EnsureRecruitState();
            if (!IsRecruitOwned(_selectedRecruitRosterIndex))
            {
                _selectedRecruitRosterIndex = GetFirstOwnedRecruitIndex();
            }

            if (!IsRecruitOwned(_teamRecruitSlot2Index))
            {
                _teamRecruitSlot2Index = GetFirstOwnedRecruitIndex();
            }

            if (!IsRecruitOwned(_teamRecruitSlot3Index) || _teamRecruitSlot3Index == _teamRecruitSlot2Index)
            {
                _teamRecruitSlot3Index = GetFirstOwnedRecruitIndexExcept(_teamRecruitSlot2Index);
            }

            EnsureFormationState();
            for (int i = 0; i < _formationRecruitSlots.Length; i++)
            {
                if (!IsRecruitOwned(_formationRecruitSlots[i]) || i == HeroFormationSlot)
                {
                    _formationRecruitSlots[i] = -1;
                }
            }

            for (int i = 0; i < _formationRecruitSlots.Length; i++)
            {
                int recruitIndex = _formationRecruitSlots[i];
                if (!IsRecruitOwned(recruitIndex))
                {
                    continue;
                }

                for (int j = i + 1; j < _formationRecruitSlots.Length; j++)
                {
                    if (_formationRecruitSlots[j] == recruitIndex)
                    {
                        _formationRecruitSlots[j] = -1;
                    }
                }
            }

            SyncLegacyTeamSlotsFromFormation();
        }

        private bool IsRecruitOwned(int recruitIndex)
        {
            EnsureRecruitState();
            return recruitIndex >= 0 && recruitIndex < _recruitOwned.Length && _recruitOwned[recruitIndex];
        }

        private int GetRecruitFragments(int recruitIndex)
        {
            EnsureRecruitState();
            if (recruitIndex < 0 || recruitIndex >= _recruitFragments.Length)
            {
                return 0;
            }

            return _recruitFragments[recruitIndex];
        }

        private int GetRecruitRank(int recruitIndex)
        {
            EnsureRecruitState();
            if (recruitIndex < 0 || recruitIndex >= _recruitRanks.Length)
            {
                return 1;
            }

            return Mathf.Clamp(_recruitRanks[recruitIndex], 1, GetRecruitMaxRank());
        }

        private string GetRecruitStarText(int recruitIndex)
        {
            return $"{GetRecruitRank(recruitIndex)}星";
        }

        private int GetOwnedRecruitCount()
        {
            EnsureRecruitState();
            int count = 0;
            for (int i = 0; i < _recruitOwned.Length; i++)
            {
                if (_recruitOwned[i])
                {
                    count++;
                }
            }

            return count;
        }

        private int GetFirstOwnedRecruitIndex()
        {
            return GetFirstOwnedRecruitIndexExcept(-1);
        }

        private int GetFirstOwnedRecruitIndexExcept(int excludedIndex)
        {
            EnsureRecruitState();
            for (int i = 0; i < _recruitOwned.Length; i++)
            {
                if (i != excludedIndex && _recruitOwned[i])
                {
                    return i;
                }
            }

            return -1;
        }

        private void ResetTaskRewardStates()
        {
            for (int i = 0; i < _mainTaskRewardClaimed.Length; i++)
            {
                _mainTaskRewardClaimed[i] = false;
            }

            for (int i = 0; i < _sideTaskRewardClaimed.Length; i++)
            {
                _sideTaskRewardClaimed[i] = false;
            }
        }

        private void LoadTaskRewardStates()
        {
            for (int i = 0; i < _mainTaskRewardClaimed.Length; i++)
            {
                _mainTaskRewardClaimed[i] = PlayerPrefs.GetInt(GetMainTaskRewardSaveKey(i), 0) == 1;
            }

            for (int i = 0; i < _sideTaskRewardClaimed.Length; i++)
            {
                _sideTaskRewardClaimed[i] = PlayerPrefs.GetInt(GetSideTaskRewardSaveKey(i), 0) == 1;
            }
        }

        private void SaveTaskRewardStates()
        {
            for (int i = 0; i < _mainTaskRewardClaimed.Length; i++)
            {
                PlayerPrefs.SetInt(GetMainTaskRewardSaveKey(i), _mainTaskRewardClaimed[i] ? 1 : 0);
            }

            for (int i = 0; i < _sideTaskRewardClaimed.Length; i++)
            {
                PlayerPrefs.SetInt(GetSideTaskRewardSaveKey(i), _sideTaskRewardClaimed[i] ? 1 : 0);
            }
        }

        private void DeleteTaskRewardStateKeys()
        {
            for (int i = 0; i < _mainTaskRewardClaimed.Length; i++)
            {
                PlayerPrefs.DeleteKey(GetMainTaskRewardSaveKey(i));
            }

            for (int i = 0; i < _sideTaskRewardClaimed.Length; i++)
            {
                PlayerPrefs.DeleteKey(GetSideTaskRewardSaveKey(i));
            }
        }

        private string GetMainTaskRewardSaveKey(int index)
        {
            return GetSaveKey("MainTaskReward" + index);
        }

        private string GetSideTaskRewardSaveKey(int index)
        {
            return GetSaveKey("SideTaskReward" + index);
        }

        private string GetRecruitOwnedSaveKey(int index)
        {
            return GetSaveKey("RecruitOwned" + index);
        }

        private string GetRecruitFragmentsSaveKey(int index)
        {
            return GetSaveKey("RecruitFragments" + index);
        }

        private string GetRecruitRankSaveKey(int index)
        {
            return GetSaveKey("RecruitRank" + index);
        }

        private string GetRecruitStarSaveKey(int index)
        {
            return GetSaveKey("RecruitStar" + index);
        }

        private string GetFormationSlotSaveKey(int index)
        {
            return GetSaveKey("FormationSlot" + index);
        }

        private string GetSaveKey(string name)
        {
            return SavePrefix + name;
        }

        private string GetEquipmentSaveKey(EquipmentSlot slot)
        {
            return GetSaveKey("Equipped" + slot.ToString());
        }

        private string GetEquipmentOwnedSaveKey(int index)
        {
            return GetSaveKey("EquipmentOwned" + index);
        }

        private string GetEquipmentEnhanceSaveKey(int index)
        {
            return GetSaveKey("EquipmentEnhance" + index);
        }

        private int GetPotionCount()
        {
            return _potionCount;
        }

        private bool CanBuyShopItem(ShopItem item)
        {
            return CanBuyShopItem(item, 1);
        }

        private bool CanBuyShopItem(ShopItem item, int quantity)
        {
            DropSystem drops = DropSystem.Instance;
            int safeQuantity = Mathf.Max(1, quantity);
            if (item.jadeCost > 0)
            {
                return _premiumCurrencyCount >= GetShopBuyTotalCost(item, safeQuantity);
            }

            return drops != null && drops.materialCount >= GetShopBuyTotalCost(item, safeQuantity);
        }

        private int GetMaxAffordableShopQuantity(ShopItem item)
        {
            DropSystem drops = DropSystem.Instance;
            int unitCost = GetShopItemUnitCost(item);
            if (unitCost <= 0)
            {
                return 0;
            }

            if (item.jadeCost > 0)
            {
                return Mathf.Max(0, _premiumCurrencyCount / unitCost);
            }

            if (drops == null)
            {
                return 0;
            }

            return Mathf.Max(0, drops.materialCount / unitCost);
        }

        private int GetShopBuyTotalCost(ShopItem item, int quantity)
        {
            return Mathf.Max(1, quantity) * GetShopItemUnitCost(item);
        }

        private int GetShopItemUnitCost(ShopItem item)
        {
            return item.jadeCost > 0 ? item.jadeCost : item.dustCost;
        }

        private string GetShopItemCurrencyName(ShopItem item)
        {
            return item.jadeCost > 0 ? PremiumCurrencyName : GetMaterialName("spirit_dust");
        }

        private string GetShopItemPriceShortText(ShopItem item)
        {
            string suffix = item.jadeCost > 0 ? "玉" : "尘";
            return $"{GetShopItemUnitCost(item)}{suffix}";
        }

        private void ClampShopBuyQuantity()
        {
            if (!HasSelectedShopItemInCategory())
            {
                _shopBuyQuantity = 1;
                _shopBuyQuantityInput = "1";
                return;
            }

            int maxQuantity = GetMaxAffordableShopQuantity(_shopItems[_selectedShopItemIndex]);
            _shopBuyQuantity = maxQuantity <= 0
                ? 1
                : Mathf.Clamp(_shopBuyQuantity, 1, maxQuantity);
            _shopBuyQuantityInput = _shopBuyQuantity.ToString();
        }

        private void ApplyShopQuantityInput(string input, int maxQuantity)
        {
            string digits = "";
            for (int i = 0; i < input.Length; i++)
            {
                if (char.IsDigit(input[i]))
                {
                    digits += input[i];
                }
            }

            if (string.IsNullOrEmpty(digits))
            {
                _shopBuyQuantityInput = "";
                _shopBuyQuantity = 1;
                return;
            }

            int parsed;
            if (!int.TryParse(digits, out parsed))
            {
                parsed = maxQuantity;
            }

            int upper = Mathf.Max(1, maxQuantity);
            _shopBuyQuantity = Mathf.Clamp(parsed, 1, upper);
            _shopBuyQuantityInput = _shopBuyQuantity.ToString();
        }

        private string GetSelectedShopCategory()
        {
            int index = Mathf.Clamp(_selectedShopCategoryIndex, 0, _shopCategories.Length - 1);
            return _shopCategories[index];
        }

        private int GetShopItemCountInCategory(string category)
        {
            int count = 0;
            for (int i = 0; i < _shopItems.Length; i++)
            {
                if (_shopItems[i].category == category)
                {
                    count++;
                }
            }

            return count;
        }

        private bool HasSelectedShopItemInCategory()
        {
            if (_selectedShopItemIndex < 0 || _selectedShopItemIndex >= _shopItems.Length)
            {
                return false;
            }

            return _shopItems[_selectedShopItemIndex].category == GetSelectedShopCategory();
        }

        private void ValidateSelectedShopItem()
        {
            int itemCount = GetShopItemCountInCategory(GetSelectedShopCategory());
            int maxPage = Mathf.Max(0, (itemCount - 1) / 10);
            _shopPageIndex = Mathf.Clamp(_shopPageIndex, 0, maxPage);

            if (_selectedShopItemIndex >= 0 && !HasSelectedShopItemInCategory())
            {
                _selectedShopItemIndex = -1;
                _shopBuyQuantity = 1;
            }
        }

        private void BuyShopItem(ShopItem item)
        {
            BuyShopItem(item, 1);
        }

        private void BuyShopItem(ShopItem item, int quantity)
        {
            DropSystem drops = DropSystem.Instance;
            if (drops == null && item.jadeCost <= 0)
            {
                _townNotice = "商店：背包数据未初始化。";
                return;
            }

            int safeQuantity = Mathf.Max(1, quantity);
            int totalCost = GetShopBuyTotalCost(item, safeQuantity);
            if (item.jadeCost > 0)
            {
                if (_premiumCurrencyCount < totalCost)
                {
                    _townNotice = $"商店：{PremiumCurrencyName}不足。";
                    return;
                }

                _premiumCurrencyCount -= totalCost;
            }
            else if (!drops.ConsumeMaterials(totalCost))
            {
                _townNotice = $"商店：{GetMaterialName("spirit_dust")}不足。";
                return;
            }

            if (item.potionGain > 0)
            {
                _potionCount += item.potionGain * safeQuantity;
            }

            if (item.herbGain > 0)
            {
                drops.AwardHerbs(item.herbGain * safeQuantity);
            }

            if (item.oreGain > 0)
            {
                drops.AwardOres(item.oreGain * safeQuantity);
            }

            if (item.recruitTokenGain > 0)
            {
                _recruitTokenCount += item.recruitTokenGain * safeQuantity;
            }

            _townNotice = $"商店：购买{item.name} x{safeQuantity} 成功。";
            ShowTownModal("购买成功", $"获得：{item.name} x{safeQuantity}\n消耗：{totalCost} {GetShopItemCurrencyName(item)}");
            ClampShopBuyQuantity();
            RefreshDropUi();
            SaveProgress();
        }

        private void ShowTownModal(string title, string message)
        {
            _townModalTitle = title;
            _townModalMessage = message;
            _showTownModal = true;
        }

        private int GetEvolutionMaxStage()
        {
            return 2;
        }

        private string GetEvolutionStageName(int stage)
        {
            switch (Mathf.Clamp(stage, 0, GetEvolutionMaxStage()))
            {
                case 1:
                    return "灵焰初醒";
                case 2:
                    return "赤炎凝形";
                default:
                    return "凡火未醒";
            }
        }

        private int GetEvolutionRequiredLevel(int targetStage)
        {
            return targetStage <= 1 ? 5 : 10;
        }

        private int GetEvolutionRequiredCompletedMap(int targetStage)
        {
            return 3;
        }

        private int GetEvolutionRequiredSkillLevel(int targetStage)
        {
            return targetStage <= 1 ? 2 : 3;
        }

        private int GetEvolutionRequiredBodyPillLevel(int targetStage)
        {
            return targetStage <= 1 ? 1 : 3;
        }

        private int GetEvolutionDustCost(int targetStage)
        {
            return targetStage <= 1 ? 60 : 120;
        }

        private int GetEvolutionHerbCost(int targetStage)
        {
            return targetStage <= 1 ? 20 : 40;
        }

        private int GetEvolutionOreCost(int targetStage)
        {
            return targetStage <= 1 ? 12 : 25;
        }

        private int GetEvolutionStageHpBonus(int stage)
        {
            return stage <= 0 ? 0 : stage == 1 ? 20 : 30;
        }

        private int GetEvolutionStageAttackBonus(int stage)
        {
            return stage <= 0 ? 0 : stage == 1 ? 4 : 6;
        }

        private int GetEvolutionStageDefenseBonus(int stage)
        {
            return stage <= 0 ? 0 : stage == 1 ? 2 : 3;
        }

        private int GetEvolutionHpBonus()
        {
            int bonus = 0;
            for (int stage = 1; stage <= _evolutionStage; stage++)
            {
                bonus += GetEvolutionStageHpBonus(stage);
            }

            return bonus;
        }

        private int GetEvolutionAttackBonus()
        {
            int bonus = 0;
            for (int stage = 1; stage <= _evolutionStage; stage++)
            {
                bonus += GetEvolutionStageAttackBonus(stage);
            }

            return bonus;
        }

        private int GetEvolutionDefenseBonus()
        {
            int bonus = 0;
            for (int stage = 1; stage <= _evolutionStage; stage++)
            {
                bonus += GetEvolutionStageDefenseBonus(stage);
            }

            return bonus;
        }

        private Color GetEvolutionAuraColor()
        {
            if (_evolutionStage >= 2)
            {
                return new Color(0.46f, 0.18f, 0.12f, 1f);
            }

            if (_evolutionStage == 1)
            {
                return new Color(0.34f, 0.22f, 0.12f, 1f);
            }

            return new Color(0.08f, 0.12f, 0.12f, 1f);
        }

        private bool CanEvolveHero()
        {
            int targetStage = _evolutionStage + 1;
            DropSystem drops = DropSystem.Instance;
            if (targetStage > GetEvolutionMaxStage() || drops == null)
            {
                return false;
            }

            return _heroLevel >= GetEvolutionRequiredLevel(targetStage)
                && _completedMapIndex >= GetEvolutionRequiredCompletedMap(targetStage)
                && _skillOneLevel >= GetEvolutionRequiredSkillLevel(targetStage)
                && _bodyPillLevel >= GetEvolutionRequiredBodyPillLevel(targetStage)
                && drops.materialCount >= GetEvolutionDustCost(targetStage)
                && drops.herbCount >= GetEvolutionHerbCost(targetStage)
                && drops.oreCount >= GetEvolutionOreCost(targetStage);
        }

        private string GetEvolutionBlockLabel()
        {
            return "查看所需条件";
        }

        private string BuildEvolutionBlockMessage(int targetStage)
        {
            DropSystem drops = DropSystem.Instance;
            int dust = drops != null ? drops.materialCount : 0;
            int herbs = drops != null ? drops.herbCount : 0;
            int ores = drops != null ? drops.oreCount : 0;
            return $"进化到 {GetEvolutionStageName(targetStage)} 需要：\n主角 Lv.{GetEvolutionRequiredLevel(targetStage)}（当前 Lv.{_heroLevel}）\n通关图谱一第 {GetEvolutionRequiredCompletedMap(targetStage)} 图（当前 {_completedMapIndex}/3）\n技能 S1 Lv.{GetEvolutionRequiredSkillLevel(targetStage)}（当前 Lv.{_skillOneLevel}）\n淬体丹 Lv.{GetEvolutionRequiredBodyPillLevel(targetStage)}（当前 Lv.{_bodyPillLevel}）\n{GetMaterialName("spirit_dust")} {GetEvolutionDustCost(targetStage)}（持有 {dust}）\n{GetMaterialName("red_herb")} {GetEvolutionHerbCost(targetStage)}（持有 {herbs}）\n{GetMaterialName("iron_sand")} {GetEvolutionOreCost(targetStage)}（持有 {ores}）";
        }

        private void EvolveHero()
        {
            int targetStage = _evolutionStage + 1;
            DropSystem drops = DropSystem.Instance;
            if (targetStage > GetEvolutionMaxStage())
            {
                ShowTownModal("已满阶", "当前 MVP 进化阶段已达到上限。");
                return;
            }

            if (!CanEvolveHero() || drops == null)
            {
                ShowTownModal("无法进化", BuildEvolutionBlockMessage(targetStage));
                return;
            }

            drops.ConsumeMaterials(GetEvolutionDustCost(targetStage));
            drops.ConsumeHerbs(GetEvolutionHerbCost(targetStage));
            drops.ConsumeOres(GetEvolutionOreCost(targetStage));
            _evolutionStage = Mathf.Clamp(targetStage, 0, GetEvolutionMaxStage());
            ApplyHeroLevelStats();
            _townNotice = $"进化塔：主角进化至 {GetEvolutionStageName(_evolutionStage)}。";
            ShowTownModal("进化成功", $"主角进化至 {GetEvolutionStageName(_evolutionStage)}\n生命 +{GetEvolutionStageHpBonus(_evolutionStage)}  攻击 +{GetEvolutionStageAttackBonus(_evolutionStage)}  防御 +{GetEvolutionStageDefenseBonus(_evolutionStage)}");
            RefreshDropUi();
            SaveProgress();
        }

        private void ValidateSelectedCraftRecipe()
        {
            if (_craftRecipes.Length == 0)
            {
                _selectedCraftRecipeIndex = 0;
                return;
            }

            _selectedCraftRecipeIndex = Mathf.Clamp(_selectedCraftRecipeIndex, 0, _craftRecipes.Length - 1);
        }

        private CraftRecipe GetSelectedCraftRecipe()
        {
            ValidateSelectedCraftRecipe();
            return _craftRecipes[_selectedCraftRecipeIndex];
        }

        private EquipmentItem GetCraftRecipeItem(CraftRecipe recipe)
        {
            int index = Mathf.Clamp(recipe.equipmentIndex, 0, _equipmentInventory.Length - 1);
            return _equipmentInventory[index];
        }

        private bool CanCraftSelectedRecipe()
        {
            if (!_hasSelectedCraftRecipe)
            {
                return false;
            }

            CraftRecipe recipe = GetSelectedCraftRecipe();
            DropSystem drops = DropSystem.Instance;
            if (drops == null || IsEquipmentOwned(recipe.equipmentIndex))
            {
                return false;
            }

            return drops.materialCount >= recipe.dustCost && drops.oreCount >= recipe.oreCost;
        }

        private void CraftSelectedRecipe()
        {
            if (!_hasSelectedCraftRecipe)
            {
                ShowTownModal("请选择图纸", "选中图纸后才能打造装备。");
                return;
            }

            CraftRecipe recipe = GetSelectedCraftRecipe();
            EquipmentItem item = GetCraftRecipeItem(recipe);
            DropSystem drops = DropSystem.Instance;
            if (drops == null)
            {
                ShowTownModal("打造失败", "背包材料数据未初始化。");
                return;
            }

            if (IsEquipmentOwned(recipe.equipmentIndex))
            {
                ShowTownModal("已拥有", $"{item.name} 已在装备库中。");
                return;
            }

            if (drops.materialCount < recipe.dustCost || drops.oreCount < recipe.oreCost)
            {
                ShowTownModal("材料不足", $"打造 {item.name} 需要：\n{GetMaterialName("spirit_dust")} {recipe.dustCost}    {GetMaterialName("iron_sand")} {recipe.oreCost}");
                return;
            }

            EnsureEquipmentOwnership();
            EnsureEquipmentEnhanceLevels();
            drops.ConsumeMaterials(recipe.dustCost);
            drops.ConsumeOres(recipe.oreCost);
            _equipmentOwned[recipe.equipmentIndex] = true;
            _equipmentEnhanceLevels[recipe.equipmentIndex] = 0;
            _townNotice = $"铁匠铺：已打造 {item.name}。";
            ShowTownModal("打造成功", $"{item.name} 已加入装备阁。\n可在装备阁选择对应部位穿戴。");
            RefreshDropUi();
            SaveProgress();
        }

        private int GetBodyPillMaxLevel()
        {
            return 3;
        }

        private int GetBodyPillHpBonus()
        {
            return _bodyPillLevel * 10;
        }

        private int GetBodyPillNextHpBonus()
        {
            return 10;
        }

        private int GetBodyPillDustCost(int currentLevel)
        {
            return currentLevel >= GetBodyPillMaxLevel() ? 0 : (currentLevel + 1) * 4;
        }

        private int GetBodyPillHerbCost(int currentLevel)
        {
            return currentLevel >= GetBodyPillMaxLevel() ? 0 : (currentLevel + 1) * 2;
        }

        private bool CanRefineBodyPill()
        {
            DropSystem drops = DropSystem.Instance;
            if (drops == null || _bodyPillLevel >= GetBodyPillMaxLevel())
            {
                return false;
            }

            return drops.materialCount >= GetBodyPillDustCost(_bodyPillLevel)
                && drops.herbCount >= GetBodyPillHerbCost(_bodyPillLevel);
        }

        private void RefineBodyPill()
        {
            DropSystem drops = DropSystem.Instance;
            if (drops == null)
            {
                ShowTownModal("炼制失败", "背包材料数据未初始化。");
                return;
            }

            if (_bodyPillLevel >= GetBodyPillMaxLevel())
            {
                ShowTownModal("已满级", "淬体丹已达到当前 MVP 上限。");
                return;
            }

            int dustCost = GetBodyPillDustCost(_bodyPillLevel);
            int herbCost = GetBodyPillHerbCost(_bodyPillLevel);
            if (drops.materialCount < dustCost || drops.herbCount < herbCost)
            {
                ShowTownModal("材料不足", $"炼制淬体丹需要：\n{GetMaterialName("red_herb")} {herbCost}    {GetMaterialName("spirit_dust")} {dustCost}");
                return;
            }

            drops.ConsumeHerbs(herbCost);
            drops.ConsumeMaterials(dustCost);
            _bodyPillLevel = Mathf.Clamp(_bodyPillLevel + 1, 0, GetBodyPillMaxLevel());
            ApplyHeroLevelStats();
            _townNotice = $"炼药铺：淬体丹升至 Lv.{_bodyPillLevel}。";
            ShowTownModal("炼制成功", $"淬体丹升至 Lv.{_bodyPillLevel}\n永久生命 +{GetBodyPillHpBonus()}");
            RefreshDropUi();
            SaveProgress();
        }

        private InventorySlot GetSelectedInventorySlot()
        {
            int visibleIndex = 0;
            for (int i = 0; i < _inventorySlots.Length; i++)
            {
                InventorySlot slot = _inventorySlots[i];
                if (!IsInventorySlotVisible(slot))
                {
                    continue;
                }

                if (visibleIndex == _selectedInventorySlotIndex)
                {
                    return slot;
                }

                visibleIndex++;
            }

            return _inventorySlots[0];
        }

        private void ValidateSelectedInventorySlot()
        {
            int count = GetInventoryVisibleSlotCount();
            if (count <= 0)
            {
                _selectedInventorySlotIndex = 0;
                return;
            }

            _selectedInventorySlotIndex = Mathf.Clamp(_selectedInventorySlotIndex, 0, count - 1);
        }

        private int GetInventoryVisibleSlotCount()
        {
            int count = 0;
            for (int i = 0; i < _inventorySlots.Length; i++)
            {
                if (IsInventorySlotVisible(_inventorySlots[i]))
                {
                    count++;
                }
            }

            return count;
        }

        private bool IsInventorySlotVisible(InventorySlot slot)
        {
            string category = GetSelectedInventoryCategory();
            return category == "全部" || slot.category == category;
        }

        private string GetSelectedInventoryCategory()
        {
            int index = Mathf.Clamp(_selectedInventoryCategoryIndex, 0, _inventoryCategories.Length - 1);
            return _inventoryCategories[index];
        }

        private int GetInventorySlotCount(InventorySlot slot)
        {
            DropSystem drops = DropSystem.Instance;
            if (slot.materialId == "recruit_token")
            {
                return _recruitTokenCount;
            }

            if (slot.materialId == "potion_small")
            {
                return _potionCount;
            }

            if (drops == null)
            {
                return 0;
            }

            if (slot.materialId == "spirit_dust")
            {
                return drops.materialCount;
            }

            if (slot.materialId == "red_herb")
            {
                return drops.herbCount;
            }

            if (slot.materialId == "iron_sand")
            {
                return drops.oreCount;
            }

            return 0;
        }

        private string GetInventorySlotName(InventorySlot slot)
        {
            if (slot.materialId == "recruit_token")
            {
                return RecruitTokenName;
            }

            if (slot.materialId == "potion_small")
            {
                return "小回血药";
            }

            return GetMaterialName(slot.materialId);
        }

        private string GetInventorySlotDescription(InventorySlot slot)
        {
            if (slot.materialId == "recruit_token")
            {
                return "招贤阁招募消耗道具，可通过商店、任务奖励等方式获得。";
            }

            if (slot.materialId == "potion_small")
            {
                return "战斗中回复 30 生命。";
            }

            return GetMaterialEntry(slot.materialId).description;
        }

        private void SellInventorySlot(InventorySlot slot, int amount)
        {
            DropSystem drops = DropSystem.Instance;
            if (drops == null || amount <= 0)
            {
                return;
            }

            int count = GetInventorySlotCount(slot);
            int sellAmount = Mathf.Clamp(amount, 0, count);
            if (sellAmount <= 0 || slot.sellPrice <= 0 || !IsMaterialTradable(slot.materialId))
            {
                _townNotice = $"背包：{GetInventorySlotName(slot)}不可出售。";
                return;
            }

            bool consumed = false;
            if (slot.materialId == "red_herb")
            {
                consumed = drops.ConsumeHerbs(sellAmount);
            }
            else if (slot.materialId == "iron_sand")
            {
                consumed = drops.ConsumeOres(sellAmount);
            }

            if (!consumed)
            {
                return;
            }

            int dustGain = sellAmount * slot.sellPrice;
            drops.AwardMaterials(dustGain);
            _townNotice = $"背包：出售{GetInventorySlotName(slot)} x{sellAmount}，{GetMaterialName("spirit_dust")} +{dustGain}。";
            RefreshDropUi();
            SaveProgress();
        }

        private bool TryConsumePotion()
        {
            if (_potionCount <= 0)
            {
                return false;
            }

            _potionCount--;
            SaveProgress();
            return true;
        }

        private int GetSkillOneUpgradeCost()
        {
            return _skillOneLevel >= 3 ? 0 : _skillOneLevel * 6;
        }

        private int GetSkillOneMultiplier()
        {
            return Mathf.Clamp(_skillOneLevel + 1, 2, 4);
        }

        private bool CanUpgradeSkillOne()
        {
            int cost = GetSkillOneUpgradeCost();
            return _skillOneLevel < 3 && cost > 0 && GetMaterialCount() >= cost;
        }

        private void UpgradeSkillOne()
        {
            if (_skillOneLevel >= 3)
            {
                _townNotice = "修炼场：S1 已达到当前 MVP 上限。";
                return;
            }

            int cost = GetSkillOneUpgradeCost();
            if (DropSystem.Instance == null || !DropSystem.Instance.ConsumeMaterials(cost))
            {
                _townNotice = "修炼场：材料不足。";
                return;
            }

            _skillOneLevel++;
            if (battleManager != null && battleManager.skillController != null)
            {
                battleManager.skillController.SetSkillOneLevel(_skillOneLevel);
            }

            _townNotice = $"修炼场：S1 升至 Lv.{_skillOneLevel}，倍率 {GetSkillOneMultiplier()}x。";
            RefreshDropUi();
            SaveProgress();
        }

        private void EnterCodex()
        {
            _activeTownPanel = TownPanel.None;
            _currentState = GameState.Codex;
            HideResultPanels();
            SetBattleHudVisible(false);

            if (battleManager != null)
            {
                battleManager.StopBattle();
                battleManager.ResetBattle();
                SetBattleVisualsVisible(false);
            }

            RefreshDropUi();
            UpdateStageText();
            Debug.Log("Entered Spirit Codex.");
        }

        private void ChallengeMap(int mapIndex)
        {
            if (mapIndex > _unlockedMapIndex)
            {
                return;
            }

            _selectedMapIndex = Mathf.Clamp(mapIndex, 1, 3);
            _stageIndex = _selectedMapIndex;
            StartGame();
        }

        private int CalculateVictoryExp()
        {
            if (_currentState != GameState.Victory)
            {
                return 0;
            }

            DropSystem drops = DropSystem.Instance;
            int normalKills = drops != null ? drops.normalKills : 0;
            int bossKills = drops != null ? drops.bossKills : 0;
            int baseExp = GetMapClearBaseExp(normalKills, bossKills);

            if (_selectedMapIndex > _completedMapIndex)
            {
                baseExp += 40;
            }

            float levelModifier = GetLevelExpModifier(_heroLevel, GetRecommendedLevel(_selectedMapIndex));
            return Mathf.Max(0, Mathf.RoundToInt(baseExp * levelModifier));
        }

        private int CalculateSweepExp(int mapIndex)
        {
            int baseExp = GetMapClearBaseExp(3, 1);
            float levelModifier = GetLevelExpModifier(_heroLevel, GetRecommendedLevel(mapIndex));
            return Mathf.Max(0, Mathf.RoundToInt(baseExp * levelModifier));
        }

        private int GetMapClearBaseExp(int normalKills, int bossKills)
        {
            return normalKills * 10 + bossKills * 50;
        }

        private float GetLevelExpModifier(int heroLevel, int recommendedLevel)
        {
            int overLevel = heroLevel - recommendedLevel;
            if (overLevel <= 2)
            {
                return 1f;
            }

            if (overLevel == 3)
            {
                return 0.5f;
            }

            if (overLevel == 4)
            {
                return 0.25f;
            }

            return 0f;
        }

        private int GetRecommendedLevel(int mapIndex)
        {
            return Mathf.Clamp(mapIndex, 1, 3);
        }

        private int GetMapPreviewExp(int mapIndex)
        {
            int baseExp = 3 * 10 + 50;
            if (mapIndex > _completedMapIndex)
            {
                baseExp += 40;
            }

            float levelModifier = GetLevelExpModifier(_heroLevel, GetRecommendedLevel(mapIndex));
            return Mathf.Max(0, Mathf.RoundToInt(baseExp * levelModifier));
        }

        private string GetPageUnlockText()
        {
            if (_completedMapIndex >= 3)
            {
                return "图谱一已全部通关，图谱二已解锁占位。";
            }

            return $"还需通关 {3 - _completedMapIndex} 张地图解锁图谱二。";
        }

        private int GetExpRequiredForLevel(int level)
        {
            switch (Mathf.Max(1, level))
            {
                case 1:
                    return 100;
                case 2:
                    return 150;
                case 3:
                    return 220;
                case 4:
                    return 320;
                default:
                    return 320 + (level - 4) * 140;
            }
        }

        private bool WillLevelUp(int expGain)
        {
            int previewLevel = _heroLevel;
            int previewExp = _heroExp + Mathf.Max(0, expGain);

            while (previewExp >= GetExpRequiredForLevel(previewLevel))
            {
                previewExp -= GetExpRequiredForLevel(previewLevel);
                previewLevel++;
            }

            return previewLevel > _heroLevel;
        }

        private void AwardPendingVictoryExp()
        {
            int expGain = CalculateVictoryExp();
            if (expGain <= 0)
            {
                _pendingVictoryExp = 0;
                _codexNotice = $"地图 {_selectedMapIndex} 通关完成。等级差过高时不会获得经验。";
                return;
            }

            _pendingVictoryExp = expGain;
            int oldLevel = _heroLevel;
            _heroExp += expGain;

            while (_heroExp >= GetExpRequiredForLevel(_heroLevel))
            {
                _heroExp -= GetExpRequiredForLevel(_heroLevel);
                _heroLevel++;
            }

            bool leveledUp = _heroLevel > oldLevel;
            ApplyHeroLevelStats();

            _codexNotice = leveledUp
                ? $"地图 {_selectedMapIndex} 通关：经验 +{_pendingVictoryExp}，主角升至 {_heroLevel} 级。"
                : $"地图 {_selectedMapIndex} 通关：经验 +{_pendingVictoryExp}。";
        }

        private void ApplyHeroLevelStats()
        {
            if (battleManager != null && battleManager.hero != null)
            {
                battleManager.hero.ApplyLevelStats(_heroLevel);
                ApplyEquipmentStats();
            }
        }

        private void ApplyEquipmentStats()
        {
            if (battleManager == null || battleManager.hero == null)
            {
                return;
            }

            int hpBonus = GetEquippedHpBonus() + GetBodyPillHpBonus() + GetEvolutionHpBonus();
            int attackBonus = GetEquippedAttackBonus() + GetEvolutionAttackBonus();
            int defenseBonus = GetEquippedDefenseBonus() + GetEvolutionDefenseBonus();
            battleManager.hero.maxHp += hpBonus;
            battleManager.hero.hp = battleManager.hero.maxHp;
            battleManager.hero.attack += attackBonus;
            battleManager.hero.defense += defenseBonus;
        }

        private EquipmentItem GetSelectedEquipment()
        {
            int index = Mathf.Clamp(_selectedEquipmentIndex, 0, _equipmentInventory.Length - 1);
            return _equipmentInventory[index];
        }

        private void EnsureEquipmentOwnership()
        {
            if (_equipmentOwned != null && _equipmentOwned.Length == _equipmentInventory.Length)
            {
                return;
            }

            _equipmentOwned = new bool[_equipmentInventory.Length];
            for (int i = 0; i < _equipmentOwned.Length; i++)
            {
                _equipmentOwned[i] = IsDefaultOwnedEquipment(i);
            }
        }

        private bool IsDefaultOwnedEquipment(int index)
        {
            return index >= 0 && index < 6;
        }

        private void EnsureEquipmentEnhanceLevels()
        {
            if (_equipmentEnhanceLevels != null && _equipmentEnhanceLevels.Length == _equipmentInventory.Length)
            {
                return;
            }

            int[] oldLevels = _equipmentEnhanceLevels;
            _equipmentEnhanceLevels = new int[_equipmentInventory.Length];
            if (oldLevels == null)
            {
                return;
            }

            int count = Mathf.Min(oldLevels.Length, _equipmentEnhanceLevels.Length);
            for (int i = 0; i < count; i++)
            {
                _equipmentEnhanceLevels[i] = Mathf.Clamp(oldLevels[i], 0, 3);
            }
        }

        private bool IsEquipmentOwned(int index)
        {
            EnsureEquipmentOwnership();
            return index >= 0 && index < _equipmentOwned.Length && _equipmentOwned[index];
        }

        private int GetEquipmentIndex(EquipmentItem item)
        {
            if (string.IsNullOrEmpty(item.name))
            {
                return -1;
            }

            for (int i = 0; i < _equipmentInventory.Length; i++)
            {
                EquipmentItem candidate = _equipmentInventory[i];
                if (candidate.name == item.name && candidate.slot == item.slot)
                {
                    return i;
                }
            }

            return -1;
        }

        private int GetEquipmentEnhanceLevel(EquipmentItem item)
        {
            EnsureEquipmentEnhanceLevels();
            int index = GetEquipmentIndex(item);
            if (index < 0 || index >= _equipmentEnhanceLevels.Length)
            {
                return 0;
            }

            return Mathf.Clamp(_equipmentEnhanceLevels[index], 0, 3);
        }

        private int GetEnhanceDustCost(int currentLevel)
        {
            return currentLevel >= 3 ? 0 : (currentLevel + 1) * 5;
        }

        private int GetEnhanceOreCost(int currentLevel)
        {
            return currentLevel >= 3 ? 0 : (currentLevel + 1) * 2;
        }

        private bool CanEnhanceEquipment(EquipmentItem item)
        {
            return CanEnhanceEquipment(item, 1);
        }

        private bool CanEnhanceEquipment(EquipmentItem item, int requestedCount)
        {
            DropSystem drops = DropSystem.Instance;
            int level = GetEquipmentEnhanceLevel(item);
            if (string.IsNullOrEmpty(item.name) || !IsEquipped(item) || level >= 3 || drops == null)
            {
                return false;
            }

            int dustCost = GetEnhanceDustCost(level);
            int oreCost = GetEnhanceOreCost(level);
            return drops.materialCount >= dustCost && drops.oreCount >= oreCost;
        }

        private void EnhanceEquipment(EquipmentItem item)
        {
            EnhanceEquipment(item, 1);
        }

        private void EnhanceEquipment(EquipmentItem item, int requestedCount)
        {
            EnsureEquipmentEnhanceLevels();
            int index = GetEquipmentIndex(item);
            int level = GetEquipmentEnhanceLevel(item);
            if (index < 0 || level >= 3)
            {
                _townNotice = "铁匠铺：该装备已无法继续强化。";
                return;
            }

            DropSystem drops = DropSystem.Instance;
            int stepsToTry = Mathf.Min(Mathf.Max(1, requestedCount), 3 - level);
            int enhancedCount = 0;
            int totalDustCost = 0;
            int totalOreCost = 0;
            for (int i = 0; i < stepsToTry; i++)
            {
                int currentLevel = level + enhancedCount;
                int dustCost = GetEnhanceDustCost(currentLevel);
                int oreCost = GetEnhanceOreCost(currentLevel);
                if (drops == null || drops.materialCount < dustCost || drops.oreCount < oreCost)
                {
                    break;
                }

                drops.ConsumeMaterials(dustCost);
                drops.ConsumeOres(oreCost);
                totalDustCost += dustCost;
                totalOreCost += oreCost;
                enhancedCount++;
            }

            if (enhancedCount <= 0)
            {
                int dustCost = GetEnhanceDustCost(level);
                int oreCost = GetEnhanceOreCost(level);
                _townNotice = $"铁匠铺：材料不足，需要灵尘 {dustCost}、铁砂 {oreCost}。";
                return;
            }

            _equipmentEnhanceLevels[index] = Mathf.Clamp(level + enhancedCount, 0, 3);
            ApplyHeroLevelStats();
            _townNotice = $"铁匠铺：{item.name} 强化 {enhancedCount} 次，当前 +{_equipmentEnhanceLevels[index]}，消耗灵尘 {totalDustCost}、铁砂 {totalOreCost}。";
            RefreshDropUi();
            SaveProgress();
        }

        private void GetEnhanceBatchCost(int startLevel, int count, out int dustCost, out int oreCost)
        {
            dustCost = 0;
            oreCost = 0;
            int safeCount = Mathf.Min(Mathf.Max(0, count), 3 - startLevel);
            for (int i = 0; i < safeCount; i++)
            {
                int level = startLevel + i;
                dustCost += GetEnhanceDustCost(level);
                oreCost += GetEnhanceOreCost(level);
            }
        }

        private bool IsOffensiveEnhanceSlot(EquipmentSlot slot)
        {
            return slot == EquipmentSlot.Weapon || slot == EquipmentSlot.Gloves || slot == EquipmentSlot.Accessory;
        }

        private int GetEnhancedAttackBonus(EquipmentItem item)
        {
            int bonus = item.attackBonus;
            if (IsOffensiveEnhanceSlot(item.slot))
            {
                bonus += GetEquipmentEnhanceLevel(item) * 2;
            }

            return bonus;
        }

        private int GetEnhancedHpBonus(EquipmentItem item)
        {
            int bonus = item.hpBonus;
            if (!IsOffensiveEnhanceSlot(item.slot) && !string.IsNullOrEmpty(item.name))
            {
                bonus += GetEquipmentEnhanceLevel(item) * 5;
            }

            return bonus;
        }

        private int GetEnhancedDefenseBonus(EquipmentItem item)
        {
            int bonus = item.defenseBonus;
            if (!IsOffensiveEnhanceSlot(item.slot) && !string.IsNullOrEmpty(item.name))
            {
                bonus += GetEquipmentEnhanceLevel(item);
            }

            return bonus;
        }

        private bool TryGetSelectedEquipmentForCurrentSlot(out EquipmentItem item)
        {
            if (_selectedEquipmentIndex >= 0 && _selectedEquipmentIndex < _equipmentInventory.Length && IsEquipmentOwned(_selectedEquipmentIndex))
            {
                item = _equipmentInventory[_selectedEquipmentIndex];
                return item.slot == _selectedEquipmentSlot;
            }

            item = default(EquipmentItem);
            return false;
        }

        private void ClearSelectedEquipmentForSlot(EquipmentSlot slot)
        {
            _selectedEquipmentIndex = -1;
        }

        private string BuildEquipmentLine(EquipmentItem item)
        {
            string classText = item.requiredClass == "All" ? "全职业" : GetClassName(item.requiredClass);
            int enhanceLevel = GetEquipmentEnhanceLevel(item);
            string enhanceText = enhanceLevel > 0 ? $" +{enhanceLevel}" : "";
            return $"{item.name}{enhanceText}  {item.quality}  Lv.{item.levelRequirement}  {classText}  攻击 +{GetEnhancedAttackBonus(item)}  生命 +{GetEnhancedHpBonus(item)}  防御 +{GetEnhancedDefenseBonus(item)}";
        }

        private string BuildEquipmentStatShortText(EquipmentItem item)
        {
            string text = "";
            int attackBonus = GetEnhancedAttackBonus(item);
            int hpBonus = GetEnhancedHpBonus(item);
            int defenseBonus = GetEnhancedDefenseBonus(item);
            int enhanceLevel = GetEquipmentEnhanceLevel(item);
            if (enhanceLevel > 0)
            {
                text += $"+{enhanceLevel} ";
            }

            if (attackBonus != 0)
            {
                text += $"攻+{attackBonus}";
            }

            if (hpBonus != 0)
            {
                text += string.IsNullOrEmpty(text) ? $"血+{hpBonus}" : $" 血+{hpBonus}";
            }

            if (defenseBonus != 0)
            {
                text += string.IsNullOrEmpty(text) ? $"防+{defenseBonus}" : $" 防+{defenseBonus}";
            }

            return string.IsNullOrEmpty(text.Trim()) ? "无属性" : text;
        }

        private bool CanAutoEquipBestSet()
        {
            EquipmentSlot[] slots = GetAutoEquipSlots();
            for (int i = 0; i < slots.Length; i++)
            {
                EquipmentSlot slot = slots[i];
                if (TryGetBestAutoEquipItem(slot, out EquipmentItem bestItem) && IsBetterAutoEquipItem(bestItem, GetEquippedItem(slot)))
                {
                    return true;
                }
            }

            return false;
        }

        private void AutoEquipBestSet()
        {
            EquipmentSlot[] slots = GetAutoEquipSlots();
            int changedCount = 0;
            for (int i = 0; i < slots.Length; i++)
            {
                EquipmentSlot slot = slots[i];
                if (!TryGetBestAutoEquipItem(slot, out EquipmentItem bestItem))
                {
                    continue;
                }

                if (!IsBetterAutoEquipItem(bestItem, GetEquippedItem(slot)))
                {
                    continue;
                }

                SetEquippedItem(slot, bestItem);
                changedCount++;
            }

            if (changedCount <= 0)
            {
                _townNotice = "装备阁：当前已是推荐穿戴。";
                return;
            }

            _showEquipmentBag = false;
            _showDismantleConfirm = false;
            _selectedEquipmentIndex = -1;
            ApplyHeroLevelStats();
            _townNotice = $"装备阁：一键穿戴已更新 {changedCount} 个部位。";
            SaveProgress();
        }

        private EquipmentSlot[] GetAutoEquipSlots()
        {
            return new EquipmentSlot[]
            {
                EquipmentSlot.Weapon,
                EquipmentSlot.Helmet,
                EquipmentSlot.Armor,
                EquipmentSlot.Gloves,
                EquipmentSlot.Boots,
                EquipmentSlot.Accessory
            };
        }

        private bool TryGetBestAutoEquipItem(EquipmentSlot slot, out EquipmentItem bestItem)
        {
            bestItem = default(EquipmentItem);
            int bestScore = int.MinValue;
            EnsureEquipmentOwnership();
            for (int i = 0; i < _equipmentInventory.Length; i++)
            {
                EquipmentItem item = _equipmentInventory[i];
                if (item.slot != slot || !IsEquipmentOwned(i) || !CanEquip(item))
                {
                    continue;
                }

                int score = GetAutoEquipScore(item);
                if (string.IsNullOrEmpty(bestItem.name) || score > bestScore)
                {
                    bestItem = item;
                    bestScore = score;
                }
            }

            return !string.IsNullOrEmpty(bestItem.name);
        }

        private bool IsBetterAutoEquipItem(EquipmentItem candidate, EquipmentItem current)
        {
            if (string.IsNullOrEmpty(candidate.name))
            {
                return false;
            }

            if (string.IsNullOrEmpty(current.name))
            {
                return true;
            }

            if (candidate.name == current.name && candidate.slot == current.slot)
            {
                return false;
            }

            return GetAutoEquipScore(candidate) > GetAutoEquipScore(current);
        }

        private int GetAutoEquipScore(EquipmentItem item)
        {
            if (string.IsNullOrEmpty(item.name))
            {
                return int.MinValue;
            }

            int score = 0;
            score += GetEnhancedAttackBonus(item) * 100;
            score += GetEnhancedDefenseBonus(item) * 45;
            score += GetEnhancedHpBonus(item) * 5;
            score += item.quality == "稀有" ? 20 : 0;
            score += item.levelRequirement * 2;
            score += GetFutureSetBonusScore(item);
            return score;
        }

        private int GetFutureSetBonusScore(EquipmentItem item)
        {
            return 0;
        }

        private bool CanEquip(EquipmentItem item)
        {
            if (_heroLevel < item.levelRequirement)
            {
                return false;
            }

            return item.requiredClass == "All" || item.requiredClass == "Ranger";
        }

        private string GetEquipBlockReason(EquipmentItem item)
        {
            if (_heroLevel < item.levelRequirement)
            {
                return $"等级不足：需要 Lv.{item.levelRequirement}";
            }

            if (item.requiredClass != "All" && item.requiredClass != "Ranger")
            {
                return $"职业不符：需要 {item.requiredClass}";
            }

            return "不能装备";
        }

        private string GetEquipBlockShortReason(EquipmentItem item)
        {
            if (_heroLevel < item.levelRequirement)
            {
                return $"等级不足 Lv.{item.levelRequirement}";
            }

            if (item.requiredClass != "All" && item.requiredClass != "Ranger")
            {
                return "职业不符";
            }

            return "不能穿戴";
        }

        private bool IsEquipped(EquipmentItem item)
        {
            EquipmentItem equipped = GetEquippedItem(item.slot);
            return equipped.name == item.name;
        }

        private EquipmentItem GetEquippedItem(EquipmentSlot slot)
        {
            switch (slot)
            {
                case EquipmentSlot.Weapon:
                    return _equippedWeapon;
                case EquipmentSlot.Helmet:
                    return _equippedHelmet;
                case EquipmentSlot.Armor:
                    return _equippedArmor;
                case EquipmentSlot.Gloves:
                    return _equippedGloves;
                case EquipmentSlot.Boots:
                    return _equippedBoots;
                case EquipmentSlot.Accessory:
                    return _equippedAccessory;
                default:
                    return default(EquipmentItem);
            }
        }

        private void EquipItem(EquipmentItem item)
        {
            if (!CanEquip(item))
            {
                _townNotice = $"装备阁：{GetEquipBlockReason(item)}。";
                return;
            }

            _selectedEquipmentSlot = item.slot;
            SetEquippedItem(item.slot, item);
            _townNotice = $"装备阁：已穿戴 {item.name}。";
            ApplyHeroLevelStats();
            SaveProgress();
        }

        private void UnequipSlot(EquipmentSlot slot)
        {
            EquipmentItem equipped = GetEquippedItem(slot);
            if (string.IsNullOrEmpty(equipped.name))
            {
                _townNotice = $"装备阁：{GetSlotName(slot)}当前为空。";
                return;
            }

            SetEquippedItem(slot, default(EquipmentItem));
            _townNotice = $"装备阁：已卸下 {equipped.name}。";
            ApplyHeroLevelStats();
            SaveProgress();
        }

        private void RequestDismantleSelectedEquipment()
        {
            if (!TryGetSelectedEquipmentForCurrentSlot(out EquipmentItem item))
            {
                _townNotice = "装备阁：请选择要拆解的装备。";
                return;
            }

            if (IsEquipped(item))
            {
                _townNotice = "装备阁：已穿戴装备不能拆解，先卸下。";
                return;
            }

            _showDismantleConfirm = true;
        }

        private void DismantleSelectedEquipment()
        {
            if (!TryGetSelectedEquipmentForCurrentSlot(out EquipmentItem item))
            {
                _showDismantleConfirm = false;
                return;
            }

            if (IsEquipped(item))
            {
                _showDismantleConfirm = false;
                _townNotice = "装备阁：已穿戴装备不能拆解，先卸下。";
                return;
            }

            int index = _selectedEquipmentIndex;
            int dustReward = GetDismantleDustReward(item);
            int oreReward = GetDismantleOreReward(item);
            EnsureEquipmentOwnership();
            EnsureEquipmentEnhanceLevels();
            _equipmentOwned[index] = false;
            _equipmentEnhanceLevels[index] = 0;

            if (DropSystem.Instance != null)
            {
                DropSystem.Instance.AwardMaterials(dustReward);
                DropSystem.Instance.AwardOres(oreReward);
            }

            _showDismantleConfirm = false;
            _townNotice = $"装备阁：已拆解 {item.name}，获得灵尘 +{dustReward}，铁砂 +{oreReward}。";
            ClearSelectedEquipmentForSlot(_selectedEquipmentSlot);
            RefreshDropUi();
            SaveProgress();
        }

        private int GetDismantleDustReward(EquipmentItem item)
        {
            return item.quality == "稀有" ? 3 : 1;
        }

        private int GetDismantleOreReward(EquipmentItem item)
        {
            return item.quality == "稀有" ? 2 : 1;
        }

        private void ToggleEquip(EquipmentItem item)
        {
            bool changed = false;
            if (IsEquipped(item))
            {
                SetEquippedItem(item.slot, default(EquipmentItem));
                _townNotice = $"装备阁：已卸下 {item.name}。";
                changed = true;
            }
            else if (CanEquip(item))
            {
                SetEquippedItem(item.slot, item);
                _townNotice = $"装备阁：已穿戴 {item.name}。";
                changed = true;
            }

            ApplyHeroLevelStats();
            if (changed)
            {
                SaveProgress();
            }
        }

        private void SetEquippedItem(EquipmentSlot slot, EquipmentItem item)
        {
            switch (slot)
            {
                case EquipmentSlot.Weapon:
                    _equippedWeapon = item;
                    break;
                case EquipmentSlot.Helmet:
                    _equippedHelmet = item;
                    break;
                case EquipmentSlot.Armor:
                    _equippedArmor = item;
                    break;
                case EquipmentSlot.Gloves:
                    _equippedGloves = item;
                    break;
                case EquipmentSlot.Boots:
                    _equippedBoots = item;
                    break;
                case EquipmentSlot.Accessory:
                    _equippedAccessory = item;
                    break;
            }
        }

        private void RestoreEquippedItem(EquipmentSlot slot, string itemName)
        {
            if (string.IsNullOrEmpty(itemName))
            {
                SetEquippedItem(slot, default(EquipmentItem));
                return;
            }

            for (int i = 0; i < _equipmentInventory.Length; i++)
            {
                EquipmentItem item = _equipmentInventory[i];
                if (item.slot == slot && item.name == itemName && CanEquip(item))
                {
                    SetEquippedItem(slot, item);
                    return;
                }
            }

            SetEquippedItem(slot, default(EquipmentItem));
        }

        private int GetEquippedHpBonus()
        {
            return GetEnhancedHpBonus(_equippedWeapon)
                + GetEnhancedHpBonus(_equippedHelmet)
                + GetEnhancedHpBonus(_equippedArmor)
                + GetEnhancedHpBonus(_equippedGloves)
                + GetEnhancedHpBonus(_equippedBoots)
                + GetEnhancedHpBonus(_equippedAccessory);
        }

        private int GetEquippedAttackBonus()
        {
            return GetEnhancedAttackBonus(_equippedWeapon)
                + GetEnhancedAttackBonus(_equippedHelmet)
                + GetEnhancedAttackBonus(_equippedArmor)
                + GetEnhancedAttackBonus(_equippedGloves)
                + GetEnhancedAttackBonus(_equippedBoots)
                + GetEnhancedAttackBonus(_equippedAccessory);
        }

        private int GetEquippedDefenseBonus()
        {
            return GetEnhancedDefenseBonus(_equippedWeapon)
                + GetEnhancedDefenseBonus(_equippedHelmet)
                + GetEnhancedDefenseBonus(_equippedArmor)
                + GetEnhancedDefenseBonus(_equippedGloves)
                + GetEnhancedDefenseBonus(_equippedBoots)
                + GetEnhancedDefenseBonus(_equippedAccessory);
        }

        private string GetSlotName(EquipmentSlot slot)
        {
            switch (slot)
            {
                case EquipmentSlot.Weapon:
                    return "武器";
                case EquipmentSlot.Helmet:
                    return "头部";
                case EquipmentSlot.Armor:
                    return "护甲";
                case EquipmentSlot.Gloves:
                    return "手部";
                case EquipmentSlot.Boots:
                    return "鞋子";
                case EquipmentSlot.Accessory:
                    return "饰品";
                default:
                    return "装备";
            }
        }

        private string GetClassName(string className)
        {
            switch (className)
            {
                case "Ranger":
                    return "游侠";
                case "Guardian":
                    return "守卫";
                case "All":
                    return "全职业";
                default:
                    return className;
            }
        }

        private void SweepMap(int mapIndex)
        {
            if (mapIndex > _completedMapIndex || _sweepAttempts <= 0)
            {
                return;
            }

            int reward = GetSweepReward(mapIndex);
            _sweepAttempts--;
            _hasSweptOnce = true;
            if (DropSystem.Instance != null)
            {
                DropSystem.Instance.AwardMaterials(reward);
                DropSystem.Instance.AwardHerbs(GetMapHerbReward(mapIndex));
                DropSystem.Instance.AwardOres(GetMapOreReward(mapIndex));
            }

            int expGain = AwardSweepExp(mapIndex);
            string expText = expGain > 0 ? $"，经验 +{expGain}" : "，等级差过高无经验";
            _codexNotice = $"地图 {mapIndex} 扫荡：{GetMaterialName("spirit_dust")} +{reward}，{GetMapMaterialPreviewText(mapIndex)}{expText}。";
            RefreshDropUi();
            SaveProgress();
        }

        private int AwardSweepExp(int mapIndex)
        {
            int expGain = CalculateSweepExp(mapIndex);
            if (expGain <= 0)
            {
                return 0;
            }

            _heroExp += expGain;
            while (_heroExp >= GetExpRequiredForLevel(_heroLevel))
            {
                _heroExp -= GetExpRequiredForLevel(_heroLevel);
                _heroLevel++;
            }

            ApplyHeroLevelStats();
            return expGain;
        }

        private void BuySweepAttempt()
        {
            RefreshDailySweepPurchases();

            DropSystem drops = DropSystem.Instance;
            int cost = GetSweepPurchaseCost();
            if (drops == null || !drops.ConsumeMaterials(cost))
            {
                _codexNotice = $"{GetMaterialName("spirit_dust")}不足，无法购买扫荡次数。";
                return;
            }

            _sweepPurchaseCount++;
            _sweepAttempts++;
            _codexNotice = $"购买扫荡次数成功：次数 +1，下次价格 {GetSweepPurchaseCost()} {GetMaterialName("spirit_dust")}。";
            RefreshDropUi();
            SaveProgress();
        }

        private int GetSweepReward(int mapIndex)
        {
            return GetMapDropEntry(mapIndex).sweepSpiritDust;
        }

        private int GetSweepPurchaseCost()
        {
            return 5 * (_sweepPurchaseCount + 1);
        }

        private bool CanBuySweepAttempt()
        {
            DropSystem drops = DropSystem.Instance;
            return drops != null && drops.materialCount >= GetSweepPurchaseCost();
        }

        private void RefreshDailySweepPurchases()
        {
            string today = GetTodayKey();
            if (_sweepPurchaseDate == today)
            {
                return;
            }

            _sweepPurchaseDate = today;
            _sweepPurchaseCount = 0;
            _sweepAttempts = Mathf.Max(_sweepAttempts, 3);
        }

        private string GetTodayKey()
        {
            return System.DateTime.Now.ToString("yyyyMMdd");
        }

        private string GetSweepButtonLabel(int mapIndex, bool completed, bool canSweep)
        {
            if (!completed)
            {
                return "未通关";
            }

            if (!canSweep)
            {
                return "次数不足";
            }

            return $"扫荡 +{GetSweepReward(mapIndex)}";
        }

        private void AwardMapMaterialsToRun(DropSystem drops, int mapIndex)
        {
            if (drops == null)
            {
                return;
            }

            int herbs = GetMapHerbReward(mapIndex);
            int ores = GetMapOreReward(mapIndex);
            drops.runHerbs += herbs;
            drops.runOres += ores;
        }

        private string GetMapMaterialPreviewText(int mapIndex)
        {
            int herbs = GetMapHerbReward(mapIndex);
            int ores = GetMapOreReward(mapIndex);
            if (herbs > 0 && ores > 0)
            {
                return $"地图材料：{GetMaterialName("red_herb")} +{herbs}  {GetMaterialName("iron_sand")} +{ores}";
            }

            if (herbs > 0)
            {
                return $"地图材料：{GetMaterialName("red_herb")} +{herbs}";
            }

            if (ores > 0)
            {
                return $"地图材料：{GetMaterialName("iron_sand")} +{ores}";
            }

            return "地图材料：无";
        }

        private int GetMapHerbReward(int mapIndex)
        {
            return GetMapDropEntry(mapIndex).victoryHerbs;
        }

        private int GetMapOreReward(int mapIndex)
        {
            return GetMapDropEntry(mapIndex).victoryOres;
        }

        private MapDropEntry GetMapDropEntry(int mapIndex)
        {
            if (_mapDropConfig == null)
            {
                _mapDropConfig = MapDropConfigLoader.Load();
            }

            return _mapDropConfig.GetMap(1, Mathf.Clamp(mapIndex, 1, 3));
        }

        private string BuildShopInfo()
        {
            string dust = GetMaterialName("spirit_dust");
            return $"点击商品格购买。\n当前{dust}：{GetMaterialCount()}\n出售材料请打开背包。";
        }

        private string GetMaterialName(string id)
        {
            return GetMaterialEntry(id).name;
        }

        private bool IsMaterialTradable(string id)
        {
            return GetMaterialEntry(id).tradable;
        }

        private MaterialEntry GetMaterialEntry(string id)
        {
            if (_materialConfig == null)
            {
                _materialConfig = MaterialConfigLoader.Load();
            }

            return _materialConfig.GetMaterial(id);
        }

        private void SetBattleVisualsVisible(bool visible)
        {
            if (battleManager != null)
            {
                battleManager.SetBattleVisualsVisible(visible);
            }
        }

        private void SetBattleHudVisible(bool visible)
        {
            GameObject skillBar = GameObject.Find("SkillBar");
            if (skillBar == null)
            {
                GameObject[] gameObjects = Resources.FindObjectsOfTypeAll<GameObject>();
                foreach (GameObject gameObject in gameObjects)
                {
                    if (gameObject != null && gameObject.name == "SkillBar")
                    {
                        skillBar = gameObject;
                        break;
                    }
                }
            }

            if (skillBar != null)
            {
                skillBar.SetActive(false);
            }
        }

        private void RefreshDropUi()
        {
            if (DropSystem.Instance != null)
            {
                DropSystem.Instance.RefreshUI();
            }
        }

        private void UpdateStageText()
        {
            if (stageText != null)
            {
                stageText.gameObject.SetActive(false);
            }
        }
    }
}
