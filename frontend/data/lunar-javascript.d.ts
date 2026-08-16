// lunar-javascript 的类型声明（npm 包未自带 types，这里按实际 API 声明本项目用到的部分）
declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar
    static fromDate(date: Date): Solar
    getLunar(): Lunar
  }

  export class Lunar {
    /** 农历日（初一、初二…三十） */
    getDayInChinese(): string
    /** 农历月（正月、二月…腊月） */
    getMonthInChinese(): string
    /** 干支年（甲子、乙丑…癸亥） */
    getYearInGanZhi(): string
    /** 生肖（鼠、牛…猪） */
    getYearShengXiao(): string
    /** 干支月（丙寅、丁卯…） */
    getMonthInGanZhi(): string
    /** 干支日（甲子、乙丑…） */
    getDayInGanZhi(): string
    /** 老黄历「宜」事项列表（嫁娶、祭祀…） */
    getDayYi(): string[]
    /** 老黄历「忌」事项列表（盖屋、安葬…） */
    getDayJi(): string[]
    /** 节气名（当天是节气时返回，否则返回空字符串） */
    getJieQi(): string
    /** 传统节日列表（除夕、春节、端午、中秋…） */
    getFestivals(): string[]
    /** 其他节日列表（母亲节、愚人节…） */
    getOtherFestivals(): string[]
  }

  export class Holiday {
    getName(): string
    isWork(): boolean
  }

  export const HolidayUtil: {
    /** 某天的法定节假日（国务院放假安排），非节假日返回 null */
    getHoliday(year: number, month: number, day: number): Holiday | null
    getHolidays(year: number, month: number): Holiday[]
    getHolidaysByTarget(year: number, month: number, day: number): Holiday[]
    /** 手动修正节假日数据（补录/修改某年安排） */
    fix(year: number, month: number, day: number, name: string, work?: boolean): void
  }
}
