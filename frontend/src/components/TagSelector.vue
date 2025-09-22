<template>
  <div class="tag-selector-container">
    <el-button 
      @click="drawerVisible = true" 
      size="small" 
      type="primary" 
      plain
      :icon="Setting"
    >
      {{ buttonText }}
    </el-button>
    
    <MultiSelectDrawer
      v-model="drawerVisible"
      :title="`${chartTitle} - 統計值選擇`"
      :options="drawerOptions"
      :selectedValues="currentSelectedValues"
      :selectedGroups="currentSelectedGroups"
      :defaultValues="defaultSelection"
      @confirm="handleDrawerConfirm"
      @cancel="handleDrawerCancel"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Setting } from '@element-plus/icons-vue'
import MultiSelectDrawer from './MultiSelectDrawer.vue'

const props = defineProps({
  chartTitle: {
    type: String,
    default: '圖表'
  },
  buttonText: {
    type: String,
    default: '勾選統計值'
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
  },
  // 新增分組支持
  groups: {
    type: Array,
    default: () => []
    // 格式: [{ id: 'id', name: 'name', items: ['value1', 'value2'] }]
  }
})

const emit = defineEmits(['update:modelValue', 'selection-changed', 'update:groups'])

const drawerVisible = ref(false)

// 轉換 options 為 MultiSelectDrawer 格式
const drawerOptions = computed(() => {
  return props.options.map(option => ({
    label: option.label,
    value: option.key,
    count: option.count // 如果有人數統計
  }))
})

// 當前選中的個別項目（不包含分組項目）
const currentSelectedValues = computed(() => {
  // 過濾掉已經在分組中的項目
  const groupedItems = new Set()
  props.groups.forEach(group => {
    group.items.forEach(item => groupedItems.add(item))
  })
  return props.modelValue.filter(item => !groupedItems.has(item))
})

// 當前的分組
const currentSelectedGroups = computed(() => {
  return props.groups
})

// 處理 drawer 確認
const handleDrawerConfirm = (selection) => {
  console.log('📋 TagSelector - 收到選擇:', selection)
  
  // 更新個別項目
  const newModelValue = [...selection.individualItems]
  
  // 更新分組並將分組項目也加入到 modelValue 中
  const newGroups = [...selection.groups]
  newGroups.forEach(group => {
    newModelValue.push(...group.items)
  })
  
  emit('update:modelValue', newModelValue)
  emit('update:groups', newGroups)
  
  // 發送變化事件
  emit('selection-changed', newModelValue, newGroups, 'confirm')
}

// 處理 drawer 取消
const handleDrawerCancel = () => {
  console.log('📋 TagSelector - 用戶取消選擇')
}

// 監聽外部值變化
watch(() => props.modelValue, (newValue) => {
  console.log('📋 TagSelector - modelValue 變化:', newValue)
}, { deep: true })

// 監聽分組變化
watch(() => props.groups, (newGroups) => {
  console.log('📋 TagSelector - groups 變化:', newGroups)
}, { deep: true })

// 監聽 drawer 的顯示/隱藏
watch(drawerVisible, (newVal) => {
  console.log(`📋 TagSelector - drawer ${newVal ? '打開' : '關閉'}`, {
    currentGroups: props.groups.length,
    groupsData: props.groups
  })
})

// 監聽選項變化
watch(() => props.options, () => {
  console.log('📋 TagSelector - options 變化，項目數:', props.options.length)
}, { deep: true })
</script>

<style scoped>
.tag-selector-container {
  display: inline-block;
}
</style>