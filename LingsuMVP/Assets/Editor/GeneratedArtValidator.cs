using UnityEditor;
using UnityEngine;

namespace LingsuMVP.Editor
{
    public static class GeneratedArtValidator
    {
        [MenuItem("LingsuMVP/Validate Generated Art")]
        public static void ValidateGeneratedArt()
        {
            string[] expectedPaths = ArtCatalog.GetExpectedGeneratedPaths();
            int foundCount = 0;

            for (int i = 0; i < expectedPaths.Length; i++)
            {
                string resourcePath = expectedPaths[i];
                string assetPath = "Assets/Resources/" + resourcePath + ".png";
                Sprite sprite = Resources.Load<Sprite>(resourcePath);
                if (sprite == null)
                {
                    Debug.LogWarning($"Generated art is missing or not imported as Sprite: {assetPath}");
                    continue;
                }

                foundCount++;
            }

            string status = foundCount == expectedPaths.Length
                ? "All generated art is ready."
                : "Missing sprites use runtime fallbacks.";
            Debug.Log($"Generated art validation: {foundCount}/{expectedPaths.Length} expected sprites are available. {status}");
        }
    }
}
