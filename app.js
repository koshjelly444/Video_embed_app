// mymind - Your Digital Mind
// Masonry feed with search, tag filtering, and muted autoplay

class MyMind {
    static ALLOWED_EMBED_DOMAINS = [
        'www.youtube.com', 'player.vimeo.com', 'www.tiktok.com',
        'platform.twitter.com', 'www.instagram.com', 'www.facebook.com'
    ];

    static IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

    static PLATFORM_PARSE_RULES = [
        {
            name: 'YouTube',
            regex: /(?:(?:m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
            embed: (id) => `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`,
            embedType: 'iframe',
            orientation: 'horizontal'
        },
        {
            name: 'Vimeo',
            regex: /(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i,
            embed: (id) => `https://player.vimeo.com/video/${id}?title=0&byline=0&portrait=0`,
            embedType: 'iframe',
            orientation: 'horizontal'
        },
        {
            name: 'TikTok',
            regex: /(?:(?:m|www)\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
            embed: (id) => `https://www.tiktok.com/embed/v2/${id}`,
            embedType: 'iframe',
            orientation: 'vertical'
        },
        {
            name: 'TikTok',
            regex: /vm\.tiktok\.com\/([a-zA-Z0-9]+)/i,
            embed: (id) => `https://www.tiktok.com/embed/v2/${id}`,
            embedType: 'iframe',
            orientation: 'vertical',
            isShortLink: true
        },
        {
            name: 'Twitter/X',
            regex: /(?:(?:mobile\.)?twitter\.com|x\.com)\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/i,
            embed: (_, id) => `https://platform.twitter.com/embed/Tweet.html?id=${id}&theme=dark&hide_thread=true`,
            embedType: 'iframe',
            idIndex: 2,
            orientation: 'horizontal'
        },
        {
            name: 'Instagram',
            regex: /(?:www\.)?instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/i,
            embed: (id) => `https://www.instagram.com/p/${id}/embed/?captioned=false`,
            embedType: 'iframe',
            orientation: 'vertical'
        },
        {
            name: 'Facebook',
            regex: /(?:(?:m|www)\.)?facebook\.com\/(?:watch\/?\?v=|[\w.-]+\/videos\/|reel\/)(\d+)/i,
            embed: (id, url) => `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`,
            embedType: 'iframe',
            orientation: 'horizontal'
        }
    ];

    constructor() {
        this.searchInput = document.getElementById('search-input');
        this.searchClear = document.getElementById('search-clear');
        this.addToggle = document.getElementById('add-toggle');
        this.addPanel = document.getElementById('add-panel');
        this.addForm = document.getElementById('add-form');
        this.addUrl = document.getElementById('add-url');
        this.tagFilter = document.getElementById('tag-filter');
        this.masonryGrid = document.getElementById('masonry-grid');
        this.itemCount = document.getElementById('item-count');
        this.toast = document.getElementById('toast');

        this.selectedTag = 'all';
        this.searchQuery = '';
        this.searchTimeout = null;

        this.allItems = this.loadData();
        this.filteredItems = [...this.allItems];
        this.allTags = this.extractTags();

        this.autoplayObserver = null;
        this.currentlyPlaying = null;

        this.init();
    }

    // Load data: merge bundled MYMIND_DATA with localStorage additions
    loadData() {
        const bundled = window.MYMIND_DATA || [];
        let local = [];
        try {
            const saved = localStorage.getItem('mymindLocal');
            if (saved) {
                local = JSON.parse(saved);
                if (!Array.isArray(local)) local = [];
            }
        } catch {
            local = [];
        }

        // Merge, deduplicate by ID (local items override bundled)
        const idMap = new Map();
        bundled.forEach(item => idMap.set(item.id, item));
        local.forEach(item => idMap.set(item.id, item));

        // Sort newest first
        return Array.from(idMap.values()).sort((a, b) => b.timestamp - a.timestamp);
    }

    saveLocalItems() {
        const localItems = this.allItems.filter(i => i.source === 'local');
        localStorage.setItem('mymindLocal', JSON.stringify(localItems));
    }

    // Extract and rank tags from all items
    extractTags() {
        const tagCounts = {};
        this.allItems.forEach(item => {
            (item.tags || []).forEach(tag => {
                const t = tag.trim();
                if (t && t.length > 1) {
                    tagCounts[t] = (tagCounts[t] || 0) + 1;
                }
            });
        });

        // Sort by count, take top 30
        return Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30)
            .map(([tag, count]) => ({ tag, count }));
    }

    init() {
        // Search
        this.searchInput.addEventListener('input', () => this.onSearch());
        this.searchClear.addEventListener('click', () => this.clearSearch());

        // Add panel
        this.addToggle.addEventListener('click', () => this.toggleAddPanel());
        this.addForm.addEventListener('submit', (e) => this.handleAdd(e));

        // Render
        this.renderTags();
        this.renderGrid();
        this.updateCount();
        this.setupAutoplay();
    }

    // --- Search ---
    onSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.searchQuery = this.searchInput.value.trim().toLowerCase();
            this.searchClear.classList.toggle('hidden', !this.searchQuery);
            this.applyFilters();
        }, 200);
    }

