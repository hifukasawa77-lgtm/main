// FRONTLINE ZERO — オリジナルの陣取り型チームFPS。外部アセット無し（形・質感・音・HUDすべてコード生成）。
// 2チーム(AZURE / EMBER)が5つの拠点を奪い合い、チケット(持ち点)を先に0にした側が負け。軽戦車に乗れる。
using System.Collections.Generic;
using UnityEngine;

public enum Team { Azure = 0, Ember = 1, None = 2 }
public enum Phase { Title, Playing, Over }

public class CapturePoint
{
    public string name;
    public Vector3 pos;
    public float control;          // -1(Ember) .. +1(Azure)
    public Team owner = Team.None;
    public Transform flag;
    public Renderer flagRend;
    public const float Radius = 9f;
}

public class FrontlineGame : MonoBehaviour
{
    // ---- 調整値 ----
    const int BotsPerSide = 9;
    const float StartTickets = 80f;
    const float PlayerSpeed = 7f, SprintMul = 1.55f, JumpV = 7.5f, Gravity = -22f;
    const float BotSpeed = 5.6f;
    const float MapHalf = 80f;
    const float CannonReloadPlayer = 1.6f, CannonDmg = 150f, CannonRadius = 7f;
    const float EnterRange = 8f;
    const float VehicleLossTickets = 5f;

    public static FrontlineGame I;
    Phase phase = Phase.Title;
    readonly List<Soldier> soldiers = new List<Soldier>();
    readonly List<Vehicle> vehicles = new List<Vehicle>();
    readonly List<CapturePoint> points = new List<CapturePoint>();
    readonly Dictionary<string, Material> matCache = new Dictionary<string, Material>();
    readonly float[] tickets = new float[2];
    Soldier player;
    Camera cam;
    Transform world;
    Material matAzure, matEmber, matTracer;
    float yaw, pitch;
    float camOrbit;
    string banner = ""; float bannerUntil;
    string killFeed = ""; float killFeedUntil;
    float hitMarkerUntil; float damageFlashUntil;
    float bleedAcc;
    AudioSource sfx; AudioClip clipShot, clipHit, clipCap, clipHurt, clipBoom;
    Transform gunModel; Vector3 gunBase; float recoil;
    GUIStyle sBig, sMid, sSmall;
    int seed = 7;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
    static void Boot()
    {
        var go = new GameObject("FrontlineGame");
        go.AddComponent<FrontlineGame>();
    }

    // ================= 初期化 =================
    void Awake()
    {
        I = this;
        Application.targetFrameRate = 60;
        QualitySettings.shadowDistance = 90f;
        Textures.Init();
        MakeAudio();
        BuildWorld();
    }

    static float R(float a, float b) { return Random.Range(a, b); }

    Material Mat(Color c, float smooth = 0.1f)
    {
        var sh = Shader.Find("Standard");
        if (sh == null) sh = Shader.Find("Unlit/Color");
        var m = new Material(sh); m.color = c;
        if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", smooth);
        return m;
    }

    // 質感つきマテリアル（同じ指定は共有する）
    Material TM(Texture2D t, float tx, float ty, float sm = 0.08f, Color? tint = null)
    {
        Color tc = tint ?? Color.white;
        string k = t.name + "|" + Mathf.Round(tx * 2f) + "|" + Mathf.Round(ty * 2f) + "|" + sm + "|" + ColorUtility.ToHtmlStringRGB(tc);
        Material m;
        if (matCache.TryGetValue(k, out m) && m != null) return m;
        var sh = Shader.Find("Standard"); if (sh == null) sh = Shader.Find("Unlit/Color");
        m = new Material(sh); m.mainTexture = t; m.mainTextureScale = new Vector2(tx, ty); m.color = tc;
        if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", sm);
        matCache[k] = m; return m;
    }

    Material FxMat(Color c)
    {
        string k = "fx" + ColorUtility.ToHtmlStringRGB(c);
        Material m;
        if (matCache.TryGetValue(k, out m) && m != null) return m;
        var sh = Shader.Find("Unlit/Color"); if (sh == null) sh = Shader.Find("Standard");
        m = new Material(sh) { color = c }; matCache[k] = m; return m;
    }

    GameObject P(Transform parent, PrimitiveType t, Vector3 lp, Vector3 ls, Material m, Vector3? euler = null, bool keepCollider = false)
    {
        var g = GameObject.CreatePrimitive(t); g.transform.SetParent(parent, false);
        g.transform.localPosition = lp; g.transform.localScale = ls;
        if (euler.HasValue) g.transform.localRotation = Quaternion.Euler(euler.Value);
        g.GetComponent<Renderer>().sharedMaterial = m;
        if (!keepCollider) { var c = g.GetComponent<Collider>(); if (c != null) DestroyImmediate(c); }
        return g;
    }

    void BuildWorld()
    {
        if (world != null) Destroy(world.gameObject);
        soldiers.Clear(); points.Clear(); vehicles.Clear(); decals.Clear(); pending.Clear();
        world = new GameObject("World").transform;
        tickets[0] = tickets[1] = StartTickets;
        Random.InitState(seed);

        matAzure = Mat(new Color(0.20f, 0.52f, 0.95f));
        matEmber = Mat(new Color(0.95f, 0.45f, 0.15f));
        var tsh = Shader.Find("Sprites/Default"); if (tsh == null) tsh = Shader.Find("Unlit/Color");
        matTracer = new Material(tsh) { color = new Color(1f, 0.9f, 0.5f) };

        // 空と光（砂塵と煙でかすんだ戦場）
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(0.52f, 0.5f, 0.48f);
        RenderSettings.fog = true; RenderSettings.fogColor = new Color(0.58f, 0.55f, 0.5f);
        RenderSettings.fogMode = FogMode.Linear; RenderSettings.fogStartDistance = 45; RenderSettings.fogEndDistance = 175;
        var lg = new GameObject("Sun").transform; lg.SetParent(world);
        var l = lg.gameObject.AddComponent<Light>(); l.type = LightType.Directional; l.intensity = 1.1f;
        l.color = new Color(1f, 0.9f, 0.78f); l.shadows = LightShadows.Hard;
        lg.rotation = Quaternion.Euler(42, -30, 0);

        // カメラ
        if (cam == null)
        {
            var cg = new GameObject("Cam"); cam = cg.AddComponent<Camera>();
            cg.AddComponent<AudioListener>();
            cam.fieldOfView = 75; cam.nearClipPlane = 0.08f; cam.farClipPlane = 260;
            cam.clearFlags = CameraClearFlags.SolidColor;
            sfx = cg.AddComponent<AudioSource>(); sfx.spatialBlend = 0f;
        }
        cam.backgroundColor = RenderSettings.fogColor;
        foreach (var c in Camera.allCameras) if (c != cam) c.enabled = false;

        // 地面（土・泥・草）
        float gs = MapHalf * 2 + 20;
        var g = GameObject.CreatePrimitive(PrimitiveType.Cube); g.transform.SetParent(world);
        g.transform.position = new Vector3(0, -0.5f, 0); g.transform.localScale = new Vector3(gs, 1, gs);
        g.GetComponent<Renderer>().sharedMaterial = TM(Textures.Ground, gs / 7f, gs / 7f, 0.03f); g.name = "Ground";
        // 外周の壁（コンクリート）
        for (int i = 0; i < 4; i++)
        {
            bool zAxis = i < 2; float s = (i % 2 == 0 ? 1 : -1) * (MapHalf + 6);
            float len = MapHalf * 2 + 24;
            var w = P(world, PrimitiveType.Cube, zAxis ? new Vector3(0, 4, s) : new Vector3(s, 4, 0),
                zAxis ? new Vector3(len, 10, 2) : new Vector3(2, 10, len), TM(Textures.Concrete, len / 4f, 2.5f), null, true);
            w.name = "Wall";
        }
        // クレーター（爆撃跡）
        for (int i = 0; i < 34; i++)
        {
            float r = R(2.5f, 6f);
            var cr = P(world, PrimitiveType.Cylinder, new Vector3(R(-MapHalf + 8, MapHalf - 8), 0.012f + i * 0.0006f, R(-MapHalf + 8, MapHalf - 8)),
                new Vector3(r * 2, 0.01f, r * 2), TM(Textures.Crater, 1, 1, 0.02f), new Vector3(0, R(0, 360), 0));
        }

        // 拠点（A〜E）
        string[] names = { "ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO" };
        Vector3[] pp = { new Vector3(-48, 0, 8), new Vector3(46, 0, -6), new Vector3(0, 0, 0), new Vector3(-30, 0, -38), new Vector3(30, 0, 40) };
        var flagMat = new Material(Shader.Find("Standard") ?? Shader.Find("Unlit/Color")) { color = new Color(.8f, .8f, .8f) };
        flagMat.mainTexture = Textures.Cloth;
        for (int i = 0; i < 5; i++)
        {
            var cp = new CapturePoint { name = names[i], pos = pp[i] };
            P(world, PrimitiveType.Cylinder, pp[i] + Vector3.up * 3.2f, new Vector3(0.3f, 3.2f, 0.3f), TM(Textures.MetalDark, 1, 3));
            var fl = P(world, PrimitiveType.Cube, pp[i] + new Vector3(0.95f, 5f, 0), new Vector3(1.9f, 1.15f, 0.1f), null);
            var fm = new Material(flagMat); cp.flagRend = fl.GetComponent<Renderer>(); cp.flagRend.sharedMaterial = fm; cp.flag = fl.transform;
            P(world, PrimitiveType.Cylinder, pp[i] + Vector3.up * 0.03f, new Vector3(CapturePoint.Radius * 2, 0.02f, CapturePoint.Radius * 2), TM(Textures.Concrete, 4, 4, 0.03f, new Color(.8f, .78f, .7f)));
            points.Add(cp);
            // 拠点まわりの陣地（土のう壁・遮蔽物）
            for (int k = 0; k < 6; k++)
            {
                float a = k * 60f + R(0, 25f) + i * 13f;
                Vector3 off = Quaternion.Euler(0, a, 0) * Vector3.forward * R(5f, 8f);
                AddCover(pp[i] + off, k % 3 == 0 ? 2 : (k % 3 == 1 ? 1 : 0), a + 90f);
            }
        }
        // 散らした遮蔽物（拠点付近・スポーン地帯は避ける）
        for (int i = 0; i < 52; i++)
        {
            Vector3 p = new Vector3(R(-MapHalf + 6, MapHalf - 6), 0, R(-MapHalf + 6, MapHalf - 6));
            bool near = false; foreach (var cp in points) if ((cp.pos - p).magnitude < 13f) near = true;
            if (Mathf.Abs(p.z) > MapHalf - 18f) near = true;
            if (near) continue;
            int kind = Random.Range(0, 7);
            AddCover(p, kind, R(0, 180f));
        }

        // 兵士・車両
        player = SpawnSoldier(Team.Azure, true, "YOU");
        for (int t = 0; t < 2; t++)
            for (int i = 0; i < BotsPerSide; i++)
                if (!(t == 0 && i == BotsPerSide - 1)) SpawnSoldier((Team)t, false, ((Team)t).ToString().ToUpper()[0] + "-" + (i + 1));
        player.kills = 0; player.deaths = 0;
        SpawnAllVehicles();
        phase = Phase.Title; camOrbit = 0;
        ShowBanner("FRONTLINE ZERO", 2f);
    }

