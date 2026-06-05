using UnityEngine;

namespace LingsuMVP
{
    public class TargetSelectionMarker : MonoBehaviour
    {
        public BattleManager battleManager;
        public Vector3 worldOffset = new Vector3(0f, 1.04f, 0f);

        private static Sprite _markerSprite;
        private SpriteRenderer _renderer;

        private void Awake()
        {
            _renderer = gameObject.AddComponent<SpriteRenderer>();
            _renderer.sprite = GetMarkerSprite();
            _renderer.color = new Color(1f, 0.9f, 0.1f, 1f);
            _renderer.sortingOrder = 55;
            transform.localScale = new Vector3(0.36f, 0.08f, 1f);
        }

        private void LateUpdate()
        {
            Monster target = battleManager != null ? battleManager.GetCurrentTarget() : null;
            if (target == null || !target.IsAlive)
            {
                _renderer.enabled = false;
                return;
            }

            _renderer.enabled = true;
            transform.position = target.transform.position + worldOffset;
        }

        private static Sprite GetMarkerSprite()
        {
            if (_markerSprite != null)
            {
                return _markerSprite;
            }

            Texture2D texture = new Texture2D(1, 1, TextureFormat.RGBA32, false);
            texture.SetPixel(0, 0, Color.white);
            texture.Apply();
            _markerSprite = Sprite.Create(texture, new Rect(0f, 0f, 1f, 1f), new Vector2(0.5f, 0.5f), 1f);
            return _markerSprite;
        }
    }
}
