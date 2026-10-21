// 戦場の質感を全部コードで焼く（外部画像なし）。継ぎ目なく並ぶよう、ノイズは周期付きの値ノイズで作る。
using UnityEngine;

public static class Textures
{
    public static Texture2D Ground, CamoAzure, CamoEmber, MetalAzure, MetalEmber, MetalDark, MetalRust,
        Concrete, Sandbag, Crate, Cloth, Crater, Bark, Burnt, Skin;
    static bool ready;

    static int Mod(int a, int m) { int r = a % m; return r < 0 ? r + m : r; }
    static float Frac(float x) { return x - Mathf.Floor(x); }
    // しきい値 e0〜e1 の間で 0→1 に滑らかに立ち上がる（Mathf.SmoothStep は補間関数で別物）
    static float Sst(float e0, float e1, float x) { float t = Mathf.Clamp01((x - e0) / (e1 - e0)); return t * t * (3f - 2f * t); }
    static float Hash(int x, int y, int s)
    {
        unchecked
        {
            uint h = (uint)(x * 374761393) + (uint)(y * 668265263) + (uint)(s * 1442695041);
            h = (h ^ (h >> 13)) * 1274126177u; h ^= h >> 16;
            return (h & 0xffffu) / 65535f;
        }
    }
    static float VN(float x, float y, int px, int py, int seed)
    {
        int x0 = Mathf.FloorToInt(x), y0 = Mathf.FloorToInt(y);
        float fx = x - x0, fy = y - y0; fx = fx * fx * (3f - 2f * fx); fy = fy * fy * (3f - 2f * fy);
        int xa = Mod(x0, px), xb = Mod(x0 + 1, px), ya = Mod(y0, py), yb = Mod(y0 + 1, py);
        float a = Hash(xa, ya, seed), b = Hash(xb, ya, seed), c = Hash(xa, yb, seed), d = Hash(xb, yb, seed);
        return Mathf.Lerp(Mathf.Lerp(a, b, fx), Mathf.Lerp(c, d, fx), fy);
    }
    static float FBM(float u, float v, int p, int oct, int seed)
    {
        float s = 0, a = 0.5f, n = 0;
        for (int i = 0; i < oct; i++) { s += a * VN(u * p, v * p, p, p, seed + i * 17); n += a; a *= 0.5f; p *= 2; }
        return s / n;
    }
    static Texture2D Gen(string name, int n, System.Func<float, float, Color> f)
    {
        var t = new Texture2D(n, n, TextureFormat.RGBA32, true); t.name = name;
        var px = new Color32[n * n];
        for (int y = 0; y < n; y++)
            for (int x = 0; x < n; x++)
            {
                Color c = f((x + 0.5f) / n, (y + 0.5f) / n); c.a = 1f;
                px[y * n + x] = c;
            }
        t.SetPixels32(px); t.wrapMode = TextureWrapMode.Repeat; t.filterMode = FilterMode.Bilinear; t.anisoLevel = 4;
        t.Apply(true);
        return t;
    }

    static Texture2D Camo(string name, Color a, Color b, Color c, Color d, int seed)
    {
        return Gen(name, 128, (u, v) =>
        {
            float n = FBM(u, v, 3, 3, seed);
            Color col = n < .38f ? a : n < .52f ? b : n < .66f ? c : d;
            float g = (Hash((int)(u * 128), (int)(v * 128), seed) - .5f) * .07f;
            return new Color(col.r + g, col.g + g, col.b + g);
        });
    }

