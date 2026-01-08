-- 创建表格视图配置表
-- Schema: public
-- 用于存储用户的表格列显示/宽度/顺序配置

CREATE TABLE IF NOT EXISTS public.table_views (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    table_name VARCHAR(100) NOT NULL,
    view_name VARCHAR(100) NOT NULL,
    column_visibility JSONB NOT NULL,
    column_sizing JSONB,
    column_order TEXT[] NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    
    -- 外键约束
    CONSTRAINT fk_table_views_user_id FOREIGN KEY (user_id)
        REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- 唯一约束：同一用户同一表的视图名不能重复
    CONSTRAINT unique_user_table_view_name UNIQUE (user_id, table_name, view_name)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_table_views_user_table 
    ON public.table_views(user_id, table_name);

CREATE INDEX IF NOT EXISTS idx_table_views_default 
    ON public.table_views(user_id, table_name, is_default);

-- 添加注释
COMMENT ON TABLE public.table_views IS '表格视图配置：存储用户自定义的表格列显示/宽度/顺序配置';
COMMENT ON COLUMN public.table_views.id IS '主键ID';
COMMENT ON COLUMN public.table_views.user_id IS '用户ID，关联到users表';
COMMENT ON COLUMN public.table_views.table_name IS '表名，如"orders"、"drivers"等';
COMMENT ON COLUMN public.table_views.view_name IS '视图名称，如"日常管理"、"导出视图"等';
COMMENT ON COLUMN public.table_views.column_visibility IS '列可见性配置JSON对象，格式：{"column_id": true/false}';
COMMENT ON COLUMN public.table_views.column_sizing IS '列宽配置JSON对象，格式：{"column_id": 150}';
COMMENT ON COLUMN public.table_views.column_order IS '列顺序数组，格式：["column1", "column2", ...]';
COMMENT ON COLUMN public.table_views.is_default IS '是否为该表的默认视图';
COMMENT ON COLUMN public.table_views.created_at IS '创建时间';
COMMENT ON COLUMN public.table_views.updated_at IS '更新时间';

