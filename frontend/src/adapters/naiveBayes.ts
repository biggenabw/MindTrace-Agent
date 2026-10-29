/**
 * 朴素贝叶斯文本分类器（支持多项 / 伯努利两种变体）。
 *
 * 与模板规则引擎的根本差别：判定不来自开发者写死的 if-else，
 * 而来自标注样本的统计分布；新增能力只需加标注，不改代码。
 *
 * 变体选择：短文本（10—40 字）下，伯努利模型对「特征缺失」也计分，
 * 比多项模型更稳，因此默认使用 bernoulli。
 */
import { extractFeatures, displayFeature } from './features'

export type ClassLabel = 'L1' | 'L2' | 'L3' | 'L4'
export type Variant = 'multinomial' | 'bernoulli'

export const CLASSES: ClassLabel[] = ['L1', 'L2', 'L3', 'L4']

export const CLASS_MEANING: Record<ClassLabel, string> = {
  L1: '未触及问题',
  L2: '描述现象',
  L3: '命名原因',
  L4: '原因 + 方案',
}

export type TrainingSample = {
  id: string
  answer: string
  label: ClassLabel
}

export type Contribution = {
  feature: string
  display: string
  /** 正值支持最高类，负值反对最高类 */
  score: number
  supports: ClassLabel
}

export type Prediction = {
  probabilities: Record<ClassLabel, number>
  topClass: ClassLabel
  confidence: number
  /** 与第二名的概率差 */
  margin: number
  contributions: Contribution[]
  knownFeatures: number
  totalFeatures: number
}

export type Model = {
  variant: Variant
  alpha: number
  priorLog: Record<ClassLabel, number>
  /** 每个类别的特征出现次数（多项模型用） */
  tokenCounts: Record<ClassLabel, Map<string, number>>
  /** 每个类别中包含该特征的文档数（伯努利模型用） */
  docFreq: Record<ClassLabel, Map<string, number>>
  vocab: Set<string>
  classTokenCount: Record<ClassLabel, number>
  classDocCount: Record<ClassLabel, number>
  sampleCount: number
  /** 各特征在类别间的事前对数比，用于贡献度展示 */
  featureLogOdds: Map<string, number>
}

const emptyCounts = (): Record<ClassLabel, number> => ({ L1: 0, L2: 0, L3: 0, L4: 0 })

/** 训练。alpha 为拉普拉斯平滑系数 */
export function train(
  samples: TrainingSample[],
  alpha = 1,
  variant: Variant = 'bernoulli',
): Model {
  const vocab = new Set<string>()
  const tokenCounts: Record<ClassLabel, Map<string, number>> = {
    L1: new Map(),
    L2: new Map(),
    L3: new Map(),
    L4: new Map(),
  }
  const docFreq: Record<ClassLabel, Map<string, number>> = {
    L1: new Map(),
    L2: new Map(),
    L3: new Map(),
    L4: new Map(),
  }
  const classTokenCount = emptyCounts()
  const classDocCount = emptyCounts()

  for (const sample of samples) {
    classDocCount[sample.label] += 1
    const feats = extractFeatures(sample.answer)
    for (const f of feats) {
      vocab.add(f)
      const m = tokenCounts[sample.label]
      m.set(f, (m.get(f) ?? 0) + 1)
      classTokenCount[sample.label] += 1
    }
    for (const f of new Set(feats)) {
      const d = docFreq[sample.label]
      d.set(f, (d.get(f) ?? 0) + 1)
    }
  }

  const V = vocab.size || 1
  const N = samples.length || 1
  const priorLog = {} as Record<ClassLabel, number>
  // 每个特征的正类先验对数比：用于给贡献度一个统一尺度
  const featureLogOdds = new Map<string, number>()

  for (const c of CLASSES) {
    priorLog[c] = Math.log((classDocCount[c] + alpha) / (N + alpha * CLASSES.length))
  }

  const p1 = (c: ClassLabel, f: string) =>
    ((docFreq[c].get(f) ?? 0) + alpha) / (classDocCount[c] + 2 * alpha)

  for (const f of vocab) {
    const logs = CLASSES.map(c => Math.log(p1(c, f)))
    const mean = logs.reduce((a, b) => a + b, 0) / logs.length
    const variance = logs.reduce((a, b) => a + (b - mean) ** 2, 0) / logs.length
    // 类别间差异越大，该特征越有区分度
    featureLogOdds.set(f, variance)
  }

  return {
    variant,
    alpha,
    priorLog,
    tokenCounts,
    docFreq,
    vocab,
    classTokenCount,
    classDocCount,
    sampleCount: samples.length,
    featureLogOdds,
  }
}

/**
 * 温度缩放后的 softmax。
 * 原始对数似然在本场景下差异极大（数百），直接 softmax 会饱和成 0% / 100%，
 * 让人误以为模型很确定。除以温度 T 使概率反映真实不确定性；argmax 不受影响。
 */
