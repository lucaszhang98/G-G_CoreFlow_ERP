import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

console.log('📋 导出数据库结构备份...\n');
console.log('='.repeat(80));

async function exportSchema() {
  try {
    const sql = [];
    
    sql.push('-- ============================================');
    sql.push('-- G&G CoreFlow ERP 数据库结构备份');
    sql.push('-- 生成时间: ' + new Date().toISOString());
    sql.push('-- 用途: 用于重建数据库结构');
    sql.push('-- ============================================\n');
    
    sql.push('-- 设置时区');
    sql.push("SET timezone = 'UTC';\n");
    
    // 1. 导出所有表结构
    console.log('📋 步骤 1: 导出表结构...');
    const tables = await prisma.$queryRawUnsafe(`
      SELECT 
        table_schema,
        table_name
      FROM information_schema.tables
      WHERE table_schema IN ('public', 'oms', 'tms', 'wms')
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `);
    
    console.log(`   找到 ${tables.length} 个表\n`);
    
    for (const table of tables) {
      const { table_schema, table_name } = table;
      const fullTableName = `${table_schema}.${table_name}`;
      
      // 获取表结构
      const columns = await prisma.$queryRawUnsafe(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          is_nullable,
          column_default,
          udt_name
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `, table_schema, table_name);
      
      sql.push(`-- ============================================`);
      sql.push(`-- 表: ${fullTableName}`);
      sql.push(`-- ============================================`);
      sql.push(`CREATE TABLE IF NOT EXISTS ${fullTableName} (`);
      
      const columnDefs = [];
      for (const col of columns) {
        let colDef = `  ${col.column_name} `;
        
        // 数据类型
        if (col.data_type === 'character varying') {
          colDef += `VARCHAR(${col.character_maximum_length})`;
        } else if (col.data_type === 'numeric' || col.data_type === 'decimal') {
          colDef += `NUMERIC(${col.numeric_precision}, ${col.numeric_scale})`;
        } else if (col.data_type === 'timestamp with time zone') {
          colDef += 'TIMESTAMPTZ';
        } else if (col.data_type === 'timestamp without time zone') {
          colDef += 'TIMESTAMP';
        } else if (col.data_type === 'date') {
          colDef += 'DATE';
        } else if (col.data_type === 'time without time zone') {
          colDef += 'TIME';
        } else if (col.data_type === 'bigint') {
          colDef += 'BIGINT';
        } else if (col.data_type === 'integer') {
          colDef += 'INTEGER';
        } else if (col.data_type === 'boolean') {
          colDef += 'BOOLEAN';
        } else if (col.data_type === 'jsonb') {
          colDef += 'JSONB';
        } else if (col.data_type === 'text') {
          colDef += 'TEXT';
        } else {
          colDef += col.udt_name.toUpperCase();
        }
        
        // NOT NULL
        if (col.is_nullable === 'NO') {
          colDef += ' NOT NULL';
        }
        
        // DEFAULT
        if (col.column_default) {
          let defaultValue = col.column_default;
          // 处理函数调用
          if (defaultValue.includes('::')) {
            defaultValue = defaultValue.split('::')[0];
          }
          // 处理 nextval
          if (defaultValue.includes('nextval')) {
            defaultValue = defaultValue.replace(/nextval\([^)]+\)/, 'AUTO_INCREMENT');
          }
          colDef += ` DEFAULT ${defaultValue}`;
        }
        
        columnDefs.push(colDef);
      }
      
      sql.push(columnDefs.join(',\n'));
      sql.push(');\n');
      
      // 获取主键
      const primaryKeys = await prisma.$queryRawUnsafe(`
        SELECT column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = $1 
          AND tc.table_name = $2
          AND tc.constraint_type = 'PRIMARY KEY'
        ORDER BY kcu.ordinal_position
      `, table_schema, table_name);
      
      if (primaryKeys.length > 0) {
        const pkColumns = primaryKeys.map(pk => pk.column_name).join(', ');
        sql.push(`ALTER TABLE ${fullTableName} ADD PRIMARY KEY (${pkColumns});\n`);
      }
    }
    
    // 2. 导出外键约束
    console.log('📋 步骤 2: 导出外键约束...');
    const foreignKeys = await prisma.$queryRawUnsafe(`
      SELECT
        tc.table_schema,
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc
        ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema IN ('public', 'oms', 'tms', 'wms')
      ORDER BY tc.table_schema, tc.table_name, tc.constraint_name
    `);
    
    console.log(`   找到 ${foreignKeys.length} 个外键约束\n`);
    
    const fkGroups = {};
    for (const fk of foreignKeys) {
      const key = `${fk.table_schema}.${fk.table_name}.${fk.constraint_name}`;
      if (!fkGroups[key]) {
        fkGroups[key] = {
          schema: fk.table_schema,
          table: fk.table_name,
          constraint: fk.constraint_name,
          columns: [],
          foreign_schema: fk.foreign_table_schema,
          foreign_table: fk.foreign_table_name,
          foreign_columns: [],
          update_rule: fk.update_rule,
          delete_rule: fk.delete_rule
        };
      }
      fkGroups[key].columns.push(fk.column_name);
      fkGroups[key].foreign_columns.push(fk.foreign_column_name);
    }
    
    sql.push('-- ============================================');
    sql.push('-- 外键约束');
    sql.push('-- ============================================\n');
    
    for (const fk of Object.values(fkGroups)) {
      const tableName = `${fk.schema}.${fk.table}`;
      const foreignTable = `${fk.foreign_schema}.${fk.foreign_table}`;
      const columns = fk.columns.join(', ');
      const foreignColumns = fk.foreign_columns.join(', ');
      
      sql.push(`ALTER TABLE ${tableName}`);
      sql.push(`  ADD CONSTRAINT ${fk.constraint}`);
      sql.push(`  FOREIGN KEY (${columns})`);
      sql.push(`  REFERENCES ${foreignTable} (${foreignColumns})`);
      sql.push(`  ON UPDATE ${fk.update_rule}`);
      sql.push(`  ON DELETE ${fk.delete_rule};`);
      sql.push('');
    }
    
    // 3. 导出唯一约束
    console.log('📋 步骤 3: 导出唯一约束...');
    const uniqueConstraints = await prisma.$queryRawUnsafe(`
      SELECT
        tc.table_schema,
        tc.table_name,
        tc.constraint_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema IN ('public', 'oms', 'tms', 'wms')
        AND tc.constraint_name NOT LIKE '%_pkey'
      GROUP BY tc.table_schema, tc.table_name, tc.constraint_name
      ORDER BY tc.table_schema, tc.table_name, tc.constraint_name
    `);
    
    console.log(`   找到 ${uniqueConstraints.length} 个唯一约束\n`);
    
    sql.push('-- ============================================');
    sql.push('-- 唯一约束');
    sql.push('-- ============================================\n');
    
    for (const uc of uniqueConstraints) {
      const tableName = `${uc.table_schema}.${uc.table_name}`;
      sql.push(`ALTER TABLE ${tableName}`);
      sql.push(`  ADD CONSTRAINT ${uc.constraint_name}`);
      sql.push(`  UNIQUE (${uc.columns});`);
      sql.push('');
    }
    
    // 4. 导出 CHECK 约束
    console.log('📋 步骤 4: 导出 CHECK 约束...');
    const checkConstraints = await prisma.$queryRawUnsafe(`
      SELECT
        tc.table_schema,
        tc.table_name,
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.check_constraints AS cc
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.constraint_type = 'CHECK'
        AND tc.table_schema IN ('public', 'oms', 'tms', 'wms')
      ORDER BY tc.table_schema, tc.table_name, tc.constraint_name
    `);
    
    console.log(`   找到 ${checkConstraints.length} 个 CHECK 约束\n`);
    
    sql.push('-- ============================================');
    sql.push('-- CHECK 约束');
    sql.push('-- ============================================\n');
    
    for (const cc of checkConstraints) {
      const tableName = `${cc.table_schema}.${cc.table_name}`;
      sql.push(`ALTER TABLE ${tableName}`);
      sql.push(`  ADD CONSTRAINT ${cc.constraint_name}`);
      sql.push(`  CHECK (${cc.check_clause});`);
      sql.push('');
    }
    
    // 5. 导出索引
    console.log('📋 步骤 5: 导出索引...');
    const indexes = await prisma.$queryRawUnsafe(`
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname IN ('public', 'oms', 'tms', 'wms')
        AND indexname NOT LIKE '%_pkey'
        AND indexname NOT LIKE '%_fkey'
      ORDER BY schemaname, tablename, indexname
    `);
    
    console.log(`   找到 ${indexes.length} 个索引\n`);
    
    sql.push('-- ============================================');
    sql.push('-- 索引');
    sql.push('-- ============================================\n');
    
    for (const idx of indexes) {
      sql.push(`-- 索引: ${idx.indexname} on ${idx.schemaname}.${idx.tablename}`);
      sql.push(`${idx.indexdef};`);
      sql.push('');
    }
    
    // 6. 导出触发器函数
    console.log('📋 步骤 6: 导出触发器函数...');
    const functions = await prisma.$queryRawUnsafe(`
      SELECT
        routine_schema,
        routine_name,
        routine_definition
      FROM information_schema.routines
      WHERE routine_schema IN ('public', 'oms', 'tms', 'wms')
        AND routine_type = 'FUNCTION'
      ORDER BY routine_schema, routine_name
    `);
    
    console.log(`   找到 ${functions.length} 个函数\n`);
    
    sql.push('-- ============================================');
    sql.push('-- 触发器函数');
    sql.push('-- ============================================\n');
    
    for (const func of functions) {
      sql.push(`-- 函数: ${func.routine_schema}.${func.routine_name}`);
      sql.push(`CREATE OR REPLACE FUNCTION ${func.routine_schema}.${func.routine_name}()`);
      sql.push(`RETURNS TRIGGER AS $$`);
      sql.push(func.routine_definition);
      sql.push(`$$ LANGUAGE plpgsql;`);
      sql.push('');
    }
    
    // 7. 导出触发器
    console.log('📋 步骤 7: 导出触发器...');
    const triggers = await prisma.$queryRawUnsafe(`
      SELECT
        trigger_schema,
        trigger_name,
        event_object_schema,
        event_object_table,
        action_timing,
        event_manipulation,
        action_statement
      FROM information_schema.triggers
      WHERE trigger_schema IN ('public', 'oms', 'tms', 'wms')
      ORDER BY trigger_schema, event_object_table, trigger_name
    `);
    
    console.log(`   找到 ${triggers.length} 个触发器\n`);
    
    sql.push('-- ============================================');
    sql.push('-- 触发器');
    sql.push('-- ============================================\n');
    
    for (const trg of triggers) {
      const tableName = `${trg.event_object_schema}.${trg.event_object_table}`;
      sql.push(`-- 触发器: ${trg.trigger_name} on ${tableName}`);
      sql.push(`CREATE TRIGGER ${trg.trigger_name}`);
      sql.push(`  ${trg.action_timing} ${trg.event_manipulation}`);
      sql.push(`  ON ${tableName}`);
      sql.push(`  FOR EACH ROW`);
      sql.push(`  EXECUTE FUNCTION ${trg.action_statement.replace('EXECUTE FUNCTION ', '')};`);
      sql.push('');
    }
    
    // 8. 导出序列（Sequence）
    console.log('📋 步骤 8: 导出序列...');
    const sequences = await prisma.$queryRawUnsafe(`
      SELECT
        sequence_schema,
        sequence_name,
        data_type,
        numeric_precision,
        start_value,
        minimum_value,
        maximum_value,
        increment
      FROM information_schema.sequences
      WHERE sequence_schema IN ('public', 'oms', 'tms', 'wms')
      ORDER BY sequence_schema, sequence_name
    `);
    
    console.log(`   找到 ${sequences.length} 个序列\n`);
    
    sql.push('-- ============================================');
    sql.push('-- 序列（Sequence）');
    sql.push('-- ============================================\n');
    
    for (const seq of sequences) {
      sql.push(`-- 序列: ${seq.sequence_schema}.${seq.sequence_name}`);
      sql.push(`CREATE SEQUENCE IF NOT EXISTS ${seq.sequence_schema}.${seq.sequence_name}`);
      sql.push(`  AS ${seq.data_type}`);
      sql.push(`  START WITH ${seq.start_value}`);
      sql.push(`  INCREMENT BY ${seq.increment}`);
      sql.push(`  MINVALUE ${seq.minimum_value}`);
      sql.push(`  MAXVALUE ${seq.maximum_value};`);
      sql.push('');
    }
    
    // 保存文件
    const outputPath = path.join(__dirname, '../../database_schema_backup.sql');
    fs.writeFileSync(outputPath, sql.join('\n'), 'utf-8');
    
    console.log('='.repeat(80));
    console.log('✅ 数据库结构备份完成！');
    console.log(`📄 文件保存位置: ${outputPath}`);
    console.log(`📊 总行数: ${sql.length} 行`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ 导出失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

exportSchema().catch(console.error);

