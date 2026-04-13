using UnityEngine;
using UnityEngine.UI;

namespace HorrorWalk
{
    public sealed class ResultUI : MonoBehaviour
    {
        public Text resultText;

        private void Start()
        {
            var gm = GameManager.Instance;
            var result = gm != null ? gm.LastResult : GameResult.None;

            if (resultText != null)
            {
                resultText.text = result switch
                {
                    GameResult.Cleared => "脱出成功",
                    GameResult.GameOver => "ゲームオーバー",
                    _ => "結果",
                };
            }
        }
    }
}

