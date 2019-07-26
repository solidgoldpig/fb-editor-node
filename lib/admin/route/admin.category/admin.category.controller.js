const instanceCreateTypeController = {}
const jp = require('jsonpath')

const serviceData = require('../../../service-data/service-data')
const {
  getSchemaNameByCategory,
  getSchemaTitle,
  getInstancesByType
} = serviceData

instanceCreateTypeController.setData = (pageInstance, pageData, POST) => {
  const {pagesMethods} = pageData
  const {getUrl} = pagesMethods
  const data = pageData.getUserData()
  let {category} = data
  const types = getSchemaNameByCategory(category)

  const list = jp.query(pageInstance, '$.components[0]')[0]
  list.items = types.map(_type => {
    return {
      text: getSchemaTitle(_type),
      href: getUrl('admin.type', {_type, nested: category === 'component' ? 'nested' : undefined}),
      count: getInstancesByType(_type, {count: true, nested: category === 'component'})
    }
  })

  pageInstance.adminBack = getUrl('admin.main')

  return pageInstance
}

module.exports = instanceCreateTypeController
