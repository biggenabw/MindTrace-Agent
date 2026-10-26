<script setup lang="ts">
import { ref, computed } from 'vue'
import WorkspaceShell from './shell/WorkspaceShell.vue'
import {
  analyse,
  saveEvidence,
  getEvidence,
  clearEvidence,
  levelDistribution,
  caseMeta,
  prompt,
  type StudentId,
  type EvidenceRecord,
} from './adapters/learning'

const role = ref<'student' | 'teacher'>('student')
const student = ref<StudentId>('A')
const answer = ref('')
const records = ref<EvidenceRecord[]>(getEvidence())
const latest = ref<EvidenceRecord | null>(null)
const error = ref('')

const selected = computed(() => records.value.filter(x => x.student === student.value))
const dist = computed(() => levelDistribution(records.value))
const total = computed(() => records.value.length)

const DIMENSION_LABEL: Record<string, string> = {
  concept: '概念',
  evidence: '证据',
  action: '行动',
  verification: '验证',
}
const LEVEL_HINT: Record<number, string> = {
  1: '未识别差距',
  2: '看到现象',
  3: '命名原因',
  4: '原因 + 方案',
}

function submit() {
  try {
    const record = analyse(student.value, answer.value)
    saveEvidence(record)
    records.value = getEvidence()
    latest.value = record
    error.value = ''
  } catch (e) {
    error.value = (e as Error).message
  }
}
function select(next: StudentId) {
  student.value = next
  answer.value = ''
  latest.value = null
  error.value = ''
}
function reset() {
  clearEvidence()
  records.value = []
  latest.value = null
}
</script>

