#!/usr/bin/env python3
"""Check all embed/source URLs for availability. Outputs dead link IDs."""

import json
import subprocess
import sys
import time
import re

def check_url(url, timeout=10):
    """Check if a URL is reachable. Returns (status_code, is_alive)."""
    try:
        result = subprocess.run(
            ['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', '-L',
             '--max-time', str(timeout), url],
            capture_output=True, text=True, timeout=timeout + 5
        )
        code = int(result.stdout.strip())
        return code, code < 400
    except Exception as e:
        return 0, False

def check_tiktok(video_id):
    """Check TikTok video via oEmbed API."""
    url = f"https://www.tiktok.com/oembed?url=https://www.tiktok.com/@user/video/{video_id}"
    try:
        result = subprocess.run(
            ['curl', '-s', '--max-time', '10', url],
            capture_output=True, text=True, timeout=15
        )
        data = json.loads(result.stdout)
        # If oEmbed returns title, video exists
        return bool(data.get('title') or data.get('html'))
    except:
        return False

def check_instagram(post_id):
    """Check Instagram post via oEmbed API."""
    url = f"https://noembed.com/embed?url=https://www.instagram.com/p/{post_id}/"
    try:
        result = subprocess.run(
            ['curl', '-s', '--max-time', '10', url],
            capture_output=True, text=True, timeout=15
        )
        data = json.loads(result.stdout)
        if data.get('error'):
            return False
        return bool(data.get('title') or data.get('html') or data.get('author_name'))
    except:
        return False

def check_youtube(video_id):
    """Check YouTube video via oEmbed API."""
    url = f"https://noembed.com/embed?url=https://www.youtube.com/watch?v={video_id}"
    try:
        result = subprocess.run(
            ['curl', '-s', '--max-time', '10', url],
            capture_output=True, text=True, timeout=15
        )
        data = json.loads(result.stdout)
        if data.get('error'):
            return False
        return bool(data.get('title'))
    except:
        return False

def check_twitter(tweet_id):
    """Check Twitter/X post."""
    url = f"https://publish.twitter.com/oembed?url=https://twitter.com/i/status/{tweet_id}"
    try:
        result = subprocess.run(
            ['curl', '-s', '--max-time', '10', url],
            capture_output=True, text=True, timeout=15
        )
        data = json.loads(result.stdout)
        return bool(data.get('html'))
    except:
        return False

def main():
    with open('data.js', 'r') as f:
        content = f.read()

    # Extract JSON array from data.js
    start = content.index('[')
    end = content.rindex(']') + 1
    items = json.loads(content[start:end])

    # Only check iframe embeds (video platforms)
    iframe_items = [i for i in items if i.get('embedType') == 'iframe']
    print(f"Checking {len(iframe_items)} embedded items...")

    dead = []
    alive = 0
    errors = 0

    for idx, item in enumerate(iframe_items):
        item_id = item['id']
        platform = item.get('platform', '')
        embed_url = item.get('embedUrl', '')
        original_url = item.get('url', '')

        print(f"  [{idx+1}/{len(iframe_items)}] {platform} {item_id}...", end=' ', flush=True)

        is_alive = False

        if platform == 'TikTok':
            # Extract video ID from embed URL
            match = re.search(r'/embed/v2/(\d+)', embed_url)
            if match:
                is_alive = check_tiktok(match.group(1))
            else:
                is_alive = False

        elif platform == 'Instagram':
            match = re.search(r'/p/([a-zA-Z0-9_-]+)/', embed_url)
            if match:
                is_alive = check_instagram(match.group(1))
            else:
                is_alive = False

        elif platform == 'YouTube':
            match = re.search(r'/embed/([a-zA-Z0-9_-]{11})', embed_url)
            if match:
                is_alive = check_youtube(match.group(1))
            else:
                is_alive = False

        elif platform == 'Twitter/X':
            match = re.search(r'id=(\d+)', embed_url)
            if match:
                is_alive = check_twitter(match.group(1))
            else:
                is_alive = False

        if is_alive:
            alive += 1
            print("OK")
        else:
            dead.append(item_id)
            print(f"DEAD")

        # Rate limit every 20 requests
        if (idx + 1) % 20 == 0:
            time.sleep(1)

    print(f"\nResults: {alive} alive, {len(dead)} dead, {errors} errors")

    # Save dead IDs
    with open('dead-links.json', 'w') as f:
        json.dump(dead, f, indent=2)

    print(f"Dead link IDs saved to dead-links.json")

if __name__ == '__main__':
    main()
