#!/usr/bin/env node
/**
 * Build script: Converts mymind CSV export + resolved TikTok URLs into data.js
 * Run once: node build-data.js
 */

const fs = require('fs');
const path = require('path');

// Simple CSV parser that handles quoted fields, commas in values, and multiline
function parseCSV(text) {
    const rows = [];
    let current = '';
    let inQuotes = false;
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (inQuotes) {
            current += '\n' + line;
            if (line.includes('"')) {
                // Check if quote is closing
                let quoteCount = 0;
                for (const ch of line) {
                    if (ch === '"') quoteCount++;
                }
                if (quoteCount % 2 === 1) {
                    inQuotes = false;
                    rows.push(current);
                    current = '';
                }
            }
        } else {
            // Count quotes in line
            let quoteCount = 0;
            for (const ch of line) {
                if (ch === '"') quoteCount++;
            }
            if (quoteCount % 2 === 1) {
                inQuotes = true;
                current = line;
            } else {
                rows.push(line);
            }
        }
    }

    // Parse each row into fields
    return rows.filter(r => r.trim()).map(row => {
        const fields = [];
        let field = '';
        let inQ = false;

        for (let i = 0; i < row.length; i++) {
            const ch = row[i];
            if (ch === '"') {
                if (inQ && row[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQ = !inQ;
                }
            } else if (ch === ',' && !inQ) {
                fields.push(field);
                field = '';
            } else {
                field += ch;
            }
        }
        fields.push(field);
        return fields;
    });
}

