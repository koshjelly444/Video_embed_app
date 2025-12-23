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

    constructor() {
        this.videoForm = document.getElementById('video-form');
        this.videoUrlInput = document.getElementById('video-url');
        this.videoContainer = document.getElementById('video-container');
        this.videoEmbed = document.getElementById('video-embed');
        this.videoPlatform = document.getElementById('video-platform');
        this.closeVideoBtn = document.getElementById('close-video');
        this.historyList = document.getElementById('history-list');
        this.historySection = document.getElementById('history-section');
        this.clearHistoryBtn = document.getElementById('clear-history');
        this.themeToggle = document.getElementById('theme-toggle');
        this.errorToast = document.getElementById('error-toast');

        // Feed elements
        this.feedSection = document.getElementById('feed-section');
        this.videoFeed = document.getElementById('video-feed');

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
        if (typeof data.embedUrl !== 'string' || !this.isValidEmbedUrl(data.embedUrl)) return false;
        return true;
    }

    init() {
        // Event listeners
        this.videoForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.closeVideoBtn.addEventListener('click', () => this.closeVideo());
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Load saved theme
        this.loadTheme();

        // Render feed on load
        this.renderFeed();
    }

    handleSubmit(e) {
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

        this.addToHistory(videoData);
        this.videoUrlInput.value = '';
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
            this.videoFeed.innerHTML = '<p class="empty-history">No videos in your feed</p>';
            return;
        }

        // Sandbox settings - YouTube needs allow-popups and allow-forms to work properly
        const sandbox = 'allow-scripts allow-same-origin allow-presentation allow-popups allow-forms';

        this.history.forEach(item => {
            if (!this.isValidVideoData(item)) return;

            const feedItem = document.createElement('div');
            feedItem.className = 'feed-item';
            feedItem.dataset.id = item.id;

            // Header with platform avatar and delete button
            const header = document.createElement('div');
            header.className = 'feed-item-header';

            const platform = document.createElement('span');
            platform.className = 'feed-item-platform';
            platform.textContent = item.platform;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'feed-item-delete';
            deleteBtn.textContent = '×';
            deleteBtn.setAttribute('aria-label', 'Remove from feed');
            deleteBtn.addEventListener('click', () => {
                this.removeFromHistory(item.id);
                this.renderFeed();
            });

            header.appendChild(platform);
            header.appendChild(deleteBtn);

            // Video embed container
            const embedContainer = document.createElement('div');
            embedContainer.className = 'feed-item-embed';

            const isVertical = item.platform === 'TikTok' || item.platform === 'Instagram';
            if (isVertical) {
                embedContainer.classList.add('vertical');
            }

            // Create iframe
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

            // Caption section below video (Instagram-style)
            const caption = document.createElement('div');
            caption.className = 'feed-item-caption';

            const captionPlatform = document.createElement('span');
            captionPlatform.className = 'caption-platform';
            captionPlatform.textContent = item.platform;

            const captionTime = document.createElement('span');
            captionTime.className = 'caption-time';
            captionTime.textContent = this.formatDate(item.timestamp);

            caption.appendChild(captionPlatform);
            caption.appendChild(captionTime);

            feedItem.appendChild(header);
            feedItem.appendChild(embedContainer);
            feedItem.appendChild(caption);
            this.videoFeed.appendChild(feedItem);
        });
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
