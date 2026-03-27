#!/usr/bin/env bash
# 将「源 Neon」整库（所有 schema + 数据）复制到「目标 Neon」。
# 需本机已安装：pg_dump / pg_restore（如：brew install libpq，并把 bin 加入 PATH）
#
# 规范（与 .env 一致）：主库为直连实例，主机 ep-autumn-cherry-ake0bqaw.c-3.us-west-2.aws.neon.tech，
# 库 neondb；迁移 / prisma db execute / Neon MCP 改库均应对准该库。连接串只放在 .env* 与部署平台，勿写进仓库。
#
# 用法（连接串用控制台里的 Direct / 非 pooler，勿提交到 Git）：
#   export NEON_SOURCE_URL='postgresql://...@...neon.tech/neondb?sslmode=require'
#   export NEON_TARGET_URL='postgresql://...@...neon.tech/neondb?sslmode=require'
#   ./scripts/neon-full-copy.sh
#
# 可选：并行恢复加快速度（大库）
#   export NEON_RESTORE_JOBS=4
#
# 注意：目标库建议为空库；若已有表，可能与 dump 里的对象冲突。

set -euo pipefail

: "${NEON_SOURCE_URL:?请先 export NEON_SOURCE_URL（你的旧库直连 URI）}"
: "${NEON_TARGET_URL:?请先 export NEON_TARGET_URL（老板新库直连 URI）}"

for cmd in pg_dump pg_restore; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "缺少命令: $cmd。请安装: brew install libpq"
    echo "并把 PATH 加上: export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\""
    exit 1
  fi
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/scripts/output"
mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
DUMP="$OUT_DIR/neon_full_${STAMP}.dump"

echo "==> 正在从源库导出到: $DUMP"
pg_dump "$NEON_SOURCE_URL" -F c -f "$DUMP" -v

echo "==> 正在导入到目标库（--no-owner --no-acl）"
JOBS="${NEON_RESTORE_JOBS:-}"
if [[ -n "$JOBS" ]]; then
  pg_restore -d "$NEON_TARGET_URL" --no-owner --no-acl --verbose --jobs="$JOBS" "$DUMP"
else
  pg_restore -d "$NEON_TARGET_URL" --no-owner --no-acl --verbose "$DUMP"
fi

echo "==> 完成。备份文件保留在: $DUMP"
echo "    请将应用 .env 中 DATABASE_URL / DIRECT_URL 改为目标库并 prisma generate。"
