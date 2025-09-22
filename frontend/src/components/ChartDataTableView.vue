<template>
  <el-drawer
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    :title="`${title} - 文字版數據`"
    direction="rtl"
    size="80%"
    @close="$emit('close')"
  >
    <div class="table-view-container">
      <div class="table-controls">
        <el-button
          type="success"
          @click="exportCSV"
          :disabled="!tableData.length"
        >
          <el-icon><Download /></el-icon>
          輸出CSV
        </el-button>
        <el-tag type="info" size="small">
          共 {{ tableData.length }} 行數據
        </el-tag>
      </div>
      
      <el-table
        :data="tableData"
        border
        stripe
        height="calc(100vh - 200px)"
        :default-sort="{ prop: 'total', order: 'descending' }"
      >
        <el-table-column
          v-for="column in columns"
          :key="column.prop"
          :prop="column.prop"
          :label="column.label"
          :width="column.width"
          :sortable="column.sortable !== false"
          :formatter="column.formatter"
        />
      </el-table>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '圖表數據'
  },
  data: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['close', 'update:visible'])

const tableData = computed(() => props.data)

// 輸出帶BOM的CSV
const exportCSV = () => {
  if (!tableData.value.length || !props.columns.length) {
    ElMessage.error('沒有數據可以輸出')
    return
  }

  try {
    // 創建CSV內容
    const headers = props.columns.map(col => col.label)
    const csvRows = [headers.join(',')]
    
    tableData.value.forEach(row => {
      const values = props.columns.map(col => {
        let value = row[col.prop]
        
        // 如果有格式化函數，使用它
        if (col.formatter && typeof col.formatter === 'function') {
          value = col.formatter(row, col, value)
        }
        
        // 處理包含逗號、引號或換行的值
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          value = `"${value.replace(/"/g, '""')}"`
        }
        
        return value || ''
      })
      csvRows.push(values.join(','))
    })
    
    const csvContent = csvRows.join('\n')
    
    // 添加BOM以支持中文
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8' })
    
    // 創建下載連結
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    
    // 生成檔名
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
    link.download = `${props.title}_數據表_${timestamp}.csv`
    
    // 觸發下載
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // 清理URL對象
    URL.revokeObjectURL(url)
    
    ElMessage.success('CSV文件已下載')
  } catch (error) {
    console.error('CSV導出錯誤:', error)
    ElMessage.error('CSV導出失敗')
  }
}
</script>

<style scoped>
.table-view-container {
  padding: 20px;
}

.table-controls {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid #e4e7ed;
}

:deep(.el-table) {
  font-size: 12px;
}

:deep(.el-table th) {
  background-color: #f5f7fa;
  font-weight: 600;
}

:deep(.el-table .cell) {
  padding-left: 8px;
  padding-right: 8px;
}
</style>