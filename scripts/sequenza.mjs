import { spawn } from 'node:child_process';import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';import { tmpdir } from 'node:os';import { join } from 'node:path';
const [,,url,out,W='1280',H='800',passo='640']=process.argv;mkdirSync(out,{recursive:true});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0',`--user-data-dir=${mkdtempSync(join(tmpdir(),'seq-'))}`,'--hide-scrollbars','--autoplay-policy=no-user-gesture-required','about:blank']);
const wsUrl=await new Promise(ok=>chrome.stderr.on('data',d=>{const m=String(d).match(/ws:\/\/[^\s]+/);if(m)ok(m[0]);}));
const ws=new WebSocket(wsUrl);await new Promise(ok=>ws.addEventListener('open',ok));let id=0;const att=new Map();
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&att.has(m.id)){att.get(m.id)(m);att.delete(m.id);}});
const inv=(method,params={},sessionId)=>new Promise(ok=>{const n=++id;att.set(n,m=>ok(m.result));ws.send(JSON.stringify({id:n,method,params,sessionId}));});
const {targetId}=await inv('Target.createTarget',{url:'about:blank'});const {sessionId}=await inv('Target.attachToTarget',{targetId,flatten:true});const s=(m,p)=>inv(m,p,sessionId);
const mob=+W<600;await s('Page.enable');await s('Emulation.setDeviceMetricsOverride',{width:+W,height:+H,deviceScaleFactor:1,mobile:mob});
await s('Page.navigate',{url});await new Promise(r=>setTimeout(r,3500));
const {result}=await s('Runtime.evaluate',{expression:'document.documentElement.scrollHeight',returnByValue:true});const alto=result.value;let i=0;
for(let y=0;y<alto;y+=+passo){await s('Input.dispatchMouseEvent',{type:'mouseWheel',x:+W/2,y:+H/2,deltaX:0,deltaY:y===0?0:+passo});await new Promise(r=>setTimeout(r,1100));
const c=await s('Page.captureScreenshot',{format:'jpeg',quality:70});writeFileSync(join(out,String(i++).padStart(2,'0')+'.jpg'),Buffer.from(c.data,'base64'));}
console.log(out,i,'fotogrammi, alto',alto);ws.close();chrome.kill();
