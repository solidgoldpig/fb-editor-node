const typeController = {}
const jp = require('jsonpath')

const serviceData = require('../../../service-data/service-data')
const {
  getInstancesByType,
  getInstanceTitle,
  getSchemaTitle
} = serviceData

typeController.setData = (pageInstance, pageData, POST) => {
  const {pagesMethods} = pageData
  const {getUrl} = pagesMethods
  const data = pageData.getUserData()
  let {_type, nested} = data
  if (nested && nested !== 'nested') {
    throw new Error(404)
  }

  const typeTitle = getSchemaTitle(_type)
  pageData.setUserDataProperty('typeTitle', typeTitle)

  const instances = getInstancesByType(_type, {nested})

  const action = jp.query(pageInstance, '$..[?(@._id === "admin.type--action")]')[0]
  const list = jp.query(pageInstance, '$..[?(@._id === "admin.type--list")]')[0]

  action.href = getUrl('admin.instance.create.id', {_type})

  const nestedLinkUrl = getUrl('admin.type', {_type, nested: nested ? undefined : 'nested'})
  pageData.setUserDataProperty('nestedLinkUrl', nestedLinkUrl)

  list.items = instances.map(_id => {
    return {
      text: getInstanceTitle(_id),
      href: getUrl('admin.instance', {_id})
    }
  })

  const category = _type.startsWith('page.') ? 'page' : 'component'
  pageInstance.adminBack = pagesMethods.getUrl('admin.category', {category})

  return pageInstance
}

module.exports = typeController