    // 鋼板: パネルの継ぎ目・リベット・錆びの縦筋・汚れ
    static Texture2D Metal(string name, Color baseC, int seed)
    {
        return Gen(name, 256, (u, v) =>
        {
            float n = FBM(u, v, 8, 3, seed);
            Color c = baseC * (0.78f + 0.44f * n);
            float fu = Frac(u * 4f), fv = Frac(v * 4f);
            float du = Mathf.Min(fu, 1 - fu) / 4f, dv = Mathf.Min(fv, 1 - fv) / 4f;
            bool nearLine = du < .03f || dv < .03f;
            if (du < .005f || dv < .005f) c *= .4f;
            else if (du < .010f || dv < .010f) c *= 1.15f;
            if (nearLine)
            {
                float cx = Frac(u * 24f) - .5f, cy = Frac(v * 24f) - .5f;
                if (cx * cx + cy * cy < .028f) c = c * 1.25f + new Color(.04f, .04f, .04f);
            }
            float r = VN(u * 20f, v * 2f, 20, 2, seed + 9) * FBM(u, v, 6, 2, seed + 3) * 1.9f;
            r = Sst(.55f, .95f, r);
            c = Color.Lerp(c, new Color(.42f, .21f, .09f), r * .75f);
            float sc = VN(u * 90f, v * 4f, 90, 4, seed + 21);
            if (sc > .93f) c *= 1.3f;
            return c;
        });
    }

    static Texture2D ConcreteTex()
    {
        return Gen("concrete", 256, (u, v) =>
        {
            float n = FBM(u, v, 6, 4, 31);
            Color c = new Color(.56f, .55f, .52f) * (0.72f + 0.55f * n);
            float cr = Mathf.Abs(FBM(u, v, 5, 3, 41) - .5f);
            if (cr < .012f) c *= .35f; else if (cr < .02f) c *= .75f;
            float st = VN(u * 10f, v * 1.5f, 10, 2, 51);
            c *= 1f - Sst(.55f, .9f, st) * .35f;
            int cx = (int)(u * 48f), cy = (int)(v * 48f);
            if (Hash(cx, cy, 61) > .985f)
            {
                float lx = Frac(u * 48f) - .5f, ly = Frac(v * 48f) - .5f;
                if (lx * lx + ly * ly < .09f) c *= .35f;
            }
            return c;
        });
    }

    static Texture2D SandbagTex()
    {
        return Gen("sandbag", 128, (u, v) =>
        {
            float ry = v * 5f; int ri = (int)Mathf.Floor(ry); float ly = Frac(ry);
            float rx = u * 3f + (ri % 2 == 0 ? 0f : .5f); float lx = Frac(rx);
            float e = Mathf.Min(Mathf.Min(lx, 1 - lx), Mathf.Min(ly, 1 - ly)) * 2.4f;
            Color bag = Color.Lerp(new Color(.52f, .45f, .29f), new Color(.66f, .58f, .38f), FBM(u, v, 8, 2, 3));
            float weave = Mathf.Sin(u * 512f) * Mathf.Sin(v * 512f) * .035f;
            bag *= .4f + .6f * Mathf.Clamp01(e * 1.5f);
            return new Color(bag.r + weave, bag.g + weave, bag.b + weave);
        });
    }

    static Texture2D CrateTex()
    {
        return Gen("crate", 128, (u, v) =>
        {
            float py = v * 4f; float lp = Frac(py);
            float g = Mathf.Sin((u * 14f + FBM(u, v, 4, 2, 7) * 6f) * 3.14159f) * .5f + .5f;
            Color c = new Color(.5f, .36f, .2f) * (0.72f + 0.3f * g);
            if (lp < .04f || lp > .96f) c = new Color(.1f, .07f, .04f);
            float edge = Mathf.Min(Mathf.Min(u, 1 - u), Mathf.Min(v, 1 - v));
            if (edge < .09f) c = new Color(.3f, .21f, .11f) * (0.8f + .3f * g);
            if (Mathf.Abs(u - v) < .045f || Mathf.Abs(u - (1 - v)) < .045f) c = new Color(.36f, .26f, .14f) * (0.85f + .2f * g);
            return c;
        });
    }

    static Texture2D ClothTex()
    {
        return Gen("cloth", 128, (u, v) =>
        {
            float s = Mathf.Sin(u * 300f) * Mathf.Sin(v * 300f) * .5f + .5f;
            float n = FBM(u, v, 5, 3, 71);
            float k = (0.78f + 0.2f * s) * (0.75f + 0.5f * n);
            float tear = VN(u * 6f, v * 6f, 6, 6, 72);
            if (tear > .86f) k *= .5f;
            return new Color(k, k, k);
        });
    }

