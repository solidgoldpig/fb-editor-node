const instancePropertyController = {}
const jp = require('jsonpath')
const get = require('lodash.get')
const {default: produce} = require('immer')

const {
  initAddError,
  setErrors
} = require('@ministryofjustice/fb-runner-node/lib/page/set-errors/set-errors')

const serviceData = require('../../../service-data/service-data')
const {
  getInstanceProperty,
  getSourceInstanceProperty,
  loadServiceData,
  getInstance,
  getInstanceTitle,
  setInstanceProperty,
  getDiscreteInstance,
  getServiceSchema
} = serviceData

instancePropertyController.setData = (pageInstance, pageData, POST) => {
  const {pagesMethods} = pageData
  const _id = pageData.getUserDataProperty('_id')
  const parentProperty = pageData.getUserDataProperty('parentProperty')
  const property = pageData.getUserDataProperty('property')

  const runtimeInstance = getInstance(_id) || pageData.getUserDataProperty('runtimeInstance')
  if (!runtimeInstance || !runtimeInstance._type) {
    return pageInstance
  }
  const discreteInstance = getDiscreteInstance(_id) || {}

  const schema = getServiceSchema(runtimeInstance._type)
  let schemaProperties = schema.properties
  let parentPropertyTitle
  if (parentProperty) {
    const parentPropertyLookup = parentProperty.replace(/\./g, '.properties.')
    const parentPropertySchema = get(schemaProperties, parentPropertyLookup)
    if (!parentPropertySchema) {
      // 404 surely?
      return pageInstance
    }
    parentPropertyTitle = parentPropertySchema.title || parentProperty
    schemaProperties = parentPropertySchema.properties
  }
  const propertySchema = schemaProperties[property]
  if (!propertySchema) {
    // 404 surely?
    return pageInstance
  }
  const propertyTitle = propertySchema.title || property
  const propertyDescription = propertySchema.description || ''
  let valueType = propertySchema.type || 'text'
  let valueTypeRecord = valueType
  if (valueType === 'string') {
    valueType = 'text'
  }
  let hiddenValueRequired
  if (valueType === 'array' || valueType === 'object' || propertySchema.properties || propertySchema.items) {
    valueType = 'textarea'
    hiddenValueRequired = true
  }
  if (propertySchema.multiline) {
    valueType = 'textarea'
  }

  let propertySingular = property
  propertySingular = propertySingular.replace(/ies$/, 'ey')
  propertySingular = propertySingular.replace(/s$/, '')
  pageData.setUserDataProperty('propertySingular', propertySingular)

  // TODO: adjust schema to parentPropertySchema if parentProperty
  const isRequired = schema.required.includes(property)
  const valueRequired = isRequired ? 'true' : 'false'

  const createMode = pageData.getUserDataProperty('create')
  // const sourceInstance = pageData.getUserDataProperty('sourceInstance')

  // let value = createMode ? sourceInstance[property] : getSourceInstanceProperty(_id, property, discreteInstance.$source)
  const propertyLookup = parentProperty ? `${parentProperty}.${property}` : property
  let value = createMode ? pageData.getUserDataProperty('value') : getSourceInstanceProperty(_id, propertyLookup, discreteInstance.$source)

  if (discreteInstance.$source !== 'service') {
    pageData.setUserDataProperty('instanceSource', discreteInstance.$source)
  }

  let addUrl
  if (hiddenValueRequired) {
    let hiddenValue = value
    if (!value) {
      if (valueTypeRecord === 'array') {
        hiddenValue = []
      } else if (valueTypeRecord === 'object') {
        hiddenValue = {}
      }
    }
    if (Array.isArray(value)) {
      pageData.setUserDataProperty('addValue', true)
      hiddenValue = hiddenValue.map(item => {
        const _id = typeof item === 'string' ? item : item._id
        return {
          _id,
          data: item,
          title: getInstanceTitle(_id),
          url: pagesMethods.getUrl('admin.instance', {_id})
        }
      })
      addUrl = pagesMethods.getUrl('admin.instance.create.type', {
        addId: _id,
        addProperty: property
      })
    }
    hiddenValue = JSON.stringify(hiddenValue)
    pageData.setUserDataProperty('hiddenValue', hiddenValue)
  }

  let inheritedValue = createMode ? get(runtimeInstance, propertyLookup) : getInstanceProperty(_id, propertyLookup)
  if (typeof value !== 'string') {
    value = JSON.stringify(value, null, 2)
    if (value && value.match(/^\{[\s\S]*\}$/)) {
      valueType = 'textarea'
    }
    // TODO: Hmmmm, seems a bit pointless
    inheritedValue = ''
  }
  if (inheritedValue === value || inheritedValue === undefined) {
    inheritedValue = ''
  }

  let items
  if (valueType === 'boolean') {
    valueType = 'radios'
    items = [{
      _id: 'admin.instance.property--value--true',
      _type: 'radio',
      value: 'true',
      label: 'true'
    }, {
      _id: 'admin.instance.property--value--false',
      _type: 'radio',
      value: 'false',
      label: 'false'
    }]
  }
  if (schemaProperties[property].enum) {
    items = []
    valueType = 'radios'
    items = schemaProperties[property].enum.map((enumValue) => {
      return {
        _id: `admin.instance.property--value--${enumValue}`,
        _type: 'radio',
        value: enumValue,
        label: enumValue
      }
    })
  }

  const instanceRoute = createMode ? 'admin.instance.create' : 'admin.instance'

  const pagePropertyComponentId = `${instanceRoute}.property`
  pageInstance = produce(pageInstance, draft => {
    const comp = jp.query(draft, `$..[?(@._id === "${pagePropertyComponentId}--value")]`)[0]
    comp._type = valueType
    comp.validation = comp.validation || {}
    comp.validation.required = isRequired
    if (items) {
      comp.items = items
    }
    if (addUrl) {
      draft._template = 'admin-page.property.items'
      const addComp = jp.query(draft, `$..[?(@._id === "${pagePropertyComponentId}--add")]`)[0]
      addComp.href = addUrl
    }
    draft.previouspage = pagesMethods.getUrl(instanceRoute, {_id})
    return draft
  })

  if (!POST) {
    pageData.setUserDataProperty('value', value)
  }
  pageData.setUserDataProperty('instanceTitle', getInstanceTitle(_id))
  pageData.setUserDataProperty('valueRequired', valueRequired)
  pageData.setUserDataProperty('valueType', valueType)
  pageData.setUserDataProperty('parentPropertyTitle', parentPropertyTitle)
  pageData.setUserDataProperty('propertyTitle', propertyTitle)
  pageData.setUserDataProperty('propertyDescription', propertyDescription)
  pageData.setUserDataProperty('inheritedValue', inheritedValue)

  return pageInstance
}

