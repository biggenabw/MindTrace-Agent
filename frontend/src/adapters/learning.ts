/**
 * 编排层：把贝叶斯模型、训练集与证据存储组装成页面可用的接口。
 *
 * 判定不再由规则决定，而由 trainingData 中的标注样本训练出的模型给出。
 * 想改变判定行为，请改标注，而不是改这里的代码。
 */
import {
  CLASSES,
  CLASS_MEANING,
  leaveOneOut,
  predict,
  train,
  type ClassLabel,
  type Contribution,
  type EvaluationResult,
  type Model,
  type Variant,
} from './naiveBayes'
import { TRAINING_SET, CLASS_RATIONALE } from './trainingData'

export type StudentId = 'A' | 'B'

/** 平滑系数与变体：由实验确定（见 docs 中的评估记录） */
export const ALPHA = 0.05
export const VARIANT: Variant = 'bernoulli'
/**
 * 温度缩放系数：用留一交叉验证的 log loss 选出。
 * T=1 时 logloss 0.814（softmax 饱和，显示为 0% / 100%），T=5 时降到 0.583，准确率不变。
 */
export const TEMPERATURE = 5

export type EvidenceRecord = {
  id: string
  student: StudentId
  answer: string
  /** 四类概率，和为 1 */
  probabilities: Record<ClassLabel, number>
  topClass: ClassLabel
  confidence: number
  margin: number
  contributions: Contribution[]
  feedback: string
  /** 训练时记录的留一准确率，随每条记录一起留痕 */
  modelAccuracy: number
  sampleCount: number
  source: 'current_local_session'
  mode: 'naive_bayes_v1'
  createdAt: string
}

/** 与模板 key 区分，避免读到旧方案遗留数据 */
const KEY = 'mindtrace-bayes-evidence-v1'

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

export { CLASSES, CLASS_MEANING, CLASS_RATIONALE }
export type { ClassLabel, Contribution, EvaluationResult }

/** 全局模型：模块加载时训练一次 */
const MODEL: Model = train(TRAINING_SET, ALPHA, VARIANT)

/** 留一评估结果：也只需算一次 */
let cachedEval: EvaluationResult | null = null

export function evaluation(): EvaluationResult {
  if (!cachedEval) cachedEval = leaveOneOut(TRAINING_SET, ALPHA, VARIANT)
  return cachedEval
}

export function modelInfo() {
  return {
    variant: VARIANT,
    alpha: ALPHA,
    temperature: TEMPERATURE,
    sampleCount: TRAINING_SET.length,
    vocabSize: MODEL.vocab.size,
    accuracy: evaluation().accuracy,
  }
}

const FEEDBACK: Record<ClassLabel, string> = {
  L1: '你的回答还没有指向具体现象。先看两个数字：整体准确率 99.2%，欺诈召回只有 8%。如果模型把每一笔都判为正常，准确率会是多少？这说明这个指标在这里是否可信？',
  L2: '你指出了指标之间的反常，但还没有命名它。当样本比例是 99:1 时，模型只要偏向多数类就能拿到很高的准确率——这个现象在机器学习里叫什么？',
  L3: '你已经命名了原因，但还没有可执行的改进。请至少给出一项训练侧改动（重采样或类别权重），并说明用哪个指标验证效果。',
  L4: '你既命名了原因，也给出了改进与验证方式。下一步请说明如何在少数类上单独报告结果，以及改进前后的对比口径。',
}

/** 概率接近时追加提示，避免把「勉强判对」当成确定结论 */
const LOW_MARGIN_HINT = '（本次最高概率与第二名差距较小，仅供参考）'

export function analyse(student: StudentId, answer: string): EvidenceRecord {
  const text = answer.trim()
  if (!text) throw new Error('请先填写回答')

  const p = predict(MODEL, text, TEMPERATURE)
  const ambiguous = p.margin < 0.15
  const ev = evaluation()

  return {
    id: crypto.randomUUID(),
    student,
    answer: text,
    probabilities: p.probabilities,
    topClass: p.topClass,
    confidence: p.confidence,
    margin: p.margin,
    contributions: p.contributions,
    feedback: ambiguous ? FEEDBACK[p.topClass] + LOW_MARGIN_HINT : FEEDBACK[p.topClass],
    modelAccuracy: ev.accuracy,
    sampleCount: TRAINING_SET.length,
    source: 'current_local_session',
    mode: 'naive_bayes_v1',
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

/** 教师侧：按预测类别统计分布 */
export function classDistribution(records: EvidenceRecord[]) {
  const base = { L1: 0, L2: 0, L3: 0, L4: 0 } as Record<ClassLabel, number>
  for (const r of records) base[r.topClass] += 1
  return base
}
