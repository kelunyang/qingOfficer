<template>

  <el-drawer
    v-model="visible"
    :title="title"
    direction="btt"
    size="100%"
    class="multi-select-drawer"
    :z-index="3000"
    :modal="true"
    :append-to-body="true"
  >
    <template #header="{ close, titleId, titleClass }">
      <div class="custom-header">
        <h4 :id="titleId" :class="titleClass">{{ title }}</h4>
        <el-button @click="close" size="large" type="primary" text class="close-btn">
          <el-icon size="20"><Close /></el-icon>
        </el-button>
      </div>
    </template>

    <div class="drawer-content">
      <!-- Search Section -->
      <div class="search-section">
        <el-input
          v-model="searchKeyword"
          :placeholder="`搜索${title}...`"
          clearable
          size="large"
          class="search-input"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <!-- Tabs for switching between items and groups -->
      <el-tabs v-model="activeTab" class="main-tabs" size="large">
        <el-tab-pane label="項目選擇" name="items">
          <!-- Actions Section -->
          <div class="actions-section">
            <el-button @click="selectAll" :disabled="filteredOptions.length === 0">
              全選 ({{ filteredOptions.length }})
            </el-button>
            <el-button @click="clearAll" :disabled="tempSelectedValues.length === 0">
              清空
            </el-button>
            <el-button @click="selectTop10" :disabled="filteredOptions.length === 0">
              選前10
            </el-button>
            <el-button @click="resetDefault" v-if="defaultValues && defaultValues.length > 0">
              重置預設
            </el-button>
            <el-button type="primary" @click="addToGroup" :disabled="tempSelectedValues.length === 0">
              添加到分組
            </el-button>
          </div>

          <!-- Selected Count Info -->
          <div class="selection-info">
            <el-tag size="default" type="success">
              已選 {{ tempSelectedValues.length }} 項
            </el-tag>
            <el-tag size="default" type="info" v-if="searchKeyword">
              顯示 {{ filteredOptions.length }} / {{ options.length }}
            </el-tag>
            <el-tag size="default" type="warning" v-if="groups.length > 0">
              分組 {{ groups.length }} 個
            </el-tag>
          </div>

          <!-- Options List with Virtual Scrolling -->
          <div 
            class="options-container"
            v-infinite-scroll="loadMore"
            :infinite-scroll-disabled="!hasMore || isLoading"
            :infinite-scroll-distance="100"
            infinite-scroll-immediate="false"
          >
            <!-- Performance info -->
            <div class="performance-info">
              <el-tag size="small" type="info">
                顯示 {{ displayedOptions.length }} / {{ totalItems }} 項
                <span v-if="totalItems > itemsPerPage">（滾動載入更多）</span>
              </el-tag>
            </div>

            <!-- Option items -->
            <div 
              v-for="option in displayedOptions" 
              :key="option.value"
              class="option-item"
              :class="{ 'selected': isSelected(option.value) }"
              @click="toggleSelection(option.value)"
            >
              <div class="option-content">
                <el-checkbox 
                  :model-value="isSelected(option.value)"
                  @change="toggleSelection(option.value)"
                  @click.stop
                  size="large"
                />
                <span class="option-label">{{ option.label }}</span>
                <span class="option-count" v-if="option.count !== undefined">
                  {{ option.count }}人
                </span>
              </div>
            </div>

            <!-- Loading skeleton -->
            <div v-if="isLoading" class="loading-skeleton">
              <div v-for="n in 5" :key="n" class="skeleton-item">
                <el-skeleton animated>
                  <template #template>
                    <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px;">
                      <el-skeleton-item variant="button" style="width: 16px; height: 16px;" />
                      <el-skeleton-item variant="text" style="width: 60%; height: 20px;" />
                      <el-skeleton-item variant="text" style="width: 40px; height: 16px; margin-left: auto;" />
                    </div>
                  </template>
                </el-skeleton>
              </div>
            </div>

            <!-- Load more indicator -->
            <div v-if="hasMore && !isLoading && displayedOptions.length > 0" class="load-more-hint">
              <el-text type="info" size="small">滾動以載入更多項目...</el-text>
            </div>
            
            <!-- Empty State -->
            <el-empty 
              v-if="!filteredOptions || filteredOptions.length === 0" 
              :description="getEmptyStateDescription()"
              :image-size="120"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane name="groups">
          <template #label>
            分組管理
            <el-badge :value="groups.length" v-if="groups.length > 0" class="item" />
          </template>
          
          <!-- Group Management -->
          <div class="group-management">
            <div class="group-create">
              <el-input
                v-model="newGroupName"
                placeholder="輸入分組名稱"
                size="large"
                style="flex: 1"
                @keyup.enter="createGroup"
              />
              <el-button size="large" type="primary" @click="createGroup" :disabled="!newGroupName.trim()">
                創建分組
              </el-button>
            </div>

            <div class="groups-list" v-if="groups.length > 0">
              <div v-for="group in groups" :key="group.id" class="group-item">
                <div class="group-header">
                  <div class="group-info">
                    <el-tag type="success" size="large">{{ group.name }}</el-tag>
                    <span class="group-count">{{ group.items.length }} 項</span>
                  </div>
                  <div class="group-actions">
                    <el-button @click="editGroup(group)" size="small">
                      <el-icon><Edit /></el-icon>
                    </el-button>
                    <el-button type="danger" @click="deleteGroup(group.id)" size="small">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>
                <div class="group-items">
                  <el-tag
                    v-for="item in group.items"
                    :key="item"
                    closable
                    @close="removeFromGroup(group.id, item)"
                    class="group-item-tag"
                  >
                    {{ getLabelByValue(item) }}
                  </el-tag>
                </div>
              </div>
            </div>

            <el-empty v-else description="還沒有創建任何分組" :image-size="150" />
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- Final Selection Preview -->
      <div class="final-preview">
        <div class="preview-header">
          <span>最終選擇預覽：</span>
          <el-tag size="default" type="primary">
            個別項目: {{ tempSelectedValues.filter(v => !isGroupItem(v)).length }}
          </el-tag>
          <el-tag size="default" type="success">
            分組: {{ groups.length }}
          </el-tag>
        </div>
        
        <!-- Individual Items -->
        <div class="individual-items" v-if="tempSelectedValues.filter(v => !isGroupItem(v)).length > 0">
          <h4>個別項目（拖拽排序，第一個為最重要）：</h4>
          <div class="selected-tags sortable-tags" ref="sortableContainer">
            <el-tag
              v-for="(value, index) in tempSelectedValues.filter(v => !isGroupItem(v))"
              :key="value"
              closable
              @close="removeSelection(value)"
              class="selected-tag sortable-tag"
              :class="{ 'first-priority': index === 0 }"
              draggable="true"
              @dragstart="onDragStart($event, value)"
              @dragover="onDragOver"
              @drop="onDrop($event, value)"
            >
              <span class="priority-indicator" v-if="index === 0">👑</span>
              <span class="priority-number">{{ index + 1 }}.</span>
              {{ getLabelByValue(value) }}
            </el-tag>
          </div>
          <div class="sort-hint">
            <el-text type="info" size="small">
              💡 拖拽調整順序：第一個項目為最重要，會影響桑基圖的階段計算
            </el-text>
          </div>
        </div>

        <!-- Groups -->
        <div class="groups-preview" v-if="groups.length > 0">
          <h4>分組（拖拽排序，第一個為最重要）：</h4>
          <div class="selected-tags sortable-tags">
            <el-tag
              v-for="(group, index) in groups"
              :key="group.id"
              closable
              @close="deleteGroupDirect(group.id)"
              size="large"
              type="success"
              class="selected-tag group-tag sortable-tag"
              :class="{ 'first-priority': index === 0 }"
              draggable="true"
              @dragstart="onGroupDragStart($event, group.id)"
              @dragover="onDragOver"
              @drop="onGroupDrop($event, group.id)"
            >
              <span class="priority-indicator" v-if="index === 0">👑</span>
              <span class="priority-number">{{ index + 1 }}.</span>
              {{ group.name }} ({{ group.items.length }}項)
            </el-tag>
          </div>
          <div class="sort-hint">
            <el-text type="info" size="small">
              💡 拖拽調整分組順序：第一個分組為最重要，會影響桑基圖的階段計算
            </el-text>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <el-button size="large" @click="handleCancel">取消</el-button>
        <el-button size="large" type="primary" @click="handleConfirm">
          確認選擇 ({{ getTotalSelectionCount() }} 項)
        </el-button>
      </div>
    </div>

    <!-- Add to Group Dialog -->
    <el-dialog
      v-model="addToGroupDialogVisible"
      title="添加到分組"
      width="600px"
      :z-index="3100"
      append-to-body
    >
      <div>
        <div v-if="groups.length > 0" style="margin-bottom: 20px;">
          <p style="margin-bottom: 10px; font-weight: 600;">點擊選擇現有分組：</p>
          <div class="existing-groups-selection">
            <el-tag
              v-for="group in groups"
              :key="group.id"
              :type="selectedGroupId === group.id ? 'primary' : 'info'"
              :effect="selectedGroupId === group.id ? 'dark' : 'light'"
              size="large"
              class="group-selection-tag"
              @click="selectedGroupId = selectedGroupId === group.id ? '' : group.id"
              style="cursor: pointer; margin: 5px;"
            >
              <el-icon v-if="selectedGroupId === group.id"><Check /></el-icon>
              {{ group.name }} ({{ group.items.length }}項)
            </el-tag>
          </div>
          <el-text type="info" size="small" style="display: block; margin-top: 10px;">
            💡 點擊分組標籤來選擇，再次點擊可取消選擇
          </el-text>
        </div>
        
        <div v-else style="margin-bottom: 20px;">
          <el-text type="info" size="small">
            💡 尚無現有分組，請在下方創建新分組
          </el-text>
        </div>
        
        <div>
          <p style="margin-bottom: 10px; font-weight: 600;">或創建新分組：</p>
          <el-input
            v-model="newGroupNameForAdd"
            placeholder="輸入新分組名稱"
            size="large"
            @keyup.enter="confirmAddToGroup"
          />
        </div>
      </div>
      
      <template #footer>
        <el-button size="large" @click="addToGroupDialogVisible = false">取消</el-button>
        <el-button 
          size="large" 
          type="primary" 
          @click="confirmAddToGroup"
          :disabled="!selectedGroupId && !newGroupNameForAdd.trim()"
        >
          確認
        </el-button>
      </template>
    </el-dialog>

    <!-- Edit Group Dialog -->
    <el-dialog
      v-model="editGroupDialogVisible"
      title="編輯分組"
      width="500px"
      :z-index="3100"
      append-to-body
    >
      <el-input
        v-model="editingGroupName"
        placeholder="分組名稱"
        size="large"
        @keyup.enter="confirmEditGroup"
      />
      
      <template #footer>
        <el-button size="large" @click="editGroupDialogVisible = false">取消</el-button>
        <el-button size="large" type="primary" @click="confirmEditGroup">確認</el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { Search, Edit, Delete, Close, Check } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// Props
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '選擇項目'
  },
  options: {
    type: Array,
    default: () => []
    // Expected format: [{ label: 'Label', value: 'value', count?: number }]
  },
  selectedValues: {
    type: Array,
    default: () => []
  },
  selectedGroups: {
    type: Array,
    default: () => []
    // Expected format: [{ id: 'id', name: 'name', items: ['value1', 'value2'] }]
  },
  defaultValues: {
    type: Array,
    default: () => []
  },
  maxSelection: {
    type: Number,
    default: null
  }
})

