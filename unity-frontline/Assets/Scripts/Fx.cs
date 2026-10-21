using UnityEngine;

// 爆発・煙の球。膨らんで、最後に縮んで消える（ループ指定なら上昇して元の位置へ戻る＝燃える残骸の煙）。
public class Fx : MonoBehaviour
{
    public float life = 0.6f, grow = 6f, rise = 0f;
    public bool loop;
    Vector3 s0, p0; float t;

    void Start() { s0 = transform.localScale; p0 = transform.position; t = loop ? Random.value * life : 0f; }

    void Update()
    {
        t += Time.deltaTime;
        float k = t / life;
        if (k >= 1f)
        {
            if (!loop) { Destroy(gameObject); return; }
            t = 0f; k = 0f; transform.position = p0;
        }
        float fade = k > 0.7f ? (1f - k) / 0.3f : 1f;
        transform.localScale = s0 * (1f + grow * k) * Mathf.Max(0.01f, fade);
        transform.position += Vector3.up * rise * Time.deltaTime;
    }
}
