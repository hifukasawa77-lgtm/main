"""
将棋RPG開発ハーネス: Planner → Generator → Tester の3エージェント構成
"""

import anyio
import json
from claude_agent_sdk import (
    query,
    ClaudeAgentOptions,
    AgentDefinition,
    ResultMessage,
    SystemMessage,
)

CWD = "/home/user/hide_0001"


# ─────────────────────────────────────────────
# Step 1: Planner
# ─────────────────────────────────────────────
async def run_planner(task: str) -> str:
    """タスクを受け取り、実装計画書(JSON)を返す"""
    print("\n[Planner] 計画立案中...")

    result_text = ""
    async for message in query(
        prompt=f"""
あなたはソフトウェアアーキテクトです。
以下のタスクについて、具体的な実装計画を立ててください。

対象ファイル: shogi_rpg_enhanced.jsx (将棋駒パズルRPGゲーム)
タスク: {task}

必ず以下のJSON形式で計画を出力してください:
{{
  "task_summary": "タスクの要約",
  "target_file": "変更対象ファイル",
  "steps": [
    {{
      "step": 1,
      "description": "何をするか",
      "location": "変更箇所の説明(関数名・行番号など)",
      "approach": "具体的な実装方針"
    }}
  ],
  "test_criteria": ["テスト基準1", "テスト基準2"]
}}
""",
        options=ClaudeAgentOptions(
            cwd=CWD,
            allowed_tools=["Read", "Glob", "Grep"],
            system_prompt=(
                "あなたはコードを読み込み、実装計画を立てる専門家です。"
                "コードを変更せず、計画書のみを作成してください。"
                "出力は必ずJSON形式にしてください。"
            ),
            max_turns=10,
        ),
    ):
        if isinstance(message, ResultMessage):
            result_text = message.result

    print(f"[Planner] 計画完了:\n{result_text[:200]}...")
    return result_text


# ─────────────────────────────────────────────
# Step 2: Generator
# ─────────────────────────────────────────────
async def run_generator(plan: str) -> str:
    """計画書を受け取り、コードを実装して変更内容を返す"""
    print("\n[Generator] コード生成中...")

    result_text = ""
    async for message in query(
        prompt=f"""
以下の実装計画に従って、shogi_rpg_enhanced.jsx を修正してください。

実装計画:
{plan}

重要:
- 既存コードの品質・スタイルを維持してください
- 最小限の変更にとどめてください
- 変更完了後、変更したファイル・関数・行番号の概要を報告してください
""",
        options=ClaudeAgentOptions(
            cwd=CWD,
            allowed_tools=["Read", "Edit", "Write", "Glob", "Grep"],
            permission_mode="acceptEdits",
            system_prompt=(
                "あなたはReact/JSXエキスパートです。"
                "計画書に従い、正確・最小限にコードを実装してください。"
            ),
            max_turns=20,
        ),
    ):
        if isinstance(message, ResultMessage):
            result_text = message.result

    print(f"[Generator] 実装完了:\n{result_text[:200]}...")
    return result_text


# ─────────────────────────────────────────────
# Step 3: Tester
# ─────────────────────────────────────────────
async def run_tester(plan: str, generator_output: str) -> dict:
    """実装結果を検証し、テスト結果を返す"""
    print("\n[Tester] テスト実行中...")

    result_text = ""
    async for message in query(
        prompt=f"""
以下の実装が正しく完了しているか検証してください。

実装計画:
{plan}

Generatorの報告:
{generator_output}

検証してください:
1. shogi_rpg_enhanced.jsx の変更箇所を読んで確認
2. 実装計画の各ステップが実施されているか確認
3. JSXの文法エラーがないか確認 (node -e でパースチェック可)

最終的に以下のJSON形式で結果を報告してください:
{{
  "status": "PASS" または "FAIL",
  "checks": [
    {{"item": "確認項目", "result": "OK/NG", "note": "備考"}}
  ],
  "summary": "総評"
}}
""",
        options=ClaudeAgentOptions(
            cwd=CWD,
            allowed_tools=["Read", "Bash", "Glob", "Grep"],
            system_prompt=(
                "あなたはQAエンジニアです。"
                "実装が計画通りに行われているか検証し、JSON形式でレポートしてください。"
            ),
            max_turns=15,
        ),
    ):
        if isinstance(message, ResultMessage):
            result_text = message.result

    # JSONパース試行
    test_result = {"status": "UNKNOWN", "raw": result_text}
    try:
        start = result_text.find("{")
        end = result_text.rfind("}") + 1
        if start != -1 and end > start:
            test_result = json.loads(result_text[start:end])
    except json.JSONDecodeError:
        test_result["raw"] = result_text

    print(f"[Tester] テスト結果: {test_result.get('status', 'UNKNOWN')}")
    return test_result


# ─────────────────────────────────────────────
# メイン: ハーネス実行
# ─────────────────────────────────────────────
async def run_harness(task: str):
    print("=" * 60)
    print(f"ハーネス開始: {task}")
    print("=" * 60)

    # Step 1: 計画
    plan = await run_planner(task)

    # Step 2: 実装
    generator_output = await run_generator(plan)

    # Step 3: テスト
    test_result = await run_tester(plan, generator_output)

    # 最終レポート
    print("\n" + "=" * 60)
    print("最終レポート")
    print("=" * 60)
    print(f"ステータス: {test_result.get('status', 'UNKNOWN')}")
    if "checks" in test_result:
        for check in test_result["checks"]:
            mark = "✓" if check.get("result") == "OK" else "✗"
            print(f"  {mark} {check.get('item')}: {check.get('note', '')}")
    if "summary" in test_result:
        print(f"\n総評: {test_result['summary']}")

    return test_result


if __name__ == "__main__":
    import sys

    task = sys.argv[1] if len(sys.argv) > 1 else "ゲームのスコア表示をステージクリア後に3秒間表示するように変更する"
    anyio.run(run_harness, task)
