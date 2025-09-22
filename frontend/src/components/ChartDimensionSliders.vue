<template>
  <div class="chart-dimension-sliders">
    <div class="slider-group">
      <label class="slider-label">寬度: {{ width }}px</label>
      <el-slider 
        v-model="width" 
        :min="minWidth" 
        :max="maxWidth" 
        :step="10"
        @change="handleWidthChange"
        size="small"
      />
    </div>
    <div class="slider-group">
      <label class="slider-label">高度: {{ height }}px</label>
      <el-slider 
        v-model="height" 
        :min="minHeight" 
        :max="maxHeight" 
        :step="10"
        @change="handleHeightChange"
        size="small"
      />
    </div>
    <el-button 
      @click="resetDimensions" 
      size="small" 
      type="info" 
      plain
      style="margin-top: 10px"
    >
      重置尺寸
    </el-button>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  defaultWidth: {
    type: Number,
    default: 600
  },
  defaultHeight: {
    type: Number,
    default: 500
  },
  minWidth: {
    type: Number,
    default: 400
  },
  maxWidth: {
    type: Number,
    default: 1200
  },
  minHeight: {
    type: Number,
    default: 300
  },
  maxHeight: {
    type: Number,
    default: 800
  }
})

const emit = defineEmits(['dimensions-changed'])

const width = ref(props.defaultWidth)
const height = ref(props.defaultHeight)

const handleWidthChange = () => {
  emit('dimensions-changed', { width: width.value, height: height.value })
}

const handleHeightChange = () => {
  emit('dimensions-changed', { width: width.value, height: height.value })
}

const resetDimensions = () => {
  width.value = props.defaultWidth
  height.value = props.defaultHeight
  emit('dimensions-changed', { width: width.value, height: height.value })
}
</script>

<style scoped>
.chart-dimension-sliders {
  background: #f5f7fa;
  border-radius: 4px;
  padding: 15px;
  margin: 10px 0;
}

.slider-group {
  margin-bottom: 15px;
}

.slider-label {
  display: block;
  font-size: 12px;
  color: #606266;
  margin-bottom: 5px;
}

.slider-group :deep(.el-slider) {
  margin: 0 10px;
}
</style>