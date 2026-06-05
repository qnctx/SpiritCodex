using System;
using System.Collections;
using TMPro;
using UnityEngine;

namespace LingsuMVP
{
    public static class CombatFeedback
    {
        private static Sprite _effectSprite;

        public static void PlayBasicAttack(MonoBehaviour runner, Transform attacker, Transform target, int damage, Color effectColor, Func<int> applyDamage)
        {
            if (runner == null || attacker == null || target == null)
            {
                return;
            }

            runner.StartCoroutine(AttackRoutine(attacker, target, damage, effectColor, applyDamage));
        }

        public static void ShowDamageNumber(Transform target, int damage, Vector3 offset)
        {
            ShowDamageNumber(target, damage, offset, new Color(1f, 0.94f, 0.18f, 1f));
        }

        public static void ShowDamageNumber(Transform target, int damage, Vector3 offset, Color color)
        {
            if (target == null)
            {
                return;
            }

            CreateDamageNumber(target.position + offset, damage, color);
        }

        private static IEnumerator AttackRoutine(Transform attacker, Transform target, int damage, Color effectColor, Func<int> applyDamage)
        {
            Vector3 attackerStart = attacker.position;
            Vector3 targetStart = target.position;
            Vector3 direction = (targetStart - attackerStart).normalized;
            Vector3 lungePosition = attackerStart + direction * 0.18f;
            SpriteRenderer targetRenderer = target.GetComponent<SpriteRenderer>();
            Color originalTargetColor = targetRenderer != null ? targetRenderer.color : Color.white;

            yield return MoveTransform(attacker, attackerStart, lungePosition, 0.08f);
            CreateProjectile(attacker.position + direction * 0.25f, targetStart, effectColor);
            yield return MoveTransform(attacker, lungePosition, attackerStart, 0.08f);
            yield return new WaitForSeconds(0.18f);

            if (targetRenderer != null && targetRenderer.enabled)
            {
                targetRenderer.color = Color.Lerp(Color.white, effectColor, 0.4f);
            }

            yield return new WaitForSeconds(0.06f);

            if (!IsBattlePlaying())
            {
                RestoreTargetColor(targetRenderer, originalTargetColor);
                yield break;
            }

            int displayedDamage = damage;
            if (applyDamage != null)
            {
                displayedDamage = applyDamage.Invoke();
            }

            CreateDamageNumber(targetStart + new Vector3(0f, 0.92f, 0f), displayedDamage, new Color(1f, 0.94f, 0.18f, 1f));

            if (targetRenderer != null && targetRenderer.enabled)
            {
                targetRenderer.color = originalTargetColor;
            }
        }

        private static bool IsBattlePlaying()
        {
            return GameManager.Instance == null || GameManager.Instance.CurrentState == GameManager.GameState.Playing;
        }

        private static void RestoreTargetColor(SpriteRenderer targetRenderer, Color originalTargetColor)
        {
            if (targetRenderer != null && targetRenderer.enabled)
            {
                targetRenderer.color = originalTargetColor;
            }
        }

        private static IEnumerator MoveTransform(Transform transform, Vector3 from, Vector3 to, float duration)
        {
            float elapsed = 0f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float ratio = Mathf.Clamp01(elapsed / duration);
                transform.position = Vector3.Lerp(from, to, ratio);
                yield return null;
            }

            transform.position = to;
        }

        private static void CreateProjectile(Vector3 from, Vector3 to, Color color)
        {
            GameObject projectile = new GameObject("AttackProjectile");
            projectile.transform.position = from;

            SpriteRenderer renderer = projectile.AddComponent<SpriteRenderer>();
            renderer.sprite = GetEffectSprite();
            renderer.color = color;
            renderer.sortingOrder = 50;

            projectile.transform.localScale = new Vector3(0.34f, 0.34f, 1f);
            ProjectileFeedback feedback = projectile.AddComponent<ProjectileFeedback>();
            feedback.Initialize(to, 0.24f);
        }

        private static void CreateDamageNumber(Vector3 position, int damage, Color color)
        {
            if (CreateUiDamageNumber(position, damage, color))
            {
                return;
            }

            GameObject textObject = new GameObject("DamageNumber");
            textObject.transform.position = position;

            TextMeshPro text = textObject.AddComponent<TextMeshPro>();
            text.text = "-" + damage;
            text.fontSize = 5.5f;
            text.alignment = TextAlignmentOptions.Center;
            text.color = color;
            text.sortingOrder = 60;
            text.fontStyle = FontStyles.Bold;
            text.outlineWidth = 0.28f;
            text.outlineColor = Color.black;

            FloatingText floatingText = textObject.AddComponent<FloatingText>();
            floatingText.Initialize(0.72f, 0.72f);
        }

        private static bool CreateUiDamageNumber(Vector3 worldPosition, int damage, Color color)
        {
            Canvas canvas = UnityEngine.Object.FindObjectOfType<Canvas>();
            Camera camera = Camera.main;
            if (canvas == null || camera == null)
            {
                return false;
            }

            RectTransform canvasRect = canvas.GetComponent<RectTransform>();
            if (canvasRect == null)
            {
                return false;
            }

            Vector3 screenPoint = camera.WorldToScreenPoint(worldPosition);
            if (screenPoint.z < 0f)
            {
                return false;
            }

            Vector2 anchoredPosition;
            RectTransformUtility.ScreenPointToLocalPointInRectangle(canvasRect, screenPoint, null, out anchoredPosition);

            GameObject textObject = new GameObject("DamageNumberUI");
            textObject.transform.SetParent(canvas.transform, false);

            RectTransform rectTransform = textObject.AddComponent<RectTransform>();
            rectTransform.anchorMin = new Vector2(0.5f, 0.5f);
            rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            rectTransform.pivot = new Vector2(0.5f, 0.5f);
            rectTransform.anchoredPosition = anchoredPosition;
            rectTransform.sizeDelta = new Vector2(160f, 64f);

            TextMeshProUGUI text = textObject.AddComponent<TextMeshProUGUI>();
            text.text = "-" + damage;
            text.fontSize = 46f;
            text.fontStyle = FontStyles.Bold;
            text.alignment = TextAlignmentOptions.Center;
            text.color = color;
            text.outlineWidth = 0.22f;
            text.outlineColor = Color.black;
            text.raycastTarget = false;

            FloatingDamageTextUI floatingText = textObject.AddComponent<FloatingDamageTextUI>();
            floatingText.Initialize(0.78f, 86f);
            return true;
        }

        private static Sprite GetEffectSprite()
        {
            if (_effectSprite != null)
            {
                return _effectSprite;
            }

            Texture2D texture = new Texture2D(16, 16, TextureFormat.RGBA32, false);
            Color clear = new Color(0f, 0f, 0f, 0f);
            for (int y = 0; y < texture.height; y++)
            {
                for (int x = 0; x < texture.width; x++)
                {
                    float dx = (x - 7.5f) / 7.5f;
                    float dy = (y - 7.5f) / 7.5f;
                    texture.SetPixel(x, y, dx * dx + dy * dy <= 1f ? Color.white : clear);
                }
            }

            texture.Apply();
            _effectSprite = Sprite.Create(texture, new Rect(0f, 0f, 16f, 16f), new Vector2(0.5f, 0.5f), 16f);
            return _effectSprite;
        }

    }
}
