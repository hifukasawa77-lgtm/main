# model.py — ミニLLM本体（Llama系アーキテクチャの自前実装）
#
# 学習目的のため、外部のモデル実装ライブラリは使わず PyTorch の基本要素だけで書く。
# 現代の標準的なLLM（Llama / Qwen / Gemma 等）と同じ構成要素を採用:
#
#   1. RMSNorm        — LayerNormの簡略版。平均を引かず二乗平均で正規化する
#   2. RoPE           — 回転位置埋め込み。Q/Kベクトルを位置に応じて回転させ相対位置を表現
#   3. SwiGLU MLP     — ゲート付きMLP。同パラメータ数で通常のMLPより表現力が高い
#   4. 重み共有        — 入力埋め込みと出力層の重みを共有しパラメータを節約
#   5. KVキャッシュ    — 生成時に過去のKey/Valueを再利用して高速化
#
# データの流れ（forward）:
#   トークンID → 埋め込み → [RMSNorm → 注意機構 → 残差加算 → RMSNorm → MLP → 残差加算] × N層
#   → 最終RMSNorm → 出力層（語彙数分のロジット）

import math

import torch
import torch.nn as nn
import torch.nn.functional as F

from config import ModelConfig


class RMSNorm(nn.Module):
    """Root Mean Square 正規化。LayerNormから平均減算とバイアスを除いた軽量版。"""

    def __init__(self, dim: int, eps: float = 1e-5):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # 二乗平均の平方根で割ってスケールを揃え、学習可能な係数を掛ける
        rms = torch.rsqrt(x.pow(2).mean(dim=-1, keepdim=True) + self.eps)
        return x * rms * self.weight


def precompute_rope(head_dim: int, max_seq_len: int, theta: float) -> tuple[torch.Tensor, torch.Tensor]:
    """RoPEの回転角（cos/sin）を全位置ぶん事前計算しておく。"""
    # 次元ペアごとの周波数: theta^(-2i/d)。低次元ほど速く回転する
    freqs = 1.0 / (theta ** (torch.arange(0, head_dim, 2).float() / head_dim))
    pos = torch.arange(max_seq_len).float()
    angles = torch.outer(pos, freqs)  # (max_seq_len, head_dim/2)
    return angles.cos(), angles.sin()


def apply_rope(x: torch.Tensor, cos: torch.Tensor, sin: torch.Tensor) -> torch.Tensor:
    """Q/Kベクトルの各2次元ペアを位置に応じた角度だけ回転させる。

    x: (B, n_heads, T, head_dim)  cos/sin: (T, head_dim/2)
    """
    x1, x2 = x[..., 0::2], x[..., 1::2]  # 偶数次元と奇数次元のペア
    # 2次元回転行列 [[cos, -sin], [sin, cos]] の適用
    rx1 = x1 * cos - x2 * sin
    rx2 = x1 * sin + x2 * cos
    out = torch.stack((rx1, rx2), dim=-1).flatten(-2)
    return out.type_as(x)


