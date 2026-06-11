# config.py — モデルサイズのプリセット定義
#
# 16GBノートPC（CPUのみ）で現実的に事前学習できる規模に絞った3プリセット。
#   micro : パイプライン検証用。30分〜1時間で学習が回りきる
#   small : 半日〜一晩の学習向け
#   base  : 本命。一晩〜数日（中断・再開しながら）の学習向け
#
# vocab_size はトークナイザ学習後に実際の語彙数で上書きされる（train.py 参照）。

from dataclasses import dataclass


@dataclass
class ModelConfig:
    vocab_size: int = 16000   # トークナイザの語彙数（実行時に上書き）
    d_model: int = 512        # 埋め込み・隠れ層の次元
    n_layers: int = 8         # Transformerブロックの段数
    n_heads: int = 8          # 注意ヘッド数（d_model を割り切れること）
    max_seq_len: int = 512    # 文脈長（学習時の系列長の上限）
    dropout: float = 0.0      # 事前学習では0、ファインチューニングでは0.1程度
    rope_theta: float = 10000.0  # RoPE（回転位置埋め込み）の基底周波数

    @property
    def head_dim(self) -> int:
        assert self.d_model % self.n_heads == 0, "d_model は n_heads で割り切れる必要があります"
        return self.d_model // self.n_heads

    @property
    def mlp_hidden(self) -> int:
        # SwiGLU は通常のMLPよりパラメータ効率が良いため、
        # Llama 流に「4*d の 2/3」を 64 の倍数に丸めた値を使う
        h = int(8 * self.d_model / 3)
        return (h + 63) // 64 * 64


PRESETS: dict[str, ModelConfig] = {
    # 約 0.3〜3M パラメータ（語彙数依存）。CPUで数十分で学習可能
    "micro": ModelConfig(vocab_size=8000, d_model=192, n_layers=4, n_heads=4, max_seq_len=256),
    # 約 10〜15M パラメータ。半日〜一晩
    "small": ModelConfig(vocab_size=16000, d_model=320, n_layers=6, n_heads=8, max_seq_len=512),
    # 約 30〜35M パラメータ。一晩×数回の再開学習を想定
    "base": ModelConfig(vocab_size=16000, d_model=512, n_layers=8, n_heads=8, max_seq_len=512),
}


def get_config(preset: str, vocab_size: int | None = None) -> ModelConfig:
    if preset not in PRESETS:
        raise ValueError(f"未知のプリセット: {preset}（micro / small / base から選択）")
    cfg = ModelConfig(**vars(PRESETS[preset]))
    if vocab_size is not None:
        cfg.vocab_size = vocab_size
    return cfg
