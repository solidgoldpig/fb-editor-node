
const server = require('@ministryofjustice/fb-runner-node/lib/server/server')

const adminRouter = require('../lib/admin/admin')

const postCachedRoutes = () => adminRouter

const path = require('path')
const fs = require('fs')
if (process.env.LOGDIR) {
  const serviceName = process.env.SERVICEDATA.replace(/\/$/, '').replace(/.*\//, '')
  const logdir = process.env.LOGDIR
  const accessLogPath = path.join(logdir, `${serviceName}.access.log`)
  const errorLogPath = path.join(logdir, `${serviceName}.error.log`)
  try {
    fs.unlinkSync(accessLogPath)
  } catch (e) {
    //
  }
  try {
    fs.unlinkSync(errorLogPath)
  } catch (e) {
    //
  }
  const accessLog = fs.createWriteStream(accessLogPath, {flags: 'a'})
  const errorLog = fs.createWriteStream(errorLogPath, {flags: 'a'})

  // redirect stdout / stderr
  process.__defineGetter__('stdout', () => { return accessLog })
  process.__defineGetter__('stderr', () => { return errorLog })
}

server.start({
  postCachedRoutes
})
