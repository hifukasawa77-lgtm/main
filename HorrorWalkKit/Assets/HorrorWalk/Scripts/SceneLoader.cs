using UnityEngine;

namespace HorrorWalk
{
    public sealed class SceneLoader : MonoBehaviour
    {
        public void StartGame()
        {
            if (GameManager.Instance != null) GameManager.Instance.LoadHouse();
        }

        public void BackToTitle()
        {
            if (GameManager.Instance != null) GameManager.Instance.LoadTitle();
        }

        public void Quit()
        {
            Application.Quit();
        }
    }
}