// Extract YouTube video ID from URL
function extractYouTubeId(url) {
    const match = url.match(/(?:(?:m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
    return match ? match[1] : null;
}

// Extract Instagram post ID from URL
function extractInstagramId(url) {
    const match = url.match(/instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/i);
    return match ? match[1] : null;
}

// Extract Twitter/X tweet ID from URL
function extractTwitterId(url) {
    const match = url.match(/(?:twitter\.com|x\.com)\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/i);
    return match ? { user: match[1], id: match[2] } : null;
}

// Get file extension for local media
function getLocalFileExt(id, mediaDir) {
    const exts = ['.jpeg', '.jpg', '.png', '.webp', '.gif', '.mov', '.mp4', '.pdf'];
    for (const ext of exts) {
        const subDirs = ['images', 'videos', 'docs'];
        for (const sub of subDirs) {
            if (fs.existsSync(path.join(mediaDir, sub, id + ext))) {
                return { ext, subDir: sub, filename: id + ext };
            }
        }
    }
    return null;
}

function main() {
    // Read CSV
    const csvText = fs.readFileSync('cards.csv', 'utf-8').replace(/^\uFEFF/, ''); // Remove BOM
    const rows = parseCSV(csvText);

    if (rows.length === 0) {
        console.error('No rows found in CSV');
        process.exit(1);
    }

    // First row is headers
    const headers = rows[0];
    console.log('Headers:', headers);

    // Read resolved TikTok URLs
    let tiktokResolved = {};
    try {
        tiktokResolved = JSON.parse(fs.readFileSync('tiktok-resolved.json', 'utf-8'));
    } catch (e) {
        console.warn('No tiktok-resolved.json found, TikTok embeds will be link-only');
    }

    const mediaDir = path.join(__dirname, 'media');
    const entries = [];
    let skipped = 0;

    for (let i = 1; i < rows.length; i++) {
        const fields = rows[i];
        if (fields.length < 8) {
            skipped++;
            continue;
        }

        const [id, type, title, url, content, note, tags, created] = fields;

        if (!id || !type) {
            skipped++;
            continue;
        }

        const entry = {
            id: id.trim(),
            title: (title || '').trim(),
            url: (url || '').trim(),
            content: (content || '').trim(),
            note: (note || '').trim(),
            tags: (tags || '').split(',').map(t => t.trim()).filter(Boolean),
            timestamp: created ? new Date(created.trim()).getTime() : Date.now(),
            source: 'mymind',
        };

        // Map CSV type to app type
        switch (type.trim()) {
            case 'InstagramReel':
            case 'InstagramPost': {
                entry.platform = 'Instagram';
                const igId = extractInstagramId(entry.url);
                if (igId) {
                    entry.embedType = 'iframe';
                    entry.embedUrl = `https://www.instagram.com/p/${igId}/embed/?captioned=false`;
                } else {
                    entry.embedType = 'link';
                }
                break;
            }

            case 'TikTokPost':
            case 'TikTok': {
                entry.platform = 'TikTok';
                const resolved = tiktokResolved[entry.id];
                if (resolved && resolved.video_id) {
                    entry.embedType = 'iframe';
                    entry.embedUrl = `https://www.tiktok.com/embed/v2/${resolved.video_id}`;
                    entry.resolvedUrl = resolved.full_url;
                } else {
                    entry.embedType = 'link';
                }
                break;
            }

            case 'YouTubeVideo': {
                entry.platform = 'YouTube';
                const ytId = extractYouTubeId(entry.url);
                if (ytId) {
                    entry.embedType = 'iframe';
                    entry.embedUrl = `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`;
                } else {
                    entry.embedType = 'link';
                }
                break;
            }

            case 'XPost': {
                entry.platform = 'Twitter/X';
                const tweet = extractTwitterId(entry.url);
                if (tweet) {
                    entry.embedType = 'iframe';
                    entry.embedUrl = `https://platform.twitter.com/embed/Tweet.html?id=${tweet.id}&theme=dark&hide_thread=true`;
                } else {
                    entry.embedType = 'link';
                }
                break;
            }

            case 'Image': {
                entry.platform = 'Image';
                // Check for local file
                const localFile = getLocalFileExt(entry.id, mediaDir);
                if (localFile) {
                    entry.embedType = 'image';
                    entry.mediaFile = `media/${localFile.subDir}/${localFile.filename}`;
                } else if (entry.url) {
                    entry.embedType = 'image';
                    entry.mediaFile = entry.url;
                } else {
                    entry.embedType = 'text';
                }
                break;
            }

            case 'Video': {
                entry.platform = 'Video';
                const localVid = getLocalFileExt(entry.id, mediaDir);
                if (localVid) {
                    entry.embedType = 'video';
                    entry.mediaFile = `media/${localVid.subDir}/${localVid.filename}`;
                } else {
                    entry.embedType = 'link';
                }
                break;
            }

            case 'Document': {
                entry.platform = 'Document';
                const localDoc = getLocalFileExt(entry.id, mediaDir);
                if (localDoc) {
                    entry.embedType = 'document';
                    entry.mediaFile = `media/${localDoc.subDir}/${localDoc.filename}`;
                } else {
                    entry.embedType = 'text';
                }
                break;
            }

            case 'WebPage': {
                entry.platform = 'Web';
                entry.embedType = 'link';
                break;
            }

            case 'Article': {
                entry.platform = 'Article';
                entry.embedType = 'link';
                break;
            }

            case 'Note':
            case 'Post':
            case 'Content': {
                entry.platform = type.trim();
                entry.embedType = 'text';
                break;
            }

            default: {
                entry.platform = 'Other';
                // Check if it has a URL
                if (entry.url) {
                    entry.embedType = 'link';
                } else {
                    entry.embedType = 'text';
                }
                break;
            }
        }

        entries.push(entry);
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => b.timestamp - a.timestamp);

    // Generate data.js
    const output = `// Auto-generated from mymind CSV export
// Generated: ${new Date().toISOString()}
// Total entries: ${entries.length}
window.MYMIND_DATA = ${JSON.stringify(entries, null, 2)};
`;

    fs.writeFileSync('data.js', output, 'utf-8');

    // Stats
    const stats = {};
    entries.forEach(e => {
        const key = `${e.platform}/${e.embedType}`;
        stats[key] = (stats[key] || 0) + 1;
    });

    console.log(`\nGenerated data.js with ${entries.length} entries (${skipped} skipped)`);
    console.log('\nBreakdown:');
    Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
        console.log(`  ${count.toString().padStart(4)} ${key}`);
    });
}

main();