    // 遮蔽物: 0コンクリ壁 1土のう壁 2木箱 3焼けた残骸 4ドラム缶 5崩れた壁 6枯れ木
    void AddCover(Vector3 p, int kind, float yawDeg)
    {
        var root = new GameObject("cover").transform; root.SetParent(world);
        root.position = new Vector3(p.x, 0, p.z); root.rotation = Quaternion.Euler(0, yawDeg, 0);
        switch (kind)
        {
            case 0:
                {
                    float w = R(3f, 6f), h = R(1.4f, 2.6f), d = R(0.8f, 1.6f);
                    P(root, PrimitiveType.Cube, new Vector3(0, h / 2, 0), new Vector3(w, h, d), TM(Textures.Concrete, w / 3f, h / 3f), null, true);
                    break;
                }
            case 1:
                {
                    float w = R(3f, 5f), h = 1.25f, d = 0.95f;
                    P(root, PrimitiveType.Cube, new Vector3(0, h / 2, 0), new Vector3(w, h, d), TM(Textures.Sandbag, w / 1.5f, h / 0.9f, 0.02f), null, true);
                    break;
                }
            case 2:
                {
                    var cm = TM(Textures.Crate, 1, 1, 0.05f);
                    P(root, PrimitiveType.Cube, new Vector3(0, 0.8f, 0), new Vector3(1.6f, 1.6f, 1.6f), cm, new Vector3(0, R(-8, 8), 0), true);
                    if (Random.value < 0.8f) P(root, PrimitiveType.Cube, new Vector3(1.75f, 0.8f, 0.15f), new Vector3(1.6f, 1.6f, 1.6f), cm, new Vector3(0, R(-10, 10), 0), true);
                    if (Random.value < 0.6f) P(root, PrimitiveType.Cube, new Vector3(0.8f, 2.4f, 0.1f), new Vector3(1.6f, 1.6f, 1.6f), cm, new Vector3(0, R(-12, 12), 0), true);
                    break;
                }
            case 3:
                {
                    var rust = TM(Textures.MetalRust, 2, 1, 0.1f); var burnt = TM(Textures.Burnt, 1, 1, 0.05f);
                    P(root, PrimitiveType.Cube, new Vector3(0, 0.75f, 0), new Vector3(3.8f, 0.9f, 1.9f), rust, null, true);
                    P(root, PrimitiveType.Cube, new Vector3(-0.3f, 1.5f, 0), new Vector3(1.8f, 0.7f, 1.7f), burnt);
                    for (int wx = -1; wx <= 1; wx += 2) for (int wz = -1; wz <= 1; wz += 2)
                            P(root, PrimitiveType.Cylinder, new Vector3(wx * 1.3f, 0.4f, wz * 0.95f), new Vector3(0.8f, 0.12f, 0.8f), burnt, new Vector3(90, 0, 0));
                    if (Random.value < 0.75f)
                    {
                        Boom(root.position + Vector3.up * 2f, 1.3f, Smoke0, 3.2f, 1.8f, 2.2f, true).c1 = Smoke1;
                        var fl = Boom(root.position + Vector3.up * 1.4f, 0.9f, new Color(1f, 0.7f, 0.2f), 0.5f, 0.7f, 1.3f, true); fl.c1 = new Color(0.7f, 0.1f, 0.02f);
                    }
                    break;
                }
            case 4:
                {
                    var bm = TM(Textures.MetalRust, 1, 1, 0.2f, new Color(.95f, .5f, .38f));
                    for (int i = 0; i < 3; i++)
                        P(root, PrimitiveType.Cylinder, new Vector3(i * 1.0f - 1f, 0.55f, R(-0.4f, 0.4f)), new Vector3(0.9f, 0.55f, 0.9f), bm, null, true);
                    break;
                }
            case 5:
                {
                    float w = R(4f, 8f), h = R(3f, 5.5f);
                    P(root, PrimitiveType.Cube, new Vector3(0, h / 2, 0), new Vector3(w, h, 0.55f), TM(Textures.Concrete, w / 3f, h / 3f), null, true);
                    P(root, PrimitiveType.Cube, new Vector3(w * 0.28f, h * 0.3f, 0.4f), new Vector3(w * 0.4f, h * 0.6f, 0.5f), TM(Textures.Concrete, w / 5f, h / 5f), new Vector3(0, 0, R(-8, 8)), true);
                    break;
                }
            default:
                {
                    var bk = TM(Textures.Bark, 1, 2, 0.02f);
                    P(root, PrimitiveType.Cylinder, new Vector3(0, 3f, 0), new Vector3(0.5f, 3f, 0.5f), bk, null, true);
                    P(root, PrimitiveType.Cylinder, new Vector3(0.7f, 5.2f, 0), new Vector3(0.14f, 1.1f, 0.14f), bk, new Vector3(0, 0, 55));
                    P(root, PrimitiveType.Cylinder, new Vector3(-0.6f, 4.6f, 0.2f), new Vector3(0.12f, 1f, 0.12f), bk, new Vector3(20, 0, -50));
                    break;
                }
        }
    }

    Vector3 SpawnPos(Team t)
    {
        float z = (t == Team.Azure ? -1 : 1) * (MapHalf - 8f);
        return new Vector3(R(-18f, 18f), 1.1f, z + R(-3f, 3f));
    }

    Soldier SpawnSoldier(Team team, bool isPlayer, string label)
    {
        var go = new GameObject("S_" + label); go.transform.SetParent(world);
        var s = go.AddComponent<Soldier>(); s.team = team; s.isPlayer = isPlayer; s.label = label;
        s.cc = go.AddComponent<CharacterController>(); s.cc.height = 1.8f; s.cc.radius = 0.38f; s.cc.center = new Vector3(0, 0.9f, 0);
        s.cc.stepOffset = 0.35f; s.cc.skinWidth = 0.04f;
        bool az = team == Team.Azure;
        var camo = TM(az ? Textures.CamoAzure : Textures.CamoEmber, 1, 1, 0.04f);
        var dark = TM(Textures.MetalDark, 0.5f, 0.5f, 0.3f);
        var khaki = TM(Textures.Cloth, 1, 1, 0.02f, new Color(.55f, .5f, .38f));
        var vest = TM(Textures.Cloth, 1, 1, 0.02f, az ? new Color(.28f, .33f, .42f) : new Color(.48f, .4f, .28f));
        var skin = TM(Textures.Skin, 1, 1, 0.1f);
        var mark = az ? matAzure : matEmber;
        var vis = new GameObject("vis").transform; vis.SetParent(go.transform, false);
        // 脚（股関節から振る）
        for (int sd = -1; sd <= 1; sd += 2)
        {
            var piv = new GameObject("leg").transform; piv.SetParent(vis, false); piv.localPosition = new Vector3(sd * 0.13f, 0.88f, 0);
            P(piv, PrimitiveType.Cube, new Vector3(0, -0.43f, 0), new Vector3(0.2f, 0.86f, 0.24f), camo);
            P(piv, PrimitiveType.Cube, new Vector3(0, -0.84f, 0.04f), new Vector3(0.22f, 0.12f, 0.34f), dark);   // ブーツ
            if (sd < 0) s.legL = piv; else s.legR = piv;
        }
        P(vis, PrimitiveType.Cube, new Vector3(0, 1.2f, 0), new Vector3(0.5f, 0.6f, 0.28f), camo);              // 胴
        P(vis, PrimitiveType.Cube, new Vector3(0, 1.22f, 0.03f), new Vector3(0.53f, 0.42f, 0.32f), vest);       // 防弾ベスト
        P(vis, PrimitiveType.Cube, new Vector3(0, 1.26f, -0.26f), new Vector3(0.38f, 0.46f, 0.22f), khaki);     // 背嚢
        P(vis, PrimitiveType.Sphere, new Vector3(0, 1.66f, 0), new Vector3(0.27f, 0.3f, 0.3f), skin);           // 頭
        P(vis, PrimitiveType.Sphere, new Vector3(0, 1.73f, -0.01f), new Vector3(0.38f, 0.28f, 0.4f), camo);     // ヘルメット
        P(vis, PrimitiveType.Cube, new Vector3(0, 1.79f, 0), new Vector3(0.39f, 0.05f, 0.41f), mark);           // 識別バンド
        for (int sd = -1; sd <= 1; sd += 2)
        {
            P(vis, PrimitiveType.Cube, new Vector3(sd * 0.31f, 1.2f, 0.14f), new Vector3(0.12f, 0.12f, 0.5f), camo);
            P(vis, PrimitiveType.Cube, new Vector3(sd * 0.31f, 1.3f, 0.02f), new Vector3(0.15f, 0.09f, 0.15f), mark);
        }
        P(vis, PrimitiveType.Cube, new Vector3(0.1f, 1.16f, 0.5f), new Vector3(0.06f, 0.1f, 0.85f), dark);       // ライフル
        P(vis, PrimitiveType.Cube, new Vector3(0.1f, 1.04f, 0.4f), new Vector3(0.05f, 0.16f, 0.08f), dark);
        s.body = go.transform;
        s.eye = new GameObject("eye").transform; s.eye.SetParent(go.transform, false); s.eye.localPosition = new Vector3(0, 1.62f, 0);
        s.aimErr = R(0.8f, 1.5f);
        soldiers.Add(s);
        Respawn(s);
        return s;
    }

    void Respawn(Soldier s)
    {
        s.dead = false; s.hp = 100; s.ammo = 30; s.reloadUntil = 0; s.vel = Vector3.zero; s.target = null; s.vtarget = null;
        s.inVehicle = null;
        s.cc.enabled = false;
        s.transform.position = s.isPlayer ? new Vector3(-3f, 1.1f, -71f) : SpawnPos(s.team);
        s.cc.enabled = true;
        s.transform.rotation = Quaternion.Euler(0, s.team == Team.Azure ? 0 : 180, 0);
        if (s.isPlayer) { yaw = s.transform.eulerAngles.y; pitch = 0; }
        foreach (var r in s.GetComponentsInChildren<Renderer>()) r.enabled = !s.isPlayer;
        s.goal = null; s.rethink = 0;
    }

