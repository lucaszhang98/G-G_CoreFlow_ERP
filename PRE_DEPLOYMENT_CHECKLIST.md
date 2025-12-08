# 部署前最终检查清单

## ✅ 代码质量检查

- [x] TypeScript 类型检查通过 (`npm run type-check`)
- [x] 构建成功 (`npm run build`)
- [x] 无严重安全漏洞 (`npm audit`)
- [x] 无 Linter 错误

## ✅ 功能验证

- [x] 订单状态字段重构完成（status 和 operation_mode 分离）
- [x] 筛选功能支持多重筛选（AND 逻辑）
- [x] 预约明细送仓地点一致性验证
- [x] 预计板数最小值为 1 的限制

## ✅ 数据库状态

- [x] 预计板数为 0 的记录已修复（9 条记录已更新为 1）
- [x] 订单状态迁移完成（status 和 operation_mode 分离）
- [x] 入库单自动创建逻辑正常

## ✅ 配置文件

- [x] `netlify.toml` 配置正确
- [x] `next.config.ts` 配置正确
- [x] `package.json` 依赖版本正确

## ⚠️ 部署前必做事项

### 1. 环境变量检查（在 Netlify 控制台）

确保以下环境变量已配置：
- `DATABASE_URL` - 生产数据库连接字符串
- `AUTH_SECRET` - 至少 32 字符的密钥
- `AUTH_URL` - 生产环境 URL（例如：`https://your-domain.netlify.app`）
- `NODE_VERSION` - 设置为 `20`（已在 netlify.toml 中配置）

### 2. 数据库迁移

如果数据库结构有变化，需要在生产环境运行：
```bash
npx prisma migrate deploy
```

### 3. 用户账号

确保生产环境有必要的用户账号：
- 管理员账号（admin）
- 测试账号（如果需要）

### 4. 监控和日志

- 检查 Netlify 函数日志设置
- 确保错误监控已配置（如果有）

## 📝 部署后验证

部署完成后，请验证以下功能：

1. **登录功能**
   - [ ] 管理员账号可以正常登录
   - [ ] 权限控制正常

2. **订单管理**
   - [ ] 订单列表正常显示
   - [ ] 状态和操作方式筛选正常
   - [ ] 多重筛选功能正常
   - [ ] 订单创建和编辑正常

3. **预约管理**
   - [ ] 预约列表正常显示
   - [ ] 创建预约明细时，地点一致性验证正常
   - [ ] 地点一致的明细优先显示

4. **WMS 功能**
   - [ ] 入库管理正常显示（operation_mode = 'unload' 的订单）
   - [ ] 库存管理正常

5. **数据完整性**
   - [ ] 预计板数最小值为 1
   - [ ] 订单状态和操作方式显示正确

## 🚀 部署命令

在 Netlify 上部署时，系统会自动：
1. 运行 `npm install`
2. 运行 `npm run build`（包含 `prebuild` 中的 `tsc --noEmit`）
3. 使用 `@netlify/plugin-nextjs` 插件处理 Next.js 应用

## ⚠️ 注意事项

1. **构建时间**：首次部署可能需要较长时间（5-10 分钟）
2. **函数超时**：确保 Netlify 函数超时时间足够（建议至少 10 秒）
3. **数据库连接**：确保生产数据库允许 Netlify 服务器的 IP 访问
4. **Prisma 客户端**：`postinstall` 脚本会自动生成 Prisma 客户端

## 📞 问题排查

如果部署失败，检查：
1. Netlify 构建日志
2. 环境变量是否正确配置
3. 数据库连接是否正常
4. Prisma 迁移是否完成
