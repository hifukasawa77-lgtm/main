using UnityEngine;

// 軽戦車。プレイヤーが乗ると操縦、乗っていなければAIが走る。
public class Vehicle : MonoBehaviour
{
    public Team team;
    public const float MaxHp = 520f;
    public float hp = MaxHp;
    public Soldier driver;
    public bool wreck;
    public float respawnAt;
    public float holdUntil;           // この時刻までAIは動かない（プレイヤー用に基地で待つ）
    public CharacterController cc;
    public Transform turret, barrel, muzzle;
    public float speed, turretYaw, turretPitch, yVel;
    public float reloadAt;
    public Vector3 spawnPos; public float spawnYaw;

    // --- AI ---
    public CapturePoint goal; public float rethink;
    public Soldier tSoldier; public Vehicle tVehicle; public float scan;
    public float reverseUntil, strafeDir = 1f;
    public Vector3 lastPos; public float stuckT;
}
