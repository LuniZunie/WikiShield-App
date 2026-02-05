#!/usr/bin/env python3

import sys
import json
import requests

def score_revisions(wiki, revids, models):
    host = "https://ores.wikimedia.org"
    url = f"{host}/v3/scores/{wiki}/"

    params = {
        'models': '|'.join(models),
        'revids': '|'.join(str(r) for r in revids)
    }

    try:
        response = requests.get(url, params=params, headers={ 'User-Agent': 'WikiShield/1.0' })
        response.raise_for_status()
        data = response.json()

        results = {}
        for revid_str, rev_data in data.get(wiki, { }).get('scores', { }).items():
            revid = int(revid_str)
            results[revid] = {}

            for model in models:
                if model in rev_data and 'score' in rev_data[model]:
                    results[revid][model] = rev_data[model]['score']

        return results
    except Exception as e:
        print(f"Error scoring revisions: {e}", file=sys.stderr)
        return { }

def main():
    if len(sys.argv) < 4:
        print("Usage: python ores_score.py <wiki> <models...> < input.jsonl", file=sys.stderr)
        sys.exit(1)

    wiki = sys.argv[1]
    models = sys.argv[2:]

    revids = []
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
            if 'rev_id' in data:
                revids.append(data['rev_id'])
        except json.JSONDecodeError:
            print(f"Warning: Skipping invalid JSON line: {line}", file=sys.stderr)

    if not revids:
        print("No revision IDs provided", file=sys.stderr)
        sys.exit(1)

    results = score_revisions(wiki, revids, models)

    for revid in revids:
        output = {
            'revid': revid,
            'score': results.get(revid, { })
        }
        if revid in results:
            output.update(results[revid])
        print(json.dumps(output))

if __name__ == "__main__":
    main()