    static Texture2D CraterTex()
    {
        return Gen("crater", 128, (u, v) =>
        {
            float dx = (u - .5f) * 2f, dy = (v - .5f) * 2f;
            float r = Mathf.Sqrt(dx * dx + dy * dy);
            float n = FBM(u, v, 4, 3, 12);
            Color core = new Color(.1f, .08f, .06f) * (0.7f + 0.6f * n);
            Color ground = new Color(.34f, .30f, .20f) * (0.85f + 0.3f * n);
            float ang = Mathf.Atan2(dy, dx);
            float soot = VN(ang * 3f + 6f, r * 3f, 12, 4, 13);
            Color mid = Color.Lerp(core, new Color(.22f, .17f, .11f), Sst(.3f, .75f, r));
            Color c = Color.Lerp(mid, ground, Sst(.55f + soot * .15f, .98f, r));
            return c;
        });
    }

    static Texture2D BarkTex()
    {
        return Gen("bark", 64, (u, v) =>
        {
            float n = VN(u * 8f, v * 1f, 8, 1, 81) * .6f + VN(u * 16f, v * 3f, 16, 3, 82) * .4f;
            return new Color(.22f, .16f, .1f) * (0.5f + n);
        });
    }

    static Texture2D BurntTex()
    {
        return Gen("burnt", 128, (u, v) =>
        {
            float n = FBM(u, v, 8, 3, 91);
            Color c = new Color(.09f, .08f, .07f) * (0.55f + n);
            float r = VN(u * 14f, v * 3f, 14, 3, 92);
            c = Color.Lerp(c, new Color(.3f, .15f, .06f), Sst(.7f, .95f, r) * .6f);
            if (Hash((int)(u * 64f), (int)(v * 64f), 93) > .993f) c = new Color(.9f, .35f, .08f);
            return c;
        });
    }

    static Texture2D SkinTex()
    {
        return Gen("skin", 32, (u, v) =>
        {
            float n = FBM(u, v, 4, 2, 95);
            return new Color(.78f, .6f, .48f) * (0.85f + 0.3f * n);
        });
    }

    public static void Init()
    {
        if (ready) return; ready = true;
        Ground = Gen("ground", 256, (u, v) =>
        {
            float m = FBM(u, v, 4, 4, 1), g = FBM(u, v, 6, 3, 5);
            Color dirt = new Color(.38f, .31f, .21f), grass = new Color(.30f, .35f, .19f), mud = new Color(.2f, .16f, .11f);
            Color c = Color.Lerp(dirt, grass, Sst(.35f, .65f, m));
            c = Color.Lerp(c, mud, Sst(.62f, .8f, g) * .7f);
            float grain = (FBM(u, v, 64, 2, 9) - .5f) * .18f;
            if (Hash((int)(u * 256f), (int)(v * 256f), 77) > .992f) grain += .12f; // 小石
            return new Color(c.r + grain, c.g + grain, c.b + grain);
        });
        // 青軍=灰青の都市迷彩 / 橙軍=砂漠迷彩
        CamoAzure = Camo("camoA", new Color(.18f, .22f, .30f), new Color(.28f, .34f, .42f), new Color(.12f, .15f, .2f), new Color(.36f, .4f, .46f), 11);
        CamoEmber = Camo("camoE", new Color(.55f, .42f, .26f), new Color(.42f, .30f, .18f), new Color(.66f, .52f, .34f), new Color(.3f, .2f, .12f), 12);
        MetalAzure = Metal("metalA", new Color(.24f, .31f, .42f), 21);
        MetalEmber = Metal("metalE", new Color(.52f, .40f, .24f), 22);
        MetalDark = Metal("metalD", new Color(.2f, .21f, .2f), 23);
        MetalRust = Metal("metalR", new Color(.46f, .3f, .2f), 24);
        Concrete = ConcreteTex(); Sandbag = SandbagTex(); Crate = CrateTex(); Cloth = ClothTex();
        Crater = CraterTex(); Bark = BarkTex(); Burnt = BurntTex(); Skin = SkinTex();
    }
}
