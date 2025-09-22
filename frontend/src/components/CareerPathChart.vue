<template>
  <div class="career-path-container">
    <!-- 操作步驟指引 -->
    <ChartStepsGuide :active-step="currentStep" />
    
    <div class="chart-header">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 20px;">
        <el-radio-group v-model="chartView" @change="onFilterChange(false)" size="small">
          <el-radio-button label="first">首次任職機構分析</el-radio-button>
          <el-radio-button label="last">最後任職機構分析</el-radio-button>
          <el-radio-button label="both">對比分析</el-radio-button>
        </el-radio-group>
        <div style="display: flex; align-items: center; gap: 10px;">
          <el-switch
            v-model="excludeBanner"
            active-text="排除旗人"
            inactive-text="包含旗人"
            @change="onFilterChange(false)"
            size="small"
            class="exclude-banner-switch"
          />
          <el-switch
            v-model="percentageMode"
            active-text="百分比"
            inactive-text="數值"
            @change="onFilterChange(true)"
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
            :chart-title="'選擇機構'"
            :options="statOptions"
            v-model="selectedStats"
            :groups="statsGroups"
            :default-selection="defaultStats"
            @selection-changed="onStatSelectionChanged"
            @update:groups="statsGroups = $event"
          />
          <TagSelector
            :chart-title="'選擇出身'"
            :options="backgroundOptions"
            v-model="selectedBackgrounds"
            :groups="backgroundGroups"
            :default-selection="defaultBackgrounds"
            @selection-changed="onBackgroundSelectionChanged"
            @update:groups="backgroundGroups = $event"
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
            @change="onFilterChange(false)"
            size="small"
            class="print-mode-switch"
          />
          
          <el-button 
            @click="exportChart" 
            size="small" 
            type="primary" 
            plain
            :disabled="!firstSvg && !lastSvg"
            class="export-button"
          >
            輸出SVG
          </el-button>
          
          <el-button 
            @click="exportPNGChart" 
            size="small" 
            type="success" 
            plain
            :disabled="!firstSvg && !lastSvg"
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
      :defaultWidth="600"
      :defaultHeight="500"
      @dimensions-changed="handleDimensionsChanged"
    />
    
    <div class="charts-wrapper" :class="{ 'dual-view': chartView === 'both' }">
      <div v-if="chartView === 'first' || chartView === 'both'" class="chart-section">
        <h4>出身 → 首次任職機構</h4>
        <div 
          ref="firstChartContainer" 
          class="chart-area"
          v-loading="loading"
          element-loading-text="正在分析職務路徑..."
          element-loading-background="rgba(255, 255, 255, 0.8)"
        ></div>
      </div>
      
      <div v-if="chartView === 'last' || chartView === 'both'" class="chart-section">
        <h4>出身 → 最後任職機構</h4>
        <div 
          ref="lastChartContainer" 
          class="chart-area"
          v-loading="loading"
          element-loading-text="正在分析職務路徑..."
          element-loading-background="rgba(255, 255, 255, 0.8)"
        ></div>
      </div>
    </div>
    
    <div class="chart-stats">
      <el-tag type="info" size="small">
        統計 {{ uniqueOfficials.size }} 位官員
      </el-tag>
      <el-tag type="success" size="small">
        共 {{ totalRecords }} 條記錄
      </el-tag>
      <el-tag type="warning" size="small">
        平均任職 {{ averagePositions.toFixed(1) }} 個職位
      </el-tag>
      <el-tag type="primary" size="small" v-if="uniqueInstitutions > 0">
        涉及 {{ uniqueInstitutions }} 個機構
      </el-tag>
    </div>
    
    <!-- 文字版視圖 -->
    <ChartDataTableView
      v-model:visible="tableViewVisible"
      :data="tableData"
      :columns="tableColumns"
      :title="`職業路徑分析 - ${chartView === 'first' ? '首次任職機構' : chartView === 'last' ? '最後任職機構' : '首次與最後任職機構對比'}`"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import * as d3 from 'd3'
