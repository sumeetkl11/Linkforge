import { ActivityRepository } from '../repositories/activityRepository.js';

export class ActivityService {
  static async getActivities() {
    return await ActivityRepository.getRecent(50);
  }

  static async createActivity(newActivity) {
    const activity = { ...newActivity };
    if (!activity.id) {
      activity.id = `act-${Date.now()}`;
    }

    await ActivityRepository.create(activity);
    await ActivityRepository.trim(50);
    return activity;
  }
}
