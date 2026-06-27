import { UserService } from '../services/userService.js';

export class UserController {
  static async register(req, res) {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    try {
      const result = await UserService.registerUser({ name, email, password });
      res.status(201).json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  static async login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      const result = await UserService.loginUser({ email, password });
      res.json(result);
    } catch (err) {
      res.status(err.statusCode || 500).json({ error: err.message });
    }
  }

  static async me(req, res) {
    try {
      const user = await UserService.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(UserService.sanitizeUser(user));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async getUsers(req, res) {
    const excludeId = req.query.exclude;
    try {
      const users = await UserService.getUsers(excludeId);
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async updateUser(req, res) {
    const io = req.app.get('io');
    try {
      const result = await UserService.updateUser(req.body, req.user.id, io);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  static async updateAvatar(req, res) {
    const id = req.params.id;
    if (id !== req.user.id) {
      return res.status(403).json({ error: 'You can only update your own avatar' });
    }
    const { avatarUrl } = req.body;
    if (!avatarUrl) {
      return res.status(400).json({ error: 'Missing avatarUrl' });
    }

    try {
      await UserService.updateAvatar(id, avatarUrl);
      res.json({ success: true, avatarUrl });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}
