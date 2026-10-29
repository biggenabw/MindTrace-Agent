import { describe, expect, it } from 'vitest'
import { evaluation, modelInfo, CLASSES } from './learning'
import { TRAINING_SET } from './trainingData'

describe('模型评估', () => {
  it('留一交叉验证准确率不低于 0.75', () => {
    const r = evaluation()
    expect(r.total).toBe(TRAINING_SET.length)
    expect(r.accuracy).toBeGreaterThanOrEqual(0.75)
  })

  it('混淆矩阵对角线和等于正确数，总数等于样本数', () => {
    const r = evaluation()
    const diag = CLASSES.reduce((acc, c) => acc + r.matrix[c][c], 0)
    const total = CLASSES.reduce(
      (acc, row) => acc + CLASSES.reduce((sum, col) => sum + r.matrix[row][col], 0),
      0,
    )
    expect(diag).toBe(r.details.filter(d => d.correct).length)
    expect(total).toBe(r.total)
    expect(diag / total).toBeCloseTo(r.accuracy, 6)
  })

  it('每类都至少有一条样本被正确识别', () => {
    const r = evaluation()
    for (const c of CLASSES) {
      expect(r.matrix[c][c]).toBeGreaterThan(0)
    }
  })

  it('模型卡记录的准确率与评估结果一致', () => {
    expect(modelInfo().accuracy).toBe(evaluation().accuracy)
  })
})