    // ================= 車両 =================
    void SpawnAllVehicles()
    {
        foreach (var v in vehicles) if (v != null) Destroy(v.gameObject);
        vehicles.Clear();
        SpawnVehicle(Team.Azure, new Vector3(-9f, 0.1f, -67f), 0f, float.MaxValue);   // プレイヤー用（基地で待つ）
        SpawnVehicle(Team.Azure, new Vector3(12f, 0.1f, -67f), 0f, 0f);
        SpawnVehicle(Team.Ember, new Vector3(-9f, 0.1f, 67f), 180f, 0f);
        SpawnVehicle(Team.Ember, new Vector3(12f, 0.1f, 67f), 180f, 0f);
    }

    Vehicle SpawnVehicle(Team team, Vector3 pos, float yawDeg, float holdUntil)
    {
        var go = new GameObject("Tank_" + team); go.transform.SetParent(world);
        go.transform.position = pos; go.transform.rotation = Quaternion.Euler(0, yawDeg, 0);
        var v = go.AddComponent<Vehicle>(); v.team = team; v.spawnPos = pos; v.spawnYaw = yawDeg; v.holdUntil = holdUntil;
        v.turretYaw = yawDeg;
        v.cc = go.AddComponent<CharacterController>(); v.cc.height = 2.2f; v.cc.radius = 1.7f; v.cc.center = new Vector3(0, 1.1f, 0);
        v.cc.stepOffset = 0.3f; v.cc.skinWidth = 0.05f;
        bool az = team == Team.Azure;
        var hull = TM(az ? Textures.MetalAzure : Textures.MetalEmber, 2, 1, 0.12f);
        var track = TM(Textures.MetalDark, 0.5f, 3, 0.05f);
        var dark = TM(Textures.MetalDark, 1, 1, 0.25f);
        var mark = az ? matAzure : matEmber;
        P(go.transform, PrimitiveType.Cube, new Vector3(0, 0.9f, 0), new Vector3(3.0f, 0.9f, 5.2f), hull);
        P(go.transform, PrimitiveType.Cube, new Vector3(0, 1.28f, 2.1f), new Vector3(2.9f, 0.3f, 1.7f), hull, new Vector3(-18, 0, 0));
        for (int sd = -1; sd <= 1; sd += 2)
        {
            P(go.transform, PrimitiveType.Cube, new Vector3(sd * 1.75f, 0.62f, 0), new Vector3(0.8f, 1.15f, 5.7f), track);
            P(go.transform, PrimitiveType.Cube, new Vector3(sd * 1.75f, 1.26f, 0), new Vector3(0.9f, 0.08f, 5.5f), hull);   // 泥よけ
            P(go.transform, PrimitiveType.Cube, new Vector3(sd * 1.53f, 1.0f, -0.4f), new Vector3(0.05f, 0.5f, 1.4f), mark); // 識別パネル
            for (int w = 0; w < 5; w++)
                P(go.transform, PrimitiveType.Cylinder, new Vector3(sd * 2.16f, 0.6f, -2.2f + w * 1.1f), new Vector3(0.7f, 0.06f, 0.7f), dark, new Vector3(0, 0, 90));
        }
        P(go.transform, PrimitiveType.Cube, new Vector3(0, 1.12f, -2.7f), new Vector3(2.6f, 0.5f, 0.3f), dark);      // 排気グリル
        var tur = new GameObject("turret").transform; tur.SetParent(go.transform, false); tur.localPosition = new Vector3(0, 1.45f, -0.25f);
        P(tur, PrimitiveType.Cylinder, new Vector3(0, 0, 0), new Vector3(2.3f, 0.18f, 2.3f), hull);
        P(tur, PrimitiveType.Cube, new Vector3(0, 0.38f, 0.15f), new Vector3(1.9f, 0.62f, 2.1f), hull);
        P(tur, PrimitiveType.Cube, new Vector3(0, 0.38f, 1.2f), new Vector3(1.2f, 0.5f, 0.3f), dark);                 // 砲盾
        P(tur, PrimitiveType.Cylinder, new Vector3(-0.5f, 0.78f, -0.3f), new Vector3(0.5f, 0.07f, 0.5f), dark);       // ハッチ
        P(tur, PrimitiveType.Cube, new Vector3(0.55f, 0.82f, -0.2f), new Vector3(0.08f, 0.08f, 0.8f), dark);          // 機銃
        P(tur, PrimitiveType.Cube, new Vector3(0, 0.38f, -0.95f), new Vector3(1.7f, 0.5f, 0.2f), mark);              // 識別マーク
        var bar = new GameObject("barrel").transform; bar.SetParent(tur, false); bar.localPosition = new Vector3(0, 0.38f, 1.35f);
        P(bar, PrimitiveType.Cylinder, new Vector3(0, 0, 1.4f), new Vector3(0.2f, 1.4f, 0.2f), dark, new Vector3(90, 0, 0));
        P(bar, PrimitiveType.Cylinder, new Vector3(0, 0, 2.7f), new Vector3(0.3f, 0.2f, 0.3f), dark, new Vector3(90, 0, 0));
        var mz = new GameObject("muzzle").transform; mz.SetParent(bar, false); mz.localPosition = new Vector3(0, 0, 3.05f);
        v.turret = tur; v.barrel = bar; v.muzzle = mz;
        vehicles.Add(v);
        return v;
    }

    Vehicle NearestEnterable(Vector3 p)
    {
        Vehicle best = null; float bd = EnterRange;
        foreach (var v in vehicles)
        {
            if (v.wreck || v.driver != null || v.team != Team.Azure) continue;
            float d = Vector3.Distance(v.transform.position, p);
            if (d < bd) { bd = d; best = v; }
        }
        return best;
    }

    void EnterVehicle(Vehicle v)
    {
        var p = player; v.driver = p; p.inVehicle = v; p.cc.enabled = false;
        yaw = v.transform.eulerAngles.y; pitch = 0; v.turretYaw = yaw; v.speed = 0;
        if (gunModel != null) gunModel.gameObject.SetActive(false);
        ShowBanner("TANK  -  Mouse/F: cannon   E: exit", 3f);
    }

    void ExitVehicle(Vehicle v)
    {
        var p = v.driver; if (p == null) return;
        v.driver = null; p.inVehicle = null; v.speed = 0;
        p.cc.enabled = false;
        p.transform.position = v.transform.position + v.transform.right * 3.4f + Vector3.up * 0.2f;
        p.cc.enabled = true;
        yaw = v.transform.eulerAngles.y; pitch = 0;
        if (gunModel != null && !p.dead) gunModel.gameObject.SetActive(true);
    }

    // ================= 音（手続き生成） =================
    AudioClip Synth(float dur, System.Func<float, float, float> f)
    {
        int n = (int)(44100 * dur); var d = new float[n];
        for (int i = 0; i < n; i++) { float t = i / 44100f; d[i] = Mathf.Clamp(f(t, dur), -1, 1); }
        var c = AudioClip.Create("s", n, 1, 44100, false); c.SetData(d, 0); return c;
    }
    void MakeAudio()
    {
        var rng = new System.Random(3);
        clipShot = Synth(0.16f, (t, d) => (float)(rng.NextDouble() * 2 - 1) * Mathf.Exp(-t * 28f) * 0.8f + Mathf.Sin(t * 150f * 6.28f) * Mathf.Exp(-t * 22f) * 0.5f);
        clipHit = Synth(0.08f, (t, d) => Mathf.Sin(t * 1500f * 6.28f) * Mathf.Exp(-t * 60f) * 0.6f);
        clipCap = Synth(0.5f, (t, d) => (Mathf.Sin(t * (t < 0.2f ? 520f : 780f) * 6.28f)) * Mathf.Exp(-t * 5f) * 0.5f);
        clipHurt = Synth(0.18f, (t, d) => Mathf.Sin(t * 90f * 6.28f) * Mathf.Exp(-t * 14f) * 0.8f);
        clipBoom = Synth(0.7f, (t, d) => (float)(rng.NextDouble() * 2 - 1) * Mathf.Exp(-t * 7f) * 0.9f + Mathf.Sin(t * 55f * 6.28f) * Mathf.Exp(-t * 5f) * 0.9f);
    }
    void Play(AudioClip c, float v = 0.6f) { if (sfx != null && c != null) sfx.PlayOneShot(c, v); }

    // ================= メインループ =================
    void Update()
    {
        float dt = Mathf.Min(Time.deltaTime, 0.05f);
        // 演出の目視確認用: URL に ?fxtest を付けたときだけ、X で目の前に爆発を出す
        if (Input.GetKeyDown(KeyCode.X) && Application.absoluteURL.Contains("fxtest"))
        {
            Vector3 fp = cam.transform.position + cam.transform.forward * 16f; fp.y = 0.2f;
            BigBoom(fp, 1.8f);
        }
        for (int pi = pending.Count - 1; pi >= 0; pi--)
            if (Time.time >= pending[pi].at) { var pd = pending[pi]; pending.RemoveAt(pi); BigBoom(pd.p, pd.k); Play(clipBoom, 0.7f); }
        if (phase == Phase.Title || phase == Phase.Over)
        {
            UpdateBots(dt, true);
            UpdateVehicles(dt);
            camOrbit += dt * 8f;
            cam.transform.position = new Vector3(Mathf.Sin(camOrbit * 0.02f) * 70f, 26f, Mathf.Cos(camOrbit * 0.02f) * 30f);
            cam.transform.LookAt(Vector3.zero);
            UpdatePoints(dt);
            if (phase == Phase.Title && (Input.GetMouseButtonDown(0) || Input.GetKeyDown(KeyCode.Return))) StartMatch();
            else if (phase == Phase.Over && (Input.GetKeyDown(KeyCode.R) || Input.GetMouseButtonDown(0))) { seed++; BuildWorld(); }
            return;
        }
        UpdatePlayer(dt);
        UpdateBots(dt, false);
        UpdateVehicles(dt);
        UpdatePoints(dt);
        recoil = Mathf.Lerp(recoil, 0, dt * 14f);
        if (gunModel != null) gunModel.localPosition = gunBase + new Vector3(0, 0, -recoil * 0.08f);
    }

