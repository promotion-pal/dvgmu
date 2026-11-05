import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('sync', Path(__file__).with_name('github_sync.py'))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class SyncTests(unittest.TestCase):
    def event(self, **changes):
        pr = {'head': {'repo': {'full_name': 'org/repo'}}, 'title': 'Fix',
              'body': 'Plane: FESMU-12', 'merged': False, 'draft': False}
        pr.update(changes)
        return {'action': 'opened', 'repository': {'full_name': 'org/repo'}, 'pull_request': pr}

    def test_pr_review_and_merge(self):
        event = self.event()
        self.assertEqual(sync.transitions('pull_request', event), {'FESMU-12': 'review'})
        event['action'] = 'closed'
        self.assertEqual(sync.transitions('pull_request', event), {})
        event['pull_request']['merged'] = True
        self.assertEqual(sync.transitions('pull_request', event), {'FESMU-12': 'done'})

    def test_fork_and_draft_ignored(self):
        self.assertEqual(sync.transitions('pull_request', self.event(draft=True)), {})
        self.assertEqual(sync.transitions('pull_request', self.event(head={'repo': {'full_name': 'fork/repo'}})), {})

    def test_explicit_commit_marker_only(self):
        event = {'commits': [{'message': 'Fix FESMU-10\nPlane-Done: FESMU-12, FESMU-13'}]}
        self.assertEqual(sync.transitions('push', event), {'FESMU-12': 'done', 'FESMU-13': 'done'})
        event['deleted'] = True
        self.assertEqual(sync.transitions('push', event), {})

    def test_manual(self):
        self.assertEqual(sync.transitions('workflow_dispatch', {'inputs': {'tasks': 'fesmu-12', 'status': 'review'}}), {'FESMU-12': 'review'})

    def test_pagination(self):
        client = object.__new__(sync.Client)
        client.path = '/project/'
        with patch.object(client, 'request', side_effect=[
            {'results': [{'id': 'a'}], 'next_page_results': True, 'next_cursor': 'abc'},
            {'results': [{'id': 'b'}], 'next_page_results': False},
        ]) as request:
            self.assertEqual(list(client.items('issues')), [{'id': 'a'}, {'id': 'b'}])
            self.assertIn('cursor=abc', request.call_args.args[0])


if __name__ == '__main__':
    unittest.main()
