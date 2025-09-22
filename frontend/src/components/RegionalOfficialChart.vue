<template>
  <div class="regional-chart-container">
    <!-- 操作步驟指引 -->
    <ChartStepsGuide :active-step="currentStep" />
    
    <div class="chart-controls">
      <el-row :gutter="15">
        <el-col :span="12">
          <el-select
            v-model="selectedRegion"
            placeholder="選擇地區"
            clearable
            @change="onFilterChange"
            :disabled="dataStore.isListLocked"
          >
            <el-option
              v-for="region in dataStore.uniqueRegions"
              :key="region"
              :label="region"
              :value="region"
            />
          </el-select>
        </el-col>
        <el-col :span="12">
          <el-select
            v-model="selectedPosition"
            placeholder="選擇官職"
            clearable
            @change="onFilterChange"
            :disabled="dataStore.isListLocked"
          >
            <el-option
              v-for="position in dataStore.uniquePositions"
              :key="position"
              :label="position"
              :value="position"
            />
          </el-select>
        </el-col>
      </el-row>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 15px; flex-wrap: wrap; gap: 15px;">
        <el-radio-group v-model="groupBy" @change="updateChart" class="group-by-switch">
          <el-radio-button label="banner">按旗分統計</el-radio-button>
          <el-radio-button label="background">按出身統計</el-radio-button>
        </el-radio-group>
        
        <div style="display: flex; align-items: center; gap: 8px;">
          <el-text size="small" type="info">統計階段:</el-text>
          <el-radio-group v-model="careerStageMode" @change="onStageStrategyChange" size="small" class="career-stage-switch">
            <el-radio-button label="first">首次任職</el-radio-button>
            <el-radio-button label="last">最後任職</el-radio-button>
            <el-radio-button label="specific">指定階段</el-radio-button>
            <el-radio-button label="all">所有記錄</el-radio-button>
          </el-radio-group>
          
          <el-select
            v-if="careerStageMode === 'specific'"
            v-model="specificStage"
            @change="updateChart"
            size="small"
            style="width: 120px"
            placeholder="選擇階段"
            class="specific-stage-select"
          >
            <el-option
              v-for="stage in availableStages"
              :key="stage.value"
              :label="stage.label"
              :value="stage.value"
            />
          </el-select>
          
          <el-tooltip placement="top" width="350px">
            <template #content>
              <div>
                <p><strong>首次任職</strong>：每位官員只統計第一次任職的機構</p>
                <p><strong>最後任職</strong>：每位官員只統計最後一次任職的機構</p>
                <p><strong>指定階段</strong>：統計官員在特定轉職階段的機構（與桑基圖一致）</p>
                <p><strong>所有記錄</strong>：統計官員所有任職記錄（可能重複計算）</p>
              </div>
            </template>
            <el-icon color="#409eff" style="cursor: help;"><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <el-switch
            v-model="excludeBanner"
            active-text="排除旗人"
            inactive-text="包含旗人"
            @change="onFilterChange"
            size="small"
            class="exclude-banner-switch"
          />
          <el-switch
            v-model="percentageMode"
            active-text="百分比"
            inactive-text="數值"
            @change="() => onFilterChange(true)"
            size="small"
            class="percentage-mode-switch"
          />
          <el-dropdown @command="changeTheme" trigger="click">
            <el-button size="small" type="success" plain>
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
          <TagSelector
            :chart-title="'機構官員組成圖 - 選擇機構'"
            :button-text="'選擇機構'"
            :options="institutionOptions"
            v-model="selectedInstitutions"
            :groups="institutionGroups"
            :default-selection="defaultInstitutions"
            @selection-changed="onInstitutionSelectionChanged"
            @update:groups="institutionGroups = $event"
          />
          
          <TagSelector
            :chart-title="`機構官員組成圖 - 選擇${groupBy === 'banner' ? '旗分' : '出身'}`"
            :button-text="`選擇${groupBy === 'banner' ? '旗分' : '出身'}`"
            :options="statsGroupsOptions"
            v-model="selectedStatsGroups"
            :groups="statsGroupsGroups"
            :default-selection="defaultStatsGroups"
            @selection-changed="onStatsGroupsSelectionChanged"
            @update:groups="statsGroupsGroups = $event"
          />
          
          <el-button 
            type="primary" 
            size="small" 
            @click="renderChart"
            :disabled="!hasValidConfiguration"
            style="font-weight: 600; margin-left: 15px;"
            class="render-chart-button"
          >
            <el-icon><RefreshRight /></el-icon>
            繪製圖表
          </el-button>
          
          <el-switch
            v-model="localPrintMode"
            active-text="列印版"
            inactive-text="彩色版"
            @change="onFilterChange"
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
            type="info"
            plain
            :disabled="!svg"
            class="export-button"
          >
            <el-icon><Grid /></el-icon>
            文字版
          </el-button>
          
          <el-button 
            @click="regionalDrawerVisible = true" 
            size="small" 
            type="warning"
            :disabled="!dataStore.effectiveData.length || dataStore.isListLocked"
          >
            <el-icon><Search /></el-icon>
            詳細篩選
          </el-button>
        </div>
      </div>
    </div>
    
    <ChartDimensionSliders
      :defaultWidth="800"
      :defaultHeight="400"
      @dimensions-changed="handleDimensionsChanged"
    />
    
    <!-- 統計資訊 -->
    <div class="chart-stats" v-if="statsData.totalPersons > 0">
      <el-tag type="info" size="small">
        統計 {{ statsData.totalPersons }} 位官員
      </el-tag>
      <el-tag type="success" size="small">
        共 {{ statsData.totalRecords }} 條記錄
      </el-tag>
      <el-tag type="warning" size="small" v-if="statsData.institutions">
        涉及 {{ statsData.institutions }} 個機構
      </el-tag>
    </div>
    
    <div 
      ref="chartContainer" 
      class="chart-area"
      v-loading="loading"
      element-loading-text="正在分析數據..."
      element-loading-background="rgba(255, 255, 255, 0.8)"
    ></div>
    
    <div class="chart-legend" v-if="legendItems.length">
      <el-tag
        v-for="item in legendItems"
        :key="item.name"
        :style="{ backgroundColor: item.color, color: 'white' }"
        style="margin: 2px"
      >
        {{ item.name || '(未記錄)' }}: {{ item.count }}
      </el-tag>
    </div>
    
    <!-- 機構官員篩選抽屜 -->
    <RegionalOfficialDrawer 
      v-model:visible="regionalDrawerVisible"
      :filter-criteria="currentFilterCriteria"
      @close="regionalDrawerVisible = false"
      @officials-changed="handleOfficialsChanged"
    />
    
    <!-- 表格檢視 -->
    <ChartDataTableView
      v-model:visible="tableViewVisible"
      :title="`機構官員組成 - ${groupBy === 'banner' ? '旗分' : '出身'}統計`"
      :data="tableData"
      :columns="tableColumns"
      @close="tableViewVisible = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import * as d3 from 'd3'
