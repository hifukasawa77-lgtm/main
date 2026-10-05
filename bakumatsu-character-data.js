/* 志士編のゲーム用データ。思想・能力は本作独自の設定。 */
(function (root) {
  'use strict';
  const domains = [
    ['bakufu','徳川幕府','佐幕','開国',85], ['satsuma','薩摩藩','公議','開国',67],
    ['choshu','長州藩','尊王','攘夷',59], ['tosa','土佐藩','公議','開国',47],
    ['saga','佐賀藩','公議','開国',56], ['mito','水戸藩','尊王','攘夷',50],
    ['aizu','会津藩','佐幕','攘夷',61], ['kuwana','桑名藩','佐幕','攘夷',48],
    ['shonai','庄内藩','佐幕','開国',50], ['nagaoka','長岡藩','公議','開国',54],
    ['fukui','福井藩','公議','開国',53]
  ].map(([id,name,ideology,foreignPolicy,power]) => ({id,name,ideology,foreignPolicy,power}));
  const places = [
    ['ezo','箱館',70,26.5,'bakufu',true], ['shonai','鶴岡',67.5,42,'shonai'],
    ['tohoku','若松',66.5,50.5,'aizu'], ['nagaoka','長岡',57.5,51.5,'nagaoka'],
    ['echigo','新潟',60.5,46.5,'bakufu',true], ['fukui','福井',46.5,57.5,'fukui'],
    ['mito','水戸',72,58,'mito'], ['edo','江戸',64,63,'bakufu',true],
    ['kyoto','京都',43.5,62.5,null], ['kuwana','桑名',50.5,66,'kuwana'],
    ['choshu','萩',22.5,63,'choshu',true], ['tosa','高知',28.5,75.5,'tosa',true],
    ['saga','佐賀',13,69,'saga'], ['satsuma','鹿児島',12.5,83,'satsuma',true]
  ].map(([id,name,x,y,domainId,port=false]) => ({id,name,x,y,domainId,port}));
  const edges = [['ezo','shonai'],['shonai','tohoku'],['shonai','echigo'],['tohoku','echigo'],['tohoku','mito'],['tohoku','edo'],['nagaoka','echigo'],['nagaoka','fukui'],['mito','edo'],['edo','kuwana'],['kuwana','kyoto'],['kyoto','fukui'],['kyoto','choshu'],['kyoto','tosa'],['choshu','saga'],['choshu','satsuma'],['tosa','satsuma'],['saga','satsuma']];
  const heroes = [
    {id:'ryoma',name:'坂本龍馬',domainId:'tosa',locationId:'tosa',ideology:'尊王',foreignPolicy:'開国',rank:1,progressiveness:80,sword:72,military:60,learning:66,charm:88,portrait:'sakamoto-ryoma',favorite:'本音'},
    {id:'saigo',name:'西郷隆盛',domainId:'satsuma',locationId:'satsuma',ideology:'尊王',foreignPolicy:'開国',rank:1,progressiveness:65,sword:65,military:88,learning:60,charm:90,portrait:'saigo-takamori',favorite:'威圧'},
    {id:'katsura',name:'桂小五郎',domainId:'choshu',locationId:'choshu',ideology:'尊王',foreignPolicy:'攘夷',rank:1,progressiveness:70,sword:85,military:60,learning:88,charm:72,portrait:'kido-takayoshi',favorite:'理論'},
    {id:'katsu',name:'勝海舟',domainId:'bakufu',locationId:'edo',ideology:'公議',foreignPolicy:'開国',rank:1,progressiveness:90,sword:70,military:76,learning:90,charm:80,portrait:'katsu-kaishu',favorite:'理論'},
    {id:'oguri',name:'小栗忠順',domainId:'bakufu',locationId:'edo',ideology:'佐幕',foreignPolicy:'開国',rank:1,progressiveness:85,sword:58,military:76,learning:88,charm:65,portrait:'oguri-tadamasa',favorite:'賄賂'}
  ];
  const data = {
    domains,places,edges,heroes,
    scenarios:[{id:'ansei',name:'安政五年・条約と藩論',year:1858,month:6,day:1},{id:'bunkyu',name:'文久三年・京の風雲',year:1863,month:8,day:1}],
    ideologies:['尊王','公議','佐幕'], foreignPolicies:['開国','攘夷'], ranks:['浪士','藩士','重臣','藩主'],
    methods:['賄賂','脅迫','理論','威圧','本音'], phases:['朝','昼','夕','夜'],
    colors:{'尊王':'#c56d52','公議':'#519c8e','佐幕':'#688ebc'},
    capitals:{bakufu:'edo',aizu:'tohoku'},
    help:'国体思想を11勢力に広め、思想別の面会・征伐条件を満たすと維新達成。信頼80で同志になり、紹介と人物切替で藩主に接近できます。天皇・将軍は説得できません。'
  };
  root.BakumatsuCharacterData=data;
  if (typeof module !== 'undefined' && module.exports) module.exports=data;
})(typeof globalThis !== 'undefined' ? globalThis : this);
