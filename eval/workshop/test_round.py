"""Exercise assignment, frozen inputs and failed-arm accounting without inference."""
import json
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import round as workshop


class RoundTest(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory(); self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.here = self.root / 'workshop'
        self.baseline = self.root / 'installed'
        self.baseline.mkdir(); (self.baseline / 'SKILL.md').write_text('frozen baseline')
        for split in ('dev','holdout'):
            for brief in ('open','material','operate'):
                fixture=self.here/'fixtures'/split/brief
                (fixture/'site').mkdir(parents=True)
                (fixture/'prompt.txt').write_text(f'{split} {brief}')
        for attr,value in [('HERE',self.here),('BASELINE',self.baseline)]:
            mock=patch.object(workshop,attr,value);mock.start();self.addCleanup(mock.stop)

    def test_independent_assignments_and_no_resumption(self):
        out=self.root/'dev'; dev=workshop.prepare(out,None,None)
        self.assertEqual(len({r['id'] for r in dev}),12)
        self.assertEqual({(r['brief'],r['group'],r['repeat']) for r in dev},
                         {(b,g,n) for b in ['open','material','operate'] for g in ['control','baseline'] for n in [1,2]})
        with self.assertRaises(FileExistsError): workshop.prepare(out,None,None)
        (self.baseline/'SKILL.md').write_text('new candidate')
        hold=self.root/'hold'; assigned=workshop.prepare(hold,self.baseline,out)
        self.assertEqual({(r['brief'],r['group']) for r in assigned},
                         {(b,g) for b in ['open','material','operate'] for g in ['control','baseline','candidate']})
        self.assertEqual((hold/'inputs/baseline/SKILL.md').read_text(),'frozen baseline')
        self.assertEqual((hold/'inputs/candidate/SKILL.md').read_text(),'new candidate')
        (out/'inputs/fixtures/holdout/open/prompt.txt').write_text('changed')
        with self.assertRaisesRegex(ValueError,'Pilot inputs changed'):
            workshop.prepare(self.root/'tampered',self.baseline,out)

    def test_failed_control_kept_and_private_task_not_sent(self):
        out=self.root/'dev'; runs=workshop.prepare(out,None,None)
        run=next(r for r in runs if r['group']=='control')
        with patch.object(subprocess,'run',return_value=subprocess.CompletedProcess([],3)) as call:
            self.assertEqual(workshop.execute(out,run,'dev'),3)
        cmd=call.call_args.args[0]; f=out/'inputs/fixtures/dev'/run['brief']
        self.assertEqual(cmd,[sys.executable,str(self.here/'runner/arm.py'),str(out/'arms'/run['id']),str(f/'site'),str(f/'prompt.txt'),'-'])
        self.assertEqual(json.loads((out/'logs'/f"{run['id']}.status.json").read_text())['exit'],3)

if __name__=='__main__': unittest.main()
