import { WikiService } from '../services/wikiService.js';

export class WikiController {
  static async getWikiPages(req, res) {
    try {
      const wikiPages = await WikiService.getWikiPages();
      res.json(wikiPages);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async saveWikiPage(req, res) {
    const io = req.app.get('io');
    try {
      const resultWiki = await WikiService.saveWikiPage(req.body, io);
      res.json(resultWiki);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async deleteWikiPage(req, res) {
    const id = req.params.id;
    const io = req.app.get('io');
    try {
      await WikiService.deleteWikiPage(id, io);
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}
