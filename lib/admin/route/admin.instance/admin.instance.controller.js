const instanceController = {}
const jp = require('jsonpath')
const {default: produce} = require('immer')

const {
  initAddError,
  setErrors
} = require('@ministryofjustice/fb-runner-node/lib/page/set-errors/set-errors')

const serviceData = require('@ministryofjustice/fb-runner-node/lib/service-data/service-data')
const {
  loadServiceData,
  getServiceInstances,
  getInstance,
  getDiscreteInstance,
  getSourceInstance,
  getInstanceProperty,
  setInstance,
  getServiceSchema
} = serviceData

const {getNavigation} = require('@ministryofjustice/fb-runner-node/lib/middleware/routes-metadata/routes-metadata')
// const {format} = require('@ministryofjustice/fb-runner-node/lib/format/format')

instanceController.setData = (pageInstance, pageData, POST) => {
  const {pagesMethods} = pageData
  const _id = pageData.getUserDataProperty('_id')
  const defaultInstance = getInstance(_id)
  if (!defaultInstance || !defaultInstance._type) {
    return pageInstance
  }
  const instanceType = defaultInstance._type

  const discreteInstance = getDiscreteInstance(_id)

  const {sourceInstances} = getServiceInstances()

  const instanceTypeUrl = `[${instanceType}](/admin/instances/${instanceType})`
  pageData.setUserDataProperty('instanceType', instanceTypeUrl)

  if (defaultInstance._type.startsWith('page.')) {
    const inSteps = jp.query(sourceInstances, `$..[?(@.steps && @.steps.includes("${_id}"))]`)[0]
    if (inSteps) {
      const pageUrl = pagesMethods.getUrl('admin.instance', {
        _id: inSteps._id
      })
      const stepsUrl = pagesMethods.getUrl('admin.instance.property', {
        _id: inSteps._id,
        property: 'steps'
      })
      const usedBy = `[${inSteps._id}](${pageUrl})`
      const usedWhere = `[steps](${stepsUrl})`
      pageData.setUserDataProperty('usedBy', usedBy)
      pageData.setUserDataProperty('usedWhere', usedWhere)
      pageData.setUserDataProperty('instanceUrl', defaultInstance.url)
    }
    const navigation = getNavigation(_id)
    const getNavTitle = (navId, direction) => {
      let navHeading = ''
      let navUrl = '/dev/null'
      if (navId) {
        navHeading = navId
        // navHeading = getInstanceProperty(navId, 'heading')
        if (!navHeading) {
          const components = getInstanceProperty(navId, 'components')
          if (components[0]) {
            navHeading = components[0].label || components[0].legend
          }
        }
        navUrl = pagesMethods.getUrl('admin.instance', {
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
        const nodeUrl = pagesMethods.getUrl('admin.instance', {
          _id
        })
        return `[${_id}](${nodeUrl})`
      })
      const usedBy = usedNodes.join(' > ')
      pageData.setUserDataProperty('usedBy', usedBy)
    }
  }

  const sourceInstance = getSourceInstance(_id, discreteInstance.$source)
  const schema = getServiceSchema(sourceInstance._type)
  const notSet = '*Not set*'
  const inherited = ' *Inherited*'
  const instanceProps = Object.keys(schema.properties)
    .filter(property => !property.match(/(_id|_type)/))
    .filter(property => !property.startsWith('multiple'))
    .map(property => {
      const propertySchema = schema.properties[property]
      const propertyTitle = propertySchema.title || property
      let value = sourceInstance[property]
      let valueSet = 'source'
      if (value === undefined && defaultInstance[property] !== undefined) {
        value = `${defaultInstance[property]}${inherited}`
        valueSet = '_isa'
      }
      if (value === undefined) {
        value = notSet
        valueSet = 'undefined'
      }
      if (Array.isArray(value)) {
        if (property === 'steps') {
          value = value.map(_id => {
            return `[${_id}](${pagesMethods.getUrl('admin.instance', {
              _id
            })})`
          })
        } else {
          value = value.map(obj => {
            if (typeof obj !== 'object') {
              return obj
            }
            const _id = obj._id
            return `[${_id}](${pagesMethods.getUrl('admin.instance', {
              _id
            })})`
          })
        }
        value = value.join(', ')
      } else if (typeof value === 'object' && value !== null) {
        value = JSON.stringify(value, null, 2)
      }

      // let nestedValues = {}
      if (propertySchema.properties) {
        //         value = ''
        //         Object.keys(propertySchema.properties).forEach(nestedProp => {
        //           console.log({nestedProp})
        //           let nestedValue = defaultInstance[property] ? defaultInstance[property][nestedProp] : notSet
        //           let nestedPropTitle = propertySchema.properties[nestedProp].title || nestedProp
        //           let propPath = `${property}.${nestedProp}`
        //           nestedValue = `- [${nestedPropTitle}](${pagesMethods.getUrl('admin.instance.property', {
        //             _id,
        //             property: propPath
        //           })})

        // ${nestedValue}
        // `
        //           nestedValues[nestedProp] = nestedValue
        //           value += nestedValue
        //         })
      }
      return {
        property: propertyTitle,
        value,
        valueSet,
        url: pagesMethods.getUrl('admin.instance.property', {
          _id,
          property
        })
      }
    })

  const instancePropsString = instanceProps.map(instanceProp => {
    return `- [${instanceProp.property}](${instanceProp.url})  
${instanceProp.value}`
  }).join('\n')

  pageData.setUserDataProperty('instanceProperties', instancePropsString)
  pageData.setUserDataProperty('expandedInstance', JSON.stringify(defaultInstance, null, 2))
  if (!POST) {
    pageData.setUserDataProperty('instance', JSON.stringify(sourceInstance, null, 2))
  }

  return pageInstance
}

instanceController.validate = (pageInstance, pageData, POST, ajv) => {
  let errors = []
  const addError = initAddError(errors)

  let instanceIn = pageData.getUserDataProperty('instance')
  if (instanceIn) {
    const _id = pageData.getUserDataProperty('_id')
    const defaultInstance = getInstance(_id)
    if (!defaultInstance) {
      addError('instance.notfound')
      pageInstance = setErrors(pageInstance, errors)
      return pageInstance
    }
    const discreteInstance = getDiscreteInstance(_id)
    const sourceInstance = getSourceInstance(_id, discreteInstance.$source)

    try {
      instanceIn = JSON.parse(instanceIn)
      try {
        const schema = getServiceSchema(sourceInstance._type)
        if (schema) {
          const valid = ajv.validate(sourceInstance._type, instanceIn)
          if (!valid) {
            // const errorMessage = ajv.errorsText()
            //   .replace(/^data( |\.)/, () => '‘{control}’ ')
            //   .replace(/, data( |\.)/g, () => '\n\n‘{control}’ ')
            // addError(errorMessage, 'instance')
            ajv.errors.forEach(error => {
              addError(`‘{control}’ ${error.dataPath ? error.dataPath : ''} ${error.message}`, 'instance')
            })
            // addError('instance.invalid', 'instance')
          }
        }
      } catch (e) {
        // console.log({instanceIn}, sourceInstance._type)
        // console.log(e)
        addError('instance.validation.blewup', 'instance')
      }
    } catch (e) {
      addError('instance.parse', 'instance')
    }
  }
  pageInstance = setErrors(pageInstance, errors)

  if (pageInstance.errorList) {
    pageInstance = produce(pageInstance, draft => {
      jp.query(draft, '$..[?(@._id === "admin.instance--instance")]')[0].open = true
    })
  }

  return pageInstance
}

instanceController.postValidation = (pageInstance, pageData, postRedirect) => {
  let errors = []
  const addError = initAddError(errors)

  const _id = pageData.getUserDataProperty('_id')
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
