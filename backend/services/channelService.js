import { ChannelRepository } from '../repositories/channelRepository.js';
import { getCache, setCache, invalidateCache } from '../db/redis.js';

export class ChannelService {
  static async getChannels() {
    const cacheKey = 'syncforge:channels';
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const channels = await ChannelRepository.getAll();
    await setCache(cacheKey, channels, 120); // 120s TTL
    return channels;
  }

  static async createChannel({ name, description, workspaceId }, io) {
    const id = `c-${Date.now()}`;
    const createdChannel = await ChannelRepository.create({
      id,
      name,
      description,
      workspaceId
    });

    await invalidateCache('syncforge:channels');

    if (io) {
      io.emit('channel_created', createdChannel);
    }

    return createdChannel;
  }
}