// Emits
const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

// Reactive data
const searchKeyword = ref('')
const activeTab = ref('items')
const tempSelectedValues = ref([])
const groups = ref([])
const newGroupName = ref('')
const addToGroupDialogVisible = ref(false)
const editGroupDialogVisible = ref(false)
const selectedGroupId = ref('')
const newGroupNameForAdd = ref('')
const editingGroupName = ref('')
const editingGroupId = ref('')

// Virtual scrolling and loading states
const isLoading = ref(false)
const displayedOptions = ref([])
const itemsPerPage = 50
const currentPage = ref(1)
const hasMore = ref(true)

// Search debounce
const searchDebounceTimer = ref(null)
const debouncedSearch = ref('')

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Initialize temp values when drawer opens
watch(visible, (newVal) => {
  if (newVal) {
    console.log('📋 MultiSelectDrawer - 打開drawer，初始化數據:', {
      selectedValues: props.selectedValues.length,
      selectedGroups: props.selectedGroups.length,
      selectedGroupsData: props.selectedGroups
    })
    
    // Initialize with current props values
    tempSelectedValues.value = [...props.selectedValues]
    groups.value = props.selectedGroups.map(g => ({ ...g, items: [...g.items] }))
    searchKeyword.value = ''
    activeTab.value = 'items'
    
    console.log('📋 MultiSelectDrawer - 初始化後的groups:', groups.value)
    
    // Initialize virtual scrolling
    nextTick(() => {
      initializeItems()
    })
  } else {
    console.log('📋 MultiSelectDrawer - 關閉drawer')
  }
})

