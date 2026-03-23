/** Data Dragon 解析后的英雄展示信息 */
export interface ChampionDisplay {
  id: number
  key: string
  /** 官方本地化名称（如 zh_CN） */
  name: string
  /** 国服别名，用于检索 */
  aliases: readonly string[]
}
