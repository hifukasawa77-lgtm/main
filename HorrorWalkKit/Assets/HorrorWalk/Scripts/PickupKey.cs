using UnityEngine;

namespace HorrorWalk
{
    public sealed class PickupKey : MonoBehaviour, IInteractable
    {
        public string keyName = "鍵";
        public float fearOnPickup = 10f;

        public string GetPrompt(GameManager gameManager)
        {
            return $"拾う: {keyName} (E)";
        }

        public void Interact(GameManager gameManager)
        {
            if (gameManager == null) return;
            gameManager.AddKey(1);
            if (fearOnPickup > 0f) gameManager.AddFear(fearOnPickup);
            Destroy(gameObject);
        }
    }
}

