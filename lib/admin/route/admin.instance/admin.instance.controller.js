// TODO: Move Based on _isa to top section
// TODO: Macroize top section
// TODO: create additional error strings for errors that don't correspond to validation rules (and allow for them to be created in first place)
// TODO: Make schema titles and descriptions for summary, inline, widthInputClass

const instanceController = {}
const jp = require('jsonpath')
const get = require('lodash.get')
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
  getInstanceTitle,
  getInstanceProperty,
  getString,
  setInstance,
  getServiceSchema,
  expandInstance,
  deleteInstance
} = serviceData

const {getNavigation} = require('@ministryofjustice/fb-runner-node/lib/middleware/routes-metadata/routes-metadata')
// const {format} = require('@ministryofjustice/fb-runner-node/lib/format/format')
const defaultOrder = [
  '_id',
  '_type',
  '_isa',
  'url',
  'name',
  'heading',
  'lede',
  'label',
  'legend',
  'hint',
  'body',
  'content',
  'components',
  'steps',
  'continue',
  'actionType',
  'validation',
  'errors',
  'show',
  'model',
  'modelProtect',
  'title',
  'extraComponents',
  'sectionHeading',
  'stepsHeading',
  'nextPage',
  'widthClassInput',
  'widthClass',
  'id',
  'classes',
  'attributes',
  'multiple',
  'repeatable',
  'repeatableHeading',
  'repeatableLede',
  'repeatableMinimum',
  'repeatableMaximum',
  'repeatableAdd',
  'repeatableDelete',
  'repeatableRemove'
]
const indexMap = {}
const createOrderedSort = (order) => {
  for (let i = 0; i < order.length; i++) {
    indexMap[order[i]] = i
  }

  return (a, b) => indexMap[a] - indexMap[b]
}

const sortProperties = createOrderedSort(defaultOrder)

