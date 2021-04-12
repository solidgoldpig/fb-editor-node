const adminController = {}

const serviceData = require('../../../service-data/service-data')
const {
  getEntryPointInstances,
  getInstance,
  getInstanceTitle,
  getInstanceProperty
} = serviceData

const {getPageHierarchy} = require('../admin.instance/admin.instance.controller')

// const {getNavigation, getPagesMethods: metadataMethods} = require('@solidgoldpig/fb-runner-node/lib/middleware/routes-metadata/routes-metadata')

adminController.setData = (pageInstance, pageData, POST) => {
  // const {pagesMethods} = pageData
  // const {getUrl} = pagesMethods

  // // const pageStart = metadataMethods().getData('/').route
  // let pages = serviceData.getEntryPointInstances().sort((a, b) => a.url > b.url ? 1 : -1)

  // let pagesStr = ''

  // const addPage = (_id, depth = '') => {
  //   const title = getInstanceTitle(_id)
  //   let href = `${getInstanceProperty(_id, 'url')}/edit` // getUrl('admin.instance', {_id})
  //   if (href === '//edit') {
  //     href = '/edit'
  //   }
  //   pagesStr += `${depth}- [${title}](${href})\n`

  //   const steps = getInstanceProperty(_id, 'steps') || []
  //   steps.forEach(step => {
  //     addPage(step, `${depth}  `)
  //   })
  // }

  // pages.forEach(page => {
  //   addPage(page._id)
  // })

  // pageData.setUserDataProperty('pages', pagesStr)

  // const categories = getServiceSchemaCategories()
  // pageInstance = produce(pageInstance, draft => {
  //   const list = jp.query(draft, '$..[?(@._id === "admin.main--list")]')[0]
  //   list.items = categories.map(category => {
  //     return {
  //       text: category,
  //       href: getUrl('admin.category', {category})
  //     }
  //   })
  //   list.items = pages

  //   return draft
  // })
  const _id = 'page.start'
  const instance = getInstance(_id)
  const _ids = _id ? [_id] : getEntryPointInstances()
    .filter(instance => instance._type !== 'page.error')
    .sort((a, b) => a.url > b.url ? 1 : -1)
    .map(instance => instance._id)

  const hierarchy = getPageHierarchy(instance, _ids, pageData, {
    currentInstanceLink: true,
    linkType: 'edit'
  })
  hierarchy._type = 'datastructure'
  hierarchy.top = true

  pageInstance.components.push(hierarchy)

  return pageInstance
}

module.exports = adminController