<template>
  <WorkspaceShell
    project="MindTrace-Skew"
    eyebrow="LEARNING AGENT LAB"
    subtitle="让每一次学习反馈都有可追溯的依据"
    mode="规则基线 · 本地会话"
    :steps="['阅读任务', '提交解释', '查看命中原文', '教师审阅证据']"
  >
    <div class="stage-intro">
      <div>
        <span class="section-label">EVIDENCE-BASED LEARNING / DEMO</span>
        <h2>{{ caseMeta.title }}</h2>
        <p class="muted">规则模式，无外部大模型。反馈仅针对当前输入，不代表真实课堂成绩。</p>
      </div>
      <span class="pill">LOCAL SESSION</span>
    </div>

    <div class="role-switch">
      <button @click="role = 'student'" :aria-pressed="role === 'student'">学生工作区</button>
      <button @click="role = 'teacher'" :aria-pressed="role === 'teacher'">教师证据视图</button>
    </div>

    <template v-if="role === 'student'">
      <div class="student-select">
        <span>演示身份</span>
        <button @click="select('A')" :aria-pressed="student === 'A'">学生 A</button>
        <button @click="select('B')" :aria-pressed="student === 'B'">学生 B</button>
        <small>DEMO / SAMPLE 身份</small>
      </div>

      <section class="problem-card">
        <span class="section-label">{{ caseMeta.id }} · {{ caseMeta.field }}</span>
        <h2>欺诈检测模型漏掉了什么？</h2>
        <p>{{ prompt }}</p>
        <div class="metrics">
          <div v-for="m in caseMeta.metrics" :key="m.label">
            <small>{{ m.label }}</small>
            <strong>{{ m.value }}</strong>
          </div>
        </div>
      </section>

      <div class="learning-grid">
        <section class="panel">
          <span class="section-label">YOUR EXPLANATION</span>
          <h3>写下你的判断</h3>
          <textarea
            v-model="answer"
            rows="7"
            :aria-label="`学生 ${student} 的回答`"
            placeholder="例如：这是类别不平衡，99:1 的样本比例下全猜正常也有 99% 准确率，我会加类别权重并看少数类召回。"
          ></textarea>
          <div class="row">
            <button class="action" @click="submit">提交并获得规则反馈</button>
            <span v-if="error" class="error">{{ error }}</span>
          </div>
        </section>

        <section class="panel feedback">
          <span class="section-label">TRACEABLE FEEDBACK</span>
          <h3>
            {{ latest ? `给学生 ${latest.student} 的建议` : '等待回答' }}
            <span v-if="latest" class="level-badge">LEVEL {{ latest.level }}</span>
          </h3>
          <p v-if="latest">{{ latest.feedback }}</p>
          <p v-else class="muted">提交回答后，这里显示按四维规则生成的建议。</p>

          <template v-if="latest">
            <div class="trace">
              <span>{{ latest.diagnosis }}</span>
              <small>来源：当前本地会话 · {{ latest.mode }} · {{ latest.knowledgeRef }}</small>
            </div>
            <div v-if="latest.evidenceSpans.length" class="spans">
              <span class="section-label">命中原文 / EVIDENCE SPANS</span>
              <ul>
                <li v-for="(s, i) in latest.evidenceSpans" :key="i">
                  <b>{{ DIMENSION_LABEL[s.dimension] }}</b>
                  <code>{{ s.matched }}</code>
                  <small>位置 {{ s.start }}–{{ s.end }}</small>
                </li>
              </ul>
            </div>
            <p v-else class="muted small-note">本条回答未命中任何关键词，档位落在第 1 档。</p>
          </template>
        </section>
      </div>

      <section class="panel recent">
        <span class="section-label">LEARNING EVIDENCE</span>
        <h3>学生 {{ student }} 的当前会话记录</h3>
        <p v-if="!selected.length" class="muted">暂无记录；提交后将保存在本机浏览器。</p>
        <article v-for="record in selected.slice(0, 3)" :key="record.id">
          <time>{{ new Date(record.createdAt).toLocaleString('zh-CN') }}</time>
          <p>{{ record.answer }}</p>
          <small>LEVEL {{ record.level }} · {{ record.diagnosis }}</small>
        </article>
      </section>
    </template>

    <template v-else>
      <div class="teacher-head">
        <div>
          <span class="section-label">TEACHER REVIEW / CURRENT BROWSER</span>
          <h2>学习证据记录</h2>
          <p class="muted">仅显示本机当前浏览器录入的演示回答，不含真实学生资料。</p>
        </div>
        <button class="secondary" @click="reset">清空本地演示记录</button>
      </div>

      <section class="panel dist-panel">
        <span class="section-label">LEVEL DISTRIBUTION / 档位分布</span>
        <h3>共 {{ total }} 条记录</h3>
        <div v-for="level in ([4, 3, 2, 1] as const)" :key="level" class="dist">
          <span class="dist-label">LEVEL {{ level }} · {{ LEVEL_HINT[level] }}</span>
          <div class="dist-bar"><i :style="{ width: total ? (dist[level] / total) * 100 + '%' : '0%' }"></i></div>
          <b>{{ dist[level] }}</b>
        </div>
      </section>

      <div class="teacher-grid">
        <section v-for="id in (['A', 'B'] as StudentId[])" :key="id" class="panel">
          <span class="section-label">DEMO STUDENT {{ id }}</span>
          <h3>{{ records.filter(x => x.student === id).length }} 条回答</h3>
          <p v-if="!records.some(x => x.student === id)" class="muted">当前会话暂无记录</p>
          <article v-for="record in records.filter(x => x.student === id)" :key="record.id" class="evidence-item">
            <small>{{ new Date(record.createdAt).toLocaleString('zh-CN') }} · LEVEL {{ record.level }} · {{ record.mode }}</small>
            <p><b>回答：</b>{{ record.answer }}</p>
            <p><b>规则反馈：</b>{{ record.feedback }}</p>
            <span class="pill">{{ record.source }} · {{ record.knowledgeRef }}</span>
          </article>
        </section>
      </div>
    </template>

    <template #drawer="{ active }">
      <p>
        {{
          [
            '阅读 CASE 002 的三项指标：整体准确率、欺诈召回、样本比例。',
            '写下个人回答，原文完整记录，不做加工。',
            '系统展示命中原文与四维诊断，可按片段核对是否为自己所写。',
            '教师读取本机记录与档位分布，自行审查；系统不自动评级。',
          ][active]
        }}
      </p>
      <p class="muted">数据：localStorage · 可随时清除</p>
    </template>
  </WorkspaceShell>
</template>

