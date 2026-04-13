using UnityEngine;

namespace HorrorWalk
{
    public sealed class Apparition : MonoBehaviour
    {
        public float lifeSeconds = 1.2f;
        public float facePlayerSpeed = 360f;
        public float fearPerSecondWhileVisible = 12f;

        private Transform _player;
        private float _spawnTime;

        private void Awake()
        {
            _spawnTime = Time.time;
            var pc = Object.FindObjectOfType<PlayerController>();
            _player = pc != null ? pc.transform : null;
        }

        private void Update()
        {
            if (_player != null)
            {
                var to = _player.position - transform.position;
                to.y = 0f;
                if (to.sqrMagnitude > 0.001f)
                {
                    var target = Quaternion.LookRotation(to.normalized, Vector3.up);
                    transform.rotation = Quaternion.RotateTowards(transform.rotation, target, facePlayerSpeed * Time.deltaTime);
                }
            }

            if (IsVisibleToMainCamera())
            {
                var gm = GameManager.Instance;
                if (gm != null && fearPerSecondWhileVisible > 0f)
                {
                    gm.AddFear(fearPerSecondWhileVisible * Time.deltaTime);
                }
            }

            if (Time.time - _spawnTime >= Mathf.Max(0.1f, lifeSeconds))
            {
                Destroy(gameObject);
            }
        }

        private bool IsVisibleToMainCamera()
        {
            var cam = Camera.main;
            if (cam == null) return false;
            var vp = cam.WorldToViewportPoint(transform.position);
            if (vp.z <= 0f) return false;
            return vp.x >= 0f && vp.x <= 1f && vp.y >= 0f && vp.y <= 1f;
        }
    }
}

