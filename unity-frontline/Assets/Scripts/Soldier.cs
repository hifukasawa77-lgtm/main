using UnityEngine;

public class Soldier : MonoBehaviour
{
    public Team team;
    public bool isPlayer;
    public float hp = 100f;
    public bool dead;
    public float respawnAt;
    public int kills, deaths;
    public CharacterController cc;
    public Transform eye;          // 目線（プレイヤー=カメラ）
    public Vector3 vel;
    public int ammo = 30;
    public float reloadUntil;
    public float nextShot;
    public string label;

    // --- bot ---
    public CapturePoint goal;
    public float rethink;
    public Soldier target;
    public float scan;
    public float strafeDir = 1f, strafeUntil;
    public Vector3 lastPos; public float stuckT;
    public float aimErr;           // 個体差
    public Transform body;
    public Vector3 lookDir = Vector3.forward;
}