    clearSearch() {
        this.searchInput.value = '';
        this.searchQuery = '';
        this.searchClear.classList.add('hidden');
        this.applyFilters();
        this.searchInput.focus();
    }

    // --- Tag Filter ---
    renderTags() {
        this.tagFilter.innerHTML = '';

        // "All" button
        const allBtn = document.createElement('button');
        allBtn.className = `tag-pill ${this.selectedTag === 'all' ? 'active' : ''}`;
        allBtn.dataset.tag = 'all';
        allBtn.textContent = 'All';
        allBtn.addEventListener('click', () => this.selectTag('all'));
        this.tagFilter.appendChild(allBtn);

        // Tag pills
        this.allTags.forEach(({ tag, count }) => {
            const btn = document.createElement('button');
            btn.className = `tag-pill ${this.selectedTag === tag ? 'active' : ''}`;
            btn.dataset.tag = tag;
            btn.innerHTML = `${this.escapeHtml(tag)}<span class="tag-count">${count}</span>`;
            btn.addEventListener('click', () => this.selectTag(tag));
            this.tagFilter.appendChild(btn);
        });
    }

    selectTag(tag) {
        this.selectedTag = tag;
        this.renderTags();
        this.applyFilters();
    }

    // --- Filtering ---
    applyFilters() {
        this.filteredItems = this.allItems.filter(item => {
            // Tag filter
            if (this.selectedTag !== 'all') {
                if (!(item.tags || []).some(t => t.toLowerCase() === this.selectedTag.toLowerCase())) {
                    return false;
                }
            }

            // Search filter
            if (this.searchQuery) {
                const q = this.searchQuery;
                const searchable = [
                    item.title || '',
                    (item.tags || []).join(' '),
                    item.content || '',
                    item.note || '',
                    item.url || '',
                    item.platform || ''
                ].join(' ').toLowerCase();

                return searchable.includes(q);
            }

            return true;
        });

        this.renderGrid();
        this.updateCount();
    }

    updateCount() {
        const total = this.filteredItems.length;
        const all = this.allItems.length;
        this.itemCount.textContent = total === all ? `${all}` : `${total}/${all}`;
    }

    // --- Add New Item ---
    toggleAddPanel() {
        this.addPanel.classList.toggle('hidden');
        if (!this.addPanel.classList.contains('hidden')) {
            this.addUrl.focus();
        }
    }

    async handleAdd(e) {
        e.preventDefault();
        const url = this.addUrl.value.trim();
        if (!url) return;

        const videoData = this.parseUrl(url);
        if (!videoData) {
            this.showToast('Unsupported URL format', 'error');
            return;
        }

        // Check duplicate
        if (this.allItems.some(item => item.id === videoData.id)) {
            this.showToast('Already in your mind');
            this.addUrl.value = '';
            return;
        }

        // Fetch title
        const caption = await this.fetchCaption(url, videoData.platform);

        const newItem = {
            ...videoData,
            title: caption || '',
            tags: [],
            timestamp: Date.now(),
            source: 'local',
        };

        this.allItems.unshift(newItem);
        this.saveLocalItems();
        this.allTags = this.extractTags();
        this.applyFilters();
        this.renderTags();

        this.addUrl.value = '';
        this.addPanel.classList.add('hidden');
        this.showToast('Saved to your mind', 'success');
    }

