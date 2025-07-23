import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { User } from '@prisma/client';

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 内存用户存储（备选方案）
interface MemoryUser {
  id: string;
  email: string;
  password: string;
  provider: string;
  provider_id?: string;
  nickname: string;
  avatar?: string;
  role: string;
  vip_expire_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const memoryUsers = new Map<string, MemoryUser>();
const memoryUsersByEmail = new Map<string, MemoryUser>();
let userIdCounter = 1;

export interface RegisterData {
  email: string;
  password: string;
  nickname: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  avatar?: string;
  role: string;
  vip_expire_at?: Date;
  created_at: Date;
}

export class AuthService {
  // 密码加密
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // 密码验证
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  // 生成JWT令牌
  static generateToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
  }

  // 验证JWT令牌
  static verifyToken(token: string): { userId: string } | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      return decoded;
    } catch (error) {
      return null;
    }
  }

  // 用户注册
  static async register(data: RegisterData): Promise<{ user: UserProfile; token: string } | null> {
    try {
      // 检查邮箱是否已存在
      const existingUser = await this.getUserByEmail(data.email);
      if (existingUser) {
        throw new Error('邮箱已被注册');
      }

      // 加密密码
      const hashedPassword = await this.hashPassword(data.password);

      // 创建用户
      const user = await this.createUser({
        email: data.email,
        password: hashedPassword,
        nickname: data.nickname,
        provider: 'local',
        role: 'user',
      });

      if (!user) {
        throw new Error('用户创建失败');
      }

      // 生成令牌
      const token = this.generateToken(user.id);

      // 返回用户信息（不包含密码）
      const userProfile: UserProfile = {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar || undefined,
        role: user.role,
        vip_expire_at: user.vip_expire_at || undefined,
        created_at: user.created_at,
      };

      return { user: userProfile, token };
    } catch (error) {
      console.error('用户注册失败:', error);
      return null;
    }
  }

  // 用户登录
  static async login(data: LoginData): Promise<{ user: UserProfile; token: string } | null> {
    try {
      // 获取用户
      const user = await this.getUserByEmail(data.email);
      if (!user) {
        throw new Error('用户不存在');
      }

      // 验证密码
      const isPasswordValid = await this.verifyPassword(data.password, user.password);
      if (!isPasswordValid) {
        throw new Error('密码错误');
      }

      // 生成令牌
      const token = this.generateToken(user.id);

      // 返回用户信息（不包含密码）
      const userProfile: UserProfile = {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar || undefined,
        role: user.role,
        vip_expire_at: user.vip_expire_at || undefined,
        created_at: user.created_at,
      };

      return { user: userProfile, token };
    } catch (error) {
      console.error('用户登录失败:', error);
      return null;
    }
  }

  // 根据ID获取用户
  static async getUserById(id: string): Promise<MemoryUser | null> {
    if (prisma) {
      try {
        const user = await prisma!.user.findUnique({
          where: { id },
        });
        return user as any;
      } catch (error) {
        console.error('数据库获取用户失败，降级到内存存储:', error);
        return memoryUsers.get(id) || null;
      }
    } else {
      return memoryUsers.get(id) || null;
    }
  }

  // 根据邮箱获取用户
  static async getUserByEmail(email: string): Promise<MemoryUser | null> {
    if (prisma) {
      try {
        const user = await prisma!.user.findUnique({
          where: { email },
        });
        return user as any;
      } catch (error) {
        console.error('数据库获取用户失败，降级到内存存储:', error);
        return memoryUsersByEmail.get(email) || null;
      }
    } else {
      return memoryUsersByEmail.get(email) || null;
    }
  }

  // 创建用户
  static async createUser(data: {
    email: string;
    password: string;
    nickname: string;
    provider: string;
    provider_id?: string;
    role?: string;
    avatar?: string;
  }): Promise<MemoryUser | null> {
    if (prisma) {
      try {
        const user = await prisma!.user.create({
          data: {
            email: data.email,
            password: data.password,
            nickname: data.nickname,
            provider: data.provider,
            provider_id: data.provider_id || null,
            role: data.role || 'user',
            avatar: data.avatar || null,
          },
        });
        return user as any;
      } catch (error) {
        console.error('数据库创建用户失败，降级到内存存储:', error);
        // 降级到内存存储
        const id = `user_${userIdCounter++}`;
        const now = new Date();
        const memoryUser: MemoryUser = {
          id,
          email: data.email,
          password: data.password,
          provider: data.provider,
          provider_id: data.provider_id,
          nickname: data.nickname,
          avatar: data.avatar,
          role: data.role || 'user',
          created_at: now,
          updated_at: now,
        };
        memoryUsers.set(id, memoryUser);
        memoryUsersByEmail.set(data.email, memoryUser);
        return memoryUser;
      }
    } else {
      // 使用内存存储
      const id = `user_${userIdCounter++}`;
      const now = new Date();
      const memoryUser: MemoryUser = {
        id,
        email: data.email,
        password: data.password,
        provider: data.provider,
        provider_id: data.provider_id,
        nickname: data.nickname,
        avatar: data.avatar,
        role: data.role || 'user',
        created_at: now,
        updated_at: now,
      };
      memoryUsers.set(id, memoryUser);
      memoryUsersByEmail.set(data.email, memoryUser);
      return memoryUser;
    }
  }

  // 更新用户信息
  static async updateUser(id: string, data: {
    nickname?: string;
    avatar?: string;
    role?: string;
  }): Promise<MemoryUser | null> {
    if (prisma) {
      try {
        const user = await prisma!.user.update({
          where: { id },
          data,
        });
        return user as any;
      } catch (error) {
        console.error('数据库更新用户失败，降级到内存存储:', error);
        // 降级到内存存储
        const memoryUser = memoryUsers.get(id);
        if (!memoryUser) return null;
        
        if (data.nickname) memoryUser.nickname = data.nickname;
        if (data.avatar) memoryUser.avatar = data.avatar;
        if (data.role) memoryUser.role = data.role;
        memoryUser.updated_at = new Date();
        
        // 更新邮箱索引
        memoryUsersByEmail.set(memoryUser.email, memoryUser);
        return memoryUser;
      }
    } else {
      // 使用内存存储
      const memoryUser = memoryUsers.get(id);
      if (!memoryUser) return null;
      
      if (data.nickname) memoryUser.nickname = data.nickname;
      if (data.avatar) memoryUser.avatar = data.avatar;
      if (data.role) memoryUser.role = data.role;
      memoryUser.updated_at = new Date();
      
      // 更新邮箱索引
      memoryUsersByEmail.set(memoryUser.email, memoryUser);
      return memoryUser;
    }
  }

  // 删除用户
  static async deleteUser(id: string): Promise<boolean> {
    if (prisma) {
      try {
        await prisma!.user.delete({
          where: { id },
        });
        return true;
      } catch (error) {
        console.error('数据库删除用户失败:', error);
        // 降级到内存存储
        const memoryUser = memoryUsers.get(id);
        if (!memoryUser) return false;
        
        memoryUsers.delete(id);
        memoryUsersByEmail.delete(memoryUser.email);
        return true;
      }
    } else {
      // 使用内存存储
      const memoryUser = memoryUsers.get(id);
      if (!memoryUser) return false;
      
      memoryUsers.delete(id);
      memoryUsersByEmail.delete(memoryUser.email);
      return true;
    }
  }

  // 获取用户统计
  static async getUserStats(): Promise<{
    total: number;
    activeUsers: number;
    vipUsers: number;
  }> {
    if (prisma) {
      try {
        const [total, vipUsers] = await Promise.all([
          prisma!.user.count(),
          prisma!.user.count({
            where: {
              vip_expire_at: {
                gt: new Date(),
              },
            },
          }),
        ]);

        return {
          total,
          activeUsers: total, // 简化处理，认为所有用户都是活跃的
          vipUsers,
        };
      } catch (error) {
        console.error('数据库获取用户统计失败，降级到内存统计:', error);
        // 降级到内存统计
        const allUsers = Array.from(memoryUsers.values());
        const now = new Date();
        const vipUsers = allUsers.filter(user => 
          user.vip_expire_at && user.vip_expire_at > now
        ).length;

        return {
          total: allUsers.length,
          activeUsers: allUsers.length,
          vipUsers,
        };
      }
    } else {
      // 使用内存统计
      const allUsers = Array.from(memoryUsers.values());
      const now = new Date();
      const vipUsers = allUsers.filter(user => 
        user.vip_expire_at && user.vip_expire_at > now
      ).length;

      return {
        total: allUsers.length,
        activeUsers: allUsers.length,
        vipUsers,
      };
    }
  }
}
