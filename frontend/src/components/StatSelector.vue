<template>
  <div class="stat-selector-container">
    <el-button 
      @click="visible = true" 
      size="small" 
      type="primary" 
      plain
      :icon="Setting"
    >
      勾選統計值
    </el-button>
    
    <el-drawer
      v-model="visible"
      :title="`${chartTitle} - 統計值選擇`"
      direction="btt"
      size="100%"
      :with-header="true"
    >
      <div class="drawer-content">
        <div class="description">
          <el-alert
            :title="`選擇要在 ${chartTitle} 中顯示的統計分組：`"
            type="info"
            :closable="false"
            show-icon
          />
        </div>
        
        <div class="transfer-container">
          <el-transfer
            v-model="selectedValues"
            :data="availableOptions"
            :titles="['可用統計值', '已選統計值']"
            :button-texts="['移除', '添加']"
            :format="{
              noChecked: '${total}',
              hasChecked: '${checked}/${total}'
            }"
            filterable
            :filter-placeholder="'搜尋統計值'"
            @change="handleSelectionChange"
          />
        </div>
        
        <div class="actions">
          <el-button @click="selectAll" size="small">全選</el-button>
          <el-button @click="clearAll" size="small">清空</el-button>
          <el-button @click="resetDefault" size="small" type="primary">重置預設</el-button>
        </div>
        
        <div class="preview">
          <el-tag 
            v-for="value in selectedValues" 
            :key="value"
            size="small"
            style="margin: 2px;"
            :color="getTagColor(value)"
          >
            {{ getOptionLabel(value) }}
          </el-tag>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Setting } from '@element-plus/icons-vue'

const props = defineProps({
  chartTitle: {
    type: String,
    default: '圖表'
  },
  options: {
    type: Array,
    required: true,
    // 格式: [{ key: 'value', label: 'Display Name' }]
  },
  modelValue: {
    type: Array,
    default: () => []
  },
  defaultSelection: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:modelValue', 'selection-changed'])

const visible = ref(false)
const selectedValues = ref([...props.modelValue])

// 轉換 options 為 el-transfer 需要的格式
const availableOptions = computed(() => {
  return props.options.map(option => ({
    key: option.key,
    label: option.label,
    disabled: false
  }))
})

// 獲取選項標籤
const getOptionLabel = (key) => {
  const option = props.options.find(opt => opt.key === key)
  return option ? option.label : key
}

// 獲取標籤顏色
const getTagColor = (key) => {
  const colors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399']
  const index = props.options.findIndex(opt => opt.key === key)
  return colors[index % colors.length]
}

// 處理選擇變化
const handleSelectionChange = (value, direction, movedKeys) => {
  emit('update:modelValue', selectedValues.value)
  emit('selection-changed', selectedValues.value, movedKeys, direction)
}

// 全選
const selectAll = () => {
  selectedValues.value = props.options.map(opt => opt.key)
  handleSelectionChange(selectedValues.value, 'right', [])
}

// 清空
const clearAll = () => {
  selectedValues.value = []
  handleSelectionChange(selectedValues.value, 'left', [])
}

// 重置為預設
const resetDefault = () => {
  selectedValues.value = [...props.defaultSelection]
  handleSelectionChange(selectedValues.value, 'reset', [])
}

// 監聽外部值變化
watch(() => props.modelValue, (newValue) => {
  selectedValues.value = [...newValue]
}, { deep: true })

// 監聽選項變化
watch(() => props.options, () => {
  // 清理無效的選擇
  const validKeys = props.options.map(opt => opt.key)
  selectedValues.value = selectedValues.value.filter(val => validKeys.includes(val))
}, { deep: true })
</script>

<style scoped>
.stat-selector-container {
  display: inline-block;
}

.drawer-content {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.description {
  margin-bottom: 20px;
  flex-shrink: 0;
}

.transfer-container {
  margin-bottom: 20px;
  flex-grow: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 500px;
}

.actions {
  margin-bottom: 15px;
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-shrink: 0;
}

.preview {
  border-top: 1px solid #e4e7ed;
  padding-top: 15px;
  max-height: 150px;
  overflow-y: auto;
  flex-shrink: 0;
}

:deep(.el-transfer) {
  width: 100%;
  max-width: 800px;
  
  .el-transfer-panel {
    width: 320px;
    height: 450px;
  }
  
  .el-transfer-panel__list {
    height: 350px;
    overflow-y: auto;
  }
  
  .el-transfer__buttons {
    padding: 0 15px;
  }
}
</style>