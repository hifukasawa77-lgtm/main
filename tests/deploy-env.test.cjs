const test=require('node:test'),assert=require('node:assert/strict'),{normalize}=require('../scripts/prepare-cloudflare-env.cjs');
const token='a'.repeat(40),account='b'.repeat(32);
test('only surrounding whitespace is removed; the token value remains unchanged',()=>assert.deepEqual(normalize(' \n'+token+'\r\n',' '+account+'\n'),{token,account}));
test('embedded whitespace and multiple tokens are rejected',()=>{for(const value of [token+'\n'+token,token.slice(0,20)+' '+token.slice(20),'', 'wrong'])assert.throws(()=>normalize(value,account));});
test('existing account configuration is used only when account input is empty',()=>{assert.equal(normalize(token,'',account).account,account);assert.throws(()=>normalize(token,'invalid',account));});
