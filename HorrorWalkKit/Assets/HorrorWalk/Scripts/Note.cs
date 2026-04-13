using UnityEngine;

namespace HorrorWalk
{
    public sealed class Note : MonoBehaviour, IInteractable
    {
        [TextArea(3, 12)]
        public string text = "……読めない。";

        public string GetPrompt(GameManager gameManager)
        {
            return "読む: メモ (E)";
        }

        public void Interact(GameManager gameManager)
        {
            if (gameManager == null) return;
            gameManager.ToggleNote(text);
        }
    }
}

