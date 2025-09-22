<template>
  <div class="alluvial-chart-container">
    <div class="chart-header">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 20px;">
        <el-tabs v-model="activeTab" @tab-change="onTabChange">
          <el-tab-pane label="機構流動" name="institution">
            <span slot="label">
              <i class="el-icon-office-building"></i> 機構流動
            </span>
          </el-tab-pane>
          <el-tab-pane label="官職流動" name="position">
            <span slot="label">
              <i class="el-icon-user"></i> 官職流動
            </span>
          </el-tab-pane>
        </el-tabs>
        
        <div style="display: flex; align-items: center; gap: 10px;">
          <el-select
            v-model="viewMode"
            placeholder="選擇視圖模式"
            @change="onSettingChange"
            size="small"
            style="width: 150px"
            :disabled="dataStore.isListLocked"
          >
            <el-option label="完整路徑" value="full" />
            <el-option label="簡化路徑" value="simplified" />
          </el-select>
          
          <div v-if="viewMode === 'simplified'" style="display: flex; align-items: center; gap: 8px;">
            <el-switch
              v-model="useDynamicSteps"
              active-text="智能步數"
              inactive-text="手動步數"
              @change="onSettingChange"
              size="small"
              :disabled="dataStore.isListLocked"
            />
            <el-select
              v-if="!useDynamicSteps"
              v-model="maxSteps"
              placeholder="最大步數"
              @change="onSettingChange"
              size="small"
              style="width: 120px"
              :disabled="dataStore.isListLocked"
            >
              <el-option
                v-for="n in [3, 4, 5, 6, 8]"
                :key="n"
                :label="`${n} 步`"
                :value="n"
              />
            </el-select>
            <el-tooltip 
              v-if="useDynamicSteps" 
              content="預設模式：根據最早達到頂級職位的人數自動計算步數，看出同輩人的職業進度對比" 
              placement="top"
            >
              <el-icon color="#67c23a"><QuestionFilled /></el-icon>
            </el-tooltip>
            <el-tooltip 
              v-else 
              content="手動模式：固定顯示指定步數的職業路徑" 
              placement="top"
            >
              <el-icon color="#909399"><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
          
          <el-button
            size="small"
            @click="openOriginDrawer"
            style="width: 240px"
            class="filter-button"
          >
            <span v-if="getTotalOriginCount() === 0">篩選起點出身</span>
            <span v-else-if="getTotalOriginCount() <= 2 && selectedOriginGroups.length === 0">
              {{ selectedOrigins.join(', ') }}
            </span>
            <span v-else>
              {{ getOriginDisplayText() }}
            </span>
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          
          <el-button
            size="small"
            @click="openDestinationDrawer"
            style="width: 240px"
            class="filter-button"
          >
            <span v-if="getTotalDestinationCount() === 0">篩選終點類型</span>
            <span v-else-if="getTotalDestinationCount() <= 2 && selectedDestinationGroups.length === 0">
              {{ selectedDestinations.join(', ') }}
            </span>
            <span v-else>
              {{ getDestinationDisplayText() }}
            </span>
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          
          <el-switch
            v-model="excludeBanner"
            active-text="排除旗人"
            inactive-text="包含旗人"
            @change="onSettingChange"
            size="small"
            class="exclude-banner-switch"
          />
          
          <el-switch
            v-model="trackingMode"
            active-text="機構流動追蹤"
            inactive-text="出身追蹤"
            @change="onSettingChange"
            size="small"
            :disabled="dataStore.isListLocked"
          />
          
          <el-dropdown @command="changeTheme" trigger="click" class="theme-button">
            <el-button size="small" type="success" plain class="theme-button">
              更換配色主題
              <el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item 
                  v-for="themeName in themeNames" 
                  :key="themeName"
                  :command="themeName"
                  :class="{ 'is-active': dataStore.currentTheme === themeName }"
                >
                  {{ getTheme(themeName).name }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          
          <el-button 
            type="primary" 
            size="small" 
            @click="renderChart"
            :disabled="false"
            style="font-weight: 600;"
          >
            <el-icon><RefreshRight /></el-icon>
            繪製桑基圖
          </el-button>
          
          <el-switch
            v-model="localPrintMode"
            active-text="列印版"
            inactive-text="彩色版"
            @change="updateChart"
            size="small"
            class="print-mode-switch"
          />
          
          <el-button 
            @click="exportChart" 
            size="small" 
            type="primary" 
            plain
            :disabled="!svg"
            class="export-button"
          >
            輸出SVG
          </el-button>
          
          <el-button 
            @click="exportPNGChart" 
            size="small" 
            type="success" 
            plain
            :disabled="!svg"
            class="export-button"
          >
            輸出PNG
          </el-button>
          
          <el-button
            @click="tableViewVisible = true"
            size="small"
            type="warning"
            plain
            class="text-view-button"
          >
            <el-icon><Grid /></el-icon>
            文字版
          </el-button>
        </div>
      </div>
    </div>
    
    <ChartDimensionSliders
      :defaultWidth="900"
      :defaultHeight="600"
      :maxWidth="1400"
      @dimensions-changed="handleDimensionsChanged"
    />
    
    <div class="chart-info">
      <el-tag type="info" size="small">
        統計 {{ uniqueOfficials }} 位官員
      </el-tag>
      <el-tag type="success" size="small">
        {{ getViewModeDisplayText() }}
      </el-tag>
      <el-tag type="warning" size="small">
        顯示前 {{ maxCategories }} 個類別
      </el-tag>
      <el-tag type="primary" size="small" v-if="getTotalOriginCount() > 0">
        起點篩選: {{ getTotalOriginCount() }} 種
        <span v-if="selectedOriginGroups.length > 0">(含 {{ selectedOriginGroups.length }} 分組)</span>
      </el-tag>
      <el-tag type="primary" size="small" v-if="getTotalDestinationCount() > 0">
        終點篩選: {{ getTotalDestinationCount() }} 種
        <span v-if="selectedDestinationGroups.length > 0">(含 {{ selectedDestinationGroups.length }} 分組)</span>
      </el-tag>
    </div>
    
    <!-- 智能步數功能說明 -->
    <div class="smart-steps-info" v-if="viewMode === 'simplified' && useDynamicSteps && getTotalDestinationCount() > 0">
      <el-alert
        title="💡 智能步數功能說明"
        type="success"
        :closable="false"
        show-icon>
        <template #default>
          <p><strong>當前模式：根據頂級職位自動計算最佳步數</strong></p>
          <div v-if="selectedDestinationGroups.length > 0">
            <p>🎯 基準職位：<strong>{{ selectedDestinationGroups[0].name }}</strong> (分組)</p>
            <p>📊 分析邏輯：找出所有人中<strong>最早達到該分組任一職位</strong>的轉職次數，以此為桑基圖階段數</p>
          </div>
          <div v-else-if="selectedDestinations.length > 0">
            <p>🎯 基準職位：<strong>{{ getDestinationDisplayName(selectedDestinations[0]) }}</strong></p>
            <p>📊 分析邏輯：找出所有人中<strong>最早達到該職位</strong>的轉職次數，以此為桑基圖階段數</p>
          </div>
          <p>💡 <strong>效果：</strong>看出「當同輩人做到頂級職位時，我還在什麼位置」的職業對比</p>
        </template>
      </el-alert>
    </div>
    
    <!-- 追蹤功能說明 -->
    <div class="tracking-info" v-if="getTotalOriginCount() > 0">
      <el-alert
        :title="trackingMode ? '機構流動追蹤功能' : '出身追蹤功能'"
        type="info"
        :closable="false"
        show-icon>
        <template #default>
          <div v-if="!trackingMode">
            <p>🔍 <strong>出身追蹤模式 - 視覺化特色：</strong></p>
            <ul>
              <li>• <strong>流線顏色</strong>：每條流線保持其原始出身的顏色，追蹤不同出身人羣的職業軌跡</li>
              <li>• <strong>節點懸停</strong>：查看該職位中「各種出身」的組成比例</li>
              <li>• <strong>流線懸停</strong>：查看該流動的原始出身信息</li>
            </ul>
            <p>📊 <strong>分析要點：</strong>看出不同出身羣體在職業發展中的「分流」和「匯聚」模式</p>
          </div>
          <div v-else>
            <p>🔍 <strong>機構流動追蹤模式 - 視覺化特色：</strong></p>
            <ul>
              <li>• <strong>流線顏色</strong>：每條流線根據前一個機構著色，追蹤機構間的「跳槽」模式</li>
              <li>• <strong>節點懸停</strong>：查看該職位中「來自哪些前序機構」的組成比例</li>
              <li>• <strong>流線懸停</strong>：查看該流動的前序機構信息</li>
            </ul>
            <p>📊 <strong>分析要點：</strong>類似現代「從NVIDIA跳槽到Intel」的職場流動分析，看出機構間的人才流動路徑</p>
          </div>
        </template>
      </el-alert>
    </div>
    
    
    <div 
      ref="chartContainer" 
      class="chart-area"
      v-loading="loading"
      element-loading-text="正在生成職業路徑圖..."
      element-loading-background="rgba(255, 255, 255, 0.8)"
    ></div>
    
    <!-- Origin Selection Drawer -->
    <MultiSelectDrawer
      v-model="originDrawerVisible"
      title="篩選起點出身"
      :options="originOptions"
      :selected-values="selectedOrigins"
      :selected-groups="selectedOriginGroups"
      @confirm="onOriginSelectionConfirm"
      @cancel="onOriginSelectionCancel"
    />
    
    <!-- Destination Selection Drawer -->
    <MultiSelectDrawer
      v-model="destinationDrawerVisible"
      title="篩選終點類型"
      :options="destinationOptions"
      :selected-values="selectedDestinations"
      :selected-groups="selectedDestinationGroups"
      @confirm="onDestinationSelectionConfirm"
      @cancel="onDestinationSelectionCancel"
    />
    
    <!-- 文字版視圖 -->
    <ChartDataTableView
      v-model:visible="tableViewVisible"
      :data="tableData"
      :columns="tableColumns"
      :title="`職業路徑分析 - ${activeTab === 'institution' ? '機構' : '官職'}流動`"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed, nextTick } from 'vue'
