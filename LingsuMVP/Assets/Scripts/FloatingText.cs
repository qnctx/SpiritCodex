using TMPro;
using UnityEngine;

namespace LingsuMVP
{
    public class FloatingText : MonoBehaviour
    {
        private float _duration = 0.55f;
        private float _distance = 0.45f;
        private float _elapsed;
        private Vector3 _startPosition;
        private TextMeshPro _text;
        private Color _startColor;

        public void Initialize(float duration, float distance)
        {
            _duration = Mathf.Max(0.01f, duration);
            _distance = distance;
        }

        private void Awake()
        {
            _startPosition = transform.position;
            _text = GetComponent<TextMeshPro>();
            _startColor = _text != null ? _text.color : Color.white;
        }

        private void Update()
        {
            _elapsed += Time.deltaTime;
            float ratio = Mathf.Clamp01(_elapsed / _duration);

            transform.position = _startPosition + new Vector3(0f, _distance * ratio, 0f);
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
