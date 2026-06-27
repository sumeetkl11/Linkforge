import { TaskService } from '../services/taskService.js';

export class TaskController {
  static async getTasks(req, res) {
    try {
      const tasks = await TaskService.getTasks();
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async createTask(req, res) {
    const io = req.app.get('io');
    try {
      const task = await TaskService.createTask(req.body, io);
      res.json(task);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async updateTask(req, res) {
    const id = req.params.id;
    const io = req.app.get('io');
    try {
      const resultTask = await TaskService.updateTask(id, req.body, io);
      res.json(resultTask);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  static async deleteTask(req, res) {
    const id = req.params.id;
    const io = req.app.get('io');
    try {
      await TaskService.deleteTask(id, io);
      res.json({ success: true, id });
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }
}
