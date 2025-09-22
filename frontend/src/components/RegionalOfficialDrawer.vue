<template>
  <el-drawer
    :model-value="visible"
    title="機構官員篩選器"
    direction="rtl"
    size="100%"
    :before-close="handleClose"
    class="regional-drawer"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div class="drawer-content">
      <!-- 搜索區域 -->
      <div class="search-section">
        <el-row :gutter="15">
          <el-col :span="6">
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
          <el-col :span="6">
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
          <el-col :span="6">
            <el-select
              v-model="searchQuery.institution"
              placeholder="選擇機構"
              clearable
              @change="handleSearch"
            >
              <el-option
                v-for="institution in uniqueInstitutions"
                :key="institution"
                :label="institution"
                :value="institution"
              />
            </el-select>
          </el-col>
          <el-col :span="6">
            <el-select
              v-model="searchQuery.position"
              placeholder="選擇官職"
              clearable
              @change="handleSearch"
            >
              <el-option
                v-for="position in uniquePositions"
                :key="position"
                :label="position"
                :value="position"
              />
            </el-select>
          </el-col>
        </el-row>
        <el-row :gutter="15" style="margin-top: 10px;">
          <el-col :span="6">
            <el-select
              v-model="searchQuery.region"
              placeholder="選擇地區"
              clearable
              @change="handleSearch"
            >
              <el-option
                v-for="region in uniqueRegions"
                :key="region"
                :label="region"
                :value="region"
              />
            </el-select>
          </el-col>
          <el-col :span="6">
            <el-select
              v-model="searchQuery.banner"
              placeholder="選擇旗分"
              clearable
              @change="handleSearch"
            >
              <el-option
                v-for="banner in uniqueBanners"
                :key="banner"
                :label="banner || '(無旗分)'"
                :value="banner"
              />
            </el-select>
          </el-col>
          <el-col :span="6">
            <el-select
              v-model="searchQuery.background"
              placeholder="選擇出身"
              clearable
              @change="handleSearch"
            >
              <el-option
                v-for="background in uniqueBackgrounds"
                :key="background"
                :label="background"
                :value="background"
              />
            </el-select>
          </el-col>
          <el-col :span="6">
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
              載入所有記錄
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
            class="official-item"
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
            
            <!-- 官員記錄表格 -->
            <div class="records-table">
              <el-table 
                :data="item.records.slice(0, showAllRecords ? item.records.length : 3)"
                size="small"
                stripe
                style="width: 100%"
              >
                <el-table-column prop="record_number" label="記錄編號" width="80" />
                <el-table-column prop="地區" label="地區" width="100">
                  <template #default="scope">
                    {{ scope.row.地區 || '-' }}
                  </template>
                </el-table-column>
                <el-table-column prop="機構一" label="機構" width="120">
                  <template #default="scope">
                    {{ scope.row.機構一 || '-' }}
                  </template>
                </el-table-column>
                <el-table-column prop="官職一" label="官職" width="120">
                  <template #default="scope">
                    <span class="position-text">{{ scope.row.官職一 || '-' }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="身份一" label="身份" width="100">
                  <template #default="scope">
                    {{ scope.row.身份一 || '-' }}
                  </template>
                </el-table-column>
                <el-table-column label="其他資訊" min-width="150">
                  <template #default="scope">
                    <div class="other-info">
                      <el-tag v-if="scope.row.機構二" size="mini" type="info">
                        {{ scope.row.機構二 }}
                      </el-tag>
                      <el-tag v-if="scope.row.官職二" size="mini" type="warning">
                        {{ scope.row.官職二 }}
                      </el-tag>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
              
              <!-- 展開/收起按鈕 -->
              <div v-if="item.records.length > 3" class="expand-button">
                <el-button 
                  type="text" 
                  size="small" 
                  @click="toggleRecordsExpansion(item.official.PersonUID)"
                >
                  {{ expandedOfficials.has(item.official.PersonUID) ? '收起' : `展開全部 ${item.records.length} 條記錄` }}
                </el-button>
              </div>
            </div>
          </div>
          
          <!-- 加載更多提示 -->
          <div v-if="!allLoaded && !loading" class="load-more-hint">
            <el-text type="info">滾動下拉加載更多...</el-text>
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
const showAllRecords = ref(false)
const expandedOfficials = ref(new Set())

const searchQuery = ref({
  surname: '',
  name: '',
  personUID: '',
  institution: '',
  position: '',
  region: '',
  banner: '',
  background: ''
})

// 選擇的官員
const selectedOfficials = ref(new Set())

const hasSelections = computed(() => selectedOfficials.value.size > 0)

// 計算唯一值選項
const uniqueInstitutions = computed(() => {
  const institutions = [...new Set(dataStore.processedData.map(d => d.機構一).filter(Boolean))]
  return institutions.sort()
})

const uniquePositions = computed(() => {
  const positions = [...new Set(dataStore.processedData.map(d => d.官職一).filter(Boolean))]
  return positions.sort()
})

const uniqueRegions = computed(() => {
  const regions = [...new Set(dataStore.processedData.map(d => d.地區).filter(Boolean))]
  return regions.sort()
})

const uniqueBanners = computed(() => {
  const banners = [...new Set(dataStore.processedData.map(d => d.旗分).filter(Boolean))]
  return banners.sort()
})

const uniqueBackgrounds = computed(() => {
  const backgrounds = [...new Set(dataStore.processedData.map(d => getBackgroundLabel(d).text).filter(Boolean))]
  return backgrounds.sort()
})

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
  if (searchQuery.value.institution) {
    data = data.filter(d => d.機構一 === searchQuery.value.institution)
  }
  if (searchQuery.value.position) {
    data = data.filter(d => d.官職一 === searchQuery.value.position)
  }
  if (searchQuery.value.region) {
    data = data.filter(d => d.地區 === searchQuery.value.region)
  }
  if (searchQuery.value.banner) {
    data = data.filter(d => d.旗分 === searchQuery.value.banner)
  }
  if (searchQuery.value.background) {
    data = data.filter(d => getBackgroundLabel(d).text === searchQuery.value.background)
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
  return filteredOfficials.value.slice(0, displayedCount.value).map(official => {
    const isExpanded = expandedOfficials.value.has(official.official.PersonUID)
    return {
      ...official,
      displayedRecords: isExpanded ? official.records : official.records.slice(0, 3)
    }
  })
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

const toggleRecordsExpansion = (personUID) => {
  if (expandedOfficials.value.has(personUID)) {
    expandedOfficials.value.delete(personUID)
  } else {
    expandedOfficials.value.add(personUID)
  }
  expandedOfficials.value = new Set(expandedOfficials.value)
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
.regional-drawer :deep(.el-drawer__body) {
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

.official-item {
  margin-bottom: 20px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.official-item.selected {
  border-color: #409eff;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.15);
}

.official-item.deselected {
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

.official-item.selected .official-header {
  background: #ecf5ff;
}

.official-header h3 {
  margin: 0;
  color: #303133;
  font-size: 16px;
}

.records-table {
  padding: 15px;
}

.position-text {
  color: #409eff;
  font-weight: 600;
}

.other-info {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}

.expand-button {
  text-align: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e4e7ed;
}

.load-more-hint,
.load-complete-hint {
  text-align: center;
  padding: 20px;
  border-top: 1px solid #e4e7ed;
  background: #f8f9fa;
}
</style>