// Watch for search changes with debounce
watch(searchKeyword, (newValue) => {
  // Clear previous timer
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value)
  }
  
  // Set new timer for debounced search
  searchDebounceTimer.value = setTimeout(() => {
    debouncedSearch.value = newValue
    nextTick(() => {
      initializeItems()
    })
  }, 300) // 300ms debounce delay
})

// Watch for options changes
watch(() => props.options, () => {
  nextTick(() => {
    initializeItems()
  })
}, { deep: true })

// Watch for selectedGroups changes from parent
watch(() => props.selectedGroups, (newGroups) => {
  console.log('📋 MultiSelectDrawer - selectedGroups props 變化:', {
    newLength: newGroups.length,
    newGroups: newGroups,
    currentLength: groups.value.length
  })
  
  // 只有在drawer關閉時才同步，避免在用戶編輯時被覆蓋
  if (!visible.value) {
    groups.value = newGroups.map(g => ({ ...g, items: [...g.items] }))
    console.log('📋 MultiSelectDrawer - 已同步groups from props:', groups.value)
  }
}, { deep: true })

// Computed
const filteredOptions = computed(() => {
  if (!props.options || props.options.length === 0) {
    return []
  }
  
  // Use debounced search value for filtering
  const searchValue = debouncedSearch.value || searchKeyword.value
  if (!searchValue) {
    return props.options
  }
  const keyword = searchValue.toLowerCase()
  return props.options.filter(option => 
    option.label.toLowerCase().includes(keyword) ||
    option.value.toLowerCase().includes(keyword)
  )
})

