using System.Collections;
using UnityEngine;

namespace LingsuMVP
{
    public class TargetFlash : MonoBehaviour
    {
        private Coroutine _flashRoutine;

        public void Play(SpriteRenderer renderer, Color flashColor)
        {
            if (_flashRoutine != null)
            {
                StopCoroutine(_flashRoutine);
            }

            _flashRoutine = StartCoroutine(FlashRoutine(renderer, flashColor));
        }

        private IEnumerator FlashRoutine(SpriteRenderer renderer, Color flashColor)
        {
            Color originalColor = renderer.color;
            renderer.color = Color.Lerp(Color.white, flashColor, 0.45f);
            yield return new WaitForSeconds(0.08f);
            renderer.color = originalColor;
            _flashRoutine = null;
        }
    }
}