import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal } from 'd3-sankey'
import { useDataStore } from '../stores/dataStore'
import { ElMessage } from 'element-plus'
import { ArrowDown, RefreshRight, QuestionFilled, Grid } from '@element-plus/icons-vue'
import { exportSVG, exportPNG, createPatterns, getColorScheme, getThemeNames, getTheme, createLinePatterns, getLinePatternByWidth, getLinePatternByStage } from '../utils/chartUtils'
import { getStandardizedBackground } from '../utils/dataUtils'
import ChartDimensionSliders from './ChartDimensionSliders.vue'
import MultiSelectDrawer from './MultiSelectDrawer.vue'
import ChartDataTableView from './ChartDataTableView.vue'

const emit = defineEmits(['selection-changed'])

const props = defineProps({
  filterCriteria: {
    type: Object,
    default: () => ({})
  }
})

const dataStore = useDataStore()
const chartContainer = ref(null)
const activeTab = ref('institution')
const viewMode = ref('simplified')
const maxSteps = ref(4)
const excludeBanner = ref(false)
const loading = ref(false)
const uniqueOfficials = ref(0)
const maxCategories = 15
const selectedOrigins = ref([])
const selectedDestinations = ref([])
const availableOrigins = ref([])
const availableDestinations = ref([])
const originCounts = ref({})
const destinationCounts = ref({})
const trackingMode = ref(false) // false: 出身追蹤, true: 機構流動追蹤
const localPrintMode = ref(false) // 獨立的列印模式控制
const useDynamicSteps = ref(true) // 是否使用動態步數計算
const tableViewVisible = ref(false)

// Drawer visibility and groups
const originDrawerVisible = ref(false)
const destinationDrawerVisible = ref(false)
const selectedOriginGroups = ref([])
const selectedDestinationGroups = ref([])

const chartDimensions = ref({ width: 900, height: 600 })
const margin = { top: 20, right: 150, bottom: 20, left: 150 }

let svg = null
let tooltip = null
let patternIds = []

const themeNames = getThemeNames()

const changeTheme = (themeName) => {
  dataStore.currentTheme = themeName
  ElMessage.success(`已切換至${getTheme(themeName).name}`)
}

// Computed properties for drawer options
const originOptions = computed(() => {
  return availableOrigins.value.map(origin => ({
    label: origin,
    value: origin,
    count: originCounts.value[origin] || 0
  }))
})

const destinationOptions = computed(() => {
  return availableDestinations.value.map(dest => ({
    label: dest,
    value: dest,
    count: destinationCounts.value[dest] || 0
  }))
})

// Event handlers for drawer selections
const onOriginSelectionConfirm = (selectionData) => {
  selectedOrigins.value = selectionData.individualItems
  selectedOriginGroups.value = selectionData.groups
  // 不自動繪圖，等用戶點擊繪圖按鈕
}

const onOriginSelectionCancel = () => {
  // Do nothing, keep current selection
}

const onDestinationSelectionConfirm = (selectionData) => {
  selectedDestinations.value = selectionData.individualItems
  selectedDestinationGroups.value = selectionData.groups
  // 不自動繪圖，等用戶點擊繪圖按鈕
}

const onDestinationSelectionCancel = () => {
  // Do nothing, keep current selection
}

// 計算基於優先級的動態 maxSteps
const calculateDynamicMaxSteps = (filteredOfficials) => {
  // 確定最高優先級的目標：分組優先於個別項目
  let topPriorityTarget = null
  let topPriorityDisplayName = null
  
  if (selectedDestinationGroups.value.length > 0) {
    // 如果有分組，使用第一個分組作為最高優先級
    topPriorityTarget = selectedDestinationGroups.value[0]
    topPriorityDisplayName = topPriorityTarget.name
  } else if (selectedDestinations.value.length > 0) {
    // 否則使用第一個個別項目
    topPriorityTarget = selectedDestinations.value[0]
    topPriorityDisplayName = getDestinationDisplayName(topPriorityTarget)
  } else {
    return null // 沒有終點篩選，使用原始邏輯
  }
  
  const field = activeTab.value === 'institution' ? '機構一' : '官職一'
  let earliestReachStep = Infinity
  
  // 查找所有人中最早到達該職位的步數
  Object.values(filteredOfficials).forEach(records => {
    for (let i = 0; i < records.length; i++) {
      const position = records[i][field] || '(無記錄)'
      const displayName = getDestinationDisplayName(position)
      
      // 檢查是否匹配最高優先級的目標
      if (displayName === topPriorityDisplayName) {
        const stepNumber = i + 2 // +1 for 出身, +1 for current step (0-indexed)
        earliestReachStep = Math.min(earliestReachStep, stepNumber)
        break // 只記錄第一次到達
      }
    }
  })
  
  return earliestReachStep === Infinity ? null : earliestReachStep
}

