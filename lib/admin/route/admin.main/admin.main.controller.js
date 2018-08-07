const adminController = {}
const jp = require('jsonpath')
const {default: produce} = require('immer')

const serviceData = require('../../../service-data/service-data')
const {
  getInstanceTitle,
  getInstanceProperty,
  getServiceSchemaCategories
} = serviceData

const {getNavigation, getPagesMethods: metadataMethods} = require('@ministryofjustice/fb-runner-node/lib/middleware/routes-metadata/routes-metadata')

adminController.setData = (pageInstance, pageData, POST) => {
  const {pagesMethods} = pageData
  const {getUrl} = pagesMethods

  const categories = getServiceSchemaCategories()

  const pageStart = metadataMethods().getData('/').route
  let pages = []
  const addPage = (_id) => {
    pages.push(_id)
    const {nextpage} = getNavigation(_id)
    if (nextpage) {
      addPage(nextpage)
    }
  }
  addPage(pageStart)
  pages = pages.map(page => {
    return {
      text: getInstanceTitle(page),
      href: getUrl('admin.instance', {_id: page})
    }
  })
  let pagesStr = pages.map(page => `- [${page.text}](${page.href})`)
    .join('\n')
  pageData.setUserDataProperty('pages', pagesStr)

  pageInstance = produce(pageInstance, draft => {
    const list = jp.query(draft, '$..[?(@._id === "admin.main--list")]')[0]
    list.items = categories.map(category => {
      return {
        text: category,
        href: getUrl('admin.category', {category})
      }
    })
    list.items = pages

    return draft
  })

  return pageInstance
}

module.exports = adminController
