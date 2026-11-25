#!/usr/bin/env python3
"""Sync explicit GitHub task references to one configured Plane project."""
import json
import os
import re
import sys
from urllib.error import HTTPError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen


def references(text, marker):
    result = set()
    for line in text.splitlines():
        match = re.match(rf'^\s*{re.escape(marker)}:\s*(.+)$', line, re.I)
        if match:
            result.update(re.findall(r'\b[A-Z][A-Z0-9_]*-\d+\b', match[1].upper()))
    return result


def transitions(event_name, event):
    if event_name == 'workflow_dispatch':
        inputs = event['inputs']
        return {key: inputs['status'] for key in references('Plane: ' + inputs['tasks'], 'Plane')}
    if event_name == 'push':
        if event.get('deleted'):
            return {}
        return {key: 'done' for commit in event.get('commits', [])
                for key in references(commit['message'], 'Plane-Done')}
    pr = event['pull_request']
    if pr['head']['repo']['full_name'] != event['repository']['full_name']:
        return {}
    if event['action'] == 'closed' and not pr.get('merged'):
        return {}
    if pr.get('draft'):
        return {}
    status = 'done' if pr.get('merged') else 'review'
    return {key: status for key in references(pr['title'] + '\n' + (pr.get('body') or ''), 'Plane')}


class Client:
    def __init__(self):
        self.base = os.environ['PLANE_URL'].rstrip('/')
        if urlsplit(self.base).scheme not in ('http', 'https'):
            raise ValueError('PLANE_URL must be an http(s) URL')
        self.key = os.environ['PLANE_API_KEY']
        workspace = quote(os.environ['PLANE_WORKSPACE'], safe='')
        project = quote(os.environ['PLANE_PROJECT_ID'], safe='')
        self.path = f'/api/v1/workspaces/{workspace}/projects/{project}/'

    def request(self, path, method='GET', data=None):
        request = Request(self.base + path, method=method,
                          data=None if data is None else json.dumps(data).encode(),
                          headers={'X-API-Key': self.key, 'Content-Type': 'application/json'})
        with urlopen(request, timeout=30) as response:
            return json.load(response)

    def items(self, resource):
        cursor = None
        seen = set()
        while True:
            query = {'per_page': 100}
            if cursor:
                query['cursor'] = cursor
            page = self.request(self.path + resource + '/?' + urlencode(query))
            if isinstance(page, list):
                yield from page
                return
            yield from page['results']
            if not page.get('next_page_results'):
                return
            cursor = page.get('next_cursor')
            if not cursor or cursor in seen:
                raise ValueError('Invalid Plane pagination cursor')
            seen.add(cursor)


def main():
    with open(os.environ['GITHUB_EVENT_PATH']) as stream:
        event = json.load(stream)
    changes = transitions(os.environ['GITHUB_EVENT_NAME'], event)
    if not changes:
        print('No explicit Plane task references; nothing to update.')
        return
    required = ['PLANE_URL', 'PLANE_API_KEY', 'PLANE_WORKSPACE', 'PLANE_PROJECT_ID', 'PLANE_PROJECT_IDENTIFIER']
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        raise ValueError('Missing settings: ' + ', '.join(missing))
    prefix = os.environ['PLANE_PROJECT_IDENTIFIER'].upper()
    if any(key.rsplit('-', 1)[0] != prefix for key in changes):
        raise ValueError('Task reference belongs to a different Plane project')
    client = Client()
    project = client.request(client.path)
    if project['identifier'].upper() != prefix:
        raise ValueError('PLANE_PROJECT_ID and PLANE_PROJECT_IDENTIFIER do not match')
    states = {item['id']: item for item in client.items('states')}
    targets = {}
    for status in set(changes.values()):
        state_id = os.environ.get('PLANE_STATE_' + status.upper(), '')
        if state_id not in states:
            raise ValueError('Set valid project state: PLANE_STATE_' + status.upper())
        if status == 'done' and states[state_id]['group'] != 'completed':
            raise ValueError('Done state must belong to completed group')
        targets[status] = state_id
    resource = 'work-items'
    try:
        items = list(client.items(resource))
    except HTTPError as error:
        if error.code != 404:
            raise
        resource = 'issues'  # Older Community releases.
        items = list(client.items(resource))
    indexed = {f"{prefix}-{item['sequence_id']}": item for item in items}
    if set(changes) - indexed.keys():
        raise ValueError('Tasks not found: ' + ', '.join(sorted(set(changes) - indexed.keys())))
    dry_run = event.get('inputs', {}).get('dry_run', 'false') == 'true'
    for key, status in sorted(changes.items()):
        item = indexed[key]
        current = item.get('state_id') or item.get('state')
        if isinstance(current, dict):
            current = current['id']
        if current == targets[status]:
            print(f'{key}: already {status}')
            continue
        if status == 'review' and states.get(current, {}).get('group') in ('completed', 'cancelled'):
            print(f'{key}: terminal state preserved')
            continue
        print(f'{key}: {status}' + (' (dry run)' if dry_run else ''))
        if not dry_run:
            client.request(client.path + resource + '/' + item['id'] + '/', 'PATCH', {'state': targets[status]})


if __name__ == '__main__':
    try:
        main()
    except HTTPError as error:
        print(f'Plane API returned HTTP {error.code}', file=sys.stderr)
        sys.exit(1)
    except Exception as error:
        print(f'Plane sync failed: {error}', file=sys.stderr)
        sys.exit(1)