// 手動繪圖函數
const renderChart = () => {
  console.log('🎯 renderChart called - excludedPersonUIDs:', props.filterCriteria?.excludedPersonUIDs?.length || 0)
  console.log('🎯 renderChart called - full criteria:', props.filterCriteria)
  
  // 強制清除現有圖表確保重新渲染
  if (chartContainer.value) {
    d3.select(chartContainer.value).selectAll("*").remove()
    svg = null
  }
  
  // 強制更新可用選項
  updateAvailableOptions()
  
  // 使用 nextTick 確保DOM更新完成後再渲染
  nextTick(() => {
    setTimeout(() => {
      updateChart()
    }, 10)
  })
}

// 設定變更處理函數 - 只在已有選擇的情況下重新渲染
const onSettingChange = () => {
  // 如果已經有選擇並且圖表已渲染，則自動更新
  if (getTotalOriginCount() > 0) {
    updateChart()
  }
}

// 標籤頁變更處理函數
const onTabChange = () => {
  // 切換tab時清空過濾器但不自動更新圖表
  selectedOrigins.value = []
  selectedDestinations.value = []
  selectedOriginGroups.value = []
  selectedDestinationGroups.value = []
  
  // 更新可用選項
  updateAvailableOptions()
}

// Helper functions for group display
const getTotalOriginCount = () => {
  const individualCount = selectedOrigins.value.length
  const groupItemsCount = selectedOriginGroups.value.reduce((total, group) => total + group.items.length, 0)
  return individualCount + groupItemsCount
}

const getTotalDestinationCount = () => {
  const individualCount = selectedDestinations.value.length
  const groupItemsCount = selectedDestinationGroups.value.reduce((total, group) => total + group.items.length, 0)
  return individualCount + groupItemsCount
}

const getOriginDisplayText = () => {
  const parts = []
  if (selectedOrigins.value.length > 0) {
    if (selectedOrigins.value.length <= 2) {
      parts.push(...selectedOrigins.value)
    } else {
      parts.push(`${selectedOrigins.value.slice(0, 2).join(', ')} 等${selectedOrigins.value.length}項`)
    }
  }
  if (selectedOriginGroups.value.length > 0) {
    const groupText = selectedOriginGroups.value.map(g => g.name).join(', ')
    parts.push(`分組: ${groupText}`)
  }
  return parts.join(' | ')
}

const getDestinationDisplayText = () => {
  const parts = []
  if (selectedDestinations.value.length > 0) {
    if (selectedDestinations.value.length <= 2) {
      parts.push(...selectedDestinations.value)
    } else {
      parts.push(`${selectedDestinations.value.slice(0, 2).join(', ')} 等${selectedDestinations.value.length}項`)
    }
  }
  if (selectedDestinationGroups.value.length > 0) {
    const groupText = selectedDestinationGroups.value.map(g => g.name).join(', ')
    parts.push(`分組: ${groupText}`)
  }
  return parts.join(' | ')
}

const getViewModeDisplayText = () => {
  if (viewMode.value === 'full') {
    return '完整職業路徑'
  } else {
    if (useDynamicSteps.value) {
      let topPriorityName = null
      
      if (selectedDestinationGroups.value.length > 0) {
        // 分組優先
        topPriorityName = selectedDestinationGroups.value[0].name
      } else if (selectedDestinations.value.length > 0) {
        // 個別項目
        topPriorityName = getDestinationDisplayName(selectedDestinations.value[0])
      }
      
      if (topPriorityName) {
        return `智能步數 - 最早達到"${topPriorityName}"的步數`
      } else {
        return `智能步數 (請選擇終點目標)`
      }
    } else {
      return `手動設定 ${maxSteps.value} 步`
    }
  }
}

// Helper functions to check if a value matches selection criteria (including groups)
const isOriginSelected = (value) => {
  // Check individual selections
  if (selectedOrigins.value.includes(value)) {
    return true
  }
  
  // Check group selections
  return selectedOriginGroups.value.some(group => group.items.includes(value))
}

const isDestinationSelected = (value) => {
  // Check individual selections
  if (selectedDestinations.value.includes(value)) {
    return true
  }
  
  // Check group selections
  return selectedDestinationGroups.value.some(group => group.items.includes(value))
}

// Helper function to get the display name for a value (group name if in group, otherwise original value)
const getOriginDisplayName = (value) => {
  // 只檢查起點出身分組，避免與終點分組交叉污染
  const group = selectedOriginGroups.value.find(group => group.items.includes(value))
  return group ? group.name : value
}

const getDestinationDisplayName = (value) => {
  // 只檢查終點類型分組，避免與起點分組交叉污染
  const group = selectedDestinationGroups.value.find(group => group.items.includes(value))
  return group ? group.name : value
}

// Functions to open drawers with data preparation
const openOriginDrawer = async () => {
  // Ensure data is available before opening drawer
  updateAvailableOptions()
  
  // Wait for Vue to update computed properties
  await nextTick()
  
  originDrawerVisible.value = true
}

const openDestinationDrawer = async () => {
  // Ensure data is available before opening drawer
  updateAvailableOptions()
  
  // Wait for Vue to update computed properties
  await nextTick()
  
  destinationDrawerVisible.value = true
}

// 計算表格數據
const tableData = computed(() => {
  if (!dataStore.effectiveData.length) return []
  
  let filteredData = dataStore.effectiveData
  // 如果不是鎖定模式，才應用額外的篩選條件
  if (!dataStore.isListLocked) {
    if (excludeBanner.value) {
      filteredData = filteredData.filter(d => !d.旗分 || d.旗分.trim() === '')
    }
  }
  
  // 按PersonUID分組
  const officialRecords = {}
  filteredData.forEach(record => {
    if (!record.PersonUID) return
    
    if (!officialRecords[record.PersonUID]) {
      officialRecords[record.PersonUID] = []
    }
    officialRecords[record.PersonUID].push(record)
  })
  
  // 為每個官員排序記錄
  Object.values(officialRecords).forEach(records => {
    records.sort((a, b) => a.record_number - b.record_number)
  })
  
  // 統計流動數據
  const flowStats = []
  const field = activeTab.value === 'institution' ? '機構一' : '官職一'
  
  Object.values(officialRecords).forEach(records => {
    const background = records[0].出身一 || '(無出身記錄)'
    
    // 應用起點過濾
    const hasOriginFilter = selectedOrigins.value.length > 0 || selectedOriginGroups.value.length > 0
    if (hasOriginFilter && !isOriginSelected(background)) {
      return
    }
    
    // 記錄每個職業階段
    records.forEach((record, index) => {
      const position = record[field] || '(無記錄)'
      
      flowStats.push({
        officialName: record.姓名 || '未知',
        officialUID: record.PersonUID,
        background,
        stage: index + 1,
        position,
        institution: record.機構一 || '(無機構)',
        positionName: record.官職一 || '(無官職)',
        region: record.地區 || '(無地區)'
      })
    })
  })
  
  // 按官員和階段排序
  return flowStats.sort((a, b) => {
    if (a.officialUID !== b.officialUID) {
      return a.officialUID.localeCompare(b.officialUID)
    }
    return a.stage - b.stage
  })
})

