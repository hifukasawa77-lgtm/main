using UnityEngine;

namespace HorrorWalk
{
    public interface IInteractable
    {
        string GetPrompt(GameManager gameManager);
        void Interact(GameManager gameManager);
    }
}

