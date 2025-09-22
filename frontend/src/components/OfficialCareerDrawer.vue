<template>
  <el-drawer
    :model-value="visible"
    title="官員職務變遷"
    direction="rtl"
    size="100%"
    :before-close="handleClose"
    class="career-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="drawer-content">
      <!-- 搜索區域 -->
      <div class="search-section">
        <el-row :gutter="15">
          <el-col :span="8">
            <el-input
              v-model="searchQuery.surname"
              placeholder="搜索姓氏"
              clearable
              @input="handleSearch"
            >
              <template #prefix>
                <el-icon><User /></el-icon>
              </template>
            </el-input>
          </el-col>
          <el-col :span="8">
            <el-input
              v-model="searchQuery.name"
              placeholder="搜索名字"
              clearable
              @input="handleSearch"
            >
              <template #prefix>
                <el-icon><User /></el-icon>
              </template>
            </el-input>
          </el-col>
          <el-col :span="8">
            <el-input
              v-model="searchQuery.personUID"
              placeholder="搜索PersonUID"
              clearable
              @input="handleSearch"
            >
              <template #prefix>
                <el-icon><Key /></el-icon>
              </template>
            </el-input>
          </el-col>
        </el-row>
        <div class="search-stats">
          <el-tag type="info">
            找到 {{ filteredOfficials.length }} 位官員，共 {{ totalRecords }} 條記錄
          </el-tag>
          <el-tag type="success" v-if="selectedOfficials.size > 0">
            已選 {{ selectedOfficials.size }} 位官員
          </el-tag>
          <div class="button-group">
            <el-button @click="selectAllOfficials" size="small" :disabled="displayedOfficials.length === 0">
              全選
            </el-button>
            <el-button @click="clearAllOfficials" size="small" :disabled="selectedOfficials.size === 0">
              清空選擇
            </el-button>
            <el-button type="primary" size="small" @click="loadAllRecords" :loading="loading">
              載入所有職務記錄
            </el-button>
            <el-button 
              type="success" 
              size="small" 
              @click="applySelectionAndRedraw"
            >
              重畫圖表 ({{ selectedOfficials.size }})
            </el-button>
          </div>
        </div>
      </div>

      <!-- 官員列表 -->
      <div class="officials-list" v-loading="loading">
        <div 
          v-if="displayedOfficials.length > 0" 
          class="officials-container"
          v-infinite-scroll="loadMore"
          :infinite-scroll-disabled="loading || allLoaded"
          :infinite-scroll-distance="100"
        >
          <div 
            v-for="item in displayedOfficials" 
            :key="item.official.PersonUID"
            class="official-timeline-item"
            :class="{ 'selected': selectedOfficials.has(item.official.PersonUID), 'deselected': !selectedOfficials.has(item.official.PersonUID) && hasSelections }"
          >
            <div class="official-header">
              <el-checkbox 
                :model-value="selectedOfficials.has(item.official.PersonUID)"
                @change="toggleOfficialSelection(item.official.PersonUID)"
                class="official-checkbox"
              />
              <h3>{{ item.official.姓 }}{{ item.official.名 }}</h3>
              <el-tag size="small">{{ item.official.PersonUID }}</el-tag>
              <el-tag type="warning" size="small" v-if="item.official.旗分">
                {{ item.official.旗分 }}
              </el-tag>
              <el-tag 
                :type="getBackgroundLabel(item.official).type" 
                size="small"
                :title="getBackgroundLabel(item.official).description"
              >
                {{ getBackgroundLabel(item.official).text }}
              </el-tag>
            </div>
            
            <el-timeline class="career-timeline">
              <el-timeline-item
                v-for="(record, index) in item.records"
                :key="record.record_number"
                :timestamp="`記錄編號: ${record.record_number}`"
                placement="top"
              >
                <el-card class="timeline-card">
                  <div class="record-info">
                    <div class="record-row">
                      <span class="record-label">地區:</span>
                      <span class="record-value">{{ record.地區 || '未記錄' }}</span>
                    </div>
                    <div class="record-row">
                      <span class="record-label">機構:</span>
                      <span class="record-value">{{ record.機構一 || '未記錄' }}</span>
                    </div>
                    <div class="record-row">
                      <span class="record-label">官職:</span>
                      <span class="record-value primary">{{ record.官職一 || '未記錄' }}</span>
                    </div>
                    <div class="record-row" v-if="record.身份一">
                      <span class="record-label">身份:</span>
                      <span class="record-value">{{ record.身份一 }}</span>
                    </div>
                  </div>
                </el-card>
              </el-timeline-item>
            </el-timeline>
          </div>
          
          <!-- 加載更多提示 -->
          <div v-if="!allLoaded && !loading" class="load-more-hint">
            <el-text type="info">滿滿下拉加載更多...</el-text>
          </div>
          
          <div v-if="allLoaded && displayedOfficials.length > 0" class="load-complete-hint">
            <el-text type="success">已加載全部 {{ filteredOfficials.length }} 位官員</el-text>
          </div>
        </div>
        
        <el-empty v-else description="未找到符合條件的官員記錄" />
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { User, Key } from '@element-plus/icons-vue'
import { useDataStore } from '../stores/dataStore'
import { ElMessage } from 'element-plus'
import { getBackgroundLabel } from '../utils/dataUtils'

