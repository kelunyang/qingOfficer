<template>
  <div id="app">
    <el-container class="app-container">
      <el-header class="app-header">
        <h1>清代官員數據可視化系統</h1>
        <div class="header-controls">
          <el-button 
            type="primary" 
            plain
            @click="dataSourceSelectorVisible = true"
            size="small"
            style="margin-right: 15px"
            :disabled="dataStore.loading"
          >
            <el-icon><FolderOpened /></el-icon>
            {{ selectedDataset ? `當前: ${getDatasetDisplayName(selectedDataset)}` : '選擇數據集' }}
          </el-button>
          
          <!-- 鎖定統計名單按鈕 -->
          <el-button 
            v-if="dataStore.hasAvailableLockList"
            type="warning" 
            @click="lockCurrentList"
            size="small"
            style="margin-right: 15px"
          >
            <el-icon><Lock /></el-icon>
            鎖定統計名單 ({{ dataStore.lockedPersonCount }})
          </el-button>
          
          <!-- 解鎖按鈕 -->
          <el-button 
            v-if="dataStore.isListLocked"
            type="danger" 
            @click="unlockList"
            size="small"
            style="margin-right: 15px"
          >
            <el-icon><Unlock /></el-icon>
            解鎖名單
          </el-button>
          
          <!-- 儲存過濾器按鈕 -->
          <el-button 
            type="success" 
            plain
            @click="saveCurrentFilters"
            size="small"
            style="margin-right: 15px"
            :disabled="!dataStore.currentDataset"
            class="filter-save-button"
          >
            <el-icon><Download /></el-icon>
            儲存過濾器
          </el-button>
          
          <!-- 載入過濾器按鈕 -->
          <el-button 
            type="info" 
            plain
            @click="filterDrawerVisible = true"
            size="small"
            style="margin-right: 15px"
            :disabled="!hasAnyFilters"
            class="filter-save-button"
          >
            <el-icon><Upload /></el-icon>
            載入過濾器
          </el-button>
          
          <el-button 
            type="info" 
            plain 
            @click="styleDrawerVisible = true"
            size="small"
            style="margin-right: 15px"
          >
            <el-icon><Setting /></el-icon>
            圖表樣式設定
          </el-button>
          
          <el-button 
            type="primary" 
            @click="careerDrawerVisible = true" 
            :disabled="!dataStore.processedData.length || dataStore.isListLocked"
          >
            <el-icon><Search /></el-icon>
            官員職務查詢
          </el-button>
        </div>
      </el-header>
      
      <el-main class="app-main" v-loading="dataStore.loading" element-loading-text="正在載入數據..." element-loading-background="rgba(255, 255, 255, 0.9)">
        <!-- 鎖定模式提示 -->
        <el-alert
          v-if="dataStore.isListLocked"
          title="已啟用鎖定統計名單"
          type="warning"
          :description="`當前鎖定了 ${dataStore.lockedPersonCount} 位官員（來源：${dataStore.lockedListSource}），所有圖表將僅顯示這些官員的數據。篩選器已被禁用。`"
          show-icon
          :closable="false"
          style="margin-bottom: 20px"
        />
        
        <!-- 未載入數據集時的提示 -->
        <el-card v-if="!dataStore.currentDataset && !dataStore.loading" class="welcome-card">
          <div class="welcome-content">
            <el-empty description="尚未載入數據集">
              <template #image>
                <el-icon size="64" color="#c0c4cc"><FolderOpened /></el-icon>
              </template>
              <template #description>
                <p>請點擊上方的「選擇數據集」按鈕來載入清代官員數據</p>
              </template>
              <el-button 
                type="primary" 
                @click="dataSourceSelectorVisible = true"
                size="large"
              >
                <el-icon><FolderOpened /></el-icon>
                選擇數據集
              </el-button>
            </el-empty>
          </div>
        </el-card>
        
        <el-tabs v-else v-model="activeTab" class="chart-tabs" :class="{ 'locked-mode': dataStore.isListLocked }">
          <el-tab-pane label="機構官員組成" name="institutional">
            <el-card class="full-height-card" v-if="activeTab === 'institutional'">
              <template #header>
                <div class="card-header">
                  <span>各機構官員出身與旗分組成</span>
                </div>
              </template>
              <RegionalOfficialChart 
                ref="regionalChartRef"
                @selection-changed="handleRegionalSelection" 
              />
            </el-card>
          </el-tab-pane>
          
          <el-tab-pane label="職務路徑分析" name="career">
            <el-card class="full-height-card" v-if="activeTab === 'career'">
              <template #header>
                <div class="card-header">
                  <span>出身與職務路徑分析</span>
                </div>
              </template>
              <CareerPathChart 
                ref="careerPathChartRef"
                @selection-changed="handleCareerPathSelection" 
              />
            </el-card>
          </el-tab-pane>
          
          <el-tab-pane label="地區流動分析" name="regional">
            <el-card class="full-height-card" v-if="activeTab === 'regional'">
              <template #header>
                <div class="card-header">
                  <span>官員任職地區流動分析</span>
                </div>
              </template>
              <RegionalFlowChart 
                ref="regionalFlowChartRef"
                @selection-changed="handleRegionalFlowSelection" 
              />
            </el-card>
          </el-tab-pane>
          
          <el-tab-pane label="職業生涯路徑" name="alluvial">
            <el-card class="full-height-card" v-if="activeTab === 'alluvial'">
              <template #header>
                <div class="card-header">
                  <span>官員職業生涯流動路徑 (Alluvial圖)</span>
                </div>
              </template>
              <CareerAlluvialChart 
                ref="alluvialChartRef"
                @selection-changed="handleAlluvialSelection" 
                :filter-criteria="selectedCriteria"
              />
            </el-card>
          </el-tab-pane>
        </el-tabs>
      </el-main>
      
      <!-- 官員職務變遷抽屜 -->
      <OfficialCareerDrawer 
        v-model:visible="careerDrawerVisible"
        :filter-criteria="selectedCriteria"
        @close="careerDrawerVisible = false"
        @officials-changed="handleOfficialsChanged"
      />
      
      <!-- 圖表樣式設定抽屜 -->
      <el-drawer
        v-model="styleDrawerVisible"
        title="圖表樣式設定"
        direction="rtl"
        size="400px"
      >
        <div class="style-settings">
          <el-card>
            <template #header>
              <div class="card-header">
                <span>🎨 全域配色設定</span>
              </div>
            </template>
            
            <div class="setting-item">
              <label>配色模式</label>
              <el-radio-group v-model="dataStore.printMode" size="small">
                <el-radio-button :label="false">彩色模式</el-radio-button>
                <el-radio-button :label="true">列印模式</el-radio-button>
              </el-radio-group>
            </div>
            
            <div class="setting-item">
              <label>配色主題</label>
              <el-select v-model="dataStore.currentTheme" placeholder="選擇主題" size="small">
                <el-option label="經典配色" value="classic" />
                <el-option label="現代配色" value="modern" />
                <el-option label="學術配色" value="academic" />
                <el-option label="柔和配色" value="soft" />
                <el-option label="對比配色" value="contrast" />
              </el-select>
            </div>
            
            <div class="setting-item" v-if="dataStore.printMode">
              <label>桑基圖線段樣式模式</label>
              <el-radio-group v-model="dataStore.sankeyLineStyleMode" size="small">
                <el-radio-button label="thickness">按粗細</el-radio-button>
                <el-radio-button label="stage">按階段</el-radio-button>
              </el-radio-group>
              <div style="margin-top: 8px; font-size: 12px; color: #909399;">
                按粗細：相同寬度的線段使用相同虛線樣式<br>
                按階段：相同出發階段的線段使用相同虛線樣式
              </div>
            </div>
            
            <div class="setting-item" v-if="dataStore.printMode">
              <el-alert
                title="列印模式說明"
                type="info"
                :closable="false"
                show-icon
              >
                <template #default>
                  <p>列印模式將使用黑白圖案紋理替代顏色，適合：</p>
                  <ul>
                    <li>• 黑白印刷</li>
                    <li>• 色盲友好顯示</li>
                    <li>• 正式文件發表</li>
                  </ul>
                </template>
              </el-alert>
            </div>
          </el-card>
          
          <el-card style="margin-top: 20px">
            <template #header>
              <div class="card-header">
                <span>📊 圖表操作說明</span>
              </div>
            </template>
            
            <div class="help-content">
              <p><strong>每個圖表都有獨立的控制項：</strong></p>
              <ul>
                <li>• <strong>列印版切換</strong>：單獨控制該圖表的列印模式</li>
                <li>• <strong>SVG輸出</strong>：匯出向量格式，適合編輯</li>
                <li>• <strong>PNG輸出</strong>：匯出點陣圖，適合插入文件</li>
              </ul>
              <p><strong>建議流程：</strong></p>
              <ol>
                <li>在此處選擇全域配色主題</li>
                <li>到各圖表調整具體設定和篩選</li>
                <li>使用圖表的輸出功能保存結果</li>
              </ol>
            </div>
          </el-card>
        </div>
      </el-drawer>
      
      <!-- 過濾器管理抽屜 -->
      <el-drawer
        v-model="filterDrawerVisible"
        title="過濾器管理"
        direction="rtl"
        size="400px"
      >
        <div class="filter-management">
          <el-card>
            <template #header>
              <div class="card-header">
                <span>💾 已儲存的過濾器</span>
              </div>
            </template>
            
            <div v-if="savedFiltersList.length > 0">
              <div 
                v-for="filter in savedFiltersList" 
                :key="filter.chartName"
                class="filter-item"
              >
                <div class="filter-info">
                  <h4>{{ getChartDisplayName(filter.chartName) }}</h4>
                  <p class="filter-time">{{ formatTimestamp(filter.timestamp) }}</p>
                </div>
                <div class="filter-actions">
                  <el-button 
                    type="primary" 
                    size="small" 
                    @click="loadFilter(filter.chartName)"
                  >
                    載入
                  </el-button>
                  <el-button 
                    type="danger" 
                    size="small" 
                    @click="deleteFilter(filter.chartName)"
                  >
                    刪除
                  </el-button>
                </div>
              </div>
            </div>
            
            <el-empty v-else description="尚未儲存任何過濾器" />
          </el-card>
          
          <el-card style="margin-top: 20px">
            <template #header>
              <div class="card-header">
                <span>📝 使用說明</span>
              </div>
            </template>
            
            <div class="help-content">
              <p><strong>過濾器儲存功能：</strong></p>
              <ul>
                <li>• 每個圖表的過濾器設定可以單獨儲存</li>
                <li>• 按數據集分組，不同數據集的設定不會互相干擾</li>
                <li>• 儲存的設定包括所有篩選條件和顯示選項</li>
                <li>• 載入時會自動切換到對應的圖表標籤</li>
              </ul>
              <p><strong>注意事項：</strong></p>
              <ul>
                <li>• 鎖定模式下無法儲存或載入過濾器</li>
                <li>• 切換數據集時會顯示對應的儲存設定</li>
                <li>• 設定儲存在瀏覽器本地，清除瀏覽器數據會遺失</li>
              </ul>
            </div>
          </el-card>
        </div>
      </el-drawer>
      
      <!-- 數據源選擇器 -->
      <DataSourceSelector
        v-model="dataSourceSelectorVisible"
        :available-datasets="dataStore.availableDatasets"
        :loading="dataStore.loading"
        @dataset-selected="handleDatasetSelection"
      />
    </el-container>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { Search, Setting, Lock, Unlock, Download, Upload, FolderOpened } from '@element-plus/icons-vue'
