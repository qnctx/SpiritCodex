using UnityEngine;

namespace LingsuMVP
{
    public class UnitHealthBar : MonoBehaviour
    {
        public Transform target;
        public Hero hero;
        public Monster monster;
        public Vector3 worldOffset = new Vector3(0f, 1f, 0f);
        public float width = 0.9f;
        public float height = 0.08f;
        public Color fillColor = new Color(0.15f, 0.9f, 0.32f, 1f);

        private static Sprite _barSprite;
        private Transform _background;
        private Transform _fill;
        private SpriteRenderer _backgroundRenderer;
        private SpriteRenderer _fillRenderer;

        private void Awake()
        {
            CreateBar();
        }

        private void LateUpdate()
        {
            if (target == null || !target.gameObject.activeInHierarchy)
            {
                SetVisible(false);
                return;
            }

            SetVisible(true);
            transform.position = target.position + worldOffset;
            _background.localScale = new Vector3(width, height, 1f);
            UpdateFill();
        }

        private void CreateBar()
        {
            _background = CreatePart("Background", new Color(0.05f, 0.05f, 0.05f, 0.88f), 40);
            _fill = CreatePart("Fill", fillColor, 41);

            _background.localScale = new Vector3(width, height, 1f);
            _fill.localScale = new Vector3(width, height, 1f);
            _fill.localPosition = Vector3.zero;
        }

        private Transform CreatePart(string partName, Color color, int sortingOrder)
        {
            GameObject part = new GameObject(partName);
            part.transform.SetParent(transform, false);

            SpriteRenderer renderer = part.AddComponent<SpriteRenderer>();
            renderer.sprite = GetBarSprite();
            renderer.color = color;
            renderer.sortingOrder = sortingOrder;

            if (partName == "Background")
            {
                _backgroundRenderer = renderer;
            }
            else
            {
                _fillRenderer = renderer;
            }

            return part.transform;
        }

        private void UpdateFill()
        {
            float ratio = GetHealthRatio();
            _fill.localScale = new Vector3(width * ratio, height, 1f);
            _fill.localPosition = new Vector3(-(width * (1f - ratio)) * 0.5f, 0f, -0.01f);

            if (ratio <= 0.3f)
            {
                _fillRenderer.color = new Color(0.95f, 0.18f, 0.12f, 1f);
            }
            else if (ratio <= 0.6f)
            {
                _fillRenderer.color = new Color(0.95f, 0.72f, 0.18f, 1f);
            }
            else
            {
                _fillRenderer.color = fillColor;
            }
        }

        private float GetHealthRatio()
        {
            if (hero != null)
            {
                return hero.maxHp <= 0 ? 0f : Mathf.Clamp01((float)hero.hp / hero.maxHp);
            }

            if (monster != null)
            {
                return monster.maxHp <= 0 ? 0f : Mathf.Clamp01((float)monster.hp / monster.maxHp);
            }

            return 0f;
        }

        private void SetVisible(bool visible)
        {
            if (_backgroundRenderer != null)
            {
                _backgroundRenderer.enabled = visible;
            }

            if (_fillRenderer != null)
            {
                _fillRenderer.enabled = visible;
            }
        }

        private static Sprite GetBarSprite()
        {
            if (_barSprite != null)
            {
                return _barSprite;
            }

            Texture2D texture = new Texture2D(1, 1, TextureFormat.RGBA32, false);
            texture.SetPixel(0, 0, Color.white);
            texture.Apply();
            _barSprite = Sprite.Create(texture, new Rect(0f, 0f, 1f, 1f), new Vector2(0.5f, 0.5f), 1f);
            return _barSprite;
        }
    }
}