// 表格列定義
const tableColumns = computed(() => {
  const baseColumns = [
    { prop: 'officialName', label: '姓名', width: 100 },
    { prop: 'background', label: '出身', width: 150 },
    { prop: 'stage', label: '階段', width: 80 }
  ]
  
  if (activeTab.value === 'institution') {
    baseColumns.push(
      { prop: 'institution', label: '任職機構', width: 180 },
      { prop: 'positionName', label: '官職', width: 150 },
      { prop: 'region', label: '地區', width: 120 }
    )
  } else {
    baseColumns.push(
      { prop: 'positionName', label: '官職', width: 180 },
      { prop: 'institution', label: '所屬機構', width: 150 },
      { prop: 'region', label: '地區', width: 120 }
    )
  }
  
  return baseColumns
})

onMounted(() => {
  initChart()
  updateChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (tooltip) tooltip.remove()
})

const initChart = () => {
  // 創建tooltip
  if (tooltip) tooltip.remove()
  tooltip = d3.select("body")
    .append("div")
    .attr("class", "chart-tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("padding", "10px")
    .style("background", "rgba(0, 0, 0, 0.85)")
    .style("color", "white")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("font-size", "12px")
    .style("max-width", "300px")
}

const updateAvailableOptions = () => {
  if (!dataStore.effectiveData.length) return
  
  let filteredData = dataStore.effectiveData
  // 如果不是鎖定模式，才應用額外的篩選條件
  if (!dataStore.isListLocked) {
    if (excludeBanner.value) {
      filteredData = filteredData.filter(d => !d.旗分 || d.旗分.trim() === '')
    }
  }
  
  // 收集所有可能的出身
  const origins = new Set()
  const destinations = new Set()
  const field = activeTab.value === 'institution' ? '機構一' : '官職一'
  
  const officialRecords = {}
  filteredData.forEach(record => {
    if (!record.PersonUID) return
    
    if (!officialRecords[record.PersonUID]) {
      officialRecords[record.PersonUID] = []
    }
    officialRecords[record.PersonUID].push(record)
  })
  
  Object.values(officialRecords).forEach(records => {
    records.sort((a, b) => a.record_number - b.record_number)
    
    // 出身一
    const background = records[0].出身一 || '(無出身記錄)'
    origins.add(background)
    
    // 所有可能的終點
    records.forEach(record => {
      const dest = record[field] || '(無記錄)'
      destinations.add(dest)
    })
  })
  
  // 按頻率排序
  const tempOriginCounts = {}
  const tempDestCounts = {}
  
  Object.values(officialRecords).forEach(records => {
    const background = records[0].出身一 || '(無出身記錄)'
    tempOriginCounts[background] = (tempOriginCounts[background] || 0) + 1
    
    records.forEach(record => {
      const dest = record[field] || '(無記錄)'
      tempDestCounts[dest] = (tempDestCounts[dest] || 0) + 1
    })
  })
  
  availableOrigins.value = Array.from(origins).sort((a, b) => (tempOriginCounts[b] || 0) - (tempOriginCounts[a] || 0))
  availableDestinations.value = Array.from(destinations).sort((a, b) => (tempDestCounts[b] || 0) - (tempDestCounts[a] || 0))
  
  // 保存計數數據供UI顯示
  originCounts.value = tempOriginCounts
  destinationCounts.value = tempDestCounts
}


const prepareAlluvialData = () => {
  if (!dataStore.effectiveData.length) return null
  
  // 在鎖定模式下，如果沒有選擇起點出身，自動使用所有可用的起點
  if (getTotalOriginCount() === 0) {
    if (dataStore.isListLocked) {
      console.log('🔒 鎖定模式：自動使用所有可用起點出身來顯示鎖定數據')
      // 暫時獲取所有可用的起點出身
      updateAvailableOptions()
      if (availableOrigins.value.length === 0) {
        console.log('⚠️ 鎖定模式：沒有可用的起點出身數據')
        return null
      }
      // 自動選擇前10個最常見的起點出身，避免圖表過於複雜
      selectedOrigins.value = availableOrigins.value.slice(0, Math.min(10, availableOrigins.value.length))
      console.log(`🔒 自動選擇了 ${selectedOrigins.value.length} 個起點出身:`, selectedOrigins.value.slice(0, 3))
    } else {
      // 非鎖定模式：必須選擇起點出身才能render
      return null
    }
  }
  
  // 過濾數據
  let filteredData = dataStore.effectiveData
  // 如果不是鎖定模式，才應用額外的篩選條件
  if (!dataStore.isListLocked) {
    if (excludeBanner.value) {
      filteredData = filteredData.filter(d => !d.旗分 || d.旗分.trim() === '')
    }
  }
  
  // 排除指定的官員UID
  console.log('🔍 prepareAlluvialData - checking excludedPersonUIDs:', props.filterCriteria?.excludedPersonUIDs?.length || 0)
  if (props.filterCriteria?.excludedPersonUIDs && props.filterCriteria.excludedPersonUIDs.length > 0) {
    const beforeCount = filteredData.length
    filteredData = filteredData.filter(d => !props.filterCriteria.excludedPersonUIDs.includes(d.PersonUID))
    console.log(`📊 PersonUID exclusion applied: ${beforeCount} -> ${filteredData.length} records`)
    console.log(`📊 Excluded UIDs:`, props.filterCriteria.excludedPersonUIDs.slice(0, 5))
  } else {
    console.log(`📊 No PersonUID exclusion needed`)
  }
  
  // 按PersonUID分組
  const officialRecords = {}
  filteredData.forEach(record => {
    if (!record.PersonUID) return
    
    if (!officialRecords[record.PersonUID]) {
      officialRecords[record.PersonUID] = []
    }
    officialRecords[record.PersonUID].push(record)
  })
  
  // 為每個官員排序記錄
  Object.values(officialRecords).forEach(records => {
    records.sort((a, b) => a.record_number - b.record_number)
  })
  
  // 應用起點和終點過濾
  const filteredOfficials = {}
  Object.entries(officialRecords).forEach(([uid, records]) => {
    const background = records[0].出身一 || '(無出身記錄)'
    const field = activeTab.value === 'institution' ? '機構一' : '官職一'
    const lastPosition = records[records.length - 1][field] || '(無記錄)'
    
    // 檢查起點過濾 - 包含分組檢查
    const hasOriginFilter = selectedOrigins.value.length > 0 || selectedOriginGroups.value.length > 0
    if (hasOriginFilter && !isOriginSelected(background)) {
      return
    }
    
    // 檢查終點過濾 - 包含分組檢查
    const hasDestinationFilter = selectedDestinations.value.length > 0 || selectedDestinationGroups.value.length > 0
    if (hasDestinationFilter && !isDestinationSelected(lastPosition)) {
      return
    }
    
    filteredOfficials[uid] = records
  })
  
  // 統計唯一官員數
  uniqueOfficials.value = Object.keys(filteredOfficials).length
  
  if (Object.keys(filteredOfficials).length === 0) return null
  
  // **核心邏輯：聚合統計相同出身人羣的流動**
  const field = activeTab.value === 'institution' ? '機構一' : '官職一'
  
  // 找出最多轉職次數，建立固定階段
  const maxRecords = Math.max(...Object.values(filteredOfficials).map(records => records.length))
  
  // 根據視圖模式決定總階段數
  let totalStages
  if (viewMode.value === 'simplified') {
    // 簡化模式：根據開關決定使用動態計算還是用戶設定
    if (useDynamicSteps.value) {
      const dynamicSteps = calculateDynamicMaxSteps(filteredOfficials)
      if (dynamicSteps !== null) {
        totalStages = dynamicSteps
        
        // 確定目標名稱用於輸出
        let targetName = null
        if (selectedDestinationGroups.value.length > 0) {
          targetName = selectedDestinationGroups.value[0].name
        } else if (selectedDestinations.value.length > 0) {
          targetName = getDestinationDisplayName(selectedDestinations.value[0])
        }
        
        console.log(`🎯 智能步數模式: 有人最早在第 ${dynamicSteps} 步達到 "${targetName}"，以此為桑基圖階段數`)
      } else {
        totalStages = maxSteps.value
        console.log(`📐 智能步數模式失敗 (無人達到目標職位)，回退到手動設定: ${maxSteps.value} 步`)
      }
    } else {
      totalStages = maxSteps.value
      console.log(`📐 手動步數模式: 固定顯示 ${maxSteps.value} 步`)
    }
  } else {
    // 完整模式：使用所有階段
    totalStages = maxRecords + 1 // 出身 + 職位記錄數
  }
  
  // 建立階段到階段的流動統計，支持兩種追蹤模式
  const flowData = {}
  // 創建顯示名稱到原始值的映射表
  const displayNameToOriginalValues = new Map()
  
  Object.values(filteredOfficials).forEach(records => {
    // 構建這個人的完整路徑
    const path = []
    const originalBackground = records[0].出身一 || '(無出身記錄)'
    
    // 階段0：出身一 - 使用分組顯示名稱
    const originDisplayName = getOriginDisplayName(originalBackground)
    path.push(originDisplayName)
    
    // 調試：檢查出身階段的數據
    if (originalBackground !== originDisplayName) {
      console.log(`🔍 出身映射: "${originalBackground}" → "${originDisplayName}"`)
    }
    
    // 記錄出身映射
    if (!displayNameToOriginalValues.has(originDisplayName)) {
      displayNameToOriginalValues.set(originDisplayName, new Set())
    }
    displayNameToOriginalValues.get(originDisplayName).add(originalBackground)
    
    // 階段1到N：各個職位 - 使用分組顯示名稱
    // 在簡化模式下，只取前 (totalStages - 1) 個職位記錄
    const maxPositions = totalStages - 1 // 減去出身階段
    const positionsToProcess = Math.min(records.length, maxPositions)
    
    for (let i = 0; i < positionsToProcess; i++) {
      const position = records[i][field] || '(無記錄)'
      const positionDisplayName = getDestinationDisplayName(position)
      path.push(positionDisplayName)
      
      // 調試：檢查每個階段的數據
      console.log(`🔍 階段${i+1}: "${position}" → "${positionDisplayName}"`, `記錄號:${records[i].record_number}`)
      
      // 記錄職位映射
      if (!displayNameToOriginalValues.has(positionDisplayName)) {
        displayNameToOriginalValues.set(positionDisplayName, new Set())
      }
      displayNameToOriginalValues.get(positionDisplayName).add(position)
    }
    
    // 補齊到總階段數
    while (path.length < totalStages) {
      path.push('(職業結束)')
    }
    
    // 統計每個相鄰階段間的流動，根據追蹤模式決定追蹤信息
    for (let stage = 0; stage < totalStages - 1; stage++) {
      const from = path[stage]
      const to = path[stage + 1]
      
      // 根據追蹤模式決定追蹤的來源
      const trackingSource = trackingMode.value ? 
        from : // 機構流動模式：追蹤前一個階段的機構
        originDisplayName // 出身追蹤模式：追蹤原始出身（使用分組顯示名稱）
      
      const key = `${stage}-${from}-${to}-${trackingSource}`
      
      flowData[key] = (flowData[key] || 0) + 1
    }
  })
  
  // 統計每個階段的所有節點
  const stageNodes = {}
  Object.keys(flowData).forEach(key => {
    const parts = key.split('-')
    const stage = parts[0]
    const from = parts[1]
    const to = parts[2]
    // 原始出身是parts[3]，但這裡暫時不用於節點統計
    const stageNum = parseInt(stage)
    
    if (!stageNodes[stageNum]) stageNodes[stageNum] = {}
    if (!stageNodes[stageNum + 1]) stageNodes[stageNum + 1] = {}
    
    stageNodes[stageNum][from] = (stageNodes[stageNum][from] || 0) + flowData[key]
    stageNodes[stageNum + 1][to] = (stageNodes[stageNum + 1][to] || 0) + flowData[key]
  })
  
  // 調試：查看階段0的節點分佈
  console.log('🎯 階段0(出身一)的分佈:', stageNodes[0])
  console.log('🎯 階段1的分佈:', stageNodes[1])
  console.log('🎯 全部階段數:', stageNodes.length)
  
  // 為每個階段選擇頻率最高的節點
  const stageFrequencies = []
  for (let stage = 0; stage < totalStages; stage++) {
    if (stageNodes[stage]) {
      const sorted = Object.entries(stageNodes[stage])
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxCategories)
      stageFrequencies.push(new Set(sorted.map(([key]) => key)))
    } else {
      stageFrequencies.push(new Set())
    }
  }
  
  // 生成節點和鏈接
  const nodes = []
  const links = []
  const nodeMap = new Map()
  
  // 創建節點
  stageFrequencies.forEach((stageSet, stageIndex) => {
    Array.from(stageSet).forEach(value => {
      const nodeId = `${stageIndex}-${value}`
      
      // 獲取這個顯示名稱對應的原始值
      const originalValues = displayNameToOriginalValues.get(value) || new Set([value])
      
      nodes.push({
        id: nodeId,
        name: value,
        stage: stageIndex,
        originalValues: Array.from(originalValues) // 保存原始值列表
      })
      nodeMap.set(nodeId, nodes.length - 1)
    })
  })
  
  // 創建鏈接，包含追蹤信息
  Object.entries(flowData).forEach(([key, count]) => {
    const parts = key.split('-')
    const stage = parts[0]
    const from = parts[1]
    const to = parts[2]
    const trackingSource = parts[3] // 追蹤來源（出身或前一機構）
    const stageNum = parseInt(stage)
    
    const sourceId = `${stageNum}-${from}`
    const targetId = `${stageNum + 1}-${to}`
    
    if (nodeMap.has(sourceId) && nodeMap.has(targetId)) {
      links.push({
        source: nodeMap.get(sourceId),
        target: nodeMap.get(targetId),
        value: count,
        sourceName: from,
        targetName: to,
        trackingSource: trackingSource,
        isOriginTracking: !trackingMode.value // 標記是否為出身追蹤模式
      })
    }
  })
  
  // 提取所有官員的 PersonUID 用於設置可鎖定名單
  const officialUIDs = Object.keys(filteredOfficials)
  
  return { nodes, links, totalStages, officialUIDs }
}