<style scoped>
.stage-intro,
.teacher-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  margin-bottom: 18px;
}
.stage-intro h2,
.teacher-head h2 {
  margin: 6px 0;
  font-size: 25px;
}
.stage-intro p,
.teacher-head p {
  margin: 0;
}
.role-switch {
  display: flex;
  gap: 7px;
  border-bottom: 1px solid #315a42;
  padding-bottom: 12px;
  margin-bottom: 15px;
}
.role-switch button,
.student-select button {
  background: #173a2a;
  color: #c3e1cc;
  border: 1px solid #3b684b;
  border-radius: 9px;
  padding: 9px 13px;
}
.role-switch button[aria-pressed='true'],
.student-select button[aria-pressed='true'] {
  background: #4ba676;
  color: #092018;
  border-color: #9fe6b2;
}
.student-select {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.student-select span {
  color: #afd5ba;
}
.student-select small {
  color: #8fbaa1;
}
.problem-card {
  padding: 25px;
  border: 1px solid #5b8566;
  border-radius: 16px;
  background: linear-gradient(105deg, #153c29, #10281f);
  margin-bottom: 15px;
}
.problem-card h2 {
  font-size: 25px;
  margin: 8px 0;
}
.problem-card p {
  font-size: 16px;
  color: #d5eedb;
}
.metrics {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
  margin-top: 22px;
}
.metrics div {
  display: grid;
  gap: 4px;
  min-width: 120px;
  border: 1px solid #4d805d;
  border-radius: 10px;
  padding: 12px 16px;
  background: #0a2119;
}
.metrics small {
  font-size: 10px;
  color: #8cb89d;
}
.metrics strong {
  font-size: 26px;
  color: #b9f6c4;
}
.learning-grid,
.teacher-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.learning-grid textarea {
  width: 100%;
  resize: vertical;
  background: #091c15;
  color: #eef8ef;
  border: 1px solid #4b795c;
  border-radius: 9px;
  padding: 12px;
  margin: 0 0 12px;
}
.feedback p {
  line-height: 1.7;
}
.trace {
  display: grid;
  gap: 8px;
  border-top: 1px solid #3a6047;
  margin-top: 20px;
  padding-top: 12px;
  color: #b2e4bd;
}
.trace small,
.evidence-item small {
  color: #89b99a;
}
.error {
  color: #ffcfac;
}
.recent {
  margin-top: 14px;
}
.recent article,
.evidence-item {
  border-top: 1px solid #315a42;
  padding: 10px 0;
}
.recent article p,
.evidence-item p {
  margin: 5px 0;
  color: #cce4d2;
}
.recent time,
.recent small {
  font-size: 11px;
  color: #8db69b;
}

/* 本组新增：档位徽章、命中原文、分布条 */
.level-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 8px;
  border-radius: 20px;
  background: #2f6b48;
  color: #d6ffe2;
  font-size: 11px;
  letter-spacing: 0.5px;
  vertical-align: middle;
}
.spans {
  margin-top: 16px;
  border-top: 1px dashed #3a6047;
  padding-top: 12px;
}
.spans ul {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  gap: 6px;
}
.spans li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #cce4d2;
}
.spans li b {
  min-width: 34px;
  color: #8fd3a5;
  font-weight: 600;
}
.spans li code {
  background: #0a2119;
  border: 1px solid #3b684b;
  border-radius: 5px;
  padding: 1px 6px;
  color: #b9f6c4;
}
.spans li small {
  color: #7ea88d;
}
.small-note {
  font-size: 12px;
  margin-top: 14px;
}
.dist-panel {
  margin-bottom: 14px;
}
.dist {
  display: grid;
  grid-template-columns: 190px 1fr 40px;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.dist-label {
  font-size: 12px;
  color: #afd5ba;
}
.dist-bar {
  height: 10px;
  border-radius: 6px;
  background: #0a2119;
  border: 1px solid #315a42;
  overflow: hidden;
}
.dist-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #4ba676, #9fe6b2);
  transition: width 0.3s ease;
}
.dist b {
  text-align: right;
  color: #b9f6c4;
}
@media (max-width: 700px) {
  .stage-intro,
  .teacher-head {
    flex-direction: column;
    align-items: start;
  }
  .learning-grid,
  .teacher-grid {
    grid-template-columns: 1fr;
  }
  .problem-card {
    padding: 16px;
  }
  .dist {
    grid-template-columns: 130px 1fr 32px;
  }
}
</style>
