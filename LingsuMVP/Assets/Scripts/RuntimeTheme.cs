using UnityEngine;

namespace LingsuMVP
{
    public static class RuntimeTheme
    {
        public static readonly Color Canvas = new Color(0.018f, 0.02f, 0.055f, 1f);
        public static readonly Color Panel = new Color(0.035f, 0.038f, 0.09f, 0.96f);
        public static readonly Color PanelRaised = new Color(0.065f, 0.065f, 0.14f, 0.96f);
        public static readonly Color PanelGlass = new Color(0.025f, 0.027f, 0.07f, 0.82f);
        public static readonly Color Button = new Color(0.12f, 0.115f, 0.19f, 1f);
        public static readonly Color ButtonHover = new Color(0.24f, 0.19f, 0.2f, 1f);
        public static readonly Color ButtonDisabled = new Color(0.055f, 0.055f, 0.09f, 1f);
        public static readonly Color Brass = new Color(0.72f, 0.55f, 0.29f, 1f);
        public static readonly Color BrassBright = new Color(0.94f, 0.78f, 0.42f, 1f);
        public static readonly Color TextPrimary = new Color(0.91f, 0.88f, 0.78f, 1f);
        public static readonly Color TextMuted = new Color(0.67f, 0.66f, 0.7f, 1f);

        public static Color HarmonizeSurface(Color source)
        {
            float max = Mathf.Max(source.r, Mathf.Max(source.g, source.b));
            float min = Mathf.Min(source.r, Mathf.Min(source.g, source.b));
            bool nearNeutralDark = max > 0.005f && max <= 0.14f && max - min <= 0.045f;
            if (!nearNeutralDark)
            {
                return source;
            }

            float lift = Mathf.InverseLerp(0f, 0.14f, max);
            Color target = Color.Lerp(Canvas, PanelRaised, lift);
            target.a = source.a;
            return target;
        }

        public static void DrawTextureCover(Rect rect, Texture texture, Color tint)
        {
            if (texture == null)
            {
                return;
            }

            Color previousColor = GUI.color;
            GUI.color = tint;
            GUI.DrawTexture(rect, texture, ScaleMode.ScaleAndCrop, true);
            GUI.color = previousColor;
        }
    }
}
