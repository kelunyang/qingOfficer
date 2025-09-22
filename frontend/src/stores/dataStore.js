import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as d3 from 'd3'

export const useDataStore = defineStore('data', () => {
  // State
  const rawData = ref([])
  const availableDatasets = ref([])
  const currentDataset = ref('')
  const loading = ref(false)
  const error = ref(null)
  
  // UI Settings
  const printMode = ref(false)
  const currentTheme = ref('default')
  const sankeyLineStyleMode = ref('thickness') // 'thickness' 或 'stage'
  
  // 鎖定名單功能
  const isListLocked = ref(false)
  const lockedPersonUIDs = ref(new Set())
  const lockedListSource = ref('') // 記錄名單來源
  
  // 過濾器儲存功能
  const savedFilters = ref(new Map()) // key: datasetName-chartName, value: filterState

  // Computed
  const processedData = computed(() => {
    if (!rawData.value.length) return []
    
    return rawData.value.map(d => ({
      ...d,
      record_number: +d.record_number || 0,
      陽曆年份: +d.陽曆年份 || 0,
      季節號: +d.季節號 || 0
    }))
  })

  const uniqueRegions = computed(() => {
    const regions = new Set(processedData.value.map(d => d.地區).filter(Boolean))
    return Array.from(regions).sort()
  })

  const uniquePositions = computed(() => {
    const positions = new Set(processedData.value.map(d => d.官職一).filter(Boolean))
    return Array.from(positions).sort()
  })

  // 鎖定名單相關計算屬性
  const hasAvailableLockList = computed(() => {
    return lockedPersonUIDs.value.size > 0 && !isListLocked.value
  })

  const lockedPersonCount = computed(() => {
    return lockedPersonUIDs.value.size
  })

  // 獲取當前有效數據（鎖定模式或全部數據）
  const effectiveData = computed(() => {
    if (isListLocked.value && lockedPersonUIDs.value.size > 0) {
      const filtered = processedData.value.filter(d => lockedPersonUIDs.value.has(d.PersonUID))
      const uniquePersonsInFiltered = new Set(filtered.map(d => d.PersonUID).filter(Boolean))
      console.log(`🔒 effectiveData: 鎖定模式，從 ${processedData.value.length} 條記錄篩選出 ${filtered.length} 條，鎖定了 ${lockedPersonUIDs.value.size} 位官員，實際包含 ${uniquePersonsInFiltered.size} 位官員`)
      return filtered
    }
    console.log(`🔓 effectiveData: 非鎖定模式，返回全部 ${processedData.value.length} 條記錄`)
    return processedData.value
  })

  // Actions
  const scanDatasets = async () => {
    try {
      // 掃描當前目錄下的CSV檔案
      const basePath = import.meta.env.BASE_URL || '/'
      const response = await fetch(`${basePath}datasets.json`)
      if (response.ok) {
        const datasets = await response.json()
        availableDatasets.value = datasets
        console.log('Loaded datasets from datasets.json:', datasets)
      } else {
        // 如果沒有API，嘗試預設的檔案列表
        availableDatasets.value = [
          'CGED-Q Public Release 1760-1798  1 Jul 2024.csv',
          'CGED-Q Public Release 1850-1864 19 Apr 2022.csv'
        ]
      }
    } catch (err) {
      // 預設檔案列表作為fallback
      availableDatasets.value = [
        'CGED-Q Public Release 1760-1798  1 Jul 2024.csv',
        'CGED-Q Public Release 1850-1864 19 Apr 2022.csv'
      ]
      console.warn('無法掃描數據集，使用預設列表:', err)
    }
  }

  const loadDataset = async (filename) => {
    loading.value = true
    error.value = null
    
    try {
      // 手動拼接 base 路徑
      const basePath = import.meta.env.BASE_URL || '/'
      const csvPath = `${basePath}${filename}`
      console.log('Loading CSV from:', csvPath)
      
      const data = await d3.csv(csvPath)
      rawData.value = data
      currentDataset.value = filename
      console.log(`已載入數據集: ${filename}, 共 ${data.length} 筆記錄`)
    } catch (err) {
      error.value = `載入數據集失敗: ${err.message}`
      console.error('載入數據集錯誤:', err)
    } finally {
      loading.value = false
    }
  }

  const getOfficialsByPersonUID = (personUID) => {
    return processedData.value
      .filter(d => d.PersonUID === personUID)
      .sort((a, b) => a.record_number - b.record_number)
  }

  const getFilteredDataForSankeyNode = (criteria) => {
    console.log('🎯 Filtering data for Sankey node click:', criteria)
    let filtered = processedData.value
    
    // 第一步：應用起點篩選條件（如果有設置的話）
    if (criteria.selectedOrigins && criteria.selectedOrigins.length > 0) {
      const beforeCount = filtered.length
      filtered = filtered.filter(d => criteria.selectedOrigins.includes(d.出身一))
      console.log(`📊 Origin filter applied: ${beforeCount} -> ${filtered.length}`)
    }
    
    if (criteria.selectedOriginGroups && criteria.selectedOriginGroups.length > 0) {
      const beforeCount = filtered.length
      const allOriginItems = criteria.selectedOriginGroups.flatMap(group => group.items)
      filtered = filtered.filter(d => allOriginItems.includes(d.出身一))
      console.log(`📊 Origin group filter applied: ${beforeCount} -> ${filtered.length}`)
    }
    
    // 第二步：按PersonUID分組，構建每個人的職業路徑
    const officialRecords = {}
    filtered.forEach(record => {
      if (!record.PersonUID) return
      
      if (!officialRecords[record.PersonUID]) {
        officialRecords[record.PersonUID] = []
      }
      officialRecords[record.PersonUID].push(record)
    })
    
    // 第三步：排序每個人的記錄
    Object.values(officialRecords).forEach(records => {
      records.sort((a, b) => a.record_number - b.record_number)
    })
    
    // 第四步：根據終點篩選條件過濾官員
    const filteredOfficials = {}
    Object.entries(officialRecords).forEach(([uid, records]) => {
      // 檢查是否有終點篩選條件
      const hasDestinationFilter = (criteria.selectedDestinations && criteria.selectedDestinations.length > 0) ||
                                   (criteria.selectedDestinationGroups && criteria.selectedDestinationGroups.length > 0)
      
      if (hasDestinationFilter) {
        const fieldName = criteria.specificFieldType === 'institution' ? '機構一' : '官職一'
        const lastPosition = records[records.length - 1][fieldName] || '(無記錄)'
        
        // 檢查終點篩選
        let matchesDestination = false
        
        if (criteria.selectedDestinations && criteria.selectedDestinations.includes(lastPosition)) {
          matchesDestination = true
        }
        
        if (criteria.selectedDestinationGroups) {
          const allDestItems = criteria.selectedDestinationGroups.flatMap(group => group.items)
          if (allDestItems.includes(lastPosition)) {
            matchesDestination = true
          }
        }
        
        if (!matchesDestination) {
          return // 跳過這個官員
        }
      }
      
      filteredOfficials[uid] = records
    })
    
    // 第五步：根據點擊的節點階段和內容進行最終篩選
    const finalResults = []
    
    Object.values(filteredOfficials).forEach(records => {
      if (criteria.nodeStage === 0) {
        // 出身階段點擊
        const background = records[0].出身一 || '(無出身記錄)'
        
        // 檢查是否符合點擊的出身節點
        let matches = false
        
        if (criteria.additionalOrigin !== undefined) {
          matches = background === criteria.additionalOrigin || 
                   (criteria.additionalOrigin === '' && (!background || background.trim() === ''))
        } else if (criteria.additionalOriginList) {
          matches = criteria.additionalOriginList.includes(background)
        }
        
        if (matches) {
          finalResults.push(...records)
        }
      } else {
        // 職位階段點擊
        const targetStage = criteria.nodeStage - 1 // 轉換為records的索引
        
        if (targetStage < records.length) {
          const record = records[targetStage]
          const fieldName = criteria.specificFieldType === 'institution' ? '機構一' : '官職一'
          const position = record[fieldName] || '(無記錄)'
          
          let matches = false
          
          if (criteria.specificInstitution !== undefined || criteria.specificPosition !== undefined) {
            const targetValue = criteria.specificInstitution || criteria.specificPosition
            matches = position === targetValue || 
                     (targetValue === '' && (!position || position.trim() === ''))
          } else if (criteria.specificValuesList) {
            matches = criteria.specificValuesList.includes(position)
          }
          
          if (matches) {
            finalResults.push(...records)
          }
        }
      }
    })
    
    console.log(`✅ Sankey node filter result: ${filtered.length} -> ${finalResults.length} records`)
    return finalResults
  }

  // 鎖定名單相關方法
  const setLockableList = (personUIDs, source = '') => {
    console.log(`📋 設置可鎖定名單: ${personUIDs.length} 位官員，來源: ${source}`)
    lockedPersonUIDs.value = new Set(personUIDs)
    lockedListSource.value = source
  }

  const lockCurrentList = () => {
    if (lockedPersonUIDs.value.size === 0) {
      console.warn('⚠️ 沒有可鎖定的名單')
      return false
    }
    isListLocked.value = true
    console.log(`🔒 已鎖定名單: ${lockedPersonUIDs.value.size} 位官員，來源: ${lockedListSource.value}`)
    return true
  }

  const unlockList = () => {
    isListLocked.value = false
    lockedPersonUIDs.value.clear()
    lockedListSource.value = ''
    console.log('🔓 已解鎖名單')
  }

  // 過濾器儲存相關方法
  const getFilterKey = (chartName) => {
    return `${currentDataset.value}-${chartName}`
  }

  const saveFiltersToLocalStorage = () => {
    try {
      const filtersObject = {}
      savedFilters.value.forEach((value, key) => {
        filtersObject[key] = value
      })
      localStorage.setItem('qingOfficer-filters', JSON.stringify(filtersObject))
      console.log('💾 過濾器已儲存到 localStorage')
    } catch (error) {
      console.error('儲存過濾器到 localStorage 失敗:', error)
    }
  }

  const loadFiltersFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem('qingOfficer-filters')
      if (saved) {
        const filtersObject = JSON.parse(saved)
        savedFilters.value = new Map(Object.entries(filtersObject))
        console.log('📂 從 localStorage 載入過濾器')
      }
    } catch (error) {
      console.error('從 localStorage 載入過濾器失敗:', error)
      savedFilters.value = new Map()
    }
  }

  const saveChartFilter = (chartName, filterState) => {
    if (!currentDataset.value) {
      console.warn('⚠️ 沒有選擇數據集，無法儲存過濾器')
      return false
    }
    
    const key = getFilterKey(chartName)
    savedFilters.value.set(key, { ...filterState, timestamp: new Date().toISOString() })
    saveFiltersToLocalStorage()
    console.log(`💾 已儲存 ${chartName} 的過濾器設定`)
    return true
  }

  const loadChartFilter = (chartName) => {
    if (!currentDataset.value) {
      console.warn('⚠️ 沒有選擇數據集，無法載入過濾器')
      return null
    }
    
    const key = getFilterKey(chartName)
    const saved = savedFilters.value.get(key)
    if (saved) {
      console.log(`📂 載入 ${chartName} 的過濾器設定`)
      return saved
    }
    return null
  }

  const hasChartFilter = (chartName) => {
    if (!currentDataset.value) return false
    const key = getFilterKey(chartName)
    return savedFilters.value.has(key)
  }

  const clearChartFilter = (chartName) => {
    if (!currentDataset.value) return false
    
    const key = getFilterKey(chartName)
    if (savedFilters.value.delete(key)) {
      saveFiltersToLocalStorage()
      console.log(`🗑️ 已清除 ${chartName} 的過濾器設定`)
      return true
    }
    return false
  }

  const getAllSavedFilters = () => {
    if (!currentDataset.value) return []
    
    const currentDatasetFilters = []
    savedFilters.value.forEach((value, key) => {
      if (key.startsWith(currentDataset.value + '-')) {
        const chartName = key.replace(currentDataset.value + '-', '')
        currentDatasetFilters.push({
          chartName,
          timestamp: value.timestamp,
          filterState: value
        })
      }
    })
    return currentDatasetFilters.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }

  const getFilteredData = (criteria) => {
    console.log('🔍 getFilteredData called with criteria:', criteria)
    
    // 如果啟用了鎖定模式，直接返回鎖定的數據
    if (isListLocked.value && lockedPersonUIDs.value.size > 0) {
      console.log(`🔒 使用鎖定名單: ${lockedPersonUIDs.value.size} 位官員，來源: ${lockedListSource.value}`)
      return effectiveData.value
    }

    let filtered = processedData.value
    const originalCount = filtered.length
    
    // 如果是從桑基圖節點點擊來的，需要特殊處理
    if (criteria.nodeStage !== undefined) {
      console.log(`🎯 Processing Sankey node click for stage ${criteria.nodeStage}`)
      return getFilteredDataForSankeyNode(criteria)
    }
    
    // 添加快速測試：統計包含"尚書"的記錄數
    if (criteria.destinationGroup && criteria.destinationGroup.name.includes('尚書')) {
      const shangShuCount = filtered.filter(d => d.官職一 && d.官職一.includes('尚書')).length
      const jigouShangShuCount = filtered.filter(d => d.機構一 && d.機構一.includes('尚書')).length
      console.log(`🔍 Quick test - Records with "尚書" in 官職一: ${shangShuCount}`)
      console.log(`🔍 Quick test - Records with "尚書" in 機構一: ${jigouShangShuCount}`)
    }
    
    if (criteria.region) {
      filtered = filtered.filter(d => d.地區 === criteria.region)
    }
    
    // 處理職位篩選（包含分組）
    if (criteria.position) {
      filtered = filtered.filter(d => d.官職一 === criteria.position)
      console.log(`📊 Position filter "${criteria.position}": ${filtered.length} records`)
    } else if (criteria.originalValuesList && criteria.fieldType === 'position') {
      // 新的多值篩選：節點包含多個原始職位
      const beforeCount = filtered.length
      filtered = filtered.filter(d => criteria.originalValuesList.includes(d.官職一))
      console.log(`📊 Position multi-value filter (${criteria.originalValuesList.length} values): ${beforeCount} -> ${filtered.length} records`)
      console.log(`📊 Values: ${criteria.originalValuesList.slice(0, 3).join(', ')}${criteria.originalValuesList.length > 3 ? '...' : ''}`)
    } else if (criteria.destinationGroup) {
      // 分組查詢：任何包含在分組中的職位
      const beforeCount = filtered.length
      console.log(`🔍 Looking for matches in 官職一 field for group "${criteria.destinationGroup.name}"`)
      console.log(`🔍 Group items (first 3):`, criteria.destinationGroup.items.slice(0, 3))
      
      // 取樣一些實際的官職一數據
      const samplePositions = [...new Set(filtered.map(d => d.官職一).filter(Boolean))].slice(0, 5)
      console.log(`🔍 Sample 官職一 values in data:`, samplePositions)
      
      filtered = filtered.filter(d => {
        // 精確匹配
        let match = criteria.destinationGroup.items.includes(d.官職一)
        
        // 如果精確匹配失敗，嘗試智能匹配（針對複雜職位名稱）
        if (!match && d.官職一) {
          match = criteria.destinationGroup.items.some(item => {
            // 檢查關鍵字匹配（如"尚書"）
            if (item.includes('尚書') && d.官職一.includes('尚書')) {
              return true
            }
            
            // 移除特殊字符和空格進行精確比較
            const cleanItem = item.replace(/[？…\s]/g, '')
            const cleanPosition = d.官職一.replace(/[？…\s]/g, '')
            
            // 精確匹配清理後的字符串
            return cleanItem === cleanPosition
          })
        }
        
        if (match) {
          console.log(`✅ Found match: "${d.官職一}"`)
        }
        return match
      })
      console.log(`📊 Destination group filter "${criteria.destinationGroup.name}": ${beforeCount} -> ${filtered.length} records`)
    }
    
    // 處理出身篩選（包含分組）
    if (criteria.background || criteria.origin) {
      const targetBackground = criteria.background || criteria.origin
      filtered = filtered.filter(d => d.出身一 === targetBackground)
      console.log(`📊 Background filter "${targetBackground}": ${filtered.length} records`)
    } else if (criteria.originalValuesList && criteria.fieldType === 'origin') {
      // 新的多值篩選：節點包含多個原始出身
      const beforeCount = filtered.length
      filtered = filtered.filter(d => criteria.originalValuesList.includes(d.出身一))
      console.log(`📊 Origin multi-value filter (${criteria.originalValuesList.length} values): ${beforeCount} -> ${filtered.length} records`)
      console.log(`📊 Values: ${criteria.originalValuesList.slice(0, 3).join(', ')}${criteria.originalValuesList.length > 3 ? '...' : ''}`)
    } else if (criteria.originGroup) {
      // 分組查詢：任何包含在分組中的出身
      const beforeCount = filtered.length
      filtered = filtered.filter(d => criteria.originGroup.items.includes(d.出身一))
      console.log(`📊 Origin group filter "${criteria.originGroup.name}" (${criteria.originGroup.items.join(', ')}): ${beforeCount} -> ${filtered.length} records`)
    } else if (criteria.backgroundGroup) {
      // RegionalOfficialChart 分組查詢：任何包含在分組中的出身
      const beforeCount = filtered.length
      filtered = filtered.filter(d => criteria.backgroundGroup.items.includes(d.出身一))
      console.log(`📊 Background group filter "${criteria.backgroundGroup.name}" (${criteria.backgroundGroup.items.join(', ')}): ${beforeCount} -> ${filtered.length} records`)
    }
    
    if (criteria.banner) {
      filtered = filtered.filter(d => d.旗分 === criteria.banner)
    } else if (criteria.bannerGroup) {
      // RegionalOfficialChart 分組查詢：任何包含在分組中的旗分
      const beforeCount = filtered.length
      filtered = filtered.filter(d => criteria.bannerGroup.items.includes(d.旗分))
      console.log(`📊 Banner group filter "${criteria.bannerGroup.name}" (${criteria.bannerGroup.items.join(', ')}): ${beforeCount} -> ${filtered.length} records`)
    }
    
    // 處理機構篩選（包含分組）
    if (criteria.institution) {
      filtered = filtered.filter(d => d.機構一 === criteria.institution)
      console.log(`📊 Institution filter "${criteria.institution}": ${filtered.length} records`)
    } else if (criteria.institutionGroup) {
      // RegionalOfficialChart 機構分組查詢：任何包含在分組中的機構
      const beforeCount = filtered.length
      filtered = filtered.filter(d => criteria.institutionGroup.items.includes(d.機構一))
      console.log(`📊 Institution group filter "${criteria.institutionGroup.name}" (${criteria.institutionGroup.items.join(', ')}): ${beforeCount} -> ${filtered.length} records`)
    } else if (criteria.originalValuesList && criteria.fieldType === 'institution') {
      // 新的多值篩選：節點包含多個原始機構
      const beforeCount = filtered.length
      filtered = filtered.filter(d => criteria.originalValuesList.includes(d.機構一))
      console.log(`📊 Institution multi-value filter (${criteria.originalValuesList.length} values): ${beforeCount} -> ${filtered.length} records`)
      console.log(`📊 Values: ${criteria.originalValuesList.slice(0, 3).join(', ')}${criteria.originalValuesList.length > 3 ? '...' : ''}`)
    } else if (criteria.destinationGroup && !criteria.position) {
      // 如果是機構模式的分組查詢
      const beforeCount = filtered.length
      console.log(`🔍 Looking for matches in 機構一 field for group "${criteria.destinationGroup.name}"`)
      console.log(`🔍 Group items (first 3):`, criteria.destinationGroup.items.slice(0, 3))
      
      // 取樣一些實際的機構一數據
      const sampleInstitutions = [...new Set(filtered.map(d => d.機構一).filter(Boolean))].slice(0, 5)
      console.log(`🔍 Sample 機構一 values in data:`, sampleInstitutions)
      
      filtered = filtered.filter(d => {
        // 精確匹配
        let match = criteria.destinationGroup.items.includes(d.機構一)
        
        // 如果精確匹配失敗，嘗試智能匹配（針對複雜機構名稱）
        if (!match && d.機構一) {
          match = criteria.destinationGroup.items.some(item => {
            // 檢查關鍵字匹配（如"尚書"）
            if (item.includes('尚書') && d.機構一.includes('尚書')) {
              return true
            }
            
            // 移除特殊字符和空格進行精確比較
            const cleanItem = item.replace(/[？…\s]/g, '')
            const cleanInstitution = d.機構一.replace(/[？…\s]/g, '')
            
            // 精確匹配清理後的字符串
            return cleanItem === cleanInstitution
          })
        }
        
        if (match) {
          console.log(`✅ Found match: "${d.機構一}"`)
        }
        return match
      })
      console.log(`📊 Institution group filter "${criteria.destinationGroup.name}": ${beforeCount} -> ${filtered.length} records`)
    }
    
    // 處理排除的官員UID列表
    if (criteria.excludedPersonUIDs && criteria.excludedPersonUIDs.length > 0) {
      const beforeCount = filtered.length
      filtered = filtered.filter(d => !criteria.excludedPersonUIDs.includes(d.PersonUID))
      console.log(`📊 Excluded PersonUIDs filter: ${beforeCount} -> ${filtered.length} records (excluded ${criteria.excludedPersonUIDs.length} UIDs)`)
    }
    
    console.log(`✅ Final filter result: ${originalCount} -> ${filtered.length} records`)
    return filtered
  }

  return {
    rawData,
    processedData,
    effectiveData,
    availableDatasets,
    currentDataset,
    loading,
    error,
    uniqueRegions,
    uniquePositions,
    printMode,
    currentTheme,
    sankeyLineStyleMode,
    // 鎖定名單功能
    isListLocked,
    lockedPersonUIDs,
    lockedListSource,
    hasAvailableLockList,
    lockedPersonCount,
    setLockableList,
    lockCurrentList,
    unlockList,
    // 過濾器儲存功能
    savedFilters,
    saveChartFilter,
    loadChartFilter,
    hasChartFilter,
    clearChartFilter,
    getAllSavedFilters,
    loadFiltersFromLocalStorage,
    // 原有方法
    scanDatasets,
    loadDataset,
    getOfficialsByPersonUID,
    getFilteredData
  }
})