import { UserRepository } from '../repositories/userRepository.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { getCache, setCache, invalidateCache } from '../db/redis.js';
import { StatsService } from './statsService.js';

export class UserService {
  static sanitizeUser(user) {
    if (!user) return user;
    const { password, ...safe } = user;
    return safe;
  }

  static async getUserById(id) {
    return await UserRepository.getById(id);
  }

  static async getUsers(excludeId) {
    const cacheKey = excludeId ? `syncforge:users:excl:${excludeId}` : 'syncforge:users:all';
    const cached = await getCache(cacheKey);
    if (cached) return cached;

    const users = await UserRepository.getAll(excludeId);
    await setCache(cacheKey, users, 60); // 60s TTL
    return users;
  }

  static async registerUser({ name, email, password }) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await UserRepository.getByEmail(normalizedEmail);
    if (existing) {
      const err = new Error('An account with this email already exists');
      err.statusCode = 409;
      throw err;
    }

    const username = normalizedEmail.split('@')[0];
    const id = `u-${Date.now()}`;
    const passwordHash = await hashPassword(password);
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`;

    const user = await UserRepository.createUser({
      id,
      name: name || username.charAt(0).toUpperCase() + username.slice(1),
      email: normalizedEmail,
      passwordHash,
      username,
      avatar
    });

    const token = signToken({ id: user.id, email: user.email });
    return { token, user: this.sanitizeUser(user) };
  }

  static async loginUser({ email, password }) {
    const user = await UserRepository.getByEmail(email);
    if (!user) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    if (!user.password) {
      const err = new Error('Please sign in with Google or GitHub');
      err.statusCode = 401;
      throw err;
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const token = signToken({ id: user.id, email: user.email });
    return { token, user: this.sanitizeUser(user) };
  }

  static async updateUser(userData, authenticatedUserId, io) {
    // Force the updated user's ID to be the authenticated user's ID
    const userToUpdate = { ...userData, id: authenticatedUserId };
    const updatedUser = await UserRepository.updateUser(userToUpdate);

    // Invalidate caches
    await invalidateCache('syncforge:users:all');
    await invalidateCache(`syncforge:users:excl:${authenticatedUserId}`);

    StatsService.pushDashboardStats(io);

    return this.sanitizeUser(updatedUser);
  }

  static async updateAvatar(id, avatarUrl) {
    await UserRepository.updateAvatar(id, avatarUrl);
    
    // Invalidate caches
    await invalidateCache('syncforge:users:all');
    await invalidateCache(`syncforge:users:excl:${id}`);
  }
}
