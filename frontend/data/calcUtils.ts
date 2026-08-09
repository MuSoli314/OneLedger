// 金额表达式计算工具
// 支持 + - * / 与括号、小数，自动识别 × ÷ ＋ － ＊ 等常见全角/中文符号。
// 采用递归下降解析实现，不使用 eval，保证安全。
// 结果统一四舍五入到两位小数（与金额保存口径一致）。

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; value: string }

// 将全角/中文运算符归一化为半角
function normalize(input: string): string {
  return input
    .replace(/[×＊✕✖]/g, '*')
    .replace(/÷/g, '/')
    .replace(/＋/g, '+')
    .replace(/－/g, '-')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, '')
}

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if ('+-*/()'.includes(ch)) {
      tokens.push({ type: 'op', value: ch })
      i++
    } else if ((ch >= '0' && ch <= '9') || ch === '.') {
      let j = i
      let dots = 0
      while (j < input.length) {
        const c = input[j]
        if (c >= '0' && c <= '9') {
          j++
        } else if (c === '.') {
          dots++
          if (dots > 1) return null // 小数点只能出现一次
          j++
        } else {
          break
        }
      }
      const value = parseFloat(input.slice(i, j))
      if (isNaN(value)) return null
      tokens.push({ type: 'num', value })
      i = j
    } else {
      return null // 非法字符
    }
  }
  return tokens
}

// 递归下降解析器：优先级 括号/一元 > 乘除 > 加减
class Parser {
  private tokens: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parse(): number | null {
    const value = this.expr()
    if (value === null || this.pos !== this.tokens.length) return null
    return value
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private expr(): number | null {
    let left = this.term()
    if (left === null) return null
    while (this.peek()?.type === 'op' && (this.peek()!.value === '+' || this.peek()!.value === '-')) {
      const op = this.tokens[this.pos++].value
      const right = this.term()
      if (right === null) return null
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  private term(): number | null {
    let left = this.factor()
    if (left === null) return null
    while (this.peek()?.type === 'op' && (this.peek()!.value === '*' || this.peek()!.value === '/')) {
      const op = this.tokens[this.pos++].value
      const right = this.factor()
      if (right === null) return null
      if (op === '/') {
        if (right === 0) return null // 除零视为非法
        left /= right
      } else {
        left *= right
      }
    }
    return left
  }

  private factor(): number | null {
    const token = this.peek()
    if (!token) return null
    if (token.type === 'num') {
      this.pos++
      return token.value
    }
    if (token.type === 'op') {
      if (token.value === '(') {
        this.pos++
        const value = this.expr()
        if (value === null) return null
        if (this.peek()?.type === 'op' && this.peek()!.value === ')') {
          this.pos++
          return value
        }
        return null // 缺少右括号
      }
      if (token.value === '+' || token.value === '-') {
        // 一元正负号，如 -5+3 或 5*(-2)
        this.pos++
        const value = this.factor()
        if (value === null) return null
        return token.value === '-' ? -value : value
      }
    }
    return null
  }
}

/**
 * 计算金额表达式，成功返回四舍五入到两位小数的数值；非法（空、除零、语法错误等）返回 null。
 * 纯数字（如 "10.5"）同样视为合法并原样返回。
 */
export function evaluateExpression(input: string): number | null {
  const tokens = tokenize(normalize(input))
  if (!tokens || tokens.length === 0) return null
  const value = new Parser(tokens).parse()
  if (value === null || !isFinite(value)) return null
  return Math.round(value * 100) / 100
}
