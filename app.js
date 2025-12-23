// Focus Video - Distraction-Free Video Viewing App

class FocusVideo {
    // Allowed embed domains for security
    static ALLOWED_EMBED_DOMAINS = [
        'www.youtube.com',
        'player.vimeo.com',
        'www.tiktok.com',
        'platform.twitter.com',
        'www.instagram.com',
        'www.facebook.com'
    ];

    // Allowed image extensions
    static IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

    // Category keywords for auto-detection
    static CATEGORY_KEYWORDS = {
        'Music': ['music', 'song', 'album', 'concert', 'remix', 'cover', 'lyrics', 'official video', 'mv', 'beat', 'hip hop', 'rap', 'rock', 'pop', 'jazz', 'edm', 'dj', 'playlist', 'acoustic', 'live performance', 'singer', 'band', 'audio'],
        'Gaming': ['game', 'gaming', 'gameplay', 'playthrough', 'walkthrough', 'speedrun', 'esports', 'twitch', 'stream', 'fortnite', 'minecraft', 'valorant', 'league', 'cod', 'gta', 'ps5', 'xbox', 'nintendo', 'pc gaming', 'let\'s play'],
        'Tech': ['tech', 'technology', 'review', 'unboxing', 'iphone', 'android', 'laptop', 'computer', 'software', 'app', 'coding', 'programming', 'tutorial', 'how to', 'gadget', 'ai', 'robot', 'startup', 'apple', 'google', 'microsoft'],
        'Comedy': ['funny', 'comedy', 'laugh', 'joke', 'prank', 'meme', 'hilarious', 'sketch', 'standup', 'parody', 'roast', 'blooper', 'fail', 'wtf', 'lol', 'humor'],
        'Sports': ['sports', 'football', 'basketball', 'soccer', 'nba', 'nfl', 'mlb', 'hockey', 'tennis', 'golf', 'boxing', 'mma', 'ufc', 'wrestling', 'olympics', 'workout', 'fitness', 'gym', 'training', 'highlights', 'goal'],
        'Education': ['learn', 'education', 'tutorial', 'course', 'lecture', 'explain', 'how to', 'tips', 'guide', 'lesson', 'study', 'science', 'history', 'math', 'english', 'documentary', 'ted', 'facts'],
        'Entertainment': ['movie', 'film', 'trailer', 'series', 'show', 'episode', 'netflix', 'disney', 'marvel', 'dc', 'anime', 'drama', 'reaction', 'celebrity', 'interview', 'podcast', 'vlog', 'daily'],
        'News': ['news', 'breaking', 'update', 'politics', 'election', 'president', 'report', 'journalist', 'media', 'cnn', 'fox', 'bbc', 'live', 'announcement'],
        'Food': ['food', 'recipe', 'cooking', 'chef', 'restaurant', 'eat', 'taste', 'mukbang', 'kitchen', 'baking', 'meal', 'dinner', 'lunch', 'breakfast', 'delicious', 'yummy'],
        'Travel': ['travel', 'trip', 'vacation', 'tour', 'vlog', 'adventure', 'explore', 'destination', 'hotel', 'flight', 'beach', 'mountain', 'city', 'country', 'abroad']
    };

    static CATEGORY_ICONS = {
        'Music': '🎵',
        'Gaming': '🎮',
        'Tech': '💻',
        'Comedy': '😂',
        'Sports': '⚽',
        'Education': '📚',
        'Entertainment': '🎬',
        'News': '📰',
        'Food': '🍕',
        'Travel': '✈️',
        'Image': '🖼️',
        'Other': '📹'
    };

