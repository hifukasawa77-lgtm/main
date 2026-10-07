(function(){
'use strict';
var $=function(id){return document.getElementById(id);},video=$('video'),canvas=$('canvas'),ctx=canvas.getContext('2d'),proc=document.createElement('canvas'),pctx=proc.getContext('2d',{willReadFrequently:true});
var stream=null,running=false,request=0,raf=0,facing='environment',range=null,palette='rainbow',frame=null;
var points=[{x:.35,y:.58},{x:.65,y:.58}],nextPoint=0,smoothedValues=[null,null],saved=false;
var lower=24,upper=35.1;var timer;
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(timer);timer=setTimeout(function(){$('toast').classList.remove('show');},2500);}
function status(text){$('status').textContent=text;}
function start(){
 if(running||$('start-btn').disabled)return;
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){status('このブラウザはカメラ非対応です / Camera unsupported');return;}
 var token=++request;$('start-btn').disabled=true;$('stop-btn').disabled=false;status('カメラを起動中 / Starting camera…');
 navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1280},height:{ideal:720}},audio:false}).then(function(s){if(token!==request){s.getTracks().forEach(function(t){t.stop();});return;}stream=s;video.srcObject=s;return video.play();}).then(function(){if(token!==request)return;running=true;range=null;smoothedValues=[null,null];$('placeholder').hidden=true;$('flip-btn').disabled=false;$('save-btn').disabled=true;status('映像の明るさを色に変換中。画面をタップして比較点を移動 / Tap to move comparison points.');loop();}).catch(function(e){if(token!==request)return;stop();status('カメラの使用許可を確認してください / Check camera permission.');toast('カメラを起動できません / '+(e.name||'Camera error'));});
}
function stop(){request++;running=false;cancelAnimationFrame(raf);if(stream)stream.getTracks().forEach(function(t){t.stop();});stream=null;video.srcObject=null;frame=null;ctx.clearRect(0,0,canvas.width,canvas.height);$('placeholder').hidden=false;$('start-btn').disabled=false;$('stop-btn').disabled=true;$('flip-btn').disabled=true;$('save-btn').disabled=true;status('紫・青＝暗い部分、黄・赤＝明るい部分。実測温度ではありません / Brightness visualization only.');}
function bounds(){lower=Number($('range-min').value);upper=Number($('range-max').value);if(!Number.isFinite(lower)||!Number.isFinite(upper)||upper<=lower){status('表示上限は下限より大きくしてください / Upper value must exceed lower value.');return false;}return true;}
function loop(){if(!running)return;if(video.readyState>=2&&video.videoWidth)render();raf=requestAnimationFrame(loop);}
function render(){
 var w=320,h=Math.max(1,Math.round(w*video.videoHeight/video.videoWidth));if(proc.width!==w||proc.height!==h){proc.width=w;proc.height=h;}
 pctx.filter=$('smooth-chk').checked?'blur(2px)':'none';pctx.drawImage(video,0,0,w,h);pctx.filter='none';
 var image=pctx.getImageData(0,0,w,h);var a=ThermalFX.analyze(image.data,range,Number($('sens-slider').value)/100);range=a.range;ThermalFX.colorize(image.data,a.levels,ThermalFX.palettes[palette]);pctx.putImageData(image,0,0);
 var dw=640,dh=Math.max(160,Math.round(dw*h/w)),legend=58,footer=27;
 if(canvas.width!==dw+legend||canvas.height!==dh+footer){canvas.width=dw+legend;canvas.height=dh+footer;$('thermal-stage').style.aspectRatio=canvas.width+'/'+canvas.height;}
 ctx.fillStyle='#12002b';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.save();if(facing==='user'){ctx.translate(dw,0);ctx.scale(-1,1);}ctx.imageSmoothingEnabled=true;ctx.drawImage(proc,0,0,dw,dh);ctx.restore();
 frame={levels:a.levels,w:w,h:h,dw:dw,dh:dh};
 if($('hotspot-chk').checked){for(var i=0;i<points.length;i++){var point=points[i],sourceX=facing==='user'?1-point.x:point.x,x=Math.min(w-1,Math.round(sourceX*(w-1))),y=Math.min(h-1,Math.round(point.y*(h-1))),value=ThermalFX.displayValue(a.levels[y*w+x],lower,upper);smoothedValues[i]=smoothedValues[i]===null?value:smoothedValues[i]+(value-smoothedValues[i])*.2;marker(point.x*dw,point.y*dh,smoothedValues[i],i+1,dw,dh);}}
 legendDraw(dw,dh);
 ctx.fillStyle='#100020';ctx.fillRect(0,dh,canvas.width,footer);ctx.fillStyle='#fff';ctx.font='12px sans-serif';ctx.textAlign='left';ctx.fillText('SIMULATED / 疑似表示 — NOT MEASURED / 実測温度ではありません',10,dh+18);saved=true;$('save-btn').disabled=false;
}
function marker(x,y,v,no,w,h){ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x-9,y);ctx.lineTo(x+9,y);ctx.moveTo(x,y-9);ctx.lineTo(x,y+9);ctx.stroke();var text=no+': '+v.toFixed(1)+'°C (SIM)',tw=ctx.measureText(text).width;ctx.font='13px sans-serif';tw=ctx.measureText(text).width;var tx=ThermalFX.clamp(x+11,4,w-tw-10),ty=ThermalFX.clamp(y+22,18,h-8);ctx.fillStyle='rgba(35,0,55,.68)';ctx.fillRect(tx-4,ty-14,tw+8,20);ctx.fillStyle='#fff';ctx.fillText(text,tx,ty);ctx.restore();}
function legendDraw(x,h){var lut=ThermalFX.palettes[palette],top=40,height=Math.max(40,h-84);for(var y=0;y<height;y++){var i=Math.round((1-y/(height-1))*255)*3;ctx.fillStyle='rgb('+lut[i]+','+lut[i+1]+','+lut[i+2]+')';ctx.fillRect(x+17,top+y,19,1);}ctx.strokeStyle='#f2daff';ctx.strokeRect(x+17,top,19,height);ctx.fillStyle='#fff';ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText(upper.toFixed(1),x+27,22);ctx.fillText(lower.toFixed(1),x+27,h-17);ctx.font='10px sans-serif';ctx.fillText('°C / SIM',x+27,h-3);}
canvas.addEventListener('pointerdown',function(e){if(!running||!frame)return;var r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*canvas.width,y=(e.clientY-r.top)/r.height*canvas.height;if(x>=frame.dw||y>=frame.dh)return;points[nextPoint]={x:ThermalFX.clamp(x/frame.dw,0,1),y:ThermalFX.clamp(y/frame.dh,0,1)};smoothedValues[nextPoint]=null;nextPoint=(nextPoint+1)%2;});
document.querySelectorAll('.seg-btn').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.pal===palette?'true':'false');b.addEventListener('click',function(){palette=b.dataset.pal;document.querySelectorAll('.seg-btn').forEach(function(p){p.classList.toggle('active',p===b);p.setAttribute('aria-pressed',p===b?'true':'false');});});});
$('sens-slider').addEventListener('input',function(){$('sens-val').textContent=(Number(this.value)/100).toFixed(1)+'×';});
['range-min','range-max'].forEach(function(id){$(id).addEventListener('change',function(){if(!bounds()){lower=24;upper=35.1;$('range-min').value=lower;$('range-max').value=upper;}smoothedValues=[null,null];});});
$('start-btn').addEventListener('click',start);$('stop-btn').addEventListener('click',stop);$('flip-btn').addEventListener('click',function(){facing=facing==='environment'?'user':'environment';stop();start();});
$('save-btn').addEventListener('click',function(){if(!running||!saved)return;var a=document.createElement('a');a.download='simulated-thermography-'+Date.now()+'.png';a.href=canvas.toDataURL('image/png');a.click();toast('疑似表示の注記付きで保存しました / Saved with simulation label');});
window.addEventListener('pagehide',stop);window.addEventListener('beforeunload',stop);document.addEventListener('visibilitychange',function(){if(document.hidden)stop();});
})();
