/* Brightness-based visualization only: RGB cameras cannot measure temperature. */
(function(root){
'use strict';
function clamp(x,a,b){return Math.min(b,Math.max(a,x));}
function lut(stops){var out=new Uint8ClampedArray(768);for(var i=0;i<256;i++){var t=i/255,a=stops[0],b=stops[stops.length-1];for(var j=0;j<stops.length-1;j++)if(t>=stops[j][0]&&t<=stops[j+1][0]){a=stops[j];b=stops[j+1];break;}var f=(t-a[0])/(b[0]-a[0]);for(var c=0;c<3;c++)out[i*3+c]=a[1][c]+(b[1][c]-a[1][c])*f;}return out;}
var palettes={rainbow:lut([[0,[120,0,230]],[.13,[40,0,255]],[.28,[0,105,255]],[.42,[0,235,220]],[.56,[30,240,30]],[.72,[245,255,0]],[.86,[255,125,0]],[1,[245,0,0]]]),iron:lut([[0,[8,8,26]],[.2,[90,0,120]],[.4,[190,20,60]],[.6,[240,85,5]],[.8,[255,195,25]],[1,[255,255,235]]]),white:lut([[0,[0,0,0]],[1,[255,255,255]]])};
function analyze(data,previous,gain){
 var n=data.length/4,levels=new Float32Array(n),hist=new Uint32Array(256);
 for(var i=0;i<n;i++){var k=i*4,l=.299*data[k]+.587*data[k+1]+.114*data[k+2];levels[i]=l;hist[Math.round(l)]++;}
 var sum=0,lo=0,hi=255,lowFound=false;
 for(var j=0;j<256;j++){sum+=hist[j];if(!lowFound&&sum>=n*.02){lo=j;lowFound=true;}if(sum>=n*.98){hi=j;break;}}
 var range={min:previous?previous.min+(lo-previous.min)*.12:lo,max:previous?previous.max+(hi-previous.max)*.12:hi};
 var span=Math.max(12,range.max-range.min),hottest=0,coldest=0,high=-1,low=2;
 for(var p=0;p<n;p++){var t=clamp(.5+((levels[p]-range.min)/span-.5)*gain,0,1);levels[p]=t;if(t>high){high=t;hottest=p;}if(t<low){low=t;coldest=p;}}
 return {levels:levels,range:range,hottest:hottest,coldest:coldest};
}
function colorize(data,levels,palette){for(var i=0;i<levels.length;i++){var k=i*4,j=Math.round(levels[i]*255)*3;data[k]=palette[j];data[k+1]=palette[j+1];data[k+2]=palette[j+2];data[k+3]=255;}return data;}
function displayValue(level,min,max){return min+clamp(level,0,1)*(max-min);}
var api={palettes:palettes,analyze:analyze,colorize:colorize,displayValue:displayValue,clamp:clamp};root.ThermalFX=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
