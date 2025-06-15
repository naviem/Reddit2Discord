const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
require('dotenv').config();
const { DataUsage, formatBytes } = require('./dataUsage');

class ConfigManager {
    constructor() {
        this.configPath = path.join(__dirname, '../config/config.json');
        this.config = null;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        // Debug: Log environment variables
        console.log('Environment Variables:');
        console.log('REDDIT_CLIENT_ID:', process.env.REDDIT_CLIENT_ID);
        console.log('REDDIT_CLIENT_SECRET:', process.env.REDDIT_CLIENT_SECRET);
        console.log('REDDIT_USER_AGENT:', process.env.REDDIT_USER_AGENT);
    }

    async loadConfig() {
        try {
            const data = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(data);
            
            // Debug: Log before updating from env
            console.log('\nBefore updating from env:');
            console.log('Config settings:', this.config.settings);
            
            // Update settings from .env if they exist
            if (process.env.REDDIT_CLIENT_ID) {
                this.config.settings.redditClientId = process.env.REDDIT_CLIENT_ID;
            }
            if (process.env.REDDIT_CLIENT_SECRET) {
                this.config.settings.redditClientSecret = process.env.REDDIT_CLIENT_SECRET;
            }
            if (process.env.REDDIT_USER_AGENT) {
                this.config.settings.redditUserAgent = process.env.REDDIT_USER_AGENT;
            }
            
            // Debug: Log after updating from env
            console.log('\nAfter updating from env:');
            console.log('Config settings:', this.config.settings);
            
            return this.config;
        } catch (error) {
            // If config doesn't exist, create default
            if (error.code === 'ENOENT') {
                console.log('\nCreating new config with env vars:');
                this.config = {
                    subreddits: [],
                    settings: {
                        notificationDelay: 2000,
                        redditClientId: process.env.REDDIT_CLIENT_ID || '',
                        redditClientSecret: process.env.REDDIT_CLIENT_SECRET || '',
                        redditUserAgent: process.env.REDDIT_USER_AGENT || ''
                    }
                };
                console.log('New config settings:', this.config.settings);
                await this.saveConfig();
                return this.config;
            }
            throw error;
        }
    }

    async saveConfig() {
        await fs.mkdir(path.dirname(this.configPath), { recursive: true });
        await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    }

    async addSubreddit(name, interval, webhookUrl) {
        if (!this.config) await this.loadConfig();
        
        const subreddit = {
            name,
            interval,
            lastChecked: new Date().toISOString(),
            enabled: true,
            webhookUrl
        };

        this.config.subreddits.push(subreddit);
        await this.saveConfig();
        return subreddit;
    }

    async removeSubreddit(name) {
        if (!this.config) await this.loadConfig();
        
        this.config.subreddits = this.config.subreddits.filter(sub => sub.name !== name);
        await this.saveConfig();
    }

    async updateSubredditInterval(name, interval) {
        if (!this.config) await this.loadConfig();
        
        const subreddit = this.config.subreddits.find(sub => sub.name === name);
        if (subreddit) {
            subreddit.interval = interval;
            await this.saveConfig();
        }
        return subreddit;
    }

    async updateSubredditWebhook(name, webhookUrl) {
        if (!this.config) await this.loadConfig();
        
        const subreddit = this.config.subreddits.find(sub => sub.name === name);
        if (subreddit) {
            subreddit.webhookUrl = webhookUrl;
            await this.saveConfig();
        }
        return subreddit;
    }

    async updateLastChecked(name, timestamp) {
        if (!this.config) await this.loadConfig();
        
        const subreddit = this.config.subreddits.find(sub => sub.name === name);
        if (subreddit) {
            subreddit.lastChecked = timestamp;
            await this.saveConfig();
        }
    }

    // CLI Interface Methods
    question(query) {
        return new Promise((resolve) => this.rl.question(query, resolve));
    }

