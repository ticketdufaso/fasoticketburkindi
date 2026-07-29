/**
 * Script de nettoyage des console.log dans le code source
 * Règles NASA 1, 4, 5, 6
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SRC_DIR = path.join(__dirname, '../src')
const EXCLUDED_DIRS = ['node_modules', 'dist', '.git', '.vite', '.husky']
const ALLOWED_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx']

const CONSOLE_PATTERNS = [
  /console\.log\([^;]*\);?/g,
  /console\.debug\([^;]*\);?/g,
  /console\.info\([^;]*\);?/g,
  /console\.warn\([^;]*\);?/g,
  /console\.error\([^;]*\);?/g,
  /console\.trace\([^;]*\);?/g,
  /console\.group\([^;]*\);?/g,
  /console\.groupEnd\([^;]*\);?/g,
  /console\.groupCollapsed\([^;]*\);?/g,
  /console\.time\([^;]*\);?/g,
  /console\.timeEnd\([^;]*\);?/g,
  /console\.timeLog\([^;]*\);?/g,
  /console\.count\([^;]*\);?/g,
  /console\.countReset\([^;]*\);?/g,
  /console\.table\([^;]*\);?/g,
  /console\.dir\([^;]*\);?/g,
  /console\.dirxml\([^;]*\);?/g,
  /console\.assert\([^;]*\);?/g,
  /console\.clear\([^;]*\);?/g,
  /console\.profile\([^;]*\);?/g,
  /console\.profileEnd\([^;]*\);?/g
]

let stats = {
  filesScanned: 0,
  filesModified: 0,
  totalRemoved: 0,
  details: []
}

const scanDirectory = (directory) => {
  if (!fs.existsSync(directory)) return
  
  const items = fs.readdirSync(directory)
  
  for (const item of items) {
    const fullPath = path.join(directory, item)
    const stat = fs.statSync(fullPath)
    
    if (stat.isDirectory()) {
      if (EXCLUDED_DIRS.includes(item)) continue
      scanDirectory(fullPath)
    } else {
      const ext = path.extname(item)
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        processFile(fullPath)
      }
    }
  }
}

const processFile = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    let modifiedContent = content
    let removedCount = 0
    let hasChanges = false
    
    for (const pattern of CONSOLE_PATTERNS) {
      const matches = modifiedContent.match(pattern)
      if (matches) {
        removedCount += matches.length
        modifiedContent = modifiedContent.replace(pattern, '')
        hasChanges = true
      }
    }
    
    if (hasChanges) {
      modifiedContent = modifiedContent.replace(/^\s*[\r\n]/gm, '')
      modifiedContent = modifiedContent.replace(/[ \t]+$/gm, '')
      
      fs.writeFileSync(filePath, modifiedContent, 'utf8')
      
      stats.filesModified++
      stats.totalRemoved += removedCount
      stats.details.push({
        path: filePath,
        removed: removedCount
      })
      
      console.log(`🧹 Nettoyé: ${path.basename(filePath)} (${removedCount} logs supprimés)`)
    }
    
    stats.filesScanned++
    
  } catch (error) {
    console.error(`❌ Erreur sur ${filePath}:`, error.message)
  }
}

const main = () => {
  console.log('🧹 Nettoyage des console.log dans le code source...')
  console.log('')
  
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`❌ Dossier src non trouvé: ${SRC_DIR}`)
    process.exit(1)
  }
  
  scanDirectory(SRC_DIR)
  
  console.log('')
  console.log('📊 RÉSUMÉ:')
  console.log(`   📁 Fichiers scannés: ${stats.filesScanned}`)
  console.log(`   ✏️ Fichiers modifiés: ${stats.filesModified}`)
  console.log(`   🗑️ Logs supprimés: ${stats.totalRemoved}`)
  console.log('')
  console.log('✅ Nettoyage terminé !')
}

main()