// Virtual scrolling computed
const totalItems = computed(() => filteredOptions.value.length)
const maxPages = computed(() => Math.ceil(totalItems.value / itemsPerPage))

// Load more items for virtual scrolling
const loadMore = () => {
  if (isLoading.value || !hasMore.value) return
  
  isLoading.value = true
  
  // Simulate loading delay for better UX
  setTimeout(() => {
    const startIndex = (currentPage.value - 1) * itemsPerPage
    const endIndex = Math.min(startIndex + itemsPerPage, filteredOptions.value.length)
    
    const newItems = filteredOptions.value.slice(startIndex, endIndex)
    displayedOptions.value.push(...newItems)
    
    currentPage.value++
    hasMore.value = currentPage.value <= maxPages.value
    isLoading.value = false
  }, 100)
}

// Initialize displayed items
const initializeItems = () => {
  displayedOptions.value = []
  currentPage.value = 1
  hasMore.value = true
  
  if (filteredOptions.value.length > 0) {
    const initialItems = filteredOptions.value.slice(0, itemsPerPage)
    displayedOptions.value = [...initialItems]
    hasMore.value = filteredOptions.value.length > itemsPerPage
  }
}

// Methods
const isSelected = (value) => {
  return tempSelectedValues.value.includes(value)
}

const isGroupItem = (value) => {
  return groups.value.some(group => group.items.includes(value))
}

