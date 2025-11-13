import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

console.log('📊 生成数据库 ER 图...\n');
console.log('='.repeat(80));

async function generateERD() {
  try {
    // 1. 获取所有表
    const tables = await prisma.$queryRawUnsafe(`
      SELECT 
        table_schema,
        table_name
      FROM information_schema.tables
      WHERE table_schema IN ('public', 'oms', 'tms', 'wms')
        AND table_type = 'BASE TABLE'
      ORDER BY table_schema, table_name
    `);

    // 2. 获取所有外键关系
    const foreignKeys = await prisma.$queryRawUnsafe(`
      SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema IN ('public', 'oms', 'tms', 'wms')
      ORDER BY tc.table_schema, tc.table_name
    `);

    // 3. 生成 Mermaid ER 图
    const mermaid = [];
    mermaid.push('erDiagram');
    mermaid.push('');

    // 按 Schema 分组
    const schemaGroups = {};
    tables.forEach(table => {
      const schema = table.table_schema;
      if (!schemaGroups[schema]) {
        schemaGroups[schema] = [];
      }
      schemaGroups[schema].push(table.table_name);
    });

    // 生成表定义
    for (const [schema, tableNames] of Object.entries(schemaGroups)) {
      mermaid.push(`    %% ${schema.toUpperCase()} Schema`);
      for (const tableName of tableNames) {
        const fullName = `${schema}_${tableName}`;
        mermaid.push(`    ${fullName} {`);
        
        // 获取表字段
        const columns = await prisma.$queryRawUnsafe(`
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
          LIMIT 10
        `, schema, tableName);
        
        // 只显示前几个重要字段
        columns.slice(0, 5).forEach(col => {
          const nullable = col.is_nullable === 'YES' ? '' : ' "not null"';
          const type = col.data_type === 'bigint' ? 'bigint' : 
                      col.data_type === 'integer' ? 'int' :
                      col.data_type === 'character varying' ? 'varchar' :
                      col.data_type === 'timestamp with time zone' ? 'timestamptz' :
                      col.data_type === 'numeric' ? 'decimal' :
                      col.data_type.toLowerCase();
          mermaid.push(`        ${col.column_name} ${type}${nullable}`);
        });
        if (columns.length > 5) {
          mermaid.push(`        ... other fields ...`);
        }
        mermaid.push(`    }`);
        mermaid.push('');
      }
    }

    // 生成关系
    mermaid.push('    %% Relationships');
    const fkGroups = {};
    foreignKeys.forEach(fk => {
      const key = `${fk.table_schema}_${fk.table_name}||--o{${fk.foreign_table_schema}_${fk.foreign_table_name}`;
      if (!fkGroups[key]) {
        fkGroups[key] = [];
      }
      fkGroups[key].push(`${fk.column_name} : ${fk.foreign_column_name}`);
    });

    for (const [relation, details] of Object.entries(fkGroups)) {
      mermaid.push(`    ${relation} : "${details[0]}"`);
    }

    // 保存 Mermaid 文件
    const mermaidContent = mermaid.join('\n');
    const mermaidPath = path.join(__dirname, '../../database_erd.mmd');
    fs.writeFileSync(mermaidPath, mermaidContent, 'utf-8');
    
    console.log('✅ Mermaid ER 图已生成！');
    console.log(`📄 文件位置: ${mermaidPath}`);
    console.log('\n📋 查看方式:');
    console.log('1. 在线查看: https://mermaid.live/ (复制文件内容)');
    console.log('2. VS Code: 安装 Mermaid 插件');
    console.log('3. GitHub: 直接显示 .mmd 文件');

    // 4. 生成 DBML 格式（用于 dbdiagram.io）
    const dbml = [];
    dbml.push('// G&G CoreFlow ERP 数据库 ER 图');
    dbml.push('// 在线查看: https://dbdiagram.io/');
    dbml.push('');

    for (const [schema, tableNames] of Object.entries(schemaGroups)) {
      dbml.push(`// ${schema.toUpperCase()} Schema`);
      for (const tableName of tableNames) {
        dbml.push(`Table ${schema}_${tableName} {`);
        
        const columns = await prisma.$queryRawUnsafe(`
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = $1 AND table_name = $2
          ORDER BY ordinal_position
        `, schema, tableName);
        
        columns.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? '' : ' not null';
          const type = col.data_type === 'bigint' ? 'bigint' : 
                      col.data_type === 'integer' ? 'int' :
                      col.data_type === 'character varying' ? `varchar(${col.character_maximum_length || 255})` :
                      col.data_type === 'timestamp with time zone' ? 'timestamptz' :
                      col.data_type === 'numeric' ? 'decimal' :
                      col.data_type.toLowerCase();
          const defaultVal = col.column_default ? ` [default: ${col.column_default}]` : '';
          dbml.push(`  ${col.column_name} ${type}${nullable}${defaultVal}`);
        });
        
        dbml.push('}');
        dbml.push('');
      }
    }

    // 添加关系
    dbml.push('// Relationships');
    for (const fk of foreignKeys) {
      const table1 = `${fk.table_schema}_${fk.table_name}`;
      const table2 = `${fk.foreign_table_schema}_${fk.foreign_table_name}`;
      dbml.push(`Ref: ${table1}.${fk.column_name} > ${table2}.${fk.foreign_column_name}`);
    }

    const dbmlContent = dbml.join('\n');
    const dbmlPath = path.join(__dirname, '../../database_erd.dbml');
    fs.writeFileSync(dbmlPath, dbmlContent, 'utf-8');
    
    console.log('\n✅ DBML ER 图已生成！');
    console.log(`📄 文件位置: ${dbmlPath}`);
    console.log('🌐 在线查看: https://dbdiagram.io/ (导入此文件)');

    // 5. 生成简化的关系图（Markdown 格式）
    const markdown = [];
    markdown.push('# 数据库 ER 图');
    markdown.push('');
    markdown.push('## 表关系图');
    markdown.push('');
    markdown.push('```mermaid');
    markdown.push(mermaidContent);
    markdown.push('```');
    markdown.push('');
    markdown.push('## 表列表');
    markdown.push('');
    for (const [schema, tableNames] of Object.entries(schemaGroups)) {
      markdown.push(`### ${schema.toUpperCase()} Schema (${tableNames.length} 表)`);
      tableNames.forEach(tableName => {
        markdown.push(`- \`${schema}.${tableName}\``);
      });
      markdown.push('');
    }
    markdown.push('## 关系列表');
    markdown.push('');
    for (const fk of foreignKeys) {
      markdown.push(`- \`${fk.table_schema}.${fk.table_name}.${fk.column_name}\` → \`${fk.foreign_table_schema}.${fk.foreign_table_name}.${fk.foreign_column_name}\``);
    }

    const markdownPath = path.join(__dirname, '../../database_erd.md');
    fs.writeFileSync(markdownPath, markdown.join('\n'), 'utf-8');
    
    console.log('\n✅ Markdown ER 图已生成！');
    console.log(`📄 文件位置: ${markdownPath}`);
    console.log('📖 可以在 GitHub 或支持 Mermaid 的 Markdown 查看器中查看');

    console.log('\n' + '='.repeat(80));
    console.log('✅ 所有 ER 图已生成完成！');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ 生成失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

generateERD().catch(console.error);

