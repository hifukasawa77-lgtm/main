# 志士編 グラフィカルUI更新

人物肖像とカード、旅の情景、面会・稽古・遠征のイベント画を導入。ゲームの行動結果に応じて中央の情景を切り替えます。

## 画像制作
内蔵 image_gen で新規生成。ユーザー了承によりモデル名の固定なし。GPT Image 2.5であることは保証していません。1672×941の画像をWebPへ圧縮し、4枚合計約1.30MB。画像は場面のイメージで、人物・建物の史実の再現ではありません。

共通プロンプト：Create a standalone landscape 16:9 event illustration asset for the historical Japanese simulation game Bakumatsu Fuunki. Painterly premium historical strategy-game art, restrained jade greens, warm amber gold and ink-black shadows, convincing anatomy, cinematic layered composition, textured brushwork, historically plausible architecture and materials. Full-bleed image, no UI, no words, no lettering, no watermark, no modern objects. Output one image for the scene only.

- meeting.webp：Two fictional Japanese Bakumatsu samurai discussing political ideals in a lantern-lit tatami room, seated respectfully across a low table with scrolls, shoji windows, tense thoughtful expressions, 1860s clothing and topknots.
- training.webp：Two Japanese samurai practicing wooden swords in a spacious traditional wooden dojo, dynamic controlled stance, morning light through open doors, 1860s Japan.
- journey.webp：A lone Japanese traveling samurai seen from behind walking toward Kyoto along a river street at dusk, wooden townhouses, warm lanterns, misty distant mountains, 1860s Japan.
- campaign.webp：Bakumatsu domain troops with period rifles and samurai officers crossing a grassy hillside, smoke and distant traditional castle, dramatic dawn, 1860s Japan, no gore.

## 検証
ゲーム進行12テスト、PC・スマートフォン・横画面、説得操作、時間制限、保存と読込、既存藩主編との分離を確認。画像4枚は目視確認済み。
