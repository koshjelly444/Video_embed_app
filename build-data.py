#!/usr/bin/env python3
"""
Build script: Converts mymind CSV export + resolved TikTok URLs into data.js
Run once: python3 build-data.py
"""

import csv
import json
import os
import re
from datetime import datetime

def extract_youtube_id(url):
    match = re.search(
        r'(?:(?:m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})',
        url, re.I
    )
    return match.group(1) if match else None

def extract_instagram_id(url):
    match = re.search(r'instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)', url, re.I)
    return match.group(1) if match else None

def extract_twitter_id(url):
    match = re.search(r'(?:twitter\.com|x\.com)\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)', url, re.I)
    return {'user': match.group(1), 'id': match.group(2)} if match else None

def get_local_file(entry_id, media_dir):
    exts = ['.jpeg', '.jpg', '.png', '.webp', '.gif', '.mov', '.mp4', '.pdf']
    sub_dirs = {'images': ['.jpeg', '.jpg', '.png', '.webp', '.gif'],
                'videos': ['.mov', '.mp4'],
                'docs': ['.pdf']}
    for sub, valid_exts in sub_dirs.items():
        for ext in valid_exts:
            filepath = os.path.join(media_dir, sub, entry_id + ext)
            if os.path.exists(filepath):
                return f'media/{sub}/{entry_id}{ext}'
    return None

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, 'cards.csv')
    tiktok_path = os.path.join(script_dir, 'tiktok-resolved.json')
    media_dir = os.path.join(script_dir, 'media')

    # Read resolved TikTok URLs
    tiktok_resolved = {}
    try:
        with open(tiktok_path, 'r') as f:
            tiktok_resolved = json.load(f)
    except FileNotFoundError:
        print('Warning: No tiktok-resolved.json found')

    # Read CSV
    entries = []
    skipped = 0

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entry_id = (row.get('id') or '').strip()
            entry_type = (row.get('type') or '').strip()
            title = (row.get('title') or '').strip()
            url = (row.get('url') or '').strip()
            content = (row.get('content') or '').strip()
            note = (row.get('note') or '').strip()
            tags_str = (row.get('tags') or '').strip()
            created = (row.get('created') or '').strip()

            if not entry_id or not entry_type:
                skipped += 1
                continue

            # Parse tags
            tags = [t.strip() for t in tags_str.split(',') if t.strip()]

            # Parse timestamp
            try:
                ts = int(datetime.fromisoformat(created.replace('Z', '+00:00')).timestamp() * 1000)
            except (ValueError, AttributeError):
                ts = int(datetime.now().timestamp() * 1000)

            entry = {
                'id': entry_id,
                'title': title,
                'url': url,
                'tags': tags,
                'timestamp': ts,
                'source': 'mymind',
            }

            # Only include content/note if non-empty
            if content:
                entry['content'] = content
            if note:
                entry['note'] = note

            # Map CSV type to app type
            if entry_type in ('InstagramReel', 'InstagramPost'):
                entry['platform'] = 'Instagram'
                ig_id = extract_instagram_id(url) if url else None
                if ig_id:
                    entry['embedType'] = 'iframe'
                    entry['embedUrl'] = f'https://www.instagram.com/p/{ig_id}/embed/?captioned=false'
                else:
                    entry['embedType'] = 'link'

            elif entry_type in ('TikTokPost', 'TikTok'):
                entry['platform'] = 'TikTok'
                resolved = tiktok_resolved.get(entry_id)
                if resolved and resolved.get('video_id'):
                    entry['embedType'] = 'iframe'
                    entry['embedUrl'] = f'https://www.tiktok.com/embed/v2/{resolved["video_id"]}'
                else:
                    entry['embedType'] = 'link'

            elif entry_type == 'YouTubeVideo':
                entry['platform'] = 'YouTube'
                yt_id = extract_youtube_id(url) if url else None
                if yt_id:
                    entry['embedType'] = 'iframe'
                    entry['embedUrl'] = f'https://www.youtube.com/embed/{yt_id}?rel=0&modestbranding=1'
                else:
                    entry['embedType'] = 'link'

            elif entry_type == 'XPost':
                entry['platform'] = 'Twitter/X'
                tweet = extract_twitter_id(url) if url else None
                if tweet:
                    entry['embedType'] = 'iframe'
                    entry['embedUrl'] = f'https://platform.twitter.com/embed/Tweet.html?id={tweet["id"]}&theme=dark&hide_thread=true'
                else:
                    entry['embedType'] = 'link'

            elif entry_type == 'Image':
                entry['platform'] = 'Image'
                local_file = get_local_file(entry_id, media_dir)
                if local_file:
                    entry['embedType'] = 'image'
                    entry['mediaFile'] = local_file
                elif url:
                    entry['embedType'] = 'image'
                    entry['mediaFile'] = url
                else:
                    entry['embedType'] = 'text'

            elif entry_type == 'Video':
                entry['platform'] = 'Video'
                local_file = get_local_file(entry_id, media_dir)
                if local_file:
                    entry['embedType'] = 'video'
                    entry['mediaFile'] = local_file
                else:
                    entry['embedType'] = 'link'

            elif entry_type == 'Document':
                entry['platform'] = 'Document'
                local_file = get_local_file(entry_id, media_dir)
                if local_file:
                    entry['embedType'] = 'document'
                    entry['mediaFile'] = local_file
                else:
                    entry['embedType'] = 'text'

            elif entry_type == 'WebPage':
                entry['platform'] = 'Web'
                entry['embedType'] = 'link'

            elif entry_type == 'Article':
                entry['platform'] = 'Article'
                entry['embedType'] = 'link'

            elif entry_type in ('Note', 'Post', 'Content'):
                entry['platform'] = entry_type
                entry['embedType'] = 'text'

            else:
                entry['platform'] = 'Other'
                entry['embedType'] = 'link' if url else 'text'

            entries.append(entry)

    # Sort by timestamp (newest first)
    entries.sort(key=lambda e: e['timestamp'], reverse=True)

    # Generate data.js
    output = f'''// Auto-generated from mymind CSV export
// Generated: {datetime.now().isoformat()}
// Total entries: {len(entries)}
window.MYMIND_DATA = {json.dumps(entries, indent=2)};
'''

    output_path = os.path.join(script_dir, 'data.js')
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(output)

    # Stats
    stats = {}
    for e in entries:
        key = f"{e['platform']}/{e['embedType']}"
        stats[key] = stats.get(key, 0) + 1

    print(f'Generated data.js with {len(entries)} entries ({skipped} skipped)')
    print(f'\nBreakdown:')
    for key, count in sorted(stats.items(), key=lambda x: -x[1]):
        print(f'  {count:4d} {key}')

if __name__ == '__main__':
    main()