    parseUrl(url) {
        url = url.trim();
        if (!url.match(/^https?:\/\//i)) url = 'https://' + url;

        for (const rule of MyMind.PLATFORM_PARSE_RULES) {
            const match = url.match(rule.regex);
            if (match) {
                const idIndex = rule.idIndex || 1;
                const id = match[idIndex];
                return {
                    platform: rule.name,
                    id: id,
                    url: url,
                    embedUrl: rule.embed(match[1], rule.idIndex ? match[rule.idIndex] : url),
                    embedType: rule.embedType,
                    orientation: rule.orientation,
                };
            }
        }

        // Direct image
        const urlLower = url.toLowerCase();
        if (MyMind.IMAGE_EXTENSIONS.some(ext => urlLower.includes(ext))) {
            return {
                platform: 'Image',
                id: btoa(url).slice(0, 20),
                url: url,
                mediaFile: url,
                embedType: 'image',
            };
        }

        return null;
    }

    async fetchCaption(url, platform) {
        try {
            const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
            if (!response.ok) return null;
            const data = await response.json();
            if (data.title) return data.title;
            if (data.author_name && platform === 'Twitter/X') return `@${data.author_name}`;
            return null;
        } catch {
            return null;
        }
    }

    // --- Rendering ---
    renderGrid() {
        this.masonryGrid.innerHTML = '';

        if (this.filteredItems.length === 0) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = this.searchQuery
                ? `No results for "${this.searchQuery}"`
                : 'Your mind is empty. Add something to get started.';
            this.masonryGrid.appendChild(empty);
            return;
        }

        const fragment = document.createDocumentFragment();

        this.filteredItems.forEach(item => {
            const card = this.createCard(item);
            if (card) fragment.appendChild(card);
        });

        this.masonryGrid.appendChild(fragment);
        this.setupAutoplay();
    }

    createCard(item) {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.id = item.id;

        // Actions overlay
        const actions = document.createElement('div');
        actions.className = 'card-actions';

        const shareBtn = document.createElement('button');
        shareBtn.className = 'card-action-btn';
        shareBtn.innerHTML = '&#128279;';
        shareBtn.title = 'Copy link';
        shareBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyLink(item);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'card-action-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = 'Remove';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeItem(item.id);
        });

        actions.appendChild(shareBtn);
        actions.appendChild(deleteBtn);

        // Content based on embedType
        switch (item.embedType) {
            case 'iframe':
                card.appendChild(actions);
                card.appendChild(this.createIframeEmbed(item));
                break;

            case 'image':
                card.appendChild(actions);
                card.appendChild(this.createImageEmbed(item));
                break;

            case 'video':
                card.appendChild(actions);
                card.appendChild(this.createVideoEmbed(item));
                break;

            case 'link':
                card.appendChild(this.createLinkCard(item));
                card.appendChild(actions);
                card.addEventListener('click', () => {
                    if (item.url) window.open(item.url, '_blank', 'noopener');
                });
                break;

            case 'text':
                card.appendChild(this.createTextCard(item));
                card.appendChild(actions);
                break;

            case 'document':
                card.appendChild(this.createDocumentCard(item));
                card.appendChild(actions);
                if (item.mediaFile) {
                    card.addEventListener('click', () => window.open(item.mediaFile, '_blank'));
                }
                break;

            default:
                card.appendChild(this.createTextCard(item));
                card.appendChild(actions);
        }

        // Footer (title + tags + meta)
        card.appendChild(this.createCardFooter(item));

