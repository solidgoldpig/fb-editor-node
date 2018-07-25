const instanceCreateTypeController = {}
const jp = require('jsonpath')
const {default: produce} = require('immer')

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

  pageInstance = produce(pageInstance, draft => {
    const list = jp.query(draft, '$.components[0]')[0]
    // const baseComp = {
    //   _id: 'fwap',
    //   _type: 'content'
    // }
    // types.forEach(type => {
    //   const typeComp = Object.assign({}, baseComp)
    //   typeComp._id += `--${type}`
    //   typeComp.html = type
    //   components.push(typeComp)
    // })
    list.items = types.map(_type => {
      return {
        text: getSchemaTitle(_type),
        href: getUrl('admin.type', {_type}),
        count: getInstancesByType(_type, {count: true})
      }
    })

    draft.previouspage = getUrl('admin.main')
    return draft
  })

  return pageInstance
}

module.exports = instanceCreateTypeController

/*
  pageInstance = produce(pageInstance, draft => {
    const comp = jp.query(draft, `$..[?(@._id === "${pagePropertyComponentId}--value")]`)[0]
    comp._type = valueType
    comp.validation = comp.validation || {}
    comp.validation.required = isRequired
    if (items) {
      comp.items = items
    }
    draft.previouspage = pagesMethods.getUrl(instanceRoute, {_id})
    return draft
  })
  */