    async showMenu() {
        console.clear();
        console.log('=== Reddit2Discord Config Manager ===');
        console.log('1. View Current Configuration');
        console.log('2. Add Subreddit');
        console.log('3. Remove Subreddit');
        console.log('4. Update Subreddit Interval');
        console.log('5. Update Subreddit Webhook');
        console.log('6. Set Reddit API Credentials');
        console.log('7. Debug Environment');
        console.log('8. Data Usage');
        console.log('9. Exit');
        
        const choice = await this.question('\nEnter your choice (1-9): ');
        
        switch(choice) {
            case '1':
                await this.showConfig();
                break;
            case '2':
                await this.addSubredditCLI();
                break;
            case '3':
                await this.removeSubredditCLI();
                break;
            case '4':
                await this.updateIntervalCLI();
                break;
            case '5':
                await this.updateWebhookCLI();
                break;
            case '6':
                await this.setRedditCredentialsCLI();
                break;
            case '7':
                await this.showDebugInfo();
                break;
            case '8':
                await this.showDataUsageMenu();
                break;
            case '9':
                this.rl.close();
                return;
            default:
                console.log('Invalid choice. Press Enter to continue...');
                await this.question('');
        }
        
        await this.question('\nPress Enter to continue...');
        await this.showMenu();
    }

    async showDebugInfo() {
        console.log('\n=== Debug Information ===');
        console.log('\nEnvironment Variables:');
        console.log('REDDIT_CLIENT_ID:', process.env.REDDIT_CLIENT_ID ? 'Set' : 'Not Set');
        console.log('REDDIT_CLIENT_SECRET:', process.env.REDDIT_CLIENT_SECRET ? 'Set' : 'Not Set');
        console.log('REDDIT_USER_AGENT:', process.env.REDDIT_USER_AGENT ? 'Set' : 'Not Set');
        
        console.log('\nConfig File Location:', this.configPath);
        console.log('Config File Exists:', await this.checkConfigExists());
        
        if (this.config) {
            console.log('\nCurrent Config Settings:');
            console.log('Client ID:', this.config.settings.redditClientId ? 'Set' : 'Not Set');
            console.log('Client Secret:', this.config.settings.redditClientSecret ? 'Set' : 'Not Set');
            console.log('User Agent:', this.config.settings.redditUserAgent ? 'Set' : 'Not Set');
        }
    }

    async checkConfigExists() {
        try {
            await fs.access(this.configPath);
            return true;
        } catch {
            return false;
        }
    }

    async showConfig() {
        if (!this.config) await this.loadConfig();
        
        console.log('\n=== Current Configuration ===');
        
        console.log('\nSubreddits:');
        this.config.subreddits.forEach(sub => {
            console.log(`- ${sub.name}`);
            console.log(`  Interval: ${sub.interval} minutes`);
            console.log(`  Enabled: ${sub.enabled}`);
            console.log(`  Webhook: ${sub.webhookUrl || 'Not set'}`);
        });
        
        console.log('\nReddit API Settings:');
        console.log(`- Client ID: ${this.config.settings.redditClientId ? 'Set' : 'Not Set'}`);
        console.log(`- Client Secret: ${this.config.settings.redditClientSecret ? 'Set' : 'Not Set'}`);
        console.log(`- User Agent: ${this.config.settings.redditUserAgent ? 'Set' : 'Not Set'}`);
        console.log(`- Username: ${this.config.settings.redditUsername ? 'Set' : 'Not Set'}`);
        console.log(`- Password: ${this.config.settings.redditPassword ? 'Set' : 'Not Set'}`);
    }

    async addSubredditCLI() {
        const name = await this.question('Enter subreddit name (without r/) (or press Enter to cancel): ');
        if (!name) return;
        const interval = await this.question('Enter scan interval in minutes (decimals allowed, or press Enter to cancel): ');
        if (!interval) return;
        const webhookUrl = await this.question('Enter Discord webhook URL for this subreddit (or press Enter to cancel): ');
        if (!webhookUrl) return;
        
        await this.addSubreddit(name, parseFloat(interval), webhookUrl);
        console.log(`Added subreddit r/${name} with ${interval} minutes interval`);
    }

    async removeSubredditCLI() {
        if (!this.config) await this.loadConfig();
        if (this.config.subreddits.length === 0) {
            console.log('No subreddits configured.');
            return;
        }
        console.log('\nSelect a subreddit to remove:');
        this.config.subreddits.forEach((sub, idx) => {
            console.log(`${idx + 1}. ${sub.name}`);
        });
        const choice = await this.question('Enter the number of the subreddit (or press Enter to cancel): ');
        if (!choice) return;
        const idx = parseInt(choice) - 1;
        if (isNaN(idx) || idx < 0 || idx >= this.config.subreddits.length) {
            console.log('Invalid selection.');
            return;
        }
        const confirm = await this.question(`Are you sure you want to delete r/${this.config.subreddits[idx].name}? Type 'yes' to confirm: `);
        if (confirm.trim().toLowerCase() !== 'yes') {
            console.log('Deletion cancelled.');
            return;
        }
        await this.removeSubreddit(this.config.subreddits[idx].name);
        console.log(`Removed subreddit r/${this.config.subreddits[idx].name}`);
    }

