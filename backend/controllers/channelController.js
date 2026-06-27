import { ChannelService } from '../services/channelService.js';

export class ChannelController {
  static async getChannels(req, res) {
    try {
      const channels = await ChannelService.getChannels();
      res.json(channels);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async createChannel(req, res) {
    const { name, description, workspaceId } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Channel name is required' });
    }

    const io = req.app.get('io');
    try {
      const createdChannel = await ChannelService.createChannel(
        { name, description, workspaceId },
        io
      );
      res.json(createdChannel);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}
