// 消费分类数据 - 二级分类体系
export interface Category {
  name: string
  icon: string
  children: { name: string }[]
}

export const categories: Category[] = [
  {
    name: '餐饮饮食',
    icon: '🍜',
    children: [
      { name: '🥚早餐' },
      { name: '🍚午餐' },
      { name: '🍜晚餐' },
      { name: '🧋奶茶' },
      { name: '🍟零食' },
      { name: '🥤饮料' },
      { name: '🍎水果' },
      { name: '🥡外卖' },
      { name: '🍳买菜' },
    ],
  },
  {
    name: '交通出行',
    icon: '🚗',
    children: [
      { name: '🚇地铁' },
      { name: '🚌公交' },
      { name: '🚕出租车' },
      { name: '🚗网约车' },
      { name: '🚄火车高铁' },
      { name: '✈️飞机机票' },
      { name: '⛽️加油' },
      { name: '🔋充电' },
      { name: '🅿️停车费' },
    ],
  },
  {
    name: '购物消费',
    icon: '🛒',
    children: [
      { name: '👔服饰鞋包' },
      { name: '📱数码产品' },
      { name: '🪑家居用品' },
      { name: '💄美妆护肤' },
      { name: '🏬日用百货' },
    ],
  },
  {
    name: '住房居家',
    icon: '🏠',
    children: [
      { name: '🚪房租' },
      { name: '🏡房贷' },
      { name: '🧹物业费' },
      { name: '🚰水费' },
      { name: '🔋电费' },
      { name: '🧰维修保养' },
    ],
  },
  {
    name: '娱乐休闲',
    icon: '🎮',
    children: [
      { name: '🎬电影' },
      { name: '🎤演出' },
      { name: '🏊运动健身' },
      { name: '🎮游戏充值' },
      { name: '⛱️旅游度假' },
      { name: '🐈‍⬛宠物开销' },
    ],
  },
  {
    name: '医疗健康',
    icon: '🏥',
    children: [
      { name: '🧑‍⚕️看病' },
      { name: '💊买药' },
      { name: '🩻体检' },
      { name: '🦷口腔' },
      { name: '👓眼镜' },
    ],
  },
  {
    name: '教育学习',
    icon: '📚',
    children: [
      { name: '📖书籍资料' },
      { name: '👩‍🏫培训课程' },
      { name: '📃考试报名' },
      { name: '✏️文具用品' },
      { name: '🤖AI订阅' },
    ],
  },
  {
    name: '人情社交',
    icon: '🎁',
    children: [
      { name: '🎁请客送礼' },
      { name: '🧧红包礼金' },
      { name: '🥳聚会聚餐' },
    ],
  },
  {
    name: '通讯网络',
    icon: '📱',
    children: [
      { name: '📲手机话费' },
      { name: '🛜宽带网络' },
      { name: '🆙会员订阅' },
    ],
  },
  {
    name: '金融保险',
    icon: '💰',
    children: [
      { name: '💲手续费' },
      { name: '🧑‍💼保险费' },
      { name: '🏦贷款利息' },
    ],
  },
  {
    name: '其他支出',
    icon: '📦',
    children: [
      { name: '🚚快递物流' },
      { name: '➕其他杂项' },
    ],
  },
]

// 支付方式（默认种子；正式数据在 payment_methods 表）
export const DEFAULT_PAYMENT_METHODS = [
  { name: '支付宝', icon: '🔵' },
  { name: '微信', icon: '💬' },
  { name: '银行卡', icon: '💳' },
  { name: '现金', icon: '💴' },
] as const

// 收支类型（默认种子；正式数据在 tx_types 表）。value 即记录里存的 code
export const DEFAULT_TX_TYPES = [
  { name: '支出', value: 'expense', icon: '💸', category: 'expense' },
  { name: '收入', value: 'income', icon: '💰', category: 'income' },
  { name: '不计', value: 'ignore', icon: '⏭️', category: 'ignore' },
] as const

// 向后兼容别名（Context 兜底 / 种子数据源用）
export const PAYMENT_METHODS = DEFAULT_PAYMENT_METHODS
export const TRANSACTION_TYPES = DEFAULT_TX_TYPES

// 找到所有二级分类的列表（用于下拉选择等）
export function getAllSubCategories(): { l1: string; l2: string }[] {
  const result: { l1: string; l2: string }[] = []
  for (const cat of categories) {
    for (const child of cat.children) {
      result.push({ l1: cat.name, l2: child.name })
    }
  }
  return result
}

// 预设为非日常的小类名称（固定开销，无法通过消费习惯控制）。
// ⚠️ 必须用 categories.ts 里的真实小类名（含 emoji 前缀），否则匹配不上。
// 用于：新装播种时写入默认值 + 老库首次迁移时按名称回填。
export const NON_DAILY_DEFAULT_NAMES = new Set([
  '🚪房租', '🏡房贷', '🧹物业费', '🚰水费', '🔋电费',
  '📲手机话费', '🛜宽带网络',
  '🧑‍💼保险费', '🏦贷款利息',
])