    void LateUpdate()
    {
        if (shake > 0.002f)
        {
            cam.transform.position += Random.insideUnitSphere * shake;
            cam.transform.rotation *= Quaternion.Euler(0, 0, Random.Range(-1f, 1f) * shake * 3f);
        }
        shake = Mathf.MoveTowards(shake, 0f, Time.deltaTime * 1.6f);
        whiteFlash = Mathf.MoveTowards(whiteFlash, 0f, Time.deltaTime * 1.2f);
    }

    void StartMatch()
    {
        phase = Phase.Playing;
        tickets[0] = tickets[1] = StartTickets;
        foreach (var cp in points) { cp.control = 0; cp.owner = Team.None; cp.flagRend.sharedMaterial.color = new Color(.8f, .8f, .8f); }
        SpawnAllVehicles();
        vehicles[0].holdUntil = Time.time + 75f;   // プレイヤー用の戦車は、しばらく基地で待つ
        foreach (var s in soldiers) { s.kills = 0; s.deaths = 0; Respawn(s); }
        Cursor.lockState = CursorLockMode.Locked; Cursor.visible = false;
        if (gunModel == null)
        {
            var g = new GameObject("Gun").transform; g.SetParent(cam.transform, false);
            gunBase = new Vector3(0.17f, -0.17f, 0.4f); g.localPosition = gunBase;
            var dk = TM(Textures.MetalDark, 0.5f, 0.5f, 0.3f);
            P(g, PrimitiveType.Cube, Vector3.zero, new Vector3(0.04f, 0.055f, 0.38f), dk);
            P(g, PrimitiveType.Cube, new Vector3(0, -0.06f, -0.04f), new Vector3(0.03f, 0.08f, 0.05f), dk);
            P(g, PrimitiveType.Cube, new Vector3(0, 0.04f, -0.05f), new Vector3(0.02f, 0.03f, 0.2f), dk);
            gunModel = g;
        }
        gunModel.gameObject.SetActive(true);
        ShowBanner("DEPLOY  -  Capture the flags!   [E] board tank", 3.5f);
    }

    // ---------- プレイヤー（徒歩） ----------
    void UpdatePlayer(float dt)
    {
        var p = player;
        if (Cursor.lockState != CursorLockMode.Locked)
        {
            if (Input.GetMouseButtonDown(0)) { Cursor.lockState = CursorLockMode.Locked; Cursor.visible = false; }
        }
        else if (Input.GetKeyDown(KeyCode.Escape)) { Cursor.lockState = CursorLockMode.None; Cursor.visible = true; }

        if (Input.GetKeyDown(KeyCode.E) && !p.dead)
        {
            if (p.inVehicle != null) { ExitVehicle(p.inVehicle); return; }
            var nv = NearestEnterable(p.transform.position);
            if (nv != null) { EnterVehicle(nv); return; }
        }
        if (p.inVehicle != null) return;   // 操縦は UpdateVehicles 側

        if (p.dead)
        {
            if (gunModel != null) gunModel.gameObject.SetActive(false);
            cam.transform.position = Vector3.Lerp(cam.transform.position, p.transform.position + new Vector3(0, 4.5f, -4f), dt * 3f);
            cam.transform.rotation = Quaternion.Slerp(cam.transform.rotation, Quaternion.Euler(50, yaw, 0), dt * 3f);
            if (Time.time >= p.respawnAt) { Respawn(p); if (gunModel != null) gunModel.gameObject.SetActive(true); }
            return;
        }
        bool locked = Cursor.lockState == CursorLockMode.Locked;
        if (locked)
        {
            yaw += Input.GetAxis("Mouse X") * 2.2f; pitch -= Input.GetAxis("Mouse Y") * 2.2f;
            pitch = Mathf.Clamp(pitch, -85, 85);
        }
        p.transform.rotation = Quaternion.Euler(0, yaw, 0);
        cam.transform.position = p.eye.position; cam.transform.rotation = Quaternion.Euler(pitch, yaw, 0);

        Vector3 inp = new Vector3(Input.GetAxisRaw("Horizontal"), 0, Input.GetAxisRaw("Vertical"));
        if (inp.sqrMagnitude > 1) inp.Normalize();
        float sp = PlayerSpeed * (Input.GetKey(KeyCode.LeftShift) ? SprintMul : 1f);
        Vector3 move = p.transform.TransformDirection(inp) * sp;
        if (p.cc.isGrounded) { p.vel.y = -1f; if (Input.GetKeyDown(KeyCode.Space)) p.vel.y = JumpV; }
        else p.vel.y += Gravity * dt;
        p.cc.Move((move + new Vector3(0, p.vel.y, 0)) * dt);

        // 射撃
        if (Time.time < p.reloadUntil) { }
        else
        {
            if (p.reloadUntil > 0) { p.ammo = 30; p.reloadUntil = 0; }
            bool trig = (locked && Input.GetMouseButton(0)) || Input.GetKey(KeyCode.F);
            if ((Input.GetKeyDown(KeyCode.R) && p.ammo < 30) || p.ammo == 0) { p.reloadUntil = Time.time + 1.6f; }
            else if (trig && Time.time >= p.nextShot)
            {
                p.nextShot = Time.time + 0.095f; p.ammo--;
                recoil = 1f; pitch -= Random.Range(0.1f, 0.5f); yaw += Random.Range(-0.18f, 0.18f);
                float spread = Input.GetKey(KeyCode.LeftShift) ? 0.035f : 0.012f;
                Vector3 dir = cam.transform.forward + cam.transform.right * Random.Range(-spread, spread) + cam.transform.up * Random.Range(-spread, spread);
                Fire(p, cam.transform.position, dir.normalized, 16f);
            }
        }
    }

    // ---------- 射撃（hitscan） ----------
    void Fire(Soldier shooter, Vector3 origin, Vector3 dir, float dmg)
    {
        float range = 150f;
        Vector3 end = origin + dir * range;
        RaycastHit hit;
        if (Physics.Raycast(origin, dir, out hit, range, ~0, QueryTriggerInteraction.Ignore))
        {
            end = hit.point;
            var tgt = hit.collider.GetComponentInParent<Soldier>();
            if (tgt != null && tgt != shooter && !tgt.dead && tgt.team != shooter.team)
            {
                float m = hit.point.y > tgt.transform.position.y + 1.45f ? 2f : 1f;
                Damage(tgt, dmg * m, shooter);
                if (shooter.isPlayer) { hitMarkerUntil = Time.time + 0.12f; Play(clipHit, 0.5f); }
            }
            var tv = hit.collider.GetComponentInParent<Vehicle>();
            if (tv != null && !tv.wreck && tv.team != shooter.team)
            {
                DamageVehicle(tv, dmg * 0.4f, shooter.team, shooter);   // 小銃は装甲に効きにくい
                if (shooter.isPlayer) { hitMarkerUntil = Time.time + 0.12f; Play(clipHit, 0.4f); }
            }
        }
        Vector3 mo = shooter.isPlayer ? origin + cam.transform.right * 0.2f + Vector3.down * 0.2f + dir * 0.6f : origin;
        SpawnTracer(mo, end, 0.035f);
        if (hit.collider != null) Impact(hit.point, hit.normal);
        if (shooter.isPlayer || (Vector3.Distance(cam.transform.position, origin) < 45f && Random.value < 0.5f))
            Blob(mo + dir * 0.7f, shooter.isPlayer ? 0.18f : 0.28f, new Color(1f, 0.95f, 0.6f), new Color(1f, 0.5f, 0.1f), 0.06f, 1.5f, Vector3.zero, 0f);
        float dist = shooter.isPlayer ? 0 : Vector3.Distance(cam.transform.position, origin);
        if (dist < 70f) Play(clipShot, shooter.isPlayer ? 0.5f : Mathf.Clamp01(1f - dist / 70f) * 0.35f);
    }

    void SpawnTracer(Vector3 a, Vector3 b, float w)
    {
        var go = new GameObject("tr"); go.transform.SetParent(world);
        var lr = go.AddComponent<LineRenderer>(); lr.positionCount = 2; lr.SetPosition(0, a); lr.SetPosition(1, b);
        lr.startWidth = w; lr.endWidth = w * 0.6f; lr.sharedMaterial = matTracer; lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        Destroy(go, 0.06f);
    }

    // ================= 演出（爆発・煙・火花・破片・閃光・画面揺れ） =================
    readonly List<Transform> decals = new List<Transform>();
    struct Pending { public float at; public Vector3 p; public float k; }
    readonly List<Pending> pending = new List<Pending>();
    float shake, whiteFlash;
    static readonly Color Fire0 = new Color(1f, 0.8f, 0.28f), Fire1 = new Color(0.55f, 0.08f, 0.02f);
    static readonly Color Smoke0 = new Color(0.24f, 0.22f, 0.2f), Smoke1 = new Color(0.06f, 0.06f, 0.06f);

    Fx Boom(Vector3 p, float size, Color c, float life, float grow, float rise, bool loop, PrimitiveType shape = PrimitiveType.Sphere)
    {
        var g = GameObject.CreatePrimitive(shape);
        var col = g.GetComponent<Collider>(); if (col != null) DestroyImmediate(col);
        g.transform.SetParent(world); g.transform.position = p; g.transform.localScale = Vector3.one * size;
        var r = g.GetComponent<Renderer>(); r.sharedMaterial = FxMat(Color.white);
        r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; r.receiveShadows = false;
        var f = g.AddComponent<Fx>(); f.life = life; f.grow = grow; f.rise = rise; f.loop = loop; f.c0 = c; f.c1 = c;
        return f;
    }

    // 色が a→b に変わりながら膨らむ球
    Fx Blob(Vector3 p, float size, Color a, Color b, float life, float grow, Vector3 vel, float drag, float rise = 0f)
    {
        var f = Boom(p, size, a, life, grow, rise, false); f.c1 = b; f.vel = vel; f.drag = drag; return f;
    }

    // 飛び散って落ちる小片（破片・火花）
    Fx Chunk(Vector3 p, Vector3 size, Color a, Color b, Vector3 vel, float life, float gravity)
    {
        var g = GameObject.CreatePrimitive(PrimitiveType.Cube);
        var col = g.GetComponent<Collider>(); if (col != null) DestroyImmediate(col);
        g.transform.SetParent(world); g.transform.position = p; g.transform.localScale = size; g.transform.rotation = Random.rotation;
        var r = g.GetComponent<Renderer>(); r.sharedMaterial = FxMat(Color.white);
        r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off; r.receiveShadows = false;
        var f = g.AddComponent<Fx>(); f.life = life; f.grow = 0f; f.vel = vel; f.gravity = gravity; f.ground = true; f.groundY = size.y * 0.5f;
        f.spinSpeed = new Vector3(R(-600f, 600f), R(-600f, 600f), R(-600f, 600f)); f.c0 = a; f.c1 = b;
        return f;
    }

