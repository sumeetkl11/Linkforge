import { MessageService } from '../services/messageService.js';

export class MessageController {
  static async getMessages(req, res) {
    const chatId = req.params.chatId;
    const { type } = req.query;
    const currentUserId = req.user.id;

    try {
      const messages = await MessageService.getMessages(chatId, type, currentUserId);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async createMessage(req, res) {
    const { channelId, message: clientMessage, receiverId } = req.body;
    if (!clientMessage) {
      return res.status(400).json({ error: 'Missing message object' });
    }

    const currentUserId = req.user.id;
    const io = req.app.get('io');

    try {
      const message = await MessageService.createMessage(
        { channelId, message: clientMessage, receiverId },
        currentUserId,
        io
      );
      res.json(message);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }
}
