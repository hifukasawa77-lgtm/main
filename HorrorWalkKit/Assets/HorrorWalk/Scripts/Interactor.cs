using UnityEngine;

namespace HorrorWalk
{
    public sealed class Interactor : MonoBehaviour
    {
        public Camera playerCamera;
        public float maxDistance = 2.2f;
        public LayerMask interactMask = ~0;
        public KeyCode interactKey = KeyCode.E;

        private IInteractable _current;

        private void Awake()
        {
            if (playerCamera == null) playerCamera = GetComponentInChildren<Camera>();
        }

        private void Update()
        {
            var gm = GameManager.Instance;
            if (gm == null) return;

            if (!gm.InputEnabled)
            {
                gm.SetPrompt("メモを閉じる: E");
                if (Input.GetKeyDown(interactKey)) gm.CloseNote();
                _current = null;
                return;
            }

            _current = FindTarget(out var prompt);
            gm.SetPrompt(prompt);

            if (_current != null && Input.GetKeyDown(interactKey))
            {
                _current.Interact(gm);
            }
        }

        private IInteractable FindTarget(out string prompt)
        {
            prompt = "";
            if (playerCamera == null) return null;

            if (!Physics.Raycast(playerCamera.transform.position, playerCamera.transform.forward, out var hit, maxDistance, interactMask, QueryTriggerInteraction.Collide))
            {
                return null;
            }

            IInteractable interactable = null;
            var behaviours = hit.collider.GetComponentsInParent<MonoBehaviour>();
            foreach (var b in behaviours)
            {
                if (b is IInteractable i)
                {
                    interactable = i;
                    break;
                }
            }
            if (interactable == null) return null;

            var gm = GameManager.Instance;
            prompt = interactable.GetPrompt(gm);
            return interactable;
        }
    }
}
