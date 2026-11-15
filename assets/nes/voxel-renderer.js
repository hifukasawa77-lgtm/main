/* Instanced, lit solid geometry using the browser Canvas / WebGL2 API. */
'use strict';
window.NESVoxelRenderer=class {
 constructor(canvas){
  this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl2',{antialias:true,alpha:false});
  if(!gl)throw Error('3D表示にはWebGL2対応ブラウザーが必要です。2Dモードをご利用ください。');
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const vertex=shader(gl.VERTEX_SHADER,`#version 300 es
   precision highp float;
   layout(location=0) in vec3 position;layout(location=1) in vec3 normal;
   layout(location=2) in vec3 center;layout(location=3) in vec3 size;layout(location=4) in vec3 color;
   uniform mat4 camera;out vec3 shaded;
   void main(){gl_Position=camera*vec4(center+position*size,1.0);float light=0.56+0.44*max(dot(normal,normalize(vec3(-0.4,0.8,1.0))),0.0);shaded=color*light;}`);
  const fragment=shader(gl.FRAGMENT_SHADER,`#version 300 es
   precision highp float;in vec3 shaded;out vec4 outputColor;void main(){outputColor=vec4(shaded,1.0);}`);
  const program=this.program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('3D描画プログラムを初期化できません。');
  gl.deleteShader(vertex);gl.deleteShader(fragment);gl.useProgram(program);this.uniform=gl.getUniformLocation(program,'camera');
  this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
  const vertices=[];
  for(const [n,a,b]of [[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]],[[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]]]){
   for(const [u,v]of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]])vertices.push(...n.map((q,i)=>(q+a[i]*u+b[i]*v)/2),...n);
  }
  this.mesh=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.mesh);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  for(let i=0;i<2;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,24,i*12);}
  this.instances=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.instances);
  for(let i=2;i<5;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,36,(i-2)*12);gl.vertexAttribDivisor(i,1);}
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
  this.yaw=-18;this.pitch=10;this.zoom=1;this.onChange=null;
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY};});
  canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;this.yaw=Math.max(-65,Math.min(65,this.yaw+(e.clientX-drag.x)*0.35));this.pitch=Math.max(-50,Math.min(50,this.pitch+(e.clientY-drag.y)*0.35));drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.onChange?.();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(0.6,Math.min(1.8,this.zoom*Math.exp(-e.deltaY*0.001)));this.onChange?.();},{passive:false});
 }
 draw(geometry,sky=0){
  const gl=this.gl,c=this.canvas,dpr=Math.min(devicePixelRatio||1,2),w=Math.round(c.clientWidth*dpr),h=Math.round(c.clientHeight*dpr);
  if(!w||!h)return;if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
  gl.viewport(0,0,w,h);gl.clearColor((sky&255)/255,((sky>>8)&255)/255,((sky>>16)&255)/255,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const radians=Math.PI/180,ya=this.yaw*radians,pi=this.pitch*radians,distance=400/this.zoom;
  const eye=[Math.sin(ya)*Math.cos(pi)*distance,Math.sin(pi)*distance,Math.cos(ya)*Math.cos(pi)*distance];
  const unit=v=>{const d=Math.hypot(...v);return v.map(x=>x/d);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
  const z=unit(eye),x=unit(cross([0,1,0],z)),y=cross(z,x),view=[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];
  const f=1/Math.tan(42*radians/2),near=1,far=1400,projection=[f/(w/h),0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0],matrix=new Float32Array(16);
  for(let column=0;column<4;column++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)matrix[column*4+row]+=projection[k*4+row]*view[column*4+k];
  gl.useProgram(this.program);gl.bindVertexArray(this.vao);gl.uniformMatrix4fv(this.uniform,false,matrix);gl.bindBuffer(gl.ARRAY_BUFFER,this.instances);gl.bufferData(gl.ARRAY_BUFFER,geometry.data.subarray(0,geometry.count*9),gl.DYNAMIC_DRAW);gl.drawArraysInstanced(gl.TRIANGLES,0,36,geometry.count);
 }
 dispose(){const g=this.gl;g.deleteBuffer(this.mesh);g.deleteBuffer(this.instances);g.deleteVertexArray(this.vao);g.deleteProgram(this.program);}
};
