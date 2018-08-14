const jp = require('jsonpath')
const {default: produce} = require('immer')

const {
  getServiceInstances,
  createInstance,
  getInstance,
  getInstanceTitle,
  getServiceSchema,
  // getSourceInstance,
  getInstancesByType,
  getSourceInstanceProperty,
  setInstanceProperty,
  loadServiceData
} = require('../../../service-data/service-data')

const {
  initAddError,
  setErrors
} = require('@ministryofjustice/fb-runner-node/lib/page/set-errors/set-errors')

const instanceCreateIdController = {}

instanceCreateIdController.setData = (pageInstance, pageData) => {
  const existingId = pageData.getUserDataProperty('existingId')
  const addId = pageData.getUserDataProperty('addId') || ''
  const _type = pageData.getUserDataProperty('_type') || ''
  const isPage = _type.startsWith('page.')
  let componentPrefix = _type
  // componentPrefix = componentPrefix.replace(/.*\.page\..*/, 'page.')
  componentPrefix = `${componentPrefix.replace(/.*\.(.+)/, '$1')}.`
  const pagePrefix = isPage ? 'page.' : ''
  let idPrefixType = 'stub'
  if (!pagePrefix && addId) {
    idPrefixType = 'auto'
  }
  pageData.setUserDataProperty('idPrefixType', idPrefixType)
  let idPrefix = pagePrefix || (addId ? `${addId}--${_type}` : componentPrefix)
  if (getInstance(idPrefix)) {
    if (idPrefix.match(/--\d+$/)) {
      idPrefix = idPrefix.replace(/--(\d+)$/, (m, m1) => {
        let numberSuffix = m1 * 1 + 1
        return `--${numberSuffix}`
      })
    } else {
      idPrefix += '--2'
    }
  }

  if (isPage) {
    const serviceInstances = getServiceInstances()
    const existingIds = getInstancesByType(_type)
      .filter(_id => {
        return !jp.query(serviceInstances, `$..[?(@.steps && @.steps.includes("${_id}"))]`).length
      })
    if (existingIds.length) {
      pageData.setUserDataProperty('existingIds', true)
      pageInstance = produce(pageInstance, draft => {
        const existingItems = existingIds.map((_id, index) => {
          const item = {
            _id: `admin.instance.create.id--existing--radios--${index}`,
            _type: 'radio',
            value: _id,
            label: getInstanceTitle(_id)
          }
          return item
        })
        const existingRadios = jp.query(draft, '$..[?(@._id == "admin.instance.create.id--existing--radios")]')[0]
        existingRadios.items = existingItems
        return draft
      })
    }
    if (!existingIds.includes(existingId)) {
      // throw existingId is gibberish
      // throw existingId already used
    }
  }

  // if page && addId, then we're putting in steps
  // we could then have a positional arg too
  const _id = existingId || pageData.getUserDataProperty('_id') || idPrefix
  pageData.setUserDataProperty('_id', _id)

  const schema = getServiceSchema(_type)
  const instanceTypeTitle = schema.title || _type
  pageData.setUserDataProperty('instanceTypeTitle', instanceTypeTitle)
  const instanceCategory = isPage ? 'page' : 'component'
  pageData.setUserDataProperty('instanceCategory', instanceCategory)

  return pageInstance
}

instanceCreateIdController.validate = (pageInstance, pageData, POST) => {
  let instanceErrors = []
  const addError = initAddError(instanceErrors)

  const existingId = pageData.getUserDataProperty('existingId')
  const _id = pageData.getUserDataProperty('_id') || existingId

  if (_id && POST) {
    const serviceInstances = getServiceInstances()
    const idMatches = jp.query(serviceInstances, `$..[?(@._id === "${_id}")]`)
    if (idMatches.length && !existingId) {
      addError('_id.duplicate', '_id')
    // boom
    } else if (existingId && !idMatches.length) {
      addError('_id.missing', '_id')
    }
    if (_id.match(/^(page|component)\.$/)) {
      addError('_id.stub.incomplete', '_id')
    }
    pageInstance = setErrors(pageInstance, instanceErrors)
  }
  return pageInstance
}

instanceCreateIdController.postValidation = (pageInstance, pageData, postRedirect) => {
  const {pagesMethods} = pageData
  const {getUrl} = pagesMethods
  // let errors = []
  // const addError = initAddError(errors)

  const {_type, existingId, addId, addProperty, operation} = pageData.getUserData()
  const _id = pageData.getUserDataProperty('_id') || existingId

  const stubInstance = {
    _id,
    _type
  }
  // $incomplete: true

  const redirectUrl = getUrl('admin.instance', {
    _id
  })
  let addOptions = {}
  if (addProperty !== 'steps') {
    addOptions = {
      _id: addId,
      property: addProperty,
      operation
    }
  }

  const preInstanceAddMethod = existingId ? () => {
    return Promise.resolve()
  } : createInstance

  preInstanceAddMethod(stubInstance, addOptions)
    .then(() => {
      if (addProperty === 'steps') {
        const parentInstance = getInstance(addId)
        // const parentSourceInstance = getSourceInstance(addId, parentInstance.$source)
        const steps = getSourceInstanceProperty(addId, addProperty, parentInstance.$source, [])
        const addMethod = operation || 'push'
        steps[addMethod](_id)
        return setInstanceProperty(addId, addProperty, steps)
        // console.log(addId, steps)
        // setInstanceProperty
      }
    })
    .then(() => {
      return loadServiceData()
    })
    .then(() => {
      postRedirect.redirect(redirectUrl)
    })

  // temporaryFile.set(_id, {
  //   addId,
  //   addProperty,
  //   operation,
  //   instance: {
  //     _id,
  //     _type
  //   }
  // })
  // create temporary file
  // const redirectUrl = getUrl('admin.instance.create', {
  //   _id
  // })
  // postRedirect.redirect(redirectUrl)
}

module.exports = instanceCreateIdController
