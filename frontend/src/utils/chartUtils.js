import * as d3 from 'd3'

// SVG export function
export const exportSVG = (svgElement, filename = 'chart.svg') => {
  if (!svgElement) return
  
  const svgData = new XMLSerializer().serializeToString(svgElement)
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)
  
  const downloadLink = document.createElement('a')
  downloadLink.href = svgUrl
  downloadLink.download = filename
  document.body.appendChild(downloadLink)
  downloadLink.click()
  document.body.removeChild(downloadLink)
  
  URL.revokeObjectURL(svgUrl)
}

// PNG export function
export const exportPNG = (svgElement, filename = 'chart.png', scale = 2) => {
  if (!svgElement) return
  
  return new Promise((resolve, reject) => {
    try {
      // 獲取SVG的尺寸
      const svgRect = svgElement.getBoundingClientRect()
      const svgData = new XMLSerializer().serializeToString(svgElement)
      
      // 創建canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      // 設置高解析度
      canvas.width = svgRect.width * scale
      canvas.height = svgRect.height * scale
      ctx.scale(scale, scale)
      
      // 設置白色背景
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, svgRect.width, svgRect.height)
      
      // 創建圖片對象
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0)
        
        // 轉換為PNG並下載
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob)
          const downloadLink = document.createElement('a')
          downloadLink.href = url
          downloadLink.download = filename
          document.body.appendChild(downloadLink)
          downloadLink.click()
          document.body.removeChild(downloadLink)
          URL.revokeObjectURL(url)
          resolve()
        }, 'image/png')
      }
      
      img.onerror = reject
      
      // 將SVG轉換為data URL
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      img.src = url
      
    } catch (error) {
      reject(error)
    }
  })
}

// Create SVG patterns for print mode
export const createPatterns = (svg) => {
  const defs = svg.append('defs')
  
  // Pattern definitions for grayscale printing
  const patterns = [
    { id: 'pattern1', path: 'M 0,4 l 4,4 M -1,1 l 2,2 M 3,7 l 2,2' },
    { id: 'pattern2', path: 'M 0,0 l 8,8 M -2,6 l 4,4 M 6,-2 l 4,4' },
    { id: 'pattern3', path: 'M 2,0 l 2,8 M 0,2 l 8,2' },
    { id: 'pattern4', path: 'M 0,8 l 8,-8 M -2,2 l 4,-4 M 6,10 l 4,-4' },
    { id: 'pattern5', path: 'M 4,0 l 0,8 M 0,4 l 8,0' },
    { id: 'pattern6', path: 'M 0,0 l 4,4 l 0,-4 l 4,4 l -4,0 l 4,4 l -8,0 l 0,-4 l 4,-4 l -4,0' },
    { id: 'dots', cx: 2, cy: 2, r: 1 },
    { id: 'diagonal1', path: 'M -1,1 l 2,2 M 0,8 l 8,-8 M 7,9 l 2,2' },
    { id: 'diagonal2', path: 'M -1,7 l 2,-2 M 0,0 l 8,8 M 7,-1 l 2,2' },
    { id: 'vertical', path: 'M 2,0 l 0,8' }
  ]
  
  patterns.forEach((pattern, index) => {
    const patternElement = defs.append('pattern')
      .attr('id', pattern.id)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 8)
      .attr('height', 8)
      .style('stroke', '#333')
      .style('stroke-width', 1)
      .style('fill', 'none')
    
    if (pattern.path) {
      patternElement.append('path').attr('d', pattern.path)
    } else if (pattern.id === 'dots') {
      patternElement.append('circle')
        .attr('cx', pattern.cx)
        .attr('cy', pattern.cy)
        .attr('r', pattern.r)
        .style('fill', '#333')
    }
  })
  
  return patterns.map(p => p.id)
}

