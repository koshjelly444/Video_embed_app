// Focus Video - Distraction-Free Video Viewing App

class FocusVideo {
    constructor() {
        this.videoForm = document.getElementById('video-form');
        this.videoUrlInput = document.getElementById('video-url');
        this.videoContainer = document.getElementById('video-container');
        this.videoEmbed = document.getElementById('video-embed');
        this.videoPlatform = document.getElementById('video-platform');
        this.closeVideoBtn = document.getElementById('close-video');
        this.historyList = document.getElementById('history-list');
        this.clearHistoryBtn = document.getElementById('clear-history');
        this.themeToggle = document.getElementById('theme-toggle');
        this.errorToast = document.getElementById('error-toast');

        this.history = this.loadHistory();

        this.init();
    }

    init() {
        // Event listeners
        this.videoForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.closeVideoBtn.addEventListener('click', () => this.closeVideo());
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        this.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Load saved theme
        this.loadTheme();

        // Render history
        this.renderHistory();
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

        this.embedVideo(videoData);
        this.addToHistory(videoData);
        this.videoUrlInput.value = '';
    }

    parseVideoUrl(url) {
        // YouTube
        const youtubeRegex = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
        const youtubeMatch = url.match(youtubeRegex);
        if (youtubeMatch) {
            return {
                platform: 'YouTube',
                id: youtubeMatch[1],
                url: url,
                embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?autoplay=1&rel=0`
            };
        }

        // Vimeo
        const vimeoRegex = /vimeo\.com\/(?:video\/)?(\d+)/;
        const vimeoMatch = url.match(vimeoRegex);
        if (vimeoMatch) {
            return {
                platform: 'Vimeo',
                id: vimeoMatch[1],
                url: url,
                embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`
            };
        }

        // TikTok
        const tiktokRegex = /tiktok\.com\/@[\w.-]+\/video\/(\d+)/;
        const tiktokMatch = url.match(tiktokRegex);
        if (tiktokMatch) {
            return {
                platform: 'TikTok',
                id: tiktokMatch[1],
                url: url,
                embedUrl: `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}`
            };
        }

        // Twitter/X - use iframe embed
        const twitterRegex = /(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/;
        const twitterMatch = url.match(twitterRegex);
        if (twitterMatch) {
            const theme = document.documentElement.getAttribute('data-theme') || 'light';
            return {
                platform: 'Twitter/X',
                id: twitterMatch[2],
                url: url,
                embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${twitterMatch[2]}&theme=${theme}`
            };
        }

        // Instagram Reels/Posts - use iframe embed
        const instagramRegex = /instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/;
        const instagramMatch = url.match(instagramRegex);
        if (instagramMatch) {
            return {
                platform: 'Instagram',
                id: instagramMatch[1],
                url: url,
                embedUrl: `https://www.instagram.com/p/${instagramMatch[1]}/embed/`
            };
        }

        // Facebook Videos
        const facebookRegex = /facebook\.com\/(?:watch\/?\?v=|[\w.-]+\/videos\/)(\d+)/;
        const facebookMatch = url.match(facebookRegex);
        if (facebookMatch) {
            return {
                platform: 'Facebook',
                id: facebookMatch[1],
                url: url,
                embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`
            };
        }

        return null;
    }

    embedVideo(videoData) {
        this.videoPlatform.textContent = videoData.platform;
        this.videoContainer.classList.remove('hidden');

        // Sandbox prevents navigation away from app - only allow what's needed for playback
        const sandbox = 'allow-scripts allow-same-origin allow-presentation';

        // Check if vertical video platform
        const isVertical = videoData.platform === 'TikTok' || videoData.platform === 'Instagram';

        // All platforms use iframe embed - keeps video in-app
        this.videoEmbed.innerHTML = `
            <iframe
                src="${videoData.embedUrl}"
                sandbox="${sandbox}"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade">
            </iframe>
        `;

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
        const saved = localStorage.getItem('focusVideoHistory');
        return saved ? JSON.parse(saved) : [];
    }

    saveHistory() {
        localStorage.setItem('focusVideoHistory', JSON.stringify(this.history));
    }

    addToHistory(videoData) {
        // Remove if already exists
        this.history = this.history.filter(item => item.id !== videoData.id);

        // Add to beginning
        this.history.unshift({
            ...videoData,
            timestamp: Date.now()
        });

        // Keep only last 20 items
        this.history = this.history.slice(0, 20);

        this.saveHistory();
        this.renderHistory();
    }

    removeFromHistory(id) {
        this.history = this.history.filter(item => item.id !== id);
        this.saveHistory();
        this.renderHistory();
    }

    clearHistory() {
        this.history = [];
        this.saveHistory();
        this.renderHistory();
    }

    renderHistory() {
        if (this.history.length === 0) {
            this.historyList.innerHTML = '<p class="empty-history">No videos watched yet</p>';
            return;
        }

        this.historyList.innerHTML = this.history.map(item => `
            <div class="history-item" data-id="${item.id}">
                <div class="platform-icon">${this.getPlatformIcon(item.platform)}</div>
                <div class="video-info">
                    <div class="video-url" title="${item.url}">${this.truncateUrl(item.url)}</div>
                    <div class="video-date">${this.formatDate(item.timestamp)}</div>
                </div>
                <button class="delete-btn" aria-label="Delete from history">×</button>
            </div>
        `).join('');

        // Add click handlers
        this.historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-btn')) {
                    e.stopPropagation();
                    this.removeFromHistory(item.dataset.id);
                } else {
                    const historyItem = this.history.find(h => h.id === item.dataset.id);
                    if (historyItem) {
                        this.embedVideo(historyItem);
                    }
                }
            });
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