instanceController.setData = (pageInstance, pageData, POST) => {
  const {pagesMethods} = pageData
  const {getUrl} = pagesMethods
  const _id = pageData.getUserDataProperty('_id')
  const runtimeInstance = getInstance(_id) || pageData.getUserDataProperty('runtimeInstance')
  if (!runtimeInstance || !runtimeInstance._type) {
    return pageInstance
  }
  const instanceType = runtimeInstance._type
  const instanceTitle = getInstanceTitle(_id)

  const discreteInstance = getDiscreteInstance(_id) || {}

  const {sourceInstances} = getServiceInstances()

  const instanceCategory = runtimeInstance._type.startsWith('page.') ? 'Page' : 'Component'
  pageData.setUserDataProperty('instanceCategory', instanceCategory)
  if (instanceCategory !== 'Page') {
    pageData.setUserDataProperty('showBasedOn', true)
  }
  if (runtimeInstance._isa) {
    pageData.setUserDataProperty('_isa', runtimeInstance._isa)
    const basedOn = getInstanceTitle(runtimeInstance._isa)
    pageData.setUserDataProperty('basedOn', basedOn)
    const basedOnUrl = getUrl('admin.instance', {
      _id: runtimeInstance._isa
    })
    pageData.setUserDataProperty('basedOnUrl', basedOnUrl)
  }
  const setBasedOnUrl = getUrl('admin.instance.property', {
    _id,
    property: '_isa'
  })
  pageData.setUserDataProperty('setBasedOnUrl', setBasedOnUrl)

  if (runtimeInstance._type.startsWith('page.')) {
    const inSteps = jp.query(sourceInstances, `$..[?(@.steps && @.steps.includes("${_id}"))]`)[0]
    if (inSteps) {
      const pageUrl = getUrl('admin.instance', {
        _id: inSteps._id
      })
      const stepsUrl = getUrl('admin.instance.property', {
        _id: inSteps._id,
        property: 'steps'
      })
      const usedBy = `[${getInstanceTitle(inSteps._id)}](${pageUrl})`
      const usedWhere = `[steps](${stepsUrl})`
      pageData.setUserDataProperty('usedBy', usedBy)
      pageData.setUserDataProperty('usedWhere', usedWhere)
    }
    pageData.setUserDataProperty('instanceUrl', runtimeInstance.url)
    const navigation = getNavigation(_id) || {}
    const getNavTitle = (navId, direction) => {
      let navHeading = ''
      let navUrl = '/dev/null'
      if (navId) {
        navHeading = getInstanceTitle(navId)
        // navHeading = getInstanceProperty(navId, 'heading')
        // if (!navHeading) {
        //   const components = getInstanceProperty(navId, 'components')
        //   if (components[0]) {
        //     navHeading = components[0].label || components[0].legend
        //   }
        // }
        navUrl = getUrl('admin.instance', {
          _id: navId
        })
      }
      return `[*${direction}* ${navHeading}](${navUrl})`
    }
    const navigationNext = getNavTitle(navigation.nextpage, 'next')
    const navigationPrevious = getNavTitle(navigation.previouspage, 'previous')
    pageData.setUserDataProperty('navigationNext', navigationNext)
    pageData.setUserDataProperty('navigationPrevious', navigationPrevious)
  } else if (_id !== discreteInstance._id) {
    const pathToInstance = jp.paths(discreteInstance, `$..[?(@._id === "${_id}")]`)[0]
    if (pathToInstance) {
      let usedNodes = []
      while (pathToInstance.length > 1) {
        pathToInstance.pop()
        const lookup = jp.stringify(pathToInstance)
        const node = jp.query(discreteInstance, lookup)[0]
        if (node && node._id) {
          usedNodes.push(node._id)
        }
      }
      usedNodes = usedNodes.reverse().map(_id => {
        const isPage = getInstanceProperty(_id, '_type') === 'page.singlequestion' ? ' (page)' : ''
        const nodeUrl = getUrl('admin.instance', {
          _id
        })
        return `[${getInstanceTitle(_id)}${isPage}](${nodeUrl})`
      })
      const usedBy = usedNodes.join(' > ')
      pageData.setUserDataProperty('usedBy', usedBy)
    }
  }

  let deletable = false
  if (!pageData.getUserDataProperty('usedBy')) {
    if (discreteInstance.$source === 'service') {
      if (getInstanceProperty(_id, 'url') !== '/') {
        deletable = true
        pageData.setUserDataProperty('deletable', true)
      }
    }
  }
  if (!deletable) {
    pageData.unsetUserDataProperty('delete-instance')
  }
  if (pageData.getUserDataProperty('delete-instance')) {
    pageInstance = produce(pageInstance, draft => {
      draft.skipValidation = true
      return draft
    })
  }

  const createMode = pageData.getUserDataProperty('create')
  const propertyRoute = createMode ? 'admin.instance.create.property' : 'admin.instance.property'

  const sourceInstance = getSourceInstance(_id, discreteInstance.$source) || pageData.getUserDataProperty('sourceInstance')
  const schema = getServiceSchema(sourceInstance._type)
  const propertyTitle = schema.title || sourceInstance._type
  const propertyDescription = schema.description
  const notSet = '<em>Not set</em>' // '*Not set*'
  const inherited = ' <em>Inherited</em>' // ' *Inherited*'
  const optionalText = ' <em class="fb-property-optional">optional</em>' // ' *(optional)*'

  const getPropValue = (instanceValue, runtimeInstanceValue, defaultValue) => {
    let value = instanceValue
    if (value === undefined) {
      value = runtimeInstanceValue
      if (value) {
        value += ' <i>Inherited</i>'
      }
    }
    if (value === undefined) {
      value = '<i>Not set</i>' // notSet
      if (defaultValue) {
        value = `${defaultValue} <em class="fb-value-default">default</em>`
      }
    }
    return value
  }
  const allInstanceProps = Object.keys(schema.properties)
    .filter(property => !property.match(/^(_id|_type|_isa|validation|errors)$/))
    .filter(property => {
      let excluded = []
      if (instanceType === 'page.singlequestion') {
        excluded = excluded.concat(['heading'])
      }
      if (instanceType.startsWith('page.')) {
        excluded = excluded.concat(['repeatable'])
      }
      if (instanceType === 'fileupload') {
        excluded = excluded.concat(['repeatable'])
      }
      if (excluded.length) {
        return !excluded.includes(property)
      }
      return true
    })
    // .sort(sortProperties)
    .sort((a, b) => {
      if (a === '_isa') { return -1 }
      if (b === '_isa') { return 1 }
      const required = schema.required
      const aRequired = required.includes(a)
      const bRequired = required.includes(b)
      if (aRequired === bRequired) {
        return indexMap[a] - indexMap[b]
      }
      return aRequired ? -1 : 1
    })
    .map(property => {
      const nestedPropertySchema = schema.properties[property]
      let nestedPropertyTitle = nestedPropertySchema.title || property
      let nestedPropertyDescription = nestedPropertySchema.description
      let optional = false
      if (!schema.required || !schema.required.includes(property)) {
        optional = true
      }
      let value = sourceInstance[property]
      let valueSet = 'source'
      if (value === undefined && runtimeInstance[property] !== undefined) {
        if (!runtimeInstance[`$FALLBACK${property}`]) {
          value = `${runtimeInstance[property]}${inherited}`
          valueSet = '_isa'
        }
      }
      if (value === undefined) {
        value = notSet
        valueSet = 'undefined'
      }
      let valueLength
      let items
      let addItem
      if (Array.isArray(value)) {
        items = []
        valueLength = value.length
        const valueIds = value.map(obj => {
          if (property === 'steps') {
            return obj
          }
          return obj._id
        }).filter(_id => _id)
        valueIds.forEach(_id => {
          const title = getInstanceTitle(_id)
          const url = getUrl('admin.instance', {
            _id
          })
          items.push({
            title,
            url
          })
        })
        // value is no longer needed
        value = ''
      } else if (typeof value === 'object' && value !== null) {
        value = JSON.stringify(value, null, 2)
      }
      if (nestedPropertySchema.type === 'array') {
        let includeAdd = true
        if (nestedPropertySchema.maxItems !== undefined && valueLength >= nestedPropertySchema.maxItems) {
          includeAdd = false
        }
        if (includeAdd) {
          const addPropertyName = property.replace(/s$/, '')
          // instanceType/new/:addId?/:addProperty
          const addTitle = `Add ${addPropertyName}`
          const addUrl = getUrl('admin.instance.create.type', {
            addId: _id,
            addProperty: property
          })
          addItem = {
            title: addTitle,
            url: addUrl
          }
          // const addPropertyItem = `[Add ${addPropertyName}](${getUrl('admin.instance.create.type', {
          //   addId: _id,
          //   addProperty: property
          // })})`
          // value += `\n  ${addPropertyItem}`
        }
      }
      let defaultValue = nestedPropertySchema.default
      if (value === notSet && nestedPropertySchema.default) {
        // value += ` - **defaults to ${nestedPropertySchema.default}**`
        value = `${nestedPropertySchema.default} <em class="fb-value-default">default</em>`
      }

      // let nestedValues = {}
      if (nestedPropertySchema.properties) {
        //         value = ''
        //         Object.keys(propertySchema.properties).forEach(nestedProp => {
        //           console.log({nestedProp})
        //           let nestedValue = defaultInstance[property] ? defaultInstance[property][nestedProp] : notSet
        //           let nestedPropTitle = propertySchema.properties[nestedProp].title || nestedProp
        //           let propPath = `${property}.${nestedProp}`
        //           nestedValue = `- [${nestedPropTitle}](${getUrl('admin.instance.property', {
        //             _id,
        //             property: propPath
        //           })})

        // ${nestedValue}
        // `
        //           nestedValues[nestedProp] = nestedValue
        //           value += nestedValue
        //         })
      }

      const title = nestedPropertyTitle
      const description = nestedPropertyDescription
      const url = getUrl(propertyRoute, {
        _id,
        property
      })

      if (optional) {
        optional = optionalText
      }
      let zeinherited

      const zebundle = {
        category: nestedPropertySchema.category ? nestedPropertySchema.category[0] : undefined,
        title,
        description,
        url,
        optional,
        value,
        defaultValue,
        inherited: zeinherited,
        items,
        addItem,
        property
      }
      return zebundle
    })

  const getPropBundle = (bundleProp, bundleSchema, bundleValues, bundleInheritedValues, bundleParentProp, bundleNestedProp) => {
    let bundlePropSchema = bundleSchema.properties[bundleProp]
    if (bundleNestedProp) {
      bundlePropSchema = bundlePropSchema.properties[bundleNestedProp]
    }
    let title = bundlePropSchema.title
    if (!title) {
      title = bundleNestedProp || bundleProp
    }
    let description = bundlePropSchema.description

    const propertyLookup = bundleNestedProp ? `${bundleProp}.${bundleNestedProp}` : bundleProp

    const instanceValue = get(bundleValues, propertyLookup)
    const inheritedInstanceValue = get(bundleInheritedValues, propertyLookup)
    let defaultValue = bundlePropSchema.default
    if (!defaultValue && bundleParentProp === 'errors') {
      const typeLookup = propertyLookup.replace(/(\.[^.]+)$/, `.${instanceType}$1`)
      defaultValue = getString(`error.${typeLookup}`)
      if (!defaultValue) {
        defaultValue = getString(`error.${propertyLookup}`)
      }
    }
    let value = getPropValue(instanceValue, inheritedInstanceValue, defaultValue)
    if (typeof value === 'object') {
      value = JSON.stringify(value)
    }

    const parentProperty = bundleNestedProp ? `${bundleParentProp}.${bundleProp}` : bundleParentProp
    const property = bundleNestedProp || bundleProp

    let optional = true
    if (optional) {
      optional = optionalText
    }
    const url = getUrl(propertyRoute, {
      _id,
      parentProperty,
      property
    })
    let inherited
    // inherited.href
    // inherited.title
    const validationPropBundle = {
      _id: `propBundle.${propertyLookup}`,
      title,
      description,
      url,
      optional,
      value,
      defaultValue,
      instanceValue,
      inheritedInstanceValue,
      inherited
    }
    return validationPropBundle
  }

  const errorTypes = ['summary', 'inline']
  const errorsSchema = schema.properties.errors || {}
  const errorsValues = sourceInstance.errors || {}
  const inheritedErrorsValues = sourceInstance._isa ? runtimeInstance.errors || {} : {}
  const validationSchema = schema.properties.validation || {}
  const validationValues = sourceInstance.validation || {}
  const inheritedValidationValues = sourceInstance._isa ? runtimeInstance.validation || {} : {}
  const validationProps = Object.keys(validationSchema.properties ||
  []).filter(property => !property.startsWith('formatM'))
    .map(validationProp => {
      const validationPropBundle = getPropBundle(validationProp, validationSchema, validationValues, inheritedValidationValues, 'validation')

      const {instanceValue, inheritedInstanceValue} = validationPropBundle
      let needErrorProps = instanceValue !== undefined || inheritedInstanceValue !== undefined
      // special case for required since all fields are required by default
      if (validationProp === 'required') {
        needErrorProps = instanceValue !== false && inheritedInstanceValue !== false
      }
      if (needErrorProps) {
        const errorComponents = errorTypes.map(errorType => {
          const propBundle = getPropBundle(validationProp, errorsSchema, errorsValues, inheritedErrorsValues, 'errors', errorType)
          return propBundle
        })
        if (errorComponents.length) {
          validationPropBundle._type = 'details'
          validationPropBundle._id = `admin.instance.${validationProp}.errors`
          validationPropBundle.summary = 'Error messages'
          validationPropBundle.open = true
          validationPropBundle.components = [{
            _type: 'propertylist',
            items: errorComponents
          }]
        }
      }

      return validationPropBundle
    })

  const addProps = (propsType, props) => {
    if (!props) {
      return
    }
    if (props.length) {
      pageData.setUserDataProperty(`${propsType}Properties`, true)
    }
    pageInstance = produce(pageInstance, draft => {
      const propsComp = jp.query(draft, `$..[?(@._id === "admin.instance--properties.${propsType}")]`)[0]
      if (propsType === 'main') {
        propsComp.items = props
      } else {
        propsComp.components = [
          {
            _type: 'propertylist',
            items: props
          }
        ]
      }
    })
  }

  const uiCategory = schema.uiCategory || {}

  const mainProps = allInstanceProps.filter(prop => {
    return !prop.category || (uiCategory.main || []).includes(prop.property)
  })

  const filterProps = (instanceProps, category) => {
    return instanceProps.filter(prop => {
      return prop.category === category || (uiCategory[category] || []).includes(prop.property)
    })
  }
  const repeatableProps = getInstanceProperty(_id, 'repeatable') ? filterProps(allInstanceProps, 'repeatable') : undefined
  const logicProps = filterProps(allInstanceProps, 'logic')
  const contentProps = filterProps(allInstanceProps, 'content')
  const htmlProps = filterProps(allInstanceProps, 'htmlattributes')
  const additionalProps = filterProps(allInstanceProps, 'additional')

  addProps('main', mainProps)
  addProps('validation', validationProps)
  addProps('repeatable', repeatableProps)
  addProps('logic', logicProps)
  addProps('content', contentProps)
  addProps('html', htmlProps)
  addProps('additional', additionalProps)

  // TODO: get pagesMethods.getUrl
  const instanceTypeUrl = `[${propertyTitle}](/admin/instances/${instanceType})`

  pageData.setUserDataProperty('instanceTitle', instanceTitle)
  pageData.setUserDataProperty('instanceType', instanceTypeUrl)
  pageData.setUserDataProperty('instanceHint', propertyDescription || '')

  pageData.setUserDataProperty('expandedInstance', JSON.stringify(runtimeInstance, null, 2))
  if (!POST) {
    pageData.setUserDataProperty('instance', JSON.stringify(sourceInstance, null, 2))
  }

  return pageInstance
}

