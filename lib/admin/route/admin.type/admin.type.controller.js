const typeController = {}
const jp = require('jsonpath')
const {default: produce} = require('immer')

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

  pageInstance = produce(pageInstance, draft => {
    const action = jp.query(draft, '$..[?(@._id === "admin.type--action")]')[0]
    const nestedLink = jp.query(draft, '$..[?(@._id === "admin.type--nested")]')[0]
    const list = jp.query(draft, '$..[?(@._id === "admin.type--list")]')[0]

    action.href = getUrl('admin.instance.create.id', {_type})

    nestedLink.href = getUrl('admin.type', {_type, nested: nested ? undefined : 'nested'})

    list.items = instances.map(_id => {
      return {
        text: getInstanceTitle(_id),
        href: getUrl('admin.instance', {_id})
      }
    })

    const category = _type.startsWith('page.') ? 'page' : 'component'
    draft.adminBack = pagesMethods.getUrl('admin.category', {category})

    return draft
  })

  return pageInstance
}

module.exports = typeController
