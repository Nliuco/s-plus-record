/**
 * 将 build/icon.png 裁成方形并生成 build/icon.ico（供 electron-builder Windows 打包）。
 * 更换素材后执行：npm run icon:build
 */
import { renameSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pngPath = join(root, 'build', 'icon.png')
const tmpPath = join(root, 'build', 'icon.tmp.png')
const icoPath = join(root, 'build', 'icon.ico')

await sharp(pngPath).resize(512, 512, { fit: 'cover', position: 'centre' }).png().toFile(tmpPath)
renameSync(tmpPath, pngPath)
writeFileSync(icoPath, await pngToIco(pngPath))
console.log('Wrote', icoPath)
