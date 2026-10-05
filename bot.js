'use strict';
const fs=require('fs'),path=require('path'),WebSocket=require('ws');
const C={
 appId:process.env.DERIV_APP_ID||'1089', token:process.env.DERIV_TOKEN||'', asset:process.env.ASSET||'R_75',
 horizons:(process.env.HORIZONS_TICKS||'3,5,7,10,15').split(',').map(Number).filter(x=>x>0),
 stake:+(process.env.STAKE||1), minSamples:+(process.env.EPEL_MIN_SAMPLES||50), lambda:+(process.env.EPEL_LAMBDA||.5), z:+(process.env.WILSON_Z||1.959964),
 signalEvery:+(process.env.SIGNAL_EVERY_TICKS||5), lookback:+(process.env.LOOKBACK_TICKS||20), logFile:process.env.LOG_FILE||'./data/r75_tick_epel_ledger.csv'
};
const URL=`wss://ws.derivws.com/websockets/v3?app_id=${encodeURIComponent(C.appId)}`;
let ws,ticks=[],seq=0,pending=[];
const COL=['signal_id','signal_tick','direction','entry_price','horizon_ticks','expiry_tick','expiry_price','result','pnl','samples_before','wins_before','probability','wilson_lower','epel_pass','features'];
function init(){fs.mkdirSync(path.dirname(C.logFile),{recursive:true});if(!fs.existsSync(C.logFile))fs.writeFileSync(C.logFile,COL.join(',')+'\n')}
function q(v){return JSON.stringify(String(v??''))}
function append(r){fs.appendFileSync(C.logFile,COL.map(k=>q(r[k])).join(',')+'\n')}
function wilson(w,n){if(!n)return 0;const p=w/n,z=C.z,d=1+z*z/n,c=p+z*z/(2*n),m=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n);return(c-m)/d}
function prior(dir,h){if(!fs.existsSync(C.logFile))return{n:0,w:0,p:.5,lower:0};let n=0,w=0;for(const line of fs.readFileSync(C.logFile,'utf8').split('\n').slice(1)){if(!line)continue;const x=line.split(',').map(s=>s.replace(/^"|"$/g,''));if(x[2]===dir&&+x[4]===h&&['WIN','LOSS'].includes(x[7])){n++;if(x[7]==='WIN')w++}}return{n,w,p:n?(w+1)/(n+2):.5,lower:n?wilson(w,n):0}}
function epel(lower,n){return n>=C.minSamples && (1-lower)<=C.lambda*.78*lower}
function features(){if(ticks.length<C.lookback+1)return null;const p=ticks.map(x=>x.quote),last=p.at(-1),old=p.at(-(C.lookback+1)),deltas=[];for(let i=Math.max(1,p.length-20);i<p.length;i++)deltas.push(p[i]-p[i-1]);const mean=deltas.reduce((a,b)=>a+b,0)/(deltas.length||1);const sd=Math.sqrt(deltas.reduce((a,b)=>a+(b-mean)**2,0)/(Math.max(1,deltas.length-1)));const recent=p.slice(-5);const move=recent.at(-1)-recent[0];let streak=0;if(p.length>1){const s=Math.sign(p.at(-1)-p.at(-2));for(let i=p.length-1;i>0&&Math.sign(p[i]-p[i-1])===s;i--)streak++}const z=sd? (last-old)/(sd*Math.sqrt(C.lookback)):0;let direction;if(z<=-1.0)direction='CALL';else if(z>=1.0)direction='PUT';else return null;return{direction,move20:last-old,z20:+z.toFixed(4),recent5:move,streak,tickVol:+sd.toFixed(6)}}
function signal(){if(seq%C.signalEvery!==0)return;const f=features();if(!f)return;const id=++signalId;for(const h of C.horizons){const pr=prior(f.direction,h);pending.push({id,entryTick:seq,entryPrice:ticks.at(-1).quote,horizon:h,targetTick:seq+h,direction:f.direction,f,pr});}}
let signalId=0;
function settle(){const now=seq;for(const p of [...pending]){if(now<p.targetTick)continue;const target=ticks[p.targetTick];if(!target)continue;const win=p.direction==='CALL'?target.quote>p.entryPrice:target.quote<p.entryPrice;const result=win?'WIN':'LOSS';const ep=epel(p.pr.lower,p.pr.n);append({signal_id:p.id,signal_tick:p.entryTick,direction:p.direction,entry_price:p.entryPrice,horizon_ticks:p.horizon,expiry_tick:p.targetTick,expiry_price:target.quote,result,pnl:win?.78:-1,samples_before:p.pr.n,wins_before:p.pr.w,probability:p.pr.p.toFixed(6),wilson_lower:p.pr.lower.toFixed(6),epel_pass:ep,features:JSON.stringify(p.f)});console.log(`[${result}] #${p.id} ${p.direction} ${p.horizon}t entry=${p.entryPrice} expiry=${target.quote} prior=${p.pr.n} p=${p.pr.p.toFixed(3)} lower=${p.pr.lower.toFixed(3)} EPEL=${ep}`);pending.splice(pending.indexOf(p),1)}}
function onTick(t){const quote=+t.quote;if(!Number.isFinite(quote))return;ticks.push({seq:seq++,epoch:+t.epoch,quote});if(ticks.length>5000)ticks.shift();settle();signal()}
function connect(){ws=new WebSocket(URL);ws.on('open',()=>{console.log(`SynthEPEL-R75 v2.0 | ${C.asset} | TICK MODE | horizons=${C.horizons.join('/')}`);ws.send(JSON.stringify({ticks:C.asset,subscribe:1}))});ws.on('message',b=>{let m;try{m=JSON.parse(b)}catch{return}if(m.error){console.error('[DERIV]',m.error.message);return}if(m.msg_type==='tick'&&m.tick)onTick(m.tick)});ws.on('close',()=>{console.log('Disconnected; reconnecting...');setTimeout(connect,3000)});ws.on('error',e=>console.error('WebSocket:',e.message))}
init();console.log(JSON.stringify({project:'SynthEPEL-R75',version:'2.0.0',asset:C.asset,mode:'TICK_RESEARCH',horizons:C.horizons,signalEvery:C.signalEvery,lookback:C.lookback,stake:C.stake,epelLambda:C.lambda,minSamples:C.minSamples,ledger:C.logFile},null,2));connect();
