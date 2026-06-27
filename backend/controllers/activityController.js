import { ActivityService } from '../services/activityService.js';

export class ActivityController {
  static async getActivities(req, res) {
    try {
      const activities = await ActivityService.getActivities();
      res.json(activities);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async createActivity(req, res) {
    try {
      const activity = await ActivityService.createActivity(req.body);
      res.json(activity);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}
