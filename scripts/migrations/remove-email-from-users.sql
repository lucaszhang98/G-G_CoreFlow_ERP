-- 删除 users 表中的 email 字段
-- 执行此脚本前请确保已备份数据库

-- 1. 删除 email 字段的唯一约束（如果存在）
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_key;

-- 2. 删除 email 字段
ALTER TABLE public.users DROP COLUMN IF EXISTS email;

