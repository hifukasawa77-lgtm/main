using UnityEngine;

// 爆発・煙・火花・破片の共用部品。球や立方体に付けて、膨らむ・飛ぶ・落ちる・色が変わる・縮んで消える。
public class Fx : MonoBehaviour
{
    public float life = 0.6f, grow = 6f, rise = 0f, delay = 0f, gravity = 0f, drag = 0f, groundY = 0.12f;
    public bool loop, flat, ground, keep, shrinkEnd = true;
    public Vector3 vel, spinSpeed;
    public Color c0 = Color.white, c1 = Color.white;
    Vector3 s0, p0, v0; float t;
    Renderer rend; MaterialPropertyBlock mpb;
    static readonly int ColorId = Shader.PropertyToID("_Color");

    void Start()
    {
        s0 = transform.localScale; p0 = transform.position; v0 = vel;
        rend = GetComponent<Renderer>();
        if (rend != null) mpb = new MaterialPropertyBlock();
        if (loop) t = Random.value * life;
        if (delay > 0f && rend != null) rend.enabled = false;
    }

    void Update()
    {
        float dt = Time.deltaTime;
        if (delay > 0f)
        {
            delay -= dt;
            if (delay > 0f) return;
            if (rend != null) rend.enabled = true;
        }
        t += dt;
        float k = t / life;
        if (k >= 1f)
        {
            if (keep) { enabled = false; return; }
            if (!loop) { Destroy(gameObject); return; }
            t = 0f; k = 0f; transform.position = p0; vel = v0;
        }
        vel.y -= gravity * dt;
        if (drag > 0f) vel *= Mathf.Max(0f, 1f - drag * dt);
        Vector3 pos = transform.position + (vel + Vector3.up * rise) * dt;
        if (ground && pos.y < groundY && vel.y < 0f)
        {
            pos.y = groundY; vel.y = -vel.y * 0.25f; vel.x *= 0.5f; vel.z *= 0.5f; spinSpeed *= 0.5f;
            if (Mathf.Abs(vel.y) < 1f) { vel = Vector3.zero; spinSpeed = Vector3.zero; }
        }
        transform.position = pos;
        if (spinSpeed != Vector3.zero) transform.Rotate(spinSpeed * dt, Space.Self);
        float sc = 1f + grow * k;
        float fade = shrinkEnd && k > 0.7f ? (1f - k) / 0.3f : 1f;
        Vector3 s = flat ? new Vector3(s0.x * sc, s0.y, s0.z * sc) : s0 * sc;
        transform.localScale = s * Mathf.Max(0.01f, fade);
        if (mpb != null) { mpb.SetColor(ColorId, Color.Lerp(c0, c1, Mathf.Sqrt(k))); rend.SetPropertyBlock(mpb); }
    }
}
