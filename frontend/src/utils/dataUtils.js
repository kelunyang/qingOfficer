// 數據處理工具函數

/**
 * 標準化出身分類
 * - 如果出身一有值，返回出身一
 * - 如果出身一為空但旗分有值，返回"沒考試的旗人"
 * - 其他情況返回"(無出身記錄)"
 */
export const getStandardizedBackground = (record) => {
  const background = record.出身一 ? record.出身一.trim() : ''
  const banner = record.旗分 ? record.旗分.trim() : ''
  
  if (background) {
    return background
  } else if (banner) {
    return '沒考試的旗人'
  } else {
    return '(無出身記錄)'
  }
}

/**
 * 檢查是否為旗人（有旗分記錄）
 */
export const isBannerPerson = (record) => {
  return Boolean(record.旗分 && record.旗分.trim())
}

/**
 * 檢查是否為考試出身（有出身一記錄）
 */
export const hasExamBackground = (record) => {
  return Boolean(record.出身一 && record.出身一.trim())
}

/**
 * 獲取顯示用的出身標籤（包含顏色提示）
 */
export const getBackgroundLabel = (record) => {
  const standardizedBg = getStandardizedBackground(record)
  const isBanner = isBannerPerson(record)
  const hasExam = hasExamBackground(record)
  
  return {
    text: standardizedBg,
    type: hasExam ? 'success' : (isBanner ? 'warning' : 'info'),
    description: hasExam ? '考試出身' : (isBanner ? '旗人無考試' : '無記錄')
  }
}