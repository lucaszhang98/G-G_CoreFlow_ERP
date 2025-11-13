/**
 * 使用 SchemaSpy 生成数据库文档
 * 从 .env 文件读取 DATABASE_URL
 * 
 * 使用方法:
 *   npm run schemaspy
 *   或
 *   node scripts/generate_schemaspy.js
 * 
 * 环境变量（可选）:
 *   SCHEMASPY_JAR - SchemaSpy jar 文件路径
 *   SCHEMASPY_OUTPUT - 输出目录路径（默认: ../../schemaspy_output）
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

console.log('📊 使用 SchemaSpy 生成数据库文档...\n');
console.log('='.repeat(80));

async function generateSchemaSpy() {
  try {
    // 1. 读取 DATABASE_URL
    let databaseUrl = process.env.DATABASE_URL;
    
    // 如果没有从环境变量获取到，尝试手动读取 .env 文件
    if (!databaseUrl) {
      const envPath = path.join(__dirname, '../.env.local');
      const envPath2 = path.join(__dirname, '../.env');
      
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/DATABASE_URL=(.+)/);
        if (match) databaseUrl = match[1].trim().replace(/^["']|["']$/g, ''); // 移除引号
      } else if (fs.existsSync(envPath2)) {
        const envContent = fs.readFileSync(envPath2, 'utf8');
        const match = envContent.match(/DATABASE_URL=(.+)/);
        if (match) databaseUrl = match[1].trim().replace(/^["']|["']$/g, ''); // 移除引号
      }
    }
    
    if (!databaseUrl) {
      console.error('❌ 未找到 DATABASE_URL');
      console.error('   请确保 .env 或 .env.local 文件中有 DATABASE_URL');
      process.exit(1);
    }

    // 2. 解析数据库连接信息
    // postgresql://user:password@host:port/database?sslmode=require
    const url = new URL(databaseUrl.replace('postgresql://', 'http://'));
    const dbUser = url.username;
    const dbPass = url.password;
    const dbHost = url.hostname;
    const dbPort = url.port || '5432';
    const dbName = url.pathname.replace('/', '').split('?')[0];

    console.log('📋 数据库信息:');
    console.log(`   主机: ${dbHost}`);
    console.log(`   端口: ${dbPort}`);
    console.log(`   数据库: ${dbName}`);
    console.log(`   用户: ${dbUser}`);
    console.log('');

    // 3. 查找 SchemaSpy jar 文件
    let schemaspyJar = null;
    let postgresJdbc = null;
    
    // 优先使用环境变量指定的路径
    if (process.env.SCHEMASPY_JAR && fs.existsSync(process.env.SCHEMASPY_JAR)) {
      schemaspyJar = process.env.SCHEMASPY_JAR;
      const jarDir = path.dirname(schemaspyJar);
      const jdbcFiles = fs.readdirSync(jarDir).filter(f => f.includes('postgresql') && f.endsWith('.jar'));
      if (jdbcFiles.length > 0) {
        postgresJdbc = path.join(jarDir, jdbcFiles[0]);
      }
    }
    
    // 如果环境变量没指定，尝试自动查找
    if (!schemaspyJar) {
      const possiblePaths = [
        path.join(__dirname, '../schemaspy'),  // web/schemaspy (当前项目)
        path.join(__dirname, '../../schemaspy'),  // 项目根目录
        path.join(__dirname, '../../../schemaspy'),  // 上一级目录
        path.join(process.env.HOME || '', 'schemaspy'),  // 用户目录
        './schemaspy',  // 当前目录
      ];
      
      // 查找 SchemaSpy jar 文件
      for (const dir of possiblePaths) {
        if (fs.existsSync(dir)) {
          try {
            const files = fs.readdirSync(dir);
            const jarFile = files.find(f => f.startsWith('schemaspy') && f.endsWith('.jar'));
            const jdbcFile = files.find(f => f.includes('postgresql') && f.endsWith('.jar'));
            
            if (jarFile && jdbcFile) {
              schemaspyJar = path.join(dir, jarFile);
              postgresJdbc = path.join(dir, jdbcFile);
              break;
            }
          } catch (e) {
            // 忽略错误，继续查找
          }
        }
      }
      
      // 如果还没找到，尝试递归搜索
      if (!schemaspyJar) {
        const searchPaths = [
          path.join(__dirname, '../..'),
          process.cwd(),
        ];
        
        for (const searchPath of searchPaths) {
          try {
            const files = fs.readdirSync(searchPath, { recursive: true });
            const jarFile = files.find(f => typeof f === 'string' && f.includes('schemaspy') && f.endsWith('.jar'));
            const jdbcFile = files.find(f => typeof f === 'string' && f.includes('postgresql') && f.endsWith('.jar'));
            
            if (jarFile && jdbcFile) {
              schemaspyJar = path.isAbsolute(jarFile) ? jarFile : path.join(searchPath, jarFile);
              postgresJdbc = path.isAbsolute(jdbcFile) ? jdbcFile : path.join(searchPath, jdbcFile);
              break;
            }
          } catch (e) {
            // 忽略错误，继续查找
          }
        }
      }
    }
    
    // 检查文件是否存在
    if (!schemaspyJar || !fs.existsSync(schemaspyJar)) {
      console.error('❌ 未找到 SchemaSpy jar 文件');
      console.error('   请确保 SchemaSpy 已安装，并在以下位置之一：');
      console.error('   - 项目根目录/schemaspy/');
      console.error('   - ~/schemaspy/');
      console.error('   或者设置环境变量 SCHEMASPY_JAR 指向 jar 文件路径');
      process.exit(1);
    }
    
    if (!postgresJdbc || !fs.existsSync(postgresJdbc)) {
      console.error('❌ 未找到 PostgreSQL JDBC 驱动');
      console.error('   请确保 PostgreSQL JDBC jar 文件与 SchemaSpy 在同一目录');
      process.exit(1);
    }
    
    // 转换为绝对路径
    schemaspyJar = path.resolve(schemaspyJar);
    postgresJdbc = path.resolve(postgresJdbc);
    
    console.log(`📦 SchemaSpy: ${schemaspyJar}`);
    console.log(`📦 JDBC 驱动: ${postgresJdbc}`);
    
    // 4. 设置输出目录（使用绝对路径）
    // 输出到 web/schemaspy/output/ 子目录下（避免与 jar 文件混在一起）
    const outputDir = process.env.SCHEMASPY_OUTPUT 
      ? path.resolve(process.env.SCHEMASPY_OUTPUT)
      : path.resolve(__dirname, '../schemaspy/output');
    
    // 创建输出目录
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    console.log(`📁 输出目录: ${outputDir}`);
    console.log('');

    // 5. 构建并执行 SchemaSpy 命令
    console.log('🚀 开始生成数据库文档...\n');

    // 确保所有路径都是绝对路径，避免路径中的特殊字符（如 &）导致问题
    const schemaspyJarAbs = path.resolve(schemaspyJar);
    const postgresJdbcAbs = path.resolve(postgresJdbc);
    const outputDirAbs = path.resolve(outputDir);

    // SchemaSpy 6.2.4 使用 -schemas 参数（不是 -s）
    // 格式: -schemas "public,oms,tms,wms"
    const schemas = ['public', 'oms', 'tms', 'wms'];
    
    const commandArgs = [
      'java',
      '-jar', schemaspyJarAbs,
      '-t', 'pgsql',
      '-host', dbHost,
      '-port', dbPort,
      '-db', dbName,
      '-u', dbUser,
      '-p', dbPass,
      '-schemas', schemas.join(','),  // 使用 -schemas 参数（之前成功的方式）
      '-o', outputDirAbs,
      '-dp', postgresJdbcAbs,
      '-imageformat', 'svg',  // 使用 SVG 格式（之前成功的方式）
      '-vizjs',  // 使用 viz.js 渲染（之前成功的方式）
      '-noads'  // 无广告
    ];

    console.log('执行命令:');
    const commandDisplay = commandArgs.map((arg, i) => {
      // 隐藏密码
      if (i > 0 && commandArgs[i - 1] === '-p') {
        return '***';
      }
      return arg;
    }).join(' ');
    console.log(`  ${commandDisplay}\n`);

    // 执行 SchemaSpy
    // 注意：使用引号包裹路径，避免路径中的特殊字符（如 &）导致 shell 解析错误
    const command = commandArgs.map(arg => {
      // 如果参数包含空格或特殊字符，用引号包裹
      if (arg.includes(' ') || arg.includes('&') || arg.includes('(') || arg.includes(')')) {
        return `"${arg.replace(/"/g, '\\"')}"`;
      }
      return arg;
    }).join(' ');

    // SchemaSpy 会把所有日志输出到 stderr，即使成功也可能返回非零退出码
    // 所以我们需要捕获输出，然后检查是否真的失败了
    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    
    try {
      const result = await execAsync(command, {
        cwd: path.join(__dirname, '../..'),
        env: { ...process.env },
        shell: true
      });
      stdout = result.stdout || '';
      stderr = result.stderr || '';
    } catch (error) {
      // execAsync 在非零退出码时会抛出异常，但 SchemaSpy 的输出在 error.stdout 中
      stdout = error.stdout || '';
      stderr = error.stderr || '';
      exitCode = error.code || 1;
    }

    // 显示输出（SchemaSpy 的日志通常在 stdout 中）
    if (stdout) {
      console.log(stdout);
    }
    
    // 显示所有 stderr 输出（SchemaSpy 会把日志输出到 stderr）
    if (stderr) {
      // 先显示所有 stderr，帮助调试
      console.log('\n--- SchemaSpy 输出 ---');
      console.log(stderr);
      console.log('--- 结束 ---\n');
      
      // 过滤掉一些可以忽略的警告
      const ignorePatterns = [
        'WARN',
        'Failed to retrieve comment',
        'Failed to retrieve stored procedure',
        'Empty schema'
      ];
      
      const lines = stderr.split('\n');
      const importantErrors = lines.filter(line => {
        if (!line.trim()) return false;
        // 如果包含 ERROR 但不包含可忽略的模式，才显示
        if (line.includes('ERROR') && !ignorePatterns.some(pattern => line.includes(pattern))) {
          return true;
        }
        return false;
      });
      
      if (importantErrors.length > 0) {
        console.log('\n⚠️  重要错误信息:');
        importantErrors.forEach(line => console.log(`   ${line}`));
      }
    }

    // 检查输出目录是否有文件生成（这是判断是否成功的标准）
    const indexHtmlPath = path.join(outputDirAbs, 'index.html');
    const hasOutput = fs.existsSync(indexHtmlPath);
    
    if (hasOutput) {
      console.log('\n' + '='.repeat(80));
      console.log('✅ 数据库文档生成成功！');
      console.log(`📁 输出目录: ${outputDirAbs}/`);
      console.log(`🌐 打开文件: ${outputDirAbs}/index.html`);
      console.log('='.repeat(80));
      console.log('\n💡 提示: 在浏览器中打开 index.html 查看 ER 图');
    } else {
      console.error('\n' + '='.repeat(80));
      console.error('❌ 生成失败: 未找到输出文件');
      console.error(`   期望的文件: ${indexHtmlPath}`);
      console.error(`   输出目录内容: ${outputDirAbs}`);
      console.error('='.repeat(80));
      
      // 列出输出目录中的文件，帮助调试
      try {
        const files = fs.readdirSync(outputDirAbs);
        console.error(`\n输出目录中的文件/文件夹:`);
        files.forEach(file => {
          const filePath = path.join(outputDirAbs, file);
          const stat = fs.statSync(filePath);
          console.error(`  ${stat.isDirectory() ? '[目录]' : '[文件]'} ${file}`);
        });
      } catch (e) {
        console.error(`\n无法读取输出目录: ${e.message}`);
      }
      
      if (stderr) {
        console.error('\n详细错误信息（stderr）:');
        console.error(stderr);
      }
      if (stdout) {
        console.error('\n详细输出信息（stdout）:');
        console.error(stdout);
      }
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ 执行失败:', error.message);
    if (error.stdout) {
      console.error('输出:', error.stdout);
    }
    if (error.stderr) {
      console.error('错误:', error.stderr);
    }
    process.exit(1);
  }
}

generateSchemaSpy();
