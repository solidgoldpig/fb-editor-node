const instancePropertyController = {}
const jp = require('jsonpath')
const get = require('lodash.get')
const {default: produce} = require('immer')

const {
  initAddError,
  setErrors
} = require('@ministryofjustice/fb-runner-node/lib/page/set-errors/set-errors')

const {getPagesMethods, getNavigationPages} = require('@ministryofjustice/fb-runner-node/lib/middleware/routes-metadata/routes-metadata')

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
  getServiceInstances,
  deleteInstance
} = serviceData

instancePropertyController.setData = (pageInstance, pageData, POST, REFERRER) => {
  const {pagesMethods} = pageData
  const {getUrl} = pagesMethods
  const _id = pageData.getUserDataProperty('_id')
  const discreteInstance = getDiscreteInstance(_id) || {}
  // console.log(discreteInstance)
  if (_id === discreteInstance._id) {
    // throw new Error('Boom')
  }

  const runtimeInstance = getInstance(_id) || pageData.getUserDataProperty('runtimeInstance')
  if (!runtimeInstance || !runtimeInstance._type) {
    return pageInstance
  }

  return pageInstance
}

instancePropertyController.postValidation = (pageInstance, pageData, postRedirect) => {
  let errors = []
  const addError = initAddError(errors)

  return postRedirect.success()

  // const _id = pageData.getUserDataProperty('_id')

  // if (JSON.stringify(value) === JSON.stringify(sourceValue)) {
  //   // const instanceUrl = pageData.pagesMethods.getUrl('admin.instance', {_id})
  //   return postRedirect.redirect(instanceUrl)
  // }
  // return setInstanceProperty(_id, propertyLookup, value)
  //   .then(() => {
  //     return loadServiceData()
  //   })
  //   .then(() => {
  //     // const instanceUrl = pageData.pagesMethods.getUrl('admin.instance', {_id})
  //     postRedirect.redirect(instanceUrl)
  //     // postRedirect.success()
  //   })
  //   .catch(err => {
  //     addError(`Failed to write property instance: ${err.toString()}`, 'value')
  //     pageInstance = setErrors(pageInstance, errors)
  //     // console.log(err)
  //     postRedirect.failure(pageInstance, pageData)
  //   })
}

module.exports = instancePropertyController
