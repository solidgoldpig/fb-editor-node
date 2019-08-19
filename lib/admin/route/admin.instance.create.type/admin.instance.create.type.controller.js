const instanceCreateTypeController = {}
const jp = require('jsonpath')

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

const defaultOrder = [
  'page.singlequestion',
  'page.form',
  'page.summary',
  'page.confirmation',
  'page.content',
  'page.flashcard',
  'text',
  'number',
  'date',
  'email',
  'textarea',
  'radios',
  'checkboxes',
  'fileupload',
  'fieldset',
  'group',
  'section',
  'autocomplete',
  'tabs',
  'accordion',
  'select',
  'content',
  'details',
  'inset',
  'warning',
  'panel',
  'table',
  'hidden'
]
const indexMap = {}
const createOrderedSort = (order) => {
  for (let i = 0; i < order.length; i++) {
    indexMap[order[i]] = i
  }

  return (a, b) => indexMap[a] - indexMap[b]
}

const sortProperties = createOrderedSort(defaultOrder)

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
        instanceDisplayType = 'step'
      } else {
        let allowableTypes = getSchemaPropertyAllowableTypes(addType, addProperty)
        if (allowableTypes && allowableTypes.length) {
          types = allowableTypes
        } else {
          types = getSchemaNameByCategory('component')
        }
      }
    }
  }

  pageData.setUserDataProperty('instanceType', instanceDisplayType)

  // If there's only one type allowable, then _type is implicit
  if (types.length === 1) {
    _type = types[0]
  }

  if (_type) {
    pageInstance.redirect = getUrl('admin.instance.create.id', {
      _type,
      addId,
      addProperty,
      operation
    })
  } else {
    const excludeTypes = ['page.admin', 'page.start', 'page.error', 'button', 'checkbox', 'form', 'header', 'option', 'radio', 'buttonPrimary', 'buttonSecondary']
    types = types.filter(type => !excludeTypes.includes(type))
      .sort(sortProperties)

    const nameNode = jp.query(pageInstance, '$..[?(@.name === "_type")]')[0]
    const option = nameNode.items[0]
    nameNode.items.shift()
    types.forEach((type, index) => {
      const newOption = Object.assign({}, option)
      newOption.value = type
      const schema = getServiceSchema(type)
      newOption.label = schema.title
      newOption.hint = schema.description
      newOption._id += `__${index}`
      nameNode.items.push(newOption)
    })
  }

  // console.log(getSchemaNameByCategory('component'))
  // console.log(getSchemaPropertyAllowableTypes('page.start', 'components'))
  // console.log(getSchemaPropertyAllowableTypes('checkboxes', 'items'))

  return pageInstance
}

module.exports = instanceCreateTypeController
