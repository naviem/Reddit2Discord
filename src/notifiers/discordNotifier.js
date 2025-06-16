const { WebhookClient, EmbedBuilder } = require('discord.js');
const { DataUsage } = require('../dataUsage');

class DiscordNotifier {
    constructor(webhookUrl) {
        this.webhook = new WebhookClient({ url: webhookUrl });
        this.dataUsage = new DataUsage();
    }

    async sendPost(post) {
        const embed = new EmbedBuilder()
            .setTitle(`New Post in r/${post.subreddit.display_name}`)
            .setColor(0x00ff00)
            .addFields([
                {
                    name: 'Title',
                    value: `[${post.title}](${post.url})`,
                    inline: false
                },
                {
                    name: 'Author',
                    value: `u/${post.author.name}`,
                    inline: true
                },
                {
                    name: 'Posted',
                    value: `<t:${Math.floor(post.created_utc)}:R>`,
                    inline: true
                }
            ])
            .setFooter({ text: `r/${post.subreddit.display_name}` })
            .setTimestamp(post.created_utc * 1000);

        // Truncate description if too long
        const maxDesc = 4096;
        function truncateDesc(desc) {
            if (!desc) return 'No content';
            if (desc.length > maxDesc) {
                return desc.slice(0, maxDesc - 15) + '\n\n...(truncated)';
            }
            return desc;
        }

        // Handle different post types
        if (post.is_self) {
            // Text post
            embed.setDescription(truncateDesc(post.selftext));
        } else if (post.post_hint === 'image') {
            // Image post
            embed.setImage(post.url);
            embed.setDescription('Image Post');
        } else if (post.post_hint === 'video') {
            // Video post
            embed.setDescription(truncateDesc(`Video Post: ${post.url}`));
            if (post.thumbnail && post.thumbnail !== 'default') {
                embed.setThumbnail(post.thumbnail);
            }
        } else {
            // Link post
            embed.setDescription(truncateDesc(`Link Post: ${post.url}`));
        }

        try {
            // Estimate payload size
            const payload = { embeds: [embed.toJSON()] };
            const payloadSize = Buffer.byteLength(JSON.stringify(payload));
            // Discord webhook responses are small, estimate 1KB
            const responseSize = 1024;
            await this.dataUsage.addUsage(payloadSize + responseSize);
            await this.webhook.send(payload);
        } catch (error) {
            console.error('Error sending Discord notification:', error);
            throw error;
        }
    }
}

module.exports = DiscordNotifier; 