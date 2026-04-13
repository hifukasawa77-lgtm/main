using UnityEngine;

namespace HorrorWalk
{
    public sealed class DoorExit : MonoBehaviour, IInteractable
    {
        public bool isExitDoor = true;
        public Transform doorPivot;
        public float openAngle = 90f;
        public float openSpeed = 180f;

        private bool _opened;

        private void Awake()
        {
            if (doorPivot == null) doorPivot = transform;
        }

        private void Update()
        {
            if (!_opened) return;
            if (doorPivot == null) return;

            var target = Quaternion.Euler(0f, openAngle, 0f);
            doorPivot.localRotation = Quaternion.RotateTowards(doorPivot.localRotation, target, openSpeed * Time.deltaTime);
        }

        public string GetPrompt(GameManager gameManager)
        {
            if (gameManager == null) return "開ける: ドア (E)";
            if (isExitDoor && !gameManager.HasAllKeys())
            {
                return $"鍵が足りない ({gameManager.KeysCollected}/{gameManager.keysRequired})";
            }

            return isExitDoor ? "脱出する (E)" : "開ける: ドア (E)";
        }

        public void Interact(GameManager gameManager)
        {
            if (gameManager == null) return;

            if (isExitDoor)
            {
                if (!gameManager.HasAllKeys()) return;
                _opened = true;
                gameManager.Clear();
                return;
            }

            _opened = true;
        }
    }
}

