using System;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace HorrorWalk
{
    public enum GameResult
    {
        None = 0,
        Cleared = 1,
        GameOver = 2,
    }

    public sealed class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Goal")]
        public int keysRequired = 3;

        [Header("Fear")]
        public float fearMax = 100f;

        [Header("Scenes")]
        public string titleSceneName = "Title";
        public string houseSceneName = "House";
        public string resultSceneName = "Result";

        public int KeysCollected => _keysCollected;
        public float Fear => _fear;
        public bool InputEnabled => _inputEnabled;
        public GameResult LastResult => _lastResult;

        public event Action<int, int> KeysChanged;
        public event Action<float, float> FearChanged;
        public event Action<string> PromptChanged;
        public event Action<bool, string> NoteChanged;
        public event Action<GameResult> ResultChanged;
        public event Action<bool> InputEnabledChanged;

        private int _keysCollected;
        private float _fear;
        private bool _inputEnabled = true;
        private GameResult _lastResult = GameResult.None;
        private string _prompt = "";
        private bool _noteOpen;
        private string _noteText = "";

        private const string PlayerPrefsLastResult = "HorrorWalk.LastResult";

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);

            var saved = PlayerPrefs.GetInt(PlayerPrefsLastResult, 0);
            _lastResult = (GameResult)saved;
        }

        public void ResetRun()
        {
            _keysCollected = 0;
            _fear = 0f;
            _lastResult = GameResult.None;
            _prompt = "";
            _noteOpen = false;
            _noteText = "";
            _inputEnabled = true;

            KeysChanged?.Invoke(_keysCollected, keysRequired);
            FearChanged?.Invoke(_fear, fearMax);
            PromptChanged?.Invoke(_prompt);
            NoteChanged?.Invoke(_noteOpen, _noteText);
            ResultChanged?.Invoke(_lastResult);
            InputEnabledChanged?.Invoke(_inputEnabled);
        }

        public void AddKey(int count = 1)
        {
            _keysCollected += Mathf.Max(0, count);
            KeysChanged?.Invoke(_keysCollected, keysRequired);
        }

        public bool HasAllKeys() => _keysCollected >= keysRequired;

        public void AddFear(float amount)
        {
            if (amount <= 0f) return;
            _fear = Mathf.Clamp(_fear + amount, 0f, fearMax);
            FearChanged?.Invoke(_fear, fearMax);

            if (_fear >= fearMax)
            {
                GameOver();
            }
        }

        public void SetPrompt(string prompt)
        {
            prompt ??= "";
            if (prompt == _prompt) return;
            _prompt = prompt;
            PromptChanged?.Invoke(_prompt);
        }

        public void OpenNote(string text)
        {
            _noteOpen = true;
            _noteText = text ?? "";
            NoteChanged?.Invoke(_noteOpen, _noteText);
            SetInputEnabled(false);
            SetPrompt("");
        }

        public void CloseNote()
        {
            if (!_noteOpen) return;
            _noteOpen = false;
            _noteText = "";
            NoteChanged?.Invoke(_noteOpen, _noteText);
            SetInputEnabled(true);
        }

        public void ToggleNote(string text)
        {
            if (_noteOpen) CloseNote();
            else OpenNote(text);
        }

        public void SetInputEnabled(bool enabled)
        {
            if (_inputEnabled == enabled) return;
            _inputEnabled = enabled;
            InputEnabledChanged?.Invoke(_inputEnabled);
        }

        public void Clear()
        {
            SetResult(GameResult.Cleared);
            LoadResult();
        }

        public void GameOver()
        {
            SetResult(GameResult.GameOver);
            LoadResult();
        }

        private void SetResult(GameResult result)
        {
            _lastResult = result;
            PlayerPrefs.SetInt(PlayerPrefsLastResult, (int)_lastResult);
            PlayerPrefs.Save();
            ResultChanged?.Invoke(_lastResult);
        }

        public void LoadTitle()
        {
            SceneManager.LoadScene(titleSceneName);
        }

        public void LoadHouse()
        {
            ResetRun();
            SceneManager.LoadScene(houseSceneName);
        }

        public void LoadResult()
        {
            SceneManager.LoadScene(resultSceneName);
        }
    }
}

