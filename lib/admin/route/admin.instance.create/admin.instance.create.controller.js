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
  'widthClassInput',
  'title',
  'extraComponents',
  'nextPage'
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
  console.log('pageData.getUserData', pageData.getUserData())
  const addInstance = pageData.getUserDataProperty('addInstance')
  const _type = pageData.getUserDataProperty('_type')
  const pagePrefix = _type.startsWith('page.') ? 'page.' : ''
  const idPrefix = pagePrefix || `${addInstance}--`
  // if page && addInstance, then we're putting in steps
  // we could then have a positional arg too
  const _id = pageData.getUserDataProperty('_id') || `${idPrefix}randoString`

  const schema = getServiceSchema(_type)
  const propertyTitle = schema.title
  const propertyDescription = schema.description

  const requiredInstanceProps = Object.keys(schema.properties)
    .filter(property => schema.required && schema.required.includes(property))
    .filter(property => property !== '_type')

  const makePropsList = (props) => {
    props.unshift('_isa')
    return props.map(instanceProp => {
      return `- ${instanceProp}`
    }).join('\n')
  }

  const instancePropsString = makePropsList(requiredInstanceProps)
  // const logicPropsString = makePropsList(logicProps)
  // const htmlPropsString = makePropsList(htmlProps)
  // const additionalPropsString = makePropsList(additionalProps)

  // TODO: get pagesMethods.getUrl
  const instanceTypeUrl = propertyTitle
  pageData.setUserDataProperty('instanceType', instanceTypeUrl)
  pageData.setUserDataProperty('instanceHint', propertyDescription || '')

  pageData.setUserDataProperty('instanceProperties', instancePropsString)

  if (!POST) {
    pageData.setUserDataProperty('instance', JSON.stringify({
      _id,
      _type
    }, null, 2))
  }

  return pageInstance
}

instanceController.validate = (pageInstance, pageData, POST, ajv) => {
  let instanceErrors = []
  const addError = initAddError(instanceErrors)

  let instanceIn = pageData.getUserDataProperty('instance')
  if (instanceIn) {
    // SURPLUS TO CREATE'S REQUIREMENTS
    // const _id = pageData.getUserDataProperty('_id')
    // const defaultInstance = getInstance(_id)
    // if (!defaultInstance) {
    //   addError('instance.notfound')
    //   pageInstance = setErrors(pageInstance, instanceErrors)
    //   return pageInstance
    // }
    // const discreteInstance = getDiscreteInstance(_id)
    // const sourceInstance = getSourceInstance(_id, discreteInstance.$source)

    const expandInstance = (instance) => {
      return produce(instance, draft => {
        if (draft._isa) {
          let [_isa, service] = draft._isa.split('=>').reverse()
          if (!service) {
            const isaDiscreteInstance = getDiscreteInstance(_isa)
            if (!isaDiscreteInstance) {
              addError('instance.isa.missing', 'instance')
              return
            }
            service = isaDiscreteInstance.$source
          }
          let isaSourceInstance = getSourceInstance(_isa, service)
          if (!isaSourceInstance) {
            addError('instance.isa.source.missing', 'instance')
          } else {
            isaSourceInstance = expandInstance(isaSourceInstance)
          }
          draft = Object.assign({}, isaSourceInstance, draft)
        }
        return draft
      })
    }

    const validateInstance = (instance, validationPath = '') => {
      const errors = []
      const schema = getServiceSchema(instance._type)
      if (schema) {
        const instanceClone = expandInstance(instance)

        const valid = ajv.validate(instance._type, instanceClone)
        if (!valid) {
          // const errorMessage = ajv.errorsText()
          //   .replace(/^data( |\.)/, () => '‘{control}’ ')
          //   .replace(/, data( |\.)/g, () => '\n\n‘{control}’ ')
          // addError(errorMessage, 'instance')
          const ajvErrors = ajv.errors.map(err => {
            const errObj = Object.assign({}, err)
            if (validationPath && errObj.dataPath) {
              errObj.dataPath = `${validationPath}${errObj.dataPath}`
            }
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

    try {
      instanceIn = JSON.parse(instanceIn)
      try {
        if (_id !== instanceIn._id) {
          addError('instance.id.incorrect', 'instance')
        } else {
          const validationErrors = validateInstance(instanceIn)
          validationErrors.forEach(error => {
            addError(`‘{control}’ ${error.dataPath ? error.dataPath : ''} ${error.message}`, 'instance')
          })
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
      jp.query(draft, '$..[?(@._id === "admin.instance--instance")]')[0].open = true
    })
  }

  return pageInstance
}

instanceController.postValidation = (pageInstance, pageData, postRedirect) => {
  return pageInstance
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
