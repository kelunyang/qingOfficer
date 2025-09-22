<template>
  <div class="chart-steps-guide">
    <el-steps :active="activeStep" finish-status="success" simple>
      <el-step title="設定篩選條件" description="選擇要分析的數據範圍" />
      <el-step title="配置圖表選項" description="調整顯示方式和分組" />
      <el-step title="生成圖表" description="點擊繪製按鈕查看結果" />
    </el-steps>
  </div>
</template>

<script setup>
const props = defineProps({
  activeStep: {
    type: Number,
    default: 0
  }
})
</script>

<style scoped>
.chart-steps-guide {
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.chart-steps-guide :deep(.el-steps) {
  margin: 0;
}

.chart-steps-guide :deep(.el-step__title) {
  font-size: 14px;
  font-weight: 600;
}

.chart-steps-guide :deep(.el-step__description) {
  font-size: 12px;
  color: #666;
}
</style>