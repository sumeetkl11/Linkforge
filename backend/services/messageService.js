import { MessageRepository } from '../repositories/messageRepository.js';
import { UserRepository } from '../repositories/userRepository.js';
import { UserService } from './userService.js';
import { StatsService } from './statsService.js';

export class MessageService {
  static async getMessages(chatId, type, currentUserId) {
    if (type === 'dm') {
      return await MessageRepository.getDMMessages(currentUserId, chatId);
    } else {
      return await MessageRepository.getChannelOrWorkspaceMessages(chatId);
    }
  }

  static async createMessage({ channelId, message: clientMessage, receiverId }, currentUserId, io) {
    // Resolve the real sender from the authenticated token
    const sender = await UserRepository.getById(currentUserId);
    if (!sender) {
      const err = new Error('Sender not found');
      err.statusCode = 401;
      throw err;
    }

    const message = {
      ...clientMessage,
      id: clientMessage.id || `msg-${Date.now()}`,
      user: UserService.sanitizeUser(sender),
      receiverId: receiverId || null,
      channelId: receiverId ? null : (channelId || null),
      workspaceId: receiverId ? null : (channelId || null)
    };

    await MessageRepository.createMessage({
      id: message.id,
      channelId,
      user: message.user,
      content: message.content,
      timestamp: message.timestamp,
      reactions: message.reactions,
      codeSnippet: message.codeSnippet,
      fileAttachment: message.fileAttachment,
      workspaceId: receiverId ? null : (channelId || null),
      receiverId: receiverId || null
    });

    if (io) {
      if (receiverId) {
        io.to(currentUserId).to(receiverId).emit('message:received', message);
      } else {
        io.to(channelId).emit('message:received', message);
      }
    }

    StatsService.pushDashboardStats(io);

    return message;
  }
}