    void AddShake(Vector3 p, float amp)
    {
        float d = Vector3.Distance(cam.transform.position, p);
        float s = amp * Mathf.Clamp01(1f - d / 90f);
        if (s > shake) shake = s;
    }

    void Scorch(Vector3 p, float r)
    {
        var d = P(world, PrimitiveType.Cylinder, new Vector3(p.x, 0.02f + decals.Count * 0.0004f, p.z), new Vector3(r * 2f, 0.01f, r * 2f), TM(Textures.Crater, 1, 1, 0.02f), new Vector3(0, R(0, 360f), 0));
        decals.Add(d.transform);
        if (decals.Count > 40) { if (decals[0] != null) Destroy(decals[0].gameObject); decals.RemoveAt(0); }
    }

    void BigBoom(Vector3 p, float k)
    {
        float dist = Vector3.Distance(cam.transform.position, p);
        float q = dist < 90f ? 1f : 0.35f;
        // 火球: 白→黄→赤へ変わりながら膨らむ
        for (int i = 0; i < 7; i++)
        {
            var fb = Blob(p + Vector3.up * (0.9f + i * 0.35f) * k + Random.insideUnitSphere * 1.3f * k, R(1.6f, 3.4f) * k, Color.Lerp(new Color(1f, 0.92f, 0.45f), new Color(1f, 0.45f, 0.08f), Random.value), Color.Lerp(Fire1, new Color(0.25f, 0.06f, 0.03f), Random.value), R(0.5f, 0.9f), 2.0f, new Vector3(R(-2f, 2f), R(1f, 4f), R(-2f, 2f)), 0f, 1.5f);
            fb.delay = i < 3 ? 0f : R(0.05f, 0.3f);
        }
        Blob(p + Vector3.up * 1.0f * k, 1.4f * k, new Color(1f, 0.97f, 0.8f), new Color(1f, 0.55f, 0.1f), 0.2f, 2.4f, Vector3.zero, 0f);   // 白熱の芯
        // 衝撃波: 地面を走る平たいリング
        var ring = Boom(new Vector3(p.x, Mathf.Max(0.15f, p.y * 0.2f + 0.1f), p.z), 2.2f * k, new Color(0.62f, 0.52f, 0.38f), 0.5f, 7f, 0f, false);
        ring.flat = true; ring.c1 = new Color(0.36f, 0.3f, 0.21f); ring.transform.localScale = new Vector3(2.2f * k, 0.1f, 2.2f * k);
        // 黒煙の柱
        int ns = Mathf.RoundToInt(4 * q);
        for (int i = 0; i < ns; i++)
            Blob(p + Vector3.up * (0.9f + i * 0.6f) + Random.insideUnitSphere * 0.6f, R(2.4f, 3.6f) * k, Smoke0, Smoke1, R(2.2f, 3.4f), 1.8f,
                new Vector3(R(-1f, 1f), 0, R(-1f, 1f)), 0.5f, R(2.2f, 4.2f));
        // 破片（燃える欠片と黒い鉄片）
        int nd = Mathf.RoundToInt(14 * k * q);
        for (int i = 0; i < nd; i++)
        {
            Vector3 v = new Vector3(R(-1f, 1f), R(0.6f, 1.6f), R(-1f, 1f)).normalized * R(7f, 17f);
            Chunk(p, Vector3.one * R(0.18f, 0.5f), i % 3 == 0 ? new Color(1f, 0.55f, 0.15f) : new Color(0.14f, 0.12f, 0.1f), new Color(0.05f, 0.05f, 0.05f), v, R(1.6f, 3f), 24f);
        }
        // 火花
        int nsp = Mathf.RoundToInt(22 * q);
        for (int i = 0; i < nsp; i++)
        {
            Vector3 v = Random.onUnitSphere; v.y = Mathf.Abs(v.y) + 0.3f; v *= R(9f, 24f);
            Chunk(p, Vector3.one * R(0.07f, 0.13f), new Color(1f, 0.95f, 0.5f), new Color(1f, 0.35f, 0.05f), v, R(0.5f, 0.95f), 14f);
        }
        FxLight.Spawn(p + Vector3.up, new Color(1f, 0.65f, 0.25f), 30f * k, 7f, 0.4f, world);
        AddShake(p, 0.55f * k);
        if (dist < 14f) whiteFlash = Mathf.Max(whiteFlash, 0.35f * (1f - dist / 14f));
        if (p.y < 3f) Scorch(p, 2.8f * k);
    }

    void MuzzleFlash(Vehicle v)
    {
        Vector3 o = v.muzzle.position, f = v.muzzle.forward;
        Blob(o + f * 0.6f, 1.3f, Color.white, new Color(1f, 0.6f, 0.15f), 0.14f, 2.2f, f * 8f, 0f);
        Blob(o + f * 1.8f, 0.7f, Fire0, Fire1, 0.18f, 2f, f * 14f, 0f);
        for (int i = 0; i < 3; i++)
            Blob(o + f * (1f + i * 0.8f), 1.0f, new Color(0.6f, 0.6f, 0.58f), new Color(0.25f, 0.25f, 0.25f), 0.9f, 2.2f, f * (7f - i * 2f) + Vector3.up * 0.8f, 2f, 0.6f);
        FxLight.Spawn(o + f * 2f, new Color(1f, 0.8f, 0.4f), 22f, 5f, 0.15f, world);
        AddShake(o, v.driver != null && v.driver.isPlayer ? 0.45f : 0.2f);
        v.kick = 1f;
    }

    // 小銃弾の着弾（土ぼこり＋火花）。遠いものは出さない
    void Impact(Vector3 p, Vector3 n)
    {
        if (Vector3.Distance(cam.transform.position, p) > 45f || Random.value > 0.5f) return;
        Blob(p + n * 0.1f, 0.5f, new Color(0.55f, 0.48f, 0.38f), new Color(0.3f, 0.26f, 0.2f), 0.35f, 2.2f, n * 1.5f, 2f, 0.5f);
        for (int i = 0; i < 2; i++)
            Chunk(p + n * 0.1f, Vector3.one * 0.06f, new Color(1f, 0.9f, 0.4f), new Color(1f, 0.4f, 0.1f), (n + Random.insideUnitSphere * 0.8f) * R(3f, 7f), 0.4f, 12f);
    }

    // ---------- ダメージ ----------
    void Damage(Soldier t, float dmg, Soldier by)
    {
        if (t.dead || phase == Phase.Over) return;
        if (t.isPlayer && t.inVehicle != null) return;
        t.hp -= dmg;
        if (t.isPlayer) { damageFlashUntil = Time.time + 0.25f; Play(clipHurt, 0.6f); }
        if (t.hp > 0) return;
        t.dead = true; t.deaths++; t.respawnAt = Time.time + (t.isPlayer ? 4f : 5f);
        if (by != null) by.kills++;
        tickets[(int)t.team] = Mathf.Max(0, tickets[(int)t.team] - 1f);
        killFeed = (by != null ? by.label : "?") + "  >  " + t.label; killFeedUntil = Time.time + 2.5f;
        foreach (var r in t.GetComponentsInChildren<Renderer>()) r.enabled = false;
        t.cc.enabled = false;
        if (Vector3.Distance(cam.transform.position, t.transform.position) < 70f)
            Blob(t.transform.position + Vector3.up * 0.9f, 1.0f, new Color(0.55f, 0.5f, 0.42f), new Color(0.3f, 0.27f, 0.22f), 0.6f, 2f, Vector3.up * 1f, 1f, 0.5f);
        CheckEnd();
    }

    void DamageVehicle(Vehicle v, float dmg, Team attacker, Soldier by)
    {
        if (v.wreck || phase == Phase.Over) return;
        v.hp -= dmg;
        if (v.driver != null && v.driver.isPlayer) { damageFlashUntil = Time.time + 0.25f; Play(clipHurt, 0.6f); }
        if (v.hp > 0) return;
        v.wreck = true; v.respawnAt = Time.time + 30f;
        tickets[(int)v.team] = Mathf.Max(0, tickets[(int)v.team] - VehicleLossTickets);
        if (by != null) by.kills++;
        killFeed = (by != null ? by.label : "?") + "  >  TANK"; killFeedUntil = Time.time + 2.5f;
        var d = v.driver;
        if (d != null) ExitVehicle(v);
        Vector3 c = v.transform.position + Vector3.up * 1.2f;
        BigBoom(c, 2.6f); Play(clipBoom, 1f);
        pending.Add(new Pending { at = Time.time + 0.45f, p = c + new Vector3(R(-1.5f, 1.5f), 0.5f, R(-1.5f, 1.5f)), k = 1.6f });   // 誘爆
        pending.Add(new Pending { at = Time.time + 0.95f, p = c + new Vector3(R(-1.5f, 1.5f), 0.8f, R(-1.5f, 1.5f)), k = 1.1f });
        v.cc.enabled = false;
        var burnt = TM(Textures.Burnt, 2, 1, 0.05f);
        foreach (var r in v.GetComponentsInChildren<Renderer>()) r.sharedMaterial = burnt;
        // 砲塔が吹き飛ぶ
        var tur = v.turret; tur.SetParent(world, true);
        var tf = tur.gameObject.AddComponent<Fx>();
        tf.life = 3.2f; tf.grow = 0f; tf.shrinkEnd = false; tf.keep = true; tf.ground = true; tf.groundY = 1.0f; tf.gravity = 24f;
        tf.vel = new Vector3(R(-4f, 4f), R(13f, 18f), R(-4f, 4f)); tf.spinSpeed = new Vector3(R(-200f, 200f), R(-120f, 120f), R(-200f, 200f));
        Destroy(tur.gameObject, 28f);
        // 燃え続ける炎と黒煙
        Boom(c + Vector3.up * 1.5f, 1.8f, Smoke0, 3.4f, 1.8f, 2.4f, true).c1 = Smoke1;
        for (int i = 0; i < 2; i++)
        {
            var fl = Boom(c + new Vector3(R(-0.8f, 0.8f), 0.6f, R(-1.2f, 1.2f)), 1.1f, new Color(1f, 0.7f, 0.2f), 0.5f, 0.8f, 1.6f, true);
            fl.c1 = new Color(0.7f, 0.1f, 0.02f);
        }
        SplashDamage(c, 6f, 100f, Team.None, by);
        if (d != null) Damage(d, 999f, by);
        CheckEnd();
    }