import { useDataStore } from '../stores/dataStore'
import { ElMessage } from 'element-plus'
import { ArrowDown, RefreshRight, Grid } from '@element-plus/icons-vue'
import { exportSVG, exportPNG, createPatterns, getColorScheme, getThemeNames, getTheme } from '../utils/chartUtils'
import { getStandardizedBackground } from '../utils/dataUtils'
import TagSelector from './TagSelector.vue'
import ChartDimensionSliders from './ChartDimensionSliders.vue'
import ChartStepsGuide from './ChartStepsGuide.vue'
import ChartDataTableView from './ChartDataTableView.vue'

const emit = defineEmits(['selection-changed'])

const dataStore = useDataStore()
const firstChartContainer = ref(null)
const lastChartContainer = ref(null)
const chartView = ref('both')
const excludeBanner = ref(false)
const percentageMode = ref(false)
const loading = ref(false)
const localPrintMode = ref(false)
const tableViewVisible = ref(false)

// 操作步驟狀態
const currentStep = ref(0)

// 驗證是否有有效配置
const hasValidConfiguration = computed(() => {
  // 如果已經鎖定名單，可以直接繪製
  if (dataStore.isListLocked) return true
  
  // 否則需要選擇機構和出身
  const hasStats = selectedStats.value.length > 0 || statsGroups.value.length > 0
  const hasBackgrounds = selectedBackgrounds.value.length > 0 || backgroundGroups.value.length > 0
  return hasStats && hasBackgrounds
})

// 統計值選擇相關（機構）
const selectedStats = ref([])
const allAvailableStats = ref([])
const statsGroups = ref([])

// 出身選擇相關
const selectedBackgrounds = ref([])
const allAvailableBackgrounds = ref([])
const backgroundGroups = ref([])

// 動態計算統計選項（這裡是機構選項）
const statOptions = computed(() => {
  return allAvailableStats.value.map(stat => ({
    key: stat,
    label: stat === '(無機構)' ? '無機構記錄' : stat
  }))
})

// 預設選擇（顯示前10個最常見的機構）
const defaultStats = computed(() => {
  return allAvailableStats.value.slice(0, 10)
})

// 動態計算出身選項
const backgroundOptions = computed(() => {
  return allAvailableBackgrounds.value.map(bg => ({
    key: bg,
    label: bg === '(無出身記錄)' ? '無出身記錄' : bg
  }))
})

// 預設選擇（顯示前15個最常見的出身）
const defaultBackgrounds = computed(() => {
  return allAvailableBackgrounds.value.slice(0, 15)
})

let firstSvg = null
let lastSvg = null
let tooltip = null

const margin = { top: 40, right: 150, bottom: 120, left: 150 }
const chartDimensions = ref({ width: 600, height: 500 })

let patternIds = []

const themeNames = getThemeNames()

const changeTheme = (themeName) => {
  dataStore.currentTheme = themeName
  ElMessage.success(`已切換至${getTheme(themeName).name}`)
}

// 計算統計數據
const filteredDataForStats = computed(() => {
  // 如果不是鎖定模式，才應用額外的篩選條件
  if (!dataStore.isListLocked && excludeBanner.value) {
    return dataStore.effectiveData.filter(d => !d.旗分 || d.旗分.trim() === '')
  }
  return dataStore.effectiveData
})

const uniqueOfficials = computed(() => {
  const officials = new Set()
  filteredDataForStats.value.forEach(d => {
    if (d.PersonUID) officials.add(d.PersonUID)
  })
  return officials
})

const totalRecords = computed(() => {
  return filteredDataForStats.value.length
})

const uniqueInstitutions = computed(() => {
  const institutions = new Set()
  filteredDataForStats.value.forEach(d => {
    if (d.機構一) institutions.add(d.機構一)
  })
  return institutions.size
})

const averagePositions = computed(() => {
  const positionCounts = {}
  filteredDataForStats.value.forEach(d => {
    if (d.PersonUID) {
      if (!positionCounts[d.PersonUID]) positionCounts[d.PersonUID] = 0
      positionCounts[d.PersonUID]++
    }
  })
  const counts = Object.values(positionCounts)
  return counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0
})

