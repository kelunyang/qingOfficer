<template>
  <div class="regional-flow-container">
    <!-- 操作步驟指引 -->
    <ChartStepsGuide :active-step="currentStep" />
    
    <div class="chart-header">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 15px; flex-wrap: wrap;">
        <el-radio-group v-model="chartView" @change="onFilterChange()" size="small">
          <el-radio-button label="first">首次任職地區分析</el-radio-button>
          <el-radio-button label="last">最後任職地區分析</el-radio-button>
          <el-radio-button label="both">對比分析</el-radio-button>
        </el-radio-group>
        
        <div style="display: flex; align-items: center; gap: 15px;">
          <el-select
            v-model="selectedBackground"
            placeholder="篩選出身"
            clearable
            @change="onFilterChange()"
            style="width: 200px"
            size="small"
            :disabled="dataStore.isListLocked"
          >
            <el-option
              v-for="bg in uniqueBackgrounds"
              :key="bg"
              :label="bg || '(無出身記錄)'"
              :value="bg"
            />
          </el-select>
          
          <el-switch
            v-model="excludeBanner"
            active-text="排除旗人"
            inactive-text="包含旗人"
            @change="onFilterChange()"
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
            :chart-title="'選擇地區'"
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
            @change="onFilterChange()"
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
        <h4>出身 → 首次任職地區</h4>
        <div 
          ref="firstChartContainer" 
          class="chart-area"
          v-loading="loading"
          element-loading-text="正在分析地區流動..."
          element-loading-background="rgba(255, 255, 255, 0.8)"
        ></div>
      </div>
      
      <div v-if="chartView === 'last' || chartView === 'both'" class="chart-section">
        <h4>出身 → 最後任職地區</h4>
        <div 
          ref="lastChartContainer" 
          class="chart-area"
          v-loading="loading"
          element-loading-text="正在分析地區流動..."
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
        涉及 {{ uniqueRegions.size }} 個地區
      </el-tag>
      <el-tag type="primary" size="small">
        平均遷徙 {{ averageMigration.toFixed(1) }} 個地區
      </el-tag>
    </div>
    
    <!-- 文字版視圖 -->
    <ChartDataTableView
      v-model:visible="tableViewVisible"
      :data="tableData"
      :columns="tableColumns"
      :title="`地區流動分析 - ${chartView === 'first' ? '首次任職地區' : chartView === 'last' ? '最後任職地區' : '首次與最後任職地區對比'}`"
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
const selectedBackground = ref('')
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
  
  // 否則需要選擇地區和出身
  const hasStats = selectedStats.value.length > 0 || statsGroups.value.length > 0
  const hasBackgrounds = selectedBackgrounds.value.length > 0 || backgroundGroups.value.length > 0
  return hasStats && hasBackgrounds
})

// 統計值選擇相關（地區）
const selectedStats = ref([])
const allAvailableStats = ref([])
const statsGroups = ref([])

// 出身選擇相關
const selectedBackgrounds = ref([])
const allAvailableBackgrounds = ref([])
const backgroundGroups = ref([])

// 動態計算統計選項（這裡是地區選項）
const statOptions = computed(() => {
  return allAvailableStats.value.map(stat => ({
    key: stat,
    label: stat === '(無地區)' ? '無地區記錄' : stat
  }))
})

