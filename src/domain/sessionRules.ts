/**
 * 数值与文本约束。集中在此，避免散落在 UI 与存储层。
 */

/**
 * 座位编号的取值范围：0=自己、1=上家、2=对家、3=下家。
 *
 * 注意这是**编号空间**的大小，不是「每场必须记录几条结果」——
 * 一场可以只记录其中 1～4 个位置，seat 0 必须记录。
 */
export const SEAT_COUNT = 4
export const SEAT_SELF = 0

/** 本人默认昵称。 */
export const DEFAULT_SELF_NICKNAME = '我'

/** 标题去除首尾空白后最多 30 字；空白时使用该默认标题。 */
export const DEFAULT_TITLE = '麻将对局'
export const MAX_TITLE_LENGTH = 30

/** 备注可选，最多 100 字。 */
export const MAX_NOTE_LENGTH = 100

/** 麻友昵称去除首尾空白后 1～12 字。 */
export const MIN_NICKNAME_LENGTH = 1
export const MAX_NICKNAME_LENGTH = 12

/** 全库上限：1,000 场、5,000 个麻友（含归档）。 */
export const MAX_SESSIONS = 1000
export const MAX_FRIENDS = 5000

/**
 * 按 Unicode 码点计数，避免把 emoji 等代理对算成两个字，
 * 使「最多 N 字」对所有输入都成立。
 */
export function textLength(text: string): number {
  return [...text].length
}

/**
 * 这个标题是不是「占位默认名」，也就是用户从来没有起过标题。
 *
 * 界面据此决定这一行还要不要显示标题——每行都重复一句「麻将对局」只是噪音。
 */
export function isPlaceholderTitle(title: string): boolean {
  return title.trim().length === 0 || title === DEFAULT_TITLE
}

/** 座位名称：自己 / 上家 / 对家 / 下家。 */
export function seatLabel(seat: number): string {
  if (seat === SEAT_SELF) return '自己'
  if (seat === 1) return '上家'
  if (seat === 2) return '对家'
  return '下家'
}