import { useDataStore } from './stores/dataStore'
import { ElMessage } from 'element-plus'
import OfficialCareerDrawer from './components/OfficialCareerDrawer.vue'
import RegionalOfficialChart from './components/RegionalOfficialChart.vue'
import CareerPathChart from './components/CareerPathChart.vue'
import RegionalFlowChart from './components/RegionalFlowChart.vue'
import CareerAlluvialChart from './components/CareerAlluvialChart.vue'
import DataSourceSelector from './components/DataSourceSelector.vue'

const dataStore = useDataStore()
const careerDrawerVisible = ref(false)
const styleDrawerVisible = ref(false)
const filterDrawerVisible = ref(false)
const dataSourceSelectorVisible = ref(false)
const selectedDataset = ref('')
const activeTab = ref('institutional')

// 圖表組件引用
const regionalChartRef = ref(null)
const careerPathChartRef = ref(null)
const regionalFlowChartRef = ref(null)
const alluvialChartRef = ref(null)

const selectedCriteria = reactive({
  region: '',
  position: '',
  background: '',
  banner: '',
  institution: '',
  excludedPersonUIDs: [] // 修改：要排除的官員UID列表（累積）
})

const getDatasetDisplayName = (filename) => {
  return filename.replace('.csv', '').replace(/CGED-Q Public Release\s*/, '')
}