class Attention(nn.Module):
    """マルチヘッド因果的自己注意。生成時はKVキャッシュで過去計算を再利用する。"""

    def __init__(self, cfg: ModelConfig):
        super().__init__()
        self.n_heads = cfg.n_heads
        self.head_dim = cfg.head_dim
        # Llama流にバイアスなしの線形層を使う
        self.wq = nn.Linear(cfg.d_model, cfg.d_model, bias=False)
        self.wk = nn.Linear(cfg.d_model, cfg.d_model, bias=False)
        self.wv = nn.Linear(cfg.d_model, cfg.d_model, bias=False)
        self.wo = nn.Linear(cfg.d_model, cfg.d_model, bias=False)
        self.dropout = cfg.dropout

    def forward(
        self,
        x: torch.Tensor,
        cos: torch.Tensor,
        sin: torch.Tensor,
        past_kv: tuple[torch.Tensor, torch.Tensor] | None = None,
    ) -> tuple[torch.Tensor, tuple[torch.Tensor, torch.Tensor]]:
        B, T, C = x.shape
        # (B, T, C) → (B, n_heads, T, head_dim) に分割
        q = self.wq(x).view(B, T, self.n_heads, self.head_dim).transpose(1, 2)
        k = self.wk(x).view(B, T, self.n_heads, self.head_dim).transpose(1, 2)
        v = self.wv(x).view(B, T, self.n_heads, self.head_dim).transpose(1, 2)

        # 位置情報を回転として注入（キャッシュがある場合は続きの位置から）
        q = apply_rope(q, cos, sin)
        k = apply_rope(k, cos, sin)

        if past_kv is not None:
            # 過去のK/Vの後ろに今回分を連結（生成の高速化の要）
            k = torch.cat([past_kv[0], k], dim=2)
            v = torch.cat([past_kv[1], v], dim=2)

        # キャッシュなし＝学習/プリフィルなので因果マスクあり。
        # キャッシュ使用時は1トークンずつのデコードで過去全トークンを参照してよいのでマスク不要。
        # ※テンソル形状の比較（SymBoolになる）ではなく静的なboolにしてONNXエクスポートに対応
        is_causal = past_kv is None
        y = F.scaled_dot_product_attention(
            q, k, v,
            is_causal=is_causal,
            dropout_p=self.dropout if self.training else 0.0,
        )
        y = y.transpose(1, 2).contiguous().view(B, T, C)
        return self.wo(y), (k, v)


