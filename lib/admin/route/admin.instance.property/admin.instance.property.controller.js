const instancePropertyController = {}
const jp = require('jsonpath')
const {default: produce} = require('immer')

const {
  initAddError,
  setErrors
} = require('@ministryofjustice/fb-runner-node/lib/page/set-errors/set-errors')

const serviceData = require('@ministryofjustice/fb-runner-node/lib/service-data/service-data')
const {
  getInstanceProperty,
  getSourceInstanceProperty,
  loadServiceData,
  getInstance,
  setInstanceProperty,
  getDiscreteInstance,
  getServiceSchema
} = serviceData

instancePropertyController.setData = (pageInstance, pageData, POST) => {
  const {pagesMethods} = pageData
  const _id = pageData.getUserDataProperty('_id')
  const property = pageData.getUserDataProperty('property')

  const defaultInstance = getInstance(_id)
  if (!defaultInstance || !defaultInstance._type) {
    return pageInstance
  }
  const discreteInstance = getDiscreteInstance(_id)

  const schema = getServiceSchema(defaultInstance._type)
  const schemaProperties = schema.properties
  const propertySchema = schemaProperties[property]
  if (!propertySchema) {
    return pageInstance
  }
  const propertyTitle = propertySchema.title || property
  const propertyDescription = propertySchema.description || ''
  let valueType = propertySchema.type || 'text'
  if (valueType === 'string') {
    valueType = 'text'
  }
  if (valueType === 'array' || valueType === 'object' || propertySchema.properties || propertySchema.items) {
    valueType = 'textarea'
  }
  if (propertySchema.multiline) {
    valueType = 'textarea'
  }

  const isRequired = schema.required.includes(property)
  const valueRequired = isRequired ? 'true' : 'false'

  let value = getSourceInstanceProperty(_id, property, discreteInstance.$source)
  let inheritedValue = getInstanceProperty(_id, property)
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

  pageInstance = produce(pageInstance, draft => {
    const comp = jp.query(draft, '$..[?(@._id === "admin.instance.property--value")]')[0]
    comp._type = valueType
    comp.validation = comp.validation || {}
    comp.validation.required = isRequired
    if (items) {
      comp.items = items
    }
    draft.previouspage = pagesMethods.getUrl('admin.instance', {_id})
    return draft
  })

  if (!POST) {
    pageData.setUserDataProperty('value', value)
  }
  pageData.setUserDataProperty('valueRequired', valueRequired)
  pageData.setUserDataProperty('valueType', valueType)
  pageData.setUserDataProperty('propertyTitle', propertyTitle)
  pageData.setUserDataProperty('propertyDescription', propertyDescription)
  pageData.setUserDataProperty('inheritedValue', inheritedValue)

  return pageInstance
}

instancePropertyController.postValidation = (pageInstance, pageData, postRedirect) => {
  let errors = []
  const addError = initAddError(errors)

  const _id = pageData.getUserDataProperty('_id')
  const property = pageData.getUserDataProperty('property')
  let value = pageData.getUserDataProperty('value')

  const defaultInstance = getInstance(_id)
  const discreteInstance = getDiscreteInstance(_id)
  const sourceValue = getSourceInstanceProperty(_id, property, discreteInstance.$source)

  const schema = getServiceSchema(defaultInstance._type)
  const propertyType = schema.properties[property].type

  if (propertyType === 'number') {
    value *= 1
  } else if (propertyType === 'boolean') {
    value = value === 'true'
  } else if (propertyType === 'array' || propertyType === 'object' || value === undefined || value.match(/^\{[\s\S]*\}$/)) {
    value = JSON.parse(value)
  }

  if (JSON.stringify(value) === JSON.stringify(sourceValue)) {
    return postRedirect.success()
  }
  return setInstanceProperty(_id, property, value)
    .then(() => {
      return loadServiceData()
    })
    .then(() => {
      postRedirect.success()
    })
    .catch(err => {
      addError(`Failed to write property instance: ${err.toString()}`, 'value')
      pageInstance = setErrors(pageInstance, errors)
      // console.log(err)
      postRedirect.failure(pageInstance, pageData)
    })
}

module.exports = instancePropertyController
