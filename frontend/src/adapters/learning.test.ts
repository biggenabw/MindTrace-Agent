import { describe, expect, it } from 'vitest'
import { analyse, classDistribution, modelInfo, CLASSES } from './learning'
import { extractFeatures, negatedRanges } from './features'
import { TRAINING_SET } from './trainingData'

// 训练集之外的句子，用于检验泛化而不是记忆
const NEW_L4 = '训练集正负比 99 比 1，我会先做欠采样再训练，然后用 PR 曲线看少数类效果'
const NEW_L2 = '准确率 99% 但欺诈几乎没识别出来，这不对劲'
const NEW_L1 = '可能需要重新训练一下模型'

describe('特征提取', () => {
  it('中文切成 bigram 并保留数字与英文', () => {
    const f = extractFeatures('类别不平衡 PR-AUC 99.2%')
    expect(f).toContain('zh2#类别')
    expect(f.some(x => x.startsWith('en#'))).toBe(true)
    expect(f.some(x => x.startsWith('num#'))).toBe(true)
  })

  it('否定作用域不跨越标点', () => {
    // 「不太」只能影响「好」，不能影响后面的「需要再优化」
    const ranges = negatedRanges('模型不太好，需要再优化')
    const features = extractFeatures('模型不太好，需要再优化')
    expect(features.some(f => f.startsWith('neg#') && f.includes('优化'))).toBe(false)
    expect(ranges.every(([, end]) => end <= 7)).toBe(true)
  })
})

describe('贝叶斯判定', () => {
  it('四类概率之和为 1', () => {
    const r = analyse('A', NEW_L4)
    const sum = CLASSES.reduce((acc, c) => acc + r.probabilities[c], 0)
    expect(sum).toBeCloseTo(1, 5)
  })

  it('命名原因并给出方案的句子应判为 L4', () => {
    const r = analyse('A', NEW_L4)
    expect(r.topClass).toBe('L4')
    expect(r.confidence).toBeGreaterThan(0.4)
  })

  it('只描述现象的句子应判为 L2', () => {
    const r = analyse('B', NEW_L2)
    expect(r.topClass).toBe('L2')
  })

  it('笼统判断应判为 L1', () => {
    const r = analyse('A', NEW_L1)
    expect(r.topClass).toBe('L1')
  })

  it('空回答被拒绝', () => {
    expect(() => analyse('A', '   ')).toThrow('请先填写回答')
  })

  it('必须给出非空的特征贡献', () => {
    const r = analyse('A', NEW_L4)
    expect(r.contributions.length).toBeGreaterThan(0)
    expect(r.contributions.some(c => c.score > 0)).toBe(true)
    r.contributions.forEach(c => expect(typeof c.display).toBe('string'))
  })

  it('记录携带模型来源与准确率', () => {
    const r = analyse('A', NEW_L4)
    expect(r.mode).toBe('naive_bayes_v1')
    expect(r.source).toBe('current_local_session')
    expect(r.sampleCount).toBe(TRAINING_SET.length)
    expect(r.modelAccuracy).toBeGreaterThan(0.7)
    expect(typeof r.createdAt).toBe('string')
  })

  it('模型信息与训练集一致', () => {
    const info = modelInfo()
    expect(info.variant).toBe('bernoulli')
    expect(info.sampleCount).toBe(32)
    expect(info.vocabSize).toBeGreaterThan(100)
  })

  it('记录分布按预测类别统计', () => {
    const a = analyse('A', NEW_L4)
    const b = analyse('B', NEW_L2)
    const dist = classDistribution([a, b])
    expect(dist[a.topClass]).toBe(1)
    expect(dist[b.topClass]).toBe(1)
    expect(CLASSES.reduce((acc, c) => acc + dist[c], 0)).toBe(2)
  })
})
