#!/usr/bin/env python3
"""Remove dead links from data.js based on dead-links.json."""

import json

# Load dead link IDs
with open('dead-links.json', 'r') as f:
    dead_ids = set(json.load(f))

# Load data.js
with open('data.js', 'r') as f:
    content = f.read()

# Extract JSON array
start = content.index('[')
end = content.rindex(']') + 1
items = json.loads(content[start:end])

original_count = len(items)
items = [item for item in items if item['id'] not in dead_ids]
removed = original_count - len(items)

# Write updated data.js
with open('data.js', 'w') as f:
    f.write('// Auto-generated from mymind CSV export\n')
    f.write(f'// Dead links removed: {removed}\n')
    f.write(f'// Total entries: {len(items)}\n')
    f.write('window.MYMIND_DATA = ')
    json.dump(items, f, indent=2, ensure_ascii=False)
    f.write(';\n')

print(f"Removed {removed} dead links. {len(items)} entries remain.")