// 預設選擇（顯示前12個最常見的地區）
const defaultStats = computed(() => {
  return allAvailableStats.value.slice(0, 12)
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
const uniqueOfficials = computed(() => {
  const officials = new Set()
  let filteredData = dataStore.effectiveData
  
  // 如果不是鎖定模式，才應用額外的篩選條件
  if (!dataStore.isListLocked) {
    if (selectedBackground.value) {
      filteredData = filteredData.filter(d => d.出身一 === selectedBackground.value)
    }
    
    if (excludeBanner.value) {
      filteredData = filteredData.filter(d => !d.旗分 || d.旗分.trim() === '')
    }
  }
  
  filteredData.forEach(d => {
    if (d.PersonUID) officials.add(d.PersonUID)
  })
  return officials
})

const totalRecords = computed(() => {
  let data = dataStore.effectiveData
  
  // 如果不是鎖定模式，才應用額外的篩選條件
  if (!dataStore.isListLocked) {
    if (selectedBackground.value) {
      data = data.filter(d => d.出身一 === selectedBackground.value)
    }
    
    if (excludeBanner.value) {
      data = data.filter(d => !d.旗分 || d.旗分.trim() === '')
    }
  }
  
  return data.length
})

const uniqueRegions = computed(() => {
  const regions = new Set()
  dataStore.effectiveData.forEach(d => {
    if (d.地區) regions.add(d.地區)
  })
  return regions
})

const uniqueBackgrounds = computed(() => {
  const backgrounds = new Set()
  let data = dataStore.effectiveData
  
  // 如果不是鎖定模式，才應用額外的篩選條件
  if (!dataStore.isListLocked) {
    if (excludeBanner.value) {
      data = data.filter(d => !d.旗分 || d.旗分.trim() === '')
    }
  }
  
  data.forEach(d => {
    if (d.出身一) backgrounds.add(d.出身一)
  })
  return Array.from(backgrounds).sort()
})

const averageMigration = computed(() => {
  const migrationCounts = {}
  const officialRecords = {}
  
  let data = dataStore.effectiveData
  // 如果不是鎖定模式，才應用額外的篩選條件
  if (!dataStore.isListLocked) {
    if (excludeBanner.value) {
      data = data.filter(d => !d.旗分 || d.旗分.trim() === '')
    }
  }
  
  data.forEach(record => {
    if (!record.PersonUID) return
    if (!officialRecords[record.PersonUID]) {
      officialRecords[record.PersonUID] = []
    }
    officialRecords[record.PersonUID].push(record)
  })
  
  Object.entries(officialRecords).forEach(([uid, records]) => {
    const regions = new Set(records.map(r => r.地區).filter(Boolean))
    migrationCounts[uid] = regions.size
  })
  
  const counts = Object.values(migrationCounts)
  return counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0
})

// 計算表格數據
const tableData = computed(() => {
  if (!dataStore.effectiveData.length) return []
  
  // 應用篩選
  let filteredData = dataStore.effectiveData

  // 如果不是鎖定模式，才應用額外的篩選條件
  if (!dataStore.isListLocked) {
    if (excludeBanner.value) {
      filteredData = filteredData.filter(d => !d.旗分 || d.旗分.trim() === '')
    }
    
    if (selectedBackground.value) {
      filteredData = filteredData.filter(d => d.出身一 === selectedBackground.value)
    }
  }
  
  // 按PersonUID分組，獲取每個官員的記錄
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
  
  // 統計出身與首次/最後任職地區的關係
  const firstRegionStats = {}
  const lastRegionStats = {}
  
  Object.values(officialRecords).forEach(records => {
    const firstRecord = records[0]
    const lastRecord = records[records.length - 1]
    
    const background = getStandardizedBackground(firstRecord)
    const firstRegion = firstRecord.地區 || '(無地區記錄)'
    const lastRegion = lastRecord.地區 || '(無地區記錄)'
    
    // 統計首次任職地區
    const firstKey = `${background}|${firstRegion}`
    if (!firstRegionStats[firstKey]) {
      firstRegionStats[firstKey] = {
        background,
        region: firstRegion,
        count: 0
      }
    }
    firstRegionStats[firstKey].count++
    
    // 統計最後任職地區
    const lastKey = `${background}|${lastRegion}`
    if (!lastRegionStats[lastKey]) {
      lastRegionStats[lastKey] = {
        background,
        region: lastRegion,
        count: 0
      }
    }
    lastRegionStats[lastKey].count++
  })
  
  // 根據當前視圖模式返回數據
  let data = []
  
  if (chartView.value === 'first' || chartView.value === 'both') {
    const firstData = Object.values(firstRegionStats).map(item => ({
      ...item,
      type: '首次任職'
    }))
    data = data.concat(firstData)
  }
  
  if (chartView.value === 'last' || chartView.value === 'both') {
    const lastData = Object.values(lastRegionStats).map(item => ({
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
    { prop: 'region', label: '任職地區', width: 150 },
    { prop: 'count', label: '人數', width: 100 }
  ]
  
  if (chartView.value === 'both') {
    columns.splice(2, 0, { prop: 'type', label: '類型', width: 100 })
  }
  
  return columns
})

onMounted(() => {
  initCharts()
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
  
  // 準備數據 - 使用用戶選擇的出身
  const allBackgrounds = Object.keys(data).sort((a, b) => {
    const aTotal = d3.sum(Object.values(data[a]))
    const bTotal = d3.sum(Object.values(data[b]))
    return bTotal - aTotal
  })
  
  // 處理出身選擇（包含分組）
  const backgrounds = []
  const backgroundDisplayMap = {} // 出身顯示名稱映射
  
  if (selectedBackgrounds.value.length > 0 || backgroundGroups.value.length > 0) {
    // 添加個別選擇的出身
    selectedBackgrounds.value.forEach(bg => {
      if (allBackgrounds.includes(bg)) {
        backgrounds.push(bg)
        backgroundDisplayMap[bg] = bg
      }
    })
    
    // 添加分組出身
    backgroundGroups.value.forEach(group => {
      const groupKey = `group_${group.id}`
      backgrounds.push(groupKey)
      backgroundDisplayMap[groupKey] = group.name
      
      // 將分組中的出身數據合併到分組key下
      group.items.forEach(bg => {
        if (data[bg]) {
          if (!data[groupKey]) data[groupKey] = {}
          Object.keys(data[bg]).forEach(region => {
            if (!data[groupKey][region]) data[groupKey][region] = 0
            data[groupKey][region] += data[bg][region]
          })
        }
      })
    })
  } else {
    // 使用前15個最常見的出身
    const topBackgrounds = allBackgrounds.slice(0, 15)
    backgrounds.push(...topBackgrounds)
    topBackgrounds.forEach(bg => {
      backgroundDisplayMap[bg] = bg
    })
  }
  
  const regions = new Set()
  backgrounds.forEach(bg => {
    if (data[bg]) {
      Object.keys(data[bg]).forEach(region => regions.add(region))
    }
  })
  
  // 按出現頻率排序地區
  const regionCounts = {}
  backgrounds.forEach(bg => {
    if (data[bg]) {
      Object.entries(data[bg]).forEach(([region, count]) => {
        if (!regionCounts[region]) regionCounts[region] = 0
        regionCounts[region] += count
      })
    }
  })
  
  // 處理地區選擇（包含分組）
  const regionList = []
  const regionDisplayMap = {} // 地區顯示名稱映射
  
  if (selectedStats.value.length > 0 || statsGroups.value.length > 0) {
    // 添加個別選擇的地區
    selectedStats.value.forEach(region => {
      regionList.push(region)
      regionDisplayMap[region] = region
    })
    
    // 添加地區分組
    statsGroups.value.forEach(group => {
      const groupKey = `regionGroup_${group.id}`
      regionList.push(groupKey)
      regionDisplayMap[groupKey] = group.name
    })
  } else {
    // 使用所有可用的地區
    const availableRegions = Array.from(regions).sort((a, b) => regionCounts[b] - regionCounts[a])
    regionList.push(...availableRegions)
    availableRegions.forEach(region => {
      regionDisplayMap[region] = region
    })
  }
  
  // 準備stack數據
  const stackData = backgrounds.map(bg => {
    const datum = { 
      background: bg,
      displayName: backgroundDisplayMap[bg] || bg
    }
    
    regionList.forEach(region => {
      if (region.startsWith('regionGroup_')) {
        // 處理地區分組：合併分組中的地區數據
        const groupId = region.replace('regionGroup_', '')
        const regionGroup = statsGroups.value.find(g => g.id === groupId)
        if (regionGroup) {
          datum[region] = 0
          regionGroup.items.forEach(regionItem => {
            datum[region] += data[bg] ? (data[bg][regionItem] || 0) : 0
          })
        }
      } else {
        // 處理個別地區
        datum[region] = data[bg] ? (data[bg][region] || 0) : 0
      }
    })
    return datum
  })
  
  // 設置比例尺
  const y = d3.scaleBand()
    .domain(backgrounds)
    .range([0, chartDimensions.value.height - margin.top - margin.bottom])
    .padding(0.1)
  
  // 計算最大值：數值模式或百分比模式
  const maxValue = percentageMode.value ? 100 : d3.max(stackData, d => d3.sum(regionList, region => d[region]))
  const x = d3.scaleLinear()
    .domain([0, maxValue])
    .nice()
    .range([0, chartDimensions.value.width - margin.left - margin.right])
  
  // 顏色比例尺 - 根據本地列印模式和主題選擇配色
  const colors = getColorScheme(localPrintMode.value, true, dataStore.currentTheme)
  const color = d3.scaleOrdinal()
    .domain(regionList)
    .range(colors)
  
  // 創建stack
  const stack = d3.stack()
    .keys(regionList)
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
        const total = d3.sum(regionList, region => d.data[region] || 0)
        const percentage0 = total > 0 ? (d[0] / total) * 100 : 0
        return x(percentage0)
      }
      return x(d[0])
    })
    .attr("width", d => {
      if (percentageMode.value) {
        const total = d3.sum(regionList, region => d.data[region] || 0)
        if (total === 0) return 0
        const percentage0 = (d[0] / total) * 100
        const percentage1 = (d[1] / total) * 100
        return x(percentage1) - x(percentage0)
      }
      return x(d[1]) - x(d[0])
    })
    .attr("height", y.bandwidth())
    .on("click", function(event, d) {
      const region = d3.select(this.parentNode).datum().key
      handleBarClick(d.data.background, region)
    })
    .on("mouseover", function(event, d) {
      const region = d3.select(this.parentNode).datum().key
      const value = d[1] - d[0]
      const total = d3.sum(regionList, r => d.data[r] || 0)
      const percentage = ((value / total) * 100).toFixed(1)
      
      const backgroundDisplayName = d.data.displayName || d.data.background
      const regionDisplayName = regionDisplayMap[region] || region
      
      const tooltipContent = percentageMode.value ? 
        (() => {
          const total = d3.sum(regionList, r => d.data[r] || 0)
          const globalPercentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0
          return `
            出身: ${backgroundDisplayName}<br>
            ${title === 'first' ? '首次' : '最後'}任職地區: ${regionDisplayName}<br>
            人數: ${value} (${globalPercentage}%)
          `
        })() :
        `
          出身: ${backgroundDisplayName}<br>
          ${title === 'first' ? '首次' : '最後'}任職地區: ${regionDisplayName}<br>
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
      return displayName.length > 15 ? displayName.substring(0, 15) + '...' : displayName
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
  
  // 圖例 - 限制顯示前12個地區
  const legendRegions = regionList.slice(0, 12)
  const legend = svg.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${chartDimensions.value.width - margin.right + 20}, ${margin.top})`)
  
  const legendItems = legend.selectAll(".legend-item")
    .data(legendRegions)
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
    .style("font-size", "11px")
    .text(d => {
      const displayName = regionDisplayMap[d] || d
      return displayName.length > 10 ? displayName.substring(0, 10) + '...' : displayName
    })
  
  // 如果有更多地區，添加說明
  if (regionList.length > legendRegions.length) {
    legend.append("text")
      .attr("x", 0)
      .attr("y", legendRegions.length * 20 + 20)
      .style("font-size", "10px")
      .style("fill", "#999")
      .text(`...還有 ${regionList.length - legendRegions.length} 個地區`)
  }
  
  return svg
}

// 處理統計值選擇變化
const onStatSelectionChanged = (selectedValues, groups, direction) => {
  console.log('📊 RegionalFlowChart - 地區選擇變化:', {
    selectedValues: selectedValues.slice(0, 5),
    groupsCount: groups.length,
    direction
  })
  // 更新步驟狀態
  currentStep.value = Math.max(currentStep.value, 1)
  // 不自動渲染，只更新步驟狀態
}

// 處理出身選擇變化
const onBackgroundSelectionChanged = (selectedValues, groups, direction) => {
  console.log('📊 RegionalFlowChart - 出身選擇變化:', {
    selectedValues: selectedValues.slice(0, 5),
    groupsCount: groups.length,
    direction
  })
  // 更新步驟狀態
  currentStep.value = Math.max(currentStep.value, 1)
  // 不自動渲染，只更新步驟狀態
}

// 篩選條件變更時的處理
const onFilterChange = (autoRender = false) => {
  // 更新步驟狀態
  currentStep.value = hasValidConfiguration.value ? 2 : 1
  // 只有在 autoRender 為 true 且有有效配置時才更新圖表
  if (autoRender && hasValidConfiguration.value) {
    updateCharts()
  }
}

// 手動繪製圖表
const renderChart = () => {
  if (!hasValidConfiguration.value) {
    ElMessage.warning('請先選擇地區和出身選項')
    return
  }
  currentStep.value = 2
  updateCharts()
}

// 更新可用統計值列表（地區和出身列表）
const updateAvailableStats = () => {
  if (!dataStore.effectiveData.length) return
  
  const regionsSet = new Set()
  const backgroundsSet = new Set()
  let filteredData = dataStore.effectiveData
  
  // 如果不是鎖定模式，才應用額外的篩選條件
  if (!dataStore.isListLocked) {
    if (excludeBanner.value) {
      filteredData = filteredData.filter(d => !d.旗分 || d.旗分.trim() === '')
    }
    if (selectedBackground.value) {
      filteredData = filteredData.filter(d => getStandardizedBackground(d) === selectedBackground.value)
    }
  }
  
  // 收集所有地區和出身
  filteredData.forEach(d => {
    const region = d.地區 || '(無地區)'
    regionsSet.add(region)
    
    const background = getStandardizedBackground(d)
    backgroundsSet.add(background)
  })
  
  // 按使用頻率排序地區
  const regionCounts = {}
  const backgroundCounts = {}
  filteredData.forEach(d => {
    const region = d.地區 || '(無地區)'
    regionCounts[region] = (regionCounts[region] || 0) + 1
    
    const background = getStandardizedBackground(d)
    backgroundCounts[background] = (backgroundCounts[background] || 0) + 1
  })
  
  allAvailableStats.value = Array.from(regionsSet).sort((a, b) => (regionCounts[b] || 0) - (regionCounts[a] || 0))
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
      // 應用篩選
      let filteredData = dataStore.effectiveData

      // 如果不是鎖定模式，才應用額外的篩選條件
      if (!dataStore.isListLocked) {
        if (excludeBanner.value) {
          filteredData = filteredData.filter(d => !d.旗分 || d.旗分.trim() === '')
        }
        
        if (selectedBackground.value) {
          filteredData = filteredData.filter(d => d.出身一 === selectedBackground.value)
        }
      }
  
  // 按PersonUID分組，獲取每個官員的記錄
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
  
  // 統計出身與首次/最後任職地區的關係
  const firstRegionData = {}
  const lastRegionData = {}
  
  Object.values(officialRecords).forEach(records => {
    const firstRecord = records[0]
    const lastRecord = records[records.length - 1]
    
    const background = getStandardizedBackground(firstRecord)
    const firstRegion = firstRecord.地區 || '(無地區記錄)'
    const lastRegion = lastRecord.地區 || '(無地區記錄)'
    
    // 統計首次任職地區
    if (!firstRegionData[background]) {
      firstRegionData[background] = {}
    }
    if (!firstRegionData[background][firstRegion]) {
      firstRegionData[background][firstRegion] = 0
    }
    firstRegionData[background][firstRegion]++
    
    // 統計最後任職地區
    if (!lastRegionData[background]) {
      lastRegionData[background] = {}
    }
    if (!lastRegionData[background][lastRegion]) {
      lastRegionData[background][lastRegion] = 0
    }
    lastRegionData[background][lastRegion]++
  })
  
      // 繪製圖表
      if (chartView.value === 'first' || chartView.value === 'both') {
        firstSvg = createStackChart(firstChartContainer.value, firstRegionData, 'first')
      }
      
      if (chartView.value === 'last' || chartView.value === 'both') {
        lastSvg = createStackChart(lastChartContainer.value, lastRegionData, 'last')
      }
      
    } catch (error) {
      console.error('Chart rendering error:', error)
    } finally {
      loading.value = false
    }
  }, 100) // 100ms 延遲，讓 loading 動畫有時間顯示
}

const handleBarClick = (background, region) => {
  // 處理分組的情況
  if (background.startsWith('group_') || region.startsWith('regionGroup_')) {
    ElMessage.info('分組不支援直接點擊篩選，請點擊個別項目')
    return
  }
  
  const criteria = {
    background: background === '(無出身記錄)' ? '' : background,
    region: region === '(無地區記錄)' ? '' : region
  }
  
  emit('selection-changed', criteria)
  ElMessage.success(`已選擇出身為"${background}"且在"${region}"任職的官員`)
}

const handleResize = () => {
  updateCharts()
}

const exportChart = () => {
  const currentSvg = chartView.value === 'first' ? firstSvg : (chartView.value === 'last' ? lastSvg : firstSvg)
  if (currentSvg) {
    const chartType = chartView.value === 'first' ? '首次任職地區' : '最後任職地區'
    const filename = `地區流動分析-${chartType}-${Date.now()}.svg`
    exportSVG(currentSvg.node(), filename)
    ElMessage.success('圖表已匯出為SVG格式')
  }
}

const exportPNGChart = async () => {
  const currentSvg = chartView.value === 'first' ? firstSvg : (chartView.value === 'last' ? lastSvg : firstSvg)
  if (currentSvg) {
    try {
      const chartType = chartView.value === 'first' ? '首次任職地區' : '最後任職地區'
      const filename = `地區流動分析-${chartType}-${Date.now()}.png`
      await exportPNG(currentSvg.node(), filename)
      ElMessage.success('圖表已匯出為PNG格式')
    } catch (error) {
      console.error('PNG export error:', error)
      ElMessage.error('PNG匯出失敗')
    }
  }
}

const handleDimensionsChanged = (dimensions) => {
  chartDimensions.value = dimensions
  updateCharts()
}

// 監聽數據變化
watch(() => dataStore.effectiveData, () => {
  updateAvailableStats()
  updateCharts()
})
watch(() => dataStore.currentTheme, updateCharts)
watch(() => localPrintMode.value, updateCharts)

// 監聽篩選條件變化，更新可用統計值
watch([() => excludeBanner.value, () => selectedBackground.value, () => chartView.value], () => {
  updateAvailableStats()
  updateCharts()
})

// 監聽出身選擇變化
watch(() => selectedBackgrounds.value, () => {
  updateCharts()
})

// 過濾器狀態管理方法
const getFilterState = () => {
  return {
    chartView: chartView.value,
    selectedBackground: selectedBackground.value,
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
  if (state.selectedBackground !== undefined) selectedBackground.value = state.selectedBackground
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
.regional-flow-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chart-header {
  margin-bottom: 15px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
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

.regional-flow-container :deep(.bar-group rect) {
  cursor: pointer;
  transition: opacity 0.3s;
}

.regional-flow-container :deep(.x-axis text),
.regional-flow-container :deep(.y-axis text) {
  font-size: 12px;
  fill: #666;
}

.regional-flow-container :deep(.x-axis path),
.regional-flow-container :deep(.y-axis path),
.regional-flow-container :deep(.x-axis line),
.regional-flow-container :deep(.y-axis line) {
  stroke: #ddd;
}

.regional-flow-container :deep(.legend-item text) {
  fill: #666;
  cursor: default;
}

.regional-flow-container :deep(.legend-item:hover text) {
  fill: #333;
  font-weight: 600;
}
</style>