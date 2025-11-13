# G&G CoreFlow ERP System

基于 Next.js 14 + TypeScript + Prisma + Shadcn/ui 构建的 OMS/TMS/WMS 一体化系统

## 技术栈

- **前端框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **UI 组件**: Shadcn/ui
- **数据库 ORM**: Prisma
- **数据库**: Neon PostgreSQL
- **认证**: NextAuth.js

## 项目结构

```
web/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   ├── (dashboard)/      # 仪表盘路由组
│   │   ├── oms/          # 订单管理系统
│   │   ├── tms/          # 运输管理系统
│   │   └── wms/          # 仓储管理系统
│   └── page.tsx          # 首页
├── lib/                   # 工具函数
│   ├── prisma.ts         # Prisma Client 实例
│   └── utils.ts          # 通用工具函数
├── components/            # React 组件
│   └── ui/               # Shadcn/ui 组件
└── prisma/               # Prisma 配置
    └── schema.prisma     # 数据库模型定义
```

## 下一步操作

### 1. 生成 Prisma Client（从现有数据库）

```bash
# 从 Neon 数据库生成 Prisma schema
npx prisma db pull

# 生成 Prisma Client
npx prisma generate
```

### 2. 添加 Shadcn/ui 组件

```bash
# 添加常用组件
npx shadcn@latest add button
npx shadcn@latest add table
npx shadcn@latest add form
npx shadcn@latest add card
npx shadcn@latest add dialog
```

### 3. 配置 NextAuth.js

创建 `app/api/auth/[...nextauth]/route.ts` 配置认证

### 4. 开发 API 接口

在 `app/api/` 目录下创建各个业务模块的 API 路由

### 5. 开发前端页面

在 `app/(dashboard)/` 目录下创建各个业务模块的页面

## 开发命令

```bash
# 启动开发服务器
npm run dev

# 生成 Prisma Client
npx prisma generate

# 查看数据库（Prisma Studio）
npx prisma studio

# 数据库迁移（如果需要）
npx prisma migrate dev
```

## 环境变量

确保 `.env.local` 文件已配置：
- `DATABASE_URL`: Neon 数据库连接字符串
- `NEXTAUTH_URL`: 应用 URL
- `NEXTAUTH_SECRET`: NextAuth 密钥（生产环境需更换）

## 数据库连接

当前连接的是 Neon PostgreSQL 数据库，包含以下 schemas:
- `public`: 主数据表
- `oms`: 订单管理
- `tms`: 运输管理
- `wms`: 仓储管理
