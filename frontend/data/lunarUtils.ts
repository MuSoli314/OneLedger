// 农历 / 节气 / 传统节日 / 法定节假日工具（基于 lunar-javascript，纯本地计算，无需联网）
// 大厂日历通用规则：同一格子里 节日 > 节气 > 农历日；法定节假日红色、节气绿色、农历灰色；
// 调休上班日显示「班」。
import { Solar, HolidayUtil } from 'lunar-javascript'

export type LunarKind = 'festival' | 'jieqi' | 'lunar' | 'work'

export interface DayExtra {
  /** 小字行主文本：节日名 / 节气名 / 农历日 / 「班」 */
  text: string
  kind: LunarKind
}

const cache = new Map<string, DayExtra>()

/**
 * 某天（YYYY-MM-DD）在日历格子里要显示的农历小字：
 * 1. 法定节假日（国务院放假安排）：休假日显示节日名（红），调休上班日显示「班」（灰）
 * 2. 传统节日（除夕/春节/端午/中秋等）：红色节日名
 * 3. 节气（立春/冬至等）：绿色节气名
 * 4. 其余：农历日（初一/十五…，灰色）
 */
export function getDayExtra(date: string): DayExtra {
  const cached = cache.get(date)
  if (cached) return cached

  const [y, m, d] = date.split('-').map(Number)
  const lunar = Solar.fromYmd(y, m, d).getLunar()
  let result: DayExtra

  const holiday = HolidayUtil.getHoliday(y, m, d)
  if (holiday) {
    if (holiday.isWork()) {
      // 调休上班日（法定假日的周六日补班）
      result = { text: '班', kind: 'work' }
    } else {
      // 法定休假日：优先显示当天自己的传统节日名（如除夕），否则显示法定假日名（如春节/国庆节）
      const festivals = lunar.getFestivals()
      const own = festivals.find((f) => holiday.getName().includes(f))
      result = { text: own ?? holiday.getName(), kind: 'festival' }
    }
  } else {
    const festivals = lunar.getFestivals()
    if (festivals.length > 0) {
      result = { text: festivals[0], kind: 'festival' }
    } else {
      const jieqi = lunar.getJieQi()
      if (jieqi) {
        result = { text: jieqi, kind: 'jieqi' }
      } else {
        result = { text: lunar.getDayInChinese(), kind: 'lunar' }
      }
    }
  }

  cache.set(date, result)
  return result
}