const props = defineProps({
  visible: Boolean,
  filterCriteria: Object
})

const emit = defineEmits(['update:visible', 'close', 'officials-changed'])

const dataStore = useDataStore()
const loading = ref(false)
const pageSize = ref(20)
const displayedCount = ref(pageSize.value)
const allLoaded = ref(false)

const searchQuery = ref({
  surname: '',
  name: '',
  personUID: ''
})

// 選擇的官員
const selectedOfficials = ref(new Set())

const hasSelections = computed(() => selectedOfficials.value.size > 0)

// 過濾官員
const filteredOfficials = computed(() => {
  let data = dataStore.processedData

  // 應用篩選條件
  if (props.filterCriteria) {
    data = dataStore.getFilteredData(props.filterCriteria)
  }

  // 應用搜索條件
  if (searchQuery.value.surname) {
    data = data.filter(d => d.姓 && d.姓.includes(searchQuery.value.surname))
  }
  if (searchQuery.value.name) {
    data = data.filter(d => d.名 && d.名.includes(searchQuery.value.name))
  }
  if (searchQuery.value.personUID) {
    data = data.filter(d => d.PersonUID && d.PersonUID.includes(searchQuery.value.personUID))
  }

  // 按PersonUID分組
  const officialGroups = {}
  data.forEach(record => {
    if (!officialGroups[record.PersonUID]) {
      officialGroups[record.PersonUID] = {
        official: record,
        records: []
      }
    }
    officialGroups[record.PersonUID].records.push(record)
  })

  // 對每個官員的記錄按record_number排序
  Object.values(officialGroups).forEach(group => {
    group.records.sort((a, b) => a.record_number - b.record_number)
  })

  return Object.values(officialGroups)
})

const totalRecords = computed(() => {
  return filteredOfficials.value.reduce((total, official) => total + official.records.length, 0)
})

const displayedOfficials = computed(() => {
  return filteredOfficials.value.slice(0, displayedCount.value)
})

const handleClose = () => {
  // 如果有選擇的官員，發送選擇變更事件
  if (selectedOfficials.value.size > 0 && selectedOfficials.value.size < filteredOfficials.value.length) {
    const selectedUIDs = Array.from(selectedOfficials.value)
    emit('officials-changed', selectedUIDs)
    ElMessage.success(`已更新選擇：保留 ${selectedOfficials.value.size} 位官員`)
  }
  
  emit('update:visible', false)
  emit('close')
}

const handleSearch = () => {
  displayedCount.value = pageSize.value
  allLoaded.value = false
}

const loadMore = () => {
  if (loading.value || allLoaded.value) return
  
  const newCount = displayedCount.value + pageSize.value
  if (newCount >= filteredOfficials.value.length) {
    displayedCount.value = filteredOfficials.value.length
    allLoaded.value = true
  } else {
    displayedCount.value = newCount
  }
}

const loadAllRecords = () => {
  loading.value = true
  
  setTimeout(() => {
    displayedCount.value = filteredOfficials.value.length
    allLoaded.value = true
    loading.value = false
    ElMessage.success(`已載入 ${filteredOfficials.value.length} 位官員的職務記錄`)
  }, 500)
}

