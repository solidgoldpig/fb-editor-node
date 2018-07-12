
const server = require('@ministryofjustice/fb-runner-node/lib/server/server')

const adminRouter = require('../lib/admin/admin')

const postCachedRoutes = () => adminRouter

server.start({
  postCachedRoutes
})
