const jp = require('jsonpath')
const {default: produce} = require('immer')

const {
  getServiceInstances,
  temporaryFile
} = require('@ministryofjustice/fb-runner-node/lib/service-data/service-data')

const {
  initAddError,
  setErrors
} = require('@ministryofjustice/fb-runner-node/lib/page/set-errors/set-errors')

const instanceCreateIdController = {}

instanceCreateIdController.setData = (pageInstance, pageData) => {
  const addId = pageData.getUserDataProperty('addId') || ''
  const _type = pageData.getUserDataProperty('_type') || ''
  const pagePrefix = _type.startsWith('page.') ? 'page.' : ''
  const idPrefix = pagePrefix || (addId ? `${addId}--` : '')
  // if page && addId, then we're putting in steps
  // we could then have a positional arg too
  const _id = pageData.getUserDataProperty('_id') || `${idPrefix}randoString`
  pageData.setUserDataProperty('_id', _id)

  return pageInstance
}

instanceCreateIdController.validate = (pageInstance, pageData) => {
  const _id = pageData.getUserDataProperty('_id')
  if (_id) {
    const serviceInstances = getServiceInstances()
    const idMatches = jp.query(serviceInstances, `$..[?(@._id === "${_id}")]`)
    if (idMatches.length) {
      let instanceErrors = []
      const addError = initAddError(instanceErrors)
      addError('_id.duplicate', '_id')
      pageInstance = setErrors(pageInstance, instanceErrors)
    // boom
    }
  }
  return pageInstance
}

instanceCreateIdController.postValidation = (pageInstance, pageData, postRedirect) => {
  const {pagesMethods} = pageData
  const {getUrl} = pagesMethods
  let errors = []
  const addError = initAddError(errors)

  const {_type, _id, addId, addProperty, operation} = pageData.getUserData()

  temporaryFile.set(_id, {
    addId,
    addProperty,
    operation,
    instance: {
      _id,
      _type
    }
  })
  // create temporary file
  const redirectUrl = getUrl('admin.instance.create', {
    _id
  })
  postRedirect.redirect(redirectUrl)
}

module.exports = instanceCreateIdController
