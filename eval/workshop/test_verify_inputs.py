"""The delivery check must not accept a substituted prompt or a missing generation."""
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from round import fingerprint, store
from verify_inputs import verify


class DeliveryTest(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory(); self.addCleanup(temp.cleanup)
        self.root = root = Path(temp.name); (root / 'logs').mkdir()
        records=[]
        for b in ('open','material','operate'):
            fixture = root/'inputs/fixtures/dev'/b; fixture.mkdir(parents=True)
            (fixture/'prompt.txt').write_text(b)
            for g in ('control','baseline'):
                for n in (1,2):
                    name=f'{b}-{g}-{n}'; record=dict(id=name,brief=b,group=g,repeat=n); records.append(record)
                    arm=root/'arms'/name; (arm/'site').mkdir(parents=True)
                    (arm/'site/index.html').write_text('<h1>demo</h1>'); (arm/'prompt.txt').write_text(b)
                    store(root/'logs'/f'{name}.status.json',{'exit':0})
        store(root/'runs.json',records); store(root/'protocol.json',{'split':'dev'}); store(root/'digests.json',fingerprint(root/'inputs'))

    def test_exact_prompt(self):
        self.assertTrue(verify(self.root)); (self.root/'arms/open-control-1/prompt.txt').write_text('other')
        with self.assertRaisesRegex(ValueError,'Prompt mismatch'): verify(self.root)

    def test_wrong_repeat_with_unique_ids(self):
        records=json.loads((self.root/'runs.json').read_text()); records[-1]['repeat']=99
        store(self.root/'runs.json',records)
        with self.assertRaisesRegex(ValueError,'Assignment'): verify(self.root)

    def test_unexpected_frozen_file(self):
        (self.root/'inputs/unexpected.txt').write_text('changed')
        with self.assertRaisesRegex(ValueError,'Frozen inputs changed'): verify(self.root)

    def test_missing_and_duplicate(self):
        (self.root/'arms/operate-baseline-1/site/index.html').unlink()
        self.assertFalse(verify(self.root))
        records=json.loads((self.root/'runs.json').read_text()); records[-1]=records[0]
        store(self.root/'runs.json',records)
        with self.assertRaisesRegex(ValueError,'Assignment'): verify(self.root)

if __name__=='__main__': unittest.main()
