// Collect visitor-visible evidence separately from the model's own screenshots.
// Usage: node inspect.cjs ROOT PORT [ACTION_FILE.json]
// Actions are per-site recorded tab/keyboard recipes authored after inspecting controls.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/opt/postman/app/resources/app/node_modules/playwright-core');
const executablePath = path.join(require('node:os').homedir(), '.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell');

async function observe(page) {
  return page.evaluate(() => {
    const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
    const desc = el => ({tag:el.tagName.toLowerCase(), role:el.getAttribute('role'), type:el.type, name:el.getAttribute('aria-label') || [...el.labels || []].map(l=>l.innerText).join(' ') || el.innerText || el.value || '', checked:el.checked, selected:el.value, options:el.options && [...el.options].map(o=>o.text),context:el.closest('article,li,tr,fieldset')?.innerText.slice(0,160)});
    return {text:document.body.innerText, controls:[...document.querySelectorAll('button,select,input,a[href],[tabindex],[role=button],[role=radio],[role=checkbox],summary')].filter(visible).map(desc),
      images:[...document.images].filter(visible).map(i=>({src:i.getAttribute('src'),alt:i.alt,loaded:i.complete&&i.naturalWidth>0})),
      focus:desc(document.activeElement),focusVisible:document.activeElement.matches(':focus-visible'),
      overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
}

(async()=>{
  const [root,port,actionsFile]=process.argv.slice(2);
  if (!root || !/^\d+$/.test(port)) throw Error('Usage: node inspect.cjs ROOT PORT [ACTIONS.json]');
  const actions=actionsFile?JSON.parse(fs.readFileSync(actionsFile)):{};
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'runs.json')));
  const seed=fs.readFileSync(path.join(root,'.pilot-gallery','seed'),'ascii');
  const base=`http://127.0.0.1:${port}`;
  const response=await fetch(`${base}/_capture`,{headers:{Authorization:`Bearer ${seed}`},redirect:'error'});
  if(!response.ok)throw Error('Gallery mapping unavailable');
  const {runs}=await response.json();
  const out=path.join(root,'task-observations');fs.mkdirSync(out,{recursive:true,mode:0o700});
  const browser=await chromium.launch({executablePath,args:['--no-sandbox']});
  try {
    for(const {id,token} of runs){
      if(!manifest.some(r=>r.id===id)|| !/^[0-9a-f]+$/.test(token))throw Error('Invalid gallery mapping');
      if(actionsFile && !Object.hasOwn(actions,id)) continue;
      for(const width of [1280,390]){
        const page=await browser.newPage({viewport:{width,height:width===390?844:800},reducedMotion:'reduce',serviceWorkers:'block'});
        const prefix=`${base}/c/${token}/`;
        await page.route('**/*',r=>r.request().url().startsWith(prefix)?r.continue():r.abort());
        const evidence=[];
        try {
          const res=await page.goto(prefix,{timeout:9000,waitUntil:'networkidle'});
          if (!res?.ok()) throw Error(`Entry returned HTTP ${res?.status()}`);
          evidence.push({stage:'initial',status:res.status(),...await observe(page)});
          for(const step of actions[id]||[]){
            for(const key of step.keys)await page.keyboard.press(key);
            await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
            evidence.push({stage:step.stage,keys:step.keys,...await observe(page)});
          }
        } catch(e){evidence.push({error:e.message});process.exitCode=1;}
        finally{await page.close();}
        fs.writeFileSync(path.join(out,`${id}-${width}${actionsFile?'-steps':''}.json`),JSON.stringify(evidence,null,2),{mode:0o600});
      }
    }
  } finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
