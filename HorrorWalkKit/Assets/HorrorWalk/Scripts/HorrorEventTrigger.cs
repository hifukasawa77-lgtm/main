using UnityEngine;

namespace HorrorWalk
{
    [RequireComponent(typeof(Collider))]
    public sealed class HorrorEventTrigger : MonoBehaviour
    {
        public bool oneShot = true;
        public float addFear = 25f;
        public float flashlightFlickerSeconds = 1.2f;
        public Apparition apparitionPrefab;
        public Transform apparitionSpawn;
        public float apparitionLifetime = 1.5f;

        private bool _done;

        private void Reset()
        {
            var col = GetComponent<Collider>();
            col.isTrigger = true;
        }

        private void OnTriggerEnter(Collider other)
        {
            if (_done && oneShot) return;
            if (!other.GetComponentInParent<PlayerController>()) return;

            var gm = GameManager.Instance;
            if (gm != null && addFear > 0f) gm.AddFear(addFear);

            var flashlight = Object.FindObjectOfType<Flashlight>();
            if (flashlight != null && flashlightFlickerSeconds > 0f) flashlight.Flicker(flashlightFlickerSeconds);

            if (apparitionPrefab != null)
            {
                var pos = apparitionSpawn != null ? apparitionSpawn.position : transform.position;
                var rot = apparitionSpawn != null ? apparitionSpawn.rotation : transform.rotation;
                var app = Object.Instantiate(apparitionPrefab, pos, rot);
                app.lifeSeconds = apparitionLifetime;
            }

            _done = true;
        }
    }
}

