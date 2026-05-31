using UnityEngine;
using UnityEngine.UI;
using TMPro;

namespace LingsuMVP
{
    public class DropSystem : MonoBehaviour
    {
        [Header("Drop Settings")]
        public int materialCount = 0;
        public int monsterDropAmount = 1;
        public int bossDropAmount = 5;

        [Header("UI Reference")]
        public TextMeshProUGUI materialCountText;
        public Image dropEffectImage;

        private DropSystem() { }

        private static DropSystem _instance;
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

        public void OnMonsterDead(bool isBoss)
        {
            int dropAmount = isBoss ? bossDropAmount : monsterDropAmount;
            materialCount += dropAmount;

            Debug.Log($"Monster{(isBoss ? " (BOSS)" : "")} dropped {dropAmount} materials. Total: {materialCount}");

            UpdateUI();
            PlayDropEffect();
        }

        private void UpdateUI()
        {
            if (materialCountText != null)
            {
                materialCountText.text = $"材料数量：×{materialCount}";
            }
        }

        private void PlayDropEffect()
        {
            if (dropEffectImage != null)
            {
                // Simple flash effect
                StartCoroutine(FlashEffect());
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
                UpdateUI();
                return true;
            }
            return false;
        }

        public void ResetDrops()
        {
            materialCount = 0;
            UpdateUI();
        }
    }
}