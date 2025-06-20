const Snoowrap = require('snoowrap');
const DiscordNotifier = require('./notifiers/discordNotifier');
const { DataUsage } = require('./dataUsage');

// Move this outside the class
const getTimeString = () => new Date().toLocaleTimeString();

class Scanner {
    constructor(configManager) {
        this.configManager = configManager;
        this.config = configManager.config;
        this.reddit = new Snoowrap({
            userAgent: this.config.settings.redditUserAgent,
            clientId: this.config.settings.redditClientId,
            clientSecret: this.config.settings.redditClientSecret,
            username: this.config.settings.redditUsername,
            password: this.config.settings.redditPassword
        });
        this.notifiers = new Map();
        this.scanIntervals = new Map();
        this.dataUsage = new DataUsage();
    }

    initializeNotifiers() {
        this.notifiers.clear();
        for (const subreddit of this.config.subreddits) {
            if (subreddit.enabled && subreddit.webhookUrl) {
                this.notifiers.set(subreddit.name, new DiscordNotifier(subreddit.webhookUrl));
            }
        }
    }

    async initialScan() {
        for (const subreddit of this.config.subreddits) {
            if (!subreddit.enabled || !subreddit.webhookUrl) continue;
            console.log(`[${getTimeString()}] Scanning r/${subreddit.name} (initial scan)`);
            try {
                // Get 2 newest posts
                const posts = await this.reddit.getSubreddit(subreddit.name)
                    .getNew({ limit: 2 });
                // Track Reddit API response size
                const postsSize = Buffer.byteLength(JSON.stringify(posts));
                await this.dataUsage.addUsage(postsSize);
                if (posts.length === 0) {
                    console.log(`[${getTimeString()}] No new posts found in r/${subreddit.name}`);
                }
                // Send notifications with delay
                const notifier = this.notifiers.get(subreddit.name);
                if (notifier) {
                    for (const post of posts) {
                        try {
                            console.log(`[${getTimeString()}] Sending notification for post "${post.title}" to webhook: ${subreddit.webhookUrl}`);
                            await notifier.sendPost(post);
                            await new Promise(resolve => setTimeout(resolve, this.config.settings.notificationDelay));
                        } catch (e) {
                            console.error(`[${getTimeString()}] Failed to send post "${post.title}". Error: ${e.message}`);
                        }
                    }
                }
                // Update last checked timestamp
                if (posts.length > 0) {
                    await this.configManager.updateLastChecked(subreddit.name, new Date().toISOString());
                }
            } catch (error) {
                console.error(`[${getTimeString()}] Error in initial scan for r/${subreddit.name}:`, error);
            }
        }
    }

    async startScanning() {
        this.initializeNotifiers();
        await this.initialScan();
        // Start interval-based scanning for each subreddit
        for (const subreddit of this.config.subreddits) {
            if (!subreddit.enabled || !subreddit.webhookUrl) continue;
            const interval = setInterval(async () => {
                console.log(`[${getTimeString()}] Scanning r/${subreddit.name}`);
                try {
                    const lastChecked = new Date(subreddit.lastChecked);
                    const posts = await this.reddit.getSubreddit(subreddit.name)
                        .getNew({ limit: 25 }); // Get more posts to ensure we don't miss any
                    // Track Reddit API response size
                    const postsSize = Buffer.byteLength(JSON.stringify(posts));
                    await this.dataUsage.addUsage(postsSize);
                    // Filter posts newer than last checked
                    const newPosts = posts.filter(post => 
                        new Date(post.created_utc * 1000) > lastChecked
                    );
                    if (newPosts.length === 0) {
                        console.log(`[${getTimeString()}] No new posts found in r/${subreddit.name}`);
                    }
                    // Send notifications for new posts
                    const notifier = this.notifiers.get(subreddit.name);
                    if (notifier) {
                        for (const post of newPosts) {
                            try {
                                console.log(`[${getTimeString()}] Sending notification for post "${post.title}" to webhook: ${subreddit.webhookUrl}`);
                                await notifier.sendPost(post);
                                await new Promise(resolve => setTimeout(resolve, this.config.settings.notificationDelay));
                            } catch (e) {
                                console.error(`[${getTimeString()}] Failed to send post "${post.title}". Error: ${e.message}`);
                            }
                        }
                    }
                    // Update last checked timestamp
                    if (newPosts.length > 0) {
                        await this.configManager.updateLastChecked(subreddit.name, new Date().toISOString());
                    }
                } catch (error) {
                    console.error(`[${getTimeString()}] Error scanning r/${subreddit.name}:`, error);
                }
            }, subreddit.interval * 60 * 1000); // Convert minutes to milliseconds
            this.scanIntervals.set(subreddit.name, interval);
        }
    }

    stopScanning() {
        for (const [subreddit, interval] of this.scanIntervals) {
            clearInterval(interval);
        }
        this.scanIntervals.clear();
    }
}

module.exports = Scanner; 