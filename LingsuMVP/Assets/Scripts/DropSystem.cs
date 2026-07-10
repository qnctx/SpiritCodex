using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace LingsuMVP
{
    public class DropSystem : MonoBehaviour
    {
        [Header("Drop Settings")]
        public int materialCount = 0;
        public int herbCount = 0;
        public int oreCount = 0;
        public int monsterDropAmount = 1;
        public int bossDropAmount = 5;
        public int runMaterials = 0;
        public int runHerbs = 0;
        public int runOres = 0;
        public int normalKills = 0;
        public int bossKills = 0;

        [Header("UI Reference")]
        public TextMeshProUGUI materialCountText;
        public Image dropEffectImage;

        private static DropSystem _instance;
        private Sprite _materialIconSprite;
        private int _stageStartMaterialCount = 0;
        private int _stageStartHerbCount = 0;
        private int _stageStartOreCount = 0;

        public static DropSystem Instance
        {
            get
            {
                if (_instance == null)
                {
                    _instance = FindObjectOfType<DropSystem>();
                }
                return _instance;
            }
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
            UpdateUI();
        }

        public void Configure(DropConfig config)
        {
            if (config == null)
            {
                return;
            }

            monsterDropAmount = config.monsterDropAmount;
            bossDropAmount = config.bossDropAmount;
            UpdateUI();
        }

        public void OnMonsterDead(bool isBoss)
        {
            HandleMonsterDead(isBoss, Vector3.zero, false);
        }

        public void OnMonsterDead(bool isBoss, Vector3 worldPosition)
        {
            HandleMonsterDead(isBoss, worldPosition, true);
        }

        private void HandleMonsterDead(bool isBoss, Vector3 worldPosition, bool hasWorldPosition)
        {
            int dropAmount = isBoss ? bossDropAmount : monsterDropAmount;
            runMaterials += dropAmount;
            if (isBoss)
            {
                bossKills++;
            }
            else
            {
                normalKills++;
            }

            Debug.Log($"Monster{(isBoss ? " (BOSS)" : "")} dropped {dropAmount} materials. Run: {runMaterials}, Backpack: {materialCount}");

            UpdateUI();
            if (hasWorldPosition)
            {
                PlayMaterialFlyEffect(worldPosition, isBoss);
            }
            else
            {
                PlayDropEffect();
            }
        }

        private void UpdateUI()
        {
            if (materialCountText != null)
            {
                materialCountText.gameObject.SetActive(false);
            }
        }

        public void RefreshUI()
        {
            UpdateUI();
        }

        private void PlayDropEffect()
        {
            if (dropEffectImage != null)
            {
                // Simple flash effect
                StartCoroutine(FlashEffect());
            }
        }

        private void PlayMaterialFlyEffect(Vector3 worldPosition, bool isBoss)
        {
            if (materialCountText == null)
            {
                PlayDropEffect();
                return;
            }

            Canvas canvas = materialCountText.GetComponentInParent<Canvas>();
            if (canvas == null)
            {
                PlayDropEffect();
                return;
            }

            RectTransform canvasRect = canvas.GetComponent<RectTransform>();
            RectTransform targetRect = materialCountText.rectTransform;
            Camera worldCamera = Camera.main;
            Camera uiCamera = canvas.renderMode == RenderMode.ScreenSpaceOverlay ? null : canvas.worldCamera;

            if (canvasRect == null || targetRect == null || worldCamera == null)
            {
                PlayDropEffect();
                return;
            }

            Vector2 startPosition;
            Vector2 targetPosition;
            Vector2 startScreenPosition = worldCamera.WorldToScreenPoint(worldPosition);
            Vector2 targetScreenPosition = RectTransformUtility.WorldToScreenPoint(uiCamera, targetRect.position);

            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRect, startScreenPosition, uiCamera, out startPosition) ||
                !RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRect, targetScreenPosition, uiCamera, out targetPosition))
            {
                PlayDropEffect();
                return;
            }

            GameObject iconObject = new GameObject(isBoss ? "BossMaterialFlyIcon" : "MaterialFlyIcon");
            iconObject.transform.SetParent(canvas.transform, false);

            RectTransform iconRect = iconObject.AddComponent<RectTransform>();
            iconRect.anchorMin = new Vector2(0.5f, 0.5f);
            iconRect.anchorMax = new Vector2(0.5f, 0.5f);
            iconRect.pivot = new Vector2(0.5f, 0.5f);
            iconRect.anchoredPosition = startPosition;
            iconRect.sizeDelta = isBoss ? new Vector2(44f, 44f) : new Vector2(32f, 32f);

            Image iconImage = iconObject.AddComponent<Image>();
            iconImage.sprite = GetMaterialIconSprite();
            iconImage.color = isBoss ? new Color(1f, 0.58f, 0.12f, 1f) : new Color(1f, 0.78f, 0.18f, 1f);
            iconImage.raycastTarget = false;

            CanvasGroup group = iconObject.AddComponent<CanvasGroup>();
            StartCoroutine(FlyMaterialIcon(iconObject, iconRect, group, startPosition, targetPosition));
        }

        private Sprite GetMaterialIconSprite()
        {
            if (_materialIconSprite != null)
            {
                return _materialIconSprite;
            }

            const int size = 32;
            Texture2D texture = new Texture2D(size, size, TextureFormat.RGBA32, false);
            texture.filterMode = FilterMode.Bilinear;
            Color clear = new Color(1f, 1f, 1f, 0f);
            Color fill = Color.white;

            Vector2 center = new Vector2((size - 1) * 0.5f, (size - 1) * 0.5f);
            float radius = size * 0.42f;
            float innerRadius = size * 0.26f;

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float diamondDistance = Mathf.Abs(x - center.x) + Mathf.Abs(y - center.y);
                    if (diamondDistance > radius)
                    {
                        texture.SetPixel(x, y, clear);
                    }
                    else if (diamondDistance > innerRadius)
                    {
                        texture.SetPixel(x, y, new Color(fill.r, fill.g, fill.b, 0.82f));
                    }
                    else
                    {
                        texture.SetPixel(x, y, fill);
                    }
                }
            }

            texture.Apply();
            _materialIconSprite = Sprite.Create(texture, new Rect(0f, 0f, size, size), new Vector2(0.5f, 0.5f), size);
            return _materialIconSprite;
        }

        private System.Collections.IEnumerator FlyMaterialIcon(GameObject iconObject, RectTransform iconRect, CanvasGroup group, Vector2 startPosition, Vector2 targetPosition)
        {
            float elapsed = 0f;
            const float duration = 0.55f;
            const float arcHeight = 80f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = Mathf.Clamp01(elapsed / duration);
                float eased = 1f - Mathf.Pow(1f - t, 3f);
                Vector2 position = Vector2.Lerp(startPosition, targetPosition, eased);
                position.y += Mathf.Sin(t * Mathf.PI) * arcHeight;
                iconRect.anchoredPosition = position;

                float scale = 1f + Mathf.Sin(t * Mathf.PI) * 0.28f;
                iconRect.localScale = new Vector3(scale, scale, 1f);

                if (group != null)
                {
                    group.alpha = t < 0.72f ? 1f : Mathf.Lerp(1f, 0f, (t - 0.72f) / 0.28f);
                }

                yield return null;
            }

            if (iconObject != null)
            {
                Destroy(iconObject);
            }
        }

        private System.Collections.IEnumerator FlashEffect()
        {
            Color originalColor = dropEffectImage.color;
            dropEffectImage.color = new Color(originalColor.r, originalColor.g, originalColor.b, 1f);
            float elapsed = 0f;
            float duration = 0.3f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float alpha = Mathf.Lerp(1f, 0f, elapsed / duration);
                dropEffectImage.color = new Color(originalColor.r, originalColor.g, originalColor.b, alpha);
                yield return null;
            }

            dropEffectImage.color = originalColor;
        }

        public bool ConsumeMaterials(int amount)
        {
            if (materialCount >= amount)
            {
                materialCount -= amount;
                _stageStartMaterialCount = Mathf.Min(_stageStartMaterialCount, materialCount);
                UpdateUI();
                return true;
            }
            return false;
        }

        public bool ConsumeHerbs(int amount)
        {
            if (herbCount >= amount)
            {
                herbCount -= amount;
                _stageStartHerbCount = Mathf.Min(_stageStartHerbCount, herbCount);
                UpdateUI();
                return true;
            }

            return false;
        }

        public bool ConsumeOres(int amount)
        {
            if (oreCount >= amount)
            {
                oreCount -= amount;
                _stageStartOreCount = Mathf.Min(_stageStartOreCount, oreCount);
                UpdateUI();
                return true;
            }

            return false;
        }

        public void AwardMaterials(int amount)
        {
            if (amount <= 0)
            {
                return;
            }

            materialCount += amount;
            _stageStartMaterialCount = materialCount;
            UpdateUI();
        }

        public void AwardHerbs(int amount)
        {
            if (amount <= 0)
            {
                return;
            }

            herbCount += amount;
            _stageStartHerbCount = herbCount;
            UpdateUI();
        }

        public void AwardOres(int amount)
        {
            if (amount <= 0)
            {
                return;
            }

            oreCount += amount;
            _stageStartOreCount = oreCount;
            UpdateUI();
        }

        public void SetBackpackCounts(int materials, int herbs, int ores)
        {
            materialCount = Mathf.Max(0, materials);
            herbCount = Mathf.Max(0, herbs);
            oreCount = Mathf.Max(0, ores);
            _stageStartMaterialCount = materialCount;
            _stageStartHerbCount = herbCount;
            _stageStartOreCount = oreCount;
            ResetRunStats();
        }

        public void ResetDrops()
        {
            ResetAllDrops();
        }

        public void ResetRunStats()
        {
            runMaterials = 0;
            runHerbs = 0;
            runOres = 0;
            normalKills = 0;
            bossKills = 0;
            UpdateUI();
        }

        public void CommitStageMaterials()
        {
            materialCount += runMaterials;
            herbCount += runHerbs;
            oreCount += runOres;
            _stageStartMaterialCount = materialCount;
            _stageStartHerbCount = herbCount;
            _stageStartOreCount = oreCount;
            ResetRunStats();
        }

        public void RollbackRunMaterials()
        {
            materialCount = _stageStartMaterialCount;
            herbCount = _stageStartHerbCount;
            oreCount = _stageStartOreCount;
            ResetRunStats();
        }

        public void ResetAllDrops()
        {
            materialCount = 0;
            herbCount = 0;
            oreCount = 0;
            _stageStartMaterialCount = 0;
            _stageStartHerbCount = 0;
            _stageStartOreCount = 0;
            runMaterials = 0;
            runHerbs = 0;
            runOres = 0;
            normalKills = 0;
            bossKills = 0;
            UpdateUI();
        }
    }
}