instancePropertyController.postValidation = (pageInstance, pageData, postRedirect) => {
  let errors = []
  const addError = initAddError(errors)

  const _id = pageData.getUserDataProperty('_id')
  const parentProperty = pageData.getUserDataProperty('parentProperty')
  const property = pageData.getUserDataProperty('property')
  let value = pageData.getUserDataProperty('value')

  const propertyLookup = parentProperty ? `${parentProperty}.${property}` : property

  const defaultInstance = getInstance(_id)
  const discreteInstance = getDiscreteInstance(_id)
  const sourceValue = getSourceInstanceProperty(_id, propertyLookup, discreteInstance.$source)

  const schema = getServiceSchema(defaultInstance._type)
  let schemaProps = schema.properties
  if (parentProperty) {
    const parentPropertyLookup = parentProperty.replace(/\./g, '.properties.')
    schemaProps = get(schemaProps, parentPropertyLookup).properties
  }
  const propertySchema = schemaProps[property]
  const propertyType = propertySchema.type

  if (propertyType === 'number') {
    value *= 1
  } else if (propertyType === 'boolean') {
    value = value === 'true'
  } else if (propertyType === 'array' || propertyType === 'object' || value === undefined || value.match(/^\{[\s\S]*\}$/)) {
    if (value !== undefined) {
      value = JSON.parse(value)
    }
  }

  if (JSON.stringify(value) === JSON.stringify(sourceValue)) {
    return postRedirect.success()
  }
  return setInstanceProperty(_id, propertyLookup, value)
    .then(() => {
      return loadServiceData()
    })
    .then(() => {
      const instanceUrl = pageData.pagesMethods.getUrl('admin.instance', {_id})
      postRedirect.redirect(instanceUrl)
      // postRedirect.success()
    })
    .catch(err => {
      addError(`Failed to write property instance: ${err.toString()}`, 'value')
      pageInstance = setErrors(pageInstance, errors)
      // console.log(err)
      postRedirect.failure(pageInstance, pageData)
    })
}

module.exports = instancePropertyController
