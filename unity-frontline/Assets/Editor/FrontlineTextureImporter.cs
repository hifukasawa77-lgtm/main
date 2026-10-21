using UnityEditor;
using UnityEngine;

// Keep repeated material detail crisp while limiting WebGL texture memory.
public sealed class FrontlineTextureImporter : AssetPostprocessor
{
    void OnPreprocessTexture()
    {
        if (!assetPath.StartsWith("Assets/Resources/FrontlineTextures/")) return;
        var importer = (TextureImporter)assetImporter;
        importer.textureType = TextureImporterType.Default;
        importer.sRGBTexture = true;
        importer.alphaSource = TextureImporterAlphaSource.None;
        importer.mipmapEnabled = true;
        importer.wrapMode = TextureWrapMode.Repeat;
        importer.filterMode = FilterMode.Trilinear;
        importer.anisoLevel = 4;
        importer.maxTextureSize = 1024;
        importer.npotScale = TextureImporterNPOTScale.ToNearest;
        importer.textureCompression = TextureImporterCompression.Compressed;
        importer.isReadable = false;
    }
}
