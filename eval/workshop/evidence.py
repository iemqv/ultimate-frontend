"""Recover treatment exposure, tool uptake and post-preview revision from completed arms."""
import hashlib
import json
from pathlib import Path
import sys


def read(path): return json.loads(path.read_text())

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def collect(root):
    records=read(root/'runs.json'); summaries=[]; sessions=set(); prompts={}
    for record in records:
        arm=root/'arms'/record['id']; group=record['group']; errors=[]
        run=read(arm/'run.json') if (arm/'run.json').is_file() else {}
        if not all(key in run for key in ('usage','settings','output','skills','responses','captures')):
            summaries.append({**record,'status':run.get('status','absent'),'errors':['Incomplete report',*run.get('failures',[])], 'previews':len(run.get('browserPixelReturns',[])), 'reads':[item['path'] for item in run.get('skillReads',[])]}); continue
        def expect(condition,message):
            if not condition: errors.append(message)
        expect(run['preflight'] is False and run['status']=='completed','not a completed real run')
        cfg=run['settings']; expect((cfg['provider'],cfg['model'],cfg['thinking'])==('openai','gpt-6.2-sol','medium'),'runtime mismatch')
        expect(sorted(cfg['tools'])==['list_site','preview','read','write_site'] and not cfg['extensions'] and not cfg['contextFiles'],'capability mismatch')
        sid=run['usage']['sessionId']; expect(sid not in sessions,'reused session'); sessions.add(sid)
        prompt=(arm/'system-prompt.txt').read_text(); prompts.setdefault(group,set()).add(prompt)
        expect(digest(arm/'prompt.txt')==run['prompt']['sha256'],'prompt digest mismatch')
        expect(len(run['skills'])==int(group!='control'),'exposure mismatch')
        if group=='control':expect(not run['skillReads'] and '/skill/SKILL.md' not in prompt,'skill leaked into control')
        else:
            skill=root/'inputs'/group
            expect(run['skills'][0]['sha256']==digest(skill/'SKILL.md'),'wrong offered skill')
            for item in run['skillReads']:
                expect(item['sha256']==digest(skill/item['path'].removeprefix('/skill/')),'wrong skill read')
        events=[json.loads(line) for line in (arm/'events.jsonl').read_text().splitlines()]; writes=[e for e in events if e['type']=='tool' and e['name']=='write_site' and e['ok']]
        expect(bool(writes),'starter never edited'); expect(run['output']['files']['index.html']==digest(arm/'site/index.html'),'entry digest mismatch')
        for capture in [*run['browserPixelReturns'],*run['captures']['final'].values()]:expect(digest(arm/capture['file'])==capture['sha256'],'wrong screenshot')
        for capture in run['captures']['final'].values():expect(capture['revision']==run['output']['sha256'],'final capture not latest revision')
        first=run['captures']['first']; previews=run['browserPixelReturns']; final=run['captures']['final']; expect(set(final)=={'desktop','mobile'},'missing final captures')
        summaries.append({**record,'status':run['status'],'errors':errors,'requests':run['providerRequests'],'tokens':run['usage']['tokens'],
                          'reads':[r['path'] for r in run['skillReads']],'writes':[e['path'] for e in writes], 'previews':len(previews),
                          'changedAfterFirstPreview':None if not first else first['revision']!=run['output']['sha256'],
                          'firstWasBlankStarter':None if not first else not any(e['time']<first['time'] for e in writes),
                          'toolErrors':[e for e in events if e['type']=='tool' and not e['ok']],
                          'lastStop':run['responses'][-1]['stopReason'] if run.get('responses') else None})
    if any(len(values)!=1 for values in prompts.values()):raise ValueError('System instruction varies within a condition')
    (root/'process-evidence.json').write_text(json.dumps(summaries,indent=2)+'\n')
    for row in summaries:print(row['id'],row['brief'],row['group'],row['previews'],'tool-returned previews;',len(row['reads']),'skill reads;',row['errors'])
    return all(not row['errors'] for row in summaries)

if __name__=='__main__':sys.exit(0 if collect(Path(sys.argv[1])) else 1)
