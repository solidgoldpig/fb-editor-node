const {deepClone} = require('@ministryofjustice/fb-utils-node')

const {
  initAddError,
  setErrors
} = require('@ministryofjustice/fb-runner-node/lib/page/set-errors/set-errors')
const {
  loadServiceData,
  createInstance,
  temporaryFile,
  expandInstance
} = require('@ministryofjustice/fb-runner-node/lib/service-data/service-data')

const instanceController = require('../admin.instance/admin.instance.controller')

const instanceCreateController = {}

instanceCreateController.setData = (pageInstance, pageData, POST) => {
  let instanceErrors = []
  const addError = initAddError(instanceErrors)
  const {
    getUserDataProperty,
    setUserDataProperty
  } = pageData
  const _id = getUserDataProperty('_id')
  let sourceInstance
  if (POST) {
    sourceInstance = JSON.parse(getUserDataProperty('instance'))
  }
  try {
    const tmpFile = temporaryFile.get(_id)
    setUserDataProperty('temporaryFile', tmpFile)
    if (!POST) {
      sourceInstance = tmpFile.instance
    }
  } catch (e) {
    throw new Error(404)
  }

  const runtimeInstance = expandInstance(deepClone(sourceInstance), addError)
  setUserDataProperty('runtimeInstance', runtimeInstance)
  setUserDataProperty('sourceInstance', sourceInstance)
  setUserDataProperty('create', true)
  pageInstance = setErrors(pageInstance, instanceErrors)
  return instanceController.setData(pageInstance, pageData, POST)
}

instanceCreateController.validate = (pageInstance, pageData, POST, ajv) => {
  return instanceController.validate(pageInstance, pageData, POST, ajv)
}

instanceCreateController.postValidationFailure = (pageInstance, pageData, postRedirect) => {
  const {
    getUserDataProperty
  } = pageData
  let errors = []
  const addError = initAddError(errors)

  const _id = getUserDataProperty('_id')
  let instanceIn = getUserDataProperty('instance')
  instanceIn = JSON.parse(instanceIn)

  let tmpFile = getUserDataProperty('temporaryFile')
  tmpFile.instance = instanceIn

  temporaryFile.set(_id, tmpFile)
    // .then(() => {
    //   return loadServiceData()
    // })
    .then(() => {
      postRedirect.success()
    })
    .catch(err => {
      addError(`Failed to save temporary instance: ${err.toString()}`, 'instance')
      pageInstance = setErrors(pageInstance, errors)
      // console.log(err)
      postRedirect.failure(pageInstance, pageData)
    })
}

instanceCreateController.postValidation = (pageInstance, pageData, postRedirect) => {
  const {
    pagesMethods,
    getUserDataProperty
  } = pageData
  const {getUrl} = pagesMethods
  let errors = []
  const addError = initAddError(errors)

  // const _id = getUserDataProperty('_id')
  const _id = getUserDataProperty('_id')
  let instanceIn = getUserDataProperty('instance')
  instanceIn = JSON.parse(instanceIn)

  const {addId, addProperty, operation} = getUserDataProperty('temporaryFile')

  createInstance(instanceIn, {
    _id: addId,
    property: addProperty,
    operation
  })
    .then(() => {
      return loadServiceData()
    })
    .then(() => {
      temporaryFile.unset(_id)
      const url = getUrl('admin.instance', {_id})
      postRedirect.redirect(url)
    })
    .catch(err => {
      addError(`Failed to write instance: ${err.toString()}`, 'instance')
      pageInstance = setErrors(pageInstance, errors)
      postRedirect.failure(pageInstance, pageData)
    })
}

module.exports = instanceCreateController
