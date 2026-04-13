using UnityEngine;
using UnityEngine.UI;

namespace HorrorWalk
{
    public sealed class UIHUD : MonoBehaviour
    {
        [Header("HUD")]
        public Text keysText;
        public Text fearText;
        public Text promptText;

        [Header("Note")]
        public GameObject notePanel;
        public Text noteText;

        private void Awake()
        {
            if (keysText == null || promptText == null) TryAutoWire();
        }

        private void OnEnable()
        {
            var gm = GameManager.Instance;
            if (gm == null) return;

            gm.KeysChanged += OnKeysChanged;
            gm.FearChanged += OnFearChanged;
            gm.PromptChanged += OnPromptChanged;
            gm.NoteChanged += OnNoteChanged;

            OnKeysChanged(gm.KeysCollected, gm.keysRequired);
            OnFearChanged(gm.Fear, gm.fearMax);
            OnPromptChanged("");
            OnNoteChanged(false, "");
        }

        private void OnDisable()
        {
            var gm = GameManager.Instance;
            if (gm == null) return;
            gm.KeysChanged -= OnKeysChanged;
            gm.FearChanged -= OnFearChanged;
            gm.PromptChanged -= OnPromptChanged;
            gm.NoteChanged -= OnNoteChanged;
        }

        private void OnKeysChanged(int collected, int required)
        {
            if (keysText == null) return;
            keysText.text = $"鍵 {collected}/{required}";
        }

        private void OnFearChanged(float fear, float max)
        {
            if (fearText == null) return;
            fearText.text = $"恐怖 {Mathf.RoundToInt(fear)}/{Mathf.RoundToInt(max)}";
        }

        private void OnPromptChanged(string prompt)
        {
            if (promptText == null) return;
            promptText.text = prompt ?? "";
        }

        private void OnNoteChanged(bool open, string text)
        {
            if (notePanel != null) notePanel.SetActive(open);
            if (noteText != null) noteText.text = text ?? "";
        }

        private void TryAutoWire()
        {
            var texts = GetComponentsInChildren<Text>(true);
            foreach (var t in texts)
            {
                if (t.name.Contains("Keys")) keysText = t;
                else if (t.name.Contains("Fear")) fearText = t;
                else if (t.name.Contains("Prompt")) promptText = t;
                else if (t.name.Contains("NoteText")) noteText = t;
            }

            var panels = GetComponentsInChildren<Transform>(true);
            foreach (var tr in panels)
            {
                if (tr.name.Contains("NotePanel")) notePanel = tr.gameObject;
            }
        }
    }
}

