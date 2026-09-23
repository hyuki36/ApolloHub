#!/usr/bin/env python3
"""ApolloHub review bot — merge live approved scripts into scripts.json.

Reads /tmp/apollo_export.json from /api/bot/export, upserts entries by id
(fallback slug), never deletes. Seeds stay untouched unless updated in place.
"""
import json

EXPORT_PATH = '/tmp/apollo_export.json'
REPO_PATH = 'scripts.json'


def main():
    with open(EXPORT_PATH, encoding='utf-8') as f:
        exp = json.load(f)
    with open(REPO_PATH, encoding='utf-8') as f:
        data = json.load(f)

    data.setdefault('scripts', [])
    by_id = {s.get('id'): i for i, s in enumerate(data['scripts']) if s.get('id')}
    by_slug = {s.get('slug'): i for i, s in enumerate(data['scripts']) if s.get('slug')}

    added, updated = [], []
    for e in exp.get('scripts', []):
        if not e.get('id') or not e.get('k'):
            continue
        i = by_id.get(e.get('id'))
        if i is None and e.get('slug'):
            i = by_slug.get(e.get('slug'))
        if i is None:
            data['scripts'].append(e)
            by_id[e['id']] = len(data['scripts']) - 1
            if e.get('slug'):
                by_slug[e['slug']] = len(data['scripts']) - 1
            added.append(e.get('slug') or e.get('id'))
        else:
            data['scripts'][i] = e
            updated.append(e.get('slug') or e.get('id'))

    with open(REPO_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')

    print('added=%s updated=%s skipped=%s' % (added, updated, exp.get('skipped', [])))


if __name__ == '__main__':
    main()
