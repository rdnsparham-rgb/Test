// server.js
// اجرا: npm install express body-parser yamljs cors
// سپس: node server.js
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const YAML = require('yamljs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(bodyParser.json({ limit: '1mb' }));
app.use(cors());

const JSON_FILE = path.join(__dirname, 'data.json');
const YAML_FILE = path.join(__dirname, 'data.yaml');
const HISTORY_FILE = path.join(__dirname, 'history.json');

let dataset = [];
try { dataset = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8')); } catch(e){}
try { const y = YAML.load(YAML_FILE); if(Array.isArray(y)) dataset = dataset.concat(y); } catch(e){}

function normalizePersian(s){
  if(!s) return '';
  return s.toString().replace(/[\u200c\u200b]+/g,'')
    .replace(/[ـ]/g,'').replace(/ي/g,'ی').replace(/ك/g,'ک')
    .replace(/[ًٌٍَُِْٰ]/g,'').replace(/[\r\n]+/g,' ')
    .trim().toLowerCase();
}

function tokenize(s){ return normalizePersian(s).split(/[\s,؟?!:.؛،]+/).filter(Boolean); }
function scoreMatch(inputTokens, targetTokens){
  const set = new Set(targetTokens); let score=0;
  for(const t of inputTokens) if(set.has(t)) score++;
  return score;
}

function generateByGrammar(tokens){
  const subjects=['من','تو','او','ما','شما','آنها'];
  const verbs=['می‌فهمم','می‌دانم','می‌توانم','تحلیل می‌کنم','کمک می‌کنم','می‌سازم'];
  const objects=['موضوعت را','جمله‌ات را','درخواستت را','نیازت را','ایده‌ات را'];
  const rnd=arr=>arr[Math.floor(Math.random()*arr.length)];
  return `${rnd(subjects)} ${rnd(verbs)} ${rnd(objects)}.`;
}

function loadHistory(){ try{ if(fs.existsSync(HISTORY_FILE)) return JSON.parse(fs.readFileSync(HISTORY_FILE,'utf8')); } catch(e){} return []; }
function appendHistory(entry){ const h = loadHistory(); h.push(entry); try{ fs.writeFileSync(HISTORY_FILE, JSON.stringify(h,null,2)); } catch(e){ console.error(e); } }

app.use('/', express.static(path.join(__dirname, '.')));

app.post('/chat', (req,res)=>{
  const msg = req.body.message || '';
  const inputTokens = tokenize(msg);

  let best=null; let bestScore=0;
  for(const item of dataset){
    const candTokens = tokenize(item.input);
    const s = scoreMatch(inputTokens,candTokens);
    if(s>bestScore){ bestScore=s; best=item; }
  }

  let response='';
  if(best && bestScore>0){ response=best.output; }
  else{
    const isQuestion=/[\?؟]$/.test(msg)||/\b(چطور|چگونه|چیه|چه|کجا|کی|چرا|آیا)\b/.test(normalizePersian(msg));
    const hasCodeWord=/\b(کد|برنامه|js|javascript|python|html|css|تابع|فانکشن)\b/.test(normalizePersian(msg));
    if(hasCodeWord) response="می‌تونم نمونه کد برات تولید کنم — بگو به چه زبان و چه کاری.";
    else if(isQuestion){ const kw=inputTokens[0]||inputTokens[1]||''; response=`سوال خوبی پرسیدی دربارهٔ "${kw}".`; }
    else response=generateByGrammar(inputTokens);
  }

  appendHistory({role:'user',text:msg,time:Date.now()});
  appendHistory({role:'bot',text:response,time:Date.now()});
  res.json({ok:true,response});
});

app.get('/status',(req,res)=>{ res.json({ok:true,datasetCount:dataset.length,historyCount:loadHistory().length}); });

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`Chatran server listening on http://localhost:${PORT}`));
