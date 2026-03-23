/** 英雄方图（列表小头像） */
export function championSquareImgUrl(ddragonVersion: string, imageKey: string): string {
  return `https://ddragon.leagueoflegends.com/cdn/${ddragonVersion}/img/champion/${imageKey}.png`
}

/** 默认皮肤立绘（splash） */
export function championSplashUrl(imageKey: string, skinIndex = 0): string {
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${imageKey}_${skinIndex}.jpg`
}

/** Data Dragon 英雄 id（如 LeeSin、KSante）→ 易读的英文展示（Lee Sin、K Sante） */
export function formatChampionSlugDisplay(slug: string): string {
  return slug.replace(/([a-z\d])([A-Z])/g, '$1 $2')
}