// 監聽篩選條件變化
watch(() => props.filterCriteria, () => {
  displayedCount.value = pageSize.value
  allLoaded.value = false
}, { deep: true })

// 監聽過濾後的官員數量變化
watch(() => filteredOfficials.value.length, (newLength) => {
  if (displayedCount.value >= newLength) {
    allLoaded.value = true
  } else {
    allLoaded.value = false
  }
})

const toggleOfficialSelection = (personUID) => {
  if (selectedOfficials.value.has(personUID)) {
    selectedOfficials.value.delete(personUID)
  } else {
    selectedOfficials.value.add(personUID)
  }
  // 觸發響應式更新
  selectedOfficials.value = new Set(selectedOfficials.value)
}

const selectAllOfficials = () => {
  displayedOfficials.value.forEach(item => {
    selectedOfficials.value.add(item.official.PersonUID)
  })
  selectedOfficials.value = new Set(selectedOfficials.value)
  ElMessage.success(`已選擇 ${displayedOfficials.value.length} 位官員`)
}

const clearAllOfficials = () => {
  selectedOfficials.value.clear()
  selectedOfficials.value = new Set(selectedOfficials.value)
  ElMessage.info('已清空所有選擇')
}

const applySelectionAndRedraw = () => {
  const selectedUIDs = Array.from(selectedOfficials.value)
  const totalCount = filteredOfficials.value.length
  
  // 計算要下架的官員（未選中的）
  const allUIDs = filteredOfficials.value.map(item => item.official.PersonUID)
  const deselectedUIDs = allUIDs.filter(uid => !selectedUIDs.includes(uid))
  
  if (deselectedUIDs.length === 0) {
    ElMessage.info('未選擇要下架的官員')
    return
  }
  
  if (deselectedUIDs.length === totalCount) {
    // 全部下架
    emit('officials-changed', deselectedUIDs)
    ElMessage.warning(`下架全部 ${totalCount} 位官員`)
    return
  }
  
  // 部分下架
  emit('officials-changed', deselectedUIDs)
  ElMessage.success(`下架 ${deselectedUIDs.length} 位官員，保留 ${selectedUIDs.length} 位`)
  
  // 可選：關閉抽屜
  // emit('update:visible', false)
}

// 初始載入
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // 抽屜打開時的邏輯
    displayedCount.value = pageSize.value
    allLoaded.value = false
    
    // 預設選擇所有官員
    selectedOfficials.value = new Set(filteredOfficials.value.map(item => item.official.PersonUID))
  }
})
</script>

<style scoped>
.career-drawer :deep(.el-drawer__body) {
  padding: 0;
}

.drawer-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.search-section {
  padding: 20px;
  background: white;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.search-stats {
  margin-top: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.button-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.officials-list {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.officials-container {
  max-height: calc(100vh - 400px);
  overflow-y: auto;
}

.official-timeline-item {
  margin-bottom: 30px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.official-timeline-item.selected {
  border-color: #409eff;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.15);
}

.official-timeline-item.deselected {
  opacity: 0.4;
  background-color: #f5f7fa;
}

.official-header {
  background: #f8f9fa;
  padding: 15px 20px;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  gap: 10px;
}

.official-checkbox {
  flex-shrink: 0;
}

.official-timeline-item.selected .official-header {
  background: #ecf5ff;
}

.official-header h3 {
  margin: 0;
  color: #303133;
  font-size: 16px;
}

.career-timeline {
  padding: 20px;
}

.timeline-card {
  margin-top: 10px;
}

.record-info {
  line-height: 1.6;
}

.record-row {
  display: flex;
  margin-bottom: 8px;
}

.record-label {
  width: 60px;
  color: #666;
  font-weight: 500;
  flex-shrink: 0;
}

.record-value {
  flex: 1;
  color: #303133;
}

.record-value.primary {
  color: #409eff;
  font-weight: 600;
}

.load-more-hint,
.load-complete-hint {
  text-align: center;
  padding: 20px;
  border-top: 1px solid #e4e7ed;
  background: #f8f9fa;
}

.career-timeline :deep(.el-timeline-item__timestamp) {
  font-weight: 600;
  color: #409eff;
}

.career-timeline :deep(.el-timeline-item__node) {
  background-color: #409eff;
  border-color: #409eff;
}
</style>