// 計算表格數據
const tableData = computed(() => {
  if (!dataStore.effectiveData.length) return []
  
  // 準備數據
  let processedData = dataStore.effectiveData
  
  // 如果不是鎖定模式，才應用額外的篩選條件
  if (!dataStore.isListLocked) {
    if (excludeBanner.value) {
      processedData = processedData.filter(d => !d.旗分 || d.旗分.trim() === '')
    }
  }
  
  // 按PersonUID分組，獲取每個官員的記錄
  const officialRecords = {}
  processedData.forEach(record => {
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
  
  // 統計出身與首次/最後任職機構的關係
  const firstInstitutionStats = {}
  const lastInstitutionStats = {}
  
  Object.values(officialRecords).forEach(records => {
    const firstRecord = records[0]
    const lastRecord = records[records.length - 1]
    
    const background = getStandardizedBackground(firstRecord)
    const firstInstitution = firstRecord.機構一 || '(無機構記錄)'
    const lastInstitution = lastRecord.機構一 || '(無機構記錄)'
    
    // 統計首次任職
    const firstKey = `${background}|${firstInstitution}`
    if (!firstInstitutionStats[firstKey]) {
      firstInstitutionStats[firstKey] = {
        background,
        institution: firstInstitution,
        count: 0
      }
    }
    firstInstitutionStats[firstKey].count++
    
    // 統計最後任職
    const lastKey = `${background}|${lastInstitution}`
    if (!lastInstitutionStats[lastKey]) {
      lastInstitutionStats[lastKey] = {
        background,
        institution: lastInstitution,
        count: 0
      }
    }
    lastInstitutionStats[lastKey].count++
  })
  
  // 根據當前視圖模式返回數據
  let data = []
  
  if (chartView.value === 'first' || chartView.value === 'both') {
    const firstData = Object.values(firstInstitutionStats).map(item => ({
      ...item,
      type: '首次任職'
    }))
    data = data.concat(firstData)
  }
  
  if (chartView.value === 'last' || chartView.value === 'both') {
    const lastData = Object.values(lastInstitutionStats).map(item => ({
      ...item,
      type: '最後任職'
    }))
    data = data.concat(lastData)
  }
  
  // 按計數排序
  return data.sort((a, b) => b.count - a.count)
})

// 表格列定義
const tableColumns = computed(() => {
  const columns = [
    { prop: 'background', label: '出身', width: 200 },
    { prop: 'institution', label: '任職機構', width: 200 },
    { prop: 'count', label: '人數', width: 100 }
  ]
  
  if (chartView.value === 'both') {
    columns.splice(2, 0, { prop: 'type', label: '類型', width: 100 })
  }
  
  return columns
})

onMounted(() => {
  initCharts()
  updateAvailableStats()
  // 初始化步驟狀態
  currentStep.value = 0
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (tooltip) tooltip.remove()
})

const initCharts = () => {
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

const createStackChart = (container, data, title) => {
  if (!container) return null
  
  const containerEl = d3.select(container)
  containerEl.select("svg").remove()
  
  const svg = containerEl
    .append("svg")
    .attr("width", "100%")
    .attr("height", chartDimensions.value.height)
    .attr("viewBox", `0 0 ${chartDimensions.value.width} ${chartDimensions.value.height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
  
  // 創建patterns用於列印模式
  patternIds = createPatterns(svg)
  
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)
  
  // 處理出身選擇（包含分組）
  const backgrounds = []
  const backgroundDisplayMap = {} // 出身顯示名稱映射
  
  if (selectedBackgrounds.value.length > 0 || backgroundGroups.value.length > 0) {
    // 添加個別選擇的出身
    selectedBackgrounds.value.forEach(bg => {
      if (data[bg]) {
        backgrounds.push(bg)
        backgroundDisplayMap[bg] = bg
      }
    })
    
    // 添加分組出身
    backgroundGroups.value.forEach(group => {
      const groupKey = `bgGroup_${group.id}`
      backgrounds.push(groupKey)
      backgroundDisplayMap[groupKey] = group.name
      
      // 將分組中的出身數據合併到分組key下
      data[groupKey] = {}
      group.items.forEach(bg => {
        if (data[bg]) {
          Object.keys(data[bg]).forEach(inst => {
            if (!data[groupKey][inst]) data[groupKey][inst] = 0
            data[groupKey][inst] += data[bg][inst]
          })
        }
      })
    })
  } else {
    // 使用預設前15個最常見的出身
    const availableBackgrounds = Object.keys(data).sort((a, b) => {
      const aTotal = d3.sum(Object.values(data[a]))
      const bTotal = d3.sum(Object.values(data[b]))
      return bTotal - aTotal
    }).slice(0, 15)
    
    backgrounds.push(...availableBackgrounds)
    availableBackgrounds.forEach(bg => {
      backgroundDisplayMap[bg] = bg
    })
  }
  
  // 如果沒有有效的背景數據，提前返回
  if (backgrounds.length === 0) {
    return svg
  }
  
  // 處理機構選擇（包含分組）
  const institutionList = []
  const institutionDisplayMap = {} // 機構顯示名稱映射
  
  if (selectedStats.value.length > 0 || statsGroups.value.length > 0) {
    // 添加個別選擇的機構
    selectedStats.value.forEach(inst => {
      institutionList.push(inst)
      institutionDisplayMap[inst] = inst
    })
    
    // 添加分組機構
    statsGroups.value.forEach(group => {
      const groupKey = `group_${group.id}`
      institutionList.push(groupKey)
      institutionDisplayMap[groupKey] = group.name
      
      // 將分組中的機構數據合併到分組key下
      group.items.forEach(inst => {
        backgrounds.forEach(bg => {
          if (data[bg] && data[bg][inst]) {
            if (!data[bg][groupKey]) data[bg][groupKey] = 0
            data[bg][groupKey] += data[bg][inst]
          }
        })
      })
    })
  } else {
    // 使用預設機構
    const institutions = new Set()
    backgrounds.forEach(bg => {
      Object.keys(data[bg]).forEach(inst => institutions.add(inst))
    })
    const sortedInstitutions = Array.from(institutions).sort()
    institutionList.push(...sortedInstitutions)
    sortedInstitutions.forEach(inst => {
      institutionDisplayMap[inst] = inst
    })
  }
  
  // 準備stack數據
  const stackData = backgrounds.map(bg => {
    const datum = { background: bg }
    institutionList.forEach(inst => {
      datum[inst] = data[bg][inst] || 0
    })
    return datum
  })
  
  // 設置比例尺
  const y = d3.scaleBand()
    .domain(backgrounds)
    .range([0, chartDimensions.value.height - margin.top - margin.bottom])
    .padding(0.1)
  
  // 計算最大值：數值模式或百分比模式
  const maxValue = percentageMode.value ? 100 : d3.max(stackData, d => d3.sum(institutionList, inst => d[inst]))
  const x = d3.scaleLinear()
    .domain([0, maxValue])
    .nice()
    .range([0, chartDimensions.value.width - margin.left - margin.right])
  
  // 顏色比例尺 - 根據本地列印模式和主題選擇配色
  const colors = getColorScheme(localPrintMode.value, true, dataStore.currentTheme)
  const color = d3.scaleOrdinal()
    .domain(institutionList)
    .range(colors)
  
  // 創建stack
  const stack = d3.stack()
    .keys(institutionList)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone)
  
  const series = stack(stackData)
  
  // 繪製條形圖
  const barGroups = g.selectAll(".bar-group")
    .data(series)
    .enter()
    .append("g")
    .attr("class", "bar-group")
    .attr("fill", d => color(d.key))
  
  barGroups.selectAll("rect")
    .data(d => d)
    .enter()
    .append("rect")
    .attr("y", d => y(d.data.background))
    .attr("x", d => {
      if (percentageMode.value) {
        const total = d3.sum(institutionList, inst => d.data[inst] || 0)
        const percentage0 = total > 0 ? (d[0] / total) * 100 : 0
        return x(percentage0)
      }
      return x(d[0])
    })
    .attr("width", d => {
      if (percentageMode.value) {
        const total = d3.sum(institutionList, inst => d.data[inst] || 0)
        if (total === 0) return 0
        const percentage0 = (d[0] / total) * 100
        const percentage1 = (d[1] / total) * 100
        return x(percentage1) - x(percentage0)
      }
      return x(d[1]) - x(d[0])
    })
    .attr("height", y.bandwidth())
    .on("click", function(event, d) {
      const institution = d3.select(this.parentNode).datum().key
      handleBarClick(d.data.background, institution)
    })
    .on("mouseover", function(event, d) {
      const institution = d3.select(this.parentNode).datum().key
      const value = d[1] - d[0]
      const total = d3.sum(institutionList, inst => d.data[inst] || 0)
      const percentage = ((value / total) * 100).toFixed(1)
      
      const backgroundDisplayName = backgroundDisplayMap[d.data.background] || d.data.background
      const institutionDisplayName = institutionDisplayMap[institution] || institution
      
      const tooltipContent = percentageMode.value ? 
        (() => {
          const total = d3.sum(institutionList, inst => d.data[inst] || 0)
          const globalPercentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0
          return `
            出身: ${backgroundDisplayName}<br>
            ${title === 'first' ? '首次' : '最後'}任職: ${institutionDisplayName}<br>
            人數: ${value} (${globalPercentage}%)
          `
        })() :
        `
          出身: ${backgroundDisplayName}<br>
          ${title === 'first' ? '首次' : '最後'}任職: ${institutionDisplayName}<br>
          人數: ${value} (${percentage}%)
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
  
  // Y軸
  g.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y))
    .selectAll("text")
    .style("font-size", "12px")
    .text(d => {
      const displayName = backgroundDisplayMap[d] || d
      return displayName.length > 12 ? displayName.substring(0, 12) + '...' : displayName
    })
  
  // X軸
  g.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${chartDimensions.value.height - margin.top - margin.bottom})`)
    .call(d3.axisBottom(x))
  
  // X軸標籤
  g.append("text")
    .attr("x", (chartDimensions.value.width - margin.left - margin.right) / 2)
    .attr("y", chartDimensions.value.height - margin.top - margin.bottom + 40)
    .style("text-anchor", "middle")
    .style("font-size", "14px")
    .text(percentageMode.value ? "百分比 (%)" : "官員人數")
  
  // 圖例
  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${chartDimensions.value.width - margin.right + 20}, ${margin.top})`)
  
  const legendItems = legend.selectAll(".legend-item")
    .data(institutionList.slice(0, 10)) // 只顯示前10個機構
    .enter()
    .append("g")
    .attr("class", "legend-item")
    .attr("transform", (d, i) => `translate(0, ${i * 20})`)
  
  legendItems.append("rect")
    .attr("width", 15)
    .attr("height", 15)
    .attr("fill", d => color(d))
  
  legendItems.append("text")
    .attr("x", 20)
    .attr("y", 12)
    .style("font-size", "12px")
    .text(d => {
      const displayName = institutionDisplayMap[d] || d
      return displayName.length > 10 ? displayName.substring(0, 10) + '...' : displayName
    })
  
  return svg
}