class SwiGLUMLP(nn.Module):
    """ゲート付きMLP: silu(W_gate x) * (W_up x) を W_down で戻す。"""

    def __init__(self, cfg: ModelConfig):
        super().__init__()
        self.w_gate = nn.Linear(cfg.d_model, cfg.mlp_hidden, bias=False)
        self.w_up = nn.Linear(cfg.d_model, cfg.mlp_hidden, bias=False)
        self.w_down = nn.Linear(cfg.mlp_hidden, cfg.d_model, bias=False)
        self.drop = nn.Dropout(cfg.dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.drop(self.w_down(F.silu(self.w_gate(x)) * self.w_up(x)))


class Block(nn.Module):
    """Transformerブロック1段。Pre-Norm構成（正規化→変換→残差加算）。"""

    def __init__(self, cfg: ModelConfig):
        super().__init__()
        self.norm1 = RMSNorm(cfg.d_model)
        self.attn = Attention(cfg)
        self.norm2 = RMSNorm(cfg.d_model)
        self.mlp = SwiGLUMLP(cfg)

    def forward(self, x, cos, sin, past_kv=None):
        a, kv = self.attn(self.norm1(x), cos, sin, past_kv)
        x = x + a
        x = x + self.mlp(self.norm2(x))
        return x, kv


class MiniLLM(nn.Module):
    def __init__(self, cfg: ModelConfig):
        super().__init__()
        self.cfg = cfg
        self.tok_emb = nn.Embedding(cfg.vocab_size, cfg.d_model)
        self.drop = nn.Dropout(cfg.dropout)
        self.blocks = nn.ModuleList([Block(cfg) for _ in range(cfg.n_layers)])
        self.norm_f = RMSNorm(cfg.d_model)
        self.lm_head = nn.Linear(cfg.d_model, cfg.vocab_size, bias=False)
        # 重み共有: 入力埋め込みと出力層で同じ行列を使う（パラメータ削減＋性能向上）
        self.lm_head.weight = self.tok_emb.weight

        # RoPEテーブルは学習対象外のバッファとして保持
        cos, sin = precompute_rope(cfg.head_dim, cfg.max_seq_len, cfg.rope_theta)
        self.register_buffer("rope_cos", cos, persistent=False)
        self.register_buffer("rope_sin", sin, persistent=False)

        self.apply(self._init_weights)
        # 残差経路に入る出力射影は層数に応じて小さく初期化（GPT-2論文の手法）
        for name, p in self.named_parameters():
            if name.endswith("wo.weight") or name.endswith("w_down.weight"):
                nn.init.normal_(p, mean=0.0, std=0.02 / math.sqrt(2 * cfg.n_layers))

    def _init_weights(self, module):
        if isinstance(module, nn.Linear):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)
        elif isinstance(module, nn.Embedding):
            nn.init.normal_(module.weight, mean=0.0, std=0.02)

    def num_params(self) -> int:
        # 重み共有しているので lm_head は二重カウントしない
        return sum(p.numel() for p in self.parameters())

    def forward(
        self,
        idx: torch.Tensor,
        targets: torch.Tensor | None = None,
        past_kvs: list | None = None,
        start_pos: int = 0,
    ):
        """idx: (B, T) トークンID列。

        targets を渡すと交差エントロピー損失を計算（学習時）。
        past_kvs / start_pos は生成時のKVキャッシュ用。
        """
        B, T = idx.shape
        cos = self.rope_cos[start_pos: start_pos + T]
        sin = self.rope_sin[start_pos: start_pos + T]

        x = self.drop(self.tok_emb(idx))
        new_kvs = []
        for i, block in enumerate(self.blocks):
            past = past_kvs[i] if past_kvs is not None else None
            x, kv = block(x, cos, sin, past)
            new_kvs.append(kv)
        x = self.norm_f(x)

        if targets is not None:
            logits = self.lm_head(x)
            # ignore_index=-1: ファインチューニング時にユーザー発話部分を損失から除外する
            loss = F.cross_entropy(
                logits.view(-1, logits.size(-1)), targets.view(-1), ignore_index=-1
            )
            return logits, loss, new_kvs
        else:
            # 生成時は最後の位置のロジットだけあればよい（計算節約）
            logits = self.lm_head(x[:, -1:, :])
            return logits, None, new_kvs

    @torch.no_grad()
    def generate(
        self,
        idx: torch.Tensor,
        max_new_tokens: int = 200,
        temperature: float = 0.8,
        top_p: float = 0.95,
        top_k: int = 0,
        eos_id: int | None = None,
    ) -> torch.Tensor:
        """KVキャッシュを使った自己回帰生成。

        temperature: 低いほど堅実、高いほど多様な出力
        top_p: 累積確率がこの値に達するまでの上位トークンのみから抽選（nucleus sampling）
        top_k: 上位k件のみから抽選（0なら無効）
        """
        self.eval()
        # 文脈長を超えないように入力を切り詰める
        idx = idx[:, -self.cfg.max_seq_len:]
        # プリフィル: プロンプト全体を一括処理してキャッシュを作る
        logits, _, kvs = self(idx, past_kvs=None, start_pos=0)
        pos = idx.size(1)

        for _ in range(max_new_tokens):
            logits_last = logits[:, -1, :] / max(temperature, 1e-5)

            if top_k > 0:
                kth = torch.topk(logits_last, min(top_k, logits_last.size(-1)))[0][..., -1, None]
                logits_last[logits_last < kth] = float("-inf")

            if 0.0 < top_p < 1.0:
                sorted_logits, sorted_idx = torch.sort(logits_last, descending=True)
                probs = F.softmax(sorted_logits, dim=-1)
                cum = torch.cumsum(probs, dim=-1)
                # 累積確率がtop_pを超えた以降のトークンを除外（先頭1件は必ず残す）
                mask = cum - probs > top_p
                sorted_logits[mask] = float("-inf")
                logits_last = torch.full_like(logits_last, float("-inf")).scatter(
                    -1, sorted_idx, sorted_logits
                )

            probs = F.softmax(logits_last, dim=-1)
            next_id = torch.multinomial(probs, num_samples=1)
            idx = torch.cat([idx, next_id], dim=1)

            if eos_id is not None and next_id.item() == eos_id:
                break
            if pos >= self.cfg.max_seq_len:
                break  # 文脈長の上限に到達

            # 新トークン1個だけをキャッシュ付きで処理（ここが高速化の核心）
            logits, _, kvs = self(next_id, past_kvs=kvs, start_pos=pos)
            pos += 1

        return idx
