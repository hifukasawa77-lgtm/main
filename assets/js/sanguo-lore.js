/* 三国志・天下三分 武将ロア定義 / General lore for "Sanguo: Three Kingdoms Divided".
   sanguo.html より前に classic script として読み込む。
   Loaded as a classic script before sanguo.html's IIFE (ES Modules are not usable under file://).

   epithet    : {generalId: {sobriquet:'二つ名', origin:'出身地'}}  未定義は epithetOf() の決定論生成にフォールバック
   affinity   : {generalId: ['cityId', …]}  在野配分でこの都市に配られやすくなる（重み ×6）
   extraNames : {generalId: '表示名'}  GENERAL_JP に無い武将の日本語名

   P5（一騎打ちの名乗り演出）で epithet を充実させた。
   `epithet` is used by the duel challenge cut-scene (P5) to render each general's
   sobriquet and birthplace on the name-calling banner.
*/
window.SANGUO_LORE = {
  // ===== 二つ名と出身地 / Sobriquet and birthplace =====
  // 名乗りの口上に使う。出典は演義・正史の通称を優先し、名乗りとして声に出して据わる語を採った。
  epithet: {
    // — 群雄 / Warlords —
    dong_zhuo:   {sobriquet:'西涼の梟雄',     origin:'隴西臨洮'},
    lu_bu:       {sobriquet:'人中の呂布',     origin:'并州五原'},
    yuan_shao:   {sobriquet:'四世三公',       origin:'汝南汝陽'},
    yuan_shu:    {sobriquet:'仲家の主',       origin:'汝南汝陽'},
    gongsun_zan: {sobriquet:'白馬長史',       origin:'遼西令支'},
    liu_biao:    {sobriquet:'荊州の牧',       origin:'山陽高平'},
    ma_teng:     {sobriquet:'西涼の柱',       origin:'扶風茂陵'},
    zhang_jiao:  {sobriquet:'大賢良師',       origin:'鉅鹿'},

    // — 蜀 / Shu —
    liu_bei:     {sobriquet:'中山靖王の後裔', origin:'幽州涿郡'},
    guan_yu:     {sobriquet:'美髯公',         origin:'河東解県'},
    zhang_fei:   {sobriquet:'燕人',           origin:'幽州涿郡'},
    zhao_yun:    {sobriquet:'常山の趙子龍',   origin:'常山真定'},
    ma_chao:     {sobriquet:'錦馬超',         origin:'扶風茂陵'},
    huang_zhong: {sobriquet:'定軍山の弓',     origin:'南陽宛'},
    zhuge_liang: {sobriquet:'臥龍',           origin:'琅邪陽都'},
    pang_tong:   {sobriquet:'鳳雛',           origin:'荊州襄陽'},
    xu_shu:      {sobriquet:'単福の名',       origin:'潁川長社'},
    fa_zheng:    {sobriquet:'蜀中の謀主',     origin:'扶風郿県'},
    wei_yan:     {sobriquet:'反骨の相',       origin:'義陽'},
    jiang_wei:   {sobriquet:'天水の麒麟児',   origin:'天水冀県'},
    ma_dai:      {sobriquet:'西涼の疾風',     origin:'扶風茂陵'},
    guan_ping:   {sobriquet:'美髯公の嗣子',   origin:'河東解県'},
    meng_huo:    {sobriquet:'南蛮王',         origin:'南中建寧'},
    lady_zhurong:{sobriquet:'火神の裔',       origin:'南中建寧'},

    // — 魏 / Wei —
    cao_cao:     {sobriquet:'乱世の奸雄',     origin:'沛国譙県'},
    xiahou_dun:  {sobriquet:'盲夏侯',         origin:'沛国譙県'},
    xiahou_yuan: {sobriquet:'神速の将',       origin:'沛国譙県'},
    cao_ren:     {sobriquet:'天人将軍',       origin:'沛国譙県'},
    dian_wei:    {sobriquet:'古の悪来',       origin:'陳留己吾'},
    xu_chu:      {sobriquet:'虎痴',           origin:'譙国譙県'},
    zhang_liao:  {sobriquet:'遼来来',         origin:'雁門馬邑'},
    xu_huang:    {sobriquet:'周亜夫の風',     origin:'河東楊県'},
    zhang_he:    {sobriquet:'変化の妙',       origin:'河間鄚県'},
    guo_jia:     {sobriquet:'鬼才',           origin:'潁川陽翟'},
    xun_yu:      {sobriquet:'王佐の才',       origin:'潁川潁陰'},
    jia_xu:      {sobriquet:'毒士',           origin:'武威姑臧'},
    sima_yi:     {sobriquet:'冢虎',           origin:'河内温県'},
    deng_ai:     {sobriquet:'陰平の奇道',     origin:'義陽棘陽'},
    zhong_hui:   {sobriquet:'士季の才',       origin:'潁川長社'},
    cao_zhen:    {sobriquet:'子丹の剛',       origin:'沛国譙県'},

    // — 呉 / Wu —
    sun_jian:    {sobriquet:'江東の虎',       origin:'呉郡富春'},
    sun_ce:      {sobriquet:'小覇王',         origin:'呉郡富春'},
    sun_quan:    {sobriquet:'紫髯碧眼',       origin:'呉郡富春'},
    sun_shangxiang:{sobriquet:'弓腰姫',       origin:'呉郡富春'},
    zhou_yu:     {sobriquet:'美周郎',         origin:'廬江舒県'},
    lu_su:       {sobriquet:'江表の英傑',     origin:'臨淮東城'},
    lu_meng:     {sobriquet:'呉下の阿蒙',     origin:'汝南富陂'},
    lu_xun:      {sobriquet:'書生の大都督',   origin:'呉郡呉県'},
    taishi_ci:   {sobriquet:'信義の弓',       origin:'東莱黄県'},
    gan_ning:    {sobriquet:'錦帆賊',         origin:'巴郡臨江'},
    huang_gai:   {sobriquet:'苦肉の老将',     origin:'零陵泉陵'},
    cheng_pu:    {sobriquet:'呉の宿将',       origin:'右北平土垠'},

    // — 河北・その他 / Hebei and others —
    yan_liang:   {sobriquet:'河北の名将',     origin:'冀州'},
    wen_chou:    {sobriquet:'河北の双璧',     origin:'冀州'},
    tian_feng:   {sobriquet:'剛直の諫臣',     origin:'鉅鹿'},
    chen_gong:   {sobriquet:'白門楼の智',     origin:'兗州東郡'},
    wang_yun:    {sobriquet:'連環の計',       origin:'太原祁県'}
  },

  // ===== 在野配分の史実ゆかり / Historical affinity for wild-talent placement =====
  affinity: {
    zhuge_liang:['xiang_yang'], pang_tong:['xiang_yang'], huang_zhong:['xiang_yang'],
    ma_chao:['chang_an'], ma_dai:['chang_an'], ma_teng:['chang_an'], han_sui:['chang_an'],
    meng_huo:['jiang_zhou'], lady_zhurong:['jiang_zhou'],
    taishi_ci:['kuai_ji'], gan_ning:['jiang_xia'],
    zhou_yu:['jian_ye'], lu_su:['jian_ye'], lu_meng:['jian_ye'], lu_xun:['jian_ye'],
    guo_jia:['xu_chang'], xun_yu:['xu_chang'], xun_you:['xu_chang'],
    tian_feng:['ye'], ju_shou:['ye'], yan_liang:['ping_yuan'], wen_chou:['ping_yuan'],
    zhang_lu:['han_zhong'], fa_zheng:['cheng_du'], liu_zhang:['cheng_du'],
    jiang_wei:['chang_an'], deng_ai:['chang_an'],
    zhang_liao:['he_fei'], chen_gong:['he_fei'],
    gongsun_zan:['liao_dong'], huang_gai:['wuchang']
  },

  // ===== GENERAL_JP に無い武将の日本語名 / Display names missing from GENERAL_JP =====
  extraNames: { zhang_jiao:'張角', cao_zhen:'曹真' }
};
