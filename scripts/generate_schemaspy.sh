#!/bin/bash
# 使用 SchemaSpy 生成数据库文档

echo "📊 使用 SchemaSpy 生成数据库文档..."
echo ""

# 检查环境变量
if [ -z "$DATABASE_URL" ]; then
    echo "❌ 未找到 DATABASE_URL 环境变量"
    echo "   请先设置: export DATABASE_URL='your-neon-connection-string'"
    exit 1
fi

# 解析数据库连接信息
# DATABASE_URL 格式: postgresql://user:password@host:port/database
DB_URL=$(echo $DATABASE_URL | sed 's|postgresql://||')
DB_USER=$(echo $DB_URL | cut -d: -f1)
DB_PASS=$(echo $DB_URL | cut -d: -f2 | cut -d@ -f1)
DB_HOST=$(echo $DB_URL | cut -d@ -f2 | cut -d: -f1)
DB_PORT=$(echo $DB_URL | cut -d: -f3 | cut -d/ -f1)
DB_NAME=$(echo $DB_URL | cut -d/ -f2 | cut -d? -f1)

echo "📋 数据库信息:"
echo "   主机: $DB_HOST"
echo "   端口: $DB_PORT"
echo "   数据库: $DB_NAME"
echo "   用户: $DB_USER"
echo ""

# SchemaSpy 目录
SCHEMASPY_DIR="schemaspy"
SCHEMASPY_JAR="$SCHEMASPY_DIR/schemaspy-6.1.1.jar"
POSTGRES_JDBC="$SCHEMASPY_DIR/postgresql-42.7.1.jar"
OUTPUT_DIR="schemaspy_output"

# 检查文件是否存在
if [ ! -f "$SCHEMASPY_JAR" ]; then
    echo "❌ SchemaSpy 未安装，请先运行: ./web/scripts/schemaspy_setup.sh"
    exit 1
fi

if [ ! -f "$POSTGRES_JDBC" ]; then
    echo "❌ PostgreSQL JDBC 驱动未安装，请先运行: ./web/scripts/schemaspy_setup.sh"
    exit 1
fi

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

echo "🚀 开始生成数据库文档..."
echo ""

# 运行 SchemaSpy
java -jar "$SCHEMASPY_JAR" \
    -t pgsql \
    -host "$DB_HOST" \
    -port "$DB_PORT" \
    -db "$DB_NAME" \
    -u "$DB_USER" \
    -p "$DB_PASS" \
    -s public,oms,tms,wms \
    -o "$OUTPUT_DIR" \
    -dp "$POSTGRES_JDBC" \
    -hq \
    -noads \
    -renderer :html

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 数据库文档生成成功！"
    echo "📁 输出目录: $OUTPUT_DIR/"
    echo "🌐 打开文件: $OUTPUT_DIR/index.html"
    echo ""
    echo "💡 提示: 在浏览器中打开 index.html 查看 ER 图"
else
    echo ""
    echo "❌ 生成失败，请检查数据库连接信息"
    exit 1
fi

