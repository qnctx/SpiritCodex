using UnityEngine;

namespace LingsuMVP
{
    public class ProjectileFeedback : MonoBehaviour
    {
        private Vector3 _from;
        private Vector3 _to;
        private float _duration = 0.18f;
        private float _elapsed;

        public void Initialize(Vector3 targetPosition, float duration)
        {
            _from = transform.position;
            _to = targetPosition;
            _duration = Mathf.Max(0.01f, duration);
            _elapsed = 0f;
        }

        private void Update()
        {
            _elapsed += Time.deltaTime;
            float ratio = Mathf.Clamp01(_elapsed / _duration);
            transform.position = Vector3.Lerp(_from, _to, ratio);

            float scale = Mathf.Lerp(0.34f, 0.12f, ratio);
            transform.localScale = new Vector3(scale, scale, 1f);

            if (ratio >= 1f)
            {
                Destroy(gameObject);
            }
        }
    }
}