// 處理統計值選擇變化
const onStatSelectionChanged = (selectedValues, groups, direction) => {
  console.log('📊 CareerPathChart - 機構選擇變化:', {
    selectedValues: selectedValues.slice(0, 5),
    groupsCount: groups.length,
    direction
  })
  // 更新步驟狀態 - 只更新狀態，不自動渲染
  currentStep.value = Math.max(currentStep.value, 1)
  // 更新步驟狀態但不觸發渲染
  currentStep.value = hasValidConfiguration.value ? 2 : 1
}

// 處理出身選擇變化
const onBackgroundSelectionChanged = (selectedValues, groups, direction) => {
  console.log('📊 CareerPathChart - 出身選擇變化:', {
    selectedValues: selectedValues.slice(0, 5),
    groupsCount: groups.length,
    direction
  })
  // 更新步驟狀態 - 只更新狀態，不自動渲染
  currentStep.value = Math.max(currentStep.value, 1)
  // 更新步驟狀態但不觸發渲染
  currentStep.value = hasValidConfiguration.value ? 2 : 1
}

// 篩選條件變更時的處理
const onFilterChange = (autoRender = false) => {
  // 更新步驟狀態
  currentStep.value = hasValidConfiguration.value ? 2 : 1
  
  // 只有在 autoRender 為 true 且已經有有效配置時，才重新渲染圖表
  if (autoRender && hasValidConfiguration.value) {
    updateCharts()
  }
}

