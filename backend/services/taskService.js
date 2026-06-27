import { TaskRepository } from '../repositories/taskRepository.js';
import { getCache, setCache, invalidateCache } from '../db/redis.js';
import { StatsService } from './statsService.js';

export class TaskService {
  static async getTasks() {
    const cacheKey = 'syncforge:tasks';
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const tasks = await TaskRepository.getAll();
    await setCache(cacheKey, tasks);
    return tasks;
  }

  static async createTask(newTask, io) {
    const task = { ...newTask };
    if (!task.id) {
      task.id = `SF-${Math.floor(100 + Math.random() * 9000)}`;
    }
    if (!task.comments) task.comments = [];
    if (task.commentsCount === undefined) task.commentsCount = 0;
    if (task.attachmentsCount === undefined) task.attachmentsCount = 0;

    await TaskRepository.create(task);
    await invalidateCache('syncforge:tasks');

    if (io) {
      io.emit('task:created', task);
    }
    StatsService.pushDashboardStats(io);

    return task;
  }

  static async updateTask(id, updatedTask, io) {
    const existingTask = await TaskRepository.getById(id);
    if (!existingTask) {
      const err = new Error('Task not found');
      err.statusCode = 404;
      throw err;
    }

    // Merge fields
    const mergedTask = {
      title: updatedTask.title !== undefined ? updatedTask.title : existingTask.title,
      description: updatedTask.description !== undefined ? updatedTask.description : existingTask.description,
      priority: updatedTask.priority !== undefined ? updatedTask.priority : existingTask.priority,
      status: updatedTask.status !== undefined ? updatedTask.status : existingTask.status,
      assignee: updatedTask.assignee !== undefined ? updatedTask.assignee : existingTask.assignee,
      dueDate: updatedTask.dueDate !== undefined ? updatedTask.dueDate : existingTask.dueDate,
      commentsCount: updatedTask.commentsCount !== undefined ? updatedTask.commentsCount : existingTask.commentsCount,
      attachmentsCount: updatedTask.attachmentsCount !== undefined ? updatedTask.attachmentsCount : existingTask.attachmentsCount,
      tags: updatedTask.tags !== undefined ? updatedTask.tags : existingTask.tags,
      comments: updatedTask.comments !== undefined ? updatedTask.comments : existingTask.comments
    };

    await TaskRepository.update(id, mergedTask);
    await invalidateCache('syncforge:tasks');

    const resultTask = await TaskRepository.getById(id);

    if (io) {
      io.emit('task:updated', resultTask);
    }
    StatsService.pushDashboardStats(io);

    return resultTask;
  }

  static async deleteTask(id, io) {
    const deleted = await TaskRepository.delete(id);
    if (!deleted) {
      const err = new Error('Task not found');
      err.statusCode = 404;
      throw err;
    }

    await invalidateCache('syncforge:tasks');

    if (io) {
      io.emit('task:deleted', id);
    }
    StatsService.pushDashboardStats(io);
  }
}
