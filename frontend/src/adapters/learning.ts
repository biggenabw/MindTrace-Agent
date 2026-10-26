export type StudentId = 'A' | 'B'

/** 诊断维度：概念 / 证据 / 行动 / 验证 */
export type Dimension = 'concept' | 'evidence' | 'action' | 'verification'

/** 诊断档位：1 未识别 → 4 命名原因且给出可验证改进 */
export type Level = 1 | 2 | 3 | 4

/** 命中的原文片段，start/end 为在原回答中的 UTF-16 下标 */
export type EvidenceSpan = {
  dimension: Dimension
  matched: string
  start: number
  end: number
}

export type EvidenceRecord = {
  id: string
  student: StudentId
  answer: string
  diagnosis: string
  level: Level
  feedback: string
  evidenceSpans: EvidenceSpan[]
  knowledgeRef: string
  source: 'current_local_session'
  mode: 'rule_baseline'
  createdAt: string
}

/** 与模板 key 区分，避免读到模板遗留数据 */
const KEY = 'mindtrace-skew-evidence-v1'

/** CASE 002：类别不平衡 / 准确率悖论 */
export const prompt =
  '信用卡欺诈检测模型整体准确率 99.2%，但测试集里 100 笔真实欺诈交易只识别出 8 笔。你认为发生了什么？如何确认并改进？'

export const caseMeta = {
  id: 'CASE 002',
  field: 'FRAUD DETECTION',
  title: '欺诈检测模型漏掉了什么？',
  metrics: [
    { label: 'OVERALL ACCURACY', value: '99.2%' },
    { label: 'FRAUD RECALL', value: '8%' },
    { label: 'CLASS RATIO', value: '99 : 1' },
  ],
} as const

/** 四维词表：按维度归类，命中即产出 EvidenceSpan */
const DIMENSION_TERMS: Record<Dimension, string[]> = {
  concept: [
    '类别不平衡',
    '数据不平衡',
    '样本不平衡',
    '不平衡',
    '样本比例',
    '少数类',
    '多数类',
    '准确率悖论',
    'accuracy paradox',
    '长尾',
    '偏斜',
    'imbalance',
  ],
  evidence: [
    '准确率',
    '召回',
    'recall',
    '精确率',
    'precision',
    '整体表现',
    '识别出',
    '没抓到',
    '漏掉',
    '99',
    '99.2',
    '8%',
  ],
  action: ['重采样', '过采样', '欠采样', '类别权重', 'class weight', '加权', 'smote', '阈值', '换指标', '代价敏感'],
  verification: ['pr-auc', 'pr 曲线', 'pr曲线', '分层', '交叉验证', '混淆矩阵', '单独评估', '召回率', 'f1', 'auc'],
}

const NEGATION = /[不非没无未]/
const TURN = /但|不过|然而|其实/

/** 命中词前 8 个字符内出现否定词且无转折词，视为否定用法 */
function isNegated(text: string, index: number): boolean {
  const window = text.slice(Math.max(0, index - 8), index)
  if (!NEGATION.test(window)) return false
  return !TURN.test(window)
}

function collectSpans(text: string, dimension: Dimension): EvidenceSpan[] {
  const spans: EvidenceSpan[] = []
  const lower = text.toLowerCase()
  for (const term of DIMENSION_TERMS[dimension]) {
    const needle = term.toLowerCase()
    let from = 0
    for (;;) {
      const hit = lower.indexOf(needle, from)
      if (hit === -1) break
      from = hit + needle.length
      if (isNegated(text, hit)) continue
      spans.push({
        dimension,
        matched: text.slice(hit, hit + needle.length),
        start: hit,
        end: hit + needle.length,
      })
    }
  }
  // 同一维度内去重：位置完全相同的只留一条
  const seen = new Set<string>()
  const unique = spans.filter(s => {
    const k = `${s.start}:${s.end}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  // 去掉被同维度更长片段完全包含的短片段（如「不平衡」被「类别不平衡」包含、「99」被「99.2」包含）
  const kept = unique.filter(s =>
    !unique.some(
      o =>
        o !== s &&
        o.dimension === s.dimension &&
        o.end - o.start > s.end - s.start &&
        o.start <= s.start &&
        o.end >= s.end,
    ),
  )
  return kept.sort((a, b) => a.start - b.start)
}

const DIAGNOSIS: Record<Level, string> = {
  1: '尚未识别多数类与少数类的表现差异',
  2: '已注意到整体准确率掩盖了少数类失效',
  3: '已识别类别不平衡问题',
  4: '已识别原因并给出可验证的改进方案',
}

const FEEDBACK: Record<Level, string> = {
  1: '先比较两个数字：整体准确率 99.2%，欺诈召回只有 8%。若模型把每一笔都判为正常，准确率会是多少？这说明准确率这个指标在这里是否可信？',
  2: '你发现了少数类没被识别出来。请进一步命名这个现象——样本比例 99:1 时会发生什么，以及你会换用什么指标来衡量它。',
  3: '你已识别出类别不平衡，但还缺可执行的改进与验证方式。请至少给出一项训练侧改动（重采样或类别权重），并说明用哪个指标验证效果。',
  4: '你既命名了原因，也给出了改进与验证思路。下一步请在少数类上单独报告召回与 PR-AUC，并说明改进前后的对比方式。',
}

const KNOWLEDGE_REF: Record<Level, string> = {
  1: 'MC-IMB-00',
  2: 'MC-IMB-01',
  3: 'MC-IMB-02',
  4: 'MC-IMB-03',
}

export function analyse(student: StudentId, answer: string): EvidenceRecord {
  const text = answer.trim()
  if (!text) throw new Error('请先填写回答')

  const conceptSpans = collectSpans(text, 'concept')
  const evidenceSpans = collectSpans(text, 'evidence')
  const actionSpans = collectSpans(text, 'action')
  const verificationSpans = collectSpans(text, 'verification')

  const hasConcept = conceptSpans.length > 0
  const hasEvidence = evidenceSpans.length > 0
  const hasPlan = actionSpans.length > 0 || verificationSpans.length > 0

  let level: Level = 1
  if (hasConcept && hasPlan) level = 4
  else if (hasConcept) level = 3
  else if (hasEvidence) level = 2

  const spans = [...conceptSpans, ...evidenceSpans, ...actionSpans, ...verificationSpans].sort(
    (a, b) => a.start - b.start,
  )

  return {
    id: crypto.randomUUID(),
    student,
    answer: text,
    diagnosis: DIAGNOSIS[level],
    level,
    feedback: FEEDBACK[level],
    evidenceSpans: spans,
    knowledgeRef: KNOWLEDGE_REF[level],
    source: 'current_local_session',
    mode: 'rule_baseline',
    createdAt: new Date().toISOString(),
  }
}

export function getEvidence(): EvidenceRecord[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(raw) ? (raw as EvidenceRecord[]) : []
  } catch {
    return []
  }
}

export function saveEvidence(record: EvidenceRecord) {
  localStorage.setItem(KEY, JSON.stringify([record, ...getEvidence()].slice(0, 100)))
}

export function clearEvidence() {
  localStorage.removeItem(KEY)
}

/** 教师侧：按档位统计分布 */
export function levelDistribution(records: EvidenceRecord[]) {
  const base = { 1: 0, 2: 0, 3: 0, 4: 0 } as Record<Level, number>
  for (const r of records) base[r.level] += 1
  return base
}
