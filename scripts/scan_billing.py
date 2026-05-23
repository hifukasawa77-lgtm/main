#!/usr/bin/env python3
"""
API課金検出スキャナー
リポジトリ内のコードを静的解析し、有料APIの使用箇所を検出する

使い方:
    python scripts/scan_billing.py [スキャン対象ディレクトリ]
    python scripts/scan_billing.py          # カレントディレクトリをスキャン
    python scripts/scan_billing.py /path/to/repo
"""

import os
import re
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import List

# ─── 設定 ─────────────────────────────────────────────────────────────────────

SKIP_DIRS = {
    ".git", "node_modules", ".edge-test-profile", "__pycache__",
    ".venv", "venv", "dist", "build", ".next", ".nuxt", "coverage",
}

TARGET_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".json",
    ".env", ".yaml", ".yml", ".sh", ".rb", ".go", ".toml",
}

# スキャン対象外ファイル（このスクリプト自身など）
SKIP_FILENAMES = {"scan_billing.py", "package-lock.json", "yarn.lock"}

# ─── 検出パターン ─────────────────────────────────────────────────────────────

# (パターン, 説明, 重要度)  重要度: high=APIキー疑い / medium=SDK使用 / low=API呼び出し
PATTERNS = {
    "Anthropic / Claude": [
        (r"sk-ant-api03-[A-Za-z0-9\-_]{93}", "APIキー (実際のキー形式)",           "high"),
        (r"sk-ant-[A-Za-z0-9\-_]{10,}",      "APIキー (旧形式の可能性)",           "high"),
        (r"ANTHROPIC_API_KEY\s*=\s*['\"]?sk", "環境変数にキーが直書き",             "high"),
        (r"ANTHROPIC_API_KEY",                "Anthropic APIキー参照",              "medium"),
        (r"from\s+anthropic\b",               "anthropic SDK インポート",           "medium"),
        (r"require\(['\"]anthropic['\"]",     "anthropic SDK require",             "medium"),
        (r"@anthropic-ai/sdk",                "@anthropic-ai/sdk 使用",            "medium"),
        (r"api\.anthropic\.com",              "Anthropic APIエンドポイント呼び出し", "low"),
        (r"messages\.create\(",               "messages.create() 呼び出し",        "low"),
        (r"claude-opus|claude-sonnet|claude-haiku|claude-3|claude-2",
                                              "Claude モデル名の指定",             "low"),
    ],
    "OpenAI / GPT": [
        (r"sk-[A-Za-z0-9]{48}",              "OpenAI APIキー (旧形式)",            "high"),
        (r"sk-proj-[A-Za-z0-9\-_]{50,}",     "OpenAI APIキー (新形式)",            "high"),
        (r"OPENAI_API_KEY\s*=\s*['\"]?sk",   "環境変数にキーが直書き",             "high"),
        (r"OPENAI_API_KEY",                   "OpenAI APIキー参照",                "medium"),
        (r"from\s+openai\b",                  "openai SDK インポート",              "medium"),
        (r"require\(['\"]openai['\"]",        "openai SDK require",                "medium"),
        (r"api\.openai\.com",                 "OpenAI APIエンドポイント呼び出し",   "low"),
        (r"chat\.completions\.create",        "chat.completions.create() 呼び出し","low"),
        (r"gpt-4|gpt-3\.5|gpt-4o|o1-mini|o3-mini|o1-preview",
                                              "GPT モデル名の指定",                "low"),
    ],
    "AWS": [
        (r"AKIA[0-9A-Z]{16}",                "AWS アクセスキーID",                 "high"),
        (r"AWS_ACCESS_KEY_ID\s*=\s*AKIA",    "環境変数にキーが直書き",             "high"),
        (r"AWS_SECRET_ACCESS_KEY\s*=\s*\S{10,}",
                                             "シークレットキーが直書き",           "high"),
        (r"AWS_ACCESS_KEY_ID",               "AWSアクセスキー参照",               "medium"),
        (r"AWS_SECRET_ACCESS_KEY",           "AWSシークレットキー参照",           "medium"),
        (r"import\s+boto3|from\s+boto3",     "boto3 (AWS Python SDK) インポート", "medium"),
        (r"require\(['\"]aws-sdk['\"]",      "aws-sdk (Node.js) require",         "medium"),
        (r"from\s+['\"]\@aws-sdk",           "@aws-sdk インポート",               "medium"),
        (r"\.amazonaws\.com",                "AWS エンドポイント呼び出し",         "low"),
        (r"boto3\.client\(|boto3\.resource\(","boto3 クライアント生成",           "low"),
        (r"new AWS\.",                        "AWS SDK クライアント生成",          "low"),
    ],
    "Google / Firebase / GCP": [
        (r"AIza[0-9A-Za-z\-_]{35}",          "Google APIキー",                    "high"),
        (r"GOOGLE_API_KEY\s*=\s*['\"]?AIza", "環境変数にキーが直書き",            "high"),
        (r"GOOGLE_API_KEY|FIREBASE_API_KEY", "Google/Firebase APIキー参照",       "medium"),
        (r"from\s+google\.cloud",            "google-cloud SDK インポート",        "medium"),
        (r"require\(['\"]firebase",          "firebase SDK require",              "medium"),
        (r"from\s+['\"]firebase",            "firebase SDK インポート",           "medium"),
        (r"@google-cloud/",                  "@google-cloud パッケージ使用",      "medium"),
        (r"\.googleapis\.com",               "Google APIs エンドポイント",        "low"),
        (r"firebase\.initializeApp|initializeApp\(",
                                             "Firebase 初期化",                   "low"),
        (r"getFirestore\(|getAuth\(|getStorage\(",
                                             "Firebase サービス取得",             "low"),
        (r"generativelanguage\.googleapis\.com|gemini-",
                                             "Gemini API 使用",                   "low"),
    ],
}

