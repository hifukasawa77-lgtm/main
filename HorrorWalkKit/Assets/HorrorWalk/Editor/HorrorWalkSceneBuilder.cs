using HorrorWalk;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace HorrorWalkEditor
{
    public static class HorrorWalkSceneBuilder
    {
        private const string ScenesDir = "Assets/HorrorWalk/Scenes";

        [MenuItem("Tools/Horror Walk/Build Demo Scenes")]
        public static void BuildDemoScenes()
        {
            EnsureFolder("Assets/HorrorWalk");
            EnsureFolder(ScenesDir);

            BuildTitleScene();
            BuildHouseScene();
            BuildResultScene();

            EditorUtility.DisplayDialog(
                "Horror Walk",
                "シーン作成が完了しました。\nBuild Settingsに3シーンを追加して再生してください。",
                "OK"
            );
        }

        private static void BuildTitleScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
            scene.name = "Title";

            EnsureGameManager();
            var canvas = CreateCanvas("Canvas");
            var loader = new GameObject("SceneLoader").AddComponent<SceneLoader>();

            CreateText(canvas.transform, "TitleText", "Horror Walk", 32, new Vector2(0, 120));
            CreateText(canvas.transform, "HintText", "クリックで開始", 16, new Vector2(0, 60));

            var button = CreateButton(canvas.transform, "StartButton", "Start", new Vector2(0, -40));
            button.onClick.AddListener(loader.StartGame);

            SaveScene(scene, $"{ScenesDir}/Title.unity");
        }

        private static void BuildHouseScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
            scene.name = "House";

            var gm = EnsureGameManager();
            gm.ResetRun();

            ConfigureFogAndAmbient();

            var playerCamera = CreatePlayer(out var player);
            CreateFlashlight(playerCamera.transform);
            CreateHud();
            CreateWhiteboxHouse();

            CreateExitDoor();
            CreateKey("Key1", new Vector3(-3f, 0.9f, 3f));
            CreateKey("Key2", new Vector3(4f, 0.9f, 6f));
            CreateKey("Key3", new Vector3(-6f, 0.9f, 8.5f));

            CreateNote();

            var apparitionPrefab = CreateInSceneApparitionPrefab();
            CreateEventTrigger("Event1", new Vector3(0f, 1f, 0f), new Vector3(6f, 2f, 1f), apparitionPrefab, new Vector3(0f, 1f, 1.5f));

            SaveScene(scene, $"{ScenesDir}/House.unity");
        }

        private static void BuildResultScene()
        {
            var scene = EditorSceneManager.NewScene(NewSceneSetup.DefaultGameObjects, NewSceneMode.Single);
            scene.name = "Result";

            EnsureGameManager();
            var canvas = CreateCanvas("Canvas");
            var loader = new GameObject("SceneLoader").AddComponent<SceneLoader>();

            var resultText = CreateText(canvas.transform, "ResultText", "結果", 32, new Vector2(0, 120));
            var ru = new GameObject("ResultUI").AddComponent<ResultUI>();
            ru.resultText = resultText;

            var retry = CreateButton(canvas.transform, "RetryButton", "Retry", new Vector2(0, 20));
            retry.onClick.AddListener(loader.StartGame);
            var title = CreateButton(canvas.transform, "TitleButton", "Title", new Vector2(0, -40));
            title.onClick.AddListener(loader.BackToTitle);

            SaveScene(scene, $"{ScenesDir}/Result.unity");
        }

        private static void ConfigureFogAndAmbient()
        {
            RenderSettings.ambientIntensity = 0.6f;
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogDensity = 0.02f;
            RenderSettings.fogColor = new Color(0.05f, 0.05f, 0.06f, 1f);
        }

        private static Camera CreatePlayer(out GameObject player)
        {
            player = new GameObject("Player");
            player.transform.position = new Vector3(0f, 1.1f, -6f);

            var cc = player.AddComponent<CharacterController>();
            cc.height = 1.8f;
            cc.radius = 0.3f;
            cc.center = new Vector3(0f, 0.9f, 0f);

            var camPivot = new GameObject("CameraPivot");
            camPivot.transform.SetParent(player.transform, false);
            camPivot.transform.localPosition = new Vector3(0f, 1.55f, 0f);

            var camObj = new GameObject("Main Camera");
            camObj.tag = "MainCamera";
            camObj.transform.SetParent(camPivot.transform, false);
            camObj.transform.localPosition = Vector3.zero;
            var cam = camObj.AddComponent<Camera>();
            camObj.AddComponent<AudioListener>();

            var pc = player.AddComponent<PlayerController>();
            pc.cameraPivot = camPivot.transform;

            player.AddComponent<Interactor>().playerCamera = cam;
            return cam;
        }

        private static void CreateFlashlight(Transform parent)
        {
            var lightObj = new GameObject("Flashlight");
            lightObj.transform.SetParent(parent, false);
            lightObj.transform.localPosition = new Vector3(0.2f, -0.2f, 0.3f);

            var light = lightObj.AddComponent<Light>();
            light.type = LightType.Spot;
            light.range = 12f;
            light.spotAngle = 55f;
            light.intensity = 1.1f;
            lightObj.AddComponent<Flashlight>();
        }

        private static void CreateHud()
        {
            var canvas = CreateCanvas("HUD");
            var hud = new GameObject("UIHUD").AddComponent<UIHUD>();
            hud.transform.SetParent(canvas.transform, false);

            hud.keysText = CreateText(canvas.transform, "KeysText", "鍵 0/3", 18, new Vector2(-260, 170));
            hud.fearText = CreateText(canvas.transform, "FearText", "恐怖 0/100", 18, new Vector2(-260, 140));
            hud.promptText = CreateText(canvas.transform, "PromptText", "", 18, new Vector2(0, -170));

            var notePanel = new GameObject("NotePanel");
            notePanel.transform.SetParent(canvas.transform, false);
            var img = notePanel.AddComponent<Image>();
            img.color = new Color(0f, 0f, 0f, 0.75f);
            var rt = notePanel.GetComponent<RectTransform>();
            rt.anchorMin = new Vector2(0.1f, 0.15f);
            rt.anchorMax = new Vector2(0.9f, 0.85f);
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
            notePanel.SetActive(false);
            hud.notePanel = notePanel;

            var noteText = CreateText(notePanel.transform, "NoteText", "", 18, Vector2.zero);
            noteText.alignment = TextAnchor.UpperLeft;
            var noteRt = noteText.GetComponent<RectTransform>();
            noteRt.anchorMin = new Vector2(0.05f, 0.05f);
            noteRt.anchorMax = new Vector2(0.95f, 0.95f);
            noteRt.offsetMin = Vector2.zero;
            noteRt.offsetMax = Vector2.zero;
            hud.noteText = noteText;
        }

        private static void CreateWhiteboxHouse()
        {
            var floor = GameObject.CreatePrimitive(PrimitiveType.Cube);
            floor.name = "Floor";
            floor.transform.position = new Vector3(0f, -0.5f, 3f);
            floor.transform.localScale = new Vector3(20f, 1f, 22f);

            CreateWall("WallL", new Vector3(-4f, 1f, 3f), new Vector3(1f, 3f, 20f));
            CreateWall("WallR", new Vector3(4f, 1f, 3f), new Vector3(1f, 3f, 20f));
            CreateWall("WallBack", new Vector3(0f, 1f, -7f), new Vector3(9f, 3f, 1f));
            CreateWall("WallFront", new Vector3(0f, 1f, 13f), new Vector3(9f, 3f, 1f));
            CreateWall("Partition1", new Vector3(-1.5f, 1f, 4f), new Vector3(1f, 3f, 6f));
            CreateWall("Partition2", new Vector3(2.0f, 1f, 7f), new Vector3(1f, 3f, 8f));
        }

        private static void CreateWall(string name, Vector3 pos, Vector3 scale)
        {
            var wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wall.name = name;
            wall.transform.position = pos;
            wall.transform.localScale = scale;
        }

        private static void CreateExitDoor()
        {
            var exit = GameObject.CreatePrimitive(PrimitiveType.Cube);
            exit.name = "ExitDoor";
            exit.transform.position = new Vector3(0f, 1f, 10f);
            exit.transform.localScale = new Vector3(1.2f, 2.2f, 0.2f);
            exit.AddComponent<DoorExit>().isExitDoor = true;
        }

        private static void CreateKey(string name, Vector3 pos)
        {
            var key = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            key.name = name;
            key.transform.position = pos;
            key.transform.localScale = new Vector3(0.25f, 0.02f, 0.25f);
            key.AddComponent<PickupKey>().keyName = "鍵";
        }

        private static void CreateNote()
        {
            var note = GameObject.CreatePrimitive(PrimitiveType.Cube);
            note.name = "Note";
            note.transform.position = new Vector3(2f, 1.0f, 2f);
            note.transform.localScale = new Vector3(0.3f, 0.02f, 0.4f);
            var noteComp = note.AddComponent<Note>();
            noteComp.text = "鍵を3つ集めろ。\n\nライトが…おかしい。";
        }

        private static Apparition CreateInSceneApparitionPrefab()
        {
            var app = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            app.name = "ApparitionPrefab";
            app.transform.position = new Vector3(1000f, -1000f, 1000f);
            app.transform.localScale = new Vector3(0.6f, 1.2f, 0.6f);
            var r = app.GetComponent<Renderer>();
            if (r != null) r.sharedMaterial.color = new Color(0f, 0f, 0f, 1f);

            Object.DestroyImmediate(app.GetComponent<Collider>());
            return app.AddComponent<Apparition>();
        }

        private static void CreateEventTrigger(string name, Vector3 pos, Vector3 boxSize, Apparition apparitionPrefab, Vector3 spawnOffset)
        {
            var go = new GameObject(name);
            go.transform.position = pos;
            var col = go.AddComponent<BoxCollider>();
            col.isTrigger = true;
            col.size = boxSize;

            var spawn = new GameObject("Spawn").transform;
            spawn.SetParent(go.transform, false);
            spawn.localPosition = spawnOffset;

            var trig = go.AddComponent<HorrorEventTrigger>();
            trig.addFear = 18f;
            trig.flashlightFlickerSeconds = 1.0f;
            trig.apparitionPrefab = apparitionPrefab;
            trig.apparitionSpawn = spawn;
            trig.apparitionLifetime = 1.4f;
        }

        private static GameManager EnsureGameManager()
        {
            var gm = Object.FindObjectOfType<GameManager>();
            if (gm != null) return gm;

            var go = new GameObject("GameManager");
            gm = go.AddComponent<GameManager>();
            return gm;
        }

        private static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;

            var parent = System.IO.Path.GetDirectoryName(path).Replace("\\", "/");
            var name = System.IO.Path.GetFileName(path);
            if (!string.IsNullOrEmpty(parent) && !AssetDatabase.IsValidFolder(parent))
            {
                EnsureFolder(parent);
            }

            AssetDatabase.CreateFolder(parent, name);
        }

        private static void SaveScene(Scene scene, string path)
        {
            EditorSceneManager.SaveScene(scene, path);
        }

        private static Canvas CreateCanvas(string name)
        {
            var go = new GameObject(name);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            go.AddComponent<CanvasScaler>().uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            go.AddComponent<GraphicRaycaster>();
            return canvas;
        }

        private static Text CreateText(Transform parent, string name, string content, int size, Vector2 anchoredPos)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);

            var text = go.AddComponent<Text>();
            text.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            text.text = content;
            text.fontSize = size;
            text.color = Color.white;
            text.alignment = TextAnchor.MiddleCenter;

            var rt = go.GetComponent<RectTransform>();
            rt.sizeDelta = new Vector2(700, 60);
            rt.anchoredPosition = anchoredPos;
            return text;
        }

        private static Button CreateButton(Transform parent, string name, string label, Vector2 anchoredPos)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var img = go.AddComponent<Image>();
            img.color = new Color(1f, 1f, 1f, 0.9f);

            var btn = go.AddComponent<Button>();
            var rt = go.GetComponent<RectTransform>();
            rt.sizeDelta = new Vector2(220, 50);
            rt.anchoredPosition = anchoredPos;

            var txt = CreateText(go.transform, "Label", label, 18, Vector2.zero);
            txt.color = Color.black;
            txt.alignment = TextAnchor.MiddleCenter;
            return btn;
        }
    }
}