        return card;
    }

    createIframeEmbed(item) {
        const container = document.createElement('div');
        const isVertical = item.orientation === 'vertical' ||
            item.platform === 'TikTok' || item.platform === 'Instagram';

        container.className = `card-embed ${isVertical ? 'vertical' : 'horizontal'} lazy-placeholder`;
        container.dataset.embedUrl = item.embedUrl || '';
        container.dataset.platform = item.platform || '';

        // Lazy load: iframes are created when visible via IntersectionObserver
        return container;
    }

    createImageEmbed(item) {
        const container = document.createElement('div');
        container.className = 'card-media';

        const img = document.createElement('img');
        img.src = item.mediaFile || item.url || '';
        img.alt = item.title || 'Image';
        img.loading = 'lazy';
        img.addEventListener('error', () => {
            img.style.display = 'none';
        });

        container.appendChild(img);
        return container;
    }

    createVideoEmbed(item) {
        const container = document.createElement('div');
        container.className = 'card-video';

        const video = document.createElement('video');
        video.src = item.mediaFile || '';
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.setAttribute('playsinline', '');

        container.appendChild(video);
        return container;
    }

    createLinkCard(item) {
        const container = document.createElement('div');
        container.className = 'card-link-preview';

        // Domain
        if (item.url) {
            try {
                const domain = new URL(item.url).hostname.replace('www.', '');
                const domainEl = document.createElement('div');
                domainEl.className = 'card-link-domain';
                domainEl.textContent = domain;
                container.appendChild(domainEl);
            } catch { /* skip */ }
        }

        // Title
        if (item.title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'card-link-title';
            titleEl.textContent = item.title;
            container.appendChild(titleEl);
        }

        // URL
        if (item.url) {
            const urlEl = document.createElement('div');
            urlEl.className = 'card-link-url';
            urlEl.textContent = item.url;
            container.appendChild(urlEl);
        }

        return container;
    }

    createTextCard(item) {
        const container = document.createElement('div');
        container.className = 'card-text-content';

        const text = item.content || item.note || item.title || '';
        if (text) {
            const body = document.createElement('div');
            body.className = 'card-text-body';
            body.textContent = text;
            container.appendChild(body);
        }

        return container;
    }

    createDocumentCard(item) {
        const container = document.createElement('div');
        container.className = 'card-document';

        // PDF icon
        const iconWrap = document.createElement('div');
        iconWrap.className = 'card-doc-icon';
        iconWrap.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';

        const titleEl = document.createElement('div');
        titleEl.className = 'card-doc-title';
        titleEl.textContent = item.title || 'Document';

        container.appendChild(iconWrap);
        container.appendChild(titleEl);
        return container;
    }

    createCardFooter(item) {
        const footer = document.createElement('div');
        footer.className = 'card-footer';

        // Title (if not already shown in card body)
        if (item.title && item.embedType !== 'text' && item.embedType !== 'link' && item.embedType !== 'document') {
            const title = document.createElement('div');
            title.className = 'card-title';
            title.textContent = item.title;
            footer.appendChild(title);
        }

        // Tags (show up to 3)
        if (item.tags && item.tags.length > 0) {
            const tagsWrap = document.createElement('div');
            tagsWrap.className = 'card-tags';

            const maxTags = 3;
            item.tags.slice(0, maxTags).forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'card-tag';
                tagEl.textContent = tag;
                tagEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.selectTag(tag);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
                tagsWrap.appendChild(tagEl);
            });

            if (item.tags.length > maxTags) {
                const more = document.createElement('span');
                more.className = 'card-tag-more';
                more.textContent = `+${item.tags.length - maxTags}`;
                tagsWrap.appendChild(more);
            }

            footer.appendChild(tagsWrap);
        }

        // Meta row
        const meta = document.createElement('div');
        meta.className = 'card-meta';

        const platform = document.createElement('span');
        platform.className = 'card-platform';
        platform.textContent = item.platform || '';

        const time = document.createElement('span');
        time.className = 'card-time';
        time.textContent = this.formatDate(item.timestamp);

        meta.appendChild(platform);
        meta.appendChild(time);
        footer.appendChild(meta);

        return footer;
    }

    // --- Autoplay & Lazy Loading ---
    setupAutoplay() {
        // Disconnect previous observer
        if (this.autoplayObserver) {
            this.autoplayObserver.disconnect();
        }

        this.autoplayObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const el = entry.target;

                if (entry.isIntersecting) {
                    // Lazy load iframes
                    if (el.classList.contains('lazy-placeholder') && el.dataset.embedUrl) {
                        this.loadIframe(el);
                    }

                    // Autoplay videos
                    const video = el.querySelector('video');
                    if (video) {
                        video.play().catch(() => {});
                    }
                } else {
                    // Pause videos when out of view
                    const video = el.querySelector('video');
                    if (video) {
                        video.pause();
                    }
                }
            });
        }, {
            threshold: 0.3,
            rootMargin: '200px 0px'
        });

        // Observe all embeds and videos
        this.masonryGrid.querySelectorAll('.card-embed, .card-video').forEach(el => {
            this.autoplayObserver.observe(el);
        });
    }

    loadIframe(container) {
        container.classList.remove('lazy-placeholder');

        const iframe = document.createElement('iframe');
        let embedUrl = container.dataset.embedUrl;

        // YouTube: add mute for autoplay
        if (container.dataset.platform === 'YouTube') {
            embedUrl += (embedUrl.includes('?') ? '&' : '?') + 'mute=1&autoplay=1';
        }

        iframe.src = embedUrl;
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups allow-forms');
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('loading', 'lazy');
        iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');

        container.appendChild(iframe);
    }

    // --- Actions ---
    copyLink(item) {
        const url = item.url || item.mediaFile || '';
        if (!url) {
            this.showToast('No link to copy');
            return;
        }
        navigator.clipboard.writeText(url).then(() => {
            this.showToast('Link copied', 'success');
        }).catch(() => {
            this.showToast('Failed to copy');
        });
    }

    removeItem(id) {
        this.allItems = this.allItems.filter(item => item.id !== id);
        this.saveLocalItems();
        this.allTags = this.extractTags();
        this.applyFilters();
        this.renderTags();
    }

    // --- Utilities ---
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        if (diff < 2592000000) return `${Math.floor(diff / 604800000)}w ago`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    }

    showToast(message, type) {
        this.toast.textContent = message;
        this.toast.className = 'toast';
        if (type) this.toast.classList.add(type);
        this.toast.classList.remove('hidden');

        setTimeout(() => {
            this.toast.classList.add('hidden');
        }, 2500);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new MyMind();
});
