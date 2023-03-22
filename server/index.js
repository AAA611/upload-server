const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { promisify } = require('util')

const app = express()

// 允许跨域请求
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Credentials', true)
  next()
})

const writeFileAsync = promisify(fs.writeFile)
const unlinkAsync = promisify(fs.unlink)

// 设置文件存储路径和文件名
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  },
})

// 创建一个 multer 实例
const upload = multer({ storage: storage })

let curReciveCount = 0
// 分块上传
app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file
  const chunkIndex = req.body.chunkIndex
  const chunkCount = req.body.chunkCount
  const originalFileName = req.body.originalFileName
  const filePath = path.join(file.destination, originalFileName)

  // 将块写入临时文件
  const tempFilePath = `${filePath}.${chunkIndex}`
  await writeFileAsync(tempFilePath, fs.readFileSync(file.path))

  // 已经接受到的chunk数量
  // TODO:这里写法需要改进，改成客户端发起over请求时再开始合并文件
  curReceiveCount++

  // 检查是否接收到所有块，如果是，则重新组装它们并保存到磁盘上。
  if (curReceiveCount == chunkCount) {
    const ws = fs.createWriteStream(filePath)
    for (let i = 0; i < chunkCount; i++) {
      const rs = fs.createReadStream(`${filePath}.${i}`)
      rs.pipe(ws, { end: false })
      rs.on('end', async () => {
        await unlinkAsync(`${filePath}.${i}`)
        if (i === chunkCount - 1) {
          ws.end(() => {
            res.send('File uploaded successfully!')
            // 全部接受并且拼装完毕，将curReceiveCount置为0
            curReceiveCount = 0
          })
        }
      })
    }
  } else {
    res.send(`Chunk ${chunkIndex} uploaded successfully!`)
  }
})

// 启动服务器
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})