function softmax(scores: Record<ClassLabel, number>, temperature = 1): Record<ClassLabel, number> {
  const t = temperature > 0 ? temperature : 1
  const max = Math.max(...CLASSES.map(c => scores[c]))
  const exps = CLASSES.map(c => Math.exp((scores[c] - max) / t))
  const sum = exps.reduce((a, b) => a + b, 0)
  const out = {} as Record<ClassLabel, number>
  CLASSES.forEach((c, i) => {
    out[c] = exps[i] / sum
  })
  return out
}

function computeContributions(
  model: Model,
  features: string[],
  topClass: ClassLabel,
  limit = 8,
): Contribution[] {
  const unique = [...new Set(features)]
  const others = CLASSES.filter(c => c !== topClass)
  const list: Contribution[] = []

  for (const f of unique) {
    if (!model.vocab.has(f)) continue
    const likelihoodOf = (c: ClassLabel) => {
      if (model.variant === 'bernoulli') {
        const df = model.docFreq[c].get(f) ?? 0
        return Math.log((df + model.alpha) / (model.classDocCount[c] + 2 * model.alpha))
      }
      const count = model.tokenCounts[c].get(f) ?? 0
      const denom = model.classTokenCount[c] + model.alpha * (model.vocab.size || 1)
      return Math.log((count + model.alpha) / denom)
    }
    const top = likelihoodOf(topClass)
    const mean = others.reduce((acc, c) => acc + likelihoodOf(c), 0) / others.length
    list.push({
      feature: f,
      display: displayFeature(f),
      score: top - mean,
      supports: topClass,
    })
  }

  return list.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, limit)
}

/** 预测。temperature 只影响概率刻度，不改变判定类别 */
export function predict(model: Model, text: string, temperature = 1): Prediction {
  const features = extractFeatures(text)
  const featureSet = new Set(features)
  const scores = {} as Record<ClassLabel, number>

  for (const c of CLASSES) {
    let s = model.priorLog[c]
    if (model.variant === 'bernoulli') {
      const denom = model.classDocCount[c] + 2 * model.alpha
      for (const f of model.vocab) {
        const df = model.docFreq[c].get(f) ?? 0
        const p = (df + model.alpha) / denom
        s += featureSet.has(f) ? Math.log(p) : Math.log(1 - p)
      }
    } else {
      const denom = model.classTokenCount[c] + model.alpha * (model.vocab.size || 1)
      for (const f of features) {
        const count = model.tokenCounts[c].get(f) ?? 0
        if (count === 0) continue
        s += Math.log((count + model.alpha) / denom)
      }
    }
    scores[c] = s
  }

  let known = 0
  for (const f of features) if (model.vocab.has(f)) known += 1

  const probabilities = softmax(scores, temperature)
  const ranked = [...CLASSES].sort((a, b) => probabilities[b] - probabilities[a])

  return {
    probabilities,
    topClass: ranked[0],
    confidence: probabilities[ranked[0]],
    margin: probabilities[ranked[0]] - probabilities[ranked[1]],
    contributions: computeContributions(model, features, ranked[0]),
    knownFeatures: known,
    totalFeatures: features.length,
  }
}

export type EvaluationResult = {
  accuracy: number
  matrix: Record<ClassLabel, Record<ClassLabel, number>>
  total: number
  details: Array<{ id: string; actual: ClassLabel; predicted: ClassLabel; correct: boolean }>
}

const emptyMatrix = (): Record<ClassLabel, Record<ClassLabel, number>> => ({
  L1: { L1: 0, L2: 0, L3: 0, L4: 0 },
  L2: { L1: 0, L2: 0, L3: 0, L4: 0 },
  L3: { L1: 0, L2: 0, L3: 0, L4: 0 },
  L4: { L1: 0, L2: 0, L3: 0, L4: 0 },
})

/** 留一交叉验证：每次留出一条样本做测试，其余用于训练 */
export function leaveOneOut(
  samples: TrainingSample[],
  alpha = 1,
  variant: Variant = 'bernoulli',
): EvaluationResult {
  const matrix = emptyMatrix()
  const details: EvaluationResult['details'] = []
  let correct = 0

  for (let i = 0; i < samples.length; i++) {
    const test = samples[i]
    const rest = samples.filter((_, idx) => idx !== i)
    const model = train(rest, alpha, variant)
    const { topClass } = predict(model, test.answer)
    matrix[test.label][topClass] += 1
    const ok = topClass === test.label
    if (ok) correct += 1
    details.push({ id: test.id, actual: test.label, predicted: topClass, correct: ok })
  }

  return {
    accuracy: samples.length ? correct / samples.length : 0,
    matrix,
    total: samples.length,
    details,
  }
}
