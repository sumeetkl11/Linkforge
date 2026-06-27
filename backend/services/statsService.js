import { UserRepository } from '../repositories/userRepository.js';
import { TaskRepository } from '../repositories/taskRepository.js';
import { MessageRepository } from '../repositories/messageRepository.js';

let _dashboardStatsTimer = null;

export class StatsService {
  static pushDashboardStats(io) {
    if (!io) return;
    if (_dashboardStatsTimer) clearTimeout(_dashboardStatsTimer);
    
    _dashboardStatsTimer = setTimeout(async () => {
      _dashboardStatsTimer = null;
      try {
        const userCount = await UserRepository.getCount();
        const activeUsers = userCount.toLocaleString();

        const openTasks = await TaskRepository.getOpenCount();

        const messageCount = await MessageRepository.getCount();
        const messageVolume = (messageCount / 1000).toFixed(1) + 'k';

        io.emit('dashboard_stats_update', { activeUsers, openTasks, messageVolume });
      } catch (err) {
        console.error('Failed to broadcast dashboard stats:', err);
      }
    }, 2000);
  }
}
