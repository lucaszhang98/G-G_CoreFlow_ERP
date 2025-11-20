# NextAuth 500 错误修复指南

## 🔴 问题诊断

根据你提供的错误信息：
- `/api/auth/session` 返回 **500 错误**
- 错误信息：`"There was a problem with the server configuration"`
- fetch 结果：`undefined`

这个错误通常是因为 **NextAuth 环境变量配置错误**。

---

## ✅ 已修复的代码问题

1. ✅ 增强了 Session callback 的错误处理
2. ✅ 添加了所有字段的安全转换
3. ✅ 添加了缺失检查，防止 undefined 错误
4. ✅ 确保即使出错也返回基本 session 结构

---

## ⚠️ **最重要：检查 Netlify 环境变量**

这个 500 错误**最可能**的原因是环境变量未设置或格式错误。

### 必须设置的环境变量

在 **Netlify 控制台** → **Site settings** → **Environment variables** 中设置：

#### 1. `NEXTAUTH_SECRET` ⚠️ **必需**
- **格式**：至少 32 个字符的随机字符串
- **如何生成**：
  ```bash
  openssl rand -base64 32
  ```
- **如果未设置**：会导致 500 错误

#### 2. `NEXTAUTH_URL` ⚠️ **必需**
- **格式**：`https://coreflow-erp.netlify.app`
- **必须包含协议（https://）**
- **不要包含尾部斜杠**
- **如果未设置或格式错误**：会导致 500 错误

#### 3. `DATABASE_URL` ⚠️ **必需**
- **格式**：`postgresql://user:password@host/database?sslmode=require`
- **不要包含 `psql '` 前缀或额外的引号**

---

## 📋 检查和设置步骤

1. **登录 Netlify 控制台**
2. **选择你的站点** (`coreflow-erp`)
3. **进入 Site settings → Environment variables**
4. **检查并设置以下变量：**

| 变量名 | 值 | 状态 |
|--------|-----|------|
| `NEXTAUTH_SECRET` | (32+ 字符的随机字符串) | ⚠️ **必须设置** |
| `NEXTAUTH_URL` | `https://coreflow-erp.netlify.app` | ⚠️ **必须设置** |
| `DATABASE_URL` | `postgresql://...` | ⚠️ **必须设置** |

5. **设置后，必须重新部署**：
   - 在 Netlify 控制台：**Deploys** → **Trigger deploy**

---

## 🧪 测试修复

设置环境变量并重新部署后：

1. 等待部署完成
2. 访问网站
3. 在浏览器控制台运行：
   ```javascript
   fetch('/api/auth/session').then(r => r.json()).then(console.log)
   ```
4. **如果返回** `{}` 或包含 `user` 对象，说明修复成功
5. **如果还是 500 错误**，检查 Netlify Functions Logs 中的详细错误信息

---

## 🔍 如果还是不行

如果设置环境变量后还是 500 错误：

1. **查看 Netlify Functions Logs**：
   - Netlify 控制台 → **Functions** → **Function logs**
   - 查找包含 `Session callback error:` 或 `Authentication error:` 的日志
   - **复制错误信息发给我**

2. **检查环境变量格式**：
   - `NEXTAUTH_URL` 必须完全匹配：`https://coreflow-erp.netlify.app`
   - 不要有空格、引号或特殊字符
   - `NEXTAUTH_SECRET` 必须足够长（至少 32 个字符）

---

## 💡 快速检查清单

- [ ] `NEXTAUTH_SECRET` 已设置且长度 >= 32 字符
- [ ] `NEXTAUTH_URL` 已设置且格式为 `https://coreflow-erp.netlify.app`
- [ ] `DATABASE_URL` 已设置且格式正确
- [ ] 已重新部署站点
- [ ] 已清除浏览器缓存

如果以上都检查过了还是不行，请提供 Netlify Functions Logs 中的错误信息。

