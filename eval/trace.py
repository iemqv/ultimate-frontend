"""Trusted output collector. No model-controlled filenames, commands, or tool calls."""
import hashlib
import json
from pathlib import Path
import re
import sys


def bundle(root):
    files = [root / 'SKILL.md', *sorted((root / 'references').glob('*.md'))]
    return '\n\n'.join(f'[{p.relative_to(root)}]\n{p.read_text().rstrip()}' for p in files)


def collect(root, name, stream):
    events, reply = [], None
    started = settled = False
    for line in stream:
        e = json.loads(line); kind = e['type']; m = e.get('message', {})
        if settled and (kind.startswith('message_') or kind == 'agent_settled'):
            raise ValueError('Conversation continued after settlement')
        if kind == 'message_start' and m.get('role') == 'assistant':
            if started: raise ValueError('Multiple assistant replies')
            started = True
        if kind.startswith('tool_execution') or m.get('role') == 'toolResult':
            raise ValueError('Tools must be absent')
        if kind == 'message_start' and m.get('role') in ('system', 'user'):
            events.append({k: m[k] for k in ('role','sections','content','toolsAdded') if k in m})
        if kind == 'message_end' and m.get('role') == 'assistant':
            if not started or reply is not None or m['stopReason'] != 'stop': raise ValueError(f'Expected one complete reply, got {m.get("stopReason")}')
            if any(part['type'] not in ('text','thinking','redactedThinking') for part in m['content']): raise ValueError('Unexpected assistant action')
            reply = ''.join(part['text'] for part in m['content'] if part['type']=='text').strip()
            events.append({k:m[k] for k in ('role','provider','model','stopReason')})
        if kind == 'agent_settled':
            settled = True
            events.append({'settled':not e['aborted']})
    if not reply or events[-1:] != [{'settled':True}]: raise ValueError('Incomplete stream')
    fenced = re.fullmatch(r'```(?:html)?\s*\n(.*?)\n```',reply,re.S|re.I)
    html=(fenced[1] if fenced else reply).strip()
    if not re.match(r'<!doctype\s+html\s*>',html,re.I) or not html.lower().endswith('</html>'): raise ValueError('Expected complete HTML document')
    data=html.encode(); events.append({'sha256':hashlib.sha256(data).hexdigest()})
    (root/'arms'/name/'index.html').write_bytes(data)
    (root/'logs'/f'{name}.json').write_text(json.dumps(events, ensure_ascii=False))

if __name__=='__main__':
    if sys.argv[1]=='--bundle': print(bundle(Path(sys.argv[2])))
    else: collect(Path(sys.argv[1]), sys.argv[2], sys.stdin)
