// 為生產環境建立簡易的數據載入API
export const scanDatasets = async () => {
  try {
    const response = await fetch('/datasets.json')
    if (response.ok) {
      return await response.json()
    }
  } catch (error) {
    console.warn('無法載入datasets.json，使用預設列表')
  }
  
  // 預設數據集列表
  return [
    'CGED-Q Public Release 1760-1798  1 Jul 2024.csv',
    'CGED-Q Public Release 1850-1864 19 Apr 2022.csv'
  ]
}