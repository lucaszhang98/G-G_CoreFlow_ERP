#!/bin/bash
# SchemaSpy 安装和配置脚本

echo "🔧 SchemaSpy 安装和配置..."
echo ""

# 检查 Java
if ! command -v java &> /dev/null; then
    echo "❌ 未找到 Java，请先安装 Java 11 或更高版本"
    echo "   Mac: brew install openjdk@11"
    echo "   Linux: sudo apt-get install openjdk-11-jdk"
    exit 1
fi

echo "✅ Java 已安装: $(java -version 2>&1 | head -1)"
echo ""

# 创建 schemaspy 目录
SCHEMASPY_DIR="schemaspy"
mkdir -p "$SCHEMASPY_DIR"
cd "$SCHEMASPY_DIR"

# 下载 SchemaSpy（如果不存在）
SCHEMASPY_JAR="schemaspy-6.1.1.jar"
if [ ! -f "$SCHEMASPY_JAR" ]; then
    echo "📥 下载 SchemaSpy..."
    curl -L -o "$SCHEMASPY_JAR" "https://github.com/schemaspy/schemaspy/releases/download/v6.1.1/schemaspy-6.1.1.jar"
    echo "✅ SchemaSpy 下载完成"
else
    echo "✅ SchemaSpy 已存在"
fi

# 下载 PostgreSQL JDBC 驱动（如果不存在）
POSTGRES_JDBC="postgresql-42.7.1.jar"
if [ ! -f "$POSTGRES_JDBC" ]; then
    echo "📥 下载 PostgreSQL JDBC 驱动..."
    curl -L -o "$POSTGRES_JDBC" "https://jdbc.postgresql.org/download/postgresql-42.7.1.jar"
    echo "✅ PostgreSQL JDBC 驱动下载完成"
else
    echo "✅ PostgreSQL JDBC 驱动已存在"
fi

cd ..

echo ""
echo "✅ SchemaSpy 安装完成！"
echo "📁 文件位置: $SCHEMASPY_DIR/"