import { useDataStore } from '../stores/dataStore'
import { ElMessage } from 'element-plus'
import { ArrowDown, Search, RefreshRight, Grid, QuestionFilled } from '@element-plus/icons-vue'
import { exportSVG, exportPNG, createPatterns, getColorScheme, getThemeNames, getTheme } from '../utils/chartUtils'
import { getStandardizedBackground } from '../utils/dataUtils'
import TagSelector from './TagSelector.vue'
import ChartDimensionSliders from './ChartDimensionSliders.vue'
import RegionalOfficialDrawer from './RegionalOfficialDrawer.vue'
import ChartStepsGuide from './ChartStepsGuide.vue'
import ChartDataTableView from './ChartDataTableView.vue'

const emit = defineEmits(['selection-changed'])

const dataStore = useDataStore()
const chartContainer = ref(null)
const selectedRegion = ref('')
const selectedPosition = ref('')
const groupBy = ref('banner')
const careerStageMode = ref('first') // 'first', 'last', 'specific', 'all'
const specificStage = ref(1) // 指定的階段編號（1-based）

// 計算可用的階段選項
const availableStages = computed(() => {
  if (!dataStore.effectiveData.length) return []
  
  // 分析有效數據中的最大階段數
  const officialRecords = {}
  let filteredData = dataStore.effectiveData
  
  // 如果不是鎖定模式，應用篩選條件
  if (!dataStore.isListLocked) {
    if (excludeBanner.value) {
      filteredData = filteredData.filter(d => !d.旗分 || d.旗分.trim() === '')
    }
    if (selectedRegion.value) {
      filteredData = filteredData.filter(d => d.地區 === selectedRegion.value)
    }
    if (selectedPosition.value) {
      filteredData = filteredData.filter(d => d.官職一 === selectedPosition.value)
    }
  }
  
  // 按 PersonUID 分組所有記錄
  filteredData.forEach(d => {
    if (!d.PersonUID) return
    if (!officialRecords[d.PersonUID]) {
      officialRecords[d.PersonUID] = []
    }
    officialRecords[d.PersonUID].push(d)
  })
  
  // 找出最大階段數
  let maxStages = 0
  Object.values(officialRecords).forEach(records => {
    records.sort((a, b) => a.record_number - b.record_number)
    maxStages = Math.max(maxStages, records.length)
  })
  
  // 生成階段選項
  const stages = []
  for (let i = 1; i <= maxStages; i++) {
    stages.push({
      value: i,
      label: `第 ${i} 階段`
    })
  }
  
  console.log(`📊 RegionalOfficialChart - availableStages: 最大階段數 ${maxStages}, 生成 ${stages.length} 個選項`)
  return stages
})
const excludeBanner = ref(false)
const percentageMode = ref(false)
const legendItems = ref([])
const loading = ref(false)
const localPrintMode = ref(false)
const regionalDrawerVisible = ref(false)
const tableViewVisible = ref(false)
const statsData = ref({
  totalPersons: 0,
  totalRecords: 0,
  institutions: 0
})

// 操作步驟狀態
const currentStep = ref(0)

// 驗證是否有有效配置
const hasValidConfiguration = computed(() => {
  console.log('🔍 hasValidConfiguration computed called - isListLocked:', dataStore.isListLocked)
  
  // 如果已經鎖定名單，可以直接繪製
  if (dataStore.isListLocked) {
    console.log('🔒 RegionalOfficialChart - 名單已鎖定，可以直接繪製')
    return true
  }
  
  // 否則需要選擇機構
  const hasInstitutions = selectedInstitutions.value.length > 0 || institutionGroups.value.length > 0
  console.log('🔓 RegionalOfficialChart - 名單未鎖定，檢查機構選擇:', {
    selectedInstitutions: selectedInstitutions.value.length,
    institutionGroups: institutionGroups.value.length,
    hasInstitutions
  })
  return hasInstitutions
})

// 注：統計分組現在根據groupBy自動決定，不需要額外選擇

// 機構選擇相關
const selectedInstitutions = ref([])
const allAvailableInstitutions = ref([])
const institutionGroups = ref([])

// 統計分組選擇相關（出身/旗分）
const selectedStatsGroups = ref([])
const allAvailableStatsGroups = ref([])
const statsGroupsGroups = ref([])

// 動態計算機構選項
const institutionOptions = computed(() => {
  return allAvailableInstitutions.value.map(inst => ({
    key: inst,
    label: inst === '(無機構)' ? '無機構記錄' : inst
  }))
})


// 預設選擇（顯示前15個最常見的機構）
const defaultInstitutions = computed(() => {
  return allAvailableInstitutions.value.slice(0, 15)
})

// 動態計算統計分組選項
const statsGroupsOptions = computed(() => {
  return allAvailableStatsGroups.value.map(group => ({
    key: group,
    label: group === '(無旗分)' ? '無旗分記錄' : (group === '(無出身記錄)' ? '無出身記錄' : group)
  }))
})

// 預設選擇（顯示所有可用的統計分組）
const defaultStatsGroups = computed(() => {
  return allAvailableStatsGroups.value
})

let svg = null
let tooltip = null

const margin = { top: 20, right: 100, bottom: 150, left: 60 }
const chartDimensions = ref({ width: 800, height: 400 })

let patternIds = []

const themeNames = getThemeNames()

// 表格檢視數據
const tableData = computed(() => {
  if (!legendItems.value.length) return []
  
  // 假設我們有當前的 stackData 和 institutions，我們需要重新生成表格數據
  // 由於這是計算屬性，我們需要依賴現有的響應式數據
  const data = []
  
  // 這裡需要根據圖表的實際數據重新生成
  // 暫時使用 legendItems 作為基礎數據
  legendItems.value.forEach((item, index) => {
    data.push({
      序號: index + 1,
      分組名稱: item.name,
      人數: item.count,
      百分比: legendItems.value.reduce((sum, i) => sum + i.count, 0) > 0 
        ? ((item.count / legendItems.value.reduce((sum, i) => sum + i.count, 0)) * 100).toFixed(1) + '%'
        : '0%'
    })
  })
  
  return data
})

const tableColumns = computed(() => [
  { prop: '序號', label: '序號', width: 80 },
  { prop: '分組名稱', label: `${groupBy.value === 'banner' ? '旗分' : '出身'}分組`, width: 200 },
  { prop: '人數', label: '人數', width: 100 },
  { prop: '百分比', label: '佔比', width: 100 }
])