// 手動繪製圖表
const renderChart = () => {
  if (!hasValidConfiguration.value) {
    ElMessage.warning('請先選擇機構和出身選項')
    return
  }
  currentStep.value = 2
  updateCharts()
}

// 更新可用統計值列表（機構列表）
const updateAvailableStats = () => {
  if (!dataStore.effectiveData.length) return
  
  const institutionsSet = new Set()
  const backgroundsSet = new Set()
  let filteredData = dataStore.effectiveData
  
  // 如果不是鎖定模式，才應用額外的篩選條件
  if (!dataStore.isListLocked) {
    if (excludeBanner.value) {
      filteredData = filteredData.filter(d => !d.旗分 || d.旗分.trim() === '')
    }
  }
  
  // 收集所有機構和出身
  filteredData.forEach(d => {
    const institution = d.機構一 || '(無機構)'
    institutionsSet.add(institution)
    
    const background = getStandardizedBackground(d)
    backgroundsSet.add(background)
  })
  
  // 按使用頻率排序機構
  const institutionCounts = {}
  const backgroundCounts = {}
  filteredData.forEach(d => {
    const institution = d.機構一 || '(無機構)'
    institutionCounts[institution] = (institutionCounts[institution] || 0) + 1
    
    const background = getStandardizedBackground(d)
    backgroundCounts[background] = (backgroundCounts[background] || 0) + 1
  })
  
  allAvailableStats.value = Array.from(institutionsSet).sort((a, b) => (institutionCounts[b] || 0) - (institutionCounts[a] || 0))
  allAvailableBackgrounds.value = Array.from(backgroundsSet).sort((a, b) => (backgroundCounts[b] || 0) - (backgroundCounts[a] || 0))
  
  // 如果還沒有選擇，設置預設選擇
  if (selectedStats.value.length === 0) {
    selectedStats.value = [...defaultStats.value]
  }
  if (selectedBackgrounds.value.length === 0) {
    selectedBackgrounds.value = [...defaultBackgrounds.value]
  }
}

