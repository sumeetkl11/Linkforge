import { WikiRepository } from '../repositories/wikiRepository.js';
import { getCache, setCache, invalidateCache } from '../db/redis.js';

export class WikiService {
  static async getWikiPages() {
    const cacheKey = 'syncforge:wiki';
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const wikiPages = await WikiRepository.getAll();
    await setCache(cacheKey, wikiPages, 120); // 120s TTL
    return wikiPages;
  }

  static async saveWikiPage(wiki, io) {
    const page = { ...wiki };
    if (!page.id) {
      page.id = `wiki-${Date.now()}`;
    }

    await WikiRepository.upsert(page);
    await invalidateCache('syncforge:wiki');

    const resultWiki = await WikiRepository.getById(page.id);

    if (io) {
      io.emit('wiki:updated', resultWiki);
    }

    return resultWiki;
  }

  static async deleteWikiPage(id, io) {
    await WikiRepository.delete(id);
    await invalidateCache('syncforge:wiki');

    if (io) {
      io.emit('wiki:deleted', id);
    }
  }
}