const updateChart = () => {
  // 只有當前激活的tab才render
  if (!chartContainer.value) return
  
  updateAvailableOptions()
  loading.value = true
  
  setTimeout(() => {
    try {
      const result = prepareAlluvialData()
      if (!result) {
        // 顯示提示消息
        d3.select(chartContainer.value).selectAll("*").remove()
        svg = d3.select(chartContainer.value)
          .append("svg")
          .attr("width", "100%")
          .attr("height", chartDimensions.value.height)
          .attr("viewBox", `0 0 ${chartDimensions.value.width} ${chartDimensions.value.height}`)
          .attr("preserveAspectRatio", "xMidYMid meet")
        
        const message = getTotalOriginCount() === 0 
          ? "請先選擇「篩選起點出身」來查看特定出身人羣的職業流動路徑"
          : "無符合條件的數據"
        
        svg.append("text")
          .attr("x", chartDimensions.value.width / 2)
          .attr("y", chartDimensions.value.height / 2 - 10)
          .attr("text-anchor", "middle")
          .style("font-size", "16px")
          .style("fill", "#666")
          .text(message)
          
        if (getTotalOriginCount() === 0) {
          svg.append("text")
            .attr("x", chartDimensions.value.width / 2)
            .attr("y", chartDimensions.value.height / 2 + 20)
            .attr("text-anchor", "middle")
            .style("font-size", "14px")
            .style("fill", "#999")
            .text("例如：選擇「進士」來查看進士出身官員的職業發展軌跡")
        }
        return
      }
      
      const { nodes, links, totalStages, officialUIDs } = result
      
      // 設置可鎖定名單為桑基圖顯示的官員
      if (officialUIDs && officialUIDs.length > 0) {
        console.log(`🎯 桑基圖設置可鎖定名單: ${officialUIDs.length} 位官員`)
        dataStore.setLockableList(officialUIDs, `桑基圖 - ${uniqueOfficials.value}位官員`)
      }
      
      // 清除現有圖表
      d3.select(chartContainer.value).selectAll("*").remove()
      
      // 根據節點數量動態調整高度
      const nodeCount = nodes.length
      const minHeight = 600  // 固定最小高度
      const nodeHeight = 12  // 每個節點的高度係數
      const dynamicHeight = Math.max(minHeight, nodeCount * nodeHeight + margin.top + margin.bottom + 200)
      
      // 創建SVG
      svg = d3.select(chartContainer.value)
        .append("svg")
        .attr("width", "100%")
        .attr("height", dynamicHeight)
        .attr("viewBox", `0 0 ${chartDimensions.value.width} ${dynamicHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
      
      // 創建patterns
      patternIds = createPatterns(svg)
      
      // 為桑基圖創建線段patterns（列印模式）
      const linePatterns = createLinePatterns(svg)
      
      const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`)
      
      // 設置桑基圖佈局
      const sankeyGenerator = sankey()
        .nodeId(d => d.index)
        .nodeWidth(15)
        .nodePadding(10)  // 增加節點間距
        .extent([
          [0, 0],
          [chartDimensions.value.width - margin.left - margin.right, 
           dynamicHeight - margin.top - margin.bottom]
        ])
      
      // 生成佈局
      const sankeyData = sankeyGenerator({nodes, links})
      
      // 顏色比例尺 - 根據追蹤模式和本地列印模式調整
      const colors = getColorScheme(localPrintMode.value, true, dataStore.currentTheme)
      
      let colorDomain
      if (trackingMode.value) {
        // 機構流動模式：收集所有可能的追蹤來源（各階段的機構）
        const allTrackingSources = new Set()
        sankeyData.links.forEach(link => {
          if (link.trackingSource) {
            allTrackingSources.add(link.trackingSource)
          }
        })
        colorDomain = Array.from(allTrackingSources)
      } else {
        // 出身追蹤模式：使用階段0的節點（出身）
        colorDomain = sankeyData.nodes.filter(d => d.stage === 0).map(d => d.name)
      }
      
      const colorScale = d3.scaleOrdinal()
        .domain(colorDomain)
        .range(colors)
      
      // 處理鏈接追蹤信息
      const enhancedLinks = sankeyData.links.map(link => {
        return {
          ...link,
          // trackingSource 已經在數據準備階段設置好了
        }
      })

      // 繪製鏈接
      const link = g.append("g")
        .selectAll(".link")
        .data(enhancedLinks)
        .enter()
        .append("path")
        .attr("class", "link")
        .attr("d", sankeyLinkHorizontal())
        .attr("stroke", d => {
          // 在列印模式下使用黑色，否則根據追蹤來源決定顏色
          if (localPrintMode.value) {
            return "#333"
          }
          
          // 如果是流向"職業結束"的鏈接，使用灰色
          if (d.targetName === '(職業結束)') {
            return "#ccc"
          }
          
          // 根據追蹤來源決定顏色
          return colorScale(d.trackingSource || d.sourceName)
        })
        .attr("stroke-width", d => Math.max(1, d.width))
        .attr("stroke-dasharray", d => {
          // 在列印模式下根據樣式模式使用不同的虛線模式
          if (localPrintMode.value) {
            let patternId
            
            if (dataStore.sankeyLineStyleMode === 'stage') {
              // 按階段模式：相同出發階段使用相同虛線樣式
              const sourceStage = d.source.stage || 0
              patternId = getLinePatternByStage(sourceStage)
              console.log(`🎨 線段樣式（按階段）: ${d.sourceName} -> ${d.targetName}, 出發階段: ${sourceStage}, pattern: ${patternId}`)
            } else {
              // 按粗細模式：相同寬度使用相同虛線樣式
              const strokeWidth = Math.max(1, d.width)
              patternId = getLinePatternByWidth(strokeWidth)
              console.log(`🎨 線段樣式（按粗細）: ${d.sourceName} -> ${d.targetName}, 寬度: ${strokeWidth}, pattern: ${patternId}`)
            }
            
            const pattern = linePatterns.find(p => p.id === patternId)
            return pattern ? pattern.dashArray : '2,2'
          }
          return null
        })
        .attr("fill", "none")
        .attr("opacity", d => d.targetName === '(職業結束)' ? 0.4 : 0.6)
        .on("mouseover", function(event, d) {
          d3.select(this).attr("opacity", 0.9)
          
          // 根據追蹤模式顯示不同的追蹤信息
          let trackingInfo = ''
          if (d.trackingSource && d.trackingSource !== d.sourceName) {
            if (trackingMode.value) {
              // 機構流動模式
              trackingInfo = `<br>前序機構: ${d.trackingSource}`
            } else {
              // 出身追蹤模式
              trackingInfo = `<br>原始出身: ${d.trackingSource}`
            }
          }
          
          tooltip
            .style("opacity", 1)
            .html(`
              ${d.sourceName} → ${d.targetName}<br>
              人數: ${d.value}${trackingInfo}
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px")
        })
        .on("mouseout", function() {
          d3.select(this).attr("opacity", 0.6)
          tooltip.style("opacity", 0)
        })
      
      // 繪製節點
      const node = g.append("g")
        .selectAll(".node")
        .data(sankeyData.nodes)
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x0},${d.y0})`)
      
      // 節點矩形
      node.append("rect")
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", d => {
          if (d.stage === 0) return colorScale(d.name)
          if (d.name === '(職業結束)') return "#f56c6c" // 職業結束用紅色
          return "#666"
        })
        .attr("stroke", d => d.name === '(職業結束)' ? "#e6a23c" : "#000")
        .attr("stroke-width", d => d.name === '(職業結束)' ? 2 : 1)
        .attr("opacity", 0.8)
        .on("click", function(event, d) {
          handleNodeClick(d)
        })
        .on("mouseover", function(event, d) {
          d3.select(this).attr("opacity", 1)
          
          const total = d3.sum(d.sourceLinks, l => l.value) || d3.sum(d.targetLinks, l => l.value)
          
          // 如果不是出身階段，計算追蹤來源組成
          let compositionInfo = ''
          if (d.stage > 0) {
            const incomingLinks = d.targetLinks || []
            const sourceBreakdown = {}
            let totalIncoming = 0
            
            incomingLinks.forEach(link => {
              const source = link.trackingSource || '未知來源'
              sourceBreakdown[source] = (sourceBreakdown[source] || 0) + link.value
              totalIncoming += link.value
            })
            
            if (totalIncoming > 0) {
              const topSources = Object.entries(sourceBreakdown)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3) // 顯示前3個主要來源
                .map(([source, count]) => {
                  const percentage = ((count / totalIncoming) * 100).toFixed(1)
                  return `${source}: ${percentage}%`
                })
              
              if (topSources.length > 0) {
                const compositionTitle = trackingMode.value ? '主要前序機構組成' : '主要出身組成'
                compositionInfo = `<br><br>${compositionTitle}:<br>${topSources.join('<br>')}`
                if (Object.keys(sourceBreakdown).length > 3) {
                  const remainingType = trackingMode.value ? '種前序機構' : '種出身'
                  compositionInfo += `<br>...還有${Object.keys(sourceBreakdown).length - 3}${remainingType}`
                }
              }
            }
          }
          
          tooltip
            .style("opacity", 1)
            .html(`
              ${d.name}<br>
              階段: ${getStageLabel(d.stage, totalStages)}<br>
              人數: ${total}${compositionInfo}
            `)
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 10) + "px")
        })
        .on("mouseout", function() {
          d3.select(this).attr("opacity", 0.8)
          tooltip.style("opacity", 0)
        })
      
      // 節點標籤
      node.append("text")
        .attr("x", d => d.x0 < chartDimensions.value.width / 2 ? -6 : d.x1 - d.x0 + 6)
        .attr("y", d => (d.y1 - d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.x0 < chartDimensions.value.width / 2 ? "end" : "start")
        .text(d => d.name.length > 12 ? d.name.substring(0, 12) + '...' : d.name)
        .style("font-size", "11px")
      
      // 添加階段標籤
      const stageLabels = g.append("g")
        .selectAll(".stage-label")
        .data(d3.range(totalStages))
        .enter()
        .append("text")
        .attr("class", "stage-label")
        .attr("x", d => (d / (totalStages - 1)) * (chartDimensions.value.width - margin.left - margin.right))
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .text(d => getStageLabel(d, totalStages))
      
    } catch (error) {
      console.error('Chart rendering error:', error)
      ElMessage.error('圖表渲染失敗')
    } finally {
      loading.value = false
    }
  }, 100)
}

