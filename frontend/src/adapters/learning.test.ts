import { expect, it, describe } from 'vitest'
import { analyse, levelDistribution, prompt, type EvidenceRecord } from './learning'

const S1 = '这是类别不平衡，99:1 的样本比例下全猜正常也有 99% 准确率，我会加类别权重并看少数类召回'
const S2 = '整体准确率 99.2% 但欺诈只识别出 8%，说明模型几乎没抓到欺诈'
const S3 = '模型训练得不够充分，需要更多数据'
const S5 = '我不认为这是类别不平衡'

describe('CASE 002 类别不平衡诊断', () => {
  it('命名原因并给出改进 → 第 4 档', () => {
    const r = analyse('A', S1)
    expect(r.level).toBe(4)
    expect(r.diagnosis).toContain('已识别原因')
  })

  it('只指出少数类失效 → 第 2 档', () => {
    const r = analyse('B', S2)
    expect(r.level).toBe(2)
    expect(r.diagnosis).toContain('整体准确率掩盖')
  })

  it('未触及少数类表现 → 第 1 档', () => {
    const r = analyse('A', S3)
    expect(r.level).toBe(1)
    expect(r.evidenceSpans).toHaveLength(0)
  })

  it('空回答被拒绝', () => {
    expect(() => analyse('A', '   ')).toThrow('请先填写回答')
  })

  it('否定句不得被判定为已识别概念', () => {
    const r = analyse('A', S5)
    expect(r.level).toBe(1)
    expect(r.evidenceSpans.some(s => s.dimension === 'concept')).toBe(false)
  })

  it('证据片段位置必须与原文对应', () => {
    const r = analyse('A', S1)
    expect(r.evidenceSpans.length).toBeGreaterThan(0)
    for (const s of r.evidenceSpans) {
      expect(r.answer.slice(s.start, s.end)).toBe(s.matched)
    }
  })

  it('不同档位的反馈文案不同', () => {
    const l2 = analyse('B', S2)
    const l4 = analyse('A', S1)
    expect(l4.feedback).not.toBe(l2.feedback)
    expect(l4.knowledgeRef).not.toBe(l2.knowledgeRef)
  })

  it('记录必须携带溯源字段', () => {
    const r = analyse('A', S1)
    expect(r.source).toBe('current_local_session')
    expect(r.mode).toBe('rule_baseline')
    expect(r.knowledgeRef).toMatch(/^MC-IMB-0[0-3]$/)
    expect(typeof r.createdAt).toBe('string')
  })

  it('题面不再使用模板的过拟合场景', () => {
    expect(prompt).toContain('欺诈')
    expect(prompt).not.toContain('猫狗')
    expect(prompt).not.toContain('78%')
  })

  it('同一维度内被更长片段包含的短片段应被丢弃', () => {
    const r = analyse('A', S1)
    const concept = r.evidenceSpans.filter(s => s.dimension === 'concept')
    expect(concept.some(s => s.matched === '类别不平衡')).toBe(true)
    expect(concept.some(s => s.matched === '不平衡' && s.start === 4)).toBe(false)
  })

  it('教师侧档位分布统计正确', () => {
    const records = [analyse('A', S1), analyse('B', S2), analyse('A', S3)] as EvidenceRecord[]
    const dist = levelDistribution(records)
    expect(dist[4]).toBe(1)
    expect(dist[2]).toBe(1)
    expect(dist[1]).toBe(1)
    expect(dist[3]).toBe(0)
  })
})
