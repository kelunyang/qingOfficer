<template>
  <el-drawer
    v-model="visible"
    title="選擇數據源"
    direction="rtl"
    size="500px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
  >
    <div class="data-source-selector">
      <el-card>
        <template #header>
          <div class="card-header">
            <span>📊 清代官員數據可視化系統</span>
          </div>
        </template>
        
        <div class="welcome-content">
          <h3>歡迎使用清代官員數據可視化系統</h3>
          <p>本系統提供多種圖表類型來分析清代官員的職業生涯、機構組成、地區流動等數據。請選擇一個數據集開始分析：</p>
        </div>
      </el-card>
      
      <el-card style="margin-top: 20px">
        <template #header>
          <div class="card-header">
            <span>📂 可用數據集</span>
          </div>
        </template>
        
        <div v-if="loading" class="loading-container">
          <el-icon class="is-loading"><Loading /></el-icon>
          <p>正在掃描可用數據集...</p>
        </div>
        
        <div v-else-if="availableDatasets.length > 0">
          <div 
            v-for="dataset in availableDatasets" 
            :key="dataset"
            class="dataset-item"
            :class="{ 'selected': selectedDataset === dataset }"
            @click="selectedDataset = dataset"
          >
            <div class="dataset-info">
              <h4>{{ getDatasetDisplayName(dataset) }}</h4>
              <p class="dataset-description">{{ getDatasetDescription(dataset) }}</p>
              <div class="dataset-meta">
                <el-tag size="small">CSV 格式</el-tag>
                <el-tag size="small" type="info">{{ getDatasetSize(dataset) }}</el-tag>
              </div>
            </div>
            <div class="dataset-select">
              <el-radio 
                v-model="selectedDataset" 
                :label="dataset" 
                size="large"
              >&nbsp;</el-radio>
            </div>
          </div>
          
          <div class="action-buttons">
            <el-button 
              type="primary" 
              size="large"
              @click="loadSelectedDataset"
              :disabled="!selectedDataset"
              :loading="loadingDataset"
              style="width: 100%; margin-top: 20px"
            >
              <el-icon><Download /></el-icon>
              載入選定的數據集
            </el-button>
          </div>
        </div>
        
        <el-empty v-else description="未找到可用的數據集" />
      </el-card>
      
      <el-card style="margin-top: 20px">
        <template #header>
          <div class="card-header">
            <span>💡 使用說明</span>
          </div>
        </template>
        
        <div class="help-content">
          <h4>功能介紹：</h4>
          <ul>
            <li><strong>機構官員組成</strong>：分析各機構的官員出身和旗分組成</li>
            <li><strong>職務路徑分析</strong>：查看官員的首次和最後任職機構分布</li>
            <li><strong>地區流動分析</strong>：分析官員在不同地區間的任職流動</li>
            <li><strong>職業生涯路徑</strong>：使用桑基圖展示完整的職業發展軌跡</li>
          </ul>
          
          <h4>數據集選擇建議：</h4>
          <ul>
            <li>選擇時間範圍較近的數據集可獲得更完整的記錄</li>
            <li>不同數據集可能包含不同時期的官員資料</li>
            <li>建議根據研究需求選擇對應時期的數據</li>
          </ul>
        </div>
      </el-card>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Loading } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  availableDatasets: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'dataset-selected'])

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const selectedDataset = ref('')
const loadingDataset = ref(false)

const getDatasetDisplayName = (filename) => {
  return filename.replace('.csv', '').replace(/CGED-Q Public Release\s*/, '')
}

const getDatasetDescription = (filename) => {
  const descriptions = {
    'CGED-Q Public Release 1760-1798  1 Jul 2024.csv': '包含乾隆25年至嘉慶3年期間的官員任職記錄，數據相對完整且經過詳細清理',
    'CGED-Q Public Release 1850-1864 19 Apr 2022.csv': '包含道光30年至同治3年期間的官員任職記錄，涵蓋太平天國時期重要歷史階段'
  }
  return descriptions[filename] || '清代官員任職記錄數據集'
}

const getDatasetSize = (filename) => {
  const sizes = {
    'CGED-Q Public Release 1760-1798  1 Jul 2024.csv': '約 50K+ 記錄',
    'CGED-Q Public Release 1850-1864 19 Apr 2022.csv': '約 30K+ 記錄'
  }
  return sizes[filename] || '數據量詳情待載入'
}

const loadSelectedDataset = async () => {
  if (!selectedDataset.value) {
    ElMessage.warning('請先選擇一個數據集')
    return
  }
  
  loadingDataset.value = true
  
  try {
    emit('dataset-selected', selectedDataset.value)
    ElMessage.success(`開始載入數據集: ${getDatasetDisplayName(selectedDataset.value)}`)
  } catch (error) {
    ElMessage.error(`載入數據集失敗: ${error.message}`)
  } finally {
    loadingDataset.value = false
  }
}

// 當數據集列表變化時，自動選擇第一個（如果沒有選擇的話）
watch(() => props.availableDatasets, (newDatasets) => {
  if (newDatasets.length > 0 && !selectedDataset.value) {
    selectedDataset.value = newDatasets[0]
  }
}, { immediate: true })
</script>

<style scoped>
.data-source-selector {
  padding: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  font-weight: 600;
  color: #303133;
  font-size: 16px;
}

.welcome-content h3 {
  margin: 0 0 15px 0;
  color: #303133;
  font-size: 20px;
}

.welcome-content p {
  margin: 0;
  color: #606266;
  line-height: 1.6;
}

.loading-container {
  text-align: center;
  padding: 40px 20px;
  color: #909399;
}

.loading-container .el-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.dataset-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border: 2px solid #e4e7ed;
  border-radius: 12px;
  margin-bottom: 15px;
  background: #fafbfc;
  cursor: pointer;
  transition: all 0.3s ease;
}

.dataset-item:hover {
  border-color: #409eff;
  background: #f0f9ff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}

.dataset-item.selected {
  border-color: #409eff;
  background: #f0f9ff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}

.dataset-info {
  flex: 1;
}

.dataset-info h4 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

.dataset-description {
  margin: 0 0 12px 0;
  color: #606266;
  font-size: 14px;
  line-height: 1.5;
}

.dataset-meta {
  display: flex;
  gap: 8px;
}

.dataset-select {
  margin-left: 15px;
}

.action-buttons {
  display: flex;
  justify-content: center;
}

.help-content h4 {
  margin: 15px 0 8px 0;
  color: #303133;
  font-size: 14px;
  font-weight: 600;
}

.help-content ul {
  padding-left: 20px;
  margin: 8px 0 15px 0;
}

.help-content li {
  margin: 6px 0;
  line-height: 1.5;
  color: #606266;
  font-size: 14px;
}

/* Radio 按鈕樣式 */
:deep(.el-radio) {
  margin-right: 0;
}

:deep(.el-radio__input) {
  transform: scale(1.2);
}
</style>