const updateCharts = () => {
  if (!dataStore.effectiveData.length) return
  
  loading.value = true
  
  // 使用 setTimeout 讓 loading 動畫有時間顯示
  setTimeout(() => {
    try {
      // 過濾數據
      let processedData = dataStore.effectiveData
      
      // 如果不是鎖定模式，才應用額外的篩選條件
      if (!dataStore.isListLocked) {
        if (excludeBanner.value) {
          processedData = processedData.filter(d => !d.旗分 || d.旗分.trim() === '')
        }
      }
  
  // 按PersonUID分組，獲取每個官員的記錄
  const officialRecords = {}
  processedData.forEach(record => {
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
  
  // 統計出身與首次/最後任職機構的關係
  const firstInstitutionData = {}
  const lastInstitutionData = {}
  
  Object.values(officialRecords).forEach(records => {
    const firstRecord = records[0]
    const lastRecord = records[records.length - 1]
    
    const background = getStandardizedBackground(firstRecord)
    const firstInstitution = firstRecord.機構一 || '(無機構記錄)'
    const lastInstitution = lastRecord.機構一 || '(無機構記錄)'
    
    // 統計首次任職
    if (!firstInstitutionData[background]) {
      firstInstitutionData[background] = {}
    }
    if (!firstInstitutionData[background][firstInstitution]) {
      firstInstitutionData[background][firstInstitution] = 0
    }
    firstInstitutionData[background][firstInstitution]++
    
    // 統計最後任職
    if (!lastInstitutionData[background]) {
      lastInstitutionData[background] = {}
    }
    if (!lastInstitutionData[background][lastInstitution]) {
      lastInstitutionData[background][lastInstitution] = 0
    }
    lastInstitutionData[background][lastInstitution]++
  })
  
      // 繪製圖表
      if (chartView.value === 'first' || chartView.value === 'both') {
        firstSvg = createStackChart(firstChartContainer.value, firstInstitutionData, 'first')
      }
      
      if (chartView.value === 'last' || chartView.value === 'both') {
        lastSvg = createStackChart(lastChartContainer.value, lastInstitutionData, 'last')
      }
      
    } catch (error) {
      console.error('Chart rendering error:', error)
    } finally {
      loading.value = false
    }
  }, 100) // 100ms 延遲，讓 loading 動畫有時間顯示
}

const handleBarClick = (background, institution) => {
  const criteria = {
    background: background === '(無出身記錄)' ? '' : background,
    institution: institution === '(無機構記錄)' ? '' : institution
  }
  
  emit('selection-changed', criteria)
  ElMessage.success(`已選擇出身為"${background}"且在"${institution}"任職的官員`)
}

const handleResize = () => {
  updateCharts()
}

const exportChart = () => {
  const currentSvg = chartView.value === 'first' ? firstSvg : (chartView.value === 'last' ? lastSvg : firstSvg)
  if (currentSvg) {
    const chartType = chartView.value === 'first' ? '首次任職' : '最後任職'
    const filename = `職業路徑分析-${chartType}-${Date.now()}.svg`
    exportSVG(currentSvg.node(), filename)
    ElMessage.success('圖表已匯出為SVG格式')
  }
}

const exportPNGChart = async () => {
  const currentSvg = chartView.value === 'first' ? firstSvg : (chartView.value === 'last' ? lastSvg : firstSvg)
  if (currentSvg) {
    try {
      const chartType = chartView.value === 'first' ? '首次任職' : '最後任職'
      const filename = `職業路徑分析-${chartType}-${Date.now()}.png`
      await exportPNG(currentSvg.node(), filename)
      ElMessage.success('圖表已匯出為PNG格式')
    } catch (error) {
      console.error('PNG export error:', error)
      ElMessage.error('PNG匯出失敗')
    }
  }
}

// 監聽數據變化
const handleDimensionsChanged = (dimensions) => {
  chartDimensions.value = dimensions
  updateCharts()
}

watch(() => dataStore.effectiveData, () => {
  updateAvailableStats()
  updateCharts()
})
watch(() => dataStore.currentTheme, updateCharts)
watch(() => localPrintMode.value, updateCharts)

// 監聽篩選條件變化，更新可用統計值
watch([() => excludeBanner.value, () => chartView.value], () => {
  updateAvailableStats()
  // 僅更新統計值，不自動渲染圖表
})

// 過濾器狀態管理方法
const getFilterState = () => {
  return {
    chartView: chartView.value,
    excludeBanner: excludeBanner.value,
    percentageMode: percentageMode.value,
    localPrintMode: localPrintMode.value,
    selectedStats: selectedStats.value,
    selectedBackgrounds: selectedBackgrounds.value,
    statsGroups: statsGroups.value,
    backgroundGroups: backgroundGroups.value
  }
}

const setFilterState = (state) => {
  if (!state) return
  
  if (state.chartView !== undefined) chartView.value = state.chartView
  if (state.excludeBanner !== undefined) excludeBanner.value = state.excludeBanner
  if (state.percentageMode !== undefined) percentageMode.value = state.percentageMode
  if (state.localPrintMode !== undefined) localPrintMode.value = state.localPrintMode
  if (state.selectedStats !== undefined) selectedStats.value = state.selectedStats
  if (state.selectedBackgrounds !== undefined) selectedBackgrounds.value = state.selectedBackgrounds
  if (state.statsGroups !== undefined) statsGroups.value = state.statsGroups
  if (state.backgroundGroups !== undefined) backgroundGroups.value = state.backgroundGroups
  
  setTimeout(() => {
    updateCharts()
  }, 100)
}

// 暴露方法給父組件
defineExpose({
  getFilterState,
  setFilterState
})
</script>

<style scoped>
.career-path-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chart-header {
  margin-bottom: 15px;
  text-align: center;
}

.charts-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.charts-wrapper.dual-view {
  flex-direction: row;
}

.chart-section {
  flex: 1;
  min-height: 0;
}

.chart-section h4 {
  margin: 0 0 10px 0;
  text-align: center;
  color: #606266;
  font-size: 16px;
}

.chart-area {
  min-height: 400px;
  padding: 10px;
}


.chart-stats {
  margin-top: 15px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
  text-align: center;
  display: flex;
  justify-content: center;
  gap: 10px;
}

.career-path-container :deep(.bar-group rect) {
  cursor: pointer;
  transition: opacity 0.3s;
}

.career-path-container :deep(.x-axis text),
.career-path-container :deep(.y-axis text) {
  font-size: 12px;
  fill: #666;
}

.career-path-container :deep(.x-axis path),
.career-path-container :deep(.y-axis path),
.career-path-container :deep(.x-axis line),
.career-path-container :deep(.y-axis line) {
  stroke: #ddd;
}

.career-path-container :deep(.legend-item text) {
  fill: #666;
}
</style>