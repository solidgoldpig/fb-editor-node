const adminController = {}
const jp = require('jsonpath')
const {default: produce} = require('immer')

const serviceData = require('../../../service-data/service-data')
const {
  getServiceSchemaCategories
} = serviceData

adminController.setData = (pageInstance, pageData, POST) => {
  const {pagesMethods} = pageData
  const {getUrl} = pagesMethods

  const categories = getServiceSchemaCategories()

  pageInstance = produce(pageInstance, draft => {
    const list = jp.query(draft, '$..[?(@._id === "admin.main--list")]')[0]
    list.items = categories.map(category => {
      return {
        text: category,
        href: getUrl('admin.category', {category})
      }
    })

    return draft
  })

  return pageInstance
}

module.exports = adminController
