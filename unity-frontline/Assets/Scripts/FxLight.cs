using UnityEngine;

// 爆発・発砲の閃光。点光源がみるみる暗くなる（同時に出せる数を絞る：描画負荷とライト数の上限のため）。
public class FxLight : MonoBehaviour
{
    public static int Live;
    public float life = 0.35f, peak = 6f;
    Light l; float t;

    public static void Spawn(Vector3 p, Color c, float range, float peak, float life, Transform parent)
    {
        if (Live >= 3) return;
        var go = new GameObject("fxlight"); go.transform.SetParent(parent); go.transform.position = p;
        var li = go.AddComponent<Light>(); li.type = LightType.Point; li.color = c; li.range = range; li.intensity = peak; li.shadows = LightShadows.None;
        var f = go.AddComponent<FxLight>(); f.life = life; f.peak = peak; f.l = li; Live++;
    }

    void Update()
    {
        t += Time.deltaTime;
        float k = t / life;
        if (k >= 1f) { Destroy(gameObject); return; }
        l.intensity = peak * (1f - k) * (1f - k);
    }
    void OnDestroy() { Live--; }
}