    void SplashDamage(Vector3 p, float r, float dmg, Team attacker, Soldier by)
    {
        foreach (var s in soldiers.ToArray())
        {
            if (s.dead || s.team == attacker || (s.isPlayer && s.inVehicle != null)) continue;
            float d = Vector3.Distance(s.transform.position + Vector3.up, p);
            if (d >= r) continue;
            Damage(s, dmg * (1f - d / r), by);
            if (by != null && by.isPlayer) hitMarkerUntil = Time.time + 0.15f;
        }
        foreach (var v in vehicles.ToArray())
        {
            if (v.wreck || v.team == attacker) continue;
            float d = Vector3.Distance(v.transform.position + Vector3.up, p);
            if (d < r + 2.2f) DamageVehicle(v, dmg * 1.3f * (1f - d / (r + 2.2f)), attacker, by);
        }
    }

    // ---------- 主砲 ----------
    void Cannon(Vehicle v, Vector3 dir)
    {
        Vector3 o = v.muzzle.position;
        Vector3 end = o + dir * 220f;
        RaycastHit h;
        if (Physics.Raycast(o, dir, out h, 220f, ~0, QueryTriggerInteraction.Ignore)) end = h.point;
        SpawnTracer(o, end, 0.14f);
        MuzzleFlash(v);
        float len = Vector3.Distance(o, end);
        for (float sdist = 4f, n = 0; sdist < len && n < 18; sdist += 7f, n++)   // 砲弾の航跡
            Blob(o + dir * sdist, 0.35f, new Color(0.85f, 0.85f, 0.8f), new Color(0.5f, 0.5f, 0.5f), 0.5f, 1.4f, Vector3.zero, 0f);
        BigBoom(end, 1.0f);
        SplashDamage(end, CannonRadius, CannonDmg, v.team, v.driver);
        float dist = Vector3.Distance(cam.transform.position, o);
        Play(clipBoom, Mathf.Clamp01(1f - dist / 120f) * 0.8f);
    }

    // ---------- 車両の移動 ----------
    void MoveVehicle(Vehicle v, float dt)
    {
        if (v.cc.isGrounded) { if (v.yVel < 0) v.yVel = -1f; } else v.yVel += Gravity * dt;
        Vector3 before = v.transform.position;
        v.cc.Move((v.transform.forward * v.speed + new Vector3(0, v.yVel, 0)) * dt);
        Vector3 d = v.transform.position - before; d.y = 0;
        if (Mathf.Abs(v.speed) > 1f && d.magnitude / Mathf.Max(dt, 0.0001f) < Mathf.Abs(v.speed) * 0.4f) v.speed *= 0.7f;
    }

    void ApplyTurret(Vehicle v)
    {
        v.turret.rotation = Quaternion.Euler(0, v.turretYaw, 0);
        v.barrel.localRotation = Quaternion.Euler(v.turretPitch, 0, 0);
        v.kick = Mathf.MoveTowards(v.kick, 0f, Time.deltaTime * 3.5f);
        v.barrel.localPosition = new Vector3(0f, 0.38f, 1.35f - v.kick * 0.7f);
    }

    bool AimPoint(Vector3 o, Vector3 d, Vehicle ignore, out Vector3 point)
    {
        point = o + d * 220f; float best = 220f; bool any = false;
        foreach (var h in Physics.RaycastAll(o, d, 220f, ~0, QueryTriggerInteraction.Ignore))
        {
            if (h.collider.GetComponentInParent<Vehicle>() == ignore) continue;
            if (h.collider.GetComponentInParent<Soldier>() == player) continue;
            if (h.distance < best) { best = h.distance; point = h.point; any = true; }
        }
        return any;
    }

    void UpdateVehicles(float dt)
    {
        for (int i = vehicles.Count - 1; i >= 0; i--)
        {
            var v = vehicles[i];
            if (v.wreck)
            {
                if (Time.time >= v.respawnAt && phase != Phase.Over)
                {
                    var t = v.team; var sp = v.spawnPos; var sy = v.spawnYaw;
                    Destroy(v.gameObject); vehicles.RemoveAt(i); SpawnVehicle(t, sp, sy, 0f);
                }
                continue;
            }
            if (v.driver != null && phase == Phase.Playing) DriveHuman(v, dt);
            else if (v.driver != null) { v.speed = 0; MoveVehicle(v, dt); }
            else if (phase != Phase.Playing || Time.time >= v.holdUntil) DriveAI(v, dt);
            else { v.speed = 0; MoveVehicle(v, dt); }

            // 轢く
            if (Mathf.Abs(v.speed) > 3f)
                foreach (var s in soldiers)
                {
                    if (s.dead || s.team == v.team || (s.isPlayer && s.inVehicle != null)) continue;
                    Vector3 d = s.transform.position - v.transform.position; d.y = 0;
                    if (d.magnitude < 2.4f) Damage(s, 250f, v.driver);
                }
        }
    }

    void DriveHuman(Vehicle v, float dt)
    {
        bool locked = Cursor.lockState == CursorLockMode.Locked;
        if (locked)
        {
            yaw += Input.GetAxis("Mouse X") * 2.2f; pitch -= Input.GetAxis("Mouse Y") * 2.2f;
            pitch = Mathf.Clamp(pitch, -25, 30);
        }
        float thr = Input.GetAxisRaw("Vertical"), st = Input.GetAxisRaw("Horizontal");
        float target = thr > 0 ? 9f : thr < 0 ? -4.5f : 0f;
        v.speed = Mathf.MoveTowards(v.speed, target, (thr == 0 ? 14f : 10f) * dt);
        float turn = st * 65f * dt * Mathf.Clamp01(Mathf.Abs(v.speed) / 2.5f + 0.35f) * (v.speed >= -0.1f ? 1f : -1f);
        v.transform.Rotate(0, turn, 0);
        MoveVehicle(v, dt);
        v.turretYaw = Mathf.MoveTowardsAngle(v.turretYaw, yaw, 115f * dt);
        v.turretPitch = Mathf.MoveTowards(v.turretPitch, Mathf.Clamp(pitch, -10f, 8f), 60f * dt);
        ApplyTurret(v);

        // 三人称カメラ
        Quaternion cr = Quaternion.Euler(pitch, yaw, 0);
        Vector3 focus = v.transform.position + Vector3.up * 2.8f;
        Vector3 cp = focus - cr * Vector3.forward * 9f;
        RaycastHit ch;
        if (Physics.Linecast(focus, cp, out ch, ~0, QueryTriggerInteraction.Ignore) && ch.collider.GetComponentInParent<Vehicle>() != v)
            cp = ch.point + (focus - cp).normalized * 0.4f;
        cam.transform.position = cp; cam.transform.rotation = cr;
        player.transform.position = v.transform.position;

        bool trig = (locked && Input.GetMouseButton(0)) || Input.GetKey(KeyCode.F);
        if (trig && Time.time >= v.reloadAt)
        {
            v.reloadAt = Time.time + CannonReloadPlayer;
            Vector3 ap; AimPoint(cp, cr * Vector3.forward, v, out ap);
            Vector3 toAim = (ap - v.muzzle.position).normalized;
            Vector3 dir = Vector3.Angle(toAim, v.muzzle.forward) < 12f ? toAim : v.muzzle.forward;
            Cannon(v, dir);
        }
    }

    void DriveAI(Vehicle v, float dt)
    {
        v.rethink -= dt;
        if (v.goal == null || v.rethink <= 0)
        {
            v.rethink = R(10f, 18f);
            CapturePoint best = null; float bs = -1e9f;
            foreach (var cp in points)
            {
                float sc = -Vector3.Distance(cp.pos, v.transform.position) * 0.35f + R(0, 25f);
                if (cp.owner == v.team) sc -= 30f;
                if (cp.owner != v.team && cp.owner != Team.None) sc += 10f;
                if (sc > bs) { bs = sc; best = cp; }
            }
            v.goal = best;
        }
        v.scan -= dt;
        if (v.scan <= 0)
        {
            v.scan = 0.5f; v.tSoldier = null; v.tVehicle = null;
            float bd = 90f; RaycastHit h;
            foreach (var e in vehicles)
            {
                if (e.wreck || e.team == v.team) continue;
                float d = Vector3.Distance(e.transform.position, v.transform.position);
                if (d >= bd) continue;
                if (Physics.Linecast(v.muzzle.position, e.transform.position + Vector3.up * 1.3f, out h, ~0, QueryTriggerInteraction.Ignore) && h.collider.GetComponentInParent<Vehicle>() != e) continue;
                bd = d; v.tVehicle = e;
            }
            if (v.tVehicle == null)
            {
                bd = 70f;
                foreach (var e in soldiers)
                {
                    if (e.dead || e.team == v.team || (e.isPlayer && e.inVehicle != null)) continue;
                    float d = Vector3.Distance(e.transform.position, v.transform.position);
                    if (d >= bd) continue;
                    if (Physics.Linecast(v.muzzle.position, e.transform.position + Vector3.up, out h, ~0, QueryTriggerInteraction.Ignore) && h.collider.GetComponentInParent<Soldier>() != e) continue;
                    bd = d; v.tSoldier = e;
                }
            }
        }
        bool has = false; Vector3 tp = Vector3.zero;
        if (v.tVehicle != null && !v.tVehicle.wreck) { tp = v.tVehicle.transform.position + Vector3.up * 1.3f; has = true; }
        else if (v.tSoldier != null && !v.tSoldier.dead) { tp = v.tSoldier.transform.position + Vector3.up; has = true; }
        Vector3 to = tp - v.muzzle.position;
        float desired = has ? Mathf.Atan2(to.x, to.z) * Mathf.Rad2Deg : v.transform.eulerAngles.y;
        v.turretYaw = Mathf.MoveTowardsAngle(v.turretYaw, desired, 70f * dt);
        float horiz = new Vector2(to.x, to.z).magnitude;
        float wantP = has ? Mathf.Clamp(-Mathf.Atan2(to.y, Mathf.Max(horiz, 1f)) * Mathf.Rad2Deg, -10f, 8f) : 0f;
        v.turretPitch = Mathf.MoveTowards(v.turretPitch, wantP, 40f * dt);
        ApplyTurret(v);
        if (has && Mathf.Abs(Mathf.DeltaAngle(v.turretYaw, desired)) < 5f && Time.time >= v.reloadAt && to.magnitude < 88f)
        {
            Vector3 dir = to.normalized + new Vector3(R(-0.025f, 0.025f), R(-0.02f, 0.02f), R(-0.025f, 0.025f));
            Cannon(v, dir.normalized);
            v.reloadAt = Time.time + R(3.0f, 4.2f);
        }

        Vector3 toGoal = v.goal.pos - v.transform.position; toGoal.y = 0;
        bool atGoal = toGoal.magnitude < 7f;
        if (Time.time < v.reverseUntil)
        {
            v.speed = Mathf.MoveTowards(v.speed, -4f, 12f * dt);
            v.transform.Rotate(0, v.strafeDir * 40f * dt, 0);
        }
        else if (atGoal) v.speed = Mathf.MoveTowards(v.speed, 0f, 10f * dt);
        else
        {
            float want = Mathf.Atan2(toGoal.x, toGoal.z) * Mathf.Rad2Deg;
            float diff = Mathf.DeltaAngle(v.transform.eulerAngles.y, want);
            v.transform.Rotate(0, Mathf.Clamp(diff, -45f * dt, 45f * dt), 0);
            float tgt = Mathf.Abs(diff) < 35f ? (has ? 4.5f : 6.5f) : 1f;
            v.speed = Mathf.MoveTowards(v.speed, tgt, 6f * dt);
        }
        MoveVehicle(v, dt);
        v.stuckT += dt;
        if (v.stuckT > 1.6f)
        {
            if (!atGoal && Time.time >= v.reverseUntil && (v.transform.position - v.lastPos).magnitude < 1.2f)
            { v.reverseUntil = Time.time + 1.4f; v.strafeDir = Random.value < 0.5f ? -1f : 1f; }
            v.lastPos = v.transform.position; v.stuckT = 0;
        }
    }