const handleDatasetChange = async (filename) => {
  if (filename) {
    try {
      await dataStore.loadDataset(filename)
      ElMessage.success(`數據集載入成功: ${getDatasetDisplayName(filename)}`)
    } catch (error) {
      ElMessage.error(`數據集載入失敗: ${error.message}`)
    }
  }
}

const handleDatasetSelection = async (filename) => {
  if (filename) {
    try {
      selectedDataset.value = filename
      await dataStore.loadDataset(filename)
      dataSourceSelectorVisible.value = false
      ElMessage.success(`數據集載入成功: ${getDatasetDisplayName(filename)}`)
    } catch (error) {
      ElMessage.error(`數據集載入失敗: ${error.message}`)
    }
  }
}

const handleRegionalSelection = (criteria) => {
  Object.assign(selectedCriteria, criteria)
  // 設置可鎖定名單 - 獲取篩選後的人員名單
  setLockableListFromCriteria(criteria, '機構官員組成圖表')
  careerDrawerVisible.value = true
}

const handleCareerPathSelection = (criteria) => {
  Object.assign(selectedCriteria, criteria)
  setLockableListFromCriteria(criteria, '職務路徑分析圖表')
  careerDrawerVisible.value = true
}

const handleRegionalFlowSelection = (criteria) => {
  Object.assign(selectedCriteria, criteria)
  setLockableListFromCriteria(criteria, '地區流動分析圖表')
  careerDrawerVisible.value = true
}

