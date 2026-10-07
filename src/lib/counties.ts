// 縣市由北到南排序（西部由北至南，接著東部宜蘭→花蓮→臺東，最後離島）
export const COUNTIES = [
  "基隆市", "臺北市", "新北市", "桃園市", "新竹市", "新竹縣", "苗栗縣", "臺中市", "彰化縣", "南投縣", "雲林縣",
  "嘉義市", "嘉義縣", "臺南市", "高雄市", "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "澎湖縣", "金門縣", "連江縣",
];

export function countyRank(c: string): number {
  const i = COUNTIES.indexOf(c);
  return i === -1 ? COUNTIES.length : i;
}
