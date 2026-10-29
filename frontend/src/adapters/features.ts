/**
 * 特征提取：把中文回答切成可统计的离散特征。
 *
 * 设计取舍：不引入分词库（离线、零依赖），中文用字符 bigram，
 * 英文按 token，数字单独成特；否定用法用「否定词 + 后续窗口」标记，
 * 使「类别不平衡」与「不是类别不平衡」落到不同特征上。
 */

/** 多字否定词。单字「不」不算否定词，否则「不平衡」会被误伤 */
const NEGATORS = [
  '不是',
  '不算',
  '并非',
  '没有',
  '不属于',
  '不认为',
  '不觉得',
  '不太',
  '不够',
  '不存在',
  '不应该',
  '不能',
  '不会',
  '没能',
]

/** 否定词影响范围：从否定词结束位置起往后 8 个字符 */
const NEG_SPAN = 8

/** 几乎不携带语义的 bigram，直接丢弃以减少噪音 */
const STOP_BIGRAMS = new Set([
  '这个',
  '那个',
  '这样',
  '那样',
  '什么',
  '怎么',
  '如何',
  '因为',
  '所以',
  '如果',
  '虽然',
  '但是',
  '可是',
  '就是',
  '也是',
  '还是',
  '可以',
  '可能',
  '应该',
  '需要',
  '一个',
  '一些',
  '时候',
  '我们',
  '你们',
  '他们',
  '感觉',
  '认为',
  '觉得',
  '的话',
])

/** 标点即语义边界：否定作用域不得跨越标点 */
const BOUNDARY = /[，。、；：！？,.;:!?\s]/

/** 所有否定词覆盖的字符区间 [start, end)，遇到标点立即截断 */
export function negatedRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  for (const n of NEGATORS) {
    let i = text.indexOf(n)
    while (i !== -1) {
      const from = i + n.length
      let end = Math.min(from + NEG_SPAN, text.length)
      for (let j = from; j < end; j++) {
        if (BOUNDARY.test(text[j])) {
          end = j
          break
        }
      }
      if (end > from) ranges.push([from, end])
      i = text.indexOf(n, i + 1)
    }
  }
  return ranges
}

function inRanges(ranges: Array<[number, number]>, pos: number): boolean {
  return ranges.some(([a, b]) => pos >= a && pos < b)
}

/**
 * 提取特征。返回的数组保留重复项（词袋模型按出现次数加权）。
 * 特征前缀：zh2#（中文 bigram）、zh1#（单字）、en#（英文）、num#（数字）、neg#（否定的 bigram）
 */
export function extractFeatures(text: string): string[] {
  const s = text.toLowerCase().trim()
  const out: string[] = []
  if (!s) return out

  for (const m of s.matchAll(/[a-z][a-z0-9-]{1,}/g)) {
    out.push('en#' + m[0])
  }

  for (const m of s.matchAll(/\d+(?:\.\d+)?%?/g)) {
    // 单个数字（如「99 比 1」里的 1）不携带语义，视为噪音丢弃
    if (m[0].length < 2) continue
    out.push('num#' + m[0])
  }

  const ranges = negatedRanges(s)

  for (const m of s.matchAll(/[\u4e00-\u9fa5]+/g)) {
    const seg = m[0]
    const base = m.index ?? 0
    if (seg.length === 1) {
      out.push('zh1#' + seg)
      continue
    }
    for (let i = 0; i < seg.length - 1; i++) {
      const bigram = seg.slice(i, i + 2)
      const pos = base + i
      const negated = inRanges(ranges, pos)
      if (!negated && STOP_BIGRAMS.has(bigram)) continue
      out.push((negated ? 'neg#' : 'zh2#') + bigram)
    }
  }

  return out
}

/** 把内部特征名转成可展示的文本 */
export function displayFeature(feature: string): string {
  const [prefix, ...rest] = feature.split('#')
  const body = rest.join('#')
  if (prefix === 'neg') return '¬' + body
  if (prefix === 'num') return body
  return body
}

/** 去重后的特征集合，用于统计覆盖率 */
export function uniqueFeatures(text: string): string[] {
  return [...new Set(extractFeatures(text))]
}