const getStageLabel = (stage, totalStages) => {
  if (stage === 0) return '出身'
  if (stage === totalStages - 1) return '最終'
  if (viewMode.value === 'full') {
    return `第${stage}次`
  } else {
    return `第${stage}階段`
  }
}

const handleNodeClick = (node) => {
  console.log('🖱️ Node clicked:', node)
  
  // 建立完整的篩選條件，包含當前已設置的起點和終點過濾器
  const criteria = {
    // 保留當前的起點篩選條件
    selectedOrigins: [...selectedOrigins.value],
    selectedOriginGroups: [...selectedOriginGroups.value],
    
    // 保留當前的終點篩選條件
    selectedDestinations: [...selectedDestinations.value],
    selectedDestinationGroups: [...selectedDestinationGroups.value],
    
    // 添加節點特定的篩選條件
    nodeStage: node.stage,
    nodeDisplayName: node.name
  }
  
  if (node.stage === 0) {
    // 出身一節點 - 添加額外的出身篩選條件
    if (node.name === '(無出身記錄)') {
      criteria.additionalOrigin = ''
    } else if (node.originalValues && node.originalValues.length > 0) {
      // 使用節點中保存的原始值列表
      if (node.originalValues.length === 1) {
        // 單一值
        criteria.additionalOrigin = node.originalValues[0]
      } else {
        // 多個原始值（分組情況）
        criteria.additionalOriginList = node.originalValues
        criteria.additionalOriginFieldType = 'origin'
      }
    } else {
      // 回退：使用節點名稱
      criteria.additionalOrigin = node.name
    }
  } else {
    // 機構/官職節點 - 添加職位階段篩選
    if (node.name === '(無記錄)' || node.name === '(職業結束)') {
      if (activeTab.value === 'institution') {
        criteria.specificInstitution = node.name === '(無記錄)' ? '' : node.name
      } else {
        criteria.specificPosition = node.name === '(無記錄)' ? '' : node.name
      }
    } else if (node.originalValues && node.originalValues.length > 0) {
      // 使用節點中保存的原始值列表
      if (node.originalValues.length === 1) {
        // 單一值
        if (activeTab.value === 'institution') {
          criteria.specificInstitution = node.originalValues[0]
        } else {
          criteria.specificPosition = node.originalValues[0]
        }
      } else {
        // 多個原始值（分組情況）
        criteria.specificValuesList = node.originalValues
        criteria.specificFieldType = activeTab.value === 'institution' ? 'institution' : 'position'
      }
    } else {
      // 回退：使用節點名稱
      if (activeTab.value === 'institution') {
        criteria.specificInstitution = node.name
      } else {
        criteria.specificPosition = node.name
      }
    }
    
    // 添加階段資訊，用於確定這是哪一個職業階段
    criteria.careerStage = node.stage
  }
  
  emit('selection-changed', criteria)
  ElMessage.success(`已選擇第${node.stage + 1}階段：${node.name}`)
}