instanceController.validate = (pageInstance, pageData, POST, ajv) => {
  if (pageData.getUserDataProperty('delete-instance')) {
    return pageInstance
  }
  let instanceErrors = []
  const addError = initAddError(instanceErrors)

  let instanceIn = pageData.getUserDataProperty('instance')
  if (instanceIn) {
    const _id = pageData.getUserDataProperty('_id')
    const runtimeInstance = getInstance(_id) || pageData.getUserDataProperty('runtimeInstance')
    if (!runtimeInstance) {
      addError('instance.notfound')
      pageInstance = setErrors(pageInstance, instanceErrors)
      return pageInstance
    }
    // const discreteInstance = getDiscreteInstance(_id)
    // const sourceInstance = getSourceInstance(_id, discreteInstance.$source)

    const validateInstance = (instance, validationPath = '') => {
      const errors = []
      const schema = getServiceSchema(instance._type)
      if (schema) {
        const instanceClone = expandInstance(instance, addError)

        const valid = ajv.validate(instance._type, instanceClone)
        if (!valid) {
          // const errorMessage = ajv.errorsText()
          //   .replace(/^data( |\.)/, () => '‘{control}’ ')
          //   .replace(/, data( |\.)/g, () => '\n\n‘{control}’ ')
          // addError(errorMessage, 'instance')
          const ajvErrors = ajv.errors.map(err => {
            const errObj = Object.assign({}, err)
            errObj.dataPath = (errObj.dataPath ? errObj.dataPath : '') + validationPath
            return errObj
          })
          errors.push(...ajvErrors)
        }
        const schemaProperties = schema.properties
        const arrayProperties = Object.keys(schemaProperties).filter(prop => {
          return schemaProperties[prop].type && schemaProperties[prop].type === 'array'
        })
        arrayProperties.forEach(arrayProp => {
          // schemaProperties[prop].items._name === 'definition.component'
          const instanceItems = instance[arrayProp]
          if (Array.isArray(instanceItems)) {
            instanceItems.forEach((instanceItem, index) => {
              if (instanceItem._id) {
                const nestedValidationPath = `${validationPath}.${arrayProp}[${index}]`
                errors.push(...validateInstance(instanceItem, nestedValidationPath))
              }
            })
          }
        })
      } else {
        addError('instance.validation.schema.missing', 'instance', {type: instance._type})
      }
      return errors
    }

    const schema = getServiceSchema(runtimeInstance._type)
    try {
      instanceIn = JSON.parse(instanceIn)
      try {
        if (_id !== instanceIn._id) {
          addError('instance.id.incorrect', 'instance')
        } else {
          const validationErrors = validateInstance(instanceIn)
          validationErrors.forEach(error => {
            // TODO - really only do on post?
            if (!POST && !error.dataPath && error.keyword === 'required') {
              pageInstance = produce(pageInstance, draft => {
                const schemaProperties = schema.properties
                const property = error.params.missingProperty
                const title = schemaProperties[property].title || property
                const infoMessage = title
                const infoUrl = pageData.pagesMethods.getUrl('admin.instance.property', {
                  _id,
                  property
                })
                draft.infoList = draft.infoList || []
                draft.infoList.push({
                  html: infoMessage,
                  href: infoUrl
                })
                return draft
              })
            } else {
              if (error.dataPath) {
                const dataPathInstance = get(instanceIn, error.dataPath.replace(/^\./, ''))
                const dataPathTitle = getInstanceTitle(dataPathInstance._id)
                const dataPathUrl = pageData.pagesMethods.getUrl('admin.instance', {
                  _id: dataPathInstance._id
                })
                addError(`Nested component ${dataPathTitle} ${error.message}==${dataPathUrl}`)
              } else {
                addError(`‘{control}’ ${error.dataPath ? error.dataPath : ''} ${error.message}`, 'instance')
              }
            }
          })
          if (pageInstance.infoList) {
            pageInstance = produce(pageInstance, draft => {
              // const instanceTypeTitle = schema.title || instanceIn._type
              // const instanceCategory = pageData.getUserDataProperty('instanceCategory').replace(/(.)/, m => m.toUpperCase())
              // draft.infoTitle = '`${instanceCategory}s of type ‘${instanceTypeTitle}’ require the following ${pageInstance.infoList.length > 1 ? 'properties' : 'property'} to be set`'
              // draft.infoDescription = 'description'
              draft.infoTitle = 'You need to set'
              return draft
            })
          }
        }
      } catch (e) {
        // Validation completely blew up
        // console.log(e)
        addError('instance.validation.fatal', 'instance')
      }
    } catch (e) {
      // JSON was not valid JSON
      addError('instance.parse', 'instance')
    }
  }
  pageInstance = setErrors(pageInstance, instanceErrors)

  if (pageInstance.errorList) {
    pageInstance = produce(pageInstance, draft => {
      // jp.query(draft, '$..[?(@._id === "admin.instance--instance")]')[0].open = true
    })
  }

  return pageInstance
}

