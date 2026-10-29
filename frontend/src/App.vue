<script setup lang="ts">
import { ref, computed } from 'vue'
import WorkspaceShell from './shell/WorkspaceShell.vue'
import {
  analyse,
  saveEvidence,
  getEvidence,
  clearEvidence,
  classDistribution,
  evaluation,
  modelInfo,
  caseMeta,
  prompt,
  CLASSES,
  CLASS_MEANING,
  CLASS_RATIONALE,
  type StudentId,
  type ClassLabel,
  type EvidenceRecord,
} from './adapters/learning'

const role = ref<'student' | 'teacher'>('student')
const student = ref<StudentId>('A')
const answer = ref('')
const records = ref<EvidenceRecord[]>(getEvidence())
const latest = ref<EvidenceRecord | null>(null)
const error = ref('')

const selected = computed(() => records.value.filter(x => x.student === student.value))
const dist = computed(() => classDistribution(records.value))
const total = computed(() => records.value.length)

const info = modelInfo()
const ev = evaluation()

const pct = (v: number) => (v * 100).toFixed(0) + '%'
const signed = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2)

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
    project="MindTrace-Bayes"
    eyebrow="LEARNING AGENT LAB"
    subtitle="让每一次学习反馈都有可追溯的依据"
    mode="朴素贝叶斯 · 本地会话"
    :steps="['阅读任务', '提交解释', '查看概率与依据', '教师审阅混淆矩阵']"
  >
    <div class="stage-intro">
      <div>
        <span class="section-label">EVIDENCE-BASED LEARNING / DEMO</span>
        <h2>{{ caseMeta.title }}</h2>
        <p class="muted">
          判定来自 {{ info.sampleCount }} 条人工标注训练的朴素贝叶斯分类器，留一准确率
          {{ pct(info.accuracy) }}。概率不是成绩，不用于评级。
        </p>
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
            placeholder="例如：这是类别不平衡，我会用类别权重重新训练，并在少数类上看召回率和 PR-AUC。"
          ></textarea>
          <div class="row">
            <button class="action" @click="submit">提交并获得概率判定</button>
            <span v-if="error" class="error">{{ error }}</span>
          </div>
        </section>

        <section class="panel feedback">
          <span class="section-label">MODEL OUTPUT</span>
          <h3 v-if="!latest">等待回答</h3>
          <template v-else>
            <h3>
              {{ CLASS_MEANING[latest.topClass] }}
              <span class="level-badge">{{ latest.topClass }}</span>
            </h3>
            <p class="muted small-note">
              最高概率 {{ pct(latest.confidence) }}，与第二名相差 {{ latest.margin.toFixed(2) }}
            </p>

            <div class="prob-list">
              <div v-for="c in CLASSES" :key="c" class="prob-row" :class="{ top: c === latest.topClass }">
                <span class="prob-label">{{ c }} · {{ CLASS_MEANING[c] }}</span>
                <div class="prob-bar"><i :style="{ width: pct(latest.probabilities[c]) }"></i></div>
                <b>{{ pct(latest.probabilities[c]) }}</b>
              </div>
            </div>

            <div class="contrib">
              <span class="section-label">特征贡献 / CONTRIBUTIONS</span>
              <p class="muted small-note">
                「{{ latest.topClass }}」的正值表示该特征把概率推向本类，负值表示拉低
              </p>
              <ul>
                <li v-for="(c, i) in latest.contributions" :key="i">
                  <code>{{ c.display }}</code>
                  <span :class="['score', c.score >= 0 ? 'pos' : 'neg']">{{ signed(c.score) }}</span>
                </li>
              </ul>
            </div>

            <p class="feedback-text">{{ latest.feedback }}</p>
            <div class="trace">
              <small>
                mode={{ latest.mode }} · 样本 {{ latest.sampleCount }} 条 · 留一准确率
                {{ pct(latest.modelAccuracy) }} · 来源 {{ latest.source }}
              </small>
            </div>
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
          <small>{{ record.topClass }} · {{ pct(record.confidence) }} · {{ CLASS_MEANING[record.topClass] }}</small>
        </article>
      </section>
    </template>

    <template v-else>
      <div class="teacher-head">
        <div>
          <span class="section-label">TEACHER REVIEW / CURRENT BROWSER</span>
          <h2>学习证据与模型状态</h2>
          <p class="muted">仅显示本机当前浏览器录入的记录，不含真实学生资料。</p>
        </div>
        <button class="secondary" @click="reset">清空本地演示记录</button>
      </div>

      <section class="panel model-panel">
        <span class="section-label">MODEL CARD</span>
        <h3>
          朴素贝叶斯 · {{ info.variant }} · α={{ info.alpha }} · 词表 {{ info.vocabSize }}
        </h3>
        <p class="muted">
          训练样本 {{ info.sampleCount }} 条 · 留一交叉验证准确率
          <b class="hl">{{ pct(info.accuracy) }}</b> · 随机基线 25%
        </p>
        <div class="rationale">
          <div v-for="c in CLASSES" :key="c">
            <b>{{ c }} {{ CLASS_MEANING[c] }}</b>
            <span>{{ CLASS_RATIONALE[c] }}</span>
          </div>
        </div>
      </section>

      <section class="panel">
        <span class="section-label">CONFUSION MATRIX / 留一交叉验证</span>
        <h3>行 = 实际标注，列 = 模型预测</h3>
        <table class="matrix">
          <thead>
            <tr>
              <th></th>
              <th v-for="c in CLASSES" :key="c">{{ c }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in CLASSES" :key="row">
              <th>{{ row }}</th>
              <td
                v-for="col in CLASSES"
                :key="col"
                :class="{ diag: row === col, wrong: row !== col && ev.matrix[row][col] > 0 }"
              >
                {{ ev.matrix[row][col] }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="muted small-note">
          对角线和 {{ ev.details.filter(d => d.correct).length }} / {{ ev.total }} = {{ pct(info.accuracy) }}
        </p>
      </section>

      <section class="panel dist-panel">
        <span class="section-label">RECORD DISTRIBUTION / 本机记录分布</span>
        <h3>共 {{ total }} 条记录</h3>
        <div v-for="c in (['L4', 'L3', 'L2', 'L1'] as ClassLabel[])" :key="c" class="dist">
          <span class="dist-label">{{ c }} · {{ CLASS_MEANING[c] }}</span>
          <div class="dist-bar"><i :style="{ width: total ? (dist[c] / total) * 100 + '%' : '0%' }"></i></div>
          <b>{{ dist[c] }}</b>
        </div>
      </section>

      <div class="teacher-grid">
        <section v-for="id in (['A', 'B'] as StudentId[])" :key="id" class="panel">
          <span class="section-label">DEMO STUDENT {{ id }}</span>
          <h3>{{ records.filter(x => x.student === id).length }} 条回答</h3>
          <p v-if="!records.some(x => x.student === id)" class="muted">当前会话暂无记录</p>
          <article v-for="record in records.filter(x => x.student === id)" :key="record.id" class="evidence-item">
            <small>
              {{ new Date(record.createdAt).toLocaleString('zh-CN') }} · {{ record.topClass }} ·
              {{ pct(record.confidence) }} · {{ record.mode }}
            </small>
            <p><b>回答：</b>{{ record.answer }}</p>
            <p><b>模型反馈：</b>{{ record.feedback }}</p>
            <span class="pill">{{ record.source }}</span>
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
            '查看四类概率与逐特征贡献，核对模型依据是否来自你的原话。',
            '教师查看模型卡、混淆矩阵与本机记录分布；系统不自动评级。',
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
  border-top: 1px solid #3a6047;
  margin-top: 16px;
  padding-top: 10px;
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

/* ---- 本组新增：概率条、贡献度、混淆矩阵 ---- */
.level-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 9px;
  border-radius: 20px;
  background: #2f6b48;
  color: #d6ffe2;
  font-size: 11px;
  letter-spacing: 0.5px;
  vertical-align: middle;
}
.small-note {
  font-size: 12px;
  margin: 4px 0 0;
}
.prob-list {
  display: grid;
  gap: 7px;
  margin: 14px 0 4px;
}
.prob-row {
  display: grid;
  grid-template-columns: 128px 1fr 42px;
  align-items: center;
  gap: 9px;
  font-size: 12px;
  color: #a9cbaf;
}
.prob-row.top {
  color: #d8ffe2;
}
.prob-row.top .prob-label {
  font-weight: 600;
}
.prob-bar {
  height: 9px;
  border-radius: 6px;
  background: #0a2119;
  border: 1px solid #315a42;
  overflow: hidden;
}
.prob-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #35714f, #6fbb8a);
  transition: width 0.3s ease;
}
.prob-row.top .prob-bar i {
  background: linear-gradient(90deg, #4ba676, #a8f0bd);
}
.prob-row b {
  text-align: right;
  color: #b9f6c4;
}
.contrib {
  margin-top: 16px;
  border-top: 1px dashed #3a6047;
  padding-top: 12px;
}
.contrib ul {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 5px 12px;
}
.contrib li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
}
.contrib code {
  background: #0a2119;
  border: 1px solid #3b684b;
  border-radius: 5px;
  padding: 1px 6px;
  color: #b9f6c4;
}
.contrib .score {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.contrib .pos {
  color: #8fe0a8;
}
.contrib .neg {
  color: #ffb59c;
}
.feedback-text {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid #3a6047;
  color: #d5eedb;
}
.model-panel {
  margin-bottom: 14px;
}
.hl {
  color: #a8f0bd;
}
.rationale {
  display: grid;
  gap: 6px;
  margin-top: 12px;
  font-size: 12.5px;
  color: #b6d7bd;
}
.rationale b {
  color: #d8ffe2;
  margin-right: 6px;
}
.matrix {
  border-collapse: collapse;
  margin-top: 10px;
  font-variant-numeric: tabular-nums;
}
.matrix th,
.matrix td {
  border: 1px solid #315a42;
  padding: 7px 14px;
  text-align: center;
  font-size: 13px;
  color: #b6d7bd;
}
.matrix th {
  background: #0f2b1f;
  color: #8fd3a5;
  font-weight: 600;
}
.matrix td.diag {
  background: #1c4b32;
  color: #b9f6c4;
  font-weight: 700;
}
.matrix td.wrong {
  background: #3a2418;
  color: #ffc9a8;
}
.dist-panel {
  margin: 14px 0;
}
.dist {
  display: grid;
  grid-template-columns: 170px 1fr 40px;
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
    grid-template-columns: 120px 1fr 32px;
  }
  .contrib ul {
    grid-template-columns: 1fr;
  }
}
</style>
