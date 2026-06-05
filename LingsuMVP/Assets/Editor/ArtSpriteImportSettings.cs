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
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = true;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.filterMode = FilterMode.Bilinear;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.maxTextureSize = 4096;

            TextureImporterPlatformSettings standalone = importer.GetPlatformTextureSettings("Standalone");
            standalone.name = "Standalone";
            standalone.overridden = true;
            standalone.maxTextureSize = 4096;
            standalone.textureCompression = TextureImporterCompression.Uncompressed;
            importer.SetPlatformTextureSettings(standalone);
        }
    }
}
