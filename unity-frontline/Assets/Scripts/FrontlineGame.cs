// FRONTLINE ZERO — オリジナルの陣取り型チームFPS。外部アセット無し（形・音・HUDすべてコード生成）。
// 2チーム(AZURE / EMBER)が5つの拠点を奪い合い、チケット(持ち点)を先に0にした側が負け。
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
    const float StartTickets = 120f;
    const float PlayerSpeed = 7f, SprintMul = 1.55f, JumpV = 7.5f, Gravity = -22f;
    const float BotSpeed = 5.6f;
    const float MapHalf = 80f;

    public static FrontlineGame I;
    Phase phase = Phase.Title;
    readonly List<Soldier> soldiers = new List<Soldier>();
    readonly List<CapturePoint> points = new List<CapturePoint>();
    readonly List<Transform> tracers = new List<Transform>();
    readonly float[] tickets = new float[2];
    Soldier player;
    Camera cam;
    Transform world;
    Material matGround, matRock, matAzure, matEmber, matNeutral, matGun, matTracer;
    float yaw, pitch;
    float camOrbit;
    string banner = ""; float bannerUntil;
    string killFeed = ""; float killFeedUntil;
    float hitMarkerUntil; float damageFlashUntil;
    float bleedAcc;
    AudioSource sfx; AudioClip clipShot, clipHit, clipCap, clipHurt;
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
        MakeAudio();
        BuildWorld();
    }

    Material Mat(Color c, float smooth = 0.1f)
    {
        var sh = Shader.Find("Standard");
        if (sh == null) sh = Shader.Find("Unlit/Color");
        var m = new Material(sh); m.color = c;
        if (m.HasProperty("_Glossiness")) m.SetFloat("_Glossiness", smooth);
        return m;
    }

    void BuildWorld()
    {
        if (world != null) Destroy(world.gameObject);
        soldiers.Clear(); points.Clear(); tracers.Clear();
        world = new GameObject("World").transform;
        tickets[0] = tickets[1] = StartTickets;
        Random.InitState(seed);

        matGround = Mat(new Color(0.30f, 0.36f, 0.27f));
        matRock = Mat(new Color(0.42f, 0.42f, 0.44f));
        matAzure = Mat(new Color(0.20f, 0.52f, 0.95f));
        matEmber = Mat(new Color(0.95f, 0.45f, 0.15f));
        matNeutral = Mat(new Color(0.8f, 0.8f, 0.8f));
        matGun = Mat(new Color(0.12f, 0.12f, 0.13f), 0.4f);
        var tsh = Shader.Find("Sprites/Default"); if (tsh == null) tsh = Shader.Find("Unlit/Color");
        matTracer = new Material(tsh) { color = new Color(1f, 0.9f, 0.5f) };

        // 空と光
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(0.55f, 0.58f, 0.65f);
        RenderSettings.fog = true; RenderSettings.fogColor = new Color(0.68f, 0.78f, 0.9f);
        RenderSettings.fogMode = FogMode.Linear; RenderSettings.fogStartDistance = 60; RenderSettings.fogEndDistance = 190;
        var lg = new GameObject("Sun").transform; lg.SetParent(world);
        var l = lg.gameObject.AddComponent<Light>(); l.type = LightType.Directional; l.intensity = 1.15f;
        l.color = new Color(1f, 0.96f, 0.88f); l.shadows = LightShadows.Hard;
        lg.rotation = Quaternion.Euler(48, -30, 0);

        // カメラ
        if (cam == null)
        {
            var cg = new GameObject("Cam"); cam = cg.AddComponent<Camera>();
            cg.AddComponent<AudioListener>();
            cam.fieldOfView = 75; cam.nearClipPlane = 0.08f; cam.farClipPlane = 260;
            cam.clearFlags = CameraClearFlags.SolidColor; cam.backgroundColor = RenderSettings.fogColor;
            sfx = cg.AddComponent<AudioSource>(); sfx.spatialBlend = 0f;
        }
        foreach (var c in Camera.allCameras) if (c != cam) c.enabled = false;

        // 地面
        var g = GameObject.CreatePrimitive(PrimitiveType.Cube); g.transform.SetParent(world);
        g.transform.position = new Vector3(0, -0.5f, 0); g.transform.localScale = new Vector3(MapHalf * 2 + 20, 1, MapHalf * 2 + 20);
        g.GetComponent<Renderer>().sharedMaterial = matGround; g.name = "Ground";
        // 外周の壁
        for (int i = 0; i < 4; i++)
        {
            var w = GameObject.CreatePrimitive(PrimitiveType.Cube); w.transform.SetParent(world);
            bool zAxis = i < 2; float s = (i % 2 == 0 ? 1 : -1) * (MapHalf + 6);
            w.transform.position = zAxis ? new Vector3(0, 4, s) : new Vector3(s, 4, 0);
            w.transform.localScale = zAxis ? new Vector3(MapHalf * 2 + 24, 10, 2) : new Vector3(2, 10, MapHalf * 2 + 24);
            w.GetComponent<Renderer>().sharedMaterial = matRock;
        }

        // 拠点（A〜E）
        string[] names = { "ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO" };
        Vector3[] pp = { new Vector3(-48, 0, 8), new Vector3(46, 0, -6), new Vector3(0, 0, 0), new Vector3(-30, 0, -38), new Vector3(30, 0, 40) };
        for (int i = 0; i < 5; i++)
        {
            var cp = new CapturePoint { name = names[i], pos = pp[i] };
            var pole = GameObject.CreatePrimitive(PrimitiveType.Cylinder); pole.transform.SetParent(world);
            pole.transform.position = pp[i] + Vector3.up * 3f; pole.transform.localScale = new Vector3(0.3f, 3f, 0.3f);
            pole.GetComponent<Renderer>().sharedMaterial = matRock; Destroy(pole.GetComponent<Collider>());
            var fl = GameObject.CreatePrimitive(PrimitiveType.Cube); fl.transform.SetParent(world);
            fl.transform.position = pp[i] + new Vector3(0.9f, 5f, 0); fl.transform.localScale = new Vector3(1.8f, 1.1f, 0.12f);
            cp.flagRend = fl.GetComponent<Renderer>(); cp.flagRend.sharedMaterial = matNeutral; cp.flag = fl.transform; Destroy(fl.GetComponent<Collider>());
            var ring = GameObject.CreatePrimitive(PrimitiveType.Cylinder); ring.transform.SetParent(world);
            ring.transform.position = pp[i] + Vector3.up * 0.03f; ring.transform.localScale = new Vector3(CapturePoint.Radius * 2, 0.02f, CapturePoint.Radius * 2);
            ring.GetComponent<Renderer>().sharedMaterial = Mat(new Color(0.55f, 0.6f, 0.5f)); Destroy(ring.GetComponent<Collider>());
            points.Add(cp);
            // 拠点まわりの遮蔽
            for (int k = 0; k < 5; k++)
            {
                float a = k * 72f + Random.Range(0, 30f) + i * 13f;
                Vector3 off = Quaternion.Euler(0, a, 0) * Vector3.forward * Random.Range(4.5f, 8f);
                AddCover(pp[i] + off, Random.Range(2.5f, 5f), Random.Range(1.4f, 2.6f), Random.Range(1f, 2.5f), a);
            }
        }
        // 散らした遮蔽物（拠点付近は避ける）
        for (int i = 0; i < 46; i++)
        {
            Vector3 p = new Vector3(Random.Range(-MapHalf + 6, MapHalf - 6), 0, Random.Range(-MapHalf + 6, MapHalf - 6));
            bool near = false; foreach (var cp in points) if ((cp.pos - p).magnitude < 13f) near = true;
            if (Mathf.Abs(p.z) > MapHalf - 18f) near = true; // スポーン地帯は空ける
            if (near) continue;
            AddCover(p, Random.Range(2f, 7f), Random.Range(1.2f, 3.6f), Random.Range(1f, 5f), Random.Range(0, 180f));
        }

        // 兵士
        player = SpawnSoldier(Team.Azure, true, "YOU");
        for (int t = 0; t < 2; t++)
            for (int i = 0; i < BotsPerSide; i++)
                if (!(t == 0 && i == BotsPerSide - 1)) SpawnSoldier((Team)t, false, ((Team)t).ToString().ToUpper()[0] + "-" + (i + 1));
        player.kills = 0; player.deaths = 0;
        phase = Phase.Title; camOrbit = 0;
        ShowBanner("FRONTLINE ZERO", 2f);
    }

    void AddCover(Vector3 p, float w, float h, float d, float yawDeg)
    {
        var c = GameObject.CreatePrimitive(PrimitiveType.Cube); c.transform.SetParent(world);
        c.transform.position = new Vector3(p.x, h * 0.5f, p.z); c.transform.localScale = new Vector3(w, h, d);
        c.transform.rotation = Quaternion.Euler(0, yawDeg, 0);
        float tone = Random.Range(0.85f, 1.1f);
        c.GetComponent<Renderer>().sharedMaterial = Mat(new Color(0.42f * tone, 0.42f * tone, 0.4f * tone));
    }

    Vector3 SpawnPos(Team t)
    {
        float z = (t == Team.Azure ? -1 : 1) * (MapHalf - 8f);
        return new Vector3(Random.Range(-18f, 18f), 1.1f, z + Random.Range(-3f, 3f));
    }

    Soldier SpawnSoldier(Team team, bool isPlayer, string label)
    {
        var go = new GameObject("S_" + label); go.transform.SetParent(world);
        var s = go.AddComponent<Soldier>(); s.team = team; s.isPlayer = isPlayer; s.label = label;
        s.cc = go.AddComponent<CharacterController>(); s.cc.height = 1.8f; s.cc.radius = 0.38f; s.cc.center = new Vector3(0, 0.9f, 0);
        s.cc.stepOffset = 0.35f; s.cc.skinWidth = 0.04f;
        var mat = team == Team.Azure ? matAzure : matEmber;
        var body = GameObject.CreatePrimitive(PrimitiveType.Capsule); body.transform.SetParent(go.transform, false);
        body.transform.localPosition = new Vector3(0, 0.85f, 0); body.transform.localScale = new Vector3(0.7f, 0.85f, 0.7f);
        body.GetComponent<Renderer>().sharedMaterial = mat; Destroy(body.GetComponent<Collider>());
        var head = GameObject.CreatePrimitive(PrimitiveType.Sphere); head.transform.SetParent(go.transform, false);
        head.transform.localPosition = new Vector3(0, 1.62f, 0); head.transform.localScale = Vector3.one * 0.36f;
        head.GetComponent<Renderer>().sharedMaterial = Mat(new Color(0.9f, 0.75f, 0.62f)); Destroy(head.GetComponent<Collider>());
        var gun = GameObject.CreatePrimitive(PrimitiveType.Cube); gun.transform.SetParent(go.transform, false);
        gun.transform.localPosition = new Vector3(0.28f, 1.2f, 0.4f); gun.transform.localScale = new Vector3(0.08f, 0.1f, 0.7f);
        gun.GetComponent<Renderer>().sharedMaterial = matGun; Destroy(gun.GetComponent<Collider>());
        s.body = go.transform;
        s.eye = new GameObject("eye").transform; s.eye.SetParent(go.transform, false); s.eye.localPosition = new Vector3(0, 1.62f, 0);
        s.aimErr = Random.Range(0.8f, 1.5f);
        if (isPlayer) { foreach (var r in go.GetComponentsInChildren<Renderer>()) r.enabled = false; }
        soldiers.Add(s);
        Respawn(s);
        return s;
    }

    void Respawn(Soldier s)
    {
        s.dead = false; s.hp = 100; s.ammo = 30; s.reloadUntil = 0; s.vel = Vector3.zero; s.target = null;
        s.cc.enabled = false;
        s.transform.position = SpawnPos(s.team);
        s.cc.enabled = true;
        s.transform.rotation = Quaternion.Euler(0, s.team == Team.Azure ? 0 : 180, 0);
        if (s.isPlayer) { yaw = s.transform.eulerAngles.y; pitch = 0; }
        foreach (var r in s.GetComponentsInChildren<Renderer>()) r.enabled = !s.isPlayer;
        s.goal = null; s.rethink = 0;
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
    }
    void Play(AudioClip c, float v = 0.6f) { if (sfx != null && c != null) sfx.PlayOneShot(c, v); }

    // ================= メインループ =================
    void Update()
    {
        float dt = Mathf.Min(Time.deltaTime, 0.05f);
        if (phase == Phase.Title)
        {
            UpdateBots(dt, true);
            camOrbit += dt * 8f;
            cam.transform.position = new Vector3(Mathf.Sin(camOrbit * 0.02f) * 70f, 26f, Mathf.Cos(camOrbit * 0.02f) * 30f);
            cam.transform.LookAt(new Vector3(0, 0, 0));
            UpdatePoints(dt);
            if (Input.GetMouseButtonDown(0) || Input.GetKeyDown(KeyCode.Return)) StartMatch();
            return;
        }
        if (phase == Phase.Over)
        {
            UpdateBots(dt, true);
            camOrbit += dt * 8f;
            cam.transform.position = new Vector3(Mathf.Sin(camOrbit * 0.02f) * 70f, 26f, Mathf.Cos(camOrbit * 0.02f) * 30f);
            cam.transform.LookAt(Vector3.zero);
            if (Input.GetKeyDown(KeyCode.R) || Input.GetMouseButtonDown(0)) { seed++; BuildWorld(); }
            return;
        }
        UpdatePlayer(dt);
        UpdateBots(dt, false);
        UpdatePoints(dt);
        // 流れ弾のトレーサー
        for (int i = tracers.Count - 1; i >= 0; i--)
            if (tracers[i] == null) tracers.RemoveAt(i);
        recoil = Mathf.Lerp(recoil, 0, dt * 14f);
        if (gunModel != null) gunModel.localPosition = gunBase + new Vector3(0, 0, -recoil * 0.08f);
    }

    void StartMatch()
    {
        phase = Phase.Playing;
        tickets[0] = tickets[1] = StartTickets;
        foreach (var cp in points) { cp.control = 0; cp.owner = Team.None; cp.flagRend.sharedMaterial = matNeutral; }
        foreach (var s in soldiers) { s.kills = 0; s.deaths = 0; Respawn(s); }
        Cursor.lockState = CursorLockMode.Locked; Cursor.visible = false;
        if (gunModel == null)
        {
            var g = new GameObject("Gun").transform; g.SetParent(cam.transform, false);
            gunBase = new Vector3(0.17f, -0.17f, 0.4f); g.localPosition = gunBase;
            var b = GameObject.CreatePrimitive(PrimitiveType.Cube); b.transform.SetParent(g, false); b.transform.localScale = new Vector3(0.04f, 0.055f, 0.38f);
            b.GetComponent<Renderer>().sharedMaterial = matGun; Destroy(b.GetComponent<Collider>());
            var m = GameObject.CreatePrimitive(PrimitiveType.Cube); m.transform.SetParent(g, false); m.transform.localPosition = new Vector3(0, -0.06f, -0.04f); m.transform.localScale = new Vector3(0.03f, 0.08f, 0.05f);
            m.GetComponent<Renderer>().sharedMaterial = matGun; Destroy(m.GetComponent<Collider>());
            gunModel = g;
        }
        gunModel.gameObject.SetActive(true);
        ShowBanner("DEPLOY  —  Capture the flags!", 3f);
    }

    // ---------- プレイヤー ----------
    void UpdatePlayer(float dt)
    {
        var p = player;
        if (Cursor.lockState != CursorLockMode.Locked)
        {
            if (Input.GetMouseButtonDown(0)) { Cursor.lockState = CursorLockMode.Locked; Cursor.visible = false; }
        }
        else if (Input.GetKeyDown(KeyCode.Escape)) { Cursor.lockState = CursorLockMode.None; Cursor.visible = true; }

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
            if ((Input.GetKeyDown(KeyCode.R) && p.ammo < 30) || p.ammo == 0) { p.reloadUntil = Time.time + 1.6f; }
            else if (locked && Input.GetMouseButton(0) && Time.time >= p.nextShot)
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
        }
        SpawnTracer(shooter.isPlayer ? origin + cam.transform.right * 0.2f + Vector3.down * 0.2f + dir * 0.6f : origin, end);
        float dist = shooter.isPlayer ? 0 : Vector3.Distance(cam.transform.position, origin);
        if (dist < 70f) Play(clipShot, shooter.isPlayer ? 0.5f : Mathf.Clamp01(1f - dist / 70f) * 0.35f);
    }

    void SpawnTracer(Vector3 a, Vector3 b)
    {
        var go = new GameObject("tr"); go.transform.SetParent(world);
        var lr = go.AddComponent<LineRenderer>(); lr.positionCount = 2; lr.SetPosition(0, a); lr.SetPosition(1, b);
        lr.startWidth = 0.035f; lr.endWidth = 0.02f; lr.sharedMaterial = matTracer; lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        Destroy(go, 0.05f);
    }

    void Damage(Soldier t, float dmg, Soldier by)
    {
        if (t.dead || phase == Phase.Over) return;
        t.hp -= dmg;
        if (t.isPlayer) { damageFlashUntil = Time.time + 0.25f; Play(clipHurt, 0.6f); }
        if (t.hp > 0) return;
        t.dead = true; t.deaths++; t.respawnAt = Time.time + (t.isPlayer ? 4f : 5f);
        if (by != null) by.kills++;
        tickets[(int)t.team] = Mathf.Max(0, tickets[(int)t.team] - 1f);
        killFeed = (by != null ? by.label : "?") + "  >  " + t.label; killFeedUntil = Time.time + 2.5f;
        foreach (var r in t.GetComponentsInChildren<Renderer>()) r.enabled = false;
        t.cc.enabled = false;
        CheckEnd();
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
            // 敵探索
            s.scan -= dt;
            if (s.scan <= 0)
            {
                s.scan = Random.Range(0.2f, 0.4f);
                if (s.target != null && (s.target.dead || (s.target.transform.position - s.transform.position).sqrMagnitude > 55f * 55f)) s.target = null;
                if (s.target == null)
                {
                    float bd = 50f;
                    foreach (var e in soldiers)
                    {
                        if (e.dead || e.team == s.team) continue;
                        float d = Vector3.Distance(e.transform.position, s.transform.position);
                        if (d >= bd) continue;
                        Vector3 from = s.eye.position, to = e.transform.position + Vector3.up * 1.2f;
                        if (Physics.Linecast(from, to, out var h, ~0, QueryTriggerInteraction.Ignore) && h.collider.GetComponentInParent<Soldier>() != e) continue;
                        bd = d; s.target = e;
                    }
                }
            }
            Vector3 mv = Vector3.zero;
            Vector3 toGoal = s.goal.pos - s.transform.position; toGoal.y = 0;
            bool atGoal = toGoal.magnitude < 5.5f;
            if (s.target != null)
            {
                Vector3 tp = s.target.transform.position + Vector3.up * (1.0f + Random.Range(0, 0.4f));
                Vector3 aim = tp - s.eye.position;
                Vector3 flat = new Vector3(aim.x, 0, aim.z);
                if (flat.sqrMagnitude > 0.01f) s.lookDir = Vector3.Slerp(s.lookDir, flat.normalized, dt * 7f);
                float dist = aim.magnitude;
                // 交戦中は動きながら撃つ
                if (Time.time > s.strafeUntil) { s.strafeDir = Random.value < 0.5f ? -1f : 1f; s.strafeUntil = Time.time + Random.Range(0.6f, 1.6f); }
                Vector3 right = Vector3.Cross(Vector3.up, flat.normalized);
                mv = right * s.strafeDir * 0.6f;
                if (dist > 28f) mv += flat.normalized * 0.6f; else if (dist < 12f) mv -= flat.normalized * 0.5f;
                if (Time.time >= s.nextShot && !spectate || (spectate && Time.time >= s.nextShot))
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
            // 障害物回避（前方1.6m）
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
            float delta = (a - e);
            if (a > 0 && e > 0) delta = 0; // 競り合い中は止まる
            else delta = Mathf.Sign(delta) * Mathf.Min(Mathf.Abs(delta), 3f);
            cp.control = Mathf.Clamp(cp.control + delta * 0.045f * dt * 10f * 0.5f, -1f, 1f);
            Team no = cp.control >= 0.999f ? Team.Azure : cp.control <= -0.999f ? Team.Ember : cp.owner;
            if (cp.control > -0.2f && cp.control < 0.2f && cp.owner != Team.None && Mathf.Abs(cp.control) < 0.2f) no = Team.None;
            if (no != cp.owner)
            {
                cp.owner = no;
                var m = no == Team.Azure ? matAzure : no == Team.Ember ? matEmber : matNeutral;
                cp.flagRend.sharedMaterial = m;
                if (phase == Phase.Playing && no != Team.None) { ShowBanner(cp.name + " captured by " + no.ToString().ToUpper(), 2.2f); Play(clipCap, 0.5f); }
            }
            // 旗の高さで進行を見せる
            cp.flag.position = cp.pos + new Vector3(0.9f, 3.2f + (cp.control * 0.5f + 0.5f) * 2.4f, 0);
            if (cp.owner == Team.Azure) own[0]++; else if (cp.owner == Team.Ember) own[1]++;
        }
        if (phase != Phase.Playing) return;
        // 多く保持している側の相手が持ち点を失う
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

        // チケット
        Box(new Rect(W / 2 - 210 * k, 10, 420 * k, 44 * k), new Color(0, 0, 0, 0.45f));
        Text(new Rect(W / 2 - 200 * k, 10, 190 * k, 44 * k), "AZURE  " + Mathf.CeilToInt(tickets[0]), sMid, azure);
        Text(new Rect(W / 2 + 10 * k, 10, 190 * k, 44 * k), Mathf.CeilToInt(tickets[1]) + "  EMBER", sMid, ember);
        // 拠点ステータス
        for (int i = 0; i < points.Count; i++)
        {
            var cp = points[i]; float x = W / 2 - 100 * k + i * 42 * k, y = 58 * k;
            Box(new Rect(x, y, 36 * k, 26 * k), new Color(0, 0, 0, 0.45f));
            Color c = cp.control > 0 ? Color.Lerp(Color.white, azure, cp.control) : Color.Lerp(Color.white, ember, -cp.control);
            Box(new Rect(x + 3, y + 3, 30 * k * (0.15f + 0.85f * Mathf.Abs(cp.control)), 20 * k), c);
            Text(new Rect(x, y, 36 * k, 26 * k), cp.name.Substring(0, 1), new GUIStyle(sSmall) { alignment = TextAnchor.MiddleCenter, fontStyle = FontStyle.Bold }, Color.black);
        }
        // ミニマップ
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

        if (phase == Phase.Playing)
        {
            // 照準
            float cx = W / 2, cy = H / 2;
            Color cc = Time.time < hitMarkerUntil ? Color.red : new Color(1, 1, 1, 0.85f);
            Box(new Rect(cx - 1, cy - 9, 2, 6), cc); Box(new Rect(cx - 1, cy + 3, 2, 6), cc);
            Box(new Rect(cx - 9, cy - 1, 6, 2), cc); Box(new Rect(cx + 3, cy - 1, 6, 2), cc);
            // HP・弾
            Box(new Rect(20, H - 56 * k, 260 * k, 20 * k), new Color(0, 0, 0, 0.5f));
            Box(new Rect(22, H - 54 * k, 256 * k * Mathf.Clamp01(player.hp / 100f), 16 * k), Color.Lerp(Color.red, new Color(0.4f, 1f, 0.5f), player.hp / 100f));
            string am = Time.time < player.reloadUntil ? "RELOADING..." : player.ammo + " / 30";
            Text(new Rect(W - 260 * k, H - 70 * k, 240 * k, 50 * k), am, new GUIStyle(sMid) { alignment = TextAnchor.MiddleRight }, Color.white);
            Text(new Rect(20, H - 100 * k, 300 * k, 30 * k), "K " + player.kills + "   D " + player.deaths, sSmall, Color.white);
            if (Time.time < damageFlashUntil) Box(new Rect(0, 0, W, H), new Color(1, 0, 0, 0.25f * (damageFlashUntil - Time.time) / 0.25f));
            if (player.dead) { Text(new Rect(0, H * 0.4f, W, 80), "YOU WERE DOWN — respawning...", sMid, Color.white); }
            if (Cursor.lockState != CursorLockMode.Locked) Text(new Rect(0, H * 0.55f, W, 40), "Click to resume", sMid, Color.white);
            if (Time.time < killFeedUntil) Text(new Rect(W - 320 * k, 14 + ms + 14, 306 * k, 28 * k), killFeed, new GUIStyle(sSmall) { alignment = TextAnchor.MiddleRight }, Color.white);
        }
        if (Time.time < bannerUntil && banner.Length > 0)
            Text(new Rect(0, H * 0.18f, W, 70 * k), banner, phase == Phase.Over ? sBig : sMid, phase == Phase.Over ? (banner == "VICTORY" ? new Color(0.5f, 1f, 0.6f) : new Color(1f, 0.5f, 0.45f)) : Color.white);

        if (phase == Phase.Title)
        {
            Text(new Rect(0, H * 0.34f, W, 90 * k), "FRONTLINE ZERO", sBig, Color.white);
            Text(new Rect(0, H * 0.34f + 70 * k, W, 40 * k), "5 flags / 2 squads / 9 vs 9", sMid, new Color(1, 1, 1, 0.8f));
            if (Mathf.Sin(Time.time * 4f) > -0.3f) Text(new Rect(0, H * 0.62f, W, 40 * k), "CLICK or ENTER to deploy", sMid, new Color(1f, 0.9f, 0.4f));
            Text(new Rect(0, H * 0.72f, W, 80 * k), "WASD move   Shift sprint   Space jump   Mouse aim/fire   R reload", sSmall.fontSize > 0 ? new GUIStyle(sSmall) { alignment = TextAnchor.MiddleCenter } : sSmall, new Color(1, 1, 1, 0.85f));
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