const toggleSelection = (value) => {
  const newSelection = [...tempSelectedValues.value]
  const index = newSelection.indexOf(value)
  
  if (index > -1) {
    newSelection.splice(index, 1)
  } else {
    // Check if item is in any group
    const inGroup = groups.value.some(group => group.items.includes(value))
    if (inGroup) {
      ElMessage.warning('該項目已在分組中，請先從分組中移除')
      return
    }
    
    // Check max selection limit
    if (props.maxSelection && newSelection.length >= props.maxSelection) {
      ElMessage.warning(`最多只能選擇 ${props.maxSelection} 項`)
      return
    }
    newSelection.push(value)
  }
  
  tempSelectedValues.value = newSelection
}

const removeSelection = (value) => {
  tempSelectedValues.value = tempSelectedValues.value.filter(v => v !== value)
}

const selectAll = () => {
  const availableItems = filteredOptions.value
    .map(opt => opt.value)
    .filter(value => !isGroupItem(value))
    
  if (props.maxSelection && availableItems.length > props.maxSelection) {
    ElMessage.warning(`最多只能選擇 ${props.maxSelection} 項，將選擇前 ${props.maxSelection} 項`)
    const newSelection = [...new Set([
      ...tempSelectedValues.value,
      ...availableItems.slice(0, props.maxSelection)
    ])]
    tempSelectedValues.value = newSelection.slice(0, props.maxSelection)
  } else {
    const newSelection = [...new Set([...tempSelectedValues.value, ...availableItems])]
    tempSelectedValues.value = newSelection
  }
  
  // Show feedback for large selections
  if (availableItems.length > 100) {
    ElMessage.success(`已選擇 ${Math.min(availableItems.length, props.maxSelection || availableItems.length)} 項`)
  }
}

const clearAll = () => {
  tempSelectedValues.value = []
}

const selectTop10 = () => {
  const top10Values = filteredOptions.value
    .slice(0, 10)
    .map(opt => opt.value)
    .filter(value => !isGroupItem(value))
    
  const newSelection = [...new Set([...tempSelectedValues.value, ...top10Values])]
  
  if (props.maxSelection && newSelection.length > props.maxSelection) {
    tempSelectedValues.value = newSelection.slice(0, props.maxSelection)
    ElMessage.warning(`已達到最大選擇數量 ${props.maxSelection}`)
  } else {
    tempSelectedValues.value = newSelection
  }
}

const resetDefault = () => {
  if (props.defaultValues) {
    tempSelectedValues.value = [...props.defaultValues]
  }
}

const getLabelByValue = (value) => {
  const option = props.options.find(opt => opt.value === value)
  return option ? option.label : value
}

// Group management
const createGroup = () => {
  if (!newGroupName.value.trim()) return
  
  const groupId = `group_${Date.now()}`
  groups.value.push({
    id: groupId,
    name: newGroupName.value.trim(),
    items: []
  })
  newGroupName.value = ''
  ElMessage.success('分組創建成功')
}

// 直接刪除分組（無確認對話框）
const deleteGroupDirect = (groupId) => {
  const groupIndex = groups.value.findIndex(g => g.id === groupId)
  if (groupIndex > -1) {
    // Add group items back to individual selection
    const groupItems = groups.value[groupIndex].items
    tempSelectedValues.value = [...new Set([...tempSelectedValues.value, ...groupItems])]
    
    groups.value.splice(groupIndex, 1)
    ElMessage.success('分組已刪除')
  }
}

// 帶確認對話框的刪除分組
const deleteGroup = (groupId) => {
  ElMessageBox.confirm('確定要刪除這個分組嗎？', '確認刪除', {
    type: 'warning',
    confirmButtonText: '確認刪除',
    cancelButtonText: '取消'
  })
  .then(() => {
    deleteGroupDirect(groupId)
  })
  .catch((error) => {
    // User cancelled or error occurred
    if (error !== 'cancel') {
      console.error('刪除分組時發生錯誤:', error)
      ElMessage.error('刪除分組失敗')
    }
  })
}

const editGroup = (group) => {
  editingGroupId.value = group.id
  editingGroupName.value = group.name
  editGroupDialogVisible.value = true
}

