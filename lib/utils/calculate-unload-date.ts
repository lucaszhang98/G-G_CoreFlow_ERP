/**
 * 计算拆柜日期（完全按照 Excel 公式逻辑）
 * 
 * Excel 公式：
 * =IF(F1458>0,F1458+1,If(D1458>0,D1458+If(WEEKDAY(D1458)=2,7,0)+If(WEEKDAY(D1458)=3,7,0)+If(WEEKDAY(D1458)=4,7,0)+If(WEEKDAY(D1458)=5,6,0)+If(WEEKDAY(D1458)=6,6,0)+If(WEEKDAY(D1458)=7,5,0)+If(WEEKDAY(D1458)=1,5,0),""))
 * 
 * 逻辑：
 * 1. 如果提柜日期(pickup_date) > 0，则拆柜日期 = 提柜日期 + 1天
 * 2. 否则如果到港日期(eta_date) > 0，则拆柜日期 = 到港日期 + 根据星期几加的天数
 *    - 周一(WEEKDAY=2): +7天
 *    - 周二(WEEKDAY=3): +7天
 *    - 周三(WEEKDAY=4): +7天
 *    - 周四(WEEKDAY=5): +6天
 *    - 周五(WEEKDAY=6): +6天
 *    - 周六(WEEKDAY=7): +5天
 *    - 周日(WEEKDAY=1): +5天
 * 3. 否则返回 null
 */

/**
 * 计算拆柜日期
 * @param pickupDate 提柜日期 (Date | string | null)
 * @param etaDate 到港日期 (Date | string | null)
 * @returns 拆柜日期 (Date | null)
 */
export function calculateUnloadDate(
  pickupDate: Date | string | null | undefined,
  etaDate: Date | string | null | undefined
): Date | null {
  // 转换提柜日期
  let pickup: Date | null = null;
  if (pickupDate) {
    if (typeof pickupDate === 'string') {
      const parsed = new Date(pickupDate);
      if (!isNaN(parsed.getTime())) {
        pickup = parsed;
      }
    } else if (pickupDate instanceof Date) {
      pickup = pickupDate;
    }
  }

  // 转换到港日期
  let eta: Date | null = null;
  if (etaDate) {
    if (typeof etaDate === 'string') {
      const parsed = new Date(etaDate);
      if (!isNaN(parsed.getTime())) {
        eta = parsed;
      }
    } else if (etaDate instanceof Date) {
      eta = etaDate;
    }
  }

  // 第一优先级：如果有提柜日期，则拆柜日期 = 提柜日期 + 1天
  if (pickup) {
    const unloadDate = new Date(pickup);
    unloadDate.setDate(unloadDate.getDate() + 1);
    return unloadDate;
  }

  // 第二优先级：如果只有到港日期，则根据星期几计算
  if (eta) {
    // Excel WEEKDAY 函数返回：1=周日, 2=周一, 3=周二, 4=周三, 5=周四, 6=周五, 7=周六
    // JavaScript getDay() 返回：0=周日, 1=周一, 2=周二, 3=周三, 4=周四, 5=周五, 6=周六
    // 需要转换：Excel WEEKDAY = JavaScript getDay() + 1 (但周日是特殊情况)
    const dayOfWeek = eta.getDay(); // 0=周日, 1=周一, ..., 6=周六
    const excelWeekday = dayOfWeek === 0 ? 1 : dayOfWeek + 1; // 转换为 Excel WEEKDAY 格式

    let daysToAdd = 0;
    switch (excelWeekday) {
      case 2: // 周一
        daysToAdd = 7;
        break;
      case 3: // 周二
        daysToAdd = 7;
        break;
      case 4: // 周三
        daysToAdd = 7;
        break;
      case 5: // 周四
        daysToAdd = 6;
        break;
      case 6: // 周五
        daysToAdd = 6;
        break;
      case 7: // 周六
        daysToAdd = 5;
        break;
      case 1: // 周日
        daysToAdd = 5;
        break;
      default:
        daysToAdd = 0;
    }

    const unloadDate = new Date(eta);
    unloadDate.setDate(unloadDate.getDate() + daysToAdd);
    return unloadDate;
  }

  // 如果都没有，返回 null
  return null;
}

