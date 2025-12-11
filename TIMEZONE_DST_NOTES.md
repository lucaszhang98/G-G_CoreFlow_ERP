# 夏令时/冬令时处理说明

## ✅ **系统自动处理**

系统使用 `'America/Los_Angeles'` 时区标识符，**会自动处理夏令时/冬令时的切换**，无需手动干预。

---

## 📅 **时区规则**

### **PST (Pacific Standard Time) - 冬令时**
- **UTC 偏移**：UTC-8
- **生效时间**：通常在 11 月第一个星期日 02:00 到次年 3 月第二个星期日 02:00
- **示例**：2025-11-02 02:00 PDT → 2025-11-02 01:00 PST

### **PDT (Pacific Daylight Time) - 夏令时**
- **UTC 偏移**：UTC-7
- **生效时间**：通常在 3 月第二个星期日 02:00 到 11 月第一个星期日 02:00
- **示例**：2025-03-09 02:00 PST → 2025-03-09 03:00 PDT

---

## 🔧 **技术实现**

### **1. PostgreSQL 时区处理**

```sql
-- 在 SQL 查询中使用 AT TIME ZONE 转换时区
-- PostgreSQL 会根据日期自动应用正确的时区偏移（PST 或 PDT）
SELECT DATE(confirmed_start AT TIME ZONE 'America/Los_Angeles') 
FROM delivery_appointments
```

**工作原理：**
- PostgreSQL 的时区库包含完整的夏令时/冬令时规则
- 根据日期自动判断应该使用 PST 还是 PDT
- 无需手动指定，系统会自动处理

### **2. JavaScript 时区处理**

```typescript
// JavaScript 的 Intl API 也会自动处理夏令时/冬令时
const date = new Date()
const pstDate = date.toLocaleString('en-US', {
  timeZone: 'America/Los_Angeles'  // 自动处理 PST/PDT 切换
})
```

**工作原理：**
- JavaScript 的时区库（IANA Time Zone Database）包含完整的夏令时/冬令时规则
- 根据日期自动判断应该使用 PST 还是 PDT
- 无需手动指定，系统会自动处理

---

## 📝 **代码中的使用**

### **SQL 查询中的时区转换**

```typescript
// ✅ 正确：使用 AT TIME ZONE 转换时区
// PostgreSQL 会自动处理夏令时/冬令时的切换
await prisma.$queryRaw`
  SELECT * FROM delivery_appointments
  WHERE DATE(confirmed_start AT TIME ZONE 'America/Los_Angeles') = ${dateString}::DATE
`
```

### **日期字符串处理**

```typescript
// ✅ 正确：日期字符串不涉及时区，直接使用
const dateString = '2025-12-24'  // 纯日期，不涉及时区
await prisma.$queryRaw`
  WHERE DATE(planned_unload_at) = ${dateString}::DATE
`
```

---

## ⚠️ **注意事项**

### **1. 不要手动处理夏令时/冬令时**

```typescript
// ❌ 错误：不要手动计算时区偏移
const offset = isDST ? -7 : -8  // 不要这样做！

// ✅ 正确：让系统自动处理
WHERE DATE(confirmed_start AT TIME ZONE 'America/Los_Angeles') = ${date}::DATE
```

### **2. 时区标识符必须正确**

```typescript
// ✅ 正确：使用完整的时区标识符
'America/Los_Angeles'  // 包含完整的夏令时/冬令时规则

// ❌ 错误：不要使用简写
'PST'  // 不包含夏令时规则
'PDT'  // 不包含冬令时规则
```

### **3. 日期字段类型**

- **`@db.Date`**：纯日期，不包含时区信息，不需要时区转换
- **`@db.Timestamptz(6)`**：带时区的时间戳，需要使用 `AT TIME ZONE` 转换

---

## 🔍 **验证方法**

### **测试夏令时切换**

```sql
-- 测试 2025 年夏令时开始（3 月第二个星期日）
SELECT 
  '2025-03-09 01:59:00-08'::timestamptz AT TIME ZONE 'America/Los_Angeles' as before_dst,
  '2025-03-09 03:00:00-07'::timestamptz AT TIME ZONE 'America/Los_Angeles' as after_dst;

-- 测试 2025 年冬令时开始（11 月第一个星期日）
SELECT 
  '2025-11-02 01:59:00-07'::timestamptz AT TIME ZONE 'America/Los_Angeles' as before_std,
  '2025-11-02 01:00:00-08'::timestamptz AT TIME ZONE 'America/Los_Angeles' as after_std;
```

---

## 📚 **参考资源**

- [IANA Time Zone Database](https://www.iana.org/time-zones)
- [PostgreSQL Time Zone Documentation](https://www.postgresql.org/docs/current/datatype-datetime.html#DATATYPE-TIMEZONES)
- [JavaScript Intl API](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)

---

## ✅ **总结**

1. **系统自动处理**：使用 `'America/Los_Angeles'` 时区标识符，PostgreSQL 和 JavaScript 会自动处理夏令时/冬令时的切换
2. **无需手动干预**：不需要手动计算时区偏移或切换日期
3. **时区库维护**：时区规则由 IANA Time Zone Database 维护，系统会自动更新
4. **代码简洁**：只需使用 `AT TIME ZONE 'America/Los_Angeles'`，系统会自动处理所有细节

