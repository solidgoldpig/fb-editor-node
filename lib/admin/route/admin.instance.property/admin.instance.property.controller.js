const instancePropertyController = {}
const jp = require('jsonpath')
const get = require('lodash.get')
const {default: produce} = require('immer')

const {
  initAddError,
  setErrors
} = require('@ministryofjustice/fb-runner-node/lib/page/set-errors/set-errors')

const {
  getEvaluationOperators
} = require('@ministryofjustice/fb-runner-node/lib/evaluate-condition/evaluate-condition')

const {getPagesMethods, getNavigationPages} = require('@ministryofjustice/fb-runner-node/lib/middleware/routes-metadata/routes-metadata')
const {setControlNames, setRepeatable} = require('@ministryofjustice/fb-runner-node/lib/page/page')

const serviceData = require('../../../service-data/service-data')
const {
  getInstanceProperty,
  getSourceInstanceProperty,
  loadServiceData,
  getInstance,
  getInstanceTitle,
  setInstanceProperty,
  getDiscreteInstance,
  getServiceSchema,
  getServiceInstances
} = serviceData

const {setAdminPanels} = require('../admin.instance/admin.instance.controller')

const isConditionalBoolean = (schemaProperties, property) => {
  const conditionalBoolean = get(schemaProperties, `${property}.oneOf[0]._name`)
  return conditionalBoolean === 'definition.conditional.boolean'
}