const confirmEditGroup = () => {
  if (!editingGroupName.value.trim()) return
  
  const group = groups.value.find(g => g.id === editingGroupId.value)
  if (group) {
    group.name = editingGroupName.value.trim()
    ElMessage.success('分組名稱已更新')
  }
  
  editGroupDialogVisible.value = false
  editingGroupName.value = ''
  editingGroupId.value = ''
}

const addToGroup = () => {
  if (tempSelectedValues.value.length === 0) return
  
  // 調試：檢查 groups 數據
  console.log('📋 Current groups:', groups.value)
  console.log('📋 Props selectedGroups:', props.selectedGroups)
  
  addToGroupDialogVisible.value = true
}

const confirmAddToGroup = () => {
  let targetGroupId = selectedGroupId.value
  
  // Create new group if specified
  if (newGroupNameForAdd.value.trim()) {
    targetGroupId = `group_${Date.now()}`
    groups.value.push({
      id: targetGroupId,
      name: newGroupNameForAdd.value.trim(),
      items: []
    })
  }
  
  if (!targetGroupId) {
    ElMessage.warning('請選擇分組或輸入新分組名稱')
    return
  }
  
  const targetGroup = groups.value.find(g => g.id === targetGroupId)
  if (targetGroup) {
    // Add selected items to group
    targetGroup.items = [...new Set([...targetGroup.items, ...tempSelectedValues.value])]
    
    // Remove from individual selection
    tempSelectedValues.value = []
    
    ElMessage.success(`已添加到分組 "${targetGroup.name}"`)
  }
  
  addToGroupDialogVisible.value = false
  selectedGroupId.value = ''
  newGroupNameForAdd.value = ''
}

const removeFromGroup = (groupId, item) => {
  const group = groups.value.find(g => g.id === groupId)
  if (group) {
    group.items = group.items.filter(i => i !== item)
    // Add back to individual selection
    tempSelectedValues.value = [...tempSelectedValues.value, item]
  }
}

const getTotalSelectionCount = () => {
  const individualCount = tempSelectedValues.value.filter(v => !isGroupItem(v)).length
  const groupItemsCount = groups.value.reduce((total, group) => total + group.items.length, 0)
  return individualCount + groupItemsCount
}

const handleConfirm = () => {
  const finalSelection = {
    individualItems: tempSelectedValues.value.filter(v => !isGroupItem(v)),
    groups: groups.value.filter(g => g.items.length > 0)
  }
  
  emit('confirm', finalSelection)
  visible.value = false
}

const handleCancel = () => {
  emit('cancel')
  visible.value = false
}

const getEmptyStateDescription = () => {
  if (searchKeyword.value) {
    return '未找到匹配項目'
  } else if (props.options.length === 0) {
    return '暫無可選項目 - 數據可能還在載入中'
  } else {
    return '暫無項目'
  }
}

const handleClose = (done) => {
  ElMessageBox.confirm('確定要關閉嗎？未確認的更改將會丟失。')
    .then(() => {
      done()
    })
    .catch(() => {
      // User cancelled closing
    })
}

// Drag and drop functionality for sorting
const draggedItem = ref(null)
const draggedGroupId = ref(null)

const onDragStart = (event, value) => {
  draggedItem.value = value
  event.dataTransfer.effectAllowed = 'move'
  event.target.style.opacity = '0.5'
}

const onGroupDragStart = (event, groupId) => {
  draggedGroupId.value = groupId
  event.dataTransfer.effectAllowed = 'move'
  event.target.style.opacity = '0.5'
}

const onDragOver = (event) => {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
}

const onDrop = (event, targetValue) => {
  event.preventDefault()
  
  if (!draggedItem.value || draggedItem.value === targetValue) {
    return
  }
  
  // 重新排序 tempSelectedValues
  const filteredItems = tempSelectedValues.value.filter(v => !isGroupItem(v))
  const draggedIndex = filteredItems.indexOf(draggedItem.value)
  const targetIndex = filteredItems.indexOf(targetValue)
  
  if (draggedIndex > -1 && targetIndex > -1) {
    // 移除拖拽的項目
    filteredItems.splice(draggedIndex, 1)
    // 插入到目標位置
    filteredItems.splice(targetIndex, 0, draggedItem.value)
    
    // 更新 tempSelectedValues，保留分組項目
    const groupItems = tempSelectedValues.value.filter(v => isGroupItem(v))
    tempSelectedValues.value = [...filteredItems, ...groupItems]
  }
  
  // 重置拖拽狀態
  draggedItem.value = null
  event.target.style.opacity = '1'
}