    // ---------- Bot ----------
    void UpdateBots(float dt, bool spectate)
    {
        foreach (var s in soldiers)
        {
            if (s.isPlayer && !spectate) continue;
            if (s.dead)
            {
                if (Time.time >= s.respawnAt && phase != Phase.Over) Respawn(s);
                continue;
            }
            // 目標拠点
            s.rethink -= dt;
            if (s.goal == null || s.rethink <= 0)
            {
                s.rethink = Random.Range(8f, 16f);
                CapturePoint best = null; float bs = -1e9f;
                foreach (var cp in points)
                {
                    float sc = -Vector3.Distance(cp.pos, s.transform.position) * 0.5f + Random.Range(0, 28f);
                    if (cp.owner == s.team) sc -= 35f;
                    if (cp.owner == OtherTeam(s.team)) sc += 10f;
                    if (sc > bs) { bs = sc; best = cp; }
                }
                s.goal = best;
            }
            // 敵探索（兵士→車両）
            s.scan -= dt;
            if (s.scan <= 0)
            {
                s.scan = Random.Range(0.2f, 0.4f);
                if (s.target != null && (s.target.dead || (s.target.transform.position - s.transform.position).sqrMagnitude > 55f * 55f)) s.target = null;
                if (s.vtarget != null && (s.vtarget.wreck || (s.vtarget.transform.position - s.transform.position).sqrMagnitude > 60f * 60f)) s.vtarget = null;
                RaycastHit h;
                if (s.target == null)
                {
                    float bd = 50f;
                    foreach (var e in soldiers)
                    {
                        if (e.dead || e.team == s.team || (e.isPlayer && e.inVehicle != null)) continue;
                        float d = Vector3.Distance(e.transform.position, s.transform.position);
                        if (d >= bd) continue;
                        Vector3 from = s.eye.position, to = e.transform.position + Vector3.up * 1.2f;
                        if (Physics.Linecast(from, to, out h, ~0, QueryTriggerInteraction.Ignore) && h.collider.GetComponentInParent<Soldier>() != e) continue;
                        bd = d; s.target = e;
                    }
                }
                if (s.target == null && s.vtarget == null)
                {
                    float bv = 55f;
                    foreach (var e in vehicles)
                    {
                        if (e.wreck || e.team == s.team) continue;
                        float d = Vector3.Distance(e.transform.position, s.transform.position);
                        if (d >= bv) continue;
                        if (Physics.Linecast(s.eye.position, e.transform.position + Vector3.up * 1.3f, out h, ~0, QueryTriggerInteraction.Ignore) && h.collider.GetComponentInParent<Vehicle>() != e) continue;
                        bv = d; s.vtarget = e;
                    }
                }
            }
            Vector3 mv = Vector3.zero;
            Vector3 toGoal = s.goal.pos - s.transform.position; toGoal.y = 0;
            bool atGoal = toGoal.magnitude < 5.5f;
            bool has = false; Vector3 tpos = Vector3.zero;
            if (s.target != null) { tpos = s.target.transform.position + Vector3.up * (1.0f + Random.Range(0, 0.4f)); has = true; }
            else if (s.vtarget != null) { tpos = s.vtarget.transform.position + Vector3.up * 1.3f; has = true; }
            if (has)
            {
                Vector3 aim = tpos - s.eye.position;
                Vector3 flat = new Vector3(aim.x, 0, aim.z);
                if (flat.sqrMagnitude > 0.01f) s.lookDir = Vector3.Slerp(s.lookDir, flat.normalized, dt * 7f);
                float dist = aim.magnitude;
                if (Time.time > s.strafeUntil) { s.strafeDir = Random.value < 0.5f ? -1f : 1f; s.strafeUntil = Time.time + Random.Range(0.6f, 1.6f); }
                Vector3 right = Vector3.Cross(Vector3.up, flat.normalized);
                mv = right * s.strafeDir * 0.6f;
                if (dist > 28f) mv += flat.normalized * 0.6f; else if (dist < 12f) mv -= flat.normalized * 0.5f;
                if (Time.time >= s.nextShot)
                {
                    if (Time.time < s.reloadUntil) { }
                    else
                    {
                        if (s.reloadUntil > 0) { s.ammo = 30; s.reloadUntil = 0; }
                        if (s.ammo <= 0) s.reloadUntil = Time.time + 2f;
                        else
                        {
                            s.nextShot = Time.time + Random.Range(0.13f, 0.3f); s.ammo--;
                            float err = (0.025f + dist * 0.0016f) * s.aimErr;
                            Vector3 d = aim.normalized + new Vector3(Random.Range(-err, err), Random.Range(-err, err), Random.Range(-err, err));
                            Fire(s, s.eye.position, d.normalized, 8.5f);
                        }
                    }
                }
            }
            else
            {
                if (toGoal.sqrMagnitude > 0.01f)
                {
                    Vector3 dir = toGoal.normalized;
                    s.lookDir = Vector3.Slerp(s.lookDir, dir, dt * 5f);
                    if (!atGoal) mv = dir;
                    else
                    {
                        if (Time.time > s.strafeUntil) { s.strafeDir = Random.Range(-1f, 1f); s.strafeUntil = Time.time + Random.Range(1f, 3f); }
                        mv = Vector3.Cross(Vector3.up, dir) * s.strafeDir * 0.4f;
                    }
                }
            }
            // 障害物回避（前方1.8m）
            if (mv.sqrMagnitude > 0.01f)
            {
                Vector3 f = mv.normalized;
                if (Physics.Raycast(s.transform.position + Vector3.up * 0.5f, f, out var oh, 1.8f, ~0, QueryTriggerInteraction.Ignore) && oh.collider.GetComponentInParent<Soldier>() == null)
                {
                    Vector3 side = Vector3.Cross(Vector3.up, f) * (s.strafeDir >= 0 ? 1f : -1f);
                    mv = side * 1.0f + f * 0.1f;
                }
            }
            // スタック脱出
            s.stuckT += dt;
            if (s.stuckT > 1.2f)
            {
                if ((s.transform.position - s.lastPos).magnitude < 0.8f && mv.sqrMagnitude > 0.01f) { s.strafeDir = -s.strafeDir; s.strafeUntil = Time.time + 1.2f; if (s.cc.isGrounded) s.vel.y = 6.5f; }
                s.lastPos = s.transform.position; s.stuckT = 0;
            }
            if (s.cc.isGrounded) { if (s.vel.y < 0) s.vel.y = -1f; } else s.vel.y += Gravity * dt;
            s.cc.Move((mv.normalized * Mathf.Min(1f, mv.magnitude) * BotSpeed + new Vector3(0, s.vel.y, 0)) * dt);
            if (s.lookDir.sqrMagnitude > 0.01f) s.transform.rotation = Quaternion.LookRotation(s.lookDir, Vector3.up);
            // 歩行アニメ
            float spd = s.cc.velocity.magnitude;
            s.walkT += dt * spd * 1.7f;
            float sw = Mathf.Sin(s.walkT) * 38f * Mathf.Clamp01(spd / 3f);
            if (s.legL != null) s.legL.localRotation = Quaternion.Euler(sw, 0, 0);
            if (s.legR != null) s.legR.localRotation = Quaternion.Euler(-sw, 0, 0);
        }
    }

    static Team OtherTeam(Team t) { return t == Team.Azure ? Team.Ember : Team.Azure; }

    // ---------- 拠点占領とチケット ----------
    void UpdatePoints(float dt)
    {
        int[] own = new int[2];
        foreach (var cp in points)
        {
            int a = 0, e = 0;
            foreach (var s in soldiers)
            {
                if (s.dead) continue;
                Vector3 d = s.transform.position - cp.pos; d.y = 0;
                if (d.magnitude > CapturePoint.Radius) continue;
                if (s.team == Team.Azure) a++; else e++;
            }
            foreach (var v in vehicles)
            {
                if (v.wreck || v.driver != null) continue;   // 搭乗中はプレイヤー自身が数えられている
                Vector3 d = v.transform.position - cp.pos; d.y = 0;
                if (d.magnitude > CapturePoint.Radius) continue;
                if (v.team == Team.Azure) a += 2; else e += 2;
            }
            float delta = (a - e);
            if (a > 0 && e > 0) delta = 0; // 競り合い中は止まる
            else delta = Mathf.Sign(delta) * Mathf.Min(Mathf.Abs(delta), 3f);
            cp.control = Mathf.Clamp(cp.control + delta * 0.045f * dt * 10f * 0.5f, -1f, 1f);
            Team no = cp.control >= 0.999f ? Team.Azure : cp.control <= -0.999f ? Team.Ember : cp.owner;
            if (cp.control > -0.2f && cp.control < 0.2f && cp.owner != Team.None && Mathf.Abs(cp.control) < 0.2f) no = Team.None;
            if (no != cp.owner)
            {
                cp.owner = no;
                cp.flagRend.sharedMaterial.color = no == Team.Azure ? new Color(.35f, .6f, 1f) : no == Team.Ember ? new Color(1f, .52f, .22f) : new Color(.8f, .8f, .8f);
                if (phase == Phase.Playing && no != Team.None) { ShowBanner(cp.name + " captured by " + no.ToString().ToUpper(), 2.2f); Play(clipCap, 0.5f); }
            }
            // 旗の高さで進行を見せる
            cp.flag.position = cp.pos + new Vector3(0.95f, 3.2f + (cp.control * 0.5f + 0.5f) * 2.4f, 0);
            if (cp.owner == Team.Azure) own[0]++; else if (cp.owner == Team.Ember) own[1]++;
        }
        if (phase != Phase.Playing) return;
        int diff = own[0] - own[1];
        if (diff != 0)
        {
            bleedAcc += Mathf.Abs(diff) * dt * 0.16f;
            if (bleedAcc >= 1f)
            {
                bleedAcc -= 1f;
                int lose = diff > 0 ? 1 : 0;
                tickets[lose] = Mathf.Max(0, tickets[lose] - 1f);
                CheckEnd();
            }
        }
    }