    constructor() {
        this.videoForm = document.getElementById('video-form');
        this.videoUrlInput = document.getElementById('video-url');
        this.videoContainer = document.getElementById('video-container');
        this.videoEmbed = document.getElementById('video-embed');
        this.videoPlatform = document.getElementById('video-platform');
        this.closeVideoBtn = document.getElementById('close-video');
        this.historyList = document.getElementById('history-list');
        this.historySection = document.getElementById('history-section');
        this.themeToggle = document.getElementById('theme-toggle');
        this.errorToast = document.getElementById('error-toast');

        // Feed elements
        this.feedSection = document.getElementById('feed-section');
        this.videoFeed = document.getElementById('video-feed');
        this.categoryFilter = document.getElementById('category-filter');

        // Current filter
        this.selectedCategory = 'all';

        this.history = this.loadHistory();

        this.init();
    }

    // Security: Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Security: Validate that embed URL is from allowed domain
    isValidEmbedUrl(url) {
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'https:') {
                return false;
            }
            return FocusVideo.ALLOWED_EMBED_DOMAINS.includes(parsed.hostname);
        } catch {
            return false;
        }
    }

    // Security: Validate video data structure
    isValidVideoData(data) {
        if (!data || typeof data !== 'object') return false;
        if (typeof data.id !== 'string' || data.id.length > 100) return false;
        if (typeof data.platform !== 'string' || data.platform.length > 20) return false;
        if (typeof data.url !== 'string' || data.url.length > 500) return false;
        // Allow images or valid embed URLs
        if (data.type === 'image') {
            return typeof data.embedUrl === 'string' && data.embedUrl.length > 0;
        }
        if (typeof data.embedUrl !== 'string' || !this.isValidEmbedUrl(data.embedUrl)) return false;
        return true;
    }

    init() {
        // Event listeners
        this.videoForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.closeVideoBtn.addEventListener('click', () => this.closeVideo());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Load saved theme
        this.loadTheme();

        // Render feed on load
        this.renderFeed();
    }

    async handleSubmit(e) {
        e.preventDefault();
        const url = this.videoUrlInput.value.trim();

        if (!url) {
            this.showError('Please enter a video URL');
            return;
        }

        const videoData = this.parseVideoUrl(url);

        if (!videoData) {
            this.showError('Unsupported video URL. Please use YouTube, Vimeo, TikTok, Twitter/X, Instagram, or Facebook.');
            return;
        }

        // Security: Validate the parsed video data
        if (!this.isValidVideoData(videoData)) {
            this.showError('Invalid video URL format.');
            return;
        }

        // Check for duplicate
        if (this.history.some(item => item.id === videoData.id)) {
            this.showError('This video is already in your feed.');
            this.videoUrlInput.value = '';
            return;
        }

        // Fetch caption/title from oEmbed
        const caption = await this.fetchVideoCaption(videoData.url, videoData.platform);
        if (caption) {
            videoData.caption = caption;
            // Auto-detect category from title
            videoData.category = this.detectCategory(caption);
        } else {
            videoData.category = 'Other';
        }

        this.addToHistory(videoData);
        this.videoUrlInput.value = '';
    }

    // Fetch video title/caption using oEmbed API
    async fetchVideoCaption(url, platform) {
        try {
            // Use noembed.com as a CORS-friendly oEmbed proxy
            const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
            if (!response.ok) return null;

            const data = await response.json();

            // Different platforms return title in different fields
            if (data.title) {
                return data.title;
            }

            // For Twitter, the caption might be in html or other fields
            if (data.author_name && platform === 'Twitter/X') {
                return `@${data.author_name}`;
            }

            return null;
        } catch (error) {
            console.log('Could not fetch caption:', error);
            return null;
        }
    }

    // Auto-detect category from video title/caption
    detectCategory(title) {
        if (!title) return 'Other';

        const lowerTitle = title.toLowerCase();
        let bestMatch = { category: 'Other', score: 0 };

        for (const [category, keywords] of Object.entries(FocusVideo.CATEGORY_KEYWORDS)) {
            let score = 0;
            for (const keyword of keywords) {
                if (lowerTitle.includes(keyword)) {
                    score++;
                }
            }
            if (score > bestMatch.score) {
                bestMatch = { category, score };
            }
        }

        return bestMatch.category;
    }

    parseVideoUrl(url) {
        // Clean URL - trim whitespace and normalize
        url = url.trim();

        // Add https:// if no protocol specified
        if (!url.match(/^https?:\/\//i)) {
            url = 'https://' + url;
        }

        // YouTube - handles youtube.com, m.youtube.com, youtu.be, shorts, live, embed
        const youtubeRegex = /(?:(?:m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
        const youtubeMatch = url.match(youtubeRegex);
        if (youtubeMatch) {
            return {
                platform: 'YouTube',
                id: youtubeMatch[1],
                url: url,
                // Hide captions, related videos, and branding - no autoplay
                embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0&modestbranding=1&cc_load_policy=0`
            };
        }

        // Vimeo - handles vimeo.com and player.vimeo.com
        const vimeoRegex = /(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i;
        const vimeoMatch = url.match(vimeoRegex);
        if (vimeoMatch) {
            return {
                platform: 'Vimeo',
                id: vimeoMatch[1],
                url: url,
                // Hide title, byline, and portrait - no autoplay
                embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?title=0&byline=0&portrait=0`
            };
        }

        // TikTok - handles tiktok.com, m.tiktok.com, vm.tiktok.com (short links need expansion)
        const tiktokRegex = /(?:(?:m|www)\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/i;
        const tiktokMatch = url.match(tiktokRegex);
        if (tiktokMatch) {
            return {
                platform: 'TikTok',
                id: tiktokMatch[1],
                url: url,
                embedUrl: `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`
            };
        }

        // TikTok short link (vm.tiktok.com) - extract video ID from path
        const tiktokShortRegex = /vm\.tiktok\.com\/([a-zA-Z0-9]+)/i;
        const tiktokShortMatch = url.match(tiktokShortRegex);
        if (tiktokShortMatch) {
            return {
                platform: 'TikTok',
                id: tiktokShortMatch[1],
                url: url,
                embedUrl: `https://www.tiktok.com/embed/v2/${tiktokShortMatch[1]}`,
                isShortLink: true
            };
        }

        // Twitter/X - handles twitter.com, x.com, mobile.twitter.com
        const twitterRegex = /(?:(?:mobile\.)?twitter\.com|x\.com)\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/i;
        const twitterMatch = url.match(twitterRegex);
        if (twitterMatch) {
            const theme = document.documentElement.getAttribute('data-theme') || 'light';
            return {
                platform: 'Twitter/X',
                id: twitterMatch[2],
                url: url,
                // Hide tweet text, show only media
                embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${twitterMatch[2]}&theme=${theme}&hide_thread=true&hide_tweet=true`
            };
        }

        // Instagram - handles instagram.com, www.instagram.com for reels, posts, tv
        const instagramRegex = /(?:www\.)?instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/i;
        const instagramMatch = url.match(instagramRegex);
        if (instagramMatch) {
            return {
                platform: 'Instagram',
                id: instagramMatch[1],
                url: url,
                // Hide captions
                embedUrl: `https://www.instagram.com/p/${instagramMatch[1]}/embed/?captioned=false`
            };
        }

        // Facebook - handles facebook.com, fb.watch, m.facebook.com
        const facebookVideoRegex = /(?:(?:m|www)\.)?facebook\.com\/(?:watch\/?\?v=|[\w.-]+\/videos\/|reel\/)(\d+)/i;
        const facebookMatch = url.match(facebookVideoRegex);
        if (facebookMatch) {
            return {
                platform: 'Facebook',
                id: facebookMatch[1],
                url: url,
                embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`
            };
        }

        // fb.watch short links
        const fbWatchRegex = /fb\.watch\/([a-zA-Z0-9_-]+)/i;
        const fbWatchMatch = url.match(fbWatchRegex);
        if (fbWatchMatch) {
            return {
                platform: 'Facebook',
                id: fbWatchMatch[1],
                url: url,
                embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`
            };
        }

        // Direct image URLs
        const urlLower = url.toLowerCase();
        const isImage = FocusVideo.IMAGE_EXTENSIONS.some(ext => urlLower.includes(ext));
        if (isImage) {
            // Generate unique ID from URL
            const imageId = btoa(url).slice(0, 20);
            return {
                platform: 'Image',
                id: imageId,
                url: url,
                embedUrl: url,
                type: 'image'
            };
        }

        return null;
    }

    embedVideo(videoData) {
        // Security: Final validation before embedding
        if (!this.isValidEmbedUrl(videoData.embedUrl)) {
            this.showError('Invalid embed URL.');
            return;
        }

        this.videoPlatform.textContent = this.escapeHtml(videoData.platform);
        this.videoContainer.classList.remove('hidden');

        // Sandbox prevents navigation away from app - allow what's needed for playback
        const sandbox = 'allow-scripts allow-same-origin allow-presentation allow-popups allow-forms';

        // Check if vertical video platform
        const isVertical = videoData.platform === 'TikTok' || videoData.platform === 'Instagram';

        // Security: Create iframe element properly instead of innerHTML
        const iframe = document.createElement('iframe');
        iframe.src = videoData.embedUrl;
        iframe.setAttribute('sandbox', sandbox);
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('loading', 'lazy');
        iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');

        // Clear and append
        this.videoEmbed.innerHTML = '';
        this.videoEmbed.appendChild(iframe);

        // Apply appropriate styling based on video orientation
        if (isVertical) {
            this.videoEmbed.classList.add('vertical');
            this.videoEmbed.style.paddingBottom = '';
        } else {
            this.videoEmbed.classList.remove('vertical');
            this.videoEmbed.style.paddingBottom = videoData.platform === 'Twitter/X' ? '75%' : '56.25%';
        }

        // Scroll to video
        this.videoContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    closeVideo() {
        this.videoContainer.classList.add('hidden');
        this.videoEmbed.innerHTML = '';
    }

    // History management
    loadHistory() {
        try {
            const saved = localStorage.getItem('focusVideoHistory');
            if (!saved) return [];

            const parsed = JSON.parse(saved);

            // Security: Validate that it's an array and filter valid items
            if (!Array.isArray(parsed)) return [];

            return parsed.filter(item => this.isValidVideoData(item));
        } catch {
            // If localStorage is corrupted, start fresh
            localStorage.removeItem('focusVideoHistory');
            return [];
        }
    }

    saveHistory() {
        localStorage.setItem('focusVideoHistory', JSON.stringify(this.history));
    }

    addToHistory(videoData) {
        // Remove if already exists (prevents duplicates)
        this.history = this.history.filter(item => item.id !== videoData.id);

        // Add to beginning
        this.history.unshift({
            ...videoData,
            timestamp: Date.now()
        });

        // Keep up to 1000 items (localStorage limit protection)
        this.history = this.history.slice(0, 1000);

        this.saveHistory();
        this.renderFeed();
    }

    removeFromHistory(id) {
        this.history = this.history.filter(item => item.id !== id);
        this.saveHistory();
        this.renderFeed();
    }

    clearHistory() {
        this.history = [];
        this.saveHistory();
        this.renderFeed();
    }

    renderFeed() {
        this.videoFeed.innerHTML = '';

        if (this.history.length === 0) {
            this.categoryFilter.innerHTML = '<button class="filter-btn active" data-category="all">All</button>';
            this.videoFeed.innerHTML = '<p class="empty-history">No videos in your feed</p>';
            return;
        }

        // Group videos by category
        const categories = {};
        this.history.forEach(item => {
            if (!this.isValidVideoData(item)) return;
            const category = item.category || 'Other';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(item);
        });

        // Sort categories (put Other last)
        const sortedCategories = Object.keys(categories).sort((a, b) => {
            if (a === 'Other') return 1;
            if (b === 'Other') return -1;
            return a.localeCompare(b);
        });

        // Build category filter buttons
        this.categoryFilter.innerHTML = '';

        // All button
        const allBtn = document.createElement('button');
        allBtn.className = `filter-btn ${this.selectedCategory === 'all' ? 'active' : ''}`;
        allBtn.dataset.category = 'all';
        allBtn.textContent = 'All';
        allBtn.addEventListener('click', () => this.filterByCategory('all'));
        this.categoryFilter.appendChild(allBtn);

        // Category buttons
        sortedCategories.forEach(category => {
            const btn = document.createElement('button');
            btn.className = `filter-btn ${this.selectedCategory === category ? 'active' : ''}`;
            btn.dataset.category = category;
            const icon = FocusVideo.CATEGORY_ICONS[category] || '📹';
            btn.textContent = `${icon} ${category}`;
            btn.addEventListener('click', () => this.filterByCategory(category));
            this.categoryFilter.appendChild(btn);
        });

        // Filter categories based on selection
        const categoriesToRender = this.selectedCategory === 'all'
            ? sortedCategories
            : sortedCategories.filter(c => c === this.selectedCategory);

        // Sandbox settings - YouTube needs allow-popups and allow-forms to work properly
        const sandbox = 'allow-scripts allow-same-origin allow-presentation allow-popups allow-forms';

        // Render each category section
        categoriesToRender.forEach(category => {
            const categorySection = document.createElement('div');
            categorySection.className = 'category-section';

            // Category header
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'category-header';

            const categoryIcon = FocusVideo.CATEGORY_ICONS[category] || '📹';
            categoryHeader.innerHTML = `<span class="category-icon">${categoryIcon}</span> ${this.escapeHtml(category)}`;

            categorySection.appendChild(categoryHeader);

            // Videos in this category
            categories[category].forEach(item => {
                const feedItem = document.createElement('div');
                feedItem.className = 'feed-item';
                feedItem.dataset.id = item.id;

                // Header with platform avatar and delete button
                const header = document.createElement('div');
                header.className = 'feed-item-header';

                const platform = document.createElement('span');
                platform.className = 'feed-item-platform';
                platform.textContent = item.platform;

                // Header actions (category selector + share + delete)
                const headerActions = document.createElement('div');
                headerActions.className = 'feed-item-actions';

                // Category selector
                const categorySelect = document.createElement('select');
                categorySelect.className = 'category-select';
                categorySelect.setAttribute('aria-label', 'Change category');

                // Add all category options
                const allCategories = ['Music', 'Gaming', 'Tech', 'Comedy', 'Sports', 'Education', 'Entertainment', 'News', 'Food', 'Travel', 'Image', 'Other'];
                allCategories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    const icon = FocusVideo.CATEGORY_ICONS[cat] || '📹';
                    option.textContent = `${icon} ${cat}`;
                    if (cat === (item.category || 'Other')) {
                        option.selected = true;
                    }
                    categorySelect.appendChild(option);
                });

                categorySelect.addEventListener('change', (e) => {
                    this.updateItemCategory(item.id, e.target.value);
                });

                // Share/Copy button
                const shareBtn = document.createElement('button');
                shareBtn.className = 'feed-item-share';
                shareBtn.innerHTML = '🔗';
                shareBtn.setAttribute('aria-label', 'Copy link');
                shareBtn.addEventListener('click', () => {
                    this.copyToClipboard(item.url);
                });

                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'feed-item-delete';
                deleteBtn.textContent = '×';
                deleteBtn.setAttribute('aria-label', 'Remove from feed');
                deleteBtn.addEventListener('click', () => {
                    this.removeFromHistory(item.id);
                    this.renderFeed();
                });

                headerActions.appendChild(categorySelect);
                headerActions.appendChild(shareBtn);
                headerActions.appendChild(deleteBtn);

                header.appendChild(platform);
                header.appendChild(headerActions);

                // Embed container (video or image)
                const embedContainer = document.createElement('div');
                embedContainer.className = 'feed-item-embed';

                if (item.type === 'image') {
                    // Display image
                    embedContainer.classList.add('image');
                    const img = document.createElement('img');
                    img.src = item.embedUrl;
                    img.alt = item.caption || 'Image';
                    img.loading = 'lazy';
                    img.addEventListener('click', () => {
                        window.open(item.url, '_blank');
                    });
                    embedContainer.appendChild(img);
                } else {
                    // Display video iframe
                    const isVertical = item.platform === 'TikTok' || item.platform === 'Instagram';
                    if (isVertical) {
                        embedContainer.classList.add('vertical');
                    }

                    const iframe = document.createElement('iframe');
                    // Force disable autoplay for YouTube
                    let embedUrl = item.embedUrl;
                    if (item.platform === 'YouTube') {
                        embedUrl = embedUrl.replace(/[?&]autoplay=1/gi, '');
                        embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'autoplay=0';
                    }
                    iframe.src = embedUrl;
                    iframe.setAttribute('sandbox', sandbox);
                    iframe.setAttribute('allow', 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
                    iframe.setAttribute('allowfullscreen', '');
                    iframe.setAttribute('loading', 'lazy');
                    iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');

                    embedContainer.appendChild(iframe);
                }

                // Caption section below video (Instagram-style)
                const captionSection = document.createElement('div');
                captionSection.className = 'feed-item-caption';

                // Platform name as bold "username"
                const captionPlatform = document.createElement('span');
                captionPlatform.className = 'caption-platform';
                captionPlatform.textContent = item.platform;

                // Video title/caption text
                if (item.caption) {
                    const captionText = document.createElement('span');
                    captionText.className = 'caption-text';
                    captionText.textContent = item.caption;
                    captionSection.appendChild(captionPlatform);
                    captionSection.appendChild(document.createTextNode(' '));
                    captionSection.appendChild(captionText);
                } else {
                    captionSection.appendChild(captionPlatform);
                }

                // Timestamp
                const captionTime = document.createElement('div');
                captionTime.className = 'caption-time';
                captionTime.textContent = this.formatDate(item.timestamp);

                captionSection.appendChild(captionTime);

                feedItem.appendChild(header);
                feedItem.appendChild(embedContainer);
                feedItem.appendChild(captionSection);
                categorySection.appendChild(feedItem);
            });

            this.videoFeed.appendChild(categorySection);
        });
    }

    filterByCategory(category) {
        this.selectedCategory = category;
        this.renderFeed();
        // Scroll to top of feed
        this.feedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    updateItemCategory(id, newCategory) {
        const item = this.history.find(item => item.id === id);
        if (item) {
            item.category = newCategory;
            this.saveHistory();
            this.renderFeed();
        }
    }

    copyToClipboard(url) {
        navigator.clipboard.writeText(url).then(() => {
            this.showToast('Link copied!');
        }).catch(() => {
            this.showError('Failed to copy link');
        });
    }

    showToast(message) {
        this.errorToast.textContent = message;
        this.errorToast.classList.remove('hidden');
        this.errorToast.classList.add('success');

        setTimeout(() => {
            this.errorToast.classList.add('hidden');
            this.errorToast.classList.remove('success');
        }, 2000);
    }

    getPlatformIcon(platform) {
        const icons = {
            'YouTube': 'YT',
            'Vimeo': 'VM',
            'TikTok': 'TT',
            'Twitter/X': 'X',
            'Instagram': 'IG',
            'Facebook': 'FB'
        };
        return icons[platform] || '?';
    }

    truncateUrl(url) {
        if (url.length > 50) {
            return url.substring(0, 47) + '...';
        }
        return url;
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;

        return date.toLocaleDateString();
    }

    // Theme management
    loadTheme() {
        const savedTheme = localStorage.getItem('focusVideoTheme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('focusVideoTheme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        this.themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
    }

    // Error handling
    showError(message) {
        this.errorToast.textContent = message;
        this.errorToast.classList.remove('hidden');

        setTimeout(() => {
            this.errorToast.classList.add('hidden');
        }, 3000);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new FocusVideo();
});