const handleAlluvialSelection = (criteria) => {
  Object.assign(selectedCriteria, criteria)
  // 注意：桑基圖會自己設置可鎖定名單，這裡不需要再次設置
  // setLockableListFromCriteria(criteria, '職業生涯路徑圖表')
  careerDrawerVisible.value = true
}

const handleOfficialsChanged = (deselectedUIDs) => {
  // 累積排除的官員UID（購物車下架）
  deselectedUIDs.forEach(uid => {
    if (!selectedCriteria.excludedPersonUIDs.includes(uid)) {
      selectedCriteria.excludedPersonUIDs.push(uid)
    }
  })
  
  console.log('🔄 App.vue - 累積排除的官員:', selectedCriteria.excludedPersonUIDs.length, 'UIDs')
  console.log('🔄 本次下架:', deselectedUIDs.length, 'UIDs')
  
  // 重要：當剔除官員後，需要更新可鎖定名單
  if (deselectedUIDs.length > 0) {
    console.log('🔄 更新可鎖定名單以排除被剔除的官員')
    
    // 檢查可鎖定名單來源是否為桑基圖
    if (dataStore.lockedListSource && dataStore.lockedListSource.includes('桑基圖')) {
      // 桑基圖來源：從現有可鎖定名單中排除被剔除的官員
      console.log('🎯 來源是桑基圖，直接從可鎖定名單中排除被剔除的官員')
      const remainingUIDs = [...dataStore.lockedPersonUIDs].filter(uid => !selectedCriteria.excludedPersonUIDs.includes(uid))
      dataStore.setLockableList(remainingUIDs, `${dataStore.lockedListSource} (已剔除${selectedCriteria.excludedPersonUIDs.length}位)`)
    } else {
      // 其他圖表來源：使用篩選條件重新計算
      console.log('🔄 來源是其他圖表，使用篩選條件重新計算可鎖定名單')
      setLockableListFromCriteria(selectedCriteria, `${dataStore.lockedListSource || '圖表'} (已剔除${selectedCriteria.excludedPersonUIDs.length}位)`)
    }
    
    // 如果當前是桑基圖tab，強制觸發桑基圖重新渲染
    if (activeTab.value === 'alluvial' && alluvialChartRef.value) {
      console.log('🎯 強制觸發桑基圖重新渲染')
      setTimeout(() => {
        if (alluvialChartRef.value && alluvialChartRef.value.renderChart) {
          alluvialChartRef.value.renderChart()
        }
      }, 100)
    }
    
    ElMessage.success(`已下架 ${deselectedUIDs.length} 位官員，累計排除 ${selectedCriteria.excludedPersonUIDs.length} 位`)
    ElMessage.info(`可鎖定名單已更新：剩餘 ${dataStore.lockedPersonCount} 位官員`)
  }
}