# ─── データクラス ──────────────────────────────────────────────────────────────

@dataclass
class Finding:
    service: str
    severity: str      # high / medium / low
    description: str
    file: str
    line_no: int
    snippet: str

@dataclass
class ScanResult:
    findings: List[Finding] = field(default_factory=list)
    scanned_files: int = 0
    skipped_files: int = 0

# ─── スキャン処理 ──────────────────────────────────────────────────────────────

def should_skip(path: Path) -> bool:
    """スキャン対象外かどうかを判定"""
    for part in path.parts:
        if part in SKIP_DIRS:
            return True
    if path.name in SKIP_FILENAMES:
        return True
    if path.suffix not in TARGET_EXTENSIONS:
        return True
    # バイナリファイルを除外（大きすぎるファイルも除外）
    try:
        if path.stat().st_size > 1_000_000:  # 1MB超はスキップ
            return True
    except OSError:
        return True
    return False


def scan_file(file_path: Path, root: Path) -> List[Finding]:
    """1ファイルをスキャンしてFindingリストを返す"""
    findings = []
    rel_path = str(file_path.relative_to(root))

    try:
        content = file_path.read_text(encoding="utf-8", errors="replace")
    except (OSError, PermissionError):
        return findings

    lines = content.splitlines()

    for service, patterns in PATTERNS.items():
        for pattern, description, severity in patterns:
            for line_no, line in enumerate(lines, start=1):
                if re.search(pattern, line, re.IGNORECASE):
                    # スニペットを50文字以内に収める（APIキーの一部マスク）
                    snippet = line.strip()
                    if severity == "high":
                        # 実際のシークレット値をマスクして表示
                        snippet = re.sub(
                            r"(sk-[A-Za-z0-9\-_]{8})[A-Za-z0-9\-_]+",
                            r"\1***",
                            snippet,
                        )
                        snippet = re.sub(
                            r"(AKIA[0-9A-Z]{4})[0-9A-Z]+",
                            r"\1***",
                            snippet,
                        )
                        snippet = re.sub(
                            r"(AIza[0-9A-Za-z\-_]{4})[0-9A-Za-z\-_]+",
                            r"\1***",
                            snippet,
                        )
                    if len(snippet) > 100:
                        snippet = snippet[:97] + "..."

                    findings.append(Finding(
                        service=service,
                        severity=severity,
                        description=description,
                        file=rel_path,
                        line_no=line_no,
                        snippet=snippet,
                    ))
    return findings


