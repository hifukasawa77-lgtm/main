using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace ShogiRPG
{
    public sealed class ShogiRPGGame : MonoBehaviour
    {
        private const int BoardSize = 9;
        private const int PlayerMaxHp = 1000;

        private enum Turn
        {
            Player,
            Enemy,
            Resolving
        }

        private enum GameState
        {
            Title,
            Playing,
            StageClear,
            Victory,
            GameOver
        }

        private enum PieceType
        {
            FU,
            KYO,
            KEI,
            GIN,
            KIN,
            GYOKU,
            KAKU,
            HI,

            // 将来的な拡張用（HTML側には成り駒が存在）
            TOKIN,
            NARIKYO,
            NARIKEI,
            NARIGIN,
            UMA,
            RYU
        }

        [Serializable]
        private sealed class Monster
        {
            public int id;
            public string name = "";
            public int maxHp;
            public float attackPower;
        }

        private readonly struct Cell
        {
            public readonly PieceType Type;
            public readonly int Id;

            public Cell(PieceType type, int id)
            {
                Type = type;
                Id = id;
            }
        }

        private static readonly PieceType[] BasePieceTypes =
        {
            PieceType.FU,
            PieceType.KYO,
            PieceType.KEI,
            PieceType.GIN,
            PieceType.KIN,
            PieceType.GYOKU,
            PieceType.KAKU,
            PieceType.HI
        };

        // `shogi_rpg.html` の PIECES[type].moves をほぼそのまま移植（最大4マスまでの列挙）。
        private static readonly Dictionary<PieceType, Vector2Int[]> MovesByType = new()
        {
            [PieceType.FU] = new[] { new Vector2Int(0, -1) },
            [PieceType.KYO] = new[]
            {
                new Vector2Int(0, -1), new Vector2Int(0, -2), new Vector2Int(0, -3), new Vector2Int(0, -4)
            },
            [PieceType.KEI] = new[] { new Vector2Int(-1, -2), new Vector2Int(1, -2) },
            [PieceType.GIN] = new[]
            {
                new Vector2Int(-1, -1), new Vector2Int(0, -1), new Vector2Int(1, -1),
                new Vector2Int(-1, 1), new Vector2Int(1, 1)
            },
            [PieceType.KIN] = new[]
            {
                new Vector2Int(-1, -1), new Vector2Int(0, -1), new Vector2Int(1, -1),
                new Vector2Int(-1, 0), new Vector2Int(1, 0),
                new Vector2Int(0, 1)
            },
            [PieceType.GYOKU] = new[]
            {
                new Vector2Int(-1, -1), new Vector2Int(0, -1), new Vector2Int(1, -1),
                new Vector2Int(-1, 0), new Vector2Int(1, 0),
                new Vector2Int(-1, 1), new Vector2Int(0, 1), new Vector2Int(1, 1)
            },
            [PieceType.KAKU] = new[]
            {
                new Vector2Int(-1, -1), new Vector2Int(1, -1), new Vector2Int(-1, 1), new Vector2Int(1, 1),
                new Vector2Int(-2, -2), new Vector2Int(2, -2), new Vector2Int(-2, 2), new Vector2Int(2, 2),
                new Vector2Int(-3, -3), new Vector2Int(3, -3), new Vector2Int(-3, 3), new Vector2Int(3, 3),
                new Vector2Int(-4, -4), new Vector2Int(4, -4), new Vector2Int(-4, 4), new Vector2Int(4, 4)
            },
            [PieceType.HI] = new[]
            {
                new Vector2Int(0, -1), new Vector2Int(0, 1), new Vector2Int(-1, 0), new Vector2Int(1, 0),
                new Vector2Int(0, -2), new Vector2Int(0, 2), new Vector2Int(-2, 0), new Vector2Int(2, 0),
                new Vector2Int(0, -3), new Vector2Int(0, 3), new Vector2Int(-3, 0), new Vector2Int(3, 0),
                new Vector2Int(0, -4), new Vector2Int(0, 4), new Vector2Int(-4, 0), new Vector2Int(4, 0)
            }
        };

        // UI用（元HTMLの漢字を踏襲）
        private static readonly Dictionary<PieceType, string> KanjiByType = new()
        {
            [PieceType.FU] = "歩",
            [PieceType.KYO] = "香",
            [PieceType.KEI] = "桂",
            [PieceType.GIN] = "銀",
            [PieceType.KIN] = "金",
            [PieceType.GYOKU] = "玉",
            [PieceType.KAKU] = "角",
            [PieceType.HI] = "飛",
            [PieceType.TOKIN] = "と",
            [PieceType.NARIKYO] = "杏",
            [PieceType.NARIKEI] = "圭",
            [PieceType.NARIGIN] = "全",
            [PieceType.UMA] = "馬",
            [PieceType.RYU] = "竜"
        };

        private static readonly Dictionary<PieceType, Color> ColorByType = new()
        {
            [PieceType.FU] = new Color(0.545f, 0.271f, 0.075f),
            [PieceType.KYO] = new Color(0.133f, 0.545f, 0.133f),
            [PieceType.KEI] = new Color(0.255f, 0.412f, 0.882f),
            [PieceType.GIN] = new Color(0.439f, 0.502f, 0.565f),
            [PieceType.KIN] = new Color(0.855f, 0.647f, 0.125f),
            [PieceType.GYOKU] = new Color(1.0f, 0.082f, 0.576f),
            [PieceType.KAKU] = new Color(0.6f, 0.196f, 0.8f),
            [PieceType.HI] = new Color(0.863f, 0.078f, 0.235f),
            [PieceType.TOKIN] = new Color(1.0f, 0.843f, 0.0f),
            [PieceType.NARIKYO] = new Color(1.0f, 0.843f, 0.0f),
            [PieceType.NARIKEI] = new Color(1.0f, 0.843f, 0.0f),
            [PieceType.NARIGIN] = new Color(1.0f, 0.843f, 0.0f),
            [PieceType.UMA] = new Color(0.576f, 0.439f, 0.859f),
            [PieceType.RYU] = new Color(1.0f, 0.412f, 0.706f)
        };

        private static readonly Monster[] Monsters =
        {
            new Monster { id = 1, name = "座敷わらし", maxHp = 300, attackPower = 0.8f },
            new Monster { id = 2, name = "河童", maxHp = 500, attackPower = 1.0f },
            new Monster { id = 3, name = "天狗", maxHp = 800, attackPower = 1.2f },
            new Monster { id = 4, name = "鬼", maxHp = 1200, attackPower = 1.5f },
            new Monster { id = 5, name = "九尾の狐", maxHp = 2000, attackPower = 2.0f },
            new Monster { id = 6, name = "雪女", maxHp = 1400, attackPower = 1.6f },
            new Monster { id = 7, name = "一つ目小僧", maxHp = 1800, attackPower = 1.8f },
            new Monster { id = 8, name = "大蛇", maxHp = 2500, attackPower = 2.2f },
            new Monster { id = 9, name = "鵺", maxHp = 3000, attackPower = 2.5f },
            new Monster { id = 10, name = "閻魔大王", maxHp = 4000, attackPower = 3.0f }
        };

        private System.Random _rng = new System.Random();

        private Cell?[,] _board = new Cell?[BoardSize, BoardSize];
        private int _stage = 1;
        private int _playerHp = PlayerMaxHp;
        private int _monsterHp;
        private int _money;
        private int _combo;
        private GameState _state = GameState.Title;
        private Turn _turn = Turn.Player;
        private string _message = "";

        private Vector2Int? _selected;
        private Vector2Int[] _cachedValidMoves = Array.Empty<Vector2Int>();

        private readonly Dictionary<Color, Texture2D> _solidTextures = new();
        private GUIStyle _cellStyle = null!;
        private GUIStyle _labelStyle = null!;
        private GUIStyle _titleStyle = null!;
        private GUIStyle _messageStyle = null!;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Bootstrap()
        {
            // シーン無しで動かせるようにする（導入が簡単）
            ShogiRPGGame existing;
#if UNITY_2022_2_OR_NEWER
            existing = FindFirstObjectByType<ShogiRPGGame>();
#else
            existing = FindObjectOfType<ShogiRPGGame>();
#endif
            if (existing != null) return;
            var go = new GameObject("ShogiRPGGame");
            DontDestroyOnLoad(go);
            go.AddComponent<ShogiRPGGame>();
        }

        private void Awake()
        {
            Application.targetFrameRate = 60;
            SetupGuiStyles();
        }

        private void SetupGuiStyles()
        {
            _cellStyle = new GUIStyle(GUI.skin.button)
            {
                fontSize = 18,
                alignment = TextAnchor.MiddleCenter,
                richText = true
            };

            _labelStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 14,
                normal = { textColor = Color.white }
            };

            _titleStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 26,
                alignment = TextAnchor.MiddleCenter,
                normal = { textColor = Color.white }
            };

            _messageStyle = new GUIStyle(GUI.skin.label)
            {
                fontSize = 16,
                alignment = TextAnchor.MiddleLeft,
                normal = { textColor = new Color(1f, 0.95f, 0.8f) }
            };
        }

        private void StartGame()
        {
            _stage = 1;
            _playerHp = PlayerMaxHp;
            _money = 0;
            _combo = 0;
            _selected = null;
            _cachedValidMoves = Array.Empty<Vector2Int>();
            _state = GameState.Playing;
            _turn = Turn.Player;
            _message = "あなたのターン";
            _monsterHp = Monsters[_stage - 1].maxHp;

            InitializeBoard(_stage);
            StartCoroutine(ResolveInitialMatches());
        }

        private void NextStage()
        {
            _stage++;
            _combo = 0;
            _selected = null;
            _cachedValidMoves = Array.Empty<Vector2Int>();

            if (_stage > Monsters.Length)
            {
                _state = GameState.Victory;
                _message = "勝利！ すべての妖怪を退けた。";
                return;
            }

            _monsterHp = Monsters[_stage - 1].maxHp;
            _state = GameState.Playing;
            _turn = Turn.Player;
            _message = "あなたのターン";
            InitializeBoard(_stage);
            StartCoroutine(ResolveInitialMatches());
        }

        private void InitializeBoard(int stage)
        {
            for (var y = 0; y < BoardSize; y++)
            for (var x = 0; x < BoardSize; x++)
                _board[x, y] = new Cell(RandomBasePiece(), _rng.Next());

            // 元HTMLの「序盤は揃いやすい盤面を意図的に置く」ロジックを簡略移植
            var easyPatternCount = stage switch
            {
                <= 2 => 10 + _rng.Next(0, 6),
                <= 4 => 5 + _rng.Next(0, 4),
                <= 6 => 3 + _rng.Next(0, 3),
                <= 9 => 1 + _rng.Next(0, 2),
                _ => 0
            };

            for (var i = 0; i < easyPatternCount; i++)
            {
                var pieceType = RandomBasePiece();
                var pattern = _rng.NextDouble();

                if (pattern < 0.5 && stage <= 4)
                {
                    var y = _rng.Next(0, BoardSize);
                    var x = _rng.Next(0, BoardSize - 2);
                    _board[x, y] = new Cell(pieceType, _rng.Next());
                    _board[x + 1, y] = new Cell(pieceType, _rng.Next());
                    _board[x + 2, y] = new Cell(pieceType, _rng.Next());
                }
                else if (pattern < 0.7 && stage <= 6)
                {
                    var x = _rng.Next(0, BoardSize);
                    var y = _rng.Next(0, BoardSize - 2);
                    _board[x, y] = new Cell(pieceType, _rng.Next());
                    _board[x, y + 1] = new Cell(pieceType, _rng.Next());
                    _board[x, y + 2] = new Cell(pieceType, _rng.Next());
                }
                else
                {
                    var y = _rng.Next(0, BoardSize);
                    var x = _rng.Next(0, BoardSize - 1);
                    _board[x, y] = new Cell(pieceType, _rng.Next());
                    _board[x + 1, y] = new Cell(pieceType, _rng.Next());
                }
            }
        }

        private PieceType RandomBasePiece()
        {
            return BasePieceTypes[_rng.Next(0, BasePieceTypes.Length)];
        }

        private IEnumerator ResolveInitialMatches()
        {
            _turn = Turn.Resolving;
            yield return new WaitForSeconds(0.15f);
            // 初期マッチはダメージ/金なし（HTMLの isInitial=true と同等）
            while (TryResolveMatches(isInitial: true, isEnemy: false))
                yield return new WaitForSeconds(0.05f);
            _turn = Turn.Player;
            _message = "あなたのターン";
        }

        private void OnGUI()
        {
            var padding = 14f;
            var top = padding;
            var width = Screen.width - padding * 2f;

            GUI.color = new Color(0.10f, 0.10f, 0.18f);
            GUI.DrawTexture(new Rect(0, 0, Screen.width, Screen.height), SolidTexture(new Color(0.10f, 0.10f, 0.18f)));
            GUI.color = Color.white;

            GUI.Label(new Rect(padding, top, width, 32), "将棋RPG（Unity移植・コア）", _titleStyle);
            top += 42f;

            if (_state == GameState.Title)
            {
                DrawTitle(top, width, padding);
                return;
            }

            DrawHud(top, width, padding);
            top += 70f;

            DrawBoard(top, padding);
            top += BoardSize * 44f + 10f;

            DrawFooter(top, width, padding);
        }

        private void DrawTitle(float top, float width, float padding)
        {
            var rect = new Rect(padding, top, width, 28);
            GUI.Label(rect, "9×9の盤面で駒を動かし、3マッチで妖怪を倒す。", _labelStyle);
            rect.y += 34;
            GUI.Label(rect, "揃いが止まると敵が手を指します。", _labelStyle);
            rect.y += 52;

            if (GUI.Button(new Rect(padding, rect.y, 220, 44), "ゲーム開始"))
            {
                StartGame();
            }
        }

        private void DrawHud(float top, float width, float padding)
        {
            var monster = Monsters[Mathf.Clamp(_stage - 1, 0, Monsters.Length - 1)];
            var hud = new Rect(padding, top, width, 70);
            GUI.color = new Color(0f, 0f, 0f, 0.25f);
            GUI.DrawTexture(hud, SolidTexture(new Color(0f, 0f, 0f, 0.25f)));
            GUI.color = Color.white;

            var line1 = $"Stage {_stage}/{Monsters.Length}  敵: {monster.name}  HP: {_monsterHp}/{monster.maxHp}";
            var line2 = $"あなた HP: {_playerHp}/{PlayerMaxHp}  金: {_money}  コンボ: {_combo}  ターン: {_turn}";
            GUI.Label(new Rect(padding + 10, top + 10, width - 20, 20), line1, _labelStyle);
            GUI.Label(new Rect(padding + 10, top + 32, width - 20, 20), line2, _labelStyle);
            GUI.Label(new Rect(padding + 10, top + 52, width - 20, 20), _message, _messageStyle);
        }

        private void DrawFooter(float top, float width, float padding)
        {
            var x = padding;

            if (_state == GameState.StageClear)
            {
                GUI.Label(new Rect(x, top, width, 24), "ステージクリア！", _labelStyle);
                top += 28;
                if (GUI.Button(new Rect(x, top, 240, 40), "次のステージへ"))
                    NextStage();
                return;
            }

            if (_state == GameState.GameOver)
            {
                GUI.Label(new Rect(x, top, width, 24), "ゲームオーバー", _labelStyle);
                top += 28;
                if (GUI.Button(new Rect(x, top, 240, 40), "タイトルへ"))
                {
                    _state = GameState.Title;
                    _message = "";
                }
                return;
            }

            if (_state == GameState.Victory)
            {
                GUI.Label(new Rect(x, top, width, 24), "全ステージクリア！", _labelStyle);
                top += 28;
                if (GUI.Button(new Rect(x, top, 240, 40), "タイトルへ"))
                {
                    _state = GameState.Title;
                    _message = "";
                }
                return;
            }

            if (GUI.Button(new Rect(x, top, 160, 34), "リスタート"))
                StartGame();
        }

        private void DrawBoard(float top, float left)
        {
            var cellSize = 42f;
            var gap = 2f;

            for (var y = 0; y < BoardSize; y++)
            for (var x = 0; x < BoardSize; x++)
            {
                var r = new Rect(left + x * (cellSize + gap), top + y * (cellSize + gap), cellSize, cellSize);
                DrawCell(r, x, y);
            }
        }

        private void DrawCell(Rect rect, int x, int y)
        {
            var cell = _board[x, y];
            if (cell == null)
            {
                GUI.Button(rect, "", _cellStyle);
                return;
            }

            var type = cell.Value.Type;
            var isSelected = _selected.HasValue && _selected.Value.x == x && _selected.Value.y == y;
            var isValidMove = IsInCachedValidMoves(x, y);

            var bg = ColorByType.TryGetValue(type, out var c) ? c : Color.gray;
            if (isValidMove) bg = Color.Lerp(bg, Color.white, 0.35f);
            if (isSelected) bg = Color.Lerp(bg, Color.cyan, 0.45f);

            _cellStyle.normal.background = SolidTexture(bg);
            _cellStyle.hover.background = _cellStyle.normal.background;
            _cellStyle.active.background = _cellStyle.normal.background;
            _cellStyle.normal.textColor = Color.black;

            var label = KanjiByType.TryGetValue(type, out var k) ? k : type.ToString();
            var clicked = GUI.Button(rect, label, _cellStyle);
            if (!clicked) return;

            HandleClick(x, y);
        }

        private bool IsInCachedValidMoves(int x, int y)
        {
            for (var i = 0; i < _cachedValidMoves.Length; i++)
            {
                var p = _cachedValidMoves[i];
                if (p.x == x && p.y == y) return true;
            }
            return false;
        }

        private void HandleClick(int x, int y)
        {
            if (_state != GameState.Playing) return;
            if (_turn != Turn.Player) return;

            if (_selected == null)
            {
                _selected = new Vector2Int(x, y);
                _cachedValidMoves = ValidMovesForSelected();
                return;
            }

            var from = _selected.Value;
            if (from.x == x && from.y == y)
            {
                _selected = null;
                _cachedValidMoves = Array.Empty<Vector2Int>();
                return;
            }

            var canMove = false;
            for (var i = 0; i < _cachedValidMoves.Length; i++)
            {
                var p = _cachedValidMoves[i];
                if (p.x == x && p.y == y) { canMove = true; break; }
            }

            if (!canMove)
            {
                _selected = new Vector2Int(x, y);
                _cachedValidMoves = ValidMovesForSelected();
                return;
            }

            Swap(from.x, from.y, x, y);
            _selected = null;
            _cachedValidMoves = Array.Empty<Vector2Int>();
            _turn = Turn.Resolving;
            _message = "攻撃中...";
            StartCoroutine(ResolveTurn(isEnemy: false));
        }

        private Vector2Int[] ValidMovesForSelected()
        {
            if (_selected == null) return Array.Empty<Vector2Int>();
            var from = _selected.Value;
            var cell = _board[from.x, from.y];
            if (cell == null) return Array.Empty<Vector2Int>();

            var type = cell.Value.Type;
            if (!MovesByType.TryGetValue(type, out var moves)) return Array.Empty<Vector2Int>();

            var tmp = new List<Vector2Int>(moves.Length);
            for (var i = 0; i < moves.Length; i++)
            {
                var to = from + moves[i];
                if (to.x < 0 || to.x >= BoardSize || to.y < 0 || to.y >= BoardSize) continue;
                tmp.Add(to);
            }
            return tmp.ToArray();
        }

        private void Swap(int x1, int y1, int x2, int y2)
        {
            var a = _board[x1, y1];
            var b = _board[x2, y2];
            _board[x1, y1] = b;
            _board[x2, y2] = a;
        }

        private IEnumerator ResolveTurn(bool isEnemy)
        {
            yield return new WaitForSeconds(0.15f);

            while (TryResolveMatches(isInitial: false, isEnemy: isEnemy))
                yield return new WaitForSeconds(0.05f);

            if (_state != GameState.Playing)
                yield break;

            if (isEnemy)
            {
                _combo = 0;
                _turn = Turn.Player;
                _message = "あなたのターン";
            }
            else
            {
                _combo = 0;
                _turn = Turn.Enemy;
                _message = $"{Monsters[_stage - 1].name}の思考中...";
                yield return new WaitForSeconds(0.6f);
                ExecuteAiTurn();
            }
        }

        private void ExecuteAiTurn()
        {
            if (_state != GameState.Playing) return;
            if (_turn != Turn.Enemy) return;

            var move = FindBestMove();
            if (move == null)
            {
                _turn = Turn.Player;
                _message = "あなたのターン";
                return;
            }

            Swap(move.Value.from.x, move.Value.from.y, move.Value.to.x, move.Value.to.y);
            _turn = Turn.Resolving;
            _message = $"{Monsters[_stage - 1].name}の攻撃！";
            StartCoroutine(ResolveTurn(isEnemy: true));
        }

        private readonly struct AiMove
        {
            public readonly Vector2Int from;
            public readonly Vector2Int to;
            public readonly int score;

            public AiMove(Vector2Int from, Vector2Int to, int score)
            {
                this.from = from;
                this.to = to;
                this.score = score;
            }
        }

        // `findBestMove` と同じ方針：合法手を全部試して、マッチ数が最大のものを選ぶ
        private AiMove? FindBestMove()
        {
            AiMove? best = null;
            var bestScore = 0;

            for (var y = 0; y < BoardSize; y++)
            for (var x = 0; x < BoardSize; x++)
            {
                var cell = _board[x, y];
                if (cell == null) continue;

                if (!MovesByType.TryGetValue(cell.Value.Type, out var moves)) continue;
                for (var i = 0; i < moves.Length; i++)
                {
                    var to = new Vector2Int(x + moves[i].x, y + moves[i].y);
                    if (to.x < 0 || to.x >= BoardSize || to.y < 0 || to.y >= BoardSize) continue;

                    Swap(x, y, to.x, to.y);
                    var score = CountMatchesOnBoard();
                    Swap(x, y, to.x, to.y);

                    if (score <= 0) continue;
                    if (score > bestScore || best == null)
                    {
                        bestScore = score;
                        best = new AiMove(new Vector2Int(x, y), to, score);
                    }
                }
            }

            return best;
        }

        private int CountMatchesOnBoard()
        {
            var marks = FindMatchesMarks();
            var count = 0;
            for (var y = 0; y < BoardSize; y++)
            for (var x = 0; x < BoardSize; x++)
                if (marks[x, y]) count++;
            return count;
        }

        // HTMLの findMatches() 相当：横/縦/斜めの3一致をマーク
        private bool[,] FindMatchesMarks()
        {
            var marks = new bool[BoardSize, BoardSize];

            // 横
            for (var y = 0; y < BoardSize; y++)
            for (var x = 0; x < BoardSize - 2; x++)
            {
                var a = _board[x, y];
                var b = _board[x + 1, y];
                var c = _board[x + 2, y];
                if (a == null || b == null || c == null) continue;
                if (a.Value.Type != b.Value.Type || a.Value.Type != c.Value.Type) continue;
                marks[x, y] = true;
                marks[x + 1, y] = true;
                marks[x + 2, y] = true;
            }

            // 縦
            for (var x = 0; x < BoardSize; x++)
            for (var y = 0; y < BoardSize - 2; y++)
            {
                var a = _board[x, y];
                var b = _board[x, y + 1];
                var c = _board[x, y + 2];
                if (a == null || b == null || c == null) continue;
                if (a.Value.Type != b.Value.Type || a.Value.Type != c.Value.Type) continue;
                marks[x, y] = true;
                marks[x, y + 1] = true;
                marks[x, y + 2] = true;
            }

            // 斜め（＼）
            for (var y = 0; y < BoardSize - 2; y++)
            for (var x = 0; x < BoardSize - 2; x++)
            {
                var a = _board[x, y];
                var b = _board[x + 1, y + 1];
                var c = _board[x + 2, y + 2];
                if (a == null || b == null || c == null) continue;
                if (a.Value.Type != b.Value.Type || a.Value.Type != c.Value.Type) continue;
                marks[x, y] = true;
                marks[x + 1, y + 1] = true;
                marks[x + 2, y + 2] = true;
            }

            // 斜め（／）
            for (var y = 0; y < BoardSize - 2; y++)
            for (var x = 2; x < BoardSize; x++)
            {
                var a = _board[x, y];
                var b = _board[x - 1, y + 1];
                var c = _board[x - 2, y + 2];
                if (a == null || b == null || c == null) continue;
                if (a.Value.Type != b.Value.Type || a.Value.Type != c.Value.Type) continue;
                marks[x, y] = true;
                marks[x - 1, y + 1] = true;
                marks[x - 2, y + 2] = true;
            }

            return marks;
        }

        private bool TryResolveMatches(bool isInitial, bool isEnemy)
        {
            var marks = FindMatchesMarks();

            var matchCount = 0;
            for (var y = 0; y < BoardSize; y++)
            for (var x = 0; x < BoardSize; x++)
                if (marks[x, y]) matchCount++;

            if (matchCount == 0)
                return false;

            // remove
            for (var y = 0; y < BoardSize; y++)
            for (var x = 0; x < BoardSize; x++)
                if (marks[x, y]) _board[x, y] = null;

            var points = matchCount * 10;
            var comboMultiplier = isInitial ? 1 : (_combo + 1);
            var monster = Monsters[_stage - 1];
            var damage = Mathf.FloorToInt(points * comboMultiplier * (isEnemy ? monster.attackPower : 1f));

            if (!isInitial)
            {
                _combo++;

                if (isEnemy)
                {
                    _playerHp = Mathf.Max(0, _playerHp - damage);
                    _message = $"{monster.name}の攻撃！ {damage}ダメージ";
                    if (_playerHp <= 0)
                    {
                        _state = GameState.GameOver;
                        _turn = Turn.Resolving;
                        return true;
                    }
                }
                else
                {
                    _monsterHp = Mathf.Max(0, _monsterHp - damage);
                    _money += matchCount; // 元HTMLの earnedMoney = points/10 を簡略反映
                    _message = $"⚔️ {damage}ダメージ！ +{matchCount}円 (×{comboMultiplier})";
                    if (_monsterHp <= 0)
                    {
                        _state = (_stage >= Monsters.Length) ? GameState.Victory : GameState.StageClear;
                        _turn = Turn.Resolving;
                        _message = (_state == GameState.Victory) ? "勝利！ 最後の妖怪を倒した。" : "ステージクリア！";
                        return true;
                    }
                }
            }

            ApplyGravityAndRefill();
            return true;
        }

        // HTMLの applyGravity() 相当：下に詰めて、空きをランダム補充
        private void ApplyGravityAndRefill()
        {
            for (var x = 0; x < BoardSize; x++)
            {
                var write = BoardSize - 1;
                for (var y = BoardSize - 1; y >= 0; y--)
                {
                    if (_board[x, y] == null) continue;
                    if (y != write)
                    {
                        _board[x, write] = _board[x, y];
                        _board[x, y] = null;
                    }
                    write--;
                }
            }

            for (var y = 0; y < BoardSize; y++)
            for (var x = 0; x < BoardSize; x++)
            {
                if (_board[x, y] != null) continue;
                _board[x, y] = new Cell(RandomBasePiece(), _rng.Next());
            }
        }

        private Texture2D SolidTexture(Color c)
        {
            // Colorはfloatなのでキーがぶれる。近似で丸めた色をキーにする
            var key = new Color(
                Mathf.Round(c.r * 255f) / 255f,
                Mathf.Round(c.g * 255f) / 255f,
                Mathf.Round(c.b * 255f) / 255f,
                Mathf.Round(c.a * 255f) / 255f
            );

            if (_solidTextures.TryGetValue(key, out var tex) && tex != null)
                return tex;

            tex = new Texture2D(1, 1, TextureFormat.RGBA32, false);
            tex.SetPixel(0, 0, key);
            tex.Apply();
            _solidTextures[key] = tex;
            return tex;
        }
    }
}