    void CheckEnd()
    {
        if (phase != Phase.Playing) return;
        if (tickets[0] <= 0 || tickets[1] <= 0)
        {
            phase = Phase.Over;
            Cursor.lockState = CursorLockMode.None; Cursor.visible = true;
            banner = tickets[1] <= 0 ? "VICTORY" : "DEFEAT"; bannerUntil = float.MaxValue;
            if (gunModel != null) gunModel.gameObject.SetActive(false);
        }
    }

    void ShowBanner(string s, float sec) { banner = s; bannerUntil = Time.time + sec; }

    // ================= HUD =================
    void InitStyles()
    {
        if (sBig != null) return;
        sBig = new GUIStyle(GUI.skin.label) { wordWrap = false, fontSize = 46, alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
        sMid = new GUIStyle(GUI.skin.label) { wordWrap = false, fontSize = 24, alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold };
        sSmall = new GUIStyle(GUI.skin.label) { wordWrap = false, fontSize = 16, alignment = TextAnchor.MiddleLeft };
    }
    void Box(Rect r, Color c) { var o = GUI.color; GUI.color = c; GUI.DrawTexture(r, Texture2D.whiteTexture); GUI.color = o; }
    void Text(Rect r, string t, GUIStyle st, Color c)
    {
        var o = GUI.color; GUI.color = new Color(0, 0, 0, 0.6f * c.a); GUI.Label(new Rect(r.x + 2, r.y + 2, r.width, r.height), t, st);
        GUI.color = c; GUI.Label(r, t, st); GUI.color = o;
    }

    void OnGUI()
    {
        InitStyles();
        float W = Screen.width, H = Screen.height; float k = Mathf.Clamp(H / 720f, 0.7f, 1.6f);
        sBig.fontSize = (int)(46 * k); sMid.fontSize = (int)(24 * k); sSmall.fontSize = (int)(16 * k);
        var azure = new Color(0.35f, 0.65f, 1f); var ember = new Color(1f, 0.55f, 0.25f);
        if (whiteFlash > 0.01f) Box(new Rect(0, 0, W, H), new Color(1f, 0.95f, 0.85f, whiteFlash));

        Box(new Rect(W / 2 - 210 * k, 10, 420 * k, 44 * k), new Color(0, 0, 0, 0.45f));
        Text(new Rect(W / 2 - 200 * k, 10, 190 * k, 44 * k), "AZURE  " + Mathf.CeilToInt(tickets[0]), sMid, azure);
        Text(new Rect(W / 2 + 10 * k, 10, 190 * k, 44 * k), Mathf.CeilToInt(tickets[1]) + "  EMBER", sMid, ember);
        for (int i = 0; i < points.Count; i++)
        {
            var cp = points[i]; float x = W / 2 - 100 * k + i * 42 * k, y = 58 * k;
            Box(new Rect(x, y, 36 * k, 26 * k), new Color(0, 0, 0, 0.45f));
            Color c = cp.control > 0 ? Color.Lerp(Color.white, azure, cp.control) : Color.Lerp(Color.white, ember, -cp.control);
            Box(new Rect(x + 3, y + 3, 30 * k * (0.15f + 0.85f * Mathf.Abs(cp.control)), 20 * k), c);
            Text(new Rect(x, y, 36 * k, 26 * k), cp.name.Substring(0, 1), new GUIStyle(sSmall) { alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold }, Color.black);
        }
        float ms = 150 * k; Rect mr = new Rect(W - ms - 14, 14, ms, ms);
        Box(mr, new Color(0, 0, 0, 0.5f));
        foreach (var cp in points)
        {
            Vector2 mp = Map2(cp.pos, mr);
            Box(new Rect(mp.x - 5, mp.y - 5, 10, 10), cp.owner == Team.Azure ? azure : cp.owner == Team.Ember ? ember : Color.gray);
        }
        foreach (var s in soldiers)
        {
            if (s.dead) continue;
            Vector2 mp = Map2(s.transform.position, mr);
            Box(new Rect(mp.x - 2, mp.y - 2, s.isPlayer ? 6 : 4, s.isPlayer ? 6 : 4), s.isPlayer ? Color.white : (s.team == Team.Azure ? azure : ember));
        }
        foreach (var v in vehicles)
        {
            if (v.wreck) continue;
            Vector2 mp = Map2(v.transform.position, mr);
            Box(new Rect(mp.x - 4, mp.y - 4, 8, 8), Color.white);
            Box(new Rect(mp.x - 3, mp.y - 3, 6, 6), v.team == Team.Azure ? azure : ember);
        }

        if (phase == Phase.Playing)
        {
            float cx = W / 2, cy = H / 2;
            Color cc = Time.time < hitMarkerUntil ? Color.red : new Color(1, 1, 1, 0.85f);
            Box(new Rect(cx - 1, cy - 9, 2, 6), cc); Box(new Rect(cx - 1, cy + 3, 2, 6), cc);
            Box(new Rect(cx - 9, cy - 1, 6, 2), cc); Box(new Rect(cx + 3, cy - 1, 6, 2), cc);
            var iv = player.inVehicle;
            float hpv = iv != null ? iv.hp / Vehicle.MaxHp : player.hp / 100f;
            Box(new Rect(20, H - 56 * k, 260 * k, 20 * k), new Color(0, 0, 0, 0.5f));
            Box(new Rect(22, H - 54 * k, 256 * k * Mathf.Clamp01(hpv), 16 * k), Color.Lerp(Color.red, new Color(0.4f, 1f, 0.5f), hpv));
            if (iv != null)
            {
                float rl = Mathf.Clamp01(1f - (iv.reloadAt - Time.time) / CannonReloadPlayer);
                Box(new Rect(W - 260 * k, H - 50 * k, 240 * k, 14 * k), new Color(0, 0, 0, 0.5f));
                Box(new Rect(W - 258 * k, H - 48 * k, 236 * k * rl, 10 * k), rl >= 1f ? new Color(1f, .85f, .3f) : new Color(.7f, .7f, .7f));
                Text(new Rect(W - 260 * k, H - 80 * k, 240 * k, 30 * k), rl >= 1f ? "CANNON READY" : "RELOADING", new GUIStyle(sMid) { alignment = TextAnchor.MiddleRight }, Color.white);
                Text(new Rect(20, H - 100 * k, 400 * k, 30 * k), "TANK   [E] exit", sSmall, Color.white);
            }
            else
            {
                string am = Time.time < player.reloadUntil ? "RELOADING..." : player.ammo + " / 30";
                Text(new Rect(W - 260 * k, H - 70 * k, 240 * k, 50 * k), am, new GUIStyle(sMid) { alignment = TextAnchor.MiddleRight }, Color.white);
                Text(new Rect(20, H - 100 * k, 300 * k, 30 * k), "K " + player.kills + "   D " + player.deaths, sSmall, Color.white);
                if (!player.dead && NearestEnterable(player.transform.position) != null)
                    Text(new Rect(0, H * 0.62f, W, 40 * k), "[E] Board tank", sMid, new Color(1f, 0.9f, 0.4f));
            }
            if (Time.time < damageFlashUntil) Box(new Rect(0, 0, W, H), new Color(1, 0, 0, 0.25f * (damageFlashUntil - Time.time) / 0.25f));
            if (player.dead) { Text(new Rect(0, H * 0.4f, W, 80), "YOU WERE DOWN - respawning...", sMid, Color.white); }
            if (Cursor.lockState != CursorLockMode.Locked) Text(new Rect(0, H * 0.55f, W, 40), "Click to resume", sMid, Color.white);
            if (Time.time < killFeedUntil) Text(new Rect(W - 320 * k, 14 + ms + 14, 306 * k, 28 * k), killFeed, new GUIStyle(sSmall) { alignment = TextAnchor.MiddleRight }, Color.white);
        }
        if (Time.time < bannerUntil && banner.Length > 0)
            Text(new Rect(0, H * 0.18f, W, 70 * k), banner, phase == Phase.Over ? sBig : sMid, phase == Phase.Over ? (banner == "VICTORY" ? new Color(0.5f, 1f, 0.6f) : new Color(1f, 0.5f, 0.45f)) : Color.white);

        if (phase == Phase.Title)
        {
            Text(new Rect(0, H * 0.34f, W, 90 * k), "FRONTLINE ZERO", sBig, Color.white);
            Text(new Rect(0, H * 0.34f + 70 * k, W, 40 * k), "5 flags / 9 vs 9 / tanks", sMid, new Color(1, 1, 1, 0.8f));
            if (Mathf.Sin(Time.time * 4f) > -0.3f) Text(new Rect(0, H * 0.62f, W, 40 * k), "CLICK or ENTER to deploy", sMid, new Color(1f, 0.9f, 0.4f));
            Text(new Rect(0, H * 0.72f, W, 80), "WASD move  Shift sprint  Space jump  Mouse aim/fire (F too)  R reload  E board/exit tank", new GUIStyle(sSmall) { alignment = TextAnchor.MiddleCenter }, new Color(1, 1, 1, 0.85f));
        }
        if (phase == Phase.Over)
            Text(new Rect(0, H * 0.4f, W, 40 * k), "Kills " + player.kills + "  Deaths " + player.deaths + "      Click or R to play again", sMid, Color.white);
    }

    Vector2 Map2(Vector3 w, Rect r)
    {
        float x = (w.x / (MapHalf * 2) + 0.5f) * r.width, y = (0.5f - w.z / (MapHalf * 2)) * r.height;
        return new Vector2(r.x + x, r.y + y);
    }
}