// 鎖定名單相關方法
const setLockableListFromCriteria = (criteria, source) => {
  if (dataStore.isListLocked) return // 如果已經鎖定，不要重新設置
  
  try {
    console.log('🔍 設置可鎖定名單 - 收到的 criteria:', criteria)
    
    // 獲取篩選後的數據
    const filteredData = dataStore.getFilteredData(criteria)
    console.log(`🔍 篩選後的數據量: ${filteredData.length} 條記錄`)
    
    // 提取唯一的 PersonUID
    const personUIDs = [...new Set(filteredData.map(d => d.PersonUID).filter(Boolean))]
    console.log(`🔍 提取到的唯一 PersonUID 數量: ${personUIDs.length}`)
    
    if (personUIDs.length > 0) {
      dataStore.setLockableList(personUIDs, source)
      console.log(`📋 設置可鎖定名單: ${personUIDs.length} 位官員，來源: ${source}`)
      console.log(`📋 前10個 PersonUID:`, personUIDs.slice(0, 10))
    } else {
      console.warn('⚠️ 沒有找到任何 PersonUID，無法設置鎖定名單')
    }
  } catch (error) {
    console.error('設置可鎖定名單時發生錯誤:', error)
  }
}

const lockCurrentList = () => {
  console.log(`🔒 嘗試鎖定名單，當前可鎖定人數: ${dataStore.lockedPersonCount}`)
  console.log(`🔒 鎖定來源: ${dataStore.lockedListSource}`)
  
  const success = dataStore.lockCurrentList()
  if (success) {
    console.log(`🔒 鎖定成功！鎖定了 ${dataStore.lockedPersonCount} 位官員`)
    ElMessage.success(`已鎖定 ${dataStore.lockedPersonCount} 位官員的統計名單，來源：${dataStore.lockedListSource}`)
  } else {
    console.warn('🔒 鎖定失敗，沒有可鎖定的名單')
    ElMessage.error('沒有可鎖定的名單')
  }
}

const unlockList = () => {
  dataStore.unlockList()
  // 清除排除名單
  selectedCriteria.excludedPersonUIDs = []
  ElMessage.info('已解鎖統計名單，恢復所有篩選功能')
}

// 過濾器儲存相關
const savedFiltersList = computed(() => {
  return dataStore.getAllSavedFilters()
})

const hasAnyFilters = computed(() => {
  return savedFiltersList.value.length > 0
})

const getChartDisplayName = (chartName) => {
  const names = {
    'institutional': '機構官員組成',
    'career': '職務路徑分析',
    'regional': '地區流動分析',
    'alluvial': '職業生涯路徑'
  }
  return names[chartName] || chartName
}

const getChartTabName = (chartName) => {
  const tabs = {
    'institutional': 'institutional',
    'career': 'career',
    'regional': 'regional',
    'alluvial': 'alluvial'
  }
  return tabs[chartName] || 'institutional'
}

const formatTimestamp = (timestamp) => {
  return new Date(timestamp).toLocaleString('zh-TW')
}