    async updateIntervalCLI() {
        if (!this.config) await this.loadConfig();
        if (this.config.subreddits.length === 0) {
            console.log('No subreddits configured.');
            return;
        }
        console.log('\nSelect a subreddit to update interval:');
        this.config.subreddits.forEach((sub, idx) => {
            console.log(`${idx + 1}. ${sub.name}`);
        });
        const choice = await this.question('Enter the number of the subreddit (or press Enter to cancel): ');
        if (!choice) return;
        const idx = parseInt(choice) - 1;
        if (isNaN(idx) || idx < 0 || idx >= this.config.subreddits.length) {
            console.log('Invalid selection.');
            return;
        }
        const interval = await this.question('Enter new scan interval in minutes (decimals allowed, or press Enter to cancel): ');
        if (!interval) return;
        await this.updateSubredditInterval(this.config.subreddits[idx].name, parseFloat(interval));
        console.log(`Updated interval for r/${this.config.subreddits[idx].name} to ${interval} minutes`);
    }

    async updateWebhookCLI() {
        if (!this.config) await this.loadConfig();
        if (this.config.subreddits.length === 0) {
            console.log('No subreddits configured.');
            return;
        }
        console.log('\nSelect a subreddit to update webhook:');
        this.config.subreddits.forEach((sub, idx) => {
            console.log(`${idx + 1}. ${sub.name}`);
        });
        const choice = await this.question('Enter the number of the subreddit (or press Enter to cancel): ');
        if (!choice) return;
        const idx = parseInt(choice) - 1;
        if (isNaN(idx) || idx < 0 || idx >= this.config.subreddits.length) {
            console.log('Invalid selection.');
            return;
        }
        const webhookUrl = await this.question('Enter new Discord webhook URL (or press Enter to cancel): ');
        if (!webhookUrl) return;
        await this.updateSubredditWebhook(this.config.subreddits[idx].name, webhookUrl);
        console.log(`Updated webhook for r/${this.config.subreddits[idx].name}`);
    }

    async setRedditCredentialsCLI() {
        if (!this.config) await this.loadConfig();
        const current = this.config.settings;
        const clientId = await this.question(`Enter Reddit Client ID [${current.redditClientId || 'not set'}]: `);
        if (clientId === '' && !current.redditClientId) return;
        const clientSecret = await this.question(`Enter Reddit Client Secret [${current.redditClientSecret ? 'set' : 'not set'}]: `);
        if (clientSecret === '' && !current.redditClientSecret) return;
        const userAgent = await this.question(`Enter Reddit User Agent [${current.redditUserAgent || 'not set'}]: `);
        if (userAgent === '' && !current.redditUserAgent) return;
        const username = await this.question(`Enter Reddit Username [${current.redditUsername || 'not set'}]: `);
        if (username === '' && !current.redditUsername) return;
        const password = await this.question(`Enter Reddit Password [${current.redditPassword ? 'set' : 'not set'}]: `);
        if (password === '' && !current.redditPassword) return;
        
        this.config.settings.redditClientId = clientId !== '' ? clientId : current.redditClientId;
        this.config.settings.redditClientSecret = clientSecret !== '' ? clientSecret : current.redditClientSecret;
        this.config.settings.redditUserAgent = userAgent !== '' ? userAgent : current.redditUserAgent;
        this.config.settings.redditUsername = username !== '' ? username : current.redditUsername;
        this.config.settings.redditPassword = password !== '' ? password : current.redditPassword;
        
        await this.saveConfig();
        console.log('Updated Reddit API credentials');
    }

    async showDataUsageMenu() {
        const dataUsage = new DataUsage();
        const stats = await dataUsage.getStats();
        console.log('\n=== Data Usage ===');
        console.log(`Today:     ${formatBytes(stats.today)}`);
        console.log(`This week: ${formatBytes(stats.thisWeek)}`);
        console.log(`This month:${formatBytes(stats.thisMonth)}`);
        const clear = await this.question('Type "clear" to reset data usage, or press Enter to go back: ');
        if (clear.trim().toLowerCase() === 'clear') {
            await dataUsage.clear();
            console.log('Data usage stats cleared.');
        }
    }
}

module.exports = ConfigManager; 