instancePropertyController.setData = (pageInstance, pageData, POST, REFERRER) => {
  const {pagesMethods} = pageData
  const {getUrl} = pagesMethods
  const _id = pageData.getUserDataProperty('_id')
  const parentProperty = pageData.getUserDataProperty('parentProperty')
  const property = pageData.getUserDataProperty('property')

  const runtimeInstance = getInstance(_id) || pageData.getUserDataProperty('runtimeInstance')
  if (!runtimeInstance || !runtimeInstance._type) {
    return pageInstance
  }

  if (runtimeInstance.$autoInjected) {
    if (runtimeInstance._repeatableId) {
      const repeatableUrl = getUrl('admin.instance', {
        _id: runtimeInstance._repeatableId
      })
      pageInstance = produce(pageInstance, draft => {
        draft.redirect = repeatableUrl
      })
      return pageInstance
    } else {
      //
    }
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
  let propertyDescription = propertySchema.description || ''
  const instanceType = runtimeInstance._type.startsWith('page.') ? 'page' : 'component'
  propertyDescription = propertyDescription.replace(/page\/component/, instanceType)
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
  if (propertySchema.pattern) {
    pageInstance = produce(pageInstance, draft => {
      const valueInstance = jp.query(draft, '$..[?(@._id === "admin.instance.property--value")]')[0]
      valueInstance.validation = {
        pattern: propertySchema.pattern
      }
      return draft
    })
  }

  const conditionalBoolean = isConditionalBoolean(schemaProperties, property)
  if (conditionalBoolean) {
    valueType = 'textarea'
  }

  if (conditionalBoolean) {
    const pages = getNavigationPages()

    const controls = []

    const updateControls = (_id) => {
      let pageInstance = getInstance(_id)
      pageInstance = setControlNames(pageInstance, pageData)
      pageInstance = setRepeatable(pageInstance, pageData, true)

      const controlInstances = jp.query(pageInstance, '$..[?(@.name && @._type && @._type !== "button")]').map(instance => {
        if (!getInstance(instance._id)) {
          return
        }
        let enums
        if (instance.items) {
          enums = instance.items.map(item => {
            return {
              value: item.value,
              label: getInstanceTitle(item._id)
            }
          })
        }
        const name = instance.name.replace(/\[.+?\]/g, '[*]')

        const instances = getServiceInstances()

        const nameParts = name.split('.')
          .map((part, index, arr) => {
            let partType = index === arr.length - 1 ? 'property' : 'model'
            let adjustedPart = part.replace('[*]', '')
            const partBundle = {
              [partType]: adjustedPart,
              repeatable: part !== adjustedPart
            }

            let modelTitle
            if (partType === 'model') {
              const modelInstance = jp.query(instances, `$..[?(@.model === "${adjustedPart}")]`)[0]
              if (modelInstance) {
                modelTitle = getInstanceProperty(modelInstance._id, 'model[title]')
                modelTitle = modelTitle || getInstanceTitle(modelInstance._id)
                modelTitle = modelTitle || modelInstance._id
              }
            }
            if (modelTitle) {
              partBundle.modelTitle = modelTitle
            }
            return partBundle
          })

        let title = getInstanceTitle(instance._id)
        let fullTitle = title
        if (pageInstance._type !== 'page.singlequestion') {
          let titlePrefix = getInstanceProperty(_id, 'model[title]') || getInstanceProperty(_id, 'heading')
          if (titlePrefix) {
            fullTitle = `${titlePrefix} - ${title}`
          }
        }
        let repeatableTitle = instance.repeatableHeading

        let controlBundle = {
          name,
          type: instance._type,
          title,
          fullTitle,
          repeatableTitle,
          nameParts
        }
        if (enums) {
          controlBundle.enums = enums
        }
        return controlBundle
      })
      controls.push(...controlInstances)
      if (pages[_id].nextpage) {
        updateControls(pages[_id].nextpage)
      }
    }

    let startPage = Object.keys(pages)[0]
    updateControls(startPage)

    pageData.setUserDataProperty('booleanConditional', JSON.stringify(controls, null, 2))

    const allowableOperators = getEvaluationOperators()
    pageData.setUserDataProperty('allowableOperators', JSON.stringify(allowableOperators, null, 2))
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

  let deletable = false
  if (!isRequired && value !== undefined && !Array.isArray(value)) {
    deletable = true
    pageData.setUserDataProperty('deletable', true)
  } else {
    pageData.unsetUserDataProperty('deletable')
  }
  if (!deletable) {
    pageData.unsetUserDataProperty('delete-property')
  }
  if (pageData.getUserDataProperty('delete-property')) {
    pageInstance = produce(pageInstance, draft => {
      draft.skipValidation = true
      return draft
    })
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
    if (Array.isArray(hiddenValue)) {
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
      label: 'Yes'
    }, {
      _id: 'admin.instance.property--value--false',
      _type: 'radio',
      value: 'false',
      label: 'No'
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

  let previouspage = pageData.getUserDataProperty('previouspage') || REFERRER
  previouspage = previouspage || pagesMethods.getUrl(instanceRoute, {_id})
  pageData.setUserDataProperty('previouspage', previouspage)

  const pagePropertyComponentId = `${instanceRoute}.property`
  pageInstance = produce(pageInstance, draft => {
    const comp = jp.query(draft, `$..[?(@._id === "${pagePropertyComponentId}--value")]`)[0]
    comp._type = valueType
    if (valueType === 'radios') {
      comp.legend = comp.label
      delete comp.label
    }
    comp.validation = comp.validation || {}
    comp.validation.required = isRequired
    if (items) {
      comp.items = items
    }
    if (addUrl) {
      pageData.setUserDataProperty('updateInstructions', true)
      draft._template = 'admin-page.property.items'
      const addComp = jp.query(draft, `$..[?(@._id === "${pagePropertyComponentId}--add")]`)[0]
      addComp.href = addUrl
    }
    if (conditionalBoolean) {
      draft._template = 'admin-page.property.booleanconditional'
    }
    draft.previouspage = previouspage
    return draft
  })

  if (!POST) {
    pageData.setUserDataProperty('value', value)
  }

  if (conditionalBoolean) {
    if (value === undefined) {
      const defaultConditionalBoolean = schemaProperties[property].default
      value = defaultConditionalBoolean || false
    }
    if (typeof value === 'object' || typeof value === 'boolean') {
      pageData.setUserDataProperty('value', JSON.stringify(value))
    }
  }
  pageData.setUserDataProperty('instanceTitle', getInstanceTitle(_id))
  pageData.setUserDataProperty('instanceType', instanceType)
  pageData.setUserDataProperty('valueRequired', valueRequired)
  pageData.setUserDataProperty('valueType', valueType)
  pageData.setUserDataProperty('parentPropertyTitle', parentPropertyTitle)
  pageData.setUserDataProperty('propertyTitle', propertyTitle)
  pageData.setUserDataProperty('propertyDescription', propertyDescription)
  pageData.setUserDataProperty('inheritedValue', inheritedValue)

  pageInstance = produce(pageInstance, draft => {
    const MODEURL = getInstanceProperty(discreteInstance._id, 'url')
    draft.MODEURL = MODEURL
    draft.MODE = 'instance'
    return draft
  })

  pageInstance = setAdminPanels(pageInstance, runtimeInstance, discreteInstance, pageData)

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

  const conditionalBoolean = isConditionalBoolean(schemaProps, property)
  if (conditionalBoolean) {
    let requiredValue = value
    if (requiredValue) {
      requiredValue = requiredValue === 'true' ? true : requiredValue
      requiredValue = requiredValue === 'false' ? false : requiredValue
      value = requiredValue
    }
  }

  const propertySchema = schemaProps[property]
  const propertyType = propertySchema.type

  const objectString = conditionalBoolean
  if (propertyType === 'number') {
    value *= 1
  } else if (propertyType === 'boolean') {
    value = value === 'true'
  } else if (propertyType === 'array' || propertyType === 'object' || objectString) {
    if (value !== undefined) {
      value = JSON.parse(value)
    }
    if (value === null) {
      value = undefined
    }
  }

  if (pageData.getUserDataProperty('delete-property')) {
    value = undefined
  }

  const instanceUrl = pageInstance.previouspage

  if (JSON.stringify(value) === JSON.stringify(sourceValue)) {
    // const instanceUrl = pageData.pagesMethods.getUrl('admin.instance', {_id})
    return postRedirect.redirect(instanceUrl)
  }
  return setInstanceProperty(_id, propertyLookup, value)
    .then(() => {
      return loadServiceData()
    })
    .then(() => {
      // const instanceUrl = pageData.pagesMethods.getUrl('admin.instance', {_id})
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
