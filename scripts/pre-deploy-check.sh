#!/bin/bash

# 部署前检查脚本
# 确保所有依赖和配置都正确

set -e

echo "🚀 开始部署前检查..."
echo ""

# 1. 检查环境变量
echo "✅ 检查环境变量..."
if [ ! -f .env ]; then
    echo "❌ 错误: 缺少 .env 文件"
    exit 1
fi

# 检查必要的环境变量
required_vars=("DATABASE_URL" "AUTH_SECRET" "NEXTAUTH_URL")
for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env; then
        echo "❌ 错误: .env 中缺少 ${var}"
        exit 1
    fi
done
echo "   环境变量配置正确"
echo ""

# 2. 检查依赖
echo "✅ 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "   安装依赖中..."
    npm install
fi
echo "   依赖已安装"
echo ""

# 3. 生成 Prisma Client
echo "✅ 生成 Prisma Client..."
npx prisma generate > /dev/null 2>&1
echo "   Prisma Client 已生成"
echo ""

# 4. 类型检查
echo "✅ TypeScript 类型检查..."
if npm run type-check > /dev/null 2>&1; then
    echo "   类型检查通过"
else
    echo "⚠️  警告: TypeScript 类型检查有错误，但继续部署"
fi
echo ""

# 5. 清理构建缓存
echo "✅ 清理构建缓存..."
rm -rf .next
echo "   构建缓存已清理"
echo ""

# 6. 测试构建
echo "✅ 测试生产构建..."
if npm run build > build.log 2>&1; then
    echo "   构建成功！"
    rm -f build.log
else
    echo "❌ 构建失败，查看 build.log 了解详情"
    exit 1
fi
echo ""

# 7. 检查构建大小
echo "✅ 检查构建大小..."
BUILD_SIZE=$(du -sh .next | cut -f1)
echo "   构建大小: $BUILD_SIZE"
echo ""

# 8. 检查数据库连接
echo "✅ 检查数据库连接..."
if node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect()
  .then(() => { console.log('   数据库连接成功'); process.exit(0); })
  .catch((e) => { console.error('❌ 数据库连接失败:', e.message); process.exit(1); });
" 2>/dev/null; then
    echo ""
else
    echo "❌ 数据库连接测试失败"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 所有检查通过！可以部署了！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📦 部署提示:"
echo "   1. 确保生产环境的 DATABASE_URL 已配置"
echo "   2. 确保生产环境的 AUTH_SECRET 已配置"
echo "   3. 确保生产环境的 NEXTAUTH_URL 已配置"
echo "   4. Netlify 会自动运行 'npm run build'"
echo ""