def scan_directory(root_path: Path) -> ScanResult:
    """ディレクトリ配下を再帰スキャン"""
    result = ScanResult()

    for path in sorted(root_path.rglob("*")):
        if not path.is_file():
            continue
        if should_skip(path):
            result.skipped_files += 1
            continue
        result.scanned_files += 1
        result.findings.extend(scan_file(path, root_path))

    return result

# ─── レポート出力 ──────────────────────────────────────────────────────────────

SEVERITY_LABEL = {
    "high":   "🔴 HIGH  ",
    "medium": "🟡 MEDIUM",
    "low":    "🔵 LOW   ",
}

SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def print_report(result: ScanResult, root_path: Path) -> None:
    print()
    print("=" * 70)
    print("  API課金検出スキャナー レポート")
    print(f"  スキャン対象: {root_path}")
    print("=" * 70)
    print(f"  スキャンファイル数: {result.scanned_files}  スキップ: {result.skipped_files}")
    print()

    if not result.findings:
        print("  ✅ 課金APIの使用は検出されませんでした。")
        print("=" * 70)
        return

    # サービス別・重要度別に集計
    by_service: dict[str, List[Finding]] = {}
    for f in result.findings:
        by_service.setdefault(f.service, []).append(f)

    total_high   = sum(1 for f in result.findings if f.severity == "high")
    total_medium = sum(1 for f in result.findings if f.severity == "medium")
    total_low    = sum(1 for f in result.findings if f.severity == "low")

    print(f"  検出件数: 計 {len(result.findings)} 件")
    print(f"    🔴 HIGH (APIキー疑い)  : {total_high} 件")
    print(f"    🟡 MEDIUM (SDK使用)    : {total_medium} 件")
    print(f"    🔵 LOW (API呼び出し)   : {total_low} 件")
    print()

    for service, findings in sorted(by_service.items()):
        findings_sorted = sorted(findings, key=lambda f: SEVERITY_ORDER[f.severity])
        high_count = sum(1 for f in findings if f.severity == "high")
        print(f"─── {service} ({len(findings)}件, HIGH:{high_count}) " + "─" * 20)
        for f in findings_sorted:
            label = SEVERITY_LABEL[f.severity]
            print(f"  {label}  {f.file}:{f.line_no}")
            print(f"           {f.description}")
            print(f"           > {f.snippet}")
        print()

    print("=" * 70)
    print("  【凡例】")
    print("  🔴 HIGH   — APIキーが直書きされている可能性。即確認が必要")
    print("  🟡 MEDIUM — SDKがインポートされ、実行時に課金される可能性あり")
    print("  🔵 LOW    — API呼び出しパターン。意図的なら問題なし")
    print()
    print("  【対処法】")
    print("  1. HIGH: キーを環境変数へ移し、.gitignore で .env を除外する")
    print("  2. MEDIUM: そのSDKが本当に必要か確認し、不要なら依存を削除する")
    print("  3. LOW: 意図しないAPI呼び出しがないか、呼び出し元のロジックを確認する")
    print("=" * 70)
    print()


# ─── エントリーポイント ────────────────────────────────────────────────────────

def main() -> None:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
    root = root.resolve()

    if not root.exists():
        print(f"エラー: ディレクトリが見つかりません: {root}", file=sys.stderr)
        sys.exit(1)

    print(f"スキャン中: {root} ...")
    result = scan_directory(root)
    print_report(result, root)

    # 終了コード: HIGHが1件以上あれば1を返す（CI連携用）
    high_count = sum(1 for f in result.findings if f.severity == "high")
    sys.exit(1 if high_count > 0 else 0)


if __name__ == "__main__":
    main()
