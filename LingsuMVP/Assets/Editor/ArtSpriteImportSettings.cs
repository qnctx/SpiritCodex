using UnityEditor;
using UnityEngine;

namespace LingsuMVP.Editor
{
    public class ArtSpriteImportSettings : AssetPostprocessor
    {
        private void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith("Assets/Resources/Art/"))
            {
                return;
            }

            TextureImporter importer = (TextureImporter)assetImporter;
            bool isGeneratedArt = assetPath.StartsWith("Assets/Resources/Art/Generated/");
            bool isGeneratedBackground = assetPath.Contains("/Generated/Backgrounds/");
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = true;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.filterMode = FilterMode.Bilinear;
            importer.wrapMode = TextureWrapMode.Clamp;
            importer.textureCompression = isGeneratedArt ? TextureImporterCompression.CompressedHQ : TextureImporterCompression.Uncompressed;
            importer.maxTextureSize = isGeneratedArt ? 2048 : 4096;

            TextureImporterPlatformSettings standalone = importer.GetPlatformTextureSettings("Standalone");
            standalone.name = "Standalone";
            standalone.overridden = true;
            standalone.maxTextureSize = isGeneratedArt ? 2048 : 4096;
            standalone.textureCompression = isGeneratedArt ? TextureImporterCompression.CompressedHQ : TextureImporterCompression.Uncompressed;
            importer.SetPlatformTextureSettings(standalone);

            if (isGeneratedArt)
            {
                TextureImporterPlatformSettings android = importer.GetPlatformTextureSettings("Android");
                android.name = "Android";
                android.overridden = true;
                android.maxTextureSize = isGeneratedBackground ? 2048 : 1024;
                android.format = isGeneratedBackground ? TextureImporterFormat.ASTC_6x6 : TextureImporterFormat.ASTC_4x4;
                android.textureCompression = TextureImporterCompression.CompressedHQ;
                importer.SetPlatformTextureSettings(android);
            }
        }
    }
}
