using TMPro;
using UnityEngine;

namespace LingsuMVP
{
    public class FloatingDamageTextUI : MonoBehaviour
    {
        private float _duration = 0.75f;
        private float _distance = 70f;
        private float _elapsed;
        private Vector2 _startPosition;
        private TextMeshProUGUI _text;
        private Color _startColor;
        private RectTransform _rectTransform;

        public void Initialize(float duration, float distance)
        {
            _duration = Mathf.Max(0.01f, duration);
            _distance = distance;
        }

        private void Awake()
        {
            _rectTransform = GetComponent<RectTransform>();
            _text = GetComponent<TextMeshProUGUI>();
            _startPosition = _rectTransform != null ? _rectTransform.anchoredPosition : Vector2.zero;
            _startColor = _text != null ? _text.color : Color.white;
        }

        private void Update()
        {
            _elapsed += Time.deltaTime;
            float ratio = Mathf.Clamp01(_elapsed / _duration);

            if (_rectTransform != null)
            {
                _rectTransform.anchoredPosition = _startPosition + new Vector2(0f, _distance * ratio);
            }

            if (_text != null)
            {
                _text.color = new Color(_startColor.r, _startColor.g, _startColor.b, 1f - ratio);
            }

            if (ratio >= 1f)
            {
                Destroy(gameObject);
            }
        }
    }
}
