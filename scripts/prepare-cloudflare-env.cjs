'use strict';
const fs=require('node:fs');
function normalize(token,account,fallback){
 const clean=String(token||'').trim();
 if(!/^[A-Za-z0-9_-]{20,256}$/.test(clean))throw Error('CLOUDFLARE_API_TOKENを確認してください。前後の空白を除いても有効な1行のトークンではありません。');
 const id=String(account||'').trim()||fallback;
 if(!/^[0-9a-f]{32}$/.test(id||''))throw Error('CLOUDFLARE_ACCOUNT_IDを確認してください（32桁）。');
 return {token:clean,account:id};
}
if(require.main===module){
 try{
  let fallback='';try{fallback=JSON.parse(fs.readFileSync('cloudflare-worker/.wrangler/cache/wrangler-account.json','utf8')).account.id;}catch{}
  const value=normalize(process.env.CLOUDFLARE_API_TOKEN,process.env.CLOUDFLARE_ACCOUNT_ID,fallback);
  if(!process.env.GITHUB_ENV)throw Error('GitHub Actionsの環境ファイルがありません。');
  // Mask the normalized value before handing it to later steps. Never print it as diagnostic text.
  process.stdout.write('::add-mask::'+value.token+'\n');
  fs.appendFileSync(process.env.GITHUB_ENV,'CLOUDFLARE_API_TOKEN='+value.token+'\nCLOUDFLARE_ACCOUNT_ID='+value.account+'\n');
  console.log('Cloudflare認証設定を検証しました。');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={normalize};