const handleDimensionsChanged = (dimensions) => {
  chartDimensions.value = dimensions
  updateChart()
}

const handleResize = () => {
  updateChart()
}

const exportChart = () => {
  if (svg) {
    const chartType = activeTab.value === 'institution' ? '機構' : '官職'
    const trackingType = trackingMode.value ? '機構流動' : '出身追蹤'
    const filename = `職業路徑-${chartType}流動-${trackingType}-${Date.now()}.svg`
    exportSVG(svg.node(), filename)
    ElMessage.success('圖表已匯出為SVG格式')
  }
}

const exportPNGChart = async () => {
  if (svg) {
    try {
      const chartType = activeTab.value === 'institution' ? '機構' : '官職'
      const trackingType = trackingMode.value ? '機構流動' : '出身追蹤'
      const filename = `職業路徑-${chartType}流動-${trackingType}-${Date.now()}.png`
      await exportPNG(svg.node(), filename)
      ElMessage.success('圖表已匯出為PNG格式')
    } catch (error) {
      console.error('PNG export error:', error)
      ElMessage.error('PNG匯出失敗')
    }
  }
}

// 監聽數據變化
watch(() => dataStore.effectiveData, () => {
  updateAvailableOptions()
  updateChart()
})
watch(() => dataStore.printMode, updateChart)
watch(() => dataStore.currentTheme, updateChart)
watch(() => dataStore.sankeyLineStyleMode, updateChart)