// 當前篩選條件
const currentFilterCriteria = computed(() => {
  return {
    region: selectedRegion.value,
    position: selectedPosition.value,
    excludeBanner: excludeBanner.value
  }
})

const changeTheme = (themeName) => {
  dataStore.currentTheme = themeName
  ElMessage.success(`已切換至${getTheme(themeName).name}`)
}

const handleOfficialsChanged = (deselectedUIDs) => {
  // 將下架的官員添加到排除列表
  const criteria = {
    ...currentFilterCriteria.value,
    excludedPersonUIDs: deselectedUIDs
  }
  emit('selection-changed', criteria)
  ElMessage.success(`已下架 ${deselectedUIDs.length} 位官員，圖表將會更新`)
}

onMounted(() => {
  initChart()
  updateAvailableInstitutions()
  // 初始化步驟狀態
  currentStep.value = 0
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (tooltip) {
    tooltip.remove()
  }
})

const initChart = () => {
  const container = d3.select(chartContainer.value)
  container.select("svg").remove()
  
  svg = container
    .append("svg")
    .attr("width", "100%")
    .attr("height", chartDimensions.value.height)
    .attr("viewBox", `0 0 ${chartDimensions.value.width} ${chartDimensions.value.height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
  
  // 創建patterns用於列印模式
  patternIds = createPatterns(svg)
  
  // 創建tooltip
  if (tooltip) tooltip.remove()
  tooltip = d3.select("body")
    .append("div")
    .attr("class", "chart-tooltip")
    .style("opacity", 0)
    .style("position", "absolute")
    .style("padding", "10px")
    .style("background", "rgba(0, 0, 0, 0.8)")
    .style("color", "white")
    .style("border-radius", "4px")
    .style("pointer-events", "none")
    .style("font-size", "12px")
}


// 處理機構選擇變化
const onInstitutionSelectionChanged = (selectedValues, groups, direction) => {
  console.log('📊 RegionalOfficialChart - 機構選擇變化:', {
    selectedValues: selectedValues.slice(0, 5),
    groupsCount: groups.length,
    direction,
    groups: groups
  })
  
  // 更新分組資料
  institutionGroups.value = groups
  console.log('📊 RegionalOfficialChart - 更新 institutionGroups:', {
    length: institutionGroups.value.length,
    data: institutionGroups.value
  })
  
  // 更新步驟狀態
  currentStep.value = Math.max(currentStep.value, 1)
  // 不自動渲染圖表，等待用戶點擊「繪製圖表」
}

// 處理統計分組選擇變化
const onStatsGroupsSelectionChanged = (selectedValues, groups, direction) => {
  console.log('📊 RegionalOfficialChart - 統計分組選擇變化:', {
    selectedValues: selectedValues.slice(0, 5),
    groupsCount: groups.length,
    direction,
    groups: groups
  })
  
  // 更新分組資料
  statsGroupsGroups.value = groups
  console.log('📊 RegionalOfficialChart - 更新 statsGroupsGroups:', statsGroupsGroups.value.length)
  
  // 更新步驟狀態
  currentStep.value = Math.max(currentStep.value, 1)
  // 不自動渲染圖表，等待用戶點擊「繪製圖表」
}

// 更新可用機構列表
const updateAvailableInstitutions = () => {
  if (!dataStore.effectiveData.length) return
  
  const institutionSet = new Set()
  const statsGroupsSet = new Set()
  let filteredData = dataStore.effectiveData
  
  // 如果不是鎖定模式，才應用額外的篩選條件
  if (!dataStore.isListLocked) {
    // 應用現有篩選條件
    if (excludeBanner.value) {
      filteredData = filteredData.filter(d => !d.旗分 || d.旗分.trim() === '')
    }
    if (selectedRegion.value) {
      filteredData = filteredData.filter(d => d.地區 === selectedRegion.value)
    }
    if (selectedPosition.value) {
      filteredData = filteredData.filter(d => d.官職一 === selectedPosition.value)
    }
  }
  
  // 收集所有機構和統計分組並統計人數（考慮轉職階段）
  const institutionPersonCounts = {}
  const statsGroupsPersonCounts = {}
  
  if (careerStageMode.value === 'all') {
    // 原邏輯：統計所有記錄
    filteredData.forEach(d => {
      const institution = d.機構一 || '(無機構)'
      institutionSet.add(institution)
      if (!institutionPersonCounts[institution]) {
        institutionPersonCounts[institution] = new Set()
      }
      if (d.PersonUID) {
        institutionPersonCounts[institution].add(d.PersonUID)
      }
      
      // 收集統計分組（根據當前選擇的 groupBy 模式）
      const statsGroup = groupBy.value === 'banner' ? (d.旗分 || '(無旗分)') : getStandardizedBackground(d)
      statsGroupsSet.add(statsGroup)
      if (!statsGroupsPersonCounts[statsGroup]) {
        statsGroupsPersonCounts[statsGroup] = new Set()
      }
      if (d.PersonUID) {
        statsGroupsPersonCounts[statsGroup].add(d.PersonUID)
      }
    })
  } else {
    // 新邏輯：按特定階段統計（首次、最後或指定階段）
    const officialRecords = {}
    
    // 按 PersonUID 分組所有記錄
    filteredData.forEach(d => {
      if (!d.PersonUID) return
      if (!officialRecords[d.PersonUID]) {
        officialRecords[d.PersonUID] = []
      }
      officialRecords[d.PersonUID].push(d)
    })
    
    // 對每個官員的記錄進行排序並選擇目標記錄
    Object.entries(officialRecords).forEach(([personUID, records]) => {
      records.sort((a, b) => a.record_number - b.record_number)
      
      let targetRecord
      if (careerStageMode.value === 'first') {
        targetRecord = records[0]
      } else if (careerStageMode.value === 'last') {
        targetRecord = records[records.length - 1]
      } else if (careerStageMode.value === 'specific') {
        // 使用指定的階段（1-based，需要轉換為 0-based 索引）
        const targetIndex = specificStage.value - 1
        if (targetIndex >= 0 && targetIndex < records.length) {
          targetRecord = records[targetIndex]
        }
      }
      
      if (targetRecord) {
        const institution = targetRecord.機構一 || '(無機構)'
        institutionSet.add(institution)
        if (!institutionPersonCounts[institution]) {
          institutionPersonCounts[institution] = new Set()
        }
        institutionPersonCounts[institution].add(personUID)
        
        // 收集統計分組
        const statsGroup = groupBy.value === 'banner' ? 
          (targetRecord.旗分 || '(無旗分)') : 
          getStandardizedBackground(targetRecord)
        statsGroupsSet.add(statsGroup)
        if (!statsGroupsPersonCounts[statsGroup]) {
          statsGroupsPersonCounts[statsGroup] = new Set()
        }
        statsGroupsPersonCounts[statsGroup].add(personUID)
      }
    })
  }
  
  // 按人數排序機構
  allAvailableInstitutions.value = Array.from(institutionSet).sort((a, b) => {
    const aCount = institutionPersonCounts[a] ? institutionPersonCounts[a].size : 0
    const bCount = institutionPersonCounts[b] ? institutionPersonCounts[b].size : 0
    return bCount - aCount
  })
  
  // 按人數排序統計分組
  allAvailableStatsGroups.value = Array.from(statsGroupsSet).sort((a, b) => {
    const aCount = statsGroupsPersonCounts[a] ? statsGroupsPersonCounts[a].size : 0
    const bCount = statsGroupsPersonCounts[b] ? statsGroupsPersonCounts[b].size : 0
    return bCount - aCount
  })
  
  console.log(`🔍 RegionalOfficialChart - updateAvailableInstitutions:`, {
    totalData: dataStore.effectiveData.length,
    filteredData: filteredData.length,
    availableInstitutions: allAvailableInstitutions.value.length,
    institutionsPreview: allAvailableInstitutions.value.slice(0, 5),
    availableStatsGroups: allAvailableStatsGroups.value.length,
    statsGroupsPreview: allAvailableStatsGroups.value.slice(0, 5),
    groupByMode: groupBy.value,
    isLocked: dataStore.isListLocked
  })
  
  // 如果還沒有選擇，或者選擇的機構不在當前可用選項中，重新設置預設選擇
  if (selectedInstitutions.value.length === 0 || !selectedInstitutions.value.some(inst => allAvailableInstitutions.value.includes(inst))) {
    selectedInstitutions.value = [...defaultInstitutions.value]
    console.log(`🔄 RegionalOfficialChart - 重新設置預設機構選擇:`, selectedInstitutions.value.slice(0, 5))
  }
  
  // 如果還沒有選擇統計分組，設置預設選擇
  if (selectedStatsGroups.value.length === 0) {
    selectedStatsGroups.value = [...defaultStatsGroups.value]
    console.log(`🔄 RegionalOfficialChart - 重新設置預設統計分組選擇:`, selectedStatsGroups.value.slice(0, 5))
  }
  
  // 保留現有的分組，但移除不再可用的項目
  console.log('🔄 RegionalOfficialChart - 檢查現有分組的有效性')
  if (institutionGroups.value.length > 0) {
    console.log('🔄 RegionalOfficialChart - 當前分組:', institutionGroups.value.map(g => ({ name: g.name, items: g.items.length })))
    console.log('🔄 RegionalOfficialChart - 可用機構前5個:', allAvailableInstitutions.value.slice(0, 5))
    
    const validatedGroups = institutionGroups.value.map(group => {
      const validItems = group.items.filter(item => allAvailableInstitutions.value.includes(item))
      console.log(`🔄 RegionalOfficialChart - 分組 "${group.name}": ${group.items.length} -> ${validItems.length} 項`)
      return {
        ...group,
        items: validItems
      }
    }).filter(group => group.items.length > 0)
    
    if (validatedGroups.length !== institutionGroups.value.length) {
      console.log(`🔄 RegionalOfficialChart - 機構分組已清理: ${institutionGroups.value.length} -> ${validatedGroups.length}`)
      institutionGroups.value = validatedGroups
    } else {
      console.log('🔄 RegionalOfficialChart - 機構分組無需清理')
    }
  }
  
  if (statsGroupsGroups.value.length > 0) {
    const validatedStatsGroups = statsGroupsGroups.value.map(group => ({
      ...group,
      items: group.items.filter(item => allAvailableStatsGroups.value.includes(item))
    })).filter(group => group.items.length > 0)
    
    if (validatedStatsGroups.length !== statsGroupsGroups.value.length) {
      console.log(`🔄 RegionalOfficialChart - 統計分組已清理: ${statsGroupsGroups.value.length} -> ${validatedStatsGroups.length}`)
      statsGroupsGroups.value = validatedStatsGroups
    }
  }
}

// 轉職階段策略變更處理
const onStageStrategyChange = () => {
  console.log(`📊 RegionalOfficialChart - 轉職階段策略變更: ${careerStageMode.value}`, {
    specificStage: specificStage.value,
    availableStages: availableStages.value.length
  })
  
  // 當切換到指定階段模式時，確保有效的階段值
  if (careerStageMode.value === 'specific' && availableStages.value.length > 0) {
    if (specificStage.value < 1 || specificStage.value > availableStages.value.length) {
      specificStage.value = 1 // 預設選擇第一階段
    }
  }
  
  // 重新計算可用選項
  updateAvailableInstitutions()
  
  // 更新步驟狀態但不自動渲染
  currentStep.value = hasValidConfiguration.value ? 2 : 1
}

// 篩選條件變更時的處理
const onFilterChange = (autoRender = false) => {
  // 更新步驟狀態
  currentStep.value = hasValidConfiguration.value ? 2 : 1
  
  // 重新計算可用選項
  updateAvailableInstitutions()
  
  // 只有在明確指定自動渲染時才重新渲染圖表（如百分比切換）
  if (autoRender && hasValidConfiguration.value) {
    updateChart()
  }
}


// 手動繪製圖表
const renderChart = () => {
  console.log('🎯 renderChart called - hasValidConfiguration:', hasValidConfiguration.value)
  if (!hasValidConfiguration.value) {
    ElMessage.warning('請先選擇要分析的機構')
    return
  }
  currentStep.value = 2
  console.log('🎯 renderChart calling updateChart')
  updateChart()
}

const updateChart = () => {
  if (!svg || !dataStore.effectiveData.length) return
  
  loading.value = true
  
  // 使用 setTimeout 讓 loading 動畫有時間顯示
  setTimeout(() => {
    try {
      svg.selectAll("*").remove()
  
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)
  
  // 過濾數據
  let filteredData = dataStore.effectiveData
  
  // 驗證鎖定數據的一致性
  if (dataStore.isListLocked) {
    const lockedUIDs = Array.from(dataStore.lockedPersonUIDs)
    const effectiveUIDs = new Set(filteredData.map(d => d.PersonUID).filter(Boolean))
    const missingUIDs = lockedUIDs.filter(uid => !effectiveUIDs.has(uid))
    const extraUIDs = Array.from(effectiveUIDs).filter(uid => !dataStore.lockedPersonUIDs.has(uid))
    
    console.log(`🔍 RegionalOfficialChart - 鎖定數據一致性檢查:`, {
      lockedUIDs: lockedUIDs.length,
      effectiveUIDs: effectiveUIDs.size,
      missingUIDs: missingUIDs.length,
      extraUIDs: extraUIDs.length,
      sampleMissing: missingUIDs.slice(0, 3),
      sampleExtra: extraUIDs.slice(0, 3)
    })
  }
  
  // 如果不是鎖定模式，才應用額外的篩選條件
  if (!dataStore.isListLocked) {
    // 排除旗人篩選
    if (excludeBanner.value) {
      filteredData = filteredData.filter(d => !d.旗分 || d.旗分.trim() === '')
    }
    
    if (selectedRegion.value) {
      filteredData = filteredData.filter(d => d.地區 === selectedRegion.value)
    }
    
    if (selectedPosition.value) {
      filteredData = filteredData.filter(d => d.官職一 === selectedPosition.value)
    }
  }
  
  // 按機構和分組統計（出身或旗分）
  const institutionStats = {}
  const uniquePersons = new Set()
  
  console.log(`🔍 RegionalOfficialChart - 開始統計 ${groupBy.value} 數據:`, {
    filteredDataLength: filteredData.length,
    groupByMode: groupBy.value,
    careerStageMode: careerStageMode.value,
    specificStage: specificStage.value,
    isLocked: dataStore.isListLocked,
    lockedPersonCount: dataStore.lockedPersonUIDs.size,
    effectiveDataLength: dataStore.effectiveData.length,
    sampleRecord: filteredData[0]
  })
  
  // 根據轉職階段選擇統計邏輯
  if (careerStageMode.value === 'all') {
    // 原來的邏輯：統計所有記錄
    filteredData.forEach(d => {
      const institution = d.機構一 || '(無機構)'
      const group = groupBy.value === 'banner' ? (d.旗分 || '(無旗分)') : getStandardizedBackground(d)
      
      if (!institutionStats[institution]) institutionStats[institution] = {}
      if (!institutionStats[institution][group]) institutionStats[institution][group] = new Set()
      
      // 使用 PersonUID 去重統計人數
      if (d.PersonUID) {
        institutionStats[institution][group].add(d.PersonUID)
        uniquePersons.add(d.PersonUID)
      }
    })
  } else {
    // 新邏輯：按 PersonUID 分組，取特定階段的記錄
    const officialRecords = {}
    
    // 按 PersonUID 分組所有記錄
    filteredData.forEach(d => {
      if (!d.PersonUID) return
      if (!officialRecords[d.PersonUID]) {
        officialRecords[d.PersonUID] = []
      }
      officialRecords[d.PersonUID].push(d)
    })
    
    // 對每個官員的記錄進行排序
    Object.values(officialRecords).forEach(records => {
      records.sort((a, b) => a.record_number - b.record_number)
    })
    
    // 根據選擇的階段統計
    Object.entries(officialRecords).forEach(([personUID, records]) => {
      let targetRecord
      
      if (careerStageMode.value === 'first') {
        targetRecord = records[0] // 首次任職
      } else if (careerStageMode.value === 'last') {
        targetRecord = records[records.length - 1] // 最後任職
      } else if (careerStageMode.value === 'specific') {
        // 使用指定的階段（1-based，需要轉換為 0-based 索引）
        const targetIndex = specificStage.value - 1
        if (targetIndex >= 0 && targetIndex < records.length) {
          targetRecord = records[targetIndex]
        }
      }
      
      if (targetRecord) {
        const institution = targetRecord.機構一 || '(無機構)'
        const group = groupBy.value === 'banner' ? 
          (targetRecord.旗分 || '(無旗分)') : 
          getStandardizedBackground(targetRecord)
        
        if (!institutionStats[institution]) institutionStats[institution] = {}
        if (!institutionStats[institution][group]) institutionStats[institution][group] = new Set()
        
        institutionStats[institution][group].add(personUID)
        uniquePersons.add(personUID)
      }
    })
  }
  
  console.log(`🔍 RegionalOfficialChart - 統計完成後:`, {
    uniquePersonsSize: uniquePersons.size,
    institutionStatsKeys: Object.keys(institutionStats).length,
    samplePersonUIDs: Array.from(uniquePersons).slice(0, 5),
    lockedPersonUIDs: Array.from(dataStore.lockedPersonUIDs).slice(0, 5),
    isDataMatching: dataStore.isListLocked ? 
      Array.from(uniquePersons).every(uid => dataStore.lockedPersonUIDs.has(uid)) : 'N/A (not locked)'
  })
  
  console.log(`🔍 RegionalOfficialChart - 統計結果:`, {
    institutionCount: Object.keys(institutionStats).length,
    sampleInstitution: Object.keys(institutionStats)[0],
    sampleGroups: institutionStats[Object.keys(institutionStats)[0]] ? Object.keys(institutionStats[Object.keys(institutionStats)[0]]) : []
  })
  
  // 轉換為數值統計
  console.log('🔍 RegionalOfficialChart - 即將轉換統計數據, institutionStats:', institutionStats)
  if (institutionStats && typeof institutionStats === 'object') {
    Object.keys(institutionStats).forEach(institution => {
      if (institutionStats[institution] && typeof institutionStats[institution] === 'object') {
        Object.keys(institutionStats[institution]).forEach(group => {
          if (institutionStats[institution][group] && institutionStats[institution][group].size !== undefined) {
            institutionStats[institution][group] = institutionStats[institution][group].size
          }
        })
      }
    })
  } else {
    console.error('❌ institutionStats is not an object:', typeof institutionStats, institutionStats)
  }
  
  // 準備數據 - 使用用戶選擇的機構
  console.log('🔍 RegionalOfficialChart - 準備排序機構, institutionStats keys:', Object.keys(institutionStats).length)
  const allInstitutionsSorted = Object.keys(institutionStats).sort((a, b) => {
    const aValues = institutionStats[a] ? Object.values(institutionStats[a]) : []
    const bValues = institutionStats[b] ? Object.values(institutionStats[b]) : []
    const aTotal = aValues.length > 0 ? aValues.reduce((sum, count) => sum + (count || 0), 0) : 0
    const bTotal = bValues.length > 0 ? bValues.reduce((sum, count) => sum + (count || 0), 0) : 0
    return bTotal - aTotal
  })
  
  // 處理機構選擇（包含分組）
  const institutions = []
  const institutionDisplayMap = {} // 機構顯示名稱映射
  
  if ((selectedInstitutions.value && selectedInstitutions.value.length > 0) || (institutionGroups.value && institutionGroups.value.length > 0)) {
    
    // 優先處理分組機構 - 如果有分組，只顯示分組
    console.log('🔍 RegionalOfficialChart - 處理分組機構, count:', institutionGroups.value ? institutionGroups.value.length : 0)
    if (Array.isArray(institutionGroups.value) && institutionGroups.value.length > 0) {
      // 創建一個 Set 來記錄哪些機構已經被分組了
      const groupedInstitutions = new Set()
      
      institutionGroups.value.forEach(group => {
        const groupKey = `group_${group.id}`
        institutions.push(groupKey)
        institutionDisplayMap[groupKey] = group.name
        
        // 將分組中的機構數據合併到分組key下
        if (Array.isArray(group.items)) {
          group.items.forEach(inst => {
            groupedInstitutions.add(inst) // 記錄這個機構已被分組
            if (institutionStats[inst]) {
              if (!institutionStats[groupKey]) institutionStats[groupKey] = {}
              const instData = institutionStats[inst]
              if (instData && typeof instData === 'object') {
                Object.keys(instData).forEach(stat => {
                  if (!institutionStats[groupKey][stat]) institutionStats[groupKey][stat] = 0
                  institutionStats[groupKey][stat] += instData[stat] || 0
                })
              }
            }
          })
        }
      })
      
      // 只添加未被分組的個別選擇機構
      console.log('🔍 RegionalOfficialChart - 處理未分組的個別機構')
      if (Array.isArray(selectedInstitutions.value)) {
        selectedInstitutions.value.forEach(inst => {
          if (!groupedInstitutions.has(inst) && allInstitutionsSorted.includes(inst)) {
            institutions.push(inst)
            institutionDisplayMap[inst] = inst
          }
        })
      }
      
    } else {
      // 沒有分組時，正常處理個別選擇的機構
      console.log('🔍 RegionalOfficialChart - 處理個別選擇的機構, count:', selectedInstitutions.value ? selectedInstitutions.value.length : 0)
      if (Array.isArray(selectedInstitutions.value)) {
        selectedInstitutions.value.forEach(inst => {
          if (allInstitutionsSorted.includes(inst)) {
            institutions.push(inst)
            institutionDisplayMap[inst] = inst
          }
        })
      }
    }
  }
  
  // 如果沒有選擇任何機構，使用前15個最常見的機構（包括鎖定模式）
  if (institutions.length === 0) {
    console.log('🏢 RegionalOfficialChart - 沒有選擇機構，使用預設的前15個機構')
    const topInstitutions = allInstitutionsSorted.slice(0, 15)
    institutions.push(...topInstitutions)
    if (Array.isArray(topInstitutions)) {
      topInstitutions.forEach(inst => {
        institutionDisplayMap[inst] = inst
      })
    }
  }
  
  console.log('🏢 RegionalOfficialChart - 最終機構列表:', {
    institutionsCount: institutions.length,
    institutions: institutions.slice(0, 5)
  })
  
  // 處理統計分組（包含分組）
  const groups = []
  const groupDisplayMap = {} // 分組顯示名稱映射
  
  console.log('🔍 RegionalOfficialChart - 即將處理統計分組:')
  console.log('🔍 RegionalOfficialChart - selectedStatsGroups:', selectedStatsGroups.value.length)
  console.log('🔍 RegionalOfficialChart - statsGroupsGroups:', statsGroupsGroups.value.length)
  
  // 優先處理分組統計分組 - 如果有分組，只顯示分組
  if (Array.isArray(statsGroupsGroups.value) && statsGroupsGroups.value.length > 0) {
    // 創建一個 Set 來記錄哪些統計分組已經被分組了
    const groupedStatsGroups = new Set()
    
    statsGroupsGroups.value.forEach(group => {
      const groupKey = `statsGroup_${group.id}`
      groups.push(groupKey)
      groupDisplayMap[groupKey] = group.name
      
      // 記錄分組中的統計分組
      if (Array.isArray(group.items)) {
        group.items.forEach(statsGroup => {
          groupedStatsGroups.add(statsGroup)
        })
      }
    })
    
    // 只添加未被分組的個別選擇統計分組
    console.log('🔍 RegionalOfficialChart - 處理未分組的個別統計分組')
    if (Array.isArray(selectedStatsGroups.value)) {
      selectedStatsGroups.value.forEach(statsGroup => {
        if (!groupedStatsGroups.has(statsGroup)) {
          groups.push(statsGroup)
          groupDisplayMap[statsGroup] = statsGroup
        }
      })
    }
    
  } else {
    // 沒有分組時，正常處理個別選擇的統計分組
    console.log('🔍 RegionalOfficialChart - 處理個別選擇的統計分組, count:', selectedStatsGroups.value ? selectedStatsGroups.value.length : 0)
    if (Array.isArray(selectedStatsGroups.value) && selectedStatsGroups.value.length > 0) {
      selectedStatsGroups.value.forEach(statsGroup => {
        groups.push(statsGroup)
        groupDisplayMap[statsGroup] = statsGroup
      })
    } else {
      // 如果沒有選擇任何統計分組，使用所有可用的統計分組
      console.log('🔍 RegionalOfficialChart - 沒有選擇統計分組，使用所有可用的統計分組')
      allAvailableStatsGroups.value.forEach(statsGroup => {
        groups.push(statsGroup)
        groupDisplayMap[statsGroup] = statsGroup
      })
    }
  }
  
  // 處理統計分組的數據合併（如果有分組）
  if (Array.isArray(statsGroupsGroups.value) && statsGroupsGroups.value.length > 0) {
    console.log('🔍 RegionalOfficialChart - 處理統計分組數據合併')
    statsGroupsGroups.value.forEach(group => {
      const groupKey = `statsGroup_${group.id}`
      
      // 為每個機構合併統計分組數據
      Object.keys(institutionStats).forEach(institution => {
        if (institutionStats[institution] && typeof institutionStats[institution] === 'object') {
          let groupTotal = 0
          if (Array.isArray(group.items)) {
            group.items.forEach(statsGroup => {
              if (institutionStats[institution][statsGroup]) {
                groupTotal += institutionStats[institution][statsGroup]
              }
            })
          }
          institutionStats[institution][groupKey] = groupTotal
        }
      })
    })
  }
  
  console.log(`🔍 RegionalOfficialChart - 準備繪圖數據:`, {
    institutionsCount: institutions.length,
    groupsCount: groups.length,
    institutions: institutions.slice(0, 3),
    groups: groups.slice(0, 5),
    groupBy: groupBy.value
  })
  
  // 準備stack數據
  console.log('🔍 RegionalOfficialChart - 即將創建stackData, institutions:', institutions?.length, 'groups:', groups?.length)
  
  const stackData = (institutions || []).map(institution => {
    const datum = { 
      institution,
      displayName: institutionDisplayMap[institution] || institution
    }
    
    if (groups && Array.isArray(groups)) {
      groups.forEach(group => {
        datum[group] = institutionStats[institution] ? (institutionStats[institution][group] || 0) : 0
      })
    } else {
      console.error('❌ groups is not an array:', groups)
    }
    return datum
  })
  
  console.log(`🔍 RegionalOfficialChart - stackData 樣本:`, {
    stackDataLength: stackData.length,
    sampleData: stackData.slice(0, 2)
  })
  
  // 更新統計資訊
  statsData.value = {
    totalPersons: uniquePersons.size,
    totalRecords: filteredData.length,
    institutions: institutions.length
  }
  
  console.log(`📊 RegionalOfficialChart - 最終統計結果:`, {
    totalPersons: uniquePersons.size,
    totalRecords: filteredData.length,
    institutions: institutions.length,
    isLocked: dataStore.isListLocked,
    lockedPersonUIDs: dataStore.lockedPersonUIDs.size
  })
  
  if (stackData.length === 0) {
    svg.append("text")
      .attr("x", chartDimensions.value.width / 2)
      .attr("y", chartDimensions.value.height / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("fill", "#999")
      .text("無符合條件的數據")
    return
  }
  
  // 設置比例尺
  console.log('🎨 RegionalOfficialChart - 設置比例尺, institutions:', institutions?.length, institutions?.slice(0, 3))
  console.log('🎨 RegionalOfficialChart - 設置比例尺, groups:', groups?.length, groups?.slice(0, 3))
  
  const x = d3.scaleBand()
    .domain(institutions || [])
    .range([0, chartDimensions.value.width - margin.left - margin.right])
    .padding(0.1)
  
  // 計算最大值：數值模式或百分比模式
  const maxValue = percentageMode.value ? 100 : d3.max(stackData, d => d3.sum(groups || [], g => d[g] || 0))
  const y = d3.scaleLinear()
    .domain([0, maxValue])
    .nice()
    .range([chartDimensions.value.height - margin.top - margin.bottom, 0])
  
  // 創建patterns（列印模式時使用）
  if (localPrintMode.value) {
    createPatterns(svg)
  }
  
  // 顏色比例尺 - 根據本地列印模式和主題選擇配色
  const colors = getColorScheme(localPrintMode.value, true, dataStore.currentTheme)
  const color = d3.scaleOrdinal()
    .domain(groups)
    .range(colors)
  
  // 創建stack
  console.log('🎨 RegionalOfficialChart - 創建stack, groups是否為數組:', Array.isArray(groups), 'length:', groups?.length)
  if (!Array.isArray(groups) || groups.length === 0) {
    console.error('❌ groups 為空或不是數組，無法創建 stack')
    svg.append("text")
      .attr("x", chartDimensions.value.width / 2)
      .attr("y", chartDimensions.value.height / 2)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("fill", "#999")
      .text("無可用的統計分組數據")
    return
  }
  
  const stack = d3.stack()
    .keys(groups)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone)
  
  const series = stack(stackData)
  
  // 繪製條形圖
  const barGroups = g.selectAll(".bar-group")
    .data(series)
    .enter()
    .append("g")
    .attr("class", "bar-group")
  
  barGroups.selectAll("rect")
    .data(d => d)
    .enter()
    .append("rect")
    .attr("x", d => x(d.data.institution))
    .attr("y", d => {
      if (percentageMode.value) {
        const total = d3.sum(groups || [], g => d.data[g] || 0)
        const percentage1 = total > 0 ? (d[1] / total) * 100 : 0
        return y(percentage1)
      }
      return y(d[1])
    })
    .attr("height", d => {
      if (percentageMode.value) {
        const total = d3.sum(groups || [], g => d.data[g] || 0)
        if (total === 0) return 0
        const percentage0 = (d[0] / total) * 100
        const percentage1 = (d[1] / total) * 100
        return y(percentage0) - y(percentage1)
      }
      return y(d[0]) - y(d[1])
    })
    .attr("width", x.bandwidth())
    .attr("fill", function(d) {
      const groupKey = d3.select(this.parentNode).datum().key
      return color(groupKey)
    })
    .on("click", function(event, d) {
      const groupKey = d3.select(this.parentNode).datum().key
      handleBarClick(d.data.institution, groupKey)
    })
    .on("mouseover", function(event, d) {
      const groupKey = d3.select(this.parentNode).datum().key
      const value = d[1] - d[0]
      
      const institutionDisplayName = d.data.displayName || d.data.institution
      const groupDisplayName = groupDisplayMap[groupKey] || groupKey
      
      const tooltipContent = percentageMode.value ? 
        (() => {
          const total = d3.sum(groups || [], g => d.data[g] || 0)
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0
          return `
            機構: ${institutionDisplayName}<br>
            ${groupBy.value === 'banner' ? '旗分' : '出身'}: ${groupDisplayName}<br>
            人數: ${value} (${percentage}%)
          `
        })() :
        `
          機構: ${institutionDisplayName}<br>
          ${groupBy.value === 'banner' ? '旗分' : '出身'}: ${groupDisplayName}<br>
          人數: ${value}
        `
      
      tooltip
        .style("opacity", 1)
        .html(tooltipContent)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px")
      
      d3.select(this).attr("opacity", 0.8)
    })
    .on("mouseout", function() {
      tooltip.style("opacity", 0)
      d3.select(this).attr("opacity", 1)
    })
  
  // X軸
  g.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${chartDimensions.value.height - margin.top - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-45)")
    .text(d => {
      const displayName = institutionDisplayMap[d] || d
      return displayName.length > 8 ? displayName.substring(0, 8) + '...' : displayName
    })
  
  // Y軸
  g.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y))
  
  // Y軸標籤
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - (chartDimensions.value.height - margin.top - margin.bottom) / 2)
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .style("font-size", "14px")
    .text(percentageMode.value ? "百分比 (%)" : "官員人數")
  
      // 更新圖例
      legendItems.value = (groups || []).map(group => ({
        name: groupDisplayMap[group] || group,
        color: color(group),
        count: d3.sum(stackData || [], d => d[group] || 0)
      })).sort((a, b) => b.count - a.count)
      
    } catch (error) {
      console.error('Chart rendering error:', error)
    } finally {
      loading.value = false
    }
  }, 100) // 100ms 延遲，讓 loading 動畫有時間顯示
}

const handleBarClick = (institution, group) => {
  console.log('🖱️ RegionalOfficialChart - Bar clicked:', { institution, group, groupBy: groupBy.value })
  
  const criteria = {}
  
  // 處理機構篩選（包括機構分組）
  const isInstitutionGroup = institution.startsWith('group_')
  if (isInstitutionGroup) {
    const institutionGroupData = institutionGroups.value.find(g => `group_${g.id}` === institution)
    if (institutionGroupData) {
      console.log('🖱️ 點擊的是機構分組:', institutionGroupData.name, '包含機構:', institutionGroupData.items)
      criteria.institutionGroup = {
        name: institutionGroupData.name,
        items: institutionGroupData.items
      }
    }
  } else {
    criteria.institution = institution === '(無機構)' ? '' : institution
  }
  
  // 處理統計分組篩選（旗分/出身，包括統計分組）
  const isStatsGroup = group.startsWith('statsGroup_')
  if (isStatsGroup) {
    const statsGroupData = statsGroupsGroups.value.find(g => `statsGroup_${g.id}` === group)
    if (statsGroupData) {
      console.log('🖱️ 點擊的是統計分組:', statsGroupData.name, '包含項目:', statsGroupData.items)
      
      // 為分組創建特殊的篩選條件
      if (groupBy.value === 'banner') {
        criteria.bannerGroup = {
          name: statsGroupData.name,
          items: statsGroupData.items
        }
      } else {
        criteria.backgroundGroup = {
          name: statsGroupData.name,
          items: statsGroupData.items
        }
      }
    }
  } else {
    // 處理單個統計分組篩選
    if (groupBy.value === 'banner') {
      criteria.banner = group === '(無旗分)' ? '' : group
    } else {
      criteria.background = group === '(無出身)' ? '' : group
    }
  }
  
  console.log('🖱️ RegionalOfficialChart - 發送篩選條件:', criteria)
  emit('selection-changed', criteria)
  
  const institutionDisplayName = institutionDisplayMap[institution] || institution
  const groupDisplayName = groupDisplayMap[group] || group
  ElMessage.success(`已選擇在"${institutionDisplayName}"任職的"${groupDisplayName}"官員，正在打開詳細名單`)
}

const handleResize = () => {
  updateChart()
}

const exportChart = () => {
  if (svg) {
    const filename = `機構官員組成-${groupBy.value === 'banner' ? '旗分' : '出身'}-${Date.now()}.svg`
    exportSVG(svg.node(), filename)
    ElMessage.success('圖表已匯出為SVG格式')
  }
}

const exportPNGChart = async () => {
  if (svg) {
    try {
      const filename = `機構官員組成-${groupBy.value === 'banner' ? '旗分' : '出身'}-${Date.now()}.png`
      await exportPNG(svg.node(), filename)
      ElMessage.success('圖表已匯出為PNG格式')
    } catch (error) {
      console.error('PNG export error:', error)
      ElMessage.error('PNG匯出失敗')
    }
  }
}

const handleDimensionsChanged = (dimensions) => {
  chartDimensions.value = dimensions
  initChart()
  updateChart()
}

// 監聽數據變化
watch(() => dataStore.effectiveData, () => {
  updateAvailableInstitutions()
})
watch(() => dataStore.currentTheme, updateChart)
watch(() => localPrintMode.value, updateChart)

// 監聽篩選條件變化，更新可用機構
watch([() => excludeBanner.value, () => selectedRegion.value, () => selectedPosition.value, () => groupBy.value, () => careerStageMode.value], () => {
  updateAvailableInstitutions()
})

// 監聽分組變化
watch(() => institutionGroups.value, (newGroups) => {
  console.log('📊 RegionalOfficialChart - institutionGroups 響應式變化:', {
    length: newGroups.length,
    data: newGroups
  })
}, { deep: true })

watch(() => statsGroupsGroups.value, (newGroups) => {
  console.log('📊 RegionalOfficialChart - statsGroupsGroups 響應式變化:', {
    length: newGroups.length,
    data: newGroups
  })
}, { deep: true })

// 監聽轉職階段模式變化（已包含在上面的多值監聽中，移除重複）

// 監聽指定階段變化
watch(() => specificStage.value, (newStage) => {
  console.log('📊 RegionalOfficialChart - specificStage 變化:', newStage)
  if (careerStageMode.value === 'specific') {
    updateAvailableInstitutions()
  }
})

// 過濾器狀態管理方法
const getFilterState = () => {
  return {
    selectedRegion: selectedRegion.value,
    selectedPosition: selectedPosition.value,
    groupBy: groupBy.value,
    careerStageMode: careerStageMode.value,
    specificStage: specificStage.value,
    excludeBanner: excludeBanner.value,
    percentageMode: percentageMode.value,
    localPrintMode: localPrintMode.value,
    selectedInstitutions: selectedInstitutions.value,
    institutionGroups: institutionGroups.value,
    selectedStatsGroups: selectedStatsGroups.value,
    statsGroupsGroups: statsGroupsGroups.value
  }
}

const setFilterState = (state) => {
  if (!state) return
  
  selectedRegion.value = state.selectedRegion || ''
  selectedPosition.value = state.selectedPosition || ''
  groupBy.value = state.groupBy || 'banner'
  careerStageMode.value = state.careerStageMode || state.careerStage || 'first' // 向後兼容
  specificStage.value = state.specificStage || 1
  excludeBanner.value = state.excludeBanner || false
  percentageMode.value = state.percentageMode || false
  localPrintMode.value = state.localPrintMode || false
  selectedInstitutions.value = state.selectedInstitutions || []
  institutionGroups.value = state.institutionGroups || []
  selectedStatsGroups.value = state.selectedStatsGroups || []
  statsGroupsGroups.value = state.statsGroupsGroups || []
  
  // 重新更新圖表
  setTimeout(() => {
    updateAvailableInstitutions()
  }, 100)
}

// 暴露方法給父組件
defineExpose({
  getFilterState,
  setFilterState
})
</script>

<style scoped>
.regional-chart-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chart-controls {
  margin-bottom: 20px;
}

.chart-area {
  flex: 1;
  min-height: 400px;
  padding: 10px;
}


.chart-legend {
  margin-top: 15px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
  text-align: center;
}

.regional-chart-container :deep(.el-select) {
  width: 100%;
}

.regional-chart-container :deep(.bar-group rect) {
  cursor: pointer;
  transition: opacity 0.3s;
}

.regional-chart-container :deep(.bar-group rect:hover) {
  opacity: 0.8;
}

.regional-chart-container :deep(.x-axis text),
.regional-chart-container :deep(.y-axis text) {
  font-size: 12px;
  fill: #666;
}

.regional-chart-container :deep(.x-axis path),
.regional-chart-container :deep(.y-axis path),
.regional-chart-container :deep(.x-axis line),
.regional-chart-container :deep(.y-axis line) {
  stroke: #ddd;
}
</style>