# 自作ローカルLLM / Build Your Own Local LLM

16GBノートPC（Windows・GPUなし）だけで、ゼロから事前学習する日本語ミニLLM。
外部APIは一切使わない完全ローカル構成です。

A miniature Japanese LLM pretrained **from scratch** on a 16GB laptop (CPU only).
No external APIs — fully local.

## できること / What it does

- Llama系アーキテクチャ（RMSNorm / RoPE / SwiGLU / KVキャッシュ）の自前実装で仕組みを学べる
- 青空文庫 + Wikipedia日本語 + TinyStories で事前学習
- 指示チューニングでチャット形式に対応
- CLIチャット＆ローカルAPI（ゲームのNPC会話などに組み込み可能）

> **期待値について**: CPUで学習できるのは数百万〜数千万パラメータ級です。
> ChatGPTのような賢さにはなりませんが、「自分で作ったLLMが日本語を話す」体験ができます。

## セットアップ / Setup（Windows）

```bash
cd local_llm
python -m venv .venv
.venv\Scripts\activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

## 学習済みモデル同梱 / Pretrained model included

リポジトリに **学習済みのmicroチャットモデル**（3.3Mパラメータ）と対応トークナイザを同梱しています。
日本語Wikipedia＋青空文庫 約5,400万トークンで事前学習（検証perplexity 69）→ dolly-15k-ja でSFT済み。
セットアップ後すぐに試せます:

```bash
python chat.py                  # 対話モード（checkpoints/chat.pt を自動使用）
python serve.py                 # ローカルAPI起動
```

※ microサイズなので応答は「日本語の体裁が整ったヨチヨチ歩き」レベルです。
   本格的な賢さは Step 1 以降の base 学習で目指します。

## 手順 / Steps

### Step 0: まず30分で全体を動かす（micro・サンプルデータ）

ネットワーク不要の内蔵サンプルでパイプライン全体を検証します。

```bash
python data_prepare.py --sample                 # 擬似コーパス生成（約2MB）
python tokenizer_train.py --vocab-size 2000     # トークナイザ学習（数秒）
python data_prepare.py --encode                 # train.bin / val.bin 作成
python train.py --preset micro --max-steps 300  # 学習（CPUで10〜30分）
python chat.py --ckpt checkpoints/latest.pt --raw --prompt "むかしむかし、"
```

lossが下がり、サンプル文体っぽい日本語が出力されれば成功です。

### Step 1: 本番コーパスで事前学習（base）

```bash
# コーパス取得（合計 約430MB。回線により数十分）
python data_prepare.py --download all

# トークナイザを本番語彙で学習し直し → 再トークン化
python tokenizer_train.py --vocab-size 16000
python data_prepare.py --encode

# 事前学習。中断したら --resume で続きから（夜間に数回に分けてOK）
python train.py --preset base --max-steps 30000 --resume
```

進捗は `logs/train_log.csv` に記録されます。検証損失（val_loss）が下がり続けている間は学習を続ける価値があります。

### Step 2: チャット形式へのファインチューニング

```bash
python finetune_chat.py --preset base --ckpt checkpoints/latest.pt
python chat.py        # checkpoints/chat.pt と対話
```

### Step 3: ゲームへの組み込み（ローカルAPI）

```bash
python serve.py       # http://127.0.0.1:8765 で起動
```

ゲームHTML側からは:

```js
const res = await fetch("http://127.0.0.1:8765/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages: [{ role: "user", content: "こんにちは、旅の人" }] })
});
const { text } = await res.json();
```

将来のブラウザ内推論（onnxruntime-web）用に `export_onnx.py` も用意しています。

## 学習時間の目安 / Training time（4〜8コアCPUの実測ベース概算）

| プリセット | パラメータ数 | 実効スループット | 目安 |
|---|---|---|---|
| micro | 約1.6M（語彙2k時） | 数千 tok/s | 300step ≒ 10〜30分 |
| small | 約13M | 1000〜2000 tok/s | 一晩で 20〜50Mトークン |
| base | 約33M | 300〜800 tok/s | 30000step（約490Mトークン処理）≒ 数日。`--resume` で分割推奨 |

※ baseを数日回せない場合は `--max-steps 10000` 程度でも文章の体裁は学習できます。

## ファイル構成 / Files

| ファイル | 役割 |
|---|---|
| `config.py` | モデルサイズのプリセット（micro / small / base） |
| `model.py` | Transformer本体（RMSNorm・RoPE・SwiGLU・KVキャッシュ） |
| `tokenizer_train.py` | SentencePiece BPEトークナイザ学習 |
| `data_prepare.py` | コーパス取得・トークン化（.bin生成） |
| `train.py` | 事前学習ループ（中断・再開・CSVログ） |
| `finetune_chat.py` | チャット形式への指示チューニング |
| `chat.py` | CLIチャット |
| `serve.py` | ローカルAPI（FastAPI、ゲーム組み込み用） |
| `export_onnx.py` | ブラウザ実行用ONNXエクスポート |

## データのライセンス / Data licenses

| ソース | ライセンス |
|---|---|
| 青空文庫（aozorabunko-clean） | パブリックドメイン中心（各作品の規定に従う） |
| Wikipedia日本語版 | CC BY-SA 4.0 |
| TinyStories | CDLA-Sharing-1.0 |
| databricks-dolly-15k-ja | CC BY-SA 3.0 |

コーパス・チェックポイントはサイズが大きいためリポジトリにはコミットしません（`.gitignore` 済み）。

## トラブルシューティング

- **学習が遅い**: `--batch-size` を下げて `--accum` を上げると同じ実効バッチでメモリが減ります。ノートPCは電源接続＋高パフォーマンス設定で実行してください。
- **メモリ不足**: baseでも学習時メモリは3GB程度ですが、ブラウザ等を閉じると安定します。
- **datasets のダウンロードが失敗する**: 回線の問題が多いので再実行してください。再開時は途中までのキャッシュが効きます。