// 監聽鎖定狀態變化，自動更新圖表
watch(() => dataStore.isListLocked, (newLocked, oldLocked) => {
  console.log(`🔒 CareerAlluvialChart: Lock status changed from ${oldLocked} to ${newLocked}`)
  if (newLocked) {
    // 切換到鎖定模式時，自動更新圖表
    console.log('🔒 自動更新桑基圖以顯示鎖定數據')
    updateChart()
  } else {
    // 解鎖時清除自動選擇的起點出身
    selectedOrigins.value = []
    selectedDestinations.value = []
    selectedOriginGroups.value = []
    selectedDestinationGroups.value = []
    console.log('🔓 已清除桑基圖的篩選條件')
    updateChart()
  }
})

// Watch for changes in excluded officials from drawer
watch(() => props.filterCriteria?.excludedPersonUIDs, (newUIDs, oldUIDs) => {
  // 將 undefined 或 null 轉換為空陣列以便統一處理
  const normalizedNewUIDs = newUIDs || []
  const normalizedOldUIDs = oldUIDs || []
  
  // 檢查是否發生變化（包括長度變化和內容變化）
  const hasChanged = normalizedNewUIDs.length !== normalizedOldUIDs.length || 
    !normalizedNewUIDs.every((uid, index) => uid === normalizedOldUIDs[index])
  
  if (hasChanged) {
    if (normalizedNewUIDs.length > 0) {
      console.log('🎯 CareerAlluvialChart: Detected excludedPersonUIDs change:', normalizedNewUIDs.length, 'officials excluded')
    } else {
      console.log('🎯 CareerAlluvialChart: excludedPersonUIDs cleared, showing all data again')
    }
    
    // 強制清除現有圖表並重新渲染
    console.log('🔄 CareerAlluvialChart: 強制重新渲染圖表')
    
    // 延遲一點時間確保狀態更新完成
    nextTick(() => {
      setTimeout(() => {
        // 強制清除SVG
        if (chartContainer.value) {
          d3.select(chartContainer.value).selectAll("*").remove()
          svg = null
        }
        
        // 重新渲染
        updateChart()
      }, 50)
    })
  }
}, { deep: true })

// 監聽整個 filterCriteria 物件的變化（作為備用監聽器）
watch(() => props.filterCriteria, (newCriteria, oldCriteria) => {
  // 這個 watch 作為備用，主要處理 filterCriteria 其他屬性的變化
  // excludedPersonUIDs 的變化已經由上面專門的 watch 處理
  
  // 如果有其他需要監聽的 filterCriteria 屬性，可以在這裡處理
  // 目前暫時保留，以防需要處理其他篩選條件的變化
}, { deep: true })

// 移除了自動更新的watch，改用事件處理函數控制
// 只保留必要的watch

// 過濾器狀態管理方法
const getFilterState = () => {
  return {
    activeTab: activeTab.value,
    viewMode: viewMode.value,
    maxSteps: maxSteps.value,
    excludeBanner: excludeBanner.value,
    trackingMode: trackingMode.value,
    localPrintMode: localPrintMode.value,
    useDynamicSteps: useDynamicSteps.value,
    selectedOrigins: selectedOrigins.value,
    selectedDestinations: selectedDestinations.value,
    selectedOriginGroups: selectedOriginGroups.value,
    selectedDestinationGroups: selectedDestinationGroups.value
  }
}

const setFilterState = (state) => {
  if (!state) return
  
  if (state.activeTab !== undefined) activeTab.value = state.activeTab
  if (state.viewMode !== undefined) viewMode.value = state.viewMode
  if (state.maxSteps !== undefined) maxSteps.value = state.maxSteps
  if (state.excludeBanner !== undefined) excludeBanner.value = state.excludeBanner
  if (state.trackingMode !== undefined) trackingMode.value = state.trackingMode
  if (state.localPrintMode !== undefined) localPrintMode.value = state.localPrintMode
  if (state.useDynamicSteps !== undefined) useDynamicSteps.value = state.useDynamicSteps
  if (state.selectedOrigins !== undefined) selectedOrigins.value = state.selectedOrigins
  if (state.selectedDestinations !== undefined) selectedDestinations.value = state.selectedDestinations
  if (state.selectedOriginGroups !== undefined) selectedOriginGroups.value = state.selectedOriginGroups
  if (state.selectedDestinationGroups !== undefined) selectedDestinationGroups.value = state.selectedDestinationGroups
  
  setTimeout(() => {
    updateChart()
  }, 100)
}

// 暴露方法給父組件
defineExpose({
  getFilterState,
  setFilterState,
  renderChart,
  updateChart
})
</script>

<style scoped>
.alluvial-chart-container {
  display: flex;
  flex-direction: column;
}

.chart-header {
  margin-bottom: 15px;
}

.chart-info {
  margin-bottom: 15px;
  text-align: center;
}

.chart-info .el-tag {
  margin: 0 5px;
}

.chart-area {
  min-height: 400px;
  padding: 10px;
  position: relative;
}


/* 自定義tab樣式 */
.alluvial-chart-container :deep(.el-tabs__nav-wrap) {
  margin-bottom: 0;
}

.alluvial-chart-container :deep(.el-tabs__content) {
  display: none;
}

/* Alluvial圖樣式 */
.alluvial-chart-container :deep(.node rect) {
  cursor: pointer;
}

.alluvial-chart-container :deep(.link) {
  cursor: pointer;
  transition: opacity 0.3s;
}

.alluvial-chart-container :deep(.stage-label) {
  fill: #303133;
}

/* 下拉框優化 */
.alluvial-chart-container :deep(.el-select) {
  --el-select-input-focus-border-color: #409eff;
}

.alluvial-chart-container :deep(.el-select .el-input__wrapper) {
  box-shadow: 0 0 0 1px #dcdfe6 inset;
}

.alluvial-chart-container :deep(.el-select .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #c0c4cc inset;
}

.alluvial-chart-container :deep(.el-select .el-input.is-focus .el-input__wrapper) {
  box-shadow: 0 0 0 1px #409eff inset;
}

/* 下拉選項樣式 */
:deep(.origin-select-dropdown .el-select-dropdown__item),
:deep(.destination-select-dropdown .el-select-dropdown__item) {
  height: auto;
  line-height: 1.4;
  padding: 8px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

:deep(.origin-select-dropdown .el-select-dropdown__item span),
:deep(.destination-select-dropdown .el-select-dropdown__item span) {
  float: none !important;
}

/* 標籤樣式 */
.alluvial-chart-container :deep(.el-tag) {
  margin-right: 4px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 追蹤功能說明樣式 */
.tracking-info {
  margin: 15px 0;
}

.tracking-info :deep(.el-alert) {
  border-radius: 8px;
}

.tracking-info :deep(.el-alert__content) {
  padding: 0 8px;
}

.tracking-info ul {
  margin: 8px 0;
  padding-left: 20px;
}

.tracking-info li {
  margin: 4px 0;
  line-height: 1.4;
}

.tracking-info p {
  margin: 8px 0;
}

/* Filter button styles */
.filter-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  text-align: left;
  border: 1px solid var(--el-border-color);
  background-color: var(--el-bg-color);
}

.filter-button:hover {
  border-color: var(--el-color-primary);
}

.filter-button span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  margin-right: 8px;
}

/* 智能步數說明區域 */
.smart-steps-info {
  margin: 16px 0;
}

.smart-steps-info :deep(.el-alert__title) {
  font-size: 16px;
  font-weight: 600;
}

.smart-steps-info :deep(.el-alert__content) {
  margin-top: 8px;
}

.smart-steps-info p {
  margin: 8px 0;
  line-height: 1.6;
}

.smart-steps-info strong {
  color: #409eff;
}

</style>