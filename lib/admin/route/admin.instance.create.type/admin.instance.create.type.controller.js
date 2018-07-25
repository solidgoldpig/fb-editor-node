const instanceCreateTypeController = {}
const jp = require('jsonpath')
const {default: produce} = require('immer')

const {
  initAddError,
  setErrors
} = require('@ministryofjustice/fb-runner-node/lib/page/set-errors/set-errors')

const serviceData = require('../../../service-data/service-data')
const {
  loadServiceData,
  getServiceInstances,
  getInstance,
  getDiscreteInstance,
  getSourceInstance,
  getInstanceProperty,
  setInstance,
  getServiceSchema,
  getSchemaNameByCategory,
  getSchemaPropertyAllowableTypes
} = serviceData

instanceCreateTypeController.setData = (pageInstance, pageData, POST) => {
  const {pagesMethods} = pageData
  const {getUrl} = pagesMethods
  const data = pageData.getUserData()
  let {instanceType, _type} = data
  const {addId, addProperty, operation} = data
  // if (addProperty === 'steps') {
  //   instanceType = 'page'
  // }

  let instanceDisplayType = 'component'

  let types = []
  if (instanceType && instanceType.match(/^(page|component|field|grouping|control)$/)) {
    types = getSchemaNameByCategory(instanceType)
    instanceDisplayType = instanceType
  } else {
    if (!addId && !addProperty) {
      // boom!
    } else {
      const addInstance = getInstance(addId)
      if (!addInstance) {
        //
      }
      const addType = addInstance._type
      if (addProperty === 'steps') {
        types = getSchemaNameByCategory('page')
      } else {
        types = getSchemaPropertyAllowableTypes(addType, addProperty)
      }
    }
  }

  pageData.setUserDataProperty('instanceType', instanceDisplayType)

  // If there's only one type allowable, then _type is implicit
  if (types.length === 1) {
    _type = types[0]
  }

  const typedPageInstance = produce(pageInstance, draft => {
    if (_type) {
      draft.redirect = getUrl('admin.instance.create.id', {
        _type,
        addId,
        addProperty,
        operation
      })
    } else {
      const nameNode = jp.query(draft, '$..[?(@.name === "_type")]')[0]
      const option = nameNode.items[0]
      nameNode.items.shift()
      types.forEach((type, index) => {
        const newOption = Object.assign({}, option)
        newOption.value = type
        newOption.label = getServiceSchema(type).title
        newOption._id += `__${index}`
        nameNode.items.push(newOption)
      })
    }
    return draft
  })

  // console.log(getSchemaNameByCategory('component'))
  // console.log(getSchemaPropertyAllowableTypes('page.start', 'components'))
  // console.log(getSchemaPropertyAllowableTypes('checkboxes', 'items'))

  return typedPageInstance
}

module.exports = instanceCreateTypeController
