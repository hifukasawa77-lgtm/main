using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

// batchmode から: Unity.exe -batchmode -quit -projectPath . -executeMethod BuildScript.BuildWebGL
public static class BuildScript
{
    static void KeepShaders()
    {
        var gs = AssetDatabase.LoadAssetAtPath<Object>("ProjectSettings/GraphicsSettings.asset");
        var so = new SerializedObject(gs);
        var arr = so.FindProperty("m_AlwaysIncludedShaders");
        foreach (var n in new[] { "Standard", "Unlit/Color", "Sprites/Default" })
        {
            var sh = Shader.Find(n); if (sh == null) { Debug.LogWarning("shader not found: " + n); continue; }
            bool has = false;
            for (int i = 0; i < arr.arraySize; i++) if (arr.GetArrayElementAtIndex(i).objectReferenceValue == sh) has = true;
            if (has) continue;
            arr.InsertArrayElementAtIndex(arr.arraySize);
            arr.GetArrayElementAtIndex(arr.arraySize - 1).objectReferenceValue = sh;
        }
        so.ApplyModifiedPropertiesWithoutUndo();
    }

    public static void BuildWebGL()
    {
        KeepShaders();
        PlayerSettings.companyName = "hide";
        PlayerSettings.productName = "Frontline Zero";
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled; // GitHub Pages が転送時に圧縮する
        PlayerSettings.WebGL.decompressionFallback = false;
        PlayerSettings.stripEngineCode = false; // 物理等を実行時にしか使わないため削ると AddComponent が失敗する
        PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.None;
        PlayerSettings.WebGL.initialMemorySize = 256;
        PlayerSettings.SetManagedStrippingLevel(UnityEditor.Build.NamedBuildTarget.WebGL, ManagedStrippingLevel.High);
        var scene = "Assets/Boot.unity";
        if (!File.Exists(scene))
        {
            var sc = UnityEditor.SceneManagement.EditorSceneManager.NewScene(UnityEditor.SceneManagement.NewSceneSetup.EmptyScene);
            UnityEditor.SceneManagement.EditorSceneManager.SaveScene(sc, scene);
        }
        var opts = new BuildPlayerOptions
        {
            scenes = new[] { scene },
            locationPathName = "../frontline-zero",
            target = BuildTarget.WebGL,
            options = BuildOptions.None
        };
        var r = BuildPipeline.BuildPlayer(opts);
        Debug.Log("BUILD " + r.summary.result + " size=" + r.summary.totalSize);
        EditorApplication.Exit(r.summary.result == BuildResult.Succeeded ? 0 : 1);
    }
}
