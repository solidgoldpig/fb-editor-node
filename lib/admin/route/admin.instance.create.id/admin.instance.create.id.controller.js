const jp = require('jsonpath')

const {
  getServiceInstances,
  createInstance,
  getInstance,
  // getSourceInstance,
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
  const addId = pageData.getUserDataProperty('addId') || ''
  const _type = pageData.getUserDataProperty('_type') || ''
  const pagePrefix = _type.startsWith('page.') ? 'page.' : ''
  let idPrefix = pagePrefix || (addId ? `${addId}--${_type}` : '')
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
  // if page && addId, then we're putting in steps
  // we could then have a positional arg too
  const _id = pageData.getUserDataProperty('_id') || idPrefix
  pageData.setUserDataProperty('_id', _id)

  return pageInstance
}

instanceCreateIdController.validate = (pageInstance, pageData) => {
  let instanceErrors = []
  const addError = initAddError(instanceErrors)

  const _id = pageData.getUserDataProperty('_id')

  if (_id) {
    const serviceInstances = getServiceInstances()
    const idMatches = jp.query(serviceInstances, `$..[?(@._id === "${_id}")]`)
    if (idMatches.length) {
      addError('_id.duplicate', '_id')
    // boom
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

  const {_type, _id, addId, addProperty, operation} = pageData.getUserData()

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

  createInstance(stubInstance, addOptions)
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