instanceController.postValidation = (pageInstance, pageData, postRedirect) => {
  let errors = []
  const addError = initAddError(errors)

  const _id = pageData.getUserDataProperty('_id')

  if (pageData.getUserDataProperty('delete-instance')) {
    const _type = getInstanceProperty(_id, '_type')
    return deleteInstance(_id)
      .then(() => {
        return loadServiceData()
      })
      .then(() => {
        const redirectUrl = `/admin/instances/${_type}`
        postRedirect.redirect(redirectUrl)
      })
      .catch(err => {
        addError(`Failed to delete instance: ${err.toString()}`)
        pageInstance = setErrors(pageInstance, errors)
        postRedirect.failure(pageInstance, pageData)
      })
  }

  let instanceIn = pageData.getUserDataProperty('instance')
  instanceIn = JSON.parse(instanceIn)
  // const defaultInstance = getInstance(_id)
  const discreteInstance = getDiscreteInstance(_id)
  const sourceInstance = getSourceInstance(_id, discreteInstance.$source)

  if (JSON.stringify(instanceIn) === JSON.stringify(sourceInstance)) {
    return postRedirect.success()
  }
  return setInstance(instanceIn)
    .then(() => {
      return loadServiceData()
    })
    .then(() => {
      postRedirect.success()
    })
    .catch(err => {
      addError(`Failed to write instance: ${err.toString()}`, 'instance')
      pageInstance = setErrors(pageInstance, errors)
      // console.log(err)
      postRedirect.failure(pageInstance, pageData)
    })
}
module.exports = instanceController
