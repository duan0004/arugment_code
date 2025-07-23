import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { AuthService } from '../services/authService';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// 输入验证规则
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('请输入有效的邮箱地址'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('密码至少需要6个字符')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('密码必须包含大小写字母和数字'),
  body('nickname')
    .isLength({ min: 2, max: 20 })
    .withMessage('昵称长度应在2-20个字符之间')
    .matches(/^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/)
    .withMessage('昵称只能包含字母、数字、中文、下划线和连字符'),
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('请输入有效的邮箱地址'),
  body('password')
    .notEmpty()
    .withMessage('密码不能为空'),
];

// 用户注册
router.post('/register', registerValidation, async (req: Request, res: Response): Promise<void> => {
  try {
    // 检查验证错误
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
      return;
    }

    const { email, password, nickname } = req.body;

    // 注册用户
    const result = await AuthService.register({ email, password, nickname });
    
    if (!result) {
      res.status(400).json({
        success: false,
        message: '注册失败，邮箱可能已被使用'
      });
      return;
    }

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: result.user,
        token: result.token
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({
      success: false,
      message: '注册服务错误'
    });
  }
});

// 用户登录
router.post('/login', loginValidation, async (req: Request, res: Response): Promise<void> => {
  try {
    // 检查验证错误
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
      return;
    }

    const { email, password } = req.body;

    // 用户登录
    const result = await AuthService.login({ email, password });
    
    if (!result) {
      res.status(401).json({
        success: false,
        message: '登录失败，邮箱或密码错误'
      });
      return;
    }

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: result.user,
        token: result.token
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '登录服务错误'
    });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '用户信息不存在'
      });
      return;
    }

    res.json({
      success: true,
      message: '获取用户信息成功',
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
});

// 更新用户信息
router.put('/me', authenticateToken, [
  body('nickname')
    .optional()
    .isLength({ min: 2, max: 20 })
    .withMessage('昵称长度应在2-20个字符之间')
    .matches(/^[a-zA-Z0-9\u4e00-\u9fa5_-]+$/)
    .withMessage('昵称只能包含字母、数字、中文、下划线和连字符'),
  body('avatar')
    .optional()
    .isURL()
    .withMessage('头像必须是有效的URL'),
], async (req: Request, res: Response): Promise<void> => {
  try {
    // 检查验证错误
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: '用户信息不存在'
      });
      return;
    }

    const { nickname, avatar } = req.body;
    const updateData: any = {};
    
    if (nickname) updateData.nickname = nickname;
    if (avatar) updateData.avatar = avatar;

    // 更新用户信息
    const updatedUser = await AuthService.updateUser(req.user.id, updateData);
    
    if (!updatedUser) {
      res.status(400).json({
        success: false,
        message: '更新用户信息失败'
      });
      return;
    }

    res.json({
      success: true,
      message: '用户信息更新成功',
      data: {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          nickname: updatedUser.nickname,
          avatar: updatedUser.avatar,
          role: updatedUser.role,
          vip_expire_at: updatedUser.vip_expire_at,
          created_at: updatedUser.created_at,
        }
      }
    });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '更新用户信息失败'
    });
  }
});

// 验证令牌
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    
    if (!token) {
      res.status(400).json({
        success: false,
        message: '令牌不能为空'
      });
      return;
    }

    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      res.status(401).json({
        success: false,
        message: '令牌无效'
      });
      return;
    }

    const user = await AuthService.getUserById(decoded.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        message: '用户不存在'
      });
      return;
    }

    res.json({
      success: true,
      message: '令牌验证成功',
      data: {
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          avatar: user.avatar,
          role: user.role,
          vip_expire_at: user.vip_expire_at,
          created_at: user.created_at,
        }
      }
    });
  } catch (error) {
    console.error('令牌验证错误:', error);
    res.status(500).json({
      success: false,
      message: '令牌验证失败'
    });
  }
});

// 获取用户统计（管理员）
router.get('/stats', authenticateToken, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await AuthService.getUserStats();
    
    res.json({
      success: true,
      message: '获取用户统计成功',
      data: stats
    });
  } catch (error) {
    console.error('获取用户统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取用户统计失败'
    });
  }
});

export default router;