const onGroupDrop = (event, targetGroupId) => {
  event.preventDefault()
  
  if (!draggedGroupId.value || draggedGroupId.value === targetGroupId) {
    return
  }
  
  // 重新排序 groups 數組
  const draggedIndex = groups.value.findIndex(g => g.id === draggedGroupId.value)
  const targetIndex = groups.value.findIndex(g => g.id === targetGroupId)
  
  if (draggedIndex > -1 && targetIndex > -1) {
    // 移除拖拽的分組
    const draggedGroup = groups.value.splice(draggedIndex, 1)[0]
    // 插入到目標位置
    groups.value.splice(targetIndex, 0, draggedGroup)
  }
  
  // 重置拖拽狀態
  draggedGroupId.value = null
  event.target.style.opacity = '1'
}

// Cleanup on unmount
onUnmounted(() => {
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value)
  }
})
</script>

<style scoped>
.multi-select-drawer {
  --el-drawer-padding-primary: 0px;
  z-index: 3000 !important;
}

.multi-select-drawer :deep(.el-drawer) {
  border-radius: 12px 12px 0 0;
  z-index: 3000 !important;
}

.multi-select-drawer :deep(.el-overlay) {
  z-index: 2999 !important;
}

.multi-select-drawer :deep(.el-drawer__header) {
  background-color: #1f2937 !important;
  background: #1f2937 !important;
  color: #000000 !important;
  padding: 20px 24px !important;
  margin-bottom: 0 !important;
  border-radius: 12px 12px 0 0 !important;
}

.multi-select-drawer :deep(.el-drawer__header .el-drawer__title) {
  color: #000000 !important;
}

.multi-select-drawer :deep(.custom-header) {
  background-color: #1f2937 !important;
  color: #000000 !important;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.multi-select-drawer :deep(.custom-header h4) {
  color: #000000 !important;
  margin: 0;
  font-weight: bold;
}

.multi-select-drawer :deep(.el-drawer__title) {
  color: #000000 !important;
  font-weight: bold;
}

.multi-select-drawer :deep(.el-drawer__close-btn) {
  color: white !important;
}

.multi-select-drawer :deep(.el-drawer__close-btn):hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

/* 更強制的header樣式 */
.el-drawer__header {
  background: #1f2937 !important;
  background-color: #1f2937 !important;
}

.multi-select-drawer .el-drawer__header {
  background: #1f2937 !important;
  background-color: #1f2937 !important;
}

.custom-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.custom-header h4 {
  color: white;
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.close-btn {
  color: white !important;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
}

.drawer-content {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px);
  gap: 20px;
  padding: 24px;
  overflow: hidden;
}

.search-section {
  flex-shrink: 0;
}

.search-input {
  width: 100%;
}

.main-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-tabs :deep(.el-tabs__content) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-tabs :deep(.el-tab-pane) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.actions-section {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  flex-shrink: 0;
  margin-bottom: 16px;
}

.selection-info {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
  margin-bottom: 16px;
}

.options-container {
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: white;
  min-height: 300px;
  max-height: none;
  position: relative;
}

.performance-info {
  position: sticky;
  top: 0;
  background: white;
  padding: 8px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  z-index: 10;
}

.loading-skeleton {
  padding: 0;
}

