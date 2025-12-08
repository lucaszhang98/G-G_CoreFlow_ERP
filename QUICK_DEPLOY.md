# ⚡ 快速部署指南

## 一键部署检查

```bash
# 1. 类型检查
npm run type-check

# 2. 构建测试
npm run build

# 3. 提交代码
git add .
git commit -m "准备部署"
git push origin main
```

## Netlify 环境变量配置

在 Netlify 控制台 → Site settings → Environment variables 中添加：

```
DATABASE_URL=postgresql://...
AUTH_SECRET=你的32字符以上密钥
AUTH_URL=https://your-app.netlify.app
```

## 部署后验证

1. 访问网站首页
2. 测试登录功能
3. 检查主要业务流程

## 回滚（如需要）

在 Netlify 控制台 → Deploys → 选择之前的部署 → Deploy to production

---

**提示**: 部署前请确保所有检查清单项目已完成 ✅


