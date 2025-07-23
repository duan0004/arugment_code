import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';

// 扩展Request接口以包含用户信息
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        nickname: string;
        role: string;
        avatar?: string;
        vip_expire_at?: Date;
        created_at: Date;
      };
    }
  }
}

// JWT认证中间件
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        message: '访问令牌缺失',
        code: 'TOKEN_MISSING'
      });
      return;
    }

    // 验证令牌
    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      res.status(401).json({
        success: false,
        message: '访问令牌无效',
        code: 'TOKEN_INVALID'
      });
      return;
    }

    // 获取用户信息
    const user = await AuthService.getUserById(decoded.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        message: '用户不存在',
        code: 'USER_NOT_FOUND'
      });
      return;
    }

    // 将用户信息添加到请求对象
    req.user = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      avatar: user.avatar,
      vip_expire_at: user.vip_expire_at,
      created_at: user.created_at,
    };

    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    res.status(500).json({
      success: false,
      message: '认证服务错误',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
};

// 可选认证中间件（不强制要求登录）
export const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = AuthService.verifyToken(token);
      if (decoded) {
        const user = await AuthService.getUserById(decoded.userId);
        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            nickname: user.nickname,
            role: user.role,
            avatar: user.avatar,
            vip_expire_at: user.vip_expire_at,
            created_at: user.created_at,
          };
        }
      }
    }

    next();
  } catch (error) {
    console.error('可选认证中间件错误:', error);
    // 可选认证失败时不阻止请求继续
    next();
  }
};

// 角色权限中间件
export const requireRole = (roles: string | string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '需要登录',
        code: 'LOGIN_REQUIRED'
      });
      return;
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: '权限不足',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
      return;
    }

    next();
  };
};

// 管理员权限中间件
export const requireAdmin = requireRole('admin');

// VIP权限中间件
export const requireVIP = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: '需要登录',
      code: 'LOGIN_REQUIRED'
    });
    return;
  }

  const now = new Date();
  const isVIP = req.user.vip_expire_at && req.user.vip_expire_at > now;
  const isAdmin = req.user.role === 'admin';

  if (!isVIP && !isAdmin) {
    res.status(403).json({
      success: false,
      message: '需要VIP权限',
      code: 'VIP_REQUIRED'
    });
    return;
  }

  next();
};

// 资源所有者权限中间件
export const requireOwnerOrAdmin = (getResourceUserId: (req: Request) => string | Promise<string>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '需要登录',
        code: 'LOGIN_REQUIRED'
      });
      return;
    }

    try {
      const resourceUserId = await getResourceUserId(req);
      const isOwner = req.user.id === resourceUserId;
      const isAdmin = req.user.role === 'admin';

      if (!isOwner && !isAdmin) {
        res.status(403).json({
          success: false,
          message: '只能访问自己的资源',
          code: 'RESOURCE_ACCESS_DENIED'
        });
        return;
      }

      next();
    } catch (error) {
      console.error('资源权限检查错误:', error);
      res.status(500).json({
        success: false,
        message: '权限检查失败',
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};
