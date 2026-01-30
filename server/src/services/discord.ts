import { config } from '../config.js';

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  thumbnail?: { url: string };
  footer?: { text: string };
  timestamp?: string;
}

interface WebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

export async function sendWebhook(webhookUrl: string, payload: WebhookPayload): Promise<boolean> {
  if (!webhookUrl) return false;
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      console.error('Discord webhook failed:', response.status, await response.text());
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Discord webhook error:', error);
    return false;
  }
}

// =====================
// Notification Helpers
// =====================

const EMBED_COLOR = 0xd97706; // amber-600

export async function notifyGameAdded(
  webhookUrl: string,
  libraryName: string,
  gameTitle: string,
  gameUrl: string,
  imageUrl?: string
): Promise<boolean> {
  return sendWebhook(webhookUrl, {
    embeds: [{
      title: '🎲 New Game Added!',
      description: `**${gameTitle}** has been added to ${libraryName}`,
      color: EMBED_COLOR,
      thumbnail: imageUrl ? { url: imageUrl } : undefined,
      fields: [
        { name: 'View Game', value: `[Click here](${gameUrl})`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    }],
  });
}

export async function notifyWishlistVote(
  webhookUrl: string,
  libraryName: string,
  gameTitle: string,
  voterName: string | null,
  voteCount: number
): Promise<boolean> {
  const voter = voterName || 'Someone';
  
  return sendWebhook(webhookUrl, {
    embeds: [{
      title: '⭐ Wishlist Vote!',
      description: `${voter} wants **${gameTitle}** in the collection!`,
      color: EMBED_COLOR,
      fields: [
        { name: 'Total Votes', value: voteCount.toString(), inline: true },
      ],
      timestamp: new Date().toISOString(),
    }],
  });
}

export async function notifyPollCreated(
  webhookUrl: string,
  libraryName: string,
  pollTitle: string,
  pollUrl: string,
  eventDate?: string
): Promise<boolean> {
  const fields = [
    { name: 'Vote Now', value: `[Click here](${pollUrl})`, inline: true },
  ];
  
  if (eventDate) {
    fields.push({ name: 'Event Date', value: eventDate, inline: true });
  }
  
  return sendWebhook(webhookUrl, {
    embeds: [{
      title: '📊 New Poll Created!',
      description: `**${pollTitle}**`,
      color: EMBED_COLOR,
      fields,
      timestamp: new Date().toISOString(),
    }],
  });
}

export async function notifyPollClosed(
  webhookUrl: string,
  libraryName: string,
  pollTitle: string,
  winnerTitle: string,
  voteCount: number
): Promise<boolean> {
  return sendWebhook(webhookUrl, {
    embeds: [{
      title: '🏆 Poll Results!',
      description: `The votes are in for **${pollTitle}**!`,
      color: EMBED_COLOR,
      fields: [
        { name: 'Winner', value: winnerTitle, inline: true },
        { name: 'Votes', value: voteCount.toString(), inline: true },
      ],
      timestamp: new Date().toISOString(),
    }],
  });
}

// =====================
// Bot API (for DMs)
// =====================

const DISCORD_API = 'https://discord.com/api/v10';

export async function sendDirectMessage(
  discordUserId: string,
  content: string
): Promise<boolean> {
  if (!config.discordBotToken || !discordUserId) return false;
  
  try {
    // Create DM channel
    const channelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${config.discordBotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient_id: discordUserId }),
    });
    
    if (!channelRes.ok) {
      console.error('Failed to create DM channel:', await channelRes.text());
      return false;
    }
    
    const channel = await channelRes.json() as { id: string };
    
    // Send message
    const messageRes = await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${config.discordBotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });
    
    return messageRes.ok;
  } catch (error) {
    console.error('Discord DM error:', error);
    return false;
  }
}

export async function createScheduledEvent(
  guildId: string,
  name: string,
  description: string,
  startTime: string,
  location?: string
): Promise<string | null> {
  if (!config.discordBotToken || !guildId) return null;
  
  try {
    const response = await fetch(`${DISCORD_API}/guilds/${guildId}/scheduled-events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${config.discordBotToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        scheduled_start_time: startTime,
        entity_type: 3, // External
        entity_metadata: { location: location || 'TBD' },
        privacy_level: 2, // Guild only
      }),
    });
    
    if (!response.ok) {
      console.error('Failed to create Discord event:', await response.text());
      return null;
    }
    
    const event = await response.json() as { id: string };
    return event.id;
  } catch (error) {
    console.error('Discord event creation error:', error);
    return null;
  }
}
