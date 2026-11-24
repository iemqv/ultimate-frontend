"""Check the entire recorded conversation envelope for each one-shot generation."""
import hashlib
import json
from pathlib import Path
import sys
from trace import bundle


def require(ok, message):
    if not ok: raise ValueError(message)


def verify(root):
    require((root/'completed.txt').read_text().strip() == 'all four pipelines exited zero', 'Run did not complete')
    base = (root/'system.txt').read_text()
    skill = bundle(root/'skill')
    require(skill == (root/'treatment.txt').read_text().rstrip('\n'), 'Frozen instructions differ')
    for brief in ('basic','detailed'):
        prompt = (root/'briefs'/f'{brief}.txt').read_text().rstrip('\n')
        for arm in ('plain','skill'):
            name=f'{brief}-{arm}'
            system,user,response,end,artifact=json.loads((root/'logs'/f'{name}.json').read_text())
            instructions=base+ ('\n\n'+skill if arm=='skill' else '')
            require(system['role']=='system' and not system.get('toolsAdded') and system.get('content','')=='' and system['sections']=={'preamble': instructions, 'cwd':'<cwd>\n/work\n</cwd>'}, f'{name}: unexpected system or tools')
            require(user=={'role':'user','content':[{'type':'text','text':prompt}]},f'{name}: different user context')
            require(response=={'role':'assistant','provider':'openai','model':'gpt-6.2-sol','stopReason':'stop'} and end=={'settled':True},f'{name}: incomplete or wrong model')
            data=(root/'arms'/name/'index.html').read_bytes()
            require(artifact=={'sha256':hashlib.sha256(data).hexdigest()}, f'{name}: artifact mismatch')
            print(f'{name}: one prompt, zero tools, one reply, expected system and HTML digest')

if __name__=='__main__': verify(Path(sys.argv[1]))