const saveCurrentFilters = () => {
  if (!dataStore.currentDataset) {
    ElMessage.error('請先選擇數據集')
    return
  }
  
  if (dataStore.isListLocked) {
    ElMessage.error('鎖定模式下無法儲存過濾器')
    return
  }
  
  let success = false
  
  // 根據當前 tab 儲存對應圖表的過濾器
  try {
    if (activeTab.value === 'institutional' && regionalChartRef.value) {
      const filterState = regionalChartRef.value.getFilterState()
      if (dataStore.saveChartFilter('institutional', filterState)) {
        success = true
      }
    } else if (activeTab.value === 'career' && careerPathChartRef.value) {
      const filterState = careerPathChartRef.value.getFilterState()
      if (dataStore.saveChartFilter('career', filterState)) {
        success = true
      }
    } else if (activeTab.value === 'regional' && regionalFlowChartRef.value) {
      const filterState = regionalFlowChartRef.value.getFilterState()
      if (dataStore.saveChartFilter('regional', filterState)) {
        success = true
      }
    } else if (activeTab.value === 'alluvial' && alluvialChartRef.value) {
      const filterState = alluvialChartRef.value.getFilterState()
      if (dataStore.saveChartFilter('alluvial', filterState)) {
        success = true
      }
    }
    
    if (success) {
      ElMessage.success(`已儲存 ${getChartDisplayName(activeTab.value)} 的過濾器設定`)
    } else {
      ElMessage.error('儲存過濾器失敗，請檢查圖表是否正確載入')
    }
  } catch (error) {
    console.error('儲存過濾器時發生錯誤:', error)
    ElMessage.error('儲存過濾器時發生錯誤')
  }
}

const loadFilter = (chartName) => {
  try {
    const filterState = dataStore.loadChartFilter(chartName)
    if (!filterState) {
      ElMessage.error('找不到對應的過濾器設定')
      return
    }
    
    // 切換到對應的 tab
    const tabName = getChartTabName(chartName)
    activeTab.value = tabName
    
    // 等待 tab 切換完成後載入過濾器
    setTimeout(() => {
      let success = false
      
      if (chartName === 'institutional' && regionalChartRef.value) {
        regionalChartRef.value.setFilterState(filterState)
        success = true
      } else if (chartName === 'career' && careerPathChartRef.value) {
        careerPathChartRef.value.setFilterState(filterState)
        success = true
      } else if (chartName === 'regional' && regionalFlowChartRef.value) {
        regionalFlowChartRef.value.setFilterState(filterState)
        success = true
      } else if (chartName === 'alluvial' && alluvialChartRef.value) {
        alluvialChartRef.value.setFilterState(filterState)
        success = true
      }
      
      if (success) {
        ElMessage.success(`已載入 ${getChartDisplayName(chartName)} 的過濾器設定`)
        filterDrawerVisible.value = false
      } else {
        ElMessage.error('載入過濾器失敗，請重試')
      }
    }, 100)
  } catch (error) {
    console.error('載入過濾器時發生錯誤:', error)
    ElMessage.error('載入過濾器時發生錯誤')
  }
}

const deleteFilter = (chartName) => {
  if (dataStore.clearChartFilter(chartName)) {
    ElMessage.success(`已刪除 ${getChartDisplayName(chartName)} 的過濾器設定`)
  } else {
    ElMessage.error('刪除過濾器失敗')
  }
}

onMounted(async () => {
  // 載入儲存的過濾器
  dataStore.loadFiltersFromLocalStorage()
  
  await dataStore.scanDatasets()
  // 顯示數據源選擇器，不自動載入數據集
  dataSourceSelectorVisible.value = true
})
</script>

<style>
/* 全局樣式確保頁面可以滾動 */
html, body {
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

#app {
  overflow: visible;
}
</style>

<style scoped>
.app-container {
  min-height: 100vh;
  background: #f5f7fa;
}