// Get pattern fills for print mode
export const getPatternFills = () => [
  'url(#pattern1)', 'url(#pattern2)', 'url(#pattern3)', 'url(#pattern4)',
  'url(#pattern5)', 'url(#pattern6)', 'url(#dots)', 'url(#diagonal1)',
  'url(#diagonal2)', 'url(#vertical)'
]

// Create line patterns based on stroke width for Sankey diagrams
export const createLinePatterns = (svg) => {
  const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs')
  
  // Line pattern definitions based on thickness ranges
  const linePatterns = [
    { id: 'line-pattern-1', dashArray: '2,2', description: '最細線段 (< 2px)' },
    { id: 'line-pattern-2', dashArray: '4,2', description: '細線段 (2-5px)' },
    { id: 'line-pattern-3', dashArray: '6,3', description: '中等線段 (5-10px)' },
    { id: 'line-pattern-4', dashArray: '8,4', description: '粗線段 (10-20px)' },
    { id: 'line-pattern-5', dashArray: '10,5', description: '很粗線段 (20-40px)' },
    { id: 'line-pattern-6', dashArray: '12,6', description: '極粗線段 (> 40px)' }
  ]
  
  return linePatterns
}

// Get line pattern based on stroke width
export const getLinePatternByWidth = (strokeWidth) => {
  if (strokeWidth < 2) return 'line-pattern-1'
  if (strokeWidth < 5) return 'line-pattern-2'
  if (strokeWidth < 10) return 'line-pattern-3'
  if (strokeWidth < 20) return 'line-pattern-4'
  if (strokeWidth < 40) return 'line-pattern-5'
  return 'line-pattern-6'
}

// Get line pattern based on source stage (0-based)
export const getLinePatternByStage = (sourceStage) => {
  const stagePatterns = [
    'line-pattern-1', // 階段0：出身 -> 第一職位
    'line-pattern-2', // 階段1：第一職位 -> 第二職位
    'line-pattern-3', // 階段2：第二職位 -> 第三職位
    'line-pattern-4', // 階段3：第三職位 -> 第四職位
    'line-pattern-5', // 階段4：第四職位 -> 第五職位
    'line-pattern-6'  // 階段5+：更高階段
  ]
  return stagePatterns[Math.min(sourceStage, stagePatterns.length - 1)]
}

// Get grayscale colors
export const getGrayscaleColors = () => [
  '#000000', '#1a1a1a', '#333333', '#4d4d4d', '#666666',
  '#808080', '#999999', '#b3b3b3', '#cccccc', '#e6e6e6'
]

// Get available theme names
export const getThemeNames = () => Object.keys(colorThemes)

// Get theme by name
export const getTheme = (themeName) => colorThemes[themeName] || colorThemes.default

// 配色主題定義
export const colorThemes = {
  classic: {
    name: '經典配色',
    colors: ['#1565c0', '#c62828', '#2e7d32', '#f57c00', '#7b1fa2', '#5d4037', '#455a64', '#6a1b9a', '#0277bd', '#388e3c']
  },
  modern: {
    name: '現代配色',
    colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']
  },
  academic: {
    name: '學術配色',
    colors: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#8d99ae', '#ef233c', '#80b918', '#fb8500', '#023047']
  },
  soft: {
    name: '柔和配色',
    colors: ['#ffcdd2', '#f8bbd9', '#e1bee7', '#d1c4e9', '#c5cae9', '#bbdefb', '#b3e5fc', '#b2dfdb', '#c8e6c9', '#dcedc8']
  },
  contrast: {
    name: '對比配色',
    colors: ['#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a']
  },
  // 保留向後兼容
  default: {
    name: '預設配色',
    colors: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']
  }
}

// Get color scheme based on print mode and theme
export const getColorScheme = (printMode, usePatterns = true, theme = 'default') => {
  if (printMode) {
    return usePatterns ? getPatternFills() : getGrayscaleColors()
  }
  return colorThemes[theme]?.colors || colorThemes.default.colors
}