.skeleton-item {
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.load-more-hint {
  text-align: center;
  padding: 16px;
  color: var(--el-text-color-secondary);
  background: var(--el-bg-color-page);
  border-top: 1px solid var(--el-border-color-lighter);
}

.option-item {
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.option-item:hover {
  background-color: var(--el-bg-color-page);
}

.option-item.selected {
  background-color: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-7);
}

.option-item:last-child {
  border-bottom: none;
}

.option-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.option-label {
  flex: 1;
  font-size: 16px;
}

.option-count {
  color: var(--el-text-color-secondary);
  font-size: 14px;
  margin-left: auto;
}

/* Group Management */
.group-management {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  overflow: hidden;
}

.group-create {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.groups-list {
  flex: 1;
  overflow-y: auto;
}

.group-item {
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  background: var(--el-bg-color-overlay);
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.group-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.group-count {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.group-actions {
  display: flex;
  gap: 8px;
}

.group-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.group-item-tag {
  margin: 2px;
}

/* Final Preview */
.final-preview {
  flex-shrink: 0;
  border-top: 1px solid var(--el-border-color-light);
  padding-top: 20px;
  max-height: 250px;
  overflow-y: auto;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 16px;
  font-weight: 500;
}

.individual-items,
.groups-preview {
  margin-bottom: 16px;
}

.individual-items h4,
.groups-preview h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.selected-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.selected-tag {
  margin: 2px;
}

/* Sortable tags styling */
.sortable-tag {
  cursor: move;
  user-select: none;
  transition: all 0.3s ease;
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.sortable-tag:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.sortable-tag.first-priority {
  background: linear-gradient(135deg, #FFD700, #FFA500) !important;
  color: #000 !important;
  font-weight: bold;
  border: 2px solid #FFD700 !important;
}

.priority-indicator {
  font-size: 14px;
  margin-right: 2px;
}

.priority-number {
  font-weight: bold;
  color: #666;
  margin-right: 4px;
}

.first-priority .priority-number {
  color: #000;
}

.sort-hint {
  margin-top: 8px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  border-left: 3px solid #409eff;
}

.group-tag {
  font-weight: 500;
}

/* 分組的第一優先級特殊樣式 */
.group-tag.first-priority {
  background: linear-gradient(135deg, #FF6B35, #F7931E) !important;
  color: white !important;
  font-weight: bold;
  border: 2px solid #FF6B35 !important;
  box-shadow: 0 4px 16px rgba(255, 107, 53, 0.4);
}

/* Action Buttons */
.action-buttons {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-light);
}

/* Custom scrollbar */
.options-container::-webkit-scrollbar,
.groups-list::-webkit-scrollbar,
.final-preview::-webkit-scrollbar {
  width: 8px;
}

.options-container::-webkit-scrollbar-track,
.groups-list::-webkit-scrollbar-track,
.final-preview::-webkit-scrollbar-track {
  background: var(--el-bg-color-page);
}

.options-container::-webkit-scrollbar-thumb,
.groups-list::-webkit-scrollbar-thumb,
.final-preview::-webkit-scrollbar-thumb {
  background: var(--el-border-color);
  border-radius: 4px;
}

.options-container::-webkit-scrollbar-thumb:hover,
.groups-list::-webkit-scrollbar-thumb:hover,
.final-preview::-webkit-scrollbar-thumb:hover {
  background: var(--el-border-color-dark);
}

/* Dialog z-index 修復 */
.multi-select-drawer :deep(.el-dialog) {
  z-index: 3100 !important;
}

.multi-select-drawer :deep(.el-dialog__wrapper) {
  z-index: 3100 !important;
}

/* 確保 dialog 中的 select 下拉選單有足夠高的 z-index */
.multi-select-drawer :deep(.el-select-dropdown) {
  z-index: 3200 !important;
}

/* 如果上面的方式不生效，使用全域樣式 */
.el-select-dropdown.el-popper {
  z-index: 3200 !important;
}

.el-select-dropdown {
  z-index: 3200 !important;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .drawer-content {
    padding: 16px;
    gap: 16px;
  }
  
  .actions-section {
    gap: 8px;
  }
  
  .actions-section .el-button {
    font-size: 12px;
    padding: 6px 12px;
  }
}

/* 分組選擇標籤樣式 */
.existing-groups-selection {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
  background: var(--el-bg-color-page);
  border-radius: 8px;
  border: 1px solid var(--el-border-color-lighter);
}

.group-selection-tag {
  transition: all 0.2s ease;
  user-select: none;
  min-height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.group-selection-tag:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.group-selection-tag .el-icon {
  margin-right: 4px;
}
</style>