.app-header {
  background: white;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.header-controls {
  display: flex;
  align-items: center;
}

.app-header h1 {
  margin: 0;
  color: #303133;
  font-size: 24px;
  font-weight: 600;
}

.app-main {
  padding: 20px;
}

.chart-tabs {
  /* 移除固定高度 */
}

.chart-tabs :deep(.el-tabs__content) {
  padding: 0;
}

.chart-tabs :deep(.el-tab-pane) {
  /* 移除固定高度 */
}

.chart-row {
  /* 移除固定高度 */
}

.chart-card {
  /* 移除固定高度 */
}

.full-height-card {
  /* 移除固定高度 */
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #303133;
}

.chart-card :deep(.el-card__body) {
  padding: 20px;
}

.full-height-card :deep(.el-card__body) {
  padding: 20px;
}

/* 主題下拉框樣式 */
:deep(.el-dropdown-menu__item.is-active) {
  background-color: #ecf5ff;
  color: #409eff;
  font-weight: 600;
}

:deep(.el-dropdown-menu__item.is-active::before) {
  content: '✓';
  margin-right: 8px;
  color: #409eff;
  font-weight: bold;
}

/* 樣式設定抽屜 */
.style-settings {
  padding: 20px;
}

.setting-item {
  margin-bottom: 20px;
}

.setting-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
  color: #303133;
}

.help-content ul, .help-content ol {
  padding-left: 20px;
  margin: 10px 0;
}

.help-content li {
  margin: 5px 0;
  line-height: 1.5;
}

/* 鎖定模式樣式 */
.locked-mode {
  opacity: 0.9;
}

.locked-mode :deep(.el-tabs__nav) {
  border-bottom: 2px solid #e6a23c;
}

.locked-mode :deep(.el-tab-pane) {
  position: relative;
}

/* 鎖定模式下禁用篩選器樣式 */
.locked-mode :deep(.el-select),
.locked-mode :deep(.el-input),
.locked-mode :deep(.el-radio-group),
.locked-mode :deep(.el-switch),
.locked-mode :deep(.el-button) {
  pointer-events: none;
  opacity: 0.6;
}

/* 但是輸出按鈕和非過濾功能仍然可用 */
.locked-mode :deep(.el-button[type="primary"]),
.locked-mode :deep(.el-button[type="success"]),
.locked-mode :deep(.el-button[type="info"]),
.locked-mode :deep(.el-button[type="warning"]),
.locked-mode :deep(.el-button[type="danger"]),
.locked-mode :deep(.el-button.export-button),
.locked-mode :deep(.el-button.theme-button),
.locked-mode :deep(.el-button.filter-save-button),
.locked-mode :deep(.el-button.render-chart-button),
.locked-mode :deep(.el-dropdown),
.locked-mode :deep(.el-switch.print-mode-switch),
.locked-mode :deep(.el-switch.percentage-mode-switch),
.locked-mode :deep(.el-switch.exclude-banner-switch),
.locked-mode :deep(.el-radio-group.group-by-switch),
.locked-mode :deep(.el-radio-group.group-by-switch .el-radio-button),
.locked-mode :deep(.el-radio-group.career-stage-switch),
.locked-mode :deep(.el-radio-group.career-stage-switch .el-radio-button),
.locked-mode :deep(.el-select.specific-stage-select),
.locked-mode :deep(.tag-selector-container),
.locked-mode :deep(.tag-selector-container .el-button) {
  pointer-events: auto;
  opacity: 1;
}

/* 過濾器管理抽屜樣式 */
.filter-management {
  padding: 20px;
}

.filter-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  margin-bottom: 10px;
  background: #f8f9fa;
}

.filter-info h4 {
  margin: 0 0 5px 0;
  color: #303133;
  font-size: 16px;
}

.filter-time {
  margin: 0;
  color: #909399;
  font-size: 12px;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

/* 歡迎卡片樣式 */
.welcome-card {
  margin-top: 50px;
  border: none;
  box-shadow: none;
}

.welcome-card .welcome-content {
  padding: 40px;
  text-align: center;
}

.welcome-card :deep(.el-empty__description p) {
  font-size: 16px;
  color: #606266;
  margin: 20px 0;
}
</style>

<style>
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}

#app {
  min-height: 100vh;
}
</style>