const movie = document.createElement('canvas');
movie.width = 1920; movie.height = 1080;
const ctx = movie.getContext('2d', {alpha:false});
let previousChapter = -1, videoNow = performance.now();
const chapters = [
  ['一台可以拆开的相机', '拆开镜头，让光学原理变得看得见', '拆开 / 组装', 0, 4],
  ['转动对焦环', '焦平面移动，光线在传感器上汇聚', '对焦距离', 4, 9],
  ['清晰，由你决定', '从花丛到小屋，观察焦点与景深的变化', '对焦距离', 9, 16],
  ['同一座山谷，三种光线', '晴天、黄昏、夜晚 · 切换后实时成像', '光线预设', 16, 21],
  ['转动变焦环', '镜头、机身与实时画面同步变化', '焦距', 21, 26],
  ['按下快门，留下这一刻', '拍照 · 对比底片 · 恢复参数', '拍照', 26, 30],
];
const ss = x => smooth(clamp(x,0,1));
function pose(a,b,targetA,targetB,u) {
  view.name=''; view.pin=false;
  view.gPos.fromArray(a).lerp(V3(...b),u); view.pos.copy(view.gPos);
  view.gTgt.fromArray(targetA).lerp(V3(...targetB),u); view.tgt.copy(view.gTgt);
}
function setupChapter(c) {
  previousChapter=c; openBigView(c===2 || c===3 || c===5);
  if(c===0){state.explode=0;state.explodeTarget=0; applyPreset('golden',true);state.N=2;state.t=1/500;state.iso=100;state.f=50;state.D=38;}
  if(c===1){state.explode=1;state.explodeTarget=1;state.N=2;state.t=1/500;}
  if(c===2){state.N=2;state.t=1/500;state.f=50;state.D=28;Object.assign(state.cur,{N:2,f:50,D:28});}
  if(c===3){state.N=4;state.f=50;state.D=52;Object.assign(state.cur,{N:4,f:50,D:52});}
  if(c===4){applyPreset('golden',true);state.N=4;state.t=1/125;state.iso=100;state.D=52;state.f=35;state.cur.f=35;state.explode=1;state.explodeTarget=1;}
  if(c===5){applyPreset('golden',true);state.f=50;state.D=52;state.N=4;state.t=1/125;state.iso=100;Object.assign(state.cur,{f:50,D:52,N:4});}
}
function sceneAt(t) {
  const c = t<4?0:t<9?1:t<16?2:t<21?3:t<26?4:5;
  if(c!==previousChapter) setupChapter(c);
  const part=chapters[c],u=ss((t-part[3])/(part[4]-part[3]));
  if(c===0){state.explodeTarget=t>1?1:0;pose([-55,105,315],[65,90,305],[12,-8,8],[14,-8,8],u);}
  if(c===1){state.D=28+38*ss((t-4.5)/3.5);pose([25,38,100],[8,34,110],[4,15,0],[6,15,0],u);}
  if(c===2){state.D=28+42*ss((t-9.5)/5.5);}
  if(c===3){const key=t<17.6?'sunny':t<19.2?'golden':'night';if(state.preset!==key){applyPreset(key,false);}}
  if(c===4){state.f=35+65*u;pose([-25,55,220],[8,48,225],[-20,8,0],[-28,8,0],u);}
  videoNow+=1000/30;tick(videoNow);
  return {c,u,part};
}
function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
function text(s,x,y,size,color='#fff',font='"Microsoft YaHei",sans-serif'){
  ctx.font=`${size}px ${font}`;ctx.fillStyle=color;ctx.fillText(s,x,y);
}
function compose(t,info){
  const {c,u,part}=info,photo=c===2||c===3||c===5;
  ctx.fillStyle='#08090c';ctx.fillRect(0,0,1920,1080);
  ctx.drawImage(renderer.domElement,0,0,1920,1080);
  const top=ctx.createLinearGradient(0,0,0,215);top.addColorStop(0,'rgba(8,9,12,.94)');top.addColorStop(.55,'rgba(8,9,12,.7)');top.addColorStop(1,'rgba(8,9,12,0)');ctx.fillStyle=top;ctx.fillRect(0,0,1920,215);
  const bot=ctx.createLinearGradient(0,835,0,1080);bot.addColorStop(0,'rgba(8,9,12,0)');bot.addColorStop(1,'rgba(8,9,12,.95)');ctx.fillStyle=bot;ctx.fillRect(0,835,1920,245);
  text('CAMERA LAB',64,46,20,'rgba(255,255,255,.52)','Consolas');
  text(`${String(c+1).padStart(2,'0')} / 06`,1776,46,20,'rgba(255,255,255,.52)','Consolas');
  text(part[0],64,117,48,'rgba(255,255,255,.94)','"SimSun",serif');
  text(part[1],64,166,24,'rgba(255,255,255,.65)');
  if(photo){
    ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=1;
    for(let k=1;k<3;k++){ctx.beginPath();ctx.moveTo(64+k*376,220);ctx.lineTo(64+k*376,972);ctx.stroke();ctx.beginPath();ctx.moveTo(64,220+k*752/3);ctx.lineTo(1192,220+k*752/3);ctx.stroke();}
    roundRect(86,244,132,40,20,'rgba(10,12,20,.65)','rgba(255,255,255,.18)');text('实时取景',109,271,19);
    ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=2;ctx.strokeRect(596,564,64,64);
    text(c===3?'让光线改变氛围':c===5?'把这一刻拍下来':'焦点在画面中移动',1280,289,34,'rgba(255,255,255,.9)','"SimSun",serif');
    text(c===3?'从明亮日光，到温暖灯火':c===5?'参数随照片一同保存':'转动对焦环，寻找清晰的位置',1280,338,23,'rgba(255,255,255,.55)');
    if(c!==5){
      for(const [k,label,value] of [[0,'光圈',fmtN(state.cur.N)],[1,'快门',fmtT(state.t)],[2,'感光度',`ISO ${fmtISO(state.iso)}`]]){
        roundRect(1280,385+k*116,576,94,16,'rgba(255,255,255,.035)','rgba(255,255,255,.1)');text(label,1304,442+k*116,22,'rgba(255,255,255,.5)');
        ctx.textAlign='right';text(value,1832,443+k*116,29,'rgba(255,255,255,.9)','Consolas');ctx.textAlign='left';
      }
    }
  }
  roundRect(1280,855,576,145,22,'rgba(10,12,20,.72)','rgba(255,255,255,.16)');
  text(part[2],1308,900,21,'rgba(255,255,255,.6)');
  const value=c===0?(t<1?'组装':'拆开'):c===3?PRESETS[state.preset].name:c===4?`${Math.round(state.cur.f)} mm`:c===5?'保存这一刻':`${state.cur.D.toFixed(1)} cm`;
  ctx.textAlign='right';text(value,1828,900,24,'rgba(255,255,255,.94)','Consolas,"Microsoft YaHei"');ctx.textAlign='left';
  const pos=c===0?ss((t-1)/1.5):c===3?(state.preset==='sunny'?.1:state.preset==='golden'?.5:.9):c===4?u:c===5?.75:(state.cur.D-28)/42;
  roundRect(1312,935,512,4,2,'rgba(255,255,255,.18)');roundRect(1312,935,Math.max(4,512*pos),4,2,'rgba(255,255,255,.8)');
  ctx.beginPath();ctx.arc(1312+512*clamp(pos,0,1),937,10,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
  if(c===1||c===2||c===4){const x=1312+512*clamp(pos,0,1);ctx.beginPath();ctx.moveTo(x+7,949);ctx.lineTo(x+7,974);ctx.lineTo(x+14,967);ctx.lineTo(x+21,981);ctx.lineTo(x+27,978);ctx.lineTo(x+20,964);ctx.lineTo(x+30,964);ctx.closePath();ctx.fillStyle='rgba(255,255,255,.92)';ctx.fill();}
  text(`${fmtN(state.cur.N)}   ${fmtT(state.t)}   ISO ${fmtISO(state.iso)}   ${Math.round(state.cur.f)} mm`,64,1024,23,'rgba(255,255,255,.75)','Consolas');
  if(c===5){
    if(t>27){const alpha=clamp(1-(t-27)/.2,0,1);ctx.fillStyle=`rgba(255,255,255,${alpha*.8})`;ctx.fillRect(0,0,1920,1080);}
    if(ROLL[0]){
      roundRect(1280,405,576,384,18,'#15171d','rgba(255,255,255,.3)');ctx.save();ctx.beginPath();ctx.roundRect(1288,413,560,368,12);ctx.clip();ctx.drawImage(ROLL[0].canvas,1288,413,560,368);ctx.restore();
      text(t>28?'每一个参数，都能亲手玩。':'快门已释放',1280,823,28,'#fff','"SimSun",serif');
    }
  }
  for(let k=0;k<6;k++)roundRect(64+k*299,1058,278,3,2,k<=c?'rgba(255,255,255,.72)':'rgba(255,255,255,.16)');
  const fade=Math.min(clamp(t/.35,0,1),clamp((30-t)/.5,0,1));if(fade<1){ctx.fillStyle=`rgba(8,9,12,${1-fade})`;ctx.fillRect(0,0,1920,1080);}
}
async function exportFrame(i){const blob=await new Promise(resolve=>movie.toBlob(resolve,'image/jpeg',.97));const res=await fetch(`/frame/${String(i).padStart(4,'0')}`,{method:'POST',body:blob});if(!res.ok)throw Error('Frame save failed');}
async function progress(data){$('renderStatus').textContent=JSON.stringify(data);await fetch('/status',{method:'POST',body:JSON.stringify(data)});}
$('renderStart').onclick=async()=>{
  $('renderStart').disabled=true;
  try{
    window.__labHold=true;startCinematic(false);renderer.setPixelRatio(1);renderer.setSize(1920,1080);QUALITY.worldDpr=1;QUALITY.kMax=8;worldSize.w=0;
    setModule('shoot',true,true);setOverlay('hist',false);setOverlay('tags',false);
    previousChapter=-1;videoNow=performance.now();last=videoNow;
    sceneAt(0);for(let k=0;k<12;k++){videoNow+=1000/30;tick(videoNow);}
    for(let i=0;i<900;i++){
      const t=i/30,info=sceneAt(t);
      if(i===810){shoot();await new Promise(resolve=>requestAnimationFrame(resolve));}
      compose(t,info);await exportFrame(i);
      if(i%30===0)await progress({state:'rendering',frame:i,total:900,chapter:info.c+1});
    }
    await progress({state:'complete',frame:900,total:900});
  }catch(e){await progress({state:'error',message:String(e),stack:e